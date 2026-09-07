import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { env } from '../config/env.js';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error encountered:', err);

  if (err instanceof ZodError) {
    const errorMessages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    let message = 'File upload error.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File exceeds the 5 MB per-file limit.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Cannot upload more than 100 files at once.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field in upload payload.';
    } else {
      message = `Upload limit exceeded: ${err.message}`;
    }
    res.status(400).json({
      success: false,
      message,
    });
    return;
  }

  const errObj = err as unknown as { type?: string; statusCode?: number; status?: number; message?: string };
  if (errObj.type === 'entity.too.large' || errObj.statusCode === 413 || errObj.status === 413) {
    res.status(413).json({
      success: false,
      message: 'Total upload size exceeds the allowed limit.',
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  const statusCode = errObj.statusCode || errObj.status || 500;
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
  });
}
