import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { DOCKER_CONTAINER_VERSION } from '../runner.config';
import { basicTests } from '../testcases/basic.spec';

basicTests("Browser", createWebsocketFactoryNoCert, DOCKER_CONTAINER_VERSION);
