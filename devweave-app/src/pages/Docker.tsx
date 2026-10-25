import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Layers,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Sliders,
  FileCode,
  FileText,
  Sparkles,
  Network,
  HardDrive,
  Activity,
  Boxes,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge, type StatusType } from '../components/ui/StatusBadge';
import {
  dockerService,
  type DockerStatus,
  type DockerTemplateSummary,
  type DockerTemplateDetail,
  type CustomDockerParams,
  type DockerRunnerStatus,
  type DockerInventorySnapshot,
  type DockerAuditEvent,
} from '../services/dockerService';
import { OneClickDockerizer } from '../components/docker/OneClickDockerizer';
import { DockerContainersManager } from '../components/docker/DockerContainersManager';
import { DockerImagesManager } from '../components/docker/DockerImagesManager';
import { DockerNetworksManager } from '../components/docker/DockerNetworksManager';
import { DockerVolumesManager } from '../components/docker/DockerVolumesManager';
import { DockerEventsManager } from '../components/docker/DockerEventsManager';

export const Docker: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<DockerStatus | null>(null);
  const [runnerStatus, setRunnerStatus] = useState<DockerRunnerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [templates, setTemplates] = useState<DockerTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('nodejs-express');
  const [activeTemplate, setActiveTemplate] = useState<DockerTemplateDetail | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'containers' | 'images' | 'networks' | 'volumes' | 'dockerize' | 'events' | 'templates' | 'custom' | 'compose'
  >('containers');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Manage Docker State
  const [inventory, setInventory] = useState<DockerInventorySnapshot | null>(null);
  const [auditEvents, setAuditEvents] = useState<DockerAuditEvent[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Custom Generator State
  const [customParams, setCustomParams] = useState<CustomDockerParams>({
    language: 'Node.js',
    baseImage: 'node:20-alpine',
    port: 8080,
    workdir: '/app',
    installCmd: 'npm ci',
    buildCmd: 'npm run build',
    startCmd: 'node dist/server.js',
    nonRootUser: true,
  });
  const [generatedDockerfile, setGeneratedDockerfile] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Image tag & build command config
  const [imageTag, setImageTag] = useState('devweave-service:v1.0.0');
  const [dockerfilePath, setDockerfilePath] = useState('Dockerfile');

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);

    try {
      const runner = await dockerService.getRunnerStatus();
      setRunnerStatus(runner);
      const snapshot = runner.snapshot;

      if (runner.online && snapshot) {
        setStatus({
          installed: true,
          cliVersion: snapshot.dockerVersion,
          daemonRunning: true,
          serverVersion: snapshot.serverVersion,
          containersRunning: snapshot.containersRunning,
          containersTotal: snapshot.containersTotal,
          imagesTotal: snapshot.imagesTotal,
          status: 'CONNECTED',
          message: `Windows Docker Desktop runner connected (${snapshot.runnerId}). Last report: ${snapshot.reportedAt}.`,
          setupInstructions: [],
        });
      } else {
        setStatus({
          installed: false,
          cliVersion: null,
          daemonRunning: false,
          serverVersion: null,
          status: 'DAEMON_OFFLINE',
          message: 'Windows Docker Desktop runner is offline or has not sent a heartbeat.',
          setupInstructions: [
            'Start Docker Desktop on your Windows PC.',
            'Configure the runner with the backend URL and runner token.',
            'Start the DevWeave Docker runner and check again.',
          ],
        });
      }
    } catch (error) {
      console.error('Failed to load Docker runner status', error);

      setStatus({
        installed: false,
        cliVersion: null,
        daemonRunning: false,
        serverVersion: null,
        status: 'DAEMON_OFFLINE',
        message: 'Could not retrieve Windows Docker runner status. Check backend authentication and connectivity.',
        setupInstructions: [
          'Confirm the backend is running.',
          'Sign in with a valid DevWeave application session.',
          'Check the runner status API and try again.',
        ],
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const list = await dockerService.getTemplates();
      setTemplates(list);
      if (list.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load docker templates', err);
    }
  }, [selectedTemplateId]);

  const loadTemplateDetail = useCallback(async (id: string) => {
    setLoadingTemplate(true);
    try {
      const detail = await dockerService.getTemplateById(id);
      setActiveTemplate(detail);
    } catch (err) {
      console.error('Failed to load template detail', err);
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const data = await dockerService.getInventory();
      setInventory(data);
    } catch (err) {
      console.error('Failed to load Docker inventory', err);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await dockerService.getAuditLogs(50);
      setAuditEvents(data);
    } catch (err) {
      console.error('Failed to load Docker audit logs', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void fetchTemplates();
    void fetchInventory();
    void fetchEvents();

    const interval = setInterval(() => {
      void fetchStatus();
      void fetchInventory();
      void fetchEvents();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchTemplates, fetchInventory, fetchEvents]);

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
      const res = await dockerService.generateDockerfile(customParams);
      setGeneratedDockerfile(res.dockerfile);
    } catch (err) {
      console.error('Failed to generate dockerfile', err);
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadgeInfo = (): { type: StatusType; label: string } => {
    if (loadingStatus) return { type: 'Pending', label: 'Probing Docker...' };
    if (!status) return { type: 'Offline', label: 'Unknown' };
    if (status.status === 'CONNECTED') return { type: 'Running', label: 'Daemon Active' };
    if (status.status === 'DAEMON_OFFLINE') return { type: 'Warning', label: 'Daemon Offline' };
    return { type: 'Failed', label: 'Not Installed' };
  };

  const badgeInfo = getStatusBadgeInfo();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Container className="h-7 w-7 text-blue-400" />
              Docker Management
            </h1>
            <StatusBadge status={badgeInfo.type} customLabel={badgeInfo.label} />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Container runtime status, multi-stage Dockerfile blueprints, and CI/CD container build configuration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void fetchStatus();
              void fetchInventory();
              void fetchEvents();
            }}
            disabled={loadingStatus || loadingInventory}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus || loadingInventory ? 'animate-spin text-blue-400' : ''}`} />
            <span>Check Daemon</span>
          </button>
          <button
            onClick={() => navigate('/pipelines')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <span>Docker CI/CD Pipeline</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Docker Daemon Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 md:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Engine Telemetry</span>
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.06] text-white/60 font-mono">Live Probe</span>
              </div>
              <h3 className="text-base font-semibold text-white">
                {status?.status === 'CONNECTED'
                  ? `Docker Engine ${status.serverVersion || ''}`
                  : status?.status === 'DAEMON_OFFLINE'
                    ? 'Docker CLI Detected — Daemon Offline'
                    : 'Docker Not Installed in PATH'}
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">{status?.message}</p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${status?.status === 'CONNECTED'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : status?.status === 'DAEMON_OFFLINE'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
            >
              {status?.status === 'CONNECTED' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
          </div>

          {status?.cliVersion && (
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-4 text-xs font-mono text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-blue-400" />
                {status.cliVersion}
              </span>
              {status.status === 'CONNECTED' && (
                <>
                  <span className="text-emerald-400">Containers: {status.containersRunning} running / {status.containersTotal} total</span>
                  <span className="text-blue-400">Images: {status.imagesTotal} cached</span>
                </>
              )}
            </div>
          )}

          {status?.status !== 'CONNECTED' && status?.setupInstructions && status.setupInstructions.length > 0 && (
            <div className="mt-4 p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Instructions to Connect Daemon
              </span>
              <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
                {status.setupInstructions.map((instruction, idx) => (
                  <li key={idx}>{instruction}</li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>

        {/* Build Command Generator Preview */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Build Command</span>
              <Sliders className="h-3.5 w-3.5 text-white/40" />
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-white/60 block mb-1">Image Tag</label>
                <input
                  type="text"
                  value={imageTag}
                  onChange={(e) => setImageTag(e.target.value)}
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/60 block mb-1">Dockerfile Path</label>
                <input
                  type="text"
                  value={dockerfilePath}
                  onChange={(e) => setDockerfilePath(e.target.value)}
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-2">
            <div className="bg-black/50 p-2.5 rounded-lg border border-white/[0.08] text-[11px] font-mono text-emerald-400 break-all select-all">
              docker build -t {imageTag} -f {dockerfilePath} .
            </div>
            <button
              onClick={() => handleCopy(`docker build -t ${imageTag} -f ${dockerfilePath} .`, 'cmd')}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/80 text-xs font-medium transition-all"
            >
              {copiedType === 'cmd' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedType === 'cmd' ? 'Copied to Clipboard' : 'Copy Command'}</span>
            </button>
          </div>
        </GlassCard>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-white/[0.08] gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('containers')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'containers'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Boxes className="h-4 w-4 text-blue-400" />
          <span>Containers</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
            {inventory?.containers.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('images')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'images'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4 text-cyan-400" />
          <span>Images</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
            {inventory?.images.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('networks')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'networks'
              ? 'border-purple-500 text-white font-semibold'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Network className="h-4 w-4 text-purple-400" />
          <span>Networks</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
            {inventory?.networks.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('volumes')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'volumes'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <HardDrive className="h-4 w-4 text-emerald-400" />
          <span>Volumes</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
            {inventory?.volumes.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dockerize')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'dockerize'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <span>One-Click Dockerize</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
            NEW
          </span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'events'
              ? 'border-amber-500 text-white font-semibold'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4 text-amber-400" />
          <span>Activity Log</span>
          {auditEvents.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              {auditEvents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'templates'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Blueprints ({templates.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('custom');
            if (!generatedDockerfile) void handleGenerateCustom();
          }}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'custom'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <FileCode className="h-4 w-4" />
          <span>Custom Generator</span>
        </button>

        <button
          onClick={() => setActiveTab('compose')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'compose'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Compose</span>
        </button>
      </div>

      {/* Tab Content: Containers */}
      {activeTab === 'containers' && (
        <DockerContainersManager
          containers={inventory?.containers || []}
          availableImages={(inventory?.images || [])
            .filter((img) => !img.isDangling)
            .map((img) =>
              img.repository !== '<none>' && img.tag !== '<none>'
                ? `${img.repository}:${img.tag}`
                : img.repository
            )
            .filter(Boolean)}
          runnerOnline={runnerStatus?.online ?? false}
          onRefresh={() => {
            void fetchInventory();
            void fetchEvents();
          }}
          onNavigateToBuilds={() => setActiveTab('dockerize')}
        />
      )}

      {/* Tab Content: Images */}
      {activeTab === 'images' && (
        <DockerImagesManager
          images={inventory?.images || []}
          runnerOnline={runnerStatus?.online ?? false}
          onRefresh={() => {
            void fetchInventory();
            void fetchEvents();
          }}
          onNavigateToDockerizer={() => setActiveTab('dockerize')}
        />
      )}

      {/* Tab Content: Networks */}
      {activeTab === 'networks' && (
        <DockerNetworksManager
          networks={inventory?.networks || []}
          containers={inventory?.containers || []}
          runnerOnline={runnerStatus?.online ?? false}
          onRefresh={() => {
            void fetchInventory();
            void fetchEvents();
          }}
        />
      )}

      {/* Tab Content: Volumes */}
      {activeTab === 'volumes' && (
        <DockerVolumesManager
          volumes={inventory?.volumes || []}
          runnerOnline={runnerStatus?.online ?? false}
          onRefresh={() => {
            void fetchInventory();
            void fetchEvents();
          }}
        />
      )}

      {/* Tab Content: Events / Activity */}
      {activeTab === 'events' && (
        <DockerEventsManager
          events={auditEvents}
          loading={loadingEvents}
          onRefresh={() => void fetchEvents()}
        />
      )}

      {/* Tab Content: One-Click Dockerize */}
      {activeTab === 'dockerize' && (
        <OneClickDockerizer
          runnerStatus={runnerStatus}
          onRefreshRunnerStatus={fetchStatus}
        />
      )}

      {/* 4. Tab Content: Predefined Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Template Selection Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1">
              Select Framework / Stack
            </span>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedTemplateId === tpl.id
                    ? 'bg-blue-500/10 border-blue-500/30 text-white shadow-lg shadow-blue-500/5'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.05] hover:text-white'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tpl.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 font-mono">
                    Port {tpl.defaultPort}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{tpl.description}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{tpl.bestPractices.length} Security Best Practices</span>
                </div>
              </div>
            ))}
          </div>

          {/* Template Code Viewer */}
          <div className="lg:col-span-8 space-y-4">
            {activeTemplate ? (
              <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{activeTemplate.name}</h3>
                    <p className="text-xs text-white/60 mt-0.5">{activeTemplate.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(activeTemplate.content, 'dockerfile')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium transition-all"
                    >
                      {copiedType === 'dockerfile' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedType === 'dockerfile' ? 'Copied' : 'Copy Dockerfile'}</span>
                    </button>
                    <button
                      onClick={() => navigate('/pipelines')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all"
                    >
                      <span>Build in Jenkins</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Best Practices Pills */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-white/40 uppercase font-semibold">Security & Optimization:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeTemplate.bestPractices.map((bp, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-white/70 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{bp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code Window */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-white/40">Dockerfile (Multi-Stage)</span>
                  <pre className="bg-black/60 p-4 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed max-h-[380px]">
                    <code>{activeTemplate.content}</code>
                  </pre>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="p-8 text-center text-white/50">
                {loadingTemplate ? 'Loading blueprint...' : 'Select a framework blueprint from the list.'}
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab Content: Custom Generator */}
      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-5 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-400" />
              Configure Custom Container
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-white/60 block mb-1">Base Image</label>
                <input
                  type="text"
                  value={customParams.baseImage}
                  onChange={(e) => setCustomParams({ ...customParams, baseImage: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 block mb-1">Container Port</label>
                  <input
                    type="number"
                    value={customParams.port}
                    onChange={(e) => setCustomParams({ ...customParams, port: parseInt(e.target.value) || 8080 })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-white/60 block mb-1">Working Directory</label>
                  <input
                    type="text"
                    value={customParams.workdir}
                    onChange={(e) => setCustomParams({ ...customParams, workdir: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/60 block mb-1">Dependency Install Command</label>
                <input
                  type="text"
                  value={customParams.installCmd}
                  onChange={(e) => setCustomParams({ ...customParams, installCmd: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-white/60 block mb-1">Build Command</label>
                <input
                  type="text"
                  value={customParams.buildCmd}
                  onChange={(e) => setCustomParams({ ...customParams, buildCmd: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-white/60 block mb-1">Startup Command</label>
                <input
                  type="text"
                  value={customParams.startCmd}
                  onChange={(e) => setCustomParams({ ...customParams, startCmd: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:border-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={customParams.nonRootUser}
                  onChange={(e) => setCustomParams({ ...customParams, nonRootUser: e.target.checked })}
                  className="rounded bg-black/40 border-white/[0.1] text-blue-600 focus:ring-0"
                />
                <span className="text-white/80">Enforce unprivileged non-root execution (Security Hardened)</span>
              </label>
            </div>

            <button
              onClick={() => void handleGenerateCustom()}
              disabled={generating}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg transition-all"
            >
              {generating ? 'Generating...' : 'Regenerate Dockerfile'}
            </button>
          </GlassCard>

          <GlassCard className="lg:col-span-7 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-xs font-semibold text-white">Generated Output</span>
              <button
                onClick={() => handleCopy(generatedDockerfile, 'custom')}
                disabled={!generatedDockerfile}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                {copiedType === 'custom' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedType === 'custom' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="bg-black/60 p-4 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed max-h-[440px]">
              <code>{generatedDockerfile || 'Generating custom Dockerfile...'}</code>
            </pre>
          </GlassCard>
        </div>
      )}

      {/* 6. Tab Content: Docker Compose */}
      {activeTab === 'compose' && (
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Full-Stack docker-compose.yml</h3>
              <p className="text-xs text-white/60 mt-0.5">
                Multi-container orchestration linking DevWeave frontend, backend, and PostgreSQL database.
              </p>
            </div>
            <button
              onClick={() =>
                handleCopy(
                  `version: '3.8'

services:
  devweave-backend:
    build:
      context: ./devweave-backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - DATABASE_URL=postgresql://devweave:password@postgres:5432/devweave
    depends_on:
      - postgres
    restart: unless-stopped

  devweave-frontend:
    build:
      context: ./devweave-app
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - devweave-backend
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=devweave
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=devweave
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:`,
                  'compose'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium transition-all"
            >
              {copiedType === 'compose' ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedType === 'compose' ? 'Copied Compose File' : 'Copy docker-compose.yml'}</span>
            </button>
          </div>

          <pre className="bg-black/60 p-4 rounded-xl border border-white/[0.08] text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
            <code>{`version: '3.8'

services:
  devweave-backend:
    build:
      context: ./devweave-backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - DATABASE_URL=postgresql://devweave:password@postgres:5432/devweave
    depends_on:
      - postgres
    restart: unless-stopped

  devweave-frontend:
    build:
      context: ./devweave-app
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - devweave-backend
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=devweave
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=devweave
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:`}</code>
          </pre>
        </GlassCard>
      )}
    </div>
  );
};
