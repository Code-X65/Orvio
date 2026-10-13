import * as React from 'react';
import { X, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { useStockMutations } from '../hooks/useStock';
import { productApi } from '../products-api';
import type { StockItem } from '../stock-api';

export interface OpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: StockItem | null;
  stockItems?: StockItem[];
  branchId?: string;
  branches: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
  initialProductId?: string;
  initialVariantId?: string;
}

export function OpeningStockModal({
  isOpen,
  onClose,
  selectedItem,
  stockItems = [],
  branchId,
  branches,
  onSuccess,
  initialProductId,
  initialVariantId,
}: OpeningStockModalProps) {
  const effectiveProductId = selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';

  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    targetBranchId?: string;
    quantity?: number;
    notes?: string;
  }>(effectiveProductId ? `opening_${effectiveProductId}` : 'opening_new', {
    quantity: 0,
    notes: 'Initial opening stock balance',
  });

  const [targetBranchId, setTargetBranchId] = React.useState<string>(() => {
    if (draft?.targetBranchId) return draft.targetBranchId;
    if (selectedItem?.branchId) return selectedItem.branchId;
    if (branchId && branchId !== 'all') return branchId;
    return branches[0]?.id || '';
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

  const [quantity, setQuantity] = React.useState<number>(() => draft?.quantity ?? 0);
  const [notes, setNotes] = React.useState(() => draft?.notes ?? 'Initial opening stock balance');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { recordOpening } = useStockMutations();

  React.useEffect(() => {
    if (selectedItem) {
      setProductId(selectedItem.productId);
      setTargetBranchId(selectedItem.branchId);
      if (selectedItem.variantId) {
        setVariantId(selectedItem.variantId);
      }
    } else if (initialProductId) {
      setProductId(initialProductId);
      if (initialVariantId) {
        setVariantId(initialVariantId);
      }
    }
  }, [selectedItem, initialProductId, initialVariantId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetBranchId) {
      setErrorMsg('Please select a branch.');
      return;
    }
    if (!productId) {
      setErrorMsg('Please select a product.');
      return;
    }
    if (hasVariants && !variantId) {
      setErrorMsg('Please select a specific variant.');
      return;
    }
    if (quantity < 0) {
      setErrorMsg('Opening stock quantity cannot be negative.');
      return;
    }

    try {
      await recordOpening.mutateAsync({
        branchId: targetBranchId,
        productId,
        variantId: variantId || undefined,
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      });

      clearDraft();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize opening stock.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#121316] border border-[#2d3139] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3139]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Record Opening Stock Balance</h2>
                {hasDraft && (
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30">
                    Draft Restored
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">Initializes starting inventory quantity and creates auditable ledger entry</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Branch & Product Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Branch *</label>
              <select
                value={targetBranchId}
                onChange={(e) => {
                  setTargetBranchId(e.target.value);
                  saveDraft({ targetBranchId: e.target.value });
                }}
                className="w-full h-9 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden focus:border-[#985184]"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Product *</label>
              {selectedItem ? (
                <div className="h-9 px-3 bg-[#1a1b20] border border-[#2d3139] rounded-md flex items-center text-xs text-slate-200 truncate">
                  {selectedItem.productName}
                </div>
              ) : (
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full h-9 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden focus:border-[#985184]"
                  required
                >
                  {stockItems.map((item) => (
                    <option key={item.productId} value={item.productId}>
                      {item.productName} ({item.sku})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Variant Selection if product has variants */}
          {hasVariants && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Product Variant *</label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="w-full h-9 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden focus:border-[#985184]"
                required
              >
                <option value="" disabled>Select Variant...</option>
                {productVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name || (v.attributes ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ') : v.sku)} ({v.sku})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Starting Quantity */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Starting Quantity On Hand *</label>
            <Input
              type="number"
              min="0"
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

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Notes (Optional)</label>
            <Input
              type="text"
              placeholder="e.g. Initial store intake audit"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                saveDraft({ notes: e.target.value });
              }}
              className="bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d3139]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={recordOpening.isPending}
              className="border-[#2d3139] text-slate-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={recordOpening.isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {recordOpening.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Recording...
                </>
              ) : (
                'Save Starting Stock'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
