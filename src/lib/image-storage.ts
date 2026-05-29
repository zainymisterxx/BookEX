import crypto from 'crypto';
import path from 'path';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
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

const DEFAULT_UPLOAD_ROOT = process.env.BOOKEX_UPLOAD_ROOT || '/var/www/bookex/uploads';
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

export function getImageStoragePathFromPublicUrl(publicUrl: string): string | null {
  if (!publicUrl || typeof publicUrl !== 'string') {
    return null;
  }

  if (!publicUrl.startsWith(PUBLIC_UPLOAD_PREFIX)) {
    return null;
  }

  const safeRelativePath = publicUrl.replace(/^\/+/, '');
  const absolutePath = path.resolve(DEFAULT_UPLOAD_ROOT, path.relative('uploads', safeRelativePath));
  const rootPath = path.resolve(DEFAULT_UPLOAD_ROOT);

  if (!absolutePath.startsWith(rootPath)) {
    return null;
  }

  return absolutePath;
}

export function isImagePublicUrl(value: string): boolean {
  return typeof value === 'string' && value.startsWith('/uploads/');
}

export function isRemoteImageUrl(value: string): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
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

export async function storeImageFile(
  file: File,
  category: ImageStorageCategory
): Promise<StoredImageResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return writeStoredBuffer(buffer, file.name, category, file.type);
}

export async function storeImageDataUri(
  dataUri: string,
  category: ImageStorageCategory,
  originalName = 'image'
): Promise<StoredImageResult> {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid image data URI');
  }

  const [, mimeType, base64Data] = match;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }

  const buffer = Buffer.from(base64Data, 'base64');
  return writeStoredBuffer(buffer, originalName, category, mimeType);
}

export async function normalizeImageReference(
  value: string,
  category: ImageStorageCategory,
  originalName = 'image'
): Promise<string> {
  if (!value) {
    return value;
  }

  if (value.startsWith('data:image/')) {
    const stored = await storeImageDataUri(value, category, originalName);
    return stored.publicUrl;
  }

  if (isImagePublicUrl(value) || isRemoteImageUrl(value)) {
    return value;
  }

  throw new Error('Image reference must be a data URI, public upload path, or remote URL');
}

export async function deleteStoredImage(publicUrl: string): Promise<void> {
  const absolutePath = getImageStoragePathFromPublicUrl(publicUrl);
  if (!absolutePath) {
    return;
  }

  await rm(absolutePath, { force: true });
}

export async function readStoredImage(publicUrl: string): Promise<Buffer | null> {
  const absolutePath = getImageStoragePathFromPublicUrl(publicUrl);
  if (!absolutePath) {
    return null;
  }

  return readFile(absolutePath).catch(() => null);
}
