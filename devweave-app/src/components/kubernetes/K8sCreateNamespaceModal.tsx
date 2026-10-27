import React, { useState } from 'react';
import { Layers, X, Loader2, AlertCircle } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';

interface K8sCreateNamespaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
}

export const K8sCreateNamespaceModal: React.FC<K8sCreateNamespaceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().toLowerCase();

    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!dnsRegex.test(clean) || clean.length < 2 || clean.length > 63) {
      setError('Namespace must consist of lower case alphanumeric characters or "-", start and end with an alphanumeric character (2-63 characters).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await kubernetesService.createNamespace(clean);
      onSuccess(clean);
      setName('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create namespace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl border border-slate-700/60 shadow-2xl bg-slate-900/95 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create Namespace</h3>
              <p className="text-xs text-slate-400">Kubernetes Resource Boundary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Namespace Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase());
                setError(null);
              }}
              placeholder="e.g. staging, feature-checkout, ml-models"
              className="w-full px-3.5 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400">
              Namespaces provide logical isolation for workloads, services, and policies.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-2 shadow-lg shadow-indigo-900/30 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Namespace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
