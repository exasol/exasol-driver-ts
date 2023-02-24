/* eslint-disable jest/no-conditional-expect */
import { ExasolDriver } from './sql-client';

describe('sqlClient', () => {
  it('should fail with no credentials', async () => {
    expect.assertions(2);
    const driver = new ExasolDriver({});
    return driver.connect().catch((err: Error) => {
      expect(err.message).toEqual('E-EDJS-6: Invalid credentials.');
      expect(err.name).toEqual('ExaError');
    });
  });
});
