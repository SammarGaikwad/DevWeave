import React from 'react';

export interface StatsCardProps {
  label: string;
  value: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value }) => {
  return (
    <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center justify-center text-center relative group hover:-translate-y-1 hover:scale-105 transition-all duration-300 shadow-xl border border-white/5 hover:border-cyan-400/30 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Value */}
      <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-blue-400 transition-all">
        {value}
      </div>

      {/* Label */}
      <div className="text-xs uppercase tracking-widest font-semibold text-white/50 mt-2 group-hover:text-white/80 transition-colors">
        {label}
      </div>
    </div>
  );
};
