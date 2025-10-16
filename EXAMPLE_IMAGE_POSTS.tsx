/**
 * EXAMPLE: How to Add Image Upload to Community Posts
 * 
 * This example shows how to integrate the ImageUpload component
 * into your post creation form for community posts.
 */

"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface CreatePostWithImagesProps {
  communityId: string;
  onPostCreated: () => void;
}

export function CreatePostWithImages({ communityId, onPostCreated }: CreatePostWithImagesProps) {
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleImageUploadComplete = (urls: string[]) => {
    setImageUrls(prev => [...prev, ...urls]);
    toast({
      title: "Success",
      description: `${urls.length} image(s) uploaded successfully`
    });
  };

  const handleImageUploadError = (error: string) => {
    toast({
      title: "Upload Error",
      description: error,
      variant: "destructive"
    });
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() && imageUrls.length === 0) {
      toast({
        title: "Error",
        description: "Please add some content or images",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          communityId,
          content,
          images: imageUrls // Include uploaded image URLs
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create post');
      }

      toast({
        title: "Success",
        description: "Post created successfully"
      });

      // Reset form
      setContent('');
      setImageUrls([]);
      onPostCreated();

    } catch (error: any) {
      console.error('Create post error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      {/* Post Content */}
      <Textarea
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        disabled={isSubmitting}
      />

      {/* Image Upload Component */}
      <ImageUpload
        onUploadComplete={handleImageUploadComplete}
        onUploadError={handleImageUploadError}
        multiple={true}
        maxImages={5}
        folder="posts"
        buttonText="Add Images to Post"
        showPreview={false} // We'll show our own preview below
      />

      {/* Uploaded Images Preview */}
      {imageUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded Images ({imageUrls.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2">
                <Image
                  src={url}
                  alt={`Upload ${index + 1}`}
                  fill
                  className="object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => handleRemoveImage(index)}
                  disabled={isSubmitting}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting || (!content.trim() && imageUrls.length === 0)}
        className="w-full"
      >
        {isSubmitting ? 'Creating Post...' : 'Create Post'}
      </Button>
    </form>
  );
}

// ============================================
// EXAMPLE: Display Post with Images
// ============================================

interface Post {
  _id: string;
  content: string;
  images?: string[];
  author: {
    name: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

interface PostCardWithImagesProps {
  post: Post;
}

export function PostCardWithImages({ post }: PostCardWithImagesProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Post Header */}
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div>
          <p className="font-semibold">{post.author.name}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Post Content */}
      <p className="text-base">{post.content}</p>

      {/* Post Images */}
      {post.images && post.images.length > 0 && (
        <div className={`grid gap-2 ${
          post.images.length === 1 ? 'grid-cols-1' :
          post.images.length === 2 ? 'grid-cols-2' :
          post.images.length === 3 ? 'grid-cols-3' :
          'grid-cols-2'
        }`}>
          {post.images.map((imageUrl, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage(imageUrl)}
            >
              <Image
                src={imageUrl}
                alt={`Post image ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative w-full h-full max-w-4xl max-h-4xl">
            <Image
              src={selectedImage}
              alt="Full size"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE: API Endpoint for Creating Post with Images
// ============================================

/*
// File: /src/app/api/posts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { communityId, content, images } = body;

    // Validate input
    if (!content?.trim() && (!images || images.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Post must have content or images' },
        { status: 400 }
      );
    }

    // Create post document
    const client = await clientPromise;
    const db = client.db('bookex');

    const post = {
      _id: new ObjectId(),
      authorId: session.user.id,
      communityId,
      content: content || '',
      images: images || [], // Store image URLs
      likes: 0,
      likedBy: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };

    await db.collection('posts').insertOne(post);

    return NextResponse.json({
      success: true,
      post
    });

  } catch (error: any) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
*/

// ============================================
// USAGE INSTRUCTIONS
// ============================================

/*

1. INSTALLATION:
   Already done! All components and utilities are ready.

2. FOR COMMUNITY POSTS:
   - Import CreatePostWithImages component
   - Add it to your community post creation page
   - It will handle image uploads automatically

3. FOR DISPLAYING POSTS:
   - Import PostCardWithImages component
   - Use it to display posts with images
   - Click images for full-screen view

4. DATABASE:
   - Posts will automatically include 'images' array
   - No manual database changes needed
   - Backward compatible with existing posts

5. TESTING:
   - Ensure Cloudinary credentials are in .env.local
   - Test upload in community post creation
   - Verify images display correctly
   - Test full-screen image preview

6. CUSTOMIZATION:
   - Adjust max images per post (currently 5)
   - Customize image grid layout
   - Add image captions if needed
   - Add image filters or editing

*/
