import { connectTest } from '../testcases/connect';

connectTest('Browser', (url) => {
  return new WebSocket(url);
});
