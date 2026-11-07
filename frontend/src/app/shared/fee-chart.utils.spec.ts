import { describe, expect, it } from 'vitest';
import {
  feeChartFragment,
  parseFeeChartFragment,
  scaleFeeChart,
} from './fee-chart.utils';

describe('fee chart scale', () => {
  it('plots finite positive sub-0.1 rates on true logarithmic axes and retains raw zeros', () => {
    const input = {
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          stack: 'Total',
          data: [0, 0.001, 0.05, Infinity, -1].map((value, index) => [
            index,
            value,
            100 + index,
          ]),
        },
      ],
    };
    const result = scaleFeeChart(input, 'log');
    const series = (result.options['series'] as any[])[0];
    expect(series.data.map((point) => point[1])).toEqual([
      null,
      0.001,
      0.05,
      null,
      null,
    ]);
    expect(series.data[0][3]).toBe(0);
    expect(series.stack).toBeUndefined();
    expect(result.options['yAxis']).toMatchObject({ type: 'log', min: 0.001 });
    expect(result.omitted).toBe(3);
    expect(result.positive).toBe(2);
    expect(input.series[0].data[0]).toEqual([0, 0, 100]);
  });

  it('keeps separate data-derived minima for BCH and fiat axes', () => {
    const result = scaleFeeChart(
      {
        yAxis: [{ type: 'value' }, { type: 'value' }],
        series: [
          { yAxisIndex: 0, type: 'line', data: [[1, 0.00000001, 1]] },
          { yAxisIndex: 1, type: 'line', data: [[1, 0.0005, 1]] },
        ],
      },
      'log'
    );
    expect(result.options['yAxis']).toMatchObject([
      { min: 0.00000001 },
      { min: 0.0005 },
    ]);
  });

  it('reports all-zero data and restores raw zeros in linear projection', () => {
    const source = {
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [[1, 0, 100]] }],
    };
    const result = scaleFeeChart(source, 'log');
    expect(result).toMatchObject({ omitted: 1, positive: 0 });
    expect(
      (scaleFeeChart(source, 'linear').options['series'] as any[])[0].data
    ).toEqual([[1, 0, 100, 0]]);
  });
});

describe('fee chart URL fragments', () => {
  it.each([
    [null, { time: undefined, scale: 'linear' }],
    ['24h', { time: '24h', scale: 'linear' }],
    ['4y', { time: '4y', scale: 'linear' }],
    ['log', { time: undefined, scale: 'log' }],
    ['time=3d&scale=log', { time: '3d', scale: 'log' }],
    ['time=bad&scale=bad', { time: undefined, scale: 'linear' }],
  ])('parses legacy and combined fragment %s', (fragment, expected) => {
    expect(parseFeeChartFragment(fragment)).toEqual(expected);
  });
  it('preserves the other selection when time or scale changes', () => {
    expect(feeChartFragment('24h', 'log', { time: '1m' })).toBe(
      'time=1m&scale=log'
    );
    expect(feeChartFragment('24h', 'log', { scale: 'linear' })).toBe(
      'time=24h&scale=linear'
    );
  });
});
