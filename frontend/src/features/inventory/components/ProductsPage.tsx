import * as React from 'react';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertOctagon,
  Loader2,
  Trash2,
  Edit2,
  Barcode,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Filter,
  Copy,
  Check,
  History,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  X,
  Eye,
  ImageIcon,
  Store,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import {
  productApi,
  type Product,
  type ProductListItem,
  type ProductVariant,
  type ProductPriceHistory,
  type ProductUsage,
  type CreateProductPayload,
  type UpdateProductPayload,
  type CreateVariantPayload,
} from '../products-api';
import { categoryApi, type CategoryTreeNode } from '../categories-api';
import { ProductForm } from './ProductForm';
import { ProductVariantForm } from './ProductVariantForm';
import { ProductGallery } from './ProductGallery';
import { VariantSwatchSelector } from './VariantSwatchSelector';
import type { UploadedImage } from '../../../components/ui/ImageUploader';
import { flattenCategoriesForSelection } from './CategoryForm';

function getVariantDisplayName(v: { name?: string; attributes?: Record<string, any>; sku?: string }): string {
  if (v.name) return v.name;
  if (v.attributes && Object.keys(v.attributes).length > 0) {
    return Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
  }
  return v.sku || 'Variant';
}

interface ProductsPageProps {
  organization?: {
    id?: string;
    name?: string;
    currency?: string;
    business_type?: string;
  };
  branchId?: string;
  branchName?: string;
  initialCategoryId?: string;
  onClearInitialCategory?: () => void;
}

export function ProductsPage({
  organization,
  branchId,
  branchName,
  initialCategoryId,
  onClearInitialCategory,
}: ProductsPageProps) {
  const currency = organization?.currency || 'NGN';

  // State
  const [products, setProducts] = React.useState<ProductListItem[]>([]);
  const [categories, setCategories] = React.useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>(
    initialCategoryId || 'all'
  );

  React.useEffect(() => {
    if (initialCategoryId) {
      setSelectedCategoryId(initialCategoryId);
      setCurrentPage(1);
    }
  }, [initialCategoryId]);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [lowStockFilter, setLowStockFilter] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Expanded product IDs for variants
  const [expandedProductIds, setExpandedProductIds] = React.useState<Set<string>>(new Set());
  const [productVariantsMap, setProductVariantsMap] = React.useState<
    Record<string, ProductVariant[]>
  >({});
  const [loadingVariantsMap, setLoadingVariantsMap] = React.useState<Record<string, boolean>>({});

  // Product Drawer State
  const [isProductDrawerOpen, setIsProductDrawerOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);

  // Variant Drawer State
  const [isVariantDrawerOpen, setIsVariantDrawerOpen] = React.useState(false);
  const [variantTargetProduct, setVariantTargetProduct] = React.useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = React.useState<ProductVariant | null>(null);

  // Delete Modal State & Stock Usage
  const [productToDelete, setProductToDelete] = React.useState<ProductListItem | null>(null);
  const [deleteUsage, setDeleteUsage] = React.useState<ProductUsage | null>(null);
  const [loadingDeleteUsage, setLoadingDeleteUsage] = React.useState(false);
  const [confirmWithStockChecked, setConfirmWithStockChecked] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState('');
  const [isDeletingProduct, setIsDeletingProduct] = React.useState(false);

  // Variant Delete Modal State
  const [variantToDelete, setVariantToDelete] = React.useState<{ product: ProductListItem; variant: ProductVariant } | null>(null);
  const [isDeletingVariant, setIsDeletingVariant] = React.useState(false);
  const [variantDeleteReason, setVariantDeleteReason] = React.useState('');
  const [confirmVariantWithStockChecked, setConfirmVariantWithStockChecked] = React.useState(false);

  // Price History Modal State
  const [historyProduct, setHistoryProduct] = React.useState<ProductListItem | null>(null);
  const [historyHeader, setHistoryHeader] = React.useState<{ title: string; subtitle: string } | null>(null);
  const [priceHistoryList, setPriceHistoryList] = React.useState<ProductPriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  // Copy feedback
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  // Product Visual Details & Gallery Modal State
  const [detailProduct, setDetailProduct] = React.useState<Product | null>(null);
  const [detailVariant, setDetailVariant] = React.useState<ProductVariant | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const handleOpenProductDetail = async (item: ProductListItem) => {
    try {
      setLoadingDetail(true);
      setIsDetailModalOpen(true);
      const res = await productApi.getProductById(item.id);
      setDetailProduct(res.product);
      setDetailVariant(null);
    } catch (err: any) {
      toast.error('Failed to load product details');
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Load Categories once
  const fetchCategories = React.useCallback(async () => {
    try {
      const res = await categoryApi.getCategories();
      setCategories(res.categories || []);
    } catch (err: any) {
      console.error('Failed to load categories for products page:', err);
    }
  }, []);

  // Fetch Products
  const fetchProducts = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await productApi.listProducts({
        page: currentPage,
        limit: 15,
        search: searchQuery.trim() || undefined,
        categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
        status: statusFilter,
        lowStock: lowStockFilter || undefined,
        branchId: branchId || undefined,
      });

      setProducts(res.products);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch products. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, selectedCategoryId, statusFilter, lowStockFilter, branchId]);

  // Reset page when branch changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [branchId]);

  // Initial load
  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch product usage when delete modal opens
  React.useEffect(() => {
    if (!productToDelete) {
      setDeleteUsage(null);
      setLoadingDeleteUsage(false);
      setConfirmWithStockChecked(false);
      setDeleteReason('');
      return;
    }

    let isMounted = true;
    setLoadingDeleteUsage(true);
    setConfirmWithStockChecked(false);
    setDeleteReason('');

    productApi
      .getProductUsage(productToDelete.id)
      .then((res) => {
        if (isMounted) {
          setDeleteUsage(res.usage);
        }
      })
      .catch((err) => {
        console.error('Failed to inspect product stock usage:', err);
        if (isMounted) {
          setDeleteUsage({
            totalOnHand: productToDelete.total_stock || 0,
            totalReserved: productToDelete.reserved_stock || 0,
            variantCount: productToDelete.variants_count || 0,
            hasReservedStock: (productToDelete.reserved_stock || 0) > 0,
            canDelete: (productToDelete.reserved_stock || 0) === 0,
            branchStock: [],
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingDeleteUsage(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productToDelete]);

  // Handle expanding a product row to view variants
  const toggleExpandProduct = async (product: ProductListItem) => {
    const next = new Set(expandedProductIds);
    if (next.has(product.id)) {
      next.delete(product.id);
      setExpandedProductIds(next);
      return;
    }

    next.add(product.id);
    setExpandedProductIds(next);

    // Fetch full product details including variants if not already cached
    if (!productVariantsMap[product.id]) {
      try {
        setLoadingVariantsMap((prev) => ({ ...prev, [product.id]: true }));
        const detail = await productApi.getProductById(product.id);
        setProductVariantsMap((prev) => ({
          ...prev,
          [product.id]: detail.product.variants || [],
        }));
      } catch (err: any) {
        toast.error(`Failed to load variants for ${product.name}`);
      } finally {
        setLoadingVariantsMap((prev) => ({ ...prev, [product.id]: false }));
      }
    }
  };

  // Create or Update Product submission
  const handleProductSubmit = async (
    data: CreateProductPayload | UpdateProductPayload,
    newFiles?: File[],
    reorderedImages?: UploadedImage[]
  ) => {
    let productId = editingProduct?.id;
    if (editingProduct) {
      await productApi.updateProduct(editingProduct.id, data as UpdateProductPayload);
      if (reorderedImages && reorderedImages.length > 0) {
        const reorderPayload = reorderedImages
          .filter((img) => Boolean(img.id))
          .map((img, index) => ({
            id: img.id as string,
            sortOrder: index,
            isPrimary: img.isPrimary,
          }));
        if (reorderPayload.length > 0) {
          await productApi.reorderProductImages(editingProduct.id, reorderPayload).catch(() => {});
        }
      }
      toast.success('Product updated successfully');
    } else {
      const createPayload: CreateProductPayload = {
        ...(data as CreateProductPayload),
        branchId: branchId || undefined,
      };
      const res = await productApi.createProduct(createPayload);
      productId = res.product.id;
      toast.success('Product created successfully');
    }

    if (productId && newFiles && newFiles.length > 0) {
      try {
        await productApi.uploadProductImages(productId, newFiles);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to upload some product images');
      }
    }
    await fetchProducts();
  };

  // Open edit drawer
  const handleEditProduct = async (item: ProductListItem) => {
    try {
      const res = await productApi.getProductById(item.id);
      setEditingProduct(res.product);
      setIsProductDrawerOpen(true);
    } catch (err: any) {
      toast.error('Failed to load product details');
    }
  };

  // Restore product handler
  const handleRestoreProduct = async (product: ProductListItem) => {
    try {
      await productApi.restoreProduct(product.id);
      toast.success(`Product "${product.name}" restored successfully`);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore product');
    }
  };

  // Open Add Variant drawer
  const handleOpenAddVariant = async (productItem: ProductListItem) => {
    try {
      const res = await productApi.getProductById(productItem.id);
      setVariantTargetProduct(res.product);
      setEditingVariant(null);
      setIsVariantDrawerOpen(true);
    } catch (err: any) {
      toast.error('Failed to prepare variant form');
    }
  };

  // Open Edit Variant drawer
  const handleOpenEditVariant = async (productItem: ProductListItem, variant: ProductVariant) => {
    try {
      const res = await productApi.getProductById(productItem.id);
      setVariantTargetProduct(res.product);
      setEditingVariant(variant);
      setIsVariantDrawerOpen(true);
    } catch (err: any) {
      toast.error('Failed to prepare variant form for editing');
    }
  };

  // Variant submit handler (Create or Update)
  const handleVariantSubmit = async (
    data: CreateVariantPayload,
    newFiles?: File[],
    _reorderedImages?: UploadedImage[]
  ) => {
    if (!variantTargetProduct) return;
    let variantId = editingVariant?.id;
    if (editingVariant) {
      await productApi.updateVariant(variantTargetProduct.id, editingVariant.id, {
        sku: data.sku,
        barcode: data.barcode,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        compareAtPrice: data.compareAtPrice,
        attributes: data.attributes,
        isActive: data.isActive,
        priceChangeReason: data.priceChangeReason,
      });
      toast.success('Variant updated successfully');
    } else {
      const createPayload: CreateVariantPayload = {
        ...(data as CreateVariantPayload),
        branchId: branchId || undefined,
      };
      const vRes = await productApi.createVariant(variantTargetProduct.id, createPayload);
      variantId = vRes.variant.id;
      toast.success('Variant added successfully');
    }

    if (variantId && newFiles && newFiles.length > 0) {
      try {
        await productApi.uploadVariantImages(variantTargetProduct.id, variantId, newFiles);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to upload some variant images');
      }
    }

    // Refresh variants for this product
    const updated = await productApi.getProductById(variantTargetProduct.id);
    setProductVariantsMap((prev) => ({
      ...prev,
      [variantTargetProduct.id]: updated.product.variants || [],
    }));

    // Ensure expanded
    setExpandedProductIds((prev) => new Set([...prev, variantTargetProduct.id]));
    await fetchProducts();
  };

  // Delete product handler (soft delete)
  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeletingProduct(true);
      await productApi.deleteProduct(productToDelete.id, {
        confirmWithStock: confirmWithStockChecked,
        reason: deleteReason.trim() || undefined,
      });
      toast.success(`Product "${productToDelete.name}" archived successfully`);
      setProductToDelete(null);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete product');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Delete variant handler (soft delete)
  const confirmDeleteVariant = async () => {
    if (!variantToDelete) return;
    try {
      setIsDeletingVariant(true);
      await productApi.deleteVariant(variantToDelete.product.id, variantToDelete.variant.id, {
        confirmWithStock: confirmVariantWithStockChecked,
        reason: variantDeleteReason.trim() || undefined,
      });
      toast.success(`Variant "${getVariantDisplayName(variantToDelete.variant)}" archived successfully`);

      const updated = await productApi.getProductById(variantToDelete.product.id);
      setProductVariantsMap((prev) => ({
        ...prev,
        [variantToDelete.product.id]: updated.product.variants || [],
      }));
      setVariantToDelete(null);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to archive variant');
    } finally {
      setIsDeletingVariant(false);
    }
  };

  // View product price history handler
  const handleViewPriceHistory = async (product: ProductListItem) => {
    setHistoryHeader({
      title: 'Price Revision History',
      subtitle: `${product.name} (SKU: ${product.sku})`,
    });
    setHistoryProduct(product);
    setLoadingHistory(true);
    try {
      const res = await productApi.getPriceHistory(product.id);
      setPriceHistoryList(res.history || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load price revision history');
      setPriceHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // View variant price history handler
  const handleViewVariantPriceHistory = async (product: ProductListItem, variant: ProductVariant) => {
    setHistoryHeader({
      title: `Price History: ${getVariantDisplayName(variant)}`,
      subtitle: `${product.name} (Variant SKU: ${variant.sku})`,
    });
    setHistoryProduct(product);
    setLoadingHistory(true);
    try {
      const res = await productApi.getVariantPriceHistory(product.id, variant.id);
      setPriceHistoryList(res.history || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load variant price revision history');
      setPriceHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Stats calculation
  const lowStockCount = products.filter(
    (p) => p.track_quantity && (p.available_stock ?? 0) <= p.low_stock_threshold
  ).length;
  const outOfStockCount = products.filter(
    (p) => p.track_quantity && (p.available_stock ?? 0) <= 0
  ).length;
  const activeCount = products.filter((p) => p.is_active).length;

  const categoryOptions = flattenCategoriesForSelection(categories);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141519] text-slate-100 overflow-y-auto">
      {/* Top Header */}
      <div className="border-b border-[#2d3139] bg-[#181a20]/95 backdrop-blur-md px-6 py-5 sticky top-0 z-20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-[#985184]/20 border border-[#985184]/30 flex items-center justify-center text-[#985184]">
                <Package className="w-4 h-4 text-[#fbb945]" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Product Catalog
              </h1>
              <Badge
                variant="outline"
                className="bg-[#252830] border-[#363a45] text-slate-300 text-xs font-normal"
              >
                {totalCount} Items
              </Badge>
              <Badge
                variant="outline"
                className="bg-[#252830] border-[#363a45] text-[#fbb945] text-xs font-medium flex items-center gap-1.5 px-2 py-0.5"
              >
                <Store className="w-3 h-3 text-[#fbb945]" />
                <span>{branchName || (branchId ? 'Selected Branch' : 'All Branches')}</span>
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage product SKUs, pricing, stock levels, variants, and barcodes
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProducts}
              disabled={loading}
              className="border-[#2d3139] bg-[#181a20] text-slate-300 hover:text-white hover:bg-[#252830] text-xs h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setEditingProduct(null);
                setIsProductDrawerOpen(true);
              }}
              className="bg-[#985184] hover:bg-[#985184]/90 text-white font-medium text-xs h-9 px-3.5 shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#2d3139]/60">
          <div className="bg-[#141519] border border-[#2d3139] rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 font-medium">Total Products</div>
            <div className="text-lg font-bold text-white mt-0.5">{totalCount}</div>
          </div>
          <div className="bg-[#141519] border border-[#2d3139] rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 font-medium">Active Items</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{activeCount}</div>
          </div>
          <div
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`border rounded-lg p-2.5 cursor-pointer transition-colors ${
              lowStockFilter
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-[#141519] border-[#2d3139] hover:border-amber-500/30'
            }`}
          >
            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Low Stock</span>
              {lowStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{lowStockCount}</div>
          </div>
          <div className="bg-[#141519] border border-[#2d3139] rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 font-medium">Out of Stock</div>
            <div className="text-lg font-bold text-rose-400 mt-0.5">{outOfStockCount}</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mt-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#121316] border-[#2d3139] pl-9 text-xs text-white placeholder:text-slate-500 h-9 focus:border-[#985184]"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-56 shrink-0">
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#121316] border border-[#2d3139] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#985184] h-9 transition-colors"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full bg-[#121316] border border-[#2d3139] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#985184] h-9 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Low Stock Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLowStockFilter(!lowStockFilter);
              setCurrentPage(1);
            }}
            className={`text-xs h-9 shrink-0 transition-colors ${
              lowStockFilter
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'border-[#2d3139] bg-[#121316] text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Low Stock Only
          </Button>
        </div>
      </div>

      {/* Active Category Filter Banner */}
      {selectedCategoryId !== 'all' && (
        <div className="px-6 pt-3 pb-1">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#985184]/15 border border-[#985184]/30 rounded-md text-xs text-white">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Filtered by category:</span>
              <span className="font-semibold text-[#fbb945] bg-black/40 px-2 py-0.5 rounded-sm border border-white/5">
                {categoryOptions.find((c) => c.id === selectedCategoryId)?.label || selectedCategoryId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId('all');
                onClearInitialCategory?.();
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer px-2 py-1 rounded-sm hover:bg-white/10 transition-colors"
              title="Clear category filter"
              data-testid="clear-category-filter-btn"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear category filter</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6">
        {loading && products.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-[#985184] animate-spin" />
            <p className="text-xs">Loading product catalog...</p>
          </div>
        ) : error ? (
          <div className="py-16 bg-rose-500/5 border border-rose-500/20 rounded-xl p-6 text-center max-w-md mx-auto">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-rose-300">Failed to Load Products</h3>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
            <Button
              size="sm"
              onClick={fetchProducts}
              className="mt-4 bg-[#985184] hover:bg-[#985184]/90 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 bg-[#181a20]/60 border border-[#2d3139] rounded-xl flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-[#252830] flex items-center justify-center text-slate-400 mb-3">
              <Package className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-white">No products found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {searchQuery || selectedCategoryId !== 'all' || lowStockFilter
                ? 'Try adjusting your search filters or clearing the criteria.'
                : 'Get started by creating your first inventory product catalog item.'}
            </p>
            <Button
              onClick={() => {
                setEditingProduct(null);
                setIsProductDrawerOpen(true);
              }}
              className="mt-4 bg-[#985184] hover:bg-[#985184]/90 text-white text-xs h-8 px-4"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Product
            </Button>
          </div>
        ) : (
          <div className="border border-[#2d3139] rounded-xl overflow-hidden bg-[#181a20] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2d3139] bg-[#141519]/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">SKU / Barcode</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Stock Level</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3139]/60">
                  {products.map((item) => {
                    const isExpanded = expandedProductIds.has(item.id);
                    const variants = productVariantsMap[item.id] || [];
                    const isLoadingVariants = loadingVariantsMap[item.id];

                    // Stock health logic
                    const availableStock = item.available_stock ?? 0;
                    let stockBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {availableStock} in stock
                      </span>
                    );

                    if (!item.track_quantity) {
                      stockBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          Untracked
                        </span>
                      );
                    } else if (availableStock <= 0) {
                      stockBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Out of Stock
                        </span>
                      );
                    } else if (availableStock <= item.low_stock_threshold) {
                      stockBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Low: {availableStock} left
                        </span>
                      );
                    }

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`hover:bg-[#202229] transition-colors group ${
                            isExpanded ? 'bg-[#1d1f26]' : ''
                          }`}
                        >
                          {/* Expand chevron column */}
                          <td className="py-3 px-4 text-center">
                            {item.has_variants ? (
                              <button
                                type="button"
                                onClick={() => toggleExpandProduct(item)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#2a2d36] transition-colors"
                                title={isExpanded ? 'Collapse variants' : 'Expand variants'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-[#fbb945]" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block w-4" />
                            )}
                          </td>

                          {/* Product Name & Details */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {/* Product Thumbnail */}
                              <button
                                type="button"
                                onClick={() => handleOpenProductDetail(item)}
                                className="w-10 h-10 rounded-lg bg-[#141519] border border-[#2d3139] overflow-hidden shrink-0 flex items-center justify-center relative group hover:border-[#985184] transition-colors cursor-pointer"
                                title="View gallery & details"
                              >
                                {item.primary_image_url || item.image_url ? (
                                  <img
                                    src={(item.primary_image_url || item.image_url) ?? undefined}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-500 group-hover:text-slate-400" />
                                )}
                              </button>
                              <div>
                                <div className="font-semibold text-white flex items-center gap-2">
                                  <span
                                    onClick={() => handleOpenProductDetail(item)}
                                    className="cursor-pointer hover:text-[#fbb945] transition-colors"
                                  >
                                    {item.name}
                                  </span>
                                  {item.has_variants && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-normal py-0 px-1.5 border-[#985184]/40 text-[#fbb945] bg-[#985184]/15"
                                    >
                                      {(item.variants_count ?? 0) > 0
                                        ? `${item.variants_count} variants`
                                        : 'Template'}
                                    </Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  Unit: {item.unit_of_measure}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* SKU & Barcode */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-200 text-xs">{item.sku}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.sku)}
                                className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy SKU"
                              >
                                {copiedText === item.sku ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {item.barcode && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono mt-0.5">
                                <Barcode className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{item.barcode}</span>
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-3 px-4">
                            {item.category_name ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#252830] text-slate-300 border border-[#363a45]">
                                {item.category_name}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                            )}
                          </td>

                          {/* Cost Price */}
                          <td className="py-3 px-4 text-right font-medium text-slate-300">
                            {currency} {Number(item.cost_price).toLocaleString()}
                          </td>

                          {/* Selling Price */}
                          <td className="py-3 px-4 text-right font-semibold text-white">
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5 font-semibold text-white">
                                <span>{currency} {Number(item.selling_price).toLocaleString()}</span>
                                {item.compare_at_price && Number(item.compare_at_price) > Number(item.selling_price) && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    -{Math.round(((Number(item.compare_at_price) - Number(item.selling_price)) / Number(item.compare_at_price)) * 100)}%
                                  </span>
                                )}
                              </div>
                              {item.compare_at_price && Number(item.compare_at_price) > Number(item.selling_price) && (
                                <span className="text-[10px] text-slate-400 line-through">
                                  {currency} {Number(item.compare_at_price).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Stock Level */}
                          <td className="py-3 px-4 text-center">{stockBadge}</td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {item.is_deleted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                                <XCircle className="w-3 h-3 text-rose-400" /> Archived
                              </span>
                            ) : item.is_active ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <XCircle className="w-3 h-3" /> Inactive
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.is_deleted ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreProduct(item)}
                                  className="h-7 px-2.5 text-xs text-emerald-400 hover:text-white hover:bg-emerald-500/20 border border-emerald-500/30"
                                  title="Restore product to active catalog"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                  Restore
                                </Button>
                              ) : (
                                <>
                                  {item.has_variants && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenAddVariant(item)}
                                      className="h-7 px-2 text-[11px] text-[#fbb945] hover:text-white hover:bg-[#2d3139]"
                                      title="Add Variant"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Variant
                                    </Button>
                                  )}
                                   <button
                                    type="button"
                                    onClick={() => handleOpenProductDetail(item)}
                                    className="p-1.5 text-slate-400 hover:text-[#985184] hover:bg-[#2d3139] rounded transition-colors"
                                    title="View gallery and details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleViewPriceHistory(item)}
                                    className="p-1.5 text-slate-400 hover:text-[#fbb945] hover:bg-[#2d3139] rounded transition-colors"
                                    title="View price revision history"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEditProduct(item)}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2d3139] rounded transition-colors"
                                    title="Edit product"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProductToDelete(item)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                    title="Archive product"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Variants Sub-Row */}
                        {isExpanded && item.has_variants && (
                          <tr className="bg-[#15161b] border-t border-b border-[#2d3139]">
                            <td colSpan={9} className="py-3 px-8">
                              <div className="bg-[#121316] border border-[#2d3139] rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-[#fbb945]" />
                                    <span className="text-xs font-semibold text-slate-200">
                                      Variants for {item.name}
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenAddVariant(item)}
                                    className="h-7 text-xs border-[#2d3139] text-[#fbb945] hover:bg-[#252830]"
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add Variant
                                  </Button>
                                </div>

                                {isLoadingVariants ? (
                                  <div className="py-4 flex items-center justify-center text-slate-400 text-xs gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#985184]" />
                                    Loading variants...
                                  </div>
                                ) : variants.length === 0 ? (
                                  <div className="py-4 text-center text-slate-400 text-xs">
                                    No variants created yet. Click "Add Variant" to create options (size, color, etc.).
                                  </div>
                                ) : (
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-[#2d3139] text-slate-500 text-[10px] uppercase font-semibold">
                                        <th className="py-2 px-3">Variant Name</th>
                                        <th className="py-2 px-3">SKU</th>
                                        <th className="py-2 px-3">Attributes</th>
                                        <th className="py-2 px-3 text-right">Cost Price</th>
                                        <th className="py-2 px-3 text-right">Selling Price</th>
                                        <th className="py-2 px-3 text-center">Status</th>
                                        <th className="py-2 px-3 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2d3139]/40">
                                      {variants.map((v) => (
                                        <tr key={v.id} className="hover:bg-[#1a1b22]">
                                          <td className="py-2 px-3 font-medium text-slate-200">
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded bg-[#202229] border border-[#2d3139] overflow-hidden shrink-0 flex items-center justify-center">
                                                {v.images && v.images.length > 0 && (v.images[0].thumbnail_200 || v.images[0].url) ? (
                                                  <img
                                                    src={v.images[0].thumbnail_200 || v.images[0].url}
                                                    alt={getVariantDisplayName(v)}
                                                    className="w-full h-full object-cover"
                                                  />
                                                ) : item.primary_image_url || item.image_url ? (
                                                  <img
                                                    src={(item.primary_image_url || item.image_url) ?? undefined}
                                                    alt={getVariantDisplayName(v)}
                                                    className="w-full h-full object-cover opacity-60"
                                                    title="Inherited product photo"
                                                  />
                                                ) : (
                                                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                                                )}
                                              </div>
                                              <span>{getVariantDisplayName(v)}</span>
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 font-mono text-slate-300">
                                            {v.sku}
                                          </td>
                                          <td className="py-2 px-3">
                                            <div className="flex flex-wrap gap-1">
                                              {v.attributes &&
                                                Object.entries(v.attributes).map(
                                                  ([k, val]) => (
                                                    <span
                                                      key={k}
                                                      className="px-1.5 py-0.5 rounded bg-[#202229] border border-[#2d3139] text-[10px] text-slate-300"
                                                    >
                                                      {k}: {String(val)}
                                                    </span>
                                                  )
                                                )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-right text-slate-400">
                                            {v.cost_price !== null && v.cost_price !== undefined
                                              ? `${currency} ${Number(v.cost_price).toLocaleString()}`
                                              : `${currency} ${Number(item.cost_price).toLocaleString()} (inherited)`}
                                          </td>
                                          <td className="py-2 px-3 text-right font-semibold text-slate-200">
                                            <div className="flex flex-col items-end">
                                              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                                                <span>
                                                  {v.selling_price !== null && v.selling_price !== undefined
                                                    ? `${currency} ${Number(v.selling_price).toLocaleString()}`
                                                    : `${currency} ${Number(item.selling_price).toLocaleString()} (inherited)`}
                                                </span>
                                                {v.compare_at_price && Number(v.compare_at_price) > Number(v.selling_price) && (
                                                  <span className="text-[9px] font-medium px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                    -{Math.round(((Number(v.compare_at_price) - Number(v.selling_price)) / Number(v.compare_at_price)) * 100)}%
                                                  </span>
                                                )}
                                              </div>
                                              {v.compare_at_price && Number(v.compare_at_price) > Number(v.selling_price) && (
                                                <span className="text-[10px] text-slate-500 line-through">
                                                  {currency} {Number(v.compare_at_price).toLocaleString()}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {v.is_active ? (
                                              <span className="text-[10px] text-emerald-400">
                                                Active
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-slate-500">
                                                Inactive
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                              <button
                                                type="button"
                                                onClick={() => handleViewVariantPriceHistory(item, v)}
                                                className="p-1 text-slate-400 hover:text-[#fbb945] hover:bg-[#252830] rounded transition-colors"
                                                title="View variant price revision history"
                                              >
                                                <History className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleOpenEditVariant(item, v)}
                                                className="p-1 text-slate-400 hover:text-white hover:bg-[#252830] rounded transition-colors"
                                                title="Edit variant"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setVariantToDelete({ product: item, variant: v });
                                                  setVariantDeleteReason('');
                                                  setConfirmVariantWithStockChecked(false);
                                                }}
                                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                                title="Archive variant"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#2d3139] bg-[#141519] flex items-center justify-between text-xs text-slate-400">
                <div>
                  Showing Page <span className="text-white font-medium">{currentPage}</span> of{' '}
                  <span className="text-white font-medium">{totalPages}</span> ({totalCount} items)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="border-[#2d3139] text-slate-300 h-8 text-xs hover:bg-[#252830]"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="border-[#2d3139] text-slate-300 h-8 text-xs hover:bg-[#252830]"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over Product Form Drawer */}
      <ProductForm
        isOpen={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
        onSubmit={handleProductSubmit}
        editingProduct={editingProduct}
        categories={categories}
        currency={currency}
        businessType={organization?.business_type}
      />

      {/* Slide-over Product Variant Drawer */}
      <ProductVariantForm
        isOpen={isVariantDrawerOpen}
        onClose={() => setIsVariantDrawerOpen(false)}
        onSubmit={handleVariantSubmit}
        parentProduct={variantTargetProduct}
        editingVariant={editingVariant}
        currency={currency}
      />

      {/* Soft-Delete Confirmation Modal */}
      {productToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181a20] border border-[#2d3139] rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Archive Product</h3>
                <p className="text-xs text-slate-400">Soft deletion preserves sales integrity</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to archive{' '}
              <strong className="text-white font-semibold">"{productToDelete.name}"</strong> (SKU:{' '}
              <span className="font-mono text-[#fbb945]">{productToDelete.sku}</span>)?
            </p>

            {/* Loading stock inspection */}
            {loadingDeleteUsage ? (
              <div className="my-4 p-4 rounded-lg bg-[#141519] border border-[#2d3139] flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#985184]" />
                <span>Checking branch stock levels & reservations...</span>
              </div>
            ) : deleteUsage?.hasReservedStock ? (
              /* State 1: Active Reserved Stock (Strict Block) */
              <div className="my-4 p-3.5 rounded-lg bg-rose-950/30 border border-rose-500/30 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                  <span>Cannot Archive: Active Reserved Stock</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  This product has <strong className="text-rose-400 font-semibold">{deleteUsage.totalReserved} reserved unit(s)</strong> across pending customer orders or branch transfers. Outstanding orders must be fulfilled or cancelled before archiving.
                </p>
                {deleteUsage.branchStock.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-rose-500/20 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Branch Reservations</span>
                    {deleteUsage.branchStock.map((b) => (
                      <div key={b.branchId} className="flex justify-between text-[11px]">
                        <span className="text-slate-300">{b.branchName}</span>
                        <span className="font-mono text-rose-300">{b.reserved} reserved ({b.onHand} on hand)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (deleteUsage?.totalOnHand ?? 0) > 0 ? (
              /* State 2: Stock on hand > 0 (Amber Alert + Checkbox + Mandatory Reason) */
              <div className="my-4 space-y-3">
                <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Active Stock Detected</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    This product currently holds <strong className="text-amber-400 font-semibold">{deleteUsage?.totalOnHand} unit(s)</strong> on hand across branches
                    {deleteUsage?.variantCount ? ` across ${deleteUsage.variantCount} variant(s)` : ''}.
                  </p>
                  {deleteUsage?.branchStock && deleteUsage.branchStock.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Branch Stock Breakdown</span>
                      {deleteUsage.branchStock.map((b) => (
                        <div key={b.branchId} className="flex justify-between text-[11px]">
                          <span className="text-slate-300">{b.branchName}</span>
                          <span className="font-mono text-amber-300">{b.onHand} on hand</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#141519] border border-[#2d3139] cursor-pointer hover:border-slate-600 transition-colors">
                  <input
                    type="checkbox"
                    checked={confirmWithStockChecked}
                    onChange={(e) => setConfirmWithStockChecked(e.target.checked)}
                    className="mt-0.5 rounded border-[#2d3139] text-[#985184] focus:ring-[#985184] bg-[#1c1e24]"
                    data-testid="confirm-stock-checkbox"
                  />
                  <span className="text-xs text-slate-300">
                    I understand there are <strong className="text-white">{deleteUsage?.totalOnHand} units</strong> in stock and confirm archiving this product.
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    <span>Reason for archiving <span className="text-rose-400">*</span></span>
                    <span className="text-[10px] text-slate-500">Required</span>
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Provide a clear operational reason (e.g., Discontinued, damaged batch write-off)..."
                    rows={2}
                    className="w-full bg-[#141519] border border-[#2d3139] rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:border-[#985184]"
                    data-testid="archive-product-reason-input"
                  />
                </div>
              </div>
            ) : (
              /* State 3: Clean (0 stock) */
              <div className="my-4 space-y-3">
                <div className="p-3 rounded-lg bg-[#141519] border border-[#2d3139] text-[11px] text-slate-400 leading-relaxed">
                  No active stock units detected across branches. This product will be hidden from catalog lists and POS terminals, but historical transaction records remain intact.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                    <span>Archive note / reason</span>
                    <span className="text-[10px] text-slate-500">Optional</span>
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Optional note for audit records..."
                    rows={2}
                    className="w-full bg-[#141519] border border-[#2d3139] rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:border-[#985184]"
                    data-testid="archive-product-reason-input"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-[#2d3139]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductToDelete(null)}
                disabled={isDeletingProduct}
                className="border-[#2d3139] text-slate-300 hover:bg-[#252830] text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmDeleteProduct}
                disabled={
                  isDeletingProduct ||
                  loadingDeleteUsage ||
                  (deleteUsage?.hasReservedStock ?? false) ||
                  ((deleteUsage?.totalOnHand ?? 0) > 0 &&
                    (!confirmWithStockChecked || !deleteReason.trim()))
                }
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="confirm-archive-product-btn"
              >
                {isDeletingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Archive Product
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Price Revision History Modal */}
      {historyProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181a20] border border-[#2d3139] rounded-xl max-w-xl w-full p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#2d3139]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#985184]/20 border border-[#985184]/30 flex items-center justify-center text-[#fbb945]">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{historyHeader?.title || 'Price Revision History'}</span>
                    <Badge variant="outline" className="bg-[#202229] border-[#2d3139] text-xs font-mono text-[#fbb945]">
                      {historyProduct.sku}
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{historyHeader?.subtitle || historyProduct.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryProduct(null);
                  setHistoryHeader(null);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#252830] transition-colors"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 flex-1 space-y-3 pr-1">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#985184]" />
                  <p className="text-xs">Loading price revision logs...</p>
                </div>
              ) : priceHistoryList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#202229] flex items-center justify-center text-slate-500 mb-2">
                    <History className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-300">No price adjustments recorded yet</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                    Any modifications to cost price or selling price will automatically create an audit record here with justifications.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {priceHistoryList.map((entry) => {
                    const oldCost = Number(entry.old_cost_price);
                    const newCost = Number(entry.new_cost_price);
                    const oldSelling = Number(entry.old_selling_price);
                    const newSelling = Number(entry.new_selling_price);

                    const oldMargin = oldSelling > 0 ? (((oldSelling - oldCost) / oldSelling) * 100).toFixed(1) : '0';
                    const newMargin = newSelling > 0 ? (((newSelling - newCost) / newSelling) * 100).toFixed(1) : '0';
                    const marginDelta = (Number(newMargin) - Number(oldMargin)).toFixed(1);

                    return (
                      <div
                        key={entry.id}
                        className="bg-[#141519] border border-[#2d3139] rounded-lg p-3.5 space-y-2.5 text-xs hover:border-[#383d47] transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-slate-300">
                            {new Date(entry.created_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#252830] text-slate-400 border border-[#2d3139]">
                            Audit Log
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {/* Cost price change */}
                          <div className="bg-[#181a20] p-2.5 rounded border border-[#2d3139]">
                            <div className="text-[10px] text-slate-400 font-medium">Cost Price</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="line-through text-slate-400 font-medium">
                                {currency} {oldCost.toLocaleString()}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="font-bold text-white">
                                {currency} {newCost.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Selling price change */}
                          <div className="bg-[#181a20] p-2.5 rounded border border-[#2d3139]">
                            <div className="text-[10px] text-slate-400 font-medium">Selling Price</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="line-through text-slate-400 font-medium">
                                {currency} {oldSelling.toLocaleString()}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="font-bold text-emerald-400">
                                {currency} {newSelling.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Margin & Profit Delta */}
                        <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-[#fbb945]" />
                            <span>Margin Shift:</span>
                            <span className="text-slate-300 font-medium">{oldMargin}%</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className={`font-semibold ${Number(marginDelta) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {newMargin}% ({Number(marginDelta) >= 0 ? `+${marginDelta}%` : `${marginDelta}%`})
                            </span>
                          </div>
                        </div>

                        {/* Reason justification */}
                        {entry.reason && (
                          <div className="mt-1 bg-[#1c1e24] border border-[#2d3139] p-2 rounded text-[11px] text-slate-300">
                            <span className="text-slate-400 font-medium mr-1.5">Reason:</span>
                            <span className="italic">"{entry.reason}"</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#2d3139] flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setHistoryProduct(null);
                  setHistoryHeader(null);
                }}
                className="bg-[#252830] hover:bg-[#2d3139] text-white text-xs h-8 px-4"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Archive Confirmation Modal */}
      {variantToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181a20] border border-[#2d3139] rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Archive Variant</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to archive variant{' '}
                  <span className="font-semibold text-slate-200">"{getVariantDisplayName(variantToDelete.variant)}"</span> (SKU:{' '}
                  <span className="font-mono text-slate-300">{variantToDelete.variant.sku}</span>) for product{' '}
                  <span className="font-medium text-slate-200">"{variantToDelete.product.name}"</span>?
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Reason for archiving <span className="text-slate-500 font-normal">(optional unless stock exists)</span>
                </label>
                <Input
                  placeholder="e.g. Discontinued variant option, supplier retired SKU"
                  value={variantDeleteReason}
                  onChange={(e) => setVariantDeleteReason(e.target.value)}
                  className="bg-[#141519] border-[#2d3139] text-xs h-9 text-slate-200 placeholder:text-slate-500"
                />
              </div>

              <div className="bg-[#141519] border border-[#2d3139] p-3 rounded-lg flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="confirmVariantStock"
                  checked={confirmVariantWithStockChecked}
                  onChange={(e) => setConfirmVariantWithStockChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 bg-slate-800 text-[#985184] focus:ring-[#985184]"
                />
                <label htmlFor="confirmVariantStock" className="text-xs text-slate-300 cursor-pointer select-none">
                  Confirm archiving even if active inventory exists for this variant
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVariantToDelete(null)}
                className="border-[#2d3139] text-slate-300 hover:text-white"
                disabled={isDeletingVariant}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmDeleteVariant}
                disabled={isDeletingVariant}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs h-9 px-4"
              >
                {isDeletingVariant ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Archiving...
                  </>
                ) : (
                  'Archive Variant'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Visual Details & Gallery Modal */}
      {isDetailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#181a20] border border-[#2d3139] rounded-2xl max-w-4xl w-full p-6 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
            {loadingDetail || !detailProduct ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-[#985184]" />
                <span className="text-sm font-medium">Loading product visuals & gallery...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-[#2d3139] pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        {detailProduct.name}
                      </h2>
                      {detailProduct.category_name && (
                        <Badge
                          variant="outline"
                          className="border-[#2d3139] text-slate-300 bg-[#141519] text-xs font-normal"
                        >
                          {detailProduct.category_name}
                        </Badge>
                      )}
                      {detailProduct.is_active ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500/15 text-slate-400 border border-slate-500/30 text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 font-mono">
                      <span>SKU: {detailProduct.sku}</span>
                      {detailProduct.barcode && <span>Barcode: {detailProduct.barcode}</span>}
                      <span>Unit: {detailProduct.unit_of_measure}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#252830] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {/* Left Column: Visual Gallery */}
                  <div>
                    <ProductGallery
                      images={detailProduct.images || []}
                      productName={detailProduct.name}
                      variantImages={detailVariant?.images}
                      onSelectVariant={setDetailVariant}
                      thumbnailPosition="bottom"
                    />
                  </div>

                  {/* Right Column: Pricing, Attributes, Swatches */}
                  <div className="space-y-5">
                    {/* Variant Swatch Selector if variants exist */}
                    {detailProduct.has_variants && (detailProduct.variants?.length ?? 0) > 0 && (
                      <div className="p-4 rounded-xl bg-[#141519] border border-[#2d3139] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Choose Variation
                          </span>
                          {detailVariant && (
                            <button
                              type="button"
                              onClick={() => setDetailVariant(null)}
                              className="text-[11px] text-[#985184] hover:underline"
                            >
                              Reset to all
                            </button>
                          )}
                        </div>
                        <VariantSwatchSelector
                          variants={detailProduct.variants || []}
                          parentImages={detailProduct.images || []}
                          selectedVariant={detailVariant}
                          onSelectVariant={setDetailVariant}
                          swatchType="auto"
                        />
                      </div>
                    )}

                    {/* Pricing summary */}
                    <div className="p-4 rounded-xl bg-[#141519] border border-[#2d3139] space-y-3">
                      <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Pricing & Margins {detailVariant ? `(${getVariantDisplayName(detailVariant)})` : ''}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Selling Price</span>
                          <span className="text-lg font-bold text-white font-mono">
                            {currency}{' '}
                            {Number(
                              detailVariant?.selling_price ?? detailProduct.selling_price
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Cost Price</span>
                          <span className="text-lg font-medium text-slate-300 font-mono">
                            {currency}{' '}
                            {Number(
                              detailVariant?.cost_price ?? detailProduct.cost_price
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {detailProduct.description && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-slate-300">Description</span>
                        <p className="text-xs text-slate-400 leading-relaxed bg-[#141519] p-3 rounded-lg border border-[#2d3139]">
                          {detailProduct.description}
                        </p>
                      </div>
                    )}

                    {/* Quick Action Footer */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          handleEditProduct(detailProduct);
                        }}
                        className="border-[#2d3139] text-slate-200 hover:text-white text-xs h-9"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Edit Product
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIsDetailModalOpen(false)}
                        className="bg-[#985184] hover:bg-[#985184]/90 text-white text-xs h-9 px-4 font-medium"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
