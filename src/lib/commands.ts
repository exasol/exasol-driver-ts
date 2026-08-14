import { SQLQueryColumn } from './types';

export type Commands =
  | BasicAuthSQLCommand
  | BasicAuthSQLCommand
  | LoginSQLCommand
  | LoginTokenSQLCommand
  | OIDCSQLCommand
  | BasicAuthSQLCommand
  | SQLBatchCommand
  | SQLSingleCommand
  | FetchCommand
  | CloseResultSetCommand
  | CreatePreparedStatementCommand
  | ClosePreparedStatementCommand
  | ExecutePreparedStatementCommand
  | SchemasCommand
  | UsersCommand
  | RolesCommand
  | FunctionsCommand
  | ScriptsCommand
  | ColumnsCommand
  | TablesCommand
  | DisconnectCommand;
export type CommandsNoResult = AbortQueryCommand;

export abstract class Command {
  abstract command: string;
  attributes?: Partial<Attributes>;

  constructor(attributes?: Partial<Attributes>) {
    this.attributes = attributes;
  }
}

export class LoginTokenSQLCommand extends Command {
  command = 'loginToken';
  protocolVersion: number;

  constructor(protocolVersion: number, attributes?: Partial<Attributes>) {
    super(attributes);
    this.protocolVersion = protocolVersion;
  }
}

export class LoginSQLCommand extends Command {
  command = 'login';
  protocolVersion: number;

  constructor(protocolVersion: number, attributes?: Partial<Attributes>) {
    super(attributes);
    this.protocolVersion = protocolVersion;
  }
}

export class FetchCommand extends Command {
  command = 'fetch';
  resultSetHandle: number;
  startPosition: number;
  numBytes: number;

  constructor(
    options: {
      resultSetHandle: number;
      startPosition: number;
      numBytes: number;
    },
    attributes?: Partial<Attributes>
  ) {
    super(attributes);
    this.resultSetHandle = options.resultSetHandle;
    this.startPosition = options.startPosition;
    this.numBytes = options.numBytes;
  }
}

export class SQLBatchCommand extends Command {
  command = 'executeBatch';
  sqlTexts: string[];

  constructor(sqlTexts: string[], attributes?: Partial<Attributes>) {
    super(attributes);
    this.sqlTexts = sqlTexts;
  }
}

export class SQLSingleCommand extends Command {
  command = 'execute';
  sqlText: string;

  constructor(sqlText: string, attributes?: Partial<Attributes>) {
    super(attributes);
    this.sqlText = sqlText;
  }
}

export class CreatePreparedStatementCommand extends Command {
  command = 'createPreparedStatement';
  sqlText: string;

  constructor(sqlText: string, attributes?: Partial<Attributes>) {
    super(attributes);
    this.sqlText = sqlText;
  }
}

/** https://github.com/exasol/websocket-api/blob/master/docs/commands/closeResultSetV1.md */
export class CloseResultSetCommand extends Command {
  command = 'closeResultSet';
  resultSetHandles: number[];

  constructor(resultSetHandles: number[], attributes?: Partial<Attributes>) {
    super(attributes);
    this.resultSetHandles = resultSetHandles;
  }
}

export class ExecutePreparedStatementCommand extends Command {
  command = 'executePreparedStatement';
  statementHandle: number;
  numColumns: number;
  numRows: number;
  columns: SQLQueryColumn[];
  data: Array<(string | number | boolean | null)[]>;

  constructor(
    options: {
      statementHandle: number;
      numColumns: number;
      numRows: number;
      columns: SQLQueryColumn[];
      data: Array<(string | number | boolean | null)[]>;
    },
    attributes?: Partial<Attributes>
  ) {
    super(attributes);
    this.statementHandle = options.statementHandle;
    this.columns = options.columns;
    this.numColumns = options.numColumns;
    this.data = options.data;
    this.numRows = options.numRows;
  }
}

export class ClosePreparedStatementCommand extends Command {
  command = 'closePreparedStatement';
  statementHandle: number;

  constructor(statementHandle: number, attributes?: Partial<Attributes>) {
    super(attributes);
    this.statementHandle = statementHandle;
  }
}

export class SetAttributesCommand extends Command {
  command = 'setAttributes';
}

export class DisconnectCommand extends Command {
  command = 'disconnect';
}

/** https://github.com/exasol/websocket-api/blob/master/docs/commands/abortQueryV1.md */
export class AbortQueryCommand extends Command {
  command = 'abortQuery';
}

/** https://github.com/exasol/websocket-api/blob/master/docs/commands/loginV3.md?plain=1#L65 */
export interface LoginOptions {
  /** use compression for messages during the session (beginning after the login process is completed) */
  useCompression: boolean;
  /** requested session ID */
  sessionID?: number;
  /** client program name, (e.g., "EXAplus") */
  clientName: string;
  /** driver name, (e.g., "EXA Python") */
  driverName: string;
  /** name and version of the client operating system */
  clientOs: string;
  /** client's operating system user name */
  clientOsUsername?: string;
  /** language setting of the client system */
  clientLanguage?: string;
  /** client version number */
  clientVersion: string;
  /** name and version of the client runtime */
  clientRuntime: string;
  /** array of attributes to set for the connection */
  attributes: Attributes;
}

/** See https://github.com/exasol/websocket-api/blob/master/docs/commands/loginTokenV3.md?plain=1#L49 */
export interface OIDCSQLCommand extends LoginOptions {
  /** OpenID access token to use for the login process */
  accessToken?: string;
  /** OpenID refresh token to use for the login process */
  refreshToken?: string;
}

/** See https://github.com/exasol/websocket-api/blob/master/docs/commands/loginV3.md?plain=1#L65 */
export interface BasicAuthSQLCommand extends LoginOptions {
  /** Exasol user name to use for the login process */
  username: string;
  /** user's password or OpenID refresh token, which is encrypted using publicKey (see 2.) and PKCS #1 v1.5 padding, encoded in Base64 format */
  password: string;
}

/** https://github.com/exasol/websocket-api/blob/master/docs/WebsocketAPIV5.md#attributes-session-and-database-properties */
export interface Attributes {
  /** If true, commit() will be executed automatically after each statement. If false, commit() and rollback() must be executed manually. */
  autocommit?: boolean;
  /** If true, the WebSocket data frame payload data is compressed. If false, it is not compressed. */
  compressionEnabled?: boolean;
  /** Current schema name */
  currentSchema?: string;
  /** Date format */
  dateFormat?: string;
  /** Language used for the day and month of dates. */
  dateLanguage?: string;
  /** Timestamp format */
  datetimeFormat?: string;
  /** Escape character in LIKE expressions. */
  defaultLikeEscapeCharacter?: string;
  /** Time interval (in seconds) specifying how often heartbeat/feedback packets are sent to the client during query execution. */
  feedbackInterval?: number;
  /** Characters specifying the group and decimal separators (`NLS_NUMERIC_CHARACTERS`). For example, `",."` would result in `"123,456,789.123"`. */
  numericCharacters?: string;
  /** If true, a transaction is open. If false, a transaction is not open. */
  openTransaction?: boolean;
  /** Query timeout value (in seconds). If a query runs longer than the specified time, it will be aborted. */
  queryTimeout?: number;
  /** Maximum number of result set rows returned, 0 (default) means no limit. Only applicable to execute, executeBatch and executePreparedStatement. */
  resultSetMaxRows?: number;
  /** If true, snapshot transactions will be used. If false, they will not be used. */
  snapshotTransactionsEnabled?: boolean;
  /** If true, timestamps will be converted to UTC. If false, UTC will not be used. */
  timestampUtcEnabled?: boolean;
  /** Timezone of the session. */
  timezone?: string;
  /** Specifies the conversion behavior of UTC timestamps to local timestamps when the time value occurs during a time shift because of daylight saving time (`TIME_ZONE_BEHAVIOR`). */
  timeZoneBehavior?: string;
}

export class SchemasCommand extends Command {
  command = 'getSchemas';
}

export class RolesCommand extends Command {
  command = 'getRoles';
}

export class TablesCommand extends Command {
  command = 'getTables';
}

export class FunctionsCommand extends Command {
  command = 'getFunctions';
}

export class ColumnsCommand extends Command {
  command = 'getColumns';
}
export class ScriptsCommand extends Command {
  command = 'getScripts';
}
export class UsersCommand extends Command {
  command = 'getUsers';
}
