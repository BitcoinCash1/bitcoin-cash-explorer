import { apiErrorHandler, parseNonnegativeInteger } from '../../utils/api';

it.each(['', '-1', '1.5', '1x', 'NaN', 'Infinity', '9007199254740992', ['1'], {}])('rejects malformed integer %j', value => {
  expect(parseNonnegativeInteger(value)).toBeNull();
});
it.each(['0', '1', '001', '9007199254740991'])('accepts complete nonnegative integer %s', value => {
  expect(parseNonnegativeInteger(value)).toBe(Number(value));
});
it('enforces inclusive upper bounds', () => {
  expect(parseNonnegativeInteger('10', 10)).toBe(10);
  expect(parseNonnegativeInteger('11', 10)).toBeNull();
});
it.each([400, 413, 500])('formats final HTTP errors and protects server errors from caching (%i)', status => {
  const res: any = { headersSent: false, removeHeader: jest.fn(), setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  apiErrorHandler({ status, message: 'private details' }, { accepts: () => true } as any, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(status);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('private details');
  if (status === 500) expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
it('delegates errors once headers have been sent', () => {
  const error = new Error('late'); const next = jest.fn();
  apiErrorHandler(error, {} as any, { headersSent: true } as any, next);
  expect(next).toHaveBeenCalledWith(error);
});
