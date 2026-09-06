import React from 'react';
import { Layers } from 'lucide-react';
import type { EnvironmentFilter } from '../../types/dashboard';

interface EnvironmentSelectorProps {
  currentEnv: EnvironmentFilter;
  onChange: (env: EnvironmentFilter) => void;
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  currentEnv,
  onChange,
}) => {
  const environments: EnvironmentFilter[] = [
    'All Environments',
    'Development',
    'Staging',
    'Production',
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-medium">
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-white/40 border-r border-white/10 shrink-0">
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Env:</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {environments.map((env) => {
          const isActive = currentEnv === env;
          return (
            <button
              key={env}
              onClick={() => onChange(env)}
              className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-500/20 text-white border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)] font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {env}
            </button>
          );
        })}
      </div>
    </div>
  );
};
