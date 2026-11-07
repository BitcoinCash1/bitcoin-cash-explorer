import '@angular/compiler';
import '@angular/localize/init';
import { HttpHeaders } from '@angular/common/http';
import { UntypedFormBuilder } from '@angular/forms';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockFeesGraphComponent } from './block-fees-graph.component';
import { BlockRewardsGraphComponent } from '../block-rewards-graph/block-rewards-graph.component';
import { BlockFeesSubsidyGraphComponent } from '../block-fees-subsidy-graph/block-fees-subsidy-graph.component';
import { FiatShortenerPipe } from '@app/shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '@app/shared/pipes/fiat-currency.pipe';
import { echarts } from '@app/graphs/echarts';

function fixture(
  rows = [{ avgHeight: 100, timestamp: 1000, avgFees: 1, USD: 500 }]
) {
  vi.stubGlobal('window', { innerWidth: 1200 });
  const state = {
    isAnyTestnet: () => false,
    fiatCurrency$: new BehaviorSubject('USD'),
  };
  const shortener = new FiatShortenerPipe('en-US', state as any);
  const currency = new FiatCurrencyPipe('en-US', state as any);
  const api = {
    getHistoricalBlockFees$: vi.fn(() =>
      of({
        body: rows,
        headers: new HttpHeaders({ 'x-total-count': '1000000' }),
      })
    ),
  };
  const seo = { setTitle: vi.fn(), setDescription: vi.fn() };
  const mining = { getDefaultTimespan: () => '1m' };
  const storage = { getValue: () => null, setValue: vi.fn() };
  const route = { fragment: of(null) };
  const component = new BlockFeesGraphComponent(
    'en-US',
    seo as any,
    api as any,
    new UntypedFormBuilder(),
    storage as any,
    mining as any,
    state as any,
    route as any,
    shortener,
    currency
  );
  return {
    component,
    state,
    shortener,
    currency,
    api,
    seo,
    mining,
    storage,
    route,
  };
}
afterEach(() => vi.unstubAllGlobals());

it('keeps total fees in raw BCH/fiat units through true log and linear round-trip', () => {
  const f = fixture();
  f.component.ngOnInit();
  const subscription = f.component.statsObservable$.subscribe();
  const raw = JSON.stringify(
    (f.component.chartOptions['series'] as any[]).map((series) => series.data)
  );
  f.component.onScaleChange('log');
  expect(f.component.chartOptions['yAxis']).toMatchObject([
    { type: 'log', min: 0.00000001 },
    { type: 'log', min: 0.000005 },
  ]);
  expect((f.component.chartOptions['series'] as any[])[0].data[0][3]).toBe(
    0.00000001
  );
  f.component.onScaleChange('linear');
  expect(
    JSON.stringify(
      (f.component.chartOptions['series'] as any[]).map((series) => series.data)
    )
  ).toBe(raw);
  f.component.currency = 'EUR';
  f.component.prepareChartOptions({
    blockFees: [[1000, 0.01, 100]],
    blockFeesFiat: [[1000, 3.5, 100]],
  });
  const axis = (f.component.chartOptions['yAxis'] as any[])[1];
  expect(axis.axisLabel.formatter(3.5)).toBe('€3.50');
  subscription.unsubscribe();
});

it.each([false, true])(
  'removes absent-price fiat axis/series/legend on fees and rewards, testnet: %s',
  (testnet) => {
    const f = fixture();
    f.state.isAnyTestnet = () => testnet;
    const data = [[1000, 1, 100]];
    const fiat = testnet ? data : [];
    f.component.prepareChartOptions({ blockFees: data, blockFeesFiat: fiat });
    expect(f.component.chartOptions['yAxis']).toHaveLength(1);
    expect(f.component.chartOptions['series']).toHaveLength(1);
    expect(f.component.chartOptions['legend']).toBeUndefined();
    const rewards = new BlockRewardsGraphComponent(
      'en-US',
      f.seo as any,
      {} as any,
      new UntypedFormBuilder(),
      f.mining as any,
      f.storage as any,
      f.state as any,
      f.route as any,
      f.shortener,
      f.currency
    );
    rewards.prepareChartOptions({ blockRewards: data, blockRewardsFiat: fiat });
    expect(rewards.chartOptions['yAxis']).toHaveLength(1);
    expect(rewards.chartOptions['series']).toHaveLength(1);
    expect(rewards.chartOptions['legend']).toBeUndefined();
  }
);

it('preserves category alignment for partially missing subsidy prices and falls back from unavailable fiat', () => {
  const f = fixture([
    { avgHeight: 100, timestamp: 1000, avgFees: 1, USD: undefined },
    { avgHeight: 101, timestamp: 1001, avgFees: 2, USD: 500 },
    { avgHeight: 102, timestamp: 1002, avgFees: 3, USD: undefined },
  ]);
  const component = new BlockFeesSubsidyGraphComponent(
    'en-US',
    f.seo as any,
    f.api as any,
    new UntypedFormBuilder(),
    f.state as any,
    f.storage as any,
    f.mining as any,
    f.route as any,
    {} as any,
    {} as any,
    f.shortener,
    f.currency,
    {} as any
  );
  component.ngOnInit();
  const subscription = component.statsObservable$.subscribe();
  expect(component.data.blockFeesFiat).toEqual([null, 0.00001, null]);
  expect(component.data.blockSubsidyFiat).toHaveLength(
    component.data.blockHeight.length
  );
  component.data.blockFeesFiat = [null, null, null];
  component.data.blockSubsidyFiat = [null, null, null];
  component.displayMode = 'fiat';
  component.prepareChartOptions();
  expect(component.displayMode).toBe('normal');
  expect(component.chartOptions['yAxis']).toHaveLength(1);
  expect(
    (component.chartOptions['series'] as any[]).some(
      (series) => series.yAxisIndex === 1
    )
  ).toBe(false);
  expect(
    (component.chartOptions['legend'] as any).data.some((entry) =>
      entry.name.includes('USD')
    )
  ).toBe(false);
  subscription.unsubscribe();
});

it('rebuilds subsidy series after zoom changes price availability without shifting category data', () => {
  const rows = [
    { avgHeight: 100, timestamp: 1000, avgFees: 1, USD: undefined },
    { avgHeight: 101, timestamp: 1001, avgFees: 2, USD: undefined },
    { avgHeight: 102, timestamp: 1002, avgFees: 3, USD: undefined },
  ];
  const f = fixture(rows);
  const zoom = new Subject<any>();
  const api = { ...f.api, getBlockFeesFromTimespan$: vi.fn(() => zoom) };
  const component = new BlockFeesSubsidyGraphComponent(
    'en-US',
    f.seo as any,
    api as any,
    new UntypedFormBuilder(),
    f.state as any,
    f.storage as any,
    f.mining as any,
    f.route as any,
    {} as any,
    {} as any,
    f.shortener,
    f.currency,
    { detectChanges: vi.fn() } as any
  );
  component.ngOnInit();
  const subscription = component.statsObservable$.subscribe();
  expect(component.chartOptions['yAxis']).toHaveLength(1);
  let options: any = component.chartOptions;
  options.dataZoom[0] = { startValue: 0, endValue: 2, start: 0, end: 100 };
  const setOption = vi.fn((next) => {
    options = next;
  });
  component.chartInstance = {
    getOption: () => options,
    setOption,
    dispatchAction: vi.fn(),
  };
  component.onZoom();
  zoom.next({ body: [rows[0], { ...rows[1], USD: 500 }, rows[2]] });
  expect(setOption).toHaveBeenCalledOnce();
  expect(component.chartOptions['yAxis']).toHaveLength(2);
  expect(component.chartOptions['series']).toHaveLength(6);
  expect(component.data.blockFeesFiat).toEqual([null, 0.00001, null, null]);
  expect(component.data.blockFeesFiat).toHaveLength(
    component.data.timestamp.length
  );
  subscription.unsubscribe();
});

it.each([
  { mode: 'normal', beforePrice: undefined, afterPrice: 500 },
  { mode: 'normal', beforePrice: 500, afterPrice: undefined },
  { mode: 'normal', beforePrice: 500, afterPrice: 500 },
  { mode: 'fiat', beforePrice: 500, afterPrice: 500 },
  { mode: 'percentage', beforePrice: 500, afterPrice: undefined },
  { mode: 'fiat', beforePrice: 500, afterPrice: undefined },
] as const)(
  'retains legend selections after zoom, with BCH fallback when fiat disappears: $mode/$beforePrice/$afterPrice',
  ({ mode, beforePrice, afterPrice }) => {
    const rows = [
      { avgHeight: 100, timestamp: 1000, avgFees: 1, USD: beforePrice },
      { avgHeight: 101, timestamp: 1001, avgFees: 2, USD: beforePrice },
      { avgHeight: 102, timestamp: 1002, avgFees: 3, USD: undefined },
    ];
    const f = fixture(rows);
    const zoom = new Subject<any>();
    const component = new BlockFeesSubsidyGraphComponent(
      'en-US',
      f.seo as any,
      { ...f.api, getBlockFeesFromTimespan$: () => zoom } as any,
      new UntypedFormBuilder(),
      f.state as any,
      f.storage as any,
      f.mining as any,
      f.route as any,
      {} as any,
      {} as any,
      f.shortener,
      f.currency,
      { detectChanges: vi.fn() } as any
    );
    component.ngOnInit();
    const subscription = component.statsObservable$.subscribe();
    const chart = echarts.init(null, null, {
      renderer: 'svg',
      ssr: true,
      width: 1000,
      height: 500,
    });
    try {
      component.displayMode = mode;
      component.prepareChartOptions();
      chart.setOption(component.chartOptions);
      component.onChartInit(chart);
      const suffix =
        mode === 'fiat' ? ' (USD)' : mode === 'percentage' ? ' (%)' : '';
      chart.dispatchAction({
        type: 'legendUnSelect',
        name: `Subsidy${suffix}`,
      });
      chart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: 2 });
      component.onZoom();
      zoom.next({ body: rows.map((row) => ({ ...row, USD: afterPrice })) });
      const fallback = mode === 'fiat' && afterPrice === undefined;
      const selected = (chart.getOption()['legend'] as any[])[0].selected;
      expect(component.displayMode).toBe(fallback ? 'normal' : mode);
      expect(selected[fallback ? 'Subsidy' : `Subsidy${suffix}`]).toBe(
        fallback
      );
      expect(selected[fallback ? 'Fees' : `Fees${suffix}`]).toBe(true);
      expect(component.isLoading).toBe(false);
      const series = chart.getOption()['series'] as any[];
      expect(series.some((item) => item.name.includes('USD'))).toBe(
        afterPrice !== undefined
      );
      expect((chart.getOption()['dataZoom'] as any[])[0]).toMatchObject({
        startValue: 0,
        endValue: 3,
      });
    } finally {
      chart.dispose();
      subscription.unsubscribe();
    }
  }
);
