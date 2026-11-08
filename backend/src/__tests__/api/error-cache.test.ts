import { Request, Response } from 'express';
import { handleError } from '../../utils/api';

describe('error response caching', () => {
  test.each([500, 502, 503, 599])('prevents caching status %i in JSON and text', (status) => {
    for (const json of [true, false]) {
      const headers = new Map([
        ['Expires', 'future'],
        ['Cache-Control', 'public'],
      ]);
      const res = {
        removeHeader: jest.fn((key) => headers.delete(key)),
        setHeader: jest.fn((key, value) => headers.set(key, value)),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(),
      };
      handleError(
        { accepts: () => json } as unknown as Request,
        res as unknown as Response,
        status,
        'Failed to get blocks'
      );
      expect(headers.has('Expires')).toBe(false);
      expect(headers.get('Cache-Control')).toBe('no-store');
      expect(headers.get('X-Accel-Expires')).toBe('0');
      expect(res.status).toHaveBeenCalledWith(status);
      if (json) {expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get blocks' });}
      else {expect(res.send).toHaveBeenCalledWith('Failed to get blocks');}
    }
  });

  test('leaves client error caching unchanged', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), removeHeader: jest.fn(), setHeader: jest.fn() };
    handleError({ accepts: () => true } as unknown as Request, res as unknown as Response, 400, 'Invalid input');
    expect(res.removeHeader).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
