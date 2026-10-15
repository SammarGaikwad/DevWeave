import React from 'react';
import { Bot, Sparkles, ArrowRight, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import type { BuildSummary } from '../../services/pipelineService';

export const AIInsightCard: React.FC<{ builds: BuildSummary[] }> = ({ builds }) => {
  const navigate = useNavigate();
  const recentBuilds = builds.slice(0, 5);
  const latest = recentBuilds[0];
  const recentFailures = recentBuilds.filter((build) =>
    ['FAILURE', 'ABORTED', 'UNSTABLE'].includes(build.status)
  ).length;
  const running = recentBuilds.some((build) => build.status === 'BUILDING');

  let insight = 'Run a pipeline to start building a live CI/CD overview.';
  let Icon = Sparkles;
  let iconClass = 'text-blue-400';
  if (running) {
    insight = 'A pipeline is running. Check its stage progress and logs for the current result.';
    Icon = PlayCircle;
    iconClass = 'text-blue-400';
  } else if (recentFailures > 0) {
    insight = `${recentFailures} of the latest ${recentBuilds.length} pipeline runs failed or were unstable. Open the pipeline logs to investigate.`;
    Icon = AlertTriangle;
    iconClass = 'text-amber-400';
  } else if (latest?.status === 'SUCCESS') {
    insight = `The latest available build (#${latest.number}) succeeded. Keep running the pipeline after changes to catch regressions early.`;
    Icon = CheckCircle2;
    iconClass = 'text-emerald-400';
  } else if (latest) {
    insight = `Latest build #${latest.number} status is ${latest.status.toLowerCase()}. Review its run details for more information.`;
  }

  return (
    <GlassCard className="relative overflow-hidden border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-purple-950/20 to-transparent p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Bot className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Pipeline Insight</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full">
                <Icon className={`h-2.5 w-2.5 ${iconClass}`} />
                Live build data
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">{insight}</p>
            <p className="text-[10px] text-white/40 mt-1">Rule-based summary of Jenkins runs, not an AI-generated diagnosis.</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/pipelines')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600/30 border border-blue-500/40 hover:bg-blue-600/40 text-white text-xs font-semibold shadow-[0_0_12px_rgba(59,130,246,0.2)] transition-all shrink-0 group"
        >
          <span>View Pipelines</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </GlassCard>
  );
};
