import { apiClient } from './apiClient';

export interface ClusterStatus {
  kubectlInstalled: boolean;
  clientVersion: string | null;
  clusterConnected: boolean;
  currentContext: string | null;
  clusterEndpoint: string | null;
  serverVersion: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CLI_NOT_FOUND';
  message: string;
  setupInstructions: string[];
}

export interface K8sManifestTemplateSummary {
  id: string;
  name: string;
  kind: string;
  apiVersion: string;
  description: string;
  bestPractices: string[];
}

export interface K8sManifestTemplateDetail extends K8sManifestTemplateSummary {
  content: string;
}

export interface K8sCustomOptions {
  serviceName: string;
  namespace: string;
  imageTag: string;
  containerPort: number;
  replicas: number;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  enableIngress: boolean;
  ingressHost: string;
  enableHpa: boolean;
  minReplicas: number;
  maxReplicas: number;
}

export interface K8sParsedResource {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
}

export interface K8sValidationResult {
  valid: boolean;
  errors: string[];
  parsedDocuments: number;
  resources?: K8sParsedResource[];
}

export interface K8sDeploymentSummary {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  updatedReplicas: number;
  age: string;
  images: string[];
  selector: Record<string, string>;
  conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>;
}

export interface K8sPodSummary {
  name: string;
  namespace: string;
  phase: string;
  status: string;
  readyContainers: number;
  totalContainers: number;
  restarts: number;
  age: string;
  ip?: string;
  node?: string;
  images: string[];
  containers: Array<{ name: string; image: string; ready: boolean; restartCount: number }>;
}

export interface K8sStatefulSetSummary {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  age: string;
  images: string[];
}

export interface K8sDaemonSetSummary {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
  images: string[];
}

export interface K8sReplicaSetSummary {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
}

export interface K8sJobSummary {
  name: string;
  namespace: string;
  completions: string;
  duration?: string;
  age: string;
  active: number;
  succeeded: number;
  failed: number;
}

export interface K8sCronJobSummary {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  lastSchedule?: string;
  age: string;
}

export interface K8sServiceSummary {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: Array<{ name?: string; port: number; targetPort?: number | string; protocol: string; nodePort?: number }>;
  age: string;
  selector?: Record<string, string>;
  isProtected?: boolean;
}

export interface K8sIngressSummary {
  name: string;
  namespace: string;
  hosts: string[];
  address?: string;
  ports?: string;
  age: string;
}

export interface K8sNetworkPolicySummary {
  name: string;
  namespace: string;
  podSelector: string;
  policyTypes: string[];
  age: string;
}

export interface K8sConfigMapSummary {
  name: string;
  namespace: string;
  dataCount: number;
  keys: string[];
  age: string;
}

export interface K8sSecretSummary {
  name: string;
  namespace: string;
  type: string;
  dataCount: number;
  keys: string[];
  age: string;
}

export interface K8sServiceAccountSummary {
  name: string;
  namespace: string;
  secretsCount: number;
  age: string;
}

export interface K8sPvcSummary {
  name: string;
  namespace: string;
  status: string;
  volume?: string;
  capacity?: string;
  accessModes: string[];
  storageClass?: string;
  age: string;
}

export interface K8sPvSummary {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: string;
  claim?: string;
  storageClass?: string;
  age: string;
}

export interface K8sStorageClassSummary {
  name: string;
  provisioner: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  age: string;
}

export interface K8sNodeSummary {
  name: string;
  status: string;
  roles: string[];
  age: string;
  version: string;
  internalIP?: string;
  cpuCapacity?: string;
  memoryCapacity?: string;
  conditions?: Array<{ type: string; status: string; reason?: string }>;
}

export interface K8sNamespaceSummary {
  name: string;
  status: string;
  age: string;
  isProtected?: boolean;
}

export interface K8sEventSummary {
  type: string;
  reason: string;
  object: string;
  message: string;
  count: number;
  lastTimestamp: string;
  namespace: string;
}

export interface KubernetesInventorySnapshot {
  clusterConnected: boolean;
  context: string | null;
  serverVersion: string | null;
  clientVersion: string | null;
  endpoint: string | null;
  namespaces: K8sNamespaceSummary[];
  nodes: K8sNodeSummary[];
  deployments: K8sDeploymentSummary[];
  pods: K8sPodSummary[];
  statefulSets: K8sStatefulSetSummary[];
  daemonSets: K8sDaemonSetSummary[];
  replicaSets: K8sReplicaSetSummary[];
  jobs: K8sJobSummary[];
  cronJobs: K8sCronJobSummary[];
  services: K8sServiceSummary[];
  ingresses: K8sIngressSummary[];
  networkPolicies: K8sNetworkPolicySummary[];
  configMaps: K8sConfigMapSummary[];
  secrets: K8sSecretSummary[];
  serviceAccounts: K8sServiceAccountSummary[];
  persistentVolumeClaims: K8sPvcSummary[];
  persistentVolumes: K8sPvSummary[];
  storageClasses: K8sStorageClassSummary[];
  events: K8sEventSummary[];
  updatedAt: string;
  runnerOnline: boolean;
}

export interface KubernetesAuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  action: string;
  resourceKind: string;
  resourceName: string;
  namespace?: string;
  status: 'ATTEMPT' | 'BLOCKED_PROTECTION' | 'SUCCESS' | 'FAILED';
  details?: Record<string, any>;
  error?: string;
}

export interface KubernetesRunnerStatus {
  online: boolean;
  lastHeartbeat: string | null;
  snapshot: {
    runnerId: string;
    hostname: string;
    kubectlVersion: string | null;
    clusterConnected: boolean;
    currentContext: string | null;
    clusterEndpoint: string | null;
    serverVersion: string | null;
    nodesCount: number;
    namespacesCount: number;
    podsCount: number;
    reportedAt: string;
    error?: string | null;
  } | null;
}

export const kubernetesService = {
  async getStatus(): Promise<ClusterStatus> {
    const res = await apiClient.get<{ success: boolean; data: ClusterStatus }>('/v1/kubernetes/status');
    return res.data;
  },

  async getRunnerStatus(): Promise<KubernetesRunnerStatus> {
    const res = await apiClient.get<{ success: boolean; data: KubernetesRunnerStatus }>('/v1/kubernetes/runner/status');
    return res.data;
  },

  async getInventory(): Promise<KubernetesInventorySnapshot> {
    const res = await apiClient.get<{ success: boolean; data: KubernetesInventorySnapshot }>('/v1/kubernetes/inventory');
    return res.data;
  },

  async getAuditLogs(): Promise<KubernetesAuditEvent[]> {
    const res = await apiClient.get<{ success: boolean; data: KubernetesAuditEvent[] }>('/v1/kubernetes/audit-logs');
    return res.data;
  },

  async getTemplates(): Promise<K8sManifestTemplateSummary[]> {
    const res = await apiClient.get<{ success: boolean; data: K8sManifestTemplateSummary[] }>('/v1/kubernetes/templates');
    return res.data;
  },

  async getTemplateById(id: string): Promise<K8sManifestTemplateDetail> {
    const res = await apiClient.get<{ success: boolean; data: K8sManifestTemplateDetail }>(`/v1/kubernetes/templates/${id}`);
    return res.data;
  },

  async generateManifest(opts: K8sCustomOptions): Promise<{ yaml: string; options: K8sCustomOptions }> {
    const res = await apiClient.post<{ success: boolean; data: { yaml: string; options: K8sCustomOptions } }>(
      '/v1/kubernetes/generate',
      opts
    );
    return res.data;
  },

  async validateManifest(yaml: string): Promise<K8sValidationResult> {
    const res = await apiClient.post<{ success: boolean; data: K8sValidationResult }>(
      '/v1/kubernetes/validate',
      { yaml }
    );
    return res.data;
  },

  async applyManifest(yaml: string, namespace?: string): Promise<{ applied: boolean; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { applied: boolean; output: string } }>(
      '/v1/kubernetes/apply',
      { yaml, namespace }
    );
    return res.data;
  },

  async deleteResource(kind: string, name: string, namespace?: string): Promise<{ deleted: boolean; output: string }> {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    const res = await apiClient.delete<{ success: boolean; data: { deleted: boolean; output: string } }>(
      `/v1/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(name)}${query}`
    );
    return res.data;
  },

  async scaleResource(kind: string, name: string, namespace: string, replicas: number): Promise<{ scaled: boolean; replicas: number; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { scaled: boolean; replicas: number; output: string } }>(
      '/v1/kubernetes/workloads/scale',
      { kind, name, namespace, replicas }
    );
    return res.data;
  },

  async restartResource(kind: string, name: string, namespace: string): Promise<{ restarted: boolean; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { restarted: boolean; output: string } }>(
      '/v1/kubernetes/workloads/restart',
      { kind, name, namespace }
    );
    return res.data;
  },

  async getPodLogs(namespace: string, name: string, container?: string, tailLines: number = 100): Promise<{ podName: string; namespace: string; logs: string }> {
    const params = new URLSearchParams();
    if (container) params.set('container', container);
    if (tailLines) params.set('tailLines', String(tailLines));
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await apiClient.get<{ success: boolean; data: { podName: string; namespace: string; logs: string } }>(
      `/v1/kubernetes/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/logs${query}`
    );
    return res.data;
  },

  async getResourceYaml(kind: string, name: string, namespace?: string): Promise<{ yaml: string }> {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    const res = await apiClient.get<{ success: boolean; data: { yaml: string } }>(
      `/v1/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/yaml${query}`
    );
    return res.data;
  },

  async describeResource(kind: string, name: string, namespace?: string): Promise<{ description: string }> {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    const res = await apiClient.get<{ success: boolean; data: { description: string } }>(
      `/v1/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/describe${query}`
    );
    return res.data;
  },

  async createNamespace(name: string): Promise<{ created: boolean; name: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string } }>(
      '/v1/kubernetes/namespaces',
      { name }
    );
    return res.data;
  },

  async deleteNamespace(name: string): Promise<{ deleted: boolean; name: string }> {
    const res = await apiClient.delete<{ success: boolean; data: { deleted: boolean; name: string } }>(
      `/v1/kubernetes/namespaces/${encodeURIComponent(name)}`
    );
    return res.data;
  },

  async revealSecret(namespace: string, name: string, key: string): Promise<{ key: string; value: string }> {
    const res = await apiClient.post<{ success: boolean; data: { key: string; value: string } }>(
      '/v1/kubernetes/secrets/reveal',
      { namespace, name, key }
    );
    return res.data;
  },

  async createService(input: K8sCreateServiceInput): Promise<{ created: boolean; name: string; namespace: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string; namespace: string; output: string } }>(
      '/v1/kubernetes/services',
      input
    );
    return res.data;
  },

  async createDeployment(input: K8sCreateDeploymentInput): Promise<{ created: boolean; name: string; namespace: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string; namespace: string; output: string } }>(
      '/v1/kubernetes/deployments',
      input
    );
    return res.data;
  },

  async createConfigMap(input: K8sCreateConfigMapInput): Promise<{ created: boolean; name: string; namespace: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string; namespace: string; output: string } }>(
      '/v1/kubernetes/configmaps',
      input
    );
    return res.data;
  },

  async createSecret(input: K8sCreateSecretInput): Promise<{ created: boolean; name: string; namespace: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string; namespace: string; output: string } }>(
      '/v1/kubernetes/secrets',
      input
    );
    return res.data;
  },

  async createPvc(input: K8sCreatePvcInput): Promise<{ created: boolean; name: string; namespace: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string; namespace: string; output: string } }>(
      '/v1/kubernetes/pvcs',
      input
    );
    return res.data;
  },

  async createIngress(input: K8sCreateIngressInput): Promise<{ created: boolean; name: string; namespace: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { created: boolean; name: string; namespace: string; output: string } }>(
      '/v1/kubernetes/ingresses',
      input
    );
    return res.data;
  },

  async suspendCronJob(namespace: string, name: string, suspend: boolean): Promise<{ suspended: boolean; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { suspended: boolean; output: string } }>(
      '/v1/kubernetes/cronjobs/suspend',
      { namespace, name, suspend }
    );
    return res.data;
  },

  async triggerCronJob(namespace: string, name: string, jobName?: string): Promise<{ triggered: boolean; jobName: string; output: string }> {
    const res = await apiClient.post<{ success: boolean; data: { triggered: boolean; jobName: string; output: string } }>(
      '/v1/kubernetes/cronjobs/trigger',
      { namespace, name, jobName }
    );
    return res.data;
  },
};

export interface K8sCreateServiceInput {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  selector: Record<string, string>;
  port: number;
  targetPort: number | string;
  protocol?: 'TCP' | 'UDP' | 'SCTP';
  portName?: string;
}

export interface K8sCreateDeploymentInput {
  name: string;
  namespace: string;
  image: string;
  replicas?: number;
  port?: number;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  env?: Array<{ name: string; value: string }>;
  labels?: Record<string, string>;
}

export interface K8sCreateConfigMapInput {
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface K8sCreateSecretInput {
  name: string;
  namespace: string;
  type?: 'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/basic-auth';
  data: Record<string, string>;
}

export interface K8sCreatePvcInput {
  name: string;
  namespace: string;
  storageClass?: string;
  accessModes?: Array<'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany'>;
  storage?: string;
}

export interface K8sCreateIngressInput {
  name: string;
  namespace: string;
  ingressClassName?: string;
  host: string;
  path?: string;
  serviceName: string;
  servicePort: number;
}
