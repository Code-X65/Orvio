import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export interface StorageService {
  saveFile(relativePath: string, data: Buffer, mimeType?: string): Promise<string>;
  deleteFile(relativePath: string): Promise<boolean>;
  deleteDirectory(relativePath: string): Promise<boolean>;
  fileExists(relativePath: string): Promise<boolean>;
  getUrl(relativePath: string): string;
}

export class LocalStorageProvider implements StorageService {
  private baseDir: string;
  private urlPrefix: string;

  constructor(baseDir?: string, urlPrefix: string = '/uploads') {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'uploads');
    this.urlPrefix = urlPrefix.replace(/\/+$/, '');
  }

  private resolvePath(relativePath: string): string {
    const cleanRelPath = relativePath.replace(/^\/+/, '');
    const fullPath = path.resolve(this.baseDir, cleanRelPath);
    // Security check to avoid directory traversal
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error(`Path traversal attempt detected: ${relativePath}`);
    }
    return fullPath;
  }

  async saveFile(relativePath: string, data: Buffer, _mimeType?: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return this.getUrl(relativePath);
  }

  async deleteFile(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.unlink(fullPath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async deleteDirectory(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.rm(fullPath, { recursive: true, force: true });
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(relativePath: string): string {
    const cleanRelPath = relativePath.replace(/^\/+/, '');
    return `${this.urlPrefix}/${cleanRelPath}`;
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

export class SupabaseStorageProvider implements StorageService {
  private client: SupabaseClient;
  private bucket: string;
  private bucketInitPromise: Promise<void> | null = null;

  constructor(options?: {
    supabaseUrl?: string;
    supabaseKey?: string;
    bucket?: string;
  }) {
    const url = options?.supabaseUrl !== undefined ? options.supabaseUrl : env.SUPABASE_URL;
    const key = options?.supabaseKey !== undefined ? options.supabaseKey : env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = options?.bucket || env.SUPABASE_STORAGE_BUCKET || 'orvio-media';

    if (!url || !key) {
      throw new AppError(
        'STORAGE_CONFIG_ERROR',
        'Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be configured.',
        500
      );
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private cleanPath(relativePath: string): string {
    return relativePath.replace(/^\/+/, '');
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketInitPromise) {
      this.bucketInitPromise = (async () => {
        try {
          const { data: buckets } = await this.client.storage.listBuckets();
          const exists = buckets?.some((b) => b.name === this.bucket);
          if (!exists) {
            await this.client.storage.createBucket(this.bucket, {
              public: true,
              fileSizeLimit: 10485760, // 10MB
              allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            });
          }
        } catch {
          // Non-blocking: continue if bucket already exists or permissions restrict listBuckets
        }
      })();
    }
    return this.bucketInitPromise;
  }

  async saveFile(relativePath: string, data: Buffer, mimeType?: string): Promise<string> {
    await this.ensureBucket();
    const cleanPath = this.cleanPath(relativePath);

    const { error } = await this.client.storage.from(this.bucket).upload(cleanPath, data, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      throw new AppError(
        'STORAGE_UPLOAD_FAILED',
        `Failed to upload file to Supabase storage: ${error.message}`,
        500
      );
    }

    return this.getUrl(cleanPath);
  }

  async deleteFile(relativePath: string): Promise<boolean> {
    const cleanPath = this.cleanPath(relativePath);
    const { data, error } = await this.client.storage.from(this.bucket).remove([cleanPath]);
    if (error) {
      return false;
    }
    return Boolean(data && data.length > 0);
  }

  async deleteDirectory(relativePath: string): Promise<boolean> {
    const cleanPath = this.cleanPath(relativePath);
    try {
      const { data: files, error } = await this.client.storage.from(this.bucket).list(cleanPath, {
        limit: 1000,
      });

      if (error || !files || files.length === 0) {
        return false;
      }

      const pathsToDelete = files
        .filter((item) => Boolean(item.name))
        .map((item) => `${cleanPath}/${item.name}`);

      if (pathsToDelete.length > 0) {
        await this.client.storage.from(this.bucket).remove(pathsToDelete);
      }
      return true;
    } catch {
      return false;
    }
  }

  async fileExists(relativePath: string): Promise<boolean> {
    const cleanPath = this.cleanPath(relativePath);
    const lastSlashIndex = cleanPath.lastIndexOf('/');
    const dir = lastSlashIndex !== -1 ? cleanPath.substring(0, lastSlashIndex) : '';
    const filename = lastSlashIndex !== -1 ? cleanPath.substring(lastSlashIndex + 1) : cleanPath;

    const { data, error } = await this.client.storage.from(this.bucket).list(dir, {
      search: filename,
    });

    if (error || !data) return false;
    return data.some((f) => f.name === filename);
  }

  getUrl(relativePath: string): string {
    const cleanPath = this.cleanPath(relativePath);
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(cleanPath);
    return data.publicUrl;
  }
}

export function createStorageProvider(): StorageService {
  if (env.STORAGE_PROVIDER === 'supabase' && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseStorageProvider();
  }
  return new LocalStorageProvider();
}

export const defaultStorage = createStorageProvider();

