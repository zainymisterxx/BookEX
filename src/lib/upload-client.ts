export type UploadImageType = 'bookImage' | 'userAvatar' | 'communityImage' | 'organizationImage';

export interface UploadImageResponse {
  url: string;
  fileId: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export async function uploadImageFile(
  file: File,
  uploadType: UploadImageType,
  resourceType?: 'book' | 'user' | 'community',
  resourceId?: string,
  accessLevel: 'public' | 'private' | 'restricted' = 'public'
): Promise<UploadImageResponse> {
  const mediaApiBaseUrl = (process.env.NEXT_PUBLIC_MEDIA_API_URL || 'https://media.farya.pk').replace(/\/+$/, '');

  const tokenResponse = await fetch('/api/media/upload-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      uploadType,
      resourceType,
      resourceId,
      accessLevel,
    }),
  });

  const tokenPayload = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenPayload?.success || !tokenPayload?.data?.token) {
    throw new Error(tokenPayload?.message || 'Could not create upload token');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadType', uploadType);

  if (resourceType) {
    formData.append('resourceType', resourceType);
  }

  if (resourceId) {
    formData.append('resourceId', resourceId);
  }

  formData.append('accessLevel', accessLevel);

  const response = await fetch(`${mediaApiBaseUrl}/api/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenPayload.data.token}`,
    },
    body: formData,
    credentials: 'include',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload?.data?.url) {
    throw new Error(payload?.message || 'Image upload failed');
  }

  return payload.data as UploadImageResponse;
}
