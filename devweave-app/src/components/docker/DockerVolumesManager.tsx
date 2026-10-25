import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  ShieldAlert,
  X,
  Database,
} from 'lucide-react';
import {
  dockerService,
  type DockerVolumeSummary,
} from '../../services/dockerService';
import { DockerConfirmModal } from './DockerConfirmModal';
import { GlassCard } from '../ui/GlassCard';

interface DockerVolumesManagerProps {
  volumes: DockerVolumeSummary[];
  runnerOnline: boolean;
  onRefresh: () => void;
}

export const DockerVolumesManager: React.FC<DockerVolumesManagerProps> = ({
  volumes,
  runnerOnline,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDriver, setCreateDriver] = useState('local');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const filteredVolumes = useMemo(() => {
    return volumes.filter((vol) =>
      vol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vol.driver.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [volumes, searchTerm]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError('Volume name is required.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      await dockerService.createVolume({
        name: createName.trim(),
        driver: createDriver,
      });
      setCreateModalOpen(false);
      setCreateName('');
      onRefresh();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create volume.');
    } finally {
      setCreateLoading(false);
    }
  };

  const promptDeleteVolume = (vol: DockerVolumeSummary) => {
    const hasContainers = vol.inUseByContainers.length > 0;
    setConfirmModal({
      isOpen: true,
      title: `Delete Persistent Volume "${vol.name}"`,
      description: `WARNING: Deleting volume "${vol.name}" will permanently erase all data, state, databases, or application files stored within it. This action CANNOT be undone.`,
      actionLabel: 'Permanently Delete Volume',
      isProtected: vol.isProtected || hasContainers,
      warningMessage: vol.isProtected
        ? 'Protected system volume (e.g. jenkins_home) cannot be deleted.'
        : hasContainers
        ? `Dependency block: Volume is currently mounted by container(s): ${vol.inUseByContainers.join(', ')}. Disconnect or remove these containers first.`
        : 'All data stored on this volume will be permanently and unrecoverably lost.',
      affectedResources: vol.inUseByContainers.map((c) => `Mounted by container: ${c}`),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await dockerService.deleteVolume(vol.name);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to delete volume.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search volumes by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-700/60 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            title="Refresh volumes"
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCreateName('');
              setCreateDriver('local');
              setCreateError(null);
              setCreateModalOpen(true);
            }}
            disabled={!runnerOnline}
            className="px-3.5 py-2 text-xs font-medium rounded-xl flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Create Volume</span>
          </button>
        </div>
      </div>

      {/* Volumes Table */}
      <GlassCard className="overflow-hidden p-0 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-medium uppercase tracking-wider">
                <th className="py-3 px-4">Volume Name</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Mountpoint</th>
                <th className="py-3 px-4">Mounted by Containers</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredVolumes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-sm text-slate-300">No volumes found</p>
                  </td>
                </tr>
              ) : (
                filteredVolumes.map((vol) => {
                  const hasContainers = vol.inUseByContainers.length > 0;
                  return (
                    <tr key={vol.name} className="hover:bg-slate-850/40 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <span>{vol.name}</span>
                            {vol.isProtected && (
                              <span
                                title="System Protected Volume"
                                className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[10px] text-red-300 flex items-center gap-1 font-normal"
                              >
                                <ShieldAlert className="w-3 h-3 text-red-400" /> Protected
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                          {vol.driver}
                        </span>
                      </td>

                      {/* Mountpoint */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {vol.mountpoint || 'Default Local Storage'}
                      </td>

                      {/* Containers */}
                      <td className="py-3.5 px-4">
                        {hasContainers ? (
                          <div className="flex flex-wrap gap-1">
                            {vol.inUseByContainers.map((cName, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono"
                              >
                                {cName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Unused</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => promptDeleteVolume(vol)}
                          disabled={vol.isProtected || !runnerOnline}
                          title={
                            vol.isProtected
                              ? 'Protected volume cannot be deleted'
                              : hasContainers
                              ? 'Volume is currently mounted by containers'
                              : 'Delete volume'
                          }
                          className={`p-1.5 rounded-lg border transition ${
                            vol.isProtected || hasContainers
                              ? 'text-slate-600 border-transparent cursor-not-allowed'
                              : 'text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 border-red-500/20'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Create Volume Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Create Persistent Volume</h3>
                  <p className="text-xs text-slate-400">Allocate persistent storage for containers</p>
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
                <label className="block text-slate-300 font-medium mb-1">Volume Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. postgres_data or app_uploads"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Driver</label>
                <input
                  type="text"
                  value={createDriver}
                  onChange={(e) => setCreateDriver(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                />
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-900/30 flex items-center space-x-2"
                >
                  {createLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Create Volume</span>
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
