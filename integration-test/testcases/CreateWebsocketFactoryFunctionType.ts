import { WebsocketFactory } from '../../src/lib/sql-client';

export type CreateWebsocketFactoryFunctionType = (cert?: string | undefined) => WebsocketFactory;
