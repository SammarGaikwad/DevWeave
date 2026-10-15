import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  GitBranch,
  ShieldCheck,
  Server,
  Database,
  User,
  KeyRound,
  RefreshCw,
  Lock,
  Globe,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  settingsService,
  type PlatformSettingsOverview,
} from '../services/settingsService';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSettingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'integrations' | 'profile' | 'environment'>('integrations');
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getOverview();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <SettingsIcon className="h-7 w-7 text-zinc-400" />
              Platform Settings
            </h1>
            <StatusBadge status="Healthy" customLabel="Config Synchronized" />
          </div>
          <p className="text-sm text-white/60 mt-1">
            Service connections, OAuth credentials, access management, and deployment environment parameters.
          </p>
        </div>

        <button
          onClick={() => void fetchSettings()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/80 hover:text-white hover:bg-white/[0.08] text-xs font-medium transition-all disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>Reload Config</span>
        </button>
      </div>

      {/* 2. Zero-Secret Disclosure Guarantee */}
      <GlassCard className="p-4 border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
        <Lock className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-white/70 leading-relaxed">
          <span className="font-semibold text-emerald-300 block">Zero Plaintext Secret Exposure Policy</span>
          <p>
            In strict compliance with DevWeave security governance, GitHub tokens, Jenkins credentials, and database connection strings are AES-256-GCM encrypted at rest and irreversibly masked before transmission to the browser client. Plain secret values are never rendered in frontend DOM elements.
          </p>
        </div>
      </GlassCard>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-white/[0.08] gap-4">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'integrations'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Service Integrations
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <User className="h-4 w-4" />
          Developer Identity & RBAC
        </button>
        <button
          onClick={() => setActiveTab('environment')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'environment'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Globe className="h-4 w-4" />
          Runtime Environment
        </button>
      </div>

      {/* 4. Tab 1: Service Integrations */}
      {activeTab === 'integrations' && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GitHub Integration Card */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">GitHub OAuth Integration</h3>
                  <p className="text-xs text-white/50">Source control repository synchronization</p>
                </div>
              </div>
              <StatusBadge
                status={settings.integrations.github.connected ? 'Healthy' : 'Pending'}
                customLabel={settings.integrations.github.connected ? 'Connected' : 'Not Linked'}
                size="sm"
              />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">Linked Account</span>
                <span className="font-semibold text-white font-mono">
                  {settings.integrations.github.username || 'Unlinked'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">OAuth Client ID</span>
                <span className="font-mono text-zinc-400 select-all">
                  {settings.integrations.github.clientIdMasked}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">OAuth Callback URL</span>
                <span className="font-mono text-zinc-400 truncate max-w-[220px]" title={settings.integrations.github.callbackUrl}>
                  {settings.integrations.github.callbackUrl}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">Access Token</span>
                <span className="font-mono text-emerald-400">
                  {settings.integrations.github.tokenMasked || '••••••••••••••••'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-purple-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Scopes: repo, user, workflow, read:org</span>
            </div>
          </GlassCard>

          {/* Jenkins Integration Card */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Jenkins CI Engine</h3>
                  <p className="text-xs text-white/50">Remote pipeline triggering & build logs</p>
                </div>
              </div>
              <StatusBadge status="Healthy" customLabel="Configured" size="sm" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">Server Endpoint</span>
                <span className="font-mono text-amber-300 break-all">{settings.integrations.jenkins.url}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">Jenkins Service User</span>
                <span className="font-mono text-white font-semibold">{settings.integrations.jenkins.username}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">API Token</span>
                <span className="font-mono text-emerald-400">{settings.integrations.jenkins.tokenMasked}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-white/50">Default Job Item</span>
                <span className="font-mono text-white/80">{settings.integrations.jenkins.defaultJob}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-amber-400">
              <KeyRound className="h-4 w-4" />
              <span>Jenkins Crumb Issuer / CSRF Protection Active</span>
            </div>
          </GlassCard>

          {/* Database Integration Card */}
          <GlassCard className="p-6 space-y-4 lg:col-span-2">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">PostgreSQL Persistence Engine</h3>
                  <p className="text-xs text-white/50">Managed relational store and Prisma ORM layer</p>
                </div>
              </div>
              <StatusBadge status="Healthy" customLabel="Supabase Active" size="sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-white/40 block">Host & Service</span>
                <span className="font-semibold text-white">{settings.integrations.database.type}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-white/40 block">Connection Topology</span>
                <span className="font-semibold text-white">{settings.integrations.database.pooling}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1">
                <span className="text-white/40 block">Masked URI</span>
                <span className="font-mono text-zinc-300 truncate block">
                  {settings.integrations.database.connectionStringMasked}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 5. Tab 2: Developer Identity & RBAC */}
      {activeTab === 'profile' && settings && (
        <GlassCard className="p-6 space-y-6 max-w-2xl">
          <div className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xl">
              {settings.user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{settings.user.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  {settings.user.role}
                </span>
              </div>
              <p className="text-xs text-white/50">{settings.user.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-white/50">User ID</span>
              <span className="font-mono text-white/80">{settings.user.id}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-white/50">Role-Based Access Level</span>
              <span className="font-mono text-emerald-400">Full Developer & Pipeline Execution Rights</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
              <span className="text-white/50">Account Registered</span>
              <span className="text-white/80">{new Date(settings.user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 6. Tab 3: Runtime Environment */}
      {activeTab === 'environment' && settings && (
        <GlassCard className="p-6 space-y-4 max-w-3xl">
          <div className="border-b border-white/[0.08] pb-4">
            <h3 className="text-base font-semibold text-white">Backend Environment Configuration</h3>
            <p className="text-xs text-white/50 mt-0.5">Parameters initialized from system environment variables</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
              <span className="text-white/40 block text-[11px]">NODE_ENV</span>
              <span className="text-emerald-400 font-bold">{settings.environment.nodeEnv}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
              <span className="text-white/40 block text-[11px]">PORT</span>
              <span className="text-blue-400 font-bold">{settings.environment.port}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
              <span className="text-white/40 block text-[11px]">FRONTEND_URL</span>
              <span className="text-zinc-300">{settings.environment.frontendUrl}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-black/40 border border-white/[0.08] space-y-1">
              <span className="text-white/40 block text-[11px]">JWT_EXPIRES_IN</span>
              <span className="text-zinc-300">{settings.environment.jwtExpiresIn}</span>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
