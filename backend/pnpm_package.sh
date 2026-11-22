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
# Keep the maintenance scripts available in the runtime image.
node - <<'JS'
const { name, version, scripts } = require('./package.json');
const maintenance = Object.fromEntries(
  Object.entries(scripts)
    .filter(([name]) => name.startsWith('statistics:buckets:'))
    .map(([name, command]) => [name, command.replace('node dist/', 'node ')])
);
require('node:fs').writeFileSync('package/package.json', JSON.stringify({ name, version, scripts: maintenance }, null, 2) + '\n');
JS
# The runtime package ships preinstalled dependencies and has no install manifest.
# Keep pnpm from reconciling node_modules against the script-only package.json.
printf 'verifyDepsBeforeRun: false\n' > package/pnpm-workspace.yaml
# Remove symlink for rust-gbt and insert real folder
rm package/node_modules/rust-gbt
cp -R rust-gbt package/node_modules
# Clean up deps
pnpm package-rm-build-deps
