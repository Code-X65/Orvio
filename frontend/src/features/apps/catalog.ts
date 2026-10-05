import * as React from 'react';
import {
  Package,
  Store,
  Dumbbell,
  ShoppingBag,
  Users,
  TrendingUp,
  CreditCard,
  MessageSquare,
  Receipt,
  PieChart,
  DollarSign,
  Calendar,
  Briefcase,
  Globe,
} from 'lucide-react';

export type AppCategory = 'Operations' | 'Sales' | 'Finance' | 'Productivity';

export interface AppItem {
  id: string;
  name: string;
  category: AppCategory;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  badgeColor: string;
  backendKey: 'inventory' | 'gym';
  description: string;
  details: string;
  route?: string;
  statusLabel?: string;
  quickAction?: string;
}

export const APPS_LIST: AppItem[] = [
  // Operations
  {
    id: 'inventory',
    name: 'Inventory Management',
    category: 'Operations',
    icon: Package,
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    backendKey: 'inventory',
    description: 'Stock tracking, barcode scans, warehouse & low-stock alerts',
    details: 'Real-time multi-location inventory counts, supplier tracking, variant barcodes, and purchase orders.',
    route: '/inventory',
    statusLabel: 'Live Inventory',
    quickAction: 'Manage Stock',
  },
  {
    id: 'pos',
    name: 'Point of Sale (POS)',
    category: 'Operations',
    icon: Store,
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    iconColor: 'text-rose-500',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    backendKey: 'inventory',
    description: 'Fast retail cashier desk, thermal receipts & barcode checkout',
    details: 'Touch-optimized cashier terminal with split payments, offline cart support, barcode scanner, and cash drawer integration.',
    route: '/pos',
    statusLabel: 'Cashier Ready',
    quickAction: 'Open POS Terminal',
  },
  {
    id: 'gym',
    name: 'Gym & Studio Hub',
    category: 'Operations',
    icon: Dumbbell,
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-500',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    backendKey: 'gym',
    description: 'Memberships, biometric/QR check-ins, trainer shifts & classes',
    details: 'Automated membership expiry warnings, RFID/turnstile gate sync, trainer appointments, and attendance logs.',
    route: '/members',
    statusLabel: 'Active Members',
    quickAction: 'Member Hub',
  },
  {
    id: 'ecommerce',
    name: 'eCommerce Storefront',
    category: 'Operations',
    icon: ShoppingBag,
    iconBg: 'bg-purple-500/10 border-purple-500/20',
    iconColor: 'text-purple-500',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    backendKey: 'inventory',
    description: 'Online store catalog, customer orders & WhatsApp checkout',
    details: 'Public branded online storefront connected directly to your warehouse stock with instant payment gateway.',
    route: '/ecommerce',
    statusLabel: 'Storefront Live',
    quickAction: 'View Store',
  },

  // Sales
  {
    id: 'crm',
    name: 'CRM & Contacts',
    category: 'Sales',
    icon: Users,
    iconBg: 'bg-teal-500/10 border-teal-500/20',
    iconColor: 'text-teal-500',
    badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    backendKey: 'inventory',
    description: 'Customer directory, purchase history, leads & pipeline tracking',
    details: 'Full customer 360-view with lifetime spend metrics, loyalty points, contact history, and sales pipelines.',
    route: '/crm',
    statusLabel: 'Customer Directory',
    quickAction: 'View Customers',
  },
  {
    id: 'sales',
    name: 'Sales & Quotes',
    category: 'Sales',
    icon: TrendingUp,
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    iconColor: 'text-indigo-500',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    backendKey: 'inventory',
    description: 'Quotations, proforma invoices & wholesale sales orders',
    details: 'Generate professional price quotes, discount rules, bulk sales orders, and convert quotes to invoices in 1 click.',
    route: '/sales',
    statusLabel: 'Sales Pipeline',
    quickAction: 'New Quotation',
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions & Billing',
    category: 'Sales',
    icon: CreditCard,
    iconBg: 'bg-sky-500/10 border-sky-500/20',
    iconColor: 'text-sky-500',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    backendKey: 'gym',
    description: 'Automated recurring billing, card debits & member renewal plans',
    details: 'Automated Paystack recurring charges, dunning for failed payments, tier management, and prorated renewals.',
    route: '/billing',
    statusLabel: 'Recurring Engine',
    quickAction: 'Manage Plans',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Marketing',
    category: 'Sales',
    icon: MessageSquare,
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    backendKey: 'inventory',
    description: 'Automated receipt broadcast, payment reminders & promo campaigns',
    details: 'Send automated WhatsApp order updates, receipt PDFs, and promotional campaigns directly to customers.',
    route: '/whatsapp',
    statusLabel: 'WhatsApp Connect',
    quickAction: 'Broadcast',
  },

  // Finance
  {
    id: 'invoicing',
    name: 'Invoicing & Receivables',
    category: 'Finance',
    icon: Receipt,
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    iconColor: 'text-blue-500',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    backendKey: 'inventory',
    description: 'Custom PDF invoices, tax calculation, payment links & aging reports',
    details: 'Create and email digital invoices with automated payment tracking, overdue follow-ups, and VAT/tax computation.',
    route: '/invoices',
    statusLabel: 'Invoice Engine',
    quickAction: 'Create Invoice',
  },
  {
    id: 'accounting',
    name: 'Accounting & Ledgers',
    category: 'Finance',
    icon: PieChart,
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    iconColor: 'text-violet-500',
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    backendKey: 'inventory',
    description: 'Double-entry journal, chart of accounts & profit/loss statements',
    details: 'Automated revenue reconciliation, balance sheets, cashflow reports, and tax compliance export.',
    route: '/accounting',
    statusLabel: 'General Ledger',
    quickAction: 'View Reports',
  },
  {
    id: 'expenses',
    name: 'Expenses & Petty Cash',
    category: 'Finance',
    icon: DollarSign,
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    iconColor: 'text-cyan-500',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    backendKey: 'inventory',
    description: 'Staff expense claims, vendor bills, receipt uploads & cash tracking',
    details: 'Track business expenses by category, staff reimbursement workflows, vendor payouts, and receipt OCR scans.',
    route: '/expenses',
    statusLabel: 'Expense Tracker',
    quickAction: 'Log Expense',
  },

  // Productivity
  {
    id: 'appointments',
    name: 'Appointments & Booking',
    category: 'Productivity',
    icon: Calendar,
    iconBg: 'bg-pink-500/10 border-pink-500/20',
    iconColor: 'text-pink-500',
    badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    backendKey: 'gym',
    description: 'Online booking calendar, client self-scheduling & reminders',
    details: 'Staff calendar synchronization, automated SMS/email booking confirmations, and service capacity management.',
    route: '/appointments',
    statusLabel: 'Booking Calendar',
    quickAction: 'Calendar',
  },
  {
    id: 'employees',
    name: 'Staff & HR Directory',
    category: 'Productivity',
    icon: Briefcase,
    iconBg: 'bg-amber-600/10 border-amber-600/20',
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-600/10 text-amber-400 border-amber-600/30',
    backendKey: 'inventory',
    description: 'Cashier & trainer directory, shift rosters, roles & PIN access',
    details: 'Manage employee permissions, POS lock PINs, shift attendance tracking, and commission calculations.',
    route: '/staff',
    statusLabel: 'Team Directory',
    quickAction: 'Manage Staff',
  },
  {
    id: 'website',
    name: 'Website & Landing Pages',
    category: 'Productivity',
    icon: Globe,
    iconBg: 'bg-indigo-600/10 border-indigo-600/20',
    iconColor: 'text-indigo-400',
    badgeColor: 'bg-indigo-600/10 text-indigo-400 border-indigo-600/30',
    backendKey: 'inventory',
    description: 'Custom landing pages, custom domain hosting & lead capture forms',
    details: 'Drag-and-drop page builder for marketing promotions, link-in-bio pages, and custom domain SSL mapping.',
    route: '/website',
    statusLabel: 'Website Builder',
    quickAction: 'Edit Pages',
  },
];

export const CATEGORIES: AppCategory[] = [
  'Operations',
  'Sales',
  'Finance',
  'Productivity',
];

export function getAppById(id: string): AppItem | undefined {
  const cleanId = id.toLowerCase().trim();
  return APPS_LIST.find((a) => a.id.toLowerCase() === cleanId);
}
