"use client";

import { useState, useCallback } from 'react';

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

interface OptimizedImage {
  dataUri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

interface UseImageOptimizationReturn {
  optimizeImage: (file: File, options?: ImageOptimizationOptions) => Promise<OptimizedImage>;
  isOptimizing: boolean;
  error: string | null;
}

/**
 * Hook for optimizing and compressing images before upload
 */
export function useImageOptimization(): UseImageOptimizationReturn {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimizeImage = useCallback(async (
    file: File, 
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImage> => {
    const {
      maxWidth = 800,
      maxHeight = 600,
      quality = 0.8,
      format = 'jpeg'
    } = options;

    setIsOptimizing(true);
    setError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('Image file size must be less than 10MB');
      }

      return new Promise<OptimizedImage>((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        img.onload = () => {
          try {
            // Calculate new dimensions maintaining aspect ratio
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
              const aspectRatio = width / height;
              
              if (width > height) {
                width = Math.min(width, maxWidth);
                height = width / aspectRatio;
              } else {
                height = Math.min(height, maxHeight);
                width = height * aspectRatio;
              }
            }

            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;

            // Draw and compress image
            ctx.fillStyle = '#FFFFFF'; // White background for JPEG
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to optimized format
            const mimeType = format === 'png' ? 'image/png' : 
                           format === 'webp' ? 'image/webp' : 'image/jpeg';
            
            const dataUri = canvas.toDataURL(mimeType, quality);
            
            // Calculate compression metrics
            const originalSize = file.size;
            const compressedSize = Math.round((dataUri.length - 'data:image/jpeg;base64,'.length) * 0.75);
            const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

            resolve({
              dataUri,
              originalSize,
              compressedSize,
              compressionRatio: Math.max(0, compressionRatio),
              width: Math.round(width),
              height: Math.round(height)
            });

          } catch (err) {
            reject(new Error('Failed to process image'));
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        // Load the image
        img.src = URL.createObjectURL(file);
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Image optimization failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  return {
    optimizeImage,
    isOptimizing,
    error
  };
}

/**
 * Utility function to validate image data URI
 */
export function validateImageDataUri(dataUri: string): { isValid: boolean; error?: string } {
  if (!dataUri) {
    return { isValid: false, error: 'Image data is required' };
  }

  if (!dataUri.startsWith('data:image/')) {
    return { isValid: false, error: 'Invalid image format' };
  }

  // Check size (base64 encoded, so roughly 4/3 of original size)
  const sizeInBytes = Math.round((dataUri.length - dataUri.indexOf(',') - 1) * 0.75);
  const maxSize = 5 * 1024 * 1024; // 5MB after compression

  if (sizeInBytes > maxSize) {
    return { isValid: false, error: 'Compressed image is too large (max 5MB)' };
  }

  return { isValid: true };
}

/**
 * Utility function to get image dimensions from data URI
 */
export function getImageDimensions(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = dataUri;
  });
}