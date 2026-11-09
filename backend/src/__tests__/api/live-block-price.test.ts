import { IPublicApi } from '../../api/bitcoin/public-api.interface';
import { BlockExtended, VerboseTransactionExtended } from '../../mempool.interfaces';
import blocks from '../../api/blocks';
import BitcoinApi from '../../api/bitcoin/bitcoin-api';
import { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import { Common } from '../../api/common';
import BlocksRepository from '../../repositories/BlocksRepository';
import PricesRepository from '../../repositories/PricesRepository';
import priceUpdater from '../../tasks/price-updater';
import indexer from '../../indexer';
import config from '../../config';

jest.mock('../../api/bitcoin/bitcoin-api-factory');
jest.mock('../../api/bitcoin/bitcoin-client');
jest.mock('../../api/disk-cache');
jest.mock('../../api/chain-tips');
jest.mock('../../repositories/BlocksRepository');
jest.mock('../../repositories/PricesRepository');
jest.mock('../../indexer');

const block = { id: 'new-block', height: 100001, bits: 1, timestamp: 100, difficulty: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Common, 'indexingEnabled').mockReturnValue(true);
  jest.spyOn(Common, 'blocksSummariesIndexingEnabled').mockReturnValue(false);
  config.EXPLORER.CACHE_ENABLED = false;
  config.VALKEY.ENABLED = false;
  priceUpdater.historyInserted = true;
  blocks.setBlocks([{ ...block, height: 100000 } as never]);
  blocks.setBlockSummaries([]);
  (blocks as unknown as { currentBits: number }).currentBits = 1;
  jest.mocked(bitcoinCoreApi.$getBlockHeightTip).mockResolvedValue(block.height);
  jest.mocked(bitcoinCoreApi.$getBlockHash).mockResolvedValue(block.id);
  jest.mocked(bitcoinClient.getBlock).mockResolvedValue({ tx: [] } as never);
  jest.spyOn(BitcoinApi, 'convertBlock').mockReturnValue(block as never);
  jest.spyOn(blocks as any, '$getTransactionsExtended').mockResolvedValue([]);
  const blockTestHooks = blocks as unknown as {
    $getBlockExtended(block: IPublicApi.Block, transactions: VerboseTransactionExtended[]): Promise<BlockExtended>;
  };
  jest.spyOn(blockTestHooks, '$getBlockExtended').mockResolvedValue(block as never);
  jest.spyOn(blocks as any, '$handleReorgs').mockResolvedValue(undefined);
  jest.mocked(PricesRepository.$getLatestPriceId).mockResolvedValue(17);
  jest.mocked(BlocksRepository.$saveBlockPrices).mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

test('queues a failed live price write while completing the new block', async () => {
  jest.mocked(BlocksRepository.$saveBlockPrices).mockResolvedValue(false);
  expect(await blocks.$updateBlocks()).toBe(1);
  expect(indexer.queueBlockPrice).toHaveBeenCalledWith(block.height);
  expect(blocks.getBlocks().at(-1)?.id).toBe(block.id);
});

test('does not queue a successfully saved live price', async () => {
  expect(await blocks.$updateBlocks()).toBe(1);
  expect(BlocksRepository.$saveBlockPrices).toHaveBeenCalledWith([{ height: block.height, priceId: 17 }]);
  expect(indexer.queueBlockPrice).not.toHaveBeenCalled();
});

test('queues a failed latest-price lookup without writing an undefined price ID', async () => {
  jest.mocked(PricesRepository.$getLatestPriceId).mockRejectedValue(new Error('price lookup failed'));
  expect(await blocks.$updateBlocks()).toBe(1);
  expect(BlocksRepository.$saveBlockPrices).not.toHaveBeenCalled();
  expect(indexer.queueBlockPrice).toHaveBeenCalledWith(block.height);
});
