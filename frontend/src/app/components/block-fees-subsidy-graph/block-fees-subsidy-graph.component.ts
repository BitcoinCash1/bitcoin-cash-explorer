import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Inject,
  Input,
  LOCALE_ID,
  NgZone,
  OnInit,
} from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import {
  catchError,
  map,
  share,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis } from '@app/shared/graphs.utils';
import { ActivatedRoute, Router } from '@angular/router';
import { FiatShortenerPipe } from '@app/shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '@app/shared/pipes/fiat-currency.pipe';
import { StateService } from '@app/services/state.service';
import { MiningService } from '@app/services/mining.service';
import { StorageService } from '@app/services/storage.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { EChartsInitOpts } from 'echarts/types/dist/echarts';

type DisplayMode = 'normal' | 'fiat' | 'percentage';
interface FeesSubsidyLegend {
  mode: DisplayMode;
  fees: boolean;
  subsidy: boolean;
}

@Component({
  selector: 'app-block-fees-subsidy-graph',
  templateUrl: './block-fees-subsidy-graph.component.html',
  styleUrls: ['./block-fees-subsidy-graph.component.scss'],
  styles: [
    `
      .loadingGraphs {
        position: absolute;
        top: 50%;
        left: calc(50% - 15px);
        z-index: 99;
      }
    `,
  ],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockFeesSubsidyGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions: EChartsInitOpts = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  data: any;
  subsidies: { [key: number]: number } = {};
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;
  private initializedCharts = new WeakSet<object>();
  displayMode: DisplayMode = 'normal';
  legend: FeesSubsidyLegend = { mode: 'normal', fees: true, subsidy: true };
  updateZoom = false;
  zoomSpan = 100;
  zoomTimeSpan = '';

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    public stateService: StateService,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone,
    private fiatShortenerPipe: FiatShortenerPipe,
    private fiatCurrencyPipe: FiatCurrencyPipe,
    private cd: ChangeDetectorRef
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls['dateSpan'].setValue('1y');

    this.subsidies = this.initSubsidies();
  }

  ngOnInit(): void {
    this.seoService.setTitle(
      $localize`:@@41545303ec98792b738d6237adbd1f3b54a22196:Block Fees Vs Subsidy`
    );
    this.seoService.setDescription(
      $localize`See the mining fees earned per Bitcoin Cash block compared to the Bitcoin Cash block subsidy, visualized in BCH and USD over time.`
    );

    this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm = this.formBuilder.group({
      dateSpan: this.miningWindowPreference,
    });
    this.radioGroupForm.controls['dateSpan'].setValue(
      this.miningWindowPreference
    );

    this.restoreLegend();

    this.route.fragment.subscribe((fragment) => {
      if (
        [
          '24h',
          '3d',
          '1w',
          '1m',
          '3m',
          '6m',
          '1y',
          '2y',
          '3y',
          '4y',
          'all',
        ].indexOf(fragment) > -1
      ) {
        this.radioGroupForm.controls['dateSpan'].setValue(fragment, {
          emitEvent: false,
        });
      }
    });

    this.statsObservable$ = this.radioGroupForm
      .get('dateSpan')
      .valueChanges.pipe(
        startWith(this.radioGroupForm.controls['dateSpan'].value),
        switchMap((timespan) => {
          this.isLoading = true;
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.zoomTimeSpan = timespan;
          return this.apiService.getHistoricalBlockFees$(timespan).pipe(
            tap((response) => {
              this.data = {
                timestamp: response.body.map((val) => val.timestamp * 1000),
                blockHeight: response.body.map((val) => val.avgHeight),
                blockFees: response.body.map(
                  (val) => val.avgFees / 100_000_000
                ),
                blockFeesFiat: response.body.map((val) =>
                  this.toFiat(val.avgFees / 100_000_000, val['USD'])
                ),
                blockFeesPercent: response.body.map(
                  (val) =>
                    (val.avgFees /
                      (val.avgFees + this.subsidyAt(val.avgHeight))) *
                    100
                ),
                blockSubsidy: response.body.map(
                  (val) => this.subsidyAt(val.avgHeight) / 100_000_000
                ),
                blockSubsidyFiat: response.body.map((val) =>
                  this.toFiat(
                    this.subsidyAt(val.avgHeight) / 100_000_000,
                    val['USD']
                  )
                ),
                blockSubsidyPercent: response.body.map(
                  (val) =>
                    (this.subsidyAt(val.avgHeight) /
                      (val.avgFees + this.subsidyAt(val.avgHeight))) *
                    100
                ),
              };

              this.prepareChartOptions();
              this.isLoading = false;
            }),
            map((response) => {
              return {
                blockCount: parseInt(response.headers.get('x-total-count'), 10),
              };
            })
          );
        }),
        share()
      );
  }

  private toFiat(value: number, price: number): number | null {
    return Number.isFinite(price) && price > 0 ? value * price : null;
  }

  private restoreLegend(): void {
    const stored = this.storageService.getValue('fees_subsidy_legend');
    if (!stored) {
      return;
    }
    try {
      const value = JSON.parse(stored);
      if (
        !value ||
        !['normal', 'fiat', 'percentage'].includes(value.mode) ||
        typeof value.fees !== 'boolean' ||
        typeof value.subsidy !== 'boolean'
      ) {
        throw new Error('Invalid fees/subsidy legend');
      }
      this.legend = {
        mode: value.mode,
        fees: value.fees,
        subsidy: value.subsidy,
      };
      this.displayMode = this.legend.mode;
    } catch {
      this.storageService.removeItem('fees_subsidy_legend');
    }
  }

  private legendSelection(): Record<string, boolean> {
    return {
      Subsidy: this.displayMode === 'normal' && this.legend.subsidy,
      Fees: this.displayMode === 'normal' && this.legend.fees,
      'Subsidy (USD)': this.displayMode === 'fiat' && this.legend.subsidy,
      'Fees (USD)': this.displayMode === 'fiat' && this.legend.fees,
      'Subsidy (%)': this.displayMode === 'percentage' && this.legend.subsidy,
      'Fees (%)': this.displayMode === 'percentage' && this.legend.fees,
    };
  }

  private persistLegend(): void {
    // Exporting or reapplying the bound options must retain live chart selections.
    const chartLegend = this.chartOptions['legend'] as any;
    if (chartLegend) {
      chartLegend.selected = this.legendSelection();
    }
    this.storageService.setValue(
      'fees_subsidy_legend',
      JSON.stringify(this.legend)
    );
  }

  prepareChartOptions() {
    const showFiat =
      !this.stateService.isAnyTestnet() &&
      this.data.blockFeesFiat.some(
        (value) => value !== null && Number.isFinite(value)
      );
    if (!showFiat && this.displayMode === 'fiat') {
      this.displayMode = 'normal';
      this.legend = { mode: 'normal', fees: true, subsidy: true };
      this.persistLegend();
    }
    let title: object;
    if (this.data.blockFees.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15,
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center',
      };
    }

    this.chartOptions = {
      title: title,
      color: ['#da9820', '#10c73a'],
      animation: false,
      grid: {
        top: 80,
        bottom: 80,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line',
        },
        backgroundColor: 'var(--bg)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: 'var(--active-bg)',
        formatter: function (data) {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: var(--fg); margin-left: 2px">${formatterXAxis(
            this.locale,
            this.zoomTimeSpan,
            parseInt(this.data.timestamp[data[0].dataIndex], 10)
          )}</b><br>`;
          for (let i = data.length - 1; i >= 0; i--) {
            const tick = data[i];
            tooltip += `${tick.marker} ${tick.seriesName.split(' ')[0]}: `;
            if (this.displayMode === 'normal') {
              tooltip += `${formatNumber(
                tick.data,
                this.locale,
                '1.0-3'
              )} BCH<br>`;
            } else if (this.displayMode === 'fiat') {
              tooltip += `${this.fiatCurrencyPipe.transform(
                tick.data,
                null,
                'USD'
              )}<br>`;
            } else {
              tooltip += `${formatNumber(
                tick.data,
                this.locale,
                '1.0-2'
              )}%<br>`;
            }
          }
          if (this.displayMode === 'normal') {
            tooltip += `<div style="margin-left: 2px">${formatNumber(
              data.reduce((acc, val) => acc + val.data, 0),
              this.locale,
              '1.0-3'
            )} BCH</div>`;
          } else if (this.displayMode === 'fiat') {
            tooltip += `<div style="margin-left: 2px">${this.fiatCurrencyPipe.transform(
              data.reduce((acc, val) => acc + val.data, 0),
              null,
              'USD'
            )}</div>`;
          }
          if (['24h', '3d'].includes(this.zoomTimeSpan)) {
            tooltip +=
              `<small>` +
              $localize`At block ${
                '<b style="color: var(--fg); margin-left: 2px">' +
                data[0].axisValue
              }` +
              `</small>`;
          } else {
            tooltip +=
              `<small>` +
              $localize`Around block ${
                '<b style="color: var(--fg); margin-left: 2px">' +
                data[0].axisValue
              }` +
              `</small>`;
          }
          return tooltip;
        }.bind(this),
      },
      xAxis:
        this.data.blockFees.length === 0
          ? undefined
          : [
              {
                type: 'category',
                data: this.data.blockHeight,
                show: false,
                axisLabel: {
                  hideOverlap: true,
                },
              },
              {
                type: 'category',
                data: this.data.timestamp,
                show: true,
                position: 'bottom',
                axisLabel: {
                  color: 'var(--grey)',
                  formatter: (val) => {
                    return formatterXAxis(
                      this.locale,
                      this.timespan,
                      parseInt(val, 10)
                    );
                  },
                },
                axisTick: {
                  show: false,
                },
                axisLine: {
                  show: false,
                },
                splitLine: {
                  show: false,
                },
              },
            ],
      legend:
        this.data.blockFees.length === 0
          ? undefined
          : {
              top: 0,
              data: [
                {
                  name: 'Subsidy',
                  inactiveColor: 'var(--grey)',
                  textStyle: {
                    color: 'var(--fg)',
                  },
                  icon: 'roundRect',
                },
                {
                  name: 'Fees',
                  inactiveColor: 'var(--grey)',
                  textStyle: {
                    color: 'var(--fg)',
                  },
                  icon: 'roundRect',
                },
                {
                  name: 'Subsidy (USD)',
                  inactiveColor: 'var(--grey)',
                  textStyle: {
                    color: 'var(--fg)',
                  },
                  icon: 'roundRect',
                },
                {
                  name: 'Fees (USD)',
                  inactiveColor: 'var(--grey)',
                  textStyle: {
                    color: 'var(--fg)',
                  },
                  icon: 'roundRect',
                },
                {
                  name: 'Subsidy (%)',
                  inactiveColor: 'var(--grey)',
                  textStyle: {
                    color: 'var(--fg)',
                  },
                  icon: 'roundRect',
                },
                {
                  name: 'Fees (%)',
                  inactiveColor: 'var(--grey)',
                  textStyle: {
                    color: 'var(--fg)',
                  },
                  icon: 'roundRect',
                },
              ],
              selected: this.legendSelection(),
            },
      yAxis:
        this.data.blockFees.length === 0
          ? undefined
          : [
              {
                type: 'value',
                axisLabel: {
                  color: 'var(--grey)',
                  formatter: (val) => {
                    return `${val}${
                      this.displayMode === 'percentage' ? '%' : ' BCH'
                    }`;
                  },
                },
                min: 0,
                max: (value) => {
                  if (this.displayMode === 'percentage') {
                    return 100;
                  }
                  return undefined;
                },
                splitLine: {
                  lineStyle: {
                    type: 'dotted',
                    color: 'var(--transparent-fg)',
                    opacity: 0.25,
                  },
                },
              },
              {
                type: 'value',
                position: 'right',
                axisLabel: {
                  color: 'var(--grey)',
                  formatter: function (val) {
                    return this.fiatShortenerPipe.transform(val, 'USD');
                  }.bind(this),
                },
                splitLine: {
                  show: false,
                },
              },
            ],
      series:
        this.data.blockFees.length === 0
          ? undefined
          : [
              {
                name: 'Subsidy',
                yAxisIndex: 0,
                type: 'bar',
                barWidth: '100%',
                stack: 'total',
                data: this.data.blockSubsidy,
              },
              {
                name: 'Fees',
                yAxisIndex: 0,
                type: 'bar',
                barWidth: '100%',
                stack: 'total',
                data: this.data.blockFees,
              },
              {
                name: 'Subsidy (USD)',
                yAxisIndex: 1,
                type: 'bar',
                barWidth: '100%',
                stack: 'total',
                data: this.data.blockSubsidyFiat,
              },
              {
                name: 'Fees (USD)',
                yAxisIndex: 1,
                type: 'bar',
                barWidth: '100%',
                stack: 'total',
                data: this.data.blockFeesFiat,
              },
              {
                name: 'Subsidy (%)',
                yAxisIndex: 0,
                type: 'bar',
                barWidth: '100%',
                stack: 'total',
                data: this.data.blockSubsidyPercent,
              },
              {
                name: 'Fees (%)',
                yAxisIndex: 0,
                type: 'bar',
                barWidth: '100%',
                stack: 'total',
                data: this.data.blockFeesPercent,
              },
            ],
      dataZoom:
        this.data.blockFees.length === 0
          ? undefined
          : [
              {
                type: 'inside',
                realtime: true,
                zoomLock: true,
                maxSpan: 100,
                minSpan: 1,
                moveOnMouseMove: false,
              },
              {
                showDetail: false,
                show: true,
                type: 'slider',
                brushSelect: false,
                realtime: true,
                left: 20,
                right: 15,
                selectedDataBackground: {
                  lineStyle: {
                    color: '#fff',
                    opacity: 0.45,
                  },
                },
              },
            ],
    };
    if (!showFiat) {
      this.chartOptions['yAxis'] = (this.chartOptions['yAxis'] as any[])?.slice(
        0,
        1
      );
      this.chartOptions['series'] = (
        this.chartOptions['series'] as any[]
      )?.filter((series) => series.yAxisIndex !== 1);
      const legend = this.chartOptions['legend'] as any;
      if (legend) {
        legend.data = legend.data.filter(
          (entry) => !entry.name.includes('USD')
        );
        delete legend.selected['Subsidy (USD)'];
        delete legend.selected['Fees (USD)'];
      }
    }
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    // Async wrapper initialization can emit the same instance more than once.
    if (this.initializedCharts.has(ec)) {
      return;
    }
    this.initializedCharts.add(ec);

    this.chartInstance.on('legendselectchanged', (params) => {
      if (this.isLoading) {
        return;
      }

      let mode: DisplayMode;
      if (params.name.includes('USD')) {
        mode = 'fiat';
      } else if (params.name.includes('%')) {
        mode = 'percentage';
      } else {
        mode = 'normal';
      }

      if (this.displayMode === mode) {
        const suffix =
          mode === 'fiat' ? ' (USD)' : mode === 'percentage' ? ' (%)' : '';
        this.legend = {
          mode,
          fees: params.selected[`Fees${suffix}`],
          subsidy: params.selected[`Subsidy${suffix}`],
        };
        this.persistLegend();
        return;
      }

      const isActivation = params.selected[params.name];

      if (isActivation) {
        this.displayMode = mode;
        this.legend = { mode, fees: true, subsidy: true };
        this.persistLegend();
        this.chartInstance.dispatchAction({
          type:
            this.displayMode === 'normal' ? 'legendSelect' : 'legendUnSelect',
          name: 'Subsidy',
        });
        this.chartInstance.dispatchAction({
          type:
            this.displayMode === 'normal' ? 'legendSelect' : 'legendUnSelect',
          name: 'Fees',
        });
        this.chartInstance.dispatchAction({
          type: this.displayMode === 'fiat' ? 'legendSelect' : 'legendUnSelect',
          name: 'Subsidy (USD)',
        });
        this.chartInstance.dispatchAction({
          type: this.displayMode === 'fiat' ? 'legendSelect' : 'legendUnSelect',
          name: 'Fees (USD)',
        });
        this.chartInstance.dispatchAction({
          type:
            this.displayMode === 'percentage'
              ? 'legendSelect'
              : 'legendUnSelect',
          name: 'Subsidy (%)',
        });
        this.chartInstance.dispatchAction({
          type:
            this.displayMode === 'percentage'
              ? 'legendSelect'
              : 'legendUnSelect',
          name: 'Fees (%)',
        });
      }
    });

    this.chartInstance.on('datazoom', (params) => {
      if (
        params.silent ||
        this.isLoading ||
        ['24h', '3d'].includes(this.timespan)
      ) {
        return;
      }
      this.updateZoom = true;
    });

    this.chartInstance.on('click', (e) => {
      this.zone.run(() => {
        if (['24h', '3d'].includes(this.zoomTimeSpan)) {
          const url = new RelativeUrlPipe(this.stateService).transform(
            `/block/${e.name}`
          );
          if (
            e.event.event.shiftKey ||
            e.event.event.ctrlKey ||
            e.event.event.metaKey
          ) {
            window.open(url);
          } else {
            this.router.navigate([url]);
          }
        }
      });
    });
  }

  @HostListener('document:pointerup', ['$event'])
  onPointerUp(event: PointerEvent) {
    if (this.updateZoom) {
      this.onZoom();
      this.updateZoom = false;
    }
  }

  isMobile() {
    return window.innerWidth <= 767.98;
  }

  initSubsidies(): { [key: number]: number } {
    let blockReward = 50 * 100_000_000;
    const subsidies = {};
    for (let i = 0; i <= 33; i++) {
      subsidies[i] = blockReward;
      blockReward = Math.floor(blockReward / 2);
    }
    return subsidies;
  }

  subsidyAt(height: number): number {
    return this.subsidies[Math.floor(Math.min(height / 210000, 33))];
  }

  onZoom() {
    const option = this.chartInstance.getOption();
    const timestamps = option.xAxis[1].data;
    const startTimestamp = timestamps[option.dataZoom[0].startValue];
    const endTimestamp = timestamps[option.dataZoom[0].endValue];

    this.isLoading = true;
    this.cd.detectChanges();

    const subscription = this.apiService
      .getBlockFeesFromTimespan$(
        Math.floor(startTimestamp / 1000),
        Math.floor(endTimestamp / 1000)
      )
      .pipe(
        tap((response) => {
          const startIndex = option.dataZoom[0].startValue;
          const endIndex = option.dataZoom[0].endValue;

          // Update series with more granular data
          const lengthBefore = this.data.timestamp.length;
          this.data.timestamp.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map((val) => val.timestamp * 1000)
          );
          this.data.blockHeight.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map((val) => val.avgHeight)
          );
          this.data.blockFees.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map((val) => val.avgFees / 100_000_000)
          );
          this.data.blockFeesFiat.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map((val) =>
              this.toFiat(val.avgFees / 100_000_000, val['USD'])
            )
          );
          this.data.blockFeesPercent.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map(
              (val) =>
                (val.avgFees / (val.avgFees + this.subsidyAt(val.avgHeight))) *
                100
            )
          );
          this.data.blockSubsidy.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map(
              (val) => this.subsidyAt(val.avgHeight) / 100_000_000
            )
          );
          this.data.blockSubsidyFiat.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map((val) =>
              this.toFiat(
                this.subsidyAt(val.avgHeight) / 100_000_000,
                val['USD']
              )
            )
          );
          this.data.blockSubsidyPercent.splice(
            startIndex,
            endIndex - startIndex,
            ...response.body.map(
              (val) =>
                (this.subsidyAt(val.avgHeight) /
                  (val.avgFees + this.subsidyAt(val.avgHeight))) *
                100
            )
          );
          // Price availability can change after zooming; rebuild axes/series by meaning,
          // while retaining the user's zoom window instead of assuming fixed series indices.
          const previousDisplayMode = this.displayMode;
          const selected = this.chartInstance.getOption().legend?.[0]?.selected;
          this.prepareChartOptions();
          const legend = this.chartOptions['legend'] as any;
          // Keep individual selections for surviving series. If fiat disappears,
          // use the new BCH defaults rather than restoring its hidden selections.
          if (legend && selected && this.displayMode === previousDisplayMode) {
            for (const name of Object.keys(legend.selected)) {
              if (typeof selected[name] === 'boolean') {
                legend.selected[name] = selected[name];
              }
            }
          }
          this.chartOptions['dataZoom'] = option.dataZoom;
          this.chartInstance.setOption(this.chartOptions, true);
          const lengthAfter = this.data.timestamp.length;

          // Update the zoom to keep the same range after the update
          this.chartInstance.dispatchAction({
            type: 'dataZoom',
            startValue: startIndex,
            endValue: endIndex + lengthAfter - lengthBefore,
            silent: true,
          });

          // Update the chart
          const newOption = this.chartInstance.getOption();
          // Angular reapplies these bound options after the rebuild. Keep both
          // zoom controls in sync with the corrected range, including percentages.
          this.chartOptions['dataZoom'] = newOption.dataZoom;
          this.zoomSpan =
            newOption.dataZoom[0].end - newOption.dataZoom[0].start;
          this.zoomTimeSpan = this.getTimeRangeFromTimespan(
            Math.floor(
              this.data.timestamp[newOption.dataZoom[0].startValue] / 1000
            ),
            Math.floor(
              this.data.timestamp[newOption.dataZoom[0].endValue] / 1000
            )
          );
          this.isLoading = false;
        }),
        catchError(() => {
          const newOption = this.chartInstance.getOption();
          this.zoomSpan =
            newOption.dataZoom[0].end - newOption.dataZoom[0].start;
          this.zoomTimeSpan = this.getTimeRangeFromTimespan(
            Math.floor(
              this.data.timestamp[newOption.dataZoom[0].startValue] / 1000
            ),
            Math.floor(
              this.data.timestamp[newOption.dataZoom[0].endValue] / 1000
            )
          );
          this.isLoading = false;
          this.cd.detectChanges();
          return [];
        })
      )
      .subscribe(() => {
        subscription.unsubscribe();
        this.cd.detectChanges();
      });
  }

  getTimeRangeFromTimespan(from: number, to: number): string {
    const timespan = to - from;
    switch (true) {
      case timespan >= 3600 * 24 * 365 * 4:
        return 'all';
      case timespan >= 3600 * 24 * 365 * 3:
        return '4y';
      case timespan >= 3600 * 24 * 365 * 2:
        return '3y';
      case timespan >= 3600 * 24 * 365:
        return '2y';
      case timespan >= 3600 * 24 * 30 * 6:
        return '1y';
      case timespan >= 3600 * 24 * 30 * 3:
        return '6m';
      case timespan >= 3600 * 24 * 30:
        return '3m';
      case timespan >= 3600 * 24 * 7:
        return '1m';
      case timespan >= 3600 * 24 * 3:
        return '1w';
      case timespan >= 3600 * 24:
        return '3d';
      default:
        return '24h';
    }
  }

  onSaveChart() {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(
      this.chartInstance.getDataURL({
        pixelRatio: 2,
        excludeComponents: ['dataZoom'],
      }),
      `block-fees-subsidy-${this.timespan}-${Math.round(
        now.getTime() / 1000
      )}.svg`
    );
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
