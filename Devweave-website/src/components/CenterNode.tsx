import React from 'react';
import { Globe } from 'lucide-react';
import { StatusChip } from './StatusChip';

export interface CenterNodeProps {
  isHighlighted?: boolean;
}

const CENTER_STATUSES = [
  'Git Connected',
  'CI Running',
  'Kubernetes Healthy',
  'AI Ready',
];

export const CenterNode: React.FC<CenterNodeProps> = ({ isHighlighted = false }) => {
  return (
    <div 
      className={`liquid-glass rounded-3xl w-[320px] h-[320px] p-6 flex flex-col justify-between items-center text-center relative group transition-all duration-500 cursor-pointer overflow-hidden ${
        isHighlighted 
          ? 'scale-105 shadow-[0_0_60px_rgba(56,189,248,0.35)] border-cyan-400/50 bg-white/[0.06]' 
          : 'shadow-[0_0_40px_rgba(0,0,0,0.8)] border-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_50px_rgba(59,130,246,0.25)]'
      }`}
    >
      {/* Dynamic ambient backlight blur */}
      <div 
        className={`absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-cyan-400/10 to-indigo-600/20 rounded-3xl blur-xl pointer-events-none transition-opacity duration-500 ${
          isHighlighted ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
        }`} 
      />

      {/* Top Sheen reflection */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header & Logo */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Globe Logo with Glowing Ring */}
        <div className="relative mb-3">
          <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-md animate-pulse" />
          <div className="liquid-glass rounded-full p-3 border border-cyan-400/40 relative z-10 bg-black/40">
            <Globe className="w-8 h-8 text-cyan-300 animate-[spin_12s_linear_infinite]" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-2xl font-bold text-white tracking-tight">
          DevWeave
        </h3>
        <span className="text-[11px] font-semibold tracking-widest text-cyan-400 uppercase mt-0.5">
          Internal Developer Platform
        </span>
      </div>

      {/* Description */}
      <p className="relative z-10 text-xs text-white/70 leading-relaxed max-w-[260px] font-normal my-1">
        A unified workspace connecting every engineering tool, workflow, deployment pipeline, and AI assistant.
      </p>

      {/* 4 Status Chips (2x2 grid inside card) */}
      <div className="relative z-10 grid grid-cols-2 gap-1.5 w-full pt-1">
        {CENTER_STATUSES.map((status) => (
          <StatusChip key={status} label={status} />
        ))}
      </div>
    </div>
  );
};
