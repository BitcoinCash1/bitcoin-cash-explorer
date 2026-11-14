export function validBlockLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function networkBlockLimit(
  network: string,
  baseline: number,
  overrides?: Record<string, number>
): number {
  const configured = overrides?.[network || 'mainnet'];
  if (validBlockLimit(configured)) return configured;
  if (network === 'testnet4' || network === 'chipnet') return 2000000;
  return validBlockLimit(baseline) ? baseline : 32000000;
}

export function minedBlockLimit(
  block: { abla_state?: { block_size_limit?: number } },
  fallback: number
): number {
  return validBlockLimit(block?.abla_state?.block_size_limit)
    ? block.abla_state.block_size_limit
    : fallback;
}
