import React, { useMemo } from 'react';
import {
  FileCode,
  AlertTriangle,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileCheck,
  Edit3,
} from 'lucide-react';
import type { GithubFile } from '../../types/repository';

export interface CodeEditorProps {
  repoFullName?: string;
  branch: string;
  file: GithubFile | null;
  content: string;
  isModified: boolean;
  isLoading: boolean;
  error: string | null;
  onChangeContent: (newContent: string) => void;
  onRetry?: () => void;
}

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'pdf',
  'zip',
  'rar',
  'tar',
  'gz',
  '7z',
  'mp4',
  'mp3',
  'wav',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'iso',
  'woff',
  'woff2',
  'ttf',
  'eot',
]);

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

export const CodeEditor: React.FC<CodeEditorProps> = ({
  repoFullName,
  branch,
  file,
  content,
  isModified,
  isLoading,
  error,
  onChangeContent,
  onRetry,
}) => {
  const extension = useMemo(() => {
    if (!file?.name) return '';
    return file.name.split('.').pop()?.toLowerCase() || '';
  }, [file?.name]);

  const isBinary = useMemo(() => {
    return BINARY_EXTENSIONS.has(extension);
  }, [extension]);

  const isTooLarge = useMemo(() => {
    if (!file?.size) return false;
    return file.size > MAX_FILE_SIZE_BYTES;
  }, [file?.size]);

  // Compute line count for line numbers sidebar
  const linesCount = useMemo(() => {
    if (!content) return 1;
    return content.split('\n').length;
  }, [content]);

  const githubFileUrl = useMemo(() => {
    if (!repoFullName || !file?.path) return '#';
    return `https://github.com/${repoFullName}/blob/${encodeURIComponent(branch)}/${file.path}`;
  }, [repoFullName, branch, file?.path]);

  // No file selected state
  if (!file && !isLoading && !error) {
    return (
      <div className="flex flex-col h-full bg-slate-950/60 border border-white/[0.08] rounded-xl overflow-hidden shadow-xl items-center justify-center p-12 text-center text-white/40">
        <FileCode className="h-12 w-12 text-white/20 mb-3" />
        <h3 className="text-sm font-semibold text-white/60 mb-1">No File Selected</h3>
        <p className="text-xs text-white/40 max-w-sm">
          Select a file from the explorer on the left to view and edit its code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/70 border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
      {/* Editor Header Bar */}
      <div className="px-3 sm:px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.08] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-xs font-mono font-semibold text-white truncate">
            {file?.path || 'Untitled'}
          </span>
          {isModified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
              <Edit3 className="h-3 w-3" />
              Modified *
            </span>
          )}
          {!isModified && file && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
              <FileCheck className="h-3 w-3" />
              Synced
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {extension && (
            <span className="text-[10px] font-mono text-white/50 bg-white/[0.05] px-2 py-0.5 rounded border border-white/10 uppercase">
              {extension}
            </span>
          )}
          {file?.size !== undefined && (
            <span className="text-[10px] font-mono text-white/40">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
          {repoFullName && file && (
            <a
              href={githubFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
              title="Open raw file on GitHub"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative overflow-hidden flex flex-col min-h-[400px]">
        {isLoading ? (
          <div className="absolute inset-0 bg-slate-950/80 z-10 flex flex-col items-center justify-center text-white/50 text-xs">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
            <span>Fetching file content from GitHub...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 bg-slate-950/90 z-10 flex flex-col items-center justify-center p-8 text-center text-xs space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <h4 className="text-sm font-semibold text-white">Unable to Load File</h4>
            <p className="text-rose-300 max-w-md">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Loading</span>
              </button>
            )}
          </div>
        ) : isBinary ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs space-y-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Binary File Detected</h4>
              <p className="text-white/60 max-w-sm">
                This file cannot be edited in the DevWeave text editor.
              </p>
            </div>
            {repoFullName && (
              <a
                href={githubFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                <span>Open on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : isTooLarge ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs space-y-4">
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Large File Warning</h4>
              <p className="text-white/60 max-w-sm">
                This file is too large to edit in DevWeave ({((file?.size || 0) / (1024 * 1024)).toFixed(2)} MB).
              </p>
            </div>
            {repoFullName && (
              <a
                href={githubFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                <span>Open on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden font-mono text-xs leading-6">
            {/* Line Numbers Column */}
            <div
              className="py-4 px-3 bg-white/[0.01] border-r border-white/[0.06] text-white/20 select-none text-right font-mono"
              style={{ minWidth: '3.5rem' }}
            >
              {Array.from({ length: linesCount }).map((_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            {/* Code Input Textarea */}
            <textarea
              value={content}
              onChange={(e) => onChangeContent(e.target.value)}
              spellCheck={false}
              className="flex-1 p-4 bg-transparent text-white/90 outline-none resize-none overflow-auto font-mono text-xs leading-6 whitespace-pre tab-4 focus:ring-0 focus:outline-none"
              placeholder="Type or edit code here..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
