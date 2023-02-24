import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { connectTest } from '../testcases/connect';

connectTest('Node', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
