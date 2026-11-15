import {
  bitsToTarget,
  getDifficultyDriftPercentSinceAnchor,
  getAsertAnchor,
} from './asert.utils';

it('uses recorded current header targets and the inverse target ratio for difficulty drift', () => {
  const anchor = getAsertAnchor('chipnet');
  const anchorTarget = bitsToTarget(anchor.bits);
  expect(
    getDifficultyDriftPercentSinceAnchor(
      332451,
      1794746156,
      'chipnet',
      parseInt(anchor.bits, 16)
    )
  ).toBe(0);
  const half = 0x1c7fff80;
  const double = 0x1d01fffe;
  expect(bitsToTarget(half.toString(16)) / anchorTarget).toBe(0.5);
  expect(
    getDifficultyDriftPercentSinceAnchor(332451, 1794746156, 'chipnet', half)
  ).toBe(100);
  expect(
    getDifficultyDriftPercentSinceAnchor(332451, 1794746156, 'chipnet', double)
  ).toBe(-50);
  expect(getDifficultyDriftPercentSinceAnchor(332450, 0, 'chipnet', half)).toBe(
    100
  );
});
