import React from 'react';

export interface SVGConnectionsProps {
  activeNodeId?: string | null;
  pulsingNodeId?: string | null;
}

export interface ConnectionConfig {
  id: string;
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  endX: number;
  endY: number;
}

const CONNECTIONS: ConnectionConfig[] = [
  { id: 'github', startX: 15, startY: 14, controlX: 32, controlY: 28, endX: 50, endY: 50 },
  { id: 'jira', startX: 85, startY: 14, controlX: 68, controlY: 28, endX: 50, endY: 50 },
  { id: 'jenkins', startX: 10, startY: 50, controlX: 26, controlY: 34, endX: 50, endY: 50 },
  { id: 'docker', startX: 90, startY: 50, controlX: 74, controlY: 34, endX: 50, endY: 50 },
  { id: 'kubernetes', startX: 18, startY: 84, controlX: 34, controlY: 67, endX: 50, endY: 50 },
  { id: 'monitoring', startX: 82, startY: 84, controlX: 66, controlY: 67, endX: 50, endY: 50 },
  { id: 'ai', startX: 50, startY: 89, controlX: 50, controlY: 70, endX: 50, endY: 50 },
];

export const SVGConnections: React.FC<SVGConnectionsProps> = ({
  activeNodeId,
  pulsingNodeId,
}) => {
  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Blue to Cyan Gradient for connections */}
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="activeLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="1" />
        </linearGradient>

        {/* Glow Filter for Active Connection */}
        <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Render each connection line */}
      {CONNECTIONS.map((conn) => {
        const pathData = `M ${conn.startX},${conn.startY} Q ${conn.controlX},${conn.controlY} ${conn.endX},${conn.endY}`;
        const isActive = activeNodeId === conn.id || pulsingNodeId === conn.id;

        return (
          <g key={conn.id}>
            {/* Background base path line */}
            <path
              d={pathData}
              fill="none"
              stroke={isActive ? "url(#activeLineGrad)" : "url(#lineGrad)"}
              strokeWidth={isActive ? "0.6" : "0.35"}
              strokeOpacity={isActive ? 1.0 : 0.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              filter={isActive ? "url(#cyanGlow)" : undefined}
              className="transition-all duration-300"
            />

            {/* Continuous Animated Flow Particles moving toward DevWeave center */}
            <circle r={isActive ? "0.8" : "0.5"} fill={isActive ? "#67e8f9" : "#38bdf8"}>
              <animateMotion
                path={pathData}
                dur={isActive ? "1.8s" : "3.5s"}
                repeatCount="indefinite"
              />
            </circle>

            {/* Secondary staggered particle for rich fluid flow */}
            <circle r="0.4" fill="#60a5fa" opacity="0.8">
              <animateMotion
                path={pathData}
                dur={isActive ? "1.8s" : "3.5s"}
                begin="1.2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
};
