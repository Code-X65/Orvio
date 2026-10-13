import * as React from 'react';
import {
  Award,
  Plus,
  Search,
  ExternalLink,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { useUrlActionState } from '../../../hooks/useUrlActionState';
import type { Brand } from '../brands-api';
import { brandApi } from '../brands-api';
import { useBrands } from '../hooks/useBrands';
import { BrandForm } from './BrandForm';

export interface BrandsPageProps {
  organization?: {
    id?: string;
    name?: string;
    currency?: string;
    business_type?: string;
  };
  onSelectBrandFilter?: (brandId: string) => void;
  branchId?: string;
}

export function BrandsPage({ organization, onSelectBrandFilter, branchId }: BrandsPageProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'active' | 'archived' | 'all'>('active');

  const {
    data: brandsData,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useBrands({
    branchId,
    search: searchQuery.trim() || undefined,
    includeDeleted: activeTab === 'archived' || activeTab === 'all',
    activeOnly: activeTab === 'active' ? true : undefined,
    limit: 100,
  });

  const fetchBrands = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  let brands = brandsData?.brands || [];
  if (activeTab === 'archived') {
    brands = brands.filter((b) => b.is_deleted);
  } else if (activeTab === 'active') {
    brands = brands.filter((b) => !b.is_deleted);
  }

  const error = queryError ? queryError.message : null;

  // URL Action State for deep-linking & session resumption
  const {
    activeAction,
    activeEntityId: actionBrandId,
    openAction,
    closeAction,
  } = useUrlActionState<'create-brand' | 'edit-brand'>({
    actionParam: 'action',
    entityIdParam: 'brandId',
  });

  // Modal states
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingBrand, setEditingBrand] = React.useState<Brand | null>(null);

  // Notify user when workflow session is restored from URL
  const restoredToastRef = React.useRef(false);
  React.useEffect(() => {
    if (activeAction && !restoredToastRef.current) {
      restoredToastRef.current = true;
      toast.info('Session restored — resumed where you left off', {
        description: `Active workflow: ${activeAction.replace('-', ' ')}`,
      });
    }
  }, [activeAction]);

  // Sync active action with modal open state
  React.useEffect(() => {
    if (activeAction === 'create-brand') {
      setEditingBrand(null);
      setIsFormOpen(true);
    } else if (activeAction === 'edit-brand' && actionBrandId && brands.length > 0) {
      const found = brands.find((b) => b.id === actionBrandId);
      if (found) {
        setEditingBrand(found);
        setIsFormOpen(true);
      }
    }
  }, [activeAction, actionBrandId, brands]);

  // Delete / Reassign dialog state
  const [brandToDelete, setBrandToDelete] = React.useState<Brand | null>(null);
  const [reassignTargetId, setReassignTargetId] = React.useState<string>('');
  const [deleteReason, setDeleteReason] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Action menu state
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  // Close row menu on click outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleOpenAdd = () => {
    setEditingBrand(null);
    setIsFormOpen(true);
    openAction('create-brand');
  };

  const handleOpenEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setIsFormOpen(true);
    openAction('edit-brand', brand.id);
  };

  const handleOpenDelete = (brand: Brand) => {
    setBrandToDelete(brand);
    setReassignTargetId('');
    setDeleteReason('');
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return;
    try {
      setIsDeleting(true);
      await brandApi.deleteBrand(brandToDelete.id, {
        reassignToBrandId: reassignTargetId || undefined,
        reason: deleteReason || undefined,
      });
      setBrandToDelete(null);
      await fetchBrands();
    } catch (err: any) {
      alert(err?.message || 'Failed to archive brand');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (brand: Brand) => {
    try {
      await brandApi.restoreBrand(brand.id);
      await fetchBrands();
    } catch (err: any) {
      alert(err?.message || 'Failed to restore brand');
    }
  };

  // Stats calculation
  const totalCount = brands.length;
  const activeCount = brands.filter((b) => b.is_active && !b.is_deleted).length;
  const withProductsCount = brands.filter((b) => (b.product_count || 0) > 0).length;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Brand Management</h1>
            <Badge className="border-[#2d3139] bg-[#141519] text-[#fbb945] text-xs">
              Unified Catalog
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Define manufacturers and brands shared across all organization branches and catalogs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBrands}
            disabled={loading}
            className="border-[#2d3139] bg-[#181a20] text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90 shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Brand
          </Button>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#2d3139] bg-[#141519] p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Brands</span>
            <Layers className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1 text-xl font-bold text-white">{totalCount}</div>
        </div>
        <div className="rounded-lg border border-[#2d3139] bg-[#141519] p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Active Brands</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{activeCount}</div>
        </div>
        <div className="rounded-lg border border-[#2d3139] bg-[#141519] p-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Brands with Products</span>
            <Package className="h-4 w-4 text-[#fbb945]" />
          </div>
          <div className="mt-1 text-xl font-bold text-[#fbb945]">{withProductsCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            type="text"
            placeholder="Search brands by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-[#2d3139] bg-[#141519] pl-9 text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
          />
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-lg border border-[#2d3139] bg-[#141519] p-0.5">
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-[#252830] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-[#252830] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'archived'
                ? 'bg-[#252830] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Brands Table */}
      <div className="overflow-hidden rounded-xl border border-[#2d3139] bg-[#141519]">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#985184]" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-400">{error}</div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#181a20] text-slate-500">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">No brands found</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              {searchQuery
                ? 'No brands matched your search criteria.'
                : activeTab === 'archived'
                ? 'There are no archived brands.'
                : 'Get started by creating your first brand to organize products across all branch catalogs.'}
            </p>
            {!searchQuery && activeTab !== 'archived' && (
              <Button
                onClick={handleOpenAdd}
                className="mt-4 bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Brand
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#2d3139] bg-[#181a20]/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Brand</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium text-center">Catalog Products</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3139]/60">
              {brands.map((brand) => (
                <tr key={brand.id} className="hover:bg-[#181a20]/50 transition-colors">
                  {/* Brand Column */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {brand.logo_url ? (
                        <div className="h-8 w-8 rounded-lg border border-[#2d3139] bg-[#181a20] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2d3139] bg-[#181a20] font-semibold text-[#985184]">
                          {brand.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{brand.name}</span>
                          {brand.is_deleted && (
                            <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px] py-0 px-1.5">
                              Archived
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">slug: {brand.slug}</div>
                      </div>
                    </div>
                  </td>

                  {/* Website */}
                  <td className="px-4 py-3.5 text-slate-300">
                    {brand.website_url ? (
                      <a
                        href={brand.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[#fbb945] hover:underline"
                      >
                        <span className="truncate max-w-[150px]">{brand.website_url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* Product Count */}
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => onSelectBrandFilter?.(brand.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#2d3139] bg-[#181a20] px-2.5 py-0.5 text-[11px] font-medium text-slate-300 hover:border-[#985184] hover:text-[#985184] transition-colors"
                      title="View products for this brand"
                    >
                      <Package className="h-3 w-3 text-slate-400" />
                      <span>{brand.product_count || 0}</span>
                    </button>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    {brand.is_deleted ? (
                      <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px]">
                        Archived
                      </Badge>
                    ) : brand.is_active ? (
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-400 text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right relative">
                    <div className="flex items-center justify-end gap-1">
                      {brand.is_deleted ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(brand)}
                          className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(brand)}
                            className="h-7 px-2 text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(brand)}
                            className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Brand Form Modal */}
      <BrandForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          closeAction();
        }}
        editingBrand={editingBrand}
        onSuccess={() => {
          fetchBrands();
          closeAction();
        }}
        branchId={branchId}
      />

      {/* Delete / Archive Modal */}
      {brandToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setBrandToDelete(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-[#2d3139] bg-[#141519] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Archive Brand</h3>
                <p className="text-xs text-slate-400">Are you sure you want to archive &quot;{brandToDelete.name}&quot;?</p>
              </div>
            </div>

            {brandToDelete.product_count > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <div className="font-semibold">Notice: Active Products Associated</div>
                <div className="mt-1">
                  This brand currently has <strong>{brandToDelete.product_count}</strong> active products.
                  You can optionally migrate these products to another brand below. If not reassigned,
                  products will retain their brand linkage with an &quot;(archived)&quot; badge.
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Reassign products to another brand (optional):
                  </label>
                  <select
                    value={reassignTargetId}
                    onChange={(e) => setReassignTargetId(e.target.value)}
                    className="mt-1 w-full rounded border border-[#2d3139] bg-[#181a20] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#985184]"
                  >
                    <option value="">Keep assigned (marked archived)</option>
                    {brands
                      .filter((b) => b.id !== brandToDelete.id && !b.is_deleted)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300">
                Reason for archiving (optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Manufacturer discontinued partnership"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-1.5 h-8 border-[#2d3139] bg-[#181a20] text-xs text-white"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#2d3139] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBrandToDelete(null)}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 text-xs font-medium text-white hover:bg-rose-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  'Archive Brand'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
