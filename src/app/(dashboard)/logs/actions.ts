'use server';

import { appendLog, clearAllLogs, readLogs } from '@/backend/log-service';
import type { LogEntry } from '@/types/log';

export type { LogEntry } from '@/types/log';

export async function log(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  await appendLog(entry);
}

export async function getLogs(): Promise<LogEntry[]> {
  return readLogs();
}

export async function clearLogs(): Promise<void> {
  return clearAllLogs();
}
