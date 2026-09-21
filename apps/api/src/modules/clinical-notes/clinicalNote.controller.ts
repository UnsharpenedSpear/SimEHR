import { Request, Response, NextFunction } from 'express';
import { ClinicalNoteModel } from './clinicalNote.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../middleware/error.middleware.js';

export class ClinicalNoteController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notes = await ClinicalNoteModel.find({ patientId: req.params.patientId })
        .populate('authorId', 'name professional')
        .populate('signedBy', 'name professional')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: notes });
    } catch (err) {
      next(err);
    }
  }

  static async createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = req.body.content || req.body.sections || {};
      const note = await ClinicalNoteModel.create({
        ...req.body,
        content,
        patientId: req.params.patientId || req.body.patientId,
        authorId: req.user!.id,
        status: 'DRAFT',
        version: 1,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'NOTE_DRAFT_CREATE',
        resourceType: 'ClinicalNote',
        resourceId: note._id.toString(),
        patientId: note.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { title: note.title, template: note.template },
      });

      res.status(201).json({ status: 'SUCCESS', data: note });
    } catch (err) {
      next(err);
    }
  }

  static async signNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const note = await ClinicalNoteModel.findById(req.params.id);
      if (!note) throw new NotFoundError('Clinical note not found');

      if (note.status === 'SIGNED') {
        throw new ConflictError('This clinical note has already been signed and is immutable');
      }

      note.status = 'SIGNED';
      note.signedBy = req.user!.id as any;
      note.signedAt = new Date();
      await note.save();

      await AuditService.log({
        actorId: req.user!.id,
        action: 'NOTE_SIGN',
        resourceType: 'ClinicalNote',
        resourceId: note._id.toString(),
        patientId: note.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { status: 'SIGNED', signedAt: note.signedAt },
      });

      res.status(200).json({ status: 'SUCCESS', data: note });
    } catch (err) {
      next(err);
    }
  }

  static async amendNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const originalNote = await ClinicalNoteModel.findById(req.params.id);
      if (!originalNote) throw new NotFoundError('Clinical note not found');

      if (originalNote.status !== 'SIGNED') {
        throw new ConflictError('Only signed clinical notes can be amended');
      }

      // Mark original as amended
      originalNote.status = 'AMENDED';
      await originalNote.save();

      // Create new versioned amendment
      const amendment = await ClinicalNoteModel.create({
        patientId: originalNote.patientId,
        encounterId: originalNote.encounterId,
        template: originalNote.template,
        title: `${originalNote.title} (Addendum / Amendment v${originalNote.version + 1})`,
        content: req.body.content,
        status: 'SIGNED',
        authorId: req.user!.id,
        signedBy: req.user!.id,
        signedAt: new Date(),
        version: originalNote.version + 1,
        previousVersionId: originalNote._id,
        amendmentReason: req.body.amendmentReason,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'NOTE_AMEND',
        resourceType: 'ClinicalNote',
        resourceId: amendment._id.toString(),
        patientId: originalNote.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: {
          originalId: originalNote._id,
          amendmentReason: req.body.amendmentReason,
          version: amendment.version,
        },
      });

      res.status(201).json({ status: 'SUCCESS', data: amendment });
    } catch (err) {
      next(err);
    }
  }
}
