import { EChartsOption } from '@app/graphs/echarts';

export type FeeChartScale = 'linear' | 'log';
export const FEE_CHART_TIMESPANS = [
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
];

export function parseFeeChartFragment(fragment: string | null): {
  time?: string;
  scale: FeeChartScale;
} {
  const params = new URLSearchParams(fragment?.includes('=') ? fragment : '');
  const time = params.get('time') || fragment;
  return {
    time: FEE_CHART_TIMESPANS.includes(time) ? time : undefined,
    scale: (params.get('scale') || fragment) === 'log' ? 'log' : 'linear',
  };
}

export function feeChartFragment(
  time: string,
  scale: FeeChartScale,
  changes: { time?: string; scale?: FeeChartScale } = {}
): string {
  return new URLSearchParams({
    time: changes.time || time,
    scale: changes.scale || scale,
  }).toString();
}

/** Keep the raw value at index 3; logarithmic axes never receive zero or nonfinite values. */
export function scaleFeeChart(
  options: EChartsOption,
  scale: FeeChartScale
): { options: EChartsOption; omitted: number; positive: number } {
  const minByAxis = new Map<number, number>();
  const barAxes = new Set<number>();
  let omitted = 0;
  let positive = 0;
  const series = ((options['series'] || []) as any[]).map((series, index) => {
    const axis = series.yAxisIndex || 0;
    if (series.type === 'bar') {
      barAxes.add(axis);
    }
    const data = series.data.map((point: number[]) => {
      const raw = point[3] ?? point[1];
      const valid = Number.isFinite(raw) && raw > 0;
      if (valid) {
        positive++;
        minByAxis.set(axis, Math.min(minByAxis.get(axis) ?? Infinity, raw));
      } else {
        omitted++;
      }
      return [point[0], scale === 'log' && !valid ? null : raw, point[2], raw];
    });
    return {
      ...series,
      data,
      ...(scale === 'log' && series.type === 'bar'
        ? { stack: undefined, barGap: '-100%', z: 20 - index }
        : {}),
      // A gap denotes an omitted zero, rather than connecting across a fabricated positive value.
      connectNulls: false,
    };
  });
  const sourceAxes = options['yAxis']
    ? Array.isArray(options['yAxis'])
      ? options['yAxis']
      : [options['yAxis']]
    : [];
  const axes = sourceAxes.map((axis, index) => {
    const minimum = minByAxis.get(index);
    // Log bars otherwise start at 1, pointing down for sub-satoshi values.
    // Leave a decade below the data so even the smallest bar has visible height.
    const baseline =
      barAxes.has(index) && minimum > 0 ? minimum / 10 : undefined;
    return {
      ...axis,
      ...(scale === 'log'
        ? {
            type: 'log' as const,
            min: baseline ?? minimum,
            startValue: baseline,
            max: undefined,
          }
        : {}),
    };
  });
  return {
    options: {
      ...options,
      series,
      yAxis: Array.isArray(options['yAxis']) ? axes : axes[0],
      graphic:
        scale === 'log' && omitted > 0
          ? [
              {
                type: 'text',
                right: 10,
                bottom: 48,
                style: {
                  text:
                    positive === 0
                      ? $localize`:@@charts.log-export-empty:No positive values. Select Linear to see zeros.`
                      : $localize`:@@charts.log-export-omitted:Log scale: zero and invalid values omitted.`,
                  fill: '#888',
                  fontSize: 11,
                },
              },
            ]
          : [],
    },
    omitted,
    positive,
  };
}
