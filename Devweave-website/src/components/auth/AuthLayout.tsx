import React, { type ReactNode } from 'react';
import { Globe, GitBranch, Terminal, Cpu, Sparkles, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BackgroundVideo } from '../BackgroundVideo';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

const FEATURE_PILLS = [
  { label: 'Unified CI/CD', icon: Terminal },
  { label: 'Kubernetes Ops', icon: Cpu },
  { label: 'AI Copilot', icon: Sparkles },
  { label: 'Repo Sync', icon: GitBranch },
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full bg-black text-white flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-x-hidden select-none font-sans antialiased">
      {/* Background Video Layer */}
      <BackgroundVideo />

      {/* Ambient Radial Gradient Overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/30 via-black/80 to-black pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Branding Column (Hidden on mobile/tablet, shown on lg+) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-8 pr-4">
          <div>
            {/* Logo */}
            <Link to="/" className="inline-flex items-center gap-3 group mb-8">
              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 group-hover:border-cyan-400/40 group-hover:bg-white/10 transition-all duration-300 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
                <Globe className="w-7 h-7 text-cyan-300 group-hover:rotate-12 transition-transform duration-500" />
              </div>
              <span className="font-bold text-3xl tracking-tight text-white group-hover:text-cyan-100 transition-colors">
                DevWeave
              </span>
            </Link>

            {/* Tagline */}
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
              Your engineering workflow, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300">connected.</span>
            </h1>

            {/* Description */}
            <p className="text-white/70 text-base lg:text-lg leading-relaxed max-w-lg mb-8">
              Manage development, deployment, infrastructure, monitoring, and AI assistance from one place.
            </p>

            {/* Feature Pills Grid */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {FEATURE_PILLS.map((pill) => {
                const IconComponent = pill.icon;
                return (
                  <div
                    key={pill.label}
                    className="liquid-glass rounded-xl p-3 flex items-center gap-3 border border-white/10 hover:border-white/20 transition-all shadow-md bg-white/[0.02]"
                  >
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-300">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-white/80">{pill.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Security Badge */}
          <div className="flex items-center gap-2 text-xs text-white/50 pt-4 border-t border-white/10">
            <ShieldCheck className="w-4 h-4 text-cyan-400/80" />
            <span>Enterprise-Grade Security & Development Platform</span>
          </div>
        </div>

        {/* Mobile Header Branding (Shown on mobile only) */}
        <div className="lg:hidden flex flex-col items-center text-center space-y-3 mb-2 pt-4">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <Globe className="w-6 h-6 text-cyan-300" />
            </div>
            <span className="font-bold text-2xl text-white tracking-tight">DevWeave</span>
          </Link>
          <p className="text-xs text-white/60">Your engineering workflow, connected.</p>
        </div>

        {/* Right Auth Form Column */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl bg-black/40 relative overflow-hidden">
            {/* Subtle inner top highlight line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
            
            {children}
          </div>
        </div>

      </div>
    </div>
  );
};
