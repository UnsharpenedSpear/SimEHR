import { z } from 'zod';

export const IdentifierSchema = z.object({
  type: z.enum(['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'INSURANCE_MEMBER_ID', 'OTHER']),
  value: z.string().min(1),
  issuer: z.string().optional(),
});

export const EmergencyContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().min(5),
  isNextOfKin: z.boolean().default(false),
});

export const GuardianSchema = z.object({
  name: z.string().min(1),
  relationship: z.enum(['PARENT', 'LEGAL_GUARDIAN', 'FOSTER_PARENT', 'OTHER']),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  nationalId: z.string().optional(),
});

export const InsuranceSchema = z.object({
  provider: z.string().min(1),
  policyNumber: z.string().min(1),
  groupNumber: z.string().optional(),
  subscriberName: z.string().min(1),
  relationship: z.enum(['SELF', 'SPOUSE', 'CHILD', 'OTHER']),
  validUntil: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

export const RawPatientSchema = z.object({
  facilityId: z.string().min(1),
  name: z.object({
    given: z.array(z.string()).min(1, 'At least one given name is required'),
    family: z.string().min(1, 'Family name is required'),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  genderIdentity: z.string().optional(),
  identifiers: z.array(IdentifierSchema).default([]),
  contact: z.object({
    phones: z.array(z.string()).min(1, 'At least one phone number is required'),
    email: z.string().email().optional().or(z.literal('')),
  }),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().default('USA'),
  }),
  emergencyContacts: z.array(EmergencyContactSchema).default([]),
  guardian: GuardianSchema.optional(),
  insurance: z.array(InsuranceSchema).default([]),
  preferredLanguage: z.string().default('English'),
  flags: z
    .object({
      vip: z.boolean().default(false),
      restricted: z.boolean().default(false),
      deceased: z.boolean().default(false),
    })
    .default({ vip: false, restricted: false, deceased: false }),
  codeStatus: z.enum(['FULL_CODE', 'DNR', 'DNI', 'COMFORT_MEASURES']).default('FULL_CODE'),
  isolationFlags: z.array(z.string()).default([]),
});

export const CreatePatientSchema = RawPatientSchema.superRefine((data, ctx) => {
  const birthDate = new Date(data.dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  if (age < 18 && !data.guardian) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Guardian information is required for minor patients under 18 years old',
      path: ['guardian'],
    });
  }
});

export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

export const UpdatePatientSchema = RawPatientSchema.partial();
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;

export const PatientSearchQuerySchema = z.object({
  query: z.string().optional(),
  mrn: z.string().optional(),
  name: z.string().optional(),
  dob: z.string().optional(),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
  gender: z.string().optional(),
  facilityId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  sort: z.string().default('createdAt:desc'),
});
export type PatientSearchQuery = z.infer<typeof PatientSearchQuerySchema>;

export const BreakGlassInputSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters detailing emergency justification'),
});
export type BreakGlassInput = z.infer<typeof BreakGlassInputSchema>;

export const MergePatientInputSchema = z.object({
  targetPatientId: z.string().min(1, 'Target patient ID to keep is required'),
  reason: z.string().min(10, 'Reason for merge is required'),
});
export type MergePatientInput = z.infer<typeof MergePatientInputSchema>;
