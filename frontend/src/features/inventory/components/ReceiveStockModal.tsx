import * as React from 'react';
import {
  X,
  PackagePlus,
  AlertCircle,
  Loader2,
  Store,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { toast } from 'sonner';
import { productApi, type ProductListItem } from '../products-api';
import { supplierApi, type Supplier } from '../suppliers-api';
import { stockReceiptsApi, type StockReceipt } from '../stock-receipts-api';
import type { StockItem } from '../stock-api';

export interface ReceiveStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: StockItem | null;
  stockItems?: StockItem[];
  branchId?: string;
  activeBranchName?: string;
  branches: Array<{ id: string; name: string }>;
  initialSupplierId?: string;
  initialProductId?: string;
  initialVariantId?: string;
  onSuccess?: () => void;
  onViewReceiptDetails?: (receiptId: string) => void;
}

interface ReceiptRowItem {
  key: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string;
  hasVariants: boolean;
  variants: Array<{ id: string; name?: string; sku: string; attributes?: Record<string, string> }>;
  quantity: number;
  unitCost: string;
  notes: string;
}

export function ReceiveStockModal({
  isOpen,
  onClose,
  selectedItem,
  stockItems = [],
  branchId,
  activeBranchName,
  branches,
  initialSupplierId,
  initialProductId,
  initialVariantId,
  onSuccess,
  onViewReceiptDetails,
}: ReceiveStockModalProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  // Animation lifecycle
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

  // Target Branch
  const [targetBranchId, setTargetBranchId] = React.useState<string>(() => {
    return (
      (branchId && branchId !== 'all' ? branchId : '') ||
      selectedItem?.branchId ||
      branches[0]?.id ||
      ''
    );
  });

  React.useEffect(() => {
    if (branchId && branchId !== 'all') {
      setTargetBranchId(branchId);
    } else if (selectedItem?.branchId) {
      setTargetBranchId(selectedItem.branchId);
    } else if (!targetBranchId && branches[0]?.id) {
      setTargetBranchId(branches[0].id);
    }
  }, [branchId, selectedItem, branches]);

  // Suppliers List
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>(initialSupplierId || '');

  // Quick inline new supplier state
  const [showAddSupplierInline, setShowAddSupplierInline] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState('');
  const [newSupplierPhone, setNewSupplierPhone] = React.useState('');
  const [savingSupplier, setSavingSupplier] = React.useState(false);

  // Catalog Products list for picking
  const [catalogProducts, setCatalogProducts] = React.useState<ProductListItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);

  // Receipt Header fields
  const [receiptDate, setReceiptDate] = React.useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reference, setReference] = React.useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = React.useState<string>('');
  const [receiptNotes, setReceiptNotes] = React.useState<string>('');

  // Multi-Product Lines
  const [rows, setRows] = React.useState<ReceiptRowItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Load Active Suppliers
  const fetchSuppliers = React.useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const res = await supplierApi.listSuppliers({ activeOnly: true, limit: 100 });
      setSuppliers(res.suppliers);
      if (!selectedSupplierId && res.suppliers.length > 0) {
        if (initialSupplierId && res.suppliers.some((s) => s.id === initialSupplierId)) {
          setSelectedSupplierId(initialSupplierId);
        } else {
          setSelectedSupplierId(res.suppliers[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingSuppliers(false);
    }
  }, [initialSupplierId, selectedSupplierId]);

  // Load Catalog Products
  const fetchProducts = React.useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const res = await productApi.listProducts({ limit: 100, status: 'active' });
      setCatalogProducts(res.products || []);
    } catch {
      // fallback to stockItems if api fails
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // Initialize data on open
  React.useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      fetchProducts();
      setErrorMsg(null);
      setReference('');
      setSupplierInvoiceNumber('');
      setReceiptNotes('');
      setReceiptDate(new Date().toISOString().split('T')[0]);

      if (initialSupplierId) {
        setSelectedSupplierId(initialSupplierId);
      }

      // Initialize line items
      const targetProdId = selectedItem?.productId || initialProductId || '';
      const targetVarId = selectedItem?.variantId || initialVariantId || '';

      if (targetProdId) {
        // Load details for initial product
        const initialRowKey = `row_${Date.now()}_0`;
        const initialRow: ReceiptRowItem = {
          key: initialRowKey,
          productId: targetProdId,
          productName: selectedItem?.productName || 'Selected Product',
          productSku: selectedItem?.sku || '',
          variantId: targetVarId,
          hasVariants: Boolean(targetVarId || selectedItem?.variantName),
          variants: targetVarId
            ? [
                {
                  id: targetVarId,
                  sku: selectedItem?.sku || '',
                  name: selectedItem?.variantName || undefined,
                },
              ]
            : [],
          quantity: 1,
          unitCost: '',
          notes: '',
        };

        setRows([initialRow]);

        // Fetch full product variants if needed
        productApi.getProduct(targetProdId).then((res) => {
          if (res?.product) {
            setRows((prev) =>
              prev.map((r) =>
                r.key === initialRowKey
                  ? {
                      ...r,
                      productName: res.product.name,
                      productSku: res.product.sku,
                      hasVariants: Boolean(res.product.has_variants && res.product.variants?.length),
                      variants: (res.product.variants as any) || [],
                      variantId: r.variantId || (res.product.variants?.[0]?.id ?? ''),
                    }
                  : r
              )
            );
          }
        }).catch(() => {});
      } else {
        // Start with an empty line
        setRows([
          {
            key: `row_${Date.now()}_0`,
            productId: '',
            productName: '',
            productSku: '',
            variantId: '',
            hasVariants: false,
            variants: [],
            quantity: 1,
            unitCost: '',
            notes: '',
          },
        ]);
      }
    }
  }, [isOpen, initialSupplierId, initialProductId, initialVariantId, selectedItem, fetchSuppliers, fetchProducts]);

  // Handle product selection in a row
  const handleSelectProduct = async (rowKey: string, productId: string) => {
    if (!productId) {
      setRows((prev) =>
        prev.map((r) =>
          r.key === rowKey
            ? {
                ...r,
                productId: '',
                productName: '',
                productSku: '',
                variantId: '',
                hasVariants: false,
                variants: [],
              }
            : r
        )
      );
      return;
    }

    // Try finding in catalog products
    const prod = catalogProducts.find((p) => p.id === productId);
    const stockProd = stockItems.find((s) => s.productId === productId);
    const name = prod?.name || stockProd?.productName || 'Product';
    const sku = prod?.sku || stockProd?.sku || '';

    // Set initial selection
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              productId,
              productName: name,
              productSku: sku,
              variantId: '',
              hasVariants: Boolean(prod?.has_variants),
              variants: (prod?.variants as any) || [],
            }
          : r
      )
    );

    // Fetch full details if needed
    try {
      const res = await productApi.getProduct(productId);
      if (res?.product) {
        const hasVars = Boolean(res.product.has_variants && res.product.variants && res.product.variants.length > 0);
        setRows((prev) =>
          prev.map((r) =>
            r.key === rowKey
              ? {
                  ...r,
                  productName: res.product.name,
                  productSku: res.product.sku,
                  hasVariants: hasVars,
                  variants: (res.product.variants as any) || [],
                  variantId: hasVars ? (res.product.variants?.[0]?.id ?? '') : '',
                }
              : r
          )
        );
      }
    } catch {
      // ignore
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `row_${Date.now()}_${prev.length}`,
        productId: '',
        productName: '',
        productSku: '',
        variantId: '',
        hasVariants: false,
        variants: [],
        quantity: 1,
        unitCost: '',
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (rowKey: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.key !== rowKey));
  };

  const handleUpdateRow = (rowKey: string, updates: Partial<ReceiptRowItem>) => {
    setRows((prev) => prev.map((r) => (r.key === rowKey ? { ...r, ...updates } : r)));
  };

  // Quick inline create supplier
  const handleCreateSupplierQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    setSavingSupplier(true);
    try {
      const res = await supplierApi.createSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
      });
      const created = res.supplier;
      toast.success(`Supplier "${created.name}" created successfully`);
      setSuppliers((prev) => [created, ...prev]);
      setSelectedSupplierId(created.id);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setShowAddSupplierInline(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create supplier');
    } finally {
      setSavingSupplier(false);
    }
  };

  // Summary calculations
  const totalUnits = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalCost = rows.reduce((sum, r) => {
    const cost = parseFloat(r.unitCost);
    const qty = Number(r.quantity) || 0;
    return sum + (!isNaN(cost) && cost >= 0 ? cost * qty : 0);
  }, 0);
  const hasAnyCostEntered = rows.some((r) => r.unitCost !== '' && !isNaN(parseFloat(r.unitCost)));

  // Submit Receipt
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetBranchId) {
      setErrorMsg('Please select a destination receiving branch.');
      return;
    }
    if (!selectedSupplierId) {
      setErrorMsg('Please select a supplier for this stock receipt.');
      return;
    }
    if (rows.length === 0) {
      setErrorMsg('Please add at least one product line to receive.');
      return;
    }

    // Validate rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId) {
        setErrorMsg(`Row #${i + 1}: Please select a product.`);
        return;
      }
      if (r.hasVariants && !r.variantId) {
        setErrorMsg(`Row #${i + 1} (${r.productName}): Please select a variant.`);
        return;
      }
      if (!r.quantity || r.quantity <= 0) {
        setErrorMsg(`Row #${i + 1} (${r.productName}): Received units must be greater than zero.`);
        return;
      }
      if (r.unitCost !== '' && (isNaN(parseFloat(r.unitCost)) || parseFloat(r.unitCost) < 0)) {
        setErrorMsg(`Row #${i + 1} (${r.productName}): Unit cost cannot be negative.`);
        return;
      }
    }

    // Validate date range (within 30 days past)
    if (receiptDate) {
      const chosen = new Date(receiptDate).getTime();
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const tomorrow = now + 24 * 60 * 60 * 1000;
      if (chosen < thirtyDaysAgo || chosen > tomorrow) {
        setErrorMsg('Receipt date cannot be more than 30 days in the past or set in the future.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const created = await stockReceiptsApi.createReceipt({
        branchId: targetBranchId,
        supplierId: selectedSupplierId,
        reference: reference.trim() || undefined,
        receiptDate: receiptDate || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        notes: receiptNotes.trim() || undefined,
        items: rows.map((r) => ({
          productId: r.productId,
          variantId: r.variantId || undefined,
          quantityReceived: Number(r.quantity),
          unitCost: r.unitCost !== '' && !isNaN(parseFloat(r.unitCost)) ? parseFloat(r.unitCost) : undefined,
          notes: r.notes.trim() || undefined,
        })),
      });

      toast.success(`Stock receipt ${created.reference} recorded successfully!`, {
        description: `Received ${created.totalQuantity} total units into inventory.`,
      });

      onSuccess?.();
      triggerClose();

      if (onViewReceiptDetails) {
        onViewReceiptDetails(created.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record stock receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  // Combine products list for options
  const allSelectableProducts = catalogProducts.length > 0
    ? catalogProducts
    : stockItems.map((s) => ({
        id: s.productId,
        name: s.productName,
        sku: s.sku,
        has_variants: Boolean(s.variantId || s.variantName),
      }));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="receive-stock-drawer">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
          animating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={triggerClose}
        aria-hidden="true"
      />

      {/* Slide-over Right Hand Panel */}
      <aside
        className={`fixed inset-y-0 right-0 w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl h-screen bg-[#181a20] border-l border-[#2d3139] text-slate-100 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${
          animating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d3139] bg-[#141519] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">Stock Receipt Intake</h2>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                  Perpetual Multi-Product
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Log supplier deliveries, record purchase costs, and automatically increment stock levels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer transition-colors"
            data-testid="receive-drawer-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmitReceipt} className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-[#121316]">
            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TOP METADATA SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#181a20] border border-[#2d3139]">
              {/* Supplier Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Supplier *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddSupplierInline(!showAddSupplierInline)}
                    className="text-[11px] text-[#fbb945] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showAddSupplierInline ? 'Cancel' : 'New Supplier'}</span>
                  </button>
                </div>

                {showAddSupplierInline ? (
                  <div className="p-2.5 rounded-md bg-[#141519] border border-[#fbb945]/30 space-y-2">
                    <div className="text-[11px] text-[#fbb945] font-medium">Quick Add Supplier</div>
                    <Input
                      type="text"
                      placeholder="Supplier / Vendor Name *"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="h-8 text-xs bg-[#1a1b20] border-[#2d3139]"
                    />
                    <Input
                      type="text"
                      placeholder="Phone Number (Optional)"
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                      className="h-8 text-xs bg-[#1a1b20] border-[#2d3139]"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddSupplierInline(false)}
                        className="h-7 text-[11px] border-[#2d3139]"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateSupplierQuick}
                        disabled={savingSupplier || !newSupplierName.trim()}
                        className="h-7 text-[11px] bg-[#fbb945] text-black hover:bg-[#fbb945]/90 font-medium"
                      >
                        {savingSupplier ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Save & Select
                      </Button>
                    </div>
                  </div>
                ) : (
                  <SearchableSelect
                    value={selectedSupplierId}
                    onChange={(val) => setSelectedSupplierId(val)}
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: s.name,
                      sublabel: s.phone || undefined,
                    }))}
                    placeholder="Select Supplier..."
                    searchPlaceholder="Search suppliers by name or phone..."
                    required
                  />
                )}
              </div>

              {/* Receipt Date (Backdatable up to 30 days) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Receipt Date *
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={receiptDate}
                    max={new Date().toISOString().split('T')[0]}
                    min={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="h-9 bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Permitted up to 30 days in the past
                </span>
              </div>

              {/* Waybill / Internal Reference */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Reference # (Waybill / Tracking)
                </label>
                <Input
                  type="text"
                  placeholder="Auto-generated if blank (e.g. RCPT-000042)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-9 bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
                />
              </div>

              {/* Supplier Invoice # */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Supplier Invoice # (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. INV-2026-904"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  className="h-9 bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
                />
              </div>

              {/* Receipt Delivery Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Delivery Notes / Remark (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Delivered via DHL, batch inspected"
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="h-9 bg-[#1a1b20] border-[#2d3139] text-xs text-slate-200"
                />
              </div>
            </div>

            {/* MULTI-PRODUCT LINE ITEMS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Products Received</span>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      {rows.length} {rows.length === 1 ? 'Line' : 'Lines'}
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add all items included in this delivery. Specify received quantity and purchase unit costs.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddRow}
                  className="h-8 text-xs border-[#2d3139] text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product Line</span>
                </Button>
              </div>

              {/* Items Table Container */}
              <div className="rounded-xl border border-[#2d3139] bg-[#181a20] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#141519] border-b border-[#2d3139] text-slate-400 font-mono text-[11px]">
                        <th className="py-2.5 px-3 font-medium w-8 text-center">#</th>
                        <th className="py-2.5 px-3 font-medium min-w-[200px]">Product *</th>
                        <th className="py-2.5 px-3 font-medium min-w-[140px]">Variant</th>
                        <th className="py-2.5 px-3 font-medium w-28 text-right">Units *</th>
                        <th className="py-2.5 px-3 font-medium w-32 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 font-medium w-32 text-right">Line Total</th>
                        <th className="py-2.5 px-3 font-medium min-w-[140px]">Notes</th>
                        <th className="py-2.5 px-2 font-medium w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3139]/50">
                      {rows.map((row, index) => {
                        const parsedCost = parseFloat(row.unitCost);
                        const lineSubtotal = !isNaN(parsedCost) && parsedCost >= 0
                          ? parsedCost * (Number(row.quantity) || 0)
                          : null;

                        return (
                          <tr key={row.key} className="hover:bg-[#1f222a]/50 transition-colors">
                            {/* Row Number */}
                            <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                              {index + 1}
                            </td>

                            {/* Product Selector */}
                            <td className="py-3 px-3">
                              <SearchableSelect
                                value={row.productId}
                                onChange={(val) => handleSelectProduct(row.key, val)}
                                options={allSelectableProducts.map((p) => ({
                                  value: p.id,
                                  label: p.name,
                                  sublabel: p.sku || undefined,
                                }))}
                                placeholder="Select product..."
                                searchPlaceholder="Search product by name or SKU..."
                                required
                              />
                            </td>

                            {/* Variant Selector */}
                            <td className="py-3 px-3">
                              {row.hasVariants ? (
                                <SearchableSelect
                                  value={row.variantId}
                                  onChange={(val) => handleUpdateRow(row.key, { variantId: val })}
                                  options={row.variants.map((v) => {
                                    const label =
                                      v.name ||
                                      (v.attributes ? Object.values(v.attributes).join(' / ') : '') ||
                                      v.sku;
                                    return {
                                      value: v.id,
                                      label: label,
                                      sublabel: v.sku || undefined,
                                    };
                                  })}
                                  placeholder="Select variant..."
                                  searchPlaceholder="Search variant..."
                                  required
                                />
                              ) : (
                                <span className="text-[11px] text-slate-500 italic px-1">—</span>
                              )}
                            </td>

                            {/* Quantity Received */}
                            <td className="py-3 px-3">
                              <Input
                                type="number"
                                min="0.001"
                                step="any"
                                value={row.quantity}
                                onChange={(e) =>
                                  handleUpdateRow(row.key, { quantity: Number(e.target.value) })
                                }
                                className="h-8 text-right bg-[#141519] border-[#2d3139] text-xs text-white font-mono"
                                required
                              />
                            </td>

                            {/* Unit Cost */}
                            <td className="py-3 px-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Optional"
                                value={row.unitCost}
                                onChange={(e) =>
                                  handleUpdateRow(row.key, { unitCost: e.target.value })
                                }
                                className="h-8 text-right bg-[#141519] border-[#2d3139] text-xs text-slate-200 font-mono"
                              />
                            </td>

                            {/* Subtotal */}
                            <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                              {lineSubtotal !== null ? (
                                <span className="text-emerald-400">
                                  {lineSubtotal.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">—</span>
                              )}
                            </td>

                            {/* Row Notes */}
                            <td className="py-3 px-3">
                              <Input
                                type="text"
                                placeholder="e.g. Batch # / exp"
                                value={row.notes}
                                onChange={(e) =>
                                  handleUpdateRow(row.key, { notes: e.target.value })
                                }
                                className="h-8 bg-[#141519] border-[#2d3139] text-xs text-slate-300"
                              />
                            </td>

                            {/* Delete Line */}
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.key)}
                                disabled={rows.length <= 1}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 cursor-pointer"
                                title={rows.length <= 1 ? 'At least one line item required' : 'Remove line'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer with Add Row */}
                <div className="p-3 bg-[#141519] border-t border-[#2d3139] flex items-center justify-between">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleAddRow}
                    className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Product Line</span>
                  </Button>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-400">
                      Total Units:{' '}
                      <strong className="text-white font-semibold">{totalUnits.toLocaleString()}</strong>
                    </span>
                    {hasAnyCostEntered && (
                      <span className="text-slate-400">
                        Total Value:{' '}
                        <strong className="text-emerald-400 font-semibold">
                          {totalCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE INVENTORY IMPACT PREVIEW */}
            <div className="p-4 rounded-xl bg-[#181a20] border border-[#2d3139] space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Info className="w-4 h-4 text-[#fbb945]" />
                <span>Automated Ledger & Perpetual Inventory Impact</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Submitting this receipt creates immutable stock movement ledger entries with type{' '}
                <code className="text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-1 py-0.5 rounded">
                  RECEIPT
                </code>{' '}
                for each product line. The on-hand inventory balance will immediately increase by the quantities specified.
              </p>
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="px-6 py-4 border-t border-[#2d3139] bg-[#141519] flex items-center justify-between gap-4 shrink-0">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{rows.length} product lines</span>
              <span>•</span>
              <span className="font-semibold text-white font-mono">{totalUnits} units total</span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={triggerClose}
                disabled={isSubmitting}
                className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || rows.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 h-9 shadow-md flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recording Receipt...</span>
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-4 h-4" />
                    <span>Confirm & Receive Stock</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
