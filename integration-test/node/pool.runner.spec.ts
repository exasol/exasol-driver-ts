import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { basicPoolTests } from '../testcases/pool.basic.spec';
basicPoolTests('Browser', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
