import { z } from 'zod';

// Container name regex matching Docker daemon rules
const CONTAINER_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

export const containerPortMappingSchema = z.object({
  hostPort: z.number().int().min(1).max(65535).optional(),
  containerPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']).default('tcp'),
});

export const containerEnvVarSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Environment variable name must start with a letter or underscore and contain only alphanumeric characters or underscores.',
  }),
  value: z.string(),
});

export const containerVolumeMountSchema = z.object({
  hostVolumeOrPath: z.string().optional(),
  hostPathOrVolume: z.string().optional(),
  containerPath: z.string().min(1),
  mode: z.enum(['ro', 'rw']).optional(),
  readOnly: z.boolean().optional(),
});

export const baseContainerCreateSchema = z.object({
  name: z.string().min(2).max(128).regex(CONTAINER_NAME_REGEX, {
    message: 'Container name must start with an alphanumeric character and contain only alphanumeric, underscores, dots, or hyphens.',
  }),
  image: z.string().min(1, 'Image reference is required.').regex(/^[a-zA-Z0-9_./:-]+(@[a-zA-Z0-9_.:-]+)?$/, {
    message: 'Image reference format is invalid.',
  }),
  ports: z.array(containerPortMappingSchema).default([]),
  env: z.array(containerEnvVarSchema).optional().default([]),
  envVars: z.array(containerEnvVarSchema).optional().default([]),
  restartPolicy: z.enum(['no', 'always', 'unless-stopped', 'on-failure']).default('unless-stopped'),
  volumes: z.array(containerVolumeMountSchema).default([]),
  network: z.string().optional(),
  command: z.union([z.string(), z.array(z.string())]).optional(),
});

export const containerCreateSchema = baseContainerCreateSchema.transform((data) => {
  const envVars = data.envVars && data.envVars.length > 0 ? data.envVars : data.env;
  return {
    ...data,
    envVars,
    env: envVars,
  };
});

export const containerRecreateSchema = z.object({
  containerId: z.string().min(1),
  newConfig: baseContainerCreateSchema.partial().optional(),
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
