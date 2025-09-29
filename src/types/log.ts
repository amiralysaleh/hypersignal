export type LogLevel = 'INFO' | 'ERROR' | 'WARN';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
}
