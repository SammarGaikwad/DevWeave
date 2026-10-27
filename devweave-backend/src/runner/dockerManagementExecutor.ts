import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RunnerConfig } from './dockerDesktopRunner.js';
import {
  PROTECTED_CONTAINERS,
  PROTECTED_NETWORKS,
  PROTECTED_VOLUMES,
  isProtectedImageFamily,
  resolveContainer,
  resolveNetwork,
  resolveImage,
  isImageProtected,
  type DockerInventorySnapshot,
} from '../services/dockerProtectionService.js';

const execFileAsync = promisify(execFile);

export interface ManagementJobPayload {
  id: string;
  jobType: 'MANAGEMENT';
  actionType: string;
  params: Record<string, any>;
}

export interface RunnerLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export type DockerRunnerExec = (args: string[], timeoutMs?: number) => Promise<{ stdout: string; stderr: string }>;

/**
 * Executes a Docker CLI command using execFile with strict argument arrays.
 * Never executes raw shell strings.
 */
async function runDocker(args: string[], timeoutMs = 30000): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', args, { timeout: timeoutMs, maxBuffer: 15 * 1024 * 1024 });
}

/**
 * Collects a full inventory snapshot from the local Docker daemon.
 */
export async function collectDockerInventory(dockerExecFn: DockerRunnerExec = runDocker): Promise<{
  containers: any[];
  images: any[];
  networks: any[];
  volumes: any[];
  lookupFailed?: boolean;
}> {
  try {
    const [psRes, imgRes, netRes, volRes] = await Promise.allSettled([
      dockerExecFn(['ps', '-a', '--no-trunc', '--format', '{{json .}}'], 5000),
      dockerExecFn(['images', '--no-trunc', '--format', '{{json .}}'], 5000),
      dockerExecFn(['network', 'ls', '--no-trunc', '--format', '{{json .}}'], 5000),
      dockerExecFn(['volume', 'ls', '--format', '{{json .}}'], 5000),
    ]);

    if (psRes.status === 'rejected') {
      return {
        containers: [],
        images: [],
        networks: [],
        volumes: [],
        lookupFailed: true,
      };
    }

    // Parse Containers
    const rawContainers: any[] = [];
    if (psRes.status === 'fulfilled' && psRes.value.stdout) {
      const lines = psRes.value.stdout.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          rawContainers.push(JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    }

    // Parse Images
    const rawImages: any[] = [];
    if (imgRes.status === 'fulfilled' && imgRes.value.stdout) {
      const lines = imgRes.value.stdout.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          rawImages.push(JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    }

    // Parse Networks
    const rawNetworks: any[] = [];
    if (netRes.status === 'fulfilled' && netRes.value.stdout) {
      const lines = netRes.value.stdout.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          rawNetworks.push(JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    }

    // Parse Volumes
    const rawVolumes: any[] = [];
    if (volRes.status === 'fulfilled' && volRes.value.stdout) {
      const lines = volRes.value.stdout.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          rawVolumes.push(JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    }

    // Transform Containers
    const containers = rawContainers.map((c) => {
      const name = (c.Names || '').replace(/^\//, '');
      const state = (c.State || 'exited').toLowerCase();
      return {
        id: c.ID || '',
        name,
        image: c.Image || '',
        status: c.Status || '',
        state,
        created: c.CreatedAt || '',
        ports: parsePortMappings(c.Ports || ''),
        rawNetworks: c.Networks || '',
        rawMounts: c.Mounts || '',
      };
    });

    // Transform Images & compute in-use containers
    const images = rawImages.map((img) => {
      const repo = img.Repository || '<none>';
      const tag = img.Tag || '<none>';
      const fullRef = repo !== '<none>' && tag !== '<none>' ? `${repo}:${tag}` : repo;
      const inUseByContainers = containers
        .filter((c) => {
          const cImg = (c.image || '').toLowerCase();
          const cleanImgId = (img.ID || '').toLowerCase().replace(/^sha256:/, '');
          const cleanCImg = cImg.replace(/^sha256:/, '');
          return (
            cImg === fullRef.toLowerCase() ||
            cImg === repo.toLowerCase() ||
            cleanCImg === cleanImgId ||
            (cleanImgId.length >= 12 && cleanCImg.length >= 12 && (cleanImgId.startsWith(cleanCImg) || cleanCImg.startsWith(cleanImgId)))
          );
        })
        .map((c) => c.name);

      return {
        id: img.ID || '',
        repository: repo,
        tag,
        size: img.Size || '',
        created: img.CreatedAt || '',
        inUseByContainers,
        isDangling: repo === '<none>' || tag === '<none>',
      };
    });

    // Transform Networks & compute connected containers
    const networks = rawNetworks.map((net) => {
      const netName = net.Name || '';
      const connectedContainers = containers
        .filter((c) => (c.rawNetworks || '').split(',').map((s: string) => s.trim()).includes(netName))
        .map((c) => c.name);

      return {
        id: net.ID || '',
        name: netName,
        driver: net.Driver || 'bridge',
        scope: net.Scope || 'local',
        containers: connectedContainers,
      };
    });

    // Transform Volumes & compute mounting containers
    const volumes = rawVolumes.map((vol) => {
      const volName = vol.Name || '';
      const inUseByContainers = containers
        .filter((c) => (c.rawMounts || '').includes(volName))
        .map((c) => c.name);

      return {
        name: volName,
        driver: vol.Driver || 'local',
        inUseByContainers,
      };
    });

    return {
      containers,
      images,
      networks,
      volumes,
      lookupFailed: false,
    };
  } catch {
    return {
      containers: [],
      images: [],
      networks: [],
      volumes: [],
      lookupFailed: true,
    };
  }
}

function parsePortMappings(portsStr: string): Array<{ hostPort?: number; containerPort: number; protocol: string }> {
  if (!portsStr) return [];
  const results: Array<{ hostPort?: number; containerPort: number; protocol: string }> = [];
  const entries = portsStr.split(',').map((s) => s.trim());
  for (const entry of entries) {
    const match = entry.match(/(?:(?:::|[0-9.]+):(\d+)->)?(\d+)\/([a-zA-Z]+)/);
    if (match) {
      results.push({
        hostPort: match[1] ? parseInt(match[1], 10) : undefined,
        containerPort: parseInt(match[2], 10),
        protocol: match[3] || 'tcp',
      });
    }
  }
  return results;
}

/**
 * Pushes the inventory snapshot to the backend API.
 */
export async function pushInventorySnapshot(
  config: RunnerConfig,
  inventory: { containers: any[]; images: any[]; networks: any[]; volumes: any[] },
  fetchFn: typeof fetch = fetch
): Promise<void> {
  try {
    await fetchFn(`${config.backendUrl}/api/v1/docker/runner/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify(inventory),
    });
  } catch {
    // Non-critical background telemetry sync failure
  }
}

async function getLiveRunnerInventory(dockerExecFn: DockerRunnerExec): Promise<DockerInventorySnapshot> {
  const inv = await collectDockerInventory(dockerExecFn);
  if (inv.lookupFailed) {
    throw new Error('Execution blocked: Docker daemon inventory lookup failed.');
  }
  return {
    containers: inv.containers,
    images: inv.images,
    networks: inv.networks,
    volumes: inv.volumes,
    updatedAt: new Date().toISOString(),
  };
}

function assertRunnerContainerNotProtected(
  nameOrId: string,
  operation: string,
  inventory: DockerInventorySnapshot
): void {
  const clean = (nameOrId || '').trim().replace(/^\//, '');
  if (!clean) {
    throw new Error(`Execution blocked: Missing container identifier for operation '${operation}'.`);
  }

  // 1. Static fast check
  if (PROTECTED_CONTAINERS.has(clean.toLowerCase())) {
    throw new Error(`Execution blocked: Container '${clean}' is a protected production resource.`);
  }

  // 2. Resolve against live daemon inventory
  const res = resolveContainer(clean, inventory.containers || []);
  if (res.isAmbiguous) {
    throw new Error(`Execution blocked: Ambiguous container identifier '${nameOrId}' matches multiple containers.`);
  }
  if (res.resolved) {
    const resolvedName = res.resolved.name.replace(/^\//, '').toLowerCase();
    if (PROTECTED_CONTAINERS.has(resolvedName)) {
      throw new Error(`Execution blocked: Container '${res.resolved.name}' is a protected production resource.`);
    }
  } else if (res.notFound) {
    for (const pc of PROTECTED_CONTAINERS) {
      if (pc.startsWith(clean.toLowerCase()) || clean.toLowerCase().startsWith(pc)) {
        throw new Error(`Execution blocked: Container '${nameOrId}' is a protected production resource.`);
      }
    }
    throw new Error(`Execution blocked: Target container '${nameOrId}' cannot be resolved reliably in Docker daemon inventory.`);
  }
}

function assertRunnerNetworkNotProtected(
  nameOrId: string,
  operation: string,
  inventory: DockerInventorySnapshot
): void {
  const clean = (nameOrId || '').trim();
  if (!clean) {
    throw new Error(`Execution blocked: Missing network identifier for operation '${operation}'.`);
  }

  // 1. Static fast check
  if (PROTECTED_NETWORKS.has(clean.toLowerCase())) {
    throw new Error(`Execution blocked: Network '${clean}' is a protected system network.`);
  }

  // 2. Resolve against live daemon inventory
  const res = resolveNetwork(clean, inventory.networks || []);
  if (res.isAmbiguous) {
    throw new Error(`Execution blocked: Ambiguous network identifier '${nameOrId}' matches multiple networks.`);
  }
  if (res.resolved) {
    const resolvedName = res.resolved.name.toLowerCase();
    if (PROTECTED_NETWORKS.has(resolvedName)) {
      throw new Error(`Execution blocked: Network '${res.resolved.name}' is a protected system network.`);
    }
  } else if (res.notFound) {
    for (const pn of PROTECTED_NETWORKS) {
      if (pn.startsWith(clean.toLowerCase()) || clean.toLowerCase().startsWith(pn)) {
        throw new Error(`Execution blocked: Network '${nameOrId}' is a protected system network.`);
      }
    }
    throw new Error(`Execution blocked: Target network '${nameOrId}' cannot be resolved reliably in Docker daemon inventory.`);
  }
}

function assertRunnerVolumeNotProtected(
  volumeName: string,
  operation: string,
  inventory: DockerInventorySnapshot
): void {
  const clean = (volumeName || '').trim();
  if (!clean) {
    throw new Error(`Execution blocked: Missing volume identifier for operation '${operation}'.`);
  }

  // 1. Static fast check
  if (PROTECTED_VOLUMES.has(clean.toLowerCase())) {
    throw new Error(`Execution blocked: Volume '${clean}' is a protected persistent volume.`);
  }

  const found = (inventory.volumes || []).find(
    (v) => v.name.toLowerCase() === clean.toLowerCase() || v.name.toLowerCase().startsWith(clean.toLowerCase())
  );
  if (found && PROTECTED_VOLUMES.has(found.name.toLowerCase())) {
    throw new Error(`Execution blocked: Volume '${found.name}' is a protected persistent volume.`);
  }
  if (!found) {
    for (const pv of PROTECTED_VOLUMES) {
      if (pv.startsWith(clean.toLowerCase()) || clean.toLowerCase().startsWith(pv)) {
        throw new Error(`Execution blocked: Volume '${volumeName}' is a protected persistent volume.`);
      }
    }
    throw new Error(`Execution blocked: Target volume '${volumeName}' cannot be resolved reliably in Docker daemon inventory.`);
  }
}

async function assertRunnerImageNotProtected(
  nameOrId: string,
  operation: string,
  inventory: DockerInventorySnapshot,
  dockerExecFn: DockerRunnerExec
): Promise<void> {
  const clean = (nameOrId || '').trim();
  if (!clean) {
    throw new Error(`Execution blocked: Missing image identifier for operation '${operation}'.`);
  }

  // 1. Static check
  if (isProtectedImageFamily(clean)) {
    throw new Error(`Execution blocked: Image '${clean}' belongs to protected image family.`);
  }

  // 2. Resolve against live inventory
  const res = resolveImage(clean, inventory.images || []);
  if (res.isAmbiguous) {
    throw new Error(`Execution blocked: Ambiguous image identifier '${nameOrId}' matches multiple images.`);
  }
  if (res.resolved) {
    const protCheck = isImageProtected(res.resolved, inventory);
    if (protCheck.protected) {
      throw new Error(`Execution blocked: Image '${res.resolved.repository}:${res.resolved.tag}' is protected (${protCheck.reason}).`);
    }
  } else if (res.notFound) {
    // Attempt fallback daemon inspect for ID or digest verification
    try {
      const inspectRes = await dockerExecFn(['image', 'inspect', clean]);
      const parsed = JSON.parse(inspectRes.stdout);
      const details = parsed[0] || parsed;
      const repoTags: string[] = details.RepoTags || [];
      const repoDigests: string[] = details.RepoDigests || [];
      for (const tag of repoTags) {
        if (isProtectedImageFamily(tag)) {
          throw new Error(`Execution blocked: Image '${clean}' resolves to protected family '${tag}'.`);
        }
      }
      for (const digest of repoDigests) {
        if (isProtectedImageFamily(digest)) {
          throw new Error(`Execution blocked: Image '${clean}' resolves to protected digest '${digest}'.`);
        }
      }
      const inspectId = (details.Id || '').replace(/^sha256:/, '').toLowerCase();
      for (const c of inventory.containers || []) {
        if (PROTECTED_CONTAINERS.has(c.name.toLowerCase().replace(/^\//, ''))) {
          const cImgId = (c.imageId || '').replace(/^sha256:/, '').toLowerCase();
          if (inspectId && (inspectId === cImgId || inspectId.startsWith(cImgId) || cImgId.startsWith(inspectId))) {
            throw new Error(`Execution blocked: Image '${clean}' is locked by protected container '${c.name}'.`);
          }
        }
      }
    } catch (err: any) {
      if (err.message?.startsWith('Execution blocked:')) {
        throw err;
      }
      throw new Error(`Execution blocked: Target image '${nameOrId}' cannot be resolved reliably in Docker daemon inventory.`);
    }
  }
}

function assertRunnerImagePruneNotProtected(operation: string, inventory: DockerInventorySnapshot): void {
  const danglingImages = (inventory.images || []).filter((img) => img.isDangling);
  for (const dImg of danglingImages) {
    const protCheck = isImageProtected(dImg, inventory);
    if (protCheck.protected) {
      throw new Error(`Execution blocked: Operation '${operation}' rejected because dangling image '${dImg.id}' is protected (${protCheck.reason}).`);
    }
  }
}

/**
 * Executes a management job dispatched from the backend.
 */
export async function executeManagementJob(
  job: ManagementJobPayload,
  config: RunnerConfig,
  logger: RunnerLogger = console,
  fetchFn: typeof fetch = fetch,
  dockerExecFn: DockerRunnerExec = runDocker
): Promise<void> {
  const { id, actionType, params } = job;
  logger.info(`[Management Job ${id}] Executing ${actionType} with params: ${JSON.stringify(params)}`);

  const reportComplete = async (success: boolean, data?: any, error?: string) => {
    try {
      await fetchFn(`${config.backendUrl}/api/v1/docker/runner/jobs/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.runnerToken}`,
        },
        body: JSON.stringify({
          runnerId: config.runnerId,
          success,
          data,
          error,
        }),
      });
    } catch (reportErr: any) {
      logger.error(`[Management Job ${id}] Failed to report completion to backend: ${reportErr.message}`);
    }
  };

  try {
    let resultData: any = null;

    switch (actionType) {
      case 'CONTAINER_START': {
        const { containerId } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerContainerNotProtected(containerId, 'START', inventory);
        await dockerExecFn(['start', containerId]);
        resultData = { started: true, containerId };
        break;
      }

      case 'CONTAINER_STOP': {
        const { containerId, timeoutSeconds } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerContainerNotProtected(containerId, 'STOP', inventory);
        const timeout = Math.min(Math.max(timeoutSeconds || 10, 1), 60);
        await dockerExecFn(['stop', '-t', String(timeout), containerId]);
        resultData = { stopped: true, containerId };
        break;
      }

      case 'CONTAINER_RESTART': {
        const { containerId, timeoutSeconds } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerContainerNotProtected(containerId, 'RESTART', inventory);
        const timeout = Math.min(Math.max(timeoutSeconds || 10, 1), 60);
        await dockerExecFn(['restart', '-t', String(timeout), containerId]);
        resultData = { restarted: true, containerId };
        break;
      }

      case 'CONTAINER_DELETE': {
        const { containerId, stopFirst } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerContainerNotProtected(containerId, 'DELETE', inventory);
        if (stopFirst) {
          try {
            await dockerExecFn(['stop', '-t', '5', containerId]);
          } catch {
            // Container might already be stopped
          }
        }
        await dockerExecFn(['rm', containerId]);
        resultData = { deleted: true, containerId };
        break;
      }

      case 'CONTAINER_CREATE': {
        const { name, image, ports, envVars, volumes, network, restartPolicy, command } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);

        if (name) {
          const normName = name.replace(/^\//, '').toLowerCase();
          if (PROTECTED_CONTAINERS.has(normName)) {
            throw new Error(`Execution blocked: Container name '${name}' is reserved for a protected system container.`);
          }
          const existing = (inventory.containers || []).find(
            (c) => c.name.replace(/^\//, '').toLowerCase() === normName
          );
          if (existing) {
            throw new Error(`Execution blocked: A container named '${name}' already exists in Docker daemon inventory.`);
          }
        }

        const cleanImage = (image || '').trim();
        if (!cleanImage) {
          throw new Error('Execution blocked: Image reference is required.');
        }

        // Verify image exists locally or safely pull it
        let imageExistsLocally = false;
        try {
          await dockerExecFn(['image', 'inspect', cleanImage], 10000);
          imageExistsLocally = true;
        } catch {
          imageExistsLocally = false;
        }

        if (!imageExistsLocally) {
          logger.info(`[Management Job ${id}] Image '${cleanImage}' not found locally. Attempting to pull...`);
          try {
            await dockerExecFn(['pull', cleanImage], 120000);
            logger.info(`[Management Job ${id}] Successfully pulled image '${cleanImage}'.`);
          } catch (pullErr: any) {
            const pullStderr = pullErr?.stderr ? `: ${pullErr.stderr.trim()}` : (pullErr?.message ? `: ${pullErr.message}` : '');
            throw new Error(`Execution blocked: Failed to pull image '${cleanImage}'${pullStderr}`);
          }
        }

        if (network && network !== 'default' && network !== 'bridge' && network !== 'host' && network !== 'none') {
          const netExists = (inventory.networks || []).some(
            (n) => n.name.toLowerCase() === network.toLowerCase() || n.id.toLowerCase().startsWith(network.toLowerCase())
          );
          if (!netExists) {
            throw new Error(`Execution blocked: Network '${network}' does not exist in Docker daemon inventory.`);
          }
        }

        const args = ['run', '-d'];
        if (name) {
          args.push('--name', name);
        }
        if (restartPolicy && restartPolicy !== 'no') {
          args.push('--restart', restartPolicy);
        }
        if (network && network !== 'default') {
          args.push('--network', network);
        }

        if (Array.isArray(ports)) {
          for (const p of ports) {
            if (p.containerPort) {
              const proto = p.protocol ? `/${p.protocol}` : '';
              if (p.hostPort) {
                args.push('-p', `${p.hostPort}:${p.containerPort}${proto}`);
              } else {
                args.push('-p', `${p.containerPort}${proto}`);
              }
            }
          }
        }

        const effectiveEnv = Array.isArray(envVars) && envVars.length > 0 ? envVars : (Array.isArray(params.env) ? params.env : []);
        for (const ev of effectiveEnv) {
          if (ev.key) {
            args.push('-e', `${ev.key}=${ev.value || ''}`);
          }
        }

        if (Array.isArray(volumes)) {
          for (const v of volumes) {
            const hostVol = v.hostVolumeOrPath || v.hostPathOrVolume;
            if (hostVol && v.containerPath) {
              const mode = v.mode ? `:${v.mode}` : (v.readOnly ? ':ro' : '');
              args.push('-v', `${hostVol}:${v.containerPath}${mode}`);
            }
          }
        }

        args.push(cleanImage);
        if (command) {
          if (Array.isArray(command)) {
            args.push(...command);
          } else if (typeof command === 'string' && command.trim()) {
            args.push(...command.trim().split(/\s+/));
          }
        }

        const { stdout } = await dockerExecFn(args, 60000);
        const newId = stdout.trim().substring(0, 12);
        resultData = { created: true, containerId: newId, name };
        break;
      }

      case 'CONTAINER_RECREATE': {
        const { containerId, image, ports, envVars, volumes, network, restartPolicy, command } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerContainerNotProtected(containerId, 'RECREATE', inventory);

        // Step 1: Inspect old container to get existing name and defaults
        const inspectRes = await dockerExecFn(['inspect', containerId]);
        const parsedInspect = JSON.parse(inspectRes.stdout);
        const details = parsedInspect[0] || parsedInspect;
        const oldName = (details.Name || '').replace(/^\//, '');
        assertRunnerContainerNotProtected(oldName, 'RECREATE', inventory);

        if (params.name) {
          const normNew = params.name.replace(/^\//, '').toLowerCase();
          if (PROTECTED_CONTAINERS.has(normNew)) {
            throw new Error(`Execution blocked: Container name '${params.name}' is reserved for a protected system container.`);
          }
          if (normNew !== oldName.toLowerCase()) {
            const existing = (inventory.containers || []).find(
              (c) => c.name.replace(/^\//, '').toLowerCase() === normNew
            );
            if (existing) {
              throw new Error(`Execution blocked: A container named '${params.name}' already exists.`);
            }
          }
        }

        // Step 2: Gracefully stop old container
        try {
          await dockerExecFn(['stop', '-t', '10', containerId]);
        } catch {
          // May already be stopped
        }

        // Step 3: Remove old container
        await dockerExecFn(['rm', containerId]);

        // Step 4: Run new container with updated parameters
        const targetName = params.name || oldName;
        const runArgs = ['run', '-d', '--name', targetName];
        const effectiveRestart = restartPolicy || details.HostConfig?.RestartPolicy?.Name || 'unless-stopped';
        if (effectiveRestart && effectiveRestart !== 'no') {
          runArgs.push('--restart', effectiveRestart);
        }

        const effectiveNet = network || details.HostConfig?.NetworkMode || 'bridge';
        if (effectiveNet && effectiveNet !== 'default') {
          runArgs.push('--network', effectiveNet);
        }

        if (Array.isArray(ports)) {
          for (const p of ports) {
            if (p.containerPort) {
              const proto = p.protocol ? `/${p.protocol}` : '';
              if (p.hostPort) {
                runArgs.push('-p', `${p.hostPort}:${p.containerPort}${proto}`);
              } else {
                runArgs.push('-p', `${p.containerPort}${proto}`);
              }
            }
          }
        }

        if (Array.isArray(envVars)) {
          for (const ev of envVars) {
            if (ev.key) {
              runArgs.push('-e', `${ev.key}=${ev.value || ''}`);
            }
          }
        }

        if (Array.isArray(volumes)) {
          for (const v of volumes) {
            if (v.hostVolumeOrPath && v.containerPath) {
              const mode = v.mode ? `:${v.mode}` : '';
              runArgs.push('-v', `${v.hostVolumeOrPath}:${v.containerPath}${mode}`);
            }
          }
        }

        const targetImage = image || details.Config?.Image;
        runArgs.push(targetImage);

        if (command) {
          if (Array.isArray(command)) {
            runArgs.push(...command);
          } else if (typeof command === 'string' && command.trim()) {
            runArgs.push(...command.trim().split(/\s+/));
          }
        }

        const createRes = await dockerExecFn(runArgs);
        resultData = { recreated: true, containerId: createRes.stdout.trim().substring(0, 12), name: oldName };
        break;
      }

      case 'CONTAINER_LOGS': {
        const { containerId, tail, timestamps } = params;
        const tailCount = Math.min(Math.max(tail || 200, 10), 2000);
        const logArgs = ['logs', '--tail', String(tailCount)];
        if (timestamps) logArgs.push('-t');
        logArgs.push(containerId);

        const { stdout, stderr } = await dockerExecFn(logArgs);
        resultData = { logs: stdout + (stderr ? '\n' + stderr : '') };
        break;
      }

      case 'CONTAINER_INSPECT': {
        const { containerId } = params;
        const { stdout } = await dockerExecFn(['inspect', containerId]);
        const parsed = JSON.parse(stdout);
        resultData = parsed[0] || parsed;
        break;
      }

      case 'IMAGE_TAG': {
        const { sourceImage, targetImage } = params;
        await dockerExecFn(['tag', sourceImage, targetImage]);
        resultData = { tagged: true, sourceImage, targetImage };
        break;
      }

      case 'IMAGE_DELETE': {
        const { imageIdOrTag } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        await assertRunnerImageNotProtected(imageIdOrTag, 'DELETE', inventory, dockerExecFn);
        await dockerExecFn(['rmi', imageIdOrTag]);
        resultData = { deleted: true, imageIdOrTag };
        break;
      }

      case 'IMAGE_PRUNE_DANGLING': {
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerImagePruneNotProtected('PRUNE', inventory);
        const { stdout } = await dockerExecFn(['image', 'prune', '-f']);
        resultData = { pruned: true, output: stdout.trim() };
        break;
      }

      case 'NETWORK_CREATE': {
        const { name, driver, options } = params;
        if (name && PROTECTED_NETWORKS.has(name.toLowerCase())) {
          throw new Error(`Execution blocked: Network name '${name}' is reserved for a protected system network.`);
        }
        const args = ['network', 'create', '--driver', driver || 'bridge'];
        if (options && typeof options === 'object') {
          for (const [k, v] of Object.entries(options)) {
            args.push('-o', `${k}=${v}`);
          }
        }
        args.push(name);
        await dockerExecFn(args);
        resultData = { created: true, name };
        break;
      }

      case 'NETWORK_DELETE': {
        const { networkIdOrName } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerNetworkNotProtected(networkIdOrName, 'DELETE', inventory);
        await dockerExecFn(['network', 'rm', networkIdOrName]);
        resultData = { deleted: true, networkIdOrName };
        break;
      }

      case 'NETWORK_CONNECT': {
        const { networkIdOrName, containerId } = params;
        await dockerExecFn(['network', 'connect', networkIdOrName, containerId]);
        resultData = { connected: true, networkIdOrName, containerId };
        break;
      }

      case 'NETWORK_DISCONNECT': {
        const { networkIdOrName, containerId } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerNetworkNotProtected(networkIdOrName, 'DISCONNECT', inventory);
        assertRunnerContainerNotProtected(containerId, 'DISCONNECT', inventory);
        await dockerExecFn(['network', 'disconnect', networkIdOrName, containerId]);
        resultData = { disconnected: true, networkIdOrName, containerId };
        break;
      }

      case 'VOLUME_CREATE': {
        const { name, driver, labels } = params;
        if (name && PROTECTED_VOLUMES.has(name.toLowerCase())) {
          throw new Error(`Execution blocked: Volume name '${name}' is reserved for a protected system volume.`);
        }
        const args = ['volume', 'create', '--driver', driver || 'local'];
        if (labels && typeof labels === 'object') {
          for (const [k, v] of Object.entries(labels)) {
            args.push('--label', `${k}=${v}`);
          }
        }
        args.push(name);
        await dockerExecFn(args);
        resultData = { created: true, name };
        break;
      }

      case 'VOLUME_DELETE': {
        const { volumeName } = params;
        const inventory = await getLiveRunnerInventory(dockerExecFn);
        assertRunnerVolumeNotProtected(volumeName, 'DELETE', inventory);
        await dockerExecFn(['volume', 'rm', volumeName]);
        resultData = { deleted: true, volumeName };
        break;
      }

      default:
        throw new Error(`Unsupported management action type: ${actionType}`);
    }

    logger.info(`[Management Job ${id}] Succeeded.`);
    await reportComplete(true, resultData);

    // Refresh inventory snapshot immediately after executing state-changing action
    try {
      const inv = await collectDockerInventory(dockerExecFn);
      await pushInventorySnapshot(config, inv, fetchFn);
    } catch {
      // background refresh error ignored
    }
  } catch (error: any) {
    const errMsg = error?.stderr ? `${error.message}: ${error.stderr.trim()}` : error?.message || String(error);
    logger.error(`[Management Job ${id}] Failed: ${errMsg}`);
    await reportComplete(false, undefined, errMsg);
  }
}
