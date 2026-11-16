const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { scanFilters } = require('../index.js');

// BIP158's testnet genesis filter and the coinbase script it holds.
const genesisHash = Buffer.from('000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943', 'hex').reverse();
const genesisFilter = Buffer.from('019dfca8', 'hex');
const coinbaseScript = Buffer.from(
  '4104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac',
  'hex'
);

/** A store whose heights hold the given filters, each after a 32 byte root, under the given block hashes. */
function writeStore(blocks) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-scan-'));
  const records = [];
  const filters = [];
  for (const { hash, filter } of blocks) {
    const stored = Buffer.concat([Buffer.alloc(32), filter]);
    const record = Buffer.alloc(100);
    hash.copy(record, 0);
    record.writeUInt32LE(stored.length, 96);
    records.push(record);
    filters.push(stored);
  }
  fs.writeFileSync(path.join(dir, 'index.dat'), Buffer.concat(records));
  fs.writeFileSync(path.join(dir, 'filters.dat'), Buffer.concat(filters));
  return { dir, indexFile: path.join(dir, 'index.dat'), filtersFile: path.join(dir, 'filters.dat') };
}

test('native binding finds the blocks whose filter holds a key', async () => {
  const empty = { hash: Buffer.alloc(32, 1), filter: Buffer.from([0]) };
  const genesis = { hash: genesisHash, filter: genesisFilter };
  const store = writeStore([empty, genesis, empty, genesis]);
  try {
    const keys = [coinbaseScript, Buffer.from('51', 'hex')];
    const all = await scanFilters({ ...store, from: 0, to: 4, filterOffset: 0, keys });
    assert.deepEqual(all, [[1, 3], []]);
    const tail = await scanFilters({ ...store, from: 2, to: 4, filterOffset: 33 + 36, keys: [coinbaseScript] });
    assert.deepEqual(tail, [[3]]);
    assert.deepEqual(await scanFilters({ ...store, from: 1, to: 1, filterOffset: 33, keys }), [[], []]);
  } finally {
    fs.rmSync(store.dir, { recursive: true, force: true });
  }
});

test('native binding rejects heights past the files and invalid requests', async () => {
  const store = writeStore([{ hash: genesisHash, filter: genesisFilter }]);
  try {
    const request = { ...store, from: 0, to: 2, filterOffset: 0, keys: [coinbaseScript] };
    await assert.rejects(scanFilters(request), /ended early/);
    await assert.rejects(scanFilters({ ...request, to: 1, filterOffset: -1 }), /negative/);
    await assert.rejects(scanFilters({ ...request, from: 1, to: 0 }), /past the last/);
  } finally {
    fs.rmSync(store.dir, { recursive: true, force: true });
  }
});
