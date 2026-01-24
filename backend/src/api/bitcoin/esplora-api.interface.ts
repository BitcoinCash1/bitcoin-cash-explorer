export namespace IEsploraApi {
  export interface Transaction {
    txid: string;
    version: number;
    locktime: number;
    size: number;
    fee: number;
    sigops?: number;
    vin: Vin[];
    vout: Vout[];
    status: Status;
    hex?: string;
  }

  export interface Recent {
    txid: string;
    fee: number;
    vsize: number;
    value: number;
  }

  export interface Vin {
    txid: string;
    vout: number;
    value: number | null;
    is_coinbase: boolean;
    scriptsig: string; // in hex
    scriptsig_asm: string; // in asm
    scriptsig_byte_code_pattern: string; // in hex
    scriptsig_byte_code_data: string[]; // script data in hex
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_byte_code_pattern: string; // in hex
    scriptpubkey_byte_code_data: string[]; // script data in hex
    scriptpubkey_address?: string;
    inner_redeemscript_asm: string;
    // TODO: Add tokenData (CashToken) as well
    sequence: any;
    prevout: Vout | null;
    // Custom
    lazy?: boolean;
  }

  export interface Vout {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    scriptpubkey_byte_code_pattern: string; // in hex
    scriptpubkey_byte_code_data: string[]; // script data in hex
    value: number;
  }

  export interface Status {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  }

  export interface AblaState {
    block_size: number;
    block_size_limit: number;
    next_block_size_limit: number;
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
    mediantime: number;
    stale: boolean;
    abla_state?: AblaState;
  }

  export interface Address {
    address: string;
    chain_stats: ChainStats;
    mempool_stats: MempoolStats;
    electrum?: boolean;
  }

  export interface ScriptHash {
    scripthash: string;
    chain_stats: ChainStats;
    mempool_stats: MempoolStats;
    electrum?: boolean;
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
    txid?: string;
    vin?: number;
    status?: Status;
  }

  export interface AddressTxSummary {
    txid: string;
    value: number;
    height: number;
    time: number;
    tx_position?: number;
  }

  export interface MerkleProof {
    merkle: string[];
    block_height: number;
    pos: number;
  }

  export interface UTXO {
    txid: string;
    vout: number;
    status: {
      confirmed: boolean;
      block_height?: number;
      block_hash?: string;
      block_time?: number;
    };
    value: number;
  }
}
