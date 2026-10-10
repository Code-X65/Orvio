import React from 'react';
import type { ProductVariant, ProductImage } from '../products-api';
import { Layers } from 'lucide-react';

export interface VariantSwatchSelectorProps {
  variants: ProductVariant[];
  parentImages?: ProductImage[];
  selectedVariant: ProductVariant | null;
  onSelectVariant: (variant: ProductVariant | null) => void;
  swatchType?: 'color' | 'size' | 'auto';
  className?: string;
}

// Common color map for CSS display
const COLOR_MAP: Record<string, string> = {
  black: '#111827',
  white: '#FFFFFF',
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#10B981',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F97316',
  gray: '#6B7280',
  grey: '#6B7280',
  navy: '#1E3A8A',
  teal: '#14B8A6',
  brown: '#78350F',
  beige: '#F5F5DC',
  gold: '#D97706',
  silver: '#9CA3AF',
};

export const VariantSwatchSelector: React.FC<VariantSwatchSelectorProps> = ({
  variants,
  parentImages = [],
  selectedVariant,
  onSelectVariant,
  swatchType = 'auto',
  className = '',
}) => {
  if (!variants || variants.length === 0) return null;

  // Determine dominant attribute key (e.g., color, size, etc.)
  const firstVariantAttrs = variants[0]?.attributes || {};
  const attrKeys = Object.keys(firstVariantAttrs);

  let targetKey = attrKeys.find((k) => k.toLowerCase().includes('color')) ||
    attrKeys.find((k) => k.toLowerCase().includes('size')) ||
    attrKeys[0] ||
    'variant';

  const isColor =
    swatchType === 'color' ||
    (swatchType === 'auto' && targetKey.toLowerCase().includes('color'));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
          Select Variation ({targetKey}):
        </span>
        {selectedVariant && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            SKU: {selectedVariant.sku}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* All / Default Product button */}
        <button
          type="button"
          onClick={() => onSelectVariant(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            selectedVariant === null
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
          }`}
        >
          Default (All)
        </button>

        {variants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;
          const attrVal = variant.attributes?.[targetKey] || Object.values(variant.attributes)[0] || variant.sku;
          const normalizedColor = String(attrVal).toLowerCase().trim();
          const cssColor = COLOR_MAP[normalizedColor] || (normalizedColor.startsWith('#') ? normalizedColor : null);

          if (isColor && cssColor) {
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelectVariant(variant)}
                title={`${targetKey}: ${attrVal} (${variant.sku})`}
                className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/30 font-medium'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 shadow-xs"
                  style={{ backgroundColor: cssColor }}
                />
                <span>{attrVal}</span>
              </button>
            );
          }

          // Size or text badge
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelectVariant(variant)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              {attrVal}
            </button>
          );
        })}
      </div>
    </div>
  );
};
