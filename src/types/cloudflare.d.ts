/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareBindings {
    DB: D1Database;
  }

  // Used when running background jobs where getRequestContext is not available.
  var __CLOUDFLARE_ENV__: CloudflareBindings | undefined;
}

export {};
