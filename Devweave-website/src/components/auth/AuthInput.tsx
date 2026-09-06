import React, { type InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  icon?: LucideIcon;
  rightElement?: React.ReactNode;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  id,
  label,
  error,
  icon: Icon,
  rightElement,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col space-y-1.5 w-full">
      <label htmlFor={id} className="text-xs font-semibold text-white/80 tracking-wide">
        {label}
      </label>
      
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 pointer-events-none text-white/40">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          id={id}
          className={`
            w-full bg-white/[0.03] border text-white text-sm rounded-xl px-3.5 py-2.5 transition-all outline-none
            placeholder:text-white/30
            ${Icon ? 'pl-10' : ''}
            ${rightElement ? 'pr-10' : ''}
            ${
              error
                ? 'border-red-500/80 focus:border-red-400 focus:ring-1 focus:ring-red-400/50'
                : 'border-white/10 focus:border-cyan-400/60 focus:bg-white/[0.05] focus:shadow-[0_0_15px_rgba(56,189,248,0.25)]'
            }
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="text-xs text-red-400 mt-1 font-medium flex items-center gap-1 animate-fadeIn">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
