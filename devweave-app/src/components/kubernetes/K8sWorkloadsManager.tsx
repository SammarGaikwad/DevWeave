import React, { useState } from 'react';
import {
  Boxes,
  Terminal,
  RotateCcw,
  Sliders,
  FileCode,
  Trash2,
  Plus,
  Play,
  Pause,
  Clock,
} from 'lucide-react';
import {
  kubernetesService,
  type K8sDeploymentSummary,
  type K8sPodSummary,
  type K8sStatefulSetSummary,
  type K8sDaemonSetSummary,
  type K8sJobSummary,
  type K8sCronJobSummary,
  type K8sReplicaSetSummary,
} from '../../services/kubernetesService';
import { K8sScaleModal } from './K8sScaleModal';
import { K8sLogsModal } from './K8sLogsModal';
import { K8sYamlModal } from './K8sYamlModal';
import { K8sConfirmModal } from './K8sConfirmModal';
import { K8sCreateDeploymentModal } from './K8sCreateDeploymentModal';

interface K8sWorkloadsManagerProps {
  deployments: K8sDeploymentSummary[];
  pods: K8sPodSummary[];
  statefulSets: K8sStatefulSetSummary[];
  daemonSets: K8sDaemonSetSummary[];
  replicaSets: K8sReplicaSetSummary[];
  jobs: K8sJobSummary[];
  cronJobs: K8sCronJobSummary[];
  selectedNamespace: string;
  searchTerm: string;
  onScale: (kind: string, name: string, namespace: string, replicas: number) => Promise<void>;
  onRestart: (kind: string, name: string, namespace: string) => Promise<void>;
  onDelete: (kind: string, name: string, namespace: string) => Promise<void>;
  onRefresh: () => void;
  onNavigateToEditor?: (blueprintId?: string, initialYaml?: string) => void;
  namespaces?: string[];
}

export const K8sWorkloadsManager: React.FC<K8sWorkloadsManagerProps> = ({
  deployments,
  pods,
  statefulSets,
  daemonSets,
  replicaSets,
  jobs,
  cronJobs,
  selectedNamespace,
  searchTerm,
  onScale,
  onRestart,
  onDelete,
  onRefresh,
  onNavigateToEditor,
  namespaces = ['default'],
}) => {
  const [subTab, setSubTab] = useState<
    'deployments' | 'pods' | 'statefulsets' | 'daemonsets' | 'jobs' | 'cronjobs' | 'replicasets'
  >('deployments');
  const [isCreateDeploymentOpen, setIsCreateDeploymentOpen] = useState<boolean>(false);
  const [cronJobLoading, setCronJobLoading] = useState<string | null>(null);

  // Modal States
  const [scaleModal, setScaleModal] = useState<{
    isOpen: boolean;
    kind: string;
    name: string;
    namespace: string;
    replicas: number;
    errorMessage?: string | null;
  }>({ isOpen: false, kind: 'Deployment', name: '', namespace: 'default', replicas: 1, errorMessage: null });
  const [scaleLoading, setScaleLoading] = useState<boolean>(false);

  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    namespace: string;
    podName: string;
    containers: Array<{ name: string }>;
  }>({ isOpen: false, namespace: 'default', podName: '', containers: [] });

  const [yamlModal, setYamlModal] = useState<{
    isOpen: boolean;
    kind: string;
    name: string;
    namespace: string;
  }>({ isOpen: false, kind: '', name: '', namespace: 'default' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isDestructive: boolean;
    errorMessage?: string | null;
    target: { kind: string; name: string; namespace: string; action: 'delete' | 'restart' };
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    isDestructive: false,
    errorMessage: null,
    target: { kind: '', name: '', namespace: 'default', action: 'delete' },
  });

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Filter helpers
  const filterByNsAndSearch = <T extends { name: string; namespace: string }>(items: T[]): T[] => {
    return items.filter((item) => {
      const matchNs = selectedNamespace === 'ALL' || item.namespace === selectedNamespace;
      const matchSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namespace.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNs && matchSearch;
    });
  };

  const filteredDeployments = filterByNsAndSearch(deployments);
  const filteredPods = filterByNsAndSearch(pods);
  const filteredStatefulSets = filterByNsAndSearch(statefulSets);
  const filteredDaemonSets = filterByNsAndSearch(daemonSets);
  const filteredReplicaSets = filterByNsAndSearch(replicaSets);
  const filteredJobs = filterByNsAndSearch(jobs);
  const filteredCronJobs = filterByNsAndSearch(cronJobs);

  const handleConfirmAction = async () => {
    const { kind, name, namespace, action } = confirmModal.target;
    setActionLoading(true);
    setConfirmModal((prev) => ({ ...prev, errorMessage: null }));
    try {
      if (action === 'delete') {
        await onDelete(kind, name, namespace);
      } else if (action === 'restart') {
        await onRestart(kind, name, namespace);
      }
      setConfirmModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Operation failed.';
      setConfirmModal((prev) => ({ ...prev, errorMessage: msg }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleScaleSubmit = async (replicas: number) => {
    setScaleLoading(true);
    setScaleModal((prev) => ({ ...prev, errorMessage: null }));
    try {
      await onScale(scaleModal.kind, scaleModal.name, scaleModal.namespace, replicas);
      setScaleModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to scale workload.';
      setScaleModal((prev) => ({ ...prev, errorMessage: msg }));
    } finally {
      setScaleLoading(false);
    }
  };

  const handleToggleSuspendCronJob = async (cj: K8sCronJobSummary) => {
    setCronJobLoading(cj.name);
    try {
      await kubernetesService.suspendCronJob(cj.namespace, cj.name, !cj.suspend);
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to update CronJob suspend state');
    } finally {
      setCronJobLoading(null);
    }
  };

  const handleTriggerCronJob = async (cj: K8sCronJobSummary) => {
    setCronJobLoading(cj.name);
    try {
      await kubernetesService.triggerCronJob(cj.namespace, cj.name);
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to trigger CronJob execution');
    } finally {
      setCronJobLoading(null);
    }
  };

  const handleOpenJobLogs = (j: K8sJobSummary) => {
    const jobPod = pods.find((p) => p.namespace === j.namespace && p.name.startsWith(j.name));
    if (jobPod) {
      setLogsModal({
        isOpen: true,
        namespace: jobPod.namespace,
        podName: jobPod.name,
        containers: jobPod.containers || [{ name: j.name }],
      });
    } else {
      alert(`No active pods found in current inventory for Job "${j.name}". If completed, pod may have been cleaned up.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('deployments')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'deployments'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Deployments ({filteredDeployments.length})
          </button>
          <button
            onClick={() => setSubTab('pods')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'pods'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Pods ({filteredPods.length})
          </button>
          <button
            onClick={() => setSubTab('statefulsets')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'statefulsets'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            StatefulSets ({filteredStatefulSets.length})
          </button>
          <button
            onClick={() => setSubTab('daemonsets')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'daemonsets'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            DaemonSets ({filteredDaemonSets.length})
          </button>
          <button
            onClick={() => setSubTab('jobs')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'jobs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Jobs ({filteredJobs.length})
          </button>
          <button
            onClick={() => setSubTab('cronjobs')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'cronjobs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            CronJobs ({filteredCronJobs.length})
          </button>
          <button
            onClick={() => setSubTab('replicasets')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'replicasets'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            ReplicaSets ({filteredReplicaSets.length})
          </button>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsCreateDeploymentOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Workload</span>
          </button>
          {onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor('deployment')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition flex items-center space-x-1.5"
              title="Open Manifest & YAML Editor with Deployment blueprint"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-400" />
              <span>YAML Blueprint</span>
            </button>
          )}
        </div>
      </div>

      {/* Deployments Table */}
      {subTab === 'deployments' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Pods (Ready / Total)</th>
                <th className="px-4 py-3">Images</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredDeployments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 font-sans space-y-2">
                    <p className="text-sm text-slate-300 font-medium">
                      No application deployments found in namespace &quot;{selectedNamespace}&quot;.
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Launch a containerized workload with replicas, container ports, and resource quotas.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => setIsCreateDeploymentOpen(true)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition inline-flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Deploy First Workload</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDeployments.map((d) => {
                  const isHealthy = d.readyReplicas === d.replicas && d.replicas > 0;
                  return (
                    <tr key={`${d.namespace}/${d.name}`} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                        <Boxes className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{d.name}</span>
                      </td>
                      <td className="px-4 py-3 text-indigo-300 font-mono text-xs">{d.namespace}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isHealthy
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : d.readyReplicas === 0
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {d.readyReplicas} / {d.replicas} ready
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-xs" title={d.images.join(', ')}>
                        {d.images.join(', ') || 'none'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-sans">{d.age}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5 font-sans">
                          <button
                            onClick={() =>
                              setScaleModal({
                                isOpen: true,
                                kind: 'Deployment',
                                name: d.name,
                                namespace: d.namespace,
                                replicas: d.replicas,
                              })
                            }
                            title="Scale Replicas"
                            className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                title: `Rollout Restart Deployment`,
                                description: `Trigger a zero-downtime rolling restart for deployment "${d.name}" in namespace "${d.namespace}"?`,
                                actionLabel: 'Rollout Restart',
                                isDestructive: false,
                                target: { kind: 'Deployment', name: d.name, namespace: d.namespace, action: 'restart' },
                              })
                            }
                            title="Rollout Restart"
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setYamlModal({
                                isOpen: true,
                                kind: 'Deployment',
                                name: d.name,
                                namespace: d.namespace,
                              })
                            }
                            title="View / Edit YAML"
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                title: `Delete Deployment`,
                                description: `Are you sure you want to delete deployment "${d.name}" in namespace "${d.namespace}"? All managed pods will be permanently terminated.`,
                                actionLabel: 'Delete Deployment',
                                isDestructive: true,
                                target: { kind: 'Deployment', name: d.name, namespace: d.namespace, action: 'delete' },
                              })
                            }
                            title="Delete Deployment"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pods Table */}
      {subTab === 'pods' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Pod Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Phase / Status</th>
                <th className="px-4 py-3">Restarts</th>
                <th className="px-4 py-3">Node</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredPods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No pods found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredPods.map((p) => {
                  const isRunning = p.phase === 'Running';
                  const isPending = p.phase === 'Pending';
                  const isFailed = p.phase === 'Failed';
                  return (
                    <tr key={`${p.namespace}/${p.name}`} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200">
                        <div className="truncate max-w-xs">{p.name}</div>
                      </td>
                      <td className="px-4 py-3 text-indigo-300">{p.namespace}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isRunning
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : isFailed
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {p.phase} ({p.readyContainers}/{p.totalContainers})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {p.restarts > 0 ? (
                          <span className="text-amber-400 font-semibold">{p.restarts}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{p.node || 'unassigned'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-sans">{p.age}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5 font-sans">
                          <button
                            onClick={() =>
                              setLogsModal({
                                isOpen: true,
                                namespace: p.namespace,
                                podName: p.name,
                                containers: p.containers,
                              })
                            }
                            title="View Pod Logs"
                            className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setYamlModal({
                                isOpen: true,
                                kind: 'Pod',
                                name: p.name,
                                namespace: p.namespace,
                              })
                            }
                            title="Inspect YAML / Describe"
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                title: `Delete Pod`,
                                description: `Are you sure you want to terminate pod "${p.name}" in namespace "${p.namespace}"? If managed by a Deployment, a replacement pod will automatically be created.`,
                                actionLabel: 'Delete Pod',
                                isDestructive: true,
                                target: { kind: 'Pod', name: p.name, namespace: p.namespace, action: 'delete' },
                              })
                            }
                            title="Delete Pod"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* StatefulSets Table */}
      {subTab === 'statefulsets' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Pods (Ready / Total)</th>
                <th className="px-4 py-3">Images</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredStatefulSets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No StatefulSets found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredStatefulSets.map((ss) => (
                  <tr key={`${ss.namespace}/${ss.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{ss.name}</td>
                    <td className="px-4 py-3 text-indigo-300">{ss.namespace}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        {ss.readyReplicas} / {ss.replicas} ready
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-xs">{ss.images.join(', ')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{ss.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setScaleModal({
                              isOpen: true,
                              kind: 'StatefulSet',
                              name: ss.name,
                              namespace: ss.namespace,
                              replicas: ss.replicas,
                            })
                          }
                          title="Scale Replicas"
                          className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Rollout Restart StatefulSet`,
                              description: `Trigger rolling restart for StatefulSet "${ss.name}" in namespace "${ss.namespace}"?`,
                              actionLabel: 'Rollout Restart',
                              isDestructive: false,
                              target: { kind: 'StatefulSet', name: ss.name, namespace: ss.namespace, action: 'restart' },
                            })
                          }
                          title="Rollout Restart StatefulSet"
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'StatefulSet',
                              name: ss.name,
                              namespace: ss.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete StatefulSet`,
                              description: `Delete StatefulSet "${ss.name}" in namespace "${ss.namespace}"?`,
                              actionLabel: 'Delete StatefulSet',
                              isDestructive: true,
                              target: { kind: 'StatefulSet', name: ss.name, namespace: ss.namespace, action: 'delete' },
                            })
                          }
                          title="Delete StatefulSet"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DaemonSets Table */}
      {subTab === 'daemonsets' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Desired</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Ready</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredDaemonSets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No DaemonSets found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredDaemonSets.map((ds) => (
                  <tr key={`${ds.namespace}/${ds.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{ds.name}</td>
                    <td className="px-4 py-3 text-indigo-300">{ds.namespace}</td>
                    <td className="px-4 py-3 text-slate-300">{ds.desired}</td>
                    <td className="px-4 py-3 text-slate-300">{ds.current}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{ds.ready}</td>
                    <td className="px-4 py-3 text-slate-400 font-sans">{ds.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Rollout Restart DaemonSet`,
                              description: `Trigger rolling restart for DaemonSet "${ds.name}" across all nodes in namespace "${ds.namespace}"?`,
                              actionLabel: 'Rollout Restart',
                              isDestructive: false,
                              target: { kind: 'DaemonSet', name: ds.name, namespace: ds.namespace, action: 'restart' },
                            })
                          }
                          title="Rollout Restart DaemonSet"
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'DaemonSet',
                              name: ds.name,
                              namespace: ds.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete DaemonSet`,
                              description: `Delete DaemonSet "${ds.name}" in namespace "${ds.namespace}"?`,
                              actionLabel: 'Delete DaemonSet',
                              isDestructive: true,
                              target: { kind: 'DaemonSet', name: ds.name, namespace: ds.namespace, action: 'delete' },
                            })
                          }
                          title="Delete DaemonSet"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Jobs Table */}
      {subTab === 'jobs' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Completions</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No batch Jobs found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => (
                  <tr key={`${j.namespace}/${j.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{j.name}</td>
                    <td className="px-4 py-3 text-indigo-300">{j.namespace}</td>
                    <td className="px-4 py-3 text-slate-300">{j.completions}</td>
                    <td className="px-4 py-3 text-slate-300">{j.active}</td>
                    <td className="px-4 py-3 text-slate-400 font-sans">{j.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenJobLogs(j)}
                          title="View Job Pod Logs"
                          className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'Job',
                              name: j.name,
                              namespace: j.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete Job`,
                              description: `Delete Job "${j.name}" in namespace "${j.namespace}"?`,
                              actionLabel: 'Delete Job',
                              isDestructive: true,
                              target: { kind: 'Job', name: j.name, namespace: j.namespace, action: 'delete' },
                            })
                          }
                          title="Delete Job"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CronJobs Table */}
      {subTab === 'cronjobs' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Suspend</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredCronJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No CronJobs found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredCronJobs.map((cj) => (
                  <tr key={`${cj.namespace}/${cj.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{cj.name}</td>
                    <td className="px-4 py-3 text-indigo-300">{cj.namespace}</td>
                    <td className="px-4 py-3 text-amber-400">{cj.schedule}</td>
                    <td className="px-4 py-3 text-slate-400">{String(cj.suspend)}</td>
                    <td className="px-4 py-3 text-slate-300">{cj.active}</td>
                    <td className="px-4 py-3 text-slate-400 font-sans">{cj.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleToggleSuspendCronJob(cj)}
                          disabled={cronJobLoading === cj.name}
                          title={cj.suspend ? 'Resume CronJob' : 'Suspend CronJob'}
                          className={`p-1 rounded transition ${
                            cj.suspend
                              ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800'
                              : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                          }`}
                        >
                          {cj.suspend ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleTriggerCronJob(cj)}
                          disabled={cronJobLoading === cj.name}
                          title="Trigger Run Now"
                          className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'CronJob',
                              name: cj.name,
                              namespace: cj.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete CronJob`,
                              description: `Delete CronJob "${cj.name}" in namespace "${cj.namespace}"?`,
                              actionLabel: 'Delete CronJob',
                              isDestructive: true,
                              target: { kind: 'CronJob', name: cj.name, namespace: cj.namespace, action: 'delete' },
                            })
                          }
                          title="Delete CronJob"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ReplicaSets Table */}
      {subTab === 'replicasets' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Desired</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Ready</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredReplicaSets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No ReplicaSets found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredReplicaSets.map((rs) => (
                  <tr key={`${rs.namespace}/${rs.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{rs.name}</td>
                    <td className="px-4 py-3 text-indigo-300">{rs.namespace}</td>
                    <td className="px-4 py-3 text-slate-300">{rs.desired}</td>
                    <td className="px-4 py-3 text-slate-300">{rs.current}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{rs.ready}</td>
                    <td className="px-4 py-3 text-slate-400 font-sans">{rs.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'ReplicaSet',
                              name: rs.name,
                              namespace: rs.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete ReplicaSet`,
                              description: `Delete ReplicaSet "${rs.name}" in namespace "${rs.namespace}"?`,
                              actionLabel: 'Delete ReplicaSet',
                              isDestructive: true,
                              target: { kind: 'ReplicaSet', name: rs.name, namespace: rs.namespace, action: 'delete' },
                            })
                          }
                          title="Delete ReplicaSet"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <K8sScaleModal
        isOpen={scaleModal.isOpen}
        kind={scaleModal.kind}
        name={scaleModal.name}
        namespace={scaleModal.namespace}
        currentReplicas={scaleModal.replicas}
        isLoading={scaleLoading}
        errorMessage={scaleModal.errorMessage}
        onScale={handleScaleSubmit}
        onClose={() => setScaleModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }))}
      />

      <K8sLogsModal
        isOpen={logsModal.isOpen}
        namespace={logsModal.namespace}
        podName={logsModal.podName}
        containers={logsModal.containers}
        onClose={() => setLogsModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <K8sYamlModal
        isOpen={yamlModal.isOpen}
        kind={yamlModal.kind}
        name={yamlModal.name}
        namespace={yamlModal.namespace}
        onClose={() => setYamlModal((prev) => ({ ...prev, isOpen: false }))}
        onApplySuccess={onRefresh}
      />

      <K8sConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        actionLabel={confirmModal.actionLabel}
        isDestructive={confirmModal.isDestructive}
        errorMessage={confirmModal.errorMessage}
        isLoading={actionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }))}
      />

      <K8sCreateDeploymentModal
        isOpen={isCreateDeploymentOpen}
        onClose={() => setIsCreateDeploymentOpen(false)}
        onSuccess={() => onRefresh()}
        namespaces={namespaces}
        onOpenYamlEditor={(yaml) => onNavigateToEditor && onNavigateToEditor('deployment', yaml)}
      />
    </div>
  );
};
