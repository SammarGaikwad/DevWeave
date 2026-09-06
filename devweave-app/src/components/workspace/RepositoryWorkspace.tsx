import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitCommit,
  Lock,
} from 'lucide-react';
import { githubService } from '../../services/githubService';
import type {
  Repository,
  BranchInfo,
  GithubContentItem,
  GithubFile,
} from '../../types/repository';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { GlassCard } from '../ui/GlassCard';

export interface RepositoryWorkspaceProps {
  repository: Repository;
  branches: BranchInfo[];
  isGithubConnected?: boolean;
  onConnectGithub?: () => void;
  onCommitSuccess?: () => void;
}

export const RepositoryWorkspace: React.FC<RepositoryWorkspaceProps> = ({
  repository,
  branches,
  isGithubConnected = true,
  onConnectGithub,
  onCommitSuccess,
}) => {
  // Workspace Branch State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    repository.defaultBranch || (branches.length > 0 ? branches[0].name : 'main')
  );

  // File Explorer State
  const [currentPath, setCurrentPath] = useState<string>('');
  const [treeItems, setTreeItems] = useState<GithubContentItem[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState<boolean>(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Active File & Editor State
  const [activeFile, setActiveFile] = useState<GithubFile | null>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Commit State
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitSuccessMsg, setCommitSuccessMsg] = useState<string | null>(null);
  const [commitErrorMsg, setCommitErrorMsg] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<boolean>(false);

  // Unsaved changes modal state
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  const isModified = Boolean(activeFile && editedContent !== originalContent);

  // Synchronize branch if repository changes
  useEffect(() => {
    if (repository.defaultBranch) {
      setSelectedBranch(repository.defaultBranch);
    } else if (branches.length > 0) {
      setSelectedBranch(branches[0].name);
    }
  }, [repository.id, repository.defaultBranch, branches]);

  // Load tree contents
  const loadFolderContents = useCallback(
    async (path: string, branch: string) => {
      setIsTreeLoading(true);
      setTreeError(null);
      try {
        const data = await githubService.getRepositoryContents(repository.id, path, branch);
        setTreeItems(data.items || []);
        setCurrentPath(data.path || path);
      } catch (err: unknown) {
        setTreeError(
          (err as { message?: string }).message || 'Failed to load repository contents.'
        );
      } finally {
        setIsTreeLoading(false);
      }
    },
    [repository.id]
  );

  // Initial load or when path / branch changes
  useEffect(() => {
    if (isGithubConnected) {
      loadFolderContents(currentPath, selectedBranch);
    }
  }, [loadFolderContents, currentPath, selectedBranch, isGithubConnected]);

  // Safely execute navigation with unsaved changes check
  const confirmWithUnsavedCheck = (action: () => void) => {
    if (isModified) {
      setPendingAction(() => action);
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const handleNavigatePath = (newPath: string) => {
    confirmWithUnsavedCheck(() => {
      setCurrentPath(newPath);
    });
  };

  const handleSelectFile = async (item: GithubContentItem) => {
    confirmWithUnsavedCheck(async () => {
      setIsFileLoading(true);
      setFileError(null);
      setConflictError(false);
      setCommitSuccessMsg(null);
      setCommitErrorMsg(null);

      try {
        const fileData = await githubService.getRepositoryFile(
          repository.id,
          item.path,
          selectedBranch
        );
        setActiveFile(fileData);
        setOriginalContent(fileData.content || '');
        setEditedContent(fileData.content || '');
      } catch (err: unknown) {
        setFileError((err as { message?: string }).message || 'Failed to load file contents.');
        setActiveFile(null);
        setOriginalContent('');
        setEditedContent('');
      } finally {
        setIsFileLoading(false);
      }
    });
  };

  const handleBranchChange = (newBranch: string) => {
    if (newBranch === selectedBranch) return;
    confirmWithUnsavedCheck(() => {
      setSelectedBranch(newBranch);
      setActiveFile(null);
      setOriginalContent('');
      setEditedContent('');
      setCommitMessage('');
      setConflictError(false);
      setCommitSuccessMsg(null);
      setCommitErrorMsg(null);
    });
  };

  const handleReloadActiveFile = async () => {
    if (!activeFile) return;
    setIsFileLoading(true);
    setFileError(null);
    setConflictError(false);
    setCommitErrorMsg(null);

    try {
      const fileData = await githubService.getRepositoryFile(
        repository.id,
        activeFile.path,
        selectedBranch
      );
      setActiveFile(fileData);
      setOriginalContent(fileData.content || '');
      setEditedContent(fileData.content || '');
    } catch (err: unknown) {
      setFileError((err as { message?: string }).message || 'Failed to reload file.');
    } finally {
      setIsFileLoading(false);
    }
  };

  const handleCommitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile || !isModified || !commitMessage.trim() || isCommitting) return;

    setIsCommitting(true);
    setCommitSuccessMsg(null);
    setCommitErrorMsg(null);
    setConflictError(false);

    try {
      const res = await githubService.updateRepositoryFile(repository.id, {
        path: activeFile.path,
        branch: selectedBranch,
        content: editedContent,
        sha: activeFile.sha,
        commitMessage: commitMessage.trim(),
      });

      // Commit successful
      setOriginalContent(editedContent);
      setActiveFile((prev) => (prev ? { ...prev, sha: res.commit.sha } : null));
      setCommitSuccessMsg('File committed successfully.');
      setCommitMessage('');

      if (onCommitSuccess) {
        onCommitSuccess();
      }
    } catch (err: unknown) {
      const errObj = err as { statusCode?: number; message?: string };
      const msg = errObj.message || 'Failed to commit changes to GitHub.';

      if (errObj.statusCode === 409 || msg.includes('File changed on GitHub')) {
        setConflictError(true);
        setCommitErrorMsg('File changed on GitHub. Please reload the file before committing.');
      } else {
        setCommitErrorMsg(msg);
      }
    } finally {
      setIsCommitting(false);
    }
  };

  // If GitHub is disconnected
  if (!isGithubConnected) {
    return (
      <GlassCard className="p-8 text-center space-y-4 max-w-lg mx-auto border-amber-500/20 my-6">
        <Lock className="h-10 w-10 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">GitHub Account Not Connected</h3>
        <p className="text-xs text-white/60">
          Connect your GitHub account to access real repository files, code editor, and commit directly from DevWeave.
        </p>
        {onConnectGithub && (
          <button
            onClick={onConnectGithub}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg transition-all"
          >
            Connect GitHub
          </button>
        )}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header & Branch Selector Bar */}
      <GlassCard className="p-4 border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Repository Workspace</h2>
            <p className="text-xs text-white/50">
              Browse, view, edit, and commit code directly to GitHub.
            </p>
          </div>
        </div>

        {/* Branch Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/60">Branch:</span>
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="appearance-none bg-slate-900 border border-white/10 hover:border-white/20 rounded-xl px-3 py-1.5 pr-8 text-xs font-mono font-semibold text-white outline-none cursor-pointer transition-all"
            >
              {branches.length === 0 ? (
                <option value={selectedBranch}>{selectedBranch}</option>
              ) : (
                branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} {b.isDefault ? '(default)' : ''}
                  </option>
                ))
              )}
            </select>
            <GitBranch className="h-3.5 w-3.5 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </GlassCard>

      {/* Main Workspace Layout (2 Columns: Left Explorer, Right Editor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        {/* Left Column: File Explorer (4 cols) */}
        <div className="lg:col-span-4 h-[550px]">
          <FileExplorer
            repoName={repository.name}
            ownerName={repository.owner}
            currentPath={currentPath}
            items={treeItems}
            selectedFilePath={activeFile?.path || null}
            isLoading={isTreeLoading}
            error={treeError}
            onNavigatePath={handleNavigatePath}
            onSelectFile={handleSelectFile}
            onRetry={() => loadFolderContents(currentPath, selectedBranch)}
          />
        </div>

        {/* Right Column: Code Editor & Commit UI (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="flex-1 h-[450px]">
            <CodeEditor
              repoFullName={repository.fullName || (repository.owner ? `${repository.owner}/${repository.name}` : undefined)}
              branch={selectedBranch}
              file={activeFile}
              content={editedContent}
              isModified={isModified}
              isLoading={isFileLoading}
              error={fileError}
              onChangeContent={setEditedContent}
              onRetry={handleReloadActiveFile}
            />
          </div>

          {/* Commit Bar */}
          {activeFile && (
            <GlassCard className="p-4 border-white/[0.08] space-y-3">
              {/* Conflict / Error Alerts */}
              {conflictError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>File changed on GitHub. Please reload the file before committing.</span>
                  </div>
                  <button
                    onClick={handleReloadActiveFile}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shrink-0 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reload File</span>
                  </button>
                </div>
              )}

              {commitErrorMsg && !conflictError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{commitErrorMsg}</span>
                </div>
              )}

              {commitSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{commitSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleCommitSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder={`Update ${activeFile.name}...`}
                    disabled={!isModified || isCommitting}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-white/40 outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                  <GitCommit className="h-3.5 w-3.5 text-white/30 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <button
                  type="submit"
                  disabled={!isModified || !commitMessage.trim() || isCommitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-white/[0.04] disabled:text-white/30 text-white font-semibold text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:shadow-none shrink-0"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Commit Changes</span>
                    </>
                  )}
                </button>
              </form>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 space-y-4 border-amber-500/30">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Unsaved Changes</h3>
                <p className="text-xs text-white/60 mt-1">
                  You have unsaved changes in <span className="font-mono font-semibold text-white">{activeFile?.name}</span>. Are you sure you want to leave without committing?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => {
                  setShowUnsavedModal(false);
                  setPendingAction(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowUnsavedModal(false);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
