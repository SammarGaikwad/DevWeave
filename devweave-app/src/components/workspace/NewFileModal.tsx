import React, { useState, useEffect } from 'react';
import { X, FilePlus, Loader2, AlertCircle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

export interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  branch: string;
  onSubmit: (filePath: string, content: string, commitMessage: string) => Promise<void>;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  branch,
  onSubmit,
}) => {
  const [filePath, setFilePath] = useState('');
  const [content, setContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialPath = currentPath ? `${currentPath.replace(/\/$/, '')}/` : '';
      setFilePath(initialPath);
      setContent('');
      setCommitMessage('');
      setError(null);
    }
  }, [isOpen, currentPath]);

  // Update default commit message when filePath changes
  const handleFilePathChange = (val: string) => {
    setFilePath(val);
    const fileName = val.split('/').pop() || val;
    if (fileName && (!commitMessage || commitMessage.startsWith('Create '))) {
      setCommitMessage(`Create ${fileName}`);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPath = filePath.trim();
    const trimmedMsg = commitMessage.trim() || `Create ${trimmedPath.split('/').pop() || trimmedPath}`;

    if (!trimmedPath) {
      setError('File path is required');
      return;
    }

    if (trimmedPath.endsWith('/')) {
      setError('File path must include a file name, not end with a slash');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmedPath, content, trimmedMsg);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Failed to create file';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="max-w-lg w-full p-6 space-y-5 border-blue-500/30 relative">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FilePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New File</h3>
              <p className="text-xs text-white/50">
                Target branch: <span className="font-mono text-blue-400 font-semibold">{branch}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2.5 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70">
              File Path <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => handleFilePathChange(e.target.value)}
              placeholder="e.g. src/components/Header.tsx"
              disabled={isSubmitting}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
            />
            <p className="text-[11px] text-white/40">
              Relative to repository root. Subdirectories will be created automatically.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70">File Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="// Write initial code or text content here..."
              rows={6}
              disabled={isSubmitting}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs font-mono text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-all resize-y disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70">
              Commit Message <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Create new file..."
              disabled={isSubmitting}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !filePath.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Committing...</span>
                </>
              ) : (
                <>
                  <FilePlus className="h-3.5 w-3.5" />
                  <span>Commit File</span>
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};
