import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden - Insufficient permissions', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict with current state', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

/**
 * RFC 7807 compliant error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || (req.headers['x-request-id'] as string) || 'unknown';

  if (err instanceof ZodError || err.name === 'ZodError') {
    const issues = (err as ZodError).issues || (err as ZodError).errors || [];
    res.status(422).json({
      type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
      title: 'Validation Error',
      status: 422,
      code: 'VALIDATION_ERROR',
      detail: 'The payload provided failed schema validation.',
      instance: req.originalUrl,
      correlationId,
      errors: issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, correlationId, path: req.path }, 'Application error encountered');
    }

    res.status(err.statusCode).json({
      type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
      title: err.name || 'Application Error',
      status: err.statusCode,
      code: err.code,
      detail: err.message,
      instance: req.originalUrl,
      correlationId,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Mongoose CastError or Duplicate key error
  if (err.name === 'CastError') {
    res.status(400).json({
      type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
      title: 'Invalid Identifier',
      status: 400,
      code: 'INVALID_ID',
      detail: 'Invalid entity identifier format.',
      instance: req.originalUrl,
      correlationId,
    });
    return;
  }

  if ('code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({
      type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
      title: 'Duplicate Key Conflict',
      status: 409,
      code: 'DUPLICATE_KEY',
      detail: 'A record with unique field values already exists.',
      instance: req.originalUrl,
      correlationId,
    });
    return;
  }

  // Unhandled / 500 Internal Error
  logger.error({ err, correlationId, path: req.path }, 'Unhandled server exception');

  res.status(500).json({
    type: 'https://tools.ietf.org/html/rfc7807#section-3.1',
    title: 'Internal Server Error',
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    detail: env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    instance: req.originalUrl,
    correlationId,
  });
}
