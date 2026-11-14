import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
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
