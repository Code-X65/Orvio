import * as React from 'react';
import {
  X,
  Store,
  ArrowRight,
  Package,
  Layers,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { catalogApi, type BranchProductItem, type ImportPreviewResponse } from '../catalog-api';
import { branchApi } from '../branches-api';

export interface CatalogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBranchId: string;
  targetBranchName: string;
  branches?: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

export function CatalogImportModal({
  isOpen,
  onClose,
  targetBranchId,
  targetBranchName,
  branches: initialBranches,
  onSuccess,
}: CatalogImportModalProps) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [internalBranches, setInternalBranches] = React.useState<Array<{ id: string; name: string }>>(
    initialBranches || []
  );

  React.useEffect(() => {
    if (initialBranches && initialBranches.length > 0) {
      setInternalBranches(initialBranches);
    } else if (isOpen) {
      branchApi.getBranches({ activeOnly: true }).then((res) => {
        setInternalBranches(res.branches || []);
      }).catch((err) => {
        console.error('Failed to load branches for catalog import:', err);
      });
    }
  }, [initialBranches, isOpen]);

  // Step 1: Source Branch
  const availableSourceBranches = React.useMemo(
    () => internalBranches.filter((b) => b.id !== targetBranchId),
    [internalBranches, targetBranchId]
  );
  const [sourceBranchId, setSourceBranchId] = React.useState<string>(
    availableSourceBranches[0]?.id || ''
  );

  // Step 2: Product selection
  const [sourceProducts, setSourceProducts] = React.useState<BranchProductItem[]>([]);
  const [targetProductIds, setTargetProductIds] = React.useState<Set<string>>(new Set());
  const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set());
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState('');
  const [hideAlreadyAssigned, setHideAlreadyAssigned] = React.useState(false);

  // Step 3: Options
  const [copyStock, setCopyStock] = React.useState(false);
  const [overwriteExisting, setOverwriteExisting] = React.useState(false);
  const [importTaxonomy, setImportTaxonomy] = React.useState(true);
  const [previewResult, setPreviewResult] = React.useState<ImportPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [notes, setNotes] = React.useState('');

  // Step 4: Submission
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset when opened
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSourceBranchId(availableSourceBranches[0]?.id || '');
      setSelectedProductIds(new Set());
      setCopyStock(false);
      setOverwriteExisting(false);
      setImportTaxonomy(true);
      setPreviewResult(null);
      setNotes('');
      setError(null);
    }
  }, [isOpen, availableSourceBranches]);

  // Load products when sourceBranchId changes or entering Step 2
  const loadBranchProducts = React.useCallback(async (srcId: string) => {
    if (!srcId) return;
    try {
      setLoadingProducts(true);
      setError(null);

      // Fetch products in source branch & products already in target branch
      const [srcRes, targetRes] = await Promise.all([
        catalogApi.getBranchCatalog(srcId, { limit: 100 }),
        catalogApi.getBranchCatalog(targetBranchId, { limit: 100 }),
      ]);

      setSourceProducts(srcRes.items);

      const targetSet = new Set(targetRes.items.filter((item) => !item.is_excluded).map((item) => item.product_id));
      setTargetProductIds(targetSet);

      // Pre-select unassigned products by default
      const defaultSelected = new Set<string>();
      for (const item of srcRes.items) {
        if (!targetSet.has(item.product_id) && !item.is_excluded) {
          defaultSelected.add(item.product_id);
        }
      }
      setSelectedProductIds(defaultSelected);
    } catch (err: any) {
      setError(err?.message || 'Failed to load source branch products');
    } finally {
      setLoadingProducts(false);
    }
  }, [targetBranchId]);

  const fetchTaxonomyPreview = React.useCallback(async () => {
    if (!sourceBranchId || selectedProductIds.size === 0) return;
    try {
      setLoadingPreview(true);
      const res = await catalogApi.previewImportTaxonomy(targetBranchId, {
        sourceBranchId,
        productIds: Array.from(selectedProductIds),
        importAll: false,
      });
      setPreviewResult(res);
    } catch (err) {
      console.error('Failed to load taxonomy preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [sourceBranchId, targetBranchId, selectedProductIds]);

  React.useEffect(() => {
    if (step === 3 && importTaxonomy) {
      fetchTaxonomyPreview();
    }
  }, [step, importTaxonomy, fetchTaxonomyPreview]);

  const handleNextToStep2 = async () => {
    if (!sourceBranchId) return;
    await loadBranchProducts(sourceBranchId);
    setStep(2);
  };

  const handleToggleProduct = (prodId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) {
        next.delete(prodId);
      } else {
        next.add(prodId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    filteredProducts.forEach((item) => all.add(item.product_id));
    setSelectedProductIds(all);
  };

  const handleDeselectAll = () => {
    setSelectedProductIds(new Set());
  };

  // Filter products for display in Step 2
  const filteredProducts = React.useMemo(() => {
    return sourceProducts.filter((item) => {
      if (hideAlreadyAssigned && targetProductIds.has(item.product_id)) {
        return false;
      }
      if (!productSearch.trim()) return true;
      const s = productSearch.toLowerCase();
      return (
        item.product.name.toLowerCase().includes(s) ||
        item.product.sku.toLowerCase().includes(s) ||
        item.product.brand_name?.toLowerCase().includes(s) ||
        item.product.category_name?.toLowerCase().includes(s)
      );
    });
  }, [sourceProducts, targetProductIds, hideAlreadyAssigned, productSearch]);

  const handleSubmitImport = async () => {
    if (selectedProductIds.size === 0) {
      setError('Please select at least one product to import.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await catalogApi.importCatalog(targetBranchId, {
        sourceBranchId,
        productIds: Array.from(selectedProductIds),
        copyStock,
        overwriteExisting,
        importTaxonomy,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete catalog import');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const sourceBranchName =
    internalBranches.find((b) => b.id === sourceBranchId)?.name || 'Source Branch';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-xl border border-[#2d3139] bg-[#141519] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d3139] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#985184]/15 text-[#985184]">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Catalog Import Wizard</h2>
              <p className="text-xs text-slate-400">
                Import products and stock from another branch into{' '}
                <strong className="text-[#fbb945]">{targetBranchName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-[#252830] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="mt-4 grid grid-cols-4 gap-2 border-b border-[#2d3139] pb-3 text-xs">
          {[
            { num: 1, title: 'Source Branch' },
            { num: 2, title: 'Select Items' },
            { num: 3, title: 'Options' },
            { num: 4, title: 'Confirm' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 font-medium ${
                step === s.num
                  ? 'text-[#fbb945]'
                  : step > s.num
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === s.num
                    ? 'bg-[#fbb945] text-black'
                    : step > s.num
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[#252830] text-slate-400'
                }`}
              >
                {step > s.num ? <Check className="h-3 w-3 stroke-[3]" /> : s.num}
              </span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ================= STEP 1: SELECT SOURCE BRANCH ================= */}
        {step === 1 && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Choose Source Branch
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                Products and catalogs will be loaded from this branch for importing.
              </p>

              {availableSourceBranches.length === 0 ? (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                  You need at least two branches in your organization to import catalogs.
                </div>
              ) : (
                <select
                  value={sourceBranchId}
                  onChange={(e) => setSourceBranchId(e.target.value)}
                  className="mt-3 w-full rounded-md border border-[#2d3139] bg-[#181a20] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#985184]"
                >
                  {availableSourceBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#2d3139] pt-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleNextToStep2}
                disabled={!sourceBranchId || availableSourceBranches.length === 0}
                className="bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90"
              >
                Next: Select Products
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: SELECT PRODUCTS ================= */}
        {step === 2 && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Filter products by name, SKU, or brand..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="h-8 border-[#2d3139] bg-[#181a20] pl-9 text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHideAlreadyAssigned(!hideAlreadyAssigned)}
                  className={`h-8 text-xs border-[#2d3139] ${
                    hideAlreadyAssigned
                      ? 'bg-[#985184]/20 text-[#fbb945] border-[#985184]'
                      : 'bg-[#181a20] text-slate-300'
                  }`}
                >
                  <Filter className="mr-1 h-3 w-3" />
                  {hideAlreadyAssigned ? 'Hiding in catalog' : 'Show all'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-8 border-[#2d3139] bg-[#181a20] text-xs text-slate-300"
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="h-8 border-[#2d3139] bg-[#181a20] text-xs text-slate-300"
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>
                Selected: <strong className="text-white">{selectedProductIds.size}</strong> of{' '}
                {sourceProducts.length} items
              </span>
              <span className="text-[11px] text-slate-500">
                Products already in target catalog are badged
              </span>
            </div>

            {/* Product selection list */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[#2d3139] bg-[#181a20]/40 p-1 divide-y divide-[#2d3139]/40">
              {loadingProducts ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#985184]" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No items match the current search or filters.
                </div>
              ) : (
                filteredProducts.map((item) => {
                  const isSelected = selectedProductIds.has(item.product_id);
                  const isAlreadyInCatalog = targetProductIds.has(item.product_id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleProduct(item.product_id)}
                      className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#985184]/10' : 'hover:bg-[#181a20]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by row click
                          className="h-4 w-4 rounded border-[#2d3139] bg-[#141519] text-[#985184] accent-[#985184]"
                        />
                        <div>
                          <div className="text-xs font-semibold text-white flex items-center gap-2">
                            <span>{item.product.name}</span>
                            {item.product.brand_name && (
                              <Badge className="border-[#2d3139] bg-[#141519] text-slate-300 text-[10px] py-0 px-1">
                                {item.product.brand_name}
                              </Badge>
                            )}
                            {isAlreadyInCatalog && (
                              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] py-0 px-1">
                                Already in catalog
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            SKU: {item.product.sku} • Stock in source: {item.quantity_on_hand}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs font-semibold text-slate-200">
                        ₦{item.product.selling_price.toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#2d3139] pt-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={selectedProductIds.size === 0}
                className="bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90"
              >
                Next: Options ({selectedProductIds.size})
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: OPTIONS ================= */}
        {step === 3 && (
          <div className="mt-6 space-y-5">
            {/* Taxonomy Reconciliation Toggle */}
            <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="importTaxonomyCheckbox"
                  checked={importTaxonomy}
                  onChange={(e) => setImportTaxonomy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#2d3139] bg-[#141519] text-[#985184] accent-[#985184]"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="importTaxonomyCheckbox"
                    className="text-xs font-semibold text-white select-none cursor-pointer"
                  >
                    Include associated Categories & Brands (Recommended)
                  </label>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Automatically checks existing categories and subcategories in{' '}
                    <strong className="text-slate-200">{targetBranchName}</strong> to link matching ones and
                    creates missing tree nodes without creating duplicates.
                  </p>
                </div>
              </div>

              {/* Dynamic Auto-Predict Preview Card */}
              {importTaxonomy ? (
                <div className="ml-7 rounded-md border border-[#985184]/30 bg-[#985184]/10 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#f3d9ea] flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[#985184]" />
                      Auto-Predict Taxonomy Reconciliation
                    </span>
                    {loadingPreview && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </div>

                  {loadingPreview ? (
                    <p className="text-[11px] text-slate-400">Analyzing category and brand hierarchies...</p>
                  ) : previewResult ? (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="h-3 w-3" />
                        <span>
                          {previewResult.matchedCategories.length} Categories already exist in target branch (will be linked)
                        </span>
                      </div>
                      {previewResult.newCategories.length > 0 && (
                        <div className="flex items-center gap-2 text-[#fbb945]">
                          <Copy className="h-3 w-3" />
                          <span>
                            {previewResult.newCategories.length} Categories will be auto-created with full tree hierarchy
                          </span>
                        </div>
                      )}
                      <div className="text-slate-300">
                        Brands: {previewResult.matchedBrands.length} matched, {previewResult.newBrands.length} to be created
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">Taxonomy will be matched with target branch.</p>
                  )}
                </div>
              ) : (
                <div className="ml-7 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-200 leading-relaxed">
                    Products will be imported into <strong className="text-white">{targetBranchName}</strong> as <strong>Unassigned</strong> (no category or brand). You can assign them manually later.
                  </p>
                </div>
              )}
            </div>

            {/* Copy stock toggle */}
            <div className="flex items-start gap-3 rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
              <input
                type="checkbox"
                id="copyStockCheckbox"
                checked={copyStock}
                onChange={(e) => setCopyStock(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#2d3139] bg-[#141519] text-[#985184] accent-[#985184]"
              />
              <div className="space-y-1">
                <label
                  htmlFor="copyStockCheckbox"
                  className="text-xs font-semibold text-white select-none cursor-pointer"
                >
                  Copy current stock levels from source branch
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If enabled, initial on-hand stock quantities from{' '}
                  <strong className="text-slate-200">{sourceBranchName}</strong> will be duplicated
                  for this branch. Default is 0 stock.
                </p>
              </div>
            </div>

            {/* Overwrite existing toggle */}
            <div className="flex items-start gap-3 rounded-lg border border-[#2d3139] bg-[#181a20] p-4">
              <input
                type="checkbox"
                id="overwriteCheckbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#2d3139] bg-[#141519] text-[#985184] accent-[#985184]"
              />
              <div className="space-y-1">
                <label
                  htmlFor="overwriteCheckbox"
                  className="text-xs font-semibold text-white select-none cursor-pointer"
                >
                  Overwrite existing items in target catalog
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If any selected items are already assigned to{' '}
                  <strong className="text-slate-200">{targetBranchName}</strong>, update their source
                  provenance and overwrite target stock levels if copying stock.
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Import Notes & Audit Reason (Optional)
              </label>
              <Textarea
                placeholder="e.g. Restocking retail showroom from central warehouse batch #2026-10"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1.5 resize-none border-[#2d3139] bg-[#181a20] text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#2d3139] pt-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => setStep(4)}
                className="bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90"
              >
                Review & Confirm
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: REVIEW & CONFIRM ================= */}
        {step === 4 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-[#2d3139] bg-[#181a20] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d3139]/60">
                <span className="text-slate-400">Migration Route:</span>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <span>{sourceBranchName}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[#fbb945]">{targetBranchName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Products to Import:</span>
                <span className="font-bold text-white">{selectedProductIds.size} items</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Categories & Brands:</span>
                <span className="font-medium text-white">
                  {importTaxonomy ? 'Smart Reconciled (Tree Preserved)' : 'Unassigned (No Category/Brand)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Copy Stock Levels:</span>
                <span className="font-medium text-white">
                  {copyStock ? 'Yes (Initial on-hand replicated)' : 'No (Start with 0 on-hand)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Overwrite Existing:</span>
                <span className="font-medium text-white">
                  {overwriteExisting ? 'Yes' : 'No (Skipped if already present)'}
                </span>
              </div>

              {notes && (
                <div className="pt-2 border-t border-[#2d3139]/60">
                  <span className="text-slate-400 block mb-0.5">Notes:</span>
                  <p className="text-slate-300 italic">{notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#2d3139] pt-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(3)}
                disabled={isSubmitting}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitImport}
                disabled={isSubmitting}
                className="bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Executing Import...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Confirm & Import ({selectedProductIds.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
