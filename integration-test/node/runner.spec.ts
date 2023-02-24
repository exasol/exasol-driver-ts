import { WebSocket } from 'ws';
import { connectTest } from '../testcases/connect';

connectTest('Node', (url) => {
  return new WebSocket(url);
});
