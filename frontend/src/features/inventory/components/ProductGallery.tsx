import React, { useState, useEffect } from 'react';
import type { ProductImage, ProductVariant } from '../products-api';
import {
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ImageIcon,
  Layers,
} from 'lucide-react';
import { VariantSwatchSelector } from './VariantSwatchSelector';

export interface ProductGalleryProps {
  images?: ProductImage[];
  productName: string;
  variantImages?: ProductImage[];
  selectedVariant?: ProductVariant | null;
  onSelectVariant?: (variant: ProductVariant | null) => void;
  variants?: ProductVariant[];
  showThumbnails?: boolean;
  thumbnailPosition?: 'bottom' | 'left';
  enableZoom?: boolean;
  enableLightbox?: boolean;
  className?: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images = [],
  productName,
  variantImages = [],
  selectedVariant = null,
  onSelectVariant,
  variants = [],
  showThumbnails = true,
  thumbnailPosition = 'bottom',
  enableZoom = true,
  enableLightbox = true,
  className = '',
}) => {
  // Determine which images to display:
  // If variant selected and it has variant-specific images, display them.
  // Otherwise, display parent images.
  const hasVariantSpecificImages =
    selectedVariant !== null && variantImages.length > 0;

  const activeImages = hasVariantSpecificImages
    ? variantImages
    : images;

  const isInherited =
    selectedVariant !== null && !hasVariantSpecificImages;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // When active image set changes (e.g., variant selected), reset activeIndex to primary image or 0
  useEffect(() => {
    if (activeImages.length > 0) {
      const primaryIdx = activeImages.findIndex((img) => img.is_primary);
      setActiveIndex(primaryIdx >= 0 ? primaryIdx : 0);
    } else {
      setActiveIndex(0);
    }
  }, [selectedVariant, activeImages.length]);

  const currentImage = activeImages[activeIndex] || null;

  const handleNext = () => {
    if (activeImages.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % activeImages.length);
  };

  const handlePrev = () => {
    if (activeImages.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + activeImages.length) % activeImages.length);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, activeImages.length]);

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {/* Variant Swatch Selector (if variations exist) */}
      {variants.length > 0 && onSelectVariant && (
        <VariantSwatchSelector
          variants={variants}
          selectedVariant={selectedVariant}
          onSelectVariant={onSelectVariant}
        />
      )}

      {/* Inheritance notification tag */}
      {isInherited && activeImages.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 w-fit">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span>Inheriting product catalog photos for this variant</span>
        </div>
      )}

      {/* Main Gallery Area */}
      <div
        className={`flex ${
          thumbnailPosition === 'left' ? 'flex-row-reverse gap-4' : 'flex-col gap-3'
        }`}
      >
        {/* Main Image Stage */}
        <div className="relative group w-full aspect-square bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center shadow-xs">
          {currentImage ? (
            <>
              <img
                src={currentImage.thumbnail_800 || currentImage.url}
                alt={currentImage.alt_text || productName}
                className="w-full h-full object-contain object-center transition-all duration-300"
              />

              {/* Lightbox trigger button */}
              {enableLightbox && (
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  title="Expand full screen"
                  className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}

              {/* Alt Text Overlay */}
              {currentImage.alt_text && (
                <div className="absolute bottom-3 left-3 bg-slate-900/70 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-xs max-w-[80%] truncate">
                  {currentImage.alt_text}
                </div>
              )}

              {/* Quick prev / next buttons */}
              {activeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-md backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-md backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-6 text-center space-y-2">
              <ImageIcon className="w-12 h-12 stroke-1" />
              <p className="text-sm font-medium">No images uploaded for this catalog item</p>
            </div>
          )}
        </div>

        {/* Thumbnail Navigation Strip */}
        {showThumbnails && activeImages.length > 1 && (
          <div
            className={`flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin ${
              thumbnailPosition === 'left' ? 'flex-col max-h-[420px]' : 'flex-row'
            }`}
          >
            {activeImages.map((img, idx) => (
              <button
                key={img.id || idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                  thumbnailPosition === 'left' ? 'w-16 h-16' : 'w-16 h-16 sm:w-20 sm:h-20'
                } ${
                  activeIndex === idx
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 scale-102 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={img.thumbnail_200 || img.url}
                  alt={img.alt_text || `Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover object-center"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && currentImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between text-white">
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold truncate max-w-md">{productName}</h3>
              <p className="text-xs text-white/70">
                Image {activeIndex + 1} of {activeImages.length}
                {currentImage.alt_text && ` • ${currentImage.alt_text}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {enableZoom && (
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                  title={isZoomed ? 'Zoom out' : 'Zoom in'}
                >
                  {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(false);
                  setIsZoomed(false);
                }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Close lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative flex-1 flex items-center justify-center overflow-auto my-4">
            <img
              src={currentImage.thumbnail_1200 || currentImage.url}
              alt={currentImage.alt_text || productName}
              className={`max-h-[80vh] object-contain transition-transform duration-200 ${
                isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
              onClick={() => enableZoom && setIsZoomed(!isZoomed)}
            />

            {activeImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 sm:left-6 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 sm:right-6 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Footer thumbnails */}
          {activeImages.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto py-2">
              {activeImages.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                    activeIndex === idx ? 'border-indigo-400 scale-105' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img
                    src={img.thumbnail_200 || img.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
