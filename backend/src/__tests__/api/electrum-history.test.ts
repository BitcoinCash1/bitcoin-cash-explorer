import { compareElectrumHistoryNewestFirst } from '../../api/bitcoin/electrum-history';
import { IElectrumApi } from '../../api/bitcoin/electrum-api.interface';

describe('Electrum history ordering', () => {
  test('keeps chained mempool transactions on the first address page', () => {
    const confirmed: IElectrumApi.ScriptHashHistory[] = Array.from({ length: 12 }, (_, index) => ({
      height: 320_971 - index,
      tx_hash: `confirmed-${index}`,
    }));
    const mempool: IElectrumApi.ScriptHashHistory[] = [
      { height: 0, tx_hash: 'root', fee: 700 },
      { height: -1, tx_hash: 'child-1', fee: 700 },
      { height: -1, tx_hash: 'child-2', fee: 700 },
      { height: -1, tx_hash: 'child-3', fee: 700 },
      { height: -1, tx_hash: 'child-4', fee: 700 },
    ];

    const firstPage = [...confirmed, ...mempool].sort(compareElectrumHistoryNewestFirst).slice(0, 10);

    expect(firstPage.slice(0, 5).map((entry) => entry.tx_hash)).toEqual([
      'root',
      'child-1',
      'child-2',
      'child-3',
      'child-4',
    ]);
    expect(firstPage.filter((entry) => entry.height <= 0)).toHaveLength(5);
    expect(firstPage.slice(5).map((entry) => entry.tx_hash)).toEqual(
      confirmed.slice(0, 5).map((entry) => entry.tx_hash)
    );
  });
});
