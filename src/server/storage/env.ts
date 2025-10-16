import { createRequire } from 'module';

const require = createRequire(import.meta.url);

type CloudflareContextModule = typeof import('@opennextjs/cloudflare');

class LocalD1PreparedStatement implements D1PreparedStatement {
  private params: unknown[] = [];

  constructor(private readonly store: Map<string, string>, private readonly query: string) {}

  bind(...params: unknown[]): D1PreparedStatement {
    this.params = params;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    const normalized = this.query.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) {
      const [key] = this.params as [string];
      if (this.store.has(String(key))) {
        return { value: this.store.get(String(key)) ?? '' } as T;
      }
      return null;
    }

    return null;
  }

  async run<T = unknown>(): Promise<T> {
    const normalized = this.query.trim().toUpperCase();

    if (normalized.startsWith('CREATE TABLE')) {
      return {} as T;
    }

    if (normalized.startsWith('INSERT OR IGNORE')) {
      const [key, value] = this.params as [string, string];
      const resolvedKey = String(key);
      if (!this.store.has(resolvedKey)) {
        this.store.set(resolvedKey, String(value ?? ''));
      }
      return {} as T;
    }

    if (normalized.startsWith('INSERT OR REPLACE')) {
      const [key, value] = this.params as [string, string];
      this.store.set(String(key), String(value ?? ''));
      return {} as T;
    }

    throw new Error(`Unsupported local D1 query: ${this.query}`);
  }

  async all<T = unknown>(): Promise<{ results: T[] } | undefined> {
    return { results: [] };
  }
}

class LocalD1Database implements D1Database {
  constructor(private readonly store: Map<string, string>) {}

  prepare(query: string): D1PreparedStatement {
    return new LocalD1PreparedStatement(this.store, query);
  }
}

const moduleIdentifier = ['@opennextjs', 'cloudflare'].join('/');

let cloudflareModule: CloudflareContextModule | null = null;
let fallbackEnv: CloudflareBindings | null = null;

function getCloudflareModule(): CloudflareContextModule | null {
  if (cloudflareModule !== null) {
    return cloudflareModule;
  }

  try {
    cloudflareModule = require(moduleIdentifier);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'The optional @opennextjs/cloudflare dependency is not available. Falling back to an in-memory stub.',
        error
      );
    }

    if (!fallbackEnv) {
      fallbackEnv = {
        DB: new LocalD1Database(new Map()),
      } satisfies CloudflareBindings;
    }

    cloudflareModule = {
      getCloudflareContext: () => ({ env: fallbackEnv }),
    } as CloudflareContextModule;
  }

  return cloudflareModule;
}

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
    const module = getCloudflareModule();
    if (module) {
      const context = module.getCloudflareContext({ async: false });
      if (
        context?.env &&
        typeof context.env === 'object' &&
        context.env !== null &&
        'DB' in context.env
      ) {
        return context.env as CloudflareBindings;
      }
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
