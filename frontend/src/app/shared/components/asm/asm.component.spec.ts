import { describe, expect, it, vi } from 'vitest';
import { AsmComponent } from './asm.component';

describe('ASM timelock annotations', () => {
  it('keeps distinct repeated opcodes and detects operand before cropping', () => {
    const component = new AsmComponent();
    component.asm = 'OP_PUSHNUM_1 OP_CSV OP_PUSHNUM_1 OP_CLTV';
    component.parseASM();
    expect(
      component.instructions.map((instruction) => instruction.timelockTooltip)
    ).toEqual([
      'Relative locktime: 1 block',
      undefined,
      'Block height: 1',
      undefined,
    ]);
    component.crop = 'OP_PUSHNUM_1 '.length;
    component.parseASM();
    expect(component.instructions).toHaveLength(1);
    expect(component.instructions[0].timelockTooltip).toBe(
      'Relative locktime: 1 block'
    );
  });

  it('retains signature events and annotations while adding timelock hints', () => {
    const component = new AsmComponent();
    const signature = { sighash: 0x41 } as any;
    const annotations = {
      signatures: { deadbeef: { sig: signature, vindex: 0 } },
      selectedSig: signature,
      p2sh: true,
    };
    component.annotations = annotations;
    component.asm = 'OP_PUSHBYTES_4 deadbeef OP_CHECKSIG OP_PUSHNUM_1 OP_CSV';
    component.parseASM();
    expect(component.annotations).toBe(annotations);
    expect(component.instructions[0].args).toContain('deadbeef');
    const show = vi.fn();
    const hide = vi.fn();
    component.showSigInfo.subscribe(show);
    component.hideSigInfo.subscribe(hide);
    component.doShowSigInfo(signature);
    component.doHideSigInfo();
    expect(show).toHaveBeenCalledWith(signature);
    expect(hide).toHaveBeenCalledOnce();
  });
});

function parse(asm: string, crop = 0): AsmComponent {
  const component = new AsmComponent();
  component.asm = asm;
  component.crop = crop;
  component.parseASM();
  return component;
}

describe('ASM control-flow indentation', () => {
  it('aligns nested branches and loops while preserving timelock annotations', () => {
    const component = parse(
      'OP_IF OP_NOTIF OP_BEGIN OP_PUSHNUM_1 OP_CSV OP_UNTIL OP_ELSE OP_DUP OP_ENDIF OP_ELSE OP_DROP OP_ENDIF OP_CHECKSIG'
    );
    expect(component.instructions.map((line) => line.visualDepth)).toEqual([
      0, 1, 2, 3, 3, 2, 1, 2, 1, 0, 1, 0, 0,
    ]);
    expect(component.instructions[3].timelockTooltip).toContain('1 block');
  });

  it('caps padding without losing actual nesting depth', () => {
    const component = parse(
      'OP_IF '.repeat(12) + 'OP_DUP ' + 'OP_ENDIF '.repeat(12) + 'OP_CHECKSIG'
    );
    expect(component.instructions.map((line) => line.visualDepth)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2,
      1, 0, 0,
    ]);
  });

  it('handles unmatched closers, cropped scripts, and subsequent input changes', () => {
    expect(
      parse('OP_ELSE OP_ENDIF OP_UNTIL OP_DUP').instructions.map(
        (line) => line.visualDepth
      )
    ).toEqual([0, 0, 0, 0]);
    const component = parse('OP_IF OP_DUP OP_ENDIF', 13);
    expect(component.instructions.map((line) => line.visualDepth)).toEqual([
      0, 1,
    ]);
    component.asm = 'OP_DUP';
    component.parseASM();
    expect(component.instructions[0].visualDepth).toBe(0);
  });
});
