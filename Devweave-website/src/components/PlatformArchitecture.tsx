import React, { useState, useEffect } from 'react';
import { 
  KanbanSquare, 
  Container, 
  Boxes, 
  Bot, 
  Activity, 
  Workflow,
  ArrowDown
} from 'lucide-react';
import { CenterNode } from './CenterNode';
import { ServiceNode, type ServiceNodeProps } from './ServiceNode';
import { SVGConnections } from './SVGConnections';

// Custom SVG GitHub Icon matching component interface
const GithubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export interface ServiceItem extends Omit<ServiceNodeProps, 'isHovered' | 'isPulsing'> {
  positionClass: string;
}

const SERVICES_DATA: ServiceItem[] = [
  {
    id: 'github',
    title: 'GitHub',
    icon: GithubIcon,
    status: 'Connected',
    positionClass: 'left-[15%] top-[14%] -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'jira',
    title: 'Jira',
    icon: KanbanSquare,
    status: 'Synced',
    positionClass: 'left-[85%] top-[14%] -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'jenkins',
    title: 'Jenkins',
    icon: Workflow,
    status: 'Running',
    positionClass: 'left-[10%] top-[50%] -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'docker',
    title: 'Docker',
    icon: Container,
    status: 'Protected',
    positionClass: 'left-[90%] top-[50%] -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes',
    icon: Boxes,
    status: 'Healthy',
    positionClass: 'left-[18%] top-[84%] -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    icon: Activity,
    status: 'Active',
    positionClass: 'left-[82%] top-[84%] -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    icon: Bot,
    status: 'AI Active',
    positionClass: 'left-[50%] top-[89%] -translate-x-1/2 -translate-y-1/2',
  },
];

// Deployment Pipeline microanimation sequence order
const PIPELINE_SEQUENCE = ['github', 'jenkins', 'docker', 'kubernetes', 'monitoring', 'ai'];

const BOTTOM_PILLS = [
  { label: 'GitHub', icon: GithubIcon },
  { label: 'Jira', icon: KanbanSquare },
  { label: 'Jenkins', icon: Workflow },
  { label: 'Docker', icon: Container },
  { label: 'Kubernetes', icon: Boxes },
  { label: 'AI', icon: Bot },
];

export const PlatformArchitecture: React.FC = () => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pulsingNodeId, setPulsingNodeId] = useState<string | null>(null);

  // Deployment Pipeline Microanimation every 4-5 seconds
  useEffect(() => {
    let stepIndex = 0;
    const interval = setInterval(() => {
      const currentId = PIPELINE_SEQUENCE[stepIndex];
      setPulsingNodeId(currentId);

      stepIndex = (stepIndex + 1) % PIPELINE_SEQUENCE.length;
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section 
      id="architecture" 
      className="relative z-10 w-full bg-black py-24 md:py-32 overflow-hidden select-none"
    >
      {/* Background radial gradient & ambient grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-black to-black pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Subtle floating glow dots */}
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Section Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="flex flex-col items-start text-left mb-16 md:mb-20">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold mb-3">
            ARCHITECTURE
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            One Platform. Every Workflow.
          </h2>
          <p className="max-w-3xl text-white/70 text-lg leading-relaxed mt-4">
            DevWeave intelligently connects every stage of your engineering workflow into one centralized platform.
          </p>
        </div>

        {/* Desktop & Tablet Main Interactive Architecture Canvas */}
        <div className="hidden md:block relative w-full h-[600px] lg:h-[700px] rounded-3xl border border-white/5 bg-black/40 backdrop-blur-md overflow-hidden shadow-2xl">
          
          {/* Animated SVG Connection Lines */}
          <SVGConnections 
            activeNodeId={hoveredNodeId}
            pulsingNodeId={pulsingNodeId}
          />

          {/* Center DevWeave Node */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <CenterNode isHighlighted={hoveredNodeId !== null || pulsingNodeId !== null} />
          </div>

          {/* Floating Connected Service Cards */}
          {SERVICES_DATA.map((service) => (
            <div 
              key={service.id} 
              className={`absolute ${service.positionClass} z-30 transition-all duration-300`}
            >
              <ServiceNode
                id={service.id}
                title={service.title}
                icon={service.icon}
                status={service.status}
                isHovered={hoveredNodeId === service.id}
                isPulsing={pulsingNodeId === service.id}
                onMouseEnter={() => setHoveredNodeId(service.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              />
            </div>
          ))}
        </div>

        {/* Mobile Vertical Pipeline Layout */}
        <div className="block md:hidden flex flex-col items-center gap-4 py-6">
          {SERVICES_DATA.map((service) => {
            const Icon = service.icon;
            return (
              <React.Fragment key={service.id}>
                <div className="liquid-glass rounded-2xl p-4 w-full max-w-sm flex items-center justify-between border border-white/10 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 text-cyan-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{service.title}</h4>
                      <span className="text-[11px] text-white/50">Service Node</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-400">{service.status}</span>
                  </div>
                </div>

                <ArrowDown className="w-4 h-4 text-cyan-400/60 my-1 animate-bounce" />
              </React.Fragment>
            );
          })}

          {/* Center DevWeave Card at Bottom of Mobile Timeline */}
          <div className="mt-4 w-full flex justify-center">
            <CenterNode isHighlighted={true} />
          </div>
        </div>

        {/* Bottom Explanation & Feature Pills */}
        <div className="mt-16 md:mt-24 text-center flex flex-col items-center">
          {/* 6 Small Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl">
            {BOTTOM_PILLS.map((pill) => {
              const PillIcon = pill.icon;
              return (
                <div 
                  key={pill.label}
                  className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-medium text-white/80 border border-white/10 shadow-md hover:scale-105 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <PillIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{pill.label}</span>
                </div>
              );
            })}
          </div>

          {/* Main Tagline */}
          <p className="text-sm md:text-base text-white/60 max-w-2xl mx-auto leading-relaxed mt-6 font-normal">
            Stop switching between tools. DevWeave becomes the single control center for your entire engineering organization.
          </p>
        </div>

      </div>
    </section>
  );
};
