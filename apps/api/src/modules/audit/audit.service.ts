import { AuditLogModel, IAuditLog } from './auditLog.model.js';
import { calculateAuditHash } from '../../utils/crypto.util.js';
import { logger } from '../../config/logger.js';

export interface CreateAuditEntryParams {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  facilityId?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ip?: string;
  userAgent?: string;
  requestId?: string;
  diff?: Record<string, unknown>;
  breakGlassReason?: string;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class AuditService {
  /**
   * Append a tamper-evident audit record to the SHA-256 hash chain
   */
  static async log(params: CreateAuditEntryParams): Promise<IAuditLog> {
    try {
      const lastEntry = await AuditLogModel.findOne().sort({ seq: -1 }).lean();

      const seq = (lastEntry?.seq || 0) + 1;
      const prevHash = lastEntry?.hash || GENESIS_HASH;
      const timestamp = new Date().toISOString();

      const hash = calculateAuditHash({
        seq,
        prevHash,
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        patientId: params.patientId,
        timestamp,
        diff: params.diff,
      });

      const entry = await AuditLogModel.create({
        seq,
        prevHash,
        hash,
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        patientId: params.patientId,
        facilityId: params.facilityId,
        outcome: params.outcome || 'SUCCESS',
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
        diff: params.diff,
        breakGlass: params.breakGlassReason ? { reason: params.breakGlassReason } : undefined,
        at: new Date(timestamp),
      });

      return entry;
    } catch (err) {
      logger.error({ err, params }, 'Failed to record audit log entry');
      throw err;
    }
  }

  /**
   * Verify the mathematical integrity of the SHA-256 hash chain
   */
  static async verifyChainIntegrity(): Promise<{
    isValid: boolean;
    totalRecords: number;
    corruptedSeq?: number;
    details?: string;
  }> {
    const logs = await AuditLogModel.find().sort({ seq: 1 }).lean();
    if (logs.length === 0) {
      return { isValid: true, totalRecords: 0 };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      const expectedSeq = i + 1;

      if (entry.seq !== expectedSeq) {
        return {
          isValid: false,
          totalRecords: logs.length,
          corruptedSeq: entry.seq,
          details: `Sequence gap detected: expected ${expectedSeq}, found ${entry.seq}`,
        };
      }

      if (entry.prevHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalRecords: logs.length,
          corruptedSeq: entry.seq,
          details: `Previous hash mismatch at sequence ${entry.seq}`,
        };
      }

      const recomputedHash = calculateAuditHash({
        seq: entry.seq,
        prevHash: entry.prevHash,
        actorId: String(entry.actorId),
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        patientId: entry.patientId ? String(entry.patientId) : undefined,
        timestamp: new Date(entry.at).toISOString(),
        diff: entry.diff,
      });

      if (recomputedHash !== entry.hash) {
        return {
          isValid: false,
          totalRecords: logs.length,
          corruptedSeq: entry.seq,
          details: `Hash signature tampering detected at sequence ${entry.seq}`,
        };
      }

      expectedPrevHash = entry.hash;
    }

    return { isValid: true, totalRecords: logs.length };
  }
}
