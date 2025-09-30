import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

const LOGS_FILE_PATH = 'logs.json';
const defaultLogs: LogEntry[] = [];
const MAX_LOG_ENTRIES = 200;

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN';
  message: string;
  context?: any;
}

export async function getLogs(): Promise<LogEntry[]> {
  return readJsonFile(LOGS_FILE_PATH, defaultLogs);
}

export async function log(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  const logs = await getLogs();
  const history = Array.isArray(logs) ? logs : [];
  const newLog: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  const updated = [newLog, ...history].slice(0, MAX_LOG_ENTRIES);
  await writeJsonFile(LOGS_FILE_PATH, updated);
}

export async function clearLogs(): Promise<void> {
  await writeJsonFile(LOGS_FILE_PATH, []);
}
