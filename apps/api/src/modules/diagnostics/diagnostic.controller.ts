import { Request, Response, NextFunction } from 'express';
import { LabResultModel, evaluateLabFlag } from './labResult.model.js';
import { ImagingReportModel } from './imagingReport.model.js';
import { OrderModel } from '../orders/order.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export class DiagnosticController {
  // --- Lab Results ---

  static async listLabResultsByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await LabResultModel.find({ patientId: req.params.patientId })
        .populate('recordedBy', 'name professional')
        .populate('verifiedBy', 'name professional')
        .populate('orderId', 'name type priority')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: results });
    } catch (err) {
      next(err);
    }
  }

  static async createLabResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawValue = req.body.value;
      const numericVal = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      const refRange = req.body.referenceRange || {};

      const flag = evaluateLabFlag(isNaN(numericVal) ? undefined : numericVal, refRange);

      const result = await LabResultModel.create({
        ...req.body,
        patientId: req.params.patientId || req.body.patientId,
        numericValue: isNaN(numericVal) ? undefined : numericVal,
        flag,
        recordedBy: req.user!.id,
      });

      // Update parent order status to COMPLETED if linked
      if (result.orderId) {
        await OrderModel.findByIdAndUpdate(result.orderId, { $set: { status: 'COMPLETED' } });
      }

      await AuditService.log({
        actorId: req.user!.id,
        action: 'LAB_RESULT_RECORD',
        resourceType: 'LabResult',
        resourceId: result._id.toString(),
        patientId: result.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { analyte: result.analyteName, value: result.value, flag: result.flag },
      });

      res.status(201).json({ status: 'SUCCESS', data: result });
    } catch (err) {
      next(err);
    }
  }

  // --- Imaging Reports ---

  static async listImagingReportsByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reports = await ImagingReportModel.find({ patientId: req.params.patientId })
        .populate('radiologistId', 'name professional')
        .populate('orderId', 'name type priority')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: reports });
    } catch (err) {
      next(err);
    }
  }

  static async getImagingReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await ImagingReportModel.findById(req.params.id)
        .populate('radiologistId', 'name professional')
        .populate('orderId')
        .lean();

      if (!report) throw new NotFoundError('Imaging report not found');

      res.status(200).json({ status: 'SUCCESS', data: report });
    } catch (err) {
      next(err);
    }
  }

  static async createImagingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accessionNumber = req.body.accessionNumber || `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const report = await ImagingReportModel.create({
        ...req.body,
        accessionNumber,
        patientId: req.params.patientId || req.body.patientId,
        radiologistId: req.user!.id,
        signedAt: new Date(),
        status: 'FINAL',
      });

      // Update parent order status to COMPLETED
      if (report.orderId) {
        await OrderModel.findByIdAndUpdate(report.orderId, { $set: { status: 'COMPLETED' } });
      }

      await AuditService.log({
        actorId: req.user!.id,
        action: 'IMAGING_REPORT_RECORD',
        resourceType: 'ImagingReport',
        resourceId: report._id.toString(),
        patientId: report.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { modality: report.modality, isCritical: report.isCritical },
      });

      res.status(201).json({ status: 'SUCCESS', data: report });
    } catch (err) {
      next(err);
    }
  }
}
