import '@angular/compiler';
import { BlockTimesGraphComponent } from './block-times-graph.component';
import { CHIPNET_ACTIVATION_TIMESTAMP } from '@app/shared/block-timing';

const activation = CHIPNET_ACTIVATION_TIMESTAMP * 1000;
const targetData = (network: string, timestamps: number[]) => {
  const component = Object.create(BlockTimesGraphComponent.prototype) as any;
  component.stateService = { network };
  return component.targetTimeData(
    timestamps.map((timestamp) => [timestamp, 5])
  );
};

describe('historical block-time target line', () => {
  it('steps from ten minutes to one at chipnet activation', () => {
    expect(
      targetData('chipnet', [activation - 1000, activation + 1000])
    ).toEqual([
      [activation - 1000, 10],
      [activation, 1],
      [activation + 1000, 1],
    ]);
  });
  it('keeps one-minute targets after activation and ten-minute targets before it', () => {
    expect(targetData('chipnet', [activation, activation + 1000])).toEqual([
      [activation, 1],
      [activation + 1000, 1],
    ]);
    expect(
      targetData('chipnet', [activation - 2000, activation - 1000])
    ).toEqual([
      [activation - 2000, 10],
      [activation - 1000, 10],
    ]);
  });
  it.each(['', 'mainnet', 'testnet4', 'scalenet'])(
    'retains ten-minute targets for %s',
    (network) => {
      expect(
        targetData(network, [activation - 1000, activation + 1000])
      ).toEqual([
        [activation - 1000, 10],
        [activation + 1000, 10],
      ]);
    }
  );
  it('handles empty series', () => {
    expect(targetData('chipnet', [])).toEqual([]);
  });
});

it('keeps the tooltip on raw block times and SMA after adding a target series', () => {
  const component = Object.create(BlockTimesGraphComponent.prototype) as any;
  component.stateService = { network: 'chipnet' };
  component.locale = 'en-US';
  component.isMobile = () => false;
  component.timespan = '24h';
  component.prepareChartOptions({
    timeDiffs: [
      [activation - 1000, 10, 332450],
      [activation + 1000, 1, 332451],
    ],
  });
  const formatter = component.chartOptions.tooltip.formatter;
  const html = formatter(
    [0, 1, 2, 3].map((seriesIndex) => ({
      seriesIndex,
      marker: '',
      seriesName: ['Raw', 'Target', 'SMA', 'Median'][seriesIndex],
      data: [activation, seriesIndex + 1, 332451],
      axisValue: activation,
    }))
  );
  expect(html).toContain('Raw');
  expect(html).toContain('SMA');
  expect(html).not.toContain('Target');
});

function targetChart(network: string) {
  const component = Object.create(BlockTimesGraphComponent.prototype) as any;
  component.stateService = { network };
  component.locale = 'en-US';
  component.isMobile = () => false;
  component.timespan = '24h';
  return component;
}

describe('zero-span target guide', () => {
  it.each([
    ['mainnet', activation + 60000, 10],
    ['chipnet', activation - 60000, 10],
    ['chipnet', activation + 60000, 1],
  ])(
    'shows the appropriate horizontal guide for one %s sample',
    (network, timestamp, target) => {
      const component = targetChart(network as string);
      component.prepareChartOptions({ timeDiffs: [[timestamp, 5, 332452]] });
      const series = component.chartOptions.series[1];
      expect(series.markLine.data).toEqual([{ yAxis: target }]);
      expect(series.markLine).toMatchObject({
        symbol: 'none',
        label: { show: false },
        silent: true,
      });
      expect(series.data).toEqual([
        [timestamp, target],
        [timestamp, target],
      ]);
    }
  );

  it('also shows the guide when multiple samples have the same timestamp', () => {
    const component = targetChart('chipnet');
    component.prepareChartOptions({
      timeDiffs: [
        [activation + 60000, 5, 332451],
        [activation + 60000, 2, 332452],
      ],
    });
    expect(component.chartOptions.series[1].markLine.data).toEqual([
      { yAxis: 1 },
    ]);
  });

  it('keeps empty charts free of a target guide', () => {
    const component = targetChart('chipnet');
    component.prepareChartOptions({ timeDiffs: [] });
    expect(component.chartOptions.series).toEqual([]);
  });

  it('clears the fallback for a time span and restores it for another single sample', () => {
    const component = targetChart('chipnet');
    component.prepareChartOptions({
      timeDiffs: [[activation + 60000, 5, 332452]],
    });
    expect(component.chartOptions.series[1].markLine.data).toEqual([
      { yAxis: 1 },
    ]);
    component.prepareChartOptions({
      timeDiffs: [
        [activation - 1000, 10, 332450],
        [activation + 1000, 1, 332451],
      ],
    });
    expect(component.chartOptions.series[1]).toMatchObject({
      step: 'end',
      markLine: { data: [] },
      data: [
        [activation - 1000, 10],
        [activation, 1],
        [activation + 1000, 1],
      ],
    });
    component.prepareChartOptions({
      timeDiffs: [[activation - 60000, 5, 332449]],
    });
    expect(component.chartOptions.series[1].markLine.data).toEqual([
      { yAxis: 10 },
    ]);
  });
});
