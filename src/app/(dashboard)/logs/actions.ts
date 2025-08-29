
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

const LOGS_FILE_PATH = path.resolve(process.cwd(), 'logs.json');
const MAX_LOG_ENTRIES = 200;

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN';
  message: string;
  context?: any;
}

async function readLogs(): Promise<LogEntry[]> {
  try {
    await fs.access(LOGS_FILE_PATH);
    const fileContent = await fs.readFile(LOGS_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(LOGS_FILE_PATH, JSON.stringify([]));
      return [];
    }
    throw error;
  }
}

async function writeLogs(logs: LogEntry[]): Promise<void> {
  await fs.writeFile(LOGS_FILE_PATH, JSON.stringify(logs, null, 2));
}

export async function log(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  const logs = await readLogs();
  const newLog: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Add new log to the beginning and truncate if over limit
  const updatedLogs = [newLog, ...logs].slice(0, MAX_LOG_ENTRIES);
  
  await writeLogs(updatedLogs);
}

export async function getLogs(): Promise<LogEntry[]> {
    return await readLogs();
}

export async function clearLogs(): Promise<void> {
    await writeLogs([]);
}
