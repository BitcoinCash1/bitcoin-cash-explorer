import { Common } from '../../api/common';
import config from '../../config';

const randomTransactions = require('./test-data/transactions-random.json');

const standardTransactions = require('./test-data/standard-txs.json');
const nonStandardTransactions = require('./test-data/btc-txs.json');

// Actual input bytecode lengths reported by chipnet.bch.ninja for this tx:
// 00f81b99421ce2433603efee1b8dc94608d14182bec2f5121685d0ec71b9b0cc
const REPORTED_CHIPNET_SCRIPTSIG_BYTES = [
  2_725, 6_294, 6_294, 6_294, 6_294, 6_294, 6_294, 4_801, 4_808, 4_808, 4_808, 2_622, 301, 301, 1_684, 3_084, 5_036,
  5_128, 5_128, 5_128, 100,
];

describe('Common', () => {
  describe('Mempool Goggles', () => {
    const originalNetwork = config.EXPLORER.NETWORK;

    afterEach(() => {
      config.EXPLORER.NETWORK = originalNetwork;
    });

    const transactionWithScriptSigSize = (bytes: number, txid = '00'.repeat(32)) => {
      const tx = structuredClone(standardTransactions[0]);
      tx.txid = txid;
      tx.version = 1;
      tx.size = Math.max(tx.size, bytes + 100);
      tx.vin[0].scriptsig = '00'.repeat(bytes);
      tx.vin[0].scriptsig_asm = '';
      return tx;
    };

    test('should detect standard transactions', () => {
      standardTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(false);
      });
    });

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

    test.each([
      ['mainnet', 951_145],
      ['testnet4', 305_848],
      ['scalenet', 10_007],
      ['chipnet', 279_792],
    ] as const)('should activate the 10,000-byte scriptSig limit on %s at height %i', (network, firstActiveBlock) => {
      config.EXPLORER.NETWORK = network;

      expect(Common.isNonStandard(transactionWithScriptSigSize(1_650), firstActiveBlock - 1)).toEqual(false);
      expect(Common.isNonStandard(transactionWithScriptSigSize(1_651), firstActiveBlock - 1)).toEqual(true);
      expect(Common.isNonStandard(transactionWithScriptSigSize(10_000), firstActiveBlock)).toEqual(false);
      expect(Common.isNonStandard(transactionWithScriptSigSize(10_001), firstActiveBlock)).toEqual(true);
    });

    test('should apply current policy when no block height is available', () => {
      config.EXPLORER.NETWORK = 'chipnet';

      expect(Common.isNonStandard(transactionWithScriptSigSize(10_000))).toEqual(false);
      expect(Common.isNonStandard(transactionWithScriptSigSize(10_001))).toEqual(true);
    });

    test('should accept the reported May 2026 chipnet scriptSig length profile', () => {
      config.EXPLORER.NETWORK = 'chipnet';
      const tx = transactionWithScriptSigSize(
        REPORTED_CHIPNET_SCRIPTSIG_BYTES[0],
        '00f81b99421ce2433603efee1b8dc94608d14182bec2f5121685d0ec71b9b0cc'
      );
      tx.vin = REPORTED_CHIPNET_SCRIPTSIG_BYTES.map((bytes, index) => {
        const vin = structuredClone(tx.vin[0]);
        vin.txid = index.toString(16).padStart(64, '0');
        vin.scriptsig = '00'.repeat(bytes);
        return vin;
      });
      tx.version = 2;
      tx.size = 89_378;

      expect(Common.isNonStandard(tx, 320_053)).toEqual(false);
    });

    test('should keep P2S non-standard before activation', () => {
      config.EXPLORER.NETWORK = 'chipnet';
      const tx = transactionWithScriptSigSize(100);
      tx.vin[0].prevout.scriptpubkey_type = 'p2s';
      tx.vout[0].scriptpubkey_type = 'p2s';

      expect(Common.isNonStandard(tx, 279_791)).toEqual(true);
      expect(Common.isNonStandard(tx, 279_792)).toEqual(false);
    });
  });

  describe('raw transaction validation', () => {
    const rawTransactionWithScriptSigSize = (bytes: number): string => {
      const compactSize = `fd${(bytes & 0xff).toString(16).padStart(2, '0')}${((bytes >> 8) & 0xff)
        .toString(16)
        .padStart(2, '0')}`;
      return [
        '02000000',
        '01',
        '00'.repeat(32),
        '00000000',
        compactSize,
        '00'.repeat(bytes),
        'ffffffff',
        '01',
        '0000000000000000',
        '01',
        '51',
        '00000000',
      ].join('');
    };

    test('should accept 10,000-byte input scripts and reject 10,001 bytes', () => {
      const accepted = rawTransactionWithScriptSigSize(10_000);
      expect(Common.getTransactionFromRequest({ body: accepted } as any, false)).toEqual(accepted);

      const rejected = rawTransactionWithScriptSigSize(10_001);
      expect(() => Common.getTransactionFromRequest({ body: rejected } as any, false)).toThrow(
        'input script too large (10001 bytes)'
      );
    });
  });
});
