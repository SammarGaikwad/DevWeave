import React, { useState, useMemo } from 'react';
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  FileText,
  Search,
  ShieldAlert,
  Plus,
  RefreshCw,
  Code,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  dockerService,
  type DockerContainerSummary,
  type CreateContainerParams,
  type RecreateContainerParams,
} from '../../services/dockerService';
import { DockerConfirmModal } from './DockerConfirmModal';
import { GlassCard } from '../ui/GlassCard';

interface DockerContainersManagerProps {
  containers: DockerContainerSummary[];
  availableImages: string[];
  runnerOnline: boolean;
  onRefresh: () => void;
  onNavigateToBuilds?: () => void;
}

export const DockerContainersManager: React.FC<DockerContainersManagerProps> = ({
  containers,
  availableImages,
  runnerOnline,
  onRefresh,
  onNavigateToBuilds,
}) => {
  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'exited'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Active Action Modals
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isDestructive?: boolean;
    isProtected?: boolean;
    warningMessage?: string;
    affectedResources?: string[];
    stopFirstOption?: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    onConfirm: async () => {},
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [stopFirstChecked, setStopFirstChecked] = useState(false);

  // Drawers
  const [logsDrawer, setLogsDrawer] = useState<{ isOpen: boolean; containerId: string; containerName: string; logs: string; loading: boolean }>({
    isOpen: false,
    containerId: '',
    containerName: '',
    logs: '',
    loading: false,
  });
  const [copiedLogs, setCopiedLogs] = useState(false);

  const [inspectDrawer, setInspectDrawer] = useState<{ isOpen: boolean; containerId: string; containerName: string; data: any; loading: boolean }>({
    isOpen: false,
    containerId: '',
    containerName: '',
    data: null,
    loading: false,
  });
  const [copiedInspect, setCopiedInspect] = useState(false);

  // Create Container Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateContainerParams>({
    name: '',
    image: '',
    ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
    envVars: [{ key: '', value: '' }],
    volumes: [],
    restartPolicy: 'unless-stopped',
    network: 'bridge',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Recreate Container Modal State
  const [recreateModalOpen, setRecreateModalOpen] = useState(false);
  const [recreateTarget, setRecreateTarget] = useState<DockerContainerSummary | null>(null);
  const [recreateForm, setRecreateForm] = useState<RecreateContainerParams>({
    containerId: '',
    name: '',
    image: '',
    ports: [],
    envVars: [],
    restartPolicy: 'unless-stopped',
  });
  const [recreateLoading, setRecreateLoading] = useState(false);
  const [recreateError, setRecreateError] = useState<string | null>(null);

  // Filtered & Paginated Containers
  const filteredContainers = useMemo(() => {
    return containers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'running' && c.state === 'running') ||
        (statusFilter === 'exited' && c.state !== 'running');
      return matchesSearch && matchesStatus;
    });
  }, [containers, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredContainers.length / itemsPerPage) || 1;
  const paginatedContainers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredContainers.slice(start, start + itemsPerPage);
  }, [filteredContainers, currentPage, itemsPerPage]);

  // Actions
  const handleStart = async (container: DockerContainerSummary) => {
    try {
      setActionLoading(true);
      await dockerService.startContainer(container.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to start container.');
    } finally {
      setActionLoading(false);
    }
  };

  const promptStop = (container: DockerContainerSummary) => {
    setConfirmModalState({
      isOpen: true,
      title: `Stop Container "${container.name}"`,
      description: `Are you sure you want to gracefully stop container ${container.name}? Running processes inside will receive a SIGTERM before being stopped.`,
      actionLabel: 'Stop Container',
      isDestructive: false,
      isProtected: container.isProtected,
      warningMessage: container.isProtected
        ? 'Protected resources cannot be stopped.'
        : undefined,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await dockerService.stopContainer(container.id);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to stop container.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const promptRestart = (container: DockerContainerSummary) => {
    setConfirmModalState({
      isOpen: true,
      title: `Restart Container "${container.name}"`,
      description: `Are you sure you want to restart container ${container.name}?`,
      actionLabel: 'Restart Container',
      isDestructive: false,
      isProtected: container.isProtected,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await dockerService.restartContainer(container.id);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to restart container.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const promptDelete = (container: DockerContainerSummary) => {
    setStopFirstChecked(container.state === 'running');
    setConfirmModalState({
      isOpen: true,
      title: `Remove Container "${container.name}"`,
      description: `Are you sure you want to delete container ${container.name}? All writable layer data not mounted to a persistent volume will be permanently discarded.`,
      actionLabel: 'Remove Container',
      isDestructive: true,
      isProtected: container.isProtected,
      affectedResources: [
        `Container ID: ${container.id.substring(0, 12)}`,
        `Image: ${container.image}`,
        `Ports: ${container.ports.map((p) => `${p.hostPort || ''}->${p.containerPort}`).join(', ') || 'None'}`,
      ],
      warningMessage: container.state === 'running'
        ? 'Container is currently RUNNING. Check the option below to stop it gracefully before deletion.'
        : undefined,
      stopFirstOption: container.state === 'running',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await dockerService.deleteContainer(container.id, stopFirstChecked);
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to remove container.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const openLogs = async (container: DockerContainerSummary) => {
    setLogsDrawer({
      isOpen: true,
      containerId: container.id,
      containerName: container.name,
      logs: '',
      loading: true,
    });
    try {
      const res = await dockerService.getContainerLogs(container.id, 300, true);
      setLogsDrawer((prev) => ({ ...prev, logs: res.logs || '(No logs recorded)', loading: false }));
    } catch (err: any) {
      setLogsDrawer((prev) => ({ ...prev, logs: `Error loading logs: ${err.message}`, loading: false }));
    }
  };

  const refreshLogs = async () => {
    if (!logsDrawer.containerId) return;
    setLogsDrawer((prev) => ({ ...prev, loading: true }));
    try {
      const res = await dockerService.getContainerLogs(logsDrawer.containerId, 300, true);
      setLogsDrawer((prev) => ({ ...prev, logs: res.logs || '(No logs recorded)', loading: false }));
    } catch (err: any) {
      setLogsDrawer((prev) => ({ ...prev, logs: `Error loading logs: ${err.message}`, loading: false }));
    }
  };

  const openInspect = async (container: DockerContainerSummary) => {
    setInspectDrawer({
      isOpen: true,
      containerId: container.id,
      containerName: container.name,
      data: null,
      loading: true,
    });
    try {
      const res = await dockerService.inspectContainer(container.id);
      setInspectDrawer((prev) => ({ ...prev, data: res, loading: false }));
    } catch (err: any) {
      setInspectDrawer((prev) => ({ ...prev, data: { error: err.message }, loading: false }));
    }
  };

  const openRecreateModal = (container: DockerContainerSummary) => {
    setRecreateTarget(container);
    setRecreateForm({
      containerId: container.id,
      name: container.name,
      image: container.image,
      ports:
        container.ports.length > 0
          ? container.ports.map((p) => ({
              hostPort: p.hostPort,
              containerPort: p.containerPort,
              protocol: (p.protocol === 'udp' ? 'udp' : 'tcp') as 'tcp' | 'udp',
            }))
          : [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
      envVars: [{ key: '', value: '' }],
      restartPolicy: 'unless-stopped',
    });
    setRecreateError(null);
    setRecreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.image.trim()) {
      setCreateError('Container name and image reference are required.');
      return;
    }
    // Prevent duplicate name on client
    if (containers.some((c) => c.name.toLowerCase() === createForm.name.trim().toLowerCase())) {
      setCreateError(`A container with the name "${createForm.name.trim()}" already exists.`);
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      const validPorts = (createForm.ports || []).filter((p) => p.containerPort > 0);
      const validEnv = (createForm.envVars || []).filter((ev) => ev.key.trim().length > 0);
      await dockerService.createContainer({
        ...createForm,
        name: createForm.name.trim(),
        image: createForm.image.trim(),
        ports: validPorts,
        envVars: validEnv,
      });
      setCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create container.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRecreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recreateForm.image.trim()) {
      setRecreateError('Image reference is required.');
      return;
    }
    setRecreateLoading(true);
    setRecreateError(null);
    try {
      const validPorts = (recreateForm.ports || []).filter((p) => p.containerPort > 0);
      const validEnv = (recreateForm.envVars || []).filter((ev) => ev.key.trim().length > 0);
      await dockerService.recreateContainer({
        ...recreateForm,
        ports: validPorts,
        envVars: validEnv,
      });
      setRecreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setRecreateError(err.message || 'Failed to recreate container.');
    } finally {
      setRecreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, ID, or image..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-700/60 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex rounded-xl p-0.5 bg-slate-900/80 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-blue-600/30 text-blue-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({containers.length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('running');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'running'
                  ? 'bg-emerald-600/30 text-emerald-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Running ({containers.filter((c) => c.state === 'running').length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('exited');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'exited'
                  ? 'bg-slate-700/40 text-slate-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stopped ({containers.filter((c) => c.state !== 'running').length})
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            title="Refresh containers"
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCreateForm({
                name: '',
                image: availableImages[0] || 'checkkkk:main',
                ports: [{ hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
                envVars: [{ key: '', value: '' }],
                volumes: [],
                restartPolicy: 'unless-stopped',
                network: 'bridge',
              });
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            disabled={!runnerOnline}
            className={`px-3.5 py-2 text-xs font-medium rounded-xl flex items-center space-x-1.5 shadow-lg transition ${
              runnerOnline
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Launch Container</span>
          </button>
        </div>
      </div>

      {/* Containers List / Table */}
      <GlassCard className="overflow-hidden p-0 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-medium uppercase tracking-wider">
                <th className="py-3 px-4">Container</th>
                <th className="py-3 px-4">Image</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Ports</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedContainers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-sm text-slate-300">No containers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm ? 'Try adjusting your search query or filters.' : 'Launch a new container or build an image to get started.'}
                    </p>
                    {onNavigateToBuilds && !searchTerm && (
                      <button
                        onClick={onNavigateToBuilds}
                        className="mt-3 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg text-xs font-medium border border-blue-500/30 transition"
                      >
                        Go to One-Click Dockerizer
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedContainers.map((container) => {
                  const isRunning = container.state === 'running';
                  return (
                    <tr
                      key={container.id}
                      className="hover:bg-slate-850/40 transition group"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-100 text-sm">
                              <span>{container.name}</span>
                              {container.isProtected && (
                                <span
                                  title="Protected System Resource"
                                  className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[10px] text-red-300 flex items-center gap-1 font-normal"
                                >
                                  <ShieldAlert className="w-3 h-3 text-red-400" /> Protected
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-400">
                              {container.id.substring(0, 12)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Image */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800/90 text-blue-300">
                          {container.image}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] font-medium border ${
                            isRunning
                              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-800/40 border-slate-700 text-slate-400'
                          }`}
                        >
                          {container.status || container.state}
                        </span>
                      </td>

                      {/* Ports */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        {container.ports.length > 0 ? (
                          <div className="space-y-0.5">
                            {container.ports.map((p, idx) => (
                              <div key={idx} className="text-slate-300">
                                {p.hostPort ? (
                                  <span className="text-emerald-400">{p.hostPort}:</span>
                                ) : null}
                                <span>{p.containerPort}/{p.protocol}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-slate-400 text-xs">
                        {container.created || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {isRunning ? (
                            <button
                              onClick={() => promptStop(container)}
                              disabled={container.isProtected || !runnerOnline}
                              title={container.isProtected ? 'Protected container' : 'Stop container'}
                              className={`p-1.5 rounded-lg border transition ${
                                container.isProtected
                                  ? 'text-slate-600 border-transparent cursor-not-allowed'
                                  : 'text-amber-400 hover:text-amber-300 bg-amber-950/20 hover:bg-amber-900/30 border-amber-500/20'
                              }`}
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStart(container)}
                              disabled={!runnerOnline}
                              title="Start container"
                              className="p-1.5 rounded-lg border text-emerald-400 hover:text-emerald-300 bg-emerald-950/20 hover:bg-emerald-900/30 border-emerald-500/20 transition"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => promptRestart(container)}
                            disabled={container.isProtected || !runnerOnline}
                            title={container.isProtected ? 'Protected container' : 'Restart container'}
                            className={`p-1.5 rounded-lg border transition ${
                              container.isProtected
                                ? 'text-slate-600 border-transparent cursor-not-allowed'
                                : 'text-blue-400 hover:text-blue-300 bg-blue-950/20 hover:bg-blue-900/30 border-blue-500/20'
                            }`}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => openRecreateModal(container)}
                            disabled={container.isProtected || !runnerOnline}
                            title={container.isProtected ? 'Protected container' : 'Edit / Recreate container'}
                            className={`p-1.5 rounded-lg border transition ${
                              container.isProtected
                                ? 'text-slate-600 border-transparent cursor-not-allowed'
                                : 'text-purple-400 hover:text-purple-300 bg-purple-950/20 hover:bg-purple-900/30 border-purple-500/20'
                            }`}
                          >
                            <Code className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => openLogs(container)}
                            title="View container logs"
                            className="p-1.5 rounded-lg border text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 border-slate-700/40 transition"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => openInspect(container)}
                            title="Inspect container configuration"
                            className="p-1.5 rounded-lg border text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 border-slate-700/40 transition"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => promptDelete(container)}
                            disabled={container.isProtected || !runnerOnline}
                            title={container.isProtected ? 'Protected container cannot be deleted' : 'Delete container'}
                            className={`p-1.5 rounded-lg border transition ${
                              container.isProtected
                                ? 'text-slate-600 border-transparent cursor-not-allowed'
                                : 'text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 border-red-500/20'
                            }`}
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

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/30 text-xs text-slate-400">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredContainers.length)} of{' '}
              {filteredContainers.length} containers
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Logs Drawer Modal */}
      {logsDrawer.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl h-full p-6 glass-panel border-l border-slate-800 bg-slate-900 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-semibold text-slate-100">Logs: {logsDrawer.containerName}</h3>
                  <span className="font-mono text-xs text-slate-400">
                    ID: {logsDrawer.containerId.substring(0, 12)}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={refreshLogs}
                  disabled={logsDrawer.loading}
                  title="Refresh logs"
                  className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${logsDrawer.loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(logsDrawer.logs);
                    setCopiedLogs(true);
                    setTimeout(() => setCopiedLogs(false), 2000);
                  }}
                  title="Copy logs"
                  className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1 text-xs"
                >
                  {copiedLogs ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setLogsDrawer((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black/90 p-4 rounded-xl border border-slate-800 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
              {logsDrawer.loading ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading logs from Windows runner...
                </div>
              ) : (
                logsDrawer.logs
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inspect Drawer Modal */}
      {inspectDrawer.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl h-full p-6 glass-panel border-l border-slate-800 bg-slate-900 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="font-semibold text-slate-100">Inspect: {inspectDrawer.containerName}</h3>
                  <span className="font-mono text-xs text-slate-400">
                    ID: {inspectDrawer.containerId.substring(0, 12)} (Sensitive values redacted)
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectDrawer.data, null, 2));
                    setCopiedInspect(true);
                    setTimeout(() => setCopiedInspect(false), 2000);
                  }}
                  title="Copy JSON"
                  className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition flex items-center gap-1 text-xs"
                >
                  {copiedInspect ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedInspect ? 'Copied' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={() => setInspectDrawer((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black/90 p-4 rounded-xl border border-slate-800 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre leading-relaxed select-text">
              {inspectDrawer.loading ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Inspecting container details...
                </div>
              ) : (
                JSON.stringify(inspectDrawer.data, null, 2)
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Container Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Launch New Container</h3>
                  <p className="text-xs text-slate-400">Run a container on Windows Docker Desktop</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Container Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. devweave-web-service"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Image Reference *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. checkkkk:main or node:20-alpine"
                    value={createForm.image}
                    onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {availableImages.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setCreateForm({ ...createForm, image: e.target.value });
                      }}
                      className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300"
                    >
                      <option value="">Select image...</option>
                      {availableImages.map((img, i) => (
                        <option key={i} value={img}>{img}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Port Mappings */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Port Mappings</label>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        ports: [...(createForm.ports || []), { hostPort: 3000, containerPort: 3000, protocol: 'tcp' }],
                      })
                    }
                    className="text-blue-400 hover:text-blue-300 text-[11px]"
                  >
                    + Add Port
                  </button>
                </div>
                <div className="space-y-2">
                  {(createForm.ports || []).map((port, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Host (e.g. 8080)"
                        value={port.hostPort || ''}
                        onChange={(e) => {
                          const updated = [...(createForm.ports || [])];
                          updated[idx].hostPort = parseInt(e.target.value, 10) || undefined;
                          setCreateForm({ ...createForm, ports: updated });
                        }}
                        className="w-1/3 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                      />
                      <span className="text-slate-500">→</span>
                      <input
                        type="number"
                        placeholder="Container (e.g. 80)"
                        value={port.containerPort || ''}
                        onChange={(e) => {
                          const updated = [...(createForm.ports || [])];
                          updated[idx].containerPort = parseInt(e.target.value, 10) || 0;
                          setCreateForm({ ...createForm, ports: updated });
                        }}
                        className="w-1/3 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                      />
                      <select
                        value={port.protocol || 'tcp'}
                        onChange={(e) => {
                          const updated = [...(createForm.ports || [])];
                          updated[idx].protocol = e.target.value as any;
                          setCreateForm({ ...createForm, ports: updated });
                        }}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300"
                      >
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (createForm.ports || []).filter((_, i) => i !== idx);
                          setCreateForm({ ...createForm, ports: updated });
                        }}
                        className="text-red-400 hover:text-red-300 px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Environment Variables</label>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        envVars: [...(createForm.envVars || []), { key: '', value: '' }],
                      })
                    }
                    className="text-blue-400 hover:text-blue-300 text-[11px]"
                  >
                    + Add Variable
                  </button>
                </div>
                <div className="space-y-2">
                  {(createForm.envVars || []).map((env, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="KEY (e.g. NODE_ENV)"
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...(createForm.envVars || [])];
                          updated[idx].key = e.target.value;
                          setCreateForm({ ...createForm, envVars: updated });
                        }}
                        className="w-1/2 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                      />
                      <span className="text-slate-500">=</span>
                      <input
                        type="text"
                        placeholder="VALUE (e.g. production)"
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...(createForm.envVars || [])];
                          updated[idx].value = e.target.value;
                          setCreateForm({ ...createForm, envVars: updated });
                        }}
                        className="w-1/2 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (createForm.envVars || []).filter((_, i) => i !== idx);
                          setCreateForm({ ...createForm, envVars: updated });
                        }}
                        className="text-red-400 hover:text-red-300 px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Restart Policy & Network */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Restart Policy</label>
                  <select
                    value={createForm.restartPolicy || 'unless-stopped'}
                    onChange={(e) => setCreateForm({ ...createForm, restartPolicy: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                  >
                    <option value="no">no</option>
                    <option value="unless-stopped">unless-stopped</option>
                    <option value="always">always</option>
                    <option value="on-failure">on-failure</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Network</label>
                  <input
                    type="text"
                    value={createForm.network || 'bridge'}
                    onChange={(e) => setCreateForm({ ...createForm, network: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-900/30 flex items-center space-x-2"
                >
                  {createLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Launch Container</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recreate Container Modal */}
      {recreateModalOpen && recreateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl glass-panel border border-purple-500/30 bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    Safe Recreate Container: {recreateTarget.name}
                  </h3>
                  <p className="text-xs text-slate-400">Update image, ports, or environment variables</p>
                </div>
              </div>
              <button
                onClick={() => setRecreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Docker Recreate Explanation */}
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200 text-xs leading-relaxed space-y-1">
              <span className="font-semibold text-purple-100 flex items-center gap-1.5">
                <Info className="w-4 h-4" /> Docker Recreation Workflow
              </span>
              <p>
                Docker architecture does not support modifying container images, port mappings, or environment variables in-place.
                DevWeave will inspect the current container, gracefully stop and remove it, then relaunch a new container with the exact same name and merged settings.
              </p>
            </div>

            {recreateError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs">
                {recreateError}
              </div>
            )}

            <form onSubmit={handleRecreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Image *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={recreateForm.image}
                    onChange={(e) => setRecreateForm({ ...recreateForm, image: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                  />
                  {availableImages.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setRecreateForm({ ...recreateForm, image: e.target.value });
                      }}
                      className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300"
                    >
                      <option value="">Choose image...</option>
                      {availableImages.map((img, i) => (
                        <option key={i} value={img}>{img}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Ports */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Port Mappings</label>
                  <button
                    type="button"
                    onClick={() =>
                      setRecreateForm({
                        ...recreateForm,
                        ports: [...(recreateForm.ports || []), { hostPort: 8080, containerPort: 80, protocol: 'tcp' }],
                      })
                    }
                    className="text-purple-400 hover:text-purple-300 text-[11px]"
                  >
                    + Add Port
                  </button>
                </div>
                <div className="space-y-2">
                  {(recreateForm.ports || []).map((port, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Host"
                        value={port.hostPort || ''}
                        onChange={(e) => {
                          const updated = [...(recreateForm.ports || [])];
                          updated[idx].hostPort = parseInt(e.target.value, 10) || undefined;
                          setRecreateForm({ ...recreateForm, ports: updated });
                        }}
                        className="w-1/3 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                      />
                      <span className="text-slate-500">→</span>
                      <input
                        type="number"
                        placeholder="Container"
                        value={port.containerPort || ''}
                        onChange={(e) => {
                          const updated = [...(recreateForm.ports || [])];
                          updated[idx].containerPort = parseInt(e.target.value, 10) || 0;
                          setRecreateForm({ ...recreateForm, ports: updated });
                        }}
                        className="w-1/3 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (recreateForm.ports || []).filter((_, i) => i !== idx);
                          setRecreateForm({ ...recreateForm, ports: updated });
                        }}
                        className="text-red-400 hover:text-red-300 px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Environment Variables Override</label>
                  <button
                    type="button"
                    onClick={() =>
                      setRecreateForm({
                        ...recreateForm,
                        envVars: [...(recreateForm.envVars || []), { key: '', value: '' }],
                      })
                    }
                    className="text-purple-400 hover:text-purple-300 text-[11px]"
                  >
                    + Add Env Var
                  </button>
                </div>
                <div className="space-y-2">
                  {(recreateForm.envVars || []).map((env, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="KEY"
                        value={env.key}
                        onChange={(e) => {
                          const updated = [...(recreateForm.envVars || [])];
                          updated[idx].key = e.target.value;
                          setRecreateForm({ ...recreateForm, envVars: updated });
                        }}
                        className="w-1/2 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                      />
                      <span className="text-slate-500">=</span>
                      <input
                        type="text"
                        placeholder="VALUE"
                        value={env.value}
                        onChange={(e) => {
                          const updated = [...(recreateForm.envVars || [])];
                          updated[idx].value = e.target.value;
                          setRecreateForm({ ...recreateForm, envVars: updated });
                        }}
                        className="w-1/2 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (recreateForm.envVars || []).filter((_, i) => i !== idx);
                          setRecreateForm({ ...recreateForm, envVars: updated });
                        }}
                        className="text-red-400 hover:text-red-300 px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRecreateModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recreateLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium shadow-lg shadow-purple-900/30 flex items-center space-x-2"
                >
                  {recreateLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Confirm & Recreate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <DockerConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        description={confirmModalState.description}
        actionLabel={confirmModalState.actionLabel}
        isDestructive={confirmModalState.isDestructive}
        isProtected={confirmModalState.isProtected}
        warningMessage={confirmModalState.warningMessage}
        affectedResources={confirmModalState.affectedResources}
        checkboxOption={
          confirmModalState.stopFirstOption
            ? {
                label: 'Stop container gracefully before removing',
                checked: stopFirstChecked,
                onChange: setStopFirstChecked,
              }
            : undefined
        }
        isLoading={actionLoading}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
