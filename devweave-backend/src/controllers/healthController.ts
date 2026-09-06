import { Request, Response } from 'express';
import { env } from '../config/env.js';

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'UP',
    service: 'devweave-backend',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
