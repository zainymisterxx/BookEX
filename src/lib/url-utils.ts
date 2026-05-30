/**
 * Utility functions for generating URLs based on environment
 */

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // Use current browser URL (works for all environments)
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  
  // Server-side: use environment variable
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
  // In browser on a real domain (production), always use same-domain proxy.
  // Vercel proxies /socket.io/* → SOCKET_SERVER_URL (set server-side only).
  // This avoids CSP violations and mixed-content issues.
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}`;
    }
  }

  // Development: use explicit override or default localhost port
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

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
  const origins = [
    'http://localhost:3000',
    'http://localhost:9002',
    'https://localhost:3000',
  ];

  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  return origins;
}
