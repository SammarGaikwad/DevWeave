import React, { useEffect, useState, useCallback } from 'react';
import {
  Wrench,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  Info,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  aiService,
  type AIProviderStatus,
  type DiagnosticResult,
} from '../services/aiService';

const SAMPLE_FAILURES = [
  {
    name: 'Vitest CI Not Found',
    log: `[Install Dependencies] Installing backend dependencies...
[Run Tests, If Configured] Running automated tests...
sh: 1: vitest: not found
[Build Backend] Stage skipped due to earlier failure`,
  },
  {
    name: 'TypeScript Compiler Error',
    log: `src/pages/Dashboard.tsx(42,5): error TS2322: Type 'number' is not assignable to type 'string'.
src/services/apiClient.ts(18,3): error TS6133: 'unusedToken' is declared but its value is never read.`,
  },
  {
    name: 'Network Connection Refused',
    log: `Error: connect ECONNREFUSED 98.70.58.149:8080
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1607:16)
    at Module.checkJenkinsReachability (/app/services/jenkinsService.ts:310:11)`,
  },
  {
    name: 'Docker Daemon Offline',
    log: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
Failed to build container image: exit status 1`,
  },
];

export const AI: React.FC = () => {
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const [logInput, setLogInput] = useState<string>(SAMPLE_FAILURES[0].log);
  const [diagnosis, setDiagnosis] = useState<DiagnosticResult | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await aiService.getStatus();
      setProviderStatus(data);
    } catch {
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
        ],
      });
    }
  }, []);

  const runDiagnosis = useCallback(async (textToDiagnose: string) => {
    if (!textToDiagnose.trim()) return;
    setDiagnosing(true);
    try {
      const res = await aiService.diagnoseLog(textToDiagnose);
      setDiagnosis(res);
    } catch (err) {
      console.error('Diagnosis failed', err);
    } finally {
      setDiagnosing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    void runDiagnosis(SAMPLE_FAILURES[0].log);
  }, [fetchStatus, runDiagnosis]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'HIGH':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'MEDIUM':
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Wrench className="h-7 w-7 text-amber-400" />
              DevOps Diagnostic Engine
            </h1>
            <StatusBadge
              status="Healthy"
              customLabel="Rule-Based Diagnostics (No LLM Key)"
              size="sm"
            />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Automated failure root-cause analysis, line isolation, and targeted remediation for CI/CD builds.
          </p>
        </div>
      </div>

      {/* 2. Attribution & Transparency Notice */}
      <GlassCard className="p-4 border-amber-500/20 bg-amber-500/5 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wider">
          <Info className="h-4 w-4" />
          <span>Attribution Transparency Notice</span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          {providerStatus?.attributionNotice ||
            'Running on built-in deterministic heuristic rule engine. No external LLM API key (OpenAI/Gemini/Anthropic) is configured or exposed in frontend code. Diagnostic results below are computed via deterministic pattern heuristics, not speculative neural generation.'}
        </p>
      </GlassCard>

      {/* 3. Diagnostic Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Console */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Log Analyzer Input
              </span>
              <span className="text-[11px] font-mono text-white/40">Raw text / stderr</span>
            </div>

            {/* Quick-Select Scenarios */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 block">Quick-Select Known CI Scenarios:</label>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_FAILURES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setLogInput(sample.log);
                      void runDiagnosis(sample.log);
                    }}
                    className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left text-[11px] text-white/80 transition-all truncate"
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-1">
              <label className="text-[11px] text-white/50 block">Or Paste Build Console Log:</label>
              <textarea
                rows={9}
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                placeholder="Paste build stdout/stderr, stack traces, or command errors..."
                className="w-full p-3 rounded-xl bg-black/60 border border-white/[0.1] text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500 leading-relaxed resize-y"
              />
            </div>

            <button
              onClick={() => void runDiagnosis(logInput)}
              disabled={diagnosing || !logInput.trim()}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>{diagnosing ? 'Analyzing Failure Signatures...' : 'Diagnose Build Output'}</span>
            </button>
          </GlassCard>

          {/* Engine Capabilities */}
          <GlassCard className="p-4 space-y-2">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block">
              Recognized Failure Heuristics
            </span>
            <div className="space-y-1.5 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Vitest CI / devDependencies omissions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>TypeScript compilation errors (TSxxxx)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Network timeouts & ECONNREFUSED</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Docker Engine socket disconnects</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Process heap memory exhaustion (OOM)</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right: Structured Diagnostic Report */}
        <div className="lg:col-span-7 space-y-4">
          {diagnosis ? (
            <GlassCard className="p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(
                        diagnosis.severity
                      )}`}
                    >
                      {diagnosis.severity}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-white/60 font-mono">
                      {diagnosis.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1.5">{diagnosis.title}</h3>
                </div>
                <span className="text-[11px] font-mono text-white/40 shrink-0 self-start sm:self-auto">
                  ID: {diagnosis.signature}
                </span>
              </div>

              {/* Pinpointed Snippet */}
              {diagnosis.pinpointedLogSnippet && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Isolated Failing Statement:
                  </span>
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs font-mono text-rose-200 break-all select-all">
                    {diagnosis.pinpointedLogSnippet}
                  </div>
                </div>
              )}

              {/* Root Cause */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Root Cause Analysis:
                </span>
                <p className="text-xs text-white/80 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                  {diagnosis.rootCause}
                </p>
              </div>

              {/* Recommended Fixes */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Targeted Remediation Steps:
                </span>
                <div className="space-y-3">
                  {diagnosis.recommendedFixes.map((fix, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2"
                    >
                      <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          Step {idx + 1}: {fix.title}
                        </span>
                      </h4>
                      <p className="text-xs text-white/70 leading-relaxed">{fix.description}</p>

                      {fix.command && (
                        <div className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-lg border border-white/[0.08] font-mono text-xs text-emerald-300">
                          <code className="select-all">{fix.command}</code>
                          <button
                            onClick={() => handleCopy(fix.command!, `cmd-${idx}`)}
                            className="text-white/40 hover:text-white ml-2 shrink-0"
                            title="Copy command"
                          >
                            {copiedKey === `cmd-${idx}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {fix.codeSnippet && (
                        <div className="relative">
                          <pre className="bg-black/60 p-3 rounded-lg border border-white/[0.08] font-mono text-[11px] text-zinc-300 overflow-x-auto select-all leading-relaxed">
                            <code>{fix.codeSnippet}</code>
                          </pre>
                          <button
                            onClick={() => handleCopy(fix.codeSnippet!, `snippet-${idx}`)}
                            className="absolute top-2 right-2 text-white/40 hover:text-white p-1"
                            title="Copy code snippet"
                          >
                            {copiedKey === `snippet-${idx}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Prevention Guideline */}
              <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-1">
                <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Architectural Prevention Guideline:
                </span>
                <p className="text-xs text-white/70 leading-relaxed">
                  {diagnosis.preventionGuideline}
                </p>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-12 text-center text-white/40">
              Paste a log and click "Diagnose Build Output" to generate a diagnostic report.
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
};
