/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareBindings extends CloudflareEnv {
    DB: D1Database;
  }

  // Used when running background jobs where Cloudflare context helpers are not available.
  var __CLOUDFLARE_ENV__: CloudflareBindings | undefined;
}

export {};
