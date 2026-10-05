import { api } from './client';
import type { AuthOrganization } from '../../stores/auth-store';

export interface MembershipDetails {
  id: string;
  role: 'owner' | 'admin' | 'manager' | 'member';
  status: 'active' | 'invited' | 'suspended';
}

export interface BranchDetails {
  id: string;
  name: string;
  type: 'store' | 'warehouse' | 'studio' | 'headquarters';
  status: 'active' | 'inactive';
  address?: unknown;
}

export interface CurrentOrgResponse {
  organization: AuthOrganization;
  membership: MembershipDetails;
  branch: BranchDetails | null;
  branches: BranchDetails[];
}

export async function getCurrentOrg(): Promise<CurrentOrgResponse> {
  return api.get<CurrentOrgResponse>('/orgs/me');
}
