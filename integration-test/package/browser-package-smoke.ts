import { ExasolDriver as BrowserDriver, ExasolPool as BrowserPool, type WebsocketFactory } from '@exasol/exasol-driver-ts/browser';
import { ExasolDriver as NodeDriver, ExasolPool as NodePool } from '@exasol/exasol-driver-ts';

const factory: WebsocketFactory = () => ({}) as never;

const browserDriver = new BrowserDriver(factory, { accessToken: 'access-token' });
new BrowserPool(factory, { accessToken: 'access-token' });
// @ts-expect-error The browser entry point excludes Node.js CSV import.
browserDriver.importFromCsvFile('TABLE', '/tmp/file.csv');

const nodeDriver = new NodeDriver(factory, { accessToken: 'access-token' });
new NodePool(factory, { accessToken: 'access-token' });
void nodeDriver.importFromCsvFile('TABLE', '/tmp/file.csv');
