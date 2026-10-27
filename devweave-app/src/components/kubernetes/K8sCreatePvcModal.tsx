import React, { useState, useEffect } from 'react';
import { Database, X, Loader2, AlertCircle, CheckCircle2, FileCode } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';

interface K8sCreatePvcModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  initialNamespace?: string;
  namespaces?: string[];
  storageClasses?: Array<{ name: string }>;
  onOpenYamlEditor?: (generatedYaml: string) => void;
}

export const K8sCreatePvcModal: React.FC<K8sCreatePvcModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNamespace = 'default',
  namespaces = ['default'],
  storageClasses = [],
  onOpenYamlEditor,
}) => {
  const [name, setName] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('default');
  const [storageClass, setStorageClass] = useState<string>('');
  const [accessMode, setAccessMode] = useState<'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany'>('ReadWriteOnce');
  const [storage, setStorage] = useState<string>('1Gi');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const activeNs = initialNamespace && initialNamespace !== 'ALL' ? initialNamespace : 'default';
      setNamespace(activeNs);
      if (storageClasses.length > 0 && !storageClass) {
        setStorageClass(storageClasses[0].name);
      }
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialNamespace, storageClasses]);

  if (!isOpen) return null;

  const buildManifestYaml = (): string => {
    const cleanName = name.trim().toLowerCase() || 'my-pvc';
    const cleanNs = namespace.trim().toLowerCase() || 'default';
    const scLine = storageClass ? `  storageClassName: ${storageClass}\n` : '';

    return `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${cleanName}
  namespace: ${cleanNs}
  labels:
    app.kubernetes.io/managed-by: devweave
spec:
${scLine}  accessModes:
    - ${accessMode}
  resources:
    requests:
      storage: ${storage.trim() || '1Gi'}
`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim().toLowerCase();
    const cleanNs = namespace.trim().toLowerCase();
    const cleanStorage = storage.trim();

    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!cleanName || !dnsRegex.test(cleanName) || cleanName.length < 2 || cleanName.length > 63) {
      setError('PVC name must consist of lower case alphanumeric characters or "-", start and end with an alphanumeric character (2-63 characters).');
      return;
    }

    if (!/^\d+(?:[KMGTPE]i|[KMGTPE]|m)?$/.test(cleanStorage)) {
      setError('Storage size must be a valid Kubernetes quantity (e.g. 1Gi, 500Mi, 10Gi).');
      return;
    }

    setLoading(true);
    try {
      await kubernetesService.createPvc({
        name: cleanName,
        namespace: cleanNs,
        storageClass: storageClass || undefined,
        accessModes: [accessMode],
        storage: cleanStorage,
      });

      setSuccessMsg(`PersistentVolumeClaim "${cleanName}" created successfully!`);
      setTimeout(() => {
        onSuccess(cleanName);
        onClose();
      }, 700);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create PVC.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg my-8 p-6 rounded-2xl border border-slate-700/70 shadow-2xl bg-slate-900/95 space-y-5 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Claim Persistent Storage (PVC)</h3>
              <p className="text-xs text-slate-400">Request persistent storage capacity and access modes from cluster StorageClasses</p>
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
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-200">Creation Failed</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">PVC Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setError(null);
                }}
                placeholder="e.g. data-volume, postgres-pvc"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Namespace *</label>
              <select
                value={namespace}
                onChange={(e) => {
                  setNamespace(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              >
                {namespaces.map((ns) => (
                  <option key={ns} value={ns} className="bg-slate-900 text-slate-100">
                    {ns}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Storage Class</label>
              <select
                value={storageClass}
                onChange={(e) => setStorageClass(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="">Default Cluster StorageClass</option>
                {storageClasses.map((sc) => (
                  <option key={sc.name} value={sc.name}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Storage Capacity *</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  required
                  value={storage}
                  onChange={(e) => {
                    setStorage(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. 1Gi, 5Gi, 20Gi"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Access Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ReadWriteOnce', 'ReadOnlyMany', 'ReadWriteMany'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setAccessMode(mode)}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition flex flex-col items-center gap-0.5 ${
                    accessMode === mode
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow'
                      : 'bg-slate-800/50 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold text-[11px]">{mode}</span>
                  <span className="text-[10px] opacity-75">
                    {mode === 'ReadWriteOnce' ? 'Single node R/W' : mode === 'ReadOnlyMany' ? 'Multi node read' : 'Multi node R/W'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {onOpenYamlEditor ? (
              <button
                type="button"
                onClick={() => {
                  const yaml = buildManifestYaml();
                  onOpenYamlEditor(yaml);
                  onClose();
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 transition py-1"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Open in YAML Studio</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
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
                <span>Create Claim</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
