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

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    headers: req.headers
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
    message = 'Database connection error';
  }

  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
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