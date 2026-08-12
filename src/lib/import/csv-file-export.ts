import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import * as tls from 'node:tls';
import { ExaErrorBuilder } from '../errors/error-reporting';
import { buildCsvExportSql } from './export-sql-builder';
import { readHttpRequest, receiveHttpRequestBody } from './http-protocol';
import { createTunnel } from './http-transport';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';
import { CsvExportFormatOptions, CsvExportOptions } from './types';

interface ExportCsvFileParameters {
  host: string;
  port: number;
  source: string;
  filePath: string;
  executeSql: (sql: string) => Promise<number>;
  csvOptions?: CsvExportFormatOptions;
  options?: CsvExportOptions;
  cancelSql?: () => Promise<void>;
}

// [impl->dsn~decision-stream-csv-through-export-tunnel~1]
export async function exportCsvFile({
  host,
  port,
  source,
  filePath,
  executeSql,
  csvOptions,
  options,
  cancelSql,
}: ExportCsvFileParameters): Promise<number> {
  // [impl->dsn~runtime-csv-export-destination-file~1]
  // [impl->dsn~runtime-csv-export-file-stream~1]
  // [impl->dsn~runtime-csv-export-cancellation~1]
  const absoluteFilePath = path.resolve(filePath);
  let fileStream: fs.WriteStream | undefined;
  let unencryptedSocket: net.Socket | undefined;
  let secureSocket: tls.TLSSocket | undefined;
  let destinationCreated = false;
  let completed = false;
  let queryStarted = false;
  let abortExport: (() => void) | undefined;
  let rowCount: number | undefined;
  let exportError: unknown;
  let cleanupError: unknown;

  throwIfAborted(options?.signal);

  const abortPromise = new Promise<never>((_, reject) => {
    abortExport = () => {
      fileStream?.destroy();
      secureSocket?.destroy();
      unencryptedSocket?.destroy();
      if (queryStarted) {
        void cancelSql?.().catch(() => undefined);
      }
      reject(newExportAbortedError());
    };
  });

  if (options?.signal && abortExport) {
    options.signal.addEventListener('abort', abortExport, { once: true });
  }

  try {
    const fileHandle = await createDestinationFile(absoluteFilePath);
    destinationCreated = true;
    fileStream = fileHandle.createWriteStream();
    throwIfAborted(options?.signal);

    const tunnel = await Promise.race([createTunnel(host, port, options?.signal), abortPromise]);
    unencryptedSocket = tunnel.socket;
    throwIfAborted(options?.signal);
    const cert = generateAdHocCertificate();
    secureSocket = wrapWithTls(unencryptedSocket, cert.key, cert.cert);
    const exportSql = buildCsvExportSql(source, tunnel.internalAddress, cert.fingerprint, csvOptions);

    queryStarted = true;
    const sqlPromise = executeSql(exportSql);
    const transferPromise = readHttpRequest(secureSocket)
      .then(async (request) => {
        await receiveHttpRequestBody(secureSocket!, request, fileStream!);
        await sendSuccessResponse(secureSocket!);
      });
    [rowCount] = await Promise.race([Promise.all([sqlPromise, transferPromise]), abortPromise]);
    completed = true;
  } catch (error) {
    exportError = error;
  } finally {
    if (options?.signal && abortExport) {
      options.signal.removeEventListener('abort', abortExport);
    }
    secureSocket?.destroy();
    unencryptedSocket?.destroy();
    if (fileStream && !fileStream.closed) {
      fileStream.destroy();
    }
    if (destinationCreated && !completed) {
      try {
        await fs.promises.unlink(absoluteFilePath);
      } catch (error) {
        cleanupError = error;
      }
    }
  }

  if (!completed) {
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [exportError, cleanupError],
        'CSV export failed and the partial destination file could not be removed.',
        { cause: exportError },
      );
    }
    throw exportError;
  }
  return rowCount!;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw newExportAbortedError();
  }
}

function newExportAbortedError(): DOMException {
  const message = new ExaErrorBuilder('E-EDJS-31').message('The CSV export was aborted.').toString();
  return new DOMException(message, 'AbortError');
}

function sendSuccessResponse(socket: tls.TLSSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n', (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function createDestinationFile(filePath: string): Promise<fs.promises.FileHandle> {
  try {
    return await fs.promises.open(filePath, 'wx');
  } catch (error) {
    if (isFileExistsError(error)) {
      throw new ExaErrorBuilder('E-EDJS-30')
        .message('CSV export destination already exists: {{path}}.', filePath)
        .mitigation('Choose a destination path that does not exist.')
        .error();
    }
    throw error;
  }
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}
