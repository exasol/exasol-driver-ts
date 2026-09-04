import { ExasolDriver as NodeDriver, ExasolPool as NodePool } from '@exasol/exasol-driver-ts';
import { ExasolDriver as BrowserDriver, ExasolPool as BrowserPool, type WebsocketFactory } from '@exasol/exasol-driver-ts/browser';

const factory: WebsocketFactory = () => ({}) as never;

const browserDriver = new BrowserDriver(factory, { accessToken: 'access-token' });
new BrowserPool(factory, { accessToken: 'access-token' });
// @ts-expect-error The browser entry point excludes Node.js CSV import.
browserDriver.importFromCsvFile('TABLE', '/tmp/file.csv');
// @ts-expect-error The browser entry point excludes Node.js Parquet import.
browserDriver.importFromParquetFile('TABLE', '/tmp/file.parquet');
// @ts-expect-error The browser entry point excludes Node.js CSV export.
browserDriver.exportToCsvFile('TABLE', '/tmp/file.csv');

const nodeDriver = new NodeDriver(factory, { accessToken: 'access-token' });
new NodePool(factory, { accessToken: 'access-token' });
void nodeDriver.importFromCsvFile('TABLE', '/tmp/file.csv');
void nodeDriver.importFromParquetFile('TABLE', '/tmp/file.parquet');
void nodeDriver.exportToCsvFile('TABLE', '/tmp/file.csv');
