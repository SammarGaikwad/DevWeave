import React from 'react';
import { NavLink } from 'react-router-dom';
import type { NavItem } from '../../types/navigation';

interface SidebarItemProps {
  item: NavItem;
  isCollapsed: boolean;
  onItemClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  isCollapsed,
  onItemClick,
}) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onItemClick}
      title={isCollapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
          isCollapsed ? 'justify-center px-0' : ''
        } ${
          isActive
            ? 'bg-blue-500/12 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
            : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active side indicator */}
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          )}

          <Icon
            className={`h-5 w-5 shrink-0 transition-colors ${
              isActive ? 'text-blue-400' : 'text-white/50 group-hover:text-white'
            }`}
          />

          {!isCollapsed && (
            <span className="truncate flex-1 leading-none">{item.label}</span>
          )}

          {!isCollapsed && item.badge && (
            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
              {item.badge}
            </span>
          )}

          {/* Floating tooltip for collapsed view */}
          {isCollapsed && (
            <div className="pointer-events-none absolute left-full ml-3 hidden rounded-md bg-zinc-900 border border-white/10 px-2.5 py-1 text-xs font-medium text-white shadow-xl group-hover:block z-50 whitespace-nowrap">
              {item.label}
              {item.badge && <span className="ml-1.5 text-blue-400">({item.badge})</span>}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
};
