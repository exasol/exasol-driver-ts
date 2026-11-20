import forge from 'node-forge';

import { Attributes, Commands, CommandsNoResult, OIDCSQLCommand, SQLBatchCommand, SQLSingleCommand } from './commands';
import { Connection, ConnectionAddress, ExaWebsocket } from './connection';
import {
  ErrClosed,
  ErrInvalidConn,
  ErrInvalidCredentials,
  ErrLoggerNil,
  ErrMalformedData,
  GeneralSqlError,
  newConnectionFailedError,
  newConnectTimeoutError,
  newDsnFingerprintNotSupportedError,
  newLoginTimeoutError,
  newInvalidReturnValueResultSet,
  newInvalidReturnValueRowCount,
  newSocketClosedError,
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
import { DsnHost, parseDsn, shuffle } from './utils';

export interface Config {
  /**
   * Host name, IP address or Exasol connection string (DSN) in the format `host[..range][:port][,host...]`,
   * e.g. `exasol1..3:8563` or `10.0.0.10..12,10.0.0.20`. The driver connects to one of the hosts in random order
   * and tries the next host if opening the WebSocket fails.
   */
  host: string;
  /** Exasol port, e.g. 8563. A port in the connection string in `host` takes precedence. */
  port: number;
  /** Websocket URL. Default: `wss://<host>:<port>`. This allows overriding the default URL if necessary. When set, `host` is not parsed as a connection string. */
  url?: string;
  /**
   * Timeout in milliseconds, applied separately to opening the WebSocket to each host and to the login.
   * When opening a WebSocket times out, the driver tries the next host; when the login times out, `connect()` rejects.
   * `0`, negative values and values above 2147483647 (the maximum timer delay) disable the timeout. Default: 20000
   */
  connectTimeout?: number;
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
  /** Called when an open WebSocket closes. */
  onClose?: () => void;
  /**
   * Called on WebSocket errors: when an open WebSocket reports an error, or once per `connect()` when no WebSocket
   * could be opened to any host. Not called for configuration errors such as an invalid connection string, which
   * reject `connect()` before any WebSocket is created.
   */
  onError?: () => void;
  compression: boolean;
}

interface InternalConfig {
  apiVersion: number;
}

export { driverVersion } from './login-options';

const DEFAULT_CONNECT_TIMEOUT_MS = 20_000;

interface OpenedWebSocket {
  webSocket: ExaWebsocket;
  /** Node the WebSocket is connected to; undefined when opened from an explicit `url`. */
  address?: ConnectionAddress;
}
/** Maximum delay supported by `setTimeout`; larger values fire immediately. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const isTimeoutEnabled = (timeoutMs: number): boolean => Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_TIMER_DELAY_MS;

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
    connectTimeout: DEFAULT_CONNECT_TIMEOUT_MS,
    apiVersion: 3,
  };
  /** @internal Runtime configuration, including connection implementation details. */
  protected readonly config: Config & InternalConfig & { websocketFactory: WebsocketFactory };
  private readonly logger: ILogger;
  protected closed = false;
  /** Aborts WebSockets that are still opening, so that `close()` stops pending connection attempts. */
  private readonly pendingOpenAborts = new Set<() => void>();

  protected readonly pool: ConnectionPool<Connection>;

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
    if (this.closed) {
      throw ErrClosed;
    }
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

    const { webSocket, address } = await this.openFirstAvailableWebSocket();
    if (this.closed) {
      // [impl->dsn~runtime-dsn-failover~1]
      // close() was called while hosts were tried: do not log in on a driver that is already closed.
      this.logger.debug('[SQLClient] Driver was closed while connecting, closing opened WebSocket');
      webSocket.close();
      throw ErrClosed;
    }
    return new Promise<void>((resolveConnect, rejectConnect) => {
      // [impl->dsn~runtime-dsn-connect-timeout~1]
      // The login has its own timeout. When it runs out, the connection is broken (not closed gracefully, as the
      // disconnect command would wait behind the pending login) and no other host is tried.
      const timeoutMs = this.getConnectTimeout();
      const loginTimer = isTimeoutEnabled(timeoutMs)
        ? setTimeout(() => {
            const error = newLoginTimeoutError(timeoutMs);
            this.logger.debug('[SQLClient] Login timed out', error);
            this.pool.remove(connection);
            connection.breakConnection(error);
            rejectConnect(error);
          }, timeoutMs)
        : undefined;
      const resolve = () => {
        clearTimeout(loginTimer);
        resolveConnect();
      };
      const reject = (error: unknown) => {
        clearTimeout(loginTimer);
        rejectConnect(error);
      };
      const connection = new Connection(webSocket, this.logger, Date.now() + '', (): void => {
        this.logger.debug('[SQLClient] Got close event');
        if (this.config.onClose) {
          this.config.onClose();
        }
        void connection.close();
        reject(ErrClosed);
      }, address);
      webSocket.onerror = (err) => {
        this.logger.debug('[SQLClient] OnError', err);
        this.notifyError();
        const error = newSocketError(err);
        connection.breakConnection(error);
        void this.close();
        reject(error);
      };
      // Login and authentication errors are not retried on another host.
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
            this.discardConnection(connection);
            reject(data.exception);
            return;
          }
          //at this point the user should be logged in, asked for the Public Key and sent credentials and info in login...Auth() methods
          connection.setCompression(this.config.compression);
          resolve();
        })
        .catch((err) => {
          this.discardConnection(connection);
          reject(err);
        });
    });
  }

  /** Calls the `onError` callback. An exception from the callback is logged and does not replace the driver's error. */
  private notifyError() {
    try {
      this.config.onError?.();
    } catch (callbackError) {
      this.logger.warn('[SQLClient] onError callback failed', callbackError);
    }
  }

  private getConnectTimeout(): number {
    return this.config.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT_MS;
  }

  /** Removes a connection that failed to log in from the pool and closes its WebSocket. */
  private discardConnection(connection: Connection) {
    // [impl->dsn~runtime-discard-failed-login-connection~1]
    this.pool.remove(connection);
    void connection.close();
  }

  /**
   * Opens a WebSocket to the configured `url` or to one of the hosts of the connection string in `host`.
   * Hosts are tried once each in random order until a WebSocket opens.
   */
  private async openFirstAvailableWebSocket(): Promise<OpenedWebSocket> {
    // [impl->dsn~runtime-dsn-failover~1]
    // [impl->req~do-not-allow-disabling-encryption~1]
    if (this.config.url) {
      return this.openWebSocketOrFail([{ url: this.config.url }]);
    }
    const hosts = parseDsn(this.config.host, this.config.port);
    // [impl->dsn~runtime-dsn-reject-fingerprint~1]
    const hostWithFingerprint = hosts.find((host) => host.fingerprint !== undefined);
    if (hostWithFingerprint) {
      throw newDsnFingerprintNotSupportedError(hostWithFingerprint.host);
    }
    return this.openWebSocketOrFail(
      shuffle(hosts).map((address) => ({ url: `wss://${address.host}:${address.port}`, address })),
    );
  }

  private async openWebSocketOrFail(targets: Array<{ url: string; address?: DsnHost }>): Promise<OpenedWebSocket> {
    const failures: Array<{ url: string; cause: unknown }> = [];
    for (const { url, address } of targets) {
      if (this.closed) {
        throw ErrClosed;
      }
      try {
        const webSocket = await this.openWebSocket(url);
        return { webSocket, address: address ? { host: address.host, port: address.port } : undefined };
      } catch (cause) {
        if (this.closed) {
          throw ErrClosed;
        }
        this.logger.debug(`[SQLClient] Failed to open WebSocket ${url}`, cause);
        failures.push({ url, cause });
      }
    }
    this.notifyError();
    throw newConnectionFailedError(failures);
  }

  private openWebSocket(url: string): Promise<ExaWebsocket> {
    // [impl->dsn~runtime-dsn-connect-timeout~1]
    const timeoutMs = this.getConnectTimeout();
    return new Promise<ExaWebsocket>((resolve, reject) => {
      let webSocket: ExaWebsocket;
      try {
        webSocket = this.config.websocketFactory(url);
      } catch (error) {
        reject(error instanceof Error ? error : newSocketError(error));
        return;
      }
      let settled = false;
      const ignoreEvent = () => undefined;
      const settle = () => {
        settled = true;
        this.pendingOpenAborts.delete(abort);
        clearTimeout(timer);
        webSocket.onopen = null;
        // Keep no-op handlers: some implementations (e.g. `ws`) emit late error events after close().
        webSocket.onerror = ignoreEvent;
        webSocket.onclose = ignoreEvent;
      };
      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settle();
        try {
          webSocket.close();
        } catch (closeError) {
          this.logger.debug(`[SQLClient] Closing WebSocket ${url} failed`, closeError);
        }
        reject(error);
      };
      const timer = isTimeoutEnabled(timeoutMs) ? setTimeout(() => fail(newConnectTimeoutError(url, timeoutMs)), timeoutMs) : undefined;
      const abort = () => fail(ErrClosed);
      this.pendingOpenAborts.add(abort);
      webSocket.onopen = () => {
        if (settled) {
          return;
        }
        settle();
        resolve(webSocket);
      };
      webSocket.onerror = (event) => fail(newSocketError(event));
      webSocket.onclose = (event) => fail(newSocketClosedError(event));
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
    // [impl->dsn~runtime-dsn-failover~1]
    for (const abort of this.pendingOpenAborts) {
      abort();
    }

    const connections = this.pool.getAll();
    await Promise.all(connections.map((connection) => connection.close()));
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
