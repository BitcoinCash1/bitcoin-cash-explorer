import '@angular/compiler';
import { convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockComponent } from './block.component';

function fixture() {
  vi.stubGlobal('window', {
    innerWidth: 1200,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal('document', { body: { scrollTo: vi.fn() } });
  vi.stubGlobal('history', { state: {} });
  const blocks$ = new Subject<any[]>();
  const paramMap = new Subject<any>();
  const state = {
    env: { AUDIT: false, ITEMS_PER_PAGE: 25 },
    hideAudit: new BehaviorSubject(true),
    isBrowser: false,
    network: '',
    timeLtr: of(true),
    blocks$,
    markBlock$: new Subject(),
    networkChanged$: new Subject(),
    keyNavigation$: new Subject(),
    fiatCurrency$: of('USD'),
    loadingIndicators$: of({}),
  };
  const fetchedBlock = { id: 'b'.repeat(64), height: 101, timestamp: 1000 };
  const api = {
    getBlock$: vi.fn(() => of(fetchedBlock)),
    getStrippedBlockTransactions$: () => of([]),
  };
  const component = new BlockComponent(
    { paramMap, queryParams: of({}), fragment: of(null) } as any,
    { replaceState: vi.fn(), path: () => '/' } as any,
    {} as any,
    { getBlockTransactions$: () => of([]) } as any,
    state as any,
    { setTitle: vi.fn(), setDescription: vi.fn() } as any,
    { want: vi.fn() } as any,
    {} as any,
    api as any,
    { getBlockPrice$: () => of(undefined) } as any,
    {
      loadedBlocks$: new Subject(),
      getCachedBlock: () => null,
      loadBlock: vi.fn(),
    } as any,
    {} as any,
    {} as any
  );
  component.blockGraphActual = [] as any;
  component.blockGraphProjected = [] as any;
  vi.spyOn(component, 'setupBlockGraphs').mockImplementation(() => {});
  vi.spyOn(component, 'setupBlockAudit').mockImplementation(() => {});
  const canonical = vi
    .spyOn(component as any, 'fetchCanonicalBlock')
    .mockImplementation(() => {});
  component.ngOnInit();
  return { component, blocks$, paramMap, canonical, api, fetchedBlock };
}

afterEach(() => vi.unstubAllGlobals());

describe('block identity and stale detection', () => {
  it('stores canonical hash for height-cache navigation and ignores duplicate same-block updates', () => {
    const f = fixture();
    const cached = { id: 'a'.repeat(64), height: 100, timestamp: 1000 };
    f.blocks$.next([cached]);
    f.paramMap.next(convertToParamMap({ id: '100' }));
    expect(f.component.blockHash).toBe(cached.id);
    f.blocks$.next([{ ...cached }]);
    expect(f.component.block.stale).not.toBe(true);
    expect(f.canonical).not.toHaveBeenCalled();
    const replacement = { ...cached, id: 'c'.repeat(64) };
    f.blocks$.next([replacement]);
    expect(f.component.block.stale).toBe(true);
    expect(f.component.block.canonical).toBe(replacement.id);
    expect(f.canonical).toHaveBeenCalledOnce();
    f.component.ngOnDestroy();
  });

  it('defends same-height/same-ID events even if the selected hash was not yet populated', () => {
    const f = fixture();
    const block = { id: 'a'.repeat(64), height: 100, timestamp: 1000 };
    f.component.block = block as any;
    f.component.blockHash = undefined;
    f.blocks$.next([{ ...block }]);
    expect(f.component.block.stale).not.toBe(true);
    expect(f.canonical).not.toHaveBeenCalled();
    f.component.ngOnDestroy();
  });

  it('stores the resolved hash when navigation history provides a height-based block', () => {
    const f = fixture();
    vi.stubGlobal('history', { state: { data: { block: f.fetchedBlock } } });
    f.paramMap.next(convertToParamMap({ id: '101' }));
    expect(f.component.blockHash).toBe(f.fetchedBlock.id);
    expect(f.api.getBlock$).not.toHaveBeenCalled();
    f.component.ngOnDestroy();
  });
});
