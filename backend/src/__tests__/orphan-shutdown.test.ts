import chainTips from '../api/chain-tips';
import blocks from '../api/blocks';
import summaries from '../repositories/BlocksSummariesRepository';
import { Common } from '../api/common';
import shutdown from '../utils/shutdown';

jest.mock('../api/blocks', () => ({
  $indexBlock: jest.fn(),
  $indexBlockSummary: jest.fn(),
  $indexBlockByHeight: jest.fn(),
}));
jest.mock('../repositories/BlocksSummariesRepository', () => ({ $isSummaryIndexed: jest.fn() }));
jest.mock('../api/bitcoin/bitcoin-api-factory', () => ({}));
jest.mock('../api/bitcoin/bitcoin-client', () => ({}));
jest.mock('../api/common', () => ({ Common: { sleep$: jest.fn() } }));

test('finishes the current orphan block but retains the queued backlog on shutdown', async () => {
  const queue = Array.from({ length: 12 }, (_, index) => ({
    block: { id: String(index), height: index + 1 },
    tip: { height: 20, status: 'valid-fork' },
  }));
  (chainTips as any).indexingQueue = queue;
  (chainTips as any).staleTips = {};
  (summaries.$isSummaryIndexed as jest.Mock).mockResolvedValue(false);
  (blocks.$indexBlock as jest.Mock).mockImplementation(async (_id, block) => block);
  (blocks.$indexBlockSummary as jest.Mock).mockResolvedValue(undefined);
  (blocks.$indexBlockByHeight as jest.Mock).mockResolvedValue({ id: 'canonical', height: 1 });
  let releaseDelay!: () => void;
  const delayed = new Promise<void>((resolve) => {
    releaseDelay = resolve;
  });
  let startedDelay!: () => void;
  const delayStarted = new Promise<void>((resolve) => {
    startedDelay = resolve;
  });
  (Common.sleep$ as jest.Mock).mockImplementation(() => {
    startedDelay();
    return delayed;
  });
  const work = (chainTips as any).$indexOrphanedBlocks();
  try {
    await delayStarted;
    shutdown.stop();
    releaseDelay();
    await work;
    await shutdown.drain();
    expect(blocks.$indexBlock).toHaveBeenCalledTimes(1);
    expect(blocks.$indexBlockSummary).toHaveBeenCalledTimes(1);
    expect(blocks.$indexBlockByHeight).toHaveBeenCalledWith(1);
    expect((chainTips as any).staleTips[1].hash).toBe('0');
    expect(queue).toHaveLength(11);
    expect(queue[0].block.id).toBe('1');
    expect((chainTips as any).indexingOrphanedBlocks).toBe(false);
  } finally {
    shutdown.stopping = false;
  }
});
