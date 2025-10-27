/**
 * Debug Logger
 */
export class Logger {
  private enabled: boolean;
  private prefix: string;
  constructor(prefix: string = '[ActiveUsers]', enabled: boolean = false) {
    this.prefix = prefix;
    this.enabled = enabled;
  }
  log(...args: any[]): void {
    if (this.enabled) {
    }
  }
  error(...args: any[]): void {
    if (this.enabled) {
      console.error(this.prefix, ...args);
    }
  }
  warn(...args: any[]): void {
    if (this.enabled) {
      console.warn(this.prefix, ...args);
    }
  }
  info(...args: any[]): void {
    if (this.enabled) {
      console.info(this.prefix, ...args);
    }
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
