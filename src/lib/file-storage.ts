/**
 * Secure file storage utility for handling image uploads
 * Supports both local storage (development) and cloud storage (production)
 */

import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

/**
 * Validates file upload with enhanced security checks including magic number validation
 */
export async function validateImageFile(file: File): Promise<{ isValid: boolean; error?: string }> {
  // Check file size (max 5MB)
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: 'File size must be less than 5MB' };
  }

  // Check file type - be more specific about allowed types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed' };
  }

  // Check file extension matches MIME type
  const extension = file.name.toLowerCase().split('.').pop();
  const validExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/gif': ['gif']
  };

  const expectedExtensions = validExtensions[file.type];
  if (!expectedExtensions || !extension || !expectedExtensions.includes(extension)) {
    return { isValid: false, error: 'File extension does not match file type' };
  }

  // Magic number validation - verify actual file content
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Read first 4100 bytes for file type detection
    const fileTypeResult = await fileTypeFromBuffer(buffer);
    
    if (!fileTypeResult) {
      return { isValid: false, error: 'Could not determine file type from content' };
    }

    // Verify the actual file type matches the claimed MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(fileTypeResult.mime)) {
      return { isValid: false, error: `File content does not match claimed type. Detected: ${fileTypeResult.mime}` };
    }

    // Additional check: ensure claimed type matches detected type
    if (file.type !== fileTypeResult.mime) {
      return { isValid: false, error: `File MIME type mismatch. Claimed: ${file.type}, Detected: ${fileTypeResult.mime}` };
    }

  } catch (error) {
    console.error('Error validating file content:', error);
    return { isValid: false, error: 'Failed to validate file content' };
  }

  return { isValid: true };
}

/**
 * Generates a secure filename to prevent path traversal and conflicts
 */
function generateSecureFilename(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  return `org_${timestamp}_${randomId}${extension}`;
}

/**
 * Saves file to local uploads directory (for development/self-hosted)
 * In production, you would replace this with cloud storage (AWS S3, Cloudinary, etc.)
 */
export async function saveImageFile(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validate the file first (now includes magic number validation)
    const validation = await validateImageFile(file);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'organizations');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch {
      // Directory might already exist, that's fine
    }

    // Generate secure filename
    const filename = generateSecureFilename(file.name);
    const filePath = path.join(uploadsDir, filename);

    // Convert file to buffer and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    // Return the public URL
    const publicUrl = `/uploads/organizations/${filename}`;
    return { success: true, url: publicUrl };

  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: 'Failed to save file' };
  }
}

/**
 * Enhanced file validation that works with both File objects and form data
 */
export async function validateFileFromFormData(formData: FormData, fieldName: string): Promise<{ isValid: boolean; file?: File; error?: string }> {
  const file = formData.get(fieldName) as File;
  
  if (!file || file.size === 0) {
    return { isValid: false, error: 'No file provided' };
  }

  const validation = await validateImageFile(file);
  if (!validation.isValid) {
    return { isValid: false, error: validation.error };
  }

  return { isValid: true, file };
}

/**
 * Future: Cloud storage integration point
 * Replace the saveImageFile function with this for production
 */
export async function saveImageToCloud(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  // Placeholder for cloud storage integration
  // This is where you would integrate with:
  // - AWS S3
  // - Cloudinary
  // - Google Cloud Storage
  // - Azure Blob Storage
  
  // For now, fall back to local storage
  return saveImageFile(file);
}
