import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Pipe({
  name: 'fiatCurrency',
  standalone: false,
})
export class FiatCurrencyPipe implements PipeTransform {
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
    const digitsInfo = args[0] || '1.2-2';
    const currency = args[1] || this.currency || 'USD';

    // Parse digitsInfo (format: {minIntegerDigits}.{minFractionDigits}-{maxFractionDigits})
    const digitsMatch = digitsInfo.match(/^(\d+)\.(\d+)-(\d+)$/);
    let minFractionDigits = 2;
    let maxFractionDigits = 2;

    if (digitsMatch) {
      minFractionDigits = parseInt(digitsMatch[2], 10);
      maxFractionDigits = parseInt(digitsMatch[3], 10);
    }

    if (Math.abs(num) >= 1000) {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    } else {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFractionDigits,
      }).format(num);
    }
  }
}
