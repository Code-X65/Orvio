import * as React from 'react';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
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
  type CreateProductPayload,
  type UpdateProductPayload,
  type CreateVariantPayload,
} from '../products-api';
import { categoryApi, type CategoryTreeNode } from '../categories-api';
import { ProductForm } from './ProductForm';
import { ProductVariantForm } from './ProductVariantForm';
import { flattenCategoriesForSelection } from './CategoryForm';

interface ProductsPageProps {
  organization?: {
    id?: string;
    name?: string;
    currency?: string;
    business_type?: string;
  };
}

export function ProductsPage({ organization }: ProductsPageProps) {
  const currency = organization?.currency || 'NGN';

  // State
  const [products, setProducts] = React.useState<ProductListItem[]>([]);
  const [categories, setCategories] = React.useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
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

  // Delete Modal State
  const [productToDelete, setProductToDelete] = React.useState<ProductListItem | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = React.useState(false);

  // Copy feedback
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

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
        activeOnly: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        lowStock: lowStockFilter || undefined,
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
  }, [currentPage, searchQuery, selectedCategoryId, statusFilter, lowStockFilter]);

  // Initial load
  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
  const handleProductSubmit = async (data: CreateProductPayload | UpdateProductPayload) => {
    if (editingProduct) {
      await productApi.updateProduct(editingProduct.id, data as UpdateProductPayload);
      toast.success('Product updated successfully');
    } else {
      await productApi.createProduct(data as CreateProductPayload);
      toast.success('Product created successfully');
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

  // Variant submit handler
  const handleVariantSubmit = async (data: CreateVariantPayload) => {
    if (!variantTargetProduct) return;
    await productApi.createVariant(variantTargetProduct.id, data);
    toast.success('Variant added successfully');

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
      await productApi.deleteProduct(productToDelete.id);
      toast.success(`Product "${productToDelete.name}" archived successfully`);
      setProductToDelete(null);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete product');
    } finally {
      setIsDeletingProduct(false);
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
    (p) => p.track_quantity && p.available_stock <= p.low_stock_threshold
  ).length;
  const outOfStockCount = products.filter(
    (p) => p.track_quantity && p.available_stock <= 0
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
                    let stockBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.available_stock} in stock
                      </span>
                    );

                    if (!item.track_quantity) {
                      stockBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          Untracked
                        </span>
                      );
                    } else if (item.available_stock <= 0) {
                      stockBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Out of Stock
                        </span>
                      );
                    } else if (item.available_stock <= item.low_stock_threshold) {
                      stockBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Low: {item.available_stock} left
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
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{item.name}</span>
                              {item.has_variants && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal py-0 px-1.5 border-[#985184]/40 text-[#fbb945] bg-[#985184]/15"
                                >
                                  {item.variants_count > 0
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
                            {currency} {Number(item.selling_price).toLocaleString()}
                          </td>

                          {/* Stock Level */}
                          <td className="py-3 px-4 text-center">{stockBadge}</td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {item.is_active ? (
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
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2d3139]/40">
                                      {variants.map((v) => (
                                        <tr key={v.id} className="hover:bg-[#1a1b22]">
                                          <td className="py-2 px-3 font-medium text-slate-200">
                                            {v.name}
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
                                            {v.selling_price !== null && v.selling_price !== undefined
                                              ? `${currency} ${Number(v.selling_price).toLocaleString()}`
                                              : `${currency} ${Number(item.selling_price).toLocaleString()} (inherited)`}
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
          <div className="bg-[#181a20] border border-[#2d3139] rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-in zoom-in-95">
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
              {productToDelete.sku})?
            </p>
            <p className="text-[11px] text-slate-400 mt-2 bg-[#141519] p-3 rounded-lg border border-[#2d3139]">
              This product will be hidden from new sales and catalog lists, but all historical transactions and stock history will remain intact.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
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
                disabled={isDeletingProduct}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-medium flex items-center gap-1.5"
              >
                {isDeletingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Archive Product
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
