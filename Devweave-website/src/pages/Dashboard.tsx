import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, LogOut, User as UserIcon, Shield, Layers, Cpu, GitBranch, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { BackgroundVideo } from '../components/BackgroundVideo';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col justify-between overflow-x-hidden select-none font-sans antialiased">
      {/* Background Video */}
      <BackgroundVideo />

      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-black to-black pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Dashboard Top Header Navigation */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="liquid-glass rounded-full px-6 py-3.5 flex items-center justify-between border border-white/10 backdrop-blur-xl bg-black/50 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-white/5 border border-white/10">
              <Globe className="w-5 h-5 text-cyan-300" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">DevWeave</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-xs text-cyan-300 font-medium ml-2">
              Application Preview
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-white/70 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/10">
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>{user?.email}</span>
            </div>

            <button
              onClick={handleLogout}
              className="liquid-glass rounded-full px-4 py-2 text-xs font-semibold text-white/90 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-white/15 flex items-center gap-1.5 transition-all cursor-pointer group"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400 group-hover:translate-x-0.5 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Placeholder */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 my-auto py-16 text-center">
        <div className="liquid-glass rounded-3xl p-8 sm:p-12 border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl bg-black/40 space-y-8">
          
          {/* Welcome Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Workspace Active</span>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
              Welcome to DevWeave
            </h1>
            <p className="text-lg text-white/70 max-w-xl mx-auto">
              Your engineering workspace starts here.
            </p>
          </div>

          {/* User Session Profile Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto pt-4">
            <div className="liquid-glass p-4 rounded-2xl border border-white/10 text-left bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
                <UserIcon className="w-4 h-4 text-cyan-400" />
                <span>Logged in as</span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{user?.email || 'N/A'}</p>
            </div>

            <div className="liquid-glass p-4 rounded-2xl border border-white/10 text-left bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Assigned Role</span>
              </div>
              <p className="text-sm font-semibold text-cyan-300">{user?.role || 'Developer'}</p>
            </div>

            <div className="liquid-glass p-4 rounded-2xl border border-white/10 text-left bg-white/[0.02] sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Organization</span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{user?.company || 'DevWeave Platform'}</p>
            </div>
          </div>

          {/* Quick Modules Preview Grid */}
          <div className="pt-6 border-t border-white/10">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-4 font-semibold">
              Planned Application Modules (Prompt 9+)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { name: 'Repositories', icon: GitBranch },
                { name: 'Pipelines', icon: Layers },
                { name: 'Infrastructure', icon: Cpu },
                { name: 'AI Workflows', icon: ArrowUpRight },
              ].map((mod) => {
                const IconComponent = mod.icon;
                return (
                  <div
                    key={mod.name}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-center gap-2 text-white/60 hover:text-white hover:border-white/20 transition-all cursor-default"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{mod.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-white/40 border-t border-white/10">
        DevWeave Protected Dashboard • Auth Phase 2 Complete
      </footer>
    </div>
  );
};
