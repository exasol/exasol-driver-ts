import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { DOCKER_CONTAINER_VERSION_V7 } from '../runner.config';
import { basicTests } from '../testcases/basic.spec';

basicTests("Browser",createWebsocketFactoryNoCert,DOCKER_CONTAINER_VERSION_V7,false);
