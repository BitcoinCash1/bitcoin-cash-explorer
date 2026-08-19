import {
  Component,
  OnInit,
  LOCALE_ID,
  Inject,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { switchMap, startWith, distinctUntilChanged } from 'rxjs/operators';

import { OptimizedMempoolStats } from '@interfaces/node-api.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { ApiService } from '@app/services/api.service';

import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { StorageService } from '@app/services/storage.service';
import { feeLevels, chartColors } from '@app/app.constants';
import { MempoolGraphComponent } from '@components/mempool-graph/mempool-graph.component';
import { IncomingTransactionsGraphComponent } from '@components/incoming-transactions-graph/incoming-transactions-graph.component';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss'],
  standalone: false,
})
export class StatisticsComponent implements OnInit {
  @ViewChild('mempoolgraph') mempoolGraph: MempoolGraphComponent;
  @ViewChild('incominggraph') incomingGraph: IncomingTransactionsGraphComponent;

  network = '';

  isLoading = true;
  feeLevels = feeLevels;
  chartColors = chartColors;
  filterSize = 100000;
  filterFeeIndex = 0;
  showCount = false;
  dropDownOpen = false;
  outlierCappingEnabled = false;
  mempoolStats: OptimizedMempoolStats[] = [];

  mempoolVsizeFeesData: any;
  mempoolUnconfirmedTransactionsData: any;
  mempoolTransactionsPerSecondData: any;

  radioGroupForm: UntypedFormGroup;
  graphWindowPreference: string;
  inverted: boolean;
  feeLevelDropdownData = [];
  timespan = '';
  titleCount = $localize`Count`;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private formBuilder: UntypedFormBuilder,
    private route: ActivatedRoute,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef // Injected to manually trigger UI updates
  ) {}

  ngOnInit() {
    this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    this.setFeeLevelDropdownData();
    this.seoService.setTitle(
      $localize`:@@5d4f792f048fcaa6df5948575d7cb325c9393383:Graphs`
    );
    this.seoService.setDescription(
      $localize`See mempool size (in MB) and transactions per second (in B/s) visualized over time.`
    );

    this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      this.cdr.markForCheck();
    });

    this.graphWindowPreference = this.storageService.getValue(
      'graphWindowPreference'
    )
      ? this.storageService.getValue('graphWindowPreference').trim()
      : '2h';
    this.outlierCappingEnabled =
      this.storageService.getValue('cap-outliers') === 'true';

    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.graphWindowPreference,
    });

    // 1. Listen for URL fragments and update the form state (allows API trigger)
    this.route.fragment.subscribe((fragment) => {
      const validSpans = ['2h', '24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', '4y', 'all'];
      const targetSpan = validSpans.includes(fragment) ? fragment : '2h';

      if (this.radioGroupForm.controls['dateSpan'].value !== targetSpan) {
        this.radioGroupForm.controls['dateSpan'].setValue(targetSpan);
      }
    });

    // 2. React to form changes properly, fetching data when the URL/selection changes
    this.radioGroupForm.controls['dateSpan'].valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls['dateSpan'].value),
        distinctUntilChanged(), // Prevent duplicate API calls for the same timespan
        switchMap((timespan) => {
          this.timespan = timespan;
          this.isLoading = true;
          this.cdr.markForCheck(); // Show spinner in UI immediately

          if (timespan === '2h') {
            this.websocketService.want(['blocks', 'live-2h-chart']);
            return this.apiService.list2HStatistics$();
          }

          this.websocketService.want(['blocks']);

          switch(timespan) {
            case '24h': return this.apiService.list24HStatistics$();
            case '3d': return this.apiService.list3DStatistics$();
            case '1w': return this.apiService.list1WStatistics$();
            case '1m': return this.apiService.list1MStatistics$();
            case '3m': return this.apiService.list3MStatistics$();
            case '6m': return this.apiService.list6MStatistics$();
            case '1y': return this.apiService.list1YStatistics$();
            case '2y': return this.apiService.list2YStatistics$();
            case '3y': return this.apiService.list3YStatistics$();
            case '4y': return this.apiService.list4YStatistics$();
            case 'all': return this.apiService.listAllTimeStatistics$();
            default: return this.apiService.list2HStatistics$();
          }
        })
      )
      .subscribe((mempoolStats: any) => {
        this.mempoolStats = mempoolStats;
        this.handleNewMempoolData([...this.mempoolStats]); // Modern shallow copy
        this.isLoading = false;
        this.cdr.markForCheck(); // Force Angular to evaluate the template and hide spinner
      });

    // 3. Keep live web-socket chart updates strictly synced with the UI
    this.stateService.live2Chart$.subscribe((mempoolStats) => {
      this.mempoolStats.unshift(mempoolStats);
      this.mempoolStats = this.mempoolStats.slice(
        0,
        this.mempoolStats.length - 1
      );
      this.handleNewMempoolData([...this.mempoolStats]);
      this.cdr.markForCheck(); // Push updated options to ngx-echarts
    });
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map((stats) => stats.added);

    this.capExtremeBytesValues();

    this.mempoolTransactionsPerSecondData = {
      labels: labels,
      series: [
        mempoolStats.map((stats) => [
          stats.added * 1000,
          stats.bytes_per_second,
        ]),
      ],
    };
  }

  /**
   * All value higher that "median * capRatio" are capped
   */
  capExtremeBytesValues() {
    if (this.stateService.network.length !== 0) {
      return; // Only cap on Bitcoin Cash mainnet
    }

    let capRatio = 10;
    if (
      ['1m', '3m', '6m', '1y', '2y', '3y', '4y', 'all'].includes(
        this.graphWindowPreference
      )
    ) {
      capRatio = 4;
    }

    // Find median value
    const bytes: number[] = [];
    for (const stat of this.mempoolStats) {
      bytes.push(stat.bytes_per_second);
    }
    const sorted = bytes.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    let median = sorted[middle];
    if (sorted.length % 2 === 0) {
      median = (sorted[middle - 1] + sorted[middle]) / 2;
    }

    // Cap
    for (const stat of this.mempoolStats) {
      stat.bytes_per_second = Math.min(
        median * capRatio,
        stat.bytes_per_second
      );
    }
  }

  saveGraphPreference() {
    this.storageService.setValue(
      'graphWindowPreference',
      this.radioGroupForm.controls['dateSpan'].value
    );
  }

  invertGraph() {
    this.storageService.setValue('inverted-graph', !this.inverted);
    document.location.reload();
  }

  setFeeLevelDropdownData() {
    let _feeLevels = feeLevels;
    let _chartColors = chartColors;
    if (!this.inverted) {
      _feeLevels = [...feeLevels].reverse();
      _chartColors = [...chartColors].reverse();
    }
    _feeLevels.forEach((fee, i) => {
      let range;
      const nextIndex = this.inverted ? i + 1 : i - 1;
      if (_feeLevels[nextIndex] == null) {
        range = `${_feeLevels[i]}+`;
      } else {
        range = `${_feeLevels[i]} - ${_feeLevels[nextIndex]}`;
      }
      if (this.inverted) {
        this.feeLevelDropdownData.push({
          fee: fee,
          range,
          color: _chartColors[i],
        });
      } else {
        this.feeLevelDropdownData.push({
          fee: fee,
          range,
          color: _chartColors[i],
        });
      }
    });
  }

  onOutlierToggleChange(e): void {
    this.outlierCappingEnabled = e.target.checked;
    this.storageService.setValue('cap-outliers', e.target.checked);
  }

  onSaveChart(name) {
    if (name === 'mempool') {
      this.mempoolGraph.onSaveChart(this.timespan);
    } else if (name === 'incoming') {
      this.incomingGraph.onSaveChart(this.timespan);
    }
  }

  isMobile() {
    return window.innerWidth <= 767.98;
  }
}
