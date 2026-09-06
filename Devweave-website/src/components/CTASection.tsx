import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';

const TRUST_METRICS = [
  { label: 'Repositories Managed', value: '1000+' },
  { label: 'Deployments', value: '250K+' },
  { label: 'Developers', value: 'Worldwide' },
  { label: 'AI Recommendations', value: 'Millions' },
];

export const CTASection: React.FC = () => {
  return (
    <section 
      id="cta" 
      className="relative z-10 w-full bg-black py-24 md:py-32 overflow-hidden select-none"
    >
      {/* Background soft radial ambient glow & faint grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/25 via-black to-black pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Glowing backdrop blur spheres */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Section Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        
        {/* Large Liquid Glass CTA Card */}
        <div className="liquid-glass rounded-3xl p-8 sm:p-12 md:p-16 text-center max-w-[1000px] mx-auto border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.9)] relative overflow-hidden group">
          
          {/* Subtle top ambient sheen */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-400/25 transition-all duration-700" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-transparent pointer-events-none" />

          {/* Small Label */}
          <span className="relative z-10 inline-block text-xs uppercase tracking-widest text-white/50 font-semibold mb-4">
            START BUILDING
          </span>

          {/* Large Heading */}
          <h2 className="relative z-10 text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Bring Your Entire Engineering Platform Together.
          </h2>

          {/* Description */}
          <p className="relative z-10 max-w-2xl mx-auto text-white/70 text-base md:text-lg leading-relaxed mt-6 font-normal">
            Stop switching between tools. Manage your repositories, deployments, infrastructure, monitoring, and AI workflows from one unified Internal Developer Platform.
          </p>

          {/* CTA Action Buttons */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            {/* Primary Button: Get Started */}
            <Link
              to="/register"
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-full px-8 py-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(56,189,248,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 group/btn cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>


            {/* Secondary Button: View Documentation */}
            <button className="w-full sm:w-auto liquid-glass rounded-full px-8 py-4 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer">
              <BookOpen className="w-4 h-4 text-cyan-400 opacity-80" />
              <span>View Documentation</span>
            </button>
          </div>

          {/* Trust Row Metrics Pills */}
          <div className="relative z-10 mt-14 pt-10 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
            {TRUST_METRICS.map((metric) => (
              <div 
                key={metric.label}
                className="liquid-glass rounded-full px-5 py-2 flex items-center gap-2 border border-white/10 text-xs text-white/80 shadow-md hover:border-white/25 hover:bg-white/10 hover:scale-105 transition-all cursor-pointer"
              >
                <span className="font-bold text-cyan-300">{metric.value}</span>
                <span className="text-white/60 font-medium">{metric.label}</span>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
};
