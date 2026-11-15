jest.unmock('../../api/memory-cache');

describe('keyed memory cache', () => {
  let cache: any;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.123Z'));
    jest.resetModules();
    cache = jest.requireActual('../../api/memory-cache').default;
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  it('replaces entries without colliding across tuple keys', () => {
    cache.set('a:b', 'c', 1, 2);
    cache.set('a', 'b:c', 2, 2);
    cache.set('a:b', 'c', 3, 2);
    cache.set('__proto__', '"[,]', 4, 2);
    expect(cache.get('a:b', 'c')).toBe(3);
    expect(cache.get('a', 'b:c')).toBe(2);
    expect(cache.get('__proto__', '"[,]')).toBe(4);
    expect(cache.cache.size).toBe(3);
  });
  it('expires exactly at the deadline before periodic cleanup', () => {
    cache.set('type', 'id', 1, 2);
    expect(cache.cache.get(JSON.stringify(['type', 'id'])).expires).toBe(Date.now() + 2000);
    jest.setSystemTime(Date.now() + 1999);
    expect(cache.get('type', 'id')).toBe(1);
    jest.setSystemTime(Date.now() + 1);
    expect(cache.get('type', 'id')).toBeNull();
    expect(cache.cache.size).toBe(0);
  });
  it('replaces the expiry and periodically removes unused expired entries', () => {
    cache.set('type', 'id', 1, 1);
    jest.advanceTimersByTime(500);
    cache.set('type', 'id', 2, 2);
    jest.advanceTimersByTime(500);
    expect(cache.get('type', 'id')).toBe(2);
    jest.advanceTimersByTime(2000);
    expect(cache.cache.size).toBe(0);
  });
  it.each([0, -1])('does not expose entries with %i seconds remaining', (expiry) => {
    cache.set('type', 'id', 1, expiry);
    expect(cache.get('type', 'id')).toBeNull();
  });
});
