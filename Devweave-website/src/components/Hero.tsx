import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  GitBranch,
  Kanban,
  Box,
  Cpu,
  Terminal,
  Activity,
  Sparkles,
  BarChart3
} from 'lucide-react';

interface Badge {
  name: string;
  icon: React.ElementType;
}

const BADGES: Badge[] = [
  { name: 'GitHub', icon: GitBranch },
  { name: 'Jira', icon: Kanban },
  { name: 'Docker', icon: Box },
  { name: 'Kubernetes', icon: Cpu },
  { name: 'Jenkins', icon: Terminal },
  { name: 'Monitoring', icon: Activity },
  { name: 'AI Assistant', icon: Sparkles },
  { name: 'Analytics', icon: BarChart3 },
];

export const Hero: React.FC = () => {
  return (
    <main className="relative z-10 flex flex-col items-center justify-center text-center px-4 min-h-[calc(100vh-100px)] max-w-7xl mx-auto pt-28 pb-16 select-none">
      {/* Platform Pill Badge */}
      <div className="liquid-glass rounded-full px-4 py-1.5 mb-6 flex items-center gap-2 shadow-inner hover:scale-105 transition-transform duration-300">
        <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-xs font-medium text-white/80 tracking-wide uppercase">
          The Next-Gen Internal Developer Platform
        </span>
      </div>

      {/* Main Title Heading in Instrument Serif */}
      <h1
        className="text-5xl md:text-6xl lg:text-7xl tracking-tight text-white whitespace-nowrap drop-shadow-2xl"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        Weave Every Developer Tool Into One Platform
      </h1>

      {/* Subtitle */}
      <p className="max-w-2xl text-white/75 leading-relaxed text-base md:text-lg mt-6 font-normal">
        Integrate GitHub, Jira, Jenkins, Docker, Kubernetes, Monitoring, Documentation, and AI into one intelligent Internal Developer Platform.
      </p>

      {/* Primary CTA Glass Container */}
      <div className="liquid-glass p-2 rounded-full flex flex-col sm:flex-row items-center gap-3 mt-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
        {/* Button 1: Get Started (Primary) */}
        <Link
          to="/register"
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-full px-8 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,140,255,0.4)] hover:shadow-[0_0_30px_rgba(110,231,255,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 group cursor-pointer"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>


        {/* Button 2: View Documentation (Secondary) */}
        <button className="w-full sm:w-auto liquid-glass rounded-full px-8 py-3.5 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer">
          <FileText className="w-4 h-4 opacity-75" />
          <span>View Documentation</span>
        </button>
      </div>

      {/* Feature Badges Section */}
      <div className="w-full max-w-4xl mt-12 overflow-hidden">
        <div className="flex items-center justify-start md:justify-center gap-3 overflow-x-auto no-scrollbar py-2 px-4 scroll-smooth">
          {BADGES.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.name}
                className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-xs md:text-sm text-white/90 whitespace-nowrap hover:bg-white/10 hover:border-white/30 hover:scale-105 transition-all duration-300 shadow-md cursor-pointer group shrink-0"
              >
                <Icon className="w-4 h-4 text-cyan-400 group-hover:scale-110 group-hover:text-blue-400 transition-all duration-300" />
                <span className="font-medium">{badge.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};
