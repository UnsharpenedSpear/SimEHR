import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { InvoiceModel, getNextInvoiceNumber } from './invoice.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ValidationError } from '../../middleware/error.middleware.js';
import { INVOICE_STATUSES } from '@ehr/shared';

export class BillingController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = {};

      if (req.query.patientId) filter.patientId = req.query.patientId;
      if (req.query.facilityId) filter.facilityId = req.query.facilityId;
      if (req.query.status) filter.status = req.query.status;

      const invoices = await InvoiceModel.find(filter)
        .populate('patientId', 'mrn name dob sex')
        .populate('encounterId', 'type status period')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: invoices });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await InvoiceModel.findById(req.params.id)
        .populate('patientId', 'mrn name dob sex contact address')
        .populate('encounterId')
        .populate('payments.recordedBy', 'name professional')
        .lean();

      if (!invoice) throw new NotFoundError('Invoice not found');

      res.status(200).json({ status: 'SUCCESS', data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lineItems } = req.body;
      const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0);
      const taxAmount = req.body.taxAmount || 0;
      const totalAmount = subtotal + taxAmount;
      const invoiceNumber = await getNextInvoiceNumber();

      const invoice = await InvoiceModel.create({
        ...req.body,
        invoiceNumber,
        subtotal,
        taxAmount,
        totalAmount,
        amountPaid: 0,
        balanceDue: totalAmount,
        status: INVOICE_STATUSES.ISSUED,
        payments: [],
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'INVOICE_CREATE',
        resourceType: 'Invoice',
        resourceId: invoice._id.toString(),
        patientId: invoice.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { invoiceNumber, totalAmount, itemsCount: lineItems.length },
      });

      res.status(201).json({ status: 'SUCCESS', data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, method, referenceNumber, notes } = req.body;
      const invoice = await InvoiceModel.findById(req.params.id);

      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.balanceDue <= 0) {
        throw new ValidationError('Invoice has already been fully settled');
      }

      const payment = {
        amount,
        method,
        referenceNumber,
        notes,
        recordedAt: new Date(),
        recordedBy: new mongoose.Types.ObjectId(req.user!.id),
      };

      invoice.payments.push(payment);
      invoice.amountPaid += amount;
      invoice.balanceDue = Math.max(0, invoice.totalAmount - invoice.amountPaid);

      if (invoice.balanceDue === 0) {
        invoice.status = INVOICE_STATUSES.PAID;
      } else {
        invoice.status = INVOICE_STATUSES.PARTIALLY_PAID;
      }

      await invoice.save();

      await AuditService.log({
        actorId: req.user!.id,
        action: 'INVOICE_PAYMENT_RECORD',
        resourceType: 'Invoice',
        resourceId: invoice._id.toString(),
        patientId: invoice.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { paymentAmount: amount, newBalance: invoice.balanceDue, status: invoice.status },
      });

      res.status(200).json({ status: 'SUCCESS', data: invoice });
    } catch (err) {
      next(err);
    }
  }
}
