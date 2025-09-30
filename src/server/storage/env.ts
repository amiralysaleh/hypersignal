import { getRequestContext } from '@cloudflare/next-on-pages';

interface CloudflareBindings {
  DB: D1Database;
}

let explicitEnv: CloudflareBindings | null = null;

export function setCloudflareEnv(env: CloudflareBindings) {
  explicitEnv = env;
}

export function getCloudflareEnv(): CloudflareBindings {
  if (explicitEnv) {
    return explicitEnv;
  }

  try {
    const context = getRequestContext();
    if (context?.env && 'DB' in context.env) {
      return context.env as CloudflareBindings;
    }
  } catch (error) {
    // getRequestContext throws when invoked outside a request (e.g. during build time).
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).__CLOUDFLARE_ENV__) {
    return (globalThis as any).__CLOUDFLARE_ENV__ as CloudflareBindings;
  }

  throw new Error(
    'Cloudflare environment bindings are not available. Ensure this code runs inside a Next.js request handler on Pages or set the bindings via setCloudflareEnv().' 
  );
}
