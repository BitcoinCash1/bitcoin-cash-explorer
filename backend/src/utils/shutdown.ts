/** Tracks background work independently of HTTP connections during shutdown. */
export class Shutdown {
  public stopping = false;
  private active = new Set<Promise<void>>();

  public async run(work: () => Promise<void>): Promise<void> {
    if (this.stopping) return;
    // Register before invoking work, including work that starts nested jobs.
    const pending = Promise.resolve().then(work);
    this.active.add(pending);
    try {
      await pending;
    } finally {
      this.active.delete(pending);
    }
  }

  public stop(): void {
    this.stopping = true;
  }

  public async drain(): Promise<void> {
    while (this.active.size) {
      await Promise.allSettled([...this.active]);
    }
  }
}

export default new Shutdown();
