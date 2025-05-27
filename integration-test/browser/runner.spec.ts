import { ExaWebsocket } from '../../src/lib/connection';
import { basicTests } from '../testcases/basic.spec';

function createWebsocketFactoryWithCertificate() {
//define the function
const factoryWithCertificate =  (url: string | URL) => {
  return new WebSocket(url) as ExaWebsocket; 
};
//pass it on
return factoryWithCertificate;
}

basicTests('Browser',createWebsocketFactoryWithCertificate);
