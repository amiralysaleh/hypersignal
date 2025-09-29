import * as path from 'path';
import { readJsonFile, writeJsonFile } from './storage';
import { LogEntry } from '@/types/log';

const LOGS_FILE_PATH = path.resolve(process.cwd(), 'logs.json');
const MAX_LOG_ENTRIES = 200;

export async function readLogs(): Promise<LogEntry[]> {
  return readJsonFile<LogEntry[]>(LOGS_FILE_PATH, []);
}

export async function appendLog(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  const logs = await readLogs();
  const newLog: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  const updatedLogs = [newLog, ...logs].slice(0, MAX_LOG_ENTRIES);
  await writeJsonFile(LOGS_FILE_PATH, updatedLogs);
}

export async function clearAllLogs(): Promise<void> {
  await writeJsonFile(LOGS_FILE_PATH, []);
}

export async function log(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  await appendLog(entry);
}
