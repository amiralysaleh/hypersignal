import type { NextConfig } from 'next';
import withPWA from 'next-pwa';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const withConfiguredPWA = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = withConfiguredPWA({
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
});

if (process.env.NODE_ENV === 'development') {
  void initOpenNextCloudflareForDev();
}

export default nextConfig;
