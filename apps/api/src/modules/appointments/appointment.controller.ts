import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppointmentModel } from './appointment.model.js';
import { EncounterModel } from '../encounters/encounter.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ConflictError } from '../../middleware/error.middleware.js';
import { APPOINTMENT_STATUSES } from '@ehr/shared';

export class AppointmentController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = {};

      if (req.query.patientId) filter.patientId = req.query.patientId;
      if (req.query.providerId) filter.providerId = req.query.providerId;
      if (req.query.facilityId) filter.facilityId = req.query.facilityId;
      if (req.query.departmentId) filter.departmentId = req.query.departmentId;
      if (req.query.status) filter.status = req.query.status;

      if (req.query.startDate || req.query.endDate) {
        filter.start = {};
        if (req.query.startDate) (filter.start as any).$gte = new Date(req.query.startDate as string);
        if (req.query.endDate) (filter.start as any).$lte = new Date(req.query.endDate as string);
      }

      const appointments = await AppointmentModel.find(filter)
        .populate('patientId', 'mrn name dob sex contact')
        .populate('providerId', 'name professional')
        .populate('departmentId', 'name code location')
        .sort({ start: 1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: appointments });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointment = await AppointmentModel.findById(req.params.id)
        .populate('patientId', 'mrn name dob sex contact flags')
        .populate('providerId', 'name professional')
        .populate('departmentId', 'name code location')
        .populate('encounterId')
        .lean();

      if (!appointment) throw new NotFoundError('Appointment not found');

      res.status(200).json({ status: 'SUCCESS', data: appointment });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { providerId, start, end } = req.body;
      const startTime = new Date(start);
      const endTime = new Date(end);

      // Check double-booking conflicts
      const conflict = await AppointmentModel.findOne({
        providerId: new mongoose.Types.ObjectId(providerId),
        status: { $nin: [APPOINTMENT_STATUSES.CANCELLED, APPOINTMENT_STATUSES.NO_SHOW] },
        $or: [
          { start: { $lt: endTime }, end: { $gt: startTime } },
        ],
      }).session(session);

      if (conflict) {
        throw new ConflictError(
          `Provider already has an overlapping appointment scheduled between ${conflict.start.toISOString()} and ${conflict.end.toISOString()}`
        );
      }

      const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      const [appointment] = await AppointmentModel.create(
        [
          {
            ...req.body,
            start: startTime,
            end: endTime,
            durationMin,
            status: req.body.status || APPOINTMENT_STATUSES.CONFIRMED,
          },
        ],
        { session }
      );

      await AuditService.log({
        actorId: req.user!.id,
        action: 'APPOINTMENT_CREATE',
        resourceType: 'Appointment',
        resourceId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { providerId: appointment.providerId, start: appointment.start, end: appointment.end },
      });

      await session.commitTransaction();
      res.status(201).json({ status: 'SUCCESS', data: appointment });
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, cancellationReason } = req.body;
      const updateData: Record<string, unknown> = { status };

      if (cancellationReason) updateData.cancellationReason = cancellationReason;
      if (status === APPOINTMENT_STATUSES.COMPLETED) updateData.completedAt = new Date();

      const appointment = await AppointmentModel.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true }
      );

      if (!appointment) throw new NotFoundError('Appointment not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'APPOINTMENT_STATUS_UPDATE',
        resourceType: 'Appointment',
        resourceId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { status, cancellationReason },
      });

      res.status(200).json({ status: 'SUCCESS', data: appointment });
    } catch (err) {
      next(err);
    }
  }

  static async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const appointment = await AppointmentModel.findById(req.params.id).session(session);
      if (!appointment) throw new NotFoundError('Appointment not found');

      // Create linked Encounter
      const [encounter] = await EncounterModel.create(
        [
          {
            patientId: appointment.patientId,
            facilityId: appointment.facilityId,
            departmentId: appointment.departmentId,
            attendingId: appointment.providerId,
            type: 'OUTPATIENT',
            status: 'ARRIVED',
            reasonForVisit: appointment.reason,
            start: new Date(),
          },
        ],
        { session }
      );

      appointment.status = APPOINTMENT_STATUSES.CHECKED_IN;
      appointment.checkedInAt = new Date();
      appointment.encounterId = encounter._id as mongoose.Types.ObjectId;
      await appointment.save({ session });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'APPOINTMENT_CHECK_IN',
        resourceType: 'Appointment',
        resourceId: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { encounterId: encounter._id },
      });

      await session.commitTransaction();
      res.status(200).json({ status: 'SUCCESS', data: { appointment, encounter } });
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  }
}
