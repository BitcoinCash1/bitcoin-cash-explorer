import { describe, expect, it } from 'vitest';
import {
  minedBlockLimit,
  networkBlockLimit,
  validBlockLimit,
} from './block-capacity';

describe('network and block capacity', () => {
  it('keeps Mainnet at 32 MB across repeated network transitions', () => {
    expect(
      ['', 'testnet4', 'chipnet', '', 'testnet4'].map((n) =>
        networkBlockLimit(n, 32000000)
      )
    ).toEqual([32000000, 2000000, 2000000, 32000000, 2000000]);
  });
  it('uses explicit network overrides and per-block ABLA without clamping growth', () => {
    expect(networkBlockLimit('chipnet', 32000000, { chipnet: 4000000 })).toBe(
      4000000
    );
    expect(
      minedBlockLimit({ abla_state: { block_size_limit: 64000000 } }, 32000000)
    ).toBe(64000000);
    expect(minedBlockLimit({}, 2000000)).toBe(2000000);
  });
  it('rejects malformed limits', () => {
    for (const limit of [0, -1, NaN, Infinity, 1.5, '2000000', null])
      expect(validBlockLimit(limit)).toBe(false);
  });
});
