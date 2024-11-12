import { createPool, Factory, Pool } from 'generic-pool';
import { Config, ExasolDriver, websocketFactory } from './sql-client';
import { ILogger, LogLevel, Logger } from './logger/logger';
import { QueryResult } from './query-result';
import { Attributes } from './commands';
import { CetCancelFunction } from './sql-client.interface';
import { SQLQueriesResponse, SQLResponse } from './types';
//https://www.npmjs.com/package/generic-pool
//https://www.npmjs.com/package/@types/generic-pool
export interface PoolConfig {
  min: number;
  max: number;
}
function getPool(websocketFactory: websocketFactory, config: Partial<Config> & Partial<PoolConfig>, logger: ILogger) {
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
  const poolOpts: PoolConfig = {
    max: config.max ?? 5, // maximum size of the pool
    min: config.min ?? 0, // minimum size of the pool
  };
  const tempPool = createPool(poolFactory, poolOpts);
  return tempPool;
}
export class ExasolPool {
  private internalPool: Pool<ExasolDriver>;
  private logger: ILogger;
  constructor(
    websocketFactory: websocketFactory,
    config: Partial<Config> & Partial<PoolConfig>,
    logger: ILogger = new Logger(LogLevel.Debug),
  ) {
    this.logger = logger;
    this.internalPool = getPool(websocketFactory, config, logger);
  }

  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
  ): Promise<QueryResult>;
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'default' | undefined,
  ): Promise<QueryResult>;
  public async query(
    sqlStatement: string,
    attributes?: Partial<Attributes> | undefined,
    getCancel?: CetCancelFunction | undefined,
    responseType?: 'raw' | undefined,
  ): Promise<SQLResponse<SQLQueriesResponse>>;
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

        const response = await exasolClient.query(sqlStatement, attributes, getCancel, responseType);
        await this.internalPool.release(exasolClient);
        return response;
      } catch (err) {
        if (exasolClient) {
          await this.internalPool.release(exasolClient);
        }
        this.logger.log('Query method error:' + err);
        throw err;
      }
    }
  }
  public async drain() {
    await this.internalPool.drain();
  }
  public async clear() {
    await this.internalPool.clear();
  }
}
