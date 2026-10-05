export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status: string;
  emailVerifiedAt?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  planCode?: string | null;
  timezone?: string;
  currency?: string;
  url?: string;
}

export interface PosProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  barcode?: string;
  sku?: string;
}

export interface CartItem {
  product: PosProduct;
  quantity: number;
}
