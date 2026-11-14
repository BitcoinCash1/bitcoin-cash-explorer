import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import BlockScene from './block-scene';
import { FastVertexArray } from './fast-vertex-array';
import TxSprite from './tx-sprite';

function scene() {
  return new BlockScene({
    width: 516,
    height: 516,
    resolution: 75,
    blockLimit: 2000000,
    animationDuration: 0,
    animationOffset: 0,
    orientation: 'top',
    flip: false,
    vertexArray: new FastVertexArray(512, TxSprite.dataSize),
    theme: { theme: 'dark' } as any,
    highlighting: false,
    colorFunction: () => ({ r: 0, g: 1, b: 0, a: 1 }),
  });
}
const transactions = (count: number, size: number) =>
  Array.from({ length: count }, (_, i) => ({
    txid: String(i),
    size,
    fee: size,
    value: 0,
    flags: 0,
  }));

describe('capacity-aware scene layout', () => {
  it('keeps all reported-block tiles in bounds across resize and capacity changes', () => {
    const graph = scene();
    const txs = transactions(5591, 357);
    graph.setup(txs);
    expect(Object.keys(graph.txs)).toHaveLength(5591);
    expect(graph.layout.rows.length).toBe(75);
    graph.resize({ width: 300, height: 300, animate: false });
    for (const tx of Object.values(graph.txs)) {
      expect(tx.screenPosition.x).toBeGreaterThanOrEqual(0);
      expect(tx.screenPosition.y).toBeGreaterThanOrEqual(0);
      expect(tx.screenPosition.x + tx.screenPosition.s).toBeLessThanOrEqual(
        300
      );
      expect(tx.screenPosition.y + tx.screenPosition.s).toBeLessThanOrEqual(
        300
      );
    }
    graph.setScale(86, 32000000);
    graph.setup(txs);
    expect(graph.bytesPerUnit).toBeCloseTo(32000000 / (86 / 1.02) ** 2);
    graph.destroy();
  });
  it('expands its viewport rather than cropping overflowing square packing', () => {
    const graph = scene();
    graph.setup(transactions(6000, 357));
    graph.resize({ animate: false });
    expect(Object.keys(graph.txs)).toHaveLength(6000);
    for (const tx of Object.values(graph.txs))
      expect(tx.screenPosition.y).toBeGreaterThanOrEqual(0);
    graph.destroy();
  });
});
