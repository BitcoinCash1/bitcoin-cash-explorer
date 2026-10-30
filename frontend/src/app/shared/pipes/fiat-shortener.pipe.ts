import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Pipe({
  name: 'fiatShortener',
  standalone: false,
})
export class FiatShortenerPipe implements PipeTransform {
  fiatSubscription: Subscription;
  currency: string;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private stateService: StateService
  ) {
    this.fiatSubscription = this.stateService.fiatCurrency$.subscribe(
      (fiat) => {
        this.currency = fiat;
      }
    );
  }

  transform(num: number, ...args: any[]): unknown {
    const currency = args[1] || this.currency || 'USD';

    if (num < 1000) {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }).format(num);
    }

    const lookup = [
      { value: 1, symbol: '' },
      { value: 1e3, symbol: 'k' },
      { value: 1e6, symbol: 'M' },
      { value: 1e9, symbol: 'B' },
      { value: 1e12, symbol: 'T' },
      { value: 1e15, symbol: 'P' },
      { value: 1e18, symbol: 'E' },
    ];
    const item = lookup
      .slice()
      .reverse()
      .find((item) => num >= item.value);

    const result = new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(item ? num / item.value : 0);

    return result + item.symbol;
  }
}
