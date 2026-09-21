import { z } from 'zod';

export const AuditQuerySchema = z.object({
  patientId: z.string().optional(),
  actorId: z.string().optional(),
  facilityId: z.string().optional(),
  resourceType: z.string().optional(),
  action: z.string().optional(),
  breakGlassOnly: z.coerce.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;
