import blocks from '../../api/blocks';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';

test('stale statistics independently order fee, bytes and fee/byte without reordering transactions', async () => {
  const transactions = [
    { txid: 'coinbase', fee: 100, size: 300, vin: [{}], vout: [{ value: 10000 }] },
    { txid: 'second', fee: 200, size: 100, vin: [{}], vout: [{ value: 500 }] },
    { txid: 'third', fee: 300, size: 200, vin: [{}], vout: [{ value: 100 }] },
  ];
  const original = structuredClone(transactions);
  const block = {
    id: 'stale',
    stale: true,
    size: 600,
    height: 1,
    timestamp: 123,
    abla_state: { block_size: 600, block_size_limit: 32000000, next_block_size_limit: 32000000 },
  };
  const result = await (blocks as any).$getBlockStats(block, transactions);
  expect(result).toMatchObject({
    minfee: 100,
    medianfee: 200,
    maxfee: 300,
    mintxsize: 100,
    mediantxsize: 200,
    maxtxsize: 300,
    minfeerate: 1 / 3,
    maxfeerate: 2,
    avgfeerate: 1,
    avgtxsize: 200,
    subsidy: 9400,
    block_size: 600,
    block_size_limit: 32000000,
  });
  expect(transactions).toEqual(original);
  expect(transactions[0].txid).toBe('coinbase');
});

test('canonical statistics continue using the BCHN RPC result', async () => {
  const rpc = jest.spyOn(bitcoinClient, 'getBlockStats').mockResolvedValue({ height: 42 } as any);
  try {
    expect(await (blocks as any).$getBlockStats({ id: 'canonical', stale: false }, [])).toEqual({ height: 42 });
    expect(rpc).toHaveBeenCalledWith('canonical');
  } finally {
    rpc.mockRestore();
  }
});
