import React from 'react';
import { 
  KanbanSquare, 
  Workflow, 
  Container, 
  Boxes, 
  Gauge, 
  BarChart3, 
  Bot 
} from 'lucide-react';
import { IntegrationCard, type IntegrationCardProps } from './IntegrationCard';
import { StatsCard, type StatsCardProps } from './StatsCard';

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

const INTEGRATIONS_DATA: IntegrationCardProps[] = [
  {
    category: 'Source Control',
    title: 'GitHub',
    description: 'Manage repositories, pull requests, branches, commits, releases, and GitHub Actions.',
    icon: GithubIcon,
  },
  {
    category: 'Project Management',
    title: 'Jira',
    description: 'Track sprints, issues, stories, tasks, bugs, and project progress.',
    icon: KanbanSquare,
  },
  {
    category: 'CI/CD',
    title: 'Jenkins',
    description: 'Trigger builds, monitor pipelines, inspect logs, and automate deployments.',
    icon: Workflow,
  },
  {
    category: 'Containers',
    title: 'Docker',
    description: 'Manage containers, images, networks, and volumes from a unified dashboard.',
    icon: Container,
  },
  {
    category: 'Container Orchestration',
    title: 'Kubernetes',
    description: 'Deploy, scale, and monitor workloads across clusters with ease.',
    icon: Boxes,
  },
  {
    category: 'Monitoring',
    title: 'Prometheus',
    description: 'Collect metrics and monitor infrastructure health in real time.',
    icon: Gauge,
  },
  {
    category: 'Visualization',
    title: 'Grafana',
    description: 'Visualize metrics through customizable dashboards and alerts.',
    icon: BarChart3,
  },
  {
    category: 'Artificial Intelligence',
    title: 'AI Assistant',
    description: 'Analyze logs, troubleshoot deployments, summarize activity, and automate repetitive engineering tasks.',
    icon: Bot,
  },
];

const STATS_DATA: StatsCardProps[] = [
  { label: 'Repositories', value: '500+' },
  { label: 'Pipelines', value: '1M+' },
  { label: 'Deployments', value: '250K+' },
  { label: 'Engineering Teams', value: 'Worldwide' },
];

export const IntegrationsSection: React.FC = () => {
  return (
    <section 
      id="integrations" 
      className="relative z-10 w-full bg-black py-24 md:py-32 overflow-hidden select-none"
    >
      {/* Background soft radial gradient & engineering grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/15 via-black to-black pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Subtle glowing ambient particles */}
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Section Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="flex flex-col items-start text-left mb-16 md:mb-20">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold mb-3">
            INTEGRATIONS
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Works With The Tools You Already Love
          </h2>
          <p className="max-w-3xl text-lg leading-relaxed text-white/70 mt-4">
            DevWeave integrates seamlessly with your favorite development, DevOps, cloud-native, monitoring, and collaboration tools.
          </p>
        </div>

        {/* Integration 4-column Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {INTEGRATIONS_DATA.map((item) => (
            <IntegrationCard
              key={item.title}
              category={item.category}
              title={item.title}
              description={item.description}
              icon={item.icon}
            />
          ))}
        </div>

        {/* Bottom Statistics Row */}
        <div className="mt-16 md:mt-24 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS_DATA.map((stat) => (
            <StatsCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>

      </div>
    </section>
  );
};
