import '@angular/compiler';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { DifficultyComponent } from './difficulty.component';
import { ChainStatsMiningComponent } from '../chain-stats-mining/chain-stats-mining.component';

it('keeps both halving widgets aligned through activation, empty updates, halving, and network switches', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
  const blocks$ = new BehaviorSubject<any[]>([]);
  const difficultyAdjustment$ = new BehaviorSubject<any>(null);
  const state = {
    network: 'chipnet',
    blocks$,
    difficultyAdjustment$,
    isLoadingWebSocket$: new BehaviorSubject(false),
  };
  const home = new DifficultyComponent(state as any, 'en-US');
  const mining = new ChainStatsMiningComponent(state as any);
  home.ngOnInit();
  mining.ngOnInit();
  let homeStatus: any;
  let miningStatus: any;
  const subscriptions = [
    home.asertStatus$.subscribe((s) => (homeStatus = s)),
    mining.asertStatus$.subscribe((s) => (miningStatus = s)),
  ];
  expect(homeStatus).toBeUndefined();
  difficultyAdjustment$.next({ timeAvg: 60000 });
  expect(homeStatus).toBeUndefined();
  for (const height of [332450, 332451, 1207940, 1207941]) {
    blocks$.next([{ height, timestamp: 1794746156, difficulty: 1 }]);
    expect(homeStatus.blocksUntilHalving).toBe(miningStatus.blocksUntilHalving);
    expect(
      Math.abs(homeStatus.timeUntilHalving - miningStatus.timeUntilHalving)
    ).toBeLessThan(10);
    expect(homeStatus.halvingProgressPercent).toBeGreaterThanOrEqual(0);
    expect(homeStatus.halvingProgressPercent).toBeLessThan(100);
  }
  state.network = '';
  blocks$.next([{ height: 419999, timestamp: 1794746156, difficulty: 1 }]);
  expect(homeStatus.blocksUntilHalving).toBe(1);
  expect(miningStatus.blocksUntilHalving).toBe(1);
  expect(home.nextSubsidy).toBe(1250000000);
  subscriptions.forEach((s) => s.unsubscribe());
  vi.restoreAllMocks();
});
