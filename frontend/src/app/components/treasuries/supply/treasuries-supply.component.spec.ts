import '@angular/compiler';
import { TreasuriesSupplyComponent } from './treasuries-supply.component';

const supplyAt = (height: number) => {
  const component = Object.create(TreasuriesSupplyComponent.prototype) as any;
  component.stateService = { network: 'chipnet' };
  component.currentHeight = height;
  component.walletBalance = {};
  component.processSupplyShares();
  return component;
};

describe('chipnet supply accounting', () => {
  it('counts the interval transition with integer satoshi subsidies', () => {
    const before = supplyAt(332450);
    const after = supplyAt(332451);
    expect(after.shares[1].btc - before.shares[1].btc).toBe(2.5);
    expect(before.shares[1].btc).toBe(13561275);
  });
  it('counts the first tick-based halving block at the reduced subsidy', () => {
    expect(
      supplyAt(1207941).shares[1].btc - supplyAt(1207940).shares[1].btc
    ).toBe(1.25);
  });
  it('ends with a finite supply and no remaining rewards', () => {
    const end = supplyAt(200000000);
    expect(end.toBeMined).toBe(0);
    expect(Number.isFinite(end.shares[1].btc)).toBe(true);
    expect(end.shares[1].btc).toBeGreaterThan(20000000);
    expect(end.shares[1].btc).toBeLessThan(21000000);
  });
});
