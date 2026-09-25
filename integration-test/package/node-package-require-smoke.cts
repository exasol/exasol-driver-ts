import browser = require('@exasol/exasol-driver-ts/browser');
import node = require('@exasol/exasol-driver-ts');

const factory: node.WebsocketFactory = () => ({}) as never;

const nodeDriver = new node.ExasolDriver(factory, { accessToken: 'access-token' });
new node.ExasolPool(factory, { accessToken: 'access-token' });
void nodeDriver.importFromCsvFile('TABLE', '/tmp/file.csv');
void nodeDriver.importFromParquetFile('TABLE', '/tmp/file.parquet');
void nodeDriver.exportToCsvFile('TABLE', '/tmp/file.csv');

const browserDriver = new browser.ExasolDriver(factory, { accessToken: 'access-token' });
new browser.ExasolPool(factory, { accessToken: 'access-token' });
// @ts-expect-error The browser entry point excludes Node.js CSV import.
browserDriver.importFromCsvFile('TABLE', '/tmp/file.csv');
// @ts-expect-error The browser entry point excludes Node.js Parquet import.
browserDriver.importFromParquetFile('TABLE', '/tmp/file.parquet');
// @ts-expect-error The browser entry point excludes Node.js CSV export.
browserDriver.exportToCsvFile('TABLE', '/tmp/file.csv');
