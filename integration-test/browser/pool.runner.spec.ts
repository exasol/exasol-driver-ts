import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { DOCKER_CONTAINER_VERSION } from '../runner.config';
import { basicPoolTests } from '../testcases/pool.basic.spec';

basicPoolTests("Browser", createWebsocketFactoryNoCert, DOCKER_CONTAINER_VERSION);
