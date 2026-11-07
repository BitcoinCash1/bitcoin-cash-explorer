import '@angular/compiler';
import '@angular/localize/init';
import { HttpHeaders } from '@angular/common/http';
import { UntypedFormBuilder } from '@angular/forms';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockFeeRatesGraphComponent } from './block-fee-rates-graph.component';

function fixture(widget = false) {
  vi.stubGlobal('window', { innerWidth: 1200 });
  const rates = [0, 0.001, 0.05, ...Array(28).fill(0.125)];
  const body = rates.map((value, index) => ({
    timestamp: 1000 + index,
    avgHeight: 100 + index,
    avgFee_0: value,
    avgFee_10: value,
    avgFee_25: value,
    avgFee_50: value,
    avgFee_75: value,
    avgFee_90: value,
    avgFee_100: value,
  }));
  const api = {
    getHistoricalBlockFeeRates$: vi.fn(() =>
      of({ body, headers: new HttpHeaders({ 'x-total-count': '1000000' }) })
    ),
  };
  const fragment = new BehaviorSubject<string | null>(null);
  const component = new BlockFeeRatesGraphComponent(
    'en-US',
    { setTitle: vi.fn(), setDescription: vi.fn() } as any,
    api as any,
    new UntypedFormBuilder(),
    { getValue: () => null, setValue: vi.fn() } as any,
    { getDefaultTimespan: () => '24h' } as any,
    {} as any,
    {} as any,
    {} as any,
    { fragment } as any,
    { markForCheck: vi.fn() } as any
  );
  component.widget = widget;
  component.ngOnInit();
  const stats = component.statsObservable$.subscribe();
  const hr = component.hrStatsObservable$.subscribe();
  return {
    component,
    api,
    fragment,
    rates,
    dispose: () => {
      stats.unsubscribe();
      hr.unsubscribe();
    },
  };
}
afterEach(() => vi.unstubAllGlobals());

it('uses precise API for both chart requests and round-trips zero/sub-sat points through scales', () => {
  const f = fixture();
  expect(f.api.getHistoricalBlockFeeRates$).toHaveBeenCalledWith('24h', true);
  expect(f.api.getHistoricalBlockFeeRates$).toHaveBeenCalledTimes(2);
  const values = () => (f.component.chartOptions['series'] as any[])[0].data;
  expect(f.component.scale).toBe('linear');
  expect(values()[0][1]).toBe(0);
  f.component.onScaleChange('log');
  expect(values()[0]).toEqual([1000000, null, 100, 0]);
  expect(values()[1][1]).toBe(0.001);
  expect(f.component.chartOptions['yAxis']).toMatchObject({
    type: 'log',
    min: 0.001,
  });
  f.component.onScaleChange('linear');
  expect(values()[0][1]).toBe(0);
  expect(f.component.chartOptions['yAxis']).toMatchObject({ type: 'value' });
  expect((f.component.chartOptions['series'] as any[])[0].stack).toBe('Total');
  f.dispose();
});

it('keeps widget linear by default and computes averages from raw rates', () => {
  const f = fixture(true);
  const series = f.component.chartOptions['series'] as any[];
  expect(f.component.scale).toBe('linear');
  expect(series[1].data[0][1]).toBeCloseTo(
    f.rates.slice(0, 30).reduce((a, b) => a + b) / 30
  );
  f.dispose();
});

it('responds to fragment back/forward changes and preserves precision in tooltip/mobile settings', () => {
  const f = fixture();
  f.fragment.next('time=3d&scale=log');
  expect(f.component.timespan).toBe('3d');
  expect(f.component.scale).toBe('log');
  const formatter = (f.component.chartOptions['tooltip'] as any).formatter;
  expect(
    formatter([
      {
        axisValue: '1000000',
        marker: '',
        seriesName: 'Median',
        data: [1000000, 0.001, 101, 0.001],
      },
    ])
  ).toContain('0.001 sats/Byte');
  expect(
    formatter([
      {
        axisValue: '1000000',
        marker: '',
        seriesName: 'Median',
        data: [1000000, null, 100, 0],
      },
    ])
  ).toContain('0 sats/Byte');
  f.fragment.next('24h');
  expect(f.component.scale).toBe('linear');
  vi.stubGlobal('window', { innerWidth: 375 });
  f.component.onScaleChange('log');
  expect((f.component.chartOptions['tooltip'] as any).show).toBe(false);
  f.dispose();
});
