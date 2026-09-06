import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  badge = false,
  active = false,
  className = '',
  ...props
}) => {
  return (
    <button
      aria-label={label}
      title={label}
      className={`relative inline-flex items-center justify-center rounded-lg p-2 text-white/70 transition-all duration-150 hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
        active ? 'bg-white/[0.08] text-white' : ''
      } ${className}`}
      {...props}
    >
      {icon}
      {badge && (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-[#050505]" />
      )}
    </button>
  );
};
