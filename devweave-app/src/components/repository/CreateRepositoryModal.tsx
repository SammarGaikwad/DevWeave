import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Lock, Globe, FileText, Loader2, AlertCircle } from 'lucide-react';
import { githubService } from '../../services/githubService';
import type { CreatedRepositoryData } from '../../types/repository';

export interface CreateRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdRepo: CreatedRepositoryData) => void;
}

export const CreateRepositoryModal: React.FC<CreateRepositoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [initializeReadme, setInitializeReadme] = useState(true);

  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIsPrivate(false);
      setInitializeReadme(true);
      setNameError(null);
      setServerError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateName = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError('Repository name is required.');
      return false;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      setNameError(
        'Repository name can only contain letters, numbers, hyphens, periods, and underscores.'
      );
      return false;
    }
    if (trimmed.length > 100) {
      setNameError('Repository name must be 100 characters or less.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateName(name)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const createdRepo = await githubService.createRepository({
        name: name.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
        initializeReadme,
      });

      onSuccess(createdRepo);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { message?: string }).message ||
        'Failed to create repository on GitHub. Please try again.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-lg glass-panel bg-[#0a0a0a]/95 rounded-2xl border border-white/15 shadow-2xl p-6 z-10 overflow-hidden space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <FolderPlus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Create New Repository</h2>
            <p className="text-xs text-white/60">
              Create a new GitHub repository directly from DevWeave.
            </p>
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-0.5">
              <p className="font-semibold text-white">Creation Failed</p>
              <p className="text-rose-200/90 leading-relaxed">{serverError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repository Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-white/80">
              Repository Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) validateName(e.target.value);
              }}
              onBlur={() => validateName(name)}
              placeholder="e.g. my-awesome-app"
              disabled={isSubmitting}
              className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/40 outline-none transition-all ${
                nameError
                  ? 'border-rose-500/60 ring-1 ring-rose-500/30'
                  : 'border-white/10 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30'
              }`}
            />
            {nameError && (
              <p className="text-[11px] font-medium text-rose-400">{nameError}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-white/80">
              Description <span className="text-white/40 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of your repository..."
              disabled={isSubmitting}
              className="w-full bg-slate-900 border border-white/10 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/40 outline-none transition-all resize-none"
            />
          </div>

          {/* Visibility Options */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/80">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                disabled={isSubmitting}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  !isPrivate
                    ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500/30'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                }`}
              >
                <Globe className={`h-4 w-4 mt-0.5 shrink-0 ${!isPrivate ? 'text-blue-400' : 'text-white/40'}`} />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-white">Public</p>
                  <p className="text-[10px] text-white/50 leading-tight">
                    Anyone on the internet can see this repository.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                disabled={isSubmitting}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  isPrivate
                    ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500/30'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                }`}
              >
                <Lock className={`h-4 w-4 mt-0.5 shrink-0 ${isPrivate ? 'text-blue-400' : 'text-white/40'}`} />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-white">Private</p>
                  <p className="text-[10px] text-white/50 leading-tight">
                    You choose who can see and commit.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Initialize README Option */}
          <div className="pt-1">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={initializeReadme}
                onChange={(e) => setInitializeReadme(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded bg-slate-900 border-white/20 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-white">
                  Initialize this repository with a README
                </span>
              </div>
            </label>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-white/[0.04] disabled:text-white/30 text-white font-semibold text-xs shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:shadow-none transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  <span>Create Repository</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
