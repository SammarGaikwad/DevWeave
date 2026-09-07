import React, { useState, useEffect, useRef } from 'react';
import { X, FolderUp, Loader2, AlertCircle, Folder, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

export interface UploadFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  branch: string;
  onSubmit: (formData: FormData, commitMessage: string) => Promise<void>;
}

interface StagedFolderFile {
  id: string;
  file: File;
  targetPath: string;
  size: number;
}

const SENSITIVE_SEGMENT_REGEX = /(^|\/|\ state)(\.env.*|\.git|node_modules|\.DS_Store|dist|build)$/i;
const SENSITIVE_EXT_REGEX = /\.(key|pem|crt)$/i;

export const UploadFolderModal: React.FC<UploadFolderModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  branch,
  onSubmit,
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFolderFile[]>([]);
  const [folderName, setFolderName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skippedInfo, setSkippedInfo] = useState<{ count: number; reason: string } | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStagedFiles([]);
      setFolderName('');
      setCommitMessage('');
      setError(null);
      setSkippedInfo(null);
      setStatusText(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isIgnoredFile = (relPath: string, fileName: string): boolean => {
    const parts = relPath.split('/');
    if (parts.some((p) => p === '.git' || p === 'node_modules' || p === 'dist' || p === 'build')) {
      return true;
    }
    if (SENSITIVE_SEGMENT_REGEX.test(fileName) || SENSITIVE_EXT_REGEX.test(fileName)) {
      return true;
    }
    return false;
  };

  const handleFolderSelection = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setError(null);

    const newStaged: StagedFolderFile[] = [];
    let skipped = 0;
    let detectedFolderName = '';

    Array.from(selectedFiles).forEach((file) => {
      const relPath = file.webkitRelativePath || file.name;
      if (!detectedFolderName && relPath.includes('/')) {
        detectedFolderName = relPath.split('/')[0];
      }

      const fileName = file.name;

      if (isIgnoredFile(relPath, fileName)) {
        skipped++;
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        skipped++;
        return;
      }

      const targetPath = currentPath
        ? `${currentPath.replace(/\/$/, '')}/${relPath}`
        : relPath;

      newStaged.push({
        id: `${relPath}-${Date.now()}-${Math.random()}`,
        file,
        targetPath,
        size: file.size,
      });
    });

    if (skipped > 0) {
      setSkippedInfo({
        count: skipped,
        reason: 'node_modules, .env, .git, or files > 5MB were automatically excluded for security and performance.',
      });
    }

    if (detectedFolderName) {
      setFolderName(detectedFolderName);
      setCommitMessage(`Upload folder ${detectedFolderName}`);
    } else {
      setCommitMessage(`Upload folder (${newStaged.length} files)`);
    }

    if (newStaged.length > 100) {
      setError('Folder contains more than 100 files. Only the first 100 files were staged.');
      setStagedFiles(newStaged.slice(0, 100));
    } else {
      setStagedFiles(newStaged);
    }
  };

  const handleRemoveFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      setError('Please select a folder containing files to upload');
      return;
    }

    const msg = commitMessage.trim() || `Upload folder ${folderName || 'contents'}`;
    setIsSubmitting(true);
    setError(null);
    setStatusText('Preparing folder files...');

    try {
      const formData = new FormData();
      formData.append('branch', branch);
      formData.append('commitMessage', msg);

      stagedFiles.forEach((sf) => {
        formData.append('files', sf.file, sf.file.name);
        formData.append('paths', sf.targetPath.trim());
      });

      setStatusText('Uploading folder files...');
      await onSubmit(formData, msg);
      setStatusText('Refreshing repository...');
      onClose();
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string }).message || 'Failed to upload folder';
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
              <FolderUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Upload Folder</h3>
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

        {skippedInfo && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2.5 text-xs shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              {skippedInfo.count} item(s) skipped: {skippedInfo.reason}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Folder Select Dropzone */}
          <div
            onClick={() => folderInputRef.current?.click()}
            className="border-2 border-dashed border-white/15 hover:border-blue-500/50 bg-white/[0.02] hover:bg-blue-500/[0.03] rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
          >
            <input
              type="file"
              ref={folderInputRef}
              onChange={(e) => handleFolderSelection(e.target.files)}
              // @ts-expect-error webkitdirectory is standard for folder picker
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <Folder className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold text-white">
              {folderName ? `Selected Folder: ${folderName}` : 'Click to select a folder from your computer'}
            </p>
            <p className="text-[11px] text-white/40">
              Preserves relative directory hierarchy • Single Git Commit
            </p>
          </div>

          {/* Staged folder contents list */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Staged Files ({stagedFiles.length})</span>
                <span>Total: {formatSize(totalSize)}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {stagedFiles.map((sf) => (
                  <div
                    key={sf.id}
                    className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="font-mono text-xs text-white truncate">
                        {sf.targetPath}
                      </span>
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

          {/* Commit Message Input */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-white/70">
              Commit Message <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Upload folder contents..."
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
                  <span>{statusText || `Committing Folder (${stagedFiles.length} files)...`}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Upload & Commit Folder</span>
                </>
              )}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};
