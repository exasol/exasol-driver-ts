import { createPool, Factory, Options, Pool } from 'generic-pool';
import { Attributes } from './commands';
import { ILogger, Logger, LogLevel } from './logger/logger';
import { QueryResult } from './query-result';
import { BaseExasolDriver, Config, ExasolDriver, WebsocketFactory } from './sql-client';
import { CetCancelFunction } from './sql-client.interface';
import { SQLQueriesResponse, SQLResponse } from './types';

// [impl->dsn~decision-use-generic-pool~1]
export interface ClientPoolConfig {
  minimumPoolSize: number;
  maximumPoolSize: number;
}
type DriverConstructor<Driver extends BaseExasolDriver> = new (
  websocketFactory: WebsocketFactory,
  config: Partial<Config>,
  logger?: ILogger,
) => Driver;

function getPool<Driver extends BaseExasolDriver>(
  DriverClass: DriverConstructor<Driver>,
  websocketFactory: WebsocketFactory,
  config: Partial<Config> & Partial<ClientPoolConfig>,
  logger: ILogger,
) {
  // [impl->dsn~runtime-pool-capacity-management~1]
  async function createClient() {
    const exasolClient = new DriverClass(websocketFactory, config, logger);
    await exasolClient.connect();
    return exasolClient;
  }

  async function destroyClient(exasolClient: Driver) {
    await exasolClient.close();
  }

  const poolFactory: Factory<Driver> = {
    create: function () {
      return createClient();
    },
    destroy: function (client: Driver) {
      return destroyClient(client);
    },
    validate: function (client: Driver) {
      // [impl->dsn~runtime-pool-borrow-validation~1]
      return Promise.resolve(!client.broken);
    },
  };
  const poolOpts: Options = {
    max: config.maximumPoolSize ?? 5, // maximum size of the pool
    min: config.minimumPoolSize ?? 0, // minimum size of the pool
    testOnBorrow: true,
  };
  const tempPool = createPool(poolFactory, poolOpts);
  // [impl->dsn~runtime-pool-create-failure~1]
  tempPool.on('factoryCreateError', (error) => rejectNextWaitingClient(tempPool, error, logger));
  return tempPool;
}

/** The part of generic-pool's internal state that holds pending `acquire()` calls. */
interface WaitingClientsQueue {
  _waitingClientsQueue?: { dequeue(): { reject(reason: unknown): void } | null | undefined };
}

/**
 * Rejects the oldest pending `acquire()` with the error of a failed driver creation. Without this, generic-pool
 * creates a new driver for the pending `acquire()` right away and retries forever, so `query()` never settles.
 * generic-pool has no public API for this, so this uses its internal queue of waiting clients.
 *
 * generic-pool does not tell which request a failed creation was meant for. When refilling `minimumPoolSize` fails,
 * this therefore rejects a waiting query with that error, even though a later creation might have served it.
 * @internal Exported for tests.
 */
export function rejectNextWaitingClient(pool: Pool<unknown>, error: unknown, logger: ILogger) {
  const queue = (pool as unknown as WaitingClientsQueue)._waitingClientsQueue;
  if (typeof queue?.dequeue !== 'function') {
    logger.warn('[ExasolPool] Cannot reject waiting queries after a failed connection: unsupported generic-pool version.', error);
    return;
  }
  queue.dequeue()?.reject(error);
}
/**
 * ExasolPool is a connection pool.
 * Use this class to manage a high volume of queries using a specified number of database connections.
 *
 * @class ExasolPool
 */
export class BaseExasolPool<Driver extends BaseExasolDriver> implements AsyncDisposable {
  private readonly internalPool: Pool<Driver>;
  private readonly logger: ILogger;
  /**
   * Creates an instance of ExasolPool.
   *
   * @param {WebsocketFactory} websocketFactory
   * @param {(Partial<Config> & Partial<ClientPoolConfig>)} config
   * @param {ILogger} [logger=new Logger(LogLevel.Debug)]
   */
  protected constructor(
    DriverClass: DriverConstructor<Driver>,
    websocketFactory: WebsocketFactory,
    config: Partial<Config> & Partial<ClientPoolConfig>,
    logger: ILogger = new Logger(LogLevel.Off),
  ) {
    this.logger = logger;
    this.internalPool = getPool(DriverClass, websocketFactory, config, logger);
  }
  /**
   * Query single SQL statement
   *
   * @param {string} sqlStatement
   * @param {(Partial<Attributes> | undefined)} [attributes]
   * @param {(CetCancelFunction | undefined)} [getCancel]
   * @return {*}  {Promise<QueryResult>}
   */
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
  ): Promise<QueryResult>;
  /**
   * Query single SQL statement
   *
   * @param {string} sqlStatement
   * @param {(Partial<Attributes> | undefined)} [attributes]
   * @param {(CetCancelFunction | undefined)} [getCancel]
   * @param {('default' | undefined)} [responseType]
   * @return {*}  {Promise<QueryResult>}
   */
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | undefined,
  ): Promise<QueryResult>;
  /**
   * Query single SQL statement
   *
   * @param {string} sqlStatement
   * @param {(Partial<Attributes> | undefined)} [attributes]
   * @param {(CetCancelFunction | undefined)} [getCancel]
   * @param {('raw' | undefined)} [responseType]
   * @return {*}  {Promise<SQLResponse<SQLQueriesResponse>>}
   */
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'raw' | undefined,
  ): Promise<SQLResponse<SQLQueriesResponse>>;
  /**
   * Query single SQL statement
   *
   * @param {string} sqlStatement
   * @param {(Partial<Attributes> | undefined)} [attributes]
   * @param {(CetCancelFunction | undefined)} [getCancel]
   * @param {('default' | 'raw')} [responseType]
   * @return {*}  {(Promise<QueryResult | SQLResponse<SQLQueriesResponse>>)}
   */
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw',
  ): Promise<QueryResult | SQLResponse<SQLQueriesResponse>> {
    // [impl->dsn~runtime-pooled-query-execution~1]
    let exasolClient;
    try {
      exasolClient = await this.internalPool.acquire();
      return await exasolClient.query(sqlStatement, attributes, getCancel, responseType);
    } catch (err) {
      this.logger.log('Query method error:' + err);
      throw err;
    } finally {
      if (exasolClient) {
        if (exasolClient.broken) {
          await this.internalPool.destroy(exasolClient);
        } else {
          await this.internalPool.release(exasolClient);
        }
      }
    }
  }
  /**
   * This sets the pool into a "draining" state.
   */
  public async drain() {
    // [impl->dsn~runtime-pool-shutdown~1]
    await this.internalPool.drain();
  }
  /**
   * Clears the connections in the pool.
   */
  public async clear() {
    // [impl->dsn~runtime-pool-shutdown~1]
    await this.internalPool.clear();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    // [impl->dsn~runtime-pool-async-disposal~1]
    try {
      await this.drain();
    } finally {
      await this.clear();
    }
  }
}

/** Browser-compatible connection pool without Node.js local file operations. */
export class ExasolPool extends BaseExasolPool<ExasolDriver> {
  // [impl->dsn~runtime-browser-websocket~2]
  constructor(
    websocketFactory: WebsocketFactory,
    config: Partial<Config> & Partial<ClientPoolConfig>,
    logger?: ILogger,
  ) {
    super(ExasolDriver, websocketFactory, config, logger);
  }
}
