import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-xl p-5 ${
        hover ? 'glass-panel-hover cursor-pointer transition-all duration-200 hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
