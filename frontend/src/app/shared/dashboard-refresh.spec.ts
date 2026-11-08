import 'zone.js/node';
import { NgZone } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { refreshDashboard$ } from './dashboard-refresh';

it('loads server dashboard history without retaining an Angular macrotask before teardown', () => {
  const zone = new NgZone({ enableLongStackTrace: false });
  const request = vi.fn(() => of([]));
  const values: unknown[] = [];
  const subscription = zone.run(() =>
    refreshDashboard$(new BehaviorSubject(2), request, false).subscribe(
      (value) => values.push(value)
    )
  );
  try {
    expect(request).toHaveBeenCalledOnce();
    expect(values).toEqual([[]]);
    expect(zone.hasPendingMacrotasks).toBe(false);
    expect(zone.isStable).toBe(true);
  } finally {
    subscription.unsubscribe();
  }
});
