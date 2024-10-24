/* eslint-disable jest/no-conditional-expect */
import { ExasolClient } from './sql-client';
import { WebSocket } from 'ws';
import { ExaWebsocket } from './connection';

describe('sqlClient', () => {
  it('should fail with no credentials', async () => {
    expect.assertions(2);
    const driver = new ExasolClient((url) => {
      return new WebSocket(url) as ExaWebsocket;
    }, {});
    return driver.connect().catch((err: Error) => {
      expect(err.message).toEqual('E-EDJS-6: Invalid credentials.');
      expect(err.name).toEqual('ExaError');
    });
  });
});
