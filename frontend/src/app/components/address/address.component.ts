import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ElectrsApiService } from '@app/services/backend-api.service';
import {
  switchMap,
  filter,
  catchError,
  map,
  tap,
  skip,
  distinctUntilChanged,
  startWith,
} from 'rxjs/operators';
import {
  Address,
  ChainStats,
  Transaction,
  Utxo,
  Vin,
  AddressTransactionCount,
} from '@app/interfaces/backend-api.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { ApiService } from '@app/services/api.service';
import {
  of,
  merge,
  Subscription,
  Observable,
  forkJoin,
  EMPTY,
  combineLatest,
  timer,
} from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { AddressInformation } from '@interfaces/node-api.interface';
import {
  AddressTypeInfo,
  convertToTokenAddress,
  cashAddrToLegacy,
  legacyToCashAddr,
  isTokenAddress,
  tokenToCashAddr,
} from '@app/shared/address-utils';

class AddressStats implements ChainStats {
  address: string;
  scriptpubkey?: string;
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;

  constructor(stats: ChainStats, address: string, scriptpubkey?: string) {
    Object.assign(this, stats);
    this.address = address;
    this.scriptpubkey = scriptpubkey;
  }

  public addTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (
        vin.prevout?.scriptpubkey_address === this.address ||
        this.scriptpubkey === vin.prevout?.scriptpubkey
      ) {
        this.spendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (
        vout.scriptpubkey_address === this.address ||
        this.scriptpubkey === vout.scriptpubkey
      ) {
        this.fundTxo(vout.value);
      }
    }
    this.tx_count++;
  }

  public removeTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (
        vin.prevout?.scriptpubkey_address === this.address ||
        this.scriptpubkey === vin.prevout?.scriptpubkey
      ) {
        this.unspendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (
        vout.scriptpubkey_address === this.address ||
        this.scriptpubkey === vout.scriptpubkey
      ) {
        this.unfundTxo(vout.value);
      }
    }
    this.tx_count--;
  }

  private fundTxo(value: number): void {
    this.funded_txo_sum += value;
    this.funded_txo_count++;
  }

  private unfundTxo(value: number): void {
    this.funded_txo_sum -= value;
    this.funded_txo_count--;
  }

  private spendTxo(value: number): void {
    this.spent_txo_sum += value;
    this.spent_txo_count++;
  }

  private unspendTxo(value: number): void {
    this.spent_txo_sum -= value;
    this.spent_txo_count--;
  }

  get balance(): number {
    return this.funded_txo_sum - this.spent_txo_sum;
  }

  get totalReceived(): number {
    return this.funded_txo_sum;
  }

  get utxos(): number {
    return this.funded_txo_count - this.spent_txo_count;
  }
}

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss'],
  standalone: false,
})
export class AddressComponent implements OnInit, OnDestroy {
  network = '';

  isMobile: boolean;
  showQR: boolean = false;
  addressType: 'bch' | 'token' | 'legacy' = 'bch';
  displayAddress = '';
  bchAddressString: string;

  address: Address;
  addressString: string;
  isLoadingAddress = true;
  transactions: Transaction[];
  utxos: Utxo[];
  isLoadingTransactions = true;
  retryLoadMore = false;
  error: any;
  mainSubscription: Subscription;
  mempoolTxSubscription: Subscription;
  mempoolRemovedTxSubscription: Subscription;
  blockTxSubscription: Subscription;
  networkChangeSubscription: Subscription;
  addressLoadingStatus$: Observable<number>;
  addressInfo: null | AddressInformation = null;
  addressTypeInfo: null | AddressTypeInfo;

  fullyLoaded = false;
  chainStats: AddressStats;
  mempoolStats: AddressStats;

  exampleChannel?: any;

  now = Date.now() / 1000;
  balancePeriod: 'all' | '1m' = 'all';

  paginatedMode = false;
  transactionError: any;
  countError: any;
  countResult: AddressTransactionCount | null = null;
  countRunning = false;
  countPaused = false;
  pageResetRequired = false;
  private emptyPageContinuations = 0;
  private liveTransactions = new Map<string, Transaction>();
  private removedTransactions = new Set<string>();
  private nextPageCursor: string | null = null;
  private pageSnapshot: string | null = null;
  private countCursor: string | null = null;
  private countSubscription = new Subscription();
  private pagedSubscriptions = new Subscription();
  private summarySubscription = new Subscription();
  private pageSubscription = new Subscription();
  private pagedScript: string | undefined;
  private pagedTarget = '';

  private tempTransactions: Transaction[];
  private timeTxIndexes: number[];
  private lastTransactionTxId: string;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.network = this.stateService.network;
    this.networkChangeSubscription =
      this.stateService.networkChanged$.subscribe((network) => {
        this.network = network;
        this.cdr.markForCheck();
      });
    this.websocketService.want(['blocks']);

    this.onResize();

    this.addressLoadingStatus$ = this.route.paramMap.pipe(
      switchMap(() => this.stateService.loadingIndicators$),
      map((indicators) =>
        indicators['address-' + this.addressString] !== undefined
          ? indicators['address-' + this.addressString]
          : 0
      )
    );

    this.mainSubscription = combineLatest([
      this.route.paramMap,
      this.stateService.backend$.pipe(distinctUntilChanged()),
      this.stateService.networkChanged$.pipe(
        startWith(this.stateService.network),
        distinctUntilChanged()
      ),
    ])
      .pipe(
        switchMap(([params, backend]) => {
          this.cancelPagedRequests();
          this.paginatedMode = backend === 'electrum';
          this.transactionError = null;
          this.countResult = null;
          this.countCursor = null;
          this.countError = null;
          this.liveTransactions.clear();
          this.removedTransactions.clear();
          this.emptyPageContinuations = 0;
          this.websocketService.stopTrackingAddress();
          this.pageSnapshot = null;
          this.nextPageCursor = null;
          this.pageResetRequired = false;
          this.error = undefined;
          this.isLoadingAddress = true;
          this.fullyLoaded = false;
          this.address = null;
          this.isLoadingTransactions = true;
          this.transactions = null;
          this.utxos = null;
          this.addressInfo = null;
          this.exampleChannel = null;
          this.cdr.markForCheck();
          document.body.scrollTo(0, 0);
          this.addressString = params.get('id') || '';
          if (
            /^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(
              this.addressString
            )
          ) {
            this.addressString = this.addressString.toLowerCase();
          }
          const network = this.stateService.network || 'mainnet';
          const isLegacy =
            !this.addressString.includes(':') &&
            (this.addressString.startsWith('1') ||
              this.addressString.startsWith('3') ||
              this.addressString.startsWith('m') ||
              this.addressString.startsWith('n') ||
              this.addressString.startsWith('2'));
          if (isLegacy) {
            try {
              this.bchAddressString = legacyToCashAddr(
                this.addressString,
                network
              );
            } catch {
              this.bchAddressString = this.addressString;
            }
            this.addressType = 'legacy';
          } else if (isTokenAddress(this.addressString)) {
            this.bchAddressString =
              tokenToCashAddr(this.addressString) || this.addressString;
            this.addressType = 'token';
          } else {
            this.bchAddressString = this.addressString;
            this.addressType = 'bch';
          }
          this.displayAddress = this.addressString;
          this.seoService.setTitle(
            $localize`:@@address.component.browser-title:Address: ${this.addressString}:INTERPOLATION:`
          );
          this.seoService.setDescription(
            $localize`See mempool transactions, confirmed transactions, balance, and more for Bitcoin Cash${seoDescriptionNetwork(this.stateService.network)} address ${
              this.addressString
            }.`
          );

          this.addressTypeInfo = new AddressTypeInfo(
            this.stateService.network || 'mainnet',
            this.addressString
          );

          if (this.paginatedMode) {
            this.startPagedAddress();
            return EMPTY;
          }

          return merge(
            of(true),
            this.stateService.connectionState$.pipe(
              filter(
                (state) =>
                  state === 2 &&
                  this.transactions &&
                  this.transactions.length > 0
              )
            )
          ).pipe(
            switchMap(() =>
              (this.addressString.match(
                /04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}/
              )
                ? this.electrsApiService.getPubKeyAddress$(this.addressString)
                : this.electrsApiService.getAddress$(this.addressString)
              ).pipe(
                catchError((err) => {
                  this.isLoadingAddress = false;
                  this.error = err;
                  this.seoService.logSoft404();
                  console.log(err);
                  this.cdr.markForCheck();
                  return of(null);
                })
              )
            )
          );
        })
      )
      .pipe(
        filter((address) => !!address),
        tap((address: Address) => {
          this.websocketService.startTrackAddress(address.address);
        }),
        switchMap((address) => {
          this.address = address;
          this.updateChainStats();
          this.isLoadingAddress = false;
          this.isLoadingTransactions = true;
          this.cdr.markForCheck();
          const utxoCount = this.chainStats.utxos + this.mempoolStats.utxos;
          return forkJoin([
            address.is_pubkey
              ? this.electrsApiService.getScriptHashTransactions$(
                  (address.address.length === 66 ? '21' : '41') +
                    address.address +
                    'ac'
                )
              : this.electrsApiService.getAddressTransactions$(address.address),
            (utxoCount > 2 && utxoCount <= 500
              ? address.is_pubkey
                ? this.electrsApiService.getScriptHashUtxos$(
                    (address.address.length === 66 ? '21' : '41') +
                      address.address +
                      'ac'
                  )
                : this.electrsApiService.getAddressUtxos$(address.address)
              : of(null)
            ).pipe(
              catchError(() => {
                return of(null);
              })
            ),
          ]);
        }),
        switchMap(([transactions, utxos]) => {
          this.utxos = utxos;

          this.tempTransactions = transactions;
          if (transactions?.length) {
            this.lastTransactionTxId =
              transactions[transactions.length - 1].txid;
          }

          const fetchTxs: string[] = [];
          this.timeTxIndexes = [];
          transactions?.forEach((tx, index) => {
            if (!tx.status.confirmed) {
              fetchTxs.push(tx.txid);
              this.timeTxIndexes.push(index);
            }
          });
          if (!fetchTxs.length) {
            return of([]);
          }
          return this.apiService.getTransactionTimes$(fetchTxs).pipe(
            catchError((err) => {
              this.isLoadingAddress = false;
              this.isLoadingTransactions = false;
              this.error = err;
              this.seoService.logSoft404();
              console.log(err);
              this.cdr.markForCheck();
              return of([]);
            })
          );
        })
      )
      .subscribe({
        next: (times: number[] | null) => {
          if (times && this.tempTransactions) {
            times.forEach((time, index) => {
              if (
                this.timeTxIndexes[index] !== undefined &&
                this.tempTransactions[this.timeTxIndexes[index]]
              ) {
                this.tempTransactions[this.timeTxIndexes[index]].firstSeen =
                  time;
              }
            });
            this.tempTransactions.sort((a, b) => {
              if (b.status.confirmed) {
                if (b.status.block_height === a.status.block_height) {
                  return b.status.block_time - a.status.block_time;
                }
                return b.status.block_height - a.status.block_height;
              }
              return (b.firstSeen || 0) - (a.firstSeen || 0);
            });

            this.transactions = this.tempTransactions;
            if (
              this.transactions.length ===
              this.mempoolStats.tx_count + this.chainStats.tx_count
            ) {
              this.fullyLoaded = true;
            }

            const addressVin: Vin[] = [];
            const vinIds: string[] = [];
            for (const tx of this.transactions) {
              tx.vin.forEach((v, index) => {
                if (
                  v.prevout?.scriptpubkey_address ===
                  (this.address?.address || this.bchAddressString)
                ) {
                  addressVin.push(v);
                  vinIds.push(`${tx.txid}:${index}`);
                }
              });
            }
            if (this.addressTypeInfo) {
              this.addressTypeInfo.processInputs(addressVin, vinIds);
              this.addressTypeInfo = this.addressTypeInfo.clone();
            }

            if (!this.showBalancePeriod()) {
              this.setBalancePeriod('all');
            } else {
              this.setBalancePeriod('1m');
            }
          }

          this.isLoadingAddress = false;
          this.isLoadingTransactions = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.log(error);
          this.error = error;
          this.seoService.logSoft404();
          this.isLoadingAddress = false;
          this.isLoadingTransactions = false;
          this.cdr.markForCheck();
        },
      });

    this.mempoolTxSubscription =
      this.stateService.mempoolTransactions$.subscribe((tx) => {
        if (this.paginatedMode) {
          this.liveTransactions.set(tx.txid, tx);
          this.removedTransactions.delete(tx.txid);
          this.addTransaction(tx);
          this.refreshPagedSummary();
        } else {
          this.addTransaction(tx);
          this.mempoolStats?.addTx(tx);
        }
        this.cdr.markForCheck();
      });

    this.mempoolRemovedTxSubscription =
      this.stateService.mempoolRemovedTransactions$.subscribe((tx) => {
        this.removeTransaction(tx);
        if (this.paginatedMode) {
          this.liveTransactions.delete(tx.txid);
          this.removedTransactions.add(tx.txid);
          this.refreshPagedSummary();
        } else this.mempoolStats?.removeTx(tx);
        this.cdr.markForCheck();
      });

    this.blockTxSubscription = this.stateService.blockTransactions$.subscribe(
      (transaction) => {
        if (this.paginatedMode) {
          this.liveTransactions.set(transaction.txid, transaction);
          this.removedTransactions.delete(transaction.txid);
          const existing = this.transactions?.find(
            (tx) => tx.txid === transaction.txid
          );
          if (existing) {
            existing.status = transaction.status;
            this.transactions = this.transactions.slice();
          } else {
            this.addTransaction(transaction, false);
          }
          this.refreshPagedSummary();
          this.cdr.markForCheck();
          return;
        }
        const tx = this.transactions?.find((t) => t.txid === transaction.txid);
        if (tx) {
          tx.status = transaction.status;
          this.transactions = this.transactions.slice();
          this.mempoolStats.removeTx(transaction);
          this.audioService.playSound('magic');
          this.confirmTransaction(tx);
        } else {
          if (this.addTransaction(transaction, false)) {
            this.audioService.playSound('magic');
          }
        }
        this.chainStats.addTx(transaction);
        this.cdr.markForCheck();
      }
    );
  }

  addTransaction(transaction: Transaction, playSound: boolean = true): boolean {
    if (
      !this.transactions ||
      this.transactions.some((t) => t.txid === transaction.txid)
    ) {
      return false;
    }

    this.transactions.unshift(transaction);
    this.transactions = this.transactions.slice();

    if (playSound) {
      if (
        transaction.vout.some(
          (vout) =>
            vout?.scriptpubkey_address ===
            (this.address?.address || this.bchAddressString)
        )
      ) {
        this.audioService.playSound('cha-ching');
      } else {
        this.audioService.playSound('chime');
      }
    }

    // update utxos in-place
    if (this.utxos != null) {
      let utxosChanged = false;
      for (const vin of transaction.vin) {
        const utxoIndex = this.utxos.findIndex(
          (utxo) => utxo.txid === vin.txid && utxo.vout === vin.vout
        );
        if (utxoIndex !== -1) {
          this.utxos.splice(utxoIndex, 1);
          utxosChanged = true;
        }
      }
      for (const [index, vout] of transaction.vout.entries()) {
        if (
          vout.scriptpubkey_address ===
          (this.address?.address || this.bchAddressString)
        ) {
          this.utxos.push({
            txid: transaction.txid,
            vout: index,
            value: vout.value,
            status: JSON.parse(JSON.stringify(transaction.status)),
          });
          utxosChanged = true;
        }
      }
      if (utxosChanged) {
        this.utxos = this.utxos.slice();
      }
    }
    return true;
  }

  removeTransaction(transaction: Transaction): boolean {
    if (!this.transactions) {
      return false;
    }
    const index = this.transactions.findIndex(
      (tx) => tx.txid === transaction.txid
    );
    if (index === -1) {
      return false;
    }

    this.transactions.splice(index, 1);
    this.transactions = this.transactions.slice();

    // update utxos in-place
    if (this.utxos != null) {
      let utxosChanged = false;
      for (const vin of transaction.vin) {
        if (
          vin.prevout?.scriptpubkey_address ===
          (this.address?.address || this.bchAddressString)
        ) {
          this.utxos.push({
            txid: vin.txid,
            vout: vin.vout,
            value: vin.prevout.value,
            status: { confirmed: true },
          });
          utxosChanged = true;
        }
      }
      for (const [index, vout] of transaction.vout.entries()) {
        if (
          vout.scriptpubkey_address ===
          (this.address?.address || this.bchAddressString)
        ) {
          const utxoIndex = this.utxos.findIndex(
            (utxo) => utxo.txid === transaction.txid && utxo.vout === index
          );
          if (utxoIndex !== -1) {
            this.utxos.splice(utxoIndex, 1);
            utxosChanged = true;
          }
        }
      }
      if (utxosChanged) {
        this.utxos = this.utxos.slice();
      }
    }

    return true;
  }

  confirmTransaction(transaction: Transaction): void {
    // update utxos in-place
    if (this.utxos != null) {
      let utxosChanged = false;
      for (const vin of transaction.vin) {
        if (
          vin.prevout?.scriptpubkey_address ===
          (this.address?.address || this.bchAddressString)
        ) {
          const utxoIndex = this.utxos.findIndex(
            (utxo) => utxo.txid === vin.txid && utxo.vout === vin.vout
          );
          if (utxoIndex !== -1) {
            this.utxos[utxoIndex].status = JSON.parse(
              JSON.stringify(transaction.status)
            );
            utxosChanged = true;
          }
        }
      }
      for (const [index, vout] of transaction.vout.entries()) {
        if (
          vout.scriptpubkey_address ===
          (this.address?.address || this.bchAddressString)
        ) {
          const utxoIndex = this.utxos.findIndex(
            (utxo) => utxo.txid === transaction.txid && utxo.vout === index
          );
          if (utxoIndex !== -1) {
            this.utxos[utxoIndex].status = JSON.parse(
              JSON.stringify(transaction.status)
            );
            utxosChanged = true;
          }
        }
      }
      if (utxosChanged) {
        this.utxos = this.utxos.slice();
      }
    }
  }

  loadMore(): void {
    if (this.paginatedMode) {
      this.emptyPageContinuations = 0;
      this.loadPagedTransactions();
      return;
    }
    if (this.isLoadingTransactions || this.fullyLoaded) {
      return;
    }
    this.isLoadingTransactions = true;
    this.retryLoadMore = false;
    this.cdr.markForCheck();

    (this.address.is_pubkey
      ? this.electrsApiService.getScriptHashTransactions$(
          ((this.address?.address || this.bchAddressString).length === 66
            ? '21'
            : '41') +
            (this.address?.address || this.bchAddressString) +
            'ac',
          this.lastTransactionTxId
        )
      : this.electrsApiService.getAddressTransactions$(
          this.address?.address || this.bchAddressString,
          this.lastTransactionTxId
        )
    ).subscribe({
      next: (transactions: Transaction[]) => {
        if (transactions && transactions.length) {
          this.lastTransactionTxId = transactions[transactions.length - 1].txid;
          this.transactions = (this.transactions || []).concat(transactions);
        } else {
          this.fullyLoaded = true;
        }
        this.isLoadingTransactions = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoadingTransactions = false;
        this.retryLoadMore = true;
        this.cdr.markForCheck();
        if (error.status === 422) {
          window.location.reload();
        }
      },
    });
  }

  private cancelPagedRequests(): void {
    this.pagedSubscriptions.unsubscribe();
    this.pagedSubscriptions = new Subscription();
    this.summarySubscription.unsubscribe();
    this.pageSubscription.unsubscribe();
    this.cancelCount();
  }

  private startPagedAddress(): void {
    const pubkey = /^(?:04[a-fA-F0-9]{128}|(?:02|03)[a-fA-F0-9]{64})$/.test(
      this.addressString
    );
    this.pagedTarget = this.bchAddressString;
    this.pagedScript = pubkey
      ? (this.addressString.length === 130 ? '41' : '21') +
        this.addressString +
        'ac'
      : undefined;
    this.isLoadingTransactions = false;
    this.refreshPagedSummary();
    this.loadPagedTransactions();
    this.pagedSubscriptions.add(
      this.stateService.connectionState$
        .pipe(
          skip(1),
          filter((state) => state === 2)
        )
        .subscribe(() => this.refreshPagedSummary())
    );
  }

  refreshPagedSummary(): void {
    this.summarySubscription.unsubscribe();
    this.summarySubscription = this.electrsApiService
      .getAddressBalanceSummary$(this.pagedTarget, this.pagedScript)
      .subscribe({
        next: (summary) => {
          // Balance-only data has no transaction or output totals. Keep these unknown.
          const stats = (balance: number): ChainStats => ({
            funded_txo_sum: balance,
            spent_txo_sum: 0,
            funded_txo_count: undefined,
            spent_txo_count: undefined,
            tx_count: undefined,
          });
          this.address = {
            address: this.pagedScript ? this.addressString : summary.address,
            electrum: true,
            is_pubkey: !!this.pagedScript,
            chain_stats: stats(summary.confirmedBalance),
            mempool_stats: stats(summary.pendingBalance),
          };
          this.updateChainStats();
          this.websocketService.startTrackAddress(this.address.address);
          this.error = null;
          this.isLoadingAddress = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = error;
          this.isLoadingAddress = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadPagedTransactions(): void {
    if (this.isLoadingTransactions && !this.pageSubscription.closed) return;
    if (this.fullyLoaded) return;
    this.isLoadingTransactions = true;
    this.retryLoadMore = false;
    const replace = !this.nextPageCursor;
    this.pageSubscription = this.electrsApiService
      .getAddressTransactionPage$(
        this.pagedTarget,
        this.pagedScript,
        this.nextPageCursor || undefined
      )
      .subscribe({
        next: (page) => {
          if (!replace && this.pageSnapshot !== page.snapshotHash) {
            this.handlePageError({ status: 409 });
            return;
          }
          this.pageSnapshot = page.snapshotHash;
          this.nextPageCursor = page.nextCursor;
          const merged = replace
            ? page.transactions
            : [...(this.transactions || []), ...page.transactions];
          const live = Array.from(this.liveTransactions.values());
          const byId = new Map([...live, ...merged].map((tx) => [tx.txid, tx]));
          for (const tx of live) byId.set(tx.txid, tx);
          this.transactions = Array.from(byId.values()).filter(
            (tx) => !this.removedTransactions.has(tx.txid)
          );
          this.fullyLoaded = page.complete;
          this.transactionError = null;
          this.pageResetRequired = false;
          this.isLoadingTransactions = false;
          if (
            !page.complete &&
            !page.transactions.length &&
            this.emptyPageContinuations++ < 3
          ) {
            this.pagedSubscriptions.add(
              timer(0).subscribe(() => this.loadPagedTransactions())
            );
          } else if (page.transactions.length) {
            this.emptyPageContinuations = 0;
          }
          this.cdr.markForCheck();
        },
        error: (error) => this.handlePageError(error),
      });
  }

  private requiresSnapshotReset(error: any): boolean {
    return (
      error.status === 409 || error.error?.code === 'INVALID_ADDRESS_CURSOR'
    );
  }

  private handlePageError(error: any): void {
    this.transactionError = error;
    this.retryLoadMore = true;
    this.isLoadingTransactions = false;
    if (this.requiresSnapshotReset(error)) {
      this.pageResetRequired = true;
      this.nextPageCursor = null;
      this.pageSnapshot = null;
      this.fullyLoaded = false;
    }
    this.cdr.markForCheck();
  }

  calculateCount(): void {
    if (this.countRunning) return;
    this.countError = null;
    this.countSubscription = new Subscription();
    this.countRunning = true;
    this.continueCount();
  }

  cancelCount(): void {
    this.countRunning = false;
    this.countPaused = false;
    this.countSubscription.unsubscribe();
  }

  private continueCount(): void {
    if (!this.countRunning) return;
    if (document.hidden) {
      this.countPaused = true;
      return;
    }
    this.countPaused = false;
    this.countSubscription.add(
      this.electrsApiService
        .getAddressTransactionCount$(
          this.pagedTarget,
          this.pagedScript,
          this.countCursor || undefined
        )
        .subscribe({
          next: (result) => {
            if (
              this.countCursor &&
              this.countResult?.snapshotHash !== result.snapshotHash
            ) {
              this.handleCountError({ status: 409 });
              return;
            }
            this.countResult = result;
            this.countCursor = result.nextCursor;
            if (result.complete) this.countRunning = false;
            else {
              // Yield between bounded foreground batches; navigation/visibility can cancel the next one.
              this.countSubscription.add(
                timer(0).subscribe(() => this.continueCount())
              );
            }
            this.cdr.markForCheck();
          },
          error: (error) => this.handleCountError(error),
        })
    );
  }

  private handleCountError(error: any): void {
    this.countError = error;
    this.countRunning = false;
    if (this.requiresSnapshotReset(error)) {
      this.countResult = null;
      this.countCursor = null;
    }
    this.cdr.markForCheck();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!this.paginatedMode || !this.countRunning) return;
    if (document.hidden) {
      this.countSubscription.unsubscribe();
      this.countPaused = true;
    } else {
      this.countSubscription = new Subscription();
      this.continueCount();
    }
    this.cdr.markForCheck();
  }

  updateChainStats(): void {
    this.chainStats = new AddressStats(
      this.address.chain_stats,
      this.address?.address || this.bchAddressString
    );
    this.mempoolStats = new AddressStats(
      this.address.mempool_stats,
      this.address?.address || this.bchAddressString
    );
  }

  setBalancePeriod(period: 'all' | '1m'): boolean {
    this.balancePeriod = period;
    return false;
  }

  showBalancePeriod(): boolean {
    return (
      !!this.transactions?.length &&
      (!this.transactions[0].status?.confirmed ||
        this.transactions[0].status.block_time > this.now - 60 * 60 * 24 * 30)
    );
  }

  updateDisplayAddress(type: 'bch' | 'token' | 'legacy'): void {
    this.addressType = type;
    if (type === 'token') {
      this.displayAddress =
        convertToTokenAddress(this.bchAddressString) || this.addressString;
    } else if (type === 'legacy') {
      try {
        this.displayAddress = cashAddrToLegacy(
          this.bchAddressString,
          this.stateService.network || 'mainnet'
        );
      } catch {
        this.displayAddress = this.addressString;
      }
    } else {
      this.displayAddress = this.bchAddressString;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  ngOnDestroy(): void {
    this.cancelPagedRequests();
    this.mainSubscription.unsubscribe();
    this.mempoolTxSubscription.unsubscribe();
    this.mempoolRemovedTxSubscription.unsubscribe();
    this.blockTxSubscription.unsubscribe();
    this.websocketService.stopTrackingAddress();
    this.networkChangeSubscription?.unsubscribe();
  }
}
