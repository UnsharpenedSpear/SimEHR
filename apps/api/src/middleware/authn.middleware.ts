import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './error.middleware.js';

export interface UserTokenPayload {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  facilityIds: string[];
  activeFacilityId: string;
  professional?: {
    licenseNo?: string;
    specialty?: string;
    npi?: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    next(new UnauthorizedError('Authentication token missing or invalid'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as UserTokenPayload;
    req.user = decoded;

    // Optional override of activeFacilityId from X-Facility-Id header if authorized
    const customFacilityId = req.headers['x-facility-id'] as string;
    if (customFacilityId && req.user.facilityIds.includes(customFacilityId)) {
      req.user.activeFacilityId = customFacilityId;
    }

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Session expired, please refresh token'));
      return;
    }
    next(new UnauthorizedError('Invalid authentication token signature'));
  }
}
