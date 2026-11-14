import config from '../config';
import blocks from './blocks';

export interface CapacityContext {
  tipHash: string;
  blockSizeLimit: number;
}
export function validBlockLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function blockLimit(block: { abla_state?: { block_size_limit?: number } }): number {
  const limit = block?.abla_state?.block_size_limit;
  return validBlockLimit(limit) ? limit : config.EXPLORER.MIN_BLOCK_SIZE_UNITS;
}
export function projectionCapacity(): CapacityContext {
  const chain = blocks.getBlocks();
  const tip = chain[chain.length - 1];
  const limit = tip?.abla_state?.next_block_size_limit;
  return {
    tipHash: tip?.id || '',
    blockSizeLimit: validBlockLimit(limit) ? limit : config.EXPLORER.MIN_BLOCK_SIZE_UNITS,
  };
}
