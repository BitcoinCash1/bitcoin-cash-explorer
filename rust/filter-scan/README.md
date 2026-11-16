# filter-scan

The filter scan of the backend's `p2p` address backend in Rust, exposed to
Node.js through NAPI-RS: for a set of keys, which blocks' stored script
filters may hold each of them. It reads the backend's filter store
(`index.dat` and `filters.dat`) directly and tests every filter against all
keys at once, on all cores. The backend checks that the store did not change
during a scan.

## Build

Use the repository's Node.js environment and install Rust with rustup. The
`rust-toolchain` file selects the local Rust toolchain. Run from this directory:

```sh
npm run build-release
```

The build script installs the pinned NAPI-RS CLI and generates `index.js`,
`index.d.ts`, and the platform-specific `filter-scan.[TARGET_TRIPLE].node`
addon. `npm run build` creates a debug build.

To copy the built addon and loader into the backend's local dependency
(`backend/rust-filter-scan`, or `$FILTER_SCAN_FD`):

```sh
npm run to-backend
```

`pnpm preinstall` in `backend/` builds and copies it together with the GBT addon.

## Test

```sh
cargo test --locked
npm run test:bindings
```

The Rust tests check SipHash and the Golomb-coded set decoder against the
reference vectors, many keys against each key alone, and a scan on many
threads against each filter tested alone. The backend's jest tests compare
the addon with its TypeScript matcher on the same vectors and on random
filters.

## API

```js
const { scanFilters } = require('.');
// For each key, the heights in [from, to) whose filter may hold it.
const heights = await scanFilters({ indexFile, filtersFile, from: 0, to: tip + 1, filterOffset: 0, keys });
```
