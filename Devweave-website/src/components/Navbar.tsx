import React from 'react';
import { Globe, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-6xl px-4 sm:px-6 pointer-events-auto select-none">
      <nav className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between transition-all duration-300 hover:shadow-[0_0_30px_rgba(56,189,248,0.2)] border border-white/10 backdrop-blur-xl bg-black/40">
        {/* Left Brand / Logo */}
        <div 
          onClick={scrollToTop}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="p-1.5 rounded-full bg-white/5 border border-white/10 group-hover:border-cyan-400/40 group-hover:bg-white/10 transition-all duration-300">
            <Globe className="w-5 h-5 text-white group-hover:rotate-12 group-hover:text-cyan-300 transition-all duration-500" />
          </div>
          <span className="font-semibold text-lg text-white tracking-tight group-hover:text-cyan-100 transition-colors">
            DevWeave
          </span>
        </div>

        {/* Center Navigation Links */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-white/75">
          <a 
            href="#architecture" 
            className="hover:text-white hover:scale-105 transition-all duration-200 py-1"
          >
            Platform
          </a>
          <a 
            href="#features" 
            className="hover:text-white hover:scale-105 transition-all duration-200 py-1"
          >
            Features
          </a>
          <a 
            href="#integrations" 
            className="hover:text-white hover:scale-105 transition-all duration-200 py-1"
          >
            Integrations
          </a>
          <a 
            href="#ai-assistant" 
            className="hover:text-white hover:scale-105 transition-all duration-200 py-1"
          >
            AI Assistant
          </a>
        </div>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/login"
            className="text-sm font-medium text-white/75 hover:text-white transition-colors"
          >
            Login
          </Link>

          <Link 
            to="/register"
            className="liquid-glass rounded-full px-5 py-2 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-1.5 shadow-lg group border border-white/15 hover:border-cyan-400/50"
          >
            <span>Get Started</span>
            <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-cyan-300" />
          </Link>
        </div>
      </nav>
    </header>
  );
};

