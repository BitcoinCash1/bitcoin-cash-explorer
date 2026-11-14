import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockOverviewGraphComponent } from './block-overview-graph.component';

describe('unknown graph capacity', () => {
  it('clears old geometry without constructing an invalid scene and retains pending transactions', () => {
    const graph = Object.create(BlockOverviewGraphComponent.prototype) as any;
    const destroy = vi.fn();
    graph.scene = { destroy };
    graph.gl = { clear: vi.fn(), COLOR_BUFFER_BIT: 1 };
    graph.blockLimit = null;
    graph.ngOnChanges({ blockLimit: {} });
    expect(destroy).toHaveBeenCalledOnce();
    expect(graph.scene).toBeNull();
    const txs = [{ txid: 'one', size: 200, fee: 200, flags: 0 }];
    graph.filtersAvailable = false;
    graph.setup(txs);
    expect(graph.currentTransactions).toBe(txs);
    graph.setup = vi.fn();
    graph.resizeCanvas = vi.fn();
    graph.canvas = {};
    graph.blockLimit = 2000000;
    graph.ngOnChanges({ blockLimit: {} });
    expect(graph.setup).toHaveBeenCalledWith(txs);
    graph.setup.mockClear();
    graph.ngOnChanges({});
    expect(graph.setup).not.toHaveBeenCalled();
  });
});

function deltaFixture() {
  const graph = Object.create(BlockOverviewGraphComponent.prototype) as any;
  const a = { txid: 'a', size: 200, fee: 200, flags: 0 };
  graph.currentTransactions = [a];
  graph.blockLimit = 2000000;
  graph.resolution = 86;
  graph.animationDuration = 1000;
  graph.filtersAvailable = false;
  graph.canvas = {};
  graph.gl = {};
  graph.start = vi.fn();
  graph.updateSearchHighlight = vi.fn();
  graph.resizeCanvas = vi.fn();
  graph.scene = {
    txs: { a },
    setScale: vi.fn(),
    setup: vi.fn((txs) => {
      graph.scene.txs = Object.fromEntries(txs.map((t) => [t.txid, t]));
    }),
    update: vi.fn((add, remove, change) => {
      remove.forEach((id) => delete graph.scene.txs[id]);
      add.forEach((t) => (graph.scene.txs[t.txid] = t));
      change.forEach(
        (t) =>
          (graph.scene.txs[t.txid] = {
            ...graph.scene.txs[t.txid],
            rate: t.rate,
          })
      );
    }),
  };
  graph.clearUpdateQueue();
  return graph;
}

describe('graph deltas during layout rebuilds', () => {
  afterEach(() => vi.useRealTimers());
  it('preserves queued adds, removals and rate changes when the timer rebuilds', () => {
    vi.useFakeTimers();
    const graph = deltaFixture();
    graph.update([{ txid: 'b', size: 250, fee: 250, flags: 0 }], [], []);
    graph.queueUpdate(
      [{ txid: 'c', size: 300, fee: 300, flags: 0 }],
      ['a'],
      [{ txid: 'b', rate: 5 }]
    );
    vi.advanceTimersByTime(250);
    expect(Object.keys(graph.scene.txs).sort()).toEqual(['b', 'c']);
    expect(graph.scene.txs.b.rate).toBe(5);
    expect(graph.pendingUpdate.count).toBe(0);
  });
  it.each(['blockLimit', 'resolution'])(
    'keeps already-applied and queued deltas when %s changes before the timer fires',
    (field) => {
      vi.useFakeTimers();
      const graph = deltaFixture();
      graph.update([{ txid: 'b', size: 250, fee: 250, flags: 0 }], [], []);
      graph.queueUpdate(
        [{ txid: 'c', size: 300, fee: 300, flags: 0 }],
        ['a'],
        [{ txid: 'b', rate: 7 }]
      );
      graph[field] = field === 'blockLimit' ? 3000000 : 75;
      graph.ngOnChanges({ [field]: {} });
      expect(Object.keys(graph.scene.txs).sort()).toEqual(['b', 'c']);
      expect(graph.scene.txs.b.rate).toBe(7);
      vi.advanceTimersByTime(250);
      expect(Object.keys(graph.scene.txs).sort()).toEqual(['b', 'c']);
    }
  );
});
