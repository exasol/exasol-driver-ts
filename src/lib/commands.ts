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
export type CommandsNoResult = AbortQueryCommand | CloseResultSetCommand;

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

export class AbortQueryCommand extends Command {
  command = 'abortQuery';
}

export interface OIDCSQLCommand {
  accessToken?: string;
  refreshToken?: string;
  useCompression: boolean;
  clientName: string;
  driverName: string;
  clientOs: string;
  clientOsUsername?: string;
  clientVersion: string;
  clientRuntime: string;
  attributes: Attributes;
}

export interface BasicAuthSQLCommand {
  username: string;
  password: string;
  useCompression: boolean;
  sessionID?: number;
  clientName: string;
  driverName: string;
  clientOs?: string;
  clientOsUsername?: string;
  clientLanguage?: string;
  clientVersion: string;
  clientRuntime: string;
  attributes: Attributes;
}

export interface Attributes {
  autocommit?: boolean;
  compressionEnabled?: boolean;
  currentSchema?: string;
  dateFormat?: string;
  dateLanguage?: string;
  datetimeFormat?: string;
  defaultLikeEscapeCharacter?: string;
  feedbackInterval?: number;
  numericCharacters?: string;
  openTransaction?: boolean;
  queryTimeout?: number;
  snapshotTransactionsEnabled?: boolean;
  timestampUtcEnabled?: boolean;
  timezone?: string;
  timeZoneBehavior?: string;
  resultSetMaxRows?: number;
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
