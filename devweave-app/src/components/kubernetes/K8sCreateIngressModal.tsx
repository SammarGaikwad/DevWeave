import React, { useState, useEffect } from 'react';
import { Globe, X, Loader2, AlertCircle, CheckCircle2, FileCode } from 'lucide-react';
import { kubernetesService } from '../../services/kubernetesService';
import type { K8sServiceSummary } from '../../services/kubernetesService';

interface K8sCreateIngressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  initialNamespace?: string;
  namespaces?: string[];
  services?: K8sServiceSummary[];
  onOpenYamlEditor?: (generatedYaml: string) => void;
}

export const K8sCreateIngressModal: React.FC<K8sCreateIngressModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialNamespace = 'default',
  namespaces = ['default'],
  services = [],
  onOpenYamlEditor,
}) => {
  const [name, setName] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('default');
  const [ingressClassName, setIngressClassName] = useState<string>('nginx');
  const [host, setHost] = useState<string>('');
  const [path, setPath] = useState<string>('/');
  const [serviceName, setServiceName] = useState<string>('');
  const [servicePort, setServicePort] = useState<number>(80);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const relevantServices = services.filter((s) => s.namespace === namespace);

  useEffect(() => {
    if (isOpen) {
      const activeNs = initialNamespace && initialNamespace !== 'ALL' ? initialNamespace : 'default';
      setNamespace(activeNs);
      if (relevantServices.length > 0 && !serviceName) {
        setServiceName(relevantServices[0].name);
        if (relevantServices[0].ports.length > 0) {
          setServicePort(relevantServices[0].ports[0].port);
        }
      }
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialNamespace, relevantServices, serviceName]);

  if (!isOpen) return null;

  const handleServiceSelect = (svcName: string) => {
    setServiceName(svcName);
    const target = relevantServices.find((s) => s.name === svcName);
    if (target && target.ports.length > 0) {
      setServicePort(target.ports[0].port);
    }
  };

  const buildManifestYaml = (): string => {
    const cleanName = name.trim().toLowerCase() || 'my-ingress';
    const cleanNs = namespace.trim().toLowerCase() || 'default';
    const cleanHost = host.trim() || 'app.example.com';
    const cleanPath = path.trim() || '/';
    const cleanSvc = serviceName.trim() || 'my-service';

    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${cleanName}
  namespace: ${cleanNs}
  labels:
    app.kubernetes.io/managed-by: devweave
spec:
  ingressClassName: ${ingressClassName}
  rules:
    - host: ${cleanHost}
      http:
        paths:
          - path: ${cleanPath}
            pathType: Prefix
            backend:
              service:
                name: ${cleanSvc}
                port:
                  number: ${servicePort}
`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim().toLowerCase();
    const cleanNs = namespace.trim().toLowerCase();
    const cleanHost = host.trim().toLowerCase();
    const cleanSvc = serviceName.trim();

    const dnsRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!cleanName || !dnsRegex.test(cleanName) || cleanName.length < 2 || cleanName.length > 63) {
      setError('Ingress name must consist of lower case alphanumeric characters or "-", start and end with an alphanumeric character (2-63 characters).');
      return;
    }

    if (!cleanHost) {
      setError('Host domain or subdomain is required (e.g. app.local or myapi.internal).');
      return;
    }

    if (!cleanSvc) {
      setError('Target backend Service is required.');
      return;
    }

    if (servicePort < 1 || servicePort > 65535) {
      setError('Service port must be between 1 and 65535.');
      return;
    }

    setLoading(true);
    try {
      await kubernetesService.createIngress({
        name: cleanName,
        namespace: cleanNs,
        ingressClassName,
        host: cleanHost,
        path: path.trim() || '/',
        serviceName: cleanSvc,
        servicePort,
      });

      setSuccessMsg(`Ingress "${cleanName}" created successfully!`);
      setTimeout(() => {
        onSuccess(cleanName);
        onClose();
      }, 700);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create Ingress.';
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
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create Ingress Route</h3>
              <p className="text-xs text-slate-400">Route HTTP/HTTPS traffic to internal cluster services</p>
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
              <label className="text-xs font-medium text-slate-300">Ingress Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setError(null);
                }}
                placeholder="e.g. app-gateway, api-ingress"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-slate-300">Host Domain / FQDN *</label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. myapp.domain.com or api.local"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Ingress Class</label>
              <input
                type="text"
                value={ingressClassName}
                onChange={(e) => setIngressClassName(e.target.value)}
                placeholder="nginx"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Path Prefix</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Target Service *</label>
              {relevantServices.length > 0 ? (
                <select
                  value={serviceName}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                >
                  {relevantServices.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. devweave-service-svc"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Service Port *</label>
              <input
                type="number"
                min="1"
                max="65535"
                required
                value={servicePort}
                onChange={(e) => setServicePort(parseInt(e.target.value, 10) || 80)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
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
                <span>Create Ingress</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
