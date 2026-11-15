import {
  getTargetBlockSeconds,
  getBlockTicks,
  getBlockSubsidySats,
  getNextHalving,
} from './block-timing';

describe('network block timing policy', () => {
  it.each([
    [332449, 600, 199469400, 2500000000],
    [332450, 600, 199470000, 2500000000],
    [332451, 60, 199470060, 250000000],
    [332452, 60, 199470120, 250000000],
  ])(
    'handles chipnet activation at height %i',
    (height, seconds, ticks, subsidy) => {
      expect(getTargetBlockSeconds('chipnet', height)).toBe(seconds);
      expect(getBlockTicks('chipnet', height)).toBe(ticks);
      expect(getBlockSubsidySats('chipnet', height)).toBe(subsidy);
    }
  );

  it.each(['', 'mainnet', 'testnet4', 'scalenet'])(
    'preserves 600-second policy for %s',
    (network) => {
      expect(getTargetBlockSeconds(network, 332451)).toBe(600);
      expect(getBlockTicks(network, 332451)).toBe(199470600);
      expect(getBlockSubsidySats(network, 332451)).toBe(2500000000);
      expect(getBlockSubsidySats(network, 419999)).toBe(2500000000);
      expect(getBlockSubsidySats(network, 420000)).toBe(1250000000);
      expect(getNextHalving(network, 419999)).toMatchObject({
        height: 420000,
        blocksRemaining: 1,
        secondsRemaining: 600,
        subsidySats: 1250000000,
      });
    }
  );

  it('uses tick chunks rather than a fixed number of chipnet blocks for halvings', () => {
    expect(getBlockSubsidySats('chipnet', 1207940)).toBe(250000000);
    expect(getBlockSubsidySats('chipnet', 1207941)).toBe(125000000);
    expect(getNextHalving('chipnet', 1207940)).toMatchObject({
      height: 1207941,
      blocksRemaining: 1,
      secondsRemaining: 60,
      subsidySats: 125000000,
    });
    expect(getNextHalving('chipnet', 1207941)).toMatchObject({
      height: 3307941,
      blocksRemaining: 2100000,
      secondsRemaining: 126000000,
      subsidySats: 62500000,
    });
  });

  it('includes the cadence transition when estimating the next halving', () => {
    expect(getNextHalving('chipnet', 332450)).toMatchObject({
      height: 1207941,
      blocksRemaining: 875491,
      secondsRemaining: 52529460,
      subsidySats: 125000000,
    });
    expect(getNextHalving('chipnet', 332449).secondsRemaining).toBe(52530060);
  });

  it('truncates fractional satoshis after cadence scaling and exhausts rewards', () => {
    // At era 28, the legacy subsidy is 18 satoshis: chipnet pays floor(18 / 10).
    const era28Height = 332450 + ((28 * 210000 - 1) * 600 - 199470000) / 60 + 1;
    expect(getBlockSubsidySats('chipnet', era28Height)).toBe(1);
    expect(getBlockSubsidySats('mainnet', 33 * 210000)).toBe(0);
    expect(getBlockSubsidySats('mainnet', 64 * 210000)).toBe(0);
    expect(getBlockSubsidySats('chipnet', 200000000)).toBe(0);
  });
});

test('halving progress remains bounded across activation and resets at the halving', () => {
  for (const height of [332449, 332450, 332451, 332452, 1207940, 1207941]) {
    const progress = getNextHalving('chipnet', height).progressPercent;
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(100);
  }
  expect(getNextHalving('chipnet', 332451).progressPercent).toBeCloseTo(
    58.31,
    2
  );
  expect(getNextHalving('chipnet', 1207941).progressPercent).toBe(0);
  expect(getNextHalving('mainnet', 419999).progressPercent).toBeCloseTo(
    99.99952380952381,
    10
  );
  expect(getNextHalving('mainnet', 420000).progressPercent).toBe(0);
});
