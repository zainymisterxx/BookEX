# 🖼️ Image Sharing - Quick Reference

## 🚀 Quick Start

### 1. Setup Cloudinary (One-time)
```bash
# Run setup script
./setup-image-sharing.sh

# Or manually add to .env.local:
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 2. Restart Server
```bash
npm run dev
```

### 3. Test in DMs
- Login → Open any chat
- Click 📷 icon → Select image
- Send message → Image appears instantly!

---

## 📦 What Was Added

### New Files
```
src/
├── lib/
│   └── cloudinary-upload.ts        # Upload utility
├── app/api/
│   └── upload/image/route.ts       # API endpoint
└── components/ui/
    ├── image-upload.tsx            # Upload component
    └── image-preview-modal.tsx     # Preview modal
```

### Updated Files
```
src/
├── lib/
│   ├── types.ts                    # Added imageUrl to Message, images to Post
│   └── mongodb-types.ts            # Added imageUrl to MessageDocument
├── app/(main)/messages/[id]/
│   └── page.tsx                    # Added image upload UI
└── server.ts                       # Socket.io supports imageUrl
```

---

## 🎯 Features

### ✅ Working Now
- **DM Image Sharing** - Send/receive images in real-time
- **Image Preview** - Full-screen view with download
- **Validation** - Type, size, format checking
- **Optimization** - Auto-resize & compress
- **Security** - Auth required, file validation

### 🔜 Ready to Enable
- **Post Images** - See `EXAMPLE_IMAGE_POSTS.tsx`
- **Group Chat Images** - Same as DMs
- **Profile Pictures** - Use upload API with `folder="profiles"`

---

## 📝 Component Usage

### ImageUpload Component
```tsx
import { ImageUpload } from '@/components/ui/image-upload';

<ImageUpload
  onUploadComplete={(urls) => console.log(urls)}
  onUploadError={(error) => console.error(error)}
  multiple={true}          // Allow multiple images
  maxImages={5}           // Max 5 images
  folder="messages"       // Cloudinary folder
  showPreview={true}      // Show thumbnails
/>
```

### ImagePreviewModal Component
```tsx
import { ImagePreviewModal } from '@/components/ui/image-preview-modal';

<ImagePreviewModal 
  imageUrl={imageUrl} 
  onClose={() => setImageUrl(null)} 
/>
```

---

## 🔌 API Endpoint

### POST `/api/upload/image`

**Single Image:**
```typescript
const formData = new FormData();
formData.append('image', file);
formData.append('folder', 'messages');

const res = await fetch('/api/upload/image', {
  method: 'POST',
  body: formData
});

const { url } = await res.json();
```

**Multiple Images:**
```typescript
const formData = new FormData();
files.forEach(f => formData.append('images', f));
formData.append('folder', 'posts');

const res = await fetch('/api/upload/image', {
  method: 'POST',
  body: formData
});

const { urls } = await res.json();
```

---

## 🗄️ Database Schema

### Message with Image
```typescript
{
  _id: ObjectId,
  senderId: string,
  text?: string,        // Optional if image
  imageUrl?: string,    // Cloudinary URL
  createdAt: string,
  read?: boolean
}
```

### Post with Images
```typescript
{
  _id: ObjectId,
  authorId: string,
  content: string,
  images?: string[],    // Array of URLs
  likes: number,
  createdAt: string
}
```

---

## 🔒 Validation Rules

| Property | Constraint |
|----------|-----------|
| **File Size** | Max 5MB |
| **File Types** | JPEG, PNG, WebP |
| **Max Images/Upload** | 5 images |
| **Auth Required** | Yes |
| **Max Dimensions** | Auto-resized to 1920x1080 |

---

## 🐛 Common Issues

### "Service not configured"
- Add Cloudinary env vars to `.env.local`
- Restart server: `npm run dev`

### Upload fails
- Check file size (<5MB)
- Check file type (JPEG/PNG/WebP)
- Check network connection
- Check Cloudinary dashboard for quota

### Images not showing
- Verify Cloudinary URL is accessible
- Check browser console for errors
- Check MongoDB has `imageUrl` field

### Socket not working
- Check Socket.io connection
- Verify `server.ts` updated
- Check browser DevTools → Network → WS

---

## 📊 Performance

- **Optimization:** Sharp compresses images
- **CDN:** Cloudinary global delivery
- **Lazy Load:** Next.js Image component
- **Caching:** Browser & CDN cache
- **Progressive:** JPEG progressive loading

---

## 🎨 Customization

### Change Max File Size
```typescript
// src/lib/cloudinary-upload.ts
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### Change Max Dimensions
```typescript
// src/lib/cloudinary-upload.ts
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;
```

### Add More File Types
```typescript
// src/lib/cloudinary-upload.ts
const ALLOWED_FORMATS = [
  'image/jpeg', 
  'image/png', 
  'image/webp',
  'image/gif'  // Add GIF
];
```

---

## 📚 Full Documentation

- **Complete Guide:** `IMAGE_SHARING_GUIDE.md`
- **Post Example:** `EXAMPLE_IMAGE_POSTS.tsx`
- **Setup Script:** `./setup-image-sharing.sh`

---

## ✅ Quick Test Checklist

- [ ] Cloudinary credentials added
- [ ] Server restarted
- [ ] Can select image in chat
- [ ] Image preview shows
- [ ] Image uploads successfully
- [ ] Message sends with image
- [ ] Image displays in chat
- [ ] Click opens full-screen
- [ ] Download works
- [ ] Real-time delivery works

---

## 🎉 You're Ready!

Image sharing is now fully functional in your BookEx app!

**Need help?** Check `IMAGE_SHARING_GUIDE.md` for detailed documentation.
