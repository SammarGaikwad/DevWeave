import React, { useState, useEffect } from 'react';
import { FileCode, X, Copy, Check, Loader2, Save, FileText, Download } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';

interface K8sYamlModalProps {
  isOpen: boolean;
  kind: string;
  name: string;
  namespace?: string;
  initialMode?: 'yaml' | 'describe';
  onClose: () => void;
  onApplySuccess?: () => void;
}

export const K8sYamlModal: React.FC<K8sYamlModalProps> = ({
  isOpen,
  kind,
  name,
  namespace,
  initialMode = 'yaml',
  onClose,
  onApplySuccess,
}) => {
  const [activeView, setActiveView] = useState<'yaml' | 'describe'>(initialMode);
  const [content, setContent] = useState<string>('');
  const [describeContent, setDescribeContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !kind || !name) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const loadData = async () => {
      try {
        const [yamlRes, descRes] = await Promise.allSettled([
          kubernetesService.getResourceYaml(kind, name, namespace),
          kubernetesService.describeResource(kind, name, namespace),
        ]);

        if (isMounted) {
          if (yamlRes.status === 'fulfilled') {
            setContent(yamlRes.value.yaml || '');
          } else {
            setError('Could not fetch resource YAML.');
          }

          if (descRes.status === 'fulfilled') {
            setDescribeContent(descRes.value.description || '');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to inspect resource.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, kind, name, namespace]);

  const handleCopy = () => {
    const textToCopy = activeView === 'yaml' ? content : describeContent;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = activeView === 'yaml' ? content : describeContent;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${activeView}.${activeView === 'yaml' ? 'yaml' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApply = async () => {
    if (!content.trim()) return;
    setApplying(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await kubernetesService.applyManifest(content, namespace);
      setSuccessMsg(res.output || 'Manifest applied successfully.');
      if (onApplySuccess) onApplySuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to apply manifest.');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl border border-slate-700/60 shadow-2xl bg-slate-900/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-100 font-mono">
                  {kind}/{name}
                </h3>
                {namespace && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                    {namespace}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Kubernetes Resource Definition</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Switcher */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                onClick={() => setActiveView('yaml')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition ${
                  activeView === 'yaml' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>YAML</span>
              </button>
              <button
                onClick={() => setActiveView('describe')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition ${
                  activeView === 'describe' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Describe</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              disabled={loading}
              title="Copy"
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownload}
              disabled={loading}
              title="Download"
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Banners */}
        {error && (
          <div className="px-6 py-2 bg-red-950/40 border-b border-red-500/30 text-xs font-mono text-red-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="px-6 py-2 bg-emerald-950/40 border-b border-emerald-500/30 text-xs font-mono text-emerald-300">
            {successMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 p-4 bg-slate-950 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center space-x-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-sm font-mono">Fetching {activeView.toUpperCase()}...</span>
            </div>
          ) : activeView === 'yaml' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 font-mono text-xs text-slate-200 resize-none focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          ) : (
            <pre className="flex-1 p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
              {describeContent || 'No describe output available.'}
            </pre>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/60">
          <span className="text-xs text-slate-400">
            {activeView === 'yaml' ? 'Edit YAML directly and click "Apply Changes" to mutate the cluster resource.' : 'Read-only cluster inspect output.'}
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Close
            </button>
            {activeView === 'yaml' && (
              <button
                onClick={handleApply}
                disabled={applying || loading}
                className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex items-center space-x-2 shadow-lg shadow-indigo-900/30 disabled:opacity-50"
              >
                {applying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Save className="w-3.5 h-3.5" />
                <span>Apply Changes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
