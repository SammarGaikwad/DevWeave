import React, { useState } from 'react';
import {
  FileText,
  Key,
  HardDrive,
  Database,
  FileCode,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  kubernetesService,
  type K8sConfigMapSummary,
  type K8sSecretSummary,
  type K8sPvcSummary,
  type K8sPvSummary,
  type K8sStorageClassSummary,
  type K8sServiceAccountSummary,
} from '../../services/kubernetesService';
import { K8sYamlModal } from './K8sYamlModal';
import { K8sConfirmModal } from './K8sConfirmModal';
import { K8sCreateConfigMapModal } from './K8sCreateConfigMapModal';
import { K8sCreateSecretModal } from './K8sCreateSecretModal';
import { K8sCreatePvcModal } from './K8sCreatePvcModal';

interface K8sConfigStorageManagerProps {
  configMaps: K8sConfigMapSummary[];
  secrets: K8sSecretSummary[];
  pvcs: K8sPvcSummary[];
  pvs: K8sPvSummary[];
  storageClasses: K8sStorageClassSummary[];
  serviceAccounts: K8sServiceAccountSummary[];
  selectedNamespace: string;
  searchTerm: string;
  onDelete: (kind: string, name: string, namespace: string) => Promise<void>;
  onRefresh: () => void;
  onNavigateToEditor?: (blueprintId?: string, initialYaml?: string) => void;
  namespaces?: string[];
}

export const K8sConfigStorageManager: React.FC<K8sConfigStorageManagerProps> = ({
  configMaps,
  secrets,
  pvcs,
  pvs,
  storageClasses,
  serviceAccounts,
  selectedNamespace,
  searchTerm,
  onDelete,
  onRefresh,
  onNavigateToEditor,
  namespaces = ['default'],
}) => {
  const [subTab, setSubTab] = useState<
    'configmaps' | 'secrets' | 'pvcs' | 'pvs' | 'storageclasses' | 'serviceaccounts'
  >('configmaps');

  const [isCreateConfigMapOpen, setIsCreateConfigMapOpen] = useState<boolean>(false);
  const [isCreateSecretOpen, setIsCreateSecretOpen] = useState<boolean>(false);
  const [isCreatePvcOpen, setIsCreatePvcOpen] = useState<boolean>(false);

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
    errorMessage?: string | null;
    target: { kind: string; name: string; namespace: string };
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    isDestructive: false,
    errorMessage: null,
    target: { kind: '', name: '', namespace: 'default' },
  });

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Secret reveal state
  const [revealedSecret, setRevealedSecret] = useState<{
    namespace: string;
    name: string;
    key: string;
    value: string;
  } | null>(null);
  const [revealingKey, setRevealingKey] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState<boolean>(false);

  const filterByNsAndSearch = <T extends { name: string; namespace?: string }>(items: T[]): T[] => {
    return items.filter((item) => {
      const matchNs =
        !item.namespace ||
        selectedNamespace === 'ALL' ||
        item.namespace === selectedNamespace;
      const matchSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.namespace && item.namespace.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchNs && matchSearch;
    });
  };

  const filteredConfigMaps = filterByNsAndSearch(configMaps);
  const filteredSecrets = filterByNsAndSearch(secrets);
  const filteredPvcs = filterByNsAndSearch(pvcs);
  const filteredPvs = filterByNsAndSearch(pvs);
  const filteredStorageClasses = filterByNsAndSearch(storageClasses);
  const filteredServiceAccounts = filterByNsAndSearch(serviceAccounts);

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

  const handleRevealSecret = async (namespace: string, name: string, key: string) => {
    const keyId = `${namespace}/${name}/${key}`;
    if (revealedSecret && revealedSecret.name === name && revealedSecret.key === key) {
      setRevealedSecret(null);
      return;
    }

    setRevealingKey(keyId);
    try {
      const res = await kubernetesService.revealSecret(namespace, name, key);
      setRevealedSecret({
        namespace,
        name,
        key,
        value: res.value,
      });
    } catch {
      // reveal failed
    } finally {
      setRevealingKey(null);
    }
  };

  const handleCopySecret = () => {
    if (!revealedSecret?.value) return;
    navigator.clipboard.writeText(revealedSecret.value);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('configmaps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'configmaps'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            ConfigMaps ({filteredConfigMaps.length})
          </button>
          <button
            onClick={() => setSubTab('secrets')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'secrets'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Secrets ({filteredSecrets.length})
          </button>
          <button
            onClick={() => setSubTab('pvcs')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'pvcs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            PVCs ({filteredPvcs.length})
          </button>
          <button
            onClick={() => setSubTab('pvs')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'pvs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            PVs ({filteredPvs.length})
          </button>
          <button
            onClick={() => setSubTab('storageclasses')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'storageclasses'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            StorageClasses ({filteredStorageClasses.length})
          </button>
          <button
            onClick={() => setSubTab('serviceaccounts')}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              subTab === 'serviceaccounts'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            ServiceAccounts ({filteredServiceAccounts.length})
          </button>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {subTab === 'configmaps' && (
            <button
              onClick={() => setIsCreateConfigMapOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create ConfigMap</span>
            </button>
          )}
          {subTab === 'secrets' && (
            <button
              onClick={() => setIsCreateSecretOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create Secret</span>
            </button>
          )}
          {subTab === 'pvcs' && (
            <button
              onClick={() => setIsCreatePvcOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create PVC</span>
            </button>
          )}
          {subTab === 'pvs' && onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor('pv')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create PV (YAML)</span>
            </button>
          )}
          {subTab === 'storageclasses' && onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor('storageclass')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create StorageClass (YAML)</span>
            </button>
          )}
          {subTab === 'serviceaccounts' && onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor('serviceaccount')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create ServiceAccount (YAML)</span>
            </button>
          )}
          {onNavigateToEditor && (
            <button
              onClick={() => onNavigateToEditor(subTab === 'configmaps' ? 'configmap' : subTab === 'secrets' ? 'secret' : subTab === 'pvcs' ? 'pvc' : subTab === 'pvs' ? 'pv' : 'storageclass')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition flex items-center space-x-1.5"
              title="Open Manifest & YAML Editor"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-400" />
              <span>YAML Blueprint</span>
            </button>
          )}
        </div>
      </div>

      {/* ConfigMaps Table */}
      {subTab === 'configmaps' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">ConfigMap Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Data Entries</th>
                <th className="px-4 py-3">Keys</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredConfigMaps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No ConfigMaps found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredConfigMaps.map((cm) => (
                  <tr key={`${cm.namespace}/${cm.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{cm.name}</span>
                    </td>
                    <td className="px-4 py-3 text-indigo-300">{cm.namespace}</td>
                    <td className="px-4 py-3 text-slate-300">{cm.dataCount}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-xs">{cm.keys.join(', ') || 'none'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{cm.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'ConfigMap',
                              name: cm.name,
                              namespace: cm.namespace,
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
                              title: `Delete ConfigMap`,
                              description: `Delete ConfigMap "${cm.name}" in namespace "${cm.namespace}"?`,
                              actionLabel: 'Delete ConfigMap',
                              isDestructive: true,
                              target: { kind: 'ConfigMap', name: cm.name, namespace: cm.namespace },
                            })
                          }
                          title="Delete ConfigMap"
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

      {/* Secrets Table with Safe Masked Display */}
      {subTab === 'secrets' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Secret Name</th>
                  <th className="px-4 py-3">Namespace</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Keys (Values Masked)</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredSecrets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                      No Secrets found in the selected namespace.
                    </td>
                  </tr>
                ) : (
                  filteredSecrets.map((sec) => (
                    <tr key={`${sec.namespace}/${sec.name}`} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                        <Key className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{sec.name}</span>
                      </td>
                      <td className="px-4 py-3 text-indigo-300">{sec.namespace}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{sec.type}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {sec.keys.map((k) => {
                            const isRevealing = revealingKey === `${sec.namespace}/${sec.name}/${k}`;
                            const isRevealed =
                              revealedSecret &&
                              revealedSecret.name === sec.name &&
                              revealedSecret.namespace === sec.namespace &&
                              revealedSecret.key === k;
                            return (
                              <button
                                key={k}
                                onClick={() => handleRevealSecret(sec.namespace, sec.name, k)}
                                title={isRevealed ? 'Hide secret value' : 'Click to securely reveal value'}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono border flex items-center space-x-1 transition ${
                                  isRevealed
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-amber-500/40'
                                }`}
                              >
                                {isRevealing ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                ) : isRevealed ? (
                                  <EyeOff className="w-3 h-3 text-amber-400" />
                                ) : (
                                  <Eye className="w-3 h-3 text-slate-400" />
                                )}
                                <span>{k}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-sans">{sec.age}</td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() =>
                              setYamlModal({
                                isOpen: true,
                                kind: 'Secret',
                                name: sec.name,
                                namespace: sec.namespace,
                              })
                            }
                            title="Inspect YAML (Values Masked)"
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                title: `Delete Secret`,
                                description: `Are you sure you want to delete secret "${sec.name}" in namespace "${sec.namespace}"? Any pods referencing this secret will fail to mount credentials.`,
                                actionLabel: 'Delete Secret',
                                isDestructive: true,
                                target: { kind: 'Secret', name: sec.name, namespace: sec.namespace },
                              })
                            }
                            title="Delete Secret"
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

          {/* Secure Revealed Secret Banner */}
          {revealedSecret && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between text-xs space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-amber-200">
                    Revealed Key [{revealedSecret.namespace}/{revealedSecret.name} &gt; {revealedSecret.key}]:
                  </span>
                  <div className="font-mono text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800 mt-1 select-all break-all">
                    {revealedSecret.value}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopySecret}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
                >
                  {secretCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{secretCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setRevealedSecret(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                >
                  Hide
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PVCs Table */}
      {subTab === 'pvcs' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Claim Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">StorageClass</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredPvcs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No PersistentVolumeClaims found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredPvcs.map((pvc) => (
                  <tr key={`${pvc.namespace}/${pvc.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                      <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{pvc.name}</span>
                    </td>
                    <td className="px-4 py-3 text-indigo-300">{pvc.namespace}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          pvc.status === 'Bound'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {pvc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{pvc.volume || 'pending'}</td>
                    <td className="px-4 py-3 text-slate-300">{pvc.capacity || 'n/a'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{pvc.storageClass || 'default'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{pvc.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'PersistentVolumeClaim',
                              name: pvc.name,
                              namespace: pvc.namespace,
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
                              title: `Delete PersistentVolumeClaim`,
                              description: `Delete PVC "${pvc.name}" in namespace "${pvc.namespace}"? Unsaved volume data may be permanently removed depending on the StorageClass reclaim policy.`,
                              actionLabel: 'Delete PVC',
                              isDestructive: true,
                              target: { kind: 'PersistentVolumeClaim', name: pvc.name, namespace: pvc.namespace },
                            })
                          }
                          title="Delete PVC"
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

      {/* PVs Table */}
      {subTab === 'pvs' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Volume Name</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Access Modes</th>
                <th className="px-4 py-3">Reclaim Policy</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredPvs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No cluster-scoped PersistentVolumes found.
                  </td>
                </tr>
              ) : (
                filteredPvs.map((pv) => (
                  <tr key={pv.name} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200 flex items-center space-x-2 font-sans">
                      <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{pv.name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{pv.capacity}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{pv.accessModes.join(', ')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{pv.reclaimPolicy}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {pv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-indigo-300 text-xs">{pv.claim || 'unbound'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{pv.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'PersistentVolume',
                              name: pv.name,
                              namespace: '',
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
                              title: `Delete PersistentVolume`,
                              description: pv.claim
                                ? `⚠️ DANGER: PersistentVolume "${pv.name}" is currently BOUND to claim "${pv.claim}". Deleting it will cause data loss or leave the claim in a Lost state!`
                                : `Delete cluster PersistentVolume "${pv.name}"?`,
                              actionLabel: 'Delete PV',
                              isDestructive: true,
                              target: { kind: 'PersistentVolume', name: pv.name, namespace: '' },
                            })
                          }
                          title="Delete PV"
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

      {/* StorageClasses Table */}
      {subTab === 'storageclasses' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">StorageClass Name</th>
                <th className="px-4 py-3">Provisioner</th>
                <th className="px-4 py-3">Reclaim Policy</th>
                <th className="px-4 py-3">Binding Mode</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredStorageClasses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No StorageClasses configured.
                  </td>
                </tr>
              ) : (
                filteredStorageClasses.map((sc) => (
                  <tr key={sc.name} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{sc.name}</td>
                    <td className="px-4 py-3 text-indigo-400 text-xs">{sc.provisioner}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{sc.reclaimPolicy || 'Delete'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{sc.volumeBindingMode || 'Immediate'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{sc.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        onClick={() =>
                          setYamlModal({
                            isOpen: true,
                            kind: 'StorageClass',
                            name: sc.name,
                            namespace: '',
                          })
                        }
                        title="View / Edit YAML"
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ServiceAccounts Table */}
      {subTab === 'serviceaccounts' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">ServiceAccount Name</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Secrets Attached</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredServiceAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No ServiceAccounts found in the selected namespace.
                  </td>
                </tr>
              ) : (
                filteredServiceAccounts.map((sa) => (
                  <tr key={`${sa.namespace}/${sa.name}`} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-200">{sa.name}</td>
                    <td className="px-4 py-3 text-indigo-300">{sa.namespace}</td>
                    <td className="px-4 py-3 text-slate-300">{sa.secretsCount}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">{sa.age}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() =>
                            setYamlModal({
                              isOpen: true,
                              kind: 'ServiceAccount',
                              name: sa.name,
                              namespace: sa.namespace,
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
                              title: `Delete ServiceAccount`,
                              description: `Delete ServiceAccount "${sa.name}" in namespace "${sa.namespace}"?`,
                              actionLabel: 'Delete SA',
                              isDestructive: true,
                              target: { kind: 'ServiceAccount', name: sa.name, namespace: sa.namespace },
                            })
                          }
                          title="Delete ServiceAccount"
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
        errorMessage={confirmModal.errorMessage}
        isLoading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, errorMessage: null }))}
      />

      <K8sCreateConfigMapModal
        isOpen={isCreateConfigMapOpen}
        onClose={() => setIsCreateConfigMapOpen(false)}
        onSuccess={() => onRefresh()}
        namespaces={namespaces}
        onOpenYamlEditor={(yaml) => onNavigateToEditor && onNavigateToEditor('configmap', yaml)}
      />

      <K8sCreateSecretModal
        isOpen={isCreateSecretOpen}
        onClose={() => setIsCreateSecretOpen(false)}
        onSuccess={() => onRefresh()}
        namespaces={namespaces}
        onOpenYamlEditor={(yaml) => onNavigateToEditor && onNavigateToEditor('secret', yaml)}
      />

      <K8sCreatePvcModal
        isOpen={isCreatePvcOpen}
        onClose={() => setIsCreatePvcOpen(false)}
        onSuccess={() => onRefresh()}
        namespaces={namespaces}
        storageClasses={storageClasses}
        onOpenYamlEditor={(yaml) => onNavigateToEditor && onNavigateToEditor('pvc', yaml)}
      />
    </div>
  );
};
