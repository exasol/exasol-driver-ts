import { createPool, Factory, Options, Pool } from 'generic-pool';
import { Config, ExasolDriver, websocketFactory } from './sql-client';
import { ILogger, LogLevel, Logger } from './logger/logger';
import { QueryResult } from './query-result';
import { Attributes } from './commands';
import { CetCancelFunction } from './sql-client.interface';
import { SQLQueriesResponse, SQLResponse } from './types';
export interface ClientPoolConfig {
  minimumPoolSize: number;
  maximumPoolSize: number;
}
function getPool(websocketFactory: websocketFactory, config: Partial<Config> & Partial<ClientPoolConfig>, logger: ILogger) {
  async function createClient() {
    const exasolClient: ExasolDriver = new ExasolDriver(websocketFactory, config, logger);
    await exasolClient.connect();
    return Promise.resolve(exasolClient);
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
  };
  const poolOpts: Options = {
    max: config.maximumPoolSize ?? 5, // maximum size of the pool
    min: config.minimumPoolSize ?? 0, // minimum size of the pool
  };
  const tempPool = createPool(poolFactory, poolOpts);
  return tempPool;
}
/**
 * ExasolPool is a connection pool.
 * Use this class to manage a high volume of queries using a specified number of database connections.
 *
 * @export
 * @class ExasolPool
 */
export class ExasolPool {
  private internalPool: Pool<ExasolDriver>;
  private logger: ILogger;
  /**
   * Creates an instance of ExasolPool.
   *
   * @param {websocketFactory} websocketFactory
   * @param {(Partial<Config> & Partial<ClientPoolConfig>)} config
   * @param {ILogger} [logger=new Logger(LogLevel.Debug)]
   * @memberof ExasolPool
   */
  constructor(
    websocketFactory: websocketFactory,
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
   * @memberof ExasolPool
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
   * @memberof ExasolPool
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
   * @memberof ExasolPool
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
   * @memberof ExasolPool
   */
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | 'raw',
  ): Promise<QueryResult | SQLResponse<SQLQueriesResponse>> {
    {
      let exasolClient;
      try {
        exasolClient = await this.internalPool.acquire();
        return await exasolClient.query(sqlStatement, attributes, getCancel, responseType);
      } catch (err) {
        this.logger.log('Query method error:' + err);
        throw err;
      } finally {
        if (exasolClient) {
          await this.internalPool.release(exasolClient);
        }
      }
    }
  }
  /**
   * This sets the pool into a "draining" state.
   *
   * @memberof ExasolPool
   */
  public async drain() {
    await this.internalPool.drain();
  }
  /**
   * Clears the connections in the pool.
   *
   * @memberof ExasolPool
   */
  public async clear() {
    await this.internalPool.clear();
  }
}
