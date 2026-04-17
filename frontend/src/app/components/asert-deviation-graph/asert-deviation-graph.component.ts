import {
  Component,
  Input,
  OnChanges,
  NgZone,
  ChangeDetectionStrategy,
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

  chartOption: EChartsOption = {};
  initOpts = { renderer: 'svg' };

  private chartInstance: any;

  constructor(private zone: NgZone) {}

  onChartInit(chart: any) {
    this.chartInstance = chart;
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
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: {
          lineStyle: { color: 'var(--transparent-fg)', opacity: 0.2 },
        },
      },

      yAxis: {
        type: 'value',
        name: 'Δ offset (s)',
        nameTextStyle: {
          color: 'var(--transparent-fg)',
          fontSize: 9,
          padding: [0, 0, 0, -4],
        },
        axisLabel: {
          formatter: (v: number) => `${v > 0 ? '+' : ''}${v}s`,
          color: 'var(--transparent-fg)',
          fontSize: 9,
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
          fontSize: 11,
        },
        formatter: (params: any) => {
          if (!params || !params[0]) {
            return '';
          }
          const p = params[0];
          const val = p.data as number;
          const absVal = Math.abs(val);
          const direction =
            val >= 0
              ? 'Gaining on schedule → difficulty increasing'
              : 'Falling behind → difficulty decreasing';
          return `
            <strong>Block ${p.axisValue}</strong><br/>
            Deviation: ${val >= 0 ? '+' : ''}${val}s (${this.formatDuration(absVal)})<br/>
            <span style="opacity:0.65;font-size:10px">${direction}</span>
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
            color: '#10b981',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
              ],
            },
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
    const heights = this.data.map((d) => d.height);
    const deviations = this.data.map((d) => d.deviation);

    this.zone.runOutsideAngular(() => {
      this.chartInstance.setOption({
        xAxis: { data: heights },
        series: [{ data: deviations }],
      });
    });
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
