#/bin/sh
set -e

# Remove previous dist folder (if present)
rm -rf dist
# Build new dist folder
pnpm build
# Remove previous package folder (if present)
rm -rf package
# Move JS and deps
mv dist package
cp -R node_modules package
# Copy healthcheck.js
cp healthcheck.js package
# Remove symlinks for the Rust addons and insert real folders
rm package/node_modules/rust-gbt package/node_modules/rust-filter-scan
cp -R rust-gbt rust-filter-scan package/node_modules
# Clean up deps
pnpm package-rm-build-deps
