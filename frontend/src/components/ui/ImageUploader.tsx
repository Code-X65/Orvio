import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Star,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageIcon,
  AlertCircle,
} from 'lucide-react';

export interface UploadedImage {
  id?: string;
  file?: File;
  previewUrl: string;
  thumbnail_200?: string | null;
  thumbnail_400?: string | null;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ImageUploaderProps {
  maxProductImages?: number;
  maxVariantImages?: number;
  maxImages?: number;
  existingImages?: UploadedImage[];
  images?: UploadedImage[];
  onImagesChange?: (images: UploadedImage[]) => void;
  onChange?: (images: UploadedImage[]) => void;
  maxFileSizeMb?: number;
  acceptedTypes?: string[];
  showPreviews?: boolean;
  compact?: boolean;
  disabled?: boolean;
  isVariant?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  maxProductImages = 5,
  maxVariantImages = 5,
  maxImages: customMaxImages,
  existingImages = [],
  images: propImages,
  onImagesChange,
  onChange,
  maxFileSizeMb = 10,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  showPreviews = true,
  compact = false,
  disabled = false,
  isVariant = false,
}) => {
  const initialImages = propImages !== undefined ? propImages : existingImages;
  const maxImages = customMaxImages ?? (isVariant ? maxVariantImages : maxProductImages);
  const [images, setImages] = useState<UploadedImage[]>(initialImages);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with incoming images when they change externally
  useEffect(() => {
    const current = propImages !== undefined ? propImages : existingImages;
    if (current) {
      setImages(current);
    }
  }, [propImages, existingImages]);

  const updateImages = (newImages: UploadedImage[]) => {
    // Ensure primary consistency: exactly one image is primary if images exist
    if (newImages.length > 0 && !newImages.some((img) => img.isPrimary)) {
      newImages[0].isPrimary = true;
    }
    // Update sortOrder sequentially
    const ordered = newImages.map((img, idx) => ({ ...img, sortOrder: idx }));
    setImages(ordered);
    onImagesChange?.(ordered);
    onChange?.(ordered);
  };

  const handleFiles = (files: FileList | File[]) => {
    setErrorMessage(null);
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!acceptedTypes.includes(file.type)) {
        setErrorMessage(`"${file.name}" has an unsupported format. Please upload JPEG, PNG, or WebP.`);
        continue;
      }

      if (file.size > maxFileSizeMb * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the ${maxFileSizeMb}MB size limit.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (images.length + validFiles.length > maxImages) {
      setErrorMessage(`Maximum limit of ${maxImages} images reached. Only ${Math.max(0, maxImages - images.length)} more can be added.`);
      const remainingSlots = Math.max(0, maxImages - images.length);
      validFiles.splice(remainingSlots);
      if (validFiles.length === 0) return;
    }

    const newUploaded: UploadedImage[] = validFiles.map((file, idx) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: '',
      isPrimary: images.length === 0 && idx === 0,
      sortOrder: images.length + idx,
    }));

    updateImages([...images, ...newUploaded]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (disabled || images.length >= maxImages) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && images.length < maxImages) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleRemove = (index: number) => {
    if (disabled) return;
    const itemToRemove = images[index];
    if (itemToRemove.file && itemToRemove.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(itemToRemove.previewUrl);
    }
    const filtered = images.filter((_, idx) => idx !== index);
    updateImages(filtered);
  };

  const handleSetPrimary = (index: number) => {
    if (disabled) return;
    const updated = images.map((img, idx) => ({
      ...img,
      isPrimary: idx === index,
    }));
    updateImages(updated);
  };

  const handleAltTextChange = (index: number, text: string) => {
    const updated = [...images];
    updated[index].altText = text;
    setImages(updated);
    onImagesChange?.(updated);
  };

  const handleMove = (index: number, direction: 'left' | 'right') => {
    if (disabled) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    updateImages(reordered);
  };

  // Reorder via HTML5 drag-and-drop
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...images];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    updateImages(reordered);
  };

  const handleItemDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className={`w-full space-y-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Upload Zone */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-center ${
            compact ? 'py-4 px-3' : 'py-8 px-4'
          } ${
            isDraggingOver
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-inner'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            disabled={disabled}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          <div className="flex flex-col items-center text-center space-y-2">
            <div className={`p-2.5 rounded-full ${isDraggingOver ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              <UploadCloud className={compact ? 'w-5 h-5' : 'w-7 h-7'} />
            </div>
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">Click to upload</span> or drag & drop
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                PNG, JPG or WebP (max {maxFileSizeMb}MB each). Up to {maxImages} images.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header with counter */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
        <span>
          Images ({images.length}/{maxImages})
        </span>
        {images.length > 0 && (
          <span className="text-[11px] text-slate-400">
            ★ Star indicates primary catalog cover
          </span>
        )}
      </div>

      {/* Previews Grid */}
      {showPreviews && images.length > 0 && (
        <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
          {images.map((image, index) => {
            const displayUrl = image.thumbnail_200 || image.previewUrl;
            return (
              <div
                key={image.id || image.previewUrl || index}
                draggable={!disabled}
                onDragStart={(e) => handleItemDragStart(e, index)}
                onDragOver={(e) => handleItemDragOver(e, index)}
                onDragEnd={handleItemDragEnd}
                className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all ${
                  image.isPrimary
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                } ${draggedIndex === index ? 'opacity-40 scale-95' : 'hover:shadow-md'}`}
              >
                {/* Image Box */}
                <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img
                    src={displayUrl}
                    alt={image.altText || `Product image ${index + 1}`}
                    className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Badges / Primary Tag */}
                  {image.isPrimary && (
                    <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      Primary
                    </div>
                  )}

                  {/* Action Overlays */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/70 p-1 rounded-lg backdrop-blur-xs">
                    {!image.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        title="Set as primary catalog cover"
                        className="p-1 hover:text-amber-400 text-white rounded transition"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      title="Remove image"
                      className="p-1 hover:text-red-400 text-white rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Reorder Buttons (for mobile or click-based reorder) */}
                  <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'left')}
                      className={`p-1 rounded bg-slate-900/70 text-white backdrop-blur-xs transition ${
                        index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-900'
                      }`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center text-white/80 bg-slate-900/70 px-1.5 py-0.5 rounded text-[10px] backdrop-blur-xs">
                      <GripVertical className="w-3 h-3 mr-0.5" />
                      #{index + 1}
                    </div>

                    <button
                      type="button"
                      disabled={index === images.length - 1}
                      onClick={() => handleMove(index, 'right')}
                      className={`p-1 rounded bg-slate-900/70 text-white backdrop-blur-xs transition ${
                        index === images.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-900'
                      }`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Alt Text input */}
                {!compact && (
                  <div className="p-2 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Alt text (e.g. Front view)"
                      maxLength={200}
                      disabled={disabled}
                      value={image.altText || ''}
                      onChange={(e) => handleAltTextChange(index, e.target.value)}
                      className="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
