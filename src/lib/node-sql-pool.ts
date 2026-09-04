import { ILogger } from './logger/logger';
import { NodeExasolDriver } from './node-sql-client';
import { Config, WebsocketFactory } from './sql-client';
import { BaseExasolPool, ClientPoolConfig } from './sql-pool';

/** Node.js connection pool with CSV-capable drivers. */
export class NodeExasolPool extends BaseExasolPool<NodeExasolDriver> {
  constructor(
    websocketFactory: WebsocketFactory,
    config: Partial<Config> & Partial<ClientPoolConfig>,
    logger?: ILogger,
  ) {
    super(NodeExasolDriver, websocketFactory, config, logger);
  }
}
