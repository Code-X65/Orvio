import * as React from 'react';
import {
  Search,
  X,
  Package,
  FolderTree,
  Award,
  Layers,
  ArrowRight,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { productApi } from '../products-api';
import { categoryApi, type CategoryTreeNode } from '../categories-api';
import { brandApi, type Brand } from '../brands-api';

export interface CatalogSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
  onSelectProduct?: (productId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
  onSelectBrand?: (brandId: string) => void;
}

type SearchResultItem =
  | {
      type: 'product';
      id: string;
      title: string;
      subtitle: string;
      price?: number;
      stock?: number;
      badge?: string;
    }
  | {
      type: 'category';
      id: string;
      title: string;
      subtitle: string;
      productCount?: number;
    }
  | {
      type: 'brand';
      id: string;
      title: string;
      subtitle: string;
      productCount?: number;
    };

function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  let list: CategoryTreeNode[] = [];
  for (const node of nodes) {
    list.push(node);
    if (node.children && node.children.length > 0) {
      list = list.concat(flattenCategoryTree(node.children));
    }
  }
  return list;
}

export function CatalogSearchModal({
  isOpen,
  onClose,
  branchId,
  onSelectProduct,
  onSelectCategory,
  onSelectBrand,
}: CatalogSearchModalProps) {
  const [query, setQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Focus input on open and reset state
  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const [productsRes, categoriesRes, brandsRes] = await Promise.all([
          productApi.searchProducts(trimmed, branchId === 'all' ? undefined : branchId).catch(() => ({ results: [] })),
          categoryApi.getCategories({ branchId: branchId === 'all' ? undefined : branchId }).catch(() => ({ categories: [] })),
          brandApi.getBrands({ search: trimmed, branchId: branchId === 'all' ? undefined : branchId, limit: 5 }).catch(() => ({ brands: [] })),
        ]);

        const items: SearchResultItem[] = [];

        // 1. Products
        if (productsRes?.results) {
          for (const p of productsRes.results) {
            items.push({
              type: 'product',
              id: p.id,
              title: p.name,
              subtitle: `SKU: ${p.sku}${p.barcode ? ` • Barcode: ${p.barcode}` : ''}`,
              price: p.selling_price,
              stock: p.available_stock,
            });
          }
        }

        // 2. Categories
        if (categoriesRes?.categories) {
          const flat = flattenCategoryTree(categoriesRes.categories);
          const normalized = trimmed.toLowerCase();
          const matchingCategories = flat
            .filter((c) => c.name.toLowerCase().includes(normalized) || c.slug.toLowerCase().includes(normalized))
            .slice(0, 5);

          for (const c of matchingCategories) {
            items.push({
              type: 'category',
              id: c.id,
              title: c.name,
              subtitle: `/${c.slug}${c.description ? ` • ${c.description}` : ''}`,
              productCount: c.product_count,
            });
          }
        }

        // 3. Brands
        if (brandsRes?.brands) {
          for (const b of brandsRes.brands) {
            items.push({
              type: 'brand',
              id: b.id,
              title: b.name,
              subtitle: `Brand${b.website_url ? ` • ${b.website_url}` : ''}`,
              productCount: b.product_count,
            });
          }
        }

        setResults(items);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query, branchId]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        handleSelectItem(selected);
      }
    }
  };

  // Scroll active item into view
  React.useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`[data-search-index="${selectedIndex}"]`);
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Global Escape key listener when modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  const handleSelectItem = (item: SearchResultItem) => {
    if (item.type === 'product') {
      onSelectProduct?.(item.id);
    } else if (item.type === 'category') {
      onSelectCategory?.(item.id);
    } else if (item.type === 'brand') {
      onSelectBrand?.(item.id);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        data-testid="catalog-search-modal"
        className="w-full max-w-2xl bg-[#141519] border border-[#2d3139] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#2d3139] gap-3 bg-[#181a20]">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog products, categories, or brands..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-hidden"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-[#fbb945] animate-spin shrink-0" />}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded-sm">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 divide-y divide-[#2d3139]/30">
          {query.trim().length === 0 ? (
            /* Empty Query Hint */
            <div className="py-12 px-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#985184]/15 text-[#fbb945] mx-auto flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Search Inventory Catalog</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Type any product name, SKU, barcode, category, or brand to instantly locate and manage inventory items.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-500 font-mono">
                <span>↑↓ Navigate</span>
                <span>•</span>
                <span>↵ Open item</span>
                <span>•</span>
                <span>ESC Close</span>
              </div>
            </div>
          ) : !isLoading && results.length === 0 ? (
            /* No Results */
            <div className="py-12 px-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-white">No catalog items found</p>
              <p className="text-xs text-slate-400">
                No products, categories, or brands match &ldquo;{query}&rdquo;.
              </p>
            </div>
          ) : (
            /* Results List */
            <div className="space-y-1">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    data-search-index={idx}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#985184]/20 border border-[#985184]/50 shadow-xs'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          item.type === 'product'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : item.type === 'category'
                            ? 'bg-[#985184]/20 text-[#fbb945] border border-[#985184]/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {item.type === 'product' && <Package className="w-4 h-4" />}
                        {item.type === 'category' && <FolderTree className="w-4 h-4" />}
                        {item.type === 'brand' && <Award className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                          <span
                            className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-xs tracking-wider ${
                              item.type === 'product'
                                ? 'bg-blue-500/15 text-blue-300'
                                : item.type === 'category'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      {item.type === 'product' && (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-white font-mono">
                            ₦{Number(item.price || 0).toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] font-mono ${
                              (item.stock || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {(item.stock || 0) > 0 ? `${item.stock} in stock` : 'Out of stock'}
                          </span>
                        </div>
                      )}
                      {(item.type === 'category' || item.type === 'brand') && item.productCount !== undefined && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {item.productCount} {item.productCount === 1 ? 'product' : 'products'}
                        </span>
                      )}
                      {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-[#fbb945] shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2 bg-[#121316] border-t border-[#2d3139] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-white/5 border border-white/10 rounded-xs text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.2 bg-white/5 border border-white/10 rounded-xs text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white/5 border border-white/10 rounded-xs text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <span className="text-slate-400">Inventory Catalog Quick Search</span>
        </div>
      </div>
    </div>
  );
}
