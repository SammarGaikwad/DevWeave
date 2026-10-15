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

export interface K8sValidationResult {
  valid: boolean;
  errors: string[];
  parsedDocuments: number;
}

export const kubernetesService = {
  async getStatus(): Promise<ClusterStatus> {
    const res = await apiClient.get<{ success: boolean; data: ClusterStatus }>('/v1/kubernetes/status');
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
};
