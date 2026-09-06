import React from 'react';
import { Network, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { navigationConfig } from '../../config/navigation';
import { SidebarItem } from '../navigation/SidebarItem';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-30 glass-panel border-r border-white/[0.08] transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-[72px]' : 'w-[250px]'
      }`}
    >
      {/* Branding Header */}
      <div className="flex h-[68px] items-center justify-between px-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            <Network className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col leading-tight truncate">
              <span className="font-bold text-white tracking-tight text-base">
                DevWeave
              </span>
              <span className="text-[11px] text-white/50 font-medium tracking-wide uppercase">
                Engineering Platform
              </span>
            </div>
          )}
        </div>

        {/* Collapse button */}
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-none">
        {navigationConfig.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!isCollapsed ? (
              <h3 className="px-3 text-[11px] font-semibold tracking-wider text-white/40 uppercase mb-2">
                {group.title}
              </h3>
            ) : (
              <div className="my-2 border-t border-white/[0.06]" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Toggle for collapsed mode */}
      {isCollapsed && (
        <div className="p-3 border-t border-white/[0.08] flex justify-center">
          <button
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      )}
    </aside>
  );
};
