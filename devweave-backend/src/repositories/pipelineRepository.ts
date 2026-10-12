import {
  RepositoryPipeline,
  PipelineRun,
  PipelineStageRun,
  PipelineStatus,
  PipelineStageStatus,
} from '../generated/prisma/client.js';
import { prisma, isDbAvailable, markDbOffline } from '../config/database.js';

const memoryPipelines = new Map<string, RepositoryPipeline>();
const memoryRuns = new Map<string, PipelineRun>();
const memoryStages = new Map<string, PipelineStageRun>();

// ==========================================
// RepositoryPipeline
// ==========================================

export async function createRepositoryPipeline(data: {
  id?: string;
  name: string;
  templateId: string;
  branch: string;
  config?: any;
  jenkinsJobName: string;
  repositoryId: string;
  userId: string;
}): Promise<RepositoryPipeline> {
  if (await isDbAvailable()) {
    try {
      const pipeline = await prisma.repositoryPipeline.create({
        data: {
          id: data.id,
          name: data.name,
          templateId: data.templateId,
          branch: data.branch,
          config: data.config ?? {},
          jenkinsJobName: data.jenkinsJobName,
          repositoryId: data.repositoryId,
          userId: data.userId,
        },
      });
      memoryPipelines.set(pipeline.id, pipeline);
      return pipeline;
    } catch {
      markDbOffline();
    }
  }

  const pipeline: RepositoryPipeline = {
    id: data.id || `mem-pipe-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: data.name,
    templateId: data.templateId,
    branch: data.branch,
    config: data.config ?? {},
    jenkinsJobName: data.jenkinsJobName,
    repositoryId: data.repositoryId,
    userId: data.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryPipelines.set(pipeline.id, pipeline);
  return pipeline;
}

export async function findPipelineById(id: string): Promise<RepositoryPipeline | null> {
  if (await isDbAvailable()) {
    try {
      const pipeline = await prisma.repositoryPipeline.findUnique({
        where: { id },
      });
      if (pipeline) memoryPipelines.set(pipeline.id, pipeline);
      return pipeline;
    } catch {
      markDbOffline();
    }
  }

  return memoryPipelines.get(id) || null;
}

export async function findPipelinesByRepositoryId(repositoryId: string): Promise<RepositoryPipeline[]> {
  if (await isDbAvailable()) {
    try {
      const pipelines = await prisma.repositoryPipeline.findMany({
        where: { repositoryId },
        orderBy: { createdAt: 'desc' },
      });
      for (const p of pipelines) memoryPipelines.set(p.id, p);
      return pipelines;
    } catch {
      markDbOffline();
    }
  }

  return Array.from(memoryPipelines.values())
    .filter((p) => p.repositoryId === repositoryId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateRepositoryPipeline(
  id: string,
  data: Partial<{
    name: string;
    branch: string;
    config: any;
    jenkinsJobName: string;
  }>
): Promise<RepositoryPipeline> {
  if (await isDbAvailable()) {
    try {
      const updated = await prisma.repositoryPipeline.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      memoryPipelines.set(updated.id, updated);
      return updated;
    } catch {
      markDbOffline();
    }
  }

  const existing = memoryPipelines.get(id);
  if (!existing) throw new Error(`Pipeline ${id} not found in memory`);
  const updated: RepositoryPipeline = {
    ...existing,
    ...data,
    updatedAt: new Date(),
  };
  memoryPipelines.set(id, updated);
  return updated;
}

// ==========================================
// PipelineRun
// ==========================================

export async function createPipelineRun(data: {
  id?: string;
  pipelineId: string;
  repositoryId: string;
  userId: string;
  templateId: string;
  branch: string;
  jenkinsJobName: string;
  jenkinsQueueItemId?: number | null;
  status?: PipelineStatus;
}): Promise<PipelineRun> {
  if (await isDbAvailable()) {
    try {
      const run = await prisma.pipelineRun.create({
        data: {
          id: data.id,
          pipelineId: data.pipelineId,
          repositoryId: data.repositoryId,
          userId: data.userId,
          templateId: data.templateId,
          branch: data.branch,
          jenkinsJobName: data.jenkinsJobName,
          jenkinsQueueItemId: data.jenkinsQueueItemId,
          status: data.status || PipelineStatus.QUEUED,
        },
      });
      memoryRuns.set(run.id, run);
      return run;
    } catch {
      markDbOffline();
    }
  }

  const run: PipelineRun = {
    id: data.id || `mem-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    pipelineId: data.pipelineId,
    repositoryId: data.repositoryId,
    userId: data.userId,
    templateId: data.templateId,
    branch: data.branch,
    jenkinsJobName: data.jenkinsJobName,
    jenkinsQueueItemId: data.jenkinsQueueItemId ?? null,
    jenkinsBuildNumber: null,
    status: data.status || PipelineStatus.QUEUED,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    commitSha: null,
    commitMessage: null,
    author: null,
    jenkinsBuildUrl: null,
    errorSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryRuns.set(run.id, run);
  return run;
}

export async function findPipelineRunById(
  id: string
): Promise<(PipelineRun & { stageRuns: PipelineStageRun[] }) | null> {
  if (await isDbAvailable()) {
    try {
      const run = await prisma.pipelineRun.findUnique({
        where: { id },
        include: {
          stageRuns: {
            orderBy: { order: 'asc' },
          },
        },
      });
      if (run) {
        memoryRuns.set(run.id, run);
        for (const s of run.stageRuns) memoryStages.set(s.id, s);
      }
      return run;
    } catch {
      markDbOffline();
    }
  }

  const run = memoryRuns.get(id);
  if (!run) return null;
  const stageRuns = Array.from(memoryStages.values())
    .filter((s) => s.runId === id)
    .sort((a, b) => a.order - b.order);
  return { ...run, stageRuns };
}

export async function findPipelineRunsByRepositoryId(
  repositoryId: string,
  limit = 20
): Promise<(PipelineRun & { stageRuns: PipelineStageRun[] })[]> {
  if (await isDbAvailable()) {
    try {
      const runs = await prisma.pipelineRun.findMany({
        where: { repositoryId },
        include: {
          stageRuns: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return runs;
    } catch {
      markDbOffline();
    }
  }

  return Array.from(memoryRuns.values())
    .filter((r) => r.repositoryId === repositoryId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((run) => {
      const stageRuns = Array.from(memoryStages.values())
        .filter((s) => s.runId === run.id)
        .sort((a, b) => a.order - b.order);
      return { ...run, stageRuns };
    });
}

export async function updatePipelineRun(
  id: string,
  data: Partial<PipelineRun>
): Promise<PipelineRun> {
  if (await isDbAvailable()) {
    try {
      const updated = await prisma.pipelineRun.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      memoryRuns.set(updated.id, updated);
      return updated;
    } catch {
      markDbOffline();
    }
  }

  const existing = memoryRuns.get(id);
  if (!existing) throw new Error(`Run ${id} not found in memory`);
  const updated: PipelineRun = {
    ...existing,
    ...data,
    updatedAt: new Date(),
  };
  memoryRuns.set(id, updated);
  return updated;
}

// ==========================================
// PipelineStageRun
// ==========================================

export async function createPipelineStageRun(data: {
  id?: string;
  runId: string;
  stageId: string;
  name: string;
  order: number;
  status?: PipelineStageStatus;
}): Promise<PipelineStageRun> {
  if (await isDbAvailable()) {
    try {
      const stage = await prisma.pipelineStageRun.create({
        data: {
          id: data.id,
          runId: data.runId,
          stageId: data.stageId,
          name: data.name,
          order: data.order,
          status: data.status || PipelineStageStatus.PENDING,
          durationMs: 0,
        },
      });
      memoryStages.set(stage.id, stage);
      return stage;
    } catch {
      markDbOffline();
    }
  }

  const stage: PipelineStageRun = {
    id: data.id || `mem-stg-${Date.now()}-${data.order}`,
    runId: data.runId,
    stageId: data.stageId,
    name: data.name,
    order: data.order,
    status: data.status || PipelineStageStatus.PENDING,
    durationMs: 0,
    startedAt: null,
    completedAt: null,
    errorDetails: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStages.set(stage.id, stage);
  return stage;
}

export async function updatePipelineStageRun(
  id: string,
  data: Partial<PipelineStageRun>
): Promise<PipelineStageRun> {
  if (await isDbAvailable()) {
    try {
      const updated = await prisma.pipelineStageRun.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      memoryStages.set(updated.id, updated);
      return updated;
    } catch {
      markDbOffline();
    }
  }

  const existing = memoryStages.get(id);
  if (!existing) throw new Error(`Stage run ${id} not found in memory`);
  const updated: PipelineStageRun = {
    ...existing,
    ...data,
    updatedAt: new Date(),
  };
  memoryStages.set(id, updated);
  return updated;
}
