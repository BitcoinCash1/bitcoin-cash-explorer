import '@angular/compiler';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { FiatShortenerPipe } from './fiat-shortener.pipe';

it('formats explicit/selected currencies, cents, negatives and thresholds', () => {
  const fiatCurrency$ = new BehaviorSubject('EUR');
  const pipe = new FiatShortenerPipe('en-US', { fiatCurrency$ } as any);
  expect(pipe.transform(3.5, 'USD')).toBe('$3.50');
  expect(pipe.transform(3.5)).toBe('€3.50');
  expect(pipe.transform(3.5, 'JPY')).toBe('¥4');
  expect(pipe.transform(-3500, 'USD')).toBe('-$4k');
  expect(pipe.transform(-3.5, 'USD')).toBe('-$3.50');
  expect(pipe.transform(999.99, 'USD')).toBe('$999.99');
  expect(pipe.transform(1000, 'USD')).toBe('$1k');
  expect(pipe.transform(3.5, 'invalid')).toBe('$3.50');
  expect(pipe.transform(0, 'USD')).toBe('$0.00');
  pipe.ngOnDestroy();
  expect(pipe.fiatSubscription.closed).toBe(true);
});
