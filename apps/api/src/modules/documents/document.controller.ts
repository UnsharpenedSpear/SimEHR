import { Request, Response, NextFunction } from 'express';
import { DocumentModel } from './document.model.js';
import { AuditService } from '../audit/audit.service.js';

export class DocumentController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await DocumentModel.find({ patientId: req.params.patientId })
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: docs });
    } catch (err) {
      next(err);
    }
  }

  static async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        uploadedBy: req.user!.id,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'DOCUMENT_UPLOAD',
        resourceType: 'Document',
        resourceId: doc._id.toString(),
        patientId: doc.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { filename: doc.filename, category: doc.category },
      });

      res.status(201).json({ status: 'SUCCESS', data: doc });
    } catch (err) {
      next(err);
    }
  }
}
