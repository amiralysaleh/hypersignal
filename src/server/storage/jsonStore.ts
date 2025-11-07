import { getCloudflareEnv } from './env';

const TABLE_NAME = 'kv_store';
const KEY_PREFIX = 'json:';
const DB_OPERATION_TIMEOUT_MS = Math.max(1_000, Number(process.env.DB_OPERATION_TIMEOUT_MS ?? 5_000));

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

let ensureTablePromise: Promise<void> | null = null;

async function ensureTable() {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  const ensure = async () => {
    const { DB } = getCloudflareEnv();
    try {
      await withDbTimeout('ensureTable', () =>
        DB.prepare(
          `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )`
        ).run()
      );
    } catch (error) {
      console.warn('[jsonStore] Failed to ensure kv_store table', error);
      throw error;
    }
  };

  ensureTablePromise = ensure()
    .catch((error) => {
      ensureTablePromise = null;
      throw error;
    });

  return ensureTablePromise;
}

async function ensureRow<T>(key: string, defaultValue: T) {
  const { DB } = getCloudflareEnv();
  await ensureTable();
  try {
    await withDbTimeout('ensureRow', () =>
      DB.prepare(`INSERT OR IGNORE INTO ${TABLE_NAME} (key, value) VALUES (?1, ?2)`).bind(key, JSON.stringify(defaultValue)).run()
    );
  } catch (error) {
    console.warn(`[jsonStore] Failed to ensure row for key ${key}`, error);
    throw error;
  }
}

function resolveKey(relativePath: string) {
  return `${KEY_PREFIX}${relativePath}`;
}

export async function ensureFile<T>(relativePath: string, defaultValue: T): Promise<string> {
  const key = resolveKey(relativePath);
  await ensureRow(key, defaultValue);
  return key;
}

export async function readJsonFile<T>(relativePath: string, defaultValue: T): Promise<T> {
  const key = await ensureFile(relativePath, defaultValue);
  const { DB } = getCloudflareEnv();
  let row: { value: string } | null = null;

  try {
    row = await withDbTimeout('readJsonFile', () =>
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
  await ensureTable();

  try {
    await withDbTimeout('writeJsonFile', () =>
      DB.prepare(`INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?1, ?2)`).bind(key, JSON.stringify(data)).run()
    );
  } catch (error) {
    console.warn(`[jsonStore] Failed to write key ${key}`, error);
    throw error;
  }
}
