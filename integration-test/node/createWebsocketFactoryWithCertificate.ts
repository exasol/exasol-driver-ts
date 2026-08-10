import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { WebsocketFactory } from '../../src/lib/sql-client';

export function createWebsocketFactoryWithCertificate(certString?: string | undefined): WebsocketFactory {
  //factory method that creates a websocket object
  const factoryWithCertificate = (url: string | URL) => {
    return new WebSocket(url, {
      rejectUnauthorized: true,
      ca: certString,
      checkServerIdentity: () => {
        return false;
      }
    }) as ExaWebsocket;
  };

  return factoryWithCertificate;
}
