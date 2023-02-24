/* eslint-disable @typescript-eslint/no-explicit-any */
export enum LogLevel {
  Off = 0,
  Error,
  Warn,
  Info,
  Debug,
  Trace,
}

export type LoggerMethod = (...data: any) => void;

export interface ILogger {
  error: LoggerMethod;
  warn: LoggerMethod;
  info: LoggerMethod;
  log: LoggerMethod;
  debug: LoggerMethod;
  trace: LoggerMethod;
}
export class Logger implements ILogger {
  private readonly level: LogLevel = LogLevel.Debug;

  constructor(level?: number) {
    if (level) {
      this.level = level;
    }
  }

  private readonly emptyLog = () => {
    /*empty */
  };

  public get error(): LoggerMethod {
    if (this.level >= LogLevel.Error) {
      return this._log('ERROR', 'red');
    }
    return this.emptyLog;
  }

  public get warn(): LoggerMethod {
    if (this.level >= LogLevel.Warn) {
      return this._log('WARN', 'darkorange');
    }
    return this.emptyLog;
  }

  public get log(): LoggerMethod {
    return this.debug;
  }

  public get info(): (...data: any) => void {
    if (this.level >= LogLevel.Info) {
      return this._log('INFO', 'blue');
    }
    return this.emptyLog;
  }

  // Used to print version, independent of the log level
  public get version(): (...data: any) => void {
    return this._log('INFO', 'blue');
  }

  public get debug(): (...data: any) => void {
    if (this.level >= LogLevel.Debug) {
      return this._log('DEBUG');
    }
    return this.emptyLog;
  }

  public get trace(): LoggerMethod {
    if (this.level >= LogLevel.Trace) {
      return this._log('TRACE');
    }
    return this.emptyLog;
  }

  private _log(level: string, color = 'inherit') {
    return console.log.bind(
      console,
      `%c[${new Date().toISOString()}] %c${level}%c: %s`,
      'color: gray',
      'color: ' + color,
      'color: inherit'
    );
  }
}
