import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImageUploadService } from '../../src/modules/inventory/image-upload-service.js';
import { LocalStorageProvider } from '../../src/lib/storage.js';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('ImageUploadService (Unit Tests)', () => {
  let tmpDir: string;
  let service: ImageUploadService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orvio-image-test-'));
    const storage = new LocalStorageProvider(tmpDir, '/uploads');
    service = new ImageUploadService(storage);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('rejects unsupported image MIME types', async () => {
    const fakeBuffer = Buffer.from('not an image');
    expect(() =>
      service.validateImage(fakeBuffer, 'application/pdf')
    ).toThrow(/Unsupported image type/);
  });

  it('rejects files larger than 10MB', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    expect(() =>
      service.validateImage(largeBuffer, 'image/jpeg')
    ).toThrow(/exceeds maximum limit of 10MB/);
  });

  it('processes image with cascading downscale and returns timing metrics', async () => {
    // Generate a test 1500x1000 PNG image
    const testImageBuffer = await sharp({
      create: {
        width: 1500,
        height: 1000,
        channels: 4,
        background: { r: 50, g: 120, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.processAndSaveProductImage({
      orgId: 'test-org-1',
      productId: 'test-prod-1',
      fileBuffer: testImageBuffer,
      originalFilename: 'hero-product.png',
      mimeType: 'image/png',
    });

    expect(result.imageId).toBeDefined();
    expect(result.url).toContain('.png');
    expect(result.thumbnail_200).toContain('-200.webp');
    expect(result.thumbnail_400).toContain('-400.webp');
    expect(result.thumbnail_800).toContain('-800.webp');
    expect(result.thumbnail_1200).toContain('-1200.webp');
    expect(result.sharpDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.storageDurationMs).toBeGreaterThanOrEqual(0);

    // Verify generated thumbnail on disk is indeed WebP and within 400x400
    const thumb400Path = path.join(
      tmpDir,
      `products/test-org-1/test-prod-1/${result.imageId}-400.webp`
    );
    const thumb400Metadata = await sharp(thumb400Path).metadata();
    expect(thumb400Metadata.format).toBe('webp');
    expect(thumb400Metadata.width).toBeLessThanOrEqual(400);
    expect(thumb400Metadata.height).toBeLessThanOrEqual(400);
  });

  it('processes category image and resizes to 400px WebP', async () => {
    const testImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 1 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.processAndSaveCategoryImage({
      orgId: 'test-org-1',
      categoryId: 'cat-123',
      fileBuffer: testImageBuffer,
      mimeType: 'image/jpeg',
    });

    expect(result.url).toBe('/uploads/categories/test-org-1/cat-123.webp');
    const catImagePath = path.join(tmpDir, 'categories/test-org-1/cat-123.webp');
    const meta = await sharp(catImagePath).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(400);
  });

  it('deletes image files and directory cleanly', async () => {
    const testImageBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.processAndSaveProductImage({
      orgId: 'test-org-2',
      productId: 'test-prod-2',
      fileBuffer: testImageBuffer,
      originalFilename: 'sample.png',
      mimeType: 'image/png',
    });

    await service.deleteProductImageFiles({
      orgId: 'test-org-2',
      productId: 'test-prod-2',
      imageId: result.imageId,
      ext: 'png',
    });

    await service.deleteProductDirectory({
      orgId: 'test-org-2',
      productId: 'test-prod-2',
    });

    const dirExists = await fs
      .access(path.join(tmpDir, 'products/test-org-2/test-prod-2'))
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(false);
  });
});
