import { z } from 'zod';

// Container name regex matching Docker daemon rules
const CONTAINER_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

export const containerPortMappingSchema = z.object({
  hostPort: z.number().int().min(1).max(65535),
  containerPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']).default('tcp'),
});

export const containerEnvVarSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  value: z.string(),
});

export const containerVolumeMountSchema = z.object({
  hostPathOrVolume: z.string().min(1),
  containerPath: z.string().min(1),
  readOnly: z.boolean().default(false),
});

export const containerCreateSchema = z.object({
  name: z.string().min(2).max(128).regex(CONTAINER_NAME_REGEX, {
    message: 'Container name must start with an alphanumeric character and contain only alphanumeric, underscores, dots, or hyphens.',
  }),
  image: z.string().min(1),
  ports: z.array(containerPortMappingSchema).default([]),
  env: z.array(containerEnvVarSchema).default([]),
  restartPolicy: z.enum(['no', 'always', 'unless-stopped', 'on-failure']).default('unless-stopped'),
  volumes: z.array(containerVolumeMountSchema).default([]),
  network: z.string().optional(),
});

export const containerRecreateSchema = z.object({
  containerId: z.string().min(1),
  newConfig: containerCreateSchema.partial().optional(),
});

export const containerActionSchema = z.object({
  containerId: z.string().min(1),
});

export const containerStopSchema = z.object({
  containerId: z.string().min(1),
  timeout: z.number().int().min(1).max(60).default(10),
});

export const containerDeleteSchema = z.object({
  containerId: z.string().min(1),
  stopFirst: z.boolean().default(false),
  removeVolumes: z.boolean().default(false),
});

export const containerLogsQuerySchema = z.object({
  tail: z.coerce.number().int().min(10).max(2000).default(200),
  timestamps: z.coerce.boolean().default(true),
});

export const imageTagSchema = z.object({
  sourceImage: z.string().min(1),
  targetTag: z.string().min(1).regex(/^[a-z0-9_.-]+:[a-z0-9_.-]+$/i, {
    message: 'Target tag must be formatted as repository:tag (e.g. my-app:v1.0.0)',
  }),
});

export const imageDeleteSchema = z.object({
  imageIdOrTag: z.string().min(1),
});

export const networkCreateSchema = z.object({
  name: z.string().min(2).max(128).regex(CONTAINER_NAME_REGEX),
  driver: z.enum(['bridge', 'overlay', 'macvlan', 'ipvlan']).default('bridge'),
  subnet: z.string().optional(),
  gateway: z.string().optional(),
});

export const networkConnectionSchema = z.object({
  networkName: z.string().min(1),
  containerId: z.string().min(1),
});

export const volumeCreateSchema = z.object({
  name: z.string().min(2).max(128).regex(CONTAINER_NAME_REGEX),
  driver: z.string().default('local'),
});

export const volumeDeleteSchema = z.object({
  volumeName: z.string().min(1),
});

export type ContainerCreateInput = z.infer<typeof containerCreateSchema>;
export type ContainerRecreateInput = z.infer<typeof containerRecreateSchema>;
export type ImageTagInput = z.infer<typeof imageTagSchema>;
export type NetworkCreateInput = z.infer<typeof networkCreateSchema>;
export type VolumeCreateInput = z.infer<typeof volumeCreateSchema>;
