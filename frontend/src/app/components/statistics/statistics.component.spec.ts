import '@angular/compiler';
import '@angular/localize/init';
import { FormBuilder } from '@angular/forms';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { StatisticsComponent } from './statistics.component';

afterEach(() => vi.useRealTimers());
function fixture(fail = false) {
  const live2Chart$ = new Subject<any>();
  const connectionState$ = new BehaviorSubject(2);
  const state = {
    network: '',
    networkChanged$: new BehaviorSubject(''),
    live2Chart$,
    connectionState$,
  };
  const history = [{ added: 10, bytes_per_second: 2 }];
  const api = {
    list2HStatistics$: vi.fn(() =>
      fail ? throwError(() => new Error('offline')) : of([])
    ),
    list24HStatistics$: vi.fn(() => of(history)),
    list3DStatistics$: vi.fn(() => of(history)),
  };
  const websocket = { want: vi.fn() };
  const component = new StatisticsComponent(
    'en-US',
    new FormBuilder(),
    { fragment: new BehaviorSubject('2h') } as any,
    websocket as any,
    api as any,
    state as any,
    { setTitle: vi.fn(), setDescription: vi.fn() } as any,
    { getValue: vi.fn() } as any,
    { markForCheck: vi.fn() } as any
  );
  component.ngOnInit();
  return { component, api, state, websocket };
}
it('fetches once, switches BCH 3d/history without live contamination, refetches on reconnect and tears down', () => {
  const { component, api, state, websocket } = fixture();
  expect(api.list2HStatistics$).toHaveBeenCalledOnce();
  expect(state.live2Chart$.observers).toHaveLength(1);
  component.radioGroupForm.controls['dateSpan'].setValue('3d');
  expect(api.list3DStatistics$).toHaveBeenCalledOnce();
  expect(state.live2Chart$.observers).toHaveLength(0);
  expect(websocket.want).toHaveBeenLastCalledWith(['blocks']);
  state.live2Chart$.next({ added: 99, bytes_per_second: 50 });
  expect(component.mempoolStats[0].added).toBe(10);
  state.connectionState$.next(0);
  state.connectionState$.next(2);
  expect(api.list3DStatistics$).toHaveBeenCalledTimes(2);
  component.ngOnDestroy();
  expect(state.connectionState$.observers).toHaveLength(0);
  expect(state.networkChanged$.observers).toHaveLength(0);
});
it('shows exhausted history error then recovers on live sample without mutating source data', () => {
  vi.useFakeTimers();
  const { component, api, state } = fixture(true);
  vi.advanceTimersByTime(3000);
  expect(api.list2HStatistics$).toHaveBeenCalledTimes(4);
  expect(component.isLoading).toBe(false);
  expect(component.statsError).toBeInstanceOf(Error);
  const sample = { added: Date.now() / 1000, bytes_per_second: 10 };
  state.live2Chart$.next(sample);
  expect(component.statsError).toBeNull();
  expect(component.mempoolStats).toHaveLength(1);
  expect(component.mempoolStats[0]).not.toBe(sample);
  component.ngOnDestroy();
});
