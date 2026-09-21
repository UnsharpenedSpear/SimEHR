import { Request, Response, NextFunction } from 'express';
import { ImmunizationModel } from './immunization.model.js';
import { AuditService } from '../audit/audit.service.js';

export class ImmunizationController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const imm = await ImmunizationModel.find({ patientId: req.params.patientId })
        .populate('administeredBy', 'name professional')
        .sort({ administeredAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: imm });
    } catch (err) {
      next(err);
    }
  }

  static async recordImmunization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const imm = await ImmunizationModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        administeredBy: req.user!.id,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'IMMUNIZATION_RECORD',
        resourceType: 'Immunization',
        resourceId: imm._id.toString(),
        patientId: imm.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { vaccine: imm.vaccineName, lot: imm.lot },
      });

      res.status(201).json({ status: 'SUCCESS', data: imm });
    } catch (err) {
      next(err);
    }
  }
}
