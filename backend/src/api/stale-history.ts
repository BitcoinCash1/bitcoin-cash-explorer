import { BlockExtended } from '../mempool.interfaces';

export const STALE_HISTORY_PAGE_SIZE = 25;

export interface StaleHistoryCursor {
  height: number;
  hash: string;
}

export interface StaleHistoryPage {
  entries: { stale: BlockExtended; canonical: BlockExtended | null }[];
  nextCursor: string | null;
}

export function encodeStaleHistoryCursor(cursor: StaleHistoryCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, height: cursor.height, hash: cursor.hash })).toString('base64url');
}

export function decodeStaleHistoryCursor(value: unknown): StaleHistoryCursor | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid stale history cursor');
  }
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      cursor?.v !== 1 ||
      !Number.isSafeInteger(cursor.height) ||
      cursor.height < 0 ||
      typeof cursor.hash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(cursor.hash) ||
      Object.keys(cursor).sort().join(',') !== 'hash,height,v' ||
      encodeStaleHistoryCursor(cursor) !== value
    ) {
      throw new Error();
    }
    return { height: cursor.height, hash: cursor.hash };
  } catch {
    throw new Error('Invalid stale history cursor');
  }
}
