# Community Image Upload - UI Visual Guide

## 📍 Image Upload Button Locations

### 1. Community Main Feed (`/community/{id}`)
**Location:** Inside "Create a Post" card
**Component:** `community-detail-client.tsx`

```
┌─────────────────────────────────────────────┐
│  Create a Post                              │
├─────────────────────────────────────────────┤
│                                             │
│  [Markdown Editor - Content Input]          │
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ Img1 │  │ Img2 │  │ Img3 │  ← Previews │
│  └──────┘  └──────┘  └──────┘             │
│                                             │
├─────────────────────────────────────────────┤
│  [🖼️ Image] 2 images selected    [Post →]  │
│   ↑ Upload Button                           │
└─────────────────────────────────────────────┘
```

**Features:**
- ImagePlus (🖼️) icon button on the left
- Post button on the right
- Preview grid shows between editor and footer
- X button on each preview (visible on hover)

---

### 2. Channel Forums (`/community/{id}/channels/{channelId}`)
**Location:** Top of channel feed in "Create a Post" card
**Component:** `forum-channel.tsx`

```
┌─────────────────────────────────────────────┐
│  Create a Post                              │
├─────────────────────────────────────────────┤
│                                             │
│  [Markdown Editor]                          │
│                                             │
│  ┌──────┐  ┌──────┐                        │
│  │ Img1 │  │ Img2 │  ← Preview Grid        │
│  └──────┘  └──────┘                        │
│                                             │
├─────────────────────────────────────────────┤
│  [🖼️] 2 images    [Post →]                 │
└─────────────────────────────────────────────┘
```

**Features:**
- Same layout as community main feed
- Appears at top of channel (sticky)
- Only visible to community members

---

## 🎨 UI Components Breakdown

### Image Upload Button
```tsx
<Button
  type="button"
  variant="outline"
  size="icon"
  onClick={() => fileInputRef.current?.click()}
  disabled={isPending || isUploadingImages || selectedImages.length >= 5}
>
  <ImagePlus className="h-4 w-4" />
</Button>
```

**Visual:**
- Outline button with ImagePlus icon
- Gray border, white background
- Disabled when: posting, uploading, or 5 images selected
- Located in CardFooter on the left side

---

### Image Counter
```tsx
{selectedImages.length > 0 && (
  <span className="text-sm text-muted-foreground">
    {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''} selected
  </span>
)}
```

**Visual:**
- Small gray text next to upload button
- Shows "1 image selected" or "3 images selected"
- Only appears when images are selected

---

### Image Preview Grid
```tsx
<div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
  {imagePreviews.map((preview, index) => (
    <div key={index} className="relative group">
      <Image
        src={preview}
        alt={`Preview ${index + 1}`}
        width={200}
        height={200}
        className="w-full h-32 object-cover rounded-md"
      />
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={() => handleRemoveImage(index)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  ))}
</div>
```

**Visual:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│              │  │              │  │              │
│   Image 1    │  │   Image 2    │  │   Image 3    │
│              │  │     [×]      │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
     Hover to see remove button (red X in top-right)
```

**Layout:**
- 2 columns on mobile
- 3 columns on tablet/desktop
- Each image 128px height
- 8px gap between images
- Remove button appears on hover

---

### Post Button States

#### 1. Normal State
```
[→ Post]
```

#### 2. Uploading Images
```
[⟳ Uploading...]
```
- Spinner animation
- Button disabled
- Gray out other controls

#### 3. Creating Post
```
[⟳ Posting...]
```
- Spinner animation
- Button disabled

#### 4. Disabled State
```
[→ Post] (grayed out)
```
- No content + no images = disabled
- While uploading = disabled
- While posting = disabled

---

## 📱 Responsive Behavior

### Mobile (< 640px)
- Preview grid: 2 columns
- Image upload button: Full icon size
- Counter text: Wrapped below button if needed
- Preview images: Full width of grid cell

### Tablet (640px - 1024px)
- Preview grid: 3 columns
- Same button size
- Counter text: Inline with button
- Preview images: Responsive scaling

### Desktop (> 1024px)
- Preview grid: 3 columns
- All elements full size
- Counter text: Inline with button
- Preview images: Fixed at 200x200 (aspect ratio maintained)

---

## 🖼️ Post Display with Images

### Single Image
```
┌───────────────────────────────────────────┐
│  User Name        • 2 hours ago           │
├───────────────────────────────────────────┤
│  This is my post content...               │
│                                           │
│  ┌───────────────────────────────────┐   │
│  │                                   │   │
│  │        Full Width Image           │   │
│  │         (Click to View)           │   │
│  │                                   │   │
│  └───────────────────────────────────┘   │
│                                           │
├───────────────────────────────────────────┤
│  ❤ 12    💬 3                            │
└───────────────────────────────────────────┘
```

### Two Images
```
┌───────────────────────────────────────────┐
│  User Name        • 2 hours ago           │
├───────────────────────────────────────────┤
│  This is my post content...               │
│                                           │
│  ┌──────────────────┐  ┌──────────────┐  │
│  │                  │  │              │  │
│  │    Image 1       │  │   Image 2    │  │
│  │                  │  │              │  │
│  └──────────────────┘  └──────────────┘  │
│                                           │
├───────────────────────────────────────────┤
│  ❤ 12    💬 3                            │
└───────────────────────────────────────────┘
```

### Three+ Images
```
┌───────────────────────────────────────────┐
│  User Name        • 2 hours ago           │
├───────────────────────────────────────────┤
│  This is my post content...               │
│                                           │
│  ┌────────┐  ┌────────┐  ┌────────┐     │
│  │  Img1  │  │  Img2  │  │  Img3  │     │
│  └────────┘  └────────┘  └────────┘     │
│  ┌────────┐  ┌────────┐                 │
│  │  Img4  │  │  Img5  │                 │
│  └────────┘  └────────┘                 │
│                                           │
├───────────────────────────────────────────┤
│  ❤ 12    💬 3                            │
└───────────────────────────────────────────┘
```

**Image Grid Rules:**
- 1 image: Full width (1 column)
- 2 images: 2 columns
- 3+ images: 2 columns on mobile, 3 columns on tablet+
- All images: 192px height, object-fit: cover
- Hover: Slight opacity change
- Click: Opens in new tab

---

## 🎯 User Interaction Flow

### Uploading Images
```
1. Click [🖼️ Image] button
         ↓
2. File picker opens
         ↓
3. Select 1-5 images
         ↓
4. Validation checks
   - File type (JPEG/PNG/WebP)
   - File size (< 5MB)
   - Count (≤ 5 total)
         ↓
5. Preview grid appears
         ↓
6. Hover over preview → See [×] button
         ↓
7. Click [×] to remove image
         ↓
8. Click [Post] when ready
         ↓
9. "Uploading..." status shows
         ↓
10. "Posting..." status shows
         ↓
11. Post appears with images
```

### Validation Errors
```
❌ File too large
   Toast: "Image.jpg is larger than 5MB"

❌ Wrong file type
   Toast: "Image.gif is not a supported image format"

❌ Too many images
   Toast: "You can upload a maximum of 5 images per post"

❌ Upload failed
   Toast: "Image Upload Failed - Unable to upload images..."
```

---

## 🔧 Technical Implementation

### Hidden File Input
```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/jpg"
  multiple
  onChange={handleImageSelect}
  className="hidden"
/>
```

- Not visible to user
- Triggered by button click
- Supports multiple files
- Restricted to image types

### State Management
```typescript
// Selected files (for upload)
selectedImages: File[] = []

// Preview URLs (for display)
imagePreviews: string[] = []

// Upload in progress
isUploadingImages: boolean = false

// Reference to file input
fileInputRef: React.RefObject<HTMLInputElement>
```

---

## ✅ Checklist for Developers

### Adding Image Upload to New Component
- [ ] Import `ImagePlus`, `X` from lucide-react
- [ ] Import `Image` from next/image
- [ ] Import `useRef` from react
- [ ] Add state variables (selectedImages, imagePreviews, isUploadingImages, fileInputRef)
- [ ] Add `handleImageSelect` function
- [ ] Add `handleRemoveImage` function
- [ ] Update form submit handler (upload images first)
- [ ] Add hidden file input
- [ ] Add ImagePlus button
- [ ] Add preview grid
- [ ] Add image display in posts
- [ ] Update disabled states
- [ ] Test validation
- [ ] Test upload
- [ ] Test post display

---

## 🐛 Common Issues & Solutions

### Issue: Button not appearing
**Solution:** Check if user is logged in and is a member

### Issue: File picker not opening
**Solution:** Verify fileInputRef is properly attached

### Issue: Images not uploading
**Solution:** Check Cloudinary credentials in .env

### Issue: Preview not showing
**Solution:** Verify FileReader is creating data URLs

### Issue: Upload stuck at "Uploading..."
**Solution:** Check network tab for API errors

---

## 📊 Image Upload Limits

| Limit Type | Value | Reason |
|-----------|-------|--------|
| Max images per post | 5 | UI performance, reasonable UX |
| Max file size | 5MB | Upload speed, server resources |
| Allowed types | JPEG, PNG, WebP | Browser support, quality |
| Preview size | 200x200px | Grid layout, performance |
| Display size | 400x300px | Post feed layout |

---

## 🎓 For New Developers

### Where is the upload button?
Look for the **ImagePlus icon** (🖼️) in the post creation card footer, left side.

### How do I add images?
1. Click the ImagePlus button
2. Select images from your device
3. See them preview in the grid
4. Click Post to upload

### How do I remove images?
Hover over the preview image and click the red **X** button in the top-right corner.

### What if I can't see the button?
- Make sure you're logged in
- Make sure you're a member of the community
- Check if the component is properly imported

---

This guide provides a complete visual reference for understanding where and how image upload buttons appear in the BookEx community features.
