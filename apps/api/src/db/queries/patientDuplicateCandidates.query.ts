import mongoose, { PipelineStage } from 'mongoose';
import { PatientModel } from '../../modules/patients/patient.model.js';
import { createBlindIndex } from '../../utils/crypto.util.js';

export interface DuplicateCheckParams {
  family: string;
  given: string[];
  dob: string;
  phone?: string;
  facilityId: string;
}

export function buildDuplicateCandidatesPipeline(params: DuplicateCheckParams): PipelineStage[] {
  const phoneBlindIndex = params.phone ? createBlindIndex(params.phone) : null;
  const familyNorm = params.family.trim().toLowerCase();

  const matchConditions: any[] = [
    // 1. Exact DOB match
    { dob: params.dob },
    // 2. Exact family name match
    { searchName: { $regex: `^${familyNorm}`, $options: 'i' } },
  ];

  if (phoneBlindIndex) {
    matchConditions.push({ 'contact.phones.blindIndex': phoneBlindIndex });
  }

  return [
    {
      $match: {
        facilityId: new mongoose.Types.ObjectId(params.facilityId),
        status: { $ne: 'MERGED' },
        $or: matchConditions,
      },
    },
    {
      $addFields: {
        dobScore: { $cond: [{ $eq: ['$dob', params.dob] }, 50, 0] },
        nameScore: {
          $cond: [
            { $regexMatch: { input: '$searchName', regex: `^${familyNorm}`, options: 'i' } },
            40,
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        matchScore: { $add: ['$dobScore', '$nameScore'] },
      },
    },
    {
      $match: {
        matchScore: { $gte: 40 }, // At least 40% match confidence
      },
    },
    { $sort: { matchScore: -1 } },
    { $limit: 5 },
    {
      $project: {
        mrn: 1,
        name: 1,
        dob: 1,
        sex: 1,
        matchScore: 1,
        createdAt: 1,
      },
    },
  ];
}

export async function findDuplicateCandidates(params: DuplicateCheckParams) {
  const pipeline = buildDuplicateCandidatesPipeline(params);
  return await PatientModel.aggregate(pipeline).option({ maxTimeMS: 5000 });
}
