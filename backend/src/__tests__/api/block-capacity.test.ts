import config from '../../config';
import blocks from '../../api/blocks';
import { blockLimit, projectionCapacity } from '../../api/block-capacity';

describe('capacity snapshots', () => {
  afterEach(() => jest.restoreAllMocks());
  test('separates mined and next-block limits and follows a replacement tip', () => {
    const get = jest.spyOn(blocks, 'getBlocks');
    const tip = { id: 'a', abla_state: { block_size_limit: 32000000, next_block_size_limit: 33000000 } } as any;
    get.mockReturnValue([tip]);
    expect(blockLimit(tip)).toBe(32000000);
    expect(projectionCapacity()).toEqual({ tipHash: 'a', blockSizeLimit: 33000000 });
    get.mockReturnValue([{ id: 'b', abla_state: { next_block_size_limit: 2000000 } } as any]);
    expect(projectionCapacity()).toEqual({ tipHash: 'b', blockSizeLimit: 2000000 });
  });
  test('uses configuration for startup and missing or invalid ABLA', () => {
    jest.spyOn(blocks, 'getBlocks').mockReturnValue([]);
    expect(projectionCapacity().blockSizeLimit).toBe(config.EXPLORER.MIN_BLOCK_SIZE_UNITS);
    expect(blockLimit({ abla_state: { block_size_limit: -1 } })).toBe(config.EXPLORER.MIN_BLOCK_SIZE_UNITS);
  });
});
