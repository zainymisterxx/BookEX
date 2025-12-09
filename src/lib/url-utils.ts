/**
 * Utility functions for generating URLs based on environment
 */

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (process.env.NODE_ENV === 'production') {
    // Vercel provides VERCEL_URL automatically
    return `https://${process.env.VERCEL_URL || 'your-app.vercel.app'}`;
  }
  
  // Development fallback
  return 'http://localhost:9002';
}

/**
 * Get the socket URL for WebSocket connections
 */
export function getSocketUrl(): string {
  // Allow explicit override via environment variable
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // If on Vercel or production domain (not localhost)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // Use same domain with secure protocol
      return `${protocol}//${hostname}`;
    }
  }
  
  // Development/localhost - use dedicated socket port
  const socketPort = process.env.SOCKET_PORT || '3001';
  return `http://localhost:${socketPort}`;
}

/**
 * Get the API base URL
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // API routes are served from the same domain as the app
  return `${getBaseUrl()}/api`;
}

/**
 * Get CORS origins for server configuration
 */
export function getCorsOrigins(): string[] {
  if (process.env.NODE_ENV === 'production') {
    return [getBaseUrl()];
  }
  
  return [
    'http://localhost:3000',
    'http://localhost:9002',
    'https://localhost:3000'
  ];
}
