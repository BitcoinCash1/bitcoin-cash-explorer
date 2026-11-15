import fixture from '../../../test/fixtures/chipnet-60-second-activation.json';
import { calcBitsDifference, calcAsertDifficultyAdjustment, predictNextTarget } from '../../api/difficulty-adjustment';

describe('Mempool Difficulty Adjustment', () => {
  const recentBlocksFor = (blockTimestamp: number) => [
    { timestamp: blockTimestamp - 3600 },
    { timestamp: blockTimestamp - 3000 },
    { timestamp: blockTimestamp - 2400 },
    { timestamp: blockTimestamp - 1800 },
    { timestamp: blockTimestamp - 1200 },
    { timestamp: blockTimestamp - 600 },
    { timestamp: blockTimestamp },
  ];

  test('should calculate ASERT Difficulty Adjustments properly for mainnet', () => {
    const blockHeight = 946905;
    const blockTimestamp = 1776280633;
    const recentBlocks = recentBlocksFor(blockTimestamp);

    const result = calcAsertDifficultyAdjustment(blockHeight, blockTimestamp, 'mainnet', recentBlocks);

    expect(result).toHaveProperty('scheduleOffsetSeconds');
    expect(result).toHaveProperty('difficultyDriftPercent');
    expect(result).toHaveProperty('currentBits');
    expect(result).toHaveProperty('nextBits');
    expect(result).toHaveProperty('timeAvg');

    expect(typeof result.scheduleOffsetSeconds).toBe('number');
    expect(typeof result.difficultyDriftPercent).toBe('number');
    expect(result.currentBits).toMatch(/^[0-9a-f]{8}$/);
    expect(result.nextBits).toMatch(/^[0-9a-f]{8}$/);
    expect(result.timeAvg).toBe(600000);
  });

  test('should use testnet4 anchor (height 16844, bits 1d00ffff, tau 3600) for testnet4', () => {
    // testnet4 anchor is at height 16844, timestamp 1605451779 (Nov 2020).
    // Use a block 200 blocks above anchor with ideal-pace timing to keep hi exponent small.
    const blockHeight = 17044; // anchor + 200
    const blockTimestamp = 1605451779 + 200 * 600; // ideal 10-min spacing
    const recentBlocks = recentBlocksFor(blockTimestamp);

    const result = calcAsertDifficultyAdjustment(blockHeight, blockTimestamp, 'testnet4', recentBlocks);

    expect(result.currentBits).toMatch(/^[0-9a-f]{8}$/);
    expect(result.nextBits).toMatch(/^[0-9a-f]{8}$/);

    // testnet4 anchor bits (1d00ffff) differ from mainnet (1804dafe) — results must differ
    const mainnetResult = calcAsertDifficultyAdjustment(blockHeight, blockTimestamp, 'mainnet', recentBlocks);
    expect(result.currentBits).not.toEqual(mainnetResult.currentBits);
  });

  test('chipnet should produce same result as testnet4 (identical anchor params)', () => {
    // chipnet anchor is identical to testnet4: height 16844, bits 1d00ffff, tau 3600
    const blockHeight = 17044; // anchor + 200
    const blockTimestamp = 1605451779 + 200 * 600; // ideal 10-min spacing → scheduleOffset = 0
    const recentBlocks = recentBlocksFor(blockTimestamp);

    const testnet4Result = calcAsertDifficultyAdjustment(blockHeight, blockTimestamp, 'testnet4', recentBlocks);
    const chipnetResult = calcAsertDifficultyAdjustment(blockHeight, blockTimestamp, 'chipnet', recentBlocks);

    // Both networks share the same anchor — results must be identical
    expect(chipnetResult.currentBits).toEqual(testnet4Result.currentBits);
    expect(chipnetResult.nextBits).toEqual(testnet4Result.nextBits);
    expect(chipnetResult.scheduleOffsetSeconds).toEqual(testnet4Result.scheduleOffsetSeconds);
    expect(chipnetResult.difficultyDriftPercent).toEqual(testnet4Result.difficultyDriftPercent);
    expect(chipnetResult.timeAvg).toEqual(testnet4Result.timeAvg);

    // At ideal pace: bits hold steady at 1d00e417, schedule is exactly on time
    expect(chipnetResult.currentBits).toBe('1d00e417');
    expect(chipnetResult.scheduleOffsetSeconds).toBe(0);
    expect(chipnetResult.timeAvg).toBe(600000);
  });

  test('should calculate Difficulty change from bits fields of two blocks', () => {
    // Check same exponent + check min max for output
    expect(calcBitsDifference(0x1d000200, 0x1d000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000400, 0x1d000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000800, 0x1d000100)).toEqual(300); // Actually 700
    expect(calcBitsDifference(0x1d000100, 0x1d000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000100, 0x1d000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000100, 0x1d000800)).toEqual(-75); // Actually -87.5
    // Check new higher exponent
    expect(calcBitsDifference(0x1c000200, 0x1d000001)).toEqual(100);
    expect(calcBitsDifference(0x1c000400, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000800, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000100, 0x1d000002)).toEqual(-50);
    expect(calcBitsDifference(0x1c000100, 0x1d000004)).toEqual(-75);
    expect(calcBitsDifference(0x1c000100, 0x1d000008)).toEqual(-75);
    // Check new lower exponent
    expect(calcBitsDifference(0x1d000002, 0x1c000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000004, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000008, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000001, 0x1c000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000001, 0x1c000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000001, 0x1c000800)).toEqual(-75);
    // Check error when exponents are too far apart
    expect(() => calcBitsDifference(0x1d000001, 0x1a000800)).toThrow(/Impossible exponent difference/);
    // Check invalid inputs
    expect(() => calcBitsDifference(0x7f000001, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(0, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(100.2783, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(0x00800000, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(0x1c000000, 0x1a000800)).toThrow(/Invalid bits/);
  });
});

describe('chipnet ASERT cadence transition', () => {
  const anchorTimestamp = 1605451779;
  const anchorTicks = 16844 * 600;
  const powLimit = 65535 * 2 ** 208;
  const timestampAt = (ticks: number) => anchorTimestamp + ticks - anchorTicks + 600 - 14400;

  test('uses the child interval at the first short block while retaining parent ticks', () => {
    const timestamp = timestampAt(332450 * 600);
    const longTarget = predictNextTarget(332450, timestamp, timestamp + 60, 'testnet4');
    const shortTarget = predictNextTarget(332450, timestamp, timestamp + 60, 'chipnet');
    expect(shortTarget / longTarget).toBeCloseTo(10, 10);
    const before = timestampAt(332449 * 600);
    expect(predictNextTarget(332449, before, before + 600, 'chipnet')).toBe(
      predictNextTarget(332449, before, before + 600, 'testnet4')
    );
  });

  test('keeps the post-activation target steady at ideal 60-second pace', () => {
    const timestamp = timestampAt(332450 * 600);
    const target = predictNextTarget(332450, timestamp, timestamp + 60, 'chipnet');
    expect(predictNextTarget(332451, timestamp + 60, timestamp + 120, 'chipnet')).toBe(target);
    expect(predictNextTarget(332452, timestamp + 120, timestamp + 180, 'chipnet')).toBe(target);
  });

  test('applies minimum difficulty strictly after twice the child interval', () => {
    const timestamp = timestampAt(332450 * 600);
    expect(predictNextTarget(332450, timestamp, timestamp + 120, 'chipnet')).toBeLessThan(powLimit);
    expect(predictNextTarget(332450, timestamp, timestamp + 121, 'chipnet')).toBe(powLimit);
    const before = timestampAt(332449 * 600);
    expect(predictNextTarget(332449, before, before + 1200, 'chipnet')).toBeLessThan(powLimit);
    expect(predictNextTarget(332449, before, before + 1201, 'chipnet')).toBe(powLimit);
    expect(predictNextTarget(332450, timestamp, timestamp + 121, 'testnet4')).toBeLessThan(powLimit);
    expect(predictNextTarget(332450, timestamp, timestamp + 1201, 'testnet4')).toBe(powLimit);
    expect(predictNextTarget(332450, timestamp, timestamp + 1201, 'scalenet')).toBe(powLimit);
  });

  test('clamps predicted targets to the consensus minimum and proof-of-work limit', () => {
    expect(predictNextTarget(332450, 0, 60, 'chipnet')).toBe(1);
    expect(predictNextTarget(332450, 2000000000, 2000000060, 'chipnet')).toBe(powLimit);
  });

  test('preserves the recorded header bits and calculates drift from that target', () => {
    const timestamp = timestampAt(332450 * 600);
    const result = calcAsertDifficultyAdjustment(332450, timestamp, 'chipnet', [], 0x1c00ffff, timestamp + 121);
    expect(result.currentBits).toBe('1c00ffff');
    expect(result.nextBits).toBe('1d00ffff');
    expect(result.difficultyDriftPercent).toBeCloseTo((1 / 256 - 1) * 100, 10);
    expect(result.timeAvg).toBe(60000);
  });

  test('measures schedule position in cumulative ticks after activation', () => {
    const timestamp = anchorTimestamp + (332450 * 600 + 120) - anchorTicks;
    const result = calcAsertDifficultyAdjustment(332452, timestamp, 'chipnet', []);
    expect(result.scheduleOffsetSeconds).toBe(0);
    expect(result.timeAvg).toBe(60000);
  });
});

test.each(fixture.blocks.slice(1))('predicts captured child compact target at height $height', (child) => {
  const parent = fixture.blocks.find((block) => block.height === child.height - 1)!;
  const target = predictNextTarget(parent.height, parent.time, child.time, 'chipnet');
  const exponent = parseInt(child.bits.slice(0, 2), 16);
  const recordedTarget = parseInt(child.bits.slice(2), 16) * 2 ** ((exponent - 3) * 8);
  // Compact rounding and floating-point ASERT approximation are bounded here;
  // the explorer does not validate proof of work.
  expect(Math.abs(target / recordedTarget - 1)).toBeLessThan(0.0001);
  if (child.height === 332451) expect(target).toBe(65535 * 2 ** 208);
});
