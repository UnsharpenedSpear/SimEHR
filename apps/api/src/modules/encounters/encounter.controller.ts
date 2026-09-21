import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { EncounterModel } from './encounter.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export class EncounterController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const encounters = await EncounterModel.find({ patientId: req.params.patientId })
        .populate('attendingId', 'name professional')
        .sort({ start: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: encounters });
    } catch (err) {
      next(err);
    }
  }

  static async createEncounter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const encounter = await EncounterModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        attendingId: req.body.attendingId || req.user!.id,
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'ENCOUNTER_CREATE',
        resourceType: 'Encounter',
        resourceId: encounter._id.toString(),
        patientId: encounter.patientId.toString(),
        facilityId: encounter.facilityId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { type: encounter.type, reason: encounter.reasonForVisit },
      });

      res.status(201).json({ status: 'SUCCESS', data: encounter });
    } catch (err) {
      next(err);
    }
  }

  static async updateDisposition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const encounter = await EncounterModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: req.body.status,
            disposition: req.body.disposition,
            end: req.body.status === 'FINISHED' ? new Date() : undefined,
          },
        },
        { new: true }
      );

      if (!encounter) throw new NotFoundError('Encounter not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'ENCOUNTER_DISCHARGE',
        resourceType: 'Encounter',
        resourceId: encounter._id.toString(),
        patientId: encounter.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: req.body,
      });

      res.status(200).json({ status: 'SUCCESS', data: encounter });
    } catch (err) {
      next(err);
    }
  }
}
