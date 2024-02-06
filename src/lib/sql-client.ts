import * as forge from 'node-forge';


import { getURIScheme } from './utils';
import { CreatePreparedStatementResponse, PublicKeyResponse, SQLQueriesResponse, SQLResponse } from './types';
import { Statement } from './statement';
import { CetCancelFunction, IExasolDriver, IStatement } from './sql-client.interface';
import { ConnectionPool } from './pool/pool';
import { ILogger, Logger, LogLevel } from './logger/logger';
import { fetchData } from './fetch';
import {
  ErrClosed,
  ErrInvalidConn,
  ErrInvalidCredentials,
  ErrLoggerNil,
  ErrMalformedData,
  newInvalidReturnValueResultSet,
  newInvalidReturnValueRowCount,
} from './errors/errors';
import { Connection, ExaWebsocket } from './connection';
import { CommandsNoResult, Attributes, Commands, OIDCSQLCommand, SQLSingleCommand, SQLBatchCommand } from './commands';
import { QueryResult } from './query-result';

export interface Config {
  host: string;
  url?: string;
  port: number;
  user?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  autocommit: boolean;
  encryption: boolean;
  clientName: string;
  clientVersion: string;
  fetchSize: number;
  schema?: string;
  /** Limit max rows fetched */
  resultSetMaxRows?: number;
  onClose?: () => void;
  onError?: () => void;
}

interface InternalConfig {
  apiVersion: number;
  compression: boolean;
}

export const driverVersion = 'v1.0.0';

export type websocketFactory = (url: string) => ExaWebsocket;

export class ExasolDriver implements IExasolDriver {
  private readonly defaultConfig: Config & InternalConfig = {
    host: 'localhost',
    port: 8563,
    fetchSize: 128 * 1024,
    clientName: 'Javascript client',
    clientVersion: '1',
    autocommit: true,
    encryption: true,
    compression: false,
    apiVersion: 3,
  };
  private readonly config: Config & InternalConfig & { websocketFactory: websocketFactory };
  private readonly logger: ILogger;
  private closed = false;

  private readonly pool: ConnectionPool<Connection>;

  constructor(websocketFactory: websocketFactory, config: Partial<Config>, logger: ILogger = new Logger(LogLevel.Debug)) {
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
      return Promise.reject(ErrInvalidCredentials);
    }

    if (!this.logger) {
      return Promise.reject(ErrLoggerNil);
    }

    let url = `${getURIScheme(this.config.encryption)}://${this.config.host}:${this.config.port}`;
    if (this.config.url) {
      url = this.config.url;
    }

    const webSocket = this.config.websocketFactory(url);
    const connection = new Connection(webSocket, this.logger, Date.now() + '');
    return new Promise<void>((resolve, reject) => {
      webSocket.onerror = (err) => {
        this.logger.debug('SQLClient] OnError', err);
        if (this.config.onError) {
          this.config.onError();
        }
        this.close();
        reject(ErrInvalidConn);
      };
      webSocket.onclose = () => {
        this.logger.debug('[SQLClient] Got close event');
        if (this.config.onClose) {
          this.config.onClose();
        }
        connection.close();
        reject(ErrClosed);
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
            resolve();
            return;
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
    await this.sendCommandWithNoResult({
      command: 'abortQuery',
    });
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
    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index];
      await connection.close();
    }
    this.pool.clear();
  }

  /**
   * @inheritDoc
   */
  public async sendCommandWithNoResult(cmd: CommandsNoResult): Promise<void> {
    if (this.closed) {
      return Promise.reject(ErrClosed);
    }
    const connection = this.pool.acquire();
    if (connection) {
      return connection
        .sendCommandWithNoResult(cmd)
        .then(() => {
          this.pool.release(connection);
          return;
        })
        .catch((err) => {
          this.pool.release(connection);
          throw err;
        });
    }

    return Promise.reject(ErrClosed);
  }

  /**
   * @inheritDoc
   */
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined
  ): Promise<QueryResult>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | undefined
  ): Promise<QueryResult>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'raw' | undefined
  ): Promise<SQLResponse<SQLQueriesResponse>>;
  async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw'
  ): Promise<QueryResult | SQLResponse<SQLQueriesResponse>> {
    const connection = await this.acquire();
    return connection
      .sendCommand<SQLQueriesResponse>(new SQLSingleCommand(sqlStatement, attributes), getCancel)
      .then((data) => {
        return fetchData(data, connection, this.logger, this.config.resultSetMaxRows);
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

  /**
   * @inheritDoc
   */
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined
  ): Promise<number>;
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | undefined
  ): Promise<number>;
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'raw' | undefined
  ): Promise<SQLResponse<SQLQueriesResponse>>;
  async execute(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw'
  ): Promise<SQLResponse<SQLQueriesResponse> | number> {
    const connection = await this.acquire();
    return connection
      .sendCommand<SQLQueriesResponse>(new SQLSingleCommand(sqlStatement, attributes), getCancel)
      .then((data) => {
        return fetchData(data, connection, this.logger, this.config.resultSetMaxRows);
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

  /**
   * @inheritDoc
   */
  public async executeBatch(
    sqlStatements: string[],
    attributes?: Partial<Attributes>,
    getCancel?: CetCancelFunction
  ): Promise<SQLResponse<SQLQueriesResponse>> {
    const connection = await this.acquire();

    return connection
      .sendCommand<SQLQueriesResponse>(new SQLBatchCommand(sqlStatements, attributes), getCancel)
      .then((data) => {
        return fetchData(data, connection, this.logger, this.config.resultSetMaxRows);
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
    const connection = await this.acquire();
    return connection
      .sendCommand<CreatePreparedStatementResponse>(
        {
          command: 'createPreparedStatement',
          sqlText: sqlStatement,
        },
        getCancel
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
      return Promise.reject(ErrClosed);
    }

    let connection = this.pool.acquire();
    if (!connection) {
      this.logger.debug("[SQLClient] Found no free connection and pool did not reach it's limit, will create new connection");
      await this.connect();
      connection = this.pool.acquire();
    }
    if (!connection) {
      return Promise.reject(ErrInvalidConn);
    }
    return connection;
  }
  
  private async loginBasicAuth() {
    return this.sendCommand<PublicKeyResponse>({
      command: 'login',
      protocolVersion: this.config.apiVersion,
    }).then((response) => {

      const n = new forge.jsbn.BigInteger(response.responseData.publicKeyModulus, 16);
      const e = new forge.jsbn.BigInteger(response.responseData.publicKeyExponent, 16);

      const pubKey = forge.pki.rsa.setPublicKey(n, e);
      const password = pubKey.encrypt(this.config.password ?? '');

      return this.sendCommand({
        username: this.config.user ?? '',
        password: forge.util.encode64(password),
        useCompression: false,
        clientName: this.config.clientName,
        driverName: `exasol-driver-js ${driverVersion}`,
        clientOs: 'Browser',
        clientVersion: this.config.clientVersion,
        clientRuntime: 'Browser',
        attributes: {
          autocommit: this.config.autocommit,
          currentSchema: this.config.schema,
          compressionEnabled: this.config.compression,
        },
      });
    });
  }

  private async loginTokenAuth() {
    return this.sendCommand({
      command: 'loginToken',
      protocolVersion: this.config.apiVersion,
    }).then(() => {
      const command: OIDCSQLCommand = {
        useCompression: false,
        clientName: this.config.clientName,
        driverName: `exasol-driver-js ${driverVersion}`,
        clientOs: 'Browser',
        clientVersion: this.config.clientVersion,
        clientRuntime: 'Browser',
        attributes: {
          autocommit: this.config.autocommit,
          currentSchema: this.config.schema,
          compressionEnabled: this.config.compression,
        },
      };

      if (this.config.refreshToken) {
        command.refreshToken = this.config.refreshToken;
      } else {
        command.accessToken = this.config.accessToken;
      }

      return this.sendCommand(command);
    });
  }
}
