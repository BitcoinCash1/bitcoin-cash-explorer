import '@angular/localize/init';
import { describe, expect, it } from 'vitest';
import {
  detectTimelockTooltips,
  formatCltvTimestamp,
  formatCsvSequence,
} from './script.utils';

const tooltip = (asm: string) =>
  detectTimelockTooltips(asm.split('OP_').filter((part) => part.trim())).get(0);

describe('timelock display hints', () => {
  it.each(['CLTV', 'CHECKLOCKTIMEVERIFY'])(
    'recognises CLTV alias %s and little-endian timestamp',
    (opcode) => {
      expect(tooltip(`OP_PUSHBYTES_4 0065cd1d OP_${opcode}`)).toBe(
        '1985-11-05 00:53:20 UTC'
      );
      expect(tooltip(`OP_PUSHBYTES_3 a08601 OP_${opcode}`)).toBe(
        'Block height: 100000'
      );
    }
  );

  it.each(['CSV', 'CHECKSEQUENCEVERIFY'])(
    'recognises CSV alias %s with block/time/disable bits',
    (opcode) => {
      expect(tooltip(`OP_PUSHBYTES_2 e803 OP_${opcode}`)).toBe(
        'Relative locktime: 1000 blocks'
      );
      expect(tooltip(`OP_PUSHBYTES_3 010040 OP_${opcode}`)).toBe(
        'Relative locktime: 8 minutes 32 seconds'
      );
      expect(tooltip(`OP_PUSHBYTES_5 0000008000 OP_${opcode}`)).toBe(
        'Relative locktime disabled (CSV acts as NOP)'
      );
    }
  );

  it.each([
    '0',
    'FALSE',
    'TRUE',
    ...Array.from({ length: 16 }, (_, index) => `PUSHNUM_${index + 1}`),
    ...Array.from({ length: 16 }, (_, index) => `${index + 1}`),
  ])('annotates small-number operand OP_%s', (opcode) => {
    const value =
      opcode === 'TRUE'
        ? 1
        : opcode.startsWith('PUSHNUM_')
          ? Number(opcode.slice(8))
          : Number(opcode) || 0;
    expect(tooltip(`OP_${opcode} OP_CLTV`)).toBe(`Block height: ${value}`);
    expect(tooltip(`OP_${opcode} OP_CSV`)).toBe(
      `Relative locktime: ${value} block${value === 1 ? '' : 's'}`
    );
  });

  it.each([
    'PUSHNUM_NEG1',
    '1NEGATE',
    'PUSHBYTES_1 81',
    'PUSHBYTES_5 0000000081',
  ])('rejects negative signed operand %s', (operand) => {
    expect(tooltip(`OP_${operand} OP_CLTV`)).toBe('Invalid locktime');
    expect(tooltip(`OP_${operand} OP_CSV`)).toBe('Invalid relative locktime');
  });

  it.each([
    'PUSHBYTES_1 gg',
    'PUSHBYTES_2 01',
    'PUSHBYTES_2 010203',
    'PUSHBYTES_6 010203040506',
    'PUSHBYTES_1',
    'PUSHNUM_17',
    '0 unexpected',
  ])('marks malformed/oversized literal %s invalid', (operand) => {
    expect(tooltip(`OP_${operand} OP_CLTV`)).toBe('Invalid locktime');
    expect(tooltip(`OP_${operand} OP_CSV`)).toBe('Invalid relative locktime');
  });

  it('keeps five-byte values intact and distinguishes height from UTC timestamp', () => {
    expect(tooltip('OP_PUSHBYTES_5 ffffffff00 OP_CLTV')).toBe(
      '2106-02-07 06:28:15 UTC'
    );
    expect(tooltip('OP_PUSHBYTES_5 0000000001 OP_CSV')).toBe(
      'Relative locktime: 0 blocks'
    );
    expect(formatCltvTimestamp(499999999)).toBe('Block height: 499999999');
    expect(formatCltvTimestamp(500000000)).toBe('1985-11-05 00:53:20 UTC');
    expect(formatCltvTimestamp(0x100000000)).toBe('Invalid locktime');
  });

  it('does not infer stack results, nonadjacent pushes or OP_RETURN data', () => {
    expect(detectTimelockTooltips(['DUP ', 'CSV'])).toEqual(new Map());
    expect(
      detectTimelockTooltips(['PUSHBYTES_1 01 ', 'DROP ', 'CLTV'])
    ).toEqual(new Map());
    expect(detectTimelockTooltips(['RETURN ', 'PUSHBYTES_1 01'])).toEqual(
      new Map()
    );
    expect(tooltip('OP_PUSHBYTES_1 80 OP_CSV')).toBe(
      'Relative locktime: 0 blocks'
    );
  });

  it.each([undefined, NaN, Infinity, -1, 1.5, 0x8000000000])(
    'rejects invalid relative formatter input %s',
    (value) => {
      expect(formatCsvSequence(value)).toBe('Invalid relative locktime');
    }
  );
});
