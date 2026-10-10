import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderTree,
  Folder,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  Layers,
  Package,
  PackageSearch,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { Category, CategoryTreeNode } from '../categories-api';
import { CategoryImageBadge } from './CategoryImageBadge';

export interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onToggleStatus: (category: Category) => void;
  onAddSubcategory: (parentCategory: Category) => void;
  onMoveUp: (category: Category, siblings: CategoryTreeNode[]) => void;
  onMoveDown: (category: Category, siblings: CategoryTreeNode[]) => void;
  onNavigateToProducts?: (categoryId: string) => void;
  level?: number;
  expandedIds?: Set<string>;
  onToggleExpand?: (id: string) => void;
}

export function CategoryTree({
  nodes,
  onEdit,
  onDelete,
  onToggleStatus,
  onAddSubcategory,
  onMoveUp,
  onMoveDown,
  onNavigateToProducts,
  level = 0,
  expandedIds,
  onToggleExpand,
}: CategoryTreeProps) {
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(() => new Set());

  const isExpanded = (id: string) => {
    if (expandedIds) return expandedIds.has(id);
    return internalExpanded.has(id);
  };

  const toggleNode = (id: string) => {
    if (onToggleExpand) {
      onToggleExpand(id);
    } else {
      setInternalExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  if (!nodes || nodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5" data-testid={`category-tree-level-${level}`}>
      {nodes.map((node, index) => {
        const hasChildren = node.children && node.children.length > 0;
        const expanded = isExpanded(node.id);
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        const totalProducts = node.product_count ?? 0;
        const directProducts = node.direct_product_count ?? 0;

        return (
          <div key={node.id} className="group/item">
            <div
              className={`flex items-center justify-between p-2.5 rounded-sm border transition-all duration-150 ${
                node.is_active
                  ? 'bg-[#181a20] border-[#252830] hover:border-[#985184]/50 hover:bg-[#1d2028]'
                  : 'bg-[#14151a] border-[#20222a] opacity-65 hover:opacity-100 hover:border-[#2d3139]'
              }`}
              style={{ marginLeft: `${level * 20}px` }}
              data-testid={`category-row-${node.id}`}
            >
              {/* Left Column: Expansion Chevron, Icon, Title & Details */}
              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleNode(node.id)}
                    className="p-1 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer transition-colors"
                    title={expanded ? 'Collapse' : 'Expand'}
                    data-testid={`category-expand-btn-${node.id}`}
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-[#fbb945]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                ) : (
                  <div className="w-6 h-6 flex items-center justify-center text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                  </div>
                )}

                {node.image_url ? (
                  <CategoryImageBadge
                    imageUrl={node.image_url}
                    name={node.name}
                    size="sm"
                    className="shrink-0"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${
                      hasChildren
                        ? 'bg-[#985184]/15 text-[#fbb945]'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {hasChildren ? <FolderTree className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-tight truncate">
                      {node.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono bg-black/40 px-1.5 py-0.5 rounded-sm border border-white/5">
                      /{node.slug}
                    </span>
                    {hasChildren && (
                      <Badge
                        variant="secondary"
                        className="bg-[#985184]/20 text-[#fbb945] border-none text-[10px] px-1.5 py-0 h-4 font-mono font-medium"
                      >
                        <Layers className="w-2.5 h-2.5 mr-1" />
                        {node.children.length} {node.children.length === 1 ? 'child' : 'children'}
                      </Badge>
                    )}

                    {/* Available Product Count Badge */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToProducts?.(node.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#985184]/15 hover:bg-[#985184]/30 border border-[#985184]/30 hover:border-[#985184]/60 text-white text-[10px] font-medium transition-colors cursor-pointer group"
                      title={`Filter products in catalog by "${node.name}" (${totalProducts} products)`}
                      data-testid={`category-product-count-${node.id}`}
                    >
                      <Package className="w-3 h-3 text-[#fbb945] group-hover:scale-110 transition-transform" />
                      <span>{totalProducts} {totalProducts === 1 ? 'product' : 'products'}</span>
                      {hasChildren && directProducts !== totalProducts && (
                        <span className="text-slate-400 font-mono text-[9px]">({directProducts} direct)</span>
                      )}
                    </button>
                  </div>
                  {node.description && (
                    <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                      {node.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Status Toggle, Sibling Ordering, and Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Interactive Active / Inactive Switch Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={node.is_active}
                  onClick={() => onToggleStatus(node)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer mr-1 ${
                    node.is_active
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                  }`}
                  title={node.is_active ? 'Click to deactivate category' : 'Click to activate category'}
                  data-testid={`category-toggle-${node.id}`}
                >
                  <div
                    className={`w-5 h-3 rounded-full transition-colors relative flex items-center p-0.5 ${
                      node.is_active ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                        node.is_active ? 'translate-x-2' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="select-none tracking-tight">
                    {node.is_active ? 'Active' : 'Inactive'}
                  </span>
                </button>

                {/* Sibling Reordering Controls */}
                <div className="flex items-center bg-black/30 border border-[#2d3139] rounded-sm p-0.5">
                  <button
                    type="button"
                    onClick={() => onMoveUp(node, nodes)}
                    disabled={isFirst}
                    title="Move up in sibling order"
                    className={`p-1 rounded-xs transition-colors ${
                      isFirst
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer'
                    }`}
                    data-testid={`category-move-up-${node.id}`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown(node, nodes)}
                    disabled={isLast}
                    title="Move down in sibling order"
                    className={`p-1 rounded-xs transition-colors ${
                      isLast
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer'
                    }`}
                    data-testid={`category-move-down-${node.id}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* View Products in Catalog Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateToProducts?.(node.id)}
                  title={`View products under "${node.name}" in catalog`}
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-[#985184]/20 cursor-pointer"
                  data-testid={`category-view-products-${node.id}`}
                >
                  <PackageSearch className="w-3.5 h-3.5 text-[#fbb945]" />
                </Button>

                {/* Add Subcategory Button (if depth allows) */}
                {level < 4 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddSubcategory(node)}
                    title="Add Subcategory"
                    className="h-7 px-2 text-slate-300 hover:text-white hover:bg-[#985184]/20 text-[11px] gap-1 cursor-pointer"
                    data-testid={`category-add-sub-${node.id}`}
                  >
                    <Plus className="w-3 h-3 text-[#fbb945]" />
                    <span className="hidden sm:inline">Add Sub</span>
                  </Button>
                )}

                {/* Edit Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(node)}
                  title="Edit Category"
                  className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  data-testid={`category-edit-${node.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(node)}
                  title={hasChildren ? 'Cannot delete category with subcategories' : 'Delete Category'}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  data-testid={`category-delete-${node.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Render nested children if expanded */}
            {hasChildren && expanded && (
              <div className="mt-1.5 pl-2 border-l border-white/5">
                <CategoryTree
                  nodes={node.children}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleStatus={onToggleStatus}
                  onAddSubcategory={onAddSubcategory}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onNavigateToProducts={onNavigateToProducts}
                  level={level + 1}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
