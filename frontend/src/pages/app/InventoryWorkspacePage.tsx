import * as React from 'react';
import {
  Package,
  Plus,
  LayoutDashboard,
  FolderTree,
  Boxes,
  ShoppingCart,
  Users,
  FileText,
  RotateCcw,
  BarChart3,
  Settings,
  Search,
  Bell,
  Mail,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  ShoppingBag,
  SlidersHorizontal,
  MoreVertical,
  CheckCircle2,
  Clock,
  Menu,
  X,
  Sparkles,
  Store,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SeoHead } from '../../components/seo/SeoHead';
import { Link } from 'react-router-dom';
import { CategoriesPage } from '../../features/inventory/components/CategoriesPage';
import { ProductsPage } from '../../features/inventory/components/ProductsPage';

interface InventoryWorkspacePageProps {
  organization: {
    name: string;
    subdomain: string;
    currency: string;
    business_type?: string;
  };
  branch: {
    id: string;
    name: string;
    type: string;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export function InventoryWorkspacePage({
  organization,
  branch,
  branches,
}: InventoryWorkspacePageProps) {
  const [selectedBranch, setSelectedBranch] = React.useState(branch || branches[0]);
  const [currentCurrency, setCurrentCurrency] = React.useState(organization.currency || 'USD');
  const [activeTab, setActiveTab] = React.useState('Dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeModal, setActiveModal] = React.useState<string | null>(null);
  const [categoryTimeRange, setCategoryTimeRange] = React.useState<'All time' | 'Weekly' | 'Monthly'>('Monthly');
  const [demographicTimeRange, setDemographicTimeRange] = React.useState<'All time' | 'Weekly' | 'Monthly'>('All time');
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | null>(6); // Default 7 May (index 6)

  const currencySymbol = currentCurrency === 'NGN' ? '₦' : '$';

  // Navigation Items
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Products', icon: Package },
    { name: 'Categories', icon: FolderTree },
    { name: 'Inventory', icon: Boxes },
    { name: 'Orders', icon: ShoppingCart },
    { name: 'Suppliers', icon: Users },
    { name: 'Purchase Orders', icon: FileText },
    { name: 'Returns', icon: RotateCcw },
    { name: 'Reports', icon: BarChart3 },
    { name: 'Settings', icon: Settings },
  ];

  // Daily Orders & Profit Data (May 1 - May 15)
  const dailyOrdersData = [
    { day: '1 May', income: 4200, profit: 1200 },
    { day: '2 May', income: 4900, profit: 1100 },
    { day: '3 May', income: 6400, profit: 1500 },
    { day: '4 May', income: 5800, profit: 1200 },
    { day: '5 May', income: 5100, profit: 1000 },
    { day: '6 May', income: 4800, profit: 900 },
    { day: '7 May', income: 4620, profit: 1080 },
    { day: '8 May', income: 3900, profit: 800 },
    { day: '9 May', income: 4700, profit: 1100 },
    { day: '10 May', income: 5300, profit: 1300 },
    { day: '11 May', income: 5900, profit: 1400 },
    { day: '12 May', income: 7200, profit: 1800 },
    { day: '13 May', income: 6800, profit: 1600 },
    { day: '14 May', income: 5400, profit: 1200 },
    { day: '15 May', income: 5100, profit: 1100 },
  ];

  // Top Categories Donut Data
  const categoriesData = [
    { name: 'T-Shirts', percent: 30, color: '#fbb945' },
    { name: 'Hoodies', percent: 22, color: '#985184' },
    { name: 'Jeans', percent: 18, color: '#d48834' },
    { name: 'Shoes', percent: 15, color: '#854372' },
    { name: 'Jackets', percent: 10, color: '#e09825' },
    { name: 'Other', percent: 5, color: '#4a4e5a' },
  ];

  // Customer Demographics Data
  const demographicData = [
    { range: '18–24', percent: 24 },
    { range: '25–34', percent: 29 },
    { range: '35–44', percent: 21 },
    { range: '45–54', percent: 16 },
    { range: '55+', percent: 10 },
  ];

  // Product Sales Catalog
  const productSales = [
    {
      id: 'p1',
      name: 'Classic Oversized Tee',
      imgBg: 'bg-[#2a2d36]',
      stock: 156,
      oldPrice: 39.99,
      sale: '15%',
      newPrice: 33.99,
      itemsSold: 320,
    },
    {
      id: 'p2',
      name: 'Premium Hoodie',
      imgBg: 'bg-[#2a2d36]',
      stock: 98,
      oldPrice: 79.99,
      sale: '20%',
      newPrice: 63.99,
      itemsSold: 210,
    },
    {
      id: 'p3',
      name: 'Slim Fit Jeans',
      imgBg: 'bg-[#2a2d36]',
      stock: 214,
      oldPrice: 59.99,
      sale: '10%',
      newPrice: 53.99,
      itemsSold: 178,
    },
    {
      id: 'p4',
      name: 'Bomber Jacket',
      imgBg: 'bg-[#2a2d36]',
      stock: 67,
      oldPrice: 119.99,
      sale: '25%',
      newPrice: 89.99,
      itemsSold: 96,
    },
    {
      id: 'p5',
      name: 'Sneakers Pro',
      imgBg: 'bg-[#2a2d36]',
      stock: 132,
      oldPrice: 89.99,
      sale: '12%',
      newPrice: 79.19,
      itemsSold: 142,
    },
  ];

  // Recent Orders Feed
  const recentOrders = [
    {
      id: '#ORD-7956',
      customer: 'Rohan Verma',
      amount: 149.99,
      status: 'Delivered',
      statusColor: 'text-emerald-400 bg-emerald-500/10',
      time: '2h ago',
    },
    {
      id: '#ORD-7955',
      customer: 'Ananya Singh',
      amount: 89.5,
      status: 'Processing',
      statusColor: 'text-[#fbb945] bg-[#fbb945]/10',
      time: '4h ago',
    },
    {
      id: '#ORD-7954',
      customer: 'Karan Mehta',
      amount: 199.0,
      status: 'Shipped',
      statusColor: 'text-sky-400 bg-sky-500/10',
      time: '6h ago',
    },
    {
      id: '#ORD-7953',
      customer: 'Neha Kapoor',
      amount: 59.49,
      status: 'Processing',
      statusColor: 'text-[#fbb945] bg-[#fbb945]/10',
      time: '8h ago',
    },
    {
      id: '#ORD-7952',
      customer: 'Vikram Patel',
      amount: 249.0,
      status: 'Cancelled',
      statusColor: 'text-rose-400 bg-rose-500/10',
      time: '10h ago',
    },
  ];

  return (
    <div className="min-h-screen bg-[#111215] text-slate-100 flex flex-col font-sans selection:bg-[#985184] selection:text-white">
      <SeoHead
        title={`${organization.name} | Inventory Management Dashboard`}
        description="Comprehensive inventory workspace, product sales, retail analytics, and stock catalog."
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-screen">
        {/* ================= LEFT SIDEBAR (DESKTOP & DRAWER) ================= */}
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#141519] flex flex-col justify-between p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {/* Top Brand & Navigation */}
          <div className="space-y-6">
            {/* Organization Branding */}
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-[#985184] flex items-center justify-center text-white font-black text-lg shadow-sm">
                  {organization.name.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight truncate max-w-[140px]">
                  <div className="font-bold text-white text-sm truncate">{organization.name}</div>
                  <div className="text-[11px] text-slate-400 font-medium">Inventory Management</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1 text-slate-400 hover:text-white rounded-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.name);
                      setMobileMenuOpen(false);
                      if (item.name !== 'Dashboard' && item.name !== 'Categories' && item.name !== 'Products') {
                        setActiveModal(item.name);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-xs font-semibold transition-all cursor-pointer text-left ${isActive
                        ? 'bg-[#985184] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Active Branch & POS Card */}
          <div className="bg-[#181a20] p-4 rounded-sm space-y-3 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm bg-[#fbb945]/15 text-[#fbb945] flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">{selectedBranch?.name || 'Primary Store'}</div>
                <div className="text-[10px] text-slate-400 font-mono">Terminal 01 • Active</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Stock synced in real-time across checkout counters.
            </p>

            <Button
              type="button"
              size="sm"
              onClick={() => setActiveModal('Branch Settings')}
              className="w-full bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-8 rounded-sm shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Branch Settings</span>
            </Button>
          </div>
        </aside>

        {/* ================= MAIN CONTENT AREA ================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar */}
          <header className="h-16 bg-[#141519] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
            {/* Left: Mobile Toggle & Global Search */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full bg-[#181a20] text-xs text-slate-200 placeholder:text-slate-500 pl-9 pr-12 py-2 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#985184]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 bg-white/5 px-1 py-0.5 rounded-sm">
                  ⌘K
                </span>
              </div>
            </div>

            {/* Right: Currency Toggle, Alerts, Launchpad, Avatar */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Currency Selector */}
              <div className="relative">
                <select
                  value={currentCurrency}
                  onChange={(e) => setCurrentCurrency(e.target.value)}
                  className="bg-[#181a20] text-xs font-semibold text-slate-200 pl-3 pr-7 py-1.5 rounded-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#985184]"
                >
                  <option value="USD">USD</option>
                  <option value="NGN">NGN</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => setActiveModal('Notifications')}
                className="relative p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-[#fbb945] text-[#111215] font-black text-[9px] rounded-full flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Messages / Mail */}
              <button
                type="button"
                onClick={() => setActiveModal('Messages')}
                className="p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer hidden sm:flex"
                title="Messages"
              >
                <Mail className="w-4 h-4" />
              </button>

              {/* Return to Launchpad */}
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-sm hover:bg-white/5 transition-colors"
                title="Return to Launchpad"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#fbb945]" />
                <span className="hidden md:inline">Launchpad</span>
              </Link>

              {/* User Avatar */}
              <div className="w-8 h-8 rounded-sm bg-[#985184] text-white font-bold text-xs flex items-center justify-center shadow-sm cursor-pointer">
                {organization.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          {/* ================= WORKSPACE BODY CONTENT ================= */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 w-full mx-auto">
            {activeTab === 'Categories' ? (
              <CategoriesPage organization={organization} />
            ) : activeTab === 'Products' ? (
              <ProductsPage organization={organization} />
            ) : (
              <>
                {/* ROW 1: TOP 4 METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Card 1: Recent Orders */}
              <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Recent Orders</span>
                    <TrendingUp className="w-4 h-4 text-[#fbb945]" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-black text-white tracking-tight">
                      {currencySymbol}18,745
                    </span>
                    <span className="text-[11px] font-bold text-[#fbb945] flex items-center">
                      <TrendingDown className="w-3 h-3 mr-0.5" /> 8.4%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {currencySymbol}20,461 last month
                  </div>
                </div>

                {/* SVG Sparkline with Tooltip Pill */}
                <div className="relative pt-6 pb-1">
                  <div className="absolute top-0 right-14 bg-[#23262f] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm flex items-center gap-1">
                    <span>{currencySymbol}2,104</span>
                  </div>
                  <svg className="w-full h-12 overflow-visible" viewBox="0 0 200 40">
                    <path
                      d="M 0 32 Q 35 15, 60 25 T 110 18 T 150 10 T 200 28"
                      fill="none"
                      stroke="#fbb945"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="150" cy="10" r="4" fill="#fbb945" />
                  </svg>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>1 May</span>
                    <span>8 May</span>
                    <span>15 May</span>
                    <span>22 May</span>
                    <span>29 May</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Total Customers & Retail Distribution */}
              <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Total Customers</span>
                    <Users className="w-4 h-4 text-[#fbb945]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="text-[10px] text-slate-400">Current Customers</div>
                      <div className="text-xl font-extrabold text-white">2,847</div>
                      <div className="text-[10px] text-[#fbb945] font-semibold">↗ 12.6% vs last mo</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">New Customers</div>
                      <div className="text-xl font-extrabold text-white">742</div>
                      <div className="text-[10px] text-[#fbb945] font-semibold">↗ 16.3% vs Apr</div>
                    </div>
                  </div>
                </div>

                {/* Channel Distribution */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    Sales Channel Distribution
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 p-2 rounded-sm">
                      <div className="font-bold text-white">58%</div>
                      <div className="text-[10px] text-slate-400">Walk-in / POS</div>
                      <div className="text-[10px] text-[#fbb945] font-mono">1,652 · ↗ 9.8%</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded-sm">
                      <div className="font-bold text-white">42%</div>
                      <div className="text-[10px] text-slate-400">Online Store</div>
                      <div className="text-[10px] text-[#fbb945] font-mono">1,195 · ↗ 15.7%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Total Revenue */}
              <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Total Revenue</span>
                    <ShoppingBag className="w-4 h-4 text-[#fbb945]" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-black text-white tracking-tight">
                      {currencySymbol}124,680
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400">↗ 22.7%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {currencySymbol}101,630 last month
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    Revenue over the last 7 days
                  </div>
                </div>

                {/* Paired Bar Chart */}
                <div className="pt-4">
                  <div className="flex items-end justify-between h-20 gap-1.5 px-1">
                    {[
                      { day: 'Mon', thisWeek: 50, lastWeek: 35 },
                      { day: 'Tue', thisWeek: 65, lastWeek: 45 },
                      { day: 'Wed', thisWeek: 55, lastWeek: 40 },
                      { day: 'Thu', thisWeek: 85, lastWeek: 55 },
                      { day: 'Fri', thisWeek: 95, lastWeek: 70 },
                      { day: 'Sat', thisWeek: 75, lastWeek: 60 },
                      { day: 'Sun', thisWeek: 60, lastWeek: 50 },
                    ].map((col, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-0.5 h-16">
                          <div
                            style={{ height: `${col.thisWeek}%` }}
                            className="w-1.5 sm:w-2 bg-[#985184] rounded-sm"
                          />
                          <div
                            style={{ height: `${col.lastWeek}%` }}
                            className="w-1.5 sm:w-2 bg-[#fbb945] rounded-sm"
                          />
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">{col.day}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 mt-2 font-mono">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#985184]" />
                      <span>This week</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#fbb945]" />
                      <span>Last week</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Top Categories (Donut Chart) */}
              <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>Top Categories</span>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                  </div>

                  {/* Donut Chart Simulation */}
                  <div className="flex items-center justify-center py-4">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#4a4e5a" strokeWidth="4" />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="transparent"
                          stroke="#985184"
                          strokeWidth="4"
                          strokeDasharray="22 100"
                          strokeDashoffset="0"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="transparent"
                          stroke="#fbb945"
                          strokeWidth="4"
                          strokeDasharray="30 100"
                          strokeDashoffset="-22"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="transparent"
                          stroke="#d48834"
                          strokeWidth="4"
                          strokeDasharray="18 100"
                          strokeDashoffset="-52"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="transparent"
                          stroke="#854372"
                          strokeWidth="4"
                          strokeDasharray="15 100"
                          strokeDashoffset="-70"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-sm font-black text-white">100%</span>
                        <span className="text-[9px] text-slate-400 font-mono">Stocked</span>
                      </div>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400 pt-1">
                    {categoriesData.map((cat, i) => (
                      <div key={i} className="flex items-center gap-1 truncate">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time range toggles */}
                <div className="flex items-center justify-center gap-1 bg-[#141519] p-1 rounded-sm mt-3">
                  {(['All time', 'Weekly', 'Monthly'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setCategoryTimeRange(range)}
                      className={`flex-1 py-1 text-[10px] font-semibold rounded-sm transition-all cursor-pointer ${categoryTimeRange === range
                          ? 'bg-[#985184] text-white'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 2: TOTAL ORDERS BAR CHART & CUSTOMER DEMOGRAPHICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Wide Card: Total Orders (Timeline Bar Chart) */}
              <div className="lg:col-span-2 bg-[#181a20] p-5 sm:p-6 rounded-sm flex flex-col justify-between">
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Total Orders</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Daily order revenue & profit analysis
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#fbb945]" />
                      <span className="text-slate-300">Income</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#985184]" />
                      <span className="text-slate-300">Profit</span>
                    </div>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                  </div>
                </div>

                {/* Interactive Bar Chart */}
                <div className="relative pt-6 pb-2">
                  {/* Tooltip Overlay */}
                  {hoveredBarIndex !== null && (
                    <div
                      className="absolute top-0 z-20 bg-[#23262f] text-white p-2.5 rounded-sm shadow-xl text-xs space-y-1 font-mono pointer-events-none transition-all duration-150"
                      style={{
                        left: `${Math.min(Math.max((hoveredBarIndex / dailyOrdersData.length) * 100, 10), 80)}%`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <div className="font-bold text-white">{dailyOrdersData[hoveredBarIndex].day}</div>
                      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                        <span className="flex items-center gap-1 text-[#fbb945]">● Income</span>
                        <span>{currencySymbol}{dailyOrdersData[hoveredBarIndex].income.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                        <span className="flex items-center gap-1 text-[#985184]">● Profit</span>
                        <span>{currencySymbol}{dailyOrdersData[hoveredBarIndex].profit.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-white/10 pt-1 flex items-center justify-between gap-3 text-[11px] font-bold text-white">
                        <span>● Total</span>
                        <span>
                          {currencySymbol}
                          {(
                            dailyOrdersData[hoveredBarIndex].income +
                            dailyOrdersData[hoveredBarIndex].profit
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bars Container */}
                  <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 px-1">
                    {dailyOrdersData.map((item, idx) => {
                      const maxVal = 9000;
                      const incomeH = (item.income / maxVal) * 100;
                      const profitH = (item.profit / maxVal) * 100;
                      const isHovered = hoveredBarIndex === idx;

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredBarIndex(idx)}
                          className="flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer group"
                        >
                          <div className="w-full flex flex-col items-center justify-end h-full">
                            {/* Stacked Profit (Top) */}
                            <div
                              style={{ height: `${profitH}%` }}
                              className={`w-full max-w-[18px] bg-[#985184] rounded-t-sm transition-all ${isHovered ? 'brightness-125' : ''
                                }`}
                            />
                            {/* Income (Base) */}
                            <div
                              style={{ height: `${incomeH}%` }}
                              className={`w-full max-w-[18px] bg-[#fbb945] rounded-b-sm transition-all ${isHovered ? 'brightness-125' : ''
                                }`}
                            />
                          </div>
                          <span
                            className={`text-[9px] font-mono truncate ${isHovered ? 'text-white font-bold' : 'text-slate-500'
                              }`}
                          >
                            {item.day.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 6: Customer Demographic / Stock Age */}
              <div className="bg-[#181a20] p-5 sm:p-6 rounded-sm flex flex-col justify-between">
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">
                      Customer Demographic
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Purchaser age distribution</p>
                  </div>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                </div>

                {/* Horizontal Progress Bars */}
                <div className="space-y-4 py-2">
                  {demographicData.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-300">{item.range}</span>
                        <span className="font-bold text-white">{item.percent}%</span>
                      </div>
                      <div className="w-full bg-[#141519] h-2.5 rounded-sm overflow-hidden">
                        <div
                          style={{ width: `${item.percent * 2.5}%` }}
                          className="h-full bg-[#fbb945] rounded-sm transition-all duration-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time range toggles */}
                <div className="flex items-center justify-center gap-1 bg-[#141519] p-1 rounded-sm mt-4">
                  {(['All time', 'Weekly', 'Monthly'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setDemographicTimeRange(range)}
                      className={`flex-1 py-1 text-[10px] font-semibold rounded-sm transition-all cursor-pointer ${demographicTimeRange === range
                          ? 'bg-[#985184] text-white'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 3: PRODUCT SALES TABLE & RECENT ORDERS FEED */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Product Sales Table (2/3 width) */}
              <div className="lg:col-span-2 bg-[#181a20] p-5 sm:p-6 rounded-sm space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Product Sales</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Top moving stock items & pricing
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => setActiveModal('New Product')}
                      className="bg-[#985184] hover:bg-[#854372] text-white text-xs font-semibold h-7 px-3 rounded-sm shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Product</span>
                    </Button>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                  </div>
                </div>

                {/* Table Responsive Wrapper */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px] font-mono border-b border-white/5">
                        <th className="pb-3 font-medium">Item</th>
                        <th className="pb-3 font-medium">Stock</th>
                        <th className="pb-3 font-medium">Old Price</th>
                        <th className="pb-3 font-medium">Sale</th>
                        <th className="pb-3 font-medium">New Price</th>
                        <th className="pb-3 font-medium text-right">Items Sold</th>
                        <th className="pb-3 font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {productSales.map((product) => (
                        <tr
                          key={product.id}
                          className="hover:bg-white/5 transition-colors group cursor-pointer"
                          onClick={() => setActiveModal(`Product: ${product.name}`)}
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-sm ${product.imgBg} flex items-center justify-center text-slate-300 shrink-0 font-bold text-xs`}
                              >
                                <Package className="w-4 h-4 text-[#fbb945]" />
                              </div>
                              <span className="font-semibold text-white group-hover:text-[#fbb945] transition-colors truncate max-w-[160px]">
                                {product.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-slate-300">{product.stock}</td>
                          <td className="py-3 font-mono text-slate-400 line-through">
                            {currencySymbol}{product.oldPrice.toFixed(2)}
                          </td>
                          <td className="py-3 font-mono text-emerald-400 font-bold">{product.sale}</td>
                          <td className="py-3 font-mono font-bold text-white">
                            {currencySymbol}{product.newPrice.toFixed(2)}
                          </td>
                          <td className="py-3 font-mono text-slate-200 text-right">{product.itemsSold}</td>
                          <td className="py-3 text-right">
                            <MoreVertical className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Orders Feed (1/3 width) */}
              <div className="bg-[#181a20] p-5 sm:p-6 rounded-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">Recent Orders</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Live store register transactions</p>
                  </div>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                </div>

                {/* Orders List */}
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setActiveModal(`Order: ${order.id}`)}
                      className="p-3 rounded-sm bg-[#141519] hover:bg-white/5 transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center text-[#fbb945]">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-[#fbb945] transition-colors">
                            {order.id}
                          </div>
                          <div className="text-[10px] text-slate-400">{order.customer}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-white font-mono">
                          {currencySymbol}{order.amount.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-sm ${order.statusColor}`}
                          >
                            ● {order.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{order.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* ================= OPERATIONAL ACTION MODAL ================= */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#181a20] rounded-sm max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-sm bg-[#985184]/15 text-[#985184] mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#fbb945]" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{activeModal}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Branch <span className="text-[#fbb945] font-semibold">{selectedBranch?.name || 'Primary Store'}</span> is synced. You can manage {activeModal.toLowerCase()} records, barcode printing, and pricing parameters here.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-9 rounded-sm cursor-pointer shadow-sm"
              >
                Close & Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
