import { Request, Response, NextFunction } from 'express';
import { SavedSearchModel } from './savedSearch.model.js';
import { executeNamedQuery } from '../../db/queries/queryRegistry.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export class SavedSearchController {
  static async listSavedSearches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searches = await SavedSearchModel.find({
        $or: [{ userId: req.user!.id }, { isShared: true }],
      })
        .sort({ updatedAt: -1 })
        .lean();

      res.status(200).json({
        status: 'SUCCESS',
        data: searches,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createSavedSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = await SavedSearchModel.create({
        userId: req.user!.id,
        name: req.body.name,
        entity: req.body.entity,
        filters: req.body.filters,
        sort: req.body.sort,
        isShared: req.body.isShared || false,
      });

      res.status(201).json({
        status: 'SUCCESS',
        data: search,
      });
    } catch (err) {
      next(err);
    }
  }

  static async executeSavedSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = await SavedSearchModel.findById(req.params.id).lean();
      if (!search) throw new NotFoundError('Saved search not found');

      const actor = {
        userId: req.user!.id,
        roles: req.user!.roles,
        permissions: req.user!.permissions,
        activeFacilityId: req.user!.activeFacilityId,
        facilityIds: req.user!.facilityIds,
      };

      // Map entity to registered named query
      const queryName = search.entity === 'PATIENTS' ? 'patientSearch' : search.entity.toLowerCase();
      const result = await executeNamedQuery(queryName, search.filters, actor);

      res.status(200).json({
        status: 'SUCCESS',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
