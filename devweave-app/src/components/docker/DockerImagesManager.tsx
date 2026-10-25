import React, { useState, useMemo } from 'react';
import {
  Layers,
  Tag,
  Trash2,
  Search,
  RefreshCw,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import {
  dockerService,
  type DockerImageSummary,
} from '../../services/dockerService';
import { DockerConfirmModal } from './DockerConfirmModal';
import { GlassCard } from '../ui/GlassCard';

interface DockerImagesManagerProps {
  images: DockerImageSummary[];
  runnerOnline: boolean;
  onRefresh: () => void;
  onNavigateToDockerizer: () => void;
}

export const DockerImagesManager: React.FC<DockerImagesManagerProps> = ({
  images,
  runnerOnline,
  onRefresh,
  onNavigateToDockerizer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'inUse' | 'dangling'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals & Action States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isDestructive?: boolean;
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

  // Retag Modal
  const [retagModalOpen, setRetagModalOpen] = useState(false);
  const [retagSource, setRetagSource] = useState<DockerImageSummary | null>(null);
  const [targetRepo, setTargetRepo] = useState('');
  const [targetTag, setTargetTag] = useState('');
  const [retagLoading, setRetagLoading] = useState(false);
  const [retagError, setRetagError] = useState<string | null>(null);

  // Filtered & Paginated Images
  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const matchesSearch =
        img.repository.toLowerCase().includes(searchTerm.toLowerCase()) ||
        img.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        img.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'inUse' && img.inUseByContainers.length > 0) ||
        (filterType === 'dangling' && img.isDangling);
      return matchesSearch && matchesFilter;
    });
  }, [images, searchTerm, filterType]);

  const totalPages = Math.ceil(filteredImages.length / itemsPerPage) || 1;
  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredImages.slice(start, start + itemsPerPage);
  }, [filteredImages, currentPage, itemsPerPage]);

  const openRetagModal = (image: DockerImageSummary) => {
    setRetagSource(image);
    setTargetRepo(image.repository !== '<none>' ? image.repository : 'devweave-custom');
    setTargetTag(image.tag !== '<none>' ? `${image.tag}-new` : 'v1.0.0');
    setRetagError(null);
    setRetagModalOpen(true);
  };

  const handleRetagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retagSource || !targetRepo.trim() || !targetTag.trim()) {
      setRetagError('Repository and tag names are required.');
      return;
    }
    setRetagLoading(true);
    setRetagError(null);
    try {
      const sourceRef = retagSource.repository !== '<none>' && retagSource.tag !== '<none>'
        ? `${retagSource.repository}:${retagSource.tag}`
        : retagSource.id;
      const targetRef = `${targetRepo.trim()}:${targetTag.trim()}`;
      await dockerService.tagImage(sourceRef, targetRef);
      setRetagModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setRetagError(err.message || 'Failed to retag image.');
    } finally {
      setRetagLoading(false);
    }
  };

  const promptDeleteImage = (image: DockerImageSummary) => {
    const hasContainers = image.inUseByContainers.length > 0;
    const ref = image.repository !== '<none>' && image.tag !== '<none>'
      ? `${image.repository}:${image.tag}`
      : image.id;

    setConfirmModal({
      isOpen: true,
      title: `Remove Image "${ref}"`,
      description: hasContainers
        ? `This image cannot be deleted because it is currently in use by ${image.inUseByContainers.length} container(s). To safely delete this image, you must first remove or recreate the dependent containers.`
        : `Are you sure you want to delete image ${ref}? This will free up ${image.size} on the host system.`,
      actionLabel: 'Remove Image',
      isDestructive: true,
      isProtected: image.isProtected || hasContainers,
      warningMessage: image.isProtected
        ? 'Protected system image cannot be deleted.'
        : hasContainers
        ? `Dependency block: Image is locked by active containers: ${image.inUseByContainers.join(', ')}.`
        : undefined,
      affectedResources: image.inUseByContainers.map((c) => `Dependent Container: ${c}`),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await dockerService.deleteImage(ref);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to delete image.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const promptPruneDangling = () => {
    const danglingCount = images.filter((img) => img.isDangling).length;
    setConfirmModal({
      isOpen: true,
      title: 'Prune Dangling Images',
      description: `Safe Cleanup: This will remove only untagged (<none>:<none>) dangling build layers. Tagged images and images in use by containers will NOT be touched. DevWeave strictly blocks global docker system prune.`,
      actionLabel: `Prune Dangling Images (${danglingCount})`,
      isDestructive: false,
      isProtected: false,
      warningMessage: 'Only untagged intermediate dangling layers will be pruned.',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await dockerService.pruneDanglingImages();
          alert(`Prune completed:\n${res.output || 'No dangling images found.'}`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err: any) {
          alert(err.message || 'Failed to prune dangling images.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search images by repository, tag, or ID..."
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
                setFilterType('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'all'
                  ? 'bg-blue-600/30 text-blue-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({images.length})
            </button>
            <button
              onClick={() => {
                setFilterType('inUse');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'inUse'
                  ? 'bg-emerald-600/30 text-emerald-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              In Use ({images.filter((i) => i.inUseByContainers.length > 0).length})
            </button>
            <button
              onClick={() => {
                setFilterType('dangling');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'dangling'
                  ? 'bg-amber-600/30 text-amber-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dangling ({images.filter((i) => i.isDangling).length})
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={promptPruneDangling}
            disabled={!runnerOnline}
            title="Safely remove untagged dangling build images"
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 rounded-xl border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Prune Dangling</span>
          </button>
          <button
            onClick={onRefresh}
            title="Refresh images"
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateToDockerizer}
            className="px-3.5 py-2 text-xs font-medium rounded-xl flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Build with Dockerizer</span>
          </button>
        </div>
      </div>

      {/* Images Table */}
      <GlassCard className="overflow-hidden p-0 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-medium uppercase tracking-wider">
                <th className="py-3 px-4">Repository</th>
                <th className="py-3 px-4">Tag</th>
                <th className="py-3 px-4">Image ID</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Associated Containers</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedImages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-sm text-slate-300">No images found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Build an image using the One-Click Dockerizer to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedImages.map((image, idx) => {
                  const hasContainers = image.inUseByContainers.length > 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-850/40 transition">
                      {/* Repository */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <span>{image.repository}</span>
                            {image.isProtected && (
                              <span
                                title="Protected Resource"
                                className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[10px] text-red-300 flex items-center gap-1 font-normal"
                              >
                                <ShieldAlert className="w-3 h-3 text-red-400" /> Protected
                              </span>
                            )}
                            {image.isDangling && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-[10px] text-amber-300 font-normal">
                                Dangling
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tag */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-blue-300">
                          {image.tag}
                        </span>
                      </td>

                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {image.id.substring(0, 12)}
                      </td>

                      {/* Size */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {image.size}
                      </td>

                      {/* Containers */}
                      <td className="py-3.5 px-4">
                        {hasContainers ? (
                          <div className="flex flex-wrap gap-1">
                            {image.inUseByContainers.map((cName, cIdx) => (
                              <span
                                key={cIdx}
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
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openRetagModal(image)}
                            disabled={!runnerOnline}
                            title="Retag this image"
                            className="p-1.5 rounded-lg border text-blue-400 hover:text-blue-300 bg-blue-950/20 hover:bg-blue-900/30 border-blue-500/20 transition disabled:opacity-50"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => promptDeleteImage(image)}
                            disabled={image.isProtected || !runnerOnline}
                            title={
                              image.isProtected
                                ? 'Protected image'
                                : hasContainers
                                ? 'Image is currently in use by containers'
                                : 'Delete image'
                            }
                            className={`p-1.5 rounded-lg border transition ${
                              image.isProtected || hasContainers
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/30 text-xs text-slate-400">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredImages.length)} of{' '}
              {filteredImages.length} images
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

      {/* Retag Image Modal */}
      {retagModalOpen && retagSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Retag Image</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Source: {retagSource.repository}:{retagSource.tag}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRetagModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {retagError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs">
                {retagError}
              </div>
            )}

            <form onSubmit={handleRetagSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Repository *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. my-app"
                  value={targetRepo}
                  onChange={(e) => setTargetRepo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Tag *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v2.0.0 or staging"
                  value={targetTag}
                  onChange={(e) => setTargetTag(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRetagModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={retagLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-900/30 flex items-center space-x-2"
                >
                  {retagLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Save Tag</span>
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
        isDestructive={confirmModal.isDestructive}
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
