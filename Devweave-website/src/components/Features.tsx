import React from 'react';
import { 
  KanbanSquare, 
  Container, 
  Boxes, 
  Bot, 
  Activity 
} from 'lucide-react';
import { FeatureCard, type FeatureCardProps } from './FeatureCard';

// Custom SVG GitHub Icon matching Lucide icon interface
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

const FEATURES_DATA: FeatureCardProps[] = [
  {
    icon: GithubIcon,
    title: 'GitHub Integration',
    description: 'Manage repositories, pull requests, commits, branches, and GitHub Actions without leaving DevWeave.',
  },
  {
    icon: KanbanSquare,
    title: 'Jira Management',
    description: 'Track projects, sprint progress, stories, bugs, and tasks from one unified workspace.',
  },
  {
    icon: Container,
    title: 'Docker Control',
    description: 'View images, manage containers, inspect resources, and deploy applications with ease.',
  },
  {
    icon: Boxes,
    title: 'Kubernetes',
    description: 'Manage clusters, pods, deployments, services, and namespaces from one intuitive dashboard.',
  },
  {
    icon: Bot,
    title: 'AI Assistant',
    description: 'Ask questions, troubleshoot deployments, summarize logs, generate YAML, and automate developer workflows.',
  },
  {
    icon: Activity,
    title: 'Real-time Monitoring',
    description: 'Monitor infrastructure health, performance metrics, resource utilization, and application status in real time.',
  },
];

export const Features: React.FC = () => {
  return (
    <section 
      id="features" 
      className="relative z-10 w-full bg-black py-24 md:py-32 overflow-hidden select-none"
    >
      {/* Very subtle background radial gradient - almost invisible */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/10 via-black to-black pointer-events-none z-0" 
      />

      {/* Main Layout Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col items-start text-left mb-16 md:mb-20">
          {/* Small Label */}
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold mb-3">
            FEATURES
          </span>

          {/* Large Heading */}
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Everything your engineering team needs.
          </h2>

          {/* Description */}
          <p className="max-w-3xl text-white/70 text-lg leading-relaxed mt-4">
            DevWeave brings together development, deployment, monitoring, collaboration, and AI into one seamless Internal Developer Platform.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES_DATA.map((feature, index) => (
            <FeatureCard 
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>

        {/* Centered Bottom Text */}
        <div className="mt-16 md:mt-24 text-center">
          <p className="text-sm text-white/50 font-medium tracking-wide">
            One platform. Every pipeline. Infinite possibilities.
          </p>
        </div>
      </div>
    </section>
  );
};
