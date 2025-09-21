/**
 * Secure file upload API endpoint
 * Handles file uploads with comprehensive security validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { SecureFileManager, FILE_CONFIGS, type SecureFileMetadata } from '@/lib/secure-file-manager';
import { createAppError, ErrorType, handleApiError } from '@/lib/error-handling';
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limiting';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return handleApiError(createAppError(ErrorType.AUTHENTICATION, 'Authentication required'));
    }

    const user = {
      id: session.user.id,
      role: (session.user.role as 'user' | 'admin') || 'user',
      status: (session.user.status as 'active' | 'suspended' | 'deactivated') || 'active'
    };

    // 2. Rate limiting check
    const rateLimitResult = await checkUserRateLimit(user.id, 'FILE_UPLOAD', RATE_LIMITS.FILE_UPLOAD);
    if (!rateLimitResult.allowed) {
      return handleApiError(createAppError(
        ErrorType.RATE_LIMIT,
        `Upload rate limit exceeded. Try again in ${Math.ceil(rateLimitResult.resetTime / 1000)} seconds`
      ));
    }

    // 3. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadType = formData.get('uploadType') as string;
    const associatedResourceType = formData.get('resourceType') as string;
    const associatedResourceId = formData.get('resourceId') as string;
    const accessLevel = formData.get('accessLevel') as 'public' | 'private' | 'restricted' || 'private';

    // 4. Validate required fields
    if (!file) {
      return handleApiError(createAppError(ErrorType.VALIDATION, 'No file provided'));
    }

    if (!uploadType || !FILE_CONFIGS[uploadType]) {
      return handleApiError(createAppError(
        ErrorType.VALIDATION,
        `Invalid upload type. Allowed: ${Object.keys(FILE_CONFIGS).join(', ')}`
      ));
    }

    // 5. Get upload configuration
    const config = FILE_CONFIGS[uploadType];

    // 6. Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 7. Validate file against security policies
    const validation = await SecureFileManager.validateFile(fileBuffer, file.name, config);
    if (!validation.isValid) {
      return handleApiError(createAppError(
        ErrorType.VALIDATION,
        `File validation failed: ${validation.errors.join(', ')}`
      ));
    }

    // 8. Perform virus scan if enabled
    let scanResult;
    let scanStatus: 'pending' | 'clean' | 'infected' | 'error' = 'pending';

    if (config.virusScanEnabled) {
      try {
        scanResult = await SecureFileManager.performVirusScan(fileBuffer, file.name);
        scanStatus = scanResult.isClean ? 'clean' : 'infected';

        if (!scanResult.isClean) {
          return handleApiError(createAppError(
            ErrorType.SECURITY,
            `File rejected - security threats detected: ${scanResult.threats.join(', ')}`
          ));
        }
      } catch (error) {
        scanStatus = 'error';
        console.error('Virus scan failed:', error);
        
        // In production, you might want to quarantine files with scan errors
        return handleApiError(createAppError(
          ErrorType.SECURITY,
          'Security scan failed - file cannot be uploaded'
        ));
      }
    } else {
      scanStatus = 'clean'; // Skip scanning for this upload type
    }

    // 9. Prepare file metadata
    const metadata: Omit<SecureFileMetadata, 'id' | 'hash' | 'uploadedAt' | 'storageLocation'> = {
      originalName: file.name,
      mimeType: file.type,
      size: fileBuffer.length,
      uploadedBy: user.id,
      scanStatus,
      scanResult,
      accessLevel,
      ...(associatedResourceType && associatedResourceId && {
        associatedResource: {
          type: associatedResourceType as 'book' | 'user' | 'community',
          id: associatedResourceId
        }
      })
    };

    // 10. Store file securely
    const storedFile = await SecureFileManager.secureStore(fileBuffer, metadata);

    // 11. Return success response
    return NextResponse.json({
      success: true,
      data: {
        fileId: storedFile.id,
        originalName: storedFile.originalName,
        size: storedFile.size,
        mimeType: storedFile.mimeType,
        uploadedAt: storedFile.uploadedAt,
        scanStatus: storedFile.scanStatus,
        accessLevel: storedFile.accessLevel
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return handleApiError(createAppError(ErrorType.AUTHENTICATION, 'Authentication required'));
    }

    const user = {
      id: session.user.id,
      role: (session.user.role as 'user' | 'admin') || 'user',
      status: (session.user.status as 'active' | 'suspended' | 'deactivated') || 'active'
    };

    // 2. Get file ID from query parameters
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return handleApiError(createAppError(ErrorType.VALIDATION, 'File ID required'));
    }

    // 3. Rate limiting for downloads
    const rateLimitResult = await checkUserRateLimit(user.id, 'FILE_DOWNLOAD', RATE_LIMITS.FILE_DOWNLOAD);
    if (!rateLimitResult.allowed) {
      return handleApiError(createAppError(
        ErrorType.RATE_LIMIT,
        `Download rate limit exceeded. Try again in ${Math.ceil(rateLimitResult.resetTime / 1000)} seconds`
      ));
    }

    // 4. Retrieve file with access control
    const fileData = await SecureFileManager.getSecureFile(fileId, user);
    
    if (!fileData) {
      return handleApiError(createAppError(ErrorType.NOT_FOUND, 'File not found'));
    }

    // 5. Return file with appropriate headers
    const response = new NextResponse(new Uint8Array(fileData.buffer));
    
    response.headers.set('Content-Type', fileData.metadata.mimeType);
    response.headers.set('Content-Length', fileData.metadata.size.toString());
    response.headers.set('Content-Disposition', `attachment; filename="${fileData.metadata.originalName}"`);
    
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error) {
    console.error('File download error:', error);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return handleApiError(createAppError(ErrorType.AUTHENTICATION, 'Authentication required'));
    }

    const user = {
      id: session.user.id,
      role: (session.user.role as 'user' | 'admin') || 'user',
      status: (session.user.status as 'active' | 'suspended' | 'deactivated') || 'active'
    };

    // 2. Get file ID from request body
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return handleApiError(createAppError(ErrorType.VALIDATION, 'File ID required'));
    }

    // 3. Delete file with access control
    await SecureFileManager.deleteSecureFile(fileId, user);

    // 4. Return success response
    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('File deletion error:', error);
    return handleApiError(error);
  }
}
