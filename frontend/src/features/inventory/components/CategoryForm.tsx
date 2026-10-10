import * as React from 'react';
import { X, FolderTree, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import type { Category, CategoryTreeNode } from '../categories-api';

export interface CategoryFormData {
  name: string;
  description: string;
  parentId: string | null;
  isActive: boolean;
}

export interface CategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  editingCategory?: Category | null;
  categories: CategoryTreeNode[];
  defaultParentId?: string | null;
}

// Flatten tree to get flat list for parent selection
export function flattenCategoriesForSelection(
  nodes: CategoryTreeNode[],
  excludeId?: string,
  prefix = ''
): Array<{ id: string; label: string }> {
  let list: Array<{ id: string; label: string }> = [];

  for (const node of nodes) {
    if (excludeId && node.id === excludeId) {
      continue; // Exclude node and its subtree from being its own parent
    }

    const currentLabel = prefix ? `${prefix} > ${node.name}` : node.name;
    list.push({ id: node.id, label: currentLabel });

    if (node.children && node.children.length > 0) {
      list = list.concat(flattenCategoriesForSelection(node.children, excludeId, currentLabel));
    }
  }

  return list;
}

export function CategoryForm({
  isOpen,
  onClose,
  onSubmit,
  editingCategory,
  categories,
  defaultParentId,
}: CategoryFormProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Manage enter/exit animation states
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

  // Sync form fields when category changes or modal opens
  React.useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setDescription(editingCategory.description || '');
      setParentId(editingCategory.parent_id || null);
      setIsActive(editingCategory.is_active);
    } else {
      setName('');
      setDescription('');
      setParentId(defaultParentId ?? null);
      setIsActive(true);
    }
    setError(null);
  }, [editingCategory, defaultParentId, isOpen]);

  const triggerClose = React.useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  if (!mounted) return null;

  const parentOptions = flattenCategoriesForSelection(categories, editingCategory?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Category name is required.');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Category name cannot exceed 100 characters.');
      return;
    }

    if (description.length > 500) {
      setError('Description cannot exceed 500 characters.');
      return;
    }

    if (editingCategory && parentId === editingCategory.id) {
      setError('A category cannot be its own parent.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        parentId: parentId || null,
        isActive,
      });
      triggerClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category. Please check details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="category-form-modal">
      {/* Backdrop with fade in/out animation */}
      <div
        onClick={triggerClose}
        className={`fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
          animating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Right Hand Panel (h-screen with slide animation) */}
      <aside
        className={`fixed inset-y-0 right-0 w-full max-w-md sm:max-w-lg h-screen bg-[#181a20] border-l border-[#2d3139] text-slate-100 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${
          animating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#2d3139] bg-[#181a20] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#985184]/15 text-[#985184] flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5 text-[#fbb945]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <p className="text-xs text-slate-400">
                {editingCategory
                  ? 'Update category properties and hierarchy'
                  : 'Add a new category to organize your catalog'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={triggerClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer transition-colors"
            data-testid="category-cancel-button"
            title="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#141519]">
            {error && (
              <div className="p-3 rounded-sm bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label htmlFor="category-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category Name <span className="text-[#fbb945]">*</span>
              </label>
              <Input
                id="category-name"
                data-testid="category-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverages, Canned Goods, Footwear"
                className="bg-[#181a20] border-[#2d3139] text-white focus:border-[#985184] text-xs h-9"
                autoFocus
                maxLength={100}
              />
            </div>

            {/* Parent Category Field */}
            <div>
              <label htmlFor="category-parent" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Parent Category (Optional)
              </label>
              <select
                id="category-parent"
                data-testid="category-parent-select"
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
                className="w-full bg-[#181a20] border border-[#2d3139] rounded-sm text-xs text-white px-3 h-9 focus:outline-none focus:border-[#985184]"
              >
                <option value="">None (Top-level Category)</option>
                {parentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Leave blank to keep this as a root category, or nest it up to 5 levels deep in your catalog tree.
              </p>
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="category-description" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Description (Optional)
              </label>
              <Textarea
                id="category-description"
                data-testid="category-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of items classified under this category"
                className="bg-[#181a20] border-[#2d3139] text-white focus:border-[#985184] text-xs resize-none"
                rows={4}
                maxLength={500}
              />
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-sm bg-[#181a20] border border-[#2d3139]">
              <div>
                <div className="text-xs font-semibold text-white">Active Status</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Inactive categories and their products are hidden from standard catalog views.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                  type="checkbox"
                  data-testid="category-active-toggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#985184]"></div>
              </label>
            </div>
          </div>

          {/* Sticky Drawer Footer */}
          <div className="p-4 bg-[#181a20] border-t border-[#2d3139] flex items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerClose}
              disabled={isSubmitting}
              className="border-[#2d3139] text-slate-300 hover:text-white hover:bg-white/5 text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              data-testid="category-submit-button"
              className="bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-9 px-5 cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
