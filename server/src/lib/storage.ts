import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

/**
 * Storage abstraction for uploaded diagram files. The PRD leaves the object
 * storage provider open (open question #3 in the design doc), so the API only
 * depends on this interface; swap LocalDiskStorage for an S3-compatible
 * driver later without touching the routes.
 */

export interface StoredFile {
  url: string;
  key: string;
}

export interface StorageDriver {
  save(buffer: Buffer, mimeType: string, originalName: string): Promise<StoredFile>;
}

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
};

/** Validate the file's magic bytes, not just the client-declared MIME type. */
export function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return (
      buffer.length > 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'application/pdf') {
    return buffer.length > 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
  return false;
}

export class LocalDiskStorage implements StorageDriver {
  private readonly dir: string;

  constructor(dir: string = config.uploadDir) {
    this.dir = dir;
  }

  async save(buffer: Buffer, mimeType: string, _originalName: string): Promise<StoredFile> {
    const extension = EXTENSIONS[mimeType] ?? '.bin';
    const key = `${randomUUID()}${extension}`;
    await mkdir(path.resolve(this.dir), { recursive: true });
    await writeFile(path.join(path.resolve(this.dir), key), buffer);
    return { url: `/uploads/${key}`, key };
  }
}

export const storage: StorageDriver = new LocalDiskStorage();

export function uploadDir(): string {
  return path.resolve(config.uploadDir);
}
