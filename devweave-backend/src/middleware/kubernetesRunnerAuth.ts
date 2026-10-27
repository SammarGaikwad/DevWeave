import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function authenticateKubernetesRunner(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expectedToken = env.KUBERNETES_RUNNER_TOKEN || env.DOCKER_RUNNER_TOKEN;
  const authHeader = req.headers.authorization;
  const prefix = 'Bearer ';

  if (!expectedToken || !authHeader?.startsWith(prefix)) {
    res.status(401).json({
      success: false,
      message: 'Kubernetes runner authentication required.',
    });
    return;
  }

  const suppliedToken = authHeader.slice(prefix.length).trim();

  // Hash both tokens to 32-byte digests so timingSafeEqual is always length-constant
  const expectedHash = createHash('sha256').update(expectedToken).digest();
  const suppliedHash = createHash('sha256').update(suppliedToken).digest();

  if (!timingSafeEqual(expectedHash, suppliedHash)) {
    res.status(401).json({
      success: false,
      message: 'Invalid Kubernetes runner credentials.',
    });
    return;
  }

  next();
}
