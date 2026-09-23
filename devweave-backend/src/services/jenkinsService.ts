import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { JenkinsBuildDetailsResponse, JenkinsTriggerBuildResponse } from '../types/index.js';


export interface PipelineStage {
  id: string;
  name: string;
  status: 'SUCCESS' | 'IN_PROGRESS' | 'FAILED' | 'PAUSED' | 'ABORTED' | 'PENDING';
  durationMillis: number;
}

export interface BuildSummary {
  number: number;
  url: string;
  status: 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'NOT_BUILT' | 'ABORTED' | 'UNSTABLE' | 'UNKNOWN';
  timestamp: number;
  duration: number;
  commitMessage?: string;
  author?: string;
  stages?: PipelineStage[];
}

export interface PipelineStatusResponse {
  name: string;
  url: string;
  status: 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'NOT_BUILT' | 'ABORTED' | 'UNSTABLE' | 'UNKNOWN';
  latestBuild: BuildSummary | null;
  builds: BuildSummary[];
}

function getJenkinsAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (env.JENKINS_USERNAME && env.JENKINS_API_TOKEN) {
    const credentials = Buffer.from(
      `${env.JENKINS_USERNAME}:${env.JENKINS_API_TOKEN}`
    ).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }
  return headers;
}

function mapJenkinsStatus(
  result: string | null | undefined,
  building?: boolean
): 'SUCCESS' | 'FAILURE' | 'BUILDING' | 'NOT_BUILT' | 'ABORTED' | 'UNSTABLE' | 'UNKNOWN' {
  if (building) return 'BUILDING';
  if (!result) return 'UNKNOWN';

  switch (result.toUpperCase()) {
    case 'SUCCESS':
      return 'SUCCESS';
    case 'FAILURE':
      return 'FAILURE';
    case 'ABORTED':
      return 'ABORTED';
    case 'UNSTABLE':
      return 'UNSTABLE';
    case 'NOT_BUILT':
      return 'NOT_BUILT';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Fetch crumb for CSRF protection when making mutating POST calls to Jenkins
 */
async function getJenkinsCrumbHeader(): Promise<Record<string, string>> {
  try {
    const url = `${env.JENKINS_URL.replace(/\/$/, '')}/crumbIssuer/api/json`;
    const response = await fetch(url, {
      headers: getJenkinsAuthHeaders(),
    });
    if (response.ok) {
      const data = (await response.json()) as { crumbRequestField?: string; crumb?: string };
      if (data.crumbRequestField && data.crumb) {
        return { [data.crumbRequestField]: data.crumb };
      }
    }
  } catch {
    // If crumb issuer fails or is disabled, proceed without extra header
  }
  return {};
}

/**
 * Fetch stage details for a specific build using Jenkins Pipeline wfapi
 */
export async function fetchBuildStages(buildNumber: number): Promise<PipelineStage[]> {
  try {
    const jobName = encodeURIComponent(env.JENKINS_JOB_NAME);
    const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
    const url = `${baseUrl}/job/${jobName}/${buildNumber}/wfapi/describe`;

    const response = await fetch(url, {
      headers: getJenkinsAuthHeaders(),
    });

    if (!response.ok) {
      return getDefaultStages();
    }

    const data = (await response.json()) as {
      stages?: Array<{
        id: string;
        name: string;
        status: string;
        durationMillis: number;
      }>;
    };

    if (!data.stages || !Array.isArray(data.stages)) {
      return getDefaultStages();
    }

    return data.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      status: mapStageStatus(stage.status),
      durationMillis: stage.durationMillis || 0,
    }));
  } catch {
    return getDefaultStages();
  }
}

function mapStageStatus(
  status: string
): 'SUCCESS' | 'IN_PROGRESS' | 'FAILED' | 'PAUSED' | 'ABORTED' | 'PENDING' {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return 'SUCCESS';
    case 'IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'FAILED':
      return 'FAILED';
    case 'PAUSED':
      return 'PAUSED';
    case 'ABORTED':
      return 'ABORTED';
    default:
      return 'PENDING';
  }
}

function getDefaultStages(): PipelineStage[] {
  return [
    { id: '1', name: 'Checkout', status: 'PENDING', durationMillis: 0 },
    { id: '2', name: 'Install Dependencies', status: 'PENDING', durationMillis: 0 },
    { id: '3', name: 'Build Frontend', status: 'PENDING', durationMillis: 0 },
    { id: '4', name: 'Build Backend', status: 'PENDING', durationMillis: 0 },
  ];
}

/**
 * Fetch complete pipeline status and build list from Jenkins
 */
export async function getJenkinsPipelineStatus(): Promise<PipelineStatusResponse> {
  const jobName = encodeURIComponent(env.JENKINS_JOB_NAME);
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${jobName}/api/json?tree=name,url,color,lastBuild[number,url,timestamp,duration,result,building],builds[number,url,timestamp,duration,result,building]`;

  const response = await fetch(url, {
    headers: getJenkinsAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline status from Jenkins: ${response.statusText} (${response.status})`);
  }

  const data = (await response.json()) as {
    name: string;
    url: string;
    color: string;
    lastBuild?: {
      number: number;
      url: string;
      timestamp: number;
      duration: number;
      result: string | null;
      building: boolean;
    };
    builds?: Array<{
      number: number;
      url: string;
      timestamp: number;
      duration: number;
      result: string | null;
      building: boolean;
    }>;
  };

  const buildsList: BuildSummary[] = (data.builds || []).slice(0, 10).map((b) => ({
    number: b.number,
    url: b.url,
    status: mapJenkinsStatus(b.result, b.building),
    timestamp: b.timestamp,
    duration: b.duration,
  }));

  let latestBuild: BuildSummary | null = null;
  if (data.lastBuild) {
    const stages = await fetchBuildStages(data.lastBuild.number);
    const commitDetails = await fetchBuildCommitDetails(data.lastBuild.number);

    latestBuild = {
      number: data.lastBuild.number,
      url: data.lastBuild.url,
      status: mapJenkinsStatus(data.lastBuild.result, data.lastBuild.building),
      timestamp: data.lastBuild.timestamp,
      duration: data.lastBuild.duration,
      stages,
      commitMessage: commitDetails.commitMessage,
      author: commitDetails.author,
    };
  }

  const overallStatus = latestBuild ? latestBuild.status : 'NOT_BUILT';

  return {
    name: data.name || env.JENKINS_JOB_NAME,
    url: data.url || `${baseUrl}/job/${jobName}`,
    status: overallStatus,
    latestBuild,
    builds: buildsList,
  };
}

/**
 * Fetch specific commit details or cause for a build
 */
async function fetchBuildCommitDetails(
  buildNumber: number
): Promise<{ commitMessage?: string; author?: string }> {
  try {
    const jobName = encodeURIComponent(env.JENKINS_JOB_NAME);
    const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
    const url = `${baseUrl}/job/${jobName}/${buildNumber}/api/json?tree=changeSets[items[comment,author[fullName]]],actions[causes[shortDescription,userName]]`;

    const response = await fetch(url, {
      headers: getJenkinsAuthHeaders(),
    });

    if (!response.ok) return {};

    const data = (await response.json()) as {
      changeSets?: Array<{
        items?: Array<{
          comment?: string;
          author?: { fullName?: string };
        }>;
      }>;
      actions?: Array<{
        causes?: Array<{
          shortDescription?: string;
          userName?: string;
        }>;
      }>;
    };

    // Check change sets first (git commits)
    if (data.changeSets && data.changeSets.length > 0) {
      for (const cs of data.changeSets) {
        if (cs.items && cs.items.length > 0) {
          const lastItem = cs.items[cs.items.length - 1];
          return {
            commitMessage: lastItem.comment?.trim() || undefined,
            author: lastItem.author?.fullName || undefined,
          };
        }
      }
    }

    // Fall back to build causes (e.g. "Started by GitHub push by SammarGaikwad")
    if (data.actions) {
      for (const action of data.actions) {
        if (action.causes && action.causes.length > 0) {
          const cause = action.causes[0];
          return {
            commitMessage: cause.shortDescription,
            author: cause.userName,
          };
        }
      }
    }
  } catch {
    // Return empty on error
  }
  return {};
}

/**
 * Trigger a new build on Jenkins and return queue item details
 */
export async function triggerJenkinsBuild(): Promise<JenkinsTriggerBuildResponse> {
  const jobName = encodeURIComponent(env.JENKINS_JOB_NAME);
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${jobName}/build`;

  const authHeaders = getJenkinsAuthHeaders();
  const crumbHeader = await getJenkinsCrumbHeader();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
      ...crumbHeader,
    },
  });

  if (!response.ok && response.status !== 201) {
    throw new AppError(
      `Failed to trigger Jenkins build: ${response.statusText} (${response.status})`,
      502
    );
  }

  const locationHeader = response.headers.get('location');
  let queueItemUrl: string | undefined = undefined;
  let queueItemId: number | null = null;

  if (locationHeader) {
    queueItemUrl = locationHeader;
    const match = locationHeader.match(/\/queue\/item\/(\d+)\/?/);
    if (match && match[1]) {
      queueItemId = parseInt(match[1], 10);
    }
  }

  const buildUrl = `${baseUrl}/job/${jobName}`;

  return {
    message: 'Jenkins build triggered successfully',
    queueItemUrl,
    queueItemId,
    buildUrl,
  };
}

/**
 * Trigger a new build on Jenkins (backward compatibility)
 */
export async function triggerJenkinsPipeline(): Promise<{ message: string; buildUrl: string }> {
  const result = await triggerJenkinsBuild();
  return {
    message: result.message,
    buildUrl: result.buildUrl,
  };
}

/**
 * Fetch status, details, stages, and commit info for a specific Jenkins build ID
 */
export async function getJenkinsBuildById(
  buildNumber: number
): Promise<JenkinsBuildDetailsResponse> {
  const jobName = encodeURIComponent(env.JENKINS_JOB_NAME);
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${jobName}/${buildNumber}/api/json`;

  const response = await fetch(url, {
    headers: getJenkinsAuthHeaders(),
  });

  if (response.status === 404) {
    throw new AppError(`Jenkins build #${buildNumber} not found`, 404);
  }

  if (!response.ok) {
    throw new AppError(
      `Failed to fetch build status from Jenkins: ${response.statusText} (${response.status})`,
      502
    );
  }

  const data = (await response.json()) as {
    number: number;
    url: string;
    timestamp: number;
    duration: number;
    result: string | null;
    building: boolean;
  };

  const status = mapJenkinsStatus(data.result, data.building);
  const stages = await fetchBuildStages(buildNumber);
  const commitDetails = await fetchBuildCommitDetails(buildNumber);

  return {
    id: data.number,
    number: data.number,
    status,
    result: data.result,
    duration: data.duration,
    timestamp: data.timestamp,
    url: data.url || `${baseUrl}/job/${jobName}/${buildNumber}/`,
    commitMessage: commitDetails.commitMessage,
    author: commitDetails.author,
    stages,
  };
}

