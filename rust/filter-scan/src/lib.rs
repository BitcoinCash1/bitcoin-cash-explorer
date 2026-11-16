//! The filter scan of the BCH Explorer's p2p backend: which blocks' script
//! filters may hold any of a set of keys, read from the backend's flat-file
//! filter store on all cores. The backend's TypeScript checks the files it
//! names here stayed the same during the scan.

#![warn(clippy::all)]
#![warn(clippy::pedantic)]

mod gcs;
mod store;

use std::num::NonZeroUsize;
use std::path::PathBuf;

use napi::bindgen_prelude::{AsyncTask, Buffer, Env, Error, Result, Task};
use napi_derive::napi;

/// What to scan: a run of heights of the store and the keys to test.
#[napi(object)]
pub struct ScanRequest {
    /// The store's index.dat: one 100 byte record per height.
    pub index_file: String,
    /// The store's filters.dat: the filters back to back.
    pub filters_file: String,
    /// The first height scanned.
    pub from: u32,
    /// The height after the last one scanned.
    pub to: u32,
    /// Where the filter of height `from` starts in filters.dat.
    pub filter_offset: i64,
    /// The items to test, such as 32 byte script keys.
    pub keys: Vec<Buffer>,
}

/// A scan run off the JavaScript thread; an invalid request rejects.
pub struct Scan(std::result::Result<store::Scan, &'static str>);

impl Task for Scan {
    type Output = Vec<Vec<u32>>;
    type JsValue = Vec<Vec<u32>>;

    fn compute(&mut self) -> Result<Self::Output> {
        let scan = self
            .0
            .as_ref()
            .map_err(|reason| Error::from_reason(*reason))?;
        let threads = std::thread::available_parallelism().map_or(1, NonZeroUsize::get);
        scan.run(threads)
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

/// For each key, the heights in `from..to` whose filter may hold it, in
/// order (false positives at rate 1/784931 per block), tested on all cores.
/// Rejects when the files end before the heights do or a filter ends before
/// the values a key needs.
#[napi(ts_return_type = "Promise<Array<Array<number>>>")]
#[must_use]
pub fn scan_filters(request: ScanRequest) -> AsyncTask<Scan> {
    let scan = match u64::try_from(request.filter_offset) {
        Err(_) => Err("The filter offset is negative"),
        Ok(_) if request.from > request.to => Err("The first height is past the last"),
        Ok(filter_offset) => Ok(store::Scan {
            index_file: PathBuf::from(request.index_file),
            filters_file: PathBuf::from(request.filters_file),
            heights: request.from..request.to,
            filter_offset,
            keys: request.keys.iter().map(|key| key.to_vec()).collect(),
        }),
    };
    AsyncTask::new(Scan(scan))
}
