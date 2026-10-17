import * as React from 'react';
import {
  Boxes,
  Package,
  Layers,
  ArrowRightLeft,
  SlidersHorizontal,
  PackagePlus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Store,
  History,
  Info,
  Receipt,
  Eye,
  Building2,
  Calendar,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { useUrlActionState } from '../../../hooks/useUrlActionState';
import {
  useStockSummary,
  useStockList,
  useStockMovements,
} from '../hooks/useStock';
import { ReceiveStockModal } from './ReceiveStockModal';
import { AdjustStockModal } from './AdjustStockModal';
import { BranchTransferModal } from './BranchTransferModal';
import { OpeningStockModal } from './OpeningStockModal';
import { ReceiptDetailsDrawer } from './ReceiptDetailsDrawer';
import { stockReceiptsApi, type StockReceipt } from '../stock-receipts-api';
import { supplierApi, type Supplier } from '../suppliers-api';
import type { StockItem } from '../stock-api';

export interface StockManagementPageProps {
  organization: {
    id?: string;
    name: string;
    currency?: string;
    subdomain?: string;
  };
  branchId?: string;
  branchName?: string;
  branches: Array<{ id: string; name: string }>;
  onOpenBranchModal?: () => void;
}

export function StockManagementPage({
  organization,
  branchId,
  branchName,
  branches,
  onOpenBranchModal,
}: StockManagementPageProps) {
  const currencySymbol = organization.currency === 'USD' ? '$' : '₦';
  const effectiveBranchId = (branchId && branchId !== 'all' ? branchId : undefined) || branches[0]?.id;

  const location = useLocation();
  const searchParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const paramSubTab = searchParams.get('subTab');

  // Sub-tabs: 'overview' | 'list' | 'receipts' | 'ledger'
  const [activeSubTab, setActiveSubTab] = React.useState<'overview' | 'list' | 'receipts' | 'ledger'>(() => {
    if (paramSubTab === 'receipts' || paramSubTab === 'list' || paramSubTab === 'ledger') {
      return paramSubTab;
    }
    return 'overview';
  });

  React.useEffect(() => {
    const pSub = searchParams.get('subTab');
    if (pSub === 'receipts' || pSub === 'list' || pSub === 'ledger' || pSub === 'overview') {
      setActiveSubTab(pSub as any);
    }
  }, [searchParams]);

  // Filters for Stock List
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [currentPage, setCurrentPage] = React.useState(1);

  // Filters for Movement Ledger
  const [movementTypeFilter, setMovementTypeFilter] = React.useState<string>('all');
  const [movementPage, setMovementPage] = React.useState(1);

  // Filters & State for Stock Receipts
  const [receiptSearch, setReceiptSearch] = React.useState('');
  const [receiptSupplierFilter, setReceiptSupplierFilter] = React.useState<string>('all');
  const [receiptPage, setReceiptPage] = React.useState(1);
  const [receiptsList, setReceiptsList] = React.useState<StockReceipt[]>([]);
  const [receiptTotalPages, setReceiptTotalPages] = React.useState(1);
  const [receiptTotalCount, setReceiptTotalCount] = React.useState(0);
  const [isLoadingReceipts, setIsLoadingReceipts] = React.useState(false);
  const [inspectReceiptId, setInspectReceiptId] = React.useState<string | null>(null);
  const [suppliersList, setSuppliersList] = React.useState<Supplier[]>([]);

  // URL Action State for deep-linking & session resumption
  const {
    activeAction,
    activeEntityId: actionProductId,
    openAction,
    closeAction,
  } = useUrlActionState<'adjust' | 'receive' | 'transfer' | 'opening'>({
    actionParam: 'action',
    entityIdParam: 'productId',
  });

  const [selectedStockItem, setSelectedStockItem] = React.useState<StockItem | null>(null);

  // Notify user when workflow session is restored from URL
  const restoredToastRef = React.useRef(false);
  React.useEffect(() => {
    if (activeAction && !restoredToastRef.current) {
      restoredToastRef.current = true;
      toast.info('Session restored — resumed where you left off', {
        description: `Active workflow: ${activeAction.replace('_', ' ')} stock`,
      });
    }
  }, [activeAction]);

  // Queries
  const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = useStockSummary(effectiveBranchId);

  const {
    data: stockData,
    isLoading: isLoadingStock,
    refetch: refetchStock,
  } = useStockList({
    branchId: effectiveBranchId,
    search: searchQuery,
    status: statusFilter,
    page: currentPage,
    limit: 20,
  });

  const {
    data: movementsData,
    isLoading: isLoadingMovements,
    refetch: refetchMovements,
  } = useStockMovements({
    branchId: effectiveBranchId,
    movementType: movementTypeFilter,
    page: movementPage,
    limit: 20,
  });

  const fetchReceipts = React.useCallback(async () => {
    setIsLoadingReceipts(true);
    try {
      const res = await stockReceiptsApi.listReceipts({
        branchId: effectiveBranchId,
        supplierId: receiptSupplierFilter !== 'all' ? receiptSupplierFilter : undefined,
        search: receiptSearch.trim() || undefined,
        page: receiptPage,
        limit: 20,
      });
      setReceiptsList(res.receipts);
      setReceiptTotalPages(res.pagination.totalPages);
      setReceiptTotalCount(res.pagination.total);
    } catch {
      // ignore
    } finally {
      setIsLoadingReceipts(false);
    }
  }, [effectiveBranchId, receiptSupplierFilter, receiptSearch, receiptPage]);

  // Load suppliers list for receipt filtering
  React.useEffect(() => {
    supplierApi.listSuppliers?.({ limit: 100 })?.then((res) => {
      setSuppliersList(res?.suppliers || []);
    })?.catch(() => {});
  }, []);

  React.useEffect(() => {
    if (activeSubTab === 'receipts') {
      fetchReceipts();
    }
  }, [activeSubTab, fetchReceipts]);

  const handleRefreshAll = () => {
    refetchSummary();
    refetchStock();
    refetchMovements();
    if (activeSubTab === 'receipts') {
      fetchReceipts();
    }
  };

  const effectiveBranchName = React.useMemo(() => {
    if (branchName) return branchName;
    if (effectiveBranchId) {
      return branches.find((b) => b.id === effectiveBranchId)?.name || 'Selected Branch';
    }
    return '';
  }, [branchName, effectiveBranchId, branches]);

  const requireActiveBranch = (_actionName: string): boolean => {
    return true;
  };

  const handleOpenReceive = (item?: StockItem) => {
    if (!requireActiveBranch('receive stock')) return;
    setSelectedStockItem(item || null);
    openAction('receive', item?.productId);
  };

  const handleOpenAdjust = (item?: StockItem) => {
    if (!requireActiveBranch('adjust stock')) return;
    setSelectedStockItem(item || null);
    openAction('adjust', item?.productId);
  };

  const handleOpenTransfer = (item?: StockItem) => {
    if (!requireActiveBranch('transfer stock')) return;
    setSelectedStockItem(item || null);
    openAction('transfer', item?.productId);
  };

  const handleOpenOpening = (item?: StockItem) => {
    if (!requireActiveBranch('record opening stock')) return;
    setSelectedStockItem(item || null);
    openAction('opening', item?.productId);
  };

  const handleCloseModals = () => {
    closeAction();
    setSelectedStockItem(null);
  };

  const items = stockData?.items || [];
  const totalPages = stockData?.pagination?.totalPages || 1;
  const movements = movementsData?.movements || [];
  const movementTotalPages = movementsData?.pagination?.totalPages || 1;

  const effectiveSelectedItem = React.useMemo(() => {
    if (selectedStockItem) return selectedStockItem;
    if (actionProductId && items.length > 0) {
      return items.find((i) => i.productId === actionProductId) || null;
    }
    return null;
  }, [selectedStockItem, actionProductId, items]);

  const isReceiveModalOpen = activeAction === 'receive';
  const isAdjustModalOpen = activeAction === 'adjust';
  const isTransferModalOpen = activeAction === 'transfer';
  const isOpeningModalOpen = activeAction === 'opening';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d0e12] text-slate-100 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="border-b border-[#2d3139]/80 bg-[#121316]/90 backdrop-blur-md px-6 py-4 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#985184] to-[#fbb945] p-px shadow-lg">
            <div className="w-full h-full bg-[#121316] rounded-xl flex items-center justify-center">
              <Boxes className="w-5 h-5 text-[#fbb945]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Stock Management & Ledger</h1>
              <Badge variant="outline" className="text-xs bg-[#252830] border-[#363a45] text-slate-300 font-normal">
                Perpetual Control
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time inventory levels, stock adjustments, receipt logging, and audit ledger
            </p>
          </div>
        </div>

        {/* Global Stock Actions Toolbar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="h-8 text-xs border-[#2d3139] text-slate-300 hover:bg-white/5"
            title="Refresh Stock Metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenOpening()}
            className="h-8 text-xs border-[#2d3139] text-purple-300 hover:bg-purple-500/10"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-400" />
            Opening Stock
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenTransfer()}
            disabled={branches.length < 2}
            className="h-8 text-xs border-[#2d3139] text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
            title={branches.length < 2 ? 'Requires at least 2 branches' : 'Transfer stock'}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1 text-blue-400" />
            Transfer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAdjust()}
            className="h-8 text-xs border-[#2d3139] text-amber-300 hover:bg-amber-500/10"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Adjust Stock
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenReceive()}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <PackagePlus className="w-3.5 h-3.5 mr-1" />
            Receive Stock
          </Button>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="border-b border-[#2d3139] bg-[#121316] px-6">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'overview'
                ? 'border-[#fbb945] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Stock Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('list')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'list'
                ? 'border-[#fbb945] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Product Stock List</span>
            {summary && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e2028] text-slate-400 font-mono">
                {summary.totalTracked}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('receipts')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'receipts'
                ? 'border-[#fbb945] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Stock Receipts</span>
            {receiptTotalCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e2028] text-emerald-400 font-mono">
                {receiptTotalCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('ledger')}
            className={`py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'ledger'
                ? 'border-[#fbb945] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Movements Ledger</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-white/5 border-[#2d3139] text-slate-400">
              Audit
            </Badge>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-6 space-y-6">
        {/* ==================== SUB-TAB 1: OVERVIEW ==================== */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Tracked */}
              <div className="p-4 rounded-xl bg-[#14151a] border border-[#2d3139] space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                  <span>Tracked Products</span>
                  <Package className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {summary ? summary.totalTracked : '...'}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Total On Hand:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {summary ? summary.totalQuantityOnHand.toLocaleString() : 0} units
                  </span>
                </div>
              </div>

              {/* In Stock */}
              <div className="p-4 rounded-xl bg-[#14151a] border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
                  <span>In Stock</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  {summary ? summary.inStockCount : '...'}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Available for Sale:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {summary ? summary.totalAvailable.toLocaleString() : 0} units
                  </span>
                </div>
              </div>

              {/* Low Stock Alerts */}
              <div
                onClick={() => {
                  setStatusFilter('low_stock');
                  setActiveSubTab('list');
                }}
                className="p-4 rounded-xl bg-[#14151a] border border-amber-500/20 space-y-2 cursor-pointer hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
                  <span>Low Stock Warnings</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {summary ? summary.lowStockCount : '...'}
                </div>
                <div className="text-[11px] text-amber-300/80 flex items-center justify-between">
                  <span>Requires reorder soon</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Out of Stock */}
              <div
                onClick={() => {
                  setStatusFilter('out_of_stock');
                  setActiveSubTab('list');
                }}
                className="p-4 rounded-xl bg-[#14151a] border border-rose-500/20 space-y-2 cursor-pointer hover:border-rose-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
                  <span>Out of Stock</span>
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-bold text-rose-400 font-mono">
                  {summary ? summary.outOfStockCount : '...'}
                </div>
                <div className="text-[11px] text-rose-300/80 flex items-center justify-between">
                  <span>0 units on hand</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Quick Operational Intake Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => handleOpenReceive()}
                className="p-5 rounded-xl bg-[#121316] border border-[#2d3139] hover:border-emerald-500/40 transition-all cursor-pointer group space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Stock Replenishment
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fast intake workflow to add units received from vendors or central production without requiring purchasing modules.
                </p>
              </div>

              <div
                onClick={() => handleOpenAdjust()}
                className="p-5 rounded-xl bg-[#121316] border border-[#2d3139] hover:border-amber-500/40 transition-all cursor-pointer group space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                  Reason-Coded Adjustments
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log inventory corrections, damages, expired goods, or count reconciliations with an immutable audit trail.
                </p>
              </div>

              <div
                onClick={() => handleOpenTransfer()}
                className="p-5 rounded-xl bg-[#121316] border border-[#2d3139] hover:border-blue-500/40 transition-all cursor-pointer group space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                  Inter-Branch Transfers
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Move inventory atomically between stores or warehouses with paired outbound and inbound movement records.
                </p>
              </div>
            </div>

            {/* Recent Movement Activity Preview */}
            <div className="p-5 rounded-xl bg-[#121316] border border-[#2d3139] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#fbb945]" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Recent Stock Activity Ledger
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('ledger')}
                  className="text-xs text-[#fbb945] hover:underline flex items-center gap-1 font-medium"
                >
                  <span>View All Movements</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {movements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No stock movements recorded yet. Receive stock or record opening balances to start tracking.
                </div>
              ) : (
                <div className="divide-y divide-[#2d3139]/50 text-xs">
                  {movements.slice(0, 5).map((m) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                            m.quantity >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {m.quantity >= 0 ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{m.productName}</span>
                            {m.variantName && (
                              <span className="text-[10px] font-normal px-1 py-0.2 bg-[#985184]/20 text-[#fbb945] rounded border border-[#985184]/30">
                                {m.variantName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{m.branchName}</span>
                            <span>•</span>
                            <span className="capitalize">{m.movementType.replace('_', ' ')}</span>
                            {m.reason && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{m.reason.replace('_', ' ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold ${
                            m.quantity >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Balance: {m.balanceAfter}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SUB-TAB 2: PRODUCT STOCK LIST ==================== */}
        {activeSubTab === 'list' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121316] p-3 rounded-xl border border-[#2d3139]">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    placeholder="Search by product name, SKU, or barcode..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-8 pl-9 bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
                  />
                </div>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-[#181920] p-0.5 rounded-lg border border-[#2d3139]">
                {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                      statusFilter === st
                        ? 'bg-[#985184] text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[#2d3139] bg-[#121316] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2d3139] text-slate-400 text-[10px] uppercase font-semibold bg-[#15161b]">
                    <th className="py-2.5 px-4">Product Details</th>
                    <th className="py-2.5 px-4">Branch</th>
                    <th className="py-2.5 px-4 text-right">On Hand</th>
                    <th className="py-2.5 px-4 text-right">Reserved</th>
                    <th className="py-2.5 px-4 text-right">Available</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3139]/40">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        No products match the selected stock filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1a1b22] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{item.productName}</span>
                            {item.variantId && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#985184]/20 border border-[#985184]/40 text-[#fbb945]">
                                {item.variantName || (item.variantAttributes ? Object.entries(item.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Variant')}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {item.sku} {item.categoryName ? `• ${item.categoryName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-[#1c1d24] border border-[#2d3139] text-[11px]">
                            {item.branchName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                          {item.quantityOnHand}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">
                          {item.reserved}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {item.available}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.status === 'in_stock' ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                              In Stock
                            </Badge>
                          ) : item.status === 'low_stock' ? (
                            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                              Low Stock (≤{item.lowStockThreshold})
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px]">
                              Out of Stock
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReceive(item)}
                              className="h-7 px-2 text-[11px] border-[#2d3139] text-emerald-400 hover:bg-emerald-500/10"
                              title="Receive Stock"
                            >
                              Receive
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAdjust(item)}
                              className="h-7 px-2 text-[11px] border-[#2d3139] text-amber-400 hover:bg-amber-500/10"
                              title="Adjust Stock"
                            >
                              Adjust
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenTransfer(item)}
                              disabled={branches.length < 2}
                              className="h-7 px-2 text-[11px] border-[#2d3139] text-blue-400 hover:bg-blue-500/10 disabled:opacity-40"
                              title="Transfer to another branch"
                            >
                              Transfer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-[#2d3139] bg-[#141519] flex items-center justify-between text-xs text-slate-400">
                  <div>
                    Page <span className="text-white font-medium">{currentPage}</span> of{' '}
                    <span className="text-white font-medium">{totalPages}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="h-7 text-xs border-[#2d3139]"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="h-7 text-xs border-[#2d3139]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SUB-TAB 3: MOVEMENTS LEDGER ==================== */}
        {activeSubTab === 'ledger' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121316] p-3 rounded-xl border border-[#2d3139]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Movement Type:</span>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => {
                    setMovementTypeFilter(e.target.value);
                    setMovementPage(1);
                  }}
                  className="h-8 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Movements</option>
                  <option value="opening">Opening Stock</option>
                  <option value="receipt">Stock Receipt</option>
                  <option value="adjustment">Manual Adjustment</option>
                  <option value="transfer_out">Transfer Out</option>
                  <option value="transfer_in">Transfer In</option>
                  <option value="sale">Sale Deduction</option>
                  <option value="sale_void">Sale Reversal</option>
                </select>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Movements are immutable; corrections create new balancing records.</span>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="rounded-xl border border-[#2d3139] bg-[#121316] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2d3139] text-slate-400 text-[10px] uppercase font-semibold bg-[#15161b]">
                    <th className="py-2.5 px-4">Date / Time</th>
                    <th className="py-2.5 px-4">Product Details</th>
                    <th className="py-2.5 px-4">Branch</th>
                    <th className="py-2.5 px-4 text-center">Type</th>
                    <th className="py-2.5 px-4 text-right">Delta</th>
                    <th className="py-2.5 px-4 text-right">Balance After</th>
                    <th className="py-2.5 px-4">Reason / Notes</th>
                    <th className="py-2.5 px-4">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3139]/40">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No movement history found.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-[#1a1b22] transition-colors">
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{m.productName}</span>
                            {m.variantName && (
                              <span className="text-[10px] font-normal px-1 py-0.2 bg-[#985184]/20 text-[#fbb945] rounded border border-[#985184]/30">
                                {m.variantName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {m.productSku}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{m.branchName}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`text-[10px] capitalize ${
                              m.movementType === 'opening'
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : m.movementType === 'receipt'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : m.movementType === 'adjustment'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : m.movementType === 'transfer_out'
                                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                : m.movementType === 'transfer_in'
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                            }`}
                          >
                            {m.movementType.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          <span
                            className={
                              m.quantity >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-200 font-semibold">
                          {m.balanceAfter}
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                          {m.reason && (
                            <span className="font-medium text-amber-300/90 capitalize mr-1">
                              [{m.reason.replace('_', ' ')}]
                            </span>
                          )}
                          <span>{m.notes || m.referenceId || '—'}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {m.actorName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {movementTotalPages > 1 && (
                <div className="p-3 border-t border-[#2d3139] bg-[#141519] flex items-center justify-between text-xs text-slate-400">
                  <div>
                    Page <span className="text-white font-medium">{movementPage}</span> of{' '}
                    <span className="text-white font-medium">{movementTotalPages}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movementPage <= 1}
                      onClick={() => setMovementPage((p) => p - 1)}
                      className="h-7 text-xs border-[#2d3139]"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movementPage >= movementTotalPages}
                      onClick={() => setMovementPage((p) => p + 1)}
                      className="h-7 text-xs border-[#2d3139]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ==================== SUB-TAB 4: STOCK RECEIPTS ==================== */}
        {activeSubTab === 'receipts' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-xl bg-[#14151a] border border-[#2d3139] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search receipt #, invoice #..."
                    value={receiptSearch}
                    onChange={(e) => {
                      setReceiptSearch(e.target.value);
                      setReceiptPage(1);
                    }}
                    className="h-8 pl-8 text-xs bg-[#181a20] border-[#2d3139] text-slate-200"
                  />
                </div>

                {/* Supplier Filter */}
                <select
                  value={receiptSupplierFilter}
                  onChange={(e) => {
                    setReceiptSupplierFilter(e.target.value);
                    setReceiptPage(1);
                  }}
                  className="h-8 bg-[#181a20] border border-[#2d3139] rounded-md px-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-[#fbb945]"
                >
                  <option value="all">All Suppliers</option>
                  {suppliersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchReceipts}
                  className="h-8 text-xs border-[#2d3139] text-slate-300 hover:bg-white/5"
                  title="Refresh receipts"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenReceive()}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>Receive Stock</span>
                </Button>
              </div>
            </div>

            {/* Receipts Table */}
            <div className="rounded-xl border border-[#2d3139] bg-[#14151a] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#181a20] border-b border-[#2d3139] text-slate-400 font-mono text-[11px]">
                      <th className="py-3 px-4 font-medium">Reference</th>
                      <th className="py-3 px-4 font-medium">Receipt Date</th>
                      <th className="py-3 px-4 font-medium">Branch</th>
                      <th className="py-3 px-4 font-medium">Supplier</th>
                      <th className="py-3 px-4 font-medium text-center">Items</th>
                      <th className="py-3 px-4 font-medium text-right">Total Units</th>
                      <th className="py-3 px-4 font-medium text-right">Total Value</th>
                      <th className="py-3 px-4 font-medium">Received By</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3139]/40">
                    {isLoadingReceipts ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-[#fbb945]" />
                          Loading stock receipts...
                        </td>
                      </tr>
                    ) : receiptsList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                          <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                          <p className="font-semibold text-slate-300">No stock receipts found</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Receive stock from suppliers to generate official intake receipts.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => handleOpenReceive()}
                            className="mt-3 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <PackagePlus className="w-3.5 h-3.5 mr-1.5" />
                            Receive Stock Now
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      receiptsList.map((rcpt) => (
                        <tr
                          key={rcpt.id}
                          className="hover:bg-[#181a20]/80 transition-colors cursor-pointer group"
                          onClick={() => setInspectReceiptId(rcpt.id)}
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono text-emerald-400 font-semibold group-hover:underline">
                              {rcpt.reference}
                            </span>
                            {rcpt.supplierInvoiceNumber && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Inv: {rcpt.supplierInvoiceNumber}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                            {new Date(rcpt.receiptDate).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-300 text-xs flex items-center gap-1.5">
                              <Store className="w-3 h-3 text-[#fbb945] shrink-0" />
                              {rcpt.branchName}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white font-medium flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              {rcpt.supplierName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="outline" className="text-[10px] font-mono bg-white/5 border-[#2d3139] text-slate-300">
                              {rcpt.lineCount} {rcpt.lineCount === 1 ? 'item' : 'items'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                            {rcpt.totalQuantity.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {rcpt.totalCost !== null ? (
                              <span className="text-emerald-400 font-semibold">
                                {currencySymbol}
                                {rcpt.totalCost.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-xs">
                            {rcpt.receivedByName || '—'}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectReceiptId(rcpt.id)}
                              className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/10"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-[#fbb945]" />
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {receiptTotalPages > 1 && (
                <div className="p-3 bg-[#181a20] border-t border-[#2d3139] flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Page {receiptPage} of {receiptTotalPages} ({receiptTotalCount} receipts total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={receiptPage <= 1}
                      onClick={() => setReceiptPage((p) => p - 1)}
                      className="h-7 text-xs border-[#2d3139]"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={receiptPage >= receiptTotalPages}
                      onClick={() => setReceiptPage((p) => p + 1)}
                      className="h-7 text-xs border-[#2d3139]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Modals */}
      <ReceiveStockModal
        isOpen={isReceiveModalOpen}
        onClose={handleCloseModals}
        selectedItem={effectiveSelectedItem}
        initialProductId={actionProductId || selectedStockItem?.productId}
        initialVariantId={effectiveSelectedItem?.variantId || undefined}
        stockItems={items}
        branchId={effectiveBranchId}
        activeBranchName={effectiveBranchName}
        branches={branches}
        onSuccess={handleRefreshAll}
        onViewReceiptDetails={(id) => setInspectReceiptId(id)}
      />

      {/* Receipt Details Inspection Drawer */}
      <ReceiptDetailsDrawer
        isOpen={Boolean(inspectReceiptId)}
        onClose={() => setInspectReceiptId(null)}
        receiptId={inspectReceiptId}
      />

      <AdjustStockModal
        isOpen={isAdjustModalOpen}
        onClose={handleCloseModals}
        selectedItem={effectiveSelectedItem}
        initialProductId={actionProductId || selectedStockItem?.productId}
        initialVariantId={effectiveSelectedItem?.variantId || undefined}
        stockItems={items}
        branchId={effectiveBranchId}
        activeBranchName={effectiveBranchName}
        branches={branches}
        onSuccess={handleRefreshAll}
      />

      <BranchTransferModal
        isOpen={isTransferModalOpen}
        onClose={handleCloseModals}
        selectedItem={effectiveSelectedItem}
        initialProductId={actionProductId || selectedStockItem?.productId}
        initialVariantId={effectiveSelectedItem?.variantId || undefined}
        stockItems={items}
        branchId={effectiveBranchId}
        activeBranchName={effectiveBranchName}
        branches={branches}
        onSuccess={handleRefreshAll}
      />

      <OpeningStockModal
        isOpen={isOpeningModalOpen}
        onClose={handleCloseModals}
        selectedItem={effectiveSelectedItem}
        initialProductId={actionProductId || selectedStockItem?.productId}
        initialVariantId={effectiveSelectedItem?.variantId || undefined}
        stockItems={items}
        branchId={effectiveBranchId}
        activeBranchName={effectiveBranchName}
        branches={branches}
        onSuccess={handleRefreshAll}
      />
    </div>
  );
}
