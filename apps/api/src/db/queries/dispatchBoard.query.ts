import mongoose, { PipelineStage } from 'mongoose';
import { DispatchModel } from '../../modules/dispatch/dispatch.model.js';
import { ActorContext } from './patientSearch.query.js';
import { z } from 'zod';

export const dispatchBoardParamsSchema = z.object({
  toDeptId: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(),
  facilityId: z.string().optional(),
});

export type DispatchBoardParams = z.infer<typeof dispatchBoardParamsSchema>;

/**
 * Named Stored Query: dispatchBoard
 * Returns dispatch items grouped by department with SLA countdown metadata,
 * patient demographics, and ordering clinician for Kanban board rendering.
 */
export async function runDispatchBoard(
  params: DispatchBoardParams,
  actorContext: ActorContext
): Promise<any> {
  const matchStage: Record<string, any> = {
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  };

  // Facility Scoping
  if (!actorContext.roles.includes('SUPER_ADMIN')) {
    matchStage.facilityId = new mongoose.Types.ObjectId(actorContext.activeFacilityId);
  } else if (params.facilityId) {
    matchStage.facilityId = new mongoose.Types.ObjectId(params.facilityId);
  }

  if (params.toDeptId) {
    matchStage.toDeptId = new mongoose.Types.ObjectId(params.toDeptId);
  }
  if (params.status) {
    matchStage.status = params.status;
  }
  if (params.priority) {
    matchStage.priority = params.priority;
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
            },
          },
        ],
      },
    },
    { $unwind: { path: '$patient', preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: 'departments',
        localField: 'toDeptId',
        foreignField: '_id',
        as: 'toDept',
        pipeline: [{ $project: { name: 1, code: 1 } }],
      },
    },
    { $unwind: { path: '$toDept', preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'order',
        pipeline: [{ $project: { type: 1, description: 1, clinicianId: 1 } }],
      },
    },
    { $unwind: { path: '$order', preserveNullAndEmptyArrays: false } },
    {
      $addFields: {
        slaRemainingMs: {
          $subtract: ['$slaDueAt', '$$NOW'],
        },
        slaRemainingMinutes: {
          $divide: [{ $subtract: ['$slaDueAt', '$$NOW'] }, 60000],
        },
        isCritical: { $eq: ['$priority', 'STAT'] },
      },
    },
    {
      $group: {
        _id: '$toDeptId',
        departmentName: { $first: '$toDept.name' },
        departmentCode: { $first: '$toDept.code' },
        items: {
          $push: {
            _id: '$_id',
            orderId: '$orderId',
            patientId: '$patientId',
            patientMrn: '$patient.mrn',
            patientName: '$patient.name',
            type: '$type',
            status: '$status',
            priority: '$priority',
            isBreached: '$isBreached',
            isCritical: '$isCritical',
            slaRemainingMinutes: '$slaRemainingMinutes',
            slaDueAt: '$slaDueAt',
            orderType: '$order.type',
            orderDescription: '$order.description',
            notes: '$notes',
            createdAt: '$createdAt',
          },
        },
        totalCount: { $sum: 1 },
        breachedCount: { $sum: { $cond: ['$isBreached', 1, 0] } },
        statCount: { $sum: { $cond: [{ $eq: ['$priority', 'STAT'] }, 1, 0] } },
      },
    },
    { $sort: { breachedCount: -1, statCount: -1, departmentName: 1 } },
  ];

  return DispatchModel.aggregate(pipeline);
}
