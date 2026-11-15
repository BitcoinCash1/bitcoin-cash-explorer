import '@angular/compiler';
import { BehaviorSubject } from 'rxjs';
import { UntypedFormBuilder } from '@angular/forms';
import { AmountSelectorComponent } from './amount-selector/amount-selector.component';
import { FiatSelectorComponent } from './fiat-selector/fiat-selector.component';
import { TimezoneSelectorComponent } from './timezone-selector/timezone-selector.component';

it.each([
  [
    AmountSelectorComponent,
    'viewAmountMode$',
    'bch',
    'sats',
    'amountForm',
    'amountMode',
  ],
  [FiatSelectorComponent, 'fiatCurrency$', 'USD', 'EUR', 'fiatForm', 'fiat'],
  [
    TimezoneSelectorComponent,
    'timezone$',
    'local',
    'utc',
    'timezoneForm',
    'mode',
  ],
])(
  'releases %s selector observers across repeated mounts',
  (Component, stream, initial, later, form, control) => {
    const subject = new BehaviorSubject(initial);
    const state: any = { [stream as string]: subject, env: {} };
    for (let i = 0; i < 10; i++) {
      const component: any = new (Component as any)(
        new UntypedFormBuilder(),
        state,
        {}
      );
      component.ngOnInit();
      expect(subject.observers).toHaveLength(1);
      component.ngOnDestroy();
      expect(subject.observers).toHaveLength(0);
      const value = component[form as string].get(control).value;
      subject.next(later);
      expect(component[form as string].get(control).value).toBe(value);
    }
  }
);
