import { describe, it, expect } from 'vitest';
import {
  collectKubernetesInventory,
  executeKubernetesJob,
  type ExecFileFn,
} from '../runner/kubernetesManagementExecutor.js';
import type { KubernetesManagementJob } from '../services/kubernetesManagementService.js';

describe('Kubernetes Runner & Management Executor Unit Tests', () => {
  describe('collectKubernetesInventory', () => {
    it('returns empty snapshot when current-context fails or is missing', async () => {
      const mockExec: ExecFileFn = async () => {
        throw new Error('error: current-context is not set');
      };

      const result = await collectKubernetesInventory(mockExec);
      expect(result.clusterConnected).toBe(false);
      expect(result.context).toBeNull();
      expect(result.deployments).toHaveLength(0);
    });

    it('returns disconnected snapshot when cluster-info fails', async () => {
      const mockExec: ExecFileFn = async (_file, args) => {
        if (args.includes('current-context')) {
          return { stdout: 'docker-desktop\n', stderr: '' };
        }
        if (args.includes('cluster-info')) {
          throw new Error('connection refused');
        }
        return { stdout: '', stderr: '' };
      };

      const result = await collectKubernetesInventory(mockExec);
      expect(result.clusterConnected).toBe(false);
      expect(result.context).toBe('docker-desktop');
    });

    it('parses live Kubernetes JSON resources when connected', async () => {
      const mockExec: ExecFileFn = async (_file, args) => {
        if (args.includes('current-context')) {
          return { stdout: 'docker-desktop\n', stderr: '' };
        }
        if (args.includes('cluster-info')) {
          return { stdout: 'Kubernetes control plane is running at https://127.0.0.1:6443\n', stderr: '' };
        }
        if (args.includes('version')) {
          return {
            stdout: JSON.stringify({
              clientVersion: { gitVersion: 'v1.28.2' },
              serverVersion: { gitVersion: 'v1.28.2' },
            }),
            stderr: '',
          };
        }
        if (args.includes('namespaces')) {
          return {
            stdout: JSON.stringify({
              items: [
                { metadata: { name: 'default', creationTimestamp: new Date().toISOString() }, status: { phase: 'Active' } },
                { metadata: { name: 'kube-system', creationTimestamp: new Date().toISOString() }, status: { phase: 'Active' } },
              ],
            }),
            stderr: '',
          };
        }
        if (args.includes('nodes')) {
          return {
            stdout: JSON.stringify({
              items: [
                {
                  metadata: { name: 'docker-desktop', labels: { 'node-role.kubernetes.io/control-plane': '' } },
                  status: {
                    conditions: [{ type: 'Ready', status: 'True' }],
                    addresses: [{ type: 'InternalIP', address: '192.168.65.3' }],
                    nodeInfo: { kubeletVersion: 'v1.28.2' },
                    capacity: { cpu: '8', memory: '16Gi' },
                  },
                },
              ],
            }),
            stderr: '',
          };
        }
        if (args.includes('deployments')) {
          return {
            stdout: JSON.stringify({
              items: [
                {
                  metadata: { name: 'frontend', namespace: 'default' },
                  spec: { replicas: 3, selector: { matchLabels: { app: 'frontend' } }, template: { spec: { containers: [{ image: 'frontend:v1' }] } } },
                  status: { readyReplicas: 3, availableReplicas: 3, updatedReplicas: 3 },
                },
              ],
            }),
            stderr: '',
          };
        }
        if (args.includes('pods')) {
          return {
            stdout: JSON.stringify({
              items: [
                {
                  metadata: { name: 'frontend-6f4b-1234', namespace: 'default' },
                  status: { phase: 'Running', podIP: '10.244.0.5', containerStatuses: [{ name: 'frontend', image: 'frontend:v1', ready: true, restartCount: 0 }] },
                  spec: { nodeName: 'docker-desktop', containers: [{ name: 'frontend', image: 'frontend:v1' }] },
                },
              ],
            }),
            stderr: '',
          };
        }
        return { stdout: JSON.stringify({ items: [] }), stderr: '' };
      };

      const result = await collectKubernetesInventory(mockExec);
      expect(result.clusterConnected).toBe(true);
      expect(result.context).toBe('docker-desktop');
      expect(result.namespaces).toHaveLength(2);
      expect(result.namespaces[0].isProtected).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].status).toBe('Ready');
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].readyReplicas).toBe(3);
      expect(result.pods).toHaveLength(1);
      expect(result.pods[0].phase).toBe('Running');
    });
  });

  describe('executeKubernetesJob', () => {
    it('executes K8S_SCALE_RESOURCE via structured arguments', async () => {
      let executedArgs: string[] = [];
      const mockExec: ExecFileFn = async (_file, args) => {
        executedArgs = args;
        return { stdout: 'deployment.apps/frontend scaled\n', stderr: '' };
      };

      const job: KubernetesManagementJob = {
        id: 'job-1',
        jobType: 'K8S_MANAGEMENT',
        actionType: 'K8S_SCALE_RESOURCE',
        params: { kind: 'deployment', name: 'frontend', namespace: 'default', replicas: 4 },
        userId: 'test-user',
        status: 'EXECUTING',
        createdAt: new Date().toISOString(),
      };

      const result = await executeKubernetesJob(job, mockExec);
      expect(result.success).toBe(true);
      expect(result.data.scaled).toBe(true);
      expect(executedArgs).toEqual(['scale', 'deployment/frontend', '--replicas=4', '-n', 'default']);
    });

    it('executes K8S_RESTART_RESOURCE via rollout restart', async () => {
      let executedArgs: string[] = [];
      const mockExec: ExecFileFn = async (_file, args) => {
        executedArgs = args;
        return { stdout: 'deployment.apps/frontend restarted\n', stderr: '' };
      };

      const job: KubernetesManagementJob = {
        id: 'job-2',
        jobType: 'K8S_MANAGEMENT',
        actionType: 'K8S_RESTART_RESOURCE',
        params: { kind: 'deployment', name: 'frontend', namespace: 'prod' },
        userId: 'test-user',
        status: 'EXECUTING',
        createdAt: new Date().toISOString(),
      };

      const result = await executeKubernetesJob(job, mockExec);
      expect(result.success).toBe(true);
      expect(executedArgs).toEqual(['rollout', 'restart', 'deployment/frontend', '-n', 'prod']);
    });

    it('executes K8S_GET_LOGS with bounded output', async () => {
      const mockExec: ExecFileFn = async () => {
        return { stdout: 'Line 1\nLine 2\nLine 3\n', stderr: '' };
      };

      const job: KubernetesManagementJob = {
        id: 'job-3',
        jobType: 'K8S_MANAGEMENT',
        actionType: 'K8S_GET_LOGS',
        params: { podName: 'my-pod', namespace: 'default', tailLines: 50 },
        userId: 'test-user',
        status: 'EXECUTING',
        createdAt: new Date().toISOString(),
      };

      const result = await executeKubernetesJob(job, mockExec);
      expect(result.success).toBe(true);
      expect(result.data.logs).toContain('Line 1');
    });

    it('executes K8S_REVEAL_SECRET and safely decodes base64 key', async () => {
      const mockExec: ExecFileFn = async () => {
        return {
          stdout: JSON.stringify({
            data: {
              'api-key': Buffer.from('super-secret-token-12345').toString('base64'),
            },
          }),
          stderr: '',
        };
      };

      const job: KubernetesManagementJob = {
        id: 'job-4',
        jobType: 'K8S_MANAGEMENT',
        actionType: 'K8S_REVEAL_SECRET',
        params: { namespace: 'default', name: 'api-secret', key: 'api-key' },
        userId: 'test-user',
        status: 'EXECUTING',
        createdAt: new Date().toISOString(),
      };

      const result = await executeKubernetesJob(job, mockExec);
      expect(result.success).toBe(true);
      expect(result.data.value).toBe('super-secret-token-12345');
    });

    it('catches and reports command failure error cleanly', async () => {
      const mockExec: ExecFileFn = async () => {
        const err: any = new Error('Process exited with code 1');
        err.stderr = 'Error from server (NotFound): deployments.apps "unknown" not found\n';
        throw err;
      };

      const job: KubernetesManagementJob = {
        id: 'job-5',
        jobType: 'K8S_MANAGEMENT',
        actionType: 'K8S_SCALE_RESOURCE',
        params: { kind: 'deployment', name: 'unknown', namespace: 'default', replicas: 1 },
        userId: 'test-user',
        status: 'EXECUTING',
        createdAt: new Date().toISOString(),
      };

      const result = await executeKubernetesJob(job, mockExec);
      expect(result.success).toBe(false);
      expect(result.error).toContain('deployments.apps "unknown" not found');
    });
  });
});
