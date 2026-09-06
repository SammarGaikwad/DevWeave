import {
  LayoutDashboard,
  GitBranch,
  Workflow,
  Rocket,
  Container,
  Boxes,
  Activity,
  FileText,
  Bot,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { NavGroup } from '../types/navigation';

export const navigationConfig: NavGroup[] = [
  {
    title: 'WORKSPACE',
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        label: 'Repositories',
        path: '/repositories',
        icon: GitBranch,
      },
    ],
  },
  {
    title: 'DELIVERY',
    items: [
      {
        label: 'Pipelines',
        path: '/pipelines',
        icon: Workflow,
      },
      {
        label: 'Deployments',
        path: '/deployments',
        icon: Rocket,
      },
    ],
  },
  {
    title: 'INFRASTRUCTURE',
    items: [
      {
        label: 'Docker',
        path: '/docker',
        icon: Container,
      },
      {
        label: 'Kubernetes',
        path: '/kubernetes',
        icon: Boxes,
      },
    ],
  },
  {
    title: 'OBSERVABILITY',
    items: [
      {
        label: 'Monitoring',
        path: '/monitoring',
        icon: Activity,
      },
      {
        label: 'Logs',
        path: '/logs',
        icon: FileText,
      },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      {
        label: 'AI Assistant',
        path: '/ai',
        icon: Bot,
        badge: 'v1.0',
      },
      {
        label: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
      },
    ],
  },
];
