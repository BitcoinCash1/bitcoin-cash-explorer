import config from '../config';
import { IDifficultyAdjustment } from '../mempool.interfaces';
import blocks from './blocks';

export interface DifficultyAdjustment {
  scheduleOffsetSeconds: number; // seconds ahead(+) or behind(-) ideal schedule
  difficultyDriftPercent: number; // next-block % difficulty change (assuming 600s block)
  currentBits: string; // current block bits (hex)
  nextBits: string; // predicted next block bits (hex)
  timeAvg: number; // avg block time over recent blocks (ms)
  adjustedTimeAvg: number; // adjusted avg block time (ms)
  timeOffset: number; // time offset for testnet (ms)
}

// --- ASERT (aserti3-2d) functions ---
// Ported from: https://gist.github.com/A60AB5450353F40E/5607d5aeb9ba0e84a71ab8f55ebdd2ad

const ASERT_ANCHOR_BITS = '1804dafe';
const ASERT_ANCHOR_TICK = 396988200;
const ASERT_ANCHOR_TIMESTAMP = 1605447844;
const ASERT_ANCHOR_IDEAL_BLOCK_TIME = 600;
const ASERT_ANCHOR_TAU = 172800; // half-life = 2 days
const ASERT_ANCHOR_HEIGHT = Math.floor(ASERT_ANCHOR_TICK / ASERT_ANCHOR_IDEAL_BLOCK_TIME); // 661647

function bitsToTarget(bits: string): number {
  const exponent = parseInt(bits.slice(0, 2), 16);
  const mantissa = parseInt(bits.slice(2), 16);
  return mantissa * Math.pow(2, (exponent - 3) * 8);
}

function targetToBits(target: number): string {
  if (target === 0) return '00000000';

  let exponent = Math.floor(Math.log2(target) / 8) + 1;
  let mantissa = Math.floor(target / Math.pow(2, (exponent - 3) * 8));

  if (mantissa > 0x7fffff) {
    mantissa = Math.floor(mantissa / 256);
    exponent++;
  }

  return exponent.toString(16).padStart(2, '0') + mantissa.toString(16).padStart(6, '0');
}

function calculateTarget(heightTick: number, timestamp: number, nextTargetBlockTime: number = 600): number {
  const anchorTarget = bitsToTarget(ASERT_ANCHOR_BITS);

  const tickDelta = heightTick - ASERT_ANCHOR_TICK;
  const timeDelta = timestamp - ASERT_ANCHOR_TIMESTAMP;

  const t = Math.trunc;
  const base = t(((timeDelta - (tickDelta + ASERT_ANCHOR_IDEAL_BLOCK_TIME)) * 65536) / ASERT_ANCHOR_TAU);
  const hi = t(base / 65536) + (base < 0 ? -1 : 0);
  const lo = base - hi * 65536;

  return (
    (t((195766423245049 * lo + 971821376 * lo ** 2 + 5127 * lo ** 3 + 140737488355328) / 2 ** 48) + 65536) *
    t(ASERT_ANCHOR_IDEAL_BLOCK_TIME / nextTargetBlockTime) *
    anchorTarget *
    2 ** (hi - 16)
  );
}

function calculateTargetLegacy(height: number, timestamp: number, nextTargetBlockTime: number = 600): number {
  return calculateTarget(height * 600, timestamp, nextTargetBlockTime);
}

function numericBitsToHex(bits: number): string {
  return bits.toString(16).padStart(8, '0');
}

// --- End ASERT functions ---

/**
 * Calculate the difficulty increase/decrease by using the `bits` integer contained in two
 * block headers.
 *
 * Warning: Only compare `bits` from blocks in two adjacent difficulty periods. This code
 * assumes the maximum difference is x4 or /4 (as per the protocol) and will throw an
 * error if an exponent difference of 2 or more is seen.
 *
 * @param {number} oldBits The 32 bit `bits` integer from a block header.
 * @param {number} newBits The 32 bit `bits` integer from a block header in the next difficulty period.
 * @returns {number} A floating point decimal of the difficulty change from old to new.
 *          (ie. 21.3 means 21.3% increase in difficulty, -21.3 is a 21.3% decrease in difficulty)
 */
export function calcBitsDifference(oldBits: number, newBits: number): number {
  // Must be
  // - integer
  // - highest exponent is 0x20, so max value (as integer) is 0x207fffff
  // - min value is 1 (exponent = 0)
  // - highest bit of the number-part is +- sign, it must not be 1
  const verifyBits = (bits: number): void => {
    if (
      Math.floor(bits) !== bits ||
      bits > 0x207fffff ||
      bits < 1 ||
      (bits & 0x00800000) !== 0 ||
      (bits & 0x007fffff) === 0
    ) {
      throw new Error('Invalid bits');
    }
  };
  verifyBits(oldBits);
  verifyBits(newBits);

  // No need to mask exponents because we checked the bounds above
  const oldExp = oldBits >> 24;
  const newExp = newBits >> 24;
  const oldNum = oldBits & 0x007fffff;
  const newNum = newBits & 0x007fffff;
  // The diff can only possibly be 1, 0, -1
  // (because maximum difficulty change is x4 or /4 (2 bits up or down))
  let result: number;
  switch (newExp - oldExp) {
    // New less than old, target lowered, difficulty increased
    case -1:
      result = ((oldNum << 8) * 100) / newNum - 100;
      break;
    // Same exponent, compare numbers as is.
    case 0:
      result = (oldNum * 100) / newNum - 100;
      break;
    // Old less than new, target raised, difficulty decreased
    case 1:
      result = (oldNum * 100) / (newNum << 8) - 100;
      break;
    default:
      throw new Error('Impossible exponent difference');
  }

  // Min/Max values
  return result > 300 ? 300 : result < -75 ? -75 : result;
}

/**
 * Calculate ASERT-based difficulty adjustment data for BCH.
 *
 * Uses the aserti3-2d algorithm to compute:
 * - Schedule offset: how far ahead/behind the ideal 10-minute schedule
 * - Difficulty drift: expected % change for the next block
 * - Current and predicted next block bits
 */
export function calcAsertDifficultyAdjustment(
  blockHeight: number,
  latestBlockTimestamp: number,
  nowSeconds: number,
  network: string,
  recentBlocks: { timestamp: number }[]
): DifficultyAdjustment {
  const BLOCK_SECONDS_TARGET = 600;
  const TESTNET_MAX_BLOCK_SECONDS = 1200;

  // Schedule offset: how far ahead or behind the ideal schedule
  // Positive = network is ahead (blocks mined faster than 10min avg)
  // Negative = network is behind (blocks mined slower than 10min avg)
  const idealElapsed = (blockHeight - ASERT_ANCHOR_HEIGHT) * BLOCK_SECONDS_TARGET;
  const actualElapsed = latestBlockTimestamp - ASERT_ANCHOR_TIMESTAMP;
  const scheduleOffsetSeconds = idealElapsed - actualElapsed;

  // Current ASERT target and bits
  const currentTarget = calculateTargetLegacy(blockHeight, latestBlockTimestamp);
  const currentBits = targetToBits(currentTarget);

  // Predicted next block target (assuming it arrives in exactly 600s)
  const nextTarget = calculateTargetLegacy(blockHeight + 1, latestBlockTimestamp + BLOCK_SECONDS_TARGET);
  const nextBits = targetToBits(nextTarget);

  // Difficulty drift %: how much harder/easier the next block will be
  // Higher target = easier mining = difficulty decrease (negative drift)
  // Lower target = harder mining = difficulty increase (positive drift)
  const difficultyDriftPercent = currentTarget !== 0 ? ((currentTarget - nextTarget) / currentTarget) * 100 : 0;

  // Average block time from recent blocks
  let timeAvgSecs = BLOCK_SECONDS_TARGET;
  if (recentBlocks.length >= 2) {
    const sorted = [...recentBlocks].sort((a, b) => a.timestamp - b.timestamp);
    const totalTime = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    timeAvgSecs = totalTime / (sorted.length - 1);
  }

  let adjustedTimeAvgSecs = timeAvgSecs;

  // Testnet: cap block time at 20 minutes
  let timeOffset = 0;
  if (network === 'testnet') {
    if (timeAvgSecs > TESTNET_MAX_BLOCK_SECONDS) {
      timeAvgSecs = TESTNET_MAX_BLOCK_SECONDS;
    }

    const secondsSinceLastBlock = nowSeconds - latestBlockTimestamp;
    if (secondsSinceLastBlock + timeAvgSecs > TESTNET_MAX_BLOCK_SECONDS) {
      timeOffset = -Math.min(secondsSinceLastBlock, TESTNET_MAX_BLOCK_SECONDS) * 1000;
    }
  }

  const timeAvg = Math.floor(timeAvgSecs * 1000);
  const adjustedTimeAvg = Math.floor(adjustedTimeAvgSecs * 1000);

  return {
    scheduleOffsetSeconds,
    difficultyDriftPercent,
    currentBits,
    nextBits,
    timeAvg,
    adjustedTimeAvg,
    timeOffset,
  };
}

class DifficultyAdjustmentApi {
  public getDifficultyAdjustment(): IDifficultyAdjustment | null {
    const blockHeight = blocks.getCurrentBlockHeight();
    const blocksCache = blocks.getBlocks();
    const latestBlock = blocksCache[blocksCache.length - 1];
    if (!latestBlock) {
      return null;
    }
    const nowSeconds = Math.floor(new Date().getTime() / 1000);

    // Use last ~8 blocks for average block time calculation
    const recentBlocks = blocksCache.slice(-8).map((b) => ({ timestamp: b.timestamp }));

    return calcAsertDifficultyAdjustment(
      blockHeight,
      latestBlock.timestamp,
      nowSeconds,
      config.EXPLORER.NETWORK,
      recentBlocks
    );
  }
}

export default new DifficultyAdjustmentApi();
