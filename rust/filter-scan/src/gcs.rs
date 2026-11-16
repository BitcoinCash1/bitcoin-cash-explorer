//! BIP158 Golomb-coded sets as committed filters serve them: N as a
//! `CompactSize`, then the sorted values' Golomb-Rice coded differences, most
//! significant bit first. An item maps to [0, N*M) by SipHash-2-4 keyed with
//! the first 16 bytes of the block hash. The same matcher as the backend's
//! `gcs.ts`, for many items at once.

use std::fmt;

pub const P: u32 = 19;
pub const M: u64 = 784_931;

/// Why a filter could not be read as far as the items needed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GcsError {
    /// The item count is cut short.
    Count,
    /// The filter has fewer bits than its item count needs.
    Short,
    /// The filter ends inside a value's quotient.
    Value,
    /// The filter ends inside a value's remainder.
    Remainder,
}

impl fmt::Display for GcsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Count => "Filter ends inside its item count",
            Self::Short => "Filter is shorter than its item count",
            Self::Value => "Filter ends inside a value",
            Self::Remainder => "Filter ends inside a remainder",
        })
    }
}

impl std::error::Error for GcsError {}

/// The `SipHash` key of a block's filter: the first 16 bytes of its hash.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SipKey(pub u64, pub u64);

impl SipKey {
    #[must_use]
    pub fn of_block(hash: &[u8; 32]) -> Self {
        Self(le_u64(&hash[..8]), le_u64(&hash[8..16]))
    }
}

fn le_u64(bytes: &[u8]) -> u64 {
    u64::from_le_bytes(bytes.try_into().expect("8 bytes"))
}

/// SipHash-2-4.
#[must_use]
pub fn siphash24(key: SipKey, data: &[u8]) -> u64 {
    let mut v = [
        key.0 ^ 0x736f_6d65_7073_6575,
        key.1 ^ 0x646f_7261_6e64_6f6d,
        key.0 ^ 0x6c79_6765_6e65_7261,
        key.1 ^ 0x7465_6462_7974_6573,
    ];
    let round = |v: &mut [u64; 4]| {
        v[0] = v[0].wrapping_add(v[1]);
        v[1] = v[1].rotate_left(13) ^ v[0];
        v[0] = v[0].rotate_left(32);
        v[2] = v[2].wrapping_add(v[3]);
        v[3] = v[3].rotate_left(16) ^ v[2];
        v[0] = v[0].wrapping_add(v[3]);
        v[3] = v[3].rotate_left(21) ^ v[0];
        v[2] = v[2].wrapping_add(v[1]);
        v[1] = v[1].rotate_left(17) ^ v[2];
        v[2] = v[2].rotate_left(32);
    };
    let absorb = |v: &mut [u64; 4], m: u64| {
        v[3] ^= m;
        round(v);
        round(v);
        v[0] ^= m;
    };
    let (words, tail) = data.as_chunks::<8>();
    for word in words {
        absorb(&mut v, u64::from_le_bytes(*word));
    }
    let mut last = [0u8; 8];
    last[..tail.len()].copy_from_slice(tail);
    // Only the length's low byte is mixed in, as the reference does.
    #[allow(clippy::cast_possible_truncation)]
    {
        last[7] = data.len() as u8;
    }
    absorb(&mut v, u64::from_le_bytes(last));
    v[2] ^= 0xff;
    for _ in 0..4 {
        round(&mut v);
    }
    v[0] ^ v[1] ^ v[2] ^ v[3]
}

/// The value an item has in a filter of `n` items under the block's key.
#[must_use]
pub fn hash_to_range(key: SipKey, n: u64, item: &[u8]) -> u64 {
    let range = u128::from(n) * u128::from(M);
    #[allow(clippy::cast_possible_truncation)]
    {
        ((u128::from(siphash24(key, item)) * range) >> 64) as u64
    }
}

/// Reads an N-prefixed filter's count and checks it can hold that many values.
fn header(filter: &[u8]) -> Result<(u64, &[u8]), GcsError> {
    let (&first, rest) = filter.split_first().ok_or(GcsError::Count)?;
    let width = match first {
        0xfd => 2,
        0xfe => 4,
        0xff => 8,
        _ => return check(u64::from(first), rest),
    };
    let bytes = rest.get(..width).ok_or(GcsError::Count)?;
    let mut le = [0u8; 8];
    le[..width].copy_from_slice(bytes);
    check(u64::from_le_bytes(le), &rest[width..])
}

fn check(n: u64, data: &[u8]) -> Result<(u64, &[u8]), GcsError> {
    // Every value takes at least P + 1 bits.
    if u128::from(n) * u128::from(P + 1) > data.len() as u128 * 8 {
        return Err(GcsError::Short);
    }
    Ok((n, data))
}

/// The item count of an N-prefixed filter.
///
/// # Errors
///
/// When the count is cut short or the filter cannot hold that many values.
#[cfg(test)]
pub fn count(filter: &[u8]) -> Result<u64, GcsError> {
    header(filter).map(|(n, _)| n)
}

/// Reads the Golomb-Rice coded values one by one.
struct Values<'a> {
    data: &'a [u8],
    pos: usize,
    end: usize,
    last: u64,
}

impl<'a> Values<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            pos: 0,
            end: data.len() * 8,
            last: 0,
        }
    }

    /// The 64 bits from `pos`, zeros past the end of the data.
    fn window(&self) -> u64 {
        let at = self.pos >> 3;
        let word = self.data.get(at..at + 8).map_or_else(
            || {
                let mut padded = [0u8; 8];
                let tail = &self.data[at.min(self.data.len())..];
                padded[..tail.len()].copy_from_slice(tail);
                u64::from_be_bytes(padded)
            },
            |bytes| u64::from_be_bytes(bytes.try_into().expect("8 bytes")),
        );
        word << (self.pos & 7)
    }

    fn next(&mut self) -> Result<u64, GcsError> {
        // The quotient in unary: ones ended by a zero.
        let mut quotient = 0u64;
        loop {
            if self.pos >= self.end {
                return Err(GcsError::Value);
            }
            let valid = (64 - (self.pos & 7)).min(self.end - self.pos);
            let ones = (!self.window()).leading_zeros() as usize;
            if ones < valid {
                quotient += ones as u64;
                self.pos += ones + 1;
                break;
            }
            quotient += valid as u64;
            self.pos += valid;
        }
        if self.pos + P as usize > self.end {
            return Err(GcsError::Remainder);
        }
        let remainder = self.window() >> (64 - P);
        self.pos += P as usize;
        self.last = self
            .last
            .wrapping_add((quotient << P).wrapping_add(remainder));
        Ok(self.last)
    }
}

/// Every value of an N-prefixed filter, in order.
///
/// # Errors
///
/// When the filter ends before its last value.
#[cfg(test)]
pub fn values(filter: &[u8]) -> Result<Vec<u64>, GcsError> {
    let (n, data) = header(filter)?;
    let mut reader = Values::new(data);
    (0..n).map(|_| reader.next()).collect()
}

/// Tests many items against filters, one filter at a time.
pub struct Matcher<'a> {
    items: &'a [Vec<u8>],
    targets: Vec<(u64, usize)>,
}

impl<'a> Matcher<'a> {
    #[must_use]
    pub fn new(items: &'a [Vec<u8>]) -> Self {
        Self {
            items,
            targets: Vec::with_capacity(items.len()),
        }
    }

    /// Calls `hit` with the index of every item an N-prefixed filter of the
    /// block may hold (false positives at rate 1/M). Values are read only as
    /// far as the largest item needs, as `gcsMatch` does for one item, so a
    /// filter cut short past that point is not an error.
    ///
    /// # Errors
    ///
    /// When the filter ends before the values the items need.
    pub fn matches(
        &mut self,
        filter: &[u8],
        key: SipKey,
        mut hit: impl FnMut(usize),
    ) -> Result<(), GcsError> {
        let (n, data) = header(filter)?;
        if n == 0 || self.items.is_empty() {
            return Ok(());
        }
        self.targets.clear();
        self.targets.extend(
            self.items
                .iter()
                .enumerate()
                .map(|(i, item)| (hash_to_range(key, n, item), i)),
        );
        self.targets.sort_unstable();
        let mut reader = Values::new(data);
        let mut next = 0;
        for _ in 0..n {
            let value = reader.next()?;
            while next < self.targets.len() && self.targets[next].0 < value {
                next += 1;
            }
            while next < self.targets.len() && self.targets[next].0 == value {
                hit(self.targets[next].1);
                next += 1;
            }
            if next == self.targets.len() {
                break;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// The N-prefixed encoding of sorted values, as BIP158 serializes them.
    pub(crate) fn encode(values: &[u64]) -> Vec<u8> {
        let mut bits = Vec::new();
        let mut last = 0;
        for &value in values {
            let delta = value - last;
            last = value;
            bits.extend(std::iter::repeat_n(
                true,
                usize::try_from(delta >> P).unwrap(),
            ));
            bits.push(false);
            bits.extend((0..P).rev().map(|i| (delta >> i) & 1 == 1));
        }
        let mut out = compact_size(values.len() as u64);
        out.extend(bits.chunks(8).map(|byte| {
            byte.iter()
                .enumerate()
                .fold(0u8, |acc, (i, &bit)| acc | (u8::from(bit) << (7 - i)))
        }));
        out
    }

    fn compact_size(n: u64) -> Vec<u8> {
        match n {
            0..0xfd => vec![u8::try_from(n).unwrap()],
            0xfd..=0xffff => [&[0xfd][..], &u16::try_from(n).unwrap().to_le_bytes()].concat(),
            _ => [&[0xfe][..], &u32::try_from(n).unwrap().to_le_bytes()].concat(),
        }
    }

    pub(crate) fn hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    /// Xorshift, for repeatable random tests.
    pub(crate) struct Rng(pub u64);

    impl Rng {
        pub(crate) fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
    }

    /// A filter of `n` values that holds the values of `present` and random others.
    pub(crate) fn filter_with(rng: &mut Rng, key: SipKey, n: u64, present: &[Vec<u8>]) -> Vec<u8> {
        let mut set: Vec<u64> = present
            .iter()
            .map(|item| hash_to_range(key, n, item))
            .collect();
        set.sort_unstable();
        set.dedup();
        let wanted = usize::try_from(n).unwrap();
        while set.len() < wanted {
            let mut more: Vec<u64> = (set.len()..wanted).map(|_| rng.next() % (n * M)).collect();
            more.retain(|value| set.binary_search(value).is_err());
            set.extend(more);
            set.sort_unstable();
            set.dedup();
        }
        encode(&set)
    }

    fn matched(filter: &[u8], key: SipKey, items: &[Vec<u8>]) -> Vec<usize> {
        let mut hits = Vec::new();
        Matcher::new(items)
            .matches(filter, key, |i| hits.push(i))
            .unwrap();
        hits.sort_unstable();
        hits
    }

    #[test]
    fn siphash_equals_the_reference_client() {
        // Key 00..0f, as the backend's test vectors from the reference light client.
        let key = SipKey(0x0706_0504_0302_0100, 0x0f0e_0d0c_0b0a_0908);
        let count = |n: u8| (0..n).collect::<Vec<u8>>();
        for (data, hash) in [
            (count(0), 0x726f_db47_dd0e_0e31),
            (count(7), 0xab02_00f5_8b01_d137),
            (count(8), 0x93f5_f579_9a93_2462),
            (count(15), 0xa129_ca61_49be_45e5),
            (count(32), 0x7127_512f_72f2_7cce),
            (count(63), 0x958a_324c_eb06_4572),
        ] {
            assert_eq!(siphash24(key, &data), hash, "{} bytes", data.len());
        }
    }

    #[test]
    fn the_bip158_testnet_genesis_filter_matches_its_coinbase_script() {
        let mut hash: [u8; 32] =
            hex("000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943")
                .try_into()
                .unwrap();
        hash.reverse();
        let key = SipKey::of_block(&hash);
        let filter = hex("019dfca8");
        assert_eq!(values(&filter).unwrap(), [769_941]);
        let script = hex(concat!(
            "4104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112",
            "de5c384df7ba0b8d578a4c702b6bf11d5fac"
        ));
        assert_eq!(hash_to_range(key, 1, &script), 769_941);
        assert_eq!(matched(&filter, key, &[script, hex("51")]), [0]);
    }

    #[test]
    fn values_round_trip_and_a_filter_holds_its_items() {
        let mut rng = Rng(0x9e37_79b9_7f4a_7c15);
        for n in [1u64, 2, 5, 100, 1850, 70_000] {
            let key = SipKey(rng.next(), rng.next());
            let items: Vec<Vec<u8>> = (0..n.min(50))
                .map(|_| rng.next().to_le_bytes().repeat(4))
                .collect();
            let filter = filter_with(&mut rng, key, n, &items);
            let all = values(&filter).unwrap();
            assert_eq!(all.len() as u64, n);
            assert_eq!(count(&filter).unwrap(), n);
            assert_eq!(encode(&all), filter);
            assert_eq!(
                matched(&filter, key, &items),
                (0..items.len()).collect::<Vec<_>>(),
                "n {n}"
            );
        }
    }

    #[test]
    fn many_items_at_once_match_as_each_alone() {
        let mut rng = Rng(7);
        for _ in 0..300 {
            let present = usize::try_from(rng.next() % 6).unwrap();
            let n = (rng.next() % 300 + 1).max(present as u64);
            let key = SipKey(rng.next(), rng.next());
            let mut items: Vec<Vec<u8>> =
                (0..20).map(|_| rng.next().to_le_bytes().to_vec()).collect();
            items.push(items[3].clone());
            let filter = filter_with(&mut rng, key, n, &items[..present.min(items.len())]);
            let alone: Vec<usize> = (0..items.len())
                .filter(|&i| !matched(&filter, key, &items[i..=i]).is_empty())
                .collect();
            assert_eq!(matched(&filter, key, &items), alone);
            assert!((0..present).all(|i| alone.contains(&i)));
        }
    }

    #[test]
    fn a_filter_cut_short_fails_only_when_its_missing_values_are_needed() {
        // 50 values 700,000 apart: 21 bits each, 1,050 bits; 128 bytes hold 1,024.
        let n = 50;
        let filter = encode(&(1..=n).map(|i| i * 700_000).collect::<Vec<_>>());
        let cut = &filter[..129];
        assert!(values(cut).is_err());
        assert_eq!(values(&filter[..100]), Err(GcsError::Short));
        let mut rng = Rng(3);
        let key = SipKey(rng.next(), rng.next());
        let item = |rng: &mut Rng, wanted: &dyn Fn(u64) -> bool| loop {
            let item = rng.next().to_le_bytes().to_vec();
            if wanted(hash_to_range(key, n, &item)) {
                return item;
            }
        };
        let early = item(&mut rng, &|t| t < 20 * 700_000);
        let late = item(&mut rng, &|t| t > 49 * 700_000);
        assert!(Matcher::new(std::slice::from_ref(&early))
            .matches(cut, key, |_| ())
            .is_ok());
        assert!(Matcher::new(std::slice::from_ref(&late))
            .matches(cut, key, |_| ())
            .is_err());
        assert!(Matcher::new(&[early, late])
            .matches(cut, key, |_| ())
            .is_err());
        assert_eq!(count(&[0xfd, 1]), Err(GcsError::Count));
        assert_eq!(count(&[]), Err(GcsError::Count));
        assert!(matched(&[0], key, &[vec![1]]).is_empty());
    }
}
