import { StartedTestContainer, GenericContainer, Wait } from 'testcontainers';
import { DOCKER_CONTAINER_VERSION_V8 } from './runner.config';

export async function startNewDockerContainer(): Promise<StartedTestContainer> {
  return await new GenericContainer(DOCKER_CONTAINER_VERSION_V8)
    .withExposedPorts(8563, 2580)
    .withPrivilegedMode()
    .withDefaultLogDriver()
    .withReuse()
    .withWaitStrategy(Wait.forLogMessage('All stages finished'))
    .start();
}
