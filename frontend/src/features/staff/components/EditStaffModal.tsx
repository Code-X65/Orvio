import * as React from 'react';
import { X, Shield, Building2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { staffApi, type OrgRole, type BranchOption, type StaffMember } from '../api/staff-api';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  member: StaffMember | null;
  branches: BranchOption[];
  actorRole?: OrgRole;
}

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

export function EditStaffModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  member,
  branches,
  actorRole = 'owner',
}: EditStaffModalProps) {
  const [selectedRole, setSelectedRole] = React.useState<OrgRole>('storekeeper');
  const [scopeAll, setScopeAll] = React.useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = React.useState<string[]>([]);
  const [defaultBranchId, setDefaultBranchId] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Filter available roles based on actor tier (Managers cannot re-role to Manager or Owner)
  const availableRoles = React.useMemo(() => {
    if (actorRole === 'owner') return ROLE_DEFINITIONS;
    return ROLE_DEFINITIONS.filter((r) => r.role !== 'manager');
  }, [actorRole]);

  React.useEffect(() => {
    if (member && isOpen) {
      setSelectedRole(member.role);
      setScopeAll(member.scopeAllBranches);
      const branchIds = member.branches.map((b) => b.id);
      setSelectedBranchIds(branchIds.length > 0 ? branchIds : branches.map((b) => b.id));
      const defaultBranch = member.branches.find((b) => b.isDefault);
      setDefaultBranchId(defaultBranch ? defaultBranch.id : branchIds[0] || branches[0]?.id || '');
      setErrorMsg(null);
    }
  }, [member, isOpen, branches]);

  if (!isOpen || !member) return null;

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) => {
      let next: string[];
      if (prev.includes(branchId)) {
        if (prev.length === 1) return prev;
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

    if (!scopeAll && selectedBranchIds.length === 0) {
      setErrorMsg('Please select at least one branch for this employee');
      return;
    }

    setIsSubmitting(true);
    try {
      await staffApi.updateMember(orgId, member.membershipId, {
        role: selectedRole,
        branchIds: scopeAll ? [] : selectedBranchIds,
        defaultBranchId: scopeAll ? undefined : defaultBranchId,
        scopeAllBranches: scopeAll,
      });

      toast.success(`Updated permissions for ${member.fullName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to update member';
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
          <div>
            <h3 className="text-base font-bold text-white">Edit Staff Permissions</h3>
            <p className="text-xs text-slate-400">
              Modifying access for <span className="text-white font-medium">{member.fullName}</span> ({member.email})
            </p>
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

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Assigned Business Role
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
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
