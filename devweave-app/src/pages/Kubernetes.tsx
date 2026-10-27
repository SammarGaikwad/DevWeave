import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Boxes,
  Layers,
  RefreshCw,
  AlertCircle,
  Search,
  Cpu,
  Network,
  HardDrive,
  FileCode,
  Activity,
  Server,
  Key,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge, type StatusType } from '../components/ui/StatusBadge';
import {
  kubernetesService,
  type ClusterStatus,
  type KubernetesInventorySnapshot,
  type KubernetesAuditEvent,
  type KubernetesRunnerStatus,
} from '../services/kubernetesService';
import { K8sWorkloadsManager } from '../components/kubernetes/K8sWorkloadsManager';
import { K8sNetworkingManager } from '../components/kubernetes/K8sNetworkingManager';
import { K8sConfigStorageManager } from '../components/kubernetes/K8sConfigStorageManager';
import { K8sClusterManager } from '../components/kubernetes/K8sClusterManager';
import { K8sManifestEditor } from '../components/kubernetes/K8sManifestEditor';
import { K8sAuditLogsManager } from '../components/kubernetes/K8sAuditLogsManager';

export const Kubernetes: React.FC = () => {
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus | null>(null);
  const [runnerStatus, setRunnerStatus] = useState<KubernetesRunnerStatus | null>(null);
  const [inventory, setInventory] = useState<KubernetesInventorySnapshot | null>(null);
  const [auditLogs, setAuditLogs] = useState<KubernetesAuditEvent[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Filters
  const [selectedNamespace, setSelectedNamespace] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Main navigation tabs
  const [activeTab, setActiveTab] = useState<
    'workloads' | 'networking' | 'config' | 'cluster' | 'editor' | 'audit'
  >('workloads');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('deployment');
  const [selectedYaml, setSelectedYaml] = useState<string | undefined>(undefined);

  const timerRef = useRef<any>(null);

  const handleOpenEditorWithBlueprint = (blueprintId: string = 'deployment', initialYaml?: string) => {
    setSelectedBlueprintId(blueprintId);
    setSelectedYaml(initialYaml);
    setActiveTab('editor');
  };

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const [statusRes, runnerRes, invRes, auditRes] = await Promise.allSettled([
        kubernetesService.getStatus(),
        kubernetesService.getRunnerStatus(),
        kubernetesService.getInventory(),
        kubernetesService.getAuditLogs(),
      ]);

      if (statusRes.status === 'fulfilled') {
        setClusterStatus(statusRes.value);
      }
      if (runnerRes.status === 'fulfilled') {
        setRunnerStatus(runnerRes.value);
      }
      if (invRes.status === 'fulfilled') {
        setInventory(invRes.value);
      }
      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value);
      }
    } catch {
      // Fetch error handled gracefully
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Periodic auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  // Handlers for workload and resource operations
  const handleScale = async (kind: string, name: string, namespace: string, replicas: number) => {
    await kubernetesService.scaleResource(kind, name, namespace, replicas);
    await fetchData(true);
  };

  const handleRestart = async (kind: string, name: string, namespace: string) => {
    await kubernetesService.restartResource(kind, name, namespace);
    await fetchData(true);
  };

  const handleDeleteResource = async (kind: string, name: string, namespace: string) => {
    await kubernetesService.deleteResource(kind, name, namespace);
    await fetchData(true);
  };

  const handleDeleteNamespace = async (name: string) => {
    await kubernetesService.deleteNamespace(name);
    await fetchData(true);
  };

  // Summaries
  const totalDeployments = inventory?.deployments?.length ?? 0;
  const readyDeployments =
    inventory?.deployments?.filter((d) => d.readyReplicas === d.replicas && d.replicas > 0).length ?? 0;
  const totalPods = inventory?.pods?.length ?? 0;
  const runningPods = inventory?.pods?.filter((p) => p.phase === 'Running').length ?? 0;
  const totalServices = inventory?.services?.length ?? 0;
  const totalNodes = inventory?.nodes?.length ?? 0;
  const readyNodes = inventory?.nodes?.filter((n) => n.status === 'Ready').length ?? 0;
  const totalPvcs = inventory?.persistentVolumeClaims?.length ?? 0;
  const boundPvcs = inventory?.persistentVolumeClaims?.filter((p) => p.status === 'Bound').length ?? 0;
  const isRunnerOnline = runnerStatus?.online ?? false;
  const isClusterConnected = clusterStatus?.clusterConnected ?? false;

  const getStatusBadge = (): { type: StatusType; label: string } => {
    if (!isRunnerOnline) {
      return { type: 'Offline', label: 'RUNNER OFFLINE' };
    }
    if (isClusterConnected) {
      return { type: 'Healthy', label: 'CLUSTER CONNECTED' };
    }
    return { type: 'Warning', label: 'CLUSTER DISCONNECTED' };
  };

  const badge = getStatusBadge();

  // Namespaces list for dropdown filter
  const namespaceOptions = inventory?.namespaces?.map((ns) => ns.name) || [];

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              Kubernetes Management
            </h1>
            <StatusBadge status={badge.type} customLabel={badge.label} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Production workload orchestration, cluster inventory, manifest lifecycle, and runner integration.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center space-x-3">
          {/* Namespace Filter */}
          <div className="flex items-center space-x-2 bg-slate-900/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">
                All Namespaces
              </option>
              {namespaceOptions.map((ns) => (
                <option key={ns} value={ns} className="bg-slate-900 text-slate-200">
                  {ns}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>

          {/* Inventory Freshness indicator */}
          {inventory?.updatedAt && (
            <div
              title={`Latest cluster telemetry: ${new Date(inventory.updatedAt).toLocaleTimeString()}`}
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-300"
            >
              <span className={`w-2 h-2 rounded-full ${isRunnerOnline && isClusterConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>Live Sync</span>
            </div>
          )}

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Auto-refresh active (10s)' : 'Auto-refresh paused'}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition flex items-center space-x-1.5 ${
              autoRefresh
                ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-indigo-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Auto</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Refresh inventory now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Runner / Cluster Warning Banner if Offline */}
      {!isRunnerOnline ? (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start space-x-3.5">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-amber-300">
              Windows Kubernetes Runner Offline
            </h4>
            <p className="leading-relaxed text-slate-300">
              The hosted DevWeave backend cannot reach your local Kubernetes cluster directly. Start the local runner daemon on your Windows machine to bridge kubectl telemetry:
            </p>
            <div className="flex items-center space-x-2 pt-1 font-mono text-[11px] text-amber-300 bg-black/40 px-3 py-1.5 rounded-lg w-fit">
              <span>.\scripts\run-k8s-runner.ps1</span>
              <span className="text-slate-500">or</span>
              <span>npm run runner:k8s</span>
            </div>
          </div>
        </div>
      ) : !isClusterConnected ? (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start space-x-3.5">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-amber-300">
              Kubernetes Cluster Unreachable
            </h4>
            <p className="leading-relaxed text-slate-300">
              {clusterStatus?.message || 'Runner is online, but kubectl cannot connect to a live Kubernetes cluster API endpoint.'}
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-0.5 pt-1">
              <li>Enable Kubernetes in Docker Desktop (Settings &gt; Kubernetes &gt; Enable Kubernetes)</li>
              <li>Or start Minikube: <code className="text-indigo-300">minikube start</code></li>
              <li>Verify current context: <code className="text-indigo-300">kubectl config get-contexts</code></li>
            </ul>
          </div>
        </div>
      ) : null}

      {/* Cluster Telemetry & Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <GlassCard className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Deployments</span>
            <Boxes className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {readyDeployments} <span className="text-xs text-slate-500 font-normal">/ {totalDeployments}</span>
          </div>
          <div className="text-[10px] text-slate-400">Ready workloads</div>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pods</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {runningPods} <span className="text-xs text-slate-500 font-normal">/ {totalPods}</span>
          </div>
          <div className="text-[10px] text-slate-400">Running pods</div>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Services</span>
            <Network className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">{totalServices}</div>
          <div className="text-[10px] text-slate-400">Network endpoints</div>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Nodes</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {readyNodes} <span className="text-xs text-slate-500 font-normal">/ {totalNodes}</span>
          </div>
          <div className="text-[10px] text-slate-400">Cluster nodes ready</div>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Storage PVCs</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {boundPvcs} <span className="text-xs text-slate-500 font-normal">/ {totalPvcs}</span>
          </div>
          <div className="text-[10px] text-slate-400">Persistent claims bound</div>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Context</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100 truncate" title={clusterStatus?.currentContext || 'none'}>
            {clusterStatus?.currentContext || 'none'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {clusterStatus?.serverVersion || 'v1.28+'}
          </div>
        </GlassCard>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('workloads')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
            activeTab === 'workloads'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Workloads</span>
        </button>

        <button
          onClick={() => setActiveTab('networking')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
            activeTab === 'networking'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Networking</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
            activeTab === 'config'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Configuration & Storage</span>
        </button>

        <button
          onClick={() => setActiveTab('cluster')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
            activeTab === 'cluster'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Cluster & Nodes</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
            activeTab === 'editor'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Manifest & YAML Editor</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Activity & Audit ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'workloads' && (
        <K8sWorkloadsManager
          deployments={inventory?.deployments || []}
          pods={inventory?.pods || []}
          statefulSets={inventory?.statefulSets || []}
          daemonSets={inventory?.daemonSets || []}
          replicaSets={inventory?.replicaSets || []}
          jobs={inventory?.jobs || []}
          cronJobs={inventory?.cronJobs || []}
          selectedNamespace={selectedNamespace}
          searchTerm={searchTerm}
          onScale={handleScale}
          onRestart={handleRestart}
          onDelete={handleDeleteResource}
          onRefresh={() => fetchData(true)}
          onNavigateToEditor={handleOpenEditorWithBlueprint}
          namespaces={namespaceOptions}
        />
      )}

      {activeTab === 'networking' && (
        <K8sNetworkingManager
          services={inventory?.services || []}
          ingresses={inventory?.ingresses || []}
          networkPolicies={inventory?.networkPolicies || []}
          selectedNamespace={selectedNamespace}
          searchTerm={searchTerm}
          onDelete={handleDeleteResource}
          onRefresh={() => fetchData(true)}
          onNavigateToEditor={handleOpenEditorWithBlueprint}
          namespaces={namespaceOptions}
          deployments={inventory?.deployments || []}
        />
      )}

      {activeTab === 'config' && (
        <K8sConfigStorageManager
          configMaps={inventory?.configMaps || []}
          secrets={inventory?.secrets || []}
          pvcs={inventory?.persistentVolumeClaims || []}
          pvs={inventory?.persistentVolumes || []}
          storageClasses={inventory?.storageClasses || []}
          serviceAccounts={inventory?.serviceAccounts || []}
          selectedNamespace={selectedNamespace}
          searchTerm={searchTerm}
          onDelete={handleDeleteResource}
          onRefresh={() => fetchData(true)}
          onNavigateToEditor={handleOpenEditorWithBlueprint}
          namespaces={namespaceOptions}
        />
      )}

      {activeTab === 'cluster' && (
        <K8sClusterManager
          nodes={inventory?.nodes || []}
          namespaces={inventory?.namespaces || []}
          events={inventory?.events || []}
          selectedNamespace={selectedNamespace}
          searchTerm={searchTerm}
          onDeleteNamespace={handleDeleteNamespace}
          onRefresh={() => fetchData(true)}
        />
      )}

      {activeTab === 'editor' && (
        <K8sManifestEditor
          initialBlueprintId={selectedBlueprintId}
          initialYaml={selectedYaml}
          onApplied={() => fetchData(true)}
        />
      )}

      {activeTab === 'audit' && (
        <K8sAuditLogsManager auditLogs={auditLogs} />
      )}
    </div>
  );
};
