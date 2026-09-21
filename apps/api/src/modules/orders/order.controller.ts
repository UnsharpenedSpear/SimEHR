import { Request, Response, NextFunction } from 'express';
import { OrderModel } from './order.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../middleware/error.middleware.js';

export class OrderController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await OrderModel.find({ patientId: req.params.patientId })
        .populate('orderedBy', 'name professional')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: orders });
    } catch (err) {
      next(err);
    }
  }

  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        orderedBy: req.user!.id,
        status: 'ORDERED',
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'ORDER_CREATE',
        resourceType: 'Order',
        resourceId: order._id.toString(),
        patientId: order.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { name: order.name, type: order.type, priority: order.priority },
      });

      res.status(201).json({ status: 'SUCCESS', data: order });
    } catch (err) {
      next(err);
    }
  }

  static async signOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderModel.findById(req.params.id);
      if (!order) throw new NotFoundError('Order not found');

      if (order.isControlledSubstance && !req.body.pin) {
        throw new ForbiddenError('PIN signature is required for controlled substance orders');
      }

      order.signedAt = new Date();
      order.status = 'ORDERED';
      await order.save();

      await AuditService.log({
        actorId: req.user!.id,
        action: 'ORDER_SIGN',
        resourceType: 'Order',
        resourceId: order._id.toString(),
        patientId: order.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({ status: 'SUCCESS', data: order });
    } catch (err) {
      next(err);
    }
  }

  static async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'CANCELLED',
          },
        },
        { new: true }
      );

      if (!order) throw new NotFoundError('Order not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'ORDER_CANCEL',
        resourceType: 'Order',
        resourceId: order._id.toString(),
        patientId: order.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({ status: 'SUCCESS', data: order });
    } catch (err) {
      next(err);
    }
  }
}
