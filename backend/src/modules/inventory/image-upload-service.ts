import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { AppError } from '../../lib/errors.js';
import { defaultStorage, type StorageService } from '../../lib/storage.js';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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

export class ImageUploadService {
  constructor(private storage: StorageService = defaultStorage) {}

  validateImage(fileBuffer: Buffer, mimeType: string) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      throw new AppError(
        'INVALID_IMAGE_TYPE',
        `Unsupported image type: ${mimeType}. Allowed formats are JPEG, PNG, and WebP.`,
        400
      );
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        'IMAGE_FILE_TOO_LARGE',
        `Image file size exceeds maximum limit of 10MB.`,
        413
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
      // 1. Cascading downscaling with Sharp
      const sharpStart = Date.now();
      const instance = sharp(fileBuffer);
      const metadata = await instance.metadata();
      const origWidth = metadata.width || 2000;
      const origHeight = metadata.height || 2000;

      const webpOptions = { quality: 80, effort: 3 };

      // Cascade: Original -> 1200px WebP -> 800px WebP -> 400px WebP -> 200px WebP
      const thumb1200 = await instance
        .clone()
        .resize(Math.min(1200, origWidth), Math.min(1200, origHeight), {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp(webpOptions)
        .toBuffer();

      const thumb800 = await sharp(thumb1200)
        .resize(Math.min(800, origWidth), Math.min(800, origHeight), {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp(webpOptions)
        .toBuffer();

      const thumb400 = await sharp(thumb800)
        .resize(Math.min(400, origWidth), Math.min(400, origHeight), {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp(webpOptions)
        .toBuffer();

      const thumb200 = await sharp(thumb400)
        .resize(Math.min(200, origWidth), Math.min(200, origHeight), {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp(webpOptions)
        .toBuffer();

      const sharpDurationMs = Date.now() - sharpStart;

      // 2. Parallel storage writes for original + 4 thumbnails
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

    for (const extension of uniqueExts) {
      await this.storage.deleteFile(`${basePath}/${imageId}.${extension}`).catch(() => {});
    }

    await Promise.all([
      this.storage.deleteFile(`${basePath}/${imageId}-200.webp`).catch(() => {}),
      this.storage.deleteFile(`${basePath}/${imageId}-400.webp`).catch(() => {}),
      this.storage.deleteFile(`${basePath}/${imageId}-800.webp`).catch(() => {}),
      this.storage.deleteFile(`${basePath}/${imageId}-1200.webp`).catch(() => {}),
    ]);
  }

  async deleteProductDirectory(params: { orgId: string; productId: string }): Promise<void> {
    const { orgId, productId } = params;
    await this.storage.deleteDirectory(`products/${orgId}/${productId}`).catch(() => {});
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
      const resized = await sharp(fileBuffer)
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
    await this.storage.deleteFile(`categories/${orgId}/${categoryId}.webp`).catch(() => {});
  }
}

export const imageUploadService = new ImageUploadService();
