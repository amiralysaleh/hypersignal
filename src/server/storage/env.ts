import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface CloudflareBindings extends CloudflareEnv {
  DB: D1Database;
  AUTOMATION_SCHEDULER?: DurableObjectNamespace;
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
    const context = getCloudflareContext({ async: false });
    if (
      context?.env &&
      typeof context.env === 'object' &&
      context.env !== null &&
      'DB' in context.env
    ) {
      return context.env as CloudflareBindings;
    }
  } catch (error) {
    // getCloudflareContext throws when invoked outside a request (e.g. during build time).
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).__CLOUDFLARE_ENV__) {
    return (globalThis as any).__CLOUDFLARE_ENV__ as CloudflareBindings;
  }

  throw new Error(
    'Cloudflare environment bindings are not available. Ensure this code runs inside a Cloudflare request handler or set the bindings via setCloudflareEnv().' 
  );
}
