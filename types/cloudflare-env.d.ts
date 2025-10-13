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

  interface DurableObjectId {
    toString(): string;
  }

  interface DurableObjectStub {
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  }

  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
  }

  interface CloudflareEnv {
    DB: D1Database;
    AUTOMATION_SCHEDULER?: DurableObjectNamespace;
    [key: string]: unknown;
  }
}

export {};
