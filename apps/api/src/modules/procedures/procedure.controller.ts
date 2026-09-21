import { Request, Response, NextFunction } from 'express';
import { ProcedureModel } from './procedure.model.js';
import { ProcedureCatalogModel } from './procedureCatalog.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../middleware/error.middleware.js';
import { PROCEDURE_CATEGORIES, PERMISSIONS, SYSTEM_ROLES } from '@ehr/shared';

export class ProcedureController {
  static async listCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const catalog = await ProcedureCatalogModel.find({ active: true }).sort({ category: 1, name: 1 }).lean();
      res.status(200).json({ status: 'SUCCESS', data: catalog });
    } catch (err) {
      next(err);
    }
  }

  static async createCatalogItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await ProcedureCatalogModel.create(req.body);
      res.status(201).json({ status: 'SUCCESS', data: item });
    } catch (err) {
      next(err);
    }
  }

  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const procedures = await ProcedureModel.find({ patientId: req.params.patientId })
        .populate('performedBy', 'name professional')
        .sort({ performedAt: -1, createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: procedures });
    } catch (err) {
      next(err);
    }
  }

  static async recordProcedure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = req.body.category;
      const user = req.user!;

      // Role check: Surgical procedures require Physician / Surgical permission
      if (category === PROCEDURE_CATEGORIES.SURGICAL) {
        if (!user.roles.includes(SYSTEM_ROLES.PHYSICIAN) && !user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
          throw new ForbiddenError('Only licensed physicians can perform and record surgical procedures');
        }
      }

      const procedure = await ProcedureModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        performedBy: req.body.performedBy || [user.id],
      });

      await AuditService.log({
        actorId: user.id,
        action: 'PROCEDURE_RECORD',
        resourceType: 'Procedure',
        resourceId: procedure._id.toString(),
        patientId: procedure.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { code: procedure.code, name: procedure.name, category: procedure.category },
      });

      res.status(201).json({ status: 'SUCCESS', data: procedure });
    } catch (err) {
      next(err);
    }
  }

  static async completeProcedure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proc = await ProcedureModel.findById(req.params.id);
      if (!proc) throw new NotFoundError('Procedure not found');

      if (proc.status === 'COMPLETED') {
        throw new ConflictError('Procedure is already completed and immutable');
      }

      proc.status = 'COMPLETED';
      proc.performedAt = new Date();
      proc.notes = req.body.notes || proc.notes;
      proc.outcome = req.body.outcome || proc.outcome;
      await proc.save();

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PROCEDURE_COMPLETE',
        resourceType: 'Procedure',
        resourceId: proc._id.toString(),
        patientId: proc.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { status: 'COMPLETED', performedAt: proc.performedAt },
      });

      res.status(200).json({ status: 'SUCCESS', data: proc });
    } catch (err) {
      next(err);
    }
  }

  static async markInError(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proc = await ProcedureModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'ENTERED_IN_ERROR',
            notes: req.body.reason ? `ENTERED IN ERROR: ${req.body.reason}` : 'ENTERED IN ERROR',
          },
        },
        { new: true }
      );

      if (!proc) throw new NotFoundError('Procedure not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PROCEDURE_ENTERED_IN_ERROR',
        resourceType: 'Procedure',
        resourceId: proc._id.toString(),
        patientId: proc.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { reason: req.body.reason },
      });

      res.status(200).json({ status: 'SUCCESS', data: proc });
    } catch (err) {
      next(err);
    }
  }
}
