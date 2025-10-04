/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    [key: string]: unknown;
  }

  interface D1Database {
    prepare: (...args: any[]) => {
      bind: (...bindArgs: any[]) => {
        first: <TRow = unknown>() => Promise<TRow | null>;
        run: () => Promise<void>;
      };
      run: () => Promise<void>;
    };
  }

  interface CloudflareBindings extends CloudflareEnv {
    DB: D1Database;
  }

  // Used when running background jobs where Cloudflare context helpers are not available.
  var __CLOUDFLARE_ENV__: CloudflareBindings | undefined;
}

export {};
