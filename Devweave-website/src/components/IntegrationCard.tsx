import React from 'react';

export interface IntegrationCardProps {
  category: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: string;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  category,
  title,
  description,
  icon: Icon,
  status = 'Supported',
}) => {
  return (
    <div className="liquid-glass rounded-3xl p-6 min-h-[220px] flex flex-col justify-between relative group cursor-pointer transition-all duration-500 ease-out hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/[0.03] shadow-xl hover:shadow-[0_0_35px_rgba(59,130,246,0.2)] border border-white/5 hover:border-cyan-400/40 overflow-hidden">
      {/* Subtle blue ambient glow highlight on hover */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 group-hover:w-56 group-hover:h-56 transition-all duration-700 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Top Header: Icon & Category */}
      <div className="relative z-10 flex items-start justify-between">
        {/* Large Logo / Icon Container */}
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-500/20 group-hover:border-cyan-400/50 group-hover:from-blue-500/25 group-hover:to-cyan-400/20 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]">
          <Icon className="w-8 h-8 text-cyan-400 group-hover:text-cyan-300 group-hover:rotate-6 transition-transform duration-300 shrink-0" />
        </div>

        {/* Category Label */}
        <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40 group-hover:text-cyan-300/80 transition-colors">
          {category}
        </span>
      </div>

      {/* Middle Section: Title & Description */}
      <div className="relative z-10 my-2">
        <h3 className="text-xl font-semibold text-white tracking-tight group-hover:text-cyan-100 transition-colors">
          {title}
        </h3>
        <p className="text-white/70 text-xs leading-relaxed font-normal mt-1 group-hover:text-white/85 transition-colors">
          {description}
        </p>
      </div>

      {/* Bottom Section: Supported Status Pill */}
      <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-white/5">
        <div className="liquid-glass rounded-full px-3 py-0.5 flex items-center gap-1.5 text-[11px] font-medium text-white/90 border border-emerald-500/30 bg-emerald-500/5 group-hover:border-emerald-400/60 group-hover:shadow-[0_0_10px_rgba(52,211,153,0.4)] transition-all">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};
