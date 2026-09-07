import React, { useEffect } from 'react';
import { Network, X } from 'lucide-react';
import { navigationConfig } from '../../config/navigation';
import { SidebarItem } from '../navigation/SidebarItem';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
}) => {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex select-none">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="relative flex w-4/5 max-w-xs h-full flex-col bg-[#0a0a0a] border-r border-white/[0.08] shadow-2xl z-10">
        {/* Branding & Close button */}
        <div className="flex h-[68px] items-center justify-between px-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Network className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-white tracking-tight text-base">
                DevWeave
              </span>
              <span className="text-[11px] text-white/50 font-medium tracking-wide uppercase">
                Engineering Platform
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigationConfig.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <h3 className="px-3 text-[11px] font-semibold tracking-wider text-white/40 uppercase mb-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.path}
                    item={item}
                    isCollapsed={false}
                    onItemClick={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
