import { getCloudflareEnv } from './env';

const TABLE_NAME = 'kv_store';
const KEY_PREFIX = 'json:';

async function ensureTable() {
  const { DB } = getCloudflareEnv();
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  ).run();
}

async function ensureRow<T>(key: string, defaultValue: T) {
  const { DB } = getCloudflareEnv();
  await ensureTable();
  await DB.prepare(`INSERT OR IGNORE INTO ${TABLE_NAME} (key, value) VALUES (?1, ?2)`).bind(key, JSON.stringify(defaultValue)).run();
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
  const row = await DB.prepare(`SELECT value FROM ${TABLE_NAME} WHERE key = ?1`).bind(key).first<{ value: string }>();

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
    await writeJsonFile(relativePath, defaultValue);
    return defaultValue;
  }
}

export async function writeJsonFile<T>(relativePath: string, data: T): Promise<void> {
  const key = resolveKey(relativePath);
  const { DB } = getCloudflareEnv();
  await ensureTable();
  await DB.prepare(`INSERT OR REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?1, ?2)`).bind(key, JSON.stringify(data)).run();
}
