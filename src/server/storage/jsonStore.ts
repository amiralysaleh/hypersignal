import { promises as fs } from 'fs';
import path from 'path';

export async function ensureFile<T>(relativePath: string, defaultValue: T): Promise<string> {
  const filePath = path.resolve(process.cwd(), relativePath);
  try {
    await fs.access(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
    } else {
      throw error;
    }
  }
  return filePath;
}

export async function readJsonFile<T>(relativePath: string, defaultValue: T): Promise<T> {
  const filePath = await ensureFile(relativePath, defaultValue);
  const content = await fs.readFile(filePath, 'utf-8');
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
    return parsed;
  } catch (error) {
    // If the file is corrupted, reset it to the default value so the app can recover gracefully.
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
}

export async function writeJsonFile<T>(relativePath: string, data: T): Promise<void> {
  const filePath = path.resolve(process.cwd(), relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
