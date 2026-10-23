import * as React from 'react';
import { Shield, Sparkles, ArrowRight, CheckCircle2, Clock, Boxes, Receipt, BarChart3 } from 'lucide-react';

interface RoleChangeTransitionOverlayProps {
  isOpen: boolean;
  branchName: string;
  oldRole: string;
  newRole: string;
  onComplete: () => void;
}

const ROLE_META: Record<
  string,
  {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeBg: string;
    summary: string;
  }
> = {
  cashier: {
    title: 'Cashier',
    icon: Receipt,
    accentColor: 'text-sky-400',
    badgeBg: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    summary: 'POS register active. Drawer balances, rapid sales, and receipt stream enabled.',
  },
  storekeeper: {
    title: 'Storekeeper',
    icon: Boxes,
    accentColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    summary: 'Warehouse logistics active. Live catalog SKUs, GRN intake, and stock alerts enabled.',
  },
  manager: {
    title: 'Manager',
    icon: BarChart3,
    accentColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    summary: 'Executive overview active. Profit analytics, staff delegation, and catalog control enabled.',
  },
  owner: {
    title: 'Owner',
    icon: Shield,
    accentColor: 'text-[#fbb945]',
    badgeBg: 'bg-[#fbb945]/15 border-[#fbb945]/30 text-[#fbb945]',
    summary: 'Full executive control active across all branches and organization settings.',
  },
  accountant: {
    title: 'Accountant',
    icon: BarChart3,
    accentColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    summary: 'Financial audit active. Valuation reports, transaction logs, and P&L statements enabled.',
  },
};

export function RoleChangeTransitionOverlay({
  isOpen,
  branchName,
  oldRole,
  newRole,
  onComplete,
}: RoleChangeTransitionOverlayProps) {
  const [secondsRemaining, setSecondsRemaining] = React.useState(3);

  const normalizedNewRole = (newRole || 'member').toLowerCase();
  const normalizedOldRole = (oldRole || 'member').toLowerCase();

  const newMeta = ROLE_META[normalizedNewRole] || {
    title: newRole.charAt(0).toUpperCase() + newRole.slice(1),
    icon: Shield,
    accentColor: 'text-[#fbb945]',
    badgeBg: 'bg-[#985184]/20 border-[#985184]/40 text-purple-300',
    summary: 'Permissions reconfigured. Adapting dashboard layout.',
  };

  const oldMetaTitle = ROLE_META[normalizedOldRole]?.title || oldRole.charAt(0).toUpperCase() + oldRole.slice(1);
  const NewIcon = newMeta.icon;

  React.useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(3);
      return;
    }

    setSecondsRemaining(3);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  const progressPercent = ((3 - secondsRemaining) / 3) * 100;

  return (
    <div
      data-testid="role-change-transition-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-[#16181e] border border-[#2e3340] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6 text-slate-100">
        {/* Glow ambient background effect */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#985184]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[#fbb945]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header & Countdown Indicator */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#985184]/25 border border-[#985184]/50 flex items-center justify-center text-[#fbb945] shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Permissions Reconfigured</h3>
              <p className="text-[11px] text-slate-400">Live role transition in progress</p>
            </div>
          </div>

          <div
            data-testid="role-change-countdown"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-xs font-bold text-[#fbb945]"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{secondsRemaining}s</span>
          </div>
        </div>

        {/* Role Transformation Banner */}
        <div className="bg-[#111216] border border-[#242731] rounded-xl p-4 space-y-3 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Location:</span>
            <span className="font-semibold text-white truncate max-w-[200px]">{branchName}</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
            <div className="flex-1 text-center p-2 rounded-lg bg-white/5 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Previous Role</div>
              <div className="text-xs font-bold text-slate-300 mt-0.5 line-through opacity-70">{oldMetaTitle}</div>
            </div>

            <ArrowRight className="w-4 h-4 text-[#fbb945] shrink-0 animate-pulse" />

            <div className="flex-1 text-center p-2 rounded-lg bg-[#985184]/15 border border-[#985184]/40">
              <div className="text-[10px] text-[#fbb945] uppercase tracking-wider font-mono font-bold">New Role</div>
              <div className="text-xs font-extrabold text-white mt-0.5 flex items-center justify-center gap-1">
                <NewIcon className={`w-3.5 h-3.5 ${newMeta.accentColor}`} />
                <span>{newMeta.title}</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-[11px] text-slate-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{newMeta.summary}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 relative z-10">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>Swapping dashboard perspective...</span>
            <span className="text-[#fbb945] font-semibold">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#985184] via-[#c273a8] to-[#fbb945] transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${Math.max(progressPercent, 10)}%` }}
            />
          </div>
        </div>

        {/* Bottom CTA to Switch Immediately */}
        <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
          <p className="text-[11px] text-slate-400 leading-tight">
            Interactions frozen while view adapts.
          </p>

          <button
            type="button"
            data-testid="role-change-switch-now-btn"
            onClick={onComplete}
            className="px-4 py-2 text-xs font-bold bg-[#985184] hover:bg-[#854372] text-white rounded-xl shadow-md shadow-[#985184]/30 hover:shadow-lg hover:shadow-[#985184]/50 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <span>Switch Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
