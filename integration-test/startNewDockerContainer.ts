import { StartedTestContainer, GenericContainer, Wait } from 'testcontainers';

export async function startNewDockerContainer(DOCKER_CONTAINER_VERSION: string): Promise<StartedTestContainer> {
  return await new GenericContainer(DOCKER_CONTAINER_VERSION)
    .withExposedPorts(8563, 2580)
    .withPrivilegedMode()
    .withDefaultLogDriver()
    .withReuse()
    .withWaitStrategy(Wait.forLogMessage('All stages finished'))
    .start();
}
