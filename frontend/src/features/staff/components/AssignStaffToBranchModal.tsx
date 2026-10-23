import * as React from 'react';
import { X, UserPlus, Search, Shield, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { staffApi, type StaffMember, type OrgRole } from '../api/staff-api';

interface AssignStaffToBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  activeBranchId: string;
  activeBranchName: string;
  allMembers: StaffMember[];
  actorRole?: OrgRole;
}

const ROLE_OPTIONS: Array<{
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

export function AssignStaffToBranchModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  activeBranchId,
  activeBranchName,
  allMembers,
  actorRole = 'owner',
}: AssignStaffToBranchModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [selectedRole, setSelectedRole] = React.useState<OrgRole>('cashier');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Filter unassigned members (members of org who are not yet assigned to activeBranchId and not owner)
  const candidateMembers = React.useMemo(() => {
    return allMembers.filter((m) => {
      if (m.role === 'owner') return false; // owners already have global access
      const alreadyInBranch = m.branches.some((b) => b.id === activeBranchId);
      return !alreadyInBranch;
    });
  }, [allMembers, activeBranchId]);

  const filteredCandidates = React.useMemo(() => {
    if (!searchQuery.trim()) return candidateMembers;
    const q = searchQuery.toLowerCase();
    return candidateMembers.filter(
      (m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [candidateMembers, searchQuery]);

  const availableRoles = React.useMemo(() => {
    if (actorRole === 'owner') return ROLE_OPTIONS;
    return ROLE_OPTIONS.filter((r) => r.role !== 'manager');
  }, [actorRole]);

  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedMemberId(candidateMembers[0]?.membershipId || '');
      setSelectedRole('cashier');
      setErrorMsg(null);
    }
  }, [isOpen, candidateMembers]);

  if (!isOpen) return null;

  const selectedMember = allMembers.find((m) => m.membershipId === selectedMemberId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setErrorMsg('Please select a team member to assign');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await staffApi.assignBranchAccess(
        orgId,
        selectedMemberId,
        activeBranchId,
        selectedRole
      );

      const roleTitle = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
      toast.success(
        `Assigned ${selectedMember?.fullName} to ${activeBranchName} as ${roleTitle}`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to assign staff member to branch';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2b2f3a] flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#714b67]" />
              <span>Assign Staff to Branch</span>
            </h3>
            <p className="text-xs text-slate-400">
              Grant an existing team member access to{' '}
              <span className="text-white font-semibold">{activeBranchName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {candidateMembers.length === 0 ? (
            <div className="p-6 text-center space-y-2 bg-[#121418] border border-[#2b2f3a] rounded-lg">
              <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-xs font-semibold text-white">All Staff Already Assigned</div>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Every team member in your organization is already authorized for {activeBranchName}.
              </p>
            </div>
          ) : (
            <>
              {/* Member Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Select Team Member
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full bg-[#121418] border border-[#2b2f3a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#714b67]"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-[#2b2f3a] bg-[#121418] rounded-lg p-2">
                  {filteredCandidates.map((m) => {
                    const isSelected = selectedMemberId === m.membershipId;
                    return (
                      <button
                        key={m.membershipId}
                        type="button"
                        onClick={() => setSelectedMemberId(m.membershipId)}
                        className={`w-full text-left p-2 rounded-md transition-all flex items-center justify-between text-xs cursor-pointer ${
                          isSelected
                            ? 'bg-[#714b67] text-white shadow-sm'
                            : 'hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white">{m.fullName}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                            {m.email}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Role Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Designated Role in {activeBranchName}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableRoles.map((r) => {
                    const isSelected = selectedRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setSelectedRole(r.role)}
                        className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#714b67]/20 border-[#714b67] text-white ring-1 ring-[#714b67]'
                            : 'bg-[#121418] border-[#2b2f3a] text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            {r.title}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${r.badgeBg} ${r.badgeColor}`}
                          >
                            {r.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {r.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-2 border-t border-[#2b2f3a] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-transparent hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || candidateMembers.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#714b67] hover:bg-[#87597b] rounded-lg shadow-md shadow-[#714b67]/30 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assign to {activeBranchName}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
