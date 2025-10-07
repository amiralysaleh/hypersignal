type D1PreparedStatement = {
  bind(...params: any[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<T>;
  all<T = unknown>(): Promise<{ results: T[] } | undefined>;
};

declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface CloudflareEnv {
    DB: D1Database;
    [key: string]: unknown;
  }
}

export {};
