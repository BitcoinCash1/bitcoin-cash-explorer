# gbt

Rust implementation of the getBlockTemplate algorithm for BCH, exposed to Node.js
through NAPI-RS.

## Build

Use the repository's Node.js 24.x environment and install Rust with rustup.
The `rust-toolchain` file selects the local Rust toolchain. Run from this directory:

```sh
npm run build-release
```

The build script installs the pinned NAPI-RS CLI and generates `index.js`,
`index.d.ts`, and the platform-specific `gbt.[TARGET_TRIPLE].node` addon.
`npm run build` creates a debug build; `npm install` alone does not build the addon.
The configured targets are Linux and FreeBSD on x86-64.

To copy the built addon and loader into the backend's local dependency:

```sh
npm run to-backend
```

Alternatively, run `pnpm preinstall` from `backend/` to build and copy the release
addon before installing backend dependencies.

## Test

After building the addon, run both test layers:

```sh
cargo test --locked
npm run test:bindings
```

Rust tests cover the algorithm; Node tests load the real addon and exercise
`GbtGenerator.make()` and `update()`. Both run in the GitLab backend test job.

## API

```js
const { GbtGenerator } = require(".");
const generator = new GbtGenerator(32_000_000, 8);
generator.make([], 0).then((result) => console.log(result.blocks));
```

See [`index.d.ts`](./index.d.ts) for transaction fields and result types,
[`src/`](./src/) for the Rust implementation, and
[`tests/bindings.test.cjs`](./tests/bindings.test.cjs) for integration examples.
Build artifacts are stored in `target/` and the platform-specific `.node` file.
