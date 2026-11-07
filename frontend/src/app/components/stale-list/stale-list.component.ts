import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, startWith } from 'rxjs/operators';
import {
  StaleTip,
  BlockExtended,
  StaleHistoryEntry,
} from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';

@Component({
  selector: 'app-stale-list',
  templateUrl: './stale-list.component.html',
  styleUrls: ['./stale-list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaleList implements OnInit, OnDestroy {
  chainTips: StaleTip[] = [];
  historyEntries: StaleHistoryEntry[] = [];
  visibleHistoryEntries: StaleHistoryEntry[] = [];
  historyNextCursor: string | null = null;
  historyLoading = false;
  historyError: 'unavailable' | 'failed' | null = null;
  recentError = false;
  isLoading = true;
  private networkSubscription: Subscription;
  private requests = new Subscription();
  private historyHashes = new Set<string>();
  private historyLoaded = false;

  gradientColors = {
    '': ['var(--mainnet-alt)', 'var(--primary)'],
    testnet4: ['var(--testnet4)', 'var(--testnet4-alt)'],
    scalenet: ['var(--scalenet)', 'var(--scalenet-alt)'],
    chipnet: ['var(--chipnet)', 'var(--chipnet-alt)'],
  };

  constructor(
    private apiService: ApiService,
    public stateService: StateService,
    private seoService: SeoService,
    public router: Router,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.networkSubscription = this.stateService.networkChanged$
      .pipe(startWith(this.stateService.network), distinctUntilChanged())
      .subscribe(() => {
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.chainTips = [];
        this.historyEntries = [];
        this.visibleHistoryEntries = [];
        this.historyHashes.clear();
        this.historyNextCursor = null;
        this.historyLoading = false;
        this.historyLoaded = false;
        this.historyError = null;
        this.recentError = false;
        this.isLoading = true;
        this.requests.add(
          this.apiService.getStaleTips$().subscribe({
            next: (tips) => {
              const hashes = new Set<string>();
              this.chainTips = tips.filter((tip) => {
                if (tip.status === 'active' || hashes.has(tip.stale.id)) {
                  return false;
                }
                hashes.add(tip.stale.id);
                return true;
              });
              this.chainTips.forEach((tip) => this.prepareEntry(tip));
              this.updateVisibleHistory();
              this.isLoading = false;
              this.changeDetector.markForCheck();
            },
            error: () => {
              this.recentError = true;
              this.isLoading = false;
              this.changeDetector.markForCheck();
            },
          })
        );
        this.loadMoreHistory();
      });

    this.seoService.setTitle(
      $localize`:@@page.stale-chain-tips:Stale Chain Tips`
    );
    this.seoService.setDescription(
      $localize`:@@meta.description.stale-chain-tips:See the most recent stale chain tips on the Bitcoin${seoDescriptionNetwork(
        this.stateService.network
      )} network.`
    );
  }

  ngOnDestroy(): void {
    this.networkSubscription?.unsubscribe();
    this.requests.unsubscribe();
  }

  loadMoreHistory(): void {
    if (
      this.historyLoading ||
      (this.historyLoaded && !this.historyNextCursor)
    ) {
      return;
    }
    this.historyLoading = true;
    this.historyError = null;
    this.changeDetector.markForCheck();
    this.requests.add(
      this.apiService
        .getStaleHistory$(this.historyNextCursor || undefined)
        .subscribe({
          next: (page) => {
            for (const entry of page.entries) {
              if (!this.historyHashes.has(entry.stale.id)) {
                this.historyHashes.add(entry.stale.id);
                this.prepareEntry(entry);
                this.historyEntries.push(entry);
              }
            }
            this.historyNextCursor = page.nextCursor;
            this.historyLoaded = true;
            this.updateVisibleHistory();
            this.historyLoading = false;
            this.changeDetector.markForCheck();
          },
          error: (error) => {
            this.historyError = error.status === 503 ? 'unavailable' : 'failed';
            this.historyLoading = false;
            this.changeDetector.markForCheck();
          },
        })
    );
  }

  trackEntry(_index: number, entry: StaleHistoryEntry): string {
    return entry.stale.id;
  }

  private updateVisibleHistory(): void {
    const recentHashes = new Set(this.chainTips.map((tip) => tip.stale.id));
    this.visibleHistoryEntries = this.historyEntries.filter(
      (entry) => !recentHashes.has(entry.stale.id)
    );
  }

  private prepareEntry(entry: StaleHistoryEntry): void {
    for (const block of [entry.stale, entry.canonical]) {
      if (block?.extras) {
        block.extras.minFee = this.getMinBlockFee(block);
        block.extras.maxFee = this.getMaxBlockFee(block);
      }
    }
  }

  getBlockGradient(block: BlockExtended): string {
    if (!block || !block.size) {
      return 'var(--secondary)';
    }

    const backgroundHeight =
      100 - (block.size / this.stateService.env.MIN_BLOCK_SIZE_UNITS) * 100;
    const network = this.stateService.network || '';

    return `repeating-linear-gradient(
      var(--secondary),
      var(--secondary) ${backgroundHeight}%,
      ${this.gradientColors[network][0]} ${Math.max(backgroundHeight, 0)}%,
      ${this.gradientColors[network][1]} 100%
    )`;
  }

  getMinBlockFee(block: BlockExtended): number {
    if (block?.extras?.feeRange) {
      if (block.extras.medianFee === block.extras.feeRange[3]) {
        return block.extras.feeRange[1];
      } else {
        return block.extras.feeRange[0];
      }
    }
    return 0;
  }

  getMaxBlockFee(block: BlockExtended): number {
    if (block?.extras?.feeRange) {
      return block.extras.feeRange[block.extras.feeRange.length - 1];
    }
    return 0;
  }
}
