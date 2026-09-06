import React from 'react';
import { Container, HardDrive, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';

export const Docker: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Docker Management</h1>
            <StatusBadge status="Pending" customLabel="Upcoming Phase" />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Container registry management, image scanning, and runtime inspection.
          </p>
        </div>
      </div>

      <GlassCard className="p-8 text-center space-y-4 max-w-2xl mx-auto my-12">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
          <Container className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white">Docker Module</h3>
        <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
          This module is being built. Docker Daemon integration and Registry management will be available in the next development phase.
        </p>
        <div className="pt-2 flex justify-center items-center gap-4 text-xs text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" /> Image Registries
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Trivy Vulnerability Scans
          </span>
        </div>
      </GlassCard>
    </div>
  );
};
