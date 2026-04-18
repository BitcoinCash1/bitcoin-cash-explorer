import {
  Component,
  Input,
  OnChanges,
  NgZone,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
} from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';

export interface AsertPoint {
  height: number;
  deviation: number; // seconds (positive = gaining on schedule, negative = falling behind)
}

@Component({
  selector: 'app-asert-deviation-graph',
  templateUrl: './asert-deviation-graph.component.html',
  styleUrls: ['./asert-deviation-graph.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsertDeviationGraphComponent implements OnChanges {
  @Input() data: AsertPoint[] = [];
  @Input() compressed = false;
  @Output() chartInit = new EventEmitter<any>();
  @Output() chartOptionsChange = new EventEmitter<EChartsOption>();

  chartOption: EChartsOption = {};
  initOpts = { renderer: 'svg' };

  private chartInstance: any;

  private get fontSize(): number {
    return this.compressed ? 9 : 12;
  }

  constructor(private zone: NgZone) {}

  onChartInit(chart: any) {
    this.chartInstance = chart;
    this.chartInit.emit(chart);
    this.chartOptionsChange.emit(this.chartOption);
  }

  ngOnChanges() {
    if (this.data.length === 0) {
      return;
    }
    if (this.chartInstance) {
      this.updateChart();
    } else {
      this.buildChart();
    }
    this.chartOptionsChange.emit(this.chartOption);
  }

  private buildChart() {
    const heights = this.data.map((d) => d.height);
    const deviations = this.data.map((d) => d.deviation);

    this.chartOption = {
      grid: {
        left: 40,
        right: 12,
        top: 4,
        bottom: 16,
      },

      xAxis: {
        type: 'category',
        data: heights,
        name: 'Blocks',
        nameLocation: 'middle',
        nameGap: 4,
        nameTextStyle: {
          color: 'var(--transparent-fg)',
          fontSize: this.fontSize,
        },
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: {
          lineStyle: { color: 'var(--transparent-fg)', opacity: 0.2 },
        },
      },

      yAxis: {
        type: 'value',
        name: 'Δ schedule',
        nameLocation: 'middle',
        nameGap: 36,
        nameRotate: 90,
        nameTextStyle: {
          color: 'var(--transparent-fg)',
          fontSize: this.fontSize,
        },
        axisLabel: {
          formatter: (v: number) => this.formatAxisLabel(v),
          color: 'var(--transparent-fg)',
          fontSize: this.fontSize,
        },
        splitLine: {
          lineStyle: { color: 'var(--transparent-fg)', opacity: 0.08 },
        },
      },

      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--transparent-fg)',
        textStyle: {
          color: 'var(--fg)',
          fontSize: 12,
        },
        formatter: (params: any) => {
          if (!params || !params[0]) {
            return '';
          }
          const idx = params[0].dataIndex;
          const dev = deviations[idx];
          const absDev = Math.abs(dev);
          const state =
            dev > 0
              ? '<span style="color:#ef4444">Gaining on schedule → difficulty increasing</span>'
              : dev < 0
                ? '<span style="color:#3b82f6">Falling behind → difficulty decreasing</span>'
                : 'On schedule';
          return `
            <strong>Block ${heights[idx]}</strong><br/>
            Deviation: ${dev >= 0 ? '+' : ''}${dev}s (${this.formatDuration(absDev)})<br/>
            ${state}
          `;
        },
      },

      series: [
        {
          name: 'Deviation',
          type: 'line',
          data: deviations,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: this.buildGradient(deviations, '#ef4444', '#3b82f6', 1),
          },
          areaStyle: {
            color: this.buildGradient(
              deviations,
              'rgba(239,68,68,0.25)',
              'rgba(59,130,246,0.25)',
              0
            ),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              type: 'dashed',
              opacity: 0.35,
              color: 'var(--transparent-fg)',
            },
            label: { show: false },
            data: [{ yAxis: 0 }],
          },
        },
      ],

      animationDuration: 300,
      animationDurationUpdate: 400,
      animationEasingUpdate: 'cubicInOut',
    };
  }

  private updateChart() {
    this.buildChart();
    this.zone.runOutsideAngular(() => {
      this.chartInstance.setOption(this.chartOption);
    });
  }

  /**
   * Build a vertical linear gradient that transitions from `aboveColor` (top)
   * through transparent at the zero-line to `belowColor` (bottom).
   * `zeroAlpha` controls the midpoint opacity (0 = fully transparent).
   */
  private buildGradient(
    deviations: number[],
    aboveColor: string,
    belowColor: string,
    zeroAlpha: number
  ): any {
    const minDev = Math.min(...deviations);
    const maxDev = Math.max(...deviations);
    const range = maxDev - minDev;

    // Position of zero in gradient space (0 = top/max, 1 = bottom/min)
    const zeroOffset =
      range > 0 ? Math.max(0.01, Math.min(0.99, maxDev / range)) : 0.5;

    const midColor = `rgba(128,128,128,${zeroAlpha})`;

    return {
      type: 'linear',
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: aboveColor },
        { offset: zeroOffset, color: midColor },
        { offset: 1, color: belowColor },
      ],
    };
  }

  private formatAxisLabel(v: number): string {
    const abs = Math.abs(v);
    if (abs < 60) {
      return `${v > 0 ? '+' : ''}${v}s`;
    }
    const mins = Math.round(v / 60);
    return `${mins > 0 ? '+' : ''}${mins}m`;
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
  }
}
