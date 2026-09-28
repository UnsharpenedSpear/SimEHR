import { ZodSchema } from 'zod';
import { runPatientSearch, patientSearchParamsSchema } from './patientSearch.query.js';
import { ActorContext } from './patientSearch.query.js';
import { runDispatchBoard, dispatchBoardParamsSchema } from './dispatchBoard.query.js';
import { runOverdueOrders, overdueOrdersParamsSchema } from './overdueOrders.query.js';
import {
  runUnacknowledgedCriticalResults,
  unacknowledgedCriticalResultsParamsSchema,
} from './unacknowledgedCriticalResults.query.js';
import {
  runDispatchTurnaroundStats,
  dispatchTurnaroundStatsParamsSchema,
} from './dispatchTurnaroundStats.query.js';
import { runReportQuery, reportQueriesParamsSchema } from './reportQueries.query.js';
import { runAuditTrailByPatient, auditTrailByPatientParamsSchema } from './auditTrailByPatient.query.js';
import { BadRequestError } from '../../middleware/error.middleware.js';

export interface NamedQueryDefinition {
  name: string;
  description: string;
  paramsSchema: ZodSchema;
  handler: (params: any, actorContext: ActorContext) => Promise<any>;
}

export const queryRegistry: Record<string, NamedQueryDefinition> = {
  patientSearch: {
    name: 'patientSearch',
    description: 'Multi-criteria ranked patient lookup with blind indexing and cursor pagination',
    paramsSchema: patientSearchParamsSchema,
    handler: (params, actorContext) => runPatientSearch(params, actorContext),
  },
  dispatchBoard: {
    name: 'dispatchBoard',
    description: 'Aggregated Kanban dispatch board grouped by department with SLA metadata',
    paramsSchema: dispatchBoardParamsSchema,
    handler: (params, actorContext) => runDispatchBoard(params, actorContext),
  },
  overdueOrders: {
    name: 'overdueOrders',
    description: 'Signed orders not dispatched/fulfilled within expected SLA threshold',
    paramsSchema: overdueOrdersParamsSchema,
    handler: (params, actorContext) => runOverdueOrders(params, actorContext),
  },
  unacknowledgedCriticalResults: {
    name: 'unacknowledgedCriticalResults',
    description: 'Critical lab results awaiting physician acknowledgment beyond SLA',
    paramsSchema: unacknowledgedCriticalResultsParamsSchema,
    handler: (params, actorContext) => runUnacknowledgedCriticalResults(params, actorContext),
  },
  dispatchTurnaroundStats: {
    name: 'dispatchTurnaroundStats',
    description: 'Dispatch mean/min/max turnaround and SLA compliance analytics',
    paramsSchema: dispatchTurnaroundStatsParamsSchema,
    handler: (params, actorContext) => runDispatchTurnaroundStats(params, actorContext),
  },
  reportQuery: {
    name: 'reportQuery',
    description: 'Parameterized KPI report aggregations (topDiagnoses, revenue, trends, etc.)',
    paramsSchema: reportQueriesParamsSchema,
    handler: (params, actorContext) => runReportQuery(params, actorContext),
  },
  auditTrailByPatient: {
    name: 'auditTrailByPatient',
    description: 'Paginated tamper-evident audit trail for a patient with actor enrichment',
    paramsSchema: auditTrailByPatientParamsSchema,
    handler: (params, actorContext) => runAuditTrailByPatient(params, actorContext),
  },
};

export async function executeNamedQuery(
  queryName: string,
  rawParams: unknown,
  actorContext: ActorContext
): Promise<any> {
  const queryDef = queryRegistry[queryName];
  if (!queryDef) {
    throw new BadRequestError(`Query '${queryName}' is not registered in the query repository`);
  }

  const validatedParams = queryDef.paramsSchema.parse(rawParams);
  return await queryDef.handler(validatedParams, actorContext);
}
