import React from 'react';
import { Bot, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';

export const AIInsightCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <GlassCard className="relative overflow-hidden border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-purple-950/20 to-transparent p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">DevWeave AI</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full">
                <Sparkles className="h-2.5 w-2.5" />
                Assistant
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              3 recent deployment events are available for automated root-cause analysis.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/ai')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600/30 border border-blue-500/40 hover:bg-blue-600/40 text-white text-xs font-semibold shadow-[0_0_12px_rgba(59,130,246,0.2)] transition-all shrink-0 group"
        >
          <span>Open AI Assistant</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </GlassCard>
  );
};
