import assert from 'node:assert/strict';
import { serialize } from 'node:v8';
import { PrevoutCache } from '../../api/bitcoin/prevout-cache';
const out = (value = 10) => ({ value, scriptpubkey: '00', scriptpubkey_byte_code: ['aa'], token_amount: '1' });
const block = (refs: [string, number][]) => ({ tx: [{ vin: refs.map(([txid, vout]) => ({ txid, vout })) }] });
const setup = (refs: [string, number][], limits = {}, custom?: (id: string) => any) => {
  let calls = 0;
  const fetch = async (id: string) => {
    calls++;
    return custom ? custom(id) : { vout: [out(), out(20), out(30)], status: { confirmed: true } };
  };
  const cache = new PrevoutCache(block(refs) as any, fetch as any, limits);
  return { cache, calls: () => calls };
};
test('reuses transaction across inputs and output indexes; retains only referenced outputs', async () => {
  const { cache, calls } = setup([
    ['a', 0],
    ['a', 2],
    ['a', 0],
  ]);
  assert.equal((await cache.resolve('a', 0)).value, 10);
  assert.equal((await cache.resolve('a', 2)).value, 30);
  await cache.resolve('a', 0);
  assert.equal(calls(), 1);
  assert.deepEqual([...(cache as any).entries.get('a').outputs.keys()], [0, 2]);
});
test('miss and hit objects cannot mutate retained values or another hit', async () => {
  const { cache } = setup([
    ['a', 0],
    ['a', 0],
  ]);
  const first = await cache.resolve('a', 0);
  first.value = 999;
  first.scriptpubkey_byte_code.push('bad');
  const hit = await cache.resolve('a', 0);
  assert.equal(hit.value, 10);
  expect(hit.scriptpubkey_byte_code).toStrictEqual(['aa']);
  hit.scriptpubkey_byte_code.push('bad');
  expect((await cache.resolve('a', 0)).scriptpubkey_byte_code).toStrictEqual(['aa']);
});
test('entry limit evicts LRU instead of recently used data', async () => {
  const { cache, calls } = setup(
    [
      ['a', 0],
      ['b', 0],
      ['c', 0],
      ['a', 0],
      ['b', 0],
      ['c', 0],
    ],
    { maxEntries: 2 }
  );
  await cache.resolve('a', 0);
  await cache.resolve('b', 0);
  await cache.resolve('a', 0);
  await cache.resolve('c', 0);
  assert.deepEqual([...(cache as any).entries.keys()], ['a', 'c']);
  await cache.resolve('b', 0);
  assert.equal(calls(), 4);
  assert.equal((cache as any).entries.size, 2);
});
test('byte bound evicts retained data', async () => {
  const cost = serialize(new Map([[0, structuredClone(out())]])).length;
  const { cache } = setup(
    [
      ['a', 0],
      ['b', 0],
      ['a', 0],
      ['b', 0],
    ],
    { maxBytes: cost }
  );
  await cache.resolve('a', 0);
  await cache.resolve('b', 0);
  assert.equal((cache as any).entries.size, 1);
  assert.ok((cache as any).bytes <= cost);
});
test('oversized results remain usable and uncached', async () => {
  const { cache, calls } = setup(
    [
      ['a', 0],
      ['a', 0],
    ],
    { maxBytes: 1 }
  );
  assert.equal((await cache.resolve('a', 0)).value, 10);
  await cache.resolve('a', 0);
  assert.equal(calls(), 2);
  assert.equal((cache as any).bytes, 0);
});
test('zero entry cap bypasses retention', async () => {
  const { cache, calls } = setup(
    [
      ['a', 0],
      ['a', 0],
    ],
    { maxEntries: 0 }
  );
  await cache.resolve('a', 0);
  await cache.resolve('a', 0);
  assert.equal(calls(), 2);
});
test('metadata txid bound falls back without losing valid outputs', async () => {
  const { cache, calls } = setup(
    [
      ['a', 0],
      ['b', 0],
      ['a', 0],
      ['b', 0],
    ],
    { maxTxids: 1 }
  );
  await cache.resolve('b', 0);
  await cache.resolve('b', 0);
  assert.equal(calls(), 2);
  assert.equal((cache as any).needed.size, 1);
});
test('metadata output bound and missing cache index fall back correctly', async () => {
  const { cache, calls } = setup(
    [
      ['a', 0],
      ['a', 2],
    ],
    { maxOutpoints: 1 }
  );
  await cache.resolve('a', 0);
  assert.equal((await cache.resolve('a', 2)).value, 30);
  assert.equal(calls(), 2);
  assert.equal((cache as any).needed.get('a').size, 1);
});
test('unconfirmed previous transactions are never retained', async () => {
  const { cache, calls } = setup(
    [
      ['a', 0],
      ['a', 0],
    ],
    {},
    () => ({ vout: [out()], status: { confirmed: false } })
  );
  await cache.resolve('a', 0);
  await cache.resolve('a', 0);
  assert.equal(calls(), 2);
  assert.equal((cache as any).entries.size, 0);
});
test('failed fetch is not retained and a later retry succeeds', async () => {
  let attempts = 0;
  const { cache } = setup(
    [
      ['a', 0],
      ['a', 0],
    ],
    {},
    () => {
      if (++attempts === 1) {
        throw new Error('rpc failed');
      }
      return { vout: [out()], status: { confirmed: true } };
    }
  );
  await assert.rejects(cache.resolve('a', 0), /rpc failed/);
  assert.equal((cache as any).entries.size, 0);
  assert.equal((await cache.resolve('a', 0)).value, 10);
  assert.equal(attempts, 2);
});
test('invalid output index throws without retaining data', async () => {
  const { cache } = setup([['a', 7]]);
  await assert.rejects(cache.resolve('a', 7), TypeError);
  assert.equal((cache as any).entries.size, 0);
});
test('contexts have independent data and cleanup releases metadata/data', async () => {
  const a = setup([
      ['a', 0],
      ['a', 0],
    ]),
    b = setup([
      ['a', 0],
      ['a', 0],
    ]);
  await Promise.all([a.cache.resolve('a', 0), b.cache.resolve('a', 0)]);
  assert.equal(a.calls(), 1);
  assert.equal(b.calls(), 1);
  a.cache.clear();
  assert.equal((a.cache as any).entries.size, 0);
  assert.equal((a.cache as any).needed.size, 0);
  assert.equal((a.cache as any).bytes, 0);
  assert.equal((b.cache as any).entries.size, 1);
});

test('single-use parents bypass cloning and serialization retention', async () => {
  const { cache, calls } = setup([
    ['a', 0],
    ['b', 0],
  ]);
  assert.equal((cache as any).needed.size, 0);
  await cache.resolve('a', 0);
  await cache.resolve('b', 0);
  assert.equal(calls(), 2);
  assert.equal((cache as any).entries.size, 0);
  assert.equal((cache as any).bytes, 0);
});
test('one repeated parent among single-use parents is the only eligible entry', async () => {
  const { cache, calls } = setup([
    ['a', 0],
    ['b', 0],
    ['c', 0],
    ['a', 2],
  ]);
  assert.deepEqual([...(cache as any).needed.keys()], ['a']);
  await cache.resolve('a', 0);
  await cache.resolve('b', 0);
  await cache.resolve('c', 0);
  await cache.resolve('a', 2);
  assert.equal(calls(), 3);
  assert.deepEqual([...(cache as any).entries.keys()], ['a']);
});
test('single-use resolution calls neither structuredClone nor cache serialization', async () => {
  const { cache } = setup([
    ['a', 0],
    ['b', 0],
  ]);
  const clone = global.structuredClone;
  let cloned = 0;
  global.structuredClone = (...args) => {
    cloned++;
    return clone(...args);
  };
  try {
    await cache.resolve('a', 0);
    await cache.resolve('b', 0);
  } finally {
    global.structuredClone = clone;
  }
  assert.equal(cloned, 0);
  assert.equal((cache as any).bytes, 0);
  assert.equal((cache as any).entries.size, 0);
});
