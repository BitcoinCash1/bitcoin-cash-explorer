import '@angular/compiler';
import '@angular/localize/init';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClipboardComponent } from './clipboard/clipboard.component';
import { ToggleComponent } from '@app/shared/components/toggle/toggle.component';
import { TrackerBarComponent } from './tracker/tracker-bar.component';
import { CodeTemplateComponent } from '@app/docs/code-template/code-template.component';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it.each([ToggleComponent, TrackerBarComponent])(
  'cancels the deferred callback for %s on destruction',
  (Component) => {
    const cd = { markForCheck: vi.fn() };
    const component: any = new Component(cd as any);
    if (component.ngOnInit) component.ngOnInit();
    else component.ngAfterViewInit();
    expect(vi.getTimerCount()).toBe(1);
    component.ngOnDestroy?.();
    expect(vi.getTimerCount()).toBe(0);
    cd.markForCheck.mockClear();
    vi.runAllTimers();
    expect(cd.markForCheck).not.toHaveBeenCalled();
    if (component instanceof TrackerBarComponent)
      expect(component.transitionsEnabled).toBe(false);
  }
);
it('cancels the clipboard message timeout', async () => {
  const cd = { markForCheck: vi.fn() };
  const c: any = new ClipboardComponent(cd as any);
  c.text = 'fixture';
  vi.spyOn(c, 'copyToClipboard').mockResolvedValue(undefined);
  await c.copyText();
  expect(c.showMessage).toBe(true);
  c.ngOnDestroy?.();
  expect(vi.getTimerCount()).toBe(0);
  cd.markForCheck.mockClear();
  vi.runAllTimers();
  expect(cd.markForCheck).not.toHaveBeenCalled();
});
it('does not schedule clipboard work when copying finishes after destruction', async () => {
  const cd = { markForCheck: vi.fn() };
  const c: any = new ClipboardComponent(cd as any);
  let resolve!: () => void;
  c.text = 'fixture';
  vi.spyOn(c, 'copyToClipboard').mockReturnValue(
    new Promise<void>((done) => (resolve = done))
  );
  const pending = c.copyText();
  c.ngOnDestroy?.();
  resolve();
  await pending;
  expect(vi.getTimerCount()).toBe(0);
  expect(c.showMessage).toBe(false);
  expect(cd.markForCheck).not.toHaveBeenCalled();
});
it('cancels deferred code-template layout and replaces a previous layout timer', () => {
  const container = { style: { height: '' }, isConnected: true };
  const content = { clientHeight: 100, isConnected: true };
  vi.stubGlobal('window', {
    innerWidth: 800,
    location: 'http://localhost/#endpoint',
    setTimeout,
  });
  vi.stubGlobal('document', {
    querySelector: (selector: string) =>
      selector.endsWith('.endpoint-content') ? content : container,
  });
  const c: any = new CodeTemplateComponent({ env: {} } as any);
  c.adjustContainerHeight(null);
  c.adjustContainerHeight(null);
  expect(vi.getTimerCount()).toBe(1);
  c.ngOnDestroy?.();
  expect(vi.getTimerCount()).toBe(0);
  vi.runAllTimers();
  expect(container.style.height).toBe('');
});
