import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { standardRateLimiter } from './middleware/rateLimiter.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { roleRoutes } from './modules/roles/role.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { patientRoutes } from './modules/patients/patient.routes.js';
import { savedSearchRoutes } from './modules/saved-searches/savedSearch.routes.js';
import { encounterRoutes } from './modules/encounters/encounter.routes.js';
import { clinicalNoteRoutes } from './modules/clinical-notes/clinicalNote.routes.js';
import { vitalsRoutes } from './modules/vitals/vitals.routes.js';
import { problemRoutes } from './modules/problems/problem.routes.js';
import { allergyRoutes } from './modules/allergies/allergy.routes.js';
import { immunizationRoutes } from './modules/immunizations/immunization.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { procedureRoutes } from './modules/procedures/procedure.routes.js';
import { orderRoutes } from './modules/orders/order.routes.js';
import { prescriptionRoutes } from './modules/prescriptions/prescription.routes.js';
import { departmentRoutes } from './modules/departments/department.routes.js';
import { dispatchRoutes } from './modules/dispatch/dispatch.routes.js';
import { diagnosticRoutes } from './modules/diagnostics/diagnostic.routes.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy for secure cookies / rate-limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'If-Match', 'Idempotency-Key'],
      exposedHeaders: ['ETag', 'X-Correlation-Id'],
    })
  );

  // Rate Limiting
  app.use(standardRateLimiter);

  // Request Correlation ID & Structured Logging
  app.use((req: Request, res: Response, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  });

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req.headers['x-correlation-id'] as string) || crypto.randomUUID(),
        customLogLevel: (req, res, err) => {
          if (res.statusCode >= 500 || err) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      })
    );
  }

  // Parsers & Sanitizers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize({ replaceWith: '_' }));
  app.use(hpp());

  // Health / Liveness & Readiness Probes
  app.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', (req: Request, res: Response) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      res.status(200).json({
        status: 'READY',
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'UNAVAILABLE',
        database: 'DISCONNECTED',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Mount API v1 Routes
  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/admin/users`, userRoutes);
  app.use(`${env.API_PREFIX}/admin/roles`, roleRoutes);
  app.use(`${env.API_PREFIX}/audit`, auditRoutes);
  app.use(`${env.API_PREFIX}/patients`, patientRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/encounters`, encounterRoutes);
  app.use(`${env.API_PREFIX}/encounters`, encounterRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/notes`, clinicalNoteRoutes);
  app.use(`${env.API_PREFIX}/notes`, clinicalNoteRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/vitals`, vitalsRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/problems`, problemRoutes);
  app.use(`${env.API_PREFIX}/problems`, problemRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/allergies`, allergyRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/immunizations`, immunizationRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/documents`, documentRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/procedures`, procedureRoutes);
  app.use(`${env.API_PREFIX}/procedures`, procedureRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/orders`, orderRoutes);
  app.use(`${env.API_PREFIX}/orders`, orderRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/prescriptions`, prescriptionRoutes);
  app.use(`${env.API_PREFIX}/prescriptions`, prescriptionRoutes);
  app.use(`${env.API_PREFIX}/patients/:patientId/diagnostics`, diagnosticRoutes);
  app.use(`${env.API_PREFIX}/diagnostics`, diagnosticRoutes);
  app.use(`${env.API_PREFIX}/departments`, departmentRoutes);
  app.use(`${env.API_PREFIX}/dispatch`, dispatchRoutes);
  app.use(`${env.API_PREFIX}/saved-searches`, savedSearchRoutes);

  // Central Error Handler (RFC 7807)
  app.use(errorHandler);

  return app;
}
