import { api } from '../../lib/api/client';

export interface InventoryBranchAddress {
  country: string;
  state: string;
  lga?: string;
  city?: string;
  area?: string;
  streetAddress: string;
  postalCode?: string;
}

export interface InventoryBranchSetupPayload {
  businessType: string;
  businessDescription?: string;
  branchName: string;
  branchCode: string;
  useOrgEmail: boolean;
  branchEmail?: string;
  useOrgPhone: boolean;
  branchPhone?: string;
  address: InventoryBranchAddress;
  currency?: string;
}

export interface SaveInventoryDraftPayload {
  currentStep: number;
  stepData: Record<string, any>;
}

export interface InventoryOnboardingStatusResponse {
  completed: boolean;
  status: 'pending' | 'completed';
  branch: {
    id: string;
    name: string;
    code?: string | null;
    type: string;
    status: string;
    is_primary: boolean;
    phone?: string | null;
    email?: string | null;
    address?: unknown;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    code?: string | null;
    type: string;
    status: string;
  }>;
  stepData?: {
    currentStep?: number;
    businessType?: string;
    businessDescription?: string;
    branchName?: string;
    branchCode?: string;
    useOrgEmail?: boolean;
    branchEmail?: string;
    useOrgPhone?: boolean;
    branchPhone?: string;
    address?: InventoryBranchAddress;
    state?: string;
    city?: string;
    streetAddress?: string;
    area?: string;
    [key: string]: any;
  } | null;
  organization: {
    id: string;
    name: string;
    subdomain: string;
    currency: string;
    timezone: string;
    businessEmail?: string | null;
    phone?: string | null;
  };
}

export interface InventorySetupResponse {
  success: boolean;
  branch: {
    id: string;
    name: string;
    code?: string | null;
    type: string;
    status: string;
  };
  onboarding: {
    id: string;
    status: string;
    completed_at: string;
  };
}

export async function getInventoryOnboardingStatus(): Promise<InventoryOnboardingStatusResponse> {
  return await api.get<InventoryOnboardingStatusResponse>('/inventory/onboarding/status');
}

export async function saveInventoryOnboardingDraft(
  payload: SaveInventoryDraftPayload
): Promise<{ success: boolean }> {
  return await api.put<{ success: boolean }>('/inventory/onboarding/draft', payload);
}

export async function submitInventoryBranchSetup(
  payload: InventoryBranchSetupPayload
): Promise<InventorySetupResponse> {
  return await api.post<InventorySetupResponse>('/inventory/onboarding/setup', payload);
}

export * from './categories-api';
