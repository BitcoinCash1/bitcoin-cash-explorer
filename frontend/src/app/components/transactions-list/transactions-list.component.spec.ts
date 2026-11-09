import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
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
