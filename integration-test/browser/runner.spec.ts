import { ExaWebsocket } from '../../src/lib/connection';
import { basicTests } from '../testcases/basic.spec';

basicTests('Browser', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
