import React from 'react';
import {
  Folder,
  FileText,
  FileCode,
  FileJson,
  Image as ImageIcon,
  File,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import type { GithubContentItem } from '../../types/repository';

export interface FileExplorerProps {
  repoName: string;
  ownerName?: string;
  currentPath: string;
  items: GithubContentItem[];
  selectedFilePath: string | null;
  isLoading: boolean;
  error: string | null;
  onNavigatePath: (path: string) => void;
  onSelectFile: (item: GithubContentItem) => void;
  onRetry?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  repoName,
  ownerName,
  currentPath,
  items,
  selectedFilePath,
  isLoading,
  error,
  onNavigatePath,
  onSelectFile,
  onRetry,
}) => {
  // Breadcrumb path construction
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'sql', 'html', 'css', 'scss'].includes(ext)) {
      return <FileCode className="h-4 w-4 text-blue-400 shrink-0" />;
    }
    if (ext === 'json') {
      return <FileJson className="h-4 w-4 text-amber-400 shrink-0" />;
    }
    if (['md', 'txt', 'rst', 'doc', 'docx'].includes(ext)) {
      return <FileText className="h-4 w-4 text-emerald-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'].includes(ext)) {
      return <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />;
    }
    return <File className="h-4 w-4 text-zinc-400 shrink-0" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/60 border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
      {/* Header & Breadcrumb Navigation */}
      <div className="p-3 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-white/70 whitespace-nowrap">
          <button
            onClick={() => onNavigatePath('')}
            className="hover:text-blue-400 hover:underline transition-colors flex items-center gap-1 text-white font-semibold"
          >
            <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
            <span>{ownerName ? `${ownerName}/${repoName}` : repoName}</span>
          </button>

          {pathSegments.map((segment, index) => {
            const accumulatedPath = pathSegments.slice(0, index + 1).join('/');
            const isLast = index === pathSegments.length - 1;

            return (
              <React.Fragment key={accumulatedPath}>
                <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
                {isLast ? (
                  <span className="text-white font-semibold">{segment}</span>
                ) : (
                  <button
                    onClick={() => onNavigatePath(accumulatedPath)}
                    className="hover:text-blue-400 hover:underline transition-colors"
                  >
                    {segment}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            title="Refresh folder contents"
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Directory Contents Body */}
      <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-white/50 text-xs">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
            <span>Loading folder contents...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs space-y-3">
            <AlertCircle className="h-7 w-7 text-rose-400" />
            <p className="text-rose-300 font-medium">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-white/40 text-xs italic">
            This directory is empty.
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* If inside subfolder, allow going up one directory */}
            {currentPath && (
              <button
                onClick={() => {
                  const parentPath = pathSegments.slice(0, -1).join('/');
                  onNavigatePath(parentPath);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors text-left"
              >
                <Folder className="h-4 w-4 text-amber-400/70 shrink-0" />
                <span>..</span>
              </button>
            )}

            {items.map((item) => {
              const isSelected = selectedFilePath === item.path;
              const isDir = item.type === 'directory';

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    if (isDir) {
                      onNavigatePath(item.path);
                    } else {
                      onSelectFile(item);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left group ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/[0.05] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {isDir ? (
                      <Folder className="h-4 w-4 text-amber-400 group-hover:text-amber-300 shrink-0" />
                    ) : (
                      getFileIcon(item.name)
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>

                  {!isDir && item.size !== undefined && (
                    <span className="text-[10px] text-white/40 font-mono shrink-0">
                      {formatFileSize(item.size)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
