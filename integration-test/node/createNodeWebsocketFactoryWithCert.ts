import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';

export function createNodeWebsocketFactoryWithCert(certString: string | undefined) {

  // const wsFactory = (url) => {
    
  //   return new WebSocket(url, {
  //     rejectUnauthorized: true,
  //     ca: certString,
  //     checkServerIdentity: () => {
  //       return false;
  //     }
  //   }) as ExaWebsocket;
  // }
  // return wsFactory;
  return (url : string | URL) => {
    
    return new WebSocket(url, {
      rejectUnauthorized: true,
      ca: certString,
      checkServerIdentity: () => {
        return false;
      }
    }) as ExaWebsocket;
  }
  //return wsFactory;
//}
}
