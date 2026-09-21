import mongoose, { PipelineStage } from 'mongoose';
import { EncounterModel } from '../../modules/encounters/encounter.model.js';

export async function getPatientTimeline(patientId: string, limit = 50) {
  const patientObjId = new mongoose.Types.ObjectId(patientId);

  const pipeline: PipelineStage[] = [
    { $match: { patientId: patientObjId } },
    {
      $project: {
        _id: 1,
        type: { $literal: 'ENCOUNTER' },
        timestamp: '$start',
        title: { $concat: ['Encounter: ', '$type'] },
        subtitle: '$reasonForVisit',
        status: '$status',
        meta: { diagnoses: '$diagnoses', attendingId: '$attendingId' },
      },
    },
    {
      $unionWith: {
        coll: 'clinicalnotes',
        pipeline: [
          { $match: { patientId: patientObjId } },
          {
            $project: {
              _id: 1,
              type: { $literal: 'CLINICAL_NOTE' },
              timestamp: '$createdAt',
              title: '$title',
              subtitle: { $concat: ['Template: ', '$template', ' (', '$status', ')'] },
              status: '$status',
              meta: { version: '$version', authorId: '$authorId', signedAt: '$signedAt' },
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: 'vitals',
        pipeline: [
          { $match: { patientId: patientObjId } },
          {
            $project: {
              _id: 1,
              type: { $literal: 'VITALS' },
              timestamp: '$recordedAt',
              title: { $literal: 'Vital Signs Recorded' },
              subtitle: {
                $concat: [
                  'BP: ',
                  { $toString: '$bp.systolic' },
                  '/',
                  { $toString: '$bp.diastolic' },
                  ' | HR: ',
                  { $toString: '$hr' },
                  ' | SpO2: ',
                  { $toString: '$spo2' },
                  '%',
                ],
              },
              status: { $cond: [{ $gt: [{ $size: '$abnormalFlags' }, 0] }, 'ABNORMAL', 'NORMAL'] },
              meta: { abnormalFlags: '$abnormalFlags', bmi: '$bmi' },
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: 'immunizations',
        pipeline: [
          { $match: { patientId: patientObjId } },
          {
            $project: {
              _id: 1,
              type: { $literal: 'IMMUNIZATION' },
              timestamp: '$administeredAt',
              title: { $concat: ['Vaccine: ', '$vaccineName'] },
              subtitle: { $concat: ['Dose: ', '$dose', ' | Site: ', '$site'] },
              status: { $literal: 'ADMINISTERED' },
              meta: { cvx: '$cvx', lot: '$lot' },
            },
          },
        ],
      },
    },
    { $sort: { timestamp: -1 } },
    { $limit: limit },
  ];

  return await EncounterModel.aggregate(pipeline).option({ maxTimeMS: 5000 });
}
