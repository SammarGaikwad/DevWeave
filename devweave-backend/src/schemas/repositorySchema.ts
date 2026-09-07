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

const SENSITIVE_FILE_REGEX = /(^\.?env($|\.)|^\.git($|\/)|^\.DS_Store$|\.(key|pem|crt)$)/i;

function isPathSafe(filePath: string): boolean {
  if (!filePath || filePath.trim().length === 0) return false;
  if (filePath.includes('\\')) return false;
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) return false;
  const segments = filePath.split('/');
  if (segments.some((seg) => seg === '.' || seg === '..')) return false;
  const fileName = segments[segments.length - 1];
  if (SENSITIVE_FILE_REGEX.test(fileName)) return false;
  return true;
}

export const fileItemSchema = z
  .object({
    path: z
      .string({ required_error: 'File path is required' })
      .trim()
      .min(1, 'File path cannot be empty')
      .refine((val) => isPathSafe(val), {
        message: 'Invalid or forbidden file path (path traversal, absolute paths, or sensitive files are disallowed)',
      }),
    content: z.string({ required_error: 'File content is required' }),
    encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  })
  .refine(
    (data) => {
      const byteSize =
        data.encoding === 'base64'
          ? Math.floor((data.content.length * 3) / 4)
          : Buffer.byteLength(data.content, 'utf-8');
      return byteSize <= 5 * 1024 * 1024;
    },
    { message: 'File size exceeds maximum limit of 5MB' }
  );

export const bulkUploadFilesSchema = z
  .object({
    branch: z.string().trim().optional(),
    message: z
      .string({ required_error: 'Commit message is required' })
      .trim()
      .min(1, 'Commit message cannot be empty')
      .max(255, 'Commit message must be 255 characters or less'),
    files: z
      .array(fileItemSchema)
      .min(1, 'At least one file must be provided')
      .max(100, 'Cannot upload more than 100 files in a single commit'),
  })
  .refine(
    (data) => {
      const totalBytes = data.files.reduce((sum, f) => {
        const bytes =
          f.encoding === 'base64'
            ? Math.floor((f.content.length * 3) / 4)
            : Buffer.byteLength(f.content, 'utf-8');
        return sum + bytes;
      }, 0);
      return totalBytes <= 20 * 1024 * 1024;
    },
    { message: 'Total payload size exceeds maximum limit of 20MB' }
  );

export type BulkUploadFilesInput = z.infer<typeof bulkUploadFilesSchema>;

