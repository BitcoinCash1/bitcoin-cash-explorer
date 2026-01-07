import { IEsploraApi } from './api/bitcoin/esplora-api.interface';
import { OrphanedBlock } from './api/chain-tips';
import { HeapNode } from './utils/pairing-heap';

export interface PoolTag {
  id: number;
  uniqueId: number;
  name: string;
  link: string;
  regexes: string; // JSON array
  addresses: string; // JSON array
  slug: string;
}

export interface PoolInfo {
  poolId: number; // mysql row id
  name: string;
  link: string;
  blockCount: number;
  slug: string;
  avgMatchRate: number | null;
  avgFeeDelta: number | null;
  poolUniqueId: number;
}

export interface PoolStats extends PoolInfo {
  rank: number;
  emptyBlocks: number;
}

export interface BlockAudit {
  version: number;
  time: number;
  height: number;
  hash: string;
  unseenTxs: string[];
  missingTxs: string[];
  freshTxs: string[];
  sigopTxs: string[];
  addedTxs: string[];
  prioritizedTxs: string[];
  matchRate: number;
  expectedFees?: number;
  expectedSize?: number;
  template?: any[];
}

export interface TransactionAudit {
  seen?: boolean;
  expected?: boolean;
  added?: boolean;
  prioritized?: boolean;
  delayed?: number;
  coinbase?: boolean;
  firstSeen?: number;
}

export interface AuditScore {
  hash: string;
  matchRate?: number;
  expectedFees?: number;
  expectedSize?: number;
}

export interface MempoolBlock {
  blockSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
}

export interface MempoolBlockWithTransactions extends MempoolBlock {
  transactionIds: string[];
  transactions: TransactionClassified[];
}

export interface MempoolBlockDelta {
  added: TransactionCompressed[];
  removed: string[];
  changed: MempoolDeltaChange[];
}

export interface MempoolDeltaTxids {
  sequence: number;
  added: string[];
  removed: string[];
  mined: string[];
  // replaced; Not used in BCH (since we do not have RBF)
}

export interface MempoolDelta {
  sequence: number;
  added: MempoolTransactionExtended[];
  removed: string[];
  mined: string[];
  // replaced;  Not used in BCH (since we do not have RBF)
}

interface VinStrippedToScriptsig {
  scriptsig: string;
}

interface VoutStrippedToScriptPubkey {
  scriptpubkey_address: string | undefined;
  scriptpubkey_asm: string | undefined;
  value: number;
}

export interface TransactionExtended extends IEsploraApi.Transaction {
  feePerSize: number; // Fee per size is differently calculated in BCH
  firstSeen?: number;
  effectiveFeePerSize: number; // We might not have this in BCH
  ancestors?: Ancestor[];
  descendants?: Ancestor[];
  bestDescendant?: BestDescendant | null;
  position?: {
    block: number;
    size: number;
  };
  feeDelta?: number; // Does BCH has fee delta? I suspect this was part of CPFP
  replacement?: boolean; // Does BCH has replacement? This is part of RBF
  uid?: number;
  flags?: number;
}

export interface MempoolTransactionExtended extends TransactionExtended {
  order: number;
  sigops: number;
  adjustedSize: number; // We might not have this in BCH
  adjustedFeePerSize: number; // We might not have this in BCH
  inputs?: number[];
  lastBoosted?: number;
}

export interface AuditTransaction {
  uid: number;
  fee: number;
  size: number;
  feePerSize: number; // We might not have this in BCH
  effectiveFeePerSize: number; // We might not have this in BCH
  sigops: number;
  inputs: number[];
  relativesSet: boolean;
  ancestorMap: Map<number, AuditTransaction>;
  children: Set<AuditTransaction>;
  ancestorFee: number;
  ancestorSize: number;
  ancestorSigops: number;
  score: number;
  used: boolean;
  modified: boolean;
  modifiedNode: HeapNode<AuditTransaction>;
  dependencyRate?: number;
}

export interface CompactThreadTransaction {
  uid: number;
  fee: number;
  size: number;
  sigops: number;
  feePerSize: number; // We might not have this in BCH
  effectiveFeePerSize: number; // We might not have this in BCH
  inputs: number[];
  dirty?: boolean;
}

export interface GbtCandidates {
  txs: { [txid: string]: boolean };
  added: MempoolTransactionExtended[];
  removed: MempoolTransactionExtended[];
}

export interface ThreadTransaction {
  txid: string;
  fee: number;
  size: number;
  feePerSize: number; // We might not have this in BCH
  effectiveFeePerSize?: number; // We might not have this in BCH
  inputs: number[];
}

export interface Ancestor {
  txid: string;
  size: number;
  fee: number;
}

export interface TransactionSet {
  fee: number;
  size: number;
  score: number;
  children?: Set<string>;
  available?: boolean;
  modified?: boolean;
  modifiedNode?: HeapNode<string>;
}

interface BestDescendant {
  txid: string;
  size: number;
  fee: number;
}

// Is stripped transaction used for witness data? BCH doesn't have witness after all.
export interface TransactionStripped {
  txid: string;
  fee: number;
  size: number;
  value: number;
  rate?: number; // effective fee rate
  time?: number;
}

export interface TransactionClassified extends TransactionStripped {
  flags: number;
}

// [txid, fee, size, value, rate, flags, acceleration?]
export type TransactionCompressed = [string, number, number, number, number, number, number, 1?];
// [txid, rate, flags, acceleration?]
export type MempoolDeltaChange = [string, number, number, 1 | 0];

// binary flags for transaction classification
export const TransactionFlags = {
  // features
  rbf: 0b00000001n, // Not used by BCH
  no_rbf: 0b00000010n, // Not used by BCH
  v1: 0b00000100n,
  v2: 0b00001000n,
  v3: 0b00010000n,
  nonstandard: 0b00100000n,
  // address types
  p2pk: 0b00000001_00000000n,
  p2ms: 0b00000010_00000000n,
  p2pkh: 0b00000100_00000000n,
  p2sh: 0b00001000_00000000n,
  p2wpkh: 0b00010000_00000000n, // pay to witness (keyhash), not used by BCH
  p2wsh: 0b00100000_00000000n, // pay to witness (scripthash), not used by BCH
  p2tr: 0b01000000_00000000n, // pay to witness (taproot), BCH doesn't have tap root
  // behavior
  cpfp_parent: 0b00000001_00000000_00000000n, // Not used by BCH
  cpfp_child: 0b00000010_00000000_00000000n, // Not used by BCH
  replacement: 0b00000100_00000000_00000000n, // Not used by BCH
  // data
  op_return: 0b00000001_00000000_00000000_00000000n,
  fake_pubkey: 0b00000010_00000000_00000000_00000000n,
  inscription: 0b00000100_00000000_00000000_00000000n,
  fake_scripthash: 0b00001000_00000000_00000000_00000000n,
  annex: 0b00010000_00000000_00000000_00000000n, // related to witness, not used by BCH
  // heuristics
  coinjoin: 0b00000001_00000000_00000000_00000000_00000000n,
  consolidation: 0b00000010_00000000_00000000_00000000_00000000n,
  batch_payout: 0b00000100_00000000_00000000_00000000_00000000n,
  // sighash
  sighash_all: 0b00000001_00000000_00000000_00000000_00000000_00000000n,
  sighash_none: 0b00000010_00000000_00000000_00000000_00000000_00000000n,
  sighash_single: 0b00000100_00000000_00000000_00000000_00000000_00000000n,
  sighash_default: 0b00001000_00000000_00000000_00000000_00000000_00000000n,
  sighash_acp: 0b00010000_00000000_00000000_00000000_00000000_00000000n,
};

export interface BlockExtension {
  totalFees: number;
  medianFee: number; // median fee rate
  feeRange: number[]; // fee rate percentiles
  reward: number;
  matchRate: number | null;
  expectedFees: number | null;
  expectedSize: number | null;
  similarity?: number;
  pool: {
    id: number; // Note - This is the `unique_id`, not to mix with the auto increment `id`
    name: string;
    slug: string;
    minerNames: string[] | null;
  };
  avgFee: number;
  avgFeeRate: number;
  coinbaseRaw: string;
  orphans: OrphanedBlock[] | null;
  coinbaseAddress: string | null;
  coinbaseAddresses: string[] | null;
  coinbaseSignature: string | null;
  coinbaseSignatureAscii: string | null;
  size: number;
  avgTxSize: number;
  totalInputs: number;
  totalOutputs: number;
  totalOutputAmt: number;
  medianFeeAmt: number | null; // median fee in sats
  feePercentiles: number[] | null; // fee percentiles in sats
  header: string;
  firstSeen: number | null;
  utxoSetChange: number;
  // Requires coinstatsindex, will be set to NULL otherwise
  utxoSetSize: number | null;
  totalInputAmt: number | null;
  // pools-v2.json git hash
  definitionHash: string | undefined;
}

/**
 * Note: Everything that is added in here will be automatically returned through
 * /api/v1/block and /api/v1/blocks APIs
 */
export interface BlockExtended extends IEsploraApi.Block {
  extras: BlockExtension;
  canonical?: string;
  indexVersion?: number;
}

export interface BlockSummary {
  id: string;
  transactions: TransactionClassified[];
  version?: number;
}

export interface AuditSummary extends BlockAudit {
  timestamp?: number;
  size?: number;
  tx_count?: number;
  transactions: TransactionClassified[];
  template?: TransactionClassified[];
}

export interface BlockPrice {
  height: number;
  priceId: number;
}

export interface TransactionMinerInfo {
  vin: VinStrippedToScriptsig[];
  vout: VoutStrippedToScriptPubkey[];
}

export interface MempoolStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface EffectiveFeeStats {
  medianFee: number; // median effective fee rate
  feeRange: number[]; // 2nd, 10th, 25th, 50th, 75th, 90th, 98th percentiles
}

export interface WorkingEffectiveFeeStats extends EffectiveFeeStats {
  minFee: number;
  maxFee: number;
}

export interface Statistic {
  id?: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  bytes_per_second: number;
  total_fee: number;
  mempool_byte_size: number;
  fee_data: string;
  min_fee: number;

  size_0: number;
  size_1: number;
  size_2: number;
  size_3: number;
  size_4: number;
  size_5: number;
  size_6: number;
  size_8: number;
  size_10: number;
  size_12: number;
  size_15: number;
  size_20: number;
  size_30: number;
  size_40: number;
  size_50: number;
  size_60: number;
  size_70: number;
  size_80: number;
  size_90: number;
  size_100: number;
  size_125: number;
  size_150: number;
  size_175: number;
  size_200: number;
  size_250: number;
  size_300: number;
  size_350: number;
  size_400: number;
  size_500: number;
  size_600: number;
  size_700: number;
  size_800: number;
  size_900: number;
  size_1000: number;
  size_1200: number;
  size_1400: number;
  size_1600: number;
  size_1800: number;
  size_2000: number;
}

export interface OptimizedStatistic {
  added: string;
  count: number;
  bytes_per_second: number;
  total_fee: number;
  mempool_byte_size: number;
  min_fee: number;
  sizes: number[];
}

export interface TxTrackingInfo {
  position?: {
    block: number;
    size: number;
    feeDelta?: number;
  };
  utxoSpent?: { [vout: number]: { vin: number; txid: string } };
  feeDelta?: number; // Used by BCH at all?
  confirmed?: boolean;
}

export interface WebsocketResponse {
  action: string;
  data: string[];
  'track-tx': string;
  'track-address': string;
  'watch-mempool': boolean;
}

export interface BytesPerSecond {
  unixTime: number;
  size: number;
}

export interface RequiredSpec {
  [name: string]: RequiredParams;
}

interface RequiredParams {
  required: boolean;
  types: ('@string' | '@number' | '@boolean' | string)[];
}

export interface ILoadingIndicators {
  [name: string]: number;
}

export interface IBackendInfo {
  hostname: string;
  gitCommit: string;
  version: string;
  coreVersion: string;
  backend: 'electrum' | 'none';
}

export interface INetworkInfo {
  version: number;
  subversion: string;
  protocolversion: number;
  localservices: string;
  localrelay: boolean;
  timeoffset: number;
  networkactive: boolean;
  networks: {
    name: string;
    limited: boolean;
    reachable: boolean;
    proxy: string;
    proxy_randomize_credentials: boolean;
  }[];
  relayfee: number;
  incrementalfee: number;
  localaddresses: {
    address: string;
    port: number;
    score: number;
  }[];
  warnings: string;
}

export interface IDifficultyAdjustment {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  previousTime: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
  expectedBlocks: number;
}

export interface IndexedDifficultyAdjustment {
  time: number; // UNIX timestamp
  height: number; // Block height
  difficulty: number;
  adjustment: number;
}

export interface RewardStats {
  totalReward: number;
  totalFee: number;
  totalTx: number;
}
