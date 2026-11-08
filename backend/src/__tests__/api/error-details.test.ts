import { safeErrorDetails } from '../../utils/error-details';

test('bounds and sanitises exception fields without serializing upstream data', () => {
  const error = Object.assign(
    new Error(
      'RPC failed https://user:password@host/path?token=abc password="hello world" Authorization: Bearer hidden\n token=private'
    ),
    {
      code: 'ECONNRESET',
      response: { data: 'never log this' },
    }
  );
  const details = safeErrorDetails(error);
  expect(details.code).toBe('ECONNRESET');
  expect(details.name).toBe('Error');
  expect(details.message).toContain('RPC failed');
  for (const secret of ['user:', 'hello world', 'hidden', 'private', 'never log', '\n']) {
    expect(JSON.stringify(details)).not.toContain(secret);
  }
  expect(safeErrorDetails(new Error('x'.repeat(1000))).message).toHaveLength(256);
  expect(safeErrorDetails({ message: 'private' })).toEqual({ name: 'UnknownError' });
});
