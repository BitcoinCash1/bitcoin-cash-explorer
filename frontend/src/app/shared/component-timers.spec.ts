import { afterEach, expect, it, vi } from 'vitest';
import { ComponentTimers } from './component-timers';
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it('cancels all pending callbacks and refuses work scheduled after destruction', () => {
  vi.useFakeTimers();
  const timers = new ComponentTimers();
  const callback = vi.fn();
  timers.schedule(callback, 1);
  timers.schedule(callback, 1000);
  timers.destroy();
  timers.schedule(callback, 1);
  expect(vi.getTimerCount()).toBe(0);
  vi.runAllTimers();
  expect(callback).not.toHaveBeenCalled();
});
it('releases completed callbacks and cancels nested work', () => {
  vi.useFakeTimers();
  const timers = new ComponentTimers();
  const callback = vi.fn();
  timers.schedule(() => timers.schedule(callback, 100), 10);
  vi.advanceTimersByTime(10);
  expect(vi.getTimerCount()).toBe(1);
  timers.destroy();
  vi.runAllTimers();
  expect(callback).not.toHaveBeenCalled();
});
