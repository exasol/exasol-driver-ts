import * as fs from 'node:fs';
import * as path from 'node:path';
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
  executeSql: (sql: string) => Promise<number>,
  csvOptions?: CsvFormatOptions,
): Promise<number> {
  const absoluteFilePath = path.resolve(filePath);
  await verifyFileExists(absoluteFilePath);

  const { socket: unencryptedSocket, internalAddress } = await createTunnel(host, port);

  const cert = generateAdHocCertificate();
  const secureSocket = wrapWithTls(unencryptedSocket, cert.key, cert.cert);
  const fingerprint = cert.fingerprint;

  const importSql = buildCsvImportSql(tableName, internalAddress, fingerprint, csvOptions);

  try {
    const sqlPromise = executeSql(importSql);
    const tunnelPromise = (async () => {
      await readHttpRequest(secureSocket);
      const fileStream = fs.createReadStream(absoluteFilePath);
      await sendChunkedResponse(secureSocket, fileStream);
    })();

    const [rowCount] = await Promise.all([sqlPromise, tunnelPromise]);
    return rowCount;
  } finally {
    secureSocket.destroy();
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
