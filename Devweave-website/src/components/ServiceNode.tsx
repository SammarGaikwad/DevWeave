import React from 'react';

export interface ServiceNodeProps {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  isHovered?: boolean;
  isPulsing?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const ServiceNode: React.FC<ServiceNodeProps> = ({
  title,
  icon: Icon,
  status,
  isHovered = false,
  isPulsing = false,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`liquid-glass rounded-2xl p-5 w-[180px] flex flex-col justify-between relative group cursor-pointer transition-all duration-300 select-none overflow-hidden ${
        isHovered || isPulsing
          ? 'scale-105 -translate-y-1 shadow-[0_0_35px_rgba(56,189,248,0.35)] border-cyan-400/60 bg-white/[0.06]'
          : 'shadow-xl border-white/10 hover:border-white/25 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]'
      }`}
    >
      {/* Background glowing sheen */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 transition-opacity duration-300 pointer-events-none ${
          isHovered || isPulsing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`} 
      />

      {/* Top Section: Icon & Pulse Ring */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div 
          className={`p-2.5 rounded-xl transition-all duration-300 ${
            isHovered || isPulsing
              ? 'bg-gradient-to-br from-blue-500/30 to-cyan-400/30 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(56,189,248,0.4)]'
              : 'bg-white/5 text-cyan-400 border border-white/10 group-hover:border-cyan-400/30 group-hover:text-cyan-300'
          }`}
        >
          <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
        </div>

        {/* Pulse Beacon Indicator */}
        <div className="flex items-center gap-1.5">
          <span 
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isHovered || isPulsing 
                ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,1)] animate-ping' 
                : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
            }`} 
          />
        </div>
      </div>

      {/* Middle Section: Title */}
      <div className="relative z-10">
        <h4 className="text-base font-semibold text-white tracking-tight group-hover:text-cyan-100 transition-colors">
          {title}
        </h4>
      </div>

      {/* Bottom Section: Status Pill */}
      <div className="mt-3 relative z-10 flex items-center justify-between border-t border-white/5 pt-2.5">
        <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
          Status
        </span>
        <span className="text-xs font-semibold text-emerald-400 tracking-wide">
          {status}
        </span>
      </div>
    </div>
  );
};
