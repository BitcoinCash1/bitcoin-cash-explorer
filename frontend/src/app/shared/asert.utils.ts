// --- ASERT (aserti3-2d) functions ---
// Ported from: https://gist.github.com/A60AB5450353F40E/5607d5aeb9ba0e84a71ab8f55ebdd2ad

const ASERT_ANCHOR_BITS = '1804dafe';
const ASERT_ANCHOR_TICK = 396988200;
export const ASERT_ANCHOR_TIMESTAMP = 1605447844;
const ASERT_ANCHOR_IDEAL_BLOCK_TIME = 600;
const ASERT_ANCHOR_TAU = 172800; // half-life = 2 days
export const ASERT_ANCHOR_HEIGHT = Math.floor(
  ASERT_ANCHOR_TICK / ASERT_ANCHOR_IDEAL_BLOCK_TIME
); // 661647

export function bitsToTarget(bits: string): number {
  const exponent = parseInt(bits.slice(0, 2), 16);
  const mantissa = parseInt(bits.slice(2), 16);
  return mantissa * Math.pow(2, (exponent - 3) * 8);
}

export function targetToBits(target: number): string {
  if (target === 0) return '00000000';

  let exponent = Math.floor(Math.log2(target) / 8) + 1;
  let mantissa = Math.floor(target / Math.pow(2, (exponent - 3) * 8));

  if (mantissa > 0x7fffff) {
    mantissa = Math.floor(mantissa / 256);
    exponent++;
  }

  return (
    exponent.toString(16).padStart(2, '0') +
    mantissa.toString(16).padStart(6, '0')
  );
}

export function calculateTarget(
  heightTick: number,
  timestamp: number,
  nextTargetBlockTime: number = 600
): number {
  const anchorTarget = bitsToTarget(ASERT_ANCHOR_BITS);

  const tickDelta = heightTick - ASERT_ANCHOR_TICK;
  const timeDelta = timestamp - ASERT_ANCHOR_TIMESTAMP;

  const t = Math.trunc;
  const base = t(
    ((timeDelta - (tickDelta + ASERT_ANCHOR_IDEAL_BLOCK_TIME)) * 65536) /
      ASERT_ANCHOR_TAU
  );
  const hi = t(base / 65536) + (base < 0 ? -1 : 0);
  const lo = base - hi * 65536;

  return (
    (t(
      (195766423245049 * lo +
        971821376 * lo ** 2 +
        5127 * lo ** 3 +
        140737488355328) /
        2 ** 48
    ) +
      65536) *
    t(ASERT_ANCHOR_IDEAL_BLOCK_TIME / nextTargetBlockTime) *
    anchorTarget *
    2 ** (hi - 16)
  );
}

export function calculateTargetLegacy(
  height: number,
  timestamp: number,
  nextTargetBlockTime: number = 600
): number {
  return calculateTarget(height * 600, timestamp, nextTargetBlockTime);
}

export function getScheduleOffsetSeconds(
  height: number,
  timestamp: number
): number {
  const idealElapsed =
    (height - ASERT_ANCHOR_HEIGHT) * ASERT_ANCHOR_IDEAL_BLOCK_TIME;
  const actualElapsed = timestamp - ASERT_ANCHOR_TIMESTAMP;
  return idealElapsed - actualElapsed;
}

export function getDifficultyDriftPercentSinceAnchor(
  height: number,
  timestamp: number
): number {
  const anchorTarget = bitsToTarget(ASERT_ANCHOR_BITS);
  const currentTarget = calculateTargetLegacy(height, timestamp);
  if (anchorTarget === 0) return 0;
  // Higher target = easier = difficulty decrease (negative drift)
  // Lower target = harder = difficulty increase (positive drift)
  return ((anchorTarget - currentTarget) / anchorTarget) * 100;
}

// --- End ASERT functions ---
