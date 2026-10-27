import React, { useState, useEffect } from 'react';
import { Network, X, Loader2, AlertCircle, Plus, Trash2, CheckCircle2, Sparkles, FileCode } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';
import type { K8sDeploymentSummary } from '../../services/kubernetesService';

interface SelectorPair {
  id: string;
  key: string;
  value: string;
}

interface K8sCreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (serviceName: string) => void;
  initialNamespace?: string;
  namespaces?: string[];
  deployments?: K8sDeploymentSummary[];
  onOpenYamlEditor?: (generatedYaml: string) => void;
}

export const K8sCreateServiceModal: React.FC<K8sCreateServiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNamespace = 'default',
  namespaces = ['default'],
  deployments = [],
  onOpenYamlEditor,
}) => {
  const [name, setName] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('default');
  const [type, setType] = useState<'ClusterIP' | 'NodePort' | 'LoadBalancer'>('ClusterIP');
  const [selectors, setSelectors] = useState<SelectorPair[]>([
    { id: '1', key: 'app', value: '' },
  ]);
  const [port, setPort] = useState<string>('80');
  const [targetPort, setTargetPort] = useState<string>('8080');
  const [protocol, setProtocol] = useState<'TCP' | 'UDP' | 'SCTP'>('TCP');

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

  // Filter deployments in current namespace for quick suggestion chips
  const relevantDeployments = deployments.filter(
    (d) => d.namespace === namespace && d.selector && Object.keys(d.selector).length > 0
  );

  const handleAddSelector = () => {
    setSelectors((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), key: '', value: '' },
    ]);
  };

  const handleRemoveSelector = (id: string) => {
    if (selectors.length <= 1) {
      setSelectors([{ id: '1', key: '', value: '' }]);
      return;
    }
    setSelectors((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSelectorChange = (id: string, field: 'key' | 'value', val: string) => {
    setSelectors((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
    setError(null);
  };

  const applySuggestedSelector = (sel: Record<string, string>) => {
    const pairs = Object.entries(sel).map(([k, v], idx) => ({
      id: String(Date.now() + idx),
      key: k,
      value: v,
    }));
    if (pairs.length > 0) {
      setSelectors(pairs);
      setError(null);
    }
  };

  const buildManifestYaml = (): string => {
    const cleanName = name.trim().toLowerCase() || 'devweave-service';
    const cleanNs = namespace.trim().toLowerCase() || 'default';
    const portNum = parseInt(port, 10) || 80;
    const targetPortVal = /^\d+$/.test(targetPort.trim()) ? parseInt(targetPort.trim(), 10) : targetPort.trim() || 8080;

    const selectorLines = selectors
      .filter((s) => s.key.trim() && s.value.trim())
      .map((s) => `    ${s.key.trim()}: "${s.value.trim()}"`);

    const selectorsBlock =
      selectorLines.length > 0 ? selectorLines.join('\n') : '    app: devweave-service';

    return `apiVersion: v1
kind: Service
metadata:
  name: ${cleanName}
  namespace: ${cleanNs}
  labels:
    app.kubernetes.io/name: ${cleanName}
    app.kubernetes.io/managed-by: devweave
spec:
  type: ${type}
  selector:
${selectorsBlock}
  ports:
    - name: ${portNum === 80 ? 'http' : portNum === 443 ? 'https' : 'service-port'}
      protocol: ${protocol}
      port: ${portNum}
      targetPort: ${targetPortVal}
`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim().toLowerCase();
    const cleanNs = namespace.trim().toLowerCase();

    // 1. Name validation
    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!cleanName || !dnsRegex.test(cleanName) || cleanName.length < 2 || cleanName.length > 63) {
      setError('Service name must consist of lower case alphanumeric characters or "-", start and end with an alphanumeric character (2-63 characters).');
      return;
    }

    // 2. Protection validation
    if (cleanName === 'kubernetes' && cleanNs === 'default') {
      setError('The name "kubernetes" in the default namespace is reserved for the core Kubernetes API service.');
      return;
    }
    if (cleanName === 'kube-dns' && cleanNs === 'kube-system') {
      setError('The name "kube-dns" in kube-system is reserved for cluster DNS.');
      return;
    }

    // 3. Port validation
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Service port must be a valid number between 1 and 65535.');
      return;
    }

    // 4. Target port validation
    const cleanTargetPort = targetPort.trim();
    if (!cleanTargetPort) {
      setError('Target port is required (e.g. 8080 or port name).');
      return;
    }
    let parsedTargetPort: number | string = cleanTargetPort;
    if (/^\d+$/.test(cleanTargetPort)) {
      const num = parseInt(cleanTargetPort, 10);
      if (num < 1 || num > 65535) {
        setError('Target port number must be between 1 and 65535.');
        return;
      }
      parsedTargetPort = num;
    }

    // 5. Selectors validation
    const validPairs = selectors.filter((s) => s.key.trim() && s.value.trim());
    if (validPairs.length === 0) {
      setError('At least one selector key-value pair is required to route traffic to workloads.');
      return;
    }

    const selectorMap: Record<string, string> = {};
    for (const pair of validPairs) {
      selectorMap[pair.key.trim()] = pair.value.trim();
    }

    setLoading(true);
    try {
      await kubernetesService.createService({
        name: cleanName,
        namespace: cleanNs,
        type,
        selector: selectorMap,
        port: portNum,
        targetPort: parsedTargetPort,
        protocol,
      });

      setSuccessMsg(`Service "${cleanName}" created successfully!`);
      setTimeout(() => {
        onSuccess(cleanName);
        onClose();
      }, 700);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create Kubernetes service.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-xl my-8 p-6 rounded-2xl border border-slate-700/70 shadow-2xl bg-slate-900/95 space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create Kubernetes Service</h3>
              <p className="text-xs text-slate-400">Expose workloads and route traffic with ClusterIP, NodePort, or LoadBalancer</p>
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

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-200">Creation Failed</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Name and Namespace */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Service Name *</span>
                <span className="text-[10px] text-slate-400">DNS-1123 label</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setError(null);
                }}
                placeholder="e.g. devweave-service-svc"
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

          {/* Row 2: Service Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Service Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ClusterIP', 'NodePort', 'LoadBalancer'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition flex flex-col items-center gap-0.5 ${
                    type === t
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow'
                      : 'bg-slate-800/50 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold">{t}</span>
                  <span className="text-[10px] opacity-75">
                    {t === 'ClusterIP' ? 'Internal only' : t === 'NodePort' ? 'Node port' : 'External LB'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Selector Key/Value Pairs */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Pod Selectors * <span className="text-slate-400 font-normal">(targets pods with matching labels)</span>
              </label>
              <button
                type="button"
                onClick={handleAddSelector}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Selector</span>
              </button>
            </div>

            {/* Workload suggestions */}
            {relevantDeployments.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Workloads:
                </span>
                {relevantDeployments.map((d) => (
                  <button
                    type="button"
                    key={d.name}
                    onClick={() => applySuggestedSelector(d.selector)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-900/80 transition"
                    title={`Click to fill selector for deployment ${d.name}`}
                  >
                    {d.name} ({Object.entries(d.selector).map(([k, v]) => `${k}=${v}`).join(', ')})
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-1">
              {selectors.map((item) => (
                <div key={item.id} className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. app)"
                    value={item.key}
                    onChange={(e) => handleSelectorChange(item.id, 'key', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-500 font-mono text-xs">=</span>
                  <input
                    type="text"
                    placeholder="Value (e.g. devweave-service)"
                    value={item.value}
                    onChange={(e) => handleSelectorChange(item.id, 'value', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSelector(item.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                    title="Remove pair"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Port Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Service Port *</label>
              <input
                type="number"
                min="1"
                max="65535"
                required
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 80"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Exposed port</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Target Port *</label>
              <input
                type="text"
                required
                value={targetPort}
                onChange={(e) => {
                  setTargetPort(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 8080 or http"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Container port</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Protocol</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="SCTP">SCTP</option>
              </select>
              <span className="text-[10px] text-slate-400">Transport layer</span>
            </div>
          </div>

          {/* Footer Controls */}
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
                title="Transfer configuration to Manifest & YAML Editor"
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
                <span>Create Service</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
