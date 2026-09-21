import { Request, Response, NextFunction } from 'express';
import { ProblemModel } from './problem.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export class ProblemController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const problems = await ProblemModel.find({ patientId: req.params.patientId })
        .sort({ status: 1, createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: problems });
    } catch (err) {
      next(err);
    }
  }

  static async createProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const problem = await ProblemModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        recordedBy: req.user!.id,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PROBLEM_CREATE',
        resourceType: 'Problem',
        resourceId: problem._id.toString(),
        patientId: problem.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { icd10: problem.icd10, description: problem.description },
      });

      res.status(201).json({ status: 'SUCCESS', data: problem });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const problem = await ProblemModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: req.body.status,
            resolvedAt: req.body.status === 'RESOLVED' ? new Date().toISOString() : undefined,
          },
        },
        { new: true }
      );

      if (!problem) throw new NotFoundError('Problem not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PROBLEM_STATUS_UPDATE',
        resourceType: 'Problem',
        resourceId: problem._id.toString(),
        patientId: problem.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { newStatus: req.body.status },
      });

      res.status(200).json({ status: 'SUCCESS', data: problem });
    } catch (err) {
      next(err);
    }
  }
}
