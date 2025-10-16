# Community Image Upload Implementation

## Overview
Added complete image upload functionality to Community post creation forms in BookEx, allowing users to upload up to 5 images per post with validation, preview, and real-time display.

## Implementation Date
January 2025

## Files Modified

### 1. `/src/components/community/community-detail-client.tsx`
**Changes Made:**
- **Imports Added:**
  - `useRef` from React
  - `Image` from Next.js
  - `ImagePlus`, `X` icons from lucide-react

- **State Variables Added:**
  ```typescript
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  ```

- **Functions Added:**
  - `handleImageSelect(e: React.ChangeEvent<HTMLInputElement>)`:
    - Validates file type (JPEG, PNG, WebP)
    - Validates file size (max 5MB per image)
    - Limits to 5 images total
    - Creates preview URLs using FileReader
    - Shows toast notifications for errors

  - `handleRemoveImage(index: number)`:
    - Removes image from selection
    - Removes preview URL

- **Updated `handleCreatePost` Function:**
  - Added image upload before post creation
  - Uploads images to `/api/upload/image` endpoint
  - Includes image URLs in post creation payload
  - Handles upload errors with proper rollback
  - Clears image state on success

- **UI Changes:**
  - Added hidden file input with `ref={fileInputRef}`
  - Added ImagePlus button to trigger file picker
  - Added image preview grid with remove buttons
  - Updated Post button to show upload status
  - Added selected image count display
  - Updated disabled states to include `isUploadingImages`

- **Post Display:**
  - Added image grid display for posts with images
  - Responsive grid: 1 column for 1 image, 2 columns for 2 images, 2-3 columns for 3+ images
  - Click to open image in new tab
  - Images displayed at 400x300 with rounded corners

### 2. `/src/components/community/forum-channel.tsx`
**Changes Made:**
- **Imports Added:**
  - `useRef` from React
  - `Image` from Next.js
  - `ImagePlus`, `X` icons from lucide-react

- **State Variables Added:**
  ```typescript
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  ```

- **Functions Added:**
  - `handleImageSelect(e: React.ChangeEvent<HTMLInputElement>)`:
    - Same implementation as community-detail-client
    
  - `handleRemoveImage(index: number)`:
    - Same implementation as community-detail-client

- **Updated `handleCreatePost` Function:**
  - Same implementation as community-detail-client
  - Uploads to `/api/upload/image` with folder='posts'
  - Includes images in API call to channel posts endpoint

- **UI Changes:**
  - Added hidden file input with `ref={fileInputRef}`
  - Added ImagePlus button in CardFooter
  - Added image preview grid in CardContent
  - Updated Post button with upload status
  - Added selected image count display
  - Updated disabled states

- **Post Display:**
  - Added image grid display for posts
  - Same responsive grid layout
  - Click to open in new tab

## Features Implemented

### Image Upload
- **File Type Validation**: Only JPEG, PNG, WebP allowed
- **File Size Validation**: Max 5MB per image
- **Quantity Limit**: Maximum 5 images per post
- **Real-time Validation**: Toast notifications for errors
- **Preview**: Live preview grid with remove buttons
- **Progress Indication**: Loading states during upload

### UI/UX
- **Image Button**: ImagePlus icon button to trigger file picker
- **Preview Grid**: Responsive grid layout for selected images
- **Remove Buttons**: X button on each preview (visible on hover)
- **Upload Status**: Loading spinner and status text
- **Disabled States**: Buttons disabled during upload/posting
- **Image Count**: Shows number of selected images

### Post Display
- **Responsive Grid**: 
  - 1 image: Full width
  - 2 images: 2 columns
  - 3+ images: 2-3 columns (responsive)
- **Image Optimization**: Next.js Image component with 400x300 dimensions
- **Hover Effect**: Opacity change on hover
- **Click to View**: Opens full image in new tab

## Validation Rules

### File Validation
```typescript
// Allowed types
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

// Size limit
const maxSize = 5 * 1024 * 1024; // 5MB

// Quantity limit
const maxImages = 5;
```

### Error Handling
- File too large: Shows error toast with filename
- Invalid file type: Shows error toast with filename
- Too many images: Shows error toast with limit
- Upload failure: Reverts optimistic update and shows error

## API Integration

### Upload Endpoint
```typescript
POST /api/upload/image
Content-Type: multipart/form-data

FormData:
  - images: File[] (multiple files)
  - folder: 'posts'

Response:
  - success: boolean
  - urls: string[] (Cloudinary URLs)
  - error?: string
```

### Post Creation
```typescript
// Community posts
POST /community/:communityId
Body: {
  authorId: string
  content: string
  images?: string[]  // New field
}

// Channel posts
POST /api/communities/:communityId/channels/:channelId/posts
Body: {
  authorId: string
  content: string
  images?: string[]  // New field
}
```

## Type Definitions

### Post Interface (Already Updated)
```typescript
interface Post {
  _id: string;
  content: string;
  authorId: string;
  communityId: string;
  likes: number;
  createdAt: string;
  likedBy?: string[];
  comments?: Comment[];
  images?: string[];  // Added field
}
```

## State Management

### Image Upload State
```typescript
// Selected files (File objects)
const [selectedImages, setSelectedImages] = useState<File[]>([]);

// Preview URLs (data URLs)
const [imagePreviews, setImagePreviews] = useState<string[]>([]);

// Upload in progress
const [isUploadingImages, setIsUploadingImages] = useState(false);

// File input reference
const fileInputRef = useRef<HTMLInputElement>(null);
```

## User Flow

### Creating a Post with Images
1. User clicks ImagePlus button
2. File picker opens
3. User selects 1-5 images
4. System validates each file
5. Preview grid displays selected images
6. User can remove images using X button
7. User clicks Post button
8. Images upload to Cloudinary
9. Post created with image URLs
10. Images displayed in post
11. Real-time update sent to other users

## Error Handling

### Upload Errors
- Validation errors: Show toast, don't upload
- Network errors: Show toast, revert optimistic update
- API errors: Show toast, restore original state

### Rollback Strategy
```typescript
// Save original state
const originalPosts = [...posts];
const originalContent = newPostContent;
const originalImages = [...selectedImages];
const originalPreviews = [...imagePreviews];

// On error, restore
setPosts(originalPosts);
setNewPostContent(originalContent);
setSelectedImages(originalImages);
setImagePreviews(originalPreviews);
```

## Performance Considerations

### Image Optimization
- Server-side optimization via Sharp (1920x1080, 85% quality)
- Progressive JPEG format
- Cloudinary CDN for fast delivery
- Next.js Image component for automatic optimization

### File Size Limits
- Client-side validation prevents large uploads
- 5MB limit per image balances quality and performance
- Maximum 5 images per post (25MB total max)

## Accessibility

### Keyboard Navigation
- File input accessible via keyboard
- Button controls have proper focus states
- Image preview grid keyboard navigable

### Screen Readers
- Alt text on all images
- Proper ARIA labels on buttons
- Status messages for upload progress

## Browser Compatibility
- FileReader API (all modern browsers)
- FormData API (all modern browsers)
- File input multiple attribute (all modern browsers)
- CSS Grid (all modern browsers)

## Testing Recommendations

### Manual Testing
1. Upload single image
2. Upload multiple images (2-5)
3. Try to upload 6+ images (should show error)
4. Upload file larger than 5MB (should show error)
5. Upload non-image file (should show error)
6. Remove images from preview
7. Create post with images
8. View post with images
9. Click image to open in new tab

### Edge Cases
- Slow network (upload progress)
- Network failure during upload
- Invalid file types
- Files exactly at 5MB limit
- Multiple rapid file selections
- Removing all images then adding more

## Future Enhancements

### Potential Improvements
- [ ] Image cropping/editing before upload
- [ ] Drag and drop file upload
- [ ] Paste images from clipboard
- [ ] Image lightbox modal (instead of new tab)
- [ ] Image reordering in preview
- [ ] Progress bar for upload
- [ ] Compress images before upload (client-side)
- [ ] Support for GIF animations
- [ ] Image captions/alt text
- [ ] Thumbnail optimization for grid view

## Related Documentation
- See `/IMAGE_SHARING_IMPLEMENTATION.md` for full image sharing infrastructure
- See `/IMAGE_SHARING_API.md` for API documentation
- See `/IMAGE_SHARING_GUIDE.md` for developer guide
- See `/IMAGE_SHARING_TESTING.md` for testing procedures

## Notes
- Images are stored in Cloudinary under `posts` folder
- Image URLs are permanent (not deleted on post deletion)
- No image editing/filters implemented
- No image compression on client side
- Backend API endpoints must support `images` field in post creation

## Verification
- ✅ TypeScript compilation passes (no errors)
- ✅ All imports added correctly
- ✅ State management implemented
- ✅ Event handlers added
- ✅ UI components integrated
- ✅ Image display implemented
- ✅ Error handling complete
- ✅ Validation rules enforced
