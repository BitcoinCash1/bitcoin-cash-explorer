//! The backend's filter store as `filter-store.ts` writes it: filters.dat
//! holds the filters back to back, index.dat one 100 byte record per height
//! (block hash, Merkle root, filter header, filter length as u32 LE). A
//! stored filter is the 32 byte root of the block's leaves, then the
//! N-prefixed GCS. A scan reads the records of its heights, then the filters
//! in chunks of about `CHUNK` bytes that the threads take in turn.

use std::fmt;
use std::fs::File;
use std::io;
use std::ops::Range;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::thread;

use crate::gcs::{GcsError, Matcher, SipKey};

pub const RECORD: usize = 100;
const LENGTH: usize = 96;
const ROOT: usize = 32;
/// Filter bytes a thread reads and tests at a time.
const CHUNK: u64 = 2 << 20;
/// Records a thread reads at a time.
const RECORDS_PER_READ: usize = 10_000;

#[derive(Debug)]
pub enum ScanError {
    Io(io::Error),
    Filter { height: u32, error: GcsError },
}

impl fmt::Display for ScanError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(e) if e.kind() == io::ErrorKind::UnexpectedEof => {
                f.write_str("The filter store ended early")
            }
            Self::Io(e) => write!(f, "Reading the filter store: {e}"),
            Self::Filter { height, error } => {
                write!(f, "{error} (stored filter at height {height})")
            }
        }
    }
}

impl std::error::Error for ScanError {}

impl From<io::Error> for ScanError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

/// Which of `keys` the filters of heights `from..to` may hold.
pub struct Scan {
    pub index_file: PathBuf,
    pub filters_file: PathBuf,
    pub heights: Range<u32>,
    /// Where the filter of the first height starts in filters.dat.
    pub filter_offset: u64,
    pub keys: Vec<Vec<u8>>,
}

/// A block's filter: where it is in filters.dat and its `SipHash` key.
struct Entry {
    key: SipKey,
    offset: u64,
    length: u32,
}

impl Scan {
    /// For each key, the heights whose filter may hold it, in order.
    ///
    /// # Errors
    ///
    /// When a file cannot be read as far as the heights go, or a filter ends
    /// before the values the keys need (then the error of the lowest such height).
    pub fn run(&self, threads: usize) -> Result<Vec<Vec<u32>>, ScanError> {
        let entries = self.entries(threads)?;
        let chunks = chunks(&entries);
        let next = AtomicUsize::new(0);
        let failed = AtomicBool::new(false);
        let found = thread::scope(|scope| {
            let workers: Vec<_> = (0..threads.clamp(1, chunks.len().max(1)))
                .map(|_| scope.spawn(|| self.test_chunks(&entries, &chunks, &next, &failed)))
                .collect();
            workers
                .into_iter()
                .map(|worker| worker.join().expect("scan thread panicked"))
                .collect::<Vec<_>>()
        });
        let (hits, errors): (Vec<_>, Vec<_>) = found.into_iter().partition(Result::is_ok);
        // A file read short first, then the damaged filter of the lowest height.
        if let Some(error) = errors
            .into_iter()
            .filter_map(Result::err)
            .min_by_key(|error| match error {
                ScanError::Io(_) => 0,
                ScanError::Filter { height, .. } => u64::from(*height) + 1,
            })
        {
            return Err(error);
        }
        let mut heights = vec![Vec::new(); self.keys.len()];
        for (key, offset) in hits.into_iter().filter_map(Result::ok).flatten() {
            heights[key].push(self.heights.start + offset);
        }
        for list in &mut heights {
            list.sort_unstable();
        }
        Ok(heights)
    }

    /// The records of the scan's heights, read by the threads part by part.
    fn entries(&self, threads: usize) -> Result<Vec<Entry>, ScanError> {
        let count = self.heights.len();
        let part = count.div_ceil(threads.max(1)).max(RECORDS_PER_READ);
        let parts: Vec<Range<usize>> = (0..count)
            .step_by(part)
            .map(|start| start..(start + part).min(count))
            .collect();
        let read = thread::scope(|scope| {
            let workers: Vec<_> = parts
                .iter()
                .map(|range| scope.spawn(|| self.read_records(range.clone())))
                .collect();
            workers
                .into_iter()
                .map(|worker| worker.join().expect("index thread panicked"))
                .collect::<Vec<_>>()
        });
        let mut entries = Vec::with_capacity(count);
        let mut offset = self.filter_offset;
        for part in read {
            for mut entry in part? {
                entry.offset = offset;
                offset += u64::from(entry.length);
                entries.push(entry);
            }
        }
        Ok(entries)
    }

    /// Records of the heights `range` (relative to the scan's first), with no offsets yet.
    fn read_records(&self, range: Range<usize>) -> Result<Vec<Entry>, ScanError> {
        let file = File::open(&self.index_file)?;
        let mut buffer = vec![0u8; RECORDS_PER_READ.min(range.len()) * RECORD];
        let mut entries = Vec::with_capacity(range.len());
        let first = self.heights.start as usize;
        for start in range.clone().step_by(RECORDS_PER_READ) {
            let n = RECORDS_PER_READ.min(range.end - start);
            let bytes = &mut buffer[..n * RECORD];
            read_exact_at(&file, bytes, ((first + start) * RECORD) as u64)?;
            entries.extend(bytes.as_chunks::<RECORD>().0.iter().map(|record| Entry {
                key: SipKey::of_block(record[..32].try_into().expect("32 bytes")),
                offset: 0,
                length: u32::from_le_bytes(record[LENGTH..RECORD].try_into().expect("4 bytes")),
            }));
        }
        Ok(entries)
    }

    /// Takes chunks until none are left, returning (key, height offset) of every hit.
    fn test_chunks(
        &self,
        entries: &[Entry],
        chunks: &[Range<usize>],
        next: &AtomicUsize,
        failed: &AtomicBool,
    ) -> Result<Vec<(usize, u32)>, ScanError> {
        let file = File::open(&self.filters_file)?;
        let mut matcher = Matcher::new(&self.keys);
        let mut buffer = Vec::new();
        let mut hits = Vec::new();
        loop {
            let at = next.fetch_add(1, Ordering::Relaxed);
            if at >= chunks.len() || failed.load(Ordering::Relaxed) {
                return Ok(hits);
            }
            let blocks = &entries[chunks[at].clone()];
            let base = blocks[0].offset;
            let last = &blocks[blocks.len() - 1];
            let size = usize::try_from(last.offset + u64::from(last.length) - base)
                .expect("chunk fits in memory");
            buffer.resize(size, 0);
            if let Err(e) = read_exact_at(&file, &mut buffer, base) {
                failed.store(true, Ordering::Relaxed);
                return Err(e.into());
            }
            for (i, block) in blocks.iter().enumerate() {
                let start = usize::try_from(block.offset - base).expect("within the chunk");
                let filter = &buffer[start..start + block.length as usize];
                if filter.len() <= ROOT {
                    continue;
                }
                let offset = u32::try_from(chunks[at].start + i).expect("heights are u32");
                if let Err(error) =
                    matcher.matches(&filter[ROOT..], block.key, |key| hits.push((key, offset)))
                {
                    failed.store(true, Ordering::Relaxed);
                    let height = self.heights.start + offset;
                    return Err(ScanError::Filter { height, error });
                }
            }
        }
    }
}

/// Consecutive runs of blocks of about `CHUNK` filter bytes, at least one block each.
fn chunks(entries: &[Entry]) -> Vec<Range<usize>> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut bytes = 0;
    for (i, entry) in entries.iter().enumerate() {
        if i > start && bytes + u64::from(entry.length) > CHUNK {
            out.push(start..i);
            start = i;
            bytes = 0;
        }
        bytes += u64::from(entry.length);
    }
    if start < entries.len() {
        out.push(start..entries.len());
    }
    out
}

/// Reads exactly `buffer.len()` bytes at `offset`, without moving a shared cursor.
fn read_exact_at(file: &File, buffer: &mut [u8], offset: u64) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::FileExt;
        file.read_exact_at(buffer, offset)
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::FileExt;
        let mut done = 0;
        while done < buffer.len() {
            match file.seek_read(&mut buffer[done..], offset + done as u64) {
                Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
                Ok(n) => done += n,
                Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gcs::tests::{filter_with, Rng};
    use std::io::Write;

    struct Store {
        dir: PathBuf,
        filters: Vec<(SipKey, Vec<u8>)>,
    }

    impl Drop for Store {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    /// A store of `blocks` filters of random sizes, each holding a few of `keys`.
    fn store(name: &str, rng: &mut Rng, blocks: usize, keys: &[Vec<u8>]) -> Store {
        let dir = std::env::temp_dir().join(format!("filter-scan-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut index = File::create(dir.join("index.dat")).unwrap();
        let mut data = File::create(dir.join("filters.dat")).unwrap();
        let mut filters = Vec::new();
        for _ in 0..blocks {
            let mut hash = [0u8; 32];
            for byte in &mut hash {
                *byte = rng.next().to_le_bytes()[0];
            }
            let key = SipKey::of_block(&hash);
            let n = rng.next() % 400;
            let present: Vec<Vec<u8>> = keys
                .iter()
                .filter(|_| rng.next().is_multiple_of(5))
                .cloned()
                .collect();
            let mut filter = vec![0xab; ROOT];
            filter.extend(filter_with(rng, key, n.max(present.len() as u64), &present));
            let mut record = [0u8; RECORD];
            record[..32].copy_from_slice(&hash);
            record[LENGTH..].copy_from_slice(&u32::try_from(filter.len()).unwrap().to_le_bytes());
            index.write_all(&record).unwrap();
            data.write_all(&filter).unwrap();
            filters.push((key, filter));
        }
        Store { dir, filters }
    }

    fn scan(store: &Store, heights: Range<u32>, keys: &[Vec<u8>]) -> Scan {
        let offset = store.filters[..heights.start as usize]
            .iter()
            .map(|(_, f)| f.len() as u64)
            .sum();
        Scan {
            index_file: store.dir.join("index.dat"),
            filters_file: store.dir.join("filters.dat"),
            heights,
            filter_offset: offset,
            keys: keys.to_vec(),
        }
    }

    fn one_by_one(store: &Store, heights: Range<u32>, keys: &[Vec<u8>]) -> Vec<Vec<u32>> {
        keys.iter()
            .map(|key| {
                heights
                    .clone()
                    .filter(|&h| {
                        let (sip, filter) = &store.filters[h as usize];
                        let mut hit = false;
                        Matcher::new(std::slice::from_ref(key))
                            .matches(&filter[ROOT..], *sip, |_| hit = true)
                            .unwrap();
                        hit
                    })
                    .collect()
            })
            .collect()
    }

    #[test]
    fn a_scan_on_many_threads_finds_what_each_filter_alone_holds() {
        let mut rng = Rng(11);
        let keys: Vec<Vec<u8>> = (0..12)
            .map(|_| rng.next().to_le_bytes().repeat(4))
            .collect();
        let store = store("threads", &mut rng, 3000, &keys);
        for (heights, threads) in [
            (0..3000, 1),
            (0..3000, 7),
            (17..2999, 32),
            (2990..3000, 4),
            (5..5, 3),
        ] {
            let expected = one_by_one(&store, heights.clone(), &keys);
            assert_eq!(
                scan(&store, heights.clone(), &keys).run(threads).unwrap(),
                expected,
                "{heights:?}"
            );
        }
        assert!(scan(&store, 0..3000, &keys)
            .run(4)
            .unwrap()
            .iter()
            .all(|h| h.len() > 400));
    }

    #[test]
    fn heights_past_the_files_and_a_damaged_filter_are_errors() {
        let mut rng = Rng(5);
        let keys = vec![rng.next().to_le_bytes().to_vec()];
        let store = store("errors", &mut rng, 50, &keys);
        let past = scan(&store, 0..51, &keys).run(2).unwrap_err();
        assert_eq!(past.to_string(), "The filter store ended early");
        // A filter whose count promises more values than its bytes hold.
        let damaged = (20..50)
            .find(|&h| store.filters[h].1.len() >= ROOT + 9)
            .unwrap();
        let at =
            usize::try_from(scan(&store, u32::try_from(damaged).unwrap()..50, &keys).filter_offset)
                .unwrap()
                + ROOT;
        let mut data = std::fs::read(store.dir.join("filters.dat")).unwrap();
        data[at..at + 9].fill(0xff);
        std::fs::write(store.dir.join("filters.dat"), data).unwrap();
        match scan(&store, 0..50, &keys).run(3) {
            Err(ScanError::Filter {
                height,
                error: GcsError::Short,
            }) if height as usize == damaged => {}
            other => panic!("{other:?}"),
        }
    }
}
