import * as React from 'react';
import { Store, Loader2, ArrowRight, Sparkles } from 'lucide-react';

export interface BranchSwitchingOverlayProps {
  isVisible: boolean;
  fromBranchName?: string | null;
  toBranchName: string;
}

export function BranchSwitchingOverlay({
  isVisible,
  fromBranchName,
  toBranchName,
}: BranchSwitchingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Switching branch to ${toBranchName}`}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#111215]/90 backdrop-blur-md transition-all duration-300 animate-in fade-in"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Subtle Ambient Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#985184]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-sm text-center px-6 py-8 rounded-2xl border border-white/10 bg-[#16181d]/80 shadow-2xl shadow-black/80">
        {/* Animated Badge & Icon */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#985184]/30 to-[#fbb945]/10 border border-[#985184]/40 flex items-center justify-center shadow-lg shadow-[#985184]/20 animate-pulse">
            <Store className="w-8 h-8 text-[#fbb945]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#985184] flex items-center justify-center border-2 border-[#16181d] shadow-md">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          </div>
        </div>

        {/* Transition Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#985184]/15 border border-[#985184]/30 text-[#fbb945] mb-3">
          <Sparkles className="w-3 h-3 text-[#fbb945]" />
          Branch Context Switch
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white tracking-tight">
          Switching to <span className="text-[#fbb945]">{toBranchName}</span>
        </h3>

        {/* From -> To pill */}
        {fromBranchName && fromBranchName !== toBranchName && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-300 font-mono bg-white/5 border border-white/10 px-3 py-1 rounded-md">
            <span className="text-slate-400 truncate max-w-[120px]">{fromBranchName}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#985184] shrink-0" />
            <span className="text-white font-semibold truncate max-w-[120px]">{toBranchName}</span>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Synchronizing isolated catalog, category trees, and stock records...
        </p>

        {/* Subtle Progress Bar */}
        <div className="mt-5 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#985184] to-[#fbb945] rounded-full animate-[progress_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
