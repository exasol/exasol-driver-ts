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
  options: CsvExportOptions;
  cancelSql: () => Promise<void>;
}

// [impl->dsn~decision-stream-csv-through-export-tunnel~1]
export async function exportCsvFile({
  filePath, ...parameters
}: ExportCsvFileParameters): Promise<number> {
  // [impl->dsn~runtime-csv-export-destination-file~1]
  // [impl->dsn~runtime-csv-export-file-stream~1]
  // [impl->dsn~runtime-csv-export-cancellation~1]
  return new ExportOperation(filePath, parameters).run();
}

class ExportOperation {
  private readonly absoluteFilePath: string;
  private readonly abortPromise: Promise<never>;
  private fileStream: fs.WriteStream | undefined;
  private unencryptedSocket: net.Socket | undefined;
  private secureSocket: tls.TLSSocket | undefined;
  private destinationCreated = false;
  private completed = false;
  private queryPending = false;
  private destinationFilePromise: Promise<fs.promises.FileHandle> | undefined;
  private abortExport!: () => void;

  public constructor(
    filePath: string,
    private readonly parameters: Omit<ExportCsvFileParameters, 'filePath'>,
  ) {
    this.absoluteFilePath = path.resolve(filePath);
    this.abortPromise = new Promise<never>((_, reject) => {
      this.abortExport = () => {
        this.fileStream?.destroy();
        this.secureSocket?.destroy();
        this.unencryptedSocket?.destroy();
        if (this.queryPending) {
          void this.parameters.cancelSql().catch(() => undefined);
        }
        reject(newExportAbortedError());
      };
    });
  }

  public async run(): Promise<number> {
    throwIfAborted(this.parameters.options.signal);
    this.parameters.options.signal?.addEventListener('abort', this.abortExport, { once: true });

    let rowCount: number | undefined;
    let exportError: unknown;
    let cleanupError: unknown;
    try {
      rowCount = await this.export();
      this.completed = true;
    } catch (error) {
      exportError = error;
    } finally {
      cleanupError = await this.cleanup();
    }
    return getExportResult(this.completed, rowCount, exportError, cleanupError);
  }

  private async export(): Promise<number> {
    const fileHandle = await this.reserveDestination();
    this.fileStream = fileHandle.createWriteStream();
    throwIfAborted(this.parameters.options.signal);

    const tunnel = await Promise.race([
      createTunnel(this.parameters.host, this.parameters.port, this.parameters.options.signal),
      this.abortPromise,
    ]);
    this.unencryptedSocket = tunnel.socket;
    throwIfAborted(this.parameters.options.signal);
    const certificate = generateAdHocCertificate();
    this.secureSocket = wrapWithTls(this.unencryptedSocket, certificate.key, certificate.cert);
    const exportSql = buildCsvExportSql(
      this.parameters.source, tunnel.internalAddress, certificate.fingerprint, this.parameters.csvOptions,
    );

    this.queryPending = true;
    const sqlPromise = this.parameters.executeSql(exportSql).finally(() => {
      this.queryPending = false;
    });
    const transferPromise = this.transferToDestination();
    const [rowCount] = await Promise.race([Promise.all([sqlPromise, transferPromise]), this.abortPromise]);
    return rowCount;
  }

  private async reserveDestination(): Promise<fs.promises.FileHandle> {
    this.destinationFilePromise = createDestinationFile(this.absoluteFilePath);
    const fileHandle = await Promise.race([this.destinationFilePromise, this.abortPromise]);
    this.destinationCreated = true;
    return fileHandle;
  }

  private async transferToDestination(): Promise<void> {
    const request = await readHttpRequest(this.secureSocket!);
    await receiveHttpRequestBody(this.secureSocket!, request, this.fileStream!);
    await sendSuccessResponse(this.secureSocket!);
  }

  private async cleanup(): Promise<unknown> {
    this.parameters.options.signal?.removeEventListener('abort', this.abortExport);
    this.secureSocket?.destroy();
    this.unencryptedSocket?.destroy();
    if (this.fileStream && !this.fileStream.closed) {
      this.fileStream.destroy();
    }
    if (this.completed) {
      return undefined;
    }
    return this.removePartialDestination();
  }

  private async removePartialDestination(): Promise<unknown> {
    if (!this.destinationCreated) {
      if (this.destinationFilePromise) {
        removeLateDestinationFile(this.destinationFilePromise, this.absoluteFilePath);
      }
      return undefined;
    }
    try {
      await fs.promises.unlink(this.absoluteFilePath);
    } catch (error) {
      return error;
    }
    return undefined;
  }
}

function getExportResult(completed: boolean, rowCount: number | undefined, exportError: unknown, cleanupError: unknown): number {
  if (completed) {
    return rowCount!;
  }
  if (cleanupError === undefined) {
    throw exportError;
  }
  throw new AggregateError(
    [exportError, cleanupError],
    'CSV export failed and the partial destination file could not be removed.',
    { cause: exportError },
  );
}

function removeLateDestinationFile(destinationFilePromise: Promise<fs.promises.FileHandle>, filePath: string): void {
  void destinationFilePromise.then(
    async (fileHandle) => {
      try {
        await fileHandle.close();
        await fs.promises.unlink(filePath);
      } catch {
        // The export has already rejected with the cancellation error.
      }
    },
    () => undefined,
  );
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
