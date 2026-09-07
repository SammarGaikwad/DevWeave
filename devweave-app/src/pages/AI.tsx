import React from 'react';
import { Bot, Sparkles, Zap } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';

export const AI: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
            <StatusBadge status="Pending" customLabel="Upcoming Phase" />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Intelligent DevOps agent for root cause analysis, K8s debugging, and pipeline automation.
          </p>
        </div>
      </div>

      <GlassCard className="p-6 sm:p-8 text-center space-y-4 max-w-2xl mx-auto my-6 sm:my-12">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
          <Bot className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white">AI Assistant Module</h3>
        <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
          This module is being built. Natural language platform diagnostics and automated code fix generation will be available in the next development phase.
        </p>
        <div className="pt-2 flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-xs text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> LLM Reasoning
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Auto-Fix Remediation
          </span>
        </div>
      </GlassCard>
    </div>
  );
};
