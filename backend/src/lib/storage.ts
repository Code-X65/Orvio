import fs from 'node:fs/promises';
import path from 'node:path';

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

export const defaultStorage = new LocalStorageProvider();
