import { WebSocket } from 'ws';

import { ExaWebsocket } from './connection';
import { ErrClosed } from './errors/errors';
import { exportCsvFile } from './import/csv-file-export';
import { importCsvFile } from './import/csv-file-import';
import { CsvExportFormatOptions, CsvExportOptions, CsvFormatOptions, CsvImportOptions } from './import/types';
import { ILogger } from './logger/logger';
import { BaseExasolDriver, Config, WebsocketFactory } from './sql-client';
import { IExasolDriver } from './sql-client.interface';

export function createNodeWebsocketFactory(): WebsocketFactory {
  return (url: string) => new WebSocket(url) as ExaWebsocket;
}

/**
 * Node.js Exasol driver with local CSV import and export support.
 */
export class NodeExasolDriver extends BaseExasolDriver implements IExasolDriver {
  // [impl->dsn~runtime-node-websocket~2]
  constructor(websocketFactory: WebsocketFactory, config: Partial<Config>, logger?: ILogger);
  constructor(
    websocketFactory: WebsocketFactory,
    config: Partial<Config>,
    logger?: ILogger,
  ) {
    super(websocketFactory, config, logger);
  }

  public async importFromCsvFile(tableName: string, filePath: string, csvOptions?: CsvFormatOptions, options?: CsvImportOptions): Promise<number> {
    if (this.closed) {
      throw ErrClosed;
    }
    return importCsvFile({
      host: this.config.host,
      port: this.config.port,
      tableName,
      filePath,
      executeSql: (sql: string) => this.execute(sql),
      csvOptions,
      options,
      cancelSql: () => this.cancel(),
    });
  }

  public async exportToCsvFile(source: string, filePath: string, csvOptions?: CsvExportFormatOptions, options?: CsvExportOptions): Promise<number> {
    if (this.closed) {
      throw ErrClosed;
    }
    return exportCsvFile({
      host: this.config.host,
      port: this.config.port,
      source,
      filePath,
      executeSql: (sql: string) => this.execute(sql),
      csvOptions,
      options: options || {},
      cancelSql: () => this.cancel(),
    });
  }
}
