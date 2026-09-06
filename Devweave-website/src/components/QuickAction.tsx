import React from 'react';

export interface QuickActionProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({
  label,
  icon: Icon,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="liquid-glass rounded-full px-4 py-2 text-xs font-medium text-white/85 hover:text-white flex items-center gap-2 border border-white/10 hover:border-cyan-400/50 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer group shrink-0"
    >
      <Icon className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 group-hover:text-cyan-300 transition-all duration-300" />
      <span>{label}</span>
    </button>
  );
};
