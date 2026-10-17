import * as React from 'react';
import { X, ArrowRightLeft, AlertCircle, AlertTriangle, Loader2, Store } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { useStockMutations } from '../hooks/useStock';
import { productApi } from '../products-api';
import type { StockItem } from '../stock-api';

export interface BranchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: StockItem | null;
  stockItems?: StockItem[];
  branchId?: string;
  activeBranchName?: string;
  branches: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
  initialProductId?: string;
  initialVariantId?: string;
}

export function BranchTransferModal({
  isOpen,
  onClose,
  selectedItem,
  stockItems = [],
  branchId,
  activeBranchName,
  branches,
  onSuccess,
  initialProductId,
  initialVariantId,
}: BranchTransferModalProps) {
  const effectiveProductId = selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';

  const effectiveBranchId =
    branchId && branchId !== 'all'
      ? branchId
      : selectedItem?.branchId || branches[0]?.id || '';

  const effectiveBranchName =
    activeBranchName ||
    branches.find((b) => b.id === effectiveBranchId)?.name ||
    'Current Branch';

  const sourceBranchId = effectiveBranchId;

  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    destinationBranchId?: string;
    quantity?: number;
    notes?: string;
  }>(effectiveProductId ? `transfer_${effectiveProductId}` : 'transfer_new', {
    quantity: 1,
    notes: '',
  });

  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setMounted(true);
      timer = setTimeout(() => setAnimating(true), 20);
    } else {
      setAnimating(false);
      timer = setTimeout(() => setMounted(false), 300);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  const triggerClose = React.useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  const [destinationBranchId, setDestinationBranchId] = React.useState<string>(() => {
    if (draft?.destinationBranchId && draft.destinationBranchId !== effectiveBranchId) {
      return draft.destinationBranchId;
    }
    const remaining = branches.filter((b) => b.id !== effectiveBranchId);
    return remaining[0]?.id || '';
  });

  const [productId, setProductId] = React.useState<string>(() => {
    return selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';
  });

  const [variantId, setVariantId] = React.useState<string>(() => {
    return selectedItem?.variantId || initialVariantId || '';
  });

  const [productVariants, setProductVariants] = React.useState<
    Array<{ id: string; name?: string; sku: string; attributes?: Record<string, string> }>
  >([]);
  const [hasVariants, setHasVariants] = React.useState(false);

  const [quantity, setQuantity] = React.useState<number>(() => draft?.quantity ?? 1);
  const [notes, setNotes] = React.useState(() => draft?.notes ?? '');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { transferStock } = useStockMutations();

  React.useEffect(() => {
    if (selectedItem) {
      setProductId(selectedItem.productId);
      if (selectedItem.variantId) {
        setVariantId(selectedItem.variantId);
      }
      const other = branches.find((b) => b.id !== effectiveBranchId);
      if (other && (!destinationBranchId || destinationBranchId === effectiveBranchId)) {
        setDestinationBranchId(other.id);
      }
    } else if (initialProductId) {
      setProductId(initialProductId);
      if (initialVariantId) {
        setVariantId(initialVariantId);
      }
    }
  }, [selectedItem, initialProductId, initialVariantId, branches, effectiveBranchId, destinationBranchId]);

  React.useEffect(() => {
    if (!productId) {
      setProductVariants([]);
      setHasVariants(false);
      return;
    }

    const matchingVariantItems = stockItems.filter((i) => i.productId === productId && i.variantId);
    if (matchingVariantItems.length > 0) {
      setHasVariants(true);
      setProductVariants(
        matchingVariantItems.map((i) => ({
          id: i.variantId!,
          sku: i.sku,
          attributes: i.variantAttributes || undefined,
          name: i.variantName || undefined,
        }))
      );
      if (!variantId && matchingVariantItems[0]) {
        setVariantId(matchingVariantItems[0].variantId!);
      }
    } else {
      productApi
        .getProduct(productId)
        .then((res) => {
          if (res?.product?.has_variants && res.product.variants && res.product.variants.length > 0) {
            setHasVariants(true);
            setProductVariants(res.product.variants as any);
            if (!variantId && res.product.variants[0]) {
              setVariantId(res.product.variants[0].id);
            }
          } else {
            setHasVariants(false);
            setProductVariants([]);
            setVariantId('');
          }
        })
        .catch(() => {
          setHasVariants(false);
        });
    }
  }, [productId]);

  if (!isOpen) return null;

  const currentItem = selectedItem || stockItems.find((i) => i.productId === productId && i.branchId === sourceBranchId && (variantId ? i.variantId === variantId : true));
  const sourceAvailable = currentItem ? currentItem.available : 0;
  const sourceOnHand = currentItem ? currentItem.quantityOnHand : 0;
  const isOverQuantity = quantity > sourceAvailable;
  const isSameBranch = sourceBranchId === destinationBranchId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isSameBranch) {
      setErrorMsg('Source branch and destination branch must be different.');
      return;
    }
    if (!destinationBranchId) {
      setErrorMsg('Please select a destination branch.');
      return;
    }
    if (!productId) {
      setErrorMsg('Please select a product to transfer.');
      return;
    }
    if (hasVariants && !variantId) {
      setErrorMsg('Please select a specific variant to transfer.');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('Transfer quantity must be greater than zero.');
      return;
    }
    if (isOverQuantity) {
      setErrorMsg(`Cannot transfer ${quantity} units. Only ${sourceAvailable} units are available at source branch.`);
      return;
    }

    try {
      await transferStock.mutateAsync({
        sourceBranchId,
        destinationBranchId,
        productId,
        variantId: variantId || undefined,
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      });

      clearDraft();
      onSuccess?.();
      triggerClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete branch transfer.');
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="branch-transfer-drawer">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
          animating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={triggerClose}
        aria-hidden="true"
      />

      {/* Slide-over Right Hand Panel */}
      <aside
        className={`fixed inset-y-0 right-0 w-full max-w-lg sm:max-w-xl h-screen bg-[#181a20] border-l border-[#2d3139] text-slate-100 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${
          animating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d3139] bg-[#181a20] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Transfer Stock Between Branches</h2>
                {hasDraft && (
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/30">
                    Draft Restored
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">Atomic inter-branch transfer with shared movement ledger reference</p>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer transition-colors"
            data-testid="transfer-drawer-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-6 space-y-4 flex-1 overflow-y-auto bg-[#141519]">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Destination Branch */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Destination Branch *</label>
            <SearchableSelect
              value={destinationBranchId}
              onChange={(val) => {
                setDestinationBranchId(val);
                saveDraft({ destinationBranchId: val });
              }}
              placeholder="Select destination branch..."
              searchPlaceholder="Search branch..."
              options={branches
                .filter((b) => b.id !== effectiveBranchId)
                .map((b) => ({
                  value: b.id,
                  label: b.name,
                }))}
              required
            />
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Product *</label>
            {selectedItem ? (
              <div className="p-3 bg-[#141519]/90 border-0 border-b-2 border-[#2d3139]">
                <div className="text-xs font-semibold text-slate-200">{selectedItem.productName}</div>
                <div className="text-[10px] text-slate-400 font-mono">SKU: {selectedItem.sku}</div>
              </div>
            ) : (
              <SearchableSelect
                value={productId}
                onChange={(val) => setProductId(val)}
                placeholder="Select product to transfer..."
                searchPlaceholder="Search product by name or SKU..."
                options={stockItems.map((item) => ({
                  value: item.productId,
                  label: item.productName,
                  sublabel: `${item.sku} • ${item.available} avail`,
                }))}
                required
              />
            )}
          </div>

          {/* Variant Selection if product has variants */}
          {hasVariants && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Product Variant *</label>
              <SearchableSelect
                value={variantId}
                onChange={(val) => setVariantId(val)}
                placeholder="Select variant..."
                searchPlaceholder="Search variant by name, attribute, or SKU..."
                options={productVariants.map((v) => ({
                  value: v.id,
                  label: v.name || (v.attributes ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ') : v.sku),
                  sublabel: v.sku,
                }))}
                required
              />
            </div>
          )}

          {/* Quantity & Availability Card */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Transfer Quantity *</label>
              <Input
                type="number"
                min="1"
                step="any"
                value={quantity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setQuantity(val);
                  saveDraft({ quantity: val });
                }}
                className="bg-[#1a1b20] border-[#2d3139] text-slate-200 font-mono"
                required
              />
            </div>
            <div className="p-2.5 rounded-lg bg-[#181920] border border-[#2d3139] flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Available at Source</span>
              <span className="text-base font-bold text-white font-mono">{sourceAvailable}</span>
            </div>
          </div>

          {isOverQuantity && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Insufficient stock at source branch. Maximum transferrable: {sourceAvailable}.</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Transfer Notes (Optional)</label>
            <Input
              type="text"
              placeholder="e.g. Stock replenishment for high demand branch"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                saveDraft({ notes: e.target.value });
              }}
              className="bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
            />
          </div>

          </div>

          {/* Sticky Footer Actions */}
          <div className="px-6 py-4 border-t border-[#2d3139] bg-[#181a20] flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerClose}
              disabled={transferStock.isPending}
              className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={transferStock.isPending || isOverQuantity || isSameBranch}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
            >
              {transferStock.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Transferring...
                </>
              ) : (
                'Dispatch & Complete Transfer'
              )}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
