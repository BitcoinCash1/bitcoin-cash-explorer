import { IElectrumApi } from './electrum-api.interface';

export function compareElectrumHistoryNewestFirst(
  a: IElectrumApi.ScriptHashHistory,
  b: IElectrumApi.ScriptHashHistory
): number {
  // Electrum uses 0 for transactions with confirmed inputs and -1 for
  // transactions with an unconfirmed parent. Both belong ahead of the chain.
  const aUnconfirmed = a.height <= 0;
  const bUnconfirmed = b.height <= 0;

  if (aUnconfirmed !== bUnconfirmed) {
    return aUnconfirmed ? -1 : 1;
  }

  return b.height - a.height;
}
