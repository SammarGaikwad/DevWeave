import React, { useState, useMemo } from 'react';
import {
  Network,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  ShieldAlert,
  Link,
  Unlink,
  X,
} from 'lucide-react';
import {
  dockerService,
  type DockerNetworkSummary,
  type DockerContainerSummary,
} from '../../services/dockerService';
import { DockerConfirmModal } from './DockerConfirmModal';
import { GlassCard } from '../ui/GlassCard';

interface DockerNetworksManagerProps {
  networks: DockerNetworkSummary[];
  containers: DockerContainerSummary[];
  runnerOnline: boolean;
  onRefresh: () => void;
}

export const DockerNetworksManager: React.FC<DockerNetworksManagerProps> = ({
  networks,
  containers,
  runnerOnline,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDriver, setCreateDriver] = useState<'bridge' | 'overlay' | 'macvlan'>('bridge');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Connect/Disconnect Modal
  const [connectModal, setConnectModal] = useState<{
    isOpen: boolean;
    network: DockerNetworkSummary | null;
    action: 'connect' | 'disconnect';
    selectedContainerId: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    network: null,
    action: 'connect',
    selectedContainerId: '',
    loading: false,
    error: null,
  });

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isProtected?: boolean;
    warningMessage?: string;
    affectedResources?: string[];
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    onConfirm: async () => {},
  });
  const [actionLoading, setActionLoading] = useState(false);

  const filteredNetworks = useMemo(() => {
    return networks.filter((net) =>
      net.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      net.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      net.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [networks, searchTerm]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError('Network name is required.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      await dockerService.createNetwork({
        name: createName.trim(),
        driver: createDriver,
      });
      setCreateModalOpen(false);
      setCreateName('');
      onRefresh();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create network.');
    } finally {
      setCreateLoading(false);
    }
  };

  const promptDeleteNetwork = (net: DockerNetworkSummary) => {
    const hasContainers = net.containers.length > 0;
    setConfirmModal({
      isOpen: true,
      title: `Delete Network "${net.name}"`,
      description: hasContainers
        ? `This network cannot be deleted because it currently has ${net.containers.length} connected container(s). You must disconnect them first.`
        : `Are you sure you want to delete network ${net.name}?`,
      actionLabel: 'Delete Network',
      isProtected: net.isProtected || hasContainers,
      warningMessage: net.isProtected
        ? 'System and built-in networks (bridge, host, none) are protected from deletion.'
        : hasContainers
        ? `Dependency block: Network has connected containers: ${net.containers.join(', ')}.`
        : undefined,
      affectedResources: net.containers.map((c) => `Connected Container: ${c}`),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await dockerService.deleteNetwork(net.name);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to delete network.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const openConnectModal = (net: DockerNetworkSummary, action: 'connect' | 'disconnect') => {
    const available = action === 'connect'
      ? containers.filter((c) => !net.containers.includes(c.name))
      : containers.filter((c) => net.containers.includes(c.name));

    setConnectModal({
      isOpen: true,
      network: net,
      action,
      selectedContainerId: available[0]?.id || '',
      loading: false,
      error: null,
    });
  };

  const handleConnectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectModal.network || !connectModal.selectedContainerId) return;
    setConnectModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (connectModal.action === 'connect') {
        await dockerService.connectNetwork(connectModal.network.name, connectModal.selectedContainerId);
      } else {
        await dockerService.disconnectNetwork(connectModal.network.name, connectModal.selectedContainerId);
      }
      setConnectModal((prev) => ({ ...prev, isOpen: false, loading: false }));
      onRefresh();
    } catch (err: any) {
      setConnectModal((prev) => ({ ...prev, error: err.message || 'Network operation failed.', loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search networks by name or driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-700/60 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            title="Refresh networks"
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCreateName('');
              setCreateDriver('bridge');
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            disabled={!runnerOnline}
            className="px-3.5 py-2 text-xs font-medium rounded-xl flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Create Network</span>
          </button>
        </div>
      </div>

      {/* Networks Table */}
      <GlassCard className="overflow-hidden p-0 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-medium uppercase tracking-wider">
                <th className="py-3 px-4">Network Name</th>
                <th className="py-3 px-4">Network ID</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Connected Containers</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredNetworks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-sm text-slate-300">No networks found</p>
                  </td>
                </tr>
              ) : (
                filteredNetworks.map((net) => {
                  const hasContainers = net.containers.length > 0;
                  return (
                    <tr key={net.id || net.name} className="hover:bg-slate-850/40 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <Network className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <span>{net.name}</span>
                            {net.isProtected && (
                              <span
                                title="System Protected Network"
                                className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[10px] text-red-300 flex items-center gap-1 font-normal"
                              >
                                <ShieldAlert className="w-3 h-3 text-red-400" /> Protected
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {net.id.substring(0, 12)}
                      </td>

                      {/* Driver */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
                          {net.driver}
                        </span>
                      </td>

                      {/* Scope */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {net.scope}
                      </td>

                      {/* Containers */}
                      <td className="py-3.5 px-4">
                        {hasContainers ? (
                          <div className="flex flex-wrap gap-1">
                            {net.containers.map((cName, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono"
                              >
                                {cName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">No containers</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openConnectModal(net, 'connect')}
                            disabled={!runnerOnline}
                            title="Connect a container to this network"
                            className="p-1.5 rounded-lg border text-blue-400 hover:text-blue-300 bg-blue-950/20 hover:bg-blue-900/30 border-blue-500/20 transition disabled:opacity-50"
                          >
                            <Link className="w-3.5 h-3.5" />
                          </button>
                          {hasContainers && (
                            <button
                              onClick={() => openConnectModal(net, 'disconnect')}
                              disabled={net.isProtected || !runnerOnline}
                              title="Disconnect a container from this network"
                              className="p-1.5 rounded-lg border text-amber-400 hover:text-amber-300 bg-amber-950/20 hover:bg-amber-900/30 border-amber-500/20 transition disabled:opacity-50"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => promptDeleteNetwork(net)}
                            disabled={net.isProtected || !runnerOnline}
                            title={net.isProtected ? 'Protected network cannot be deleted' : 'Delete network'}
                            className={`p-1.5 rounded-lg border transition ${
                              net.isProtected
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
      </GlassCard>

      {/* Create Network Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Network className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Create Docker Network</h3>
                  <p className="text-xs text-slate-400">Configure isolated container networking</p>
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
                <label className="block text-slate-300 font-medium mb-1">Network Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. devweave-internal-net"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Driver</label>
                <select
                  value={createDriver}
                  onChange={(e) => setCreateDriver(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                >
                  <option value="bridge">bridge (Standard local bridge network)</option>
                  <option value="overlay">overlay (Multi-host overlay)</option>
                  <option value="macvlan">macvlan (Direct MAC interface)</option>
                </select>
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium shadow-lg shadow-purple-900/30 flex items-center space-x-2"
                >
                  {createLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Create Network</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect/Disconnect Modal */}
      {connectModal.isOpen && connectModal.network && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                {connectModal.action === 'connect' ? (
                  <Link className="w-5 h-5 text-blue-400" />
                ) : (
                  <Unlink className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {connectModal.action === 'connect' ? 'Connect Container' : 'Disconnect Container'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Network: {connectModal.network.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConnectModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {connectModal.error && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs">
                {connectModal.error}
              </div>
            )}

            <form onSubmit={handleConnectionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Container</label>
                <select
                  value={connectModal.selectedContainerId}
                  onChange={(e) =>
                    setConnectModal((prev) => ({ ...prev, selectedContainerId: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                >
                  {(connectModal.action === 'connect'
                    ? containers.filter((c) => !connectModal.network?.containers.includes(c.name))
                    : containers.filter((c) => connectModal.network?.containers.includes(c.name))
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id.substring(0, 12)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setConnectModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-slate-300 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectModal.loading || !connectModal.selectedContainerId}
                  className={`px-4 py-2 text-white rounded-xl font-medium shadow-lg flex items-center space-x-2 ${
                    connectModal.action === 'connect'
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                  }`}
                >
                  {connectModal.loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{connectModal.action === 'connect' ? 'Connect' : 'Disconnect'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <DockerConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        actionLabel={confirmModal.actionLabel}
        isDestructive={true}
        isProtected={confirmModal.isProtected}
        warningMessage={confirmModal.warningMessage}
        affectedResources={confirmModal.affectedResources}
        isLoading={actionLoading}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
