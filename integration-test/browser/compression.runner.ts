import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { DOCKER_CONTAINER_VERSION } from '../runner.config';
import { basicCompressionTests } from '../testcases/compression.basic.spec';

basicCompressionTests('Browser', createWebsocketFactoryNoCert, DOCKER_CONTAINER_VERSION, false);
