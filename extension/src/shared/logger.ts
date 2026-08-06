// Lightweight structured logger.
// Replaces ad-hoc console.* calls so we can route to OpenTelemetry / a sink
// later without touching every call site. Today: thin wrapper over console.
//
// Usage:
//   import { logger } from '../shared/logger';
//   logger.debug('scrape.ok', { url, length: 1234 });
//   logger.warn('sync.failed', { reason: 'offline' });

type LogContext = Record<string, unknown>;

const PREFIX = '[DopaQueue]';

function emit(level: 'debug' | 'info' | 'warn' | 'error', event: string, context?: LogContext) {
  const ts = new Date().toISOString();
  // Compact one-line format for the SW console; humans + log shippers can parse.
  const payload = context ? ` ${JSON.stringify(stripFunctions(context))}` : '';
  const line = `${PREFIX} ${level.toUpperCase()} ${ts} ${event}${payload}`;
  const fn =
    level === 'error' ? console.error :
    level === 'warn'  ? console.warn  :
    level === 'info'  ? console.info  :
                         console.debug;
  fn(line);
}

// Functions and circular refs can't survive JSON.stringify — strip them
// so a stray callback in the context object doesn't throw.
function stripFunctions<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripFunctions) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'function') out[k] = '[Function]';
    else if (v instanceof Error) out[k] = { name: v.name, message: v.message, stack: v.stack };
    else out[k] = stripFunctions(v);
  }
  return out as T;
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit('debug', event, context),
  info:  (event: string, context?: LogContext) => emit('info',  event, context),
  warn:  (event: string, context?: LogContext) => emit('warn',  event, context),
  error: (event: string, context?: LogContext) => emit('error', event, context),
};

export default logger;
