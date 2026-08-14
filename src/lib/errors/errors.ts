import { SQLException } from '../types';
import { ExaErrorBuilder } from './error-reporting';

export const ErrInvalidConn = new ExaErrorBuilder('E-EDJS-1').message('Invalid connection.').error();
export const ErrNotConnected = new ExaErrorBuilder('E-EDJS-19').message('Not connected.').error();
export const newSocketError = (cause: unknown) => {
  return new ExaErrorBuilder('E-EDJS-16').message('Socket error: {{cause}}', getSocketErrorMessage(cause)).error();
};

export const newSocketClosedError = (cause: unknown) => {
  const { code, reason } = getSocketCloseDetails(cause);
  return new ExaErrorBuilder('E-EDJS-36').message('Socket closed: code {{code}}, reason {{reason}}.', code, reason).error();
};

const getSocketErrorMessage = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string') {
    return cause.message;
  }
  if (cause instanceof Event) {
    return `Event type ${cause.type}: ${JSON.stringify(cause)}`;
  }
  try {
    return JSON.stringify(cause) ?? String(cause);
  } catch {
    return String(cause);
  }
};

const getSocketCloseDetails = (cause: unknown): { code: string | number; reason: string } => {
  if (typeof cause === 'object' && cause !== null && 'code' in cause && 'reason' in cause) {
    const { code, reason } = cause;
    if ((typeof code === 'number' || typeof code === 'string') && (typeof reason === 'string' || reason instanceof Uint8Array)) {
      return { code, reason: reason.toString() };
    }
  }
  return { code: 'unknown', reason: 'not provided' };
};
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

export const newSqlError = (exception: SQLException) => {
  return new ExaErrorBuilder('E-EDJS-25').message('SQL error: code: {{code}}, message: {{message}}', exception.sqlCode, exception.text).error();
}

export const GeneralSqlError = new ExaErrorBuilder('E-EDJS-26').message("Query failed with status 'error'.").error();
export const MissingExceptionError = new ExaErrorBuilder('E-EDJS-27').message("Received error response with missing exception details.").error();

export const newInvalidReturnValueResultSet = new ExaErrorBuilder('E-EDJS-10')
  .message('Invalid result type.')
  .mitigation('Please use method query to execute sql')
  .error();

export const newInvalidReturnValueRowCount = new ExaErrorBuilder('E-EDJS-11')
  .message('Invalid result type.')
  .mitigation('Please use method execute instead of query')
  .error();
