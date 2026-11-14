import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { StateService } from './state.service';

describe('capacity lifecycle', () => {
  it('sets the destination capacity before notifying network consumers', () => {
    const state = Object.create(StateService.prototype) as StateService;
    state.env = { BASE_MODULE: 'explorer', MIN_BLOCK_SIZE_UNITS: 32000000 } as any;
    state.networkChanged$ = new Subject() as any;
    const seen: number[] = [];
    state.networkChanged$.subscribe(() => seen.push(state.blockSize));
    for (const path of ['/testnet4', '/chipnet', '/', '/nl/testnet4']) state.setNetworkBasedonUrl(path);
    expect(seen).toEqual([2000000, 2000000, 32000000, 2000000]);
    state.updateBlockCapacity(2200000);
    expect(state.getBlockLimit({ size: 100, abla_state: { block_size_limit: 2000000 } } as any)).toBe(2000000);
    expect(state.blockSize).toBe(2200000);
    expect(state.getBlockFullness({ size: 2100000, abla_state: { block_size_limit: 2000000 } } as any)).toBe(100);
    state.updateBlockCapacity(NaN);
    expect(state.blockSize).toBe(2200000);
  });
});
