import * as React from 'react';
import { X, PackagePlus, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { useStockMutations } from '../hooks/useStock';
import { productApi } from '../products-api';
import type { StockItem } from '../stock-api';

export interface ReceiveStockModalProps {
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

export function ReceiveStockModal({
  isOpen,
  onClose,
  selectedItem,
  stockItems = [],
  branchId,
  branches,
  onSuccess,
  initialProductId,
  initialVariantId,
}: ReceiveStockModalProps) {
  const effectiveProductId = selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';

  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    quantity?: number;
    reference?: string;
    notes?: string;
    targetBranchId?: string;
  }>(effectiveProductId ? `receive_${effectiveProductId}` : 'receive_new', {
    quantity: 1,
    reference: '',
    notes: '',
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

  const [quantity, setQuantity] = React.useState<number>(() => draft?.quantity ?? 1);
  const [reference, setReference] = React.useState(() => draft?.reference ?? '');
  const [notes, setNotes] = React.useState(() => draft?.notes ?? '');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { receiveStock } = useStockMutations();

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

    // Check if stockItems already has variants for this product
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

  const currentItem = selectedItem || stockItems.find((i) => i.productId === productId && (variantId ? i.variantId === variantId : true));
  const currentOnHand = currentItem ? currentItem.quantityOnHand : 0;
  const resultingOnHand = currentOnHand + (Number(quantity) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetBranchId) {
      setErrorMsg('Please select a destination branch.');
      return;
    }
    if (!productId) {
      setErrorMsg('Please select a product.');
      return;
    }
    if (hasVariants && !variantId) {
      setErrorMsg('Please select a specific product variant to receive.');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('Received quantity must be greater than zero.');
      return;
    }

    try {
      await receiveStock.mutateAsync({
        branchId: targetBranchId,
        productId,
        variantId: variantId || undefined,
        quantity: Number(quantity),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      clearDraft();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record stock receipt.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#121316] border border-[#2d3139] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3139]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Receive Stock Replenishment</h2>
                {hasDraft && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    Draft Restored
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">Record incoming stock units without purchase order workflows</p>
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

          {/* Branch Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Receiving Branch *</label>
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

          {/* Product Info / Select */}
          {selectedItem ? (
            <div className="p-3 rounded-lg bg-[#181920] border border-[#2d3139] space-y-1">
              <div className="text-[11px] text-slate-400 font-medium">Selected Product</div>
              <div className="text-xs font-semibold text-slate-200">{selectedItem.productName}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                SKU: {selectedItem.sku}
                {selectedItem.variantName && ` • Option: ${selectedItem.variantName}`}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Product *</label>
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
              </div>

              {hasVariants && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Product Variant *
                  </label>
                  <select
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="w-full h-9 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden focus:border-[#985184]"
                    required
                  >
                    <option value="">Select a variant...</option>
                    {productVariants.map((v) => {
                      const label =
                        v.name ||
                        (v.attributes ? Object.values(v.attributes).join(' / ') : '') ||
                        v.sku;
                      return (
                        <option key={v.id} value={v.id}>
                          {label} (SKU: {v.sku})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Units Received *</label>
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
              className="bg-[#1a1b20] border-[#2d3139] text-slate-200"
              required
            />
          </div>

          {/* Live Balance Preview */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#181920] border border-[#2d3139]">
            <div>
              <span className="text-[11px] text-slate-400 block">Current On Hand</span>
              <span className="text-sm font-semibold text-slate-200 font-mono">{currentOnHand}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Resulting On Hand</span>
              <span className="text-sm font-semibold text-emerald-400 font-mono">{resultingOnHand}</span>
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Reference / Waybill #</label>
              <Input
                type="text"
                placeholder="e.g. REC-2026-004"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value);
                  saveDraft({ reference: e.target.value });
                }}
                className="bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Notes (Optional)</label>
              <Input
                type="text"
                placeholder="e.g. Supplier delivery"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  saveDraft({ notes: e.target.value });
                }}
                className="bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d3139]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={receiveStock.isPending}
              className="border-[#2d3139] text-slate-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={receiveStock.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {receiveStock.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Recording...
                </>
              ) : (
                'Confirm Receipt'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
