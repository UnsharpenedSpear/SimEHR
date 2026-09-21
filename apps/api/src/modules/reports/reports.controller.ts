import { Request, Response, NextFunction } from 'express';
import { EncounterModel } from '../encounters/encounter.model.js';
import { DispatchModel } from '../dispatch/dispatch.model.js';
import { InvoiceModel } from '../billing/invoice.model.js';

export class ReportsController {
  static async getCensusReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeEncounters = await EncounterModel.aggregate([
        { $match: { status: { $in: ['IN_PROGRESS', 'ARRIVED', 'TRIAGED'] } } },
        {
          $group: {
            _id: '$departmentId',
            count: { $sum: 1 },
            types: { $push: '$type' },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'department',
          },
        },
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            departmentId: '$_id',
            departmentName: { $ifNull: ['$department.name', 'Unassigned'] },
            departmentCode: { $ifNull: ['$department.code', 'UNK'] },
            activeCount: '$count',
          },
        },
      ]);

      const totalActivePatients = activeEncounters.reduce((sum, item) => sum + item.activeCount, 0);

      res.status(200).json({
        status: 'SUCCESS',
        data: {
          timestamp: new Date().toISOString(),
          totalActivePatients,
          byDepartment: activeEncounters,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDispatchSlaReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DispatchModel.aggregate([
        {
          $group: {
            _id: '$type',
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
            },
            breachedTasks: {
              $sum: { $cond: ['$isBreached', 1, 0] },
            },
            statCount: {
              $sum: { $cond: [{ $eq: ['$priority', 'STAT'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            type: '$_id',
            totalTasks: 1,
            completedTasks: 1,
            breachedTasks: 1,
            statCount: 1,
            complianceRatePercent: {
              $cond: [
                { $gt: ['$totalTasks', 0] },
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalTasks', '$breachedTasks'] }, '$totalTasks'] },
                    100,
                  ],
                },
                100,
              ],
            },
          },
        },
      ]);

      const overall = await DispatchModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            breached: { $sum: { $cond: ['$isBreached', 1, 0] } },
          },
        },
      ]);

      const total = overall[0]?.total || 0;
      const breached = overall[0]?.breached || 0;
      const overallCompliance = total > 0 ? ((total - breached) / total) * 100 : 100;

      res.status(200).json({
        status: 'SUCCESS',
        data: {
          timestamp: new Date().toISOString(),
          overallTotal: total,
          overallBreached: breached,
          overallCompliancePercent: Math.round(overallCompliance * 10) / 10,
          byType: stats,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFinancialReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await InvoiceModel.aggregate([
        {
          $group: {
            _id: null,
            totalBilled: { $sum: '$totalAmount' },
            totalCollected: { $sum: '$amountPaid' },
            totalOutstanding: { $sum: '$balanceDue' },
            invoiceCount: { $sum: 1 },
          },
        },
      ]);

      const byStatus = await InvoiceModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            balanceDue: { $sum: '$balanceDue' },
          },
        },
      ]);

      res.status(200).json({
        status: 'SUCCESS',
        data: {
          timestamp: new Date().toISOString(),
          summary: summary[0] || { totalBilled: 0, totalCollected: 0, totalOutstanding: 0, invoiceCount: 0 },
          byStatus,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
