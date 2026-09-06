import { z } from 'zod';

export const repositoryParamSchema = z.object({
  id: z.string().uuid('Invalid repository UUID format'),
});

export const repositoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
});
