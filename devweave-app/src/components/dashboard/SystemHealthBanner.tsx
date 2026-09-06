import React from 'react';
import { ShieldCheck, Activity, AlertOctagon } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { systemHealthData } from '../../data/dashboardData';

export const SystemHealthBanner: React.FC = () => {
  return (
    <GlassCard className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-transparent to-transparent p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Status Title & Message */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                System Health
              </h2>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
              </span>
              <span className="text-sm font-bold text-emerald-400">
                {systemHealthData.status}
              </span>
              <span className="text-[10px] uppercase font-bold text-white/40 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">
                Demo data
              </span>
            </div>
            <p className="text-sm sm:text-base font-medium text-white/90">
              {systemHealthData.message}
            </p>
          </div>
        </div>

        {/* Right Side: Quick Health Stats */}
        <div className="flex items-center gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] text-white/60">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase font-medium">Services</p>
              <p className="text-sm font-mono font-bold text-white">
                {systemHealthData.servicesHealthy} / {systemHealthData.servicesTotal}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.04] text-emerald-400">
              <AlertOctagon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase font-medium">Incidents</p>
              <p className="text-sm font-mono font-bold text-emerald-400">
                {systemHealthData.incidents}
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
