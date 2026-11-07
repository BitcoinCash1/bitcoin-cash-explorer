import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { StateService } from '@app/services/state.service';
import {
  Address,
  AddressTxSummary,
} from '@app/interfaces/backend-api.interface';
import { ElectrsApiService } from '@app/services/backend-api.service';
import { Observable, Subscription, catchError, of } from 'rxjs';

@Component({
  selector: 'app-balance-widget',
  templateUrl: './balance-widget.component.html',
  styleUrls: ['./balance-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BalanceWidgetComponent implements OnChanges, OnDestroy {
  private subscription: Subscription;
  @Input() address: string;
  @Input() addressInfo: Address;
  @Input() addressSummary$: Observable<AddressTxSummary[]> | null;
  @Input() isPubkey: boolean = false;

  isLoading: boolean = true;
  error: any;

  total: number = 0;
  delta7d: number = 0;
  delta30d: number = 0;

  constructor(
    public stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.subscription &&
      (!this.subscription.closed || !this.error) &&
      this.addressInfo &&
      !changes['addressSummary$'] &&
      !changes['address'] &&
      !changes['isPubkey']
    ) {
      this.total =
        this.addressInfo.chain_stats.funded_txo_sum -
        this.addressInfo.chain_stats.spent_txo_sum;
      this.cd.markForCheck();
      return;
    }
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.error = null;
    this.total = this.delta7d = this.delta30d = 0;
    this.isLoading = true;
    if (!this.addressSummary$ && (!this.address || !this.addressInfo)) {
      this.isLoading = false;
      this.cd.markForCheck();
      return;
    }
    const summary$ =
      this.addressSummary$ ||
      (this.isPubkey
        ? this.electrsApiService.getScriptHashSummary$(
            (this.address.length === 66 ? '21' : '41') + this.address + 'ac'
          )
        : this.electrsApiService.getAddressSummary$(this.address));
    this.subscription = summary$
      .pipe(
        catchError((error) => {
          this.error = `Failed to fetch address balance history: ${error?.status || ''} ${error?.statusText || 'unknown error'}`;
          return of(null);
        })
      )
      .subscribe((summary) => {
        if (summary) {
          this.error = null;
          this.calculateStats(summary);
        } else {
          this.error ||= $localize`Unable to load balance history. Waiting to retry.`;
        }
        this.isLoading = false;
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  calculateStats(summary: AddressTxSummary[]): void {
    let weekTotal = 0;
    let monthTotal = 0;
    this.total = this.addressInfo
      ? this.addressInfo.chain_stats.funded_txo_sum -
        this.addressInfo.chain_stats.spent_txo_sum
      : summary.reduce((acc, tx) => acc + tx.value, 0);

    const weekAgo =
      new Date(
        new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000
      ).getTime() / 1000;
    const monthAgo =
      new Date(
        new Date().setHours(0, 0, 0, 0) - 30 * 24 * 60 * 60 * 1000
      ).getTime() / 1000;
    for (let i = 0; i < summary.length && summary[i].time >= monthAgo; i++) {
      monthTotal += summary[i].value;
      if (summary[i].time >= weekAgo) {
        weekTotal += summary[i].value;
      }
    }
    this.delta7d = weekTotal;
    this.delta30d = monthTotal;
  }
}
