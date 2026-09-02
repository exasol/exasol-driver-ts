import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import * as tls from 'node:tls';
import { ExaErrorBuilder } from '../errors/error-reporting';
import { FileServingOptions, serveFileRequests } from './http-protocol';
import { createTunnel, InternalAddress } from './http-transport';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';
import { FileImportOptions } from './types';

/** Parameters for streaming a local file through an Exasol import tunnel. */
export interface ImportLocalFileParameters {
  host: string;
  port: number;
  filePath: string;
  executeSql: (sql: string) => Promise<number>;
  buildImportSql: (internalAddress: InternalAddress, fingerprint: string) => string;
  options?: FileImportOptions;
  cancelSql?: () => Promise<void>;
  newAbortedError: () => DOMException;
  fileServingOptions?: FileServingOptions;
}

/** Imports a local file by executing format-specific SQL and streaming its bytes through the tunnel. */
export async function importLocalFile({
  host,
  port,
  filePath,
  executeSql,
  buildImportSql,
  options,
  cancelSql,
  newAbortedError,
  fileServingOptions,
}: ImportLocalFileParameters): Promise<number> {
  const absoluteFilePath = path.resolve(filePath);
  await verifyFileExists(absoluteFilePath);
  throwIfAborted(options?.signal, newAbortedError);

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
      reject(newAbortedError());
    };
  });

  if (options?.signal && abortImport) {
    options.signal.addEventListener('abort', abortImport, { once: true });
  }

  try {
    const tunnel = await Promise.race([createTunnel(host, port, options?.signal), abortPromise]);
    unencryptedSocket = tunnel.socket;
    throwIfAborted(options?.signal, newAbortedError);

    const cert = generateAdHocCertificate();
    secureSocket = wrapWithTls(unencryptedSocket, cert.key, cert.cert);
    queryStarted = true;
    const sqlPromise = executeSql(buildImportSql(tunnel.internalAddress, cert.fingerprint));
    const servingOptions: FileServingOptions = {
      ...fileServingOptions,
      onFileStream: (stream) => {
        fileStream = stream;
        fileServingOptions?.onFileStream?.(stream);
      },
    };
    return await Promise.race([serveFileRequests(secureSocket, absoluteFilePath, sqlPromise, servingOptions), abortPromise]);
  } finally {
    if (options?.signal && abortImport) {
      options.signal.removeEventListener('abort', abortImport);
    }
    fileStream?.destroy();
    secureSocket?.destroy();
    unencryptedSocket?.destroy();
  }
}

function throwIfAborted(signal: AbortSignal | undefined, newAbortedError: () => DOMException): void {
  if (signal?.aborted) {
    throw newAbortedError();
  }
}

/** Verifies that a local import source exists and is readable. */
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
