import { websocketFactory } from '../../src/lib/sql-client';

export type CreateWebsocketFactoryFunctionType = (cert?: string | undefined) => websocketFactory;
