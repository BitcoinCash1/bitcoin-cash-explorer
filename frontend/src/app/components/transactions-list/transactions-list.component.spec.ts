import { BehaviorSubject, Subscription } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { TransactionsListComponent } from './transactions-list.component';

it('isolates OP_RETURN preview/full-data by transaction and output through list reordering', () => {
  const component = new TransactionsListComponent(
    { signaturesMode$: new BehaviorSubject('interesting') } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  component.transactions = [{ txid: 'a' }, { txid: 'b' }] as any;
  component.toggleShowFullOpReturnPreview('a', 0);
  component.toggleShowFullOpReturnData('b', 0);
  component.toggleShowFullOpReturnPreview('a', 1);
  expect(component.showFullOpReturnPreview).toEqual({
    'a-vout-0': true,
    'a-vout-1': true,
  });
  expect(component.showFullOpReturnData).toEqual({ 'b-vout-0': true });
  component.transactions.reverse();
  component.toggleShowFullOpReturnPreview('b', 0);
  component.toggleShowFullOpReturnPreview('a', 0);
  expect(component.showFullOpReturnPreview).toEqual({
    'a-vout-0': false,
    'a-vout-1': true,
    'b-vout-0': true,
  });
  expect(component.showFullOpReturnData).toEqual({ 'b-vout-0': true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each([false, true])(
  'guards token copying after destruction (already pending: %s)',
  async (pending) => {
    vi.useFakeTimers();
    let finishCopy!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCopy = resolve;
        })
    );
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const ref = { markForCheck: vi.fn() };
    const component = new TransactionsListComponent(
      { signaturesMode$: new BehaviorSubject('interesting') } as any,
      {} as any,
      {} as any,
      ref as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    component.outspendsSubscription = new Subscription();
    component.networkSubscription = new Subscription();
    component.signaturesSubscription = new Subscription();
    if (pending) component.copyTokenId('token', 0, 'vout', 0);
    component.ngOnDestroy();
    if (pending) {
      finishCopy();
      await Promise.resolve();
    } else component.copyTokenId('token', 0, 'vout', 0);
    expect(writeText).toHaveBeenCalledTimes(pending ? 1 : 0);
    expect(component.showTokenCopied).toEqual({});
    expect(ref.markForCheck).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  }
);
