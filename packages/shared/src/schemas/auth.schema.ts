import { z } from 'zod';
import { SYSTEM_ROLES } from '../constants/permissions.js';

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const MFALoginInputSchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  code: z.string().length(6, 'MFA code must be 6 digits'),
});
export type MFALoginInput = z.infer<typeof MFALoginInputSchema>;

export const MFASetupVerifySchema = z.object({
  code: z.string().length(6, 'MFA code must be 6 digits'),
});
export type MFASetupVerify = z.infer<typeof MFASetupVerifySchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.object({
    given: z.array(z.string()).min(1).or(z.string().min(1).transform((s) => [s])),
    family: z.string().min(1),
    prefix: z.string().optional(),
  }),
  roleIds: z.array(z.string()).min(1, 'At least one role is required'),
  facilityIds: z.array(z.string()).min(1, 'At least one facility is required'),
  departmentIds: z.array(z.string()).default([]),
  professional: z
    .object({
      licenseNo: z.string().optional(),
      specialty: z.string().optional(),
      npi: z.string().optional(),
    })
    .optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
