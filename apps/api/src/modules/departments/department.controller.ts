import { Request, Response, NextFunction } from 'express';
import { DepartmentModel } from './department.model.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export class DepartmentController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = { active: true };
      if (req.query.facilityId) filter.facilityId = req.query.facilityId;
      if (req.query.type) filter.type = req.query.type;

      const departments = await DepartmentModel.find(filter).sort({ name: 1 }).lean();
      res.status(200).json({ status: 'SUCCESS', data: departments });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dept = await DepartmentModel.findById(req.params.id).lean();
      if (!dept) throw new NotFoundError('Department not found');
      res.status(200).json({ status: 'SUCCESS', data: dept });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dept = await DepartmentModel.create(req.body);
      res.status(201).json({ status: 'SUCCESS', data: dept });
    } catch (err) {
      next(err);
    }
  }
}
