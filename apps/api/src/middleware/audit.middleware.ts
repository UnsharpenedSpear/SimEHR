import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../modules/audit/audit.service.js';
import { logger } from '../config/logger.js';

export interface AuditMiddlewareOptions {
  action: string;
  resourceType: string;
  /**
   * Optional function to extract the resourceId from the request.
   * Defaults to checking req.params.id or req.params[:resourceType]Id.
   */
  getResourceId?: (req: Request) => string | undefined;
  /**
   * Optional function to extract the patientId from the request.
   */
  getPatientId?: (req: Request) => string | undefined;
  /**
   * If true, audit log is written even when the response status is 4xx.
   * Useful for logging denied access attempts.
   * @default true
   */
  logOnFailure?: boolean;
  /**
   * Only log requests with these HTTP methods. Defaults to all mutating methods.
   */
  methods?: string[];
}

/**
 * Audit Middleware Factory
 * 
 * Creates an Express middleware that auto-captures tamper-evident audit log entries
 * after each request completes. The audit record includes actor identity, IP address,
 * correlation ID, resource identifiers, and HTTP outcome code.
 *
 * Usage:
 *   router.post('/:id/sign', authenticate, authorize('note:sign'), auditLog({
 *     action: 'NOTE_SIGNED',
 *     resourceType: 'ClinicalNote',
 *   }), controller.signNote);
 */
export function auditLog(options: AuditMiddlewareOptions) {
  const {
    action,
    resourceType,
    getResourceId,
    getPatientId,
    logOnFailure = true,
    methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!methods.includes(req.method)) {
      next();
      return;
    }

    const startTime = Date.now();

    // Intercept the response finish event to capture outcome
    res.on('finish', () => {
      const user = req.user;
      if (!user) return; // Skip unauthenticated requests (auth failures handled separately)

      const statusCode = res.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      const isClientError = statusCode >= 400 && statusCode < 500;

      // Determine outcome
      let outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
      if (isSuccess) {
        outcome = 'SUCCESS';
      } else if (statusCode === 403 || statusCode === 401) {
        outcome = 'DENIED';
      } else {
        outcome = 'FAILURE';
      }

      if (!logOnFailure && !isSuccess) return;

      // Extract resource identifiers
      const resourceId: string | undefined = getResourceId
        ? getResourceId(req)
        : ((req.params.id as string | undefined) ||
            ((req.params as Record<string, string | undefined>)[`${resourceType.toLowerCase()}Id`]) ||
            undefined);

      const patientId: string | undefined = getPatientId
        ? getPatientId(req)
        : ((req.params.patientId as string | undefined) || (req.body?.patientId as string | undefined) || undefined);

      // Fire-and-forget: audit logging must not block the response
      AuditService.log({
        actorId: user.id,
        action,
        resourceType,
        resourceId,
        patientId,
        facilityId: user.activeFacilityId,
        outcome,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: {
          method: req.method,
          path: req.path,
          statusCode,
          durationMs: Date.now() - startTime,
        },
      }).catch((err) => {
        // Audit failures are logged but must not crash the application
        logger.error({ err, action, resourceType }, 'Audit log write failed');
      });
    });

    next();
  };
}

/**
 * Convenience: Audit middleware for read operations (GET requests).
 * Only logs access to sensitive resources like restricted patient charts.
 */
export function auditReadAccess(options: Omit<AuditMiddlewareOptions, 'methods'>) {
  return auditLog({ ...options, methods: ['GET'] });
}
