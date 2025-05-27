import { StartedTestContainer, GenericContainer, Wait } from 'testcontainers';
import { DOCKER_CONTAINER_VERSION } from './runner.config';

export async function startNewDockerContainer(): Promise<StartedTestContainer> {
  return await new GenericContainer(DOCKER_CONTAINER_VERSION)
    .withExposedPorts(8563, 2580)
    .withPrivilegedMode()
    .withDefaultLogDriver()
    .withReuse()
    .withWaitStrategy(Wait.forLogMessage('All stages finished'))
    .start();
}
