# BookEx Vercel Deployment Guide

This guide explains how to deploy BookEx to Vercel with proper environment variable configuration for chat and WebSocket connections.

## 🚀 Quick Start

1. **Push your code to GitHub**
2. **Connect your repository to Vercel**
3. **Set the required environment variables in Vercel dashboard**
4. **Deploy!**

## 📋 Required Environment Variables

### 🔴 CRITICAL - Must be set in Vercel Dashboard

These variables are **REQUIRED** for the app to work properly:

```bash
# Core Application
NEXTAUTH_SECRET=your-super-secret-nextauth-key-here
NEXTAUTH_URL=https://your-app.vercel.app
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bookex?retryWrites=true&w=majority

# Frontend URLs (NEXT_PUBLIC_*)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SOCKET_URL=https://your-app.vercel.app

# AI Features
GEMINI_API_KEY=your-google-ai-api-key-here
```

### 🟡 OPTIONAL - Recommended for full functionality

```bash
# Email Notifications (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
ADMIN_EMAIL=admin@yourdomain.com

# Performance & Caching (optional)
REDIS_URL=redis://your-redis-url:6379
```

## 🔧 How to Set Environment Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable with the following settings:
   - **Name**: The environment variable name (e.g., `NEXTAUTH_SECRET`)
   - **Value**: The actual value
   - **Environment**: Select **Production** (and **Preview** if you want it in preview deployments)
5. Click **Save**

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variables
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add MONGODB_URI
vercel env add NEXT_PUBLIC_APP_URL
vercel env add NEXT_PUBLIC_SOCKET_URL
vercel env add GEMINI_API_KEY

# Deploy
vercel --prod
```

## 🌐 URL Configuration Explained

### Why These URLs Matter

The BookEx app uses **real-time WebSocket connections** for:
- 💬 **Chat messaging** between users
- 🔄 **Live exchange status updates**
- 👥 **Community notifications**
- 📱 **Real-time presence indicators**

### URL Configuration Logic

The app automatically detects the environment and uses the appropriate URLs:

```typescript
// Development (localhost)
NEXT_PUBLIC_APP_URL=http://localhost:9002
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

// Production (Vercel)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SOCKET_URL=https://your-app.vercel.app
```

### ⚠️ Important Notes

1. **Socket.IO runs on the same server** as your Next.js app in production
2. **Both URLs should be identical** in production (same domain)
3. **Vercel automatically provides `VERCEL_URL`** - the app uses this as fallback
4. **CORS is automatically configured** based on your environment

## 🔍 Troubleshooting

### Chat Not Working?

1. **Check browser console** for WebSocket connection errors
2. **Verify environment variables** are set correctly in Vercel
3. **Ensure URLs match** your actual Vercel deployment URL
4. **Check CORS settings** - they're automatically configured

### Common Issues

| Issue | Solution |
|-------|----------|
| `WebSocket connection failed` | Check `NEXT_PUBLIC_SOCKET_URL` matches your Vercel URL |
| `CORS error` | Verify `NEXT_PUBLIC_APP_URL` is set correctly |
| `Authentication failed` | Check `NEXTAUTH_SECRET` and `NEXTAUTH_URL` |
| `Database connection failed` | Verify `MONGODB_URI` is correct and accessible |

### Debug Mode

To debug connection issues, check the browser console for:

```javascript
// Look for these log messages:
"Connected to Socket.IO server"
"Socket ID: [socket-id]"
"Socket transport: [websocket/polling]"
```

## 📁 File Structure

The refactored code includes:

```
src/lib/url-utils.ts          # Centralized URL generation
src/components/socket-provider.tsx  # Updated WebSocket client
src/hooks/use-exchange-realtime.ts  # Real-time exchange updates
server.ts                     # Updated Socket.IO server
env.production.example        # Environment variables template
```

## 🚀 Deployment Steps

1. **Prepare your environment**:
   ```bash
   # Copy the example file
   cp env.production.example .env.local
   
   # Edit with your values
   nano .env.local
   ```

2. **Test locally**:
   ```bash
   npm run dev
   ```

3. **Deploy to Vercel**:
   ```bash
   # Push to GitHub
   git add .
   git commit -m "Fix environment variables for Vercel deployment"
   git push origin main
   
   # Deploy (if using Vercel CLI)
   vercel --prod
   ```

4. **Set environment variables** in Vercel dashboard

5. **Test the deployment**:
   - Visit your Vercel URL
   - Try creating an account
   - Test chat functionality
   - Check real-time features

## ✅ Verification Checklist

After deployment, verify these features work:

- [ ] User registration and login
- [ ] Real-time chat messaging
- [ ] Community notifications
- [ ] Exchange status updates
- [ ] AI-powered book recommendations
- [ ] Email notifications (if configured)

## 🆘 Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review the browser console for errors
3. Verify all environment variables are set correctly
4. Check the Vercel function logs in the dashboard

## 📝 Environment Variables Reference

| Variable | Required | Type | Description |
|----------|----------|------|-------------|
| `NEXTAUTH_SECRET` | ✅ | String | Secret for NextAuth.js |
| `NEXTAUTH_URL` | ✅ | String | Your app's public URL |
| `MONGODB_URI` | ✅ | String | MongoDB connection string |
| `NEXT_PUBLIC_APP_URL` | ✅ | String | Public app URL (frontend) |
| `NEXT_PUBLIC_SOCKET_URL` | ✅ | String | WebSocket server URL |
| `GEMINI_API_KEY` | ✅ | String | Google AI API key |
| `EMAIL_HOST` | ❌ | String | SMTP server host |
| `EMAIL_USER` | ❌ | String | SMTP username |
| `EMAIL_PASSWORD` | ❌ | String | SMTP password |
| `REDIS_URL` | ❌ | String | Redis connection string |

---

**🎉 That's it!** Your BookEx app should now work perfectly on Vercel with real-time chat and WebSocket connections.
