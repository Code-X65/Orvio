import * as React from 'react';
import { X, Award, AlertCircle, Loader2, Globe, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import type { Brand, CreateBrandPayload, UpdateBrandPayload } from '../brands-api';
import { brandApi } from '../brands-api';

export interface BrandFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: CreateBrandPayload | UpdateBrandPayload) => Promise<void>;
  onSuccess?: (createdOrUpdatedBrand: Brand) => void;
  editingBrand?: Brand | null;
  isQuickCreate?: boolean;
  branchId?: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function BrandForm({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  editingBrand,
  isQuickCreate = false,
  branchId,
}: BrandFormProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState('');
  const [websiteUrl, setWebsiteUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setMounted(true);
      timer = setTimeout(() => setAnimating(true), 10);
    } else {
      setAnimating(false);
      timer = setTimeout(() => setMounted(false), 200);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  React.useEffect(() => {
    if (editingBrand) {
      setName(editingBrand.name || '');
      setSlug(editingBrand.slug || '');
      setSlugManuallyEdited(true);
      setLogoUrl(editingBrand.logo_url || '');
      setWebsiteUrl(editingBrand.website_url || '');
      setDescription(editingBrand.description || '');
      setIsActive(editingBrand.is_active ?? true);
    } else {
      setName('');
      setSlug('');
      setSlugManuallyEdited(false);
      setLogoUrl('');
      setWebsiteUrl('');
      setDescription('');
      setIsActive(true);
    }
    setError(null);
  }, [editingBrand, isOpen]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value);
    setSlugManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Brand name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        logoUrl: logoUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        description: description.trim() || null,
        isActive,
        branchId,
      };

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        let resultBrand: Brand;
        if (editingBrand) {
          const res = await brandApi.updateBrand(editingBrand.id, payload);
          resultBrand = res.brand;
        } else {
          const res = await brandApi.createBrand(payload);
          resultBrand = res.brand;
        }
        onSuccess?.(resultBrand);
      }

      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save brand. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        animating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-lg rounded-xl border border-[#2d3139] bg-[#141519] p-6 shadow-2xl transition-all duration-200 ${
          animating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d3139] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#985184]/10 text-[#985184]">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {editingBrand ? 'Edit Brand' : isQuickCreate ? 'Quick Create Brand' : 'Add New Brand'}
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                {editingBrand
                  ? 'Update brand information and catalog identity'
                  : 'Add a manufacturer or brand to your unified catalog'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-[#252830] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Brand Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Brand Name <span className="text-rose-400">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Nike, Apple, Sony"
              value={name}
              onChange={handleNameChange}
              className="mt-1.5 h-9 border-[#2d3139] bg-[#181a20] text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
              autoFocus
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-slate-300">
              URL Identifier (Slug)
            </label>
            <Input
              type="text"
              placeholder="auto-generated-from-name"
              value={slug}
              onChange={handleSlugChange}
              className="mt-1.5 h-9 border-[#2d3139] bg-[#181a20] text-xs text-slate-300 placeholder:text-slate-500 focus:border-[#985184]"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Unique identifier used in catalog paths and search.
            </p>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-medium text-slate-300">
              Logo Image URL
            </label>
            <div className="relative mt-1.5">
              <ImageIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="h-9 border-[#2d3139] bg-[#181a20] pl-9 text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
              />
            </div>
            {logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-8 w-8 rounded border border-[#2d3139] bg-[#181a20] p-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={logoUrl}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-400">Logo preview</span>
              </div>
            )}
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Website</label>
            <div className="relative mt-1.5">
              <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                type="url"
                placeholder="https://brand-website.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="h-9 border-[#2d3139] bg-[#181a20] pl-9 text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Description</label>
            <Textarea
              placeholder="Brief description of the brand, manufacturer, or publisher..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 resize-none border-[#2d3139] bg-[#181a20] text-xs text-white placeholder:text-slate-500 focus:border-[#985184]"
            />
          </div>

          {/* Active status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="brandActiveCheckbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[#2d3139] bg-[#181a20] text-[#985184] accent-[#985184]"
            />
            <label htmlFor="brandActiveCheckbox" className="text-xs text-slate-300 select-none cursor-pointer">
              Active in catalog (visible when assigning products)
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-[#2d3139] pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-[#2d3139] bg-transparent text-xs text-slate-300 hover:bg-[#252830] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-[#985184] text-xs font-medium text-white hover:bg-[#985184]/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : editingBrand ? (
                'Save Changes'
              ) : (
                'Create Brand'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
