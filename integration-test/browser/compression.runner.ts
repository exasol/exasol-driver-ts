import { ExaWebsocket } from '../../src';
import { basicCompressionTests } from '../testcases/compression.basic.spec';
basicCompressionTests('Browser', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
