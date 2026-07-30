import { getCloudflareEnv } from './env';

const TABLE_NAME = 'kv_store';
const KEY_PREFIX = 'json:';
const DB_OPERATION_TIMEOUT_MS = Math.max(1_000, Number(process.env.DB_OPERATION_TIMEOUT_MS ?? 5_000));
const DB_TIMEOUT_RETRY_ATTEMPTS = Math.max(1, Number(process.env.DB_TIMEOUT_RETRY_ATTEMPTS ?? 3));
const DB_TIMEOUT_RETRY_BACKOFF_MS = Math.max(0, Number(process.env.DB_TIMEOUT_RETRY_BACKOFF_MS ?? 500));

export class DbTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbTimeoutError';
  }
}

async function withDbTimeout<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const timeoutMs = DB_OPERATION_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new DbTimeoutError(`D1 operation "${label}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    return result as T;
  } catch (error) {
    if (timedOut) {
      console.warn(`[jsonStore] ${label} exceeded timeout (${timeoutMs}ms)`);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

let createTablePromise: Promise<void> | null = null;

function isMissingTableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes('no such table') && message.includes(TABLE_NAME);
}

function isDbTimeoutError(error: unknown): error is DbTimeoutError {
  return error instanceof DbTimeoutError;
}

async function wait(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeoutRetries<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < DB_TIMEOUT_RETRY_ATTEMPTS) {
    attempt += 1;

    try {
      return await withDbTimeout(label, operation);
    } catch (error) {
      lastError = error;

      if (!isDbTimeoutError(error) || attempt >= DB_TIMEOUT_RETRY_ATTEMPTS) {
        throw error;
      }

      const delayMs = DB_TIMEOUT_RETRY_BACKOFF_MS * 2 ** (attempt - 1);
      console.warn(
        `[jsonStore] ${label} timed out (attempt ${attempt}/${DB_TIMEOUT_RETRY_ATTEMPTS}). Retrying after ${delayMs}ms.`
      );
      await wait(delayMs);
    }
  }

  throw lastError ?? new DbTimeoutError(`${label} failed after ${DB_TIMEOUT_RETRY_ATTEMPTS} attempts`);
}

async function createTableIfMissing() {
  if (createTablePromise) {
    return createTablePromise;
  }

  const { DB } = getCloudflareEnv();

  const create = async () => {
    try {
      await withTimeoutRetries('createTable', () =>
        DB.prepare(
          `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )`
        ).run()
      );
    } catch (error) {
      console.warn('[jsonStore] Failed to create kv_store table', error);
      throw error;
    }
  };

  createTablePromise = create().catch((error) => {
    createTablePromise = null;
    throw error;
  });

  return createTablePromise;
}

async function runWithTableRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let attemptedCreate = false;

  while (true) {
    try {
      return await withTimeoutRetries(label, operation);
    } catch (error) {
      if (!attemptedCreate && isMissingTableError(error)) {
        attemptedCreate = true;
        console.warn(`[jsonStore] ${label} failed because table was missing. Creating table and retrying.`);
        await createTableIfMissing();
        continue;
      }

      throw error;
    }
  }
}

function resolveKey(relativePath: string) {
  return `${KEY_PREFIX}${relativePath}`;
}

export async function ensureFile<T>(relativePath: string, defaultValue: T): Promise<string> {
  const key = resolveKey(relativePath);
  const { DB } = getCloudflareEnv();

  await runWithTableRetry('ensureRow', () =>
    DB.prepare(`INSERT OR IGNORE INTO ${TABLE_NAME} (key, value) VALUES (?1, ?2)`).bind(key, JSON.stringify(defaultValue)).run()
  );
  return key;
}

export async function readJsonFile<T>(relativePath: string, defaultValue: T): Promise<T> {
  const key = await ensureFile(relativePath, defaultValue);
  const { DB } = getCloudflareEnv();
  let row: { value: string } | null = null;

  try {
    row = await runWithTableRetry('readJsonFile', () =>
      DB.prepare(`SELECT value FROM ${TABLE_NAME} WHERE key = ?1`).bind(key).first<{ value: string }>()
    );
  } catch (error) {
    console.warn(`[jsonStore] Failed to read key ${key}`, error);
    throw error;
  }

  if (!row || !row.value) {
    return defaultValue;
  }

  const content = row.value;
  if (!content.trim()) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(defaultValue)) {
      return Array.isArray(parsed) ? (parsed as T) : defaultValue;
    }
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      return { ...(defaultValue as object), ...(parsed as object) } as T;
    }
    return parsed as T;
  } catch (error) {
    console.warn(`[jsonStore] Failed to parse JSON for key ${key}, resetting to default.`, error);
    await writeJsonFile(relativePath, defaultValue);
    return defaultValue;
  }
}

export async function writeJsonFile<T>(relativePath: string, data: T): Promise<void> {
  const key = resolveKey(relativePath);
  const { DB } = getCloudflareEnv();

  try {
    await runWithTableRetry('writeJsonFile', () =>
      DB.prepare(`INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?1, ?2)`).bind(key, JSON.stringify(data)).run()
    );
  } catch (error) {
    console.warn(`[jsonStore] Failed to write key ${key}`, error);
    throw error;
  }
}
