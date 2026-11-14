import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { StateService } from './state.service';
import { BlockCapacityService } from './block-capacity.service';

function stateFixture() {
  const state = Object.create(StateService.prototype) as StateService;
  (state as any).capacityService = new BlockCapacityService();
  state.env = { BASE_MODULE: 'explorer' } as any;
  state.networkChanged$ = new Subject() as any;
  return state;
}
describe('backend-authoritative capacity', () => {
  it('clears projections on network switches, caches baselines and refreshes reconnect settings', () => {
    const state = stateFixture();
    state.setNetworkBasedonUrl('/');
    expect(state.blockSize).toBeNull();
    for (const [path, network, limit] of [
      ['/', 'mainnet', 32000000],
      ['/testnet4', 'testnet4', 2000000],
      ['/chipnet', 'chipnet', 2000000],
    ] as const) {
      state.setNetworkBasedonUrl(path);
      expect(
        state.acceptNetworkSettings({ network, minimumBlockSize: limit })
      ).toBe(true);
      expect(state.blockSize).toBe(limit);
      state.updateBlockCapacity(limit + 1000);
      expect(state.blockSize).toBe(limit + 1000);
    }
    state.setNetworkBasedonUrl('/');
    expect(state.blockSize).toBe(32000000);
    state.setNetworkBasedonUrl('/nl/testnet4');
    expect(state.blockSize).toBe(2000000);
    expect(
      state.acceptNetworkSettings({
        network: 'mainnet',
        minimumBlockSize: 32000000,
      })
    ).toBe(false);
    state.acceptNetworkSettings({
      network: 'testnet4',
      minimumBlockSize: 2100000,
    });
    expect(state.blockSize).toBe(2100000);
    expect(
      state.getBlockLimit({ abla_state: { block_size_limit: 2000000 } } as any)
    ).toBe(2000000);
    expect(state.blockSize).toBe(2100000);
  });
  it('does not guess limits for old backends and rejects invalid settings', () => {
    const state = stateFixture();
    state.setNetworkBasedonUrl('/chipnet');
    expect(state.getBlockFullness({ size: 100 } as any)).toBeNull();
    expect(state.projectedBlockCount(100)).toBeNull();
    expect(state.projectionRatio(100)).toBeNull();
    expect(
      state.getBlockFullness({
        size: 1998207,
        abla_state: { block_size_limit: 2000000 },
      } as any)
    ).toBeCloseTo(99.91035);
    expect(
      state.acceptNetworkSettings({ network: 'chipnet', minimumBlockSize: NaN })
    ).toBe(false);
    const cache = new BlockCapacityService();
    cache.activate('chipnet', 'one');
    cache.acceptSettings({ network: 'chipnet', minimumBlockSize: 2000000 });
    cache.activate('chipnet', 'two');
    expect(cache.baseline).toBeNull();
  });
});
