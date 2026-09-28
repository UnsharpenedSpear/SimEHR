import mongoose, { PipelineStage } from 'mongoose';
import { OrderModel } from '../../modules/orders/order.model.js';
import { ActorContext } from './patientSearch.query.js';
import { z } from 'zod';

export const overdueOrdersParamsSchema = z.object({
  facilityId: z.string().optional(),
  hoursThreshold: z.number().int().min(1).max(168).default(24),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(),
  orderType: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export type OverdueOrdersParams = z.infer<typeof overdueOrdersParamsSchema>;

/**
 * Named Stored Query: overdueOrders
 * Finds signed orders that have not been dispatched or fulfilled within the
 * expected SLA threshold. Used by the BullMQ sweeper and clinical oversight dashboards.
 */
export async function runOverdueOrders(
  params: OverdueOrdersParams,
  actorContext: ActorContext
): Promise<any[]> {
  const thresholdDate = new Date(Date.now() - params.hoursThreshold * 60 * 60 * 1000);

  const matchStage: Record<string, any> = {
    status: { $in: ['SIGNED', 'ACTIVE'] },
    createdAt: { $lte: thresholdDate },
  };

  // Facility Scoping
  if (!actorContext.roles.includes('SUPER_ADMIN')) {
    matchStage.facilityId = new mongoose.Types.ObjectId(actorContext.activeFacilityId);
  } else if (params.facilityId) {
    matchStage.facilityId = new mongoose.Types.ObjectId(params.facilityId);
  }

  if (params.priority) {
    matchStage.priority = params.priority;
  }
  if (params.orderType) {
    matchStage.type = params.orderType;
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
        from: 'users',
        localField: 'clinicianId',
        foreignField: '_id',
        as: 'clinician',
        pipeline: [{ $project: { 'name.given': 1, 'name.family': 1, email: 1 } }],
      },
    },
    { $unwind: { path: '$clinician', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        overdueHours: {
          $divide: [{ $subtract: ['$$NOW', '$createdAt'] }, 3600000],
        },
        urgencyScore: {
          $switch: {
            branches: [
              { case: { $eq: ['$priority', 'STAT'] }, then: 3 },
              { case: { $eq: ['$priority', 'URGENT'] }, then: 2 },
            ],
            default: 1,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        type: 1,
        description: 1,
        priority: 1,
        status: 1,
        createdAt: 1,
        overdueHours: 1,
        urgencyScore: 1,
        patientId: 1,
        patientMrn: '$patient.mrn',
        patientName: '$patient.name',
        clinicianName: '$clinician.name',
        clinicianEmail: '$clinician.email',
      },
    },
    { $sort: { urgencyScore: -1, overdueHours: -1 } },
    { $limit: params.limit },
  ];

  return OrderModel.aggregate(pipeline);
}
