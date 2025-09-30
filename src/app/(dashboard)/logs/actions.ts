'use server';

import type { LogEntry } from '@/server/services/logs';
import { clearLogs as clearLogsService, getLogs as getLogsService, log as writeLogService } from '@/server/services/logs';

export type { LogEntry };

export async function log(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  await writeLogService(entry);
}

export async function getLogs(): Promise<LogEntry[]> {
  return getLogsService();
}

export async function clearLogs(): Promise<void> {
  await clearLogsService();
}
