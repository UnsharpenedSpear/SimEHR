import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  DispatchModel,
  VALID_DISPATCH_TRANSITIONS,
  getDefaultSlaMinutes,
} from './dispatch.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { OrderModel } from '../orders/order.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { RoutingSlipService } from './routingSlip.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ConflictError, ValidationError } from '../../middleware/error.middleware.js';
import { DISPATCH_STATUSES } from '@ehr/shared';

export class DispatchController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = {};

      if (req.query.facilityId) filter.facilityId = req.query.facilityId;
      if (req.query.patientId) filter.patientId = req.query.patientId;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.priority) filter.priority = req.query.priority;
      if (req.query.type) filter.type = req.query.type;
      if (req.query.isBreached !== undefined) filter.isBreached = req.query.isBreached === 'true';

      if (req.query.departmentId) {
        filter.$or = [{ fromDeptId: req.query.departmentId }, { toDeptId: req.query.departmentId }];
      }

      const dispatches = await DispatchModel.find(filter)
        .populate('patientId', 'mrn name dob sex')
        .populate('fromDeptId', 'name code')
        .populate('toDeptId', 'name code')
        .populate('assignedStaffId', 'name professional')
        .populate('orderId', 'name type priority indication')
        .sort({ isBreached: -1, slaDueAt: 1, createdAt: -1 })
        .limit(100)
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: dispatches });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dispatch = await DispatchModel.findById(req.params.id)
        .populate('patientId', 'mrn name dob sex flags contact')
        .populate('fromDeptId', 'name code location')
        .populate('toDeptId', 'name code location')
        .populate('assignedStaffId', 'name professional')
        .populate('orderId')
        .lean();

      if (!dispatch) throw new NotFoundError('Dispatch task not found');

      res.status(200).json({ status: 'SUCCESS', data: dispatch });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const priority = req.body.priority || 'ROUTINE';
      const slaMinutes = req.body.slaMinutes || getDefaultSlaMinutes(priority);
      const slaDueAt = new Date(Date.now() + slaMinutes * 60 * 1000);

      const initialEvent = {
        fromStatus: 'NONE',
        toStatus: DISPATCH_STATUSES.CREATED,
        timestamp: new Date(),
        actorId: new mongoose.Types.ObjectId(req.user!.id),
        reason: 'Initial dispatch request created',
      };

      const dispatch = await DispatchModel.create({
        ...req.body,
        status: DISPATCH_STATUSES.CREATED,
        slaMinutes,
        slaDueAt,
        isBreached: false,
        events: [initialEvent],
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'DISPATCH_CREATE',
        resourceType: 'Dispatch',
        resourceId: dispatch._id.toString(),
        patientId: dispatch.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: {
          type: dispatch.type,
          priority: dispatch.priority,
          fromDeptId: dispatch.fromDeptId,
          toDeptId: dispatch.toDeptId,
        },
      });

      res.status(201).json({ status: 'SUCCESS', data: dispatch });
    } catch (err) {
      next(err);
    }
  }

  static async transitionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetStatus, reason, location, meta } = req.body;
      const dispatch = await DispatchModel.findById(req.params.id);

      if (!dispatch) throw new NotFoundError('Dispatch task not found');

      const currentStatus = dispatch.status;
      const allowedTransitions = VALID_DISPATCH_TRANSITIONS[currentStatus] || [];

      if (!allowedTransitions.includes(targetStatus)) {
        throw new ConflictError(
          `Invalid state transition from ${currentStatus} to ${targetStatus}. Allowed transitions: [${allowedTransitions.join(', ')}]`
        );
      }

      // Check mandatory reason
      if (
        (targetStatus === DISPATCH_STATUSES.REJECTED ||
          targetStatus === DISPATCH_STATUSES.ON_HOLD ||
          targetStatus === DISPATCH_STATUSES.CANCELLED) &&
        (!reason || reason.trim().length === 0)
      ) {
        throw new ValidationError(`Reason is mandatory when transitioning to status ${targetStatus}`);
      }

      dispatch.status = targetStatus;
      dispatch.events.push({
        fromStatus: currentStatus,
        toStatus: targetStatus,
        timestamp: new Date(),
        actorId: new mongoose.Types.ObjectId(req.user!.id),
        reason,
        location,
        meta,
      });

      if (req.body.assignedStaffId) {
        dispatch.assignedStaffId = new mongoose.Types.ObjectId(req.body.assignedStaffId);
      }

      await dispatch.save();

      await AuditService.log({
        actorId: req.user!.id,
        action: 'DISPATCH_TRANSITION',
        resourceType: 'Dispatch',
        resourceId: dispatch._id.toString(),
        patientId: dispatch.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { from: currentStatus, to: targetStatus, reason },
      });

      res.status(200).json({ status: 'SUCCESS', data: dispatch });
    } catch (err) {
      next(err);
    }
  }

  static async batchTransition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dispatchIds, targetStatus, reason } = req.body;
      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const id of dispatchIds) {
        const dispatch = await DispatchModel.findById(id);
        if (!dispatch) {
          results.push({ id, success: false, error: 'Dispatch not found' });
          continue;
        }

        const currentStatus = dispatch.status;
        const allowedTransitions = VALID_DISPATCH_TRANSITIONS[currentStatus] || [];

        if (!allowedTransitions.includes(targetStatus)) {
          results.push({
            id,
            success: false,
            error: `Invalid transition from ${currentStatus} to ${targetStatus}`,
          });
          continue;
        }

        dispatch.status = targetStatus;
        dispatch.events.push({
          fromStatus: currentStatus,
          toStatus: targetStatus,
          timestamp: new Date(),
          actorId: new mongoose.Types.ObjectId(req.user!.id),
          reason,
        });

        await dispatch.save();
        results.push({ id, success: true });
      }

      res.status(200).json({ status: 'SUCCESS', data: { updated: results.filter((r) => r.success).length, results } });
    } catch (err) {
      next(err);
    }
  }

  static async getRoutingSlip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dispatch = await DispatchModel.findById(req.params.id);
      if (!dispatch) throw new NotFoundError('Dispatch task not found');

      const patient = await PatientModel.findById(dispatch.patientId);
      if (!patient) throw new NotFoundError('Patient not found');

      const order = await OrderModel.findById(dispatch.orderId);
      const fromDept = await DepartmentModel.findById(dispatch.fromDeptId);
      const toDept = await DepartmentModel.findById(dispatch.toDeptId);

      const pdfBuffer = await RoutingSlipService.generateRoutingSlipPdf(
        dispatch,
        patient,
        order,
        fromDept?.name,
        toDept?.name
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="routing-slip-${dispatch._id.toString()}.pdf"`
      );
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}
