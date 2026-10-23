import { api } from '../../../lib/api/client';

export type OrgRole = 'owner' | 'manager' | 'storekeeper' | 'cashier' | 'accountant';

export interface GrantedBranch {
  id: string;
  name: string;
  code?: string | null;
  isPrimary: boolean;
  isDefault: boolean;
  role?: OrgRole;
  grantedAt: string;
}

export interface StaffMember {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: OrgRole;
  legacyRole: string;
  status: 'active' | 'suspended';
  scopeAllBranches: boolean;
  branches: GrantedBranch[];
  branchRoles?: Record<string, OrgRole>;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: OrgRole;
  status: string;
  default_branch_id?: string | null;
  branches: Array<{ id: string; name: string; code?: string | null; is_primary?: boolean }>;
  expires_at: string;
  created_at: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code?: string | null;
  is_primary: boolean;
}

export interface ListStaffResponse {
  members: StaffMember[];
  invitations: StaffInvitation[];
  branches: BranchOption[];
}

export interface InviteStaffPayload {
  email: string;
  role: OrgRole;
  branchIds?: string[];
  branchRoles?: Record<string, OrgRole>;
  defaultBranchId?: string;
  scopeAllBranches?: boolean;
  appKeys?: string[];
}

export interface UpdateMemberPayload {
  role?: OrgRole;
  branchIds?: string[];
  branchRoles?: Record<string, OrgRole>;
  defaultBranchId?: string;
  scopeAllBranches?: boolean;
  appKeys?: string[];
}

export interface AcceptInvitationPayload {
  fullName: string;
  password?: string;
}

export interface AcceptInvitationResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  role: OrgRole;
  defaultBranchId?: string | null;
}

export interface InvitationMetadataResponse {
  id: string;
  email: string;
  role: OrgRole;
  organization: {
    id: string;
    name: string;
    subdomain: string;
    logo_url?: string | null;
  };
  defaultBranchId?: string | null;
  branches: Array<{ id: string; name: string; code?: string | null }>;
  expiresAt: string;
}

export const staffApi = {
  /** List all staff members, pending invitations, and available branches (optionally filtered by branchId) */
  listStaff: async (orgId: string, branchId?: string): Promise<ListStaffResponse> => {
    const url = branchId ? `/organizations/${orgId}/staff?branchId=${encodeURIComponent(branchId)}` : `/organizations/${orgId}/staff`;
    return api.get<ListStaffResponse>(url);
  },

  /** Update an existing staff member's role specifically in a single branch */
  updateBranchRole: async (
    orgId: string,
    membershipId: string,
    branchId: string,
    role: OrgRole
  ): Promise<{ success: boolean; membershipId: string; branchId: string; role: OrgRole }> => {
    return api.patch(`/organizations/${orgId}/staff/members/${membershipId}/branch-role`, {
      branchId,
      role,
    });
  },

  /** Revoke a staff member's access from a specific branch */
  revokeBranchAccess: async (
    orgId: string,
    membershipId: string,
    branchId: string
  ): Promise<{ success: boolean; membershipId: string; revokedBranchId: string }> => {
    return api.delete(`/organizations/${orgId}/staff/members/${membershipId}/branch-access/${branchId}`);
  },

  /** Assign an existing staff member to a branch */
  assignBranchAccess: async (
    orgId: string,
    membershipId: string,
    branchId: string,
    role: OrgRole
  ): Promise<{ success: boolean; membershipId: string; branchId: string; role: OrgRole }> => {
    return api.post(`/organizations/${orgId}/staff/members/${membershipId}/branch-access`, {
      branchId,
      role,
    });
  },

  /** Send a new staff invitation */
  inviteStaff: async (
    orgId: string,
    payload: InviteStaffPayload
  ): Promise<{ invitationId: string; email: string; role: OrgRole; status: string }> => {
    return api.post(`/organizations/${orgId}/staff/invitations`, payload);
  },

  /** Update an existing staff member's role or branches (global) */
  updateMember: async (
    orgId: string,
    membershipId: string,
    payload: UpdateMemberPayload
  ): Promise<{ success: boolean; membershipId: string }> => {
    return api.patch(`/organizations/${orgId}/staff/members/${membershipId}`, payload);
  },

  /** Suspend a staff member */
  suspendMember: async (
    orgId: string,
    membershipId: string
  ): Promise<{ success: boolean; status: string }> => {
    return api.post(`/organizations/${orgId}/staff/members/${membershipId}/suspend`);
  },

  /** Reactivate a suspended staff member */
  reactivateMember: async (
    orgId: string,
    membershipId: string
  ): Promise<{ success: boolean; status: string }> => {
    return api.post(`/organizations/${orgId}/staff/members/${membershipId}/reactivate`);
  },

  /** Permanently remove a staff member from the organization */
  removeMember: async (
    orgId: string,
    membershipId: string
  ): Promise<{ success: boolean; membershipId: string }> => {
    return api.delete(`/organizations/${orgId}/staff/members/${membershipId}`);
  },

  /** Revoke an open invitation */
  revokeInvitation: async (
    orgId: string,
    invitationId: string
  ): Promise<{ success: boolean }> => {
    return api.delete(`/organizations/${orgId}/staff/invitations/${invitationId}`);
  },

  /** Resend an open invitation */
  resendInvitation: async (
    orgId: string,
    invitationId: string
  ): Promise<{ success: boolean; invitationId: string }> => {
    return api.post(`/organizations/${orgId}/staff/invitations/${invitationId}/resend`);
  },

  /** Get invitation details by raw token (public) */
  getInvitationByToken: async (token: string): Promise<InvitationMetadataResponse> => {
    return api.get<InvitationMetadataResponse>(`/invitations/${token}`);
  },

  /** Accept an invitation and set up password/profile */
  acceptInvitation: async (
    token: string,
    payload: AcceptInvitationPayload
  ): Promise<AcceptInvitationResponse> => {
    return api.post<AcceptInvitationResponse>(`/invitations/${token}/accept`, payload);
  },
};
