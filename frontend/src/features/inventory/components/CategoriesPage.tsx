import * as React from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderPlus,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { useUrlActionState } from '../../../hooks/useUrlActionState';
import {
  categoryApi,
  type Category,
  type CategoryTreeNode,
} from '../categories-api';
import { useCategories } from '../hooks/useCategories';
import { CategoryTree } from './CategoryTree';
import {
  CategoryForm,
  type CategoryFormData,
  flattenCategoriesForSelection,
} from './CategoryForm';

interface CategoriesPageProps {
  organization?: {
    name?: string;
    business_type?: string;
  };
  onNavigateToProducts?: (categoryId: string) => void;
  branchId?: string;
}

// Recursively filter tree nodes based on search query
function filterTreeNodes(nodes: CategoryTreeNode[], query: string): CategoryTreeNode[] {
  if (!query) return nodes;

  const normalized = query.toLowerCase().trim();

  return nodes.reduce<CategoryTreeNode[]>((acc, node) => {
    const matchesSelf =
      node.name.toLowerCase().includes(normalized) ||
      (node.description && node.description.toLowerCase().includes(normalized)) ||
      node.slug.toLowerCase().includes(normalized);

    const filteredChildren = node.children ? filterTreeNodes(node.children, query) : [];

    if (matchesSelf || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: filteredChildren,
      });
    }
    return acc;
  }, []);
}

// Collect all node IDs in tree for "Expand All"
function collectAllNodeIds(nodes: CategoryTreeNode[]): string[] {
  let ids: string[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      ids.push(node.id);
      ids = ids.concat(collectAllNodeIds(node.children));
    }
  }
  return ids;
}

// Count total categories recursively
function countTotalCategories(nodes: CategoryTreeNode[]): number {
  return nodes.reduce((total, node) => {
    return total + 1 + (node.children ? countTotalCategories(node.children) : 0);
  }, 0);
}

// Helper to find category recursively in tree
function findCategoryInTree(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findCategoryInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function CategoriesPage({ organization, onNavigateToProducts, branchId }: CategoriesPageProps) {
  const { data: categoriesData, isLoading, error: queryError, refetch } = useCategories({ branchId });
  const [categories, setCategories] = React.useState<CategoryTreeNode[]>([]);
  const loading = isLoading;
  const error = queryError ? queryError.message : null;

  // URL Action State for deep-linking & session resumption
  const {
    activeAction,
    activeEntityId: actionCategoryId,
    openAction,
    closeAction,
  } = useUrlActionState<'create-category' | 'edit-category'>({
    actionParam: 'action',
    entityIdParam: 'categoryId',
  });

  // Filters & State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Modal State
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = React.useState<string | null>(null);

  // Notify user when workflow session is restored from URL
  const restoredToastRef = React.useRef(false);
  React.useEffect(() => {
    if (activeAction && !restoredToastRef.current) {
      restoredToastRef.current = true;
      toast.info('Session restored — resumed where you left off', {
        description: `Active workflow: ${activeAction.replace('-', ' ')}`,
      });
    }
  }, [activeAction]);

  // Sync active action with modal open state
  React.useEffect(() => {
    if (activeAction === 'create-category') {
      setEditingCategory(null);
      setIsFormOpen(true);
    } else if (activeAction === 'edit-category' && actionCategoryId && categories.length > 0) {
      const found = findCategoryInTree(categories, actionCategoryId);
      if (found) {
        setEditingCategory(found);
        setDefaultParentId(found.parent_id);
        setIsFormOpen(true);
      }
    }
  }, [activeAction, actionCategoryId, categories]);

  // Sync React Query data into local tree state
  React.useEffect(() => {
    if (categoriesData) {
      const tree = (categoriesData as any)?.data?.categories ?? categoriesData?.categories ?? [];
      setCategories(tree);

      const initialExpanded = new Set<string>();
      for (const node of tree) {
        if (node.children && node.children.length > 0) {
          initialExpanded.add(node.id);
        }
      }
      setExpandedIds(initialExpanded);
    }
  }, [categoriesData]);

  // Delete Confirm Modal State
  const [categoryToDelete, setCategoryToDelete] = React.useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [usageLoading, setUsageLoading] = React.useState(false);
  const [categoryUsage, setCategoryUsage] = React.useState<{ productCount: number; childCount: number } | null>(null);
  const [reassignTargetCategoryId, setReassignTargetCategoryId] = React.useState<string>('');

  // Seeding State
  const [isSeeding, setIsSeeding] = React.useState(false);

  // Fetch categories wrapper
  const fetchCategories = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Expand / Collapse Handlers
  const toggleNodeExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = collectAllNodeIds(categories);
    setExpandedIds(new Set(allIds));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Create / Edit Handlers
  const handleOpenCreate = (parentId?: string | null) => {
    openAction('create-category');
    setEditingCategory(null);
    setDefaultParentId(parentId ?? null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    openAction('edit-category', cat.id);
    setEditingCategory(cat);
    setDefaultParentId(cat.parent_id);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (
    data: CategoryFormData,
    imageFile?: File | null,
    shouldRemoveImage?: boolean
  ) => {
    let catId: string;
    if (editingCategory) {
      await categoryApi.updateCategory(editingCategory.id, {
        name: data.name,
        description: data.description || null,
        parentId: data.parentId,
        isActive: data.isActive,
      });
      catId = editingCategory.id;
      toast.success(`Category "${data.name}" updated successfully.`);
    } else {
      const res = await categoryApi.createCategory({
        name: data.name,
        description: data.description || null,
        parentId: data.parentId,
        isActive: data.isActive,
        branchId,
      });
      catId = res.category.id;
      toast.success(`Category "${data.name}" created successfully.`);
    }

    if (imageFile) {
      try {
        await categoryApi.uploadCategoryImage(catId, imageFile);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to upload category image');
      }
    } else if (shouldRemoveImage && editingCategory) {
      try {
        await categoryApi.deleteCategoryImage(catId);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to remove category image');
      }
    }

    await fetchCategories();
    closeAction();
  };

  // Helper to recursively update category node active status
  const updateNodeStatusInTree = (
    nodes: CategoryTreeNode[],
    id: string,
    newActive: boolean
  ): CategoryTreeNode[] => {
    return nodes.map((n) => {
      if (n.id === id) {
        return { ...n, is_active: newActive };
      }
      if (n.children && n.children.length > 0) {
        return { ...n, children: updateNodeStatusInTree(n.children, id, newActive) };
      }
      return n;
    });
  };

  // Toggle active status with optimistic UI update
  const handleToggleStatus = async (cat: Category) => {
    const previousState = cat.is_active;
    const nextState = !previousState;

    // Optimistically update the UI immediately
    setCategories((prev) => updateNodeStatusInTree(prev, cat.id, nextState));

    try {
      await categoryApi.toggleCategoryStatus(cat.id);
      toast.success(
        `Category "${cat.name}" is now ${nextState ? 'active' : 'inactive'}.`
      );
      await fetchCategories();
    } catch (err: any) {
      // Revert optimistic update on failure
      setCategories((prev) => updateNodeStatusInTree(prev, cat.id, previousState));
      toast.error(err?.message || 'Failed to update category status.');
    }
  };

  // Delete category
  const handleDeleteClick = async (cat: Category) => {
    setCategoryToDelete(cat);
    setCategoryUsage(null);
    setReassignTargetCategoryId('');
    setUsageLoading(true);
    try {
      const res = await categoryApi.getCategoryUsage(cat.id);
      setCategoryUsage(res.usage);
    } catch (err: any) {
      console.error('Failed to get category usage:', err);
    } finally {
      setUsageLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      setIsDeleting(true);
      const targetId =
        categoryUsage && categoryUsage.productCount > 0
          ? reassignTargetCategoryId || undefined
          : undefined;

      const res = await categoryApi.deleteCategory(categoryToDelete.id, targetId);
      if (res.reassignedProductCount && res.reassignedProductCount > 0) {
        toast.success(
          `Category "${categoryToDelete.name}" archived. ${res.reassignedProductCount} product(s) reassigned successfully.`
        );
      } else {
        toast.success(`Category "${categoryToDelete.name}" archived.`);
      }
      setCategoryToDelete(null);
      setCategoryUsage(null);
      setReassignTargetCategoryId('');
      await fetchCategories();
    } catch (err: any) {
      toast.error(
        err?.message ||
          'Failed to delete category. Subcategories must be deleted or moved first.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Find all descendant IDs of categoryToDelete to exclude them from reassignment
  const getSubtreeCategoryIds = React.useCallback((nodeId: string, nodes: CategoryTreeNode[]): Set<string> => {
    const ids = new Set<string>([nodeId]);
    const findAndCollect = (list: CategoryTreeNode[]) => {
      for (const item of list) {
        if (item.id === nodeId || ids.has(item.parent_id || '')) {
          ids.add(item.id);
          if (item.children) findAndCollect(item.children);
        } else if (item.children) {
          findAndCollect(item.children);
        }
      }
    };
    findAndCollect(nodes);
    return ids;
  }, []);

  const excludedCategoryIds = React.useMemo(() => {
    if (!categoryToDelete) return new Set<string>();
    return getSubtreeCategoryIds(categoryToDelete.id, categories);
  }, [categoryToDelete, categories, getSubtreeCategoryIds]);

  const reassignCategoryOptions = React.useMemo(() => {
    const allOptions = flattenCategoriesForSelection(categories);
    return allOptions.filter((opt) => !excludedCategoryIds.has(opt.id));
  }, [categories, excludedCategoryIds]);

  // Reorder siblings
  const handleMoveUp = async (cat: Category, siblings: CategoryTreeNode[]) => {
    const idx = siblings.findIndex((s) => s.id === cat.id);
    if (idx <= 0) return;

    const reordered = [...siblings];
    const temp = reordered[idx - 1];
    reordered[idx - 1] = reordered[idx];
    reordered[idx] = temp;

    try {
      await categoryApi.reorderCategories(
        cat.parent_id,
        reordered.map((r) => r.id)
      );
      toast.success('Category order updated.');
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reorder categories.');
    }
  };

  const handleMoveDown = async (cat: Category, siblings: CategoryTreeNode[]) => {
    const idx = siblings.findIndex((s) => s.id === cat.id);
    if (idx < 0 || idx >= siblings.length - 1) return;

    const reordered = [...siblings];
    const temp = reordered[idx + 1];
    reordered[idx + 1] = reordered[idx];
    reordered[idx] = temp;

    try {
      await categoryApi.reorderCategories(
        cat.parent_id,
        reordered.map((r) => r.id)
      );
      toast.success('Category order updated.');
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reorder categories.');
    }
  };

  // Seed default categories
  const handleSeedDefaults = async () => {
    try {
      setIsSeeding(true);
      const res = await categoryApi.seedDefaultCategories(organization?.business_type, branchId);
      const count = (res as any)?.data?.count ?? res?.count ?? 0;
      toast.success(`Generated ${count} starter categories!`);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate default categories.');
    } finally {
      setIsSeeding(false);
    }
  };

  const totalCategoriesCount = countTotalCategories(categories);
  const filteredNodes = filterTreeNodes(categories, searchQuery);

  return (
    <div className="space-y-5" data-testid="categories-page">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2d3139] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-[#985184]/15 text-[#fbb945] flex items-center justify-center">
              <FolderTree className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Category Management</h1>
            <Badge
              variant="secondary"
              className="bg-[#181a20] text-slate-300 border border-[#2d3139] text-xs font-mono"
            >
              {totalCategoriesCount} {totalCategoriesCount === 1 ? 'Category' : 'Categories'}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organize products into hierarchical categories for catalog browsing and inventory reporting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchCategories}
            disabled={loading}
            className="border-[#2d3139] text-slate-300 hover:text-white hover:bg-white/5 text-xs h-9 cursor-pointer"
            title="Refresh categories"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenCreate(null)}
            className="bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-9 px-4 rounded-sm shadow-sm flex items-center gap-1.5 cursor-pointer"
            data-testid="add-category-btn"
          >
            <Plus className="w-4 h-4 text-[#fbb945]" />
            <span>Add Category</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#181a20] p-3 rounded-sm border border-[#2d3139]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories by name, slug or description..."
            className="bg-[#111216] border-[#2d3139] pl-9 text-xs text-white h-8 w-full focus:border-[#985184]"
            data-testid="category-search-input"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Active Filter Toggle */}
          <div className="flex items-center bg-[#111216] p-0.5 rounded-sm border border-[#2d3139]">
            <button
              type="button"
              onClick={() => setActiveOnly(true)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xs cursor-pointer transition-colors ${
                activeOnly
                  ? 'bg-[#985184] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Only
            </button>
            <button
              type="button"
              onClick={() => setActiveOnly(false)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-xs cursor-pointer transition-colors ${
                !activeOnly
                  ? 'bg-[#985184] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Categories
            </button>
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1 border-l border-[#2d3139] pl-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExpandAll}
              className="h-8 px-2 text-slate-400 hover:text-white text-[11px] gap-1 cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5 text-[#fbb945]" />
              <span className="hidden md:inline">Expand All</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCollapseAll}
              className="h-8 px-2 text-slate-400 hover:text-white text-[11px] gap-1 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Collapse</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading && categories.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-[#181a20] rounded-sm border border-[#252830]">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#fbb945] mb-3" />
          <p className="text-xs">Loading categories hierarchy...</p>
        </div>
      ) : categories.length === 0 ? (
        /* Empty State */
        <div className="p-8 text-center bg-[#181a20] rounded-sm border border-[#252830] space-y-4 max-w-lg mx-auto mt-6">
          <div className="w-14 h-14 rounded-full bg-[#985184]/15 text-[#985184] mx-auto flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-[#fbb945]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">No Categories Found</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Categories help organize your inventory into departments and shelves. You can load starter categories tailored to your business or create them manually.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenCreate(null)}
              className="border-[#2d3139] text-white hover:bg-white/5 text-xs h-9 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-[#fbb945]" />
              Add First Category
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSeedDefaults}
              disabled={isSeeding}
              className="bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-9 px-4 cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderPlus className="w-3.5 h-3.5 text-[#fbb945]" />
              )}
              <span>Load Starter Categories</span>
            </Button>
          </div>
        </div>
      ) : filteredNodes.length === 0 ? (
        /* Search Empty State */
        <div className="py-12 text-center text-slate-400 bg-[#181a20] rounded-sm border border-[#252830]">
          <p className="text-xs">No categories match &quot;{searchQuery}&quot;</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="text-xs text-[#fbb945] hover:underline mt-2 cursor-pointer"
          >
            Clear Search Filter
          </Button>
        </div>
      ) : (
        /* Category Hierarchy Tree */
        <div className="bg-[#14151a] p-4 rounded-sm border border-[#252830]">
          <CategoryTree
            nodes={filteredNodes}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteClick}
            onToggleStatus={handleToggleStatus}
            onAddSubcategory={(parent) => handleOpenCreate(parent.id)}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onNavigateToProducts={onNavigateToProducts}
            expandedIds={expandedIds}
            onToggleExpand={toggleNodeExpand}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <CategoryForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCategory(null);
          closeAction();
        }}
        onSubmit={handleFormSubmit}
        editingCategory={editingCategory}
        categories={categories}
        defaultParentId={defaultParentId}
      />

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#181a20] border border-[#2d3139] rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Archive Category</h3>
                <p className="text-xs text-slate-400">Manage category lifecycle and product integrity</p>
              </div>
            </div>

            {usageLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#985184]" />
                <p className="text-xs">Checking assigned products and subcategories...</p>
              </div>
            ) : categoryUsage?.childCount && categoryUsage.childCount > 0 ? (
              <div className="space-y-3">
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-3.5 text-xs text-rose-300">
                  <div className="font-semibold flex items-center gap-1.5 mb-1.5 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Cannot Delete: Subcategories Detected
                  </div>
                  Category <strong className="text-white">"{categoryToDelete.name}"</strong> has{' '}
                  <span className="font-bold text-white">{categoryUsage.childCount} subcategory/subcategories</span>.
                  You must delete or move child categories first before archiving this category.
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryToDelete(null)}
                    className="border-[#2d3139] text-slate-300 hover:bg-white/5 text-xs h-9 cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : categoryUsage?.productCount && categoryUsage.productCount > 0 ? (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3.5 text-xs text-amber-300">
                  <div className="font-semibold flex items-center gap-1.5 mb-1.5 text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    Active Products Assigned
                  </div>
                  This category contains{' '}
                  <span className="font-bold text-white">
                    {categoryUsage.productCount} active product{categoryUsage.productCount > 1 ? 's' : ''}
                  </span>.
                  To protect your catalog and prevent orphaned items, select a destination category to reassign them to:
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Reassign Products To <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={reassignTargetCategoryId}
                    onChange={(e) => setReassignTargetCategoryId(e.target.value)}
                    className="w-full bg-[#121316] border border-[#2d3139] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#985184] transition-colors"
                    required
                  >
                    <option value="">Select destination category...</option>
                    {reassignCategoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    All {categoryUsage.productCount} product(s) will be atomically moved to this category.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryToDelete(null)}
                    disabled={isDeleting}
                    className="border-[#2d3139] text-slate-300 hover:bg-white/5 text-xs h-9 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={confirmDelete}
                    disabled={isDeleting || !reassignTargetCategoryId}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 px-4 cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="confirm-delete-category-btn"
                  >
                    {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Reassign & Archive</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to archive{' '}
                  <span className="text-white font-semibold">&quot;{categoryToDelete.name}&quot;</span>?
                  It has no subcategories and 0 assigned products.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryToDelete(null)}
                    disabled={isDeleting}
                    className="border-[#2d3139] text-slate-300 hover:bg-white/5 text-xs h-9 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 px-4 cursor-pointer shadow-sm flex items-center gap-1.5"
                    data-testid="confirm-delete-category-btn"
                  >
                    {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Archive Category</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
