import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';

export function createWebsocketFactoryWithCertificate(certString?: string | undefined) {

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
