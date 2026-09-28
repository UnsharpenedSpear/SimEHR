import { Request, Response, NextFunction } from 'express';
import { VitalsModel, calculateBMI, evaluateVitalsFlags } from './vitals.model.js';
import { getVitalsTrend } from '../../db/queries/vitalsTrend.query.js';
import { AuditService } from '../audit/audit.service.js';

export class VitalsController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vitals = await VitalsModel.find({ patientId: req.params.patientId })
        .populate('recordedBy', 'name professional')
        .sort({ recordedAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: vitals });
    } catch (err) {
      next(err);
    }
  }

  static async getTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trends = await getVitalsTrend(req.params.patientId as string);
      res.status(200).json({ status: 'SUCCESS', data: trends });
    } catch (err) {
      next(err);
    }
  }

  static async recordVitals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bmi = calculateBMI(req.body.weightKg, req.body.heightCm);
      const abnormalFlags = evaluateVitalsFlags(req.body);

      const vitals = await VitalsModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        recordedBy: req.user!.id,
        bmi,
        abnormalFlags,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'VITALS_RECORD',
        resourceType: 'Vitals',
        resourceId: vitals._id.toString(),
        patientId: vitals.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { bp: vitals.bp, hr: vitals.hr, flags: abnormalFlags },
      });

      res.status(201).json({ status: 'SUCCESS', data: vitals });
    } catch (err) {
      next(err);
    }
  }
}
