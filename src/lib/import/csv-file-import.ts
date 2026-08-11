import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import * as tls from 'node:tls';
import { ExaErrorBuilder } from '../errors/error-reporting';
import { readHttpRequest, sendChunkedResponse } from './http-protocol';
import { createTunnel } from './http-transport';
import { buildCsvImportSql } from './import-sql-builder';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';
import { CsvFormatOptions, CsvImportOptions } from './types';

interface ImportCsvFileParameters {
  host: string;
  port: number;
  tableName: string;
  filePath: string;
  executeSql: (sql: string) => Promise<number>;
  csvOptions?: CsvFormatOptions;
  options?: CsvImportOptions;
  cancelSql?: () => Promise<void>;
}

// [impl->dsn~decision-stream-csv-through-import-tunnel~1]
export async function importCsvFile({
  host,
  port,
  tableName,
  filePath,
  executeSql,
  csvOptions,
  options,
  cancelSql,
}: ImportCsvFileParameters): Promise<number> {
  // [impl->dsn~runtime-csv-import-file-readability-check~1]
  // [impl->dsn~runtime-csv-import-missing-target-table~1]
  // [impl->dsn~runtime-csv-import-file-stream~1]
  // [impl->dsn~runtime-csv-import-cancellation~1]
  const absoluteFilePath = path.resolve(filePath);
  await verifyFileExists(absoluteFilePath);

  throwIfAborted(options?.signal);

  let unencryptedSocket: net.Socket | undefined;
  let secureSocket: tls.TLSSocket | undefined;
  let fileStream: fs.ReadStream | undefined;
  let queryStarted = false;
  let abortImport: (() => void) | undefined;

  const abortPromise = new Promise<never>((_, reject) => {
    abortImport = () => {
      fileStream?.destroy();
      secureSocket?.destroy();
      unencryptedSocket?.destroy();
      if (queryStarted) {
        void cancelSql?.().catch(() => undefined);
      }
      reject(newImportAbortedError());
    };
  });

  if (options?.signal && abortImport) {
    options.signal.addEventListener('abort', abortImport, { once: true });
  }

  try {
    const tunnel = await Promise.race([createTunnel(host, port, options?.signal), abortPromise]);
    unencryptedSocket = tunnel.socket;
    throwIfAborted(options?.signal);

    const cert = generateAdHocCertificate();
    secureSocket = wrapWithTls(unencryptedSocket, cert.key, cert.cert);
    const importSql = buildCsvImportSql(tableName, tunnel.internalAddress, cert.fingerprint, csvOptions);

    queryStarted = true;
    const sqlPromise = executeSql(importSql);
    const tunnelPromise = (async () => {
      await readHttpRequest(secureSocket);
      fileStream = fs.createReadStream(absoluteFilePath);
      await sendChunkedResponse(secureSocket, fileStream);
    })();

    const [rowCount] = await Promise.race([Promise.all([sqlPromise, tunnelPromise]), abortPromise]);
    return rowCount;
  } finally {
    if (options?.signal && abortImport) {
      options.signal.removeEventListener('abort', abortImport);
    }
    fileStream?.destroy();
    secureSocket?.destroy();
    unencryptedSocket?.destroy();
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw newImportAbortedError();
  }
}

function newImportAbortedError() {
  const message = new ExaErrorBuilder('E-EDJS-20')
    .message('The CSV import was aborted.').toString();
  return new DOMException(message, 'AbortError');
}

export async function verifyFileExists(filePath: string): Promise<void> {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    throw new ExaErrorBuilder('E-EDJS-14')
      .message('Import file not found: {{path}}.', filePath)
      .mitigation('Verify the file path exists and is readable.')
      .error();
  }
}
