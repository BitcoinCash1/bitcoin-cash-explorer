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
