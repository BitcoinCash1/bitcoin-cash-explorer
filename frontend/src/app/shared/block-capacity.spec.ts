import { describe, expect, it } from 'vitest';
import { minedBlockLimit, validBlockLimit } from './block-capacity';

describe('mined block capacity', () => {
  it('prefers ABLA, accepts growth and keeps unknown capacity unknown', () => {
    expect(
      minedBlockLimit({ abla_state: { block_size_limit: 64000000 } }, 32000000)
    ).toBe(64000000);
    expect(minedBlockLimit({}, 2000000)).toBe(2000000);
    expect(minedBlockLimit({}, null)).toBeNull();
  });
  it('rejects malformed limits', () => {
    for (const limit of [0, -1, NaN, Infinity, 1.5, '2000000', null])
      expect(validBlockLimit(limit)).toBe(false);
  });
});
