import { LogLevel, Logger } from './logger';

describe('Logger', () => {
  it('Should "console.log()" with default Log level (= debug) when using logger.debug()', () => {
    const defaultLogger = new Logger();

    const logSpy = jest.spyOn(global.console, 'log');
    defaultLogger.debug('hello');
    expect(logSpy).toHaveBeenCalled();
  });
  it('Should "console.log()" with log level debug when using logger.debug()', () => {
    const defaultLogger = new Logger(LogLevel.Debug);

    const logSpy = jest.spyOn(global.console, 'log');
    defaultLogger.debug('hello');
    expect(logSpy).toHaveBeenCalled();
  });
  it('Should not "console.log" with log level "off" when using logger.debug()', () => {
    const defaultLogger = new Logger(LogLevel.Off);

    const logSpy = jest.spyOn(global.console, 'log');
    defaultLogger.debug('hello');
    expect(logSpy).not.toHaveBeenCalled();
  });
  it('Should not "console.log" with a lower debug level than debug when using logger.debug()', () => {
    const defaultLogger = new Logger(LogLevel.Error);

    const logSpy = jest.spyOn(global.console, 'log');
    defaultLogger.debug('hello');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('Should "console.log" with a higher debug level than debug when using logger.debug()', () => {
    const defaultLogger = new Logger(LogLevel.Trace);

    const logSpy = jest.spyOn(global.console, 'log');
    defaultLogger.debug('hello');
    expect(logSpy).toHaveBeenCalled();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
