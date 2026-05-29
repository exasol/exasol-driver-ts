import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export async function startNewDockerContainer(DOCKER_CONTAINER_VERSION: string): Promise<StartedTestContainer> {
  const containerLog: string[] = [];
  const startupTimeoutMillis = 1 * 60 * 1000; // 2 minutes
  const container = new GenericContainer(DOCKER_CONTAINER_VERSION)
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
    console.log(`Starting Docker container ${DOCKER_CONTAINER_VERSION} with startup timeout ${startupTimeoutMillis / 1000} seconds...`);
    return await container.start();
  } catch (error) {
    console.error('Failed to start Docker container:', error);
    console.error('Container logs:\n', containerLog.join(''));
    throw error;
  }
}
