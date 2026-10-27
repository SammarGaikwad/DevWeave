import React, { useState } from 'react';
import { Sliders, X, Loader2, AlertTriangle } from 'lucide-react';

interface K8sScaleModalProps {
  isOpen: boolean;
  kind: string;
  name: string;
  namespace: string;
  currentReplicas: number;
  isLoading?: boolean;
  onScale: (replicas: number) => void;
  onClose: () => void;
}

export const K8sScaleModal: React.FC<K8sScaleModalProps> = ({
  isOpen,
  kind,
  name,
  namespace,
  currentReplicas,
  isLoading = false,
  onScale,
  onClose,
}) => {
  const [replicas, setReplicas] = useState<number>(currentReplicas);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onScale(replicas);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl border border-slate-700/60 shadow-2xl bg-slate-900/95 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Scale Workload</h3>
              <p className="text-xs font-mono text-slate-400">
                {kind}/{name} in {namespace}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Current Pod Replicas:</span>
            <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {currentReplicas}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-slate-300">Desired Replicas</label>
              <span className="text-base font-bold font-mono text-indigo-400">{replicas}</span>
            </div>
            <input
              type="range"
              min={0}
              max={25}
              value={replicas}
              onChange={(e) => setReplicas(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 (Stop all pods)</span>
              <span>10</span>
              <span>25</span>
            </div>
          </div>

          {replicas === 0 && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Scaling to 0 replicas will terminate all running pods for this {kind}.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/30 rounded-xl transition flex items-center space-x-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Apply Scale</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
