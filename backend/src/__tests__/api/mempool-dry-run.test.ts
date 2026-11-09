import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import config from '../../config';
import singleton from '../../api/mempool-blocks';
import { GbtGenerator } from 'rust-gbt';

// Keep the actual worker and its selection algorithm; only point its filename at compiled JS.
jest.mock('worker_threads', () => {
  const actual = jest.requireActual('worker_threads');
  const nodePath = require('node:path');
  return {
    ...actual,
    Worker: class extends actual.Worker {
      constructor(filename: string) {
        super(filename.replace(`${nodePath.sep}src${nodePath.sep}`, `${nodePath.sep}dist${nodePath.sep}`), {
          env: { ...process.env, EXPLORER_CONFIG_FILE: process.env.BCH_GBT_WORKER_CONFIG },
        });
      }
    },
  };
});

const transaction = (txid: string, fee = 1000, size = 250, parents: string[] = []) =>
  ({
    txid,
    fee,
    size,
    sigops: 1,
    feePerSize: fee / size,
    order: 1,
    vin: parents.map((parent) => ({ txid: parent })),
    vout: [],
  }) as any;
const ids = (result) => result.flatMap((block) => block.transactionIds);
const snapshot = (engine) => ({
  uids: [...engine.uidMap],
  txids: [...engine.txidMap],
  next: engine.nextUid,
  templates: structuredClone(engine.getMempoolBlocksWithTransactions()),
  deltas: structuredClone(engine.getMempoolBlockDeltas()),
});
let temp: string;
beforeAll(() => {
  // A normal Jest run must exercise the current source worker, even on a clean checkout.
  execFileSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', path.resolve(__dirname, '../../../tsconfig.build.json')],
    { stdio: 'pipe' }
  );
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-gbt-worker-'));
  const file = path.join(temp, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ EXPLORER: { MIN_BLOCK_SIZE_UNITS: 1000000, MEMPOOL_BLOCKS_AMOUNT: 8 } }));
  process.env.BCH_GBT_WORKER_CONFIG = file;
}, 30000);
afterAll(() => {
  fs.rmSync(temp, { recursive: true, force: true });
  delete process.env.BCH_GBT_WORKER_CONFIG;
});

describe.each(['rust', 'js'])('%s dry-run UID isolation', (kind) => {
  let engine: any;
  let oldSize: number;
  beforeEach(() => {
    oldSize = config.EXPLORER.MIN_BLOCK_SIZE_UNITS;
    config.EXPLORER.MIN_BLOCK_SIZE_UNITS = 1000000;
    engine = new (singleton.constructor as any)();
  });
  afterEach(async () => {
    if (engine.txSelectionWorker) await engine.txSelectionWorker.terminate();
    config.EXPLORER.MIN_BLOCK_SIZE_UNITS = oldSize;
    jest.restoreAllMocks();
  });
  const make = (engine, pool, save, extra: string[] = []) =>
    engine[kind === 'rust' ? '$rustMakeBlockTemplates' : '$makeBlockTemplates'](
      [...Object.keys(pool), ...extra],
      pool,
      undefined,
      save
    );
  const update = async (engine, pool, added, removed) => {
    if (kind === 'rust') return engine.$rustUpdateBlockTemplates(Object.keys(pool), pool, added, removed, undefined);
    await engine.$updateBlockTemplates(Object.keys(pool), pool, added, removed, undefined, true);
    return engine.getMempoolBlocksWithTransactions();
  };

  test('repeated audits preserve live maps, counters, transaction fields, templates and deltas then update incrementally', async () => {
    const parent = transaction('parent', 250);
    const child = transaction('child', 2500, 250, ['parent', 'parent']);
    const live = { parent, child };
    await make(engine, live, true);
    const before = snapshot(engine);
    for (let i = 0; i < 3; i++) {
      const auditParent = transaction(`audit-parent-${i}`);
      const auditChild = transaction(`audit-child-${i}`, 2000, 250, [auditParent.txid, auditParent.txid]);
      // Existing UID/input fields must survive even if the audit assigns different temporary IDs.
      auditParent.uid = 900;
      auditParent.inputs = [901];
      const audit = { [auditParent.txid]: auditParent, [auditChild.txid]: auditChild, parent };
      const fields = Object.values(audit).map((tx) => [tx.uid, tx.inputs && [...tx.inputs]]);
      const result = await make(engine, audit, false, ['missing-txid']);
      expect(new Set(ids(result))).toEqual(new Set(Object.keys(audit)));
      if (kind === 'rust')
        expect(ids(result).indexOf(auditParent.txid)).toBeLessThan(ids(result).indexOf(auditChild.txid));
      expect(Object.values(audit).map((tx) => [tx.uid, tx.inputs && [...tx.inputs]])).toEqual(fields);
      expect(snapshot(engine)).toEqual(before);
      expect(result.reduce((size, block) => size + block.blockSize, 0)).toBe(750);
    }
    if (kind === 'js') {
      const audit = transaction('incremental-audit');
      await engine.$updateBlockTemplates(
        ['incremental-audit'],
        { 'incremental-audit': audit },
        [audit],
        [],
        undefined,
        false
      );
      expect(snapshot(engine)).toEqual(before);
      expect(audit.uid).toBeUndefined();
      expect(audit.inputs).toBeUndefined();
    }
    const fresh = transaction('new', 4000, 250, ['child', 'parent', 'parent']);
    const next = { parent, new: fresh };
    const result = await update(engine, next, [fresh], [child]);
    expect(new Set(ids(result))).toEqual(new Set(['parent', 'new']));
    expect([...engine.txidMap.keys()].sort()).toEqual(['new', 'parent']);
    expect(engine.uidMap.size).toBe(2);
    if (kind === 'rust') {
      expect(parent.inputs).toEqual([]);
      expect(fresh.inputs).toEqual([parent.uid]);
    } else expect(engine.txSelectionWorkerInitialized).toBe(true);
  });

  test('first audit leaves persistent state empty and subsequent saved update initializes it', async () => {
    const tx = transaction('audit');
    expect(ids(await make(engine, { audit: tx }, false))).toEqual(['audit']);
    expect(engine.nextUid).toBe(1);
    expect(engine.uidMap.size).toBe(0);
    expect(tx.uid).toBeUndefined();
    expect(tx.inputs).toBeUndefined();
    const live = transaction('saved');
    expect(ids(await update(engine, { saved: live }, [live], []))).toEqual(['saved']);
    expect(engine.uidMap.size).toBe(1);
  });

  test('empty and missing-only audits leave saved identifiers intact', async () => {
    await make(engine, { saved: transaction('saved') }, true);
    const before = snapshot(engine);
    expect(ids(await make(engine, {}, false, ['missing']))).toEqual([]);
    expect(snapshot(engine)).toEqual(before);
  });
});

test('native audit converts overflow with temporary IDs and preserves parent deduplication and byte sizes', async () => {
  const engine = new (singleton.constructor as any)();
  const parent = transaction('parent');
  const child = transaction('child', 3000, 250, ['parent', 'parent']);
  const huge = transaction('overflow', 1000, 250, ['overflow']);
  const convert = jest.spyOn(engine, 'convertNapiResultTxids');
  const result = await engine.$rustMakeBlockTemplates(
    ['parent', 'child', 'overflow'],
    { parent, child, overflow: huge },
    undefined,
    false
  );
  const raw = convert.mock.calls[0][0] as any;
  expect(raw.overflow).toHaveLength(1);
  expect((convert.mock.results[0].value as any).overflow).toEqual(['overflow']);
  expect(raw.blockSizes[0]).toBe(1500); // native coinbase reserve1000 + two250-byte transactions
  expect(result[0].blockSize).toBe(500);
  expect(ids(result)).toEqual(['parent', 'child']);
  expect(parent.inputs).toBeUndefined();
  expect(child.inputs).toBeUndefined();
  expect(engine.nextUid).toBe(1);
  convert.mockRestore();
});

test('native dry-run failure preserves live state and saved failure rebuilds on the next update', async () => {
  const engine = new (singleton.constructor as any)();
  const saved = transaction('saved');
  await engine.$rustMakeBlockTemplates(['saved'], { saved }, undefined, true);
  const before = snapshot(engine);
  const fail = jest.spyOn(GbtGenerator.prototype, 'make').mockRejectedValueOnce(new Error('native failed'));
  await engine.$rustMakeBlockTemplates(['audit'], { audit: transaction('audit') }, undefined, false);
  expect(snapshot(engine)).toEqual(before);
  fail.mockRejectedValueOnce(new Error('saved failed'));
  await engine.$rustMakeBlockTemplates(['saved'], { saved }, undefined, true);
  expect(engine.rustInitialized).toBe(false);
  fail.mockRestore();
  expect(ids(await engine.$rustUpdateBlockTemplates(['saved'], { saved }, [], [], undefined))).toEqual(['saved']);
  expect(engine.rustInitialized).toBe(true);
});

test('actual JS worker exit recovers through a saved incremental call', async () => {
  const engine = new (singleton.constructor as any)();
  const saved = transaction('saved');
  await engine.$makeBlockTemplates(['saved'], { saved }, undefined, true);
  const worker = engine.txSelectionWorker;
  await worker.terminate();
  expect(engine.txSelectionWorker).toBeNull();
  await engine.$updateBlockTemplates(['saved'], { saved }, [], [], undefined, true);
  expect(ids(engine.getMempoolBlocksWithTransactions())).toEqual(['saved']);
  await engine.txSelectionWorker.terminate();
});

test('a rejected actual JS worker request removes listeners and the next update rebuilds', async () => {
  const engine = new (singleton.constructor as any)();
  const saved = transaction('saved');
  await engine.$makeBlockTemplates(['saved'], { saved }, undefined, true);
  const worker = engine.txSelectionWorker;
  const exited = new Promise((resolve) => worker.once('exit', resolve));
  const post = worker.postMessage.bind(worker);
  jest.spyOn(worker, 'postMessage').mockImplementationOnce(() => post({ type: 'set', mempool: undefined }));
  await engine.$makeBlockTemplates(['audit'], { audit: transaction('audit') }, undefined, false);
  await exited;
  expect(worker.listenerCount('message')).toBe(0);
  expect(worker.listenerCount('error')).toBe(0);
  expect(engine.txSelectionWorker).toBeNull();
  await engine.$updateBlockTemplates(['saved'], { saved }, [], [], undefined, true);
  expect(ids(engine.getMempoolBlocksWithTransactions())).toEqual(['saved']);
  await engine.txSelectionWorker.terminate();
});

test('native audit uses compact temporary IDs even when the live counter requires an overflow reset', async () => {
  const engine = new (singleton.constructor as any)();
  const saved = transaction('saved');
  await engine.$rustMakeBlockTemplates(['saved'], { saved }, undefined, true);
  engine.nextUid = 0xffffffff;
  const before = snapshot(engine);
  const audit = transaction('audit');
  expect(ids(await engine.$rustMakeBlockTemplates(['audit'], { audit }, undefined, false))).toEqual(['audit']);
  expect(snapshot(engine)).toEqual(before);
  expect(ids(await engine.$rustUpdateBlockTemplates(['saved'], { saved }, [], [], undefined))).toEqual(['saved']);
  expect(engine.nextUid).toBe(2);
});
