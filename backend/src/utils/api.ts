import { STATUS_CODES } from 'http';
import logger from '../logger';
import { NextFunction, Request, Response } from 'express';

export function handleError(req: Request, res: Response, statusCode: number, errorMessage: string | unknown): void {
  // Success headers may already exist when lookup or serialization fails.
  if (statusCode >= 500 && statusCode <= 599) {
    res.removeHeader('Expires');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Expires', '0');
  }
  if (req.accepts('json')) {
    res.status(statusCode).json({ error: errorMessage });
  } else {
    res.status(statusCode).send(errorMessage);
  }
}

export function parseNonnegativeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export function apiErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) logger.err(`Unhandled error on ${req.method} ${req.path}: ${error?.stack ?? error}`);
  handleError(req, res, status, STATUS_CODES[status] ?? 'Internal Server Error');
}
