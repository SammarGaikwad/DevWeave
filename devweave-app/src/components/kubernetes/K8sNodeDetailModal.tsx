import React, { useState } from 'react';
import { Server, X, CheckCircle2, AlertTriangle, Shield, Terminal, Loader2 } from 'lucide-react';
import type { K8sNodeSummary } from '../../services/kubernetesService';
import { kubernetesService } from '../../services/kubernetesService';

interface K8sNodeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: K8sNodeSummary | null;
}

export const K8sNodeDetailModal: React.FC<K8sNodeDetailModalProps> = ({
  isOpen,
  onClose,
  node,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'conditions' | 'describe'>('overview');
  const [describeText, setDescribeText] = useState<string | null>(null);
  const [describeLoading, setDescribeLoading] = useState<boolean>(false);

  if (!isOpen || !node) return null;

  const handleFetchDescribe = async () => {
    setActiveTab('describe');
    if (!describeText) {
      setDescribeLoading(true);
      try {
        const res = await kubernetesService.describeResource('Node', node.name);
        setDescribeText(res.description);
      } catch (err: any) {
        setDescribeText(err?.message || 'Failed to fetch Node describe telemetry.');
      } finally {
        setDescribeLoading(false);
      }
    }
  };

  const isReady = node.status === 'Ready';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl my-8 p-6 rounded-2xl border border-slate-700/70 shadow-2xl bg-slate-900/95 space-y-5 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${
              isReady ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-100">{node.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isReady ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {node.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">Kubernetes Cluster Infrastructure Host &middot; Kubelet {node.version}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Overview & Telemetry
          </button>
          <button
            onClick={() => setActiveTab('conditions')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'conditions'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Node Conditions ({node.conditions?.length || 0})
          </button>
          <button
            onClick={handleFetchDescribe}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'describe'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Kubectl Describe</span>
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                <span className="text-[11px] text-slate-400">Roles</span>
                <p className="text-xs font-semibold text-slate-200 font-mono mt-0.5">{node.roles.join(', ') || 'worker'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                <span className="text-[11px] text-slate-400">Internal IP</span>
                <p className="text-xs font-semibold text-indigo-300 font-mono mt-0.5">{node.internalIP || '127.0.0.1'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                <span className="text-[11px] text-slate-400">CPU Capacity</span>
                <p className="text-xs font-semibold text-slate-200 font-mono mt-0.5">{node.cpuCapacity || 'Unknown'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                <span className="text-[11px] text-slate-400">Memory Capacity</span>
                <p className="text-xs font-semibold text-slate-200 font-mono mt-0.5">{node.memoryCapacity || 'Unknown'}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Cluster Scope & Node Safeguards</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nodes are physical or virtual control-plane and worker instances registered with the Kubernetes API server.
                Direct deletion via the management API is strictly blocked to protect cluster stability. Drain and uncordon nodes through host infrastructure.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'conditions' && (
          <div className="space-y-2">
            {!node.conditions || node.conditions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">No reported condition states.</p>
            ) : (
              node.conditions.map((c, i) => {
                const isGood = (c.type === 'Ready' && c.status === 'True') || (c.type !== 'Ready' && c.status === 'False');
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
                    <div className="flex items-center space-x-2.5">
                      {isGood ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-200">{c.type}</span>
                        {c.reason && <span className="text-[11px] text-slate-400 ml-2">({c.reason})</span>}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      isGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'describe' && (
          <div className="space-y-2">
            {describeLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Fetching node telemetry from runner...</span>
              </div>
            ) : (
              <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-[11px] max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                {describeText}
              </pre>
            )}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
