import { Request, Response, NextFunction } from 'express';
import { PatientService } from './patient.service.js';
import { ActorContext } from '../../db/queries/patientSearch.query.js';

function getActorContext(req: Request): ActorContext {
  const user = req.user!;
  return {
    userId: user.id,
    roles: user.roles,
    permissions: user.permissions,
    activeFacilityId: user.activeFacilityId || user.facilityIds[0],
    facilityIds: user.facilityIds,
  };
}

export class PatientController {
  static async createPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = getActorContext(req);
      const patient = await PatientService.createPatient(req.body, actor, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(201).json({
        status: 'SUCCESS',
        data: patient,
      });
    } catch (err) {
      next(err);
    }
  }

  static async searchPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = getActorContext(req);
      const result = await PatientService.search(req.query as any, actor, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({
        status: 'SUCCESS',
        data: result.patients,
        meta: {
          nextCursor: result.nextCursor,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async checkDuplicates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidates = await PatientService.checkDuplicates(req.body);
      res.status(200).json({
        status: 'SUCCESS',
        data: candidates,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPatientById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = getActorContext(req);
      const patient = await PatientService.getById(req.params.id, actor, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({
        status: 'SUCCESS',
        data: patient,
      });
    } catch (err) {
      next(err);
    }
  }

  static async breakGlass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = getActorContext(req);
      const patient = await PatientService.breakGlass(req.params.id, req.body.reason, actor, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({
        status: 'SUCCESS',
        data: patient,
      });
    } catch (err) {
      next(err);
    }
  }

  static async mergePatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = getActorContext(req);
      const result = await PatientService.mergePatients(
        req.params.id,
        req.body.targetPatientId,
        req.body.reason,
        actor,
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: req.headers['x-correlation-id'] as string,
        }
      );

      res.status(200).json({
        status: 'SUCCESS',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
