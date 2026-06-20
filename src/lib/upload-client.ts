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

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload?.data?.url) {
    throw new Error(payload?.message || 'Image upload failed');
  }

  return payload.data as UploadImageResponse;
}
