import { ExaWebsocket } from '../../src/lib/connection';
import { connectTest } from '../testcases/connect';

connectTest('Browser', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
