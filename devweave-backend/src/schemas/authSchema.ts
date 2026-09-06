import { z } from 'zod';
import { Role } from '../generated/prisma/enums.js';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),

  email: z.string().email('Email must be valid'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),

  role: z
    .nativeEnum(Role)
    .optional()
    .refine((val) => val !== Role.ADMIN, {
      message: 'Standard registration cannot assign ADMIN role',
    }),
});

export const loginSchema = z.object({
  email: z.string().email('Email must be valid'),

  password: z.string().min(1, 'Password is required'),
});

export type RegisterRequestInput = z.infer<typeof registerSchema>;

export type LoginRequestInput = z.infer<typeof loginSchema>;