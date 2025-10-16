/**
 * ImageUpload Component
 * Reusable component for uploading images with preview, validation, and progress
 */

"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { X, ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ImageUploadProps {
  onUploadComplete: (urls: string[]) => void;
  onUploadError?: (error: string) => void;
  multiple?: boolean;
  maxImages?: number;
  folder?: 'messages' | 'posts' | 'profiles' | 'communities';
  className?: string;
  buttonText?: string;
  showPreview?: boolean;
}

export function ImageUpload({
  onUploadComplete,
  onUploadError,
  multiple = false,
  maxImages = 5,
  folder = 'messages',
  className,
  buttonText,
  showPreview = true
}: ImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Validate file count
    if (multiple && selectedFiles.length + files.length > maxImages) {
      onUploadError?.(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      // Check file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name}: File size must be less than 5MB`);
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Only JPEG, PNG, and WebP images are allowed`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      onUploadError?.(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      if (multiple) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
        
        // Create preview URLs
        validFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreviewUrls(prev => [...prev, e.target?.result as string]);
          };
          reader.readAsDataURL(file);
        });
      } else {
        setSelectedFiles([validFiles[0]]);
        
        // Create preview URL
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrls([e.target?.result as string]);
        };
        reader.readAsDataURL(validFiles[0]);
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('folder', folder);

      if (multiple) {
        selectedFiles.forEach(file => {
          formData.append('images', file);
        });
      } else {
        formData.append('image', selectedFiles[0]);
      }

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Handle response
      const urls = multiple ? result.urls : [result.url];
      onUploadComplete(urls);

      // Reset state
      setSelectedFiles([]);
      setPreviewUrls([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      onUploadError?.(error.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* File Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Select Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || (!multiple && selectedFiles.length > 0)}
      >
        <ImagePlus className="h-4 w-4 mr-2" />
        {buttonText || (multiple ? 'Select Images' : 'Select Image')}
      </Button>

      {/* Preview Grid */}
      {showPreview && previewUrls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-border">
              <Image
                src={url}
                alt={`Preview ${index + 1}`}
                fill
                className="object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => removeImage(index)}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <Button
          type="button"
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            `Upload ${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}`
          )}
        </Button>
      )}
    </div>
  );
}
