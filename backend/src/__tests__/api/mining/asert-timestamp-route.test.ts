import routes from '../../../api/mining/mining-routes';
import mining from '../../../api/mining/mining';

jest.mock('../../../api/mining/mining', () => ({ __esModule: true, default: { $getAsertBlocks: jest.fn() } }));

const fetchBlocks = jest.mocked(mining.$getAsertBlocks);
const invoke = async (query: Record<string, unknown>) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), header: jest.fn(), setHeader: jest.fn() };
  await (routes as any).$getAsertBlocks({ params: { blockheight: '900000' }, query, accepts: () => true }, res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchBlocks.mockResolvedValue([]);
});

test.each(['-1', '1.5', 'NaN', '', '253402300800', '9007199254740992', ['1'], { x: '1' }])(
  'rejects malformed timestamp %j before mining access',
  async (value) => {
    for (const key of ['fromTimestamp', 'toTimestamp']) {
      const res = await invoke({ [key]: value });
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(fetchBlocks).not.toHaveBeenCalled();
  }
);

test('rejects reversed timestamp range', async () => {
  expect((await invoke({ fromTimestamp: '2', toTimestamp: '1' })).status).toHaveBeenCalledWith(400);
  expect(fetchBlocks).not.toHaveBeenCalled();
});

test.each([
  [{}, undefined, undefined],
  [{ fromTimestamp: '0' }, 0, undefined],
  [{ toTimestamp: '253402300799' }, undefined, 253402300799],
  [{ fromTimestamp: '1794746156', toTimestamp: '1794746156' }, 1794746156, 1794746156],
])('passes valid optional bounds to mining %j', async (query, from, to) => {
  const res = await invoke(query);
  expect(res.status).not.toHaveBeenCalled();
  expect(fetchBlocks).toHaveBeenCalledWith(900000, from, to);
  expect(res.json).toHaveBeenCalledWith([]);
});
