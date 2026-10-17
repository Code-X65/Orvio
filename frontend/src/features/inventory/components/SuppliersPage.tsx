import * as React from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  User,
  MoreVertical,
  PackagePlus,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Archive,
  RefreshCw,
  Loader2,
  Receipt,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { supplierApi, type Supplier } from '../suppliers-api';
import { SupplierDrawer } from './SupplierDrawer';
import { ReceiveStockModal } from './ReceiveStockModal';
import { ReceiptDetailsDrawer } from './ReceiptDetailsDrawer';

export interface SuppliersPageProps {
  organization?: any;
  branches?: Array<{ id: string; name: string }>;
  activeBranchId?: string;
  onNavigateToStockReceipts?: (supplierId?: string) => void;
}

export function SuppliersPage({
  organization,
  branches = [],
  activeBranchId,
  onNavigateToStockReceipts,
}: SuppliersPageProps) {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'created_at' | 'receipts_count'>('name');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string | null>(null);
  const [drawerMode, setDrawerMode] = React.useState<'create' | 'edit' | 'view'>('view');

  const [isReceiveModalOpen, setIsReceiveModalOpen] = React.useState(false);
  const [receiveSupplier, setReceiveSupplier] = React.useState<Supplier | null>(null);

  const [inspectReceiptId, setInspectReceiptId] = React.useState<string | null>(null);

  const fetchSuppliers = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await supplierApi.listSuppliers({
        search: search.trim() || undefined,
        activeOnly: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      });
      setSuppliers(res.suppliers);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder, page]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setSelectedSupplierId(null);
    setDrawerMode('create');
    setIsDrawerOpen(true);
  };

  const handleOpenView = (id: string) => {
    setSelectedSupplierId(id);
    setDrawerMode('view');
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    setSelectedSupplierId(id);
    setDrawerMode('edit');
    setIsDrawerOpen(true);
  };

  const handleOpenReceive = (supplier: Supplier) => {
    setReceiveSupplier(supplier);
    setIsReceiveModalOpen(true);
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    try {
      if (supplier.isActive) {
        await supplierApi.deactivateSupplier(supplier.id);
      } else {
        await supplierApi.activateSupplier(supplier.id);
      }
      fetchSuppliers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update supplier status');
    }
  };

  // Metrics
  const activeCount = React.useMemo(() => suppliers.filter((s) => s.isActive).length, [suppliers]);
  const totalReceiptsLinked = React.useMemo(
    () => suppliers.reduce((acc, s) => acc + s.receiptsCount, 0),
    [suppliers]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Suppliers & Vendors</h1>
            <Badge className="bg-[#fbb945]/10 text-[#fbb945] border border-[#fbb945]/30 text-xs font-semibold px-2 py-0.5">
              {totalCount} Total
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage authorized merchandise suppliers and record incoming deliveries directly into branch stock.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleOpenCreate}
            className="bg-[#fbb945] hover:bg-[#e5a83d] text-black font-bold text-xs h-9 px-4 gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#14151a] border border-[#2d3139] space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Registered Vendors
          </span>
          <div className="text-2xl font-bold font-mono text-white">{totalCount}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#14151a] border border-emerald-500/20 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Active for Receiving
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-400">{activeCount}</div>
        </div>

        <div className="p-4 rounded-xl bg-[#14151a] border border-[#2d3139] space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Total Stock Receipts Logged
          </span>
          <div className="text-2xl font-bold font-mono text-[#fbb945]">{totalReceiptsLinked}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#14151a] border border-[#2d3139] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by vendor name, contact person, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#181a20] rounded-lg border border-[#2d3139] self-start md:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-[#fbb945] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Vendors
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'active'
                ? 'bg-[#fbb945] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Only
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'inactive'
                ? 'bg-[#fbb945] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Deactivated
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <Button size="sm" variant="outline" onClick={fetchSuppliers} className="h-7 text-xs border-rose-500/30">
            Retry
          </Button>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-xl border border-[#2d3139] bg-[#14151a] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 text-[#fbb945] animate-spin" />
            <p className="text-xs text-slate-400">Loading suppliers directory...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#181a20] border border-[#2d3139] flex items-center justify-center text-slate-500">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-semibold text-white">
                {search ? 'No matching suppliers found' : 'No suppliers registered yet'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {search
                  ? `No vendor matches "${search}". Try searching by a different name, phone, or email.`
                  : 'Add your first supplier to start tracking where stock comes from and receive deliveries into branch inventory.'}
              </p>
            </div>
            {!search && (
              <Button
                onClick={handleOpenCreate}
                className="bg-[#fbb945] hover:bg-[#e5a83d] text-black font-bold text-xs h-9 px-4 gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Your First Supplier
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#2d3139] text-slate-400 font-semibold bg-[#16181d]">
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Location / Address</th>
                  <th className="py-3 px-4 text-center">Receipts</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23262f] text-slate-300">
                {suppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => handleOpenView(supplier.id)}
                  >
                    {/* Supplier Name & Representative */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white group-hover:text-[#fbb945] transition-colors text-sm">
                        {supplier.name}
                      </div>
                      {supplier.contactPerson ? (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{supplier.contactPerson}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic mt-0.5">No representative listed</div>
                      )}
                    </td>

                    {/* Contact Phone & Email */}
                    <td className="py-3.5 px-4 space-y-0.5">
                      {supplier.phone && (
                        <div className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate max-w-[220px]">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{supplier.email}</span>
                        </div>
                      )}
                      {!supplier.phone && !supplier.email && (
                        <span className="text-[11px] text-slate-600 italic">No contact details</span>
                      )}
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-400">
                      {supplier.address || <span className="text-slate-600 italic">None</span>}
                    </td>

                    {/* Receipts count */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigateToStockReceipts) {
                            onNavigateToStockReceipts(supplier.id);
                          } else {
                            handleOpenView(supplier.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#181a20] border border-[#2d3139] hover:border-[#fbb945]/40 text-slate-300 font-mono text-xs transition-colors"
                      >
                        <Receipt className="w-3 h-3 text-[#fbb945]" />
                        <span>{supplier.receiptsCount}</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        className={`text-[10px] font-semibold border ${
                          supplier.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {supplier.isActive && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenReceive(supplier)}
                            className="bg-[#fbb945]/10 hover:bg-[#fbb945]/20 text-[#fbb945] border border-[#fbb945]/30 text-xs h-7 px-2.5 gap-1"
                            title="Receive stock delivery from this vendor"
                          >
                            <PackagePlus className="w-3 h-3" />
                            <span>Receive</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenView(supplier.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          title="View profile and history"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(supplier.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          title="Edit supplier details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(supplier)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          title={supplier.isActive ? 'Deactivate supplier' : 'Reactivate supplier'}
                        >
                          {supplier.isActive ? (
                            <Archive className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Profile / Edit / Create Slide-over Drawer */}
      <SupplierDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        supplierId={selectedSupplierId}
        mode={drawerMode}
        onSaved={() => fetchSuppliers()}
        onReceiveStock={(supp) => handleOpenReceive(supp)}
        onViewReceipt={(rcptId) => setInspectReceiptId(rcptId)}
      />

      {/* Upgraded Multi-Product Stock Intake Modal */}
      <ReceiveStockModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        branches={branches}
        branchId={activeBranchId}
        initialSupplierId={receiveSupplier?.id}
        onSuccess={() => {
          fetchSuppliers();
        }}
        onViewReceiptDetails={(rcptId) => {
          setInspectReceiptId(rcptId);
        }}
      />

      {/* Receipt Details Inspection Drawer */}
      <ReceiptDetailsDrawer
        isOpen={Boolean(inspectReceiptId)}
        onClose={() => setInspectReceiptId(null)}
        receiptId={inspectReceiptId}
        onViewSupplier={(suppId) => {
          setInspectReceiptId(null);
          handleOpenView(suppId);
        }}
      />
    </div>
  );
}
