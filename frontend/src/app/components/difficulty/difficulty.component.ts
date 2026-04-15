import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  LOCALE_ID,
  OnInit,
} from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import {
  getScheduleOffsetSeconds,
  getDifficultyDriftPercent,
} from '@app/shared/asert.utils';

interface AsertStatus {
  scheduleOffsetSeconds: number;
  scheduleOffsetMinutes: number;
  difficultyDriftPercent: number;
  colorDrift: string;
  timeAvg: number;
  adjustedTimeAvg: number;
  blocksUntilHalving: number;
  timeUntilHalving: number;
  // Schedule bar: percentage offset from center, capped at [-100, 100]
  barOffsetPercent: number;
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
      map(([blocks, da]) => {
        const maxHeight = blocks.reduce(
          (max, block) => Math.max(max, block.height),
          0
        );
        const latestBlock = blocks.reduce(
          (latest, block) => (block.height > latest.height ? block : latest),
          blocks[0]
        );

        this.now = new Date().getTime();
        this.nextSubsidy = getNextBlockSubsidy(maxHeight);

        // Halving
        const blocksUntilHalving = 210000 - (maxHeight % 210000);
        const timeUntilHalving =
          new Date().getTime() + blocksUntilHalving * 600000;

        // ASERT schedule offset (computed client-side from latest block)
        const scheduleOffsetSeconds = getScheduleOffsetSeconds(
          latestBlock.height,
          latestBlock.timestamp
        );
        const scheduleOffsetMinutes = scheduleOffsetSeconds / 60;

        // ASERT difficulty drift %
        const difficultyDriftPercent = getDifficultyDriftPercent(
          latestBlock.height,
          latestBlock.timestamp
        );

        // Color for drift indicator
        let colorDrift = 'var(--transparent-fg)';
        if (difficultyDriftPercent > 0.001) {
          colorDrift = 'var(--green)';
        } else if (difficultyDriftPercent < -0.001) {
          colorDrift = 'var(--red)';
        }

        // Bar offset: map schedule offset to [-100, 100]%, capped at +/- 60 minutes
        const MAX_OFFSET_MINUTES = 60;
        const barOffsetPercent = Math.max(
          -100,
          Math.min(100, (scheduleOffsetMinutes / MAX_OFFSET_MINUTES) * 100)
        );

        if (!this.userSelectedMode) {
          this.mode = 'difficulty';
        }

        return {
          scheduleOffsetSeconds,
          scheduleOffsetMinutes,
          difficultyDriftPercent,
          colorDrift,
          timeAvg: da.timeAvg,
          adjustedTimeAvg: da.adjustedTimeAvg,
          blocksUntilHalving,
          timeUntilHalving,
          barOffsetPercent,
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

function getNextBlockSubsidy(height: number): number {
  const halvings = Math.floor(height / 210_000) + 1;
  // Force block reward to zero when right shift is undefined.
  if (halvings >= 64) {
    return 0;
  }

  let subsidy = BigInt(50 * 100_000_000);
  // Subsidy is cut in half every 210,000 blocks which will occur approximately every 4 years.
  subsidy >>= BigInt(halvings);
  return Number(subsidy);
}
