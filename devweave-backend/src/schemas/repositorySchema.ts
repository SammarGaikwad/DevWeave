import { z } from 'zod';

export const repositoryParamSchema = z.object({
  id: z.string().uuid('Invalid repository UUID format'),
});

export const repositoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
});

export const createRepositorySchema = z.object({
  name: z
    .string({ required_error: 'Repository name is required' })
    .trim()
    .min(1, 'Repository name cannot be empty')
    .max(100, 'Repository name must be 100 characters or less')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Repository name can only contain letters, numbers, hyphens, periods, and underscores'
    ),
  description: z.string().max(255, 'Description must be 255 characters or less').optional(),
  private: z.boolean().default(false),
  initializeReadme: z.boolean().default(true),
});

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;

