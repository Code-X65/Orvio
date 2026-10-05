import { api } from '../../lib/api';

export interface WorkspaceProductItem {
  id: string;
  org_id: string;
  product_key: string;
  status: string;
  is_primary: boolean;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDetailsResponse {
  organization: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
    timezone: string;
    currency: string;
    plan_code: string;
    url: string;
  };
  membership: {
    id: string;
    role: string;
    status: string;
  } | null;
  branch: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;
  products: WorkspaceProductItem[];
}

export async function fetchWorkspaceDetails(): Promise<WorkspaceDetailsResponse> {
  return await api.get<WorkspaceDetailsResponse>('/orgs/me');
}

export async function installWorkspaceProduct(productKey: string): Promise<WorkspaceProductItem[]> {
  const res = await api.post<{ products: WorkspaceProductItem[] }>('/orgs/products', { productKey });
  return res.products;
}

export async function uninstallWorkspaceProduct(productKey: string): Promise<WorkspaceProductItem[]> {
  const res = await api.delete<{ products: WorkspaceProductItem[] }>(`/orgs/products/${encodeURIComponent(productKey)}`);
  return res.products;
}

export async function setPrimaryWorkspaceProduct(productKey: string): Promise<WorkspaceProductItem[]> {
  const res = await api.patch<{ products: WorkspaceProductItem[] }>(`/orgs/products/${encodeURIComponent(productKey)}/primary`);
  return res.products;
}

export async function updateWorkspaceProductSettings(
  productKey: string,
  settings: Record<string, any>
): Promise<WorkspaceProductItem> {
  const res = await api.patch<{ product: WorkspaceProductItem }>(
    `/orgs/products/${encodeURIComponent(productKey)}/settings`,
    { settings }
  );
  return res.product;
}
