import React from 'react';

export interface StatusChipProps {
  label: string;
  active?: boolean;
}

export const StatusChip: React.FC<StatusChipProps> = ({ label, active = true }) => {
  return (
    <div className="liquid-glass rounded-full px-3 py-1 flex items-center gap-2 text-[11px] font-medium text-white/90 border border-white/10 shadow-sm whitespace-nowrap">
      <span 
        className={`w-1.5 h-1.5 rounded-full ${
          active ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/30'
        }`} 
      />
      <span>{label}</span>
    </div>
  );
};
