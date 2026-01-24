import { Price } from '@app/services/price.service';

export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  fee: number;
  vin: Vin[];
  vout: Vout[];
  status: Status;

  // Custom properties
  firstSeen?: number;
  feePerSize?: number;
  ancestors?: Ancestor[];
  descendants?: Ancestor[];
  feeDelta?: number;
  deleteAfter?: number;
  _unblinded?: any;
  _deduced?: boolean;
  _outspends?: Outspend[];
  price?: Price;
  sigops?: number;
  flags?: bigint;
  largeInput?: boolean;
  largeOutput?: boolean;
}

interface Ancestor {
  txid: string;
  size: number;
  fee: number;
}

interface BestDescendant {
  txid: string;
  size: number;
  fee: number;
}

export interface Recent {
  txid: string;
  fee: number;
  size: number;
  value: number;
}

export interface Vin {
  value: number | null;
  txid: string;
  vout: number;
  is_coinbase: boolean;
  scriptsig: string; // in hex
  scriptsig_asm: string; // in asm
  scriptsig_byte_code_pattern: string; // in hex
  scriptsig_byte_code_data: string[]; // script data in hex
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  scriptpubkey_byte_code_pattern: string; // in hex
  scriptpubkey_byte_code_data: string[]; // script data in hex
  inner_redeemscript_asm: string;
  // TODO: Add tokenData (CashToken) as well
  sequence: any;
  prevout: Vout | null;
  // Custom
  lazy?: boolean;
  // temporary field for extracted raw simplicity scripts
  inner_simplicityscript?: string;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  scriptpubkey_byte_code_pattern: string; // in hex
  scriptpubkey_byte_code_data: string[]; // script data in hex
  value: number;
  // Ord
  isRunestone?: boolean;
}

export interface Status {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface Block {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  bits: number;
  nonce: number;
  difficulty: number;
  merkle_root: string;
  tx_count: number;
  size: number;
  previousblockhash: string;
  stale?: boolean;
  canonical?: string;
  // TODO: Add optional ABLA fields
}

export interface Address {
  electrum?: boolean;
  address: string;
  chain_stats: ChainStats;
  mempool_stats: MempoolStats;
  is_pubkey?: boolean;
}

export interface ScriptHash {
  electrum?: boolean;
  scripthash: string;
  chain_stats: ChainStats;
  mempool_stats: MempoolStats;
}

export interface AddressOrScriptHash {
  electrum?: boolean;
  address?: string;
  scripthash?: string;
  chain_stats: ChainStats;
  mempool_stats: MempoolStats;
}

export interface AddressTxSummary {
  txid: string;
  value: number;
  height: number;
  time: number;
  price?: number;
  tx_position?: number;
}

export interface ChainStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface MempoolStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface Outspend {
  spent: boolean;
  txid: string;
  vin: number;
  status: Status;
}

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: Status;
}
