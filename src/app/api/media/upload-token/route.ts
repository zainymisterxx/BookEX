import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { createAppError, ErrorType, handleApiError } from '@/lib/error-handling';
import { signMediaUploadToken, type MediaUploadType, type MediaResourceType } from '@/lib/media-token';

const ALLOWED_UPLOAD_TYPES: MediaUploadType[] = ['bookImage', 'userAvatar', 'communityImage', 'organizationImage'];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return handleApiError(createAppError(ErrorType.AUTHENTICATION, 'Authentication required'));
    }

    const body = await request.json().catch(() => ({}));
    const uploadType = body.uploadType as MediaUploadType;
    const resourceType = body.resourceType as MediaResourceType | undefined;
    const resourceId = body.resourceId as string | undefined;
    const accessLevel = (body.accessLevel as 'public' | 'private' | 'restricted') || 'public';

    if (!uploadType || !ALLOWED_UPLOAD_TYPES.includes(uploadType)) {
      return handleApiError(createAppError(ErrorType.VALIDATION, `Invalid upload type. Allowed: ${ALLOWED_UPLOAD_TYPES.join(', ')}`));
    }

    if (process.env.NODE_ENV === 'production' && !process.env.MEDIA_API_SECRET) {
      return handleApiError(createAppError(ErrorType.INTERNAL, 'MEDIA_API_SECRET is not configured'));
    }

    const token = signMediaUploadToken(
      {
        sub: session.user.id,
        uploadType,
        resourceType,
        resourceId,
        accessLevel,
      },
      process.env.MEDIA_API_SECRET || 'dev-media-secret'
    );

    return NextResponse.json({
      success: true,
      data: {
        token,
        uploadUrl: `${(process.env.NEXT_PUBLIC_MEDIA_API_URL || 'https://media.farya.pk').replace(/\/+$/, '')}/api/uploads`,
        publicBaseUrl: (process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL || 'https://media.farya.pk').replace(/\/+$/, ''),
        expiresInSeconds: 300,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
