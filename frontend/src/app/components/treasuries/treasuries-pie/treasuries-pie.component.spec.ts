import '@angular/compiler';
import { SimpleChange } from '@angular/core';
import { Subject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { TreasuriesPieComponent } from './treasuries-pie.component';

it('replaces the initial changes subscription during init and releases all observers on destruction', () => {
  const summaries = new Subject<any>();
  const cd = { markForCheck: vi.fn() };
  const component = new TreasuriesPieComponent('en-US', {} as any, cd as any);
  component.walletSummaries$ = summaries;
  vi.spyOn(component, 'processWalletData').mockImplementation(() => {});
  vi.spyOn(component, 'prepareChartOptions').mockImplementation(() => {});

  component.ngOnChanges({
    walletSummaries$: new SimpleChange(undefined, summaries, true),
  });
  const initialSubscription = component.subscription;
  component.ngOnInit();
  expect(initialSubscription.closed).toBe(true);
  expect(summaries.observers).toHaveLength(1);
  expect(component.redraw$.observers).toHaveLength(1);
  summaries.next({});
  expect(cd.markForCheck).toHaveBeenCalledTimes(1);

  component.ngOnChanges({ mode: new SimpleChange('relative', 'all', false) });
  expect(summaries.observers).toHaveLength(1);
  component.ngOnDestroy();
  expect(summaries.observers).toHaveLength(0);
  expect(component.redraw$.observers).toHaveLength(0);
  cd.markForCheck.mockClear();
  summaries.next({});
  component.redraw$.next(true);
  expect(cd.markForCheck).not.toHaveBeenCalled();
});
