type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

function formatLogEntry(entry: LogEntry): string {
  const time = entry.timestamp;
  const level = entry.level.toUpperCase().padEnd(5);
  const context = entry.context ? `[${entry.context}]` : '';
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${time} ${level} ${context} ${entry.message}${data}`;
}

export const logger = {
  info(message: string, context?: string, data?: unknown): void {
    const entry: LogEntry = {
      level: 'info',
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };
    console.log(formatLogEntry(entry));
  },

  warn(message: string, context?: string, data?: unknown): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };
    console.warn(formatLogEntry(entry));
  },

  error(message: string, context?: string, error?: unknown): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      context,
      data: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      timestamp: new Date().toISOString(),
    };
    console.error(formatLogEntry(entry));
  },

  debug(message: string, context?: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      const entry: LogEntry = {
        level: 'debug',
        message,
        context,
        data,
        timestamp: new Date().toISOString(),
      };
      console.debug(formatLogEntry(entry));
    }
  },
};

