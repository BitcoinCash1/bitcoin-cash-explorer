import { describe, expect, it } from 'vitest';
import { gridResolution } from './grid-resolution';

describe('square grid calibration', () => {
  it('corrects the dense small-transaction case without stretching sparse data', () => {
    const actual = Array.from({ length: 5591 }, () => ({ size: 357 }));
    const width = gridResolution(actual, 2000000, 86);
    expect(width).toBe(75);
    expect(Math.abs(5591 / width ** 2 - (5591 * 357) / 2000000)).toBeLessThan(
      0.02
    );
    // Both panels share this resolution: Expected remains around 31%, not 100%.
    expect(1746 / width ** 2).toBeCloseTo(0.31, 2);
    expect(gridResolution(actual, 2000000, 86)).toBe(width);
  });
  it('handles empty snapshots, capacity changes and larger transactions', () => {
    expect(gridResolution([], 2000000, 86)).toBe(86);
    const txs = [{ size: 1000000 }];
    expect(gridResolution(txs, 2000000, 86)).toBeGreaterThanOrEqual(32);
    expect(gridResolution(txs, 32000000, 86)).toBeGreaterThanOrEqual(32);
  });
});
