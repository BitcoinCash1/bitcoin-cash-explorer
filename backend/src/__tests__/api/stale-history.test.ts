import { decodeStaleHistoryCursor, encodeStaleHistoryCursor } from '../../api/stale-history';

const cursor = { height: 950000, hash: 'a'.repeat(64) };

test('stale history cursor round-trips both ordering keys', () => {
  expect(decodeStaleHistoryCursor(undefined)).toBeUndefined();
  expect(decodeStaleHistoryCursor(encodeStaleHistoryCursor(cursor))).toEqual(cursor);
  expect(decodeStaleHistoryCursor(encodeStaleHistoryCursor({ ...cursor, height: 0 }))).toEqual({
    ...cursor,
    height: 0,
  });
  expect(decodeStaleHistoryCursor(encodeStaleHistoryCursor({ ...cursor, hash: 'A'.repeat(64) }))).toEqual({
    ...cursor,
    hash: 'A'.repeat(64),
  });
});

test.each([
  '',
  '!',
  'a'.repeat(257),
  [],
  {},
  ['cursor'],
  ...[
    { v: 2, ...cursor },
    { v: 1, hash: cursor.hash },
    { v: 1, ...cursor, height: -1 },
    { v: 1, ...cursor, height: 1.5 },
    { v: 1, ...cursor, height: Number.MAX_SAFE_INTEGER + 1 },
    { v: 1, ...cursor, hash: 'xyz' },
    { v: 1, ...cursor, extra: true },
    null,
  ].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url')),
  encodeStaleHistoryCursor(cursor) + '=',
])('rejects malformed or unsupported cursor %p', (value) => {
  expect(() => decodeStaleHistoryCursor(value)).toThrow('Invalid stale history cursor');
});
