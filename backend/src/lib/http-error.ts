import { Response } from 'express';

export function internalError(res: Response, message: string, error: unknown, status = 500) {
  console.error(message, error);
  const details = error instanceof Error ? error.message : String(error);
  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' ? { error: details } : {}),
  });
}
