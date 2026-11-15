/** CHIP-2025-03, revision 2b15bb825adf84d82aab2100fc1cc38479d59666.
 * https://gitlab.com/0353F40E/fablous/-/blob/2b15bb825adf84d82aab2100fc1cc38479d59666/readme.md
 * Observed chipnet activation: BCHN 29.2.1 RPC (binary reports 3e6827e95), block
 * 00000000000ecc7187034ddaa4327af300c23fd57bfd2557af6ca2392a022671.
 * This is the first short block; the CHIP calls its parent H_a.
 */
export const CHIPNET_FIRST_SHORT_BLOCK = 332451;
export const CHIPNET_ACTIVATION_TIMESTAMP = 1794746156;
const LAST_LONG_HEIGHT = CHIPNET_FIRST_SHORT_BLOCK - 1;

export function getTargetBlockSeconds(network: string, height: number): number {
  return network === 'chipnet' && height >= CHIPNET_FIRST_SHORT_BLOCK
    ? 60
    : 600;
}

export function getBlockTicks(network: string, height: number): number {
  return network === 'chipnet' && height >= CHIPNET_FIRST_SHORT_BLOCK
    ? LAST_LONG_HEIGHT * 600 + (height - LAST_LONG_HEIGHT) * 60
    : height * 600;
}

export function getBlockSubsidySats(network: string, height: number): number {
  const chunks = (BigInt(getBlockTicks(network, height)) + 599n) / 600n;
  const halvings = chunks / 210000n;
  if (halvings >= 64n) return 0;
  return Number(
    ((5000000000n >> halvings) *
      BigInt(getTargetBlockSeconds(network, height))) /
      600n
  );
}

export function getNextHalving(
  network: string,
  height: number
): {
  height: number;
  blocksRemaining: number;
  secondsRemaining: number;
  subsidySats: number;
  progressPercent: number;
} {
  const ticks = getBlockTicks(network, height);
  const nextChunk = (Math.floor(Math.ceil(ticks / 600) / 210000) + 1) * 210000;
  // First block in the next 600-tick chunk, including its own interval.
  const previousChunkTicks = (nextChunk - 1) * 600;
  const halvingHeight =
    network === 'chipnet' && previousChunkTicks >= LAST_LONG_HEIGHT * 600
      ? LAST_LONG_HEIGHT +
        (previousChunkTicks - LAST_LONG_HEIGHT * 600) / 60 +
        1
      : nextChunk;
  return {
    height: halvingHeight,
    progressPercent: (Math.ceil(ticks / 600) % 210000) / 2100,
    blocksRemaining: halvingHeight - height,
    secondsRemaining: getBlockTicks(network, halvingHeight) - ticks,
    subsidySats: getBlockSubsidySats(network, halvingHeight),
  };
}
