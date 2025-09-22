
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
      // Exclude Node.js modules that aren't available in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'fs': false,
        'net': false,
        'tls': false,
        'child_process': false,
        'crypto': false,
        'os': false,
        'path': false,
        'util': false,
        'stream': false,
        'buffer': false,
        'events': false,
        'url': false,
        'querystring': false,
        'http': false,
        'https': false,
        'zlib': false,
        'dns': false,
        'cluster': false,
        'worker_threads': false,
        'perf_hooks': false,
        'async_hooks': false,
        'trace_events': false,
        'v8': false,
        'vm': false,
        'assert': false,
        'constants': false,
        'domain': false,
        'punycode': false,
        'readline': false,
        'repl': false,
        'string_decoder': false,
        'timers': false,
        'tty': false,
      };

      // Exclude MongoDB modules that cause client-side bundling issues
      config.resolve.alias = {
        ...config.resolve.alias,
        'mongodb': false,
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
    }
    
    return config;
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
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
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

    