import { Request, Response, NextFunction } from 'express';
import {
  checkDockerStatus,
  DOCKER_TEMPLATES,
} from '../services/dockerService.js';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

const generateSchema = z.object({
  templateId: z.string().optional(),
  language: z.string().default('Node.js'),
  baseImage: z.string().default('node:20-alpine'),
  port: z.number().int().min(1).max(65535).default(8080),
  workdir: z.string().default('/app'),
  installCmd: z.string().default('npm ci'),
  buildCmd: z.string().default('npm run build'),
  startCmd: z.string().default('node dist/server.js'),
  nonRootUser: z.boolean().default(true),
});

export async function getDockerStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await checkDockerStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

export function getDockerTemplates(
  _req: Request,
  res: Response
): void {
  const templates = Object.values(DOCKER_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    description: t.description,
    defaultPort: t.defaultPort,
    bestPractices: t.bestPractices,
    composeSnippet: t.composeSnippet,
  }));

  res.status(200).json({
    success: true,
    data: templates,
  });
}

export function getDockerTemplateById(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { id } = req.params;
  const template = DOCKER_TEMPLATES[id];

  if (!template) {
    return next(new AppError(`Docker template "${id}" not found.`, 404));
  }

  res.status(200).json({
    success: true,
    data: template,
  });
}

export function generateCustomDockerfile(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const parsed = generateSchema.parse(req.body);

    const userSnippet = parsed.nonRootUser
      ? `RUN addgroup -S appgroup && adduser -S appuser -G appgroup\nUSER appuser\n`
      : '';

    const dockerfile = `# Custom DevWeave Dockerfile
# Generated at ${new Date().toISOString()}
FROM ${parsed.baseImage} AS base
WORKDIR ${parsed.workdir}

# Dependencies
COPY package*.json ./
RUN ${parsed.installCmd}

# Application Source
COPY . .
RUN ${parsed.buildCmd}

# Runtime Configuration
${userSnippet}EXPOSE ${parsed.port}
CMD [${parsed.startCmd
      .split(' ')
      .map((s) => `"${s}"`)
      .join(', ')}]
`;

    res.status(200).json({
      success: true,
      data: {
        dockerfile,
        parameters: parsed,
      },
    });
  } catch (error) {
    next(error);
  }
}
