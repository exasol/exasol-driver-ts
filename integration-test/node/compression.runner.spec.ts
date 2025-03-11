import { WebSocket } from 'ws';
import { ExaWebsocket } from '../../src/lib/connection';
import { basicCompressionTests } from '../testcases/compression.basic.spec';
basicCompressionTests('Node', (url) => {
  return new WebSocket(url) as ExaWebsocket;
});
