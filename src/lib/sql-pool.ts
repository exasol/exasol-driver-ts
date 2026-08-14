import { createPool, Factory, Options, Pool } from 'generic-pool';
import { Attributes } from './commands';
import { ILogger, Logger, LogLevel } from './logger/logger';
import { QueryResult } from './query-result';
import { Config, ExasolDriver, WebsocketFactory } from './sql-client';
import { CetCancelFunction } from './sql-client.interface';
import { SQLQueriesResponse, SQLResponse } from './types';

// [impl->dsn~decision-use-generic-pool~1]
export interface ClientPoolConfig {
  minimumPoolSize: number;
  maximumPoolSize: number;
}
function getPool(websocketFactory: WebsocketFactory, config: Partial<Config> & Partial<ClientPoolConfig>, logger: ILogger) {
  // [impl->dsn~runtime-pool-capacity-management~1]
  async function createClient() {
    const exasolClient: ExasolDriver = new ExasolDriver(websocketFactory, config, logger);
    await exasolClient.connect();
    return exasolClient;
  }

  async function destroyClient(exasolClient: ExasolDriver) {
    await exasolClient.close();
  }

  const poolFactory: Factory<ExasolDriver> = {
    create: function () {
      return createClient();
    },
    destroy: function (client: ExasolDriver) {
      return destroyClient(client);
    },
    validate: function (client: ExasolDriver) {
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
  return tempPool;
}
/**
 * ExasolPool is a connection pool.
 * Use this class to manage a high volume of queries using a specified number of database connections.
 *
 * @class ExasolPool
 */
export class ExasolPool implements AsyncDisposable {
  private readonly internalPool: Pool<ExasolDriver>;
  private readonly logger: ILogger;
  /**
   * Creates an instance of ExasolPool.
   *
   * @param {WebsocketFactory} websocketFactory
   * @param {(Partial<Config> & Partial<ClientPoolConfig>)} config
   * @param {ILogger} [logger=new Logger(LogLevel.Debug)]
   */
  constructor(
    websocketFactory: WebsocketFactory,
    config: Partial<Config> & Partial<ClientPoolConfig>,
    logger: ILogger = new Logger(LogLevel.Off),
  ) {
    this.logger = logger;
    this.internalPool = getPool(websocketFactory, config, logger);
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
   *
   */
  public async drain() {
    // [impl->dsn~runtime-pool-shutdown~1]
    await this.internalPool.drain();
  }
  /**
   * Clears the connections in the pool.
   *
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
