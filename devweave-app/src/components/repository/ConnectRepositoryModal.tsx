import React, { useEffect, useState } from 'react';
import { X, Info, GitBranch, FolderGit2, ArrowRight } from 'lucide-react';
import { githubService } from '../../services/githubService';

interface ConnectRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectGitHubSuccess?: () => void;
}

export const ConnectRepositoryModal: React.FC<ConnectRepositoryModalProps> = ({
  isOpen,
  onClose,
  onConnectGitHubSuccess,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProviderSelect = async (provider: string) => {
    setSelectedProvider(provider);
    if (provider === 'GitHub') {
      try {
        if (onConnectGitHubSuccess) {
          await onConnectGitHubSuccess();
        } else {
          await githubService.connectGitHub();
        }
      } catch (err: unknown) {
        setNoticeMessage(
          (err as { message?: string }).message || 'Failed to initiate GitHub authorization.'
        );
      }
    } else {
      setNoticeMessage(`${provider} integration is coming soon.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className="relative w-full max-w-lg glass-panel bg-[#0a0a0a]/95 rounded-2xl border border-white/15 shadow-2xl p-6 z-10 overflow-hidden space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-6">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Connect a source control provider
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Link external code repositories securely to your DevWeave workspace.
          </p>
        </div>

        {/* Notice Message Alert if selected */}
        {noticeMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs animate-in fade-in duration-200">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-white">{selectedProvider} Integration</p>
              <p className="text-white/80 leading-relaxed">{noticeMessage}</p>
            </div>
          </div>
        )}

        {/* Provider Selection Buttons */}
        <div className="space-y-3 pt-2">
          {/* GitHub Option (Visually Primary & Active) */}
          <button
            onClick={() => handleProviderSelect('GitHub')}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group ${
              selectedProvider === 'GitHub'
                ? 'bg-blue-600/20 border-blue-500/60 ring-2 ring-blue-500/30'
                : 'bg-white/[0.04] border-white/15 hover:bg-white/[0.08] hover:border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.03)]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-white/10 text-white group-hover:scale-105 transition-transform">
                <FolderGit2 className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">GitHub</span>
                  <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                    Functional Provider
                  </span>
                </div>
                <p className="text-xs text-white/50">Connect your GitHub account to access repositories.</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
              Connect GitHub
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>

          {/* GitLab Option (Coming Soon) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02] opacity-75">
            <div className="flex items-center gap-3.5">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <GitBranch className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/80">GitLab</span>
                  <span className="text-[10px] font-semibold text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/10">
                    Coming soon
                  </span>
                </div>
                <p className="text-xs text-white/40">Self-hosted & SaaS GitLab support</p>
              </div>
            </div>
          </div>

          {/* Bitbucket Option (Coming Soon) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02] opacity-75">
            <div className="flex items-center gap-3.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <span className="text-xs font-bold font-mono">BB</span>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/80">Bitbucket</span>
                  <span className="text-[10px] font-semibold text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/10">
                    Coming soon
                  </span>
                </div>
                <p className="text-xs text-white/40">Atlassian Bitbucket Cloud & Data Center</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
