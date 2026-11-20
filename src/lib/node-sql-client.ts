import { Connection, ConnectionAddress } from './connection';
import { ErrClosed, ErrInvalidConn } from './errors/errors';
import { exportCsvFile } from './import/csv-file-export';
import { importCsvFile } from './import/csv-file-import';
import { CsvExportFormatOptions, CsvExportOptions, CsvFormatOptions, CsvImportOptions, FileImportOptions, ParquetImportOptions } from './import/types';
import { importParquetFile } from './import/parquet-file-import';
import { ILogger } from './logger/logger';
import { BaseExasolDriver, Config, WebsocketFactory } from './sql-client';
import { IExasolDriver } from './sql-client.interface';
import { stripIpv6Brackets } from './utils';

/** Node.js driver with local CSV import and export support. */
export class NodeExasolDriver extends BaseExasolDriver implements IExasolDriver {
  // [impl->dsn~runtime-node-websocket~2]
  constructor(websocketFactory: WebsocketFactory, config: Partial<Config>, logger?: ILogger) {
    super(websocketFactory, config, logger);
  }

  /**
   * Returns the address for the import/export tunnel. Like pyexasol, this is the node the live connection's
   * WebSocket is connected to, so the tunnel goes to a reachable node. Connects first if there is no live connection.
   * With an explicit `url`, the configured `host` and `port` are used.
   */
  private async getTunnelAddress(): Promise<ConnectionAddress> {
    // [impl->dsn~runtime-dsn-tunnel-address~1]
    if (this.config.url) {
      return { host: stripIpv6Brackets(this.config.host), port: this.config.port };
    }
    let connection = this.findLiveConnection();
    if (!connection) {
      await this.connect();
      connection = this.findLiveConnection();
    }
    if (!connection?.address) {
      throw ErrInvalidConn;
    }
    return { host: stripIpv6Brackets(connection.address.host), port: connection.address.port };
  }

  private findLiveConnection(): Connection | undefined {
    return this.pool.getAll().find((connection) => !connection.broken);
  }

  public async importFromCsvFile(
    tableName: string,
    filePath: string,
    csvOptions?: CsvFormatOptions,
    options?: CsvImportOptions,
  ): Promise<number> {
    if (this.closed) {
      throw ErrClosed;
    }
    return importCsvFile({
      tunnelAddress: () => this.getTunnelAddress(),
      tableName,
      filePath,
      executeSql: (sql: string) => this.execute(sql),
      csvOptions,
      options,
      cancelSql: () => this.cancel(),
    });
  }

  public async importFromParquetFile(
    tableName: string,
    filePath: string,
    parquetOptions?: ParquetImportOptions,
    options?: FileImportOptions,
  ): Promise<number> {
    if (this.closed) {
      throw ErrClosed;
    }
    return importParquetFile({
      tunnelAddress: () => this.getTunnelAddress(),
      tableName,
      filePath,
      parquetOptions,
      executeSql: (sql: string) => this.execute(sql),
      options,
      cancelSql: () => this.cancel(),
    });
  }

  public async exportToCsvFile(
    source: string,
    filePath: string,
    csvOptions?: CsvExportFormatOptions,
    options?: CsvExportOptions,
  ): Promise<number> {
    if (this.closed) {
      throw ErrClosed;
    }
    return exportCsvFile({
      tunnelAddress: () => this.getTunnelAddress(),
      source,
      filePath,
      executeSql: (sql: string) => this.execute(sql),
      csvOptions,
      options: options || {},
      cancelSql: () => this.cancel(),
    });
  }
}
