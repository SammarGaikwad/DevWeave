import React from 'react';

export interface InsightCardProps {
  label: string;
  value: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({ label, value }) => {
  return (
    <div className="liquid-glass rounded-3xl p-6 flex flex-col justify-between relative group hover:-translate-y-1 hover:scale-105 transition-all duration-300 shadow-xl border border-white/5 hover:border-cyan-400/30 overflow-hidden">
      {/* Background glow sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Label Top */}
      <span className="text-xs uppercase tracking-widest font-semibold text-white/50 group-hover:text-white/80 transition-colors">
        {label}
      </span>

      {/* Value Bottom */}
      <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-3 bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-blue-400 transition-all">
        {value}
      </div>
    </div>
  );
};
