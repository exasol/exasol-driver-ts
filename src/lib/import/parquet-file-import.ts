import * as fs from 'fs';
import * as net from 'net';
import * as tls from 'tls';
import { PassThrough } from 'stream';
import { parquetRead } from 'hyparquet';
import type { FileMetaData } from 'hyparquet';
import { ParquetImportOptions, CsvFormatOptions } from './types';
import { createTunnel } from './http-transport';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';
import { buildCsvImportSql, buildCreateTableSql } from './import-sql-builder';
import { readHttpRequest, sendChunkedResponse } from './http-protocol';
import { verifyFileExists } from './csv-file-import';
import { inferParquetSchema, readParquetMetadata } from './parquet-schema';
import { serializeRowsToCsv } from './csv-serializer';
import { ExaErrorBuilder } from '../errors/error-reporting';

export async function importParquetFile(
  host: string,
  port: number,
  tableName: string,
  filePath: string,
  encryption: boolean,
  executeSql: (sql: string) => Promise<number>,
  options?: ParquetImportOptions,
): Promise<number> {
  await verifyFileExists(filePath);

  const { metadata, columnNames: allColumnNames } = await readParquetMetadata(filePath);
  const rowCount = Number(metadata.num_rows);

  if (rowCount === 0) {
    return 0;
  }

  const selectedColumns = resolveColumns(allColumnNames, options?.columns);

  if (options?.createTableIfNotExists) {
    await autoCreateTable(tableName, filePath, executeSql, options);
  }

  const { socket, internalAddress } = await createTunnel(host, port);

  let activeSocket: net.Socket | tls.TLSSocket = socket;
  let fingerprint: string | undefined;

  if (encryption) {
    const cert = generateAdHocCertificate();
    activeSocket = wrapWithTls(socket, cert.key, cert.cert);
    fingerprint = cert.fingerprint;
  }

  const csvOptions = options?.csvOptions;
  const importSql = buildCsvImportSql(tableName, internalAddress, encryption, fingerprint, csvOptions);

  try {
    const sqlPromise = executeSql(importSql);
    const tunnelPromise = streamParquetAsCsv(activeSocket, filePath, metadata, selectedColumns, csvOptions);

    const [sqlRowCount] = await Promise.all([sqlPromise, tunnelPromise]);
    return sqlRowCount;
  } finally {
    activeSocket.destroy();
  }
}

function resolveColumns(allColumnNames: string[], requestedColumns?: string[]): string[] {
  if (!requestedColumns || requestedColumns.length === 0) {
    return allColumnNames;
  }

  for (const col of requestedColumns) {
    if (!allColumnNames.includes(col)) {
      throw new ExaErrorBuilder('E-EDJS-20')
        .message('Column {{name}} not found in Parquet file.', col)
        .mitigation('Available columns: ' + allColumnNames.join(', '))
        .error();
    }
  }

  return requestedColumns;
}

async function autoCreateTable(
  tableName: string,
  filePath: string,
  executeSql: (sql: string) => Promise<number>,
  options?: ParquetImportOptions,
): Promise<void> {
  const schema = await inferParquetSchema(filePath);
  const columnNameMode = options?.columnNameMode ?? 'quoted';
  const createSql = buildCreateTableSql(tableName, schema.columns, columnNameMode);

  try {
    await executeSql(createSql);
  } catch (err) {
    // Ignore "table already exists" errors
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('already exists')) {
      throw new ExaErrorBuilder('E-EDJS-19')
        .message('Failed to create table {{name}} from Parquet schema.', tableName)
        .error();
    }
  }
}

async function streamParquetAsCsv(
  socket: net.Socket | tls.TLSSocket,
  filePath: string,
  metadata: FileMetaData,
  columnNames: string[],
  csvOptions?: CsvFormatOptions,
): Promise<void> {
  await readHttpRequest(socket);

  const csvStream = new PassThrough();
  const sendPromise = sendChunkedResponse(socket, csvStream);

  const fileBuffer = await fs.promises.readFile(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

  const asyncBuffer = {
    byteLength: arrayBuffer.byteLength,
    slice(start: number, end?: number) {
      return arrayBuffer.slice(start, end);
    },
  };

  await parquetRead({
    file: asyncBuffer,
    metadata,
    columns: columnNames,
    rowFormat: 'object',
    onComplete: (rows: Record<string, unknown>[]) => {
      if (rows.length > 0) {
        const csvData = serializeRowsToCsv(rows, columnNames, csvOptions);
        csvStream.write(csvData);
      }
    },
  });

  csvStream.end();
  await sendPromise;
}
