import * as React from 'react';
import { X, SlidersHorizontal, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { useStockMutations } from '../hooks/useStock';
import { productApi } from '../products-api';
import type { StockItem } from '../stock-api';

export interface AdjustStockModalProps {
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

export function AdjustStockModal({
  isOpen,
  onClose,
  selectedItem,
  stockItems = [],
  branchId,
  branches,
  onSuccess,
  initialProductId,
  initialVariantId,
}: AdjustStockModalProps) {
  const effectiveProductId = selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';

  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    mode?: 'delta' | 'counted';
    inputValue?: string;
    reason?: 'damage' | 'loss' | 'found' | 'correction' | 'count_reconciliation' | 'other';
    notes?: string;
    targetBranchId?: string;
  }>(effectiveProductId ? `adjust_${effectiveProductId}` : 'adjust_new', {
    mode: 'delta',
    inputValue: '0',
    reason: 'damage',
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

  // Dual mode: 'delta' (+/- change) vs 'counted' (new physical total)
  const [mode, setMode] = React.useState<'delta' | 'counted'>(() => draft?.mode || 'delta');
  const [inputValue, setInputValue] = React.useState<string>(() => draft?.inputValue || '0');
  const [reason, setReason] = React.useState<
    'damage' | 'loss' | 'found' | 'correction' | 'count_reconciliation' | 'other'
  >(() => draft?.reason || 'damage');
  const [notes, setNotes] = React.useState(() => draft?.notes || '');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { adjustStock } = useStockMutations();

  React.useEffect(() => {
    if (selectedItem) {
      setProductId(selectedItem.productId);
      setTargetBranchId(selectedItem.branchId);
      if (selectedItem.variantId) {
        setVariantId(selectedItem.variantId);
      }
      if (draft?.inputValue) {
        setInputValue(draft.inputValue);
      } else if (mode === 'counted') {
        setInputValue(String(selectedItem.quantityOnHand));
      } else {
        setInputValue('0');
      }
    } else if (initialProductId) {
      setProductId(initialProductId);
      if (initialVariantId) {
        setVariantId(initialVariantId);
      }
    }
  }, [selectedItem, initialProductId, initialVariantId, mode, draft?.inputValue]);

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

  const currentItem = selectedItem || stockItems.find((i) => i.productId === productId && (variantId ? i.variantId === variantId : true));
  const currentOnHand = currentItem ? currentItem.quantityOnHand : 0;
  const reserved = currentItem ? currentItem.reserved : 0;
  const available = Math.max(0, currentOnHand - reserved);

  const numericInput = Number(inputValue) || 0;
  const resultingOnHand = mode === 'delta' ? currentOnHand + numericInput : numericInput;
  const derivedDelta = mode === 'delta' ? numericInput : numericInput - currentOnHand;
  const resultingAvailable = Math.max(0, resultingOnHand - reserved);

  const isInvalidNegative = resultingOnHand < 0;
  const isInvalidReserved = resultingOnHand < reserved;

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
      setErrorMsg('Please select a specific variant to adjust.');
      return;
    }
    if (mode === 'delta' && numericInput === 0) {
      setErrorMsg('Delta quantity cannot be 0.');
      return;
    }
    if (mode === 'counted' && numericInput < 0) {
      setErrorMsg('Counted physical quantity cannot be negative.');
      return;
    }
    if (isInvalidNegative) {
      setErrorMsg(`Resulting quantity (${resultingOnHand}) cannot be negative.`);
      return;
    }
    if (isInvalidReserved) {
      setErrorMsg(
        `Cannot reduce stock below reserved quantity (${reserved}). Resulting would be ${resultingOnHand}.`
      );
      return;
    }
    if (reason === 'other' && notes.trim().length === 0) {
      setErrorMsg('A detailed note is required when reason is set to "Other".');
      return;
    }

    try {
      await adjustStock.mutateAsync({
        branchId: targetBranchId,
        productId,
        variantId: variantId || undefined,
        mode,
        value: numericInput,
        reason,
        notes: notes.trim() || undefined,
      });

      clearDraft();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply stock adjustment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#121316] border border-[#2d3139] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3139]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Adjust Product Stock</h2>
                {hasDraft && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30">
                    Draft Restored
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">Record auditable inventory corrections, loss, or counts</p>
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

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-[#181920] border border-[#2d3139] rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('delta');
                setInputValue('0');
                saveDraft({ mode: 'delta', inputValue: '0' });
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'delta'
                  ? 'bg-[#985184] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Quantity Delta (+ / -)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('counted');
                const val = String(currentOnHand);
                setInputValue(val);
                saveDraft({ mode: 'counted', inputValue: val });
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'counted'
                  ? 'bg-[#985184] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              New Verified Count
            </button>
          </div>

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

          {/* Input Value */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                {mode === 'delta' ? 'Quantity Change (+ for increase, - for decrease) *' : 'New Verified On-Hand Count *'}
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Derived change: {derivedDelta >= 0 ? `+${derivedDelta}` : derivedDelta}
              </span>
            </div>
            <Input
              type="number"
              step="any"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                saveDraft({ inputValue: e.target.value });
              }}
              className="bg-[#1a1b20] border-[#2d3139] text-slate-200 font-mono"
              required
            />
          </div>

          {/* Current vs Resulting Balance Card */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#181920] border border-[#2d3139] text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Current On-Hand</span>
              <span className="text-sm font-semibold text-slate-200 font-mono">{currentOnHand}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Reserved (Locked)</span>
              <span className="text-sm font-semibold text-amber-400 font-mono">{reserved}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Resulting On-Hand</span>
              <span
                className={`text-sm font-semibold font-mono ${
                  isInvalidNegative || isInvalidReserved ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {resultingOnHand}
              </span>
            </div>
          </div>

          {(isInvalidNegative || isInvalidReserved) && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                {isInvalidNegative
                  ? 'Negative stock balance is strictly disallowed.'
                  : `Resulting stock cannot fall below reserved stock (${reserved}).`}
              </span>
            </div>
          )}

          {/* Reason & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Adjustment Reason *</label>
              <select
                value={reason}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setReason(val);
                  saveDraft({ reason: val });
                }}
                className="w-full h-9 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden focus:border-[#985184]"
              >
                <option value="damage">Damage / Breakage</option>
                <option value="loss">Loss / Theft</option>
                <option value="found">Found / Discovered</option>
                <option value="correction">Data Correction</option>
                <option value="count_reconciliation">Physical Count Reconciliation</option>
                <option value="other">Other (Requires Note)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Notes {reason === 'other' ? '(Required) *' : '(Optional)'}
              </label>
              <Input
                type="text"
                placeholder={reason === 'other' ? 'Explain adjustment reason' : 'Optional reference note'}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  saveDraft({ notes: e.target.value });
                }}
                className="bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
                required={reason === 'other'}
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
              disabled={adjustStock.isPending}
              className="border-[#2d3139] text-slate-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={adjustStock.isPending || isInvalidNegative || isInvalidReserved}
              className="bg-[#985184] hover:bg-[#854573] text-white"
            >
              {adjustStock.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Updating...
                </>
              ) : (
                'Commit Adjustment'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
