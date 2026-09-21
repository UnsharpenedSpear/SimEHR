import { Request, Response, NextFunction } from 'express';
import { PrescriptionModel } from './prescription.model.js';
import { InteractionService } from './interaction.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ConflictError, ValidationError } from '../../middleware/error.middleware.js';

export class PrescriptionController {
  static async listByPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prescriptions = await PrescriptionModel.find({ patientId: req.params.patientId })
        .populate('prescribedBy', 'name professional')
        .populate('verifiedBy', 'name professional')
        .populate('dispensedBy', 'name professional')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({ status: 'SUCCESS', data: prescriptions });
    } catch (err) {
      next(err);
    }
  }

  static async checkInteractions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId, drugName } = req.body;
      const targetPatientId = req.params.patientId || patientId;
      const warnings = await InteractionService.evaluateInteractions(targetPatientId, drugName);
      res.status(200).json({ status: 'SUCCESS', data: warnings });
    } catch (err) {
      next(err);
    }
  }

  static async createPrescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetPatientId = req.params.patientId || req.body.patientId;
      const drugName = req.body.drug?.name;

      // Evaluate drug-drug and drug-allergy interactions
      const warnings = await InteractionService.evaluateInteractions(targetPatientId, drugName);
      const hasMajorConflict = warnings.some((w) => w.severity === 'MAJOR');

      if (hasMajorConflict && !req.body.overrideWarningReason) {
        res.status(409).json({
          status: 'WARNING_OVERRIDE_REQUIRED',
          code: 'CLINICAL_INTERACTION_CONFLICT',
          detail: 'Critical drug interaction or allergy conflict detected. Override reason is mandatory.',
          warnings,
        });
        return;
      }

      const prescription = await PrescriptionModel.create({
        ...req.body,
        patientId: targetPatientId,
        prescribedBy: req.user!.id,
        interactionWarnings: warnings,
        status: 'ACTIVE',
      });

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PRESCRIPTION_PRESCRIBE',
        resourceType: 'Prescription',
        resourceId: prescription._id.toString(),
        patientId: prescription.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: {
          drug: prescription.drug.name,
          dosage: prescription.dosage,
          warningsCount: warnings.length,
          overridden: !!req.body.overrideWarningReason,
        },
      });

      res.status(201).json({ status: 'SUCCESS', data: prescription });
    } catch (err) {
      next(err);
    }
  }

  static async verifyPrescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rx = await PrescriptionModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'VERIFIED',
            verifiedBy: req.user!.id,
          },
        },
        { new: true }
      );

      if (!rx) throw new NotFoundError('Prescription not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PRESCRIPTION_VERIFY',
        resourceType: 'Prescription',
        resourceId: rx._id.toString(),
        patientId: rx.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({ status: 'SUCCESS', data: rx });
    } catch (err) {
      next(err);
    }
  }

  static async dispensePrescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rx = await PrescriptionModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'DISPENSED',
            dispensedBy: req.user!.id,
          },
        },
        { new: true }
      );

      if (!rx) throw new NotFoundError('Prescription not found');

      await AuditService.log({
        actorId: req.user!.id,
        action: 'PRESCRIPTION_DISPENSE',
        resourceType: 'Prescription',
        resourceId: rx._id.toString(),
        patientId: rx.patientId.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { dispensedLot: req.body.lotNumber, qty: req.body.quantityDispensed },
      });

      res.status(200).json({ status: 'SUCCESS', data: rx });
    } catch (err) {
      next(err);
    }
  }
}
