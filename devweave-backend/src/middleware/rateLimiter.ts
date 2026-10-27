import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

export const dockerRunnerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many Docker runner heartbeat requests.',
  },
});

export const kubernetesRunnerRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many Kubernetes runner heartbeat requests.',
  },
});

export const aiChatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each client to 60 chat requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI chat requests. Please wait a moment before sending more messages.',
  },
});

export const deploymentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each client to 60 deployment requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many deployment requests. Please wait a moment before retrying.',
  },
});

