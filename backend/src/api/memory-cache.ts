interface ICache {
  type: string;
  id: string;
  expires: Date;
  data: any;
}

class MemoryCache {
  private cache = new Map<string, ICache>();
  constructor() {
    setInterval(this.cleanup.bind(this), 1000);
  }

  public set(type: string, id: string, data: any, secondsExpiry: number) {
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + secondsExpiry);
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
    if (found && found.expires > new Date()) {
      return found.data;
    }
    this.cache.delete(key);
    return null;
  }

  private cleanup() {
    const now = new Date();
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }
  }
}

export default new MemoryCache();
