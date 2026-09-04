import * as forge from 'node-forge';

import { Attributes, Commands, CommandsNoResult, OIDCSQLCommand, SQLBatchCommand, SQLSingleCommand } from './commands';
import { Connection, ExaWebsocket } from './connection';
import {
  ErrClosed,
  ErrInvalidConn,
  ErrInvalidCredentials,
  ErrLoggerNil,
  ErrMalformedData,
  GeneralSqlError,
  newInvalidReturnValueResultSet,
  newInvalidReturnValueRowCount,
  newSocketError,
  newSqlError,
} from './errors/errors';
import { fetchData } from './fetch';
import { ILogger, Logger, LogLevel } from './logger/logger';
import { createLoginOptions } from './login-options';
import { ConnectionPool } from './pool/pool';
import { QueryResult } from './query-result';
import { CetCancelFunction, IExasolClient, IStatement } from './sql-client.interface';
import { Statement } from './statement';
import { CreatePreparedStatementResponse, PublicKeyResponse, SQLQueriesResponse, SQLResponse } from './types';

export interface Config {
  /** Host name or IP address */
  host: string;
  /** Exasol port, e.g. 8563 */
  port: number;
  /** Websocket URL. Default: `wss://<host>:<port>`. This allows overriding the default URL if necessary.  */
  url?: string;
  user?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  autocommit: boolean;
  /** Disable encryption. @deprecated Exasol only supports encrypted connections. Setting this to `false` has no effect. */
  encryption?: boolean;
  clientName: string;
  clientVersion: string;
  /** Name and version of the client operating system. Defaults to the active platform. */
  clientOs?: string;
  /** Operating-system username of the client. Defaults to the active Node.js user when available. */
  clientOsUsername?: string;
  /** Name and version of the client runtime. Defaults to the active platform. */
  clientRuntime?: string;
  /** Number of bytes to fetch per request. Default: 1024 * 1024 (1 MB) */
  fetchSize: number;
  schema?: string;
  /** Limit max rows fetched */
  resultSetMaxRows?: number;
  onClose?: () => void;
  onError?: () => void;
  compression: boolean;
}

interface InternalConfig {
  apiVersion: number;
}

export { driverVersion } from './login-options';

export type WebsocketFactory = (url: string) => ExaWebsocket;

export class BaseExasolDriver implements IExasolClient {
  private readonly defaultConfig: Config & InternalConfig = {
    host: 'localhost',
    port: 8563,
    fetchSize: 1024 * 1024, // in bytes = 1 MB
    clientName: 'Javascript client',
    clientVersion: '1',
    autocommit: true,
    encryption: true,
    compression: false,
    apiVersion: 3,
  };
  protected readonly config: Config & InternalConfig & { websocketFactory: WebsocketFactory };
  private readonly logger: ILogger;
  protected closed = false;

  private readonly pool: ConnectionPool<Connection>;

  protected constructor(websocketFactory: WebsocketFactory, config: Partial<Config>, logger: ILogger = new Logger(LogLevel.Off)) {
    // Used internally to avoid parallel execution
    this.pool = new ConnectionPool<Connection>(1, logger);
    this.config = {
      ...this.defaultConfig,
      ...config,
      websocketFactory,
    };
    this.logger = logger;
  }

  /**
   * @inheritDoc
   */
  public async connect(): Promise<void> {
    // [impl->dsn~runtime-connect-basic-authentication~1]
    // [impl->dsn~runtime-reject-missing-credentials~1]
    let hasCredentials = false;
    let isBasicAuth = false;
    if (this.config.user && this.config.password) {
      hasCredentials = true;
      isBasicAuth = true;
    }
    if (this.config.refreshToken || this.config.accessToken) {
      hasCredentials = true;
    }

    if (!hasCredentials) {
      throw ErrInvalidCredentials;
    }

    if (!this.logger) {
      throw ErrLoggerNil;
    }

    // [impl->req~do-not-allow-disabling-encryption~1]
    let url = `wss://${this.config.host}:${this.config.port}`;
    if (this.config.url) {
      url = this.config.url;
    }

    const webSocket = this.config.websocketFactory(url);
    return new Promise<void>((resolve, reject) => {
      const connection = new Connection(webSocket, this.logger, Date.now() + '', (): void => {
        this.logger.debug('[SQLClient] Got close event');
        if (this.config.onClose) {
          this.config.onClose();
        }
        void connection.close();
        reject(ErrClosed);
      });
      webSocket.onerror = (err) => {
        this.logger.debug('[SQLClient] OnError', err);
        if (this.config.onError) {
          this.config.onError();
        }
        this.close();
        reject(newSocketError(err));
      };
      webSocket.onopen = () => {
        this.logger.debug('[SQLClient] Login');
        this.pool
          .add(connection)
          .then(() => {
            if (isBasicAuth) {
              return this.loginBasicAuth();
            }
            return this.loginTokenAuth();
          })
          .then((data) => {
            if (data.status !== 'ok') {
              reject(data.exception);
              return;
            }
            //at this point the user should be logged in, asked for the Public Key and sent credentials and info in login...Auth() methods
            connection.setCompression(this.config.compression);
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
      };
    });
  }

  /**
   * @inheritDoc
   */
  async cancel() {
    // [impl->dsn~runtime-query-cancellation~1]
    if (this.closed) {
      throw ErrClosed;
    }
    const connections = this.pool.getAll();
    if (connections.length === 0) {
      throw ErrInvalidConn;
    }
    await Promise.all(connections.map((connection) => connection.sendCommandWithNoResult({
      command: 'abortQuery',
    })));
  }

  /**
   * @inheritDoc
   */
  public async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.logger.debug('[SQLClient] Close all connections');

    const connections = this.pool.getAll();
    for (const connection of connections) {
      await connection.close();
    }
    this.pool.clear();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    // [impl->dsn~runtime-driver-async-disposal~1]
    return this.close();
  }

  public get broken(): boolean {
    return this.pool.getAll().some((connection) => connection.broken);
  }

  /**
   * @inheritDoc
   */
  public async sendCommandWithNoResult(cmd: CommandsNoResult): Promise<void> {
    if (this.closed) {
      throw ErrClosed;
    }
    const connection = await this.acquire();
    if (connection) {
      return connection
        .sendCommandWithNoResult(cmd)
        .then(() => {
          this.pool.release(connection);
        })
        .catch((err) => {
          this.pool.release(connection);
          throw err;
        });
    }

    throw ErrClosed;
  }

  /**
   * @inheritDoc
   */
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
  ): Promise<QueryResult>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | undefined,
  ): Promise<QueryResult>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'raw' | undefined,
  ): Promise<SQLResponse<SQLQueriesResponse>>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw',
  ): Promise<QueryResult | SQLResponse<SQLQueriesResponse>>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw' | undefined,
  ): Promise<QueryResult | SQLResponse<SQLQueriesResponse>> {
    // [impl->dsn~runtime-query-execution~3]
    // [impl->dsn~runtime-raw-response-execution~1]
    const connection = await this.acquire();
    return connection
      .sendCommand<SQLQueriesResponse>(new SQLSingleCommand(sqlStatement, attributes), getCancel)
      .then((data) => {
        return this.fetchData(data, connection);
      })
      .then((data) => {
        if (connection) {
          this.pool.release(connection);
        }
        return data;
      })
      .then((data) => {
        if (responseType == 'raw') {
          return data;
        }

        this.verifyNoError(data);

        if (data.responseData.numResults === 0) {
          throw ErrMalformedData;
        }

        if (data.responseData.results[0].resultType === 'rowCount') {
          throw newInvalidReturnValueRowCount;
        }

        return new QueryResult(data.responseData.results[0].resultSet);
      })
      .catch((err) => {
        if (connection) {
          this.pool.release(connection);
        }
        throw err;
      });
  }

  async fetchData(data: SQLResponse<SQLQueriesResponse>, connection: Connection): Promise<SQLResponse<SQLQueriesResponse>> {
    const fetchSizeBytes = this.config.fetchSize || this.defaultConfig.fetchSize;
    return fetchData(data, connection, this.logger, fetchSizeBytes, this.config.resultSetMaxRows);
  }

  /**
   * @inheritDoc
   */
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
  ): Promise<number>;
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | undefined,
  ): Promise<number>;
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'raw' | undefined,
  ): Promise<SQLResponse<SQLQueriesResponse>>;
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw',
  ): Promise<SQLResponse<SQLQueriesResponse> | number> {
    // [impl->dsn~runtime-command-execution~1]
    // [impl->dsn~runtime-raw-response-execution~1]
    const connection = await this.acquire();
    return connection
      .sendCommand<SQLQueriesResponse>(new SQLSingleCommand(sqlStatement, attributes), getCancel)
      .then((data) => {
        return this.fetchData(data, connection);
      })
      .then((data) => {
        if (connection) {
          this.pool.release(connection);
        }
        return data;
      })
      .then((data) => {
        if (responseType == 'raw') {
          return data;
        }

        this.verifyNoError(data);

        if (data.responseData.numResults === 0) {
          throw ErrMalformedData;
        }

        if (data.responseData.results[0].resultType === 'resultSet') {
          throw newInvalidReturnValueResultSet;
        }

        return data.responseData.results[0].rowCount ?? 0;
      })
      .catch((err) => {
        if (connection) {
          this.pool.release(connection);
        }
        throw err;
      });
  }

  private verifyNoError(data: SQLResponse<SQLQueriesResponse>) {
    if (data.status === 'error') {
      if (data.exception) {
        throw newSqlError(data.exception);
      } else {
        throw GeneralSqlError;
      }
    }
  }

  /**
   * @inheritDoc
   */
  public async executeBatch(
    sqlStatements: string[],
    attributes?: Partial<Attributes>,
    getCancel?: CetCancelFunction,
  ): Promise<SQLResponse<SQLQueriesResponse>> {
    const connection = await this.acquire();

    return connection
      .sendCommand<SQLQueriesResponse>(new SQLBatchCommand(sqlStatements, attributes), getCancel)
      .then((data) => {
        return this.fetchData(data, connection);
      })
      .then((data) => {
        if (connection) {
          this.pool.release(connection);
        }
        return data;
      })
      .catch((err) => {
        if (connection) {
          this.pool.release(connection);
        }
        throw err;
      });
  }

  /**
   * @inheritDoc
   */
  public async prepare(sqlStatement: string, getCancel?: CetCancelFunction): Promise<IStatement> {
    // [impl->dsn~runtime-prepared-statement-execution~1]
    const connection = await this.acquire();
    return connection
      .sendCommand<CreatePreparedStatementResponse>(
        {
          command: 'createPreparedStatement',
          sqlText: sqlStatement,
        },
        getCancel,
      )
      .then((response) => {
        return new Statement(connection, this.pool, response.responseData.statementHandle, response.responseData.parameterData.columns);
      });
  }

  /**
   * @inheritDoc
   */
  public async sendCommand<T>(cmd: Commands, getCancel?: CetCancelFunction): Promise<SQLResponse<T>> {
    const connection = await this.acquire();

    return connection
      .sendCommand<T>(cmd, getCancel)
      .then((data) => {
        if (connection) {
          this.pool.release(connection);
        }
        return data;
      })
      .catch((err) => {
        if (connection) {
          this.pool.release(connection);
        }
        throw err;
      });
  }

  private async acquire() {
    if (this.closed) {
      throw ErrClosed;
    }

    let connection = this.pool.acquire();
    if (!connection) {
      this.logger.debug("[SQLClient] Found no free connection and pool did not reach its limit, will create new connection");
      await this.connect();
      connection = this.pool.acquire();
    }
    if (!connection) {
      throw ErrInvalidConn;
    }
    return connection;
  }

  private async loginBasicAuth() {
    return this.sendCommand<PublicKeyResponse>({
      command: 'login',
      protocolVersion: this.config.apiVersion,
    }).then((response) => {

      if (response.status == 'error') {
        const errorString: string = this.buildConnectionError(response);
        throw new Error(errorString);
      }

      const n = new forge.jsbn.BigInteger(response.responseData.publicKeyModulus, 16);
      const e = new forge.jsbn.BigInteger(response.responseData.publicKeyExponent, 16);

      const pubKey = forge.pki.rsa.setPublicKey(n, e);
      const password = pubKey.encrypt(this.config.password ?? '');

      return this.sendCommand({
        username: this.config.user ?? '',
        password: forge.util.encode64(password),
        ...createLoginOptions(this.config),
      });
    });
  }

  private buildConnectionError(response: SQLResponse<PublicKeyResponse>) {
    let errorString: string = "Error sending 'login' command: ";
    if (response.exception?.text && response.exception.sqlCode) {
      errorString += response.exception.text + 'sqlCode: ' + response.exception.sqlCode;
    }
    this.logger.error(errorString);
    return errorString;
  }

  private async loginTokenAuth() {
    return this.sendCommand({
      command: 'loginToken',
      protocolVersion: this.config.apiVersion,
    }).then(() => {
      const command: OIDCSQLCommand = createLoginOptions(this.config);

      if (this.config.refreshToken) {
        command.refreshToken = this.config.refreshToken;
      } else {
        command.accessToken = this.config.accessToken;
      }

      return this.sendCommand(command);
    });
  }
}

/** Browser-compatible driver core without Node.js local file operations. */
export class ExasolDriver extends BaseExasolDriver {
  // [impl->dsn~runtime-browser-websocket~2]
  constructor(websocketFactory: WebsocketFactory, config: Partial<Config>, logger?: ILogger) {
    super(websocketFactory, config, logger);
  }
}
