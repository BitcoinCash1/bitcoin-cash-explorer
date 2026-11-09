/** One history RPC at a time, isolated from balance/transaction traffic. */
export class HistoryBusyError extends Error {
  readonly status = 503;
  readonly code = 'ADDRESS_HISTORY_BUSY';
}
interface Work {
  run: () => void;
  count: boolean;
}
interface Shared {
  promise: Promise<unknown>;
  signals: (AbortSignal | undefined)[];
  join: (signal?: AbortSignal) => void;
}
export class HistoryCoordinator {
  private active = false;
  private queue: Work[] = [];
  private pending = new Map<string, Shared>();
  private cache = new Map<string, { expires: number; value: unknown }>();
  request<T>(key: string, operation: () => Promise<T>, count = false, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(new HistoryBusyError('Request cancelled'));
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(structuredClone(cached.value) as T);
    const pending = this.pending.get(key);
    if (pending) {
      pending.join(signal);
      return pending.promise.then((value) => structuredClone(value) as T);
    }
    if (this.active && this.queue.length >= 32) return Promise.reject(new HistoryBusyError('History queue is full'));
    const signals: (AbortSignal | undefined)[] = [];
    const cleanup: (() => void)[] = [];
    let rejectWork: (error: Error) => void;
    let work: Work;
    const cancel = () => {
      if (!signals.every((waiter) => waiter?.aborted)) return;
      const index = this.queue.indexOf(work);
      if (index >= 0) {
        this.queue.splice(index, 1);
        rejectWork(new HistoryBusyError('Request cancelled'));
      }
    };
    const join = (waiter?: AbortSignal) => {
      signals.push(waiter);
      if (waiter) {
        waiter.addEventListener('abort', cancel, { once: true });
        cleanup.push(() => waiter.removeEventListener('abort', cancel));
      }
    };
    join(signal);
    const result = new Promise<T>((resolve, reject) => {
      rejectWork = reject;
      work = {
        count,
        run: () => {
          this.active = true;
          if (signals.every((waiter) => waiter?.aborted)) {
            reject(new HistoryBusyError('Request cancelled'));
            this.next();
            return;
          }
          Promise.resolve()
            .then(operation)
            .then((value) => {
              for (const [cachedKey, entry] of this.cache)
                if (entry.expires <= Date.now()) this.cache.delete(cachedKey);
              if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
              if (!Array.isArray(value) || value.length <= 2000) {
                const entry = { expires: Date.now() + 2000, value: structuredClone(value) };
                this.cache.set(key, entry);
                const timer = setTimeout(() => {
                  if (this.cache.get(key) === entry) this.cache.delete(key);
                }, 2000);
                timer.unref();
              }
              resolve(value);
            }, reject)
            .finally(() => this.next());
        },
      };
      if (this.active) this.queue.push(work);
      else work.run();
    });
    this.pending.set(key, { promise: result, signals, join });
    const finish = () => {
      this.pending.delete(key);
      for (const remove of cleanup) remove();
    };
    void result.then(finish, finish);
    return result.then((value) => structuredClone(value));
  }
  private next(): void {
    this.active = false;
    const interactive = this.queue.findIndex((entry) => !entry.count);
    this.queue.splice(interactive < 0 ? 0 : interactive, 1)[0]?.run();
  }
}
