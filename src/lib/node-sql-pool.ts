import { ILogger } from './logger/logger';
import { NodeExasolDriver } from './node-sql-client';
import { Config, WebsocketFactory } from './sql-client';
import { BaseExasolPool, ClientPoolConfig } from './exasol-pool';

/** Node.js connection pool that creates CSV-capable {@link NodeExasolDriver} instances. */
export class NodeExasolPool extends BaseExasolPool<NodeExasolDriver> {
  constructor(
    websocketFactory: WebsocketFactory,
    config: Partial<Config> & Partial<ClientPoolConfig>,
    logger?: ILogger,
  ) {
    super(NodeExasolDriver, websocketFactory, config, logger);
  }
}
