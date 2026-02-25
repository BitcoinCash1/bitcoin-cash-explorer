import {
  VerboseTransactionExtended,
  VerboseMempoolTransactionExtended,
  TransactionExtended,
  TransactionMinerInfo,
  VoutStrippedToScriptPubkey,
} from '../mempool.interfaces';
import { IPublicApi } from './bitcoin/public-api.interface';
import bitcoinApi, { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';
import * as bitcoinjs from 'bitcoinjs-lib';
import logger from '../logger';
import pLimit from '../utils/p-limit';

class TransactionUtils {
  constructor() {}

  public stripCoinbaseTransaction(tx: VerboseTransactionExtended): TransactionMinerInfo {
    return {
      vin: [
        {
          scriptsig: tx.vin[0].scriptsig || tx.vin[0]['coinbase'],
        },
      ],
      vout: tx.vout
        .map(
          (vout): VoutStrippedToScriptPubkey => ({
            scriptpubkey_address: vout.scriptpubkey_address,
            scriptpubkey_asm: vout.scriptpubkey_asm,
            value: vout.value,
          })
        )
        .filter((vout) => vout.value),
    };
  }

  /**
   * Wrapper for $getTransactionExtended with an automatic retry direct to BCHN if the first API request fails.
   * Propagates any error from the retry request.
   * @param txid
   * @param addPrevouts
   * @param lazyPrevouts
   * @param forceCore
   * @param addMempoolData
   * @returns Promise<TransactionExtended>
   */
  public async $getTransactionExtendedRetry(
    txid: string,
    addPrevouts = false,
    lazyPrevouts = false,
    forceCore = false,
    addMempoolData = false
  ): Promise<VerboseTransactionExtended> {
    try {
      const result = await this.$getTransactionExtended(txid, addPrevouts, lazyPrevouts, forceCore, addMempoolData);
      if (result) {
        return result;
      } else {
        logger.err(`Cannot fetch tx ${txid}. Reason: backend returned null data`);
      }
    } catch (e) {
      logger.err(`Cannot fetch tx ${txid}. Reason: ` + (e instanceof Error ? e.message : e));
    }
    // retry direct from Core if first request failed
    return this.$getTransactionExtended(txid, addPrevouts, lazyPrevouts, true, addMempoolData);
  }

  /**
   * @param txId
   * @param addPrevouts
   * @param lazyPrevouts
   * @param forceCore - See https://github.com/mempool/mempool/issues/2904
   * @param addMempoolData
   * @returns Promise<TransactionExtended>
   */
  public async $getTransactionExtended(
    txId: string,
    addPrevouts = false,
    lazyPrevouts = false,
    forceCore = false,
    addMempoolData = false
  ): Promise<VerboseTransactionExtended> {
    let transaction: IPublicApi.VerboseTransaction;
    if (forceCore === true) {
      transaction = (await bitcoinCoreApi.$getRawTransaction(
        txId,
        false,
        addPrevouts,
        lazyPrevouts
      )) as IPublicApi.VerboseTransaction;
    } else {
      transaction = (await bitcoinApi.$getRawTransaction(
        txId,
        false,
        addPrevouts,
        lazyPrevouts
      )) as IPublicApi.VerboseTransaction;
    }

    if (addMempoolData || !transaction?.status?.confirmed) {
      return this.extendMempoolTransaction(transaction);
    } else {
      return this.extendTransaction(transaction);
    }
  }

  /**
   *
   * @param txId
   * @param addPrevouts
   * @param lazyPrevouts
   * @param forceCore
   * @returns Promise<MempoolTransactionExtended>
   */
  public async $getMempoolTransactionExtended(
    txId: string,
    addPrevouts = false,
    lazyPrevouts = false,
    forceCore = false
  ): Promise<VerboseMempoolTransactionExtended> {
    return (await this.$getTransactionExtended(
      txId,
      addPrevouts,
      lazyPrevouts,
      forceCore,
      true
    )) as VerboseMempoolTransactionExtended;
  }

  public async $getMempoolTransactionsExtended(
    txids: string[],
    addPrevouts = false,
    lazyPrevouts = false,
    forceCore = false
  ): Promise<VerboseMempoolTransactionExtended[]> {
    const limiter = pLimit(8); // Run 8 requests at a time
    const results = await Promise.allSettled(
      txids.map((txid) =>
        limiter(() => this.$getMempoolTransactionExtended(txid, addPrevouts, lazyPrevouts, forceCore))
      )
    );
    return results
      .filter((reply) => reply.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<VerboseMempoolTransactionExtended>).value);
  }

  public extendTransaction(transaction: IPublicApi.VerboseTransaction): VerboseTransactionExtended {
    // @ts-ignore
    if (transaction.vsize) {
      // @ts-ignore
      return transaction;
    }
    const feePerSize = (transaction.fee || 0) / transaction.size;
    const transactionExtended: VerboseTransactionExtended = {
      feePerSize,
      ...transaction,
    };
    if (!transaction?.status?.confirmed && !transactionExtended.firstSeen) {
      transactionExtended.firstSeen = Math.round(Date.now() / 1000);
    }
    return transactionExtended;
  }

  public extendMempoolTransaction(transaction: IPublicApi.VerboseTransaction): VerboseMempoolTransactionExtended {
    const size = Math.ceil(transaction.size);
    const sigops = transaction.sigops ? transaction.sigops : this.countSigops(transaction);
    // https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/blob/master/src/policy/policy.cpp#L182-185
    const adjustedSize = Math.max(transaction.size, sigops * 5); // adjusted vsize = std::max(nSize, nSigChecks * bytes_per_sigcheck)
    const feePerSize = (transaction.fee || 0) / transaction.size;
    const adjustedFeePerSize = (transaction.fee || 0) / adjustedSize;
    const transactionExtended: VerboseMempoolTransactionExtended = {
      ...transaction,
      order: this.txidToOrdering(transaction.txid),
      size,
      adjustedSize,
      sigops,
      feePerSize,
      adjustedFeePerSize,
    };
    if (!transactionExtended?.status?.confirmed && !transactionExtended.firstSeen) {
      transactionExtended.firstSeen = Math.round(Date.now() / 1000);
    }
    return transactionExtended;
  }

  // Generic method to strip verbosity from any verbose transaction type
  private stripVerbosity<T extends IPublicApi.VerboseTransaction>(transaction: T): IPublicApi.Transaction {
    // Convert verbose vin/vout to non-verbose versions
    const vin = transaction.vin.map(
      (v): IPublicApi.Vin => ({
        txid: v.txid,
        vout: v.vout,
        value: v.value,
        is_coinbase: v.is_coinbase,
        scriptsig: v.scriptsig,
        scriptsig_asm: v.scriptsig_asm,
        inner_redeemscript_asm: v.inner_redeemscript_asm,
        scriptsig_byte_code: v.scriptsig_byte_code,
        scriptpubkey_byte_code_pattern: v.scriptpubkey_byte_code_pattern,
        token_category: v.token_category,
        token_amount: v.token_amount,
        token_nft_capability: v.token_nft_capability,
        token_nft_commitment: v.token_nft_commitment,
        sequence: v.sequence,
        prevout: v.prevout
          ? {
              scriptpubkey: v.prevout.scriptpubkey,
              scriptpubkey_asm: v.prevout.scriptpubkey_asm,
              scriptpubkey_type: v.prevout.scriptpubkey_type,
              scriptpubkey_address: v.prevout.scriptpubkey_address,
              token_category: v.prevout.token_category,
              token_amount: v.prevout.token_amount,
              token_nft_capability: v.prevout.token_nft_capability,
              token_nft_commitment: v.prevout.token_nft_commitment,
              value: v.prevout.value,
            }
          : null,
        lazy: v.lazy,
      })
    );

    const vout = transaction.vout.map(
      (v): IPublicApi.Vout => ({
        scriptpubkey: v.scriptpubkey,
        scriptpubkey_asm: v.scriptpubkey_asm,
        scriptpubkey_type: v.scriptpubkey_type,
        scriptpubkey_address: v.scriptpubkey_address,
        value: v.value,
        token_category: v.token_category,
        token_amount: v.token_amount,
        token_nft_capability: v.token_nft_capability,
        token_nft_commitment: v.token_nft_commitment,
      })
    );

    const result: IPublicApi.Transaction = { ...transaction };
    result.vin = vin;
    result.vout = vout;
    return result;
  }

  // Method to strip verbosity from arrays of verbose transactions
  public stripVerbosityFromTransactions(transactions: IPublicApi.VerboseTransaction[]): IPublicApi.Transaction[] {
    return transactions.map((tx) => this.stripVerbosity(tx));
  }

  // Method to strip verbosity from a single verbose transaction (extended types)
  public stripVerbosityFromTransaction(transaction: VerboseTransactionExtended): TransactionExtended {
    return this.stripVerbosity(transaction) as TransactionExtended;
  }

  public hex2ascii(hex: string) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  /**
   *  Calculate the sigops cost of an asm script
   */
  public countScriptSigops(script: string, isRawScript = false): number {
    if (!script?.length) {
      return 0;
    }

    let sigops = 0;
    // count OP_CHECKSIG and OP_CHECKSIGVERIFY
    sigops += script.match(/OP_CHECKSIG/g)?.length || 0;

    // count OP_CHECKMULTISIG and OP_CHECKMULTISIGVERIFY
    if (isRawScript) {
      // in scriptPubKey or scriptSig, always worth 20
      sigops += 20 * (script.match(/OP_CHECKMULTISIG/g)?.length || 0);
    } else {
      // in redeem scripts and witnesses, worth N if preceded by OP_N, 20 otherwise
      const matches = script.matchAll(/(?:OP_(?:PUSHNUM_)?(\d+))? OP_CHECKMULTISIG/g);
      for (const match of matches) {
        const n = parseInt(match[1]);
        if (Number.isInteger(n)) {
          sigops += n;
        } else {
          sigops += 20;
        }
      }
    }

    return sigops * 4;
  }

  public countSigops(transaction: IPublicApi.Transaction): number {
    let sigops = 0;

    for (const input of transaction.vin) {
      if (input.scriptsig_asm) {
        sigops += this.countScriptSigops(input.scriptsig_asm, true);
      }
      if (input.prevout) {
        // BCH  does not have v0_p2wpkh, v0_p2wsh or v1_p2tr
        switch (true) {
          case input.prevout.scriptpubkey_type === 'p2sh' && input.scriptsig && input.scriptsig.startsWith('160014'):
          case input.prevout?.scriptpubkey_type === 'p2sh' && input.scriptsig && input.scriptsig.startsWith('220020'):
          case input.prevout.scriptpubkey_type === 'p2sh':
            if (input.inner_redeemscript_asm) {
              sigops += this.countScriptSigops(input.inner_redeemscript_asm);
            }
            break;
        }
      }
    }

    for (const output of transaction.vout) {
      if (output.scriptpubkey_asm) {
        sigops += this.countScriptSigops(output.scriptpubkey_asm, true);
      }
    }

    return sigops;
  }

  /**
   * see https://github.com/bitcoin/bitcoin/blob/25c45bb0d0bd6618ec9296a1a43605657124e5de/src/policy/policy.cpp#L166-L193
   * returns true if the transactions is permitted under bip54 sigops rules
   *
   * "Unlike the existing block wide sigop limit which counts sigops present in the block
   * itself (including the scriptPubKey which is not executed until spending later), BIP54
   * counts sigops in the block where they are potentially executed (only).
   * This means sigops in the spent scriptPubKey count toward the limit.
   * `fAccurate` means correctly accounting sigops for CHECKMULTISIGs(VERIFY) with 16 pubkeys
   * or fewer. This method of accounting was introduced by BIP16, and BIP54 reuses it.
   * The GetSigOpCount call on the previous scriptPubKey counts both bare and P2SH sigops."
   */
  public checkSigopsBIP54(tx: VerboseTransactionExtended, limit): boolean {
    let sigops = 0;
    for (const input of tx.vin) {
      if (input.scriptsig_asm) {
        sigops += this.countScriptSigops(input.scriptsig_asm);
      }
      if (input.prevout) {
        // P2SH redeem script
        if (input.prevout.scriptpubkey_type === 'p2sh' && input.inner_redeemscript_asm) {
          sigops += this.countScriptSigops(input.inner_redeemscript_asm);
        } else {
          // prevout scriptpubkey
          sigops += this.countScriptSigops(input.prevout.scriptpubkey_asm);
        }
      }

      if (sigops > limit) {
        return false;
      }
    }
    return true;
  }

  // returns the most significant 4 bytes of the txid as an integer
  public txidToOrdering(txid: string): number {
    return parseInt(txid.substr(62, 2) + txid.substr(60, 2) + txid.substr(58, 2) + txid.substr(56, 2), 16);
  }

  public addInnerScriptsToVin(vin: IPublicApi.Vin): void {
    if (!vin.prevout) {
      return;
    }

    if (vin.prevout.scriptpubkey_type === 'p2sh' && vin.scriptsig_asm?.length) {
      const redeemScript = vin.scriptsig_asm.split(' ').reverse()[0];
      vin.inner_redeemscript_asm = this.convertScriptSigAsm(redeemScript);
    }

    // No checks of witness, that is not supported by BCH
  }

  public convertScriptSigAsm(hex: string): string {
    const buf = Buffer.from(hex, 'hex');

    const b: string[] = [];

    let i = 0;
    while (i < buf.length) {
      const op = buf[i];
      if (op >= 0x01 && op <= 0x4e) {
        i++;
        let push: number;
        if (op === 0x4c && buf.length > i) {
          push = buf.readUInt8(i);
          b.push('OP_PUSHDATA1');
          i += 1;
        } else if (op === 0x4d && buf.length > i + 1) {
          push = buf.readUInt16LE(i);
          b.push('OP_PUSHDATA2');
          i += 2;
        } else if (op === 0x4e && buf.length > i + 3) {
          push = buf.readUInt32LE(i);
          b.push('OP_PUSHDATA4');
          i += 4;
        } else {
          push = op;
          b.push('OP_PUSHBYTES_' + push);
        }

        if (i >= buf.length) {
          break;
        }
        const data = buf.subarray(i, Math.min(i + push, buf.length));
        b.push(data.toString('hex'));
        i += data.length;
        if (data.length !== push) {
          break;
        }
      } else {
        if (op === 0x00) {
          b.push('OP_0');
        } else if (op === 0x4f) {
          b.push('OP_PUSHNUM_NEG1');
        } else if (op === 0xb1) {
          b.push('OP_CLTV');
        } else if (op === 0xb2) {
          b.push('OP_CSV');
        } else {
          const opcode = bitcoinjs.script.toASM([op]);
          if (opcode && op < 0xfd) {
            if (/^OP_(\d+)$/.test(opcode)) {
              b.push(opcode.replace(/^OP_(\d+)$/, 'OP_PUSHNUM_$1'));
            } else {
              b.push(opcode);
            }
          } else {
            b.push('OP_RETURN_' + op);
          }
        }
        i += 1;
      }
    }

    return b.join(' ');
  }

  // calculate the most parsimonious set of prioritizations given a list of block transactions
  // (i.e. the most likely prioritizations and deprioritizations)
  public identifyPrioritizedTransactions(
    transactions: any[],
    rateKey: string
  ): { prioritized: string[]; deprioritized: string[] } {
    // find the longest increasing subsequence of transactions
    // (adapted from https://en.wikipedia.org/wiki/Longest_increasing_subsequence#Efficient_algorithms)
    // should be O(n log n)
    const X = transactions
      .slice(1)
      .reverse()
      .map((tx) => ({ txid: tx.txid, rate: tx[rateKey] })); // standard block order is by *decreasing* effective fee rate, but we want to iterate in increasing order (and skip the coinbase)
    if (X.length < 2) {
      return { prioritized: [], deprioritized: [] };
    }
    const N = X.length;
    const P: number[] = new Array(N);
    const M: number[] = new Array(N + 1);
    M[0] = -1; // undefined so can be set to any value

    let L = 0;
    for (let i = 0; i < N; i++) {
      // Binary search for the smallest positive l ≤ L
      // such that X[M[l]].effectiveFeePerVsize > X[i].effectiveFeePerVsize
      let lo = 1;
      let hi = L + 1;
      while (lo < hi) {
        const mid = lo + Math.floor((hi - lo) / 2); // lo <= mid < hi
        if (X[M[mid]].rate > X[i].rate) {
          hi = mid;
        } else {
          // if X[M[mid]].effectiveFeePerVsize < X[i].effectiveFeePerVsize
          lo = mid + 1;
        }
      }

      // After searching, lo == hi is 1 greater than the
      // length of the longest prefix of X[i]
      const newL = lo;

      // The predecessor of X[i] is the last index of
      // the subsequence of length newL-1
      P[i] = M[newL - 1];
      M[newL] = i;

      if (newL > L) {
        // If we found a subsequence longer than any we've
        // found yet, update L
        L = newL;
      }
    }

    // Reconstruct the longest increasing subsequence
    // It consists of the values of X at the L indices:
    // ..., P[P[M[L]]], P[M[L]], M[L]
    const LIS: any[] = new Array(L);
    let k = M[L];
    for (let j = L - 1; j >= 0; j--) {
      LIS[j] = X[k];
      k = P[k];
    }

    const lisMap = new Map<string, number>();
    LIS.forEach((tx, index) => lisMap.set(tx.txid, index));

    const prioritized: string[] = [];
    const deprioritized: string[] = [];

    let lastRate = X[0].rate;

    for (const tx of X) {
      if (lisMap.has(tx.txid)) {
        lastRate = tx.rate;
      } else {
        if (Math.abs(tx.rate - lastRate) < 0.1) {
          // skip if the rate is almost the same as the previous transaction
        } else if (tx.rate <= lastRate) {
          prioritized.push(tx.txid);
        } else {
          deprioritized.push(tx.txid);
        }
      }
    }

    return { prioritized, deprioritized };
  }

  // Copied from https://gitlab.melroy.org/bitcoincash/bitcoin-cash-explorer/-/blob/main/backend/src/api/bitcoin/bitcoin-api.ts?ref_type=heads#L378
  public translateScriptPubKeyType(outputType: string): string {
    const map = {
      pubkey: 'p2pk',
      pubkeyhash: 'p2pkh',
      scripthash: 'p2sh',
      nonstandard: 'nonstandard',
      multisig: 'multisig',
      anchor: 'anchor',
      nulldata: 'op_return',
    };

    if (map[outputType]) {
      return map[outputType];
    } else {
      return 'unknown';
    }
  }
}

export default new TransactionUtils();
