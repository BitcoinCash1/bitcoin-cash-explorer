import '@angular/compiler';
import { FormBuilder } from '@angular/forms';
import { BehaviorSubject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CalculatorComponent } from './calculator.component';

function fixture() {
  const conversions$ = new BehaviorSubject({
    time: 100,
    USD: 500,
    EUR: 400,
    JPY: 70000,
  });
  const fiatCurrency$ = new BehaviorSubject('USD');
  const api = {
    getHistoricalPrice$: vi.fn((timestamp: number) =>
      of({
        prices: [
          { ...conversions$.value, time: timestamp, USD: 600, EUR: 450 },
        ],
      })
    ),
  };
  const component = new CalculatorComponent(
    'en-US',
    { conversions$, fiatCurrency$ } as any,
    new FormBuilder(),
    {} as any,
    api as any
  );
  component.ngOnInit();
  return { component, conversions$, fiatCurrency$, api };
}

function number(component: CalculatorComponent, field: string): number {
  return Number(component.form.get(field).value);
}

describe('calculator last edited amount', () => {
  it('preserves BCH input after earlier fiat input when the live price changes', () => {
    const { component, conversions$ } = fixture();
    component.form.get('fiat').setValue(1500);
    component.form.get('bitcoin').setValue(2);
    conversions$.next({ ...conversions$.value, USD: 600 });
    expect(number(component, 'bitcoin')).toBe(2);
    expect(number(component, 'fiat')).toBe(1200);
    expect(number(component, 'satoshis')).toBe(200000000);
  });

  it.each([
    ['fiat', 1500, 2.5, 1500, 250000000],
    ['bitcoin', 2, 2, 1200, 200000000],
    ['satoshis', 150000000, 1.5, 900, 150000000],
  ])(
    'retains last %s input across live price updates',
    (field, amount, bch, fiat, sats) => {
      const { component, conversions$ } = fixture();
      for (const earlier of ['fiat', 'bitcoin', 'satoshis']) {
        component.form.get(earlier).setValue(1);
      }
      component.form.get(field as string).setValue(amount);
      conversions$.next({ ...conversions$.value, USD: 600 });
      expect(number(component, 'bitcoin')).toBe(bch);
      expect(number(component, 'fiat')).toBe(fiat);
      expect(number(component, 'satoshis')).toBe(sats);
    }
  );

  it('preserves fiat on currency/date changes and shares the historical price request', () => {
    const { component, fiatCurrency$, api } = fixture();
    component.form.get('fiat').setValue(1800);
    fiatCurrency$.next('EUR');
    expect(number(component, 'fiat')).toBe(1800);
    expect(number(component, 'bitcoin')).toBe(4.5);
    component.dateModel = { year: 2020, month: 1, day: 1 };
    component.updatePrice();
    expect(api.getHistoricalPrice$).toHaveBeenCalledOnce();
    expect(number(component, 'fiat')).toBe(1800);
    expect(number(component, 'bitcoin')).toBe(4);
    expect(component.currentCurrency).toBe('EUR');
  });

  it('retains BCH supply and decimal rules', () => {
    const { component, conversions$, fiatCurrency$ } = fixture();
    component.form.get('satoshis').setValue(2100000000000001);
    conversions$.next({ ...conversions$.value, USD: 600 });
    expect(number(component, 'satoshis')).toBe(2100000000000000);
    expect(number(component, 'bitcoin')).toBe(21000000);
    fiatCurrency$.next('JPY');
    expect(component.currencyDecimals).toBe(0);
    component.form.get('bitcoin').setValue('0.00000001');
    expect(number(component, 'satoshis')).toBe(1);
  });
});
