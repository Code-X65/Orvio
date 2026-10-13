import * as React from 'react';
import {
  X,
  Store,
  Package,
  Layers,
  History,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  catalogApi,
  type BranchProductItem,
  type BranchCatalogSummary,
} from '../catalog-api';
import { useBranchCatalogSummary } from '../hooks';
import { CatalogImportModal } from './CatalogImportModal';
import { CatalogImportHistory } from './CatalogImportHistory';

export interface BranchCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: {
    id: string;
    name: string;
    code?: string | null;
  };
  branches: Array<{ id: string; name: string }>;
  onCatalogUpdated?: () => void;
}

export function BranchCatalogModal({
  isOpen,
  onClose,
  branch,
  branches,
  onCatalogUpdated,
}: BranchCatalogModalProps) {
  const [activeTab, setActiveTab] = React.useState<'products' | 'summary' | 'history'>('products');

  // Products Tab State
  const [items, setItems] = React.useState<BranchProductItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [includeExcluded, setIncludeExcluded] = React.useState(false);
  const { data: cachedSummary, refetch: refetchSummary } = useBranchCatalogSummary(branch.id, {
    enabled: isOpen,
  });
  const summary = cachedSummary || null;

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

  // Remove dialog state
  const [itemToRemove, setItemToRemove] = React.useState<BranchProductItem | null>(null);
  const [removeReason, setRemoveReason] = React.useState('');
  const [isRemoving, setIsRemoving] = React.useState(false);

  const fetchCatalog = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await catalogApi.getBranchCatalog(branch.id, {
        search: searchQuery.trim() || undefined,
        includeExcluded,
        limit: 100,
      });
      setItems(res.items);
    } catch (err: any) {
      console.error('Failed to load branch catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [branch.id, searchQuery, includeExcluded]);

  React.useEffect(() => {
    if (isOpen) {
      fetchCatalog();
    }
  }, [isOpen, fetchCatalog]);

  const handleConfirmRemove = async () => {
    if (!itemToRemove) return;
    try {
      setIsRemoving(true);
      await catalogApi.removeProduct(branch.id, itemToRemove.product_id, removeReason);
      setItemToRemove(null);
      await fetchCatalog();
      refetchSummary();
      onCatalogUpdated?.();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove product from catalog');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRestoreProduct = async (item: BranchProductItem) => {
    try {
      await catalogApi.restoreProduct(branch.id, item.product_id);
      await fetchCatalog();
      refetchSummary();
      onCatalogUpdated?.();
    } catch (err: any) {
      alert(err?.message || 'Failed to restore product to catalog');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-[#2d3139] bg-[#141519] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d3139] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fbb945]/15 text-[#fbb945]">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Branch Catalog Management</h2>
                <Badge className="border-[#2d3139] bg-[#181a20] text-[#fbb945] text-xs">
                  {branch.name}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Manage which products appear in this location&apos;s active catalog and import from other branches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90 shadow-sm"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Import Catalog
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-[#252830] hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#2d3139] bg-[#181a20]/40 px-5 text-xs">
          <button
            onClick={() => setActiveTab('products')}
            className={`border-b-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'products'
                ? 'border-[#985184] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Assigned Products ({summary?.activeAssignedProducts ?? items.length})
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`border-b-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'summary'
                ? 'border-[#985184] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Catalog Summary
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`border-b-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'history'
                ? 'border-[#985184] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Import Audit Trail
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Search assigned products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 border-[#2d3139] bg-[#181a20] pl-9 text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeExcluded}
                      onChange={(e) => setIncludeExcluded(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-[#2d3139] bg-[#181a20] text-[#985184] accent-[#985184]"
                    />
                    <span>Show Excluded Items</span>
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCatalog}
                    disabled={loading}
                    className="h-8 border-[#2d3139] bg-[#181a20] text-xs text-slate-300 hover:text-white"
                  >
                    <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Products Table */}
              <div className="overflow-hidden rounded-xl border border-[#2d3139] bg-[#141519]">
                {loading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[#985184]" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    No products assigned to this branch catalog. Click &quot;Import Catalog&quot; to bring in items from another location.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#2d3139] bg-[#181a20]/60 text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Product Name & SKU</th>
                        <th className="px-4 py-3 font-medium">Brand</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Source Branch</th>
                        <th className="px-4 py-3 font-medium text-center">Branch Stock</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3139]/60">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#181a20]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{item.product.name}</span>
                              {item.is_excluded && (
                                <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px]">
                                  Excluded
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              SKU: {item.product.sku}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-300">
                            {item.product.brand_name ? (
                              <Badge className="border-[#2d3139] bg-[#181a20] text-slate-300 text-[11px]">
                                {item.product.brand_name}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-300">
                            {item.product.category_name || '—'}
                          </td>

                          <td className="px-4 py-3 text-slate-400">
                            {item.source_branch_name ? (
                              <span className="text-[#fbb945] flex items-center gap-1 text-[11px]">
                                <ArrowRight className="h-3 w-3" />
                                {item.source_branch_name}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Native to branch</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-semibold ${
                                item.quantity_on_hand <= 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {item.quantity_on_hand}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {item.is_excluded ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestoreProduct(item)}
                                className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Restore
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItemToRemove(item);
                                  setRemoveReason('');
                                }}
                                className="h-7 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Remove
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'summary' && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
                  <div className="text-xs text-slate-400 font-medium">Assigned Products</div>
                  <div className="mt-1 text-2xl font-bold text-white">{summary.totalAssignedProducts}</div>
                </div>
                <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
                  <div className="text-xs text-slate-400 font-medium">Active in Catalog</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-400">
                    {summary.activeAssignedProducts}
                  </div>
                </div>
                <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
                  <div className="text-xs text-slate-400 font-medium">Imported from Branches</div>
                  <div className="mt-1 text-2xl font-bold text-[#fbb945]">
                    {summary.importedProductsCount}
                  </div>
                </div>
                <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
                  <div className="text-xs text-slate-400 font-medium">Excluded Items</div>
                  <div className="mt-1 text-2xl font-bold text-rose-400">{summary.excludedProducts}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-4">
                <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
                  <div className="text-xs font-semibold text-white">Categories Represented</div>
                  <div className="mt-1 text-xl font-bold text-[#985184]">{summary.categoriesCount}</div>
                </div>
                <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
                  <div className="text-xs font-semibold text-white">Brands Represented</div>
                  <div className="mt-1 text-xl font-bold text-[#985184]">{summary.brandsCount}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && <CatalogImportHistory />}
        </div>
      </div>

      {/* Catalog Import Wizard */}
      <CatalogImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        targetBranchId={branch.id}
        targetBranchName={branch.name}
        branches={branches}
        onSuccess={() => {
          fetchCatalog();
          onCatalogUpdated?.();
        }}
      />

      {/* Remove Confirmation Dialog */}
      {itemToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setItemToRemove(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-[#2d3139] bg-[#141519] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Remove Product from Catalog</h3>
                <p className="text-xs text-slate-400">
                  Exclude &quot;{itemToRemove.product.name}&quot; from {branch.name}
                </p>
              </div>
            </div>

            {itemToRemove.quantity_on_hand > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <strong>Warning: On-hand stock exists!</strong>
                <p className="mt-1">
                  This location currently records{' '}
                  <strong>{itemToRemove.quantity_on_hand}</strong> units on hand. Removing from
                  catalog will hide the product from branch views, but historical stock records will
                  be preserved in case it is re-assigned later.
                </p>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300">
                Reason for removal (optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Discontinued at this store location"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="mt-1.5 h-8 border-[#2d3139] bg-[#181a20] text-xs text-white"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#2d3139] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItemToRemove(null)}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="bg-rose-600 text-xs font-medium text-white hover:bg-rose-700"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Removing...
                  </>
                ) : (
                  'Remove from Catalog'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
