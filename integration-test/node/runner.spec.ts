import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { basicTests } from '../testcases/basic.spec';

function createWebsocketFactoryWithCertificate(certString?: string | undefined ) {
//define the function
const factoryWithCertificate =  (url: string | URL) => {
  return new WebSocket(url, {
    rejectUnauthorized: true,
    ca: certString,
    checkServerIdentity: () => {
      return false;
    }
  }) as ExaWebsocket; 
}
//pass it on
return factoryWithCertificate;
}

basicTests('Node',createWebsocketFactoryWithCertificate);

