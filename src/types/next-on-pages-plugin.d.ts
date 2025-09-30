declare module '@cloudflare/next-on-pages/plugin' {
  import type { NextConfig } from 'next';
  export function nextOnPages(config?: NextConfig): NextConfig;
}
