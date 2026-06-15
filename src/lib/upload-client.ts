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
  _uploadType?: UploadImageType,
  _resourceType?: string,
  _resourceId?: string,
  _accessLevel?: string
): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || !payload?.data?.url) {
    throw new Error(payload?.message || 'Image upload failed');
  }

  return payload.data as UploadImageResponse;
}
