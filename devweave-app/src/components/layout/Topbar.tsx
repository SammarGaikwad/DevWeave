import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Bell,
  CircleHelp,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  HelpCircle,
  Keyboard,
  LogOut,
  Sliders,
  X,
  FileCode,
  Box,
  Layers,
} from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { IconButton } from '../ui/IconButton';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activePopover, setActivePopover] = useState<'notifications' | 'help' | 'profile' | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const popoverRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setActivePopover(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePopover = (name: 'notifications' | 'help' | 'profile') => {
    setActivePopover((prev) => (prev === name ? null : name));
  };

  const handleLogout = async () => {
    setActivePopover(null);
    await logout();
    navigate('/login');
  };

  const mockSearchResults = [
    { title: 'Repositories', category: 'Workspace', path: '/repositories', icon: FileCode },
    { title: 'CI/CD Pipelines', category: 'Delivery', path: '/pipelines', icon: Layers },
    { title: 'Kubernetes Workloads', category: 'Infrastructure', path: '/kubernetes', icon: Box },
    { title: 'AI Assistant', category: 'Intelligence', path: '/ai', icon: Sparkles },
  ].filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      <header className="sticky top-0 z-20 h-[68px] glass-panel border-b border-white/[0.08] px-4 md:px-6 flex items-center justify-between">
        {/* Left Section: Mobile Menu + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <IconButton
            icon={<Menu className="h-5 w-5" />}
            label="Open menu"
            onClick={onOpenMobileMenu}
            className="md:hidden"
          />
          <Breadcrumbs />
        </div>

        {/* Center Section: Global Search UI */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.05] hover:border-white/15 transition-all duration-150 group"
          >
            <div className="flex items-center gap-2.5">
              <Search className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
              <span>Search DevWeave...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/50">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-1 sm:gap-2" ref={popoverRef}>
          {/* Search button for mobile */}
          <IconButton
            icon={<Search className="h-5 w-5" />}
            label="Search"
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden"
          />

          {/* Notifications */}
          <div className="relative">
            <IconButton
              icon={<Bell className="h-5 w-5" />}
              label="Notifications"
              badge={true}
              active={activePopover === 'notifications'}
              onClick={() => togglePopover('notifications')}
            />
            {activePopover === 'notifications' && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl glass-panel bg-[#0a0a0a]/95 border border-white/10 shadow-2xl p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h4 className="text-sm font-semibold text-white">Notifications</h4>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    Mock Data
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-white/90">Jenkins build completed</p>
                      <p className="text-white/50 text-[11px]">Pipeline #142 passed standard suite</p>
                      <span className="text-white/30 text-[10px]">2m ago</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-white/90">Deployment is healthy</p>
                      <p className="text-white/50 text-[11px]">Cluster prod-us-east-1 operational</p>
                      <span className="text-white/30 text-[10px]">15m ago</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <Sparkles className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-white/90">AI analysis completed</p>
                      <p className="text-white/50 text-[11px]">No vulnerability regressions detected</p>
                      <span className="text-white/30 text-[10px]">1h ago</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <div className="relative">
            <IconButton
              icon={<CircleHelp className="h-5 w-5" />}
              label="Help & Documentation"
              active={activePopover === 'help'}
              onClick={() => togglePopover('help')}
            />
            {activePopover === 'help' && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass-panel bg-[#0a0a0a]/95 border border-white/10 shadow-2xl p-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setActivePopover(null);
                    alert('Documentation standard center placeholder.');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-blue-400" />
                  Documentation
                </button>
                <button
                  onClick={() => {
                    setActivePopover(null);
                    alert('Support channel placeholder.');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <HelpCircle className="h-4 w-4 text-emerald-400" />
                  Support
                </button>
                <button
                  onClick={() => {
                    setActivePopover(null);
                    setIsSearchOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <Keyboard className="h-4 w-4 text-purple-400" />
                  Keyboard Shortcuts (⌘K)
                </button>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => togglePopover('profile')}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              aria-label="User profile menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-white/90">
                {user?.name || 'Developer'}
              </span>
            </button>

            {activePopover === 'profile' && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass-panel bg-[#0a0a0a]/95 border border-white/10 shadow-2xl p-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold text-white truncate">{user?.name || 'Developer'}</p>
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded uppercase">
                      {user?.role || 'DEVELOPER'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 truncate">{user?.email || 'developer@devweave.local'}</p>
                </div>

                <button
                  onClick={() => {
                    setActivePopover(null);
                    alert('Profile management placeholder.');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <User className="h-4 w-4 text-white/50" />
                  Profile
                </button>

                <button
                  onClick={() => {
                    setActivePopover(null);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <Sliders className="h-4 w-4 text-white/50" />
                  Settings
                </button>

                <div className="my-1 border-t border-white/10" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Dialog Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-xl glass-panel bg-[#0a0a0a]/95 rounded-2xl border border-white/15 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 border-b border-white/10">
              <Search className="h-5 w-5 text-white/40 mr-3 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search modules, pipelines, deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-4 bg-transparent text-white text-sm focus:outline-none placeholder-white/40"
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto">
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider px-3 py-1">
                Suggested Modules
              </p>
              <div className="mt-1 space-y-1">
                {mockSearchResults.map((res) => {
                  const ResIcon = res.icon;
                  return (
                    <button
                      key={res.path}
                      onClick={() => {
                        setIsSearchOpen(false);
                        navigate(res.path);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-left transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 group-hover:border-blue-500/40 text-blue-400">
                          <ResIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{res.title}</p>
                          <p className="text-[10px] text-white/40">{res.category}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-white/30 group-hover:text-blue-400">Jump to →</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">ESC</kbd> to exit search</span>
              <span>Search UI framework preview</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
