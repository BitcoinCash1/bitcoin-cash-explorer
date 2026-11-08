import routes from '../../api/bitcoin/bitcoin.routes';
import blocks from '../../api/blocks';
import config from '../../config';
import logger from '../../logger';

jest.mock('../../api/blocks');
jest.mock('../../api/bitcoin/bitcoin-api-factory');
jest.mock('../../api/bitcoin/bitcoin-client');
jest.mock('../../api/disk-cache');
jest.mock('../../api/chain-tips');

test.each(['lookup', 'serialization', 'success'])('block list %s cache contract', async (scenario) => {
  config.EXPLORER.NETWORK = 'mainnet';
  jest.clearAllMocks();
  const headers = new Map();
  const result = Array.from({ length: 15 }, (_, i) => ({ height: 100 - i }));
  jest.mocked(blocks.$getBlocks).mockResolvedValue(result as never);
  if (scenario === 'lookup') {jest.mocked(blocks.$getBlocks).mockRejectedValue(new Error('secret upstream body'));}
  const res = {
    setHeader: jest.fn((k, v) => headers.set(k, v)),
    removeHeader: jest.fn((k) => headers.delete(k)),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  if (scenario === 'serialization')
    {res.json.mockImplementationOnce(() => {
      throw new Error('secret');
    });}
  await (routes as any).getBlocks({ params: { height: '100' }, accepts: () => true }, res);
  expect(blocks.$getBlocks).toHaveBeenCalledWith(100, 15);
  if (scenario === 'success') {
    expect(Date.parse(headers.get('Expires')) - Date.now()).toBeGreaterThan(58000);
    expect(res.json).toHaveBeenCalledWith(result);
    expect(logger.err).not.toHaveBeenCalled();
  } else {
    expect(headers.has('Expires')).toBe(false);
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('X-Accel-Expires')).toBe('0');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenLastCalledWith({ error: 'Failed to get blocks' });
    expect(logger.err).toHaveBeenCalledTimes(1);
    expect(jest.mocked(logger.err).mock.calls[0][0]).not.toContain('secret');
  }
});
