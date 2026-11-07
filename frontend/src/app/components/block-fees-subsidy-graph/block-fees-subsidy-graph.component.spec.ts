import '@angular/compiler';
import '@angular/localize/init';
import { HttpHeaders } from '@angular/common/http';
import { UntypedFormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockFeesSubsidyGraphComponent } from './block-fees-subsidy-graph.component';
import { echarts } from '@app/graphs/echarts';

function fixture(stored: string | null = null, price = 500, testnet = false) {
  vi.stubGlobal('window', { innerWidth: 1200 });
  const values = new Map<string, string>();
  if (stored !== null) values.set('fees_subsidy_legend', stored);
  const storage = {
    getValue: (key: string) => values.get(key) ?? null,
    setValue: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
  const component = () =>
    new BlockFeesSubsidyGraphComponent(
      'en-US',
      { setTitle: vi.fn(), setDescription: vi.fn() } as any,
      {
        getHistoricalBlockFees$: () =>
          of({
            body: [{ avgHeight: 100, timestamp: 1000, avgFees: 1, USD: price }],
            headers: new HttpHeaders({ 'x-total-count': '1' }),
          }),
      } as any,
      new UntypedFormBuilder(),
      { isAnyTestnet: () => testnet } as any,
      storage as any,
      { getDefaultTimespan: () => '1m' } as any,
      { fragment: of(null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  const load = () => {
    const instance = component();
    instance.ngOnInit();
    instance.statsObservable$.subscribe().unsubscribe();
    return instance;
  };
  return { load, values, storage };
}

afterEach(() => vi.unstubAllGlobals());

it.each(['normal', 'fiat', 'percentage'] as const)(
  'restores %s mode and individual selections across timespan rebuilds',
  (mode) => {
    const state = { mode, fees: false, subsidy: true };
    const f = fixture(JSON.stringify(state));
    const component = f.load();
    expect(component.displayMode).toBe(mode);
    expect(component.legend).toEqual(state);
    const suffix =
      mode === 'fiat' ? ' (USD)' : mode === 'percentage' ? ' (%)' : '';
    const subscription = component.statsObservable$.subscribe();
    component.radioGroupForm.get('dateSpan').setValue('1y');
    subscription.unsubscribe();
    expect((component.chartOptions['legend'] as any).selected).toMatchObject({
      [`Fees${suffix}`]: false,
      [`Subsidy${suffix}`]: true,
    });
  }
);

it.each([
  '{',
  'null',
  '[]',
  '42',
  '{}',
  '{"mode":"bogus","fees":true,"subsidy":true}',
  '{"mode":"normal","fees":"false","subsidy":true}',
  '{"mode":"fiat","fees":true}',
])('rejects malformed persisted state: %s', (stored) => {
  const f = fixture(stored);
  const component = f.load();
  expect(component.legend).toEqual({
    mode: 'normal',
    fees: true,
    subsidy: true,
  });
  expect(component.displayMode).toBe('normal');
  expect(f.storage.removeItem).toHaveBeenCalledWith('fees_subsidy_legend');
});

it.each([
  { price: undefined, testnet: false },
  { price: 500, testnet: true },
])(
  'falls back from persisted fiat when unavailable: $testnet/$price',
  ({ price, testnet }) => {
    const f = fixture(
      JSON.stringify({ mode: 'fiat', fees: false, subsidy: true }),
      price === undefined ? NaN : price,
      testnet
    );
    const component = f.load();
    expect(component.displayMode).toBe('normal');
    expect(component.chartOptions['yAxis']).toHaveLength(2);
    expect(component.chartOptions['series']).toHaveLength(6);
    expect((component.chartOptions['legend'] as any).selected).toMatchObject({
      Fees: true,
      Subsidy: true,
    });
    expect(JSON.parse(f.values.get('fees_subsidy_legend'))).toEqual({
      mode: 'normal',
      fees: true,
      subsidy: true,
    });
  }
);

it('persists real ECharts toggles, switches modes and restores hidden selections after reload', () => {
  const f = fixture();
  const component = f.load();
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 1000,
    height: 500,
  });
  try {
    chart.setOption(component.chartOptions);
    component.onChartInit(chart);
    chart.dispatchAction({ type: 'legendToggleSelect', name: 'Fees' });
    expect(f.load().legend).toEqual({
      mode: 'normal',
      fees: false,
      subsidy: true,
    });
    chart.setOption(component.chartOptions);
    expect((chart.getOption()['legend'] as any[])[0].selected.Fees).toBe(false);
    chart.dispatchAction({ type: 'legendToggleSelect', name: 'Fees (%)' });
    expect(f.load().legend).toEqual({
      mode: 'percentage',
      fees: true,
      subsidy: true,
    });
    chart.dispatchAction({ type: 'legendToggleSelect', name: 'Subsidy (%)' });
    chart.dispatchAction({ type: 'legendToggleSelect', name: 'Fees (%)' });
    const reloaded = f.load();
    expect(reloaded.legend).toEqual({
      mode: 'percentage',
      fees: false,
      subsidy: false,
    });
    expect((reloaded.chartOptions['legend'] as any).selected).toMatchObject({
      'Fees (%)': false,
      'Subsidy (%)': false,
    });
  } finally {
    chart.dispose();
  }
});
