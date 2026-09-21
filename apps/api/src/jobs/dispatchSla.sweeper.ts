import { DispatchModel } from '../modules/dispatch/dispatch.model.js';
import { logger } from '../config/logger.js';
import { emitDispatchTransitioned } from '../realtime/socket.js';

export class DispatchSlaSweeper {
  /**
   * Sweeps the active dispatches and marks tasks that have exceeded their SLA target
   */
  static async checkBreachedSlas(): Promise<number> {
    try {
      const now = new Date();
      const terminalStatuses = ['COMPLETED', 'REJECTED', 'CANCELLED'];

      const overdueDispatches = await DispatchModel.find({
        status: { $nin: terminalStatuses },
        slaDueAt: { $lte: now },
        isBreached: false,
      });

      if (overdueDispatches.length === 0) {
        return 0;
      }

      logger.warn({ count: overdueDispatches.length }, 'Detected overdue dispatch tasks breaching SLA');

      for (const dispatch of overdueDispatches) {
        dispatch.isBreached = true;
        dispatch.events.push({
          fromStatus: dispatch.status,
          toStatus: dispatch.status,
          timestamp: now,
          actorId: dispatch.events[0]?.actorId || dispatch.patientId,
          reason: `SLA Target Breached (Target was ${dispatch.slaDueAt.toISOString()})`,
        });

        await dispatch.save();
        emitDispatchTransitioned(dispatch);
      }

      return overdueDispatches.length;
    } catch (err) {
      logger.error({ err }, 'Error running dispatch SLA sweeper');
      return 0;
    }
  }
}
