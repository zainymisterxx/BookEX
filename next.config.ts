
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Re-enable TypeScript error checking for production safety
    ignoreBuildErrors: false,
  },
  eslint: {
    // Re-enable ESLint for code quality enforcement
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // More targeted fallbacks - only exclude modules that are actually problematic
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Core Node.js modules that should never be used client-side
        'fs': false,
        'net': false,
        'tls': false,
        'child_process': false,
        'os': false,
        'cluster': false,
        'worker_threads': false,
        'perf_hooks': false,
        'async_hooks': false,
        'trace_events': false,
        'v8': false,
        'vm': false,
        'domain': false,
        'readline': false,
        'repl': false,
        'tty': false,
        // Keep these as polyfills for better compatibility
        'crypto': require.resolve('crypto-browserify'),
        'stream': require.resolve('stream-browserify'),
        'buffer': require.resolve('buffer'),
        'events': require.resolve('events'),
        'url': require.resolve('url'),
        'querystring': require.resolve('querystring-es3'),
        'http': require.resolve('stream-http'),
        'https': require.resolve('https-browserify'),
        'zlib': require.resolve('browserify-zlib'),
        'dns': false,
        'assert': require.resolve('assert'),
        'constants': require.resolve('constants-browserify'),
        'punycode': require.resolve('punycode'),
        'string_decoder': require.resolve('string_decoder'),
        'timers': require.resolve('timers-browserify'),
        'path': require.resolve('path-browserify'),
        'util': require.resolve('util'),
      };

      // Exclude MongoDB modules that cause client-side bundling issues
      config.resolve.alias = {
        ...config.resolve.alias,
        'mongodb': false,
        // Exclude server-only database modules
        '@/lib/mongodb': false,
        '@/lib/mongodb-server': false,
        '@/lib/mongodb-client-safe': false,
      };

      // Exclude server-only files from client bundle
      config.module.rules.push({
        test: /server\.ts$/,
        use: 'null-loader',
      });

      // Exclude MongoDB client-side encryption modules
      config.module.rules.push({
        test: /node_modules\/mongodb\/lib\/client-side-encryption/,
        use: 'null-loader',
      });

      // Exclude MongoDB auto-encryption modules
      config.module.rules.push({
        test: /node_modules\/mongodb\/lib\/auto-encryption/,
        use: 'null-loader',
      });

      // Exclude MongoDB mongocryptd manager specifically
      config.module.rules.push({
        test: /mongocryptd_manager\.js$/,
        use: 'null-loader',
      });

      // Handle handlebars require.extensions issue
      config.module.rules.push({
        test: /node_modules\/handlebars/,
        use: 'null-loader',
      });

      // Exclude AI flows from client bundle
      config.module.rules.push({
        test: /src\/ai\//,
        use: 'null-loader',
      });
    }
    
    return config;
  },
  // Proxy /socket.io/* to the externally hosted Socket.IO server.
  // vercel.json rewrites cannot expand env vars in destination, so this must live here.
  async rewrites() {
    const socketUrl = process.env.SOCKET_SERVER_URL;
    if (!socketUrl) return [];
    return [
      {
        source: '/socket.io/:path*',
        destination: `${socketUrl}/socket.io/:path*`,
      },
    ];
  },
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            // NOTE: unsafe-eval is allowed only in development (required by Next.js HMR/source maps).
            // unsafe-inline is kept for Next.js inline scripts injected at build time; removing it
            // requires a nonce-based approach which needs middleware-level integration.
            // NOTE: connect-src uses 'self' and *.vercel.app wildcard so the CSP value
            // is static at build time — no VERCEL_URL baked in per-deployment.
            value: `default-src 'self'; script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} 'unsafe-inline' https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:* ws://localhost:* wss://localhost:* https://*.vercel.app wss://*.vercel.app wss://socket.farya.pk https://socket.farya.pk; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`,
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        // picsum.photos redirects here — Next.js image optimizer follows the redirect
        // and the final domain must be explicitly allowlisted
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.farya.pk',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.bookex.pk',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

    