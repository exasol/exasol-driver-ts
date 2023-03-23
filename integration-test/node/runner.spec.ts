import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { basicTests } from '../testcases/basic.spec';

basicTests('Node', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
