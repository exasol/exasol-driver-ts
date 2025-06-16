import { createHash, X509Certificate } from 'crypto';
import { StartedTestContainer } from 'testcontainers';
import * as tar from "tar-stream";
export class CertificateProvider {
  constructor(container: StartedTestContainer) {
    this.container = container;
  }
  container: StartedTestContainer;

  public getTlsCertificateCAPath(): string {
    return '/exa/etc/ssl/ssl.ca';
  }
  public getTlsCertificatePath(): string {
    return '/exa/etc/ssl/ssl.crt';
  }
  public getTlsCertificateCAKeyPath(): string {
    return '/exa/etc/ssl/ssl.ca.key';
  }
  public getTlsCertificateKeyPath(): string {
    return '/exa/etc/ssl/ssl.key';
  }

  /**
   * Read and convert the self-signed TLS certificate used by the database in the container for database connections
   * and the RPC interface.
   *
   * @return the TLS certificate or an empty {@link Optional} when the certificate file does not exist.
   */
  public async getTlsCertificate(): Promise<X509Certificate | undefined> {
    return this.getCertificate();
  }

  /**
   * Get the SHA256 fingerprint of the TLS certificate used by the database in the container for database connections
   * and the RPC interface.
   *
   * @return SHA256 fingerprint of the TLS certificate or an empty {@link Optional} when the certificate file does not
   *         exist.
   */
  public async getTlsCertificateFingerprint(): Promise<string | undefined> {
    return await this.getSha256Fingerprint();
  }

  public async downloadFileFromContainer(container: StartedTestContainer, containerFilePath: string) {
    const tarStream = await container.copyArchiveFromContainer(containerFilePath);
    return tarStream;
  }

  /**
   * Read and convert the self-signed TLS certificate used by the database in the container for database connections
   * and the RPC interface.
   *
   * @return the TLS certificate or an empty {@link Optional} when no configuration exists or the certificate file
   *         does not exist.
   */
  public async getCertificate(): Promise<X509Certificate | undefined> {
    const certString = await this.readCertificate();
    if (certString) {
      return this.parseCertificate(certString);
    } else {
      return undefined;
    }
  }

  /**
 * Reads a file from the container using copyArchiveFromContainer.
 *
 * @param container - The StartedTestContainer instance
 * @param containerFilePath - The absolute path of the file inside the container
 * @returns The contents of the file as a string
 */
private async readFileFromContainer(
  container: StartedTestContainer,
  containerFilePath: string
): Promise<string> {
  const archiveStream = await container.copyArchiveFromContainer(containerFilePath);

  return new Promise<string>((resolve, reject) => {
    const extract = tar.extract();
    let fileContent = "";

    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        fileContent = Buffer.concat(chunks).toString("utf-8");
        next();
      });
      stream.on("error", reject);
    });

    extract.on("finish", () => resolve(fileContent));
    extract.on("error", reject);

    archiveStream.pipe(extract);
  });
}
  
  public async readCertificate(): Promise<string | undefined> {
    const certPath: string = this.getTlsCertificatePath();
    try {
      const fileContents = await this.readFileFromContainer(this.container, certPath);
      return fileContents;
    } catch (error) {
      return undefined;
    }
  }
  public async readCA(): Promise<string | undefined> {
    const certCAPath: string = this.getTlsCertificateCAPath();
    try {
      const fileContents = await this.readFileFromContainer(this.container, certCAPath);
      return fileContents;
    } catch (error) {
      return undefined;
    }
  }
  public async readKey(): Promise<string | undefined> {
    const certKeyPath: string = this.getTlsCertificateKeyPath();
    try {
      const fileContents = await this.readFileFromContainer(this.container, certKeyPath);
      return fileContents;
    } catch (error) {
      return undefined;
    }
  }
  public async readCAKey(): Promise<string | undefined> {
    const certCAKeyPath: string = this.getTlsCertificateCAKeyPath();
    try {
      const fileContents = await this.readFileFromContainer(this.container, certCAKeyPath);
      return fileContents;
    } catch (error) {
      return undefined;
    }
  }
  private parseCertificate(certContent: string): X509Certificate {
    try {
      return new X509Certificate(certContent);
    } catch (error) {
      throw new Error(`Error parsing certificate: ${certContent}`);
    }
  }

  public async getSha256Fingerprint(): Promise<string | undefined> {
    const encodedCert = await this.getEncodedCertificate();
    if (encodedCert) {
      const sha = CertificateProvider.sha256(encodedCert);
      return CertificateProvider.bytesToHexWithPadding(32, sha);
    }
    return undefined;
  }

  private async getEncodedCertificate(): Promise<Buffer | undefined> {
    const cert = await this.getCertificate();
    if (cert) {
      return this.encodeX509Certificate(cert);
    }
    return undefined;
  }

  private encodeX509Certificate(certificate: X509Certificate): Buffer {
    return certificate.raw;
  }

  private static sha256(data: Buffer): Buffer {
    return createHash('sha256').update(data).digest();
  }

  private static bytesToHexWithPadding(byteCount: number, bytes: Buffer): string {
    const hex = CertificateProvider.bytesToHex(bytes);
    return hex.padStart(byteCount * 2, '0');
  }

  private static bytesToHex(bytes: Buffer): string {
    return bytes.toString('hex');
  }
}
