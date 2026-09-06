import React from 'react';
import { GitBranch, Workflow, Rocket, Boxes, Bot, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DashboardQuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Connect Repository',
      icon: GitBranch,
      path: '/repositories',
    },
    {
      label: 'Create Pipeline',
      icon: Workflow,
      path: '/pipelines',
    },
    {
      label: 'View Deployments',
      icon: Rocket,
      path: '/deployments',
    },
    {
      label: 'Open Kubernetes',
      icon: Boxes,
      path: '/kubernetes',
    },
    {
      label: 'Ask AI Assistant',
      icon: Bot,
      path: '/ai',
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex items-center justify-between p-3 rounded-xl glass-panel text-white/80 hover:text-white hover:bg-white/[0.06] hover:border-white/20 transition-all duration-150 group text-left"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className="h-4 w-4 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium truncate">{action.label}</span>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-white/30 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
