import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  });
};

// General API rate limiter
export const rateLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  'Too many requests from this IP, please try again later'
);

// Strict rate limiter for LLM endpoints
export const llmRateLimiter = createRateLimiter(
  900000, // 15 minutes
  20, // 20 requests per 15 minutes
  'Too many LLM requests, please try again later'
);

// Relaxed rate limiter for read-only endpoints
export const readOnlyRateLimiter = createRateLimiter(
  900000, // 15 minutes
  200, // 200 requests per 15 minutes
  'Too many read requests, please try again later'
);

// Very strict rate limiter for expensive operations
export const expensiveOperationLimiter = createRateLimiter(
  3600000, // 1 hour
  10, // 10 requests per hour
  'Too many expensive operations, please try again later'
);