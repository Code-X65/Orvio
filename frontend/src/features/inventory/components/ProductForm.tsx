import * as React from 'react';
import {
  X,
  Package,
  AlertCircle,
  Loader2,
  Wand2,
  Barcode,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import type { CategoryTreeNode } from '../categories-api';
import { flattenCategoriesForSelection } from './CategoryForm';
import type {
  Product,
  MeasurementUnit,
  CreateProductPayload,
  UpdateProductPayload,
} from '../products-api';

export interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProductPayload | UpdateProductPayload) => Promise<void>;
  editingProduct?: Product | null;
  categories: CategoryTreeNode[];
  currency?: string;
  defaultCategoryId?: string | null;
}

const MEASUREMENT_UNITS: Array<{ value: MeasurementUnit; label: string }> = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'liter', label: 'Liters (liter)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'dozen', label: 'Dozen' },
];

export function formatPriceInput(raw: string): { display: string; numeric: number | '' } {
  if (!raw || !raw.trim()) {
    return { display: '', numeric: '' };
  }
  // Sanitize: allow only digits and dots
  const sanitized = raw.replace(/[^\d.]/g, '');
  const parts = sanitized.split('.');
  const intDigits = parts[0].replace(/[^\d]/g, '');
  const formattedInt = intDigits ? Number(intDigits).toLocaleString('en-US') : '';

  let display = formattedInt;
  if (parts.length > 1) {
    // Keep up to 2 decimal places
    const decDigits = parts.slice(1).join('').replace(/[^\d]/g, '').slice(0, 2);
    display = `${formattedInt || '0'}.${decDigits}`;
  }

  const numeric = display ? Number(display.replace(/,/g, '')) : '';
  return {
    display,
    numeric: typeof numeric === 'number' && !isNaN(numeric) ? numeric : '',
  };
}

export function formatInitialPrice(val: number | null | undefined): { display: string; numeric: number | '' } {
  if (val === null || val === undefined || isNaN(val)) {
    return { display: '', numeric: '' };
  }
  const display = Number(val).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  return { display, numeric: val };
}

export function ProductForm({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  categories,
  currency = 'NGN',
  defaultCategoryId,
}: ProductFormProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [sku, setSku] = React.useState('');
  const [barcode, setBarcode] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [costPrice, setCostPrice] = React.useState<number | ''>('');
  const [costPriceDisplay, setCostPriceDisplay] = React.useState('');
  const [sellingPrice, setSellingPrice] = React.useState<number | ''>('');
  const [sellingPriceDisplay, setSellingPriceDisplay] = React.useState('');
  const [unitOfMeasure, setUnitOfMeasure] = React.useState<MeasurementUnit>('pcs');
  const [trackQuantity, setTrackQuantity] = React.useState(true);
  const [initialStock, setInitialStock] = React.useState<number | ''>(0);
  const [lowStockThreshold, setLowStockThreshold] = React.useState<number | ''>(5);
  const [hasVariants, setHasVariants] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  // Sync state on edit / open
  React.useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setSku(editingProduct.sku);
      setBarcode(editingProduct.barcode || '');
      setCategoryId(editingProduct.category_id || null);

      const cost = formatInitialPrice(editingProduct.cost_price);
      setCostPrice(cost.numeric);
      setCostPriceDisplay(cost.display);

      const selling = formatInitialPrice(editingProduct.selling_price);
      setSellingPrice(selling.numeric);
      setSellingPriceDisplay(selling.display);

      setUnitOfMeasure(editingProduct.unit_of_measure);
      setTrackQuantity(editingProduct.track_quantity);
      setInitialStock(''); // Not editable after creation
      setLowStockThreshold(editingProduct.low_stock_threshold);
      setHasVariants(editingProduct.has_variants);
      setDescription(editingProduct.description || '');
      setIsActive(editingProduct.is_active);
    } else {
      setName('');
      setSku('');
      setBarcode('');
      setCategoryId(defaultCategoryId ?? null);
      setCostPrice('');
      setCostPriceDisplay('');
      setSellingPrice('');
      setSellingPriceDisplay('');
      setUnitOfMeasure('pcs');
      setTrackQuantity(true);
      setInitialStock(0);
      setLowStockThreshold(5);
      setHasVariants(false);
      setDescription('');
      setIsActive(true);
    }
    setError(null);
  }, [editingProduct, defaultCategoryId, isOpen]);

  const triggerClose = React.useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  if (!mounted) return null;

  const categoryOptions = flattenCategoriesForSelection(categories);

  // Helper: auto-generate SKU suggestion from name
  const handleGenerateSku = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a product name first to generate SKU.');
      return;
    }
    const words = trimmed.split(/[\s-_]+/).filter(Boolean);
    let prefix = '';
    if (words.length === 1) {
      prefix = words[0].slice(0, 3).toUpperCase();
    } else {
      prefix = words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
    }
    const rand = Math.floor(100 + Math.random() * 900);
    setSku(`${prefix}-${rand}`);
    setError(null);
  };

  // Helper: auto-generate EAN-13-style barcode
  const handleGenerateBarcode = () => {
    const timestamp = Date.now().toString().slice(-10);
    const rand = Math.floor(10 + Math.random() * 90);
    setBarcode(`20${timestamp}${rand}`);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }

    if (!categoryId || !categoryId.trim()) {
      setError('Category or subcategory is mandatory. Please select one.');
      return;
    }

    if (costPrice === '' || Number(costPrice) < 0) {
      setError('Please enter a valid cost price (0 or greater).');
      return;
    }

    if (sellingPrice === '' || Number(sellingPrice) < 0) {
      setError('Please enter a valid selling price (0 or greater).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (editingProduct) {
        const payload: UpdateProductPayload = {
          name: trimmedName,
          sku: sku.trim() || undefined,
          barcode: barcode.trim() ? barcode.trim() : null,
          categoryId: categoryId || null,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          unitOfMeasure,
          trackQuantity,
          lowStockThreshold: lowStockThreshold === '' ? 5 : Number(lowStockThreshold),
          hasVariants,
          description: description.trim() || null,
          isActive,
        };
        await onSubmit(payload);
      } else {
        const payload: CreateProductPayload = {
          name: trimmedName,
          sku: sku.trim() || undefined,
          barcode: barcode.trim() || undefined,
          categoryId: categoryId || null,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          unitOfMeasure,
          trackQuantity,
          initialStock: initialStock === '' ? 0 : Number(initialStock),
          lowStockThreshold: lowStockThreshold === '' ? 5 : Number(lowStockThreshold),
          hasVariants,
          description: description.trim() || undefined,
          isActive,
        };
        await onSubmit(payload);
      }
      triggerClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product. Please check the fields and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="product-form-modal">
      {/* Backdrop */}
      <div
        onClick={triggerClose}
        className={`fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
          animating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Right Hand Panel (h-screen with slide animation) */}
      <aside
        className={`fixed inset-y-0 right-0 w-full max-w-lg sm:max-w-xl h-screen bg-[#181a20] border-l border-[#2d3139] text-slate-100 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${
          animating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#2d3139] bg-[#181a20] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#985184]/15 text-[#985184] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-[#fbb945]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <p className="text-xs text-slate-400">
                {editingProduct
                  ? 'Update product details, pricing and inventory policy'
                  : 'Define a product item or template for your inventory catalog'}
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

          {/* Section: Basic Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              General Information
            </h4>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Product Name <span className="text-rose-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Golden Penny Spaghetti 500g"
                className="bg-[#121316] border-[#2d3139] text-white placeholder:text-slate-600 focus:border-[#985184] text-sm"
                required
              />
            </div>

            {/* SKU and Barcode (Grid 2 cols) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    SKU Code
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-[11px] text-[#fbb945] hover:text-[#fbb945]/80 flex items-center gap-1 font-medium transition-colors"
                    title="Auto-generate from product name"
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
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Unique item identifier
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Barcode
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] text-[#fbb945] hover:text-[#fbb945]/80 flex items-center gap-1 font-medium transition-colors"
                    title="Generate random barcode"
                  >
                    <Barcode className="w-3 h-3" /> Gen
                  </button>
                </div>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Optional barcode / UPC"
                  className="bg-[#121316] border-[#2d3139] text-white font-mono text-xs placeholder:text-slate-600 focus:border-[#985184]"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  For barcode scanners
                </span>
              </div>
            </div>

            {/* Category or Subcategory Select (Mandatory) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Category or Subcategory <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">Mandatory</span>
              </div>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value ? e.target.value : null)}
                className={`w-full bg-[#121316] border rounded-md px-3 py-2 text-sm text-white focus:outline-none transition-colors ${
                  !categoryId ? 'border-amber-500/50 text-slate-400' : 'border-[#2d3139] text-white focus:border-[#985184]'
                }`}
                required
              >
                <option value="" disabled>-- Select a Category or Subcategory * --</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="text-white bg-[#181a20]">
                    {opt.label}
                  </option>
                ))}
              </select>
              {categoryOptions.length === 0 ? (
                <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  No categories found. Please create a category first in the Categories tab.
                </p>
              ) : (
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Assign product to a primary category or nested subcategory
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-[#2d3139]/80 pt-4 space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pricing & Unit
            </h4>

            {/* Cost and Selling Price (Auto-comma formatted) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cost Price ({currency}) <span className="text-rose-400">*</span>
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
                  placeholder="0.00"
                  className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184]"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  e.g. 1,500.00 (commas added automatically)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Selling Price ({currency}) <span className="text-rose-400">*</span>
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
                  placeholder="0.00"
                  className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184]"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  e.g. 2,500.00 (commas added automatically)
                </span>
              </div>
            </div>

            {/* Unit of Measure */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Unit of Measure
              </label>
              <select
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value as MeasurementUnit)}
                className="w-full bg-[#121316] border border-[#2d3139] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#985184] transition-colors"
              >
                {MEASUREMENT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-[#2d3139]/80 pt-4 space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Inventory & Tracking
            </h4>

            {/* Track Quantity Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#141519] border border-[#2d3139] rounded-lg">
              <div>
                <div className="text-xs font-semibold text-slate-200">Track Quantity</div>
                <div className="text-[11px] text-slate-400">
                  Enable stock level deductions during sales
                </div>
              </div>
              <input
                type="checkbox"
                checked={trackQuantity}
                onChange={(e) => setTrackQuantity(e.target.checked)}
                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-[#985184] focus:ring-[#985184] accent-[#985184] cursor-pointer"
              />
            </div>

            {/* Initial Stock (Only on creation) & Low Stock Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!editingProduct && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                    disabled={!trackQuantity}
                    className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184] disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Assigned to primary branch
                  </span>
                </div>
              )}

              <div className={editingProduct ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Low Stock Threshold
                </label>
                <Input
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) =>
                    setLowStockThreshold(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="5"
                  disabled={!trackQuantity}
                  className="bg-[#121316] border-[#2d3139] text-white text-sm focus:border-[#985184] disabled:opacity-50"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Triggers low stock badge and warning
                </span>
              </div>
            </div>

            {/* Has Variants Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#141519] border border-[#2d3139] rounded-lg">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#fbb945]" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Template with Variants
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Product comes in multiple sizes, colors, or flavors
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-[#985184] focus:ring-[#985184] accent-[#985184] cursor-pointer"
              />
            </div>
          </div>

          <div className="border-t border-[#2d3139]/80 pt-4 space-y-4">
            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Description (Optional)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product specifications, brand, notes..."
                rows={3}
                className="bg-[#121316] border-[#2d3139] text-white placeholder:text-slate-600 focus:border-[#985184] text-xs resize-none"
              />
            </div>

            {/* Active Status Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#141519] border border-[#2d3139] rounded-lg">
              <div>
                <div className="text-xs font-semibold text-slate-200">Active Status</div>
                <div className="text-[11px] text-slate-400">
                  Available for sales and catalog browsing
                </div>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-[#985184] focus:ring-[#985184] accent-[#985184] cursor-pointer"
              />
            </div>
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
            disabled={isSubmitting}
            className="bg-[#985184] hover:bg-[#985184]/90 text-white text-xs h-9 px-4 font-medium flex items-center gap-2 shadow-sm"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editingProduct ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </aside>
    </div>
  );
}
