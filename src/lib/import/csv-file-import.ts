import * as fs from 'fs';
import * as net from 'net';
import * as tls from 'tls';
import { CsvFormatOptions } from './types';
import { createTunnel } from './http-transport';
import { generateAdHocCertificate, wrapWithTls } from './tls-transport';
import { buildCsvImportSql } from './import-sql-builder';
import { readHttpRequest, sendChunkedResponse } from './http-protocol';
import { ExaErrorBuilder } from '../errors/error-reporting';

export async function importCsvFile(
  host: string,
  port: number,
  tableName: string,
  filePath: string,
  encryption: boolean,
  executeSql: (sql: string) => Promise<number>,
  csvOptions?: CsvFormatOptions,
): Promise<number> {
  await verifyFileExists(filePath);

  const { socket, internalAddress } = await createTunnel(host, port);

  let activeSocket: net.Socket | tls.TLSSocket = socket;
  let fingerprint: string | undefined;

  if (encryption) {
    const cert = generateAdHocCertificate();
    activeSocket = wrapWithTls(socket, cert.key, cert.cert);
    fingerprint = cert.fingerprint;
  }

  const importSql = buildCsvImportSql(tableName, internalAddress, encryption, fingerprint, csvOptions);

  try {
    const sqlPromise = executeSql(importSql);
    const tunnelPromise = (async () => {
      await readHttpRequest(activeSocket);
      const fileStream = fs.createReadStream(filePath);
      await sendChunkedResponse(activeSocket, fileStream);
    })();

    const [rowCount] = await Promise.all([sqlPromise, tunnelPromise]);
    return rowCount;
  } finally {
    activeSocket.destroy();
  }
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
