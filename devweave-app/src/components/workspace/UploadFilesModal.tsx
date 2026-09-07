import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Loader2, AlertCircle, FileText, Trash2, CheckCircle2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

export interface UploadFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  branch: string;
  onSubmit: (formData: FormData, commitMessage: string) => Promise<void>;
}

interface StagedFile {
  id: string;
  file: File;
  targetPath: string;
  size: number;
}

const FORBIDDEN_FILE_REGEX = /(^\.?env($|\.)|^\.git($|\/)|node_modules|\.DS_Store$|\.(key|pem|crt)$)/i;

export const UploadFilesModal: React.FC<UploadFilesModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  branch,
  onSubmit,
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStagedFiles([]);
      setCommitMessage('');
      setError(null);
      setSkippedCount(0);
      setStatusText(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sanitizePath = (base: string, name: string): string => {
    const prefix = base ? `${base.replace(/\/$/, '')}/` : '';
    return `${prefix}${name}`;
  };

  const handleFileSelection = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setError(null);

    const newStaged: StagedFile[] = [];
    let skipped = 0;

    Array.from(selectedFiles).forEach((file) => {
      // Security check for forbidden file names
      if (FORBIDDEN_FILE_REGEX.test(file.name)) {
        skipped++;
        return;
      }

      // 5MB per file check
      if (file.size > 5 * 1024 * 1024) {
        skipped++;
        return;
      }

      const targetPath = sanitizePath(currentPath, file.name);
      newStaged.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        targetPath,
        size: file.size,
      });
    });

    if (skipped > 0) {
      setSkippedCount((prev) => prev + skipped);
    }

    setStagedFiles((prev) => {
      const combined = [...prev, ...newStaged];
      // Max 100 files check
      if (combined.length > 100) {
        setError('Cannot upload more than 100 files at once. Excess files were truncated.');
        return combined.slice(0, 100);
      }
      return combined;
    });

    // Auto-update commit message if empty
    if (!commitMessage || commitMessage.startsWith('Upload ')) {
      const total = stagedFiles.length + newStaged.length;
      setCommitMessage(`Upload ${total} file${total === 1 ? '' : 's'}`);
    }
  };

  const handleRemoveFile = (id: string) => {
    setStagedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      if (updated.length > 0 && commitMessage.startsWith('Upload ')) {
        setCommitMessage(`Upload ${updated.length} file${updated.length === 1 ? '' : 's'}`);
      }
      return updated;
    });
  };

  const handlePathChange = (id: string, newPath: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, targetPath: newPath } : f))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    const msg = commitMessage.trim() || `Upload ${stagedFiles.length} files`;
    setIsSubmitting(true);
    setError(null);
    setStatusText('Preparing files...');

    try {
      const formData = new FormData();
      formData.append('branch', branch);
      formData.append('commitMessage', msg);

      stagedFiles.forEach((sf) => {
        formData.append('files', sf.file, sf.file.name);
        formData.append('paths', sf.targetPath.trim());
      });

      setStatusText('Uploading files...');
      await onSubmit(formData, msg);
      setStatusText('Refreshing repository...');
      onClose();
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string }).message || 'Failed to upload files';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
      setStatusText(null);
    }
  };

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="max-w-2xl w-full p-6 space-y-5 border-blue-500/30 relative max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Upload Files</h3>
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
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2.5 text-xs shrink-0">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {skippedCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2.5 text-xs shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              {skippedCount} file(s) were skipped (either exceeding 5MB or matching sensitive patterns like .env / .git).
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Dropzone area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/15 hover:border-blue-500/50 bg-white/[0.02] hover:bg-blue-500/[0.03] rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileSelection(e.target.files)}
              multiple
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold text-white">
              Click to select files or drag & drop here
            </p>
            <p className="text-[11px] text-white/40">
              Max 100 files • Up to 5MB per file • Single Git Commit
            </p>
          </div>

          {/* Staged file list preview */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Selected Files ({stagedFiles.length})</span>
                <span>Total: {formatSize(totalSize)}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {stagedFiles.map((sf) => (
                  <div
                    key={sf.id}
                    className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <input
                        type="text"
                        value={sf.targetPath}
                        onChange={(e) => handlePathChange(sf.id, e.target.value)}
                        className="bg-transparent font-mono text-xs text-white border-b border-white/10 focus:border-blue-400 outline-none w-full py-0.5"
                        placeholder="Path..."
                      />
                    </div>
                    <span className="text-[11px] font-mono text-white/40 shrink-0">
                      {formatSize(sf.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(sf.id)}
                      className="text-white/30 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commit Message input */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-white/70">
              Commit Message <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Upload files via DevWeave..."
              disabled={isSubmitting}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] shrink-0">
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
              disabled={isSubmitting || stagedFiles.length === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{statusText || `Committing (${stagedFiles.length} files)...`}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Upload & Commit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};
