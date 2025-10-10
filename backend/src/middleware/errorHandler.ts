import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log' })
  ]
});

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  const isProduction = process.env.NODE_ENV === 'production';

  // Sanitize request body to remove sensitive data before logging
  const sanitizedBody = req.body ? { ...req.body } : {};
  if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
  if (sanitizedBody.currentPassword) sanitizedBody.currentPassword = '[REDACTED]';
  if (sanitizedBody.newPassword) sanitizedBody.newPassword = '[REDACTED]';

  // Sanitize headers to remove authorization tokens
  const sanitizedHeaders = req.headers ? { ...req.headers } : {};
  if (sanitizedHeaders.authorization) sanitizedHeaders.authorization = '[REDACTED]';
  if (sanitizedHeaders.cookie) sanitizedHeaders.cookie = '[REDACTED]';

  // Log full error details (always logged regardless of environment)
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: sanitizedBody,
    headers: sanitizedHeaders,
    statusCode
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if ((err as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Rate limiting error
  if (err.message.includes('Too many requests')) {
    statusCode = 429;
    message = 'Too many requests, please try again later';
  }

  // LLM API errors
  if (err.message.includes('OpenAI') || err.message.includes('Anthropic')) {
    statusCode = 502;
    message = 'External API error';
  }

  // Database connection errors
  if (err.message.includes('ECONNREFUSED') || err.message.includes('connection')) {
    statusCode = 503;
    message = 'Service temporarily unavailable. Please try again later.';
  }

  // In production, sanitize 500 errors to prevent information leakage
  if (isProduction && statusCode === 500 && !message.match(/^(Registration failed|Login failed|Password update failed|Failed to generate SQL|Query execution failed|Failed to fetch|Query validation failed|Unable to generate SQL)/)) {
    message = 'An unexpected error occurred. Please try again later.';
  }

  // Build response
  const errorResponse: any = {
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Only include stack trace in development
  if (!isProduction) {
    errorResponse.stack = err.stack;
    errorResponse.details = err.message; // Original message in dev
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const createError = (statusCode: number, message: string): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  return error;
};