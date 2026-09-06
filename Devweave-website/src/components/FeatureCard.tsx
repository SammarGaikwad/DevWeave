import React from 'react';

export interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon: Icon,
  title,
  description,
}) => {
  return (
    <div className="liquid-glass rounded-3xl p-8 min-h-[280px] flex flex-col justify-between relative group hover:-translate-y-1.5 hover:scale-[1.02] hover:bg-white/[0.03] transition-all duration-500 ease-out cursor-pointer shadow-2xl hover:shadow-[0_0_45px_rgba(59,130,246,0.18)] border border-white/5 hover:border-white/20 overflow-hidden">
      {/* Top subtle sheen highlight & glow effect on hover */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-400/25 group-hover:w-64 group-hover:h-64 transition-all duration-700 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Card Content Top & Middle */}
      <div>
        {/* Top: Large Icon (48px) with Accent Blue Gradient */}
        <div className="relative inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-500/20 group-hover:border-cyan-400/40 group-hover:from-blue-500/25 group-hover:to-cyan-400/20 transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.35)]">
          <Icon className="w-12 h-12 text-cyan-400 group-hover:scale-105 group-hover:text-cyan-300 transition-all duration-300 shrink-0" />
        </div>

        {/* Middle: Feature Title */}
        <h3 className="text-xl font-semibold text-white tracking-tight mt-6 mb-3 group-hover:text-cyan-100 transition-colors duration-300">
          {title}
        </h3>

        {/* Bottom: Feature Description */}
        <p className="text-white/70 leading-relaxed text-sm md:text-base font-normal group-hover:text-white/85 transition-colors duration-300">
          {description}
        </p>
      </div>

      {/* Subtle indicator accent line at bottom of card */}
      <div className="w-8 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-30 group-hover:w-full group-hover:opacity-100 transition-all duration-500 mt-6" />
    </div>
  );
};
