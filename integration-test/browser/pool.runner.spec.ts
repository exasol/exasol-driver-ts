import { ExaWebsocket } from '../../src';
import { basicPoolTests } from '../testcases/pool.basic.spec';
basicPoolTests('Browser', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
