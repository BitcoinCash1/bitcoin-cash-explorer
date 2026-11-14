export function validBlockLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function minedBlockLimit(
  block: { abla_state?: { block_size_limit?: number } },
  fallback: number | null
): number | null {
  return validBlockLimit(block?.abla_state?.block_size_limit)
    ? block.abla_state.block_size_limit
    : fallback;
}
