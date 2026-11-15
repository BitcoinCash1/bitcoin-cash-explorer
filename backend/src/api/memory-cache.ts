interface ICache {
  type: string;
  id: string;
  expires: number;
  data: any;
}

class MemoryCache {
  private cache = new Map<string, ICache>();
  constructor() {
    setInterval(this.cleanup.bind(this), 1000);
  }

  public set(type: string, id: string, data: any, secondsExpiry: number) {
    const expiry = Date.now() + secondsExpiry * 1000;
    this.cache.set(JSON.stringify([type, id]), {
      type: type,
      id: id,
      data: data,
      expires: expiry,
    });
  }

  public get<T>(type: string, id: string): T | null {
    const key = JSON.stringify([type, id]);
    const found = this.cache.get(key);
    if (found && found.expires > Date.now()) {
      return found.data;
    }
    this.cache.delete(key);
    return null;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }
  }
}

export default new MemoryCache();
