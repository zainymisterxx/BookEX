/**
 * Image Upload API Route
 * Handles secure image uploads to Cloudinary for messages, posts, and profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { uploadImageToCloudinary, uploadMultipleImages, isCloudinaryConfigured } from '@/lib/cloudinary-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/image
 * Upload single or multiple images to Cloudinary
 * 
 * Body (multipart/form-data):
 * - image: File (single file)
 * - images: File[] (multiple files)
 * - folder: 'messages' | 'posts' | 'profiles' | 'communities'
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Cloudinary configuration
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Image upload service not configured. Please add Cloudinary credentials.' 
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const folder = (formData.get('folder') as string) || 'messages';
    
    // Validate folder parameter
    const validFolders = ['messages', 'posts', 'profiles', 'communities'];
    if (!validFolders.includes(folder)) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder parameter' },
        { status: 400 }
      );
    }

    // Check if single or multiple files
    const singleFile = formData.get('image') as File;
    const multipleFiles = formData.getAll('images') as File[];

    // Handle single file upload
    if (singleFile && singleFile.size > 0) {
      const result = await uploadImageToCloudinary(
        singleFile, 
        folder as any, 
        session.user.id
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        url: result.url
      });
    }

    // Handle multiple files upload
    if (multipleFiles.length > 0) {
      // Filter out empty files
      const validFiles = multipleFiles.filter(file => file.size > 0);
      
      if (validFiles.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No valid files provided' },
          { status: 400 }
        );
      }

      // Limit to 5 images per upload
      if (validFiles.length > 5) {
        return NextResponse.json(
          { success: false, error: 'Maximum 5 images allowed per upload' },
          { status: 400 }
        );
      }

      const result = await uploadMultipleImages(
        validFiles,
        folder as any,
        session.user.id
      );

      if (!result.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to upload images',
            errors: result.errors 
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        urls: result.urls,
        errors: result.errors // Partial success errors
      });
    }

    return NextResponse.json(
      { success: false, error: 'No image file provided' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Image upload API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during image upload' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/image
 * Check if image upload is configured
 */
export async function GET() {
  return NextResponse.json({
    configured: isCloudinaryConfigured(),
    message: isCloudinaryConfigured() 
      ? 'Image upload service is ready' 
      : 'Image upload service not configured'
  });
}
