import * as React from 'react';
import {
  X,
  Layers,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  Barcode,
  TrendingUp,
  AlertTriangle,
  Tag,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type {
  Product,
  ProductVariant,
  CreateVariantPayload,
} from '../products-api';
import { formatPriceInput, formatInitialPrice } from './ProductForm';

export interface ProductVariantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVariantPayload) => Promise<void>;
  parentProduct: Product | null;
  editingVariant?: ProductVariant | null;
  currency?: string;
}

interface AttributeRow {
  key: string;
  value: string;
}

export function ProductVariantForm({
  isOpen,
  onClose,
  onSubmit,
  parentProduct,
  editingVariant,
  currency = 'NGN',
}: ProductVariantFormProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [sku, setSku] = React.useState('');
  const [barcode, setBarcode] = React.useState('');
  const [costPrice, setCostPrice] = React.useState<number | ''>('');
  const [costPriceDisplay, setCostPriceDisplay] = React.useState('');
  const [sellingPrice, setSellingPrice] = React.useState<number | ''>('');
  const [sellingPriceDisplay, setSellingPriceDisplay] = React.useState('');
  const [compareAtPrice, setCompareAtPrice] = React.useState<number | ''>('');
  const [compareAtPriceDisplay, setCompareAtPriceDisplay] = React.useState('');
  const [initialStock, setInitialStock] = React.useState<number | ''>(0);
  const [attributes, setAttributes] = React.useState<AttributeRow[]>([
    { key: 'Size', value: '' },
  ]);
  const [isActive, setIsActive] = React.useState(true);

  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sensitive Price Modal
  const [isPriceConfirmOpen, setIsPriceConfirmOpen] = React.useState(false);
  const [pendingPayload, setPendingPayload] = React.useState<CreateVariantPayload | null>(null);

  // Animation controller
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setMounted(true);
      timer = setTimeout(() => {
        setAnimating(true);
      }, 20);
    } else {
      setAnimating(false);
      timer = setTimeout(() => {
        setMounted(false);
      }, 300);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Sync state on open
  React.useEffect(() => {
    if (editingVariant) {
      setName(editingVariant.name);
      setSku(editingVariant.sku);
      setBarcode(editingVariant.barcode || '');

      const cost = formatInitialPrice(editingVariant.cost_price);
      setCostPrice(cost.numeric);
      setCostPriceDisplay(cost.display);

      const selling = formatInitialPrice(editingVariant.selling_price);
      setSellingPrice(selling.numeric);
      setSellingPriceDisplay(selling.display);

      const compare = formatInitialPrice(editingVariant.compare_at_price);
      setCompareAtPrice(compare.numeric);
      setCompareAtPriceDisplay(compare.display);

      setInitialStock('');

      const attrEntries = Object.entries(editingVariant.attributes || {});
      if (attrEntries.length > 0) {
        setAttributes(attrEntries.map(([key, value]) => ({ key, value: String(value) })));
      } else {
        setAttributes([{ key: 'Size', value: '' }]);
      }
      setIsActive(editingVariant.is_active);
    } else {
      setName('');
      setSku('');
      setBarcode('');

      const cost = formatInitialPrice(parentProduct?.cost_price);
      setCostPrice(cost.numeric);
      setCostPriceDisplay(cost.display);

      const selling = formatInitialPrice(parentProduct?.selling_price);
      setSellingPrice(selling.numeric);
      setSellingPriceDisplay(selling.display);

      setCompareAtPrice('');
      setCompareAtPriceDisplay('');

      setInitialStock(0);
      setAttributes([{ key: 'Size', value: '' }]);
      setIsActive(true);
    }
    setError(null);
    setIsPriceConfirmOpen(false);
    setPendingPayload(null);
  }, [editingVariant, parentProduct, isOpen]);

  const triggerClose = React.useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  if (!mounted) return null;

  // Compute live gain for variant
  const effectiveCost = costPrice !== '' ? Number(costPrice) : Number(parentProduct?.cost_price || 0);
  const effectiveSelling = sellingPrice !== '' ? Number(sellingPrice) : Number(parentProduct?.selling_price || 0);
  const gain = effectiveSelling - effectiveCost;
  const marginPercent = effectiveSelling > 0 ? (gain / effectiveSelling) * 100 : 0;
  const isLoss = effectiveSelling < effectiveCost;
  const isBreakEven = gain === 0;

  // Auto-generate variant SKU from parent SKU and attributes/name
  const handleAutoSku = () => {
    const parentSku = parentProduct?.sku || 'PRD';
    const variantSuffix = attributes
      .map((a) => a.value.trim().toUpperCase())
      .filter(Boolean)
      .join('-');
    const suffix = variantSuffix || Math.floor(10 + Math.random() * 90).toString();
    setSku(`${parentSku}-${suffix}`);
  };

  const handleGenerateBarcode = () => {
    const timestamp = Date.now().toString().slice(-10);
    const rand = Math.floor(10 + Math.random() * 90);
    setBarcode(`20${timestamp}${rand}`);
  };

  const addAttributeRow = () => {
    setAttributes([...attributes, { key: '', value: '' }]);
  };

  const updateAttributeRow = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...attributes];
    next[index][field] = val;
    setAttributes(next);

    // Auto-update variant name if user hasn't typed an explicit custom one
    if (!name || name === attributes.map((a) => a.value).filter(Boolean).join(' / ')) {
      const combined = next.map((a) => a.value).filter(Boolean).join(' / ');
      setName(combined);
    }
  };

  const removeAttributeRow = (index: number) => {
    if (attributes.length === 1) {
      setAttributes([{ key: '', value: '' }]);
      return;
    }
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Variant name is required.');
      return;
    }

    if (isLoss) {
      setError('Variant selling price must not be less than cost price. You cannot sell at a loss.');
      return;
    }

    // Build attributes record
    const attrRecord: Record<string, any> = {};
    for (const attr of attributes) {
      if (attr.key.trim() && attr.value.trim()) {
        attrRecord[attr.key.trim()] = attr.value.trim();
      }
    }

    const payload: CreateVariantPayload = {
      name: trimmedName,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      attributes: Object.keys(attrRecord).length > 0 ? attrRecord : undefined,
      costPrice: costPrice !== '' ? Number(costPrice) : undefined,
      sellingPrice: sellingPrice !== '' ? Number(sellingPrice) : undefined,
      compareAtPrice: compareAtPrice !== '' ? Number(compareAtPrice) : undefined,
      initialStock: initialStock !== '' ? Number(initialStock) : 0,
      isActive,
    };

    if (editingVariant) {
      const costChanged = Number(costPrice) !== Number(editingVariant.cost_price);
      const sellingChanged = Number(sellingPrice) !== Number(editingVariant.selling_price);
      if (costChanged || sellingChanged) {
        setPendingPayload(payload);
        setIsPriceConfirmOpen(true);
        return;
      }
    }

    await executeSubmit(payload);
  };

  const executeSubmit = async (payload: CreateVariantPayload) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(payload);
      triggerClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save variant. Please check details and try again.');
    } finally {
      setIsSubmitting(false);
      setIsPriceConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden" data-testid="variant-form-modal">
        {/* Backdrop */}
        <div
          onClick={triggerClose}
          className={`fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
            animating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
        />

        {/* Slide-over Right Hand Panel */}
        <aside
          className={`fixed inset-y-0 right-0 w-full max-w-md sm:max-w-lg h-screen bg-[#181a20] border-l border-[#2d3139] text-slate-100 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${
            animating ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-[#2d3139] bg-[#181a20] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-[#985184]/15 text-[#985184] flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-[#fbb945]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {editingVariant ? 'Edit Variant' : 'Add Product Variant'}
                </h3>
                <p className="text-xs text-slate-400">
                  For: <span className="text-[#fbb945] font-medium">{parentProduct?.name}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={triggerClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#252830] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div
                className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {/* Variant Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Variant Name / Label <span className="text-rose-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Large / Red or 500ml"
                className="bg-[#121316] border-[#2d3139] text-white placeholder:text-slate-600 focus:border-[#985184] text-sm"
                required
              />
            </div>

            {/* Dynamic Attributes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Attributes (Options)
                </label>
                <button
                  type="button"
                  onClick={addAttributeRow}
                  className="text-[11px] text-[#fbb945] hover:text-[#fbb945]/80 flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Option
                </button>
              </div>

              <div className="space-y-2">
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={attr.key}
                      onChange={(e) => updateAttributeRow(idx, 'key', e.target.value)}
                      placeholder="Option (e.g. Size)"
                      className="w-1/3 bg-[#121316] border-[#2d3139] text-white text-xs placeholder:text-slate-600"
                    />
                    <Input
                      value={attr.value}
                      onChange={(e) => updateAttributeRow(idx, 'value', e.target.value)}
                      placeholder="Value (e.g. XL, Red)"
                      className="flex-1 bg-[#121316] border-[#2d3139] text-white text-xs placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttributeRow(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SKU & Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Variant SKU</label>
                  <button
                    type="button"
                    onClick={handleAutoSku}
                    className="text-[11px] text-[#fbb945] hover:text-[#fbb945]/80 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Wand2 className="w-3 h-3" /> Auto
                  </button>
                </div>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="Auto-generated if empty"
                  className="bg-[#121316] border-[#2d3139] text-white font-mono text-xs placeholder:text-slate-600 focus:border-[#985184]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Barcode</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] text-[#fbb945] hover:text-[#fbb945]/80 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Barcode className="w-3 h-3" /> Gen
                  </button>
                </div>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Optional Barcode"
                  className="bg-[#121316] border-[#2d3139] text-white font-mono text-xs placeholder:text-slate-600 focus:border-[#985184]"
                />
              </div>
            </div>

            {/* Pricing Overrides & Gain Analysis */}
            <div className="border-t border-[#2d3139]/80 pt-4 space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pricing & Margin Override
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cost Price ({currency})
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={costPriceDisplay}
                    onChange={(e) => {
                      const formatted = formatPriceInput(e.target.value);
                      setCostPriceDisplay(formatted.display);
                      setCostPrice(formatted.numeric);
                    }}
                    placeholder={`Default: ${parentProduct?.cost_price ? Number(parentProduct.cost_price).toLocaleString('en-US') : '0.00'}`}
                    className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Selling Price ({currency})
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={sellingPriceDisplay}
                    onChange={(e) => {
                      const formatted = formatPriceInput(e.target.value);
                      setSellingPriceDisplay(formatted.display);
                      setSellingPrice(formatted.numeric);
                    }}
                    placeholder={`Default: ${parentProduct?.selling_price ? Number(parentProduct.selling_price).toLocaleString('en-US') : '0.00'}`}
                    className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184]"
                  />
                </div>
              </div>

              {/* Compare-At Price for Variant */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#fbb945]" />
                  Compare-At Price ({currency}) <span className="text-slate-500 font-normal">(Optional Promo)</span>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={compareAtPriceDisplay}
                  onChange={(e) => {
                    const formatted = formatPriceInput(e.target.value);
                    setCompareAtPriceDisplay(formatted.display);
                    setCompareAtPrice(formatted.numeric);
                  }}
                  placeholder="Original price before discount"
                  className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184]"
                />
              </div>

              {/* REAL-TIME GAIN & MARGIN BADGE */}
              <div
                className={`p-3 rounded-lg border text-xs transition-colors ${
                  isLoss
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : isBreakEven
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    {isLoss ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>{isLoss ? 'Selling at a loss!' : 'Variant Gain & Margin'}</span>
                  </div>
                  <div className="font-bold text-sm font-mono">
                    {gain > 0 ? '+' : ''}
                    {currency} {gain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-[11px] font-normal ml-1.5 opacity-80">
                      ({marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                {isLoss && (
                  <div className="mt-1 text-[11px] text-rose-400">
                    ⚠️ Selling price must be at or above {currency} {effectiveCost.toLocaleString('en-US')}.
                  </div>
                )}
              </div>
            </div>

            {/* Stock Level */}
            {!editingVariant && (
              <div className="border-t border-[#2d3139]/80 pt-4 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Initial Stock Level
                </label>
                <Input
                  type="number"
                  min="0"
                  value={initialStock}
                  onChange={(e) =>
                    setInitialStock(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="0"
                  className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184]"
                />
                <span className="text-[10px] text-slate-500">
                  Stock allocated for this variant at primary branch
                </span>
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 bg-[#141519] border border-[#2d3139] rounded-lg">
              <div>
                <div className="text-xs font-semibold text-slate-200">Active Status</div>
                <div className="text-[11px] text-slate-400">
                  Available for sale and inventory counts
                </div>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-[#985184] focus:ring-[#985184] accent-[#985184] cursor-pointer"
              />
            </div>
          </form>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#2d3139] bg-[#181a20] flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={triggerClose}
              disabled={isSubmitting}
              className="border-[#2d3139] text-slate-300 hover:bg-[#252830] hover:text-white text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoss}
              className="bg-[#985184] hover:bg-[#985184]/90 text-white text-xs h-9 px-4 font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingVariant ? 'Save Changes' : 'Add Variant'}
            </Button>
          </div>
        </aside>
      </div>

      {/* SENSITIVE PRICE CHANGE CONFIRMATION MODAL FOR VARIANT */}
      {isPriceConfirmOpen && editingVariant && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181a20] border border-amber-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Sensitive Price Change</h3>
                <p className="text-xs text-slate-400">Review price revision for variant "{name}"</p>
              </div>
            </div>

            <div className="bg-[#141519] border border-[#2d3139] rounded-lg p-3 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Selling Price:</span>
                <span className="font-mono flex items-center gap-1.5">
                  <span className="line-through text-slate-500">
                    {currency} {Number(editingVariant.selling_price).toLocaleString()}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-emerald-400">
                    {currency} {effectiveSelling.toLocaleString()}
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cost Price:</span>
                <span className="font-mono flex items-center gap-1.5">
                  <span className="line-through text-slate-500">
                    {currency} {Number(editingVariant.cost_price).toLocaleString()}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-white">
                    {currency} {effectiveCost.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPriceConfirmOpen(false)}
                className="border-[#2d3139] text-slate-300 text-xs h-9"
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => pendingPayload && executeSubmit(pendingPayload)}
                className="bg-[#985184] hover:bg-[#985184]/90 text-white text-xs h-9 font-medium"
              >
                Confirm Revision
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
