import * as forge from 'node-forge';

import { getURIScheme } from './utils';
import { CreatePreparedStatementResponse, PublicKeyResponse, SQLQueriesResponse, SQLResponse } from './types';
import { Statement } from './statement';
import { CetCancelFunction, IExasolDriver as IExasolClient, IStatement } from './sql-client.interface';
//import { ConnectionPool } from './pool/pool';
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
  poolMaxConnections: number;
}

export const driverVersion = 'v1.0.0';

export type websocketFactory = (url: string) => ExaWebsocket;

export class ExasolClient implements IExasolClient {
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
    poolMaxConnections: 1,
  };
  private clientConnection?: Connection;
  private readonly config: Config & InternalConfig & { websocketFactory: websocketFactory };
  private readonly logger: ILogger;
  private closed = false;

  constructor(
    websocketFactory: websocketFactory,
    config: Partial<Config> & Partial<InternalConfig>,
    logger: ILogger = new Logger(LogLevel.Debug),
  ) {
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
    await this.createConnection();
  }
  private async createConnection(): Promise<void> {
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

      webSocket.onopen = async () => {
        this.logger.debug('[SQLClient] Login');
        let authResult;
        if (isBasicAuth) {
          authResult = await this.loginBasicAuth();
        } else {
          authResult = await this.loginTokenAuth();
        }
        if (authResult.status !== 'ok') {
          reject(authResult.exception);
          return;
        }
        this.logger.debug('[SQLClient] Authentication Succesful.');
        this.clientConnection = connection;
        resolve();
        return;
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
    await this.clientConnection?.close();
  }

  /**
   * @inheritDoc
   */
  public async sendCommandWithNoResult(cmd: CommandsNoResult): Promise<void> {
    if (this.closed) {
      return Promise.reject(ErrClosed);
    }
    const connection = await this.acquire();
    if (connection) {
      return connection
        .sendCommandWithNoResult(cmd)
        .then(() => {
          this.release(connection);
          return;
        })
        .catch((err) => {
          this.release(connection);
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
  ): Promise<QueryResult | SQLResponse<SQLQueriesResponse>> {
    const connection = await this.acquire();
    if (connection) {
      return connection
        .sendCommand<SQLQueriesResponse>(new SQLSingleCommand(sqlStatement, attributes), getCancel)
        .then((data) => {
          return fetchData(data, connection, this.logger, this.config.resultSetMaxRows);
        })
        .then((data) => {
          if (connection) {
            this.release(connection);
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
            this.release(connection);
          }
          throw err;
        });
    } else {
      throw Error('Connection undefined');
    }
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
    const connection = await this.acquire();
    if (connection) {
      return connection
        .sendCommand<SQLQueriesResponse>(new SQLSingleCommand(sqlStatement, attributes), getCancel)
        .then((data) => {
          return fetchData(data, connection, this.logger, this.config.resultSetMaxRows);
        })
        .then((data) => {
          if (connection) {
            this.release(connection);
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
            this.release(connection);
          }
          throw err;
        });
    } else {
      throw Error('Connection undefined');
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
    if (connection) {
      return connection
        .sendCommand<SQLQueriesResponse>(new SQLBatchCommand(sqlStatements, attributes), getCancel)
        .then((data) => {
          return fetchData(data, connection, this.logger, this.config.resultSetMaxRows);
        })
        .then((data) => {
          if (connection) {
            this.release(connection);
          }
          return data;
        })
        .catch((err) => {
          if (connection) {
            this.release(connection);
          }
          throw err;
        });
    } else {
      throw Error('Connection undefined');
    }
  }

  /**
   * @inheritDoc
   */
  public async prepare(sqlStatement: string, getCancel?: CetCancelFunction): Promise<IStatement> {
    const connection = await this.acquire();
    if (connection) {
      return connection
        .sendCommand<CreatePreparedStatementResponse>(
          {
            command: 'createPreparedStatement',
            sqlText: sqlStatement,
          },
          getCancel,
        )
        .then((response) => {
          return new Statement(connection, response.responseData.statementHandle, response.responseData.parameterData.columns);
        });
    } else {
      throw Error('Connection undefined');
    }
  }

  /**
   * @inheritDoc
   */
  public async sendCommand<T>(cmd: Commands, getCancel?: CetCancelFunction): Promise<SQLResponse<T>> {
    const connection = await this.acquire();
    if (connection) {
      return connection
        .sendCommand<T>(cmd, getCancel)
        .then((data) => {
          if (connection) {
            this.release(connection);
          }
          return data;
        })
        .catch((err) => {
          if (connection) {
            this.release(connection);
          }
          throw err;
        });
    } else {
      throw Error('Connection undefined');
    }
  }
  // Attempts to acquire a connection from the pool.
  // If there is one available, acquire the connection.
  // If there isn't one:
  // If the pool is at max size: wait until a connection gets released and then acquire it.
  // If the pool is not at max size: Create a new connection using the connect() method and acquire the new connection from the pool.

  private async acquire() {
    if (!this.clientConnection) Promise.reject('Failed to acquire connection. Uninitialized.');

    while (this.clientConnection?.active && !this.clientConnection.broken) {
      this.logger.debug('Waiting to acquire active clientconnection.');
    }

    if (!this.clientConnection?.broken) Promise.reject('Broken connection.');

    if (this.clientConnection) {
      this.clientConnection.active = true;
    }
    return this.clientConnection;
  }

  private async release(connection: Connection) {
    //TODO: clientConnection release, remove param and do the necessary
    connection.active = false;
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
