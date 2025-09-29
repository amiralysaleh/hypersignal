import * as fs from 'fs/promises';
import * as path from 'path';

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  await ensureDirectoryExists(filePath);
  try {
    const file = await fs.readFile(filePath, 'utf-8');
    if (!file.trim()) {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
      return structuredClone(defaultValue);
    }
    return JSON.parse(file) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
      return structuredClone(defaultValue);
    }
    throw error;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDirectoryExists(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
