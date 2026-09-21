import mongoose from 'mongoose';
import { PatientModel } from '../modules/patients/patient.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { RefreshTokenModel } from '../modules/auth/refreshToken.model.js';
import { AuditLogModel } from '../modules/audit/auditLog.model.js';
import { SavedSearchModel } from '../modules/saved-searches/savedSearch.model.js';
import { logger } from '../config/logger.js';

export async function syncAllIndexes(): Promise<void> {
  logger.info('Synchronizing MongoDB indexes across collections...');

  await Promise.all([
    PatientModel.syncIndexes(),
    UserModel.syncIndexes(),
    RoleModel.syncIndexes(),
    RefreshTokenModel.syncIndexes(),
    AuditLogModel.syncIndexes(),
    SavedSearchModel.syncIndexes(),
  ]);

  logger.info('All collection indexes successfully verified and synchronized');
}
