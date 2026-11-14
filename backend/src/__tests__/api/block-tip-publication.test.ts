import config from '../../config';
import blocks from '../../api/blocks';
import mempoolBlocks from '../../api/mempool-blocks';
import { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import { Common } from '../../api/common';
import chainTips from '../../api/chain-tips';

test.each([false, true])(
  'async callbacks see the new canonical tip and failures stay retryable (fail=%s)',
  async (fail) => {
    const state = blocks as any;
    const previous = {
      blocks: state.blocks,
      summaries: state.blockSummaries,
      callbacks: state.newAsyncBlockCallbacks,
      sync: state.newBlockCallbacks,
      bits: state.currentBits,
      height: state.currentBlockHeight,
    };
    const cache = config.EXPLORER.CACHE_ENABLED,
      valkey = config.VALKEY.ENABLED;
    const engine = new (mempoolBlocks.constructor as any)();
    try {
      config.EXPLORER.CACHE_ENABLED = false;
      config.VALKEY.ENABLED = false;
      state.blocks = [{ id: 'old', height: 100, abla_state: { next_block_size_limit: 2000000 } }];
      state.blockSummaries = [];
      state.currentBits = 1;
      state.newAsyncBlockCallbacks = [];
      state.newBlockCallbacks = [];
      const next = {
        id: 'new',
        height: 101,
        bits: 1,
        abla_state: { block_size_limit: 2000000, next_block_size_limit: 2100000 },
      };
      jest.spyOn(bitcoinCoreApi, '$getBlockHeightTip').mockResolvedValue(101);
      jest.spyOn(bitcoinCoreApi, '$getBlockHash').mockResolvedValue('new');
      jest.spyOn(bitcoinClient, 'getBlock').mockResolvedValue({ hash: 'new', height: 101, tx: [] });
      jest.spyOn(state, '$getTransactionsExtended').mockResolvedValue([]);
      jest.spyOn(state, '$getBlockExtended').mockResolvedValue(next);
      jest.spyOn(state, 'summarizeBlockTransactions').mockReturnValue({ id: 'new' });
      jest.spyOn(Common, 'indexingEnabled').mockReturnValue(false);
      jest.spyOn(chainTips, 'updateOrphanedBlocks').mockResolvedValue(undefined);
      blocks.setNewAsyncBlockCallback(async (block) => {
        await engine.$rustMakeBlockTemplates([], {}, undefined, true);
        expect(engine.getCapacity()).toEqual({ tipHash: block.id, blockSizeLimit: 2100000 });
        expect(blocks.getBlocks().at(-1)?.id).toBe(block.id);
        if (fail) throw new Error('callback failed');
      });
      if (fail) {
        await expect(state.$updateBlocksWithCacheLocked({})).rejects.toThrow('callback failed');
        expect(blocks.getBlocks().map((b) => b.id)).toEqual(['old']);
        state.newAsyncBlockCallbacks = [];
        await state.$updateBlocksWithCacheLocked({});
      } else {
        await state.$updateBlocksWithCacheLocked({});
      }
      expect(blocks.getBlocks().map((b) => b.id)).toEqual(['old', 'new']);
    } finally {
      state.blocks = previous.blocks;
      state.blockSummaries = previous.summaries;
      state.newAsyncBlockCallbacks = previous.callbacks;
      state.newBlockCallbacks = previous.sync;
      state.currentBits = previous.bits;
      state.currentBlockHeight = previous.height;
      config.EXPLORER.CACHE_ENABLED = cache;
      config.VALKEY.ENABLED = valkey;
      jest.restoreAllMocks();
    }
  }
);
