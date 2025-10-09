import { DbTimeoutError, readJsonFile, writeJsonFile } from '../storage/jsonStore';

const LOGS_FILE_PATH = 'logs.json';
const defaultLogs: LogEntry[] = [];
const MAX_LOG_ENTRIES = 200;
const LOG_WRITE_RETRY_ATTEMPTS = 3;
const LOG_WRITE_RETRY_DELAY_MS = 50;

let logWriteQueue: Promise<void> = Promise.resolve();

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs));
}

async function persistLog(entry: Omit<LogEntry, 'timestamp'>) {
  const logs = await getLogs();
  const history = Array.isArray(logs) ? logs : [];
  const newLog: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  const updated = [newLog, ...history].slice(0, MAX_LOG_ENTRIES);
  await writeJsonFile(LOGS_FILE_PATH, updated);
}

async function persistLogWithRetry(entry: Omit<LogEntry, 'timestamp'>, attempt = 1): Promise<void> {
  try {
    await persistLog(entry);
  } catch (error) {
    if (error instanceof DbTimeoutError) {
      console.warn('[logs] D1 timeout while persisting log entry, aborting retries.');
      throw error;
    }

    if (attempt >= LOG_WRITE_RETRY_ATTEMPTS) {
      throw error;
    }

    await sleep(LOG_WRITE_RETRY_DELAY_MS * attempt);
    await persistLogWithRetry(entry, attempt + 1);
  }
}

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
  logWriteQueue = logWriteQueue.catch(() => undefined).then(() => persistLogWithRetry(entry));

  try {
    await logWriteQueue;
  } catch (error) {
    console.error('Failed to persist log entry', error);
    throw error;
  }
}

export async function clearLogs(): Promise<void> {
  await writeJsonFile(LOGS_FILE_PATH, []);
}
