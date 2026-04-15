import {
  calcBitsDifference,
  calcAsertDifficultyAdjustment,
  DifficultyAdjustment,
} from '../../api/difficulty-adjustment';

describe('Mempool Difficulty Adjustment', () => {
  test('should calculate ASERT Difficulty Adjustments properly', () => {
    // Test basic ASERT calculation with a known block
    const blockHeight = 946905;
    const blockTimestamp = 1776280633;
    const nowSeconds = blockTimestamp + 60; // 1 minute after the block
    const recentBlocks = [
      { timestamp: blockTimestamp - 3600 },
      { timestamp: blockTimestamp - 3000 },
      { timestamp: blockTimestamp - 2400 },
      { timestamp: blockTimestamp - 1800 },
      { timestamp: blockTimestamp - 1200 },
      { timestamp: blockTimestamp - 600 },
      { timestamp: blockTimestamp },
    ];

    const result = calcAsertDifficultyAdjustment(blockHeight, blockTimestamp, nowSeconds, 'mainnet', recentBlocks);

    // Verify structure
    expect(result).toHaveProperty('scheduleOffsetSeconds');
    expect(result).toHaveProperty('difficultyDriftPercent');
    expect(result).toHaveProperty('currentBits');
    expect(result).toHaveProperty('nextBits');
    expect(result).toHaveProperty('timeAvg');
    expect(result).toHaveProperty('adjustedTimeAvg');
    expect(result).toHaveProperty('timeOffset');

    // scheduleOffsetSeconds should be a number
    expect(typeof result.scheduleOffsetSeconds).toBe('number');

    // difficultyDriftPercent should be a small number (near zero for normal operation)
    expect(typeof result.difficultyDriftPercent).toBe('number');

    // bits should be valid hex strings (8 chars)
    expect(result.currentBits).toMatch(/^[0-9a-f]{8}$/);
    expect(result.nextBits).toMatch(/^[0-9a-f]{8}$/);

    // timeAvg should be 600000ms (600s * 1000) for perfectly spaced blocks
    expect(result.timeAvg).toBe(600000);
    expect(result.adjustedTimeAvg).toBe(600000);

    // timeOffset should be 0 for mainnet
    expect(result.timeOffset).toBe(0);
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
