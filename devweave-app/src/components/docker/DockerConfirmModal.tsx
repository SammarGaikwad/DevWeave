import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Loader2, X } from 'lucide-react';

interface DockerConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel: string;
  isDestructive?: boolean;
  isProtected?: boolean;
  affectedResources?: string[];
  warningMessage?: string;
  checkboxOption?: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DockerConfirmModal: React.FC<DockerConfirmModalProps> = ({
  isOpen,
  title,
  description,
  actionLabel,
  isDestructive = false,
  isProtected = false,
  affectedResources = [],
  warningMessage,
  checkboxOption,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-slate-700/60 shadow-2xl bg-slate-900/95 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            {isProtected ? (
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
            ) : isDestructive ? (
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <CheckCircle className="w-6 h-6" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">Confirmation required</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Protected Alert Banner */}
        {isProtected && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-red-200">
              <ShieldAlert className="w-4 h-4 text-red-400" /> Protected Production Resource
            </div>
            <p className="text-xs text-red-300/90 leading-relaxed">
              This resource is marked as protected by the DevWeave security policy. Modifying, stopping, restarting, or deleting protected resources is strictly denied to ensure operational safety.
            </p>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-slate-300 leading-relaxed">{description}</p>

        {/* Warning Message */}
        {warningMessage && !isProtected && (
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Affected Resources */}
        {affectedResources.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Affected Dependencies / Resources ({affectedResources.length})
            </span>
            <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-slate-300 font-mono">
              {affectedResources.map((res, i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                  <span>{res}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checkbox option (e.g. stopFirst) */}
        {checkboxOption && !isProtected && (
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkboxOption.checked}
              onChange={(e) => checkboxOption.onChange(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
            />
            <span>{checkboxOption.label}</span>
          </label>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProtected || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-xl flex items-center space-x-2 transition ${
              isProtected
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : isDestructive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{actionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
