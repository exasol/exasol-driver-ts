import { ILogger } from './logger/logger';
import { createNodeWebsocketFactory, NodeExasolDriver } from './node-sql-client';
import { Config, WebsocketFactory } from './sql-client';
import { BaseExasolPool, ClientPoolConfig } from './sql-pool';

/**
 * Node.js Exasol connection pool. It uses `ws` unless the application supplies
 * a factory explicitly.
 */
export class NodeExasolPool extends BaseExasolPool<NodeExasolDriver> {
  constructor(websocketFactory: WebsocketFactory, config: Partial<Config> & Partial<ClientPoolConfig>, logger?: ILogger);
  constructor(config: Partial<Config> & Partial<ClientPoolConfig>, logger?: ILogger);
  constructor(
    websocketFactoryOrConfig: WebsocketFactory | (Partial<Config> & Partial<ClientPoolConfig>),
    configOrLogger?: (Partial<Config> & Partial<ClientPoolConfig>) | ILogger,
    logger?: ILogger,
  ) {
    super(NodeExasolDriver, createNodeWebsocketFactory(), websocketFactoryOrConfig, configOrLogger, logger);
  }
}
