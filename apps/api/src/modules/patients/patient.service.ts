import mongoose from 'mongoose';
import { PatientModel, IPatient } from './patient.model.js';
import { getNextMRN } from './counter.model.js';
import { AuditService } from '../audit/audit.service.js';
import { encryptField, decryptField, createBlindIndex } from '../../utils/crypto.util.js';
import { runPatientSearch, ActorContext } from '../../db/queries/patientSearch.query.js';
import { findDuplicateCandidates } from '../../db/queries/patientDuplicateCandidates.query.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../../middleware/error.middleware.js';
import { CreatePatientInput, UpdatePatientInput, PatientSearchQuery, SYSTEM_ROLES } from '@ehr/shared';

export class PatientService {
  /**
   * Register a new patient with automatic MRN generation, encryption, and blind indexing
   */
  static async createPatient(input: CreatePatientInput, actor: ActorContext, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    // 1. Normalize searchName
    const searchName = `${input.name.family} ${input.name.given.join(' ')}`
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '');

    // 2. Encrypt sensitive fields and create blind indexes
    const encryptedIdentifiers = input.identifiers.map((ident) => ({
      type: ident.type,
      value: encryptField(ident.value),
      issuer: ident.issuer,
      blindIndex: createBlindIndex(ident.value),
    }));

    const encryptedPhones = input.contact.phones.map((phone, idx) => ({
      value: encryptField(phone),
      blindIndex: createBlindIndex(phone),
      isPrimary: idx === 0,
    }));

    const encryptedEmail = input.contact.email
      ? {
          value: encryptField(input.contact.email),
          blindIndex: createBlindIndex(input.contact.email),
        }
      : undefined;

    const encryptedAddress = {
      ...input.address,
      street: encryptField(input.address.street),
    };

    // 3. Atomically acquire next MRN
    const mrn = await getNextMRN('FAC');

    // 4. Create patient record
    const patient = await PatientModel.create({
      mrn,
      facilityId: new mongoose.Types.ObjectId(input.facilityId),
      name: input.name,
      searchName,
      dob: input.dob,
      sex: input.sex,
      genderIdentity: input.genderIdentity,
      identifiers: encryptedIdentifiers,
      contact: {
        phones: encryptedPhones,
        email: encryptedEmail,
      },
      address: encryptedAddress,
      emergencyContacts: input.emergencyContacts,
      guardian: input.guardian,
      insurance: input.insurance,
      preferredLanguage: input.preferredLanguage,
      flags: input.flags,
      codeStatus: input.codeStatus,
      isolationFlags: input.isolationFlags,
      status: 'ACTIVE',
    });

    // 5. Audit Log
    await AuditService.log({
      actorId: actor.userId,
      action: 'PATIENT_CREATE',
      resourceType: 'Patient',
      resourceId: patient._id.toString(),
      patientId: patient._id.toString(),
      facilityId: input.facilityId,
      outcome: 'SUCCESS',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      requestId: meta?.requestId,
      diff: { mrn: patient.mrn, name: patient.name, dob: patient.dob },
    });

    return this.decryptPatient(patient.toObject());
  }

  /**
   * Search patients using the named query pipeline
   */
  static async search(query: PatientSearchQuery, actor: ActorContext, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    const result = await runPatientSearch(query, actor);

    await AuditService.log({
      actorId: actor.userId,
      action: 'PATIENT_SEARCH',
      resourceType: 'Patient',
      facilityId: actor.activeFacilityId,
      outcome: 'SUCCESS',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      requestId: meta?.requestId,
      diff: { query: query.query || query.mrn || query.name, count: result.patients.length },
    });

    return result;
  }

  /**
   * Check for duplicate candidates before registration
   */
  static async checkDuplicates(params: { family: string; given: string[]; dob: string; phone?: string; facilityId: string }) {
    return await findDuplicateCandidates(params);
  }

  /**
   * Retrieve single patient by ID with ABAC evaluation
   */
  static async getById(patientId: string, actor: ActorContext, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    const patient = await PatientModel.findById(patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient record not found');
    }

    if (patient.status === 'MERGED') {
      throw new ConflictError(`This record was merged into patient ID: ${patient.mergedInto}`);
    }

    // ABAC Facility Check
    if (!actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      const patientFac = patient.facilityId.toString();
      if (!actor.facilityIds.includes(patientFac)) {
        throw new ForbiddenError('You are not authorized to view patient records from this facility');
      }
    }

    // ABAC Restricted Record / VIP check
    if (patient.flags?.restricted && !actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      // Check if user is in care team
      const isInCareTeam = patient.careTeam?.some((c) => c.userId.toString() === actor.userId);
      if (!isInCareTeam) {
        // Return restricted notice that triggers the break-glass modal on client
        return {
          isRestricted: true,
          id: patient._id,
          mrn: patient.mrn,
          name: patient.name,
          dob: patient.dob,
          sex: patient.sex,
          flags: patient.flags,
          message: 'This record is restricted. Break-glass authorization required.',
        };
      }
    }

    // Log access
    await AuditService.log({
      actorId: actor.userId,
      action: 'PATIENT_READ',
      resourceType: 'Patient',
      resourceId: patient._id.toString(),
      patientId: patient._id.toString(),
      facilityId: patient.facilityId.toString(),
      outcome: 'SUCCESS',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      requestId: meta?.requestId,
    });

    return this.decryptPatient(patient);
  }

  /**
   * Break-glass emergency override access
   */
  static async breakGlass(patientId: string, reason: string, actor: ActorContext, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    const patient = await PatientModel.findById(patientId);
    if (!patient) throw new NotFoundError('Patient record not found');

    // Add actor to care team temporarily
    patient.careTeam.push({
      userId: new mongoose.Types.ObjectId(actor.userId),
      role: actor.roles[0] || 'Clinician',
      from: new Date(),
    });
    await patient.save();

    await AuditService.log({
      actorId: actor.userId,
      action: 'PATIENT_BREAK_GLASS',
      resourceType: 'Patient',
      resourceId: patient._id.toString(),
      patientId: patient._id.toString(),
      facilityId: patient.facilityId.toString(),
      outcome: 'SUCCESS',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      requestId: meta?.requestId,
      breakGlassReason: reason,
      diff: { reason, overriddenAt: new Date().toISOString() },
    });

    return this.decryptPatient(patient.toObject());
  }

  /**
   * Merge two patient records inside a MongoDB multi-document transaction
   */
  static async mergePatients(sourcePatientId: string, targetPatientId: string, reason: string, actor: ActorContext, meta?: { ip?: string; userAgent?: string; requestId?: string }) {
    if (sourcePatientId === targetPatientId) {
      throw new BadRequestError('Source and target patient cannot be the same');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const source = await PatientModel.findById(sourcePatientId).session(session);
      const target = await PatientModel.findById(targetPatientId).session(session);

      if (!source || !target) {
        throw new NotFoundError('One or both patient records not found');
      }

      if (source.status === 'MERGED') {
        throw new ConflictError('Source patient record is already merged');
      }

      // Mark source as merged
      source.status = 'MERGED';
      source.mergedInto = target._id;
      await source.save({ session });

      // Audit entry within transaction
      await AuditService.log({
        actorId: actor.userId,
        action: 'PATIENT_MERGE',
        resourceType: 'Patient',
        resourceId: source._id.toString(),
        patientId: target._id.toString(),
        facilityId: target.facilityId.toString(),
        outcome: 'SUCCESS',
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
        diff: {
          sourceMrn: source.mrn,
          targetMrn: target.mrn,
          reason,
        },
      });

      await session.commitTransaction();
      return { success: true, targetPatientId: target._id, sourcePatientId: source._id };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Helper to decrypt sensitive fields
   */
  private static decryptPatient(p: any) {
    return {
      ...p,
      id: p._id?.toString() || p.id,
      identifiers: p.identifiers?.map((ident: any) => ({
        ...ident,
        value: decryptField(ident.value),
      })),
      contact: {
        ...p.contact,
        phones: p.contact?.phones?.map((ph: any) => ({
          ...ph,
          value: decryptField(ph.value),
        })),
        email: p.contact?.email ? { ...p.contact.email, value: decryptField(p.contact.email.value) } : undefined,
      },
      address: p.address
        ? {
            ...p.address,
            street: decryptField(p.address.street),
          }
        : undefined,
    };
  }
}
