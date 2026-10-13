import crypto from 'node:crypto';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { AppError } from '../../lib/errors.js';
import { defaultStorage, type StorageService } from '../../lib/storage.js';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_DECODED_PIXELS = 16_777_216; // 4096 x 4096 (16 Megapixels)
export const MAX_DIMENSION_PX = 4096;

export interface ProcessedProductImageFiles {
  imageId: string;
  url: string;
  thumbnail_200: string;
  thumbnail_400: string;
  thumbnail_800: string;
  thumbnail_1200: string;
  file_size: number;
  mime_type: string;
  sharpDurationMs: number;
  storageDurationMs: number;
}

/**
 * Sniffs binary magic bytes from the buffer header to determine real format.
 */
export function detectMimeTypeFromBuffer(fileBuffer: Buffer): string | null {
  if (!fileBuffer || fileBuffer.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47 &&
    fileBuffer[4] === 0x0d &&
    fileBuffer[5] === 0x0a &&
    fileBuffer[6] === 0x1a &&
    fileBuffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (
    fileBuffer[0] === 0xff &&
    fileBuffer[1] === 0xd8 &&
    fileBuffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    fileBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    fileBuffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export class ImageUploadService {
  constructor(private storage: StorageService = defaultStorage) {}

  validateImage(fileBuffer: Buffer, reportedMimeType: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No image file buffer provided', 400);
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        'IMAGE_FILE_TOO_LARGE',
        `Image file size exceeds maximum limit of 10MB (${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB).`,
        413
      );
    }

    const lowerReported = (reportedMimeType || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(lowerReported)) {
      throw new AppError(
        'INVALID_IMAGE_TYPE',
        `Unsupported image type: '${reportedMimeType}'. Allowed formats are JPEG, PNG, and WebP.`,
        400
      );
    }

    const detectedMime = detectMimeTypeFromBuffer(fileBuffer);
    if (!detectedMime) {
      throw new AppError(
        'INVALID_IMAGE_TYPE',
        'Invalid or corrupted image format. File content does not match JPEG, PNG, or WebP signatures.',
        400
      );
    }

    const normalizedReported = lowerReported === 'image/jpg' ? 'image/jpeg' : lowerReported;
    if (detectedMime !== normalizedReported) {
      throw new AppError(
        'SPOOFED_IMAGE_MIME_TYPE',
        `Image content signature mismatch: reported '${reportedMimeType}', but actual file content is '${detectedMime}'.`,
        400
      );
    }
  }

  private getExtensionFromMime(mimeType: string, filename?: string): string {
    const ext = filename ? path.extname(filename).toLowerCase().replace(/^\./, '') : '';
    if (ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
    switch (mimeType.toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/jpeg':
      case 'image/jpg':
      default:
        return 'jpg';
    }
  }

  async processAndSaveProductImage(params: {
    orgId: string;
    productId: string;
    fileBuffer: Buffer;
    originalFilename?: string;
    mimeType: string;
    imageId?: string;
  }): Promise<ProcessedProductImageFiles> {
    const { orgId, productId, fileBuffer, originalFilename, mimeType } = params;
    this.validateImage(fileBuffer, mimeType);

    const imageId = params.imageId || crypto.randomUUID();
    const ext = this.getExtensionFromMime(mimeType, originalFilename);
    const basePath = `products/${orgId}/${productId}`;
    const originalPath = `${basePath}/${imageId}.${ext}`;

    try {
      const sharpStart = Date.now();

      // Configure Sharp instance with strict pixel ceiling and auto-orientation
      const instance = sharp(fileBuffer, {
        limitInputPixels: MAX_DECODED_PIXELS,
        failOn: 'truncated',
      }).rotate();

      let metadata: Metadata;
      try {
        metadata = await instance.metadata();
      } catch (err: any) {
        throw new AppError('MALFORMED_IMAGE', `Corrupted or unreadable image file: ${err.message}`, 400);
      }

      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (width <= 0 || height <= 0) {
        throw new AppError('MALFORMED_IMAGE', 'Image has invalid zero or negative dimensions', 400);
      }

      if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX || width * height > MAX_DECODED_PIXELS) {
        throw new AppError(
          'IMAGE_DIMENSIONS_TOO_LARGE',
          `Image dimensions (${width}x${height}) exceed maximum allowed limit of ${MAX_DIMENSION_PX}x${MAX_DIMENSION_PX} (${MAX_DECODED_PIXELS} pixels).`,
          422,
          { width, height, maxDimension: MAX_DIMENSION_PX, maxPixels: MAX_DECODED_PIXELS }
        );
      }

      const webpOptions = { quality: 80, effort: 3 };

      // Direct parallel downscaling from source instance with EXIF orientation preserved
      const [thumb1200, thumb800, thumb400, thumb200] = await Promise.all([
        instance
          .clone()
          .resize(Math.min(1200, width), Math.min(1200, height), {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp(webpOptions)
          .toBuffer(),
        instance
          .clone()
          .resize(Math.min(800, width), Math.min(800, height), {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp(webpOptions)
          .toBuffer(),
        instance
          .clone()
          .resize(Math.min(400, width), Math.min(400, height), {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp(webpOptions)
          .toBuffer(),
        instance
          .clone()
          .resize(Math.min(200, width), Math.min(200, height), {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp(webpOptions)
          .toBuffer(),
      ]);

      const sharpDurationMs = Date.now() - sharpStart;

      // Parallel storage writes for original + 4 thumbnails
      const storageStart = Date.now();
      const [originalUrl, url200, url400, url800, url1200] = await Promise.all([
        this.storage.saveFile(originalPath, fileBuffer, mimeType),
        this.storage.saveFile(`${basePath}/${imageId}-200.webp`, thumb200, 'image/webp'),
        this.storage.saveFile(`${basePath}/${imageId}-400.webp`, thumb400, 'image/webp'),
        this.storage.saveFile(`${basePath}/${imageId}-800.webp`, thumb800, 'image/webp'),
        this.storage.saveFile(`${basePath}/${imageId}-1200.webp`, thumb1200, 'image/webp'),
      ]);
      const storageDurationMs = Date.now() - storageStart;

      return {
        imageId,
        url: originalUrl,
        thumbnail_200: url200,
        thumbnail_400: url400,
        thumbnail_800: url800,
        thumbnail_1200: url1200,
        file_size: fileBuffer.length,
        mime_type: mimeType,
        sharpDurationMs,
        storageDurationMs,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        'IMAGE_UPLOAD_FAILED',
        `Failed to process and store product image: ${err.message}`,
        500
      );
    }
  }

  /**
   * Deletes all files associated with a product image with exponential backoff retries.
   */
  async deleteProductImageFiles(params: {
    orgId: string;
    productId: string;
    imageId: string;
    ext?: string;
  }): Promise<void> {
    const { orgId, productId, imageId, ext = 'jpg' } = params;
    const basePath = `products/${orgId}/${productId}`;
    const extensionsToTry = [ext, 'jpg', 'png', 'webp', 'jpeg'];
    const uniqueExts = Array.from(new Set(extensionsToTry));

    const deleteWithRetry = async (filePath: string, maxAttempts = 3): Promise<void> => {
      let delay = 100;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.storage.deleteFile(filePath);
          return;
        } catch (err: any) {
          if (attempt === maxAttempts) {
            console.error(`[StorageCleanup] Failed to delete ${filePath} after ${maxAttempts} attempts:`, err);
            return;
          }
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        }
      }
    };

    for (const extension of uniqueExts) {
      await deleteWithRetry(`${basePath}/${imageId}.${extension}`);
    }

    await Promise.all([
      deleteWithRetry(`${basePath}/${imageId}-200.webp`),
      deleteWithRetry(`${basePath}/${imageId}-400.webp`),
      deleteWithRetry(`${basePath}/${imageId}-800.webp`),
      deleteWithRetry(`${basePath}/${imageId}-1200.webp`),
    ]);
  }

  async deleteProductDirectory(params: { orgId: string; productId: string }): Promise<void> {
    const { orgId, productId } = params;
    try {
      await this.storage.deleteDirectory(`products/${orgId}/${productId}`);
    } catch (err: any) {
      console.error(`[StorageCleanup] Failed to delete directory products/${orgId}/${productId}:`, err);
    }
  }

  async processAndSaveCategoryImage(params: {
    orgId: string;
    categoryId: string;
    fileBuffer: Buffer;
    mimeType: string;
  }): Promise<{ url: string }> {
    const { orgId, categoryId, fileBuffer, mimeType } = params;
    this.validateImage(fileBuffer, mimeType);

    try {
      const resized = await sharp(fileBuffer, {
        limitInputPixels: MAX_DECODED_PIXELS,
        failOn: 'truncated',
      })
        .rotate()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 3 })
        .toBuffer();

      const filePath = `categories/${orgId}/${categoryId}.webp`;
      const url = await this.storage.saveFile(filePath, resized, 'image/webp');
      return { url };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        'IMAGE_UPLOAD_FAILED',
        `Failed to process category image: ${err.message}`,
        500
      );
    }
  }

  async deleteCategoryImageFile(params: { orgId: string; categoryId: string }): Promise<void> {
    const { orgId, categoryId } = params;
    try {
      await this.storage.deleteFile(`categories/${orgId}/${categoryId}.webp`);
    } catch (err: any) {
      console.error(`[StorageCleanup] Failed to delete category image categories/${orgId}/${categoryId}.webp:`, err);
    }
  }
}

export const imageUploadService = new ImageUploadService();
