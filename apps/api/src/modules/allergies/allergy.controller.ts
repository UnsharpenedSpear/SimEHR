import { Request, Response, NextFunction } from 'express';
import { AllergyModel } from './allergy.model.js';
import { AuditService } from '../audit/audit.service.js';

export class AllergyController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allergies = await AllergyModel.find({ patientId: req.params.patientId })
        .sort({ severity: -1, createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: allergies });
    } catch (err) {
      next(err);
    }
  }

  static async createAllergy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allergy = await AllergyModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        recordedBy: req.user!.id,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'ALLERGY_RECORD',
        resourceType: 'Allergy',
        resourceId: allergy._id.toString(),
        patientId: allergy.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { substance: allergy.substance, severity: allergy.severity },
      });

      res.status(201).json({ status: 'SUCCESS', data: allergy });
    } catch (err) {
      next(err);
    }
  }
}
