import * as React from 'react';
import {
  Boxes,
  ShoppingCart,
  Users,
  FileText,
  RotateCcw,
  BarChart3,
  Settings,
  Search,
  Filter,
  Download,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Store,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

export type OperationalSection =
  | 'Inventory'
  | 'Orders'
  | 'Suppliers'
  | 'Purchase Orders'
  | 'Returns'
  | 'Reports'
  | 'Settings';

interface OperationalSectionViewProps {
  section: OperationalSection;
  organization: {
    name: string;
    currency?: string;
    subdomain?: string;
  };
  branchName: string;
  isAllBranches: boolean;
  currencySymbol: string;
  onOpenBranchModal: () => void;
  onNavigate: (path: string) => void;
}

export function OperationalSectionView({
  section,
  organization,
  branchName,
  isAllBranches,
  currencySymbol,
  onOpenBranchModal,
  onNavigate,
}: OperationalSectionViewProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all');

  // Render metadata for each section
  const sectionMeta = React.useMemo(() => {
    switch (section) {
      case 'Inventory':
        return {
          title: 'Stock & Inventory Control',
          subtitle: 'Live stock balances, SKU variant availability, batch records, and reorder levels.',
          icon: Boxes,
          primaryActionText: 'Transfer Stock',
          secondaryActionText: 'Export Ledger',
          kpis: [
            { label: 'Tracked Stock SKUs', value: '1,420 items', change: '+14 this week', isPositive: true },
            { label: 'Total Valuation', value: `${currencySymbol}84,250`, change: 'Cost basis', isPositive: true },
            { label: 'Low Stock Alerts', value: '18 items', change: 'Below reorder point', isPositive: false },
            { label: 'Out of Stock', value: '4 items', change: 'Requires PO reorder', isPositive: false },
          ],
          rows: [
            { id: 'SKU-8821', title: 'Classic Oversized Tee (Black / L)', category: 'Apparel', qty: 156, threshold: 25, status: 'Healthy', statusColor: 'emerald' },
            { id: 'SKU-8822', title: 'Classic Oversized Tee (White / M)', category: 'Apparel', qty: 12, threshold: 20, status: 'Low Stock', statusColor: 'amber' },
            { id: 'SKU-9041', title: 'Premium Fleece Hoodie (Grey / XL)', category: 'Outerwear', qty: 98, threshold: 15, status: 'Healthy', statusColor: 'emerald' },
            { id: 'SKU-7729', title: 'Pro Performance Sneakers (Size 43)', category: 'Footwear', qty: 0, threshold: 10, status: 'Out of Stock', statusColor: 'rose' },
            { id: 'SKU-4412', title: 'Vintage Washed Denim (32x32)', category: 'Jeans', qty: 214, threshold: 30, status: 'Healthy', statusColor: 'emerald' },
          ],
        };
      case 'Orders':
        return {
          title: 'Sales Orders & Counter Transactions',
          subtitle: 'Store register sales, POS checkout tickets, and fulfillment pipeline.',
          icon: ShoppingCart,
          primaryActionText: 'New Sale Order',
          secondaryActionText: 'Export Orders',
          kpis: [
            { label: "Today's Orders", value: '42 orders', change: '+12.4% vs yesterday', isPositive: true },
            { label: 'Sales Volume', value: `${currencySymbol}4,620.00`, change: 'Register totals', isPositive: true },
            { label: 'Pending Dispatch', value: '7 tickets', change: 'Awaiting packing', isPositive: false },
            { label: 'Average Ticket', value: `${currencySymbol}109.50`, change: '+4.8% vs last week', isPositive: true },
          ],
          rows: [
            { id: '#ORD-7956', title: 'Rohan Verma', category: 'Credit Card (POS)', qty: 3, threshold: 149.99, status: 'Delivered', statusColor: 'emerald' },
            { id: '#ORD-7955', title: 'Ananya Singh', category: 'Cash Register', qty: 1, threshold: 89.50, status: 'Processing', statusColor: 'amber' },
            { id: '#ORD-7954', title: 'Karan Mehta', category: 'Bank Transfer', qty: 4, threshold: 199.00, status: 'Shipped', statusColor: 'sky' },
            { id: '#ORD-7953', title: 'Neha Kapoor', category: 'Digital POS', qty: 2, threshold: 59.49, status: 'Processing', statusColor: 'amber' },
            { id: '#ORD-7952', title: 'Vikram Patel', category: 'Direct Counter', qty: 5, threshold: 249.00, status: 'Delivered', statusColor: 'emerald' },
          ],
        };
      case 'Suppliers':
        return {
          title: 'Wholesale Suppliers & Vendors',
          subtitle: 'Certified distributor agreements, contact records, payment terms, and lead times.',
          icon: Users,
          primaryActionText: 'Add Supplier',
          secondaryActionText: 'Supplier Directory',
          kpis: [
            { label: 'Active Suppliers', value: '14 vendors', change: 'Verified suppliers', isPositive: true },
            { label: 'Open Inbound POs', value: '5 shipments', change: 'Expected this month', isPositive: true },
            { label: 'Avg Lead Time', value: '3.8 days', change: 'On schedule', isPositive: true },
            { label: 'Outstanding Balance', value: `${currencySymbol}12,450`, change: 'Net 30 terms', isPositive: false },
          ],
          rows: [
            { id: 'VND-001', title: 'Apex Textiles & Fabric Ltd', category: 'Raw Materials & Apparel', qty: 3, threshold: 4.2, status: 'Verified', statusColor: 'emerald' },
            { id: 'VND-002', title: 'Global Footwear Logistics', category: 'Finished Goods', qty: 1, threshold: 2.5, status: 'Verified', statusColor: 'emerald' },
            { id: 'VND-003', title: 'Nordic Denim Mills', category: 'Fabrics & Accessories', qty: 2, threshold: 5.0, status: 'Pending Review', statusColor: 'amber' },
            { id: 'VND-004', title: 'Pacific Trim & Packaging', category: 'Boxes & Labels', qty: 0, threshold: 1.5, status: 'Verified', statusColor: 'emerald' },
          ],
        };
      case 'Purchase Orders':
        return {
          title: 'Procurement Purchase Orders',
          subtitle: 'Track outbound supplier POs, dock receiving schedules, and invoice matching.',
          icon: FileText,
          primaryActionText: 'Create PO',
          secondaryActionText: 'Receiving Dock',
          kpis: [
            { label: 'Active POs', value: '8 orders', change: 'In procurement', isPositive: true },
            { label: 'In Transit', value: '5 shipments', change: 'Estimated in 48h', isPositive: true },
            { label: 'Received This Month', value: '19 POs', change: 'Fully verified', isPositive: true },
            { label: 'Committed Cost', value: `${currencySymbol}28,940`, change: 'Approved budgets', isPositive: true },
          ],
          rows: [
            { id: '#PO-2024-081', title: 'Apex Textiles & Fabric Ltd', category: '500x Oversized Tees', qty: 500, threshold: 6250.00, status: 'In Transit', statusColor: 'sky' },
            { id: '#PO-2024-082', title: 'Global Footwear Logistics', category: '250x Sneakers Pro', qty: 250, threshold: 9800.00, status: 'Approved', statusColor: 'emerald' },
            { id: '#PO-2024-083', title: 'Nordic Denim Mills', category: '300x Slim Fit Jeans', qty: 300, threshold: 7200.00, status: 'Drafting', statusColor: 'amber' },
            { id: '#PO-2024-080', title: 'Pacific Trim & Packaging', category: '2000x Branded Poly Mailers', qty: 2000, threshold: 1450.00, status: 'Received', statusColor: 'emerald' },
          ],
        };
      case 'Returns':
        return {
          title: 'Customer Returns & RMA Desk',
          subtitle: 'Inspect returns, restore restocking balances, and issue credit notes.',
          icon: RotateCcw,
          primaryActionText: 'Process RMA',
          secondaryActionText: 'Inspection Log',
          kpis: [
            { label: 'Pending RMA Requests', value: '5 tickets', change: 'Awaiting inspection', isPositive: false },
            { label: 'Restocked Items', value: '38 units', change: '92% salvage rate', isPositive: true },
            { label: 'Damaged / Written-off', value: '3 items', change: 'Discarded', isPositive: false },
            { label: 'Refund Volume', value: `${currencySymbol}840.00`, change: 'Current period', isPositive: false },
          ],
          rows: [
            { id: '#RMA-1042', title: 'ORD-7940 (Size Exchange)', category: 'Classic Oversized Tee (XL)', qty: 1, threshold: 33.99, status: 'Restocked', statusColor: 'emerald' },
            { id: '#RMA-1043', title: 'ORD-7938 (Defect Claim)', category: 'Bomber Jacket (M)', qty: 1, threshold: 89.99, status: 'Under Review', statusColor: 'amber' },
            { id: '#RMA-1044', title: 'ORD-7931 (Change of Mind)', category: 'Sneakers Pro (42)', qty: 1, threshold: 79.19, status: 'Restocked', statusColor: 'emerald' },
          ],
        };
      case 'Reports':
        return {
          title: 'Financial & Inventory Analytics',
          subtitle: 'Consolidated valuation, inventory velocity, dead stock analysis, and audit trails.',
          icon: BarChart3,
          primaryActionText: 'Export PDF Report',
          secondaryActionText: 'Download CSV Data',
          kpis: [
            { label: 'Consolidated Sales', value: `${currencySymbol}64,280.00`, change: '+18.2% vs last month', isPositive: true },
            { label: 'Average Gross Margin', value: '38.4%', change: 'Across all catalog items', isPositive: true },
            { label: 'Inventory Turnover', value: '4.6x', change: 'Healthy retail velocity', isPositive: true },
            { label: 'Stock Shrinkage', value: '0.18%', change: 'Well under 1% threshold', isPositive: true },
          ],
          rows: [
            { id: 'REP-01', title: 'Inventory Valuation by Branch & Category', category: 'Financial Audit', qty: 1, threshold: 84250, status: 'Ready', statusColor: 'emerald' },
            { id: 'REP-02', title: 'ABC Analysis (Fast vs Slow Velocity SKUs)', category: 'Merchandising', qty: 1, threshold: 0, status: 'Ready', statusColor: 'emerald' },
            { id: 'REP-03', title: 'Branch Register Daily Sales Distribution', category: 'POS Reconciliation', qty: 1, threshold: 64280, status: 'Ready', statusColor: 'emerald' },
            { id: 'REP-04', title: 'Sales Tax & VAT Liability Breakdown', category: 'Tax & Compliance', qty: 1, threshold: 4820, status: 'Ready', statusColor: 'emerald' },
          ],
        };
      case 'Settings':
      default:
        return {
          title: 'Branch & Inventory Configurations',
          subtitle: 'Multi-branch sync controls, barcode parameters, currency symbols, and register rules.',
          icon: Settings,
          primaryActionText: 'Save Settings',
          secondaryActionText: 'Branch Settings Hub',
          kpis: [
            { label: 'Active Locations', value: `${branchName}`, change: isAllBranches ? 'Org-wide Aggregate' : 'Isolated Branch', isPositive: true },
            { label: 'Default Currency', value: organization.currency || 'USD', change: 'Configured in setup', isPositive: true },
            { label: 'Low Stock Auto-Alerts', value: 'Enabled', change: 'Threshold: 15 units', isPositive: true },
            { label: 'Multi-Branch Sync', value: 'Active', change: 'Real-time database sync', isPositive: true },
          ],
          rows: [
            { id: 'SET-01', title: 'Branch Operational Profiles & Address', category: 'Branch Hub', qty: 1, threshold: 0, status: 'Configured', statusColor: 'emerald' },
            { id: 'SET-02', title: 'Barcode Scanner & Label Print Formats', category: 'Hardware POS', qty: 1, threshold: 0, status: 'Active', statusColor: 'emerald' },
            { id: 'SET-03', title: 'Automated Purchase Reorder Triggers', category: 'Procurement', qty: 1, threshold: 0, status: 'Active', statusColor: 'emerald' },
            { id: 'SET-04', title: 'Staff Role Permissions & Register Cash Caps', category: 'Security', qty: 1, threshold: 0, status: 'Configured', statusColor: 'emerald' },
          ],
        };
    }
  }, [section, branchName, isAllBranches, currencySymbol, organization.currency]);

  const Icon = sectionMeta.icon;

  const filteredRows = React.useMemo(() => {
    return sectionMeta.rows.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filterStatus !== 'all') {
        if (r.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
      }
      return true;
    });
  }, [sectionMeta.rows, searchQuery, filterStatus]);

  return (
    <div className="space-y-6">
      {/* ================= SECTION TOP HERO BANNER ================= */}
      <div className="bg-[#181a20] border border-[#2d3139]/80 rounded-sm p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-sm bg-[#985184]/15 text-[#985184] flex items-center justify-center shrink-0 border border-[#985184]/30 shadow-xs">
              <Icon className="w-6 h-6 text-[#fbb945]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-white tracking-tight">{sectionMeta.title}</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#23262f] text-slate-300 border border-white/5">
                  <Store className="w-3 h-3 text-[#fbb945]" />
                  <span>{isAllBranches ? 'All Branches (Consolidated)' : branchName}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {sectionMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Actions in Banner */}
          <div className="flex items-center gap-2.5 shrink-0">
            {section === 'Settings' ? (
              <Button
                type="button"
                onClick={onOpenBranchModal}
                className="bg-[#985184] hover:bg-[#854372] text-white text-xs font-semibold h-9 px-4 rounded-sm shadow-sm cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Manage Branches Hub
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (sectionMeta.secondaryActionText.includes('Branch')) {
                      onOpenBranchModal();
                    }
                  }}
                  className="bg-transparent border border-[#2d3139] hover:bg-white/5 text-slate-300 text-xs h-9 px-3.5 rounded-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  {sectionMeta.secondaryActionText}
                </Button>
                <Button
                  size="sm"
                  className="bg-[#985184] hover:bg-[#854372] text-white text-xs font-semibold h-9 px-4 rounded-sm shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {sectionMeta.primaryActionText}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= 4 KPI SUMMARY CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sectionMeta.kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-[#181a20] border border-[#2d3139]/60 rounded-sm p-4.5 flex flex-col justify-between hover:border-[#3d424e] transition-colors"
          >
            <div className="text-xs text-slate-400 font-medium">{kpi.label}</div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white tracking-tight">{kpi.value}</div>
              <div
                className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
                  kpi.isPositive ? 'text-[#fbb945]' : 'text-rose-400'
                }`}
              >
                {kpi.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= DATA TABLE & RECORD LIST ================= */}
      <div className="bg-[#181a20] border border-[#2d3139]/80 rounded-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-[#2d3139]/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${section.toLowerCase()} records...`}
              className="w-full bg-[#121316] text-xs text-slate-200 placeholder:text-slate-500 pl-9 pr-3 py-2 rounded-sm border border-[#2d3139] focus:outline-none focus:border-[#985184]"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#121316] border border-[#2d3139] text-xs font-semibold text-slate-200 px-3 py-2 rounded-sm cursor-pointer focus:outline-none focus:border-[#985184]"
            >
              <option value="all">All Statuses</option>
              <option value="healthy">Healthy / Verified</option>
              <option value="low stock">Low Stock / Review</option>
              <option value="delivered">Delivered / Completed</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2d3139]/60 bg-[#141519]/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Identifier</th>
                <th className="py-3 px-4">Record Description</th>
                <th className="py-3 px-4">Category / Type</th>
                <th className="py-3 px-4 text-right">Units / Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3139]/40 text-xs">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#fbb945]">{row.id}</td>
                  <td className="py-3 px-4 font-medium text-white">{row.title}</td>
                  <td className="py-3 px-4 text-slate-400">{row.category}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                    {section === 'Reports' || section === 'Orders'
                      ? `${currencySymbol}${row.threshold.toLocaleString()}`
                      : `${row.qty} units`}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-semibold ${
                        row.statusColor === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : row.statusColor === 'amber'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : row.statusColor === 'rose'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (section === 'Inventory') {
                          onNavigate('/inventory/products');
                        } else if (section === 'Settings') {
                          onOpenBranchModal();
                        }
                      }}
                      className="text-xs text-[#985184] hover:text-[#b4659d] font-semibold cursor-pointer inline-flex items-center gap-1 hover:underline"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info banner */}
        <div className="p-4 bg-[#141519]/40 border-t border-[#2d3139]/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#fbb945]" />
            <span>
              Showing {filteredRows.length} active {section.toLowerCase()} records for branch{' '}
              <strong className="text-white">{isAllBranches ? 'All Branches' : branchName}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/inventory/products')}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Catalog Products</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={() => onNavigate('/inventory/categories')}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Categories</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
