/**
 * Debug Logger
 */
export class Logger {
  private enabled: boolean;
  private prefix: string;
  private bufferEnabled: boolean;
  private static STORAGE_KEY = 'activeUsers.logs';
  private static MAX_ENTRIES = 500;
  constructor(prefix: string = '[ActiveUsers]', enabled: boolean = false) {
    this.prefix = prefix;
    this.enabled = enabled;
    this.bufferEnabled = true;
  }
  private appendToBuffer(level: 'log' | 'info' | 'warn' | 'error', parts: any[]): void {
    if (!this.bufferEnabled) return;
    try {
      const now = new Date();
      const entry = {
        ts: now.toISOString(),
        level,
        prefix: this.prefix,
        message: parts.map((p) => {
          try { return typeof p === 'string' ? p : JSON.stringify(p); } catch { return String(p); }
        }).join(' '),
      };
      const raw = localStorage.getItem(Logger.STORAGE_KEY);
      const list = raw ? JSON.parse(raw) as any[] : [];
      list.push(entry);
      if (list.length > Logger.MAX_ENTRIES) {
        list.splice(0, list.length - Logger.MAX_ENTRIES);
      }
      localStorage.setItem(Logger.STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore storage errors (quota, privacy mode)
    }
  }
  log(...args: any[]): void {
    if (this.enabled) {
      // console
      // eslint-disable-next-line no-console
      console.log(this.prefix, ...args);
      // persistent buffer
      this.appendToBuffer('log', args);
    }
  }
  error(...args: any[]): void {
    if (this.enabled) {
      console.error(this.prefix, ...args);
      this.appendToBuffer('error', args);
    }
  }
  warn(...args: any[]): void {
    if (this.enabled) {
      console.warn(this.prefix, ...args);
      this.appendToBuffer('warn', args);
    }
  }
  info(...args: any[]): void {
    if (this.enabled) {
      console.info(this.prefix, ...args);
      this.appendToBuffer('info', args);
    }
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  static readBuffered(): Array<{ ts: string; level: string; prefix: string; message: string }>
  {
    try {
      const raw = localStorage.getItem(Logger.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  static clearBuffered(): void {
    try { localStorage.removeItem(Logger.STORAGE_KEY); } catch {}
  }
}
