import { z } from 'zod';
import mongoose, { PipelineStage } from 'mongoose';
import { PatientModel, IPatient } from '../../modules/patients/patient.model.js';
import { createBlindIndex, decryptField } from '../../utils/crypto.util.js';
import { PatientSearchQuerySchema, PatientSearchQuery } from '@ehr/shared';

export const patientSearchParamsSchema = PatientSearchQuerySchema;

export interface ActorContext {
  userId: string;
  roles: string[];
  permissions: string[];
  activeFacilityId: string;
  facilityIds: string[];
}

/**
 * Named Stored Query: patientSearch
 * Multi-criteria ranked patient search utilizing compound indexes and blind indexes for encrypted PHI
 */
export function buildPatientSearchPipeline(
  params: PatientSearchQuery,
  actorContext: ActorContext
): PipelineStage[] {
  const match: Record<string, any> = {
    status: { $ne: 'MERGED' },
  };

  // 1. Facility Scoping
  if (!actorContext.roles.includes('SUPER_ADMIN')) {
    match.facilityId = new mongoose.Types.ObjectId(actorContext.activeFacilityId);
  } else if (params.facilityId) {
    match.facilityId = new mongoose.Types.ObjectId(params.facilityId);
  }

  // 2. Specific search criteria
  if (params.mrn) {
    match.mrn = params.mrn.trim().toUpperCase();
  } else if (params.query) {
    const q = params.query.trim();
    const isDigitsOnly = /^\d+$/.test(q);

    if (q.toUpperCase().startsWith('FAC-') || q.toUpperCase().startsWith('MRN-')) {
      match.mrn = q.toUpperCase();
    } else if (isDigitsOnly && q.length >= 7) {
      // Treat as phone or national ID blind index search
      const bIndex = createBlindIndex(q);
      match.$or = [
        { 'contact.phones.blindIndex': bIndex },
        { 'identifiers.blindIndex': bIndex },
      ];
    } else {
      // Prefix search on normalized searchName
      const normalizedQuery = q.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      match.searchName = { $regex: `^${normalizedQuery}|\\s${normalizedQuery}`, $options: 'i' };
    }
  }

  if (params.dob) {
    match.dob = params.dob;
  }
  if (params.gender) {
    match.sex = params.gender.toUpperCase();
  }

  // 3. Cursor pagination
  if (params.cursor) {
    try {
      const [cursorDate, cursorId] = Buffer.from(params.cursor, 'base64').toString('ascii').split('_');
      if (cursorDate && cursorId) {
        match._id = { $lt: new mongoose.Types.ObjectId(cursorId) };
      }
    } catch {
      // Invalid cursor ignored
    }
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: params.limit + 1 }, // Fetch 1 extra to determine next cursor
  ];

  // 4. Role-based minimum-necessary field projection
  const isClinicalRole = actorContext.roles.some((r) => ['PHYSICIAN', 'NURSE', 'SUPER_ADMIN'].includes(r));
  if (!isClinicalRole) {
    pipeline.push({
      $project: {
        mrn: 1,
        name: 1,
        dob: 1,
        sex: 1,
        contact: 1,
        insurance: 1,
        status: 1,
        flags: 1,
        facilityId: 1,
        createdAt: 1,
        // Clinical details omitted for non-clinical roles
      },
    });
  }

  return pipeline;
}

export async function runPatientSearch(
  params: PatientSearchQuery,
  actorContext: ActorContext
): Promise<{ patients: any[]; nextCursor?: string }> {
  const pipeline = buildPatientSearchPipeline(params, actorContext);
  const rawResults = await PatientModel.aggregate(pipeline).option({ maxTimeMS: 5000 });

  const hasNextPage = rawResults.length > params.limit;
  const patients = hasNextPage ? rawResults.slice(0, params.limit) : rawResults;

  // Decrypt encrypted fields for authorized output
  const decryptedPatients = patients.map((p) => {
    return {
      ...p,
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
  });

  let nextCursor: string | undefined;
  if (hasNextPage && patients.length > 0) {
    const lastItem = patients[patients.length - 1];
    nextCursor = Buffer.from(`${new Date(lastItem.createdAt).toISOString()}_${lastItem._id}`).toString('base64');
  }

  return { patients: decryptedPatients, nextCursor };
}
