import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import {
  getScheduleOffsetSeconds,
  getDifficultyDriftPercent,
} from '@app/shared/asert.utils';

interface AsertMiningStatus {
  difficultyDriftPercent: number;
  colorDrift: string;
  scheduleOffsetMinutes: number;
  scheduleOffsetSeconds: number;
  blocksUntilHalving: number;
  timeUntilHalving: number;
  timeAvg: number;
  adjustedTimeAvg: number;
}

@Component({
  selector: 'app-chain-stats-mining',
  templateUrl: './chain-stats-mining.component.html',
  styleUrls: ['./chain-stats-mining.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChainStatsMiningComponent implements OnInit {
  isLoadingWebSocket$: Observable<boolean>;
  asertStatus$: Observable<AsertMiningStatus>;
  blocksUntilHalving: number | null = null;
  timeUntilHalving = 0;
  now = new Date().getTime();

  @Input() showProgress = true;
  @Input() showHalving = false;
  @Input() showTitle = true;

  constructor(public stateService: StateService) {}

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

        const scheduleOffsetSeconds = getScheduleOffsetSeconds(
          latestBlock.height,
          latestBlock.timestamp
        );
        const scheduleOffsetMinutes = scheduleOffsetSeconds / 60;

        const difficultyDriftPercent = getDifficultyDriftPercent(
          latestBlock.height,
          latestBlock.timestamp
        );

        let colorDrift = 'var(--transparent-fg)';
        if (difficultyDriftPercent > 0.001) {
          colorDrift = 'var(--green)';
        } else if (difficultyDriftPercent < -0.001) {
          colorDrift = 'var(--red)';
        }

        this.blocksUntilHalving = 210000 - (maxHeight % 210000);
        this.timeUntilHalving =
          new Date().getTime() + this.blocksUntilHalving * 600000;
        this.now = new Date().getTime();

        return {
          difficultyDriftPercent,
          colorDrift,
          scheduleOffsetMinutes,
          scheduleOffsetSeconds,
          blocksUntilHalving: this.blocksUntilHalving,
          timeUntilHalving: this.timeUntilHalving,
          timeAvg: da.timeAvg,
          adjustedTimeAvg: da.adjustedTimeAvg,
        };
      })
    );
  }

  isEllipsisActive(e): boolean {
    return e.offsetWidth < e.scrollWidth;
  }
}
