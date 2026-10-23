import * as React from 'react';
import { AlertTriangle, LogOut, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';

export type RevocationType = 'branch' | 'organization';

export interface AccessRevocationModalProps {
  isOpen: boolean;
  type: RevocationType;
  branchName?: string;
  organizationName?: string;
  remainingBranchName?: string;
  onProceed: () => void;
}

export function AccessRevocationModal({
  isOpen,
  type,
  branchName,
  organizationName,
  remainingBranchName,
  onProceed,
}: AccessRevocationModalProps) {
  if (!isOpen) return null;

  const isOrgRevocation = type === 'organization';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revocation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#14161a] border border-rose-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center space-y-5 animate-in zoom-in-95 duration-200">
        {/* Glow indicator */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-lg">
          {isOrgRevocation ? (
            <ShieldAlert className="w-7 h-7 text-rose-500 animate-pulse" />
          ) : (
            <AlertTriangle className="w-7 h-7 text-amber-400 animate-pulse" />
          )}
        </div>

        <div>
          <h2
            id="revocation-modal-title"
            className="text-lg sm:text-xl font-bold text-white tracking-tight"
          >
            {isOrgRevocation ? 'Organization Access Revoked' : 'Branch Access Revoked'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed">
            {isOrgRevocation ? (
              <>
                Your staff access to{' '}
                <span className="text-white font-semibold">
                  {organizationName || 'this organization'}
                </span>{' '}
                has been suspended or revoked by an administrator. Your personal account remains
                intact.
              </>
            ) : (
              <>
                An administrator has removed your access to{' '}
                <span className="text-white font-semibold">{branchName || 'this branch'}</span>.
                {remainingBranchName
                  ? ` You are being redirected to your assigned branch (${remainingBranchName}).`
                  : ' You are being redirected to the main launchpad.'}
              </>
            )}
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Button
            type="button"
            onClick={onProceed}
            className={`w-full h-10 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
              isOrgRevocation
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
                : 'bg-[#985184] hover:bg-[#b05f99] text-white shadow-lg shadow-purple-950/40'
            }`}
          >
            {isOrgRevocation ? (
              <>
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Organization</span>
              </>
            ) : (
              <>
                <span>
                  {remainingBranchName ? `Continue to ${remainingBranchName}` : 'Return to Launchpad'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
