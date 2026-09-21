import { z } from 'zod';

export const CreateSavedSearchSchema = z.object({
  name: z.string().min(1),
  entity: z.enum(['PATIENTS', 'ORDERS', 'DISPATCHES', 'APPOINTMENTS', 'PROCEDURES', 'INVOICES']),
  filters: z.record(z.any()),
  sort: z.string().optional(),
  isShared: z.boolean().default(false),
});
export type CreateSavedSearchInput = z.infer<typeof CreateSavedSearchSchema>;
