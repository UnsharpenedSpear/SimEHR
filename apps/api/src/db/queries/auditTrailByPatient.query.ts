import mongoose, { PipelineStage } from 'mongoose';
import { AuditLogModel } from '../../modules/audit/auditLog.model.js';
import { ActorContext } from './patientSearch.query.js';
import { z } from 'zod';

export const auditTrailByPatientParamsSchema = z.object({
  patientId: z.string().min(1),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export type AuditTrailByPatientParams = z.infer<typeof auditTrailByPatientParamsSchema>;

/**
 * Named Stored Query: auditTrailByPatient
 * Returns the paginated, tamper-evident audit trail for a specific patient,
 * enriched with actor identity information. Used for patient-level access disclosure reports.
 */
export async function runAuditTrailByPatient(
  params: AuditTrailByPatientParams,
  actorContext: ActorContext
): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
  const matchStage: Record<string, any> = {
    patientId: new mongoose.Types.ObjectId(params.patientId),
  };

  if (params.fromDate || params.toDate) {
    matchStage.timestamp = {};
    if (params.fromDate) matchStage.timestamp.$gte = new Date(params.fromDate);
    if (params.toDate) matchStage.timestamp.$lte = new Date(params.toDate);
  }

  if (params.actorId) {
    matchStage.actorId = new mongoose.Types.ObjectId(params.actorId);
  }

  if (params.action) {
    matchStage.action = params.action;
  }

  const skip = (params.page - 1) * params.limit;

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    { $sort: { seq: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: params.limit },
          {
            $lookup: {
              from: 'users',
              localField: 'actorId',
              foreignField: '_id',
              as: 'actor',
              pipeline: [
                {
                  $project: {
                    'name.given': 1,
                    'name.family': 1,
                    email: 1,
                    roles: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              seq: 1,
              hash: 1,
              prevHash: 1,
              action: 1,
              resourceType: 1,
              resourceId: 1,
              outcome: 1,
              ip: 1,
              userAgent: 1,
              requestId: 1,
              breakGlassReason: 1,
              timestamp: 1,
              diff: 1,
              actorId: 1,
              actorName: '$actor.name',
              actorEmail: '$actor.email',
              actorRoles: '$actor.roles',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        items: 1,
        total: { $arrayElemAt: ['$totalCount.count', 0] },
      },
    },
  ];

  const [result] = await AuditLogModel.aggregate(pipeline);

  const total = result?.total || 0;
  const items = result?.items || [];

  return {
    items,
    total,
    page: params.page,
    totalPages: Math.ceil(total / params.limit),
  };
}
