import { getNextHalving } from '@app/shared/block-timing';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  LOCALE_ID,
  OnInit,
} from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  getScheduleOffsetSeconds,
  getDifficultyDriftPercentSinceAnchor,
  getAsertAnchorHeight,
  getAsertAnchor,
} from '@app/shared/asert.utils';
import { StateService } from '@app/services/state.service';
import { AsertPoint } from '@app/components/asert-deviation-graph/asert-deviation-graph.component';

interface AsertStatus {
  difficultyDriftPercent: number;
  colorDrift: string;
  timeAvg: number;
  blocksUntilHalving: number;
  halvingProgressPercent: number;
  timeUntilHalving: number;
  diffChangePercent: number;
  diffChangeBlocks: number;
  colorDiffChange: string;
}

@Component({
  selector: 'app-difficulty',
  templateUrl: './difficulty.component.html',
  styleUrls: ['./difficulty.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyComponent implements OnInit {
  @Input() showProgress = true;
  @Input() showHalving = false;
  @Input() showTitle = true;

  isLoadingWebSocket$: Observable<boolean>;
  asertStatus$: Observable<AsertStatus>;

  mode: 'difficulty' | 'halving' = 'difficulty';
  userSelectedMode: boolean = false;

  now: number = Date.now();
  nextSubsidy: number;
  asertData: AsertPoint[] = [];
  private asertNetwork: string;
  private asertRawData: AsertPoint[] = [];

  get asertAnchorHeight(): number {
    return getAsertAnchorHeight(this.stateService.network);
  }

  get asertAnchorTimestamp(): number {
    return getAsertAnchor(this.stateService.network).timestamp;
  }

  constructor(
    public stateService: StateService,
    @Inject(LOCALE_ID) private locale: string
  ) {}

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.asertStatus$ = combineLatest([
      this.stateService.blocks$,
      this.stateService.difficultyAdjustment$,
    ]).pipe(
      filter(([blocks, da]) => blocks.length > 0 && !!da),
      map(([blocks, da]) => {
        if (this.asertNetwork !== this.stateService.network) {
          this.asertRawData = [];
          this.asertNetwork = this.stateService.network;
        }
        const maxHeight = blocks.reduce(
          (max, block) => Math.max(max, block.height),
          0
        );
        const latestBlock = blocks.reduce(
          (latest, block) => (block.height > latest.height ? block : latest),
          blocks[0]
        );

        this.now = new Date().getTime();
        const halving = getNextHalving(this.stateService.network, maxHeight);
        this.nextSubsidy = halving.subsidySats;

        // Halving
        const blocksUntilHalving = halving.blocksRemaining;
        const timeUntilHalving =
          new Date().getTime() + halving.secondsRemaining * 1000;

        // ASERT difficulty drift %
        const difficultyDriftPercentSinceAnchor =
          getDifficultyDriftPercentSinceAnchor(
            latestBlock.height,
            latestBlock.timestamp,
            this.stateService.network,
            latestBlock.bits
          );

        // Color for drift indicator
        let colorDrift = 'var(--transparent-fg)';
        if (difficultyDriftPercentSinceAnchor > 0.001) {
          colorDrift = 'var(--green)';
        } else if (difficultyDriftPercentSinceAnchor < -0.001) {
          colorDrift = 'var(--red)';
        }

        // Difficulty change over visible blocks
        const sorted = [...blocks].sort((a, b) => a.height - b.height);
        const oldestBlock = sorted[0];
        const diffChangeBlocks = sorted.length;
        let diffChangePercent = 0;
        if (oldestBlock && oldestBlock.difficulty > 0) {
          diffChangePercent =
            ((latestBlock.difficulty - oldestBlock.difficulty) /
              oldestBlock.difficulty) *
            100;
        }
        let colorDiffChange = 'var(--transparent-fg)';
        if (diffChangePercent > 0.001) {
          colorDiffChange = 'var(--green)';
        } else if (diffChangePercent < -0.001) {
          colorDiffChange = 'var(--red)';
        }

        // Build ASERT deviation points from all known blocks (relative to baseline)
        const absolutePoints = sorted.map((block) => ({
          height: block.height,
          deviation: getScheduleOffsetSeconds(
            block.height,
            block.timestamp,
            this.stateService.network
          ),
          timestamp: block.timestamp,
        }));
        // Merge new points into raw rolling window (absolute values), dedup by height
        this.asertRawData = [
          ...this.asertRawData,
          ...absolutePoints.filter(
            (p) => !this.asertRawData.some((e) => e.height === p.height)
          ),
        ]
          .sort((a, b) => a.height - b.height)
          .slice(-100);
        // Normalize: subtract first point's deviation so chart centers at 0
        const baseline =
          this.asertRawData.length > 0 ? this.asertRawData[0].deviation : 0;
        this.asertData = this.asertRawData.map((p) => ({
          height: p.height,
          deviation: p.deviation - baseline,
          timestamp: p.timestamp,
        }));

        if (!this.userSelectedMode) {
          this.mode = 'difficulty';
        }

        return {
          difficultyDriftPercent: difficultyDriftPercentSinceAnchor,
          colorDrift,
          timeAvg: da.timeAvg,
          blocksUntilHalving,
          halvingProgressPercent: halving.progressPercent,
          timeUntilHalving,
          diffChangePercent,
          diffChangeBlocks,
          colorDiffChange,
        };
      })
    );
  }

  setMode(mode: 'difficulty' | 'halving'): boolean {
    this.mode = mode;
    this.userSelectedMode = true;
    return false;
  }
}
