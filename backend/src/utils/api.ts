import { Request, Response } from 'express';

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
