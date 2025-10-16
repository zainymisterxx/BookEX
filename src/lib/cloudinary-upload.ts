/**
 * Cloudinary Upload Utility
 * Handles secure image uploads to Cloudinary with validation, optimization, and error handling
 */

import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

// Max dimensions for optimization
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

/**
 * Validates image file before upload
 */
export function validateImage(file: File): { isValid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: 'Image size must be less than 5MB' };
  }

  // Check MIME type
  if (!ALLOWED_FORMATS.includes(file.type)) {
    return { isValid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
  }

  // Check file extension
  const extension = file.name.toLowerCase().split('.').pop();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return { isValid: false, error: 'Invalid file extension' };
  }

  // Verify extension matches MIME type
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp']
  };

  const validExtensions = mimeToExt[file.type];
  if (!validExtensions || !validExtensions.includes(extension)) {
    return { isValid: false, error: 'File extension does not match file type' };
  }

  return { isValid: true };
}

/**
 * Optimizes image buffer using Sharp
 * Resizes if too large and converts to optimal format
 */
async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize if image is too large
    if (metadata.width && metadata.height && 
        (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT)) {
      return await image
        .resize(MAX_WIDTH, MAX_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    }

    // Optimize without resizing
    return await image
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  } catch (error) {
    console.error('Image optimization error:', error);
    // Return original buffer if optimization fails
    return buffer;
  }
}

/**
 * Uploads image to Cloudinary
 * @param file - File object from form data
 * @param folder - Cloudinary folder (e.g., 'messages', 'posts', 'profiles')
 * @param userId - User ID for organizing uploads
 * @returns Promise with upload result containing secure URL
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: 'messages' | 'posts' | 'profiles' | 'communities',
  userId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validate the image
    const validation = validateImage(file);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Optimize image
    buffer = await optimizeImage(buffer);

    // Create folder path with optional userId
    const folderPath = userId ? `bookex/${folder}/${userId}` : `bookex/${folder}`;

    // Upload to Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          resource_type: 'image',
          transformation: [
            { width: MAX_WIDTH, height: MAX_HEIGHT, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ],
          // Generate unique public_id
          public_id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    return {
      success: true,
      url: result.secure_url
    };

  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload image'
    };
  }
}

/**
 * Uploads multiple images to Cloudinary
 * @param files - Array of File objects
 * @param folder - Cloudinary folder
 * @param userId - User ID for organizing uploads
 * @returns Promise with array of upload results
 */
export async function uploadMultipleImages(
  files: File[],
  folder: 'messages' | 'posts' | 'profiles' | 'communities',
  userId?: string
): Promise<{ success: boolean; urls?: string[]; errors?: string[] }> {
  try {
    const uploadPromises = files.map(file => 
      uploadImageToCloudinary(file, folder, userId)
    );

    const results = await Promise.all(uploadPromises);
    
    const urls: string[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.success && result.url) {
        urls.push(result.url);
      } else {
        errors.push(`File ${index + 1}: ${result.error || 'Upload failed'}`);
      }
    });

    if (urls.length === 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      urls,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error: any) {
    console.error('Multiple upload error:', error);
    return {
      success: false,
      errors: [error.message || 'Failed to upload images']
    };
  }
}

/**
 * Deletes an image from Cloudinary using its public_id
 * @param imageUrl - Full Cloudinary URL
 * @returns Promise with deletion result
 */
export async function deleteImageFromCloudinary(
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract public_id from URL
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const publicId = filename.split('.')[0];
    
    // Find the folder path
    const folderStartIndex = urlParts.indexOf('bookex');
    if (folderStartIndex === -1) {
      return { success: false, error: 'Invalid Cloudinary URL' };
    }
    
    const folderPath = urlParts.slice(folderStartIndex, -1).join('/');
    const fullPublicId = `${folderPath}/${publicId}`;

    await cloudinary.uploader.destroy(fullPublicId);

    return { success: true };
  } catch (error: any) {
    console.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete image'
    };
  }
}

/**
 * Checks if Cloudinary is properly configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}
