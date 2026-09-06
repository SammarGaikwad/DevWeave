import React from 'react';

export interface SocialButtonProps {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SocialButton: React.FC<SocialButtonProps> = ({
  label,
  href,
  icon: Icon,
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="liquid-glass rounded-full w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 hover:border-cyan-400/40 hover:scale-110 hover:rotate-6 active:scale-95 transition-all duration-300 shadow-md group border border-white/10"
    >
      <Icon className="w-4 h-4 text-white/80 group-hover:text-cyan-300 transition-colors" />
    </a>
  );
};
