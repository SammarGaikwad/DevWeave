import React from 'react';

export type StatusType = 'Healthy' | 'Active' | 'Running' | 'Pending' | 'Warning' | 'Failed' | 'Offline';

interface StatusBadgeProps {
  status: StatusType;
  customLabel?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  customLabel,
  size = 'md',
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Healthy':
      case 'Running':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/20',
          dot: 'bg-emerald-400',
          pulse: true,
        };
      case 'Pending':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          border: 'border-amber-500/20',
          dot: 'bg-amber-400',
          pulse: false,
        };
      case 'Warning':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          border: 'border-amber-500/20',
          dot: 'bg-amber-400',
          pulse: true,
        };
      case 'Failed':
        return {
          bg: 'bg-rose-500/10',
          text: 'text-rose-400',
          border: 'border-rose-500/20',
          dot: 'bg-rose-400',
          pulse: false,
        };
      case 'Offline':
      default:
        return {
          bg: 'bg-zinc-500/10',
          text: 'text-zinc-400',
          border: 'border-zinc-500/20',
          dot: 'bg-zinc-400',
          pulse: false,
        };
    }
  };

  const style = getStatusStyles();
  const label = customLabel || status;
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs font-medium' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {style.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.dot} opacity-75`}
          ></span>
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${style.dot}`}></span>
      </span>
      <span>{label}</span>
    </span>
  );
};
