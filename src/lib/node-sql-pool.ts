import { ILogger } from './logger/logger';
import { NodeExasolDriver } from './node-sql-client';
import { Config, WebsocketFactory } from './sql-client';
import { BaseExasolPool, ClientPoolConfig } from './sql-pool';

/**
 * Node.js Exasol connection pool. It uses `ws` unless the application supplies
 * a factory explicitly.
 */
export class NodeExasolPool extends BaseExasolPool<NodeExasolDriver> {
  constructor(websocketFactory: WebsocketFactory, config: Partial<Config> & Partial<ClientPoolConfig>, logger?: ILogger);
  constructor(
    websocketFactory: WebsocketFactory,
    config: Partial<Config> & Partial<ClientPoolConfig>,
    logger?: ILogger,
  ) {
    super(NodeExasolDriver, websocketFactory, config, logger);
  }
}
