import React, { useState, useEffect } from 'react';
import { Key, X, Loader2, AlertCircle, Plus, Trash2, CheckCircle2, FileCode, Eye, EyeOff } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';

interface SecretRow {
  id: string;
  key: string;
  value: string;
  show: boolean;
}

interface K8sCreateSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  initialNamespace?: string;
  namespaces?: string[];
  onOpenYamlEditor?: (generatedYaml: string) => void;
}

export const K8sCreateSecretModal: React.FC<K8sCreateSecretModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNamespace = 'default',
  namespaces = ['default'],
  onOpenYamlEditor,
}) => {
  const [name, setName] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('default');
  const [type, setType] = useState<'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/basic-auth'>('Opaque');
  const [rows, setRows] = useState<SecretRow[]>([
    { id: '1', key: 'API_KEY', value: '', show: false },
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const activeNs = initialNamespace && initialNamespace !== 'ALL' ? initialNamespace : 'default';
      setNamespace(activeNs);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialNamespace]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), key: '', value: '', show: false },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([{ id: '1', key: '', value: '', show: false }]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: 'key' | 'value', val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const toggleShow = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, show: !r.show } : r))
    );
  };

  const buildManifestYaml = (): string => {
    const cleanName = name.trim().toLowerCase() || 'my-secret';
    const cleanNs = namespace.trim().toLowerCase() || 'default';
    const validRows = rows.filter((r) => r.key.trim());

    // In YAML stringData can be used for plain input
    const dataBlock =
      validRows.length > 0
        ? `stringData:\n` +
          validRows.map((r) => `  ${r.key.trim()}: "${r.value.replace(/"/g, '\\"')}"`).join('\n')
        : 'stringData:\n  API_KEY: "secret-value"';

    return `apiVersion: v1
kind: Secret
metadata:
  name: ${cleanName}
  namespace: ${cleanNs}
  labels:
    app.kubernetes.io/managed-by: devweave
type: ${type}
${dataBlock}
`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim().toLowerCase();
    const cleanNs = namespace.trim().toLowerCase();

    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!cleanName || !dnsRegex.test(cleanName) || cleanName.length < 2 || cleanName.length > 63) {
      setError('Secret name must consist of lower case alphanumeric characters or "-", start and end with an alphanumeric character (2-63 characters).');
      return;
    }

    const validRows = rows.filter((r) => r.key.trim());
    if (validRows.length === 0) {
      setError('At least one non-empty secret key-value entry is required.');
      return;
    }

    const dataMap: Record<string, string> = {};
    for (const r of validRows) {
      dataMap[r.key.trim()] = r.value;
    }

    setLoading(true);
    try {
      await kubernetesService.createSecret({
        name: cleanName,
        namespace: cleanNs,
        type,
        data: dataMap,
      });

      setSuccessMsg(`Secret "${cleanName}" created securely!`);
      setTimeout(() => {
        onSuccess(cleanName);
        onClose();
      }, 700);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create Secret.';
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
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create Kubernetes Secret</h3>
              <p className="text-xs text-slate-400">Store sensitive tokens, passwords, and keys with encryption and audit safeguards</p>
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
              <label className="text-xs font-medium text-slate-300">Secret Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setError(null);
                }}
                placeholder="e.g. app-credentials, db-auth"
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Secret Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="Opaque">Opaque (Generic Secret)</option>
              <option value="kubernetes.io/tls">kubernetes.io/tls (TLS Certificate & Key)</option>
              <option value="kubernetes.io/basic-auth">kubernetes.io/basic-auth (Basic Authentication)</option>
            </select>
          </div>

          <div className="space-y-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Secret Key-Value Pairs *</label>
              <button
                type="button"
                onClick={handleAddRow}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Entry</span>
              </button>
            </div>

            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. PASSWORD)"
                    value={row.key}
                    onChange={(e) => handleRowChange(row.id, 'key', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-500 font-mono text-xs">=</span>
                  <div className="flex-1 relative">
                    <input
                      type={row.show ? 'text' : 'password'}
                      placeholder="Sensitive Value"
                      value={row.value}
                      onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                      className="w-full px-3 py-1.5 pr-8 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(row.id)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                      title={row.show ? 'Hide value' : 'Show value'}
                    >
                      {row.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                <span>Create Secret</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
