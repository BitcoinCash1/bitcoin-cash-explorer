import { afterEach, describe, expect, it, vi } from 'vitest';
import { download } from './graphs.utils';

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg"><text fill="var(--fg)">BCH — 日本語 ₿</text><path stroke="var(--missing)"/></svg>';

function fixture(color = '#fff') {
  const anchor = { download: '', href: '', click: vi.fn() };
  const root = {};
  const document = {
    documentElement: root,
    createElement: vi.fn(() => anchor),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  };
  const getComputedStyle = vi.fn(() => ({
    getPropertyValue: (name: string) => (name === '--fg' ? ` ${color} ` : ''),
  }));
  vi.stubGlobal('document', document);
  vi.stubGlobal('getComputedStyle', getComputedStyle);
  return { anchor, document, getComputedStyle, root };
}

afterEach(() => vi.unstubAllGlobals());

describe('SVG downloads', () => {
  it.each(['utf8', 'base64'])(
    'resolves current theme colors and preserves Unicode and missing variables in %s',
    (encoding) => {
      const f = fixture();
      const base64 = encoding === 'base64';
      const prefix = base64
        ? 'data:image/svg+xml;base64,'
        : 'data:image/svg+xml;charset=UTF-8,';
      const encode = (value: string) =>
        base64
          ? Buffer.from(value, 'utf8').toString('base64')
          : encodeURIComponent(value);
      const decode = (value: string) =>
        base64
          ? Buffer.from(value, 'base64').toString('utf8')
          : decodeURIComponent(value);
      const href = prefix + encode(svg);
      download(href, 'chart.svg');
      expect(decode(f.anchor.href.slice(prefix.length))).toBe(
        svg.replace('var(--fg)', '#fff')
      );
      expect(f.getComputedStyle).toHaveBeenCalledWith(f.root);
      expect(f.anchor.download).toBe('chart.svg');
      expect(f.anchor.click).toHaveBeenCalledOnce();
      expect(f.document.body.removeChild).toHaveBeenCalledWith(f.anchor);
      f.getComputedStyle.mockReturnValue({
        getPropertyValue: (name) => (name === '--fg' ? '#111' : ''),
      });
      download(href, 'light.svg');
      expect(decode(f.anchor.href.slice(prefix.length))).toContain(
        'fill="#111"'
      );
    }
  );

  it.each([
    'data:image/png;base64,Zm9v',
    'https://example.org/chart.svg',
    'blob:chart',
    'data:text/csv,a%2Cb',
  ])('leaves other downloads unchanged: %s', (href) => {
    const f = fixture();
    download(href, 'download');
    expect(f.anchor.href).toBe(href);
    expect(f.getComputedStyle).not.toHaveBeenCalled();
  });

  it.each([
    'data:image/svg+xml;charset=UTF-8,%broken',
    'data:image/svg+xml;base64,!!invalid',
  ])('still saves malformed SVG data URLs', (href) => {
    const f = fixture();
    expect(() => download(href, 'chart.svg')).not.toThrow();
    expect(f.anchor.href).toBe(href);
    expect(f.anchor.click).toHaveBeenCalledOnce();
  });

  it('still saves when computed styles are unavailable', () => {
    const f = fixture();
    f.getComputedStyle.mockImplementation(() => {
      throw new Error('Unavailable');
    });
    const href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    download(href, 'chart.svg');
    expect(f.anchor.href).toBe(href);
    expect(f.anchor.click).toHaveBeenCalledOnce();
  });
});
