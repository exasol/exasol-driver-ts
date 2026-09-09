import { ExasolDriver, ExasolPool, type WebsocketFactory } from '@exasol/exasol-driver-ts';

const factory: WebsocketFactory = () => ({}) as never;

const driver = new ExasolDriver(factory, { accessToken: 'access-token' });
new ExasolPool(factory, { accessToken: 'access-token' });
void driver.importFromCsvFile('TABLE', '/tmp/file.csv');
void driver.importFromParquetFile('TABLE', '/tmp/file.parquet');
void driver.exportToCsvFile('TABLE', '/tmp/file.csv');
