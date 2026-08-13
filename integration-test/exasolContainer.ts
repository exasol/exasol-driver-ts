import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { CertificateProvider } from './certificateProvider';

const DOCKER_CONTAINER_VERSION: string = process.env['EXASOL_DOCKER_VERSION'] ?? 'exasol/docker-db:2026.1.1';


export class ExasolContainer {

  private readonly certProvider: CertificateProvider;

  constructor(private readonly container: StartedTestContainer) {
    this.certProvider = new CertificateProvider(container);
  }

  public static supportsEncryptedImportExport(): boolean {
    // Exasol 8.x does not support `PUBLIC KEY` option
    return !DOCKER_CONTAINER_VERSION.match(/(?:^|:)8(?:\.|$)/);
  }

  getPort(): number {
    const port = this.container.getMappedPort(8563);
    if (port === undefined) {
      throw new Error('Port 8563 is not mapped in the container');
    }
    return port;
  }

  getHost(): string {
    const host = this.container.getHost();
    if (host === undefined) {
      throw new Error('Host is not available in the container');
    }
    return host;
  }

  public async loadCert() {
    return await this.certProvider.readCertificate();
  }

  public async loadCA() {
    return await this.certProvider.readCA();
  }

  public async loadKey() {
    return await this.certProvider.readKey();
  }

  public async loadCAKey() {
    return await this.certProvider.readCAKey();
  }
}

export async function startNewDockerContainer(): Promise<ExasolContainer> {
  let imageName = DOCKER_CONTAINER_VERSION;
  if (!imageName.startsWith('exasol/docker-db:')) {
    imageName = 'exasol/docker-db:' + imageName;
  }
  return new ExasolContainer(await startNewDockerContainerWithImageName(imageName));
}

async function startNewDockerContainerWithImageName(imageName: string): Promise<StartedTestContainer> {
  const containerLog: string[] = [];
  const startupTimeoutMillis = 2 * 60 * 1000; // 2 minutes
  const container = new GenericContainer(imageName)
    .withExposedPorts(8563, 2580)
    .withPrivilegedMode()
    .withDefaultLogDriver()
    .withReuse()
    .withStartupTimeout(startupTimeoutMillis)
    .withLogConsumer((stream) => {
      stream.on('data', (line) => {
        containerLog.push(line.toString());
      });
    })
    .withWaitStrategy(Wait.forLogMessage('All stages finished'));
  try {
    console.debug(`Starting Docker container ${imageName} with startup timeout ${startupTimeoutMillis / 1000} seconds...`);
    const startTimestamp = Date.now();
    const startedContainer = await container.start();
    console.debug(`Docker container ${imageName} started with ID ${startedContainer.getId()} in ${(Date.now() - startTimestamp) / 1000} seconds.`);
    return startedContainer;
  } catch (error) {
    console.error('Failed to start Docker container:', error);
    console.error('Container logs:\n', containerLog.join(''));
    throw error;
  }
}
