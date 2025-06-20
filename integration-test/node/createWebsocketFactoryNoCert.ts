import { ExaWebsocket } from '../../src/lib/connection';

export function createWebsocketFactoryNoCert() {
  //factory method that creates a websocket object
  const factoryWithCertificate = (url: string | URL) => {
    return new WebSocket(url) as ExaWebsocket;
  };
  
  return factoryWithCertificate;
}
