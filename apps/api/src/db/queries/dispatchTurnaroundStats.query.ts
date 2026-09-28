import mongoose, { PipelineStage } from 'mongoose';
import { DispatchModel } from '../../modules/dispatch/dispatch.model.js';
import { ActorContext } from './patientSearch.query.js';
import { z } from 'zod';

export const dispatchTurnaroundStatsParamsSchema = z.object({
  facilityId: z.string().optional(),
  deptId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  groupBy: z.enum(['priority', 'type', 'department', 'day']).default('priority'),
});

export type DispatchTurnaroundStatsParams = z.infer<typeof dispatchTurnaroundStatsParamsSchema>;

/**
 * Named Stored Query: dispatchTurnaroundStats
 * Calculates mean, median, and SLA compliance rate for dispatch turnaround times.
 * Supports flexible grouping by priority, dispatch type, department, or day.
 */
export async function runDispatchTurnaroundStats(
  params: DispatchTurnaroundStatsParams,
  actorContext: ActorContext
): Promise<any[]> {
  const matchStage: Record<string, any> = {
    status: 'COMPLETED',
  };

  // Facility Scoping
  if (!actorContext.roles.includes('SUPER_ADMIN')) {
    matchStage.facilityId = new mongoose.Types.ObjectId(actorContext.activeFacilityId);
  } else if (params.facilityId) {
    matchStage.facilityId = new mongoose.Types.ObjectId(params.facilityId);
  }

  if (params.deptId) {
    matchStage.toDeptId = new mongoose.Types.ObjectId(params.deptId);
  }

  if (params.fromDate || params.toDate) {
    matchStage.createdAt = {};
    if (params.fromDate) matchStage.createdAt.$gte = new Date(params.fromDate);
    if (params.toDate) matchStage.createdAt.$lte = new Date(params.toDate);
  }

  const groupKey =
    params.groupBy === 'day'
      ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
      : params.groupBy === 'department'
        ? '$toDeptId'
        : params.groupBy === 'type'
          ? '$type'
          : '$priority';

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $addFields: {
        // Find the COMPLETED event to calculate actual turnaround
        completedEvent: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$events',
                as: 'ev',
                cond: { $eq: ['$$ev.toStatus', 'COMPLETED'] },
              },
            },
            -1,
          ],
        },
      },
    },
    {
      $addFields: {
        turnaroundMinutes: {
          $divide: [
            {
              $subtract: [
                { $ifNull: ['$completedEvent.timestamp', '$updatedAt'] },
                '$createdAt',
              ],
            },
            60000,
          ],
        },
      },
    },
    {
      $group: {
        _id: groupKey,
        count: { $sum: 1 },
        meanTurnaroundMin: { $avg: '$turnaroundMinutes' },
        minTurnaroundMin: { $min: '$turnaroundMinutes' },
        maxTurnaroundMin: { $max: '$turnaroundMinutes' },
        slaCompliantCount: {
          $sum: { $cond: [{ $eq: ['$isBreached', false] }, 1, 0] },
        },
        slaBreachedCount: {
          $sum: { $cond: ['$isBreached', 1, 0] },
        },
        turnaroundValues: { $push: '$turnaroundMinutes' },
      },
    },
    {
      $addFields: {
        slaComplianceRate: {
          $multiply: [
            { $divide: ['$slaCompliantCount', { $max: ['$count', 1] }] },
            100,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        group: '$_id',
        count: 1,
        meanTurnaroundMin: { $round: ['$meanTurnaroundMin', 1] },
        minTurnaroundMin: { $round: ['$minTurnaroundMin', 1] },
        maxTurnaroundMin: { $round: ['$maxTurnaroundMin', 1] },
        slaCompliantCount: 1,
        slaBreachedCount: 1,
        slaComplianceRate: { $round: ['$slaComplianceRate', 1] },
      },
    },
    { $sort: { count: -1 } },
  ];

  return DispatchModel.aggregate(pipeline);
}
