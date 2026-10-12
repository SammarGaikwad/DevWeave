import { AppError } from '../middleware/errorHandler.js';
import * as pipelineRepo from '../repositories/pipelineRepository.js';
import * as repoRepo from '../repositories/repositoryRepository.js';
import * as jenkinsService from './jenkinsService.js';
import {
  getPipelineTemplate,
  generateJenkinsfile,
} from './pipelineTemplateRegistry.js';
import {
  PipelineStatus,
  PipelineStageStatus,
} from '../generated/prisma/client.js';

const BRANCH_REGEX = /^[a-zA-Z0-9._\/-]+$/;

function sanitizeJobName(repoName: string, templateId: string): string {
  const cleanRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const cleanTemplate = templateId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  return `devweave-${cleanRepo}-${cleanTemplate}`.substring(0, 80);
}

/**
 * Verify repository ownership or authorized access.
 */
async function verifyRepositoryAccess(
  userId: string,
  repositoryId: string
): Promise<{ id: string; name: string; fullName: string; defaultBranch: string }> {
  const repo = await repoRepo.findRepositoryById(repositoryId);
  if (!repo) {
    throw new AppError(`Repository with ID "${repositoryId}" not found`, 404);
  }

  // If repository has an owner userId, ensure requesting user matches
  if (repo.userId && repo.userId !== userId) {
    throw new AppError('Unauthorized: You do not have permission to access this repository', 403);
  }

  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName || repo.name,
    defaultBranch: repo.defaultBranch || 'main',
  };
}

/**
 * Configure or create a new pipeline for a repository.
 */
export async function configureRepositoryPipeline(params: {
  userId: string;
  repositoryId: string;
  templateId: string;
  name?: string;
  branch?: string;
  config?: Record<string, any>;
}) {
  const { userId, repositoryId, templateId, config = {} } = params;

  const repo = await verifyRepositoryAccess(userId, repositoryId);
  const template = getPipelineTemplate(templateId);

  const branch = params.branch?.trim() || repo.defaultBranch || 'main';
  if (!BRANCH_REGEX.test(branch) || branch.includes('..')) {
    throw new AppError(`Invalid branch name: "${branch}"`, 400);
  }

  const pipelineName =
    params.name?.trim() || `${repo.name} - ${template.name}`;

  const jenkinsJobName = sanitizeJobName(repo.name, templateId);

  // Generate repository clone URL
  const cloneUrl = `https://github.com/${repo.fullName}.git`;

  // Synthesize Declarative Jenkins Pipeline
  const pipelineScript = generateJenkinsfile({
    templateId,
    repositoryCloneUrl: cloneUrl,
    branch,
    config,
  });

  // Ensure dedicated job exists in Jenkins
  try {
    await jenkinsService.ensureJenkinsJob(jenkinsJobName, pipelineScript);
  } catch (error: any) {
    console.error(`Jenkins job configuration error for ${jenkinsJobName}:`, error.message);
    throw new AppError(`Failed to configure Jenkins pipeline job: ${error.message}`, 502);
  }

  // Check if pipeline already exists for this repo and template
  const existingPipelines = await pipelineRepo.findPipelinesByRepositoryId(repositoryId);
  const existing = existingPipelines.find((p) => p.templateId === templateId && p.branch === branch);

  let pipeline;
  if (existing) {
    pipeline = await pipelineRepo.updateRepositoryPipeline(existing.id, {
      name: pipelineName,
      branch,
      config,
      jenkinsJobName,
    });
  } else {
    pipeline = await pipelineRepo.createRepositoryPipeline({
      name: pipelineName,
      templateId,
      branch,
      config,
      jenkinsJobName,
      repositoryId,
      userId,
    });
  }

  return {
    ...pipeline,
    template,
  };
}

/**
 * List all pipelines configured for a repository.
 */
export async function getRepositoryPipelines(userId: string, repositoryId: string) {
  await verifyRepositoryAccess(userId, repositoryId);
  const pipelines = await pipelineRepo.findPipelinesByRepositoryId(repositoryId);

  return pipelines.map((p) => ({
    ...p,
    template: getPipelineTemplate(p.templateId),
  }));
}

/**
 * Trigger an execution run for a pipeline.
 */
export async function triggerPipelineRun(userId: string, pipelineId: string) {
  const pipeline = await pipelineRepo.findPipelineById(pipelineId);
  if (!pipeline) {
    throw new AppError(`Pipeline with ID "${pipelineId}" not found`, 404);
  }

  await verifyRepositoryAccess(userId, pipeline.repositoryId);
  const template = getPipelineTemplate(pipeline.templateId);

  // 1. Create run record in QUEUED status
  const run = await pipelineRepo.createPipelineRun({
    pipelineId: pipeline.id,
    repositoryId: pipeline.repositoryId,
    userId,
    templateId: pipeline.templateId,
    branch: pipeline.branch,
    jenkinsJobName: pipeline.jenkinsJobName,
    status: PipelineStatus.QUEUED,
  });

  // 2. Create stage run records
  for (const stageDef of template.stages) {
    await pipelineRepo.createPipelineStageRun({
      runId: run.id,
      stageId: stageDef.id,
      name: stageDef.name,
      order: stageDef.order,
      status: PipelineStageStatus.PENDING,
    });
  }

  // 3. Trigger build in Jenkins
  try {
    const triggerResult = await jenkinsService.triggerJobBuild(pipeline.jenkinsJobName);
    const updatedRun = await pipelineRepo.updatePipelineRun(run.id, {
      jenkinsQueueItemId: triggerResult.queueItemId,
      jenkinsBuildUrl: triggerResult.buildUrl,
    });

    const fullRun = await pipelineRepo.findPipelineRunById(run.id);
    return fullRun || updatedRun;
  } catch (error: any) {
    await pipelineRepo.updatePipelineRun(run.id, {
      status: PipelineStatus.FAILED,
      errorSummary: `Failed to trigger Jenkins runner: ${error.message}`,
    });
    throw new AppError(`Failed to trigger Jenkins execution: ${error.message}`, 502);
  }
}

/**
 * Synchronize pipeline run status with Jenkins and return updated details.
 */
export async function getPipelineRunStatus(userId: string, runId: string) {
  const run = await pipelineRepo.findPipelineRunById(runId);
  if (!run) {
    throw new AppError(`Pipeline run with ID "${runId}" not found`, 404);
  }

  await verifyRepositoryAccess(userId, run.repositoryId);

  // If already terminal (SUCCESS, FAILED, ABORTED), return as-is
  if (
    run.status === PipelineStatus.SUCCESS ||
    run.status === PipelineStatus.FAILED ||
    run.status === PipelineStatus.ABORTED
  ) {
    return run;
  }

  // If still queued or running, sync with Jenkins
  try {
    let buildNumber = run.jenkinsBuildNumber;

    // A. Resolve build number from queue item if missing
    if (!buildNumber && run.jenkinsQueueItemId) {
      const queueRes = await jenkinsService.resolveQueueItem(run.jenkinsQueueItemId);
      if (queueRes.cancelled) {
        await pipelineRepo.updatePipelineRun(run.id, {
          status: PipelineStatus.ABORTED,
          completedAt: new Date(),
          errorSummary: queueRes.why || 'Build cancelled in queue',
        });
        return await pipelineRepo.findPipelineRunById(run.id);
      }

      if (queueRes.buildNumber) {
        buildNumber = queueRes.buildNumber;
        await pipelineRepo.updatePipelineRun(run.id, {
          jenkinsBuildNumber: buildNumber,
          status: PipelineStatus.RUNNING,
          startedAt: run.startedAt || new Date(),
        });
      } else {
        // If queue item already departed without resolution, check recent builds of job
        const recentBuilds = await jenkinsService.getJobRecentBuilds(run.jenkinsJobName, 3);
        if (recentBuilds.length > 0) {
          buildNumber = recentBuilds[0].number;
          await pipelineRepo.updatePipelineRun(run.id, {
            jenkinsBuildNumber: buildNumber,
            status: PipelineStatus.RUNNING,
            startedAt: run.startedAt || new Date(),
          });
        }
      }
    }

    // B. Fetch build status and stages if build number is resolved
    if (buildNumber) {
      const buildDetails = await jenkinsService.getJobBuildDetails(
        run.jenkinsJobName,
        buildNumber
      );

      // Update stage runs from Jenkins wfapi
      if (buildDetails.stages && buildDetails.stages.length > 0) {
        for (const jStage of buildDetails.stages) {
          // Find matching stageRun by name or partial match
          const matchingStage = run.stageRuns.find(
            (sr) => sr.name.toLowerCase() === jStage.name.toLowerCase()
          );

          if (matchingStage) {
            let stageStatus: PipelineStageStatus = PipelineStageStatus.PENDING;
            if (jStage.status === 'SUCCESS') stageStatus = PipelineStageStatus.SUCCESS;
            else if (jStage.status === 'IN_PROGRESS') stageStatus = PipelineStageStatus.RUNNING;
            else if (jStage.status === 'FAILED') stageStatus = PipelineStageStatus.FAILED;
            else if (jStage.status === 'ABORTED') stageStatus = PipelineStageStatus.ABORTED;

            await pipelineRepo.updatePipelineStageRun(matchingStage.id, {
              status: stageStatus,
              durationMs: jStage.durationMillis,
            });
          }
        }
      }

      // Check if build completed
      if (buildDetails.status !== 'BUILDING' && buildDetails.status !== 'UNKNOWN') {
        let finalStatus: PipelineStatus = PipelineStatus.FAILED;
        if (buildDetails.status === 'SUCCESS') finalStatus = PipelineStatus.SUCCESS;
        else if (buildDetails.status === 'ABORTED') finalStatus = PipelineStatus.ABORTED;

        await pipelineRepo.updatePipelineRun(run.id, {
          status: finalStatus,
          completedAt: new Date(),
          durationMs: buildDetails.duration,
          commitMessage: buildDetails.commitMessage,
          author: buildDetails.author,
          jenkinsBuildUrl: buildDetails.url,
        });
      } else if (run.status === PipelineStatus.QUEUED) {
        await pipelineRepo.updatePipelineRun(run.id, {
          status: PipelineStatus.RUNNING,
          startedAt: run.startedAt || new Date(),
        });
      }
    }
  } catch (err: any) {
    console.warn(`Failed to sync status for run ${run.id}:`, err.message);
  }

  return await pipelineRepo.findPipelineRunById(run.id);
}

/**
 * Fetch Jenkins console logs for a pipeline run.
 */
export async function getPipelineRunLogs(userId: string, runId: string) {
  const run = await pipelineRepo.findPipelineRunById(runId);
  if (!run) {
    throw new AppError(`Pipeline run with ID "${runId}" not found`, 404);
  }

  await verifyRepositoryAccess(userId, run.repositoryId);

  if (!run.jenkinsBuildNumber) {
    return {
      runId: run.id,
      buildNumber: null,
      status: run.status,
      logs: 'Build is currently queued. Waiting for Jenkins executor to allocate runner...',
    };
  }

  try {
    const logs = await jenkinsService.fetchJobBuildLogs(
      run.jenkinsJobName,
      run.jenkinsBuildNumber
    );
    return {
      runId: run.id,
      buildNumber: run.jenkinsBuildNumber,
      status: run.status,
      logs,
    };
  } catch (error: any) {
    return {
      runId: run.id,
      buildNumber: run.jenkinsBuildNumber,
      status: run.status,
      logs: `Could not retrieve console logs: ${error.message}`,
    };
  }
}

/**
 * Fetch execution history for a repository.
 */
export async function getRepositoryPipelineRuns(userId: string, repositoryId: string) {
  await verifyRepositoryAccess(userId, repositoryId);
  return await pipelineRepo.findPipelineRunsByRepositoryId(repositoryId);
}
