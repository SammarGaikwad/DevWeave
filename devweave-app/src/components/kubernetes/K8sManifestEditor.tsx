import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Loader2,
  FileCheck,
} from 'lucide-react';
import {
  kubernetesService,
  type K8sManifestTemplateSummary,
  type K8sManifestTemplateDetail,
  type K8sCustomOptions,
  type K8sValidationResult,
} from '../../services/kubernetesService';

interface K8sManifestEditorProps {
  initialBlueprintId?: string;
  initialYaml?: string;
  onApplied?: () => void;
}

export const K8sManifestEditor: React.FC<K8sManifestEditorProps> = ({
  initialBlueprintId,
  initialYaml,
  onApplied,
}) => {
  const [editorMode, setEditorMode] = useState<'editor' | 'templates' | 'generator'>('editor');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialBlueprintId || 'deployment');
  const [yamlContent, setYamlContent] = useState<string>(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-service
  namespace: default
  labels:
    app: demo-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo-service
  template:
    metadata:
      labels:
        app: demo-service
    spec:
      containers:
        - name: web
          image: nginx:alpine
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: demo-service
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: demo-service
  ports:
    - name: http
      port: 80
      targetPort: 80`);

  // Templates
  const [templates, setTemplates] = useState<K8sManifestTemplateSummary[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<K8sManifestTemplateDetail | null>(null);

  useEffect(() => {
    if (initialBlueprintId) {
      setSelectedTemplateId(initialBlueprintId);
      kubernetesService.getTemplateById(initialBlueprintId).then((t) => {
        if (t?.content) {
          setYamlContent(t.content);
        }
      }).catch(() => {});
    }
  }, [initialBlueprintId]);

  useEffect(() => {
    if (initialYaml) {
      setYamlContent(initialYaml);
      setEditorMode('editor');
    }
  }, [initialYaml]);

  // Custom Generator options
  const [customOptions, setCustomOptions] = useState<K8sCustomOptions>({
    serviceName: 'devweave-api',
    namespace: 'default',
    imageTag: 'devweave/api:v1.0.0',
    containerPort: 8080,
    replicas: 3,
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '128Mi',
    memoryLimit: '512Mi',
    enableIngress: true,
    ingressHost: 'api.devweave.internal',
    enableHpa: true,
    minReplicas: 2,
    maxReplicas: 10,
  });
  const [generating, setGenerating] = useState<boolean>(false);

  // Validation State
  const [validation, setValidation] = useState<K8sValidationResult | null>(null);
  const [validating, setValidating] = useState<boolean>(false);

  // Apply State
  const [applying, setApplying] = useState<boolean>(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const list = await kubernetesService.getTemplates();
        setTemplates(list);
      } catch {
        // template load error
      }
    };
    fetchTemplates();
  }, []);

  // Fetch template detail when selected
  useEffect(() => {
    if (!selectedTemplateId) return;
    const fetchDetail = async () => {
      try {
        const t = await kubernetesService.getTemplateById(selectedTemplateId);
        setActiveTemplate(t);
      } catch {
        // error
      }
    };
    fetchDetail();
  }, [selectedTemplateId]);

  // Validate YAML
  const handleValidate = async () => {
    if (!yamlContent.trim()) return;
    setValidating(true);
    setApplyResult(null);
    try {
      const res = await kubernetesService.validateManifest(yamlContent);
      setValidation(res);
    } catch (err: any) {
      setValidation({
        valid: false,
        errors: [err?.message || 'Validation request failed.'],
        parsedDocuments: 0,
      });
    } finally {
      setValidating(false);
    }
  };

  // Generate manifest
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await kubernetesService.generateManifest(customOptions);
      setYamlContent(res.yaml);
      setEditorMode('editor');
      handleValidate();
    } catch {
      // error
    } finally {
      setGenerating(false);
    }
  };

  // Load active template into editor
  const handleLoadTemplate = () => {
    if (!activeTemplate) return;
    setYamlContent(activeTemplate.content);
    setEditorMode('editor');
    handleValidate();
  };

  // Apply to cluster
  const handleApply = async () => {
    if (!yamlContent.trim()) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await kubernetesService.applyManifest(yamlContent);
      setApplyResult({
        success: true,
        message: res.output || 'Kubernetes manifest applied successfully.',
      });
      if (onApplied) onApplied();
    } catch (err: any) {
      setApplyResult({
        success: false,
        message: err?.response?.data?.message || err?.message || 'Failed to apply manifest to cluster.',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Mode navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setEditorMode('editor')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              editorMode === 'editor'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            YAML Editor
          </button>
          <button
            onClick={() => setEditorMode('templates')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              editorMode === 'templates'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Production Templates ({templates.length})
          </button>
          <button
            onClick={() => setEditorMode('generator')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              editorMode === 'generator'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Custom Generator</span>
          </button>
        </div>

        {editorMode === 'editor' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleValidate}
              disabled={validating}
              className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center space-x-1.5 transition"
            >
              {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
              <span>Validate YAML</span>
            </button>
            <button
              onClick={handleCopy}
              title="Copy YAML"
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center space-x-1.5 shadow-lg shadow-indigo-900/30 transition disabled:opacity-50"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Apply to Cluster</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor Tab */}
      {editorMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-xl border border-slate-800/80 bg-slate-950 overflow-hidden shadow-2xl">
              <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">manifest.yaml</span>
                <span className="text-[11px] text-slate-500">Supports multi-document manifests separated by ---</span>
              </div>
              <textarea
                value={yamlContent}
                onChange={(e) => {
                  setYamlContent(e.target.value);
                  setValidation(null);
                  setApplyResult(null);
                }}
                spellCheck={false}
                rows={22}
                className="w-full p-4 font-mono text-xs text-slate-200 bg-transparent resize-none focus:outline-none leading-relaxed"
                placeholder="Paste or write Kubernetes manifests here..."
              />
            </div>
          </div>

          {/* Validation & Preview Panel */}
          <div className="space-y-4">
            {applyResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  applyResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  {applyResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{applyResult.success ? 'Cluster Mutation Succeeded' : 'Cluster Mutation Failed'}</span>
                </div>
                <pre className="font-mono text-[11px] whitespace-pre-wrap break-all bg-black/40 p-2.5 rounded-lg">
                  {applyResult.message}
                </pre>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Validation & Schema
                </h4>
                {validation && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      validation.valid
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {validation.valid ? 'VALID SYNTAX' : 'ERRORS DETECTED'}
                  </span>
                )}
              </div>

              {!validation ? (
                <p className="text-xs text-slate-400">
                  Click &quot;Validate YAML&quot; to parse documents, detect syntax issues, and verify Kubernetes resources.
                </p>
              ) : validation.valid ? (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{validation.parsedDocuments} valid Kubernetes document(s) parsed.</span>
                  </p>
                  {validation.resources && validation.resources.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Detected Resources:
                      </span>
                      <div className="space-y-1 font-mono text-xs">
                        {validation.resources.map((r, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between"
                          >
                            <span className="text-indigo-400">{r.kind}</span>
                            <span className="text-slate-200 font-semibold">{r.name}</span>
                            <span className="text-slate-400 text-[10px]">({r.namespace || 'default'})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-red-400">Syntax / Schema Errors:</span>
                  <ul className="text-xs text-red-300 space-y-1 font-mono">
                    {validation.errors.map((err, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-red-400">•</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {editorMode === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Select Production Blueprint
            </h4>
            <div className="space-y-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                    selectedTemplateId === t.id
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="font-semibold text-slate-200 mb-0.5">{t.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {t.apiVersion} / {t.kind}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {activeTemplate && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{activeTemplate.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{activeTemplate.description}</p>
                  </div>
                  <button
                    onClick={handleLoadTemplate}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-lg shadow-indigo-900/30"
                  >
                    Load into Editor
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Best Practices Included:
                  </span>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {activeTemplate.bestPractices.map((bp, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{bp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    YAML Blueprint:
                  </span>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                    {activeTemplate.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generator Tab */}
      {editorMode === 'generator' && (
        <form onSubmit={handleGenerate} className="max-w-2xl p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-5">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Custom Manifest Generator</h3>
              <p className="text-xs text-slate-400">
                Generate production-grade Deployment, Service, Ingress, and HPA manifests.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Service Name</label>
              <input
                type="text"
                required
                value={customOptions.serviceName}
                onChange={(e) => setCustomOptions({ ...customOptions, serviceName: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Namespace</label>
              <input
                type="text"
                required
                value={customOptions.namespace}
                onChange={(e) => setCustomOptions({ ...customOptions, namespace: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Docker Image Tag</label>
              <input
                type="text"
                required
                value={customOptions.imageTag}
                onChange={(e) => setCustomOptions({ ...customOptions, imageTag: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Container Port</label>
              <input
                type="number"
                min={1}
                max={65535}
                required
                value={customOptions.containerPort}
                onChange={(e) => setCustomOptions({ ...customOptions, containerPort: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">CPU Request</label>
              <input
                type="text"
                value={customOptions.cpuRequest}
                onChange={(e) => setCustomOptions({ ...customOptions, cpuRequest: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">CPU Limit</label>
              <input
                type="text"
                value={customOptions.cpuLimit}
                onChange={(e) => setCustomOptions({ ...customOptions, cpuLimit: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Mem Request</label>
              <input
                type="text"
                value={customOptions.memoryRequest}
                onChange={(e) => setCustomOptions({ ...customOptions, memoryRequest: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Mem Limit</label>
              <input
                type="text"
                value={customOptions.memoryLimit}
                onChange={(e) => setCustomOptions({ ...customOptions, memoryLimit: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6 pt-2">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={customOptions.enableIngress}
                onChange={(e) => setCustomOptions({ ...customOptions, enableIngress: e.target.checked })}
                className="rounded accent-indigo-500"
              />
              <span>Generate Ingress Resource</span>
            </label>
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={customOptions.enableHpa}
                onChange={(e) => setCustomOptions({ ...customOptions, enableHpa: e.target.checked })}
                className="rounded accent-indigo-500"
              />
              <span>Generate HPA Resource</span>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="submit"
              disabled={generating}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-900/30 transition flex items-center space-x-2"
            >
              {generating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Generate Manifests</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
