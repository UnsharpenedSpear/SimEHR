import { Request, Response, NextFunction } from 'express';
import { AuditLogModel } from './auditLog.model.js';
import { AuditService } from './audit.service.js';

export class AuditController {
  static async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId, actorId, action, breakGlassOnly, limit = 50 } = req.query;

      const query: any = {};
      if (patientId) query.patientId = patientId;
      if (actorId) query.actorId = actorId;
      if (action) query.action = action;
      if (breakGlassOnly === 'true') {
        query['breakGlass.reason'] = { $exists: true, $ne: null };
      }

      const logs = await AuditLogModel.find(query)
        .sort({ seq: -1 })
        .limit(Number(limit))
        .lean();

      res.status(200).json({
        status: 'SUCCESS',
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyAuditChain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await AuditService.verifyChainIntegrity();
      res.status(200).json({
        status: 'SUCCESS',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPatientAccessReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await AuditLogModel.find({ patientId: req.params.id })
        .sort({ seq: -1 })
        .lean();

      res.status(200).json({
        status: 'SUCCESS',
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  }
}
