import type { ComponentType } from 'react';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}
