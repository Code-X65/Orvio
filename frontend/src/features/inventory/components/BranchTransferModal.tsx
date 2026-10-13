import * as React from 'react';
import { X, ArrowRightLeft, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { useStockMutations } from '../hooks/useStock';
import type { StockItem } from '../stock-api';

export interface BranchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: StockItem | null;
  stockItems?: StockItem[];
  branchId?: string;
  branches: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
  initialProductId?: string;
}

export function BranchTransferModal({
  isOpen,
  onClose,
  selectedItem,
  stockItems = [],
  branchId,
  branches,
  onSuccess,
  initialProductId,
}: BranchTransferModalProps) {
  const effectiveProductId = selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';

  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    sourceBranchId?: string;
    destinationBranchId?: string;
    quantity?: number;
    notes?: string;
  }>(effectiveProductId ? `transfer_${effectiveProductId}` : 'transfer_new', {
    quantity: 1,
    notes: '',
  });

  const [sourceBranchId, setSourceBranchId] = React.useState<string>(() => {
    if (draft?.sourceBranchId) return draft.sourceBranchId;
    if (selectedItem?.branchId) return selectedItem.branchId;
    if (branchId && branchId !== 'all') return branchId;
    return branches[0]?.id || '';
  });

  const [destinationBranchId, setDestinationBranchId] = React.useState<string>(() => {
    if (draft?.destinationBranchId) return draft.destinationBranchId;
    const remaining = branches.filter((b) => b.id !== (selectedItem?.branchId || branchId || branches[0]?.id));
    return remaining[0]?.id || '';
  });

  const [productId, setProductId] = React.useState<string>(() => {
    return selectedItem?.productId || initialProductId || stockItems[0]?.productId || '';
  });

  const [quantity, setQuantity] = React.useState<number>(() => draft?.quantity ?? 1);
  const [notes, setNotes] = React.useState(() => draft?.notes ?? '');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { transferStock } = useStockMutations();

  React.useEffect(() => {
    if (selectedItem) {
      setProductId(selectedItem.productId);
      setSourceBranchId(selectedItem.branchId);
      const other = branches.find((b) => b.id !== selectedItem.branchId);
      if (other && !draft?.destinationBranchId) setDestinationBranchId(other.id);
    } else if (initialProductId) {
      setProductId(initialProductId);
    }
  }, [selectedItem, initialProductId, branches, draft?.destinationBranchId]);

  if (!isOpen) return null;

  const currentItem = selectedItem || stockItems.find((i) => i.productId === productId && i.branchId === sourceBranchId);
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
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      });

      clearDraft();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete branch transfer.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#121316] border border-[#2d3139] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3139]">
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

          {/* Branch Routing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Source Branch (From) *</label>
              <select
                value={sourceBranchId}
                onChange={(e) => {
                  setSourceBranchId(e.target.value);
                  saveDraft({ sourceBranchId: e.target.value });
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Destination Branch (To) *</label>
              <select
                value={destinationBranchId}
                onChange={(e) => {
                  setDestinationBranchId(e.target.value);
                  saveDraft({ destinationBranchId: e.target.value });
                }}
                className="w-full h-9 bg-[#1a1b20] border border-[#2d3139] rounded-md px-3 text-xs text-slate-200 focus:outline-hidden focus:border-[#985184]"
                required
              >
                {branches
                  .filter((b) => b.id !== sourceBranchId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Product *</label>
            {selectedItem ? (
              <div className="p-3 rounded-lg bg-[#181920] border border-[#2d3139]">
                <div className="text-xs font-semibold text-slate-200">{selectedItem.productName}</div>
                <div className="text-[10px] text-slate-400 font-mono">SKU: {selectedItem.sku}</div>
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
                    {item.productName} ({item.sku}) - {item.available} avail
                  </option>
                ))}
              </select>
            )}
          </div>

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

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2d3139]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={transferStock.isPending}
              className="border-[#2d3139] text-slate-300 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={transferStock.isPending || isOverQuantity || isSameBranch}
              className="bg-blue-600 hover:bg-blue-500 text-white"
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
      </div>
    </div>
  );
}
