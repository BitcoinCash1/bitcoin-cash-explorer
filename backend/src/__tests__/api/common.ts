import { Common } from '../../api/common';

const randomTransactions = require('./test-data/transactions-random.json');
const nonStandardTransactions = require('./test-data/non-standard-txs.json');

describe('Common', () => {
  describe('Mempool Goggles', () => {
    test('should detect nonstandard transactions', () => {
      nonStandardTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(true);
      });
    });

    test('should not misclassify as nonstandard transactions', () => {
      randomTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(false);
      });
    });
  });
});
