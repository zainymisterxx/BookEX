#!/bin/bash

# Image Sharing Feature - Environment Setup Script
# This script helps you configure Cloudinary credentials

echo "=================================="
echo "BookEx Image Sharing Setup"
echo "=================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    cp env.production.example .env.local
    echo "✅ Created .env.local from template"
else
    echo "ℹ️  .env.local already exists"
fi

echo ""
echo "📋 Cloudinary Setup Instructions:"
echo ""
echo "1. Go to https://cloudinary.com and sign up (free tier available)"
echo "2. Navigate to your Dashboard"
echo "3. Copy the following credentials:"
echo "   - Cloud Name"
echo "   - API Key"
echo "   - API Secret"
echo ""
echo "4. Add them to your .env.local file:"
echo ""
echo "   CLOUDINARY_CLOUD_NAME=your-cloud-name"
echo "   CLOUDINARY_API_KEY=your-api-key"
echo "   CLOUDINARY_API_SECRET=your-api-secret"
echo ""
echo "5. Restart your development server:"
echo "   npm run dev"
echo ""
echo "=================================="
echo "Testing Image Upload API"
echo "=================================="
echo ""

# Check if server is running
if curl -s http://localhost:9002/api/upload/image > /dev/null 2>&1; then
    echo "✅ Server is running"
    
    # Test if Cloudinary is configured
    RESPONSE=$(curl -s http://localhost:9002/api/upload/image)
    CONFIGURED=$(echo $RESPONSE | grep -o '"configured":[^,}]*' | cut -d':' -f2)
    
    if [ "$CONFIGURED" = "true" ]; then
        echo "✅ Cloudinary is configured correctly!"
        echo ""
        echo "🎉 You're all set! Image sharing is ready to use."
    else
        echo "⚠️  Cloudinary is not configured yet"
        echo "Please add your Cloudinary credentials to .env.local"
    fi
else
    echo "⚠️  Development server is not running"
    echo "Start it with: npm run dev"
fi

echo ""
echo "=================================="
echo "Quick Test (after configuration):"
echo "=================================="
echo ""
echo "1. Start dev server: npm run dev"
echo "2. Login to your BookEx account"
echo "3. Open any chat/DM"
echo "4. Click the image icon (📷) in the message input"
echo "5. Select an image (JPEG, PNG, or WebP, max 5MB)"
echo "6. Send the message"
echo "7. Image should appear in chat instantly!"
echo ""
echo "📖 For detailed documentation, see: IMAGE_SHARING_GUIDE.md"
echo ""
