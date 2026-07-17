/**
 * Structured Logger (from Automaton, simplified)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

let globalLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setGlobalLogLevel(level: LogLevel) {
  globalLogLevel = level;
}

export class StructuredLogger {
  constructor(private module: string) {}

  private log(level: LogLevel, message: string, ctx?: Record<string, unknown>) {
    if (LEVELS[level] < LEVELS[globalLogLevel]) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      module: this.module,
      msg: message,
      ...ctx,
    };
    if (level === "error") {
      console.error(JSON.stringify(line));
    } else {
      console.log(JSON.stringify(line));
    }
  }

  debug(msg: string, ctx?: Record<string, unknown>) { this.log("debug", msg, ctx); }
  info(msg: string, ctx?: Record<string, unknown>) { this.log("info", msg, ctx); }
  warn(msg: string, ctx?: Record<string, unknown>) { this.log("warn", msg, ctx); }
  error(msg: string, ctx?: Record<string, unknown>) { this.log("error", msg, ctx); }
}

export function createLogger(module: string): StructuredLogger {
  return new StructuredLogger(module);
}
