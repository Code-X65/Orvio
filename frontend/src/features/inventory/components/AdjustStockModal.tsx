import * as React from 'react';
import { X, SlidersHorizontal, AlertCircle, AlertTriangle, Loader2, Store } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
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
  activeBranchName?: string;
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
  activeBranchName,
  branches,
  onSuccess,
  initialProductId,
  initialVariantId,
}: AdjustStockModalProps) {
  const effectiveProductId = selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';

  const effectiveBranchId =
    branchId && branchId !== 'all'
      ? branchId
      : selectedItem?.branchId || branches[0]?.id || '';

  const effectiveBranchName =
    activeBranchName ||
    branches.find((b) => b.id === effectiveBranchId)?.name ||
    'Current Branch';

  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    mode?: 'delta' | 'counted';
    inputValue?: string;
    reason?: 'damage' | 'loss' | 'found' | 'correction' | 'count_reconciliation' | 'other';
    notes?: string;
  }>(effectiveProductId ? `adjust_${effectiveProductId}` : 'adjust_new', {
    mode: 'delta',
    inputValue: '0',
    reason: 'damage',
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

  const targetBranchId = effectiveBranchId;

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
      triggerClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply stock adjustment.');
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="adjust-stock-drawer">
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
            onClick={triggerClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer transition-colors"
            data-testid="adjust-drawer-close"
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

          {/* Product Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Product *</label>
            {selectedItem ? (
              <div className="h-10 px-3 bg-[#141519]/90 border-0 border-b-2 border-[#2d3139] flex items-center text-xs text-slate-200 truncate">
                {selectedItem.productName}
              </div>
            ) : (
              <SearchableSelect
                value={productId}
                onChange={(val) => setProductId(val)}
                placeholder="Select product to adjust..."
                searchPlaceholder="Search by product name or SKU..."
                options={stockItems.map((item) => ({
                  value: item.productId,
                  label: item.productName,
                  sublabel: item.sku,
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
                placeholder="Select product variant..."
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
              <SearchableSelect
                value={reason}
                onChange={(val) => {
                  setReason(val as any);
                  saveDraft({ reason: val as any });
                }}
                options={[
                  { value: 'damage', label: 'Damage / Breakage' },
                  { value: 'loss', label: 'Loss / Theft' },
                  { value: 'found', label: 'Found / Discovered' },
                  { value: 'correction', label: 'Data Correction' },
                  { value: 'count_reconciliation', label: 'Physical Count Reconciliation' },
                  { value: 'other', label: 'Other (Requires Note)' },
                ]}
                searchPlaceholder="Filter reasons..."
                required
              />
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

          </div>

          {/* Sticky Footer Actions */}
          <div className="px-6 py-4 border-t border-[#2d3139] bg-[#181a20] flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerClose}
              disabled={adjustStock.isPending}
              className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={adjustStock.isPending || isInvalidNegative || isInvalidReserved}
              className="bg-[#985184] hover:bg-[#854573] text-white text-xs font-medium"
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
      </aside>
    </div>
  );
}
