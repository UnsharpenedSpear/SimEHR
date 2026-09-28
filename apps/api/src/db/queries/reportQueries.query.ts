import mongoose, { PipelineStage } from 'mongoose';
import { PatientModel } from '../../modules/patients/patient.model.js';
import { EncounterModel } from '../../modules/encounters/encounter.model.js';
import { DispatchModel } from '../../modules/dispatch/dispatch.model.js';
import { InvoiceModel } from '../../modules/billing/invoice.model.js';
import { ActorContext } from './patientSearch.query.js';
import { z } from 'zod';

export const reportQueriesParamsSchema = z.object({
  reportKey: z.enum([
    'topDiagnoses',
    'procedureVolumeByCategory',
    'patientRegistrationTrend',
    'revenueByMonth',
    'encounterTypeDistribution',
    'admissionDischargeRatio',
  ]),
  facilityId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type ReportQueriesParams = z.infer<typeof reportQueriesParamsSchema>;

/**
 * Named Stored Query: reportQueries
 * Hub for parameterized, role-specific operational & clinical KPI aggregations.
 * Each reportKey targets a different collection + aggregation strategy.
 */
export async function runReportQuery(
  params: ReportQueriesParams,
  actorContext: ActorContext
): Promise<any> {
  const facilityFilter: Record<string, any> =
    !actorContext.roles.includes('SUPER_ADMIN')
      ? { facilityId: new mongoose.Types.ObjectId(actorContext.activeFacilityId) }
      : params.facilityId
        ? { facilityId: new mongoose.Types.ObjectId(params.facilityId) }
        : {};

  const dateFilter: Record<string, any> = {};
  if (params.fromDate || params.toDate) {
    dateFilter.createdAt = {};
    if (params.fromDate) dateFilter.createdAt.$gte = new Date(params.fromDate);
    if (params.toDate) dateFilter.createdAt.$lte = new Date(params.toDate);
  }

  switch (params.reportKey) {
    case 'topDiagnoses': {
      const pipeline: PipelineStage[] = [
        { $match: { ...facilityFilter, ...dateFilter } },
        { $unwind: { path: '$diagnoses', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { code: '$diagnoses.code', display: '$diagnoses.display' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: params.limit },
        {
          $project: {
            _id: 0,
            icd10Code: '$_id.code',
            display: '$_id.display',
            encounterCount: '$count',
          },
        },
      ];
      return EncounterModel.aggregate(pipeline);
    }

    case 'procedureVolumeByCategory': {
      const { ProcedureModel } = await import('../../modules/procedures/procedure.model.js');
      const pipeline: PipelineStage[] = [
        { $match: { ...facilityFilter, ...dateFilter, status: 'COMPLETED' } },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        {
          $project: {
            _id: 0,
            category: '$_id',
            total: 1,
          },
        },
      ];
      return ProcedureModel.aggregate(pipeline);
    }

    case 'patientRegistrationTrend': {
      const pipeline: PipelineStage[] = [
        { $match: { ...facilityFilter, ...dateFilter, status: { $ne: 'MERGED' } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            registrations: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            period: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                {
                  $cond: [
                    { $lt: ['$_id.month', 10] },
                    { $concat: ['0', { $toString: '$_id.month' }] },
                    { $toString: '$_id.month' },
                  ],
                },
              ],
            },
            registrations: 1,
          },
        },
      ];
      return PatientModel.aggregate(pipeline);
    }

    case 'revenueByMonth': {
      const pipeline: PipelineStage[] = [
        {
          $match: {
            ...facilityFilter,
            ...dateFilter,
            status: { $in: ['PAID', 'PARTIALLY_PAID'] },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            totalBilled: { $sum: '$totalAmount' },
            totalCollected: { $sum: '$amountPaid' },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            period: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                {
                  $cond: [
                    { $lt: ['$_id.month', 10] },
                    { $concat: ['0', { $toString: '$_id.month' }] },
                    { $toString: '$_id.month' },
                  ],
                },
              ],
            },
            totalBilled: 1,
            totalCollected: 1,
            invoiceCount: 1,
            collectionRate: {
              $round: [
                { $multiply: [{ $divide: ['$totalCollected', { $max: ['$totalBilled', 1] }] }, 100] },
                1,
              ],
            },
          },
        },
      ];
      return InvoiceModel.aggregate(pipeline);
    }

    case 'encounterTypeDistribution': {
      const pipeline: PipelineStage[] = [
        { $match: { ...facilityFilter, ...dateFilter } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            encounterType: '$_id',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ];
      return EncounterModel.aggregate(pipeline);
    }

    case 'admissionDischargeRatio': {
      const pipeline: PipelineStage[] = [
        { $match: { ...facilityFilter, type: 'INPATIENT' } },
        {
          $group: {
            _id: {
              year: { $year: '$start' },
              month: { $month: '$start' },
            },
            admissions: { $sum: 1 },
            discharges: {
              $sum: {
                $cond: [{ $in: ['$status', ['DISCHARGED', 'COMPLETED']] }, 1, 0],
              },
            },
            avgLosHours: {
              $avg: {
                $cond: [
                  { $ifNull: ['$end', false] },
                  { $divide: [{ $subtract: ['$end', '$start'] }, 3600000] },
                  null,
                ],
              },
            },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: params.limit },
        {
          $project: {
            _id: 0,
            period: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                {
                  $cond: [
                    { $lt: ['$_id.month', 10] },
                    { $concat: ['0', { $toString: '$_id.month' }] },
                    { $toString: '$_id.month' },
                  ],
                },
              ],
            },
            admissions: 1,
            discharges: 1,
            avgLosHours: { $round: ['$avgLosHours', 1] },
          },
        },
      ];
      return EncounterModel.aggregate(pipeline);
    }

    default:
      throw new Error(`Unknown report key: ${params.reportKey}`);
  }
}
