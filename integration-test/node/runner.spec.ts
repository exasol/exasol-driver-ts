import { DOCKER_CONTAINER_VERSION_V8 } from '../runner.config';
import { basicTests } from '../testcases/basic.spec';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';

basicTests('Node', createWebsocketFactoryWithCertificate,DOCKER_CONTAINER_VERSION_V8,true);

