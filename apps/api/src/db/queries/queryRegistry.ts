import { ZodSchema } from 'zod';
import { runPatientSearch, patientSearchParamsSchema } from './patientSearch.query.js';
import { ActorContext } from './patientSearch.query.js';
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
