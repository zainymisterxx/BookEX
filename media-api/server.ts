import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import { ensureImageStorageDirectories, getImageStorageRoot, IMAGE_STORAGE_CATEGORIES } from './storage';
import { verifyMediaUploadToken, type MediaUploadType } from './media-token';

const HOST = process.env.MEDIA_BIND_HOST || '0.0.0.0';
const PORT = Number(process.env.MEDIA_PORT || 4010);
const PUBLIC_BASE_URL = (process.env.MEDIA_PUBLIC_URL || 'https://media.farya.pk').replace(/\/+$/, '');
const STORAGE_ROOT = process.env.MEDIA_STORAGE_ROOT || process.env.BOOKEX_UPLOAD_ROOT || '/var/www/bookex/uploads';
const MEDIA_API_SECRET = process.env.MEDIA_API_SECRET || '';

type UploadConfig = {
  category: (typeof IMAGE_STORAGE_CATEGORIES)[number];
  maxSize: number;
  allowedTypes: Set<string>;
};

const UPLOAD_CONFIGS: Record<MediaUploadType, UploadConfig> = {
  bookImage: {
    category: 'books',
    maxSize: 5 * 1024 * 1024,
    allowedTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
  userAvatar: {
    category: 'profiles',
    maxSize: 2 * 1024 * 1024,
    allowedTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
  communityImage: {
    category: 'communities',
    maxSize: 5 * 1024 * 1024,
    allowedTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
  organizationImage: {
    category: 'communities',
    maxSize: 5 * 1024 * 1024,
    allowedTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  },
};

function json(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sanitizeBaseName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .toLowerCase();
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}

function getUploadRoot(): string {
  return STORAGE_ROOT;
}

async function readJsonBody(request: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function handleUpload(request: http.IncomingMessage, response: http.ServerResponse) {
  if (!MEDIA_API_SECRET) {
    return json(response, 500, { success: false, message: 'MEDIA_API_SECRET is not configured' });
  }

  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const tokenPayload = token ? verifyMediaUploadToken(token, MEDIA_API_SECRET) : null;

  if (!tokenPayload) {
    return json(response, 401, { success: false, message: 'Invalid or expired upload token' });
  }

  const expectedConfig = UPLOAD_CONFIGS[tokenPayload.uploadType];
  if (!expectedConfig) {
    return json(response, 400, { success: false, message: 'Unsupported upload type' });
  }

  const requestUrl = `http://${request.headers.host || 'localhost'}/api/uploads`;
  const webRequest = new Request(requestUrl, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body: Readable.toWeb(request) as unknown as ReadableStream,
    duplex: 'half' as never,
  });

  const formData = await webRequest.formData();
  const file = formData.get('file');
  const uploadType = formData.get('uploadType');

  if (!(file instanceof File)) {
    return json(response, 400, { success: false, message: 'No file provided' });
  }

  if (uploadType !== tokenPayload.uploadType) {
    return json(response, 400, { success: false, message: 'Upload type mismatch' });
  }

  if (!expectedConfig.allowedTypes.has(file.type)) {
    return json(response, 400, { success: false, message: 'Only JPEG, PNG, and WebP images are allowed' });
  }

  if (file.size > expectedConfig.maxSize) {
    return json(response, 413, { success: false, message: `File size exceeds limit of ${Math.round(expectedConfig.maxSize / 1024 / 1024)}MB` });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const detectedType = await fileTypeFromBuffer(fileBuffer);
  const detectedMimeType = detectedType?.mime || file.type;

  if (!expectedConfig.allowedTypes.has(detectedMimeType)) {
    return json(response, 400, { success: false, message: 'File content does not match an allowed image type' });
  }

  if (detectedMimeType !== file.type) {
    return json(response, 400, { success: false, message: 'File MIME type mismatch' });
  }

  await ensureImageStorageDirectories();

  const originalName = file.name || 'image';
  const safeBase = sanitizeBaseName(path.parse(originalName).name) || 'image';
  const fileName = `${safeBase}-${Date.now()}-${crypto.randomUUID()}${extensionForMimeType(detectedMimeType)}`;
  const storageDir = path.join(getUploadRoot(), expectedConfig.category);
  const storagePath = path.join(storageDir, fileName);
  await mkdir(storageDir, { recursive: true, mode: 0o755 });
  await writeFile(storagePath, fileBuffer, { mode: 0o644 });

  const publicUrl = `${PUBLIC_BASE_URL}/uploads/${expectedConfig.category}/${fileName}`;

  return json(response, 200, {
    success: true,
    data: {
      fileId: crypto.randomUUID(),
      url: publicUrl,
      originalName,
      size: fileBuffer.length,
      mimeType: detectedMimeType,
      uploadedAt: new Date().toISOString(),
      storagePath,
    },
  });
}

async function handleDelete(request: http.IncomingMessage, response: http.ServerResponse) {
  if (!MEDIA_API_SECRET) {
    return json(response, 500, { success: false, message: 'MEDIA_API_SECRET is not configured' });
  }

  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const tokenPayload = token ? verifyMediaUploadToken(token, MEDIA_API_SECRET) : null;

  if (!tokenPayload) {
    return json(response, 401, { success: false, message: 'Invalid or expired upload token' });
  }

  const body = await readJsonBody(request);
  const targetUrl = String(body.url || body.publicUrl || '');

  if (!targetUrl.startsWith(`${PUBLIC_BASE_URL}/uploads/`)) {
    return json(response, 400, { success: false, message: 'Invalid media URL' });
  }

  const relativePath = targetUrl.replace(`${PUBLIC_BASE_URL}/uploads/`, '');
  const absolutePath = path.join(getUploadRoot(), relativePath);

  try {
    await access(absolutePath, fsConstants.F_OK);
    await rm(absolutePath, { force: true });
    return json(response, 200, { success: true });
  } catch {
    return json(response, 404, { success: false, message: 'File not found' });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (request.method === 'GET' && url.pathname === '/health') {
    return json(response, 200, {
      success: true,
      service: 'bookex-media-api',
      storageRoot: getUploadRoot(),
      publicBaseUrl: PUBLIC_BASE_URL,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/uploads') {
    try {
      return await handleUpload(request, response);
    } catch (error) {
      console.error('Upload failed:', error);
      return json(response, 500, { success: false, message: 'Upload failed' });
    }
  }

  if (request.method === 'DELETE' && url.pathname === '/api/uploads') {
    try {
      return await handleDelete(request, response);
    } catch (error) {
      console.error('Delete failed:', error);
      return json(response, 500, { success: false, message: 'Delete failed' });
    }
  }

  return json(response, 404, { success: false, message: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`BookEx media API listening on http://${HOST}:${PORT}`);
});
