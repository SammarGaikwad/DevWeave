import React, { useEffect, useState, useCallback } from 'react';
import {
  Boxes,
  Layers,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  Sliders,
  FileCode,
  CheckSquare,
  Network,
  Cpu,
  Info,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge, type StatusType } from '../components/ui/StatusBadge';
import {
  kubernetesService,
  type ClusterStatus,
  type K8sManifestTemplateSummary,
  type K8sManifestTemplateDetail,
  type K8sCustomOptions,
  type K8sValidationResult,
} from '../services/kubernetesService';

export const Kubernetes: React.FC = () => {
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [templates, setTemplates] = useState<K8sManifestTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('deployment');
  const [activeTemplate, setActiveTemplate] = useState<K8sManifestTemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'generator' | 'validator'>('templates');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Custom Generator State
  const [customOptions, setCustomOptions] = useState<K8sCustomOptions>({
    serviceName: 'devweave-api',
    namespace: 'production',
    imageTag: 'devweave/api:v1.0.0',
    containerPort: 8080,
    replicas: 3,
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '128Mi',
    memoryLimit: '512Mi',
    enableIngress: true,
    ingressHost: 'api.devweave.internal',
    enableHpa: true,
    minReplicas: 2,
    maxReplicas: 10,
  });
  const [generatedYaml, setGeneratedYaml] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Validator State
  const [yamlToValidate, setYamlToValidate] = useState<string>(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
        - name: web
          image: nginx:alpine
          ports:
            - containerPort: 80`);
  const [validationResult, setValidationResult] = useState<K8sValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await kubernetesService.getStatus();
      setClusterStatus(data);
    } catch {
      setClusterStatus({
        kubectlInstalled: false,
        clientVersion: null,
        clusterConnected: false,
        currentContext: null,
        clusterEndpoint: null,
        serverVersion: null,
        status: 'DISCONNECTED',
        message: 'Could not connect to backend cluster health probe.',
        setupInstructions: [
          'Verify backend API server is running on port 8080',
          'Check cluster reachability via: kubectl cluster-info',
        ],
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const list = await kubernetesService.getTemplates();
      setTemplates(list);
      if (list.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load k8s templates', err);
    }
  }, [selectedTemplateId]);

  const loadTemplateDetail = useCallback(async (id: string) => {
    setLoadingTemplate(true);
    try {
      const detail = await kubernetesService.getTemplateById(id);
      setActiveTemplate(detail);
    } catch (err) {
      console.error('Failed to load k8s template detail', err);
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchTemplates();
  }, [fetchStatus, fetchTemplates]);

  useEffect(() => {
    if (selectedTemplateId) {
      void loadTemplateDetail(selectedTemplateId);
    }
  }, [selectedTemplateId, loadTemplateDetail]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleGenerateCustom = async () => {
    setGenerating(true);
    try {
      const res = await kubernetesService.generateManifest(customOptions);
      setGeneratedYaml(res.yaml);
    } catch (err) {
      console.error('Failed to generate manifest', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await kubernetesService.validateManifest(yamlToValidate);
      setValidationResult(res);
    } catch (err) {
      console.error('Failed to validate manifest', err);
    } finally {
      setValidating(false);
    }
  };

  const getStatusBadgeInfo = (): { type: StatusType; label: string } => {
    if (loadingStatus) return { type: 'Pending', label: 'Probing Cluster...' };
    if (!clusterStatus) return { type: 'Offline', label: 'Unknown' };
    if (clusterStatus.status === 'CONNECTED') return { type: 'Running', label: 'Cluster Active' };
    if (clusterStatus.status === 'DISCONNECTED') return { type: 'Warning', label: 'Cluster Offline (Manifest Mode)' };
    return { type: 'Failed', label: 'kubectl Not Found' };
  };

  const badgeInfo = getStatusBadgeInfo();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Boxes className="h-7 w-7 text-indigo-400" />
              Kubernetes Orchestration
            </h1>
            <StatusBadge status={badgeInfo.type} customLabel={badgeInfo.label} />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Cluster connection diagnostics, manifest blueprint catalog, and multi-document YAML generator.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchStatus()}
            disabled={loadingStatus}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Probe Cluster</span>
          </button>
        </div>
      </div>

      {/* 2. Cluster Telemetry Banner */}
      <GlassCard className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Cluster Status</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.06] text-white/60 font-mono">
                {clusterStatus?.status === 'CONNECTED' ? 'Live Telemetry' : 'Offline / Standalone Mode'}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">
              {clusterStatus?.status === 'CONNECTED'
                ? `Connected: Context "${clusterStatus.currentContext || 'default'}"`
                : clusterStatus?.status === 'DISCONNECTED'
                ? 'No Active Kubernetes Cluster Connected'
                : 'kubectl Client Not Found'}
            </h3>
            <p className="text-xs text-white/60 leading-relaxed max-w-2xl">
              {clusterStatus?.message || 'Inspecting local kubeconfig contexts and cluster reachability...'}
            </p>
          </div>

          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border self-start md:self-auto ${
              clusterStatus?.status === 'CONNECTED'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            {clusterStatus?.status === 'CONNECTED' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
        </div>

        {clusterStatus?.clientVersion && (
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-4 text-xs font-mono text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              kubectl: {clusterStatus.clientVersion}
            </span>
            {clusterStatus.currentContext && (
              <span className="text-white/80">Active Context: {clusterStatus.currentContext}</span>
            )}
            {clusterStatus.clusterEndpoint && (
              <span className="text-emerald-400">Endpoint: {clusterStatus.clusterEndpoint}</span>
            )}
          </div>
        )}

        {clusterStatus?.status !== 'CONNECTED' && clusterStatus?.setupInstructions && (
          <div className="mt-4 p-3.5 rounded-lg bg-indigo-500/5 border border-indigo-500/15 space-y-2">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Note on Live Cluster Connection
            </span>
            <p className="text-xs text-white/70">
              DevWeave allows full preview, validation, and generation of Kubernetes manifests in standalone mode without requiring a running cluster. To connect a live cluster:
            </p>
            <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
              {clusterStatus.setupInstructions.map((instruction, idx) => (
                <li key={idx}>{instruction}</li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>

      {/* 3. Workload Architecture Notice & Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Workload Architecture</h2>
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">
              {clusterStatus?.status === 'CONNECTED' ? 'Live Cluster' : 'Simulated Preview (Disconnected)'}
            </span>
          </div>
          <span className="text-xs text-white/40">3 Workloads configured in blueprints</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">devweave-api</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                3/3 Pods Ready
              </span>
            </div>
            <p className="text-xs text-white/60">Deployment (RollingUpdate) &bull; port 8080</p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-white/40 font-mono">
              <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3 text-blue-400" /> 120m / 500m</span>
              <span className="inline-flex items-center gap-1"><Network className="h-3 w-3 text-indigo-400" /> ClusterIP</span>
            </div>
          </GlassCard>

          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">devweave-frontend</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                2/2 Pods Ready
              </span>
            </div>
            <p className="text-xs text-white/60">Nginx SPA &bull; port 80</p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-white/40 font-mono">
              <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3 text-blue-400" /> 45m / 250m</span>
              <span className="inline-flex items-center gap-1"><Network className="h-3 w-3 text-indigo-400" /> Ingress Enabled</span>
            </div>
          </GlassCard>

          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">postgres-cluster</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                1/1 Pod Ready
              </span>
            </div>
            <p className="text-xs text-white/60">StatefulSet &bull; PVC 20Gi &bull; port 5432</p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-white/40 font-mono">
              <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3 text-blue-400" /> 210m / 1000m</span>
              <span className="inline-flex items-center gap-1"><Network className="h-3 w-3 text-indigo-400" /> Internal Only</span>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* 4. Navigation Tabs */}
      <div className="flex border-b border-white/[0.08] gap-4">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          Manifest Blueprints ({templates.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('generator');
            if (!generatedYaml) void handleGenerateCustom();
          }}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'generator'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <FileCode className="h-4 w-4" />
          Full Multi-Doc Generator
        </button>
        <button
          onClick={() => setActiveTab('validator')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'validator'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          YAML Syntax Validator
        </button>
      </div>

      {/* 5. Tab Content: Manifest Blueprints */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1">
              Select K8s Resource
            </span>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedTemplateId === tpl.id
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/5'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tpl.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-indigo-400 font-mono">
                    {tpl.kind}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{tpl.description}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{tpl.bestPractices.length} Production Best Practices</span>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-8 space-y-4">
            {activeTemplate ? (
              <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{activeTemplate.name}</h3>
                    <p className="text-xs text-white/60 mt-0.5">{activeTemplate.description}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(activeTemplate.content, 'manifest')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium transition-all"
                  >
                    {copiedType === 'manifest' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedType === 'manifest' ? 'Copied' : 'Copy Manifest'}</span>
                  </button>
                </div>

                {/* Best Practices */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-white/40 uppercase font-semibold">Reliability Standards:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeTemplate.bestPractices.map((bp, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-white/70 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{bp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manifest Code */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-white/40">{activeTemplate.kind}.yaml</span>
                  <pre className="bg-black/60 p-4 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed max-h-[380px]">
                    <code>{activeTemplate.content}</code>
                  </pre>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="p-8 text-center text-white/50">
                {loadingTemplate ? 'Loading blueprint...' : 'Select a manifest blueprint from the list.'}
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* 6. Tab Content: Generator */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-5 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              Configure Service Architecture
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 block mb-1">Service Name</label>
                  <input
                    type="text"
                    value={customOptions.serviceName}
                    onChange={(e) => setCustomOptions({ ...customOptions, serviceName: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-white/60 block mb-1">Namespace</label>
                  <input
                    type="text"
                    value={customOptions.namespace}
                    onChange={(e) => setCustomOptions({ ...customOptions, namespace: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 block mb-1">Container Image Tag</label>
                <input
                  type="text"
                  value={customOptions.imageTag}
                  onChange={(e) => setCustomOptions({ ...customOptions, imageTag: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 block mb-1">Port</label>
                  <input
                    type="number"
                    value={customOptions.containerPort}
                    onChange={(e) => setCustomOptions({ ...customOptions, containerPort: parseInt(e.target.value) || 8080 })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-white/60 block mb-1">Replicas</label>
                  <input
                    type="number"
                    value={customOptions.replicas}
                    onChange={(e) => setCustomOptions({ ...customOptions, replicas: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-white/60 block mb-1">CPU Req / Limit</label>
                  <input
                    type="text"
                    value={`${customOptions.cpuRequest} / ${customOptions.cpuLimit}`}
                    readOnly
                    className="w-full px-3 py-1.5 rounded-lg bg-black/20 border border-white/[0.05] text-white/50 font-mono"
                  />
                </div>
                <div>
                  <label className="text-white/60 block mb-1">Memory Req / Limit</label>
                  <input
                    type="text"
                    value={`${customOptions.memoryRequest} / ${customOptions.memoryLimit}`}
                    readOnly
                    className="w-full px-3 py-1.5 rounded-lg bg-black/20 border border-white/[0.05] text-white/50 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customOptions.enableIngress}
                    onChange={(e) => setCustomOptions({ ...customOptions, enableIngress: e.target.checked })}
                    className="rounded bg-black/40 border-white/[0.1] text-indigo-600 focus:ring-0"
                  />
                  <span className="text-white/80">Include Ingress (Nginx Reverse Proxy)</span>
                </label>
                {customOptions.enableIngress && (
                  <input
                    type="text"
                    value={customOptions.ingressHost}
                    onChange={(e) => setCustomOptions({ ...customOptions, ingressHost: e.target.value })}
                    placeholder="Host domain (e.g. app.devweave.internal)"
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-indigo-500"
                  />
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customOptions.enableHpa}
                    onChange={(e) => setCustomOptions({ ...customOptions, enableHpa: e.target.checked })}
                    className="rounded bg-black/40 border-white/[0.1] text-indigo-600 focus:ring-0"
                  />
                  <span className="text-white/80">Include HPA (2 to 10 Replicas @ 80% CPU)</span>
                </label>
              </div>
            </div>

            <button
              onClick={() => void handleGenerateCustom()}
              disabled={generating}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg transition-all"
            >
              {generating ? 'Generating Manifests...' : 'Regenerate Multi-Doc YAML'}
            </button>
          </GlassCard>

          <GlassCard className="lg:col-span-7 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-xs font-semibold text-white">Generated Multi-Document YAML</span>
              <button
                onClick={() => handleCopy(generatedYaml, 'generated')}
                disabled={!generatedYaml}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                {copiedType === 'generated' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedType === 'generated' ? 'Copied' : 'Copy Multi-Doc'}</span>
              </button>
            </div>
            <pre className="bg-black/60 p-4 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed max-h-[460px]">
              <code>{generatedYaml || 'Click regenerate to create YAML...'}</code>
            </pre>
          </GlassCard>
        </div>
      )}

      {/* 7. Tab Content: Validator */}
      {activeTab === 'validator' && (
        <GlassCard className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Kubernetes Manifest Validator</h3>
              <p className="text-xs text-white/60 mt-0.5">
                Paste any single or multi-document Kubernetes YAML to verify apiVersion, kind, and structure.
              </p>
            </div>
            <button
              onClick={() => void handleValidate()}
              disabled={validating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition-all"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{validating ? 'Validating...' : 'Validate YAML'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-2">
              <label className="text-xs font-mono text-white/40 block">YAML Editor</label>
              <textarea
                rows={12}
                value={yamlToValidate}
                onChange={(e) => setYamlToValidate(e.target.value)}
                className="w-full p-4 rounded-xl bg-black/60 border border-white/[0.1] text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
              />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block">
                Validation Telemetry
              </label>

              {validationResult ? (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    validationResult.valid
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-rose-400" />
                    )}
                    <span className="font-semibold text-sm">
                      {validationResult.valid ? 'Valid Manifest' : 'Validation Failed'}
                    </span>
                  </div>
                  <p className="text-xs text-white/70">
                    Parsed {validationResult.parsedDocuments} resource document(s).
                  </p>
                  {validationResult.errors.length > 0 && (
                    <ul className="text-xs text-rose-400 space-y-1 list-disc list-inside pt-1">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-white/50 text-center">
                  Click "Validate YAML" to run syntax verification.
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
