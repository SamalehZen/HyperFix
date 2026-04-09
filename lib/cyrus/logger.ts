type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface CyrusLogEntry {
  timestamp: string;
  level: LogLevel;
  step: string;
  message: string;
  data?: Record<string, any>;
}

export class CyrusLogger {
  private logs: CyrusLogEntry[] = [];

  log(
    level: LogLevel,
    step: string,
    message: string,
    data?: Record<string, any>,
  ): void {
    const entry: CyrusLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      data,
    };
    this.logs.push(entry);

    const tag = `[Cyrus V2] [${level.toUpperCase()}] [${step}]`;
    const line = data
      ? `${tag} ${message} ${JSON.stringify(data)}`
      : `${tag} ${message}`;

    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      default:
        console.log(line);
        break;
    }
  }

  info(step: string, message: string, data?: Record<string, any>): void {
    this.log('info', step, message, data);
  }

  warn(step: string, message: string, data?: Record<string, any>): void {
    this.log('warn', step, message, data);
  }

  error(step: string, message: string, data?: Record<string, any>): void {
    this.log('error', step, message, data);
  }

  debug(step: string, message: string, data?: Record<string, any>): void {
    this.log('debug', step, message, data);
  }

  getLogs(): CyrusLogEntry[] {
    return [...this.logs];
  }

  flush(): void {
    for (const entry of this.logs) {
      const tag = `[Cyrus V2] [${entry.level.toUpperCase()}] [${entry.step}]`;
      const line = entry.data
        ? `${tag} ${entry.message} ${JSON.stringify(entry.data)}`
        : `${tag} ${entry.message}`;
      console.log(line);
    }
  }
}
