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
  Power,
  Layers,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { Category, CategoryTreeNode } from '../categories-api';

export interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onToggleStatus: (category: Category) => void;
  onAddSubcategory: (parentCategory: Category) => void;
  onMoveUp: (category: Category, siblings: CategoryTreeNode[]) => void;
  onMoveDown: (category: Category, siblings: CategoryTreeNode[]) => void;
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

                <div
                  className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${
                    hasChildren
                      ? 'bg-[#985184]/15 text-[#fbb945]'
                      : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {hasChildren ? <FolderTree className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                </div>

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
                  </div>
                  {node.description && (
                    <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                      {node.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Status Badge, Sibling Ordering, and Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Active/Inactive Badge */}
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm flex items-center gap-1 mr-1 ${
                    node.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-700/30 text-slate-400 border border-slate-700/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      node.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  {node.is_active ? 'Active' : 'Inactive'}
                </span>

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

                {/* Toggle Status Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleStatus(node)}
                  title={node.is_active ? 'Deactivate Category' : 'Activate Category'}
                  className={`h-7 w-7 p-0 hover:bg-white/5 cursor-pointer ${
                    node.is_active ? 'text-slate-400 hover:text-amber-400' : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                  data-testid={`category-toggle-${node.id}`}
                >
                  <Power className="w-3.5 h-3.5" />
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
