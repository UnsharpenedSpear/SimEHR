import mongoose, { PipelineStage } from 'mongoose';
import { ActorContext } from './patientSearch.query.js';
import { z } from 'zod';

export const unacknowledgedCriticalResultsParamsSchema = z.object({
  facilityId: z.string().optional(),
  minutesThreshold: z.number().int().min(1).max(240).default(30),
  limit: z.number().int().min(1).max(100).default(50),
});

export type UnacknowledgedCriticalResultsParams = z.infer<
  typeof unacknowledgedCriticalResultsParamsSchema
>;

/**
 * Named Stored Query: unacknowledgedCriticalResults
 * Identifies critical lab results that have not been acknowledged by the ordering
 * physician within the SLA threshold. Used by BullMQ escalation sweeper and dashboards.
 */
export async function runUnacknowledgedCriticalResults(
  params: UnacknowledgedCriticalResultsParams,
  actorContext: ActorContext
): Promise<any[]> {
  // Import dynamically to avoid circular deps at module init
  const { LabResultModel } = await import('../../modules/diagnostics/labResult.model.js');

  const thresholdDate = new Date(Date.now() - params.minutesThreshold * 60 * 1000);

  const matchStage: Record<string, any> = {
    hasCriticalFlags: true,
    acknowledgedAt: { $exists: false },
    resultedAt: { $lte: thresholdDate },
  };

  // Facility Scoping
  if (!actorContext.roles.includes('SUPER_ADMIN')) {
    matchStage.facilityId = new mongoose.Types.ObjectId(actorContext.activeFacilityId);
  } else if (params.facilityId) {
    matchStage.facilityId = new mongoose.Types.ObjectId(params.facilityId);
  }

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientId',
        foreignField: '_id',
        as: 'patient',
        pipeline: [
          {
            $project: {
              mrn: 1,
              'name.given': 1,
              'name.family': 1,
              'flags.vip': 1,
              'flags.restricted': 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: '$patient', preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'order',
        pipeline: [
          {
            $project: {
              clinicianId: 1,
              type: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'order.clinicianId',
        foreignField: '_id',
        as: 'orderingPhysician',
        pipeline: [{ $project: { 'name.given': 1, 'name.family': 1, email: 1 } }],
      },
    },
    { $unwind: { path: '$orderingPhysician', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        minutesSinceResult: {
          $divide: [{ $subtract: ['$$NOW', '$resultedAt'] }, 60000],
        },
        criticalValues: {
          $filter: {
            input: { $ifNull: ['$analytes', []] },
            as: 'analyte',
            cond: { $eq: ['$$analyte.flag', 'CRITICAL'] },
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        orderId: 1,
        patientId: 1,
        patientMrn: '$patient.mrn',
        patientName: '$patient.name',
        patientFlags: '$patient.flags',
        orderingPhysicianName: '$orderingPhysician.name',
        orderingPhysicianEmail: '$orderingPhysician.email',
        criticalValues: 1,
        resultedAt: 1,
        minutesSinceResult: 1,
        testName: 1,
        specimenId: 1,
      },
    },
    { $sort: { minutesSinceResult: -1 } },
    { $limit: params.limit },
  ];

  return LabResultModel.aggregate(pipeline);
}
