import { ExaWebsocket } from '../../src/lib/connection';
import { WebsocketFactory } from '../../src/lib/sql-client';

export function createWebsocketFactoryNoCert(): WebsocketFactory {
  //factory method that creates a websocket object
  const factoryWithCertificate = (url: string | URL) => {
    return new WebSocket(url) as ExaWebsocket;
  };
  return factoryWithCertificate;
}
