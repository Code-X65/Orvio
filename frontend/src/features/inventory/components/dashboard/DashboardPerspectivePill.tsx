import * as React from 'react';
import { Eye, Shield, Boxes, ShoppingBag } from 'lucide-react';

export type DashboardPerspective = 'executive' | 'storekeeper' | 'cashier';

interface DashboardPerspectivePillProps {
  currentPerspective: DashboardPerspective;
  onChangePerspective: (perspective: DashboardPerspective) => void;
  isElevated: boolean;
}

export function DashboardPerspectivePill({
  currentPerspective,
  onChangePerspective,
  isElevated,
}: DashboardPerspectivePillProps) {
  if (!isElevated) return null;

  return (
    <div
      data-testid="dashboard-perspective-pill"
      className="inline-flex items-center gap-1 bg-[#14161a] border border-[#2b2f3a] p-1 rounded-xl shadow-inner text-xs"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-400 select-none">
        <Eye className="w-3.5 h-3.5 text-[#fbb945]" />
        <span className="hidden sm:inline">Perspective:</span>
      </div>

      <button
        type="button"
        onClick={() => onChangePerspective('executive')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
          currentPerspective === 'executive'
            ? 'bg-[#985184] text-white shadow-md shadow-[#985184]/40'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Executive</span>
      </button>

      <button
        type="button"
        onClick={() => onChangePerspective('storekeeper')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
          currentPerspective === 'storekeeper'
            ? 'bg-[#985184] text-white shadow-md shadow-[#985184]/40'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Boxes className="w-3.5 h-3.5" />
        <span>Storekeeper</span>
      </button>

      <button
        type="button"
        onClick={() => onChangePerspective('cashier')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
          currentPerspective === 'cashier'
            ? 'bg-[#985184] text-white shadow-md shadow-[#985184]/40'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        <span>Cashier</span>
      </button>
    </div>
  );
}
