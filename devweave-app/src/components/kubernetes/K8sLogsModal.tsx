import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal, X, Copy, Check, RefreshCw, Loader2, Download } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';

interface K8sLogsModalProps {
  isOpen: boolean;
  namespace: string;
  podName: string;
  containers?: Array<{ name: string }>;
  onClose: () => void;
}

export const K8sLogsModal: React.FC<K8sLogsModalProps> = ({
  isOpen,
  namespace,
  podName,
  containers = [],
  onClose,
}) => {
  const [selectedContainer, setSelectedContainer] = useState<string>(
    containers.length > 0 ? containers[0].name : ''
  );
  const [tailLines, setTailLines] = useState<number>(100);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (containers.length > 0 && (!selectedContainer || !containers.some(c => c.name === selectedContainer))) {
      setSelectedContainer(containers[0].name);
    }
  }, [containers, selectedContainer]);

  const fetchLogs = useCallback(async () => {
    if (!isOpen || !podName || !namespace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await kubernetesService.getPodLogs(
        namespace,
        podName,
        selectedContainer || undefined,
        tailLines
      );
      setLogs(data.logs || 'No logs available for this container.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to retrieve pod logs.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, namespace, podName, selectedContainer, tailLines]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    if (!logs) return;
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!logs) return;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podName}-${selectedContainer || 'logs'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl border border-slate-700/60 shadow-2xl bg-slate-900/95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-100">{podName}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                  {namespace}
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Pod Container Logs</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Container Selector if pod has multiple containers */}
            {containers.length > 1 && (
              <select
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {containers.map((c) => (
                  <option key={c.name} value={c.name}>
                    container: {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tail lines selector */}
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-mono bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value={50}>Last 50 lines</option>
              <option value={100}>Last 100 lines</option>
              <option value={250}>Last 250 lines</option>
              <option value={500}>Last 500 lines</option>
              <option value={1000}>Last 1000 lines</option>
            </select>

            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh logs"
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleCopy}
              disabled={!logs || loading}
              title="Copy to clipboard"
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownload}
              disabled={!logs || loading}
              title="Download logs"
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

        {/* Content */}
        <div className="flex-1 p-4 bg-slate-950 overflow-hidden flex flex-col">
          {error ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm">
              <p className="font-semibold mb-1">Failed to fetch container logs</p>
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : loading && !logs ? (
            <div className="flex-1 flex items-center justify-center space-x-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-sm font-mono">Fetching container logs...</span>
            </div>
          ) : (
            <pre
              ref={scrollRef}
              className="flex-1 p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text"
            >
              {logs || 'Empty log output received from container.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
