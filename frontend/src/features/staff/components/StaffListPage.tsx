import * as React from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Building2,
  MoreVertical,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  RotateCw,
  Trash2,
  Edit,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  staffApi,
  type StaffMember,
  type StaffInvitation,
  type BranchOption,
  type OrgRole,
} from '../api/staff-api';
import { InviteStaffModal } from './InviteStaffModal';
import { EditStaffModal } from './EditStaffModal';
import { useAuthStore } from '../../../stores/auth-store';

interface StaffListPageProps {
  organization: { id: string; name: string; subdomain: string } | null;
  branches: Array<{ id: string; name: string; code?: string | null; is_primary?: boolean }>;
  activeBranchId?: string;
  contextApp?: string;
}

const ROLE_BADGES: Record<OrgRole, { label: string; bg: string; text: string; border: string }> = {
  owner: { label: 'Owner', bg: 'bg-[#fbb945]/15', text: 'text-[#fbb945]', border: 'border-[#fbb945]/30' },
  manager: { label: 'Manager', bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  storekeeper: { label: 'Storekeeper', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  cashier: { label: 'Cashier', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30' },
  accountant: { label: 'Accountant', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
};

export function StaffListPage({
  organization,
  branches: initialBranches,
  activeBranchId,
  contextApp,
}: StaffListPageProps) {
  const user = useAuthStore((s) => s.user);

  const [members, setMembers] = React.useState<StaffMember[]>([]);
  const [invitations, setInvitations] = React.useState<StaffInvitation[]>([]);
  const [branches, setBranches] = React.useState<BranchOption[]>(() => {
    return initialBranches.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code || null,
      is_primary: b.is_primary || false,
    }));
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [branchFilter, setBranchFilter] = React.useState<string>('all');
  const [activeTab, setActiveTab] = React.useState<'members' | 'invitations'>('members');

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<StaffMember | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(null);

  const orgId = organization?.id || '';

  const loadData = React.useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const res = await staffApi.listStaff(orgId);
      setMembers(res.members || []);
      setInvitations(res.invitations || []);
      if (res.branches && res.branches.length > 0) {
        setBranches(res.branches);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load staff list');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Close kebab menu on outside click
  React.useEffect(() => {
    const handleOutside = () => setOpenActionMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  // Compute acting user role from current membership
  const currentMember = React.useMemo(() => {
    return members.find((m) => m.userId === user?.id);
  }, [members, user?.id]);

  const actorRole: OrgRole = currentMember?.role || 'owner';

  // Suspend action
  const handleSuspend = async (membershipId: string, memberName: string) => {
    try {
      await staffApi.suspendMember(orgId, membershipId);
      toast.success(`Suspended access for ${memberName}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to suspend member');
    }
  };

  // Reactivate action
  const handleReactivate = async (membershipId: string, memberName: string) => {
    try {
      await staffApi.reactivateMember(orgId, membershipId);
      toast.success(`Reactivated access for ${memberName}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate member');
    }
  };

  // Revoke invite
  const handleRevokeInvite = async (invitationId: string, email: string) => {
    try {
      await staffApi.revokeInvitation(orgId, invitationId);
      toast.success(`Revoked invitation for ${email}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation');
    }
  };

  // Resend invite
  const handleResendInvite = async (invitationId: string, email: string) => {
    try {
      await staffApi.resendInvitation(orgId, invitationId);
      toast.success(`Resent invitation to ${email}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  };

  // Filter members
  const filteredMembers = React.useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      const matchesBranch =
        branchFilter === 'all' ||
        m.scopeAllBranches ||
        m.branches.some((b) => b.id === branchFilter);

      return matchesSearch && matchesRole && matchesBranch;
    });
  }, [members, searchQuery, roleFilter, branchFilter]);

  // Filter invitations
  const filteredInvitations = React.useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch = inv.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || inv.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [invitations, searchQuery, roleFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#2b2f3a]">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Staff & Access Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-[#fbb945] font-semibold">
              RBAC
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assign team member roles, control branch authorization, and track employee invitations.
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#714b67] hover:bg-[#87597b] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md shadow-[#714b67]/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Staff</span>
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#181a20] border border-[#2b2f3a] p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Staff</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{members.length}</div>
        </div>

        <div className="bg-[#181a20] border border-[#2b2f3a] p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Active Users</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {members.filter((m) => m.status === 'active').length}
          </div>
        </div>

        <div className="bg-[#181a20] border border-[#2b2f3a] p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Pending Invites</span>
            <Clock className="w-4 h-4 text-[#fbb945]" />
          </div>
          <div className="text-2xl font-black text-[#fbb945]">{invitations.length}</div>
        </div>

        <div className="bg-[#181a20] border border-[#2b2f3a] p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Branches</span>
            <Building2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{branches.length}</div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#181a20] border border-[#2b2f3a] p-3 rounded-xl">
        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 bg-[#121418] p-1 rounded-lg border border-[#2b2f3a] self-start md:self-auto">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'members'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Team Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'invitations'
                ? 'bg-[#714b67] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Invites ({invitations.length})
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2.5 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-[#121418] border border-[#2b2f3a] rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#714b67]"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#121418] border border-[#2b2f3a] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#714b67]"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="storekeeper">Storekeeper</option>
            <option value="cashier">Cashier</option>
            <option value="accountant">Accountant</option>
          </select>

          {activeTab === 'members' && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-[#121418] border border-[#2b2f3a] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#714b67]"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          <div className="w-6 h-6 border-2 border-white/20 border-t-[#714b67] rounded-full animate-spin mx-auto mb-3" />
          Loading staff directory...
        </div>
      ) : activeTab === 'members' ? (
        /* ================= MEMBERS TABLE ================= */
        <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121418] border-b border-[#2b2f3a] text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Branch Access</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f3a] text-slate-200">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No staff members match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const badge = ROLE_BADGES[m.role] || ROLE_BADGES.storekeeper;
                    const initials = m.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    const isSelf = m.userId === user?.id;
                    const isOwner = m.role === 'owner';
                    const canEdit =
                      !isOwner &&
                      (actorRole === 'owner' ||
                        (actorRole === 'manager' && m.role !== 'manager'));

                    return (
                      <tr key={m.membershipId} className="hover:bg-white/[0.02] transition-colors">
                        {/* Member Identity */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#714b67] to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{m.fullName}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{m.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            <Shield className="w-3 h-3" />
                            {badge.label}
                          </span>
                        </td>

                        {/* Branch Access */}
                        <td className="py-3 px-4">
                          {m.scopeAllBranches ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-medium">
                              <Sparkles className="w-3 h-3 text-[#fbb945]" />
                              Global (All Branches)
                            </span>
                          ) : m.branches.length === 0 ? (
                            <span className="text-slate-500 text-[11px]">No branches assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {m.branches.map((b) => (
                                <span
                                  key={b.id}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                    b.isDefault
                                      ? 'bg-[#714b67]/20 border-[#714b67]/40 text-purple-200 font-semibold'
                                      : 'bg-white/5 border-[#3b3f4d] text-slate-300'
                                  }`}
                                >
                                  {b.name}
                                  {b.isDefault && (
                                    <span className="text-[#fbb945] font-bold" title="Default Branch">
                                      ★
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {m.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-rose-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>

                        {/* Action Menu */}
                        <td className="py-3 px-4 text-right">
                          {canEdit ? (
                            <div className="relative inline-block text-left">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenuId(
                                    openActionMenuId === m.membershipId ? null : m.membershipId
                                  );
                                }}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openActionMenuId === m.membershipId && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 mt-1 w-44 bg-[#1e2029] border border-[#2b2f3a] rounded-lg shadow-xl py-1 z-30 animate-fade-in text-xs"
                                >
                                  <button
                                    onClick={() => {
                                      setEditingMember(m);
                                      setOpenActionMenuId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Edit Permissions</span>
                                  </button>

                                  {m.status === 'active' ? (
                                    <button
                                      onClick={() => {
                                        handleSuspend(m.membershipId, m.fullName);
                                        setOpenActionMenuId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>Suspend Access</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        handleReactivate(m.membershipId, m.fullName);
                                        setOpenActionMenuId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Reactivate Access</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= INVITATIONS TABLE ================= */
        <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121418] border-b border-[#2b2f3a] text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invited Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Branches</th>
                  <th className="py-3 px-4">Sent At</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f3a] text-slate-200">
                {filteredInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No pending invitations. Click &quot;Invite Staff&quot; above to invite team members.
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((inv) => {
                    const badge = ROLE_BADGES[inv.role] || ROLE_BADGES.storekeeper;

                    return (
                      <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{inv.email}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            <Shield className="w-3 h-3" />
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {inv.branches.length === 0 ? (
                            <span className="text-purple-300 text-[11px]">All Branches</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {inv.branches.map((b) => (
                                <span
                                  key={b.id}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-[#3b3f4d] text-slate-300"
                                >
                                  {b.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleResendInvite(inv.id, inv.email)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors text-[11px]"
                            title="Resend invitation email"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Resend</span>
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(inv.id, inv.email)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded transition-colors text-[11px]"
                            title="Revoke open invitation"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Staff Modal */}
      <InviteStaffModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={loadData}
        orgId={orgId}
        branches={branches}
        actorRole={actorRole}
        contextApp={contextApp}
        contextBranchId={activeBranchId}
      />

      {/* Edit Staff Modal */}
      <EditStaffModal
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        onSuccess={loadData}
        orgId={orgId}
        member={editingMember}
        branches={branches}
        actorRole={actorRole}
      />
    </div>
  );
}
