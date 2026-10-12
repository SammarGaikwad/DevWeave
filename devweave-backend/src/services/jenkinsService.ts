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

export function getJenkinsAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (env.JENKINS_USERNAME && env.JENKINS_API_TOKEN) {
    const credentials = Buffer.from(`${env.JENKINS_USERNAME}:${env.JENKINS_API_TOKEN}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }
  return headers;
}

export function mapJenkinsStatus(
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

export function mapStageStatus(
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

/**
 * Fetch crumb for CSRF protection when making mutating POST calls to Jenkins
 */
export async function getJenkinsCrumbHeader(): Promise<Record<string, string>> {
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
 * Strips XML 1.0-invalid characters and disallowed control characters from input string.
 *
 * XML 1.0 specifies valid characters as:
 *   #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
 *
 * This function preserves:
 *   - Tab (\t, U+0009), Newline (\n, U+000A), Carriage return (\r, U+000D)
 *   - Printable ASCII (U+0020 - U+007E)
 *   - Valid non-ASCII Unicode (U+00A0 - U+D7FF, U+E000 - U+FFFD, U+10000 - U+10FFFF, e.g. accents, emojis 🚀)
 *
 * And removes:
 *   - C0 control characters (U+0000 - U+0008, U+000B - U+000C, U+000E - U+001F)
 *   - DEL and C1 control characters (U+007F - U+009F, including U+009F which caused Jenkins XML parse failure)
 *   - Noncharacters (U+FFFE, U+FFFF) and unpaired surrogates
 */
export function stripInvalidXmlChars(input: string): string {
  if (!input) return '';
  return input.replace(/[^\t\n\r\u0020-\u007E\u00A0-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '');
}

/**
 * Escapes text content for safe inclusion inside XML elements.
 *
 * Order of escaping:
 * 1. Remove XML-invalid characters and disallowed control characters (including U+009F).
 * 2. Escape '&' to '&amp;' ONLY when not already part of a valid XML entity (&amp;, &lt;, &gt;, &quot;, &apos;, &#..., &#x...).
 * 3. Escape '<' to '&lt;'.
 * 4. Escape '>' to '&gt;'.
 *
 * Valid newlines (\n, \r\n), indentation (\t), and script quotes are preserved.
 */
export function escapeXmlText(unsafe: string): string {
  if (!unsafe) return '';
  const sanitized = stripInvalidXmlChars(unsafe);
  return sanitized
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const escapeXml = escapeXmlText;

/**
 * Builds the Jenkins FlowDefinition XML config string for a pipeline script.
 */
export function buildJenkinsJobXml(
  declarativePipelineScript: string,
  description = 'DevWeave Automated Pipeline'
): string {
  const escapedScript = escapeXmlText(declarativePipelineScript);
  const escapedDescription = escapeXmlText(description);

  return `<?xml version="1.1" encoding="UTF-8"?>
<flow-definition plugin="workflow-job@1602.v2a_70b_80a_2396">
  <description>${escapedDescription}</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps@4383.v04fa_a_3d67b_d9">
    <script>${escapedScript}</script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>`;
}

/**
 * Ensure a Jenkins pipeline job exists with the given Declarative Pipeline script.
 * Creates it if missing, or updates it if it exists.
 */
export async function ensureJenkinsJob(jobName: string, declarativePipelineScript: string): Promise<void> {
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const authHeaders = getJenkinsAuthHeaders();
  const crumbHeader = await getJenkinsCrumbHeader();

  const xmlConfig = buildJenkinsJobXml(declarativePipelineScript);

  // 1. Check if job exists
  const checkUrl = `${baseUrl}/job/${encodeURIComponent(jobName)}/api/json`;
  const checkRes = await fetch(checkUrl, {
    headers: authHeaders,
  });

  if (checkRes.status === 200) {
    // Update existing job config
    const updateUrl = `${baseUrl}/job/${encodeURIComponent(jobName)}/config.xml`;
    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...crumbHeader,
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: xmlConfig,
    });

    if (!updateRes.ok) {
      throw new AppError(
        `Failed to update Jenkins job configuration: ${updateRes.statusText} (${updateRes.status})`,
        502
      );
    }
  } else if (checkRes.status === 404) {
    // Create new job
    const createUrl = `${baseUrl}/createItem?name=${encodeURIComponent(jobName)}`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...crumbHeader,
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: xmlConfig,
    });

    if (!createRes.ok && createRes.status !== 200) {
      throw new AppError(
        `Failed to create Jenkins job: ${createRes.statusText} (${createRes.status})`,
        502
      );
    }
  } else {
    throw new AppError(
      `Jenkins job verification failed: ${checkRes.statusText} (${checkRes.status})`,
      502
    );
  }
}

/**
 * Trigger a build for any named Jenkins job.
 */
export async function triggerJobBuild(jobName: string): Promise<{
  queueItemId: number | null;
  queueItemUrl: string | undefined;
  buildUrl: string;
}> {
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/build`;

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
      `Failed to trigger Jenkins build for job ${jobName}: ${response.statusText} (${response.status})`,
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

  return {
    queueItemId,
    queueItemUrl,
    buildUrl: `${baseUrl}/job/${encodeURIComponent(jobName)}`,
  };
}

/**
 * Resolve Jenkins queue item to determine build number or cancellation.
 */
export async function resolveQueueItem(queueItemId: number): Promise<{
  buildNumber: number | null;
  cancelled: boolean;
  why?: string;
}> {
  try {
    const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
    const url = `${baseUrl}/queue/item/${queueItemId}/api/json`;

    const response = await fetch(url, {
      headers: getJenkinsAuthHeaders(),
    });

    if (response.status === 404) {
      // Item left the queue (already assigned build number or expired)
      return { buildNumber: null, cancelled: false };
    }

    if (!response.ok) {
      return { buildNumber: null, cancelled: false };
    }

    const data = (await response.json()) as {
      cancelled?: boolean;
      why?: string;
      executable?: { number: number; url: string };
    };

    if (data.cancelled) {
      return { buildNumber: null, cancelled: true, why: data.why };
    }

    if (data.executable && typeof data.executable.number === 'number') {
      return { buildNumber: data.executable.number, cancelled: false };
    }

    return { buildNumber: null, cancelled: false, why: data.why };
  } catch {
    return { buildNumber: null, cancelled: false };
  }
}

/**
 * Fetch stage details for a specific build using Jenkins Pipeline wfapi
 */
export async function fetchBuildStagesForJob(
  jobName: string,
  buildNumber: number
): Promise<PipelineStage[]> {
  try {
    const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
    const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/wfapi/describe`;

    const response = await fetch(url, {
      headers: getJenkinsAuthHeaders(),
    });

    if (!response.ok) {
      return [];
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
      return [];
    }

    // Filter out internal Declarative wrapper stages if desired, or map all
    return data.stages
      .filter((s) => !s.name.startsWith('Declarative:'))
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        status: mapStageStatus(stage.status),
        durationMillis: stage.durationMillis || 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch detailed build metadata from Jenkins including stages and commits.
 */
export async function getJobBuildDetails(
  jobName: string,
  buildNumber: number
): Promise<BuildSummary> {
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`;

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
  const stages = await fetchBuildStagesForJob(jobName, buildNumber);
  const commitDetails = await fetchBuildCommitDetailsForJob(jobName, buildNumber);

  return {
    number: data.number,
    url: data.url || `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/`,
    status,
    timestamp: data.timestamp,
    duration: data.duration,
    commitMessage: commitDetails.commitMessage,
    author: commitDetails.author,
    stages,
  };
}

/**
 * Fetch console text logs for a Jenkins build and sanitize sensitive tokens.
 */
export async function fetchJobBuildLogs(jobName: string, buildNumber: number): Promise<string> {
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`;

  const response = await fetch(url, {
    headers: getJenkinsAuthHeaders(),
  });

  if (response.status === 404) {
    return 'Build logs are not yet available or build has not started execution.';
  }

  if (!response.ok) {
    throw new AppError(`Failed to fetch build logs from Jenkins: ${response.statusText}`, 502);
  }

  const rawLogs = await response.text();

  // Sanitize any possible tokens or sensitive credentials in logs
  return rawLogs
    .replace(/(ghp_[a-zA-Z0-9]{36})/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(x-access-token:[^@]+@)/gi, 'x-access-token:[REDACTED]@')
    .replace(/Authorization: Basic [a-zA-Z0-9=+/]+/gi, 'Authorization: Basic [REDACTED]');
}

/**
 * Fetch recent builds for a Jenkins job.
 */
export async function getJobRecentBuilds(jobName: string, limit = 10): Promise<BuildSummary[]> {
  try {
    const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
    const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/api/json?tree=builds[number,url,timestamp,duration,result,building]`;

    const response = await fetch(url, {
      headers: getJenkinsAuthHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      builds?: Array<{
        number: number;
        url: string;
        timestamp: number;
        duration: number;
        result: string | null;
        building: boolean;
      }>;
    };

    return (data.builds || []).slice(0, limit).map((b) => ({
      number: b.number,
      url: b.url,
      status: mapJenkinsStatus(b.result, b.building),
      timestamp: b.timestamp,
      duration: b.duration,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch specific commit details or cause for a build
 */
async function fetchBuildCommitDetailsForJob(
  jobName: string,
  buildNumber: number
): Promise<{ commitMessage?: string; author?: string }> {
  try {
    const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
    const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json?tree=changeSets[items[comment,author[fullName]]],actions[causes[shortDescription,userName]]`;

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

// ==========================================
// Backward compatibility functions for DevWeave-CI-CD
// ==========================================

export async function fetchBuildStages(buildNumber: number): Promise<PipelineStage[]> {
  const stages = await fetchBuildStagesForJob(env.JENKINS_JOB_NAME, buildNumber);
  if (stages.length === 0) {
    return getDefaultStages();
  }
  return stages;
}

function getDefaultStages(): PipelineStage[] {
  return [
    { id: '1', name: 'Checkout', status: 'PENDING', durationMillis: 0 },
    { id: '2', name: 'Install Dependencies', status: 'PENDING', durationMillis: 0 },
    { id: '3', name: 'Build Frontend', status: 'PENDING', durationMillis: 0 },
    { id: '4', name: 'Build Backend', status: 'PENDING', durationMillis: 0 },
  ];
}

export async function getJenkinsPipelineStatus(): Promise<PipelineStatusResponse> {
  const jobName = env.JENKINS_JOB_NAME;
  const baseUrl = env.JENKINS_URL.replace(/\/$/, '');
  const url = `${baseUrl}/job/${encodeURIComponent(jobName)}/api/json?tree=name,url,color,lastBuild[number,url,timestamp,duration,result,building],builds[number,url,timestamp,duration,result,building]`;

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
    const commitDetails = await fetchBuildCommitDetailsForJob(jobName, data.lastBuild.number);

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
    url: data.url || `${baseUrl}/job/${encodeURIComponent(jobName)}`,
    status: overallStatus,
    latestBuild,
    builds: buildsList,
  };
}

export async function triggerJenkinsBuild(): Promise<JenkinsTriggerBuildResponse> {
  const res = await triggerJobBuild(env.JENKINS_JOB_NAME);
  return {
    message: 'Jenkins build triggered successfully',
    queueItemUrl: res.queueItemUrl,
    queueItemId: res.queueItemId,
    buildUrl: res.buildUrl,
  };
}

export async function triggerJenkinsPipeline(): Promise<{ message: string; buildUrl: string }> {
  const result = await triggerJenkinsBuild();
  return {
    message: result.message,
    buildUrl: result.buildUrl,
  };
}

export async function getJenkinsBuildById(buildNumber: number): Promise<JenkinsBuildDetailsResponse> {
  const details = await getJobBuildDetails(env.JENKINS_JOB_NAME, buildNumber);
  return {
    id: details.number,
    number: details.number,
    status: details.status,
    result: details.status === 'BUILDING' ? null : details.status,
    duration: details.duration,
    timestamp: details.timestamp,
    url: details.url,
    commitMessage: details.commitMessage,
    author: details.author,
    stages: details.stages || [],
  };
}
