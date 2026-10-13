import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  ImageUploadService,
  detectMimeTypeFromBuffer,
  MAX_FILE_SIZE_BYTES,
  MAX_DIMENSION_PX,
} from '../../src/modules/inventory/image-upload-service.js';
import { AppError } from '../../src/lib/errors.js';

describe('Image Upload Security & Validation', () => {
  const service = new ImageUploadService();

  it('detects MIME types accurately from raw binary magic bytes', async () => {
    // 1. Synthetic PNG
    const pngBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();
    expect(detectMimeTypeFromBuffer(pngBuffer)).toBe('image/png');

    // 2. Synthetic JPEG
    const jpegBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).jpeg().toBuffer();
    expect(detectMimeTypeFromBuffer(jpegBuffer)).toBe('image/jpeg');

    // 3. Synthetic WebP
    const webpBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).webp().toBuffer();
    expect(detectMimeTypeFromBuffer(webpBuffer)).toBe('image/webp');

    // 4. Non-image text/html
    const textBuffer = Buffer.from('<html><script>alert("xss")</script></html>');
    expect(detectMimeTypeFromBuffer(textBuffer)).toBeNull();
  });

  it('passes validation for authentic PNG, JPEG, and WebP images', async () => {
    const pngBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 100, b: 100 } },
    }).png().toBuffer();

    const jpegBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 100, b: 100 } },
    }).jpeg().toBuffer();

    expect(() => service.validateImage(pngBuffer, 'image/png')).not.toThrow();
    expect(() => service.validateImage(jpegBuffer, 'image/jpeg')).not.toThrow();
    expect(() => service.validateImage(jpegBuffer, 'image/jpg')).not.toThrow();
  });

  it('rejects spoofed MIME types when text/script payload is sent as image/jpeg', () => {
    const maliciousPayload = Buffer.from('<?php echo "evil"; ?>');
    expect(() => service.validateImage(maliciousPayload, 'image/jpeg')).toThrowError(AppError);
    try {
      service.validateImage(maliciousPayload, 'image/jpeg');
    } catch (err: any) {
      expect(err.code).toBe('INVALID_IMAGE_TYPE');
    }
  });

  it('rejects spoofed MIME types when PNG is reported as image/jpeg', async () => {
    const pngBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    try {
      service.validateImage(pngBuffer, 'image/jpeg');
      expect.fail('Should have thrown SPOOFED_IMAGE_MIME_TYPE');
    } catch (err: any) {
      expect(err.code).toBe('SPOOFED_IMAGE_MIME_TYPE');
    }
  });

  it('rejects payloads exceeding the 10MB size limit', () => {
    const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
    try {
      service.validateImage(oversizedBuffer, 'image/jpeg');
      expect.fail('Should have thrown IMAGE_FILE_TOO_LARGE');
    } catch (err: any) {
      expect(err.code).toBe('IMAGE_FILE_TOO_LARGE');
      expect(err.statusCode).toBe(413);
    }
  });

  it('rejects images exceeding the 4096px maximum dimension limit', async () => {
    // Synthetic 4097 x 100 image
    const wideBuffer = await sharp({
      create: { width: MAX_DIMENSION_PX + 1, height: 100, channels: 3, background: { r: 50, g: 50, b: 50 } },
    }).png().toBuffer();

    await expect(
      service.processAndSaveProductImage({
        orgId: 'test_org',
        productId: 'test_prod',
        fileBuffer: wideBuffer,
        mimeType: 'image/png',
      })
    ).rejects.toThrowError(AppError);

    try {
      await service.processAndSaveProductImage({
        orgId: 'test_org',
        productId: 'test_prod',
        fileBuffer: wideBuffer,
        mimeType: 'image/png',
      });
    } catch (err: any) {
      expect(err.code).toBe('IMAGE_DIMENSIONS_TOO_LARGE');
      expect(err.statusCode).toBe(422);
    }
  });

  it('rejects corrupted image data during Sharp processing with MALFORMED_IMAGE', async () => {
    // Valid PNG signature followed by truncated/garbage bytes
    const brokenPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // truncated IHDR
    ]);

    await expect(
      service.processAndSaveProductImage({
        orgId: 'test_org',
        productId: 'test_prod',
        fileBuffer: brokenPng,
        mimeType: 'image/png',
      })
    ).rejects.toThrowError(AppError);

    try {
      await service.processAndSaveProductImage({
        orgId: 'test_org',
        productId: 'test_prod',
        fileBuffer: brokenPng,
        mimeType: 'image/png',
      });
    } catch (err: any) {
      expect(err.code).toBe('MALFORMED_IMAGE');
      expect(err.statusCode).toBe(400);
    }
  });
});
