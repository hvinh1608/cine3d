import { Response } from 'express';

export function isStorageFullError(error: unknown) {
  const details = error instanceof Error ? `${error.message} ${error}` : String(error);
  return details.includes('53100') || details.includes('project size limit');
}

export function internalError(res: Response, message: string, error: unknown, status = 500) {
  console.error(message, error);
  const details = error instanceof Error ? error.message : String(error);
  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' ? { error: details } : {}),
  });
}
