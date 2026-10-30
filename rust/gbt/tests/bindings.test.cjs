const assert = require('node:assert/strict');
const { test } = require('node:test');
const { GbtGenerator } = require('../index.js');

const transaction = (uid, feePerSize, inputs = []) => ({
  uid,
  order: uid,
  fee: feePerSize * 250,
  size: 250,
  sigops: 1,
  feePerSize,
  inputs,
});

test('native binding handles an empty mempool', async () => {
  const generator = new GbtGenerator(32_000_000, 8);
  const result = await generator.make([], 0);
  assert.deepEqual(result.blocks.flat(), []);
  assert.deepEqual(result.overflow, []);
});

test('native binding orders parents before children and updates its state', async () => {
  const generator = new GbtGenerator(32_000_000, 8);
  const result = await generator.make([
    transaction(1, 1),
    transaction(2, 10, [1]),
    transaction(3, 5),
  ], 3);
  const placed = result.blocks.flat();
  assert.deepEqual([...placed].sort(), [1, 2, 3]);
  assert.ok(placed.indexOf(1) < placed.indexOf(2));
  assert.equal(result.blockSizes[0], 1_750);
  assert.deepEqual(result.overflow, []);

  const updated = await generator.update([transaction(4, 20)], [1, 2], 4);
  assert.deepEqual(updated.blocks.flat(), [4, 3]);
  assert.equal(updated.blockSizes[0], 1_500);
  assert.deepEqual(updated.overflow, []);

  const empty = await generator.update([], [3, 4], 4);
  assert.deepEqual(empty.blocks.flat(), []);
});
