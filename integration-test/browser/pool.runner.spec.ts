import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { DOCKER_CONTAINER_VERSION_V7 } from '../runner.config';
import { basicPoolTests } from '../testcases/pool.basic.spec';

basicPoolTests("Browser", createWebsocketFactoryNoCert, DOCKER_CONTAINER_VERSION_V7, false);
