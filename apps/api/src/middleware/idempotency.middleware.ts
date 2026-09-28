import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.js';
import { ConflictError } from './error.middleware.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours
const IDEMPOTENCY_LOCK_TTL_MS = 30000; // 30-second processing lock

/**
 * Idempotency Middleware
 * 
 * Enforces exactly-once semantics for mutating requests (POST/PUT) that supply
 * an `Idempotency-Key` header. Designed for order creation, prescription submission,
 * and other non-idempotent operations where duplicate network retries must not
 * create duplicate resources.
 * 
 * Protocol:
 * 1. If no Idempotency-Key → pass through unchanged (optional opt-in).
 * 2. If key is PROCESSING → 409 Conflict (another request with same key is in-flight).
 * 3. If key has a DONE response cached → return cached response immediately.
 * 4. Otherwise → set key to PROCESSING, run handler, cache result, set DONE.
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  // Only enforce on state-changing methods
  if (!idempotencyKey || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
    next();
    return;
  }

  const redisKey = `idempotency:${idempotencyKey}`;
  const redis = getRedisClient();

  // Async IIFE to allow async/await in middleware
  (async () => {
    try {
      const existing = await redis.get(redisKey);

      if (existing) {
        const parsed = JSON.parse(existing);

        if (parsed.status === 'PROCESSING') {
          // Another identical request is currently being processed
          next(
            new ConflictError(
              `Idempotency-Key "${idempotencyKey}" is already being processed. ` +
                'Please wait and retry if the original request did not complete.'
            )
          );
          return;
        }

        if (parsed.status === 'DONE') {
          // Return the cached response from the original successful request
          res.status(parsed.statusCode).json(parsed.body);
          return;
        }
      }

      // Mark as PROCESSING with short TTL to prevent stale locks
      await redis.set(
        redisKey,
        JSON.stringify({ status: 'PROCESSING' }),
        'EX',
        Math.ceil(IDEMPOTENCY_LOCK_TTL_MS / 1000)
      );

      // Intercept res.json() to cache the response body before sending
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        const statusCode = res.statusCode;

        // Only cache successful responses (2xx)
        if (statusCode >= 200 && statusCode < 300) {
          redis
            .set(
              redisKey,
              JSON.stringify({ status: 'DONE', statusCode, body }),
              'EX',
              IDEMPOTENCY_TTL_SECONDS
            )
            .catch(() => {
              // Non-fatal: if Redis fails to cache, just proceed
            });
        } else {
          // On failure, remove the PROCESSING lock so the client can retry
          redis.del(redisKey).catch(() => {});
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      // If Redis is unavailable, fall through gracefully (fail-open)
      next();
    }
  })();
}
