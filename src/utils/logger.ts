/**
 * Centralized Logger utility for the Fountain plugin.
 * Provides a standard interface for logging with different levels.
 * Debug logs are only emitted when 'Debug Mode' is enabled in settings.
 */
export class Logger {
  private static debugEnabled = false;

  /**
   * Initializes the logger with current settings.
   */
  static initialize(debugMode: boolean) {
    this.debugEnabled = debugMode;
  }

  /**
   * Logs a debug message to the console if Debug Mode is enabled.
   */
  static debug(prefix: string, message: string, ...args: any[]) {
    if (this.debugEnabled) {
      console.log(`[Fountain][DEBUG][${prefix}] ${message}`, ...args);
    }
  }

  /**
   * Logs an info message to the console.
   */
  static info(prefix: string, message: string, ...args: any[]) {
    console.log(`[Fountain][INFO][${prefix}] ${message}`, ...args);
  }

  /**
   * Logs a warning message to the console.
   */
  static warn(prefix: string, message: string, ...args: any[]) {
    console.warn(`[Fountain][WARN][${prefix}] ${message}`, ...args);
  }

  /**
   * Logs an error message to the console.
   */
  static error(prefix: string, message: string, ...args: any[]) {
    console.error(`[Fountain][ERROR][${prefix}] ${message}`, ...args);
  }
}
