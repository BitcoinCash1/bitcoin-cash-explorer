/** Own delayed component work, including callbacks scheduled by another callback. */
export class ComponentTimers {
  private readonly pending = new Set<ReturnType<typeof setTimeout>>();
  private destroyed = false;

  schedule(callback: () => void, delay = 0): void {
    if (this.destroyed) return;
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      if (!this.destroyed) callback();
    }, delay);
    this.pending.add(timer);
  }

  destroy(): void {
    this.destroyed = true;
    for (const timer of this.pending) clearTimeout(timer);
    this.pending.clear();
  }
}
