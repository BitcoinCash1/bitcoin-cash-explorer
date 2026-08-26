import { describe, expect, it } from 'vitest';
import { resolveBcmrIconUrl } from './bcmr.utils';

describe('resolveBcmrIconUrl', () => {
  it('resolves an IPFS URI through the public gateway', () => {
    expect(resolveBcmrIconUrl('ipfs://bafybeigdyrzt/icon.png')).toBe(
      'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt/icon.png'
    );
  });

  it('keeps an HTTP URL unchanged', () => {
    expect(resolveBcmrIconUrl('https://example.com/icon.png')).toBe(
      'https://example.com/icon.png'
    );
  });

  it('returns null when no icon is provided', () => {
    expect(resolveBcmrIconUrl()).toBeNull();
  });
});
