import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type {
  KubernetesInventorySnapshot,
  KubernetesManagementJob,
} from '../services/kubernetesManagementService.js';
import {
  PROTECTED_K8S_NAMESPACES,
  maskSecretData,
} from '../services/kubernetesProtectionService.js';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);

export type ExecFileFn = (
  file: string,
  args: string[],
  options?: { timeout?: number; maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

export const defaultExecFileFn: ExecFileFn = (file, args, options) =>
  execFileAsync(file, args, {
    timeout: options?.timeout ?? 20000,
    maxBuffer: options?.maxBuffer ?? 5 * 1024 * 1024,
  });

function calculateAge(creationTimestamp?: string): string {
  if (!creationTimestamp) return 'unknown';
  const diff = Date.now() - new Date(creationTimestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Safely collects live cluster inventory using read-only JSON queries.
 */
export async function collectKubernetesInventory(
  execFn: ExecFileFn = defaultExecFileFn,
): Promise<KubernetesInventorySnapshot> {
  const emptySnapshot: KubernetesInventorySnapshot = {
    clusterConnected: false,
    context: null,
    serverVersion: null,
    clientVersion: null,
    endpoint: null,
    namespaces: [],
    nodes: [],
    deployments: [],
    pods: [],
    statefulSets: [],
    daemonSets: [],
    replicaSets: [],
    jobs: [],
    cronJobs: [],
    services: [],
    ingresses: [],
    networkPolicies: [],
    configMaps: [],
    secrets: [],
    serviceAccounts: [],
    persistentVolumeClaims: [],
    persistentVolumes: [],
    storageClasses: [],
    events: [],
    updatedAt: new Date().toISOString(),
  };

  // 1. Check current-context
  let currentContext: string | null = null;
  try {
    const { stdout } = await execFn('kubectl', ['config', 'current-context'], { timeout: 3000 });
    currentContext = stdout.trim() || null;
  } catch {
    return emptySnapshot;
  }

  if (!currentContext) {
    return emptySnapshot;
  }

  // 2. Check cluster-info to verify live connectivity
  let clusterEndpoint: string | null = null;
  try {
    const { stdout } = await execFn('kubectl', ['cluster-info', '--request-timeout=3s'], { timeout: 4000 });
    const match = stdout.match(/https?:\/\/[^\s]+/);
    clusterEndpoint = match ? match[0] : null;
  } catch {
    return {
      ...emptySnapshot,
      context: currentContext,
    };
  }

  // 3. Query versions
  let clientVersion: string | null = null;
  let serverVersion: string | null = null;
  try {
    const { stdout } = await execFn('kubectl', ['version', '--output=json'], { timeout: 4000 });
    const parsed = JSON.parse(stdout);
    clientVersion = parsed.clientVersion?.gitVersion || null;
    serverVersion = parsed.serverVersion?.gitVersion || 'Connected';
  } catch {
    serverVersion = 'Connected';
  }

  // 4. Safely query resources via json output
  const fetchJson = async (resourceArgs: string[]): Promise<any[]> => {
    try {
      const { stdout } = await execFn('kubectl', ['get', ...resourceArgs, '-o', 'json'], { timeout: 8000 });
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
  };

  const [
    rawNamespaces,
    rawNodes,
    rawDeployments,
    rawPods,
    rawServices,
    rawIngresses,
    rawConfigMaps,
    rawSecrets,
    rawStatefulSets,
    rawDaemonSets,
    rawReplicaSets,
    rawJobs,
    rawCronJobs,
    rawPvcs,
    rawPvs,
    rawStorageClasses,
    rawServiceAccounts,
    rawNetworkPolicies,
    rawEvents,
  ] = await Promise.all([
    fetchJson(['namespaces']),
    fetchJson(['nodes']),
    fetchJson(['deployments', '-A']),
    fetchJson(['pods', '-A']),
    fetchJson(['services', '-A']),
    fetchJson(['ingresses', '-A']),
    fetchJson(['configmaps', '-A']),
    fetchJson(['secrets', '-A']),
    fetchJson(['statefulsets', '-A']),
    fetchJson(['daemonsets', '-A']),
    fetchJson(['replicasets', '-A']),
    fetchJson(['jobs', '-A']),
    fetchJson(['cronjobs', '-A']),
    fetchJson(['pvc', '-A']),
    fetchJson(['pv']),
    fetchJson(['storageclasses']),
    fetchJson(['serviceaccounts', '-A']),
    fetchJson(['networkpolicies', '-A']),
    fetchJson(['events', '-A']),
  ]);

  // Format Namespaces
  const namespaces = rawNamespaces.map((ns) => ({
    name: ns.metadata?.name || 'unknown',
    status: ns.status?.phase || 'Active',
    age: calculateAge(ns.metadata?.creationTimestamp),
    isProtected: PROTECTED_K8S_NAMESPACES.has((ns.metadata?.name || '').toLowerCase()),
  }));

  // Format Nodes
  const nodes = rawNodes.map((n) => {
    const isReady = n.status?.conditions?.some(
      (c: any) => c.type === 'Ready' && c.status === 'True'
    );
    const roles: string[] = [];
    if (n.metadata?.labels) {
      for (const key of Object.keys(n.metadata.labels)) {
        if (key.startsWith('node-role.kubernetes.io/')) {
          roles.push(key.replace('node-role.kubernetes.io/', ''));
        }
      }
    }
    if (roles.length === 0) roles.push('worker');

    const internalIP = n.status?.addresses?.find((a: any) => a.type === 'InternalIP')?.address;

    return {
      name: n.metadata?.name || 'unknown',
      status: isReady ? 'Ready' : 'NotReady',
      roles,
      age: calculateAge(n.metadata?.creationTimestamp),
      version: n.status?.nodeInfo?.kubeletVersion || 'unknown',
      internalIP,
      cpuCapacity: n.status?.capacity?.cpu,
      memoryCapacity: n.status?.capacity?.memory,
      conditions: (n.status?.conditions || []).map((c: any) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
      })),
    };
  });

  // Format Deployments
  const deployments = rawDeployments.map((d) => {
    const containers = d.spec?.template?.spec?.containers || [];
    return {
      name: d.metadata?.name || 'unknown',
      namespace: d.metadata?.namespace || 'default',
      replicas: d.spec?.replicas ?? 0,
      readyReplicas: d.status?.readyReplicas ?? 0,
      availableReplicas: d.status?.availableReplicas ?? 0,
      updatedReplicas: d.status?.updatedReplicas ?? 0,
      age: calculateAge(d.metadata?.creationTimestamp),
      images: containers.map((c: any) => c.image),
      selector: d.spec?.selector?.matchLabels || {},
      conditions: (d.status?.conditions || []).map((c: any) => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
      })),
    };
  });

  // Format Pods
  const pods = rawPods.map((p) => {
    const containerStatuses = p.status?.containerStatuses || [];
    const containers = p.spec?.containers || [];
    const readyCount = containerStatuses.filter((c: any) => c.ready).length;
    const restarts = containerStatuses.reduce((acc: number, c: any) => acc + (c.restartCount || 0), 0);

    return {
      name: p.metadata?.name || 'unknown',
      namespace: p.metadata?.namespace || 'default',
      phase: p.status?.phase || 'Unknown',
      status: p.status?.phase || 'Unknown',
      readyContainers: readyCount,
      totalContainers: containers.length,
      restarts,
      age: calculateAge(p.metadata?.creationTimestamp),
      ip: p.status?.podIP,
      node: p.spec?.nodeName,
      images: containers.map((c: any) => c.image),
      containers: containerStatuses.map((cs: any) => ({
        name: cs.name,
        image: cs.image,
        ready: cs.ready,
        restartCount: cs.restartCount || 0,
      })),
    };
  });

  // Format Services
  const services = rawServices.map((s) => ({
    name: s.metadata?.name || 'unknown',
    namespace: s.metadata?.namespace || 'default',
    type: s.spec?.type || 'ClusterIP',
    clusterIP: s.spec?.clusterIP || 'None',
    externalIP: s.status?.loadBalancer?.ingress?.[0]?.ip || s.status?.loadBalancer?.ingress?.[0]?.hostname,
    ports: (s.spec?.ports || []).map((p: any) => ({
      name: p.name,
      port: p.port,
      targetPort: p.targetPort,
      protocol: p.protocol || 'TCP',
      nodePort: p.nodePort,
    })),
    age: calculateAge(s.metadata?.creationTimestamp),
    selector: s.spec?.selector,
    isProtected: s.metadata?.name === 'kubernetes' && (s.metadata?.namespace === 'default' || !s.metadata?.namespace),
  }));

  // Format Ingresses
  const ingresses = rawIngresses.map((ing) => {
    const hosts: string[] = [];
    (ing.spec?.rules || []).forEach((r: any) => {
      if (r.host) hosts.push(r.host);
    });
    return {
      name: ing.metadata?.name || 'unknown',
      namespace: ing.metadata?.namespace || 'default',
      hosts: hosts.length > 0 ? hosts : ['*'],
      address: ing.status?.loadBalancer?.ingress?.[0]?.ip || ing.status?.loadBalancer?.ingress?.[0]?.hostname,
      ports: '80, 443',
      age: calculateAge(ing.metadata?.creationTimestamp),
    };
  });

  // Format ConfigMaps
  const configMaps = rawConfigMaps.map((cm) => {
    const keys = cm.data ? Object.keys(cm.data) : [];
    return {
      name: cm.metadata?.name || 'unknown',
      namespace: cm.metadata?.namespace || 'default',
      dataCount: keys.length,
      keys,
      age: calculateAge(cm.metadata?.creationTimestamp),
    };
  });

  // Format Secrets (MASK VALUES! Never expose secrets in inventory)
  const secrets = rawSecrets.map((sec) => {
    const keys = sec.data ? Object.keys(sec.data) : (sec.stringData ? Object.keys(sec.stringData) : []);
    return {
      name: sec.metadata?.name || 'unknown',
      namespace: sec.metadata?.namespace || 'default',
      type: sec.type || 'Opaque',
      dataCount: keys.length,
      keys,
      age: calculateAge(sec.metadata?.creationTimestamp),
    };
  });

  // Format StatefulSets
  const statefulSets = rawStatefulSets.map((ss) => ({
    name: ss.metadata?.name || 'unknown',
    namespace: ss.metadata?.namespace || 'default',
    replicas: ss.spec?.replicas ?? 0,
    readyReplicas: ss.status?.readyReplicas ?? 0,
    age: calculateAge(ss.metadata?.creationTimestamp),
    images: (ss.spec?.template?.spec?.containers || []).map((c: any) => c.image),
  }));

  // Format DaemonSets
  const daemonSets = rawDaemonSets.map((ds) => ({
    name: ds.metadata?.name || 'unknown',
    namespace: ds.metadata?.namespace || 'default',
    desired: ds.status?.desiredNumberScheduled ?? 0,
    current: ds.status?.currentNumberScheduled ?? 0,
    ready: ds.status?.numberReady ?? 0,
    age: calculateAge(ds.metadata?.creationTimestamp),
    images: (ds.spec?.template?.spec?.containers || []).map((c: any) => c.image),
  }));

  // Format ReplicaSets
  const replicaSets = rawReplicaSets.map((rs) => ({
    name: rs.metadata?.name || 'unknown',
    namespace: rs.metadata?.namespace || 'default',
    desired: rs.spec?.replicas ?? 0,
    current: rs.status?.replicas ?? 0,
    ready: rs.status?.readyReplicas ?? 0,
    age: calculateAge(rs.metadata?.creationTimestamp),
  }));

  // Format Jobs
  const jobs = rawJobs.map((j) => ({
    name: j.metadata?.name || 'unknown',
    namespace: j.metadata?.namespace || 'default',
    completions: `${j.status?.succeeded ?? 0}/${j.spec?.completions ?? 1}`,
    duration: j.status?.startTime && j.status?.completionTime ? `${Math.round((new Date(j.status.completionTime).getTime() - new Date(j.status.startTime).getTime()) / 1000)}s` : undefined,
    age: calculateAge(j.metadata?.creationTimestamp),
    active: j.status?.active ?? 0,
    succeeded: j.status?.succeeded ?? 0,
    failed: j.status?.failed ?? 0,
  }));

  // Format CronJobs
  const cronJobs = rawCronJobs.map((cj) => ({
    name: cj.metadata?.name || 'unknown',
    namespace: cj.metadata?.namespace || 'default',
    schedule: cj.spec?.schedule || '* * * * *',
    suspend: cj.spec?.suspend || false,
    active: cj.status?.active?.length ?? 0,
    lastSchedule: cj.status?.lastScheduleTime,
    age: calculateAge(cj.metadata?.creationTimestamp),
  }));

  // Format PVCs
  const persistentVolumeClaims = rawPvcs.map((pvc) => ({
    name: pvc.metadata?.name || 'unknown',
    namespace: pvc.metadata?.namespace || 'default',
    status: pvc.status?.phase || 'Pending',
    volume: pvc.spec?.volumeName,
    capacity: pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage,
    accessModes: pvc.spec?.accessModes || [],
    storageClass: pvc.spec?.storageClassName,
    age: calculateAge(pvc.metadata?.creationTimestamp),
  }));

  // Format PVs
  const persistentVolumes = rawPvs.map((pv) => ({
    name: pv.metadata?.name || 'unknown',
    capacity: pv.spec?.capacity?.storage || 'unknown',
    accessModes: pv.spec?.accessModes || [],
    reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy || 'Retain',
    status: pv.status?.phase || 'Available',
    claim: pv.spec?.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : undefined,
    storageClass: pv.spec?.storageClassName,
    age: calculateAge(pv.metadata?.creationTimestamp),
  }));

  // Format StorageClasses
  const storageClasses = rawStorageClasses.map((sc) => ({
    name: sc.metadata?.name || 'unknown',
    provisioner: sc.provisioner || 'unknown',
    reclaimPolicy: sc.reclaimPolicy,
    volumeBindingMode: sc.volumeBindingMode,
    age: calculateAge(sc.metadata?.creationTimestamp),
  }));

  // Format ServiceAccounts
  const serviceAccounts = rawServiceAccounts.map((sa) => ({
    name: sa.metadata?.name || 'unknown',
    namespace: sa.metadata?.namespace || 'default',
    secretsCount: sa.secrets?.length ?? 0,
    age: calculateAge(sa.metadata?.creationTimestamp),
  }));

  // Format NetworkPolicies
  const networkPolicies = rawNetworkPolicies.map((np) => ({
    name: np.metadata?.name || 'unknown',
    namespace: np.metadata?.namespace || 'default',
    podSelector: JSON.stringify(np.spec?.podSelector?.matchLabels || {}),
    policyTypes: np.spec?.policyTypes || ['Ingress'],
    age: calculateAge(np.metadata?.creationTimestamp),
  }));

  // Format Events
  const events = rawEvents.slice(0, 100).map((ev) => ({
    type: ev.type || 'Normal',
    reason: ev.reason || 'Unknown',
    object: `${ev.involvedObject?.kind || 'Resource'}/${ev.involvedObject?.name || 'unknown'}`,
    message: ev.message || '',
    count: ev.count || 1,
    lastTimestamp: ev.lastTimestamp || ev.eventTime || ev.metadata?.creationTimestamp || new Date().toISOString(),
    namespace: ev.metadata?.namespace || 'default',
  }));

  return {
    clusterConnected: true,
    context: currentContext,
    serverVersion,
    clientVersion,
    endpoint: clusterEndpoint,
    namespaces,
    nodes,
    deployments,
    pods,
    statefulSets,
    daemonSets,
    replicaSets,
    jobs,
    cronJobs,
    services,
    ingresses,
    networkPolicies,
    configMaps,
    secrets,
    serviceAccounts,
    persistentVolumeClaims,
    persistentVolumes,
    storageClasses,
    events,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Executes a structured Kubernetes management job using execFile.
 * No arbitrary shell commands or injection vulnerabilities.
 */
export async function executeKubernetesJob(
  job: KubernetesManagementJob,
  execFn: ExecFileFn = defaultExecFileFn,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const { actionType, params } = job;

  try {
    switch (actionType) {
      case 'K8S_APPLY_MANIFEST': {
        const { yaml, namespace } = params;
        if (!yaml || typeof yaml !== 'string') {
          throw new Error('YAML content is required to apply manifest.');
        }

        // Write YAML to secure temp file
        const tempDir = path.join(os.tmpdir(), 'devweave-k8s');
        await fs.mkdir(tempDir, { recursive: true });
        const tempFile = path.join(tempDir, `manifest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.yaml`);
        await fs.writeFile(tempFile, yaml, 'utf8');

        try {
          const args = ['apply', '-f', tempFile];
          if (namespace) {
            args.push('-n', namespace);
          }
          const { stdout, stderr } = await execFn('kubectl', args, { timeout: 30000 });
          return { success: true, data: { applied: true, output: stdout || stderr } };
        } finally {
          await fs.unlink(tempFile).catch(() => {});
        }
      }

      case 'K8S_DELETE_RESOURCE': {
        const { kind, name, namespace } = params;
        const args = ['delete', kind, name];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 25000 });
        return { success: true, data: { deleted: true, output: stdout || stderr } };
      }

      case 'K8S_SCALE_RESOURCE': {
        const { kind, name, namespace, replicas } = params;
        const target = `${kind}/${name}`;
        const args = ['scale', target, `--replicas=${replicas}`];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 20000 });
        return { success: true, data: { scaled: true, replicas, output: stdout || stderr } };
      }

      case 'K8S_RESTART_RESOURCE': {
        const { kind, name, namespace } = params;
        const target = `${kind}/${name}`;
        const args = ['rollout', 'restart', target];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 20000 });
        return { success: true, data: { restarted: true, output: stdout || stderr } };
      }

      case 'K8S_ROLLOUT_UNDO': {
        const { kind, name, namespace, toRevision } = params;
        const target = `${kind || 'deployment'}/${name}`;
        const args = ['rollout', 'undo', target];
        if (namespace) {
          args.push('-n', namespace);
        }
        if (toRevision) {
          args.push(`--to-revision=${toRevision}`);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 25000 });
        return { success: true, data: { rolledBack: true, output: stdout || stderr } };
      }

      case 'K8S_GET_LOGS': {
        const { podName, namespace, container, tailLines, timestamps } = params;
        const args = ['logs', podName, '-n', namespace || 'default', `--tail=${tailLines || 100}`];
        if (container) {
          args.push('-c', container);
        }
        if (timestamps) {
          args.push('--timestamps');
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 20000, maxBuffer: 1024 * 1024 });
        return {
          success: true,
          data: {
            podName,
            namespace,
            logs: (stdout || stderr || 'No logs found.').substring(0, 500_000),
          },
        };
      }

      case 'K8S_GET_RESOURCE_YAML': {
        const { kind, name, namespace } = params;
        const args = ['get', kind, name, '-o', 'yaml'];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout } = await execFn('kubectl', args, { timeout: 15000 });
        let finalYaml = stdout;
        if (kind.toLowerCase() === 'secret') {
          // Parse and mask secret
          try {
            const { stdout: jsonOut } = await execFn('kubectl', ['get', kind, name, '-o', 'json', ...(namespace ? ['-n', namespace] : [])]);
            const parsed = JSON.parse(jsonOut);
            const masked = maskSecretData(parsed);
            finalYaml = YAML.stringify(masked);
          } catch {
            // fallback
          }
        }
        return { success: true, data: { yaml: finalYaml } };
      }

      case 'K8S_GET_DESCRIBE': {
        const { kind, name, namespace } = params;
        const args = ['describe', kind, name];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 15000 });
        return { success: true, data: { description: stdout || stderr } };
      }

      case 'K8S_CREATE_NAMESPACE': {
        const { name } = params;
        const { stdout, stderr } = await execFn('kubectl', ['create', 'namespace', name], { timeout: 15000 });
        return { success: true, data: { created: true, name, output: stdout || stderr } };
      }

      case 'K8S_DELETE_NAMESPACE': {
        const { name } = params;
        const { stdout, stderr } = await execFn('kubectl', ['delete', 'namespace', name], { timeout: 25000 });
        return { success: true, data: { deleted: true, name, output: stdout || stderr } };
      }

      case 'K8S_REVEAL_SECRET': {
        const { namespace, name, key } = params;
        const { stdout } = await execFn('kubectl', ['get', 'secret', name, '-n', namespace, '-o', 'json'], { timeout: 15000 });
        const secret = JSON.parse(stdout);
        const encoded = secret.data?.[key];
        if (encoded) {
          const decoded = Buffer.from(encoded, 'base64').toString('utf8');
          return { success: true, data: { key, value: decoded } };
        }
        if (secret.stringData?.[key] !== undefined) {
          return { success: true, data: { key, value: String(secret.stringData[key]) } };
        }
        throw new Error(`Key "${key}" not found in secret "${name}".`);
      }

      case 'K8S_PATCH_CRONJOB_SUSPEND': {
        const { name, namespace, suspend } = params;
        const patchJson = JSON.stringify({ spec: { suspend: Boolean(suspend) } });
        const args = ['patch', 'cronjob', name, '-p', patchJson];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 15000 });
        return { success: true, data: { suspended: Boolean(suspend), output: stdout || stderr } };
      }

      case 'K8S_TRIGGER_CRONJOB': {
        const { name, namespace, jobName } = params;
        const actualJobName = jobName || `${name}-manual-${Date.now().toString(36)}`;
        const args = ['create', 'job', actualJobName, `--from=cronjob/${name}`];
        if (namespace) {
          args.push('-n', namespace);
        }
        const { stdout, stderr } = await execFn('kubectl', args, { timeout: 20000 });
        return { success: true, data: { triggered: true, jobName: actualJobName, output: stdout || stderr } };
      }

      default:
        throw new Error(`Unsupported Kubernetes action type "${actionType}".`);
    }
  } catch (err: any) {
    const errorMsg = err?.stderr ? err.stderr.trim() : (err?.message || 'Command execution failed.');
    return {
      success: false,
      error: errorMsg,
    };
  }
}
