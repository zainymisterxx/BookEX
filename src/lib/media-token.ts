import crypto from 'crypto';

export type MediaUploadType = 'bookImage' | 'userAvatar' | 'communityImage' | 'organizationImage';
export type MediaResourceType = 'book' | 'user' | 'community';

export interface MediaUploadTokenPayload {
  sub: string;
  uploadType: MediaUploadType;
  resourceType?: MediaResourceType;
  resourceId?: string;
  accessLevel: 'public' | 'private' | 'restricted';
  iat: number;
  exp: number;
  nonce: string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function hmac(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function signMediaUploadToken(payload: Omit<MediaUploadTokenPayload, 'iat' | 'exp' | 'nonce'>, secret: string, expiresInSeconds = 300): string {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: MediaUploadTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = hmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyMediaUploadToken(token: string, secret: string): MediaUploadTokenPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = hmac(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as MediaUploadTokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
