import React, { useState, useEffect } from 'react';
import { Boxes, X, Loader2, AlertCircle, Plus, Trash2, CheckCircle2, FileCode } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';

interface EnvVar {
  id: string;
  name: string;
  value: string;
}

interface K8sCreateDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deploymentName: string) => void;
  initialNamespace?: string;
  namespaces?: string[];
  onOpenYamlEditor?: (generatedYaml: string) => void;
}

export const K8sCreateDeploymentModal: React.FC<K8sCreateDeploymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNamespace = 'default',
  namespaces = ['default'],
  onOpenYamlEditor,
}) => {
  const [name, setName] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('default');
  const [image, setImage] = useState<string>('nginx:alpine');
  const [replicas, setReplicas] = useState<number>(1);
  const [port, setPort] = useState<number>(80);
  const [cpuRequest, setCpuRequest] = useState<string>('100m');
  const [cpuLimit, setCpuLimit] = useState<string>('500m');
  const [memoryRequest, setMemoryRequest] = useState<string>('128Mi');
  const [memoryLimit, setMemoryLimit] = useState<string>('512Mi');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);

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

  const handleAddEnv = () => {
    setEnvVars((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), name: '', value: '' },
    ]);
  };

  const handleRemoveEnv = (id: string) => {
    setEnvVars((prev) => prev.filter((e) => e.id !== id));
  };

  const handleEnvChange = (id: string, field: 'name' | 'value', val: string) => {
    setEnvVars((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );
  };

  const buildManifestYaml = (): string => {
    const cleanName = name.trim().toLowerCase() || 'my-deployment';
    const cleanNs = namespace.trim().toLowerCase() || 'default';
    const cleanImage = image.trim() || 'nginx:alpine';

    const validEnvs = envVars.filter((e) => e.name.trim());
    const envBlock =
      validEnvs.length > 0
        ? `          env:\n` +
          validEnvs
            .map((e) => `            - name: ${e.name.trim()}\n              value: "${e.value}"`)
            .join('\n')
        : '';

    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${cleanName}
  namespace: ${cleanNs}
  labels:
    app: ${cleanName}
    app.kubernetes.io/name: ${cleanName}
    app.kubernetes.io/managed-by: devweave
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${cleanName}
  template:
    metadata:
      labels:
        app: ${cleanName}
    spec:
      containers:
        - name: app
          image: ${cleanImage}
          ports:
            - containerPort: ${port}
              name: http
          resources:
            requests:
              cpu: ${cpuRequest}
              memory: ${memoryRequest}
            limits:
              cpu: ${cpuLimit}
              memory: ${memoryLimit}
${envBlock}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim().toLowerCase();
    const cleanNs = namespace.trim().toLowerCase();
    const cleanImage = image.trim();

    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!cleanName || !dnsRegex.test(cleanName) || cleanName.length < 2 || cleanName.length > 63) {
      setError('Deployment name must consist of lower case alphanumeric characters or "-", start and end with an alphanumeric character (2-63 characters).');
      return;
    }

    if (!cleanImage) {
      setError('Container image is required (e.g. nginx:alpine or redis:7).');
      return;
    }

    if (replicas < 0 || replicas > 50) {
      setError('Replicas must be between 0 and 50.');
      return;
    }

    if (port < 1 || port > 65535) {
      setError('Port must be between 1 and 65535.');
      return;
    }

    const validEnvs = envVars
      .filter((e) => e.name.trim())
      .map((e) => ({ name: e.name.trim(), value: e.value }));

    setLoading(true);
    try {
      await kubernetesService.createDeployment({
        name: cleanName,
        namespace: cleanNs,
        image: cleanImage,
        replicas,
        port,
        cpuRequest,
        cpuLimit,
        memoryRequest,
        memoryLimit,
        env: validEnvs,
      });

      setSuccessMsg(`Deployment "${cleanName}" created successfully!`);
      setTimeout(() => {
        onSuccess(cleanName);
        onClose();
      }, 700);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create Deployment.';
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
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Deploy Workload</h3>
              <p className="text-xs text-slate-400">Launch a scalable Kubernetes Deployment with container specs and resources</p>
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
              <p className="font-semibold text-red-200">Deployment Failed</p>
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
              <label className="text-xs font-medium text-slate-300">Deployment Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setError(null);
                }}
                placeholder="e.g. web-app, auth-api"
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

          {/* Row 2: Image and Replicas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-slate-300">Container Image *</label>
              <input
                type="text"
                required
                value={image}
                onChange={(e) => {
                  setImage(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. nginx:alpine, redis:7-alpine"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Replicas</label>
              <input
                type="number"
                min="0"
                max="50"
                value={replicas}
                onChange={(e) => setReplicas(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Row 3: Port and Resources */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Container Port</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 80)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">CPU Request</label>
              <input
                type="text"
                value={cpuRequest}
                onChange={(e) => setCpuRequest(e.target.value)}
                placeholder="100m"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">CPU Limit</label>
              <input
                type="text"
                value={cpuLimit}
                onChange={(e) => setCpuLimit(e.target.value)}
                placeholder="500m"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Memory Request</label>
              <input
                type="text"
                value={memoryRequest}
                onChange={(e) => setMemoryRequest(e.target.value)}
                placeholder="128Mi"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Memory Limit</label>
              <input
                type="text"
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
                placeholder="512Mi"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 4: Environment Variables */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Environment Variables</label>
              <button
                type="button"
                onClick={handleAddEnv}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Variable</span>
              </button>
            </div>

            {envVars.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">No environment variables specified.</p>
            ) : (
              <div className="space-y-2">
                {envVars.map((env) => (
                  <div key={env.id} className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="NAME (e.g. NODE_ENV)"
                      value={env.name}
                      onChange={(e) => handleEnvChange(env.id, 'name', e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-500 font-mono text-xs">=</span>
                    <input
                      type="text"
                      placeholder="Value"
                      value={env.value}
                      onChange={(e) => handleEnvChange(env.id, 'value', e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEnv(env.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
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
                title="Transfer manifest to YAML Editor"
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
                <span>Deploy Workload</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
