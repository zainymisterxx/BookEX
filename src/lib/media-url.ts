const DEFAULT_MEDIA_PUBLIC_URL = process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL || 'https://media.farya.pk';

export function getMediaPublicBaseUrl(): string {
  return DEFAULT_MEDIA_PUBLIC_URL.replace(/\/+$/, '');
}

export function isMediaPublicUrl(value: string): boolean {
  const baseUrl = getMediaPublicBaseUrl();
  return typeof value === 'string' && (value.startsWith(`${baseUrl}/uploads/`) || value.startsWith('/uploads/'));
}

export function normalizeMediaUrl(value: string): string {
  if (!value) {
    return value;
  }

  if (value.startsWith('data:image/')) {
    throw new Error('Base64 image data is not allowed. Upload the file to the media service first.');
  }

  if (value.startsWith('/uploads/')) {
    return `${getMediaPublicBaseUrl()}${value}`;
  }

  if (isMediaPublicUrl(value)) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  throw new Error('Invalid media URL. Expected a media URL or uploaded file path.');
}
