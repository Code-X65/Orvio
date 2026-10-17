import * as React from 'react';
import { X, Mail, Shield, Building2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { staffApi, type OrgRole, type BranchOption } from '../api/staff-api';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  branches: BranchOption[];
  actorRole?: OrgRole;
  contextApp?: string;
  contextBranchId?: string;
  installedApps?: Array<{ key: string; name: string }>;
}

const DEFAULT_WORKSPACE_APPS: Array<{ key: string; name: string }> = [
  { key: 'inventory', name: 'Inventory & Stock' },
  { key: 'pos', name: 'Point of Sale (POS)' },
  { key: 'gym', name: 'Gym & Fitness Management' },
];

const ROLE_DEFINITIONS: Array<{
  role: OrgRole;
  title: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
}> = [
  {
    role: 'manager',
    title: 'Manager',
    badgeColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20',
    description: 'Branch operations, catalog & product management, and team delegation.',
  },
  {
    role: 'storekeeper',
    title: 'Storekeeper',
    badgeColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/20',
    description: 'Stock counting, reasoned adjustments, GRN receipts, and warehouse transfers.',
  },
  {
    role: 'cashier',
    title: 'Cashier',
    badgeColor: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 border-sky-500/20',
    description: 'Point of sale, sales orders, customer checkout, and returns (Catalog read-only).',
  },
  {
    role: 'accountant',
    title: 'Accountant',
    badgeColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
    description: 'Financial reporting, inventory valuation, and audit trail review (Read-only).',
  },
];

export function InviteStaffModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  branches,
  actorRole = 'owner',
  contextApp,
  contextBranchId,
  installedApps = DEFAULT_WORKSPACE_APPS,
}: InviteStaffModalProps) {
  const [email, setEmail] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<OrgRole>('storekeeper');
  const [scopeAll, setScopeAll] = React.useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = React.useState<string[]>(() => {
    if (contextBranchId) return [contextBranchId];
    return branches.length > 0 ? [branches[0].id] : [];
  });
  const [defaultBranchId, setDefaultBranchId] = React.useState<string>(() => {
    if (contextBranchId) return contextBranchId;
    return branches.length > 0 ? branches[0].id : '';
  });
  const [selectedApps, setSelectedApps] = React.useState<string[]>(() => {
    if (contextApp) return [contextApp.toLowerCase()];
    return installedApps.map((a) => a.key.toLowerCase());
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Filter available roles based on actor tier (Managers cannot invite Managers or Owners)
  const availableRoles = React.useMemo(() => {
    if (actorRole === 'owner') return ROLE_DEFINITIONS;
    return ROLE_DEFINITIONS.filter((r) => r.role !== 'manager');
  }, [actorRole]);

  // Reset state on open
  React.useEffect(() => {
    if (isOpen) {
      setEmail('');
      setSelectedRole(availableRoles[0]?.role || 'storekeeper');
      setScopeAll(false);
      const initialBranchIds = contextBranchId
        ? [contextBranchId]
        : branches.length > 0
        ? [branches[0].id]
        : [];
      setSelectedBranchIds(initialBranchIds);
      setDefaultBranchId(contextBranchId || (branches.length > 0 ? branches[0].id : ''));
      setSelectedApps(
        contextApp
          ? [contextApp.toLowerCase()]
          : installedApps.map((a) => a.key.toLowerCase())
      );
      setErrorMsg(null);
    }
  }, [isOpen, branches, availableRoles, contextApp, contextBranchId, installedApps]);

  if (!isOpen) return null;

  const handleToggleApp = (appKey: string) => {
    if (contextApp) return; // Locked in context mode
    setSelectedApps((prev) => {
      if (prev.includes(appKey)) {
        if (prev.length === 1) return prev; // Keep at least one app
        return prev.filter((k) => k !== appKey);
      }
      return [...prev, appKey];
    });
  };

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) => {
      let next: string[];
      if (prev.includes(branchId)) {
        if (prev.length === 1) return prev; // Keep at least one branch selected
        next = prev.filter((id) => id !== branchId);
      } else {
        next = [...prev, branchId];
      }
      if (!next.includes(defaultBranchId)) {
        setDefaultBranchId(next[0] || '');
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    if (!scopeAll && selectedBranchIds.length === 0) {
      setErrorMsg('Please select at least one branch for this employee');
      return;
    }

    if (selectedApps.length === 0) {
      setErrorMsg('Please assign at least one application for this employee');
      return;
    }

    setIsSubmitting(true);
    try {
      await staffApi.inviteStaff(orgId, {
        email: cleanEmail,
        role: selectedRole,
        branchIds: scopeAll ? undefined : selectedBranchIds,
        defaultBranchId: scopeAll ? undefined : defaultBranchId,
        scopeAllBranches: scopeAll,
        appKeys: selectedApps,
      });

      toast.success(`Invitation sent to ${cleanEmail}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to send invitation';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2b2f3a] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#fbb945]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Invite Team Member</h3>
              <p className="text-xs text-slate-400">
                Send an invitation to join your workspace with assigned role and branch scope.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Staff Email Address <span className="text-[#fbb945]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. employee@company.com"
              required
              className="w-full bg-[#121418] border border-[#2b2f3a] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#714b67] focus:ring-1 focus:ring-[#714b67]"
            />
          </div>

          {/* Context App Banner (When invited from within an app) */}
          {contextApp ? (
            <div className="p-3 bg-[#714b67]/15 border border-[#714b67]/30 rounded-lg text-xs text-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white uppercase tracking-wider text-[10px] bg-[#714b67] px-2 py-0.5 rounded">
                  App Scoped
                </span>
                <span>Inviting staff to <strong>{contextApp.toUpperCase()}</strong> application.</span>
              </div>
              {contextBranchId && (
                <span className="text-[11px] text-[#fbb945] font-medium">
                  Active Branch
                </span>
              )}
            </div>
          ) : (
            /* Multi-app Picker (When invited from /employees) */
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
                <span>Application Access</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Select apps this employee can access
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {installedApps.map((app) => {
                  const isChecked = selectedApps.includes(app.key.toLowerCase());
                  return (
                    <label
                      key={app.key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[#714b67]/15 border-[#714b67] text-white font-medium'
                          : 'bg-[#121418] border-[#2b2f3a] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleApp(app.key.toLowerCase())}
                        className="rounded border-[#2b2f3a] text-[#714b67] focus:ring-[#714b67] bg-[#181a20]"
                      />
                      <span className="truncate">{app.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
              <span>Select Role</span>
              <span className="text-[11px] text-slate-500 font-normal">
                Owner role cannot be invited
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableRoles.map((r) => {
                const isSelected = selectedRole === r.role;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setSelectedRole(r.role)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#714b67]/15 border-[#714b67] text-white shadow-sm'
                        : 'bg-[#121418] border-[#2b2f3a] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        {r.title}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${r.badgeBg} ${r.badgeColor}`}
                      >
                        {r.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {r.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Branch Access Assignment */}
          <div className="space-y-3 pt-2 border-t border-[#2b2f3a]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Branch Access Scoping
              </label>

              {actorRole === 'owner' && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeAll}
                    onChange={(e) => setScopeAll(e.target.checked)}
                    className="rounded border-[#2b2f3a] text-[#714b67] focus:ring-[#714b67] bg-[#121418]"
                  />
                  <span>All Branches (Global)</span>
                </label>
              )}
            </div>

            {!scopeAll ? (
              <div className="bg-[#121418] border border-[#2b2f3a] rounded-lg p-3 space-y-2">
                <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                  <span>Select authorized branches:</span>
                  <span className="text-slate-500">Pick default branch</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {branches.map((b) => {
                    const isChecked = selectedBranchIds.includes(b.id);
                    const isDefault = defaultBranchId === b.id;

                    return (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between p-2 rounded border text-xs transition-colors ${
                          isChecked
                            ? 'bg-white/5 border-[#3b3f4d] text-slate-200'
                            : 'bg-transparent border-transparent text-slate-500'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleBranch(b.id)}
                            className="rounded border-[#2b2f3a] text-[#714b67] focus:ring-[#714b67] bg-[#181a20]"
                          />
                          <span className="font-medium text-slate-200">{b.name}</span>
                          {b.code && (
                            <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                              {b.code}
                            </span>
                          )}
                          {b.is_primary && (
                            <span className="text-[10px] text-[#fbb945] bg-[#fbb945]/10 px-1.5 py-0.5 rounded font-medium">
                              HQ / Primary
                            </span>
                          )}
                        </label>

                        {isChecked && (
                          <button
                            type="button"
                            onClick={() => setDefaultBranchId(b.id)}
                            className={`text-[10px] px-2 py-0.5 rounded transition-all font-medium ${
                              isDefault
                                ? 'bg-[#714b67] text-white'
                                : 'text-slate-400 hover:text-white bg-white/5'
                            }`}
                          >
                            {isDefault ? 'Default Branch' : 'Set Default'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#714b67]/10 border border-[#714b67]/30 rounded-lg text-xs text-purple-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-[#fbb945] shrink-0" />
                <span>
                  This employee will have organization-wide access to all existing and future branches.
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#2b2f3a] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-transparent hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#714b67] hover:bg-[#87597b] rounded-lg shadow-md shadow-[#714b67]/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending Invitation...</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
