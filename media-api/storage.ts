import crypto from 'crypto';
import path from 'path';
import process from 'process';
import { Buffer } from 'buffer';
import { mkdir, rm, writeFile } from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';

export const IMAGE_STORAGE_CATEGORIES = ['books', 'profiles', 'communities', 'temp'] as const;

export type ImageStorageCategory = (typeof IMAGE_STORAGE_CATEGORIES)[number];

export interface StoredImageResult {
  filename: string;
  absolutePath: string;
  publicUrl: string;
  mimeType: string;
  size: number;
}

const DEFAULT_UPLOAD_ROOT = process.env.MEDIA_STORAGE_ROOT || process.env.BOOKEX_UPLOAD_ROOT || '/var/www/bookex/uploads';
const PUBLIC_UPLOAD_PREFIX = '/uploads';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function sanitizeBaseName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .toLowerCase();
}

function sanitizeExtension(ext: string | undefined): string {
  if (!ext) return '';
  const normalized = ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
  return /^\.[a-z0-9]+$/.test(normalized) ? normalized : '';
}

function getCategoryDirectory(category: ImageStorageCategory): string {
  return path.join(DEFAULT_UPLOAD_ROOT, category);
}

export function getImageStorageRoot(): string {
  return DEFAULT_UPLOAD_ROOT;
}

export async function ensureImageStorageDirectories(): Promise<void> {
  await mkdir(DEFAULT_UPLOAD_ROOT, { recursive: true, mode: 0o755 });

  for (const category of IMAGE_STORAGE_CATEGORIES) {
    await mkdir(getCategoryDirectory(category), { recursive: true, mode: 0o755 });
  }
}

function createStoredFilename(originalName: string, mimeType: string): string {
  const parsed = path.parse(originalName);
  const safeBase = sanitizeBaseName(parsed.name) || 'image';
  const safeExtension = sanitizeExtension(parsed.ext) || MIME_TO_EXTENSION[mimeType] || '.img';
  return `${safeBase}-${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
}

async function writeStoredBuffer(
  buffer: Buffer,
  originalName: string,
  category: ImageStorageCategory,
  mimeType: string
): Promise<StoredImageResult> {
  await ensureImageStorageDirectories();

  const filename = createStoredFilename(originalName, mimeType);
  const absolutePath = path.join(getCategoryDirectory(category), filename);
  await writeFile(absolutePath, buffer, { mode: 0o644 });

  return {
    filename,
    absolutePath,
    publicUrl: `${PUBLIC_UPLOAD_PREFIX}/${category}/${filename}`,
    mimeType,
    size: buffer.length,
  };
}

export async function storeImageBuffer(
  buffer: Buffer,
  originalName: string,
  category: ImageStorageCategory
): Promise<StoredImageResult> {
  const detectedType = await fileTypeFromBuffer(buffer);
  const mimeType = detectedType?.mime || 'application/octet-stream';

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }

  return writeStoredBuffer(buffer, originalName, category, mimeType);
}

export async function deleteStoredImage(publicUrl: string): Promise<void> {
  const absolutePath = path.join(DEFAULT_UPLOAD_ROOT, publicUrl.replace(/^\/uploads\//, ''));
  await rm(absolutePath, { force: true });
}
