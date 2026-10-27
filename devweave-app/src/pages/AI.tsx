import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wrench,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  Info,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import {
  aiService,
  type AIProviderStatus,
  type DiagnosticResult,
  type DiagnosticFix,
} from '../services/aiService';

interface Scenario {
  id: string;
  name: string;
  category: 'CI/CD & Tests' | 'Kubernetes & Pods' | 'Docker & Containers' | 'Config & Network';
  description: string;
  log: string;
}

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: 'vitest-not-found',
    name: 'Vitest CI Not Found',
    category: 'CI/CD & Tests',
    description: 'Missing devDependencies in automated test stage',
    log: `[Install Dependencies] Installing backend dependencies...
[Run Tests, If Configured] Running automated tests...
sh: 1: vitest: not found
[Build Backend] Stage skipped due to earlier failure`,
  },
  {
    id: 'ts-compiler-error',
    name: 'TypeScript Compiler Error',
    category: 'CI/CD & Tests',
    description: 'Static type checking failure in component props',
    log: `src/pages/Dashboard.tsx(42,5): error TS2322: Type 'number' is not assignable to type 'string'.
src/services/apiClient.ts(18,3): error TS6133: 'unusedToken' is declared but its value is never read.`,
  },
  {
    id: 'k8s-crashloop',
    name: 'Pod CrashLoopBackOff',
    category: 'Kubernetes & Pods',
    description: 'Container crashed immediately or killed by OOM (exit code 137)',
    log: `Events:
  Type     Reason     Age                From               Message
  Warning  BackOff    2m (x5 over 4m)    kubelet            Back-off restarting failed container web-app in pod devweave-workload-7d9f784b8c-x9k2p (exit code 137)
  Warning  Unhealthy  1m (x3 over 3m)    kubelet            Liveness probe failed: HTTP probe failed with statuscode: 500`,
  },
  {
    id: 'k8s-image-pull',
    name: 'Kubernetes ImagePullBackOff',
    category: 'Kubernetes & Pods',
    description: 'Non-existent tag or missing private registry credentials',
    log: `Events:
  Type     Reason     Age                From               Message
  Normal   BackOff    45s                kubelet            Back-off pulling image "sammar/devweave-backend:v2.1.0-rc"
  Warning  Failed     32s (x2 over 78s)  kubelet            Failed to pull image "sammar/devweave-backend:v2.1.0-rc": rpc error: code = NotFound desc = failed to pull and unpack image: manifest unknown`,
  },
  {
    id: 'docker-daemon-offline',
    name: 'Docker Daemon Offline',
    category: 'Docker & Containers',
    description: 'Docker CLI cannot communicate with engine socket',
    log: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
Failed to build container image: exit status 1`,
  },
  {
    id: 'docker-build-fail',
    name: 'Docker BuildKit Failure',
    category: 'Docker & Containers',
    description: 'Build step compilation error during multi-stage Docker build',
    log: `#12 [build 4/5] RUN npm run build
#12 4.120 > devweave-backend@1.0.0 build
#12 4.120 > tsc
#12 6.840 src/controllers/kubernetesController.ts(12,8): error TS2307: Cannot find module '../services/newService' or its corresponding type declarations.
#12 ERROR: failed to solve with frontend dockerfile.v0: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1`,
  },
  {
    id: 'health-check-failed',
    name: 'Health Check / Probe Failure',
    category: 'Docker & Containers',
    description: 'Liveness probe timeout or 500 internal server error',
    log: `Container devweave-api is unhealthy:
Health check failed: HTTP probe to http://localhost:8080/api/health returned statuscode 500
Response: {"success":false,"message":"Database pool connection timeout after 5000ms"}`,
  },
  {
    id: 'network-econnrefused',
    name: 'Network Connection Refused',
    category: 'Config & Network',
    description: 'Target daemon or runner unreachable on port',
    log: `Error: connect ECONNREFUSED 98.70.58.149:8080
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1607:16)
    at Module.checkJenkinsReachability (/app/services/jenkinsService.ts:310:11)`,
  },
  {
    id: 'missing-env-vars',
    name: 'Missing Environment Variables',
    category: 'Config & Network',
    description: 'Zod configuration schema failed during startup',
    log: `❌ Invalid environment variables configuration:
{
  "DATABASE_URL": {
    "_errors": [
      "DATABASE_URL environment variable is required"
    ]
  }
}
Error: Environment configuration validation failed. Process exiting.
    at Object.<anonymous> (/app/dist/config/env.js:51:9)`,
  },
  {
    id: 'jenkins-pipeline-abort',
    name: 'Jenkins Pipeline Abort',
    category: 'CI/CD & Tests',
    description: 'Declarative pipeline script returned exit code 1',
    log: `[Pipeline] sh
+ npm test
sh: 1: vitest: not found
[Pipeline] }
[Pipeline] // stage
[Pipeline] }
ERROR: script returned exit code 1
hudson.AbortException: script returned exit code 1
    at org.jenkinsci.plugins.workflow.steps.durable_task.DurableTaskStep$Execution.handleExit(DurableTaskStep.java:669)
Finished: FAILURE`,
  },
  {
    id: 'npm-eresolve',
    name: 'npm Dependency Conflict (ERESOLVE)',
    category: 'CI/CD & Tests',
    description: 'Strict peer dependency resolution failure during npm ci',
    log: `npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: @types/react@19.2.17
npm ERR! Found: react@18.3.1
npm ERR! Conflicting peer dependency: react@19.2.8
npm ERR! Fix the upstream dependency conflict, or retry this command with --legacy-peer-deps`,
  },
];

const MAX_LOG_LENGTH = 50000;

export const AI: React.FC = () => {
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<boolean>(false);

  const [selectedScenarioCategory, setSelectedScenarioCategory] = useState<string>('All');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SAMPLE_SCENARIOS[0].id);
  const [logInput, setLogInput] = useState<string>(SAMPLE_SCENARIOS[0].log);

  const [diagnosis, setDiagnosis] = useState<DiagnosticResult | null>(null);
  const [diagnosing, setDiagnosing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<boolean>(true);

  // Fetch true provider status from backend
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(false);
    try {
      const data = await aiService.getStatus();
      setProviderStatus(data);
    } catch {
      setStatusError(true);
      setProviderStatus({
        provider: 'DETERMINISTIC_RULES',
        modelName: 'DevWeave Static Diagnostic Engine v1.0',
        isLLMConfigured: false,
        attributionNotice:
          'Running on built-in deterministic heuristic rule engine. No external LLM API key is configured.',
        supportedSignatures: [
          'Vitest devDependencies CI omission',
          'TypeScript compiler errors',
          'Network connection timeouts',
          'Docker daemon offline socket errors',
          'Kubernetes CrashLoopBackOff & exit code 137',
          'Kubernetes ImagePullBackOff / ErrImagePull',
          'Docker image build & BuildKit failures',
          'Container health check & probe failures',
        ],
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const runDiagnosis = useCallback(async (textToDiagnose: string) => {
    const trimmed = textToDiagnose.trim();
    if (!trimmed) {
      setValidationError('Please paste build stdout/stderr or select an example scenario.');
      return;
    }
    setValidationError(null);
    setDiagnosing(true);

    try {
      const res = await aiService.diagnoseLog(trimmed);
      setDiagnosis(res);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || err?.message || 'Diagnosis execution failed.';
      setValidationError(errorMsg);
    } finally {
      setDiagnosing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void runDiagnosis(SAMPLE_SCENARIOS[0].log);
  }, [fetchStatus, runDiagnosis]);

  const handleCopy = async (text: string, key: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.warn('Clipboard write failed', err);
    }
  };

  const handleCopyAllRemediation = async () => {
    if (!diagnosis) return;
    const markdownReport = `# DevWeave Diagnostic Report: ${diagnosis.title}
Severity: ${diagnosis.severity} | Category: ${diagnosis.category}
Signature ID: ${diagnosis.signature}

## Root Cause Analysis
${diagnosis.rootCause}

${diagnosis.pinpointedLogSnippet ? `## Isolated Failing Statement\n\`\`\`\n${diagnosis.pinpointedLogSnippet}\n\`\`\`\n` : ''}
## Recommended Remediation Steps
${diagnosis.recommendedFixes
  .map(
    (fix, idx) =>
      `### Step ${idx + 1}: ${fix.title}\n${fix.description}${
        fix.command ? `\n\`\`\`bash\n${fix.command}\n\`\`\`` : ''
      }${fix.codeSnippet ? `\n\`\`\`\n${fix.codeSnippet}\n\`\`\`` : ''}${
        fix.verification ? `\n*Verification:*\n\`\`\`bash\n${fix.verification}\n\`\`\`` : ''
      }`
  )
  .join('\n\n')}

## Prevention Guideline
${diagnosis.preventionGuideline}
`;
    await handleCopy(markdownReport, 'copy-all');
  };

  const handleSelectScenario = (scenario: Scenario) => {
    setSelectedScenarioId(scenario.id);
    setLogInput(scenario.log);
    setValidationError(null);
    void runDiagnosis(scenario.log);
  };

  const handleClear = () => {
    setLogInput('');
    setDiagnosis(null);
    setSelectedScenarioId('');
    setValidationError(null);
  };

  const filteredScenarios = useMemo(() => {
    if (selectedScenarioCategory === 'All') return SAMPLE_SCENARIOS;
    return SAMPLE_SCENARIOS.filter((s) => s.category === selectedScenarioCategory);
  }, [selectedScenarioCategory]);

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'HIGH':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'MEDIUM':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'LOW':
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getContextBadge = (context?: string) => {
    switch (context) {
      case 'kubernetes':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'docker':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'powershell':
        return 'bg-sky-500/10 text-sky-300 border-sky-500/30';
      case 'config':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'bash':
      default:
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Wrench className="h-7 w-7 text-amber-400 shrink-0" />
              <span>DevOps AI Assistant</span>
            </h1>

            {/* Truthful Engine Status Badge */}
            {statusLoading ? (
              <span className="px-2.5 py-1 text-xs rounded-full bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
                Checking engine status...
              </span>
            ) : providerStatus?.isLLMConfigured ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                <span>
                  AI Provider Connected ({providerStatus.provider} • {providerStatus.modelName})
                </span>
              </span>
            ) : statusError ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>AI Provider Unavailable • Using Deterministic Rules</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Rule-Based Diagnostics Active</span>
              </span>
            )}
          </div>
          <p className="text-sm text-white/60 mt-1.5">
            Diagnose CI/CD failures, understand root causes, and get actionable remediation steps.
          </p>
        </div>
      </div>

      {/* 2. Attribution & Transparency Notice */}
      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1.5 text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold uppercase tracking-wider text-[11px]">
            <Info className="h-4 w-4 shrink-0 text-indigo-400" />
            <span>Diagnostic Engine Transparency</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {providerStatus?.isLLMConfigured ? 'Model: ' + providerStatus.modelName : 'Deterministic Pattern Matching'}
          </span>
        </div>
        <p className="text-white/70 leading-relaxed">
          {providerStatus?.isLLMConfigured ? (
            <>
              External LLM provider <strong className="text-white">{providerStatus.provider}</strong> is active.
              Diagnostic reports combine validated heuristic pattern detection with contextual language reasoning.
            </>
          ) : (
            <>
              <strong>Running built-in rule-based diagnostics. External AI is not configured.</strong> Diagnostic
              results are computed using deterministic heuristics and verified regex patterns across Node.js,
              TypeScript, Vitest, Docker, and Kubernetes error signatures. No external API keys are configured or exposed in frontend code.
            </>
          )}
        </p>
      </div>

      {/* 3. Diagnostic Workspace (Two-Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Scenarios & Input Console */}
        <div className="lg:col-span-5 space-y-5">
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Log Analyzer Workspace</span>
                </h2>
                <span className="text-[11px] text-white/50">
                  Select a test scenario or paste build logs below
                </span>
              </div>
              <button
                type="button"
                onClick={handleClear}
                title="Clear current input and diagnosis"
                className="text-[11px] text-white/50 hover:text-white/90 flex items-center gap-1 transition px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08]"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            {/* Quick-Select Scenarios Header & Filter */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                  Quick-Select Test Scenarios:
                </label>
                <span className="text-[10px] text-amber-400/90 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  Examples
                </span>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                {['All', 'CI/CD & Tests', 'Kubernetes & Pods', 'Docker & Containers', 'Config & Network'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedScenarioCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                      selectedScenarioCategory === cat
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.05] bg-white/[0.02] border border-white/[0.06]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Scenario Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredScenarios.map((scenario) => {
                  const isSelected = selectedScenarioId === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => handleSelectScenario(scenario)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-sm ring-1 ring-indigo-500/30'
                          : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06] text-white/80'
                      }`}
                    >
                      <span className="text-xs font-semibold leading-tight">{scenario.name}</span>
                      <span className="text-[10px] text-white/50 line-clamp-1">{scenario.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Console Log Input Textarea */}
            <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                  Raw Console Output / Stderr:
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    logInput.length > MAX_LOG_LENGTH ? 'text-rose-400 font-bold' : 'text-white/40'
                  }`}
                >
                  {logInput.length.toLocaleString()} / {MAX_LOG_LENGTH.toLocaleString()} chars
                </span>
              </div>

              <textarea
                rows={9}
                value={logInput}
                onChange={(e) => {
                  setLogInput(e.target.value);
                  setValidationError(null);
                }}
                disabled={diagnosing}
                placeholder="Paste failure stdout/stderr, stack traces, compiler errors, or container exit logs..."
                className="w-full p-3 rounded-xl bg-black/70 border border-white/[0.1] text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y max-h-96 selection:bg-indigo-600/40"
              />

              {validationError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={() => void runDiagnosis(logInput)}
              disabled={diagnosing || !logInput.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-indigo-600/40 active:scale-[0.99]"
            >
              {diagnosing ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin text-white" />
                  <span>Analyzing Failure Patterns...</span>
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" />
                  <span>Run Failure Diagnosis</span>
                </>
              )}
            </button>
          </GlassCard>

          {/* Supported Failure Signatures Info Card */}
          <GlassCard className="p-4 space-y-2.5">
            <span className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Recognized Failure Signatures ({providerStatus?.supportedSignatures?.length || 12})</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-white/70">
              {(
                providerStatus?.supportedSignatures || [
                  'Vitest devDependencies CI omission',
                  'TypeScript compilation errors (TSxxxx)',
                  'Network connection timeouts & ECONNREFUSED',
                  'Docker daemon offline socket errors',
                  'Kubernetes CrashLoopBackOff & exit code 137',
                  'Kubernetes ImagePullBackOff / ErrImagePull',
                  'Docker image build & BuildKit failures',
                  'Container health check & probe failures',
                  'Jenkins pipeline stage termination',
                  'Missing required environment variables',
                  'npm peer dependency conflict (ERESOLVE)',
                  'Process heap memory exhaustion (OOM)',
                ]
              ).map((sig, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="truncate" title={sig}>
                    {sig}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Structured Diagnostic Report */}
        <div className="lg:col-span-7 space-y-5">
          {diagnosing ? (
            <GlassCard className="p-12 flex flex-col items-center justify-center space-y-3 text-center border-indigo-500/20">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="font-semibold text-sm text-white">Analyzing Failure Signatures...</div>
              <p className="text-xs text-white/50 max-w-sm">
                Parsing stack traces, extracting compiler line numbers, and matching against DevOps remediation patterns.
              </p>
            </GlassCard>
          ) : diagnosis ? (
            <GlassCard className="p-5 sm:p-6 space-y-5">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(
                        diagnosis.severity
                      )}`}
                    >
                      {diagnosis.severity}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-white/80 font-mono border border-white/[0.08]">
                      {diagnosis.category}
                    </span>
                    {diagnosis.confidenceScore && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {Math.round(diagnosis.confidenceScore * 100)}% Match
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">{diagnosis.title}</h3>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={handleCopyAllRemediation}
                    className="px-2.5 py-1.5 text-xs bg-white/[0.05] hover:bg-white/[0.1] text-white/90 border border-white/[0.08] rounded-lg transition flex items-center space-x-1.5"
                    title="Copy full remediation report in markdown"
                  >
                    {copiedKey === 'copy-all' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'copy-all' ? 'Copied Report' : 'Copy All Steps'}</span>
                  </button>
                  <button
                    onClick={() => runDiagnosis(logInput)}
                    className="p-1.5 text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg transition"
                    title="Re-run diagnosis"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Isolated Failing Statement */}
              {diagnosis.pinpointedLogSnippet && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Isolated Failing Statement / Trace:
                  </span>
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xs font-mono text-rose-200 break-all select-all leading-relaxed">
                    {diagnosis.pinpointedLogSnippet}
                  </div>
                </div>
              )}

              {/* Root Cause Analysis */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Root Cause Analysis:
                  </span>
                  <button
                    onClick={() => setExpandedAnalysis((prev) => !prev)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    {expandedAnalysis ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                {expandedAnalysis && (
                  <p className="text-xs text-white/80 leading-relaxed bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06]">
                    {diagnosis.rootCause}
                  </p>
                )}
              </div>

              {/* Targeted Remediation Steps */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Targeted Remediation Steps ({diagnosis.recommendedFixes.length}):
                  </span>
                  <span className="text-[11px] font-mono text-white/40">ID: {diagnosis.signature}</span>
                </div>

                <div className="space-y-3">
                  {diagnosis.recommendedFixes.map((fix: DiagnosticFix, idx: number) => {
                    const cmdKey = `cmd-${idx}`;
                    const snipKey = `snip-${idx}`;
                    const verifKey = `verif-${idx}`;

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 transition hover:border-white/[0.1]"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>
                              Step {idx + 1}: {fix.title}
                            </span>
                          </h4>
                          {fix.context && (
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${getContextBadge(
                                fix.context
                              )}`}
                            >
                              {fix.context}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-white/70 leading-relaxed">{fix.description}</p>

                        {/* Direct Executable Command */}
                        {fix.command && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                              Action Command:
                            </span>
                            <div className="flex items-center justify-between bg-black/70 px-3 py-2 rounded-lg border border-white/[0.08] font-mono text-xs text-emerald-300">
                              <code className="select-all break-all">{fix.command}</code>
                              <button
                                onClick={() => handleCopy(fix.command!, cmdKey)}
                                className="text-white/40 hover:text-white ml-2 shrink-0 p-1 rounded hover:bg-white/[0.06] transition flex items-center space-x-1"
                                title="Copy command"
                              >
                                {copiedKey === cmdKey ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                <span className="text-[10px]">{copiedKey === cmdKey ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Code or Manifest Snippet */}
                        {fix.codeSnippet && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                              Configuration Snippet:
                            </span>
                            <div className="relative">
                              <pre className="bg-black/70 p-3 rounded-lg border border-white/[0.08] font-mono text-[11px] text-zinc-300 overflow-x-auto select-all leading-relaxed">
                                <code>{fix.codeSnippet}</code>
                              </pre>
                              <button
                                onClick={() => handleCopy(fix.codeSnippet!, snipKey)}
                                className="absolute top-2 right-2 text-white/40 hover:text-white p-1 rounded bg-black/60 border border-white/[0.08] flex items-center space-x-1"
                                title="Copy code snippet"
                              >
                                {copiedKey === snipKey ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                <span className="text-[10px]">{copiedKey === snipKey ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Verification Command */}
                        {fix.verification && (
                          <div className="pt-1 flex items-center justify-between text-[11px] text-white/50 bg-black/40 px-3 py-1.5 rounded-lg border border-white/[0.04]">
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-indigo-400">Verification:</span>
                              <code className="font-mono text-zinc-300 select-all truncate">{fix.verification}</code>
                            </span>
                            <button
                              onClick={() => handleCopy(fix.verification!, verifKey)}
                              className="text-white/40 hover:text-white ml-2 shrink-0"
                              title="Copy verification command"
                            >
                              {copiedKey === verifKey ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Architectural Prevention Guideline */}
              {diagnosis.preventionGuideline && (
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-1.5">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Architectural Prevention Guideline:
                  </span>
                  <p className="text-xs text-white/70 leading-relaxed">{diagnosis.preventionGuideline}</p>
                </div>
              )}

              {/* Report Footer / Transparency */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/40">
                <span>
                  Engine: <code className="text-white/60">{diagnosis.engineType}</code>
                </span>
                <span>Attribution: {diagnosis.isAIGenerated ? 'Generative Model' : 'Deterministic Pattern Rule'}</span>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-12 text-center text-white/40 space-y-4 border-dashed border-white/[0.08]">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-white/40">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white/80">Diagnostic Engine Ready</h3>
                <p className="text-xs text-white/50 max-w-md mx-auto">
                  Paste console stderr from a failed pipeline, test runner, Docker build, or Kubernetes event, then
                  click <strong>Run Failure Diagnosis</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSelectScenario(SAMPLE_SCENARIOS[0])}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-white/80 border border-white/[0.08] transition inline-flex items-center space-x-1.5"
              >
                <span>Load Sample Vitest Scenario</span>
              </button>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
};
