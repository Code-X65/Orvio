import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStorageProvider, SupabaseStorageProvider } from '../../src/lib/storage.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Storage Providers (Unit Tests)', () => {
  describe('LocalStorageProvider', () => {
    let tmpDir: string;
    let provider: LocalStorageProvider;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orvio-storage-test-'));
      provider = new LocalStorageProvider(tmpDir, '/uploads');
    });

    it('saves a file and returns relative url', async () => {
      const buffer = Buffer.from('hello world');
      const url = await provider.saveFile('products/org1/prod1/image.png', buffer, 'image/png');

      expect(url).toBe('/uploads/products/org1/prod1/image.png');
      const exists = await provider.fileExists('products/org1/prod1/image.png');
      expect(exists).toBe(true);
    });

    it('detects and prevents path traversal', async () => {
      const buffer = Buffer.from('exploit');
      await expect(provider.saveFile('../../../etc/passwd', buffer)).rejects.toThrow(
        /Path traversal attempt detected/
      );
    });

    it('deletes file and directory', async () => {
      const buffer = Buffer.from('file to delete');
      await provider.saveFile('test/dir/item.txt', buffer);

      const deleted = await provider.deleteFile('test/dir/item.txt');
      expect(deleted).toBe(true);

      const exists = await provider.fileExists('test/dir/item.txt');
      expect(exists).toBe(false);

      const dirDeleted = await provider.deleteDirectory('test/dir');
      expect(dirDeleted).toBe(true);
    });
  });

  describe('SupabaseStorageProvider', () => {
    it('initializes with custom options and generates public URLs', () => {
      const provider = new SupabaseStorageProvider({
        supabaseUrl: 'https://xyzcompany.supabase.co',
        supabaseKey: 'test-service-role-key-1234567890',
        bucket: 'custom-media',
      });

      const url = provider.getUrl('products/org-123/prod-456/hero.webp');
      expect(url).toBe(
        'https://xyzcompany.supabase.co/storage/v1/object/public/custom-media/products/org-123/prod-456/hero.webp'
      );
    });

    it('strips leading slashes from file paths', () => {
      const provider = new SupabaseStorageProvider({
        supabaseUrl: 'https://xyzcompany.supabase.co',
        supabaseKey: 'test-service-role-key-1234567890',
        bucket: 'custom-media',
      });

      const url = provider.getUrl('/products/org-123/prod-456/hero.webp');
      expect(url).toBe(
        'https://xyzcompany.supabase.co/storage/v1/object/public/custom-media/products/org-123/prod-456/hero.webp'
      );
    });

    it('throws error when credentials are not configured', () => {
      expect(() => {
        new SupabaseStorageProvider({
          supabaseUrl: '',
          supabaseKey: '',
        });
      }).toThrow(/Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    });
  });
});
