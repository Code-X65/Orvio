import * as React from 'react';
import { X, Shield, Building2, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { staffApi, type OrgRole, type BranchOption, type StaffMember } from '../api/staff-api';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  member: StaffMember | null;
  branches: BranchOption[];
  contextBranchId?: string;
  activeBranchId?: string;
  activeBranchName?: string;
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
    description: 'Point of sale, sales orders, customer checkout, and returns.',
  },
  {
    role: 'accountant',
    title: 'Accountant',
    badgeColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
    description: 'Financial reporting, inventory valuation, and audit trail review.',
  },
];

export function EditStaffModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  member,
  branches,
  contextBranchId,
  activeBranchId,
  activeBranchName,
  actorRole = 'owner',
}: EditStaffModalProps) {
  const branchContextId = (contextBranchId && contextBranchId !== 'all')
    ? contextBranchId
    : (activeBranchId && activeBranchId !== 'all')
    ? activeBranchId
    : undefined;

  const isBranchContext = Boolean(branchContextId);

  // Determine effective target branch
  const effectiveBranchId = React.useMemo(() => {
    if (branchContextId) return branchContextId;
    if (member && member.branches.length > 0) return member.branches[0].id;
    return branches[0]?.id || '';
  }, [branchContextId, member, branches]);

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>(effectiveBranchId);
  const [selectedRole, setSelectedRole] = React.useState<OrgRole>('cashier');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Available roles: managers cannot promote to Manager or Owner
  const availableRoles = React.useMemo(() => {
    if (actorRole === 'owner') return ROLE_DEFINITIONS;
    return ROLE_DEFINITIONS.filter((r) => r.role !== 'manager');
  }, [actorRole]);

  // Synchronize initial role when modal opens or target branch changes
  React.useEffect(() => {
    if (member && isOpen) {
      const targetBranch = effectiveBranchId;
      setSelectedBranchId(targetBranch);
      setShowRevokeConfirm(false);
      setErrorMsg(null);

      // Determine the staff member's role for this branch
      const branchRole =
        (member.branchRoles && member.branchRoles[targetBranch]) ||
        member.branches.find((b) => b.id === targetBranch)?.role ||
        (member.scopeAllBranches ? member.role : undefined) ||
        member.role;

      if (branchRole && branchRole !== 'owner') {
        setSelectedRole(branchRole);
      } else {
        setSelectedRole('cashier');
      }
    }
  }, [member, isOpen, effectiveBranchId]);

  // Resolve target branch object & display name
  const currentBranchObj = React.useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  const resolvedBranchName =
    (isBranchContext && activeBranchName) ||
    currentBranchObj?.name ||
    'Selected Branch';

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchToUpdate = isBranchContext ? branchContextId! : selectedBranchId;
    if (!branchToUpdate) {
      setErrorMsg('Please select a branch to configure');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await staffApi.updateBranchRole(
        orgId,
        member.membershipId,
        branchToUpdate,
        selectedRole
      );

      const roleTitle = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
      toast.success(
        `Updated role for ${member.fullName} in ${resolvedBranchName} to ${roleTitle}`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to update branch role';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeBranchAccess = async () => {
    const branchToRevoke = isBranchContext ? branchContextId! : selectedBranchId;
    if (!branchToRevoke) return;

    setIsRevoking(true);
    setErrorMsg(null);

    try {
      await staffApi.revokeBranchAccess(
        orgId,
        member.membershipId,
        branchToRevoke
      );

      toast.info(
        `Revoked access to ${resolvedBranchName} for ${member.fullName}`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to revoke branch access';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsRevoking(false);
      setShowRevokeConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2b2f3a] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#fbb945]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Staff Permissions</h3>
              <p className="text-xs text-slate-400">
                Modifying access for <span className="text-white font-medium">{member.fullName}</span> ({member.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Branch Access Scoping - Just like InviteStaffModal */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Branch Scope
            </label>

            {isBranchContext ? (
              <div className="bg-[#121418] border border-[#2b2f3a] rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-purple-300">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {resolvedBranchName}
                      </span>
                      {currentBranchObj?.code && (
                        <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                          {currentBranchObj?.code}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Role and permissions will be applied exclusively to this branch.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-medium shrink-0">
                  Active Context
                </span>
              </div>
            ) : (
              <div className="bg-[#121418] border border-[#2b2f3a] rounded-lg p-3 flex items-center justify-between">
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#714b67]" />
                  <span className="text-slate-400">Target Branch:</span>
                </div>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    setSelectedBranchId(bId);
                    const role =
                      (member.branchRoles && member.branchRoles[bId]) ||
                      member.branches.find((b) => b.id === bId)?.role ||
                      (member.scopeAllBranches ? member.role : 'cashier');
                    if (role && role !== 'owner') setSelectedRole(role);
                  }}
                  className="bg-[#181a20] border border-[#2b2f3a] text-slate-200 text-xs rounded px-2.5 py-1.5 font-medium focus:outline-none focus:border-[#714b67]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Single Focused Role Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Assigned Role in {resolvedBranchName}
              </label>
              <span className="text-[11px] text-slate-400">
                Determines permissions & dashboard view
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableRoles.map((r) => {
                const isSelected = selectedRole === r.role;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setSelectedRole(r.role)}
                    className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#714b67]/20 border-[#714b67] text-white shadow-sm ring-1 ring-[#714b67]'
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

          {/* Revoke Access Notice & Action */}
          <div className="pt-3 border-t border-[#2b2f3a]">
            {showRevokeConfirm ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg space-y-2.5 text-xs text-rose-300">
                <div className="font-semibold flex items-center gap-1.5 text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Confirm Revoking Branch Access</span>
                </div>
                <p className="leading-relaxed">
                  Are you sure you want to remove <span className="font-bold text-white">{member.fullName}</span> from{' '}
                  <span className="font-bold text-white">{resolvedBranchName}</span>? If active in this branch, they will be disconnected immediately.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRevokeConfirm(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRevokeBranchAccess}
                    disabled={isRevoking}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors flex items-center gap-1"
                  >
                    {isRevoking ? 'Revoking...' : 'Yes, Revoke Access'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-[#121418] border border-[#2b2f3a] rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-300">Branch Membership</div>
                  <div className="text-[11px] text-slate-500">
                    Staff member is currently assigned to this location
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(true)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove from this branch</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isRevoking}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-transparent hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isRevoking}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#714b67] hover:bg-[#87597b] rounded-lg shadow-md shadow-[#714b67]/30 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Role...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Role in {resolvedBranchName}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
