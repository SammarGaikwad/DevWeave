import React, { useState } from 'react';
import { Network, Globe, Shield, FileCode, Trash2, ShieldAlert, Plus } from 'lucide-react';
import type {
  K8sServiceSummary,
  K8sIngressSummary,
  K8sNetworkPolicySummary,
  K8sDeploymentSummary,
} from '../../services/kubernetesService';
import { K8sYamlModal } from './K8sYamlModal';
import { K8sConfirmModal } from './K8sConfirmModal';
import { K8sCreateServiceModal } from './K8sCreateServiceModal';
import { K8sCreateIngressModal } from './K8sCreateIngressModal';

interface K8sNetworkingManagerProps {
  services: K8sServiceSummary[];
  ingresses: K8sIngressSummary[];
  networkPolicies: K8sNetworkPolicySummary[];
  selectedNamespace: string;
  searchTerm: string;
  onDelete: (kind: string, name: string, namespace: string) => Promise<void>;
  onRefresh: () => void;
  onNavigateToEditor?: (blueprintId?: string, initialYaml?: string) => void;
  namespaces?: string[];
  deployments?: K8sDeploymentSummary[];
}

export const K8sNetworkingManager: React.FC<K8sNetworkingManagerProps> = ({
  services,
  ingresses,
  networkPolicies,
  selectedNamespace,
  searchTerm,
  onDelete,
  onRefresh,
  onNavigateToEditor,
  namespaces = ['default'],
  deployments = [],
}) => {
  const [subTab, setSubTab] = useState<'services' | 'ingresses' | 'networkpolicies'>('services');
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState<boolean>(false);
  const [isCreateIngressOpen, setIsCreateIngressOpen] = useState<boolean>(false);

  const [yamlModal, setYamlModal] = useState<{
    isOpen: boolean;
    kind: string;
    name: string;
    namespace: string;
  }>({ isOpen: false, kind: '', name: '', namespace: 'default' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    isDestructive: boolean;
    isProtected: boolean;
    errorMessage?: string | null;
    target: { kind: string; name: string; namespace: string };
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    isDestructive: false,
    isProtected: false,
    errorMessage: null,
    target: { kind: '', name: '', namespace: 'default' },
  });

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const filterByNsAndSearch = <T extends { name: string; namespace: string }>(items: T[]): T[] => {
    return items.filter((item) => {
      const matchNs = selectedNamespace === 'ALL' || item.namespace === selectedNamespace;
      const matchSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namespace.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNs && matchSearch;
    });
  };

  const filteredServices = filterByNsAndSearch(services);
  const filteredIngresses = filterByNsAndSearch(ingresses);
  const filteredNetworkPolicies = filterByNsAndSearch(networkPolicies);

  const handleConfirmDelete = async () => {
    const { kind, name, namespace } = confirmModal.target;
    setActionLoading(true);
    setConfirmModal((prev) => ({ ...prev, errorMessage: null }));
    try {
      await onDelete(kind, name, namespace);
      setConfirmModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Delete operation failed.';
      setConfirmModal((prev) => ({ ...prev, errorMessage: msg }));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('services')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'services'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Services ({filteredServices.length})
          </button>
          <button
            onClick={() => setSubTab('ingresses')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'ingresses'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Ingresses ({filteredIngresses.length})
          </button>
          <button
            onClick={() => setSubTab('networkpolicies')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'networkpolicies'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Network Policies ({filteredNetworkPolicies.length})
          </button>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {subTab === 'services' && (
            <button
              onClick={() => setIsCreateServiceOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create Service</span>
            </button>
          )}
          {subTab === 'ingresses' && (
            <button
              onClick={() => setIsCreateIngressOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create Ingress</span>
            </button>
          )}
          {subTab === 'networkpolicies' && onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor('networkpolicy')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create Policy (YAML)</span>
            </button>
          )}
          {onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor(subTab === 'services' ? 'service' : subTab === 'ingresses' ? 'ingress' : 'networkpolicy')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition flex items-center space-x-1.5"
              title="Open Manifest & YAML Editor"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-400" />
              <span>YAML Blueprint</span>
            </button>
          )}
        </div>
      </div>

      {/* Services Table */}
      {subTab === 'services' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Service Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Cluster IP</th>
                <th className="px-4 py-3">Ports</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    <div className="max-w-sm mx-auto space-y-3">
                      <p>No Services found in the selected namespace.</p>
                      <button
                        onClick={() => setIsCreateServiceOpen(true)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-700/50 hover:bg-indigo-900/80 rounded-xl transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Service</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const isProtected = svc.isProtected;
                  return (
                    <tr key={`${svc.namespace}/${svc.name}`} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                        <Network className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{svc.name}</span>
                        {isProtected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Core
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-indigo-300">{svc.namespace}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {svc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{svc.clusterIP}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {svc.ports.map((p) => `${p.port}${p.targetPort ? `:${p.targetPort}` : ''}/${p.protocol}`).join(', ') || 'none'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-sans">{svc.age}</td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() =>
                              setYamlModal({
                                isOpen: true,
                                kind: 'Service',
                                name: svc.name,
                                namespace: svc.namespace,
                              })
                            }
                            title="View / Edit YAML"
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                title: `Delete Service`,
                                description: `Are you sure you want to delete service "${svc.name}" in namespace "${svc.namespace}"? Any workloads routing through this service endpoint will lose connectivity.`,
                                actionLabel: 'Delete Service',
                                isDestructive: true,
                                isProtected: !!isProtected,
                                target: { kind: 'Service', name: svc.name, namespace: svc.namespace },
                              })
                            }
                            title="Delete Service"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ingresses Table */}
      {subTab === 'ingresses' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Ingress Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Hosts</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Ports</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredIngresses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No Ingress controllers or rules found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredIngresses.map((ing) => (
                  <tr key={`${ing.namespace}/${ing.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                      <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{ing.name}</span>
                    </td>
                    <td className="px-4 py-3 text-indigo-300">{ing.namespace}</td>
                    <td className="px-4 py-3 text-indigo-400 text-xs">{ing.hosts.join(', ')}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{ing.address || 'pending'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{ing.ports || '80, 443'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{ing.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'Ingress',
                              name: ing.name,
                              namespace: ing.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete Ingress`,
                              description: `Are you sure you want to delete ingress rule "${ing.name}" in namespace "${ing.namespace}"? External HTTP/HTTPS routing to backend services will stop.`,
                              actionLabel: 'Delete Ingress',
                              isDestructive: true,
                              isProtected: false,
                              target: { kind: 'Ingress', name: ing.name, namespace: ing.namespace },
                            })
                          }
                          title="Delete Ingress"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Network Policies Table */}
      {subTab === 'networkpolicies' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Policy Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Pod Selector</th>
                <th className="px-4 py-3">Policy Types</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredNetworkPolicies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No NetworkPolicies found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredNetworkPolicies.map((np) => (
                  <tr key={`${np.namespace}/${np.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                      <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{np.name}</span>
                    </td>
                    <td className="px-4 py-3 text-indigo-300">{np.namespace}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{np.podSelector}</td>
                    <td className="px-4 py-3 text-indigo-400 text-xs">{np.policyTypes.join(', ')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{np.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'NetworkPolicy',
                              name: np.name,
                              namespace: np.namespace,
                            })
                          }
                          title="View / Edit YAML"
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              title: `Delete NetworkPolicy`,
                              description: `Delete network policy "${np.name}" in namespace "${np.namespace}"?`,
                              actionLabel: 'Delete Policy',
                              isDestructive: true,
                              isProtected: false,
                              target: { kind: 'NetworkPolicy', name: np.name, namespace: np.namespace },
                            })
                          }
                          title="Delete NetworkPolicy"
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <K8sYamlModal
        isOpen={yamlModal.isOpen}
        kind={yamlModal.kind}
        name={yamlModal.name}
        namespace={yamlModal.namespace}
        onClose={() => setYamlModal((prev) => ({ ...prev, isOpen: false }))}
        onApplySuccess={onRefresh}
      />

      <K8sConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        actionLabel={confirmModal.actionLabel}
        isDestructive={confirmModal.isDestructive}
        isProtected={confirmModal.isProtected}
        errorMessage={confirmModal.errorMessage}
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }))}
      />

      <K8sCreateServiceModal
        isOpen={isCreateServiceOpen}
        onClose={() => setIsCreateServiceOpen(false)}
        onSuccess={() => {
          onRefresh();
        }}
        initialNamespace={selectedNamespace}
        namespaces={namespaces}
        deployments={deployments}
        onOpenYamlEditor={(yaml) => {
          if (onNavigateToEditor) {
            onNavigateToEditor('service', yaml);
          }
        }}
      />

      <K8sCreateIngressModal
        isOpen={isCreateIngressOpen}
        onClose={() => setIsCreateIngressOpen(false)}
        onSuccess={() => {
          onRefresh();
        }}
        namespaces={namespaces}
        services={services}
        onOpenYamlEditor={(yaml) => {
          if (onNavigateToEditor) {
            onNavigateToEditor('ingress', yaml);
          }
        }}
      />
    </div>
  );
};
