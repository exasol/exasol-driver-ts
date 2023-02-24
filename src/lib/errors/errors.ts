import { ExaErrorBuilder } from './error-reporting';

export const ErrInvalidConn = new ExaErrorBuilder('E-EDJS-1').message('Invalid connection.').error();
export const ErrClosed = new ExaErrorBuilder('E-EDJS-2').message('Connection was closed.').error();
export const ErrMalformedData = new ExaErrorBuilder('E-EDJS-3').message('Malformed result.').error();
export const ErrInvalidValuesCount = new ExaErrorBuilder('E-EDJS-4').message('Invalid value count for prepared status.').error();
export const ErrLoggerNil = new ExaErrorBuilder('E-EDJS-5')
  .message('Logger is undefined or null.')
  .mitigation('Set logger in ExasolDriver constructor.')
  .error();
export const ErrInvalidCredentials = new ExaErrorBuilder('E-EDJS-6').message('Invalid credentials.').error();
export const ErrJobAlreadyRunning = new ExaErrorBuilder('E-EDJS-7').message('Another query is already running.').error();

export const newPoolSizeErr = (max: number) => {
  return new ExaErrorBuilder('E-EDJS-8').message('Execution failed pool reached its limit from {{max}} parallel connections.', max).error();
};

export const newInvalidHostRangeLimits = (host: string) => {
  return new ExaErrorBuilder('E-EDJS-9').message('Invalid host range limits: {{host name}}.', host).error();
};
