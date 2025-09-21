
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
    // Exclude server.ts from client bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Ignore server-only modules on client
        'fs': false,
        'net': false,
        'tls': false,
        'child_process': false,
      };
      
      // Exclude server.ts from client bundle
      config.module.rules.push({
        test: /server\.ts$/,
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

    