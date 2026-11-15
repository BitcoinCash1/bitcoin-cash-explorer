import '@angular/compiler';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsertDeviationGraphPageComponent } from './asert-deviation-graph-page.component';

const minuteStartMs = Date.UTC(2026, 10, 15, 12, 34);
const minuteStart = minuteStartMs / 1000;

function fixture() {
  const getAsertBlocks$ = vi.fn(() => of([]));
  const component = Object.create(
    AsertDeviationGraphPageComponent.prototype
  ) as any;
  component.stateService = {
    network: 'chipnet',
    blocks$: new BehaviorSubject([]),
  };
  component.apiService = { getAsertBlocks$ };
  return { component, getAsertBlocks$ };
}

afterEach(() => vi.restoreAllMocks());

describe('ASERT rolling window cache bounds', () => {
  it('reuses identical bounds for separate visitors within the same minute', async () => {
    const clock = vi.spyOn(Date, 'now');
    const visitors = [fixture(), fixture()];
    for (const [index, visitor] of visitors.entries()) {
      clock.mockReturnValue(minuteStartMs + [1000, 59999][index]);
      await firstValueFrom(visitor.component.fetchBlocksForTimespan('1w'));
    }
    expect(visitors[0].getAsertBlocks$.mock.calls).toEqual(
      visitors[1].getAsertBlocks$.mock.calls
    );
    expect(visitors[0].getAsertBlocks$).toHaveBeenCalledWith(
      16844,
      minuteStart - 7 * 86400,
      minuteStart + 60
    );
  });

  it('advances both bounds by one minute on rollover while covering the full requested window', async () => {
    const clock = vi.spyOn(Date, 'now');
    const { component, getAsertBlocks$ } = fixture();
    for (const now of [minuteStartMs + 59999, minuteStartMs + 60000]) {
      clock.mockReturnValue(now);
      await firstValueFrom(component.fetchBlocksForTimespan('24h'));
      const [, from, to] = getAsertBlocks$.mock.lastCall as unknown as [
        number,
        number,
        number,
      ];
      expect(from).toBeLessThanOrEqual(now / 1000 - 86400);
      expect(to).toBeGreaterThanOrEqual(now / 1000);
      expect(to - from).toBe(86400 + 60);
    }
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      1,
      16844,
      minuteStart - 86400,
      minuteStart + 60
    );
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      2,
      16844,
      minuteStart + 60 - 86400,
      minuteStart + 120
    );
  });

  it('keeps all-history requests unbounded across time', async () => {
    const clock = vi.spyOn(Date, 'now');
    const { component, getAsertBlocks$ } = fixture();
    for (const now of [minuteStartMs, minuteStartMs + 30 * 86400000]) {
      clock.mockReturnValue(now);
      await firstValueFrom(component.fetchBlocksForTimespan('all'));
    }
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      1,
      16844,
      undefined,
      undefined
    );
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      2,
      16844,
      undefined,
      undefined
    );
  });

  it('keeps distinct rolling spans in separate cache windows', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(minuteStartMs + 12000);
    const { component, getAsertBlocks$ } = fixture();
    for (const span of ['24h', '1w', '1m'])
      await firstValueFrom(component.fetchBlocksForTimespan(span));
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      1,
      16844,
      minuteStart - 86400,
      minuteStart + 60
    );
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      2,
      16844,
      minuteStart - 7 * 86400,
      minuteStart + 60
    );
    expect(getAsertBlocks$).toHaveBeenNthCalledWith(
      3,
      16844,
      minuteStart - 30 * 86400,
      minuteStart + 60
    );
  });
});
