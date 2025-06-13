import { DOCKER_CONTAINER_VERSION_V8 } from '../runner.config';
import { basicPoolTests } from '../testcases/pool.basic.spec';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';
basicPoolTests('Node',  createWebsocketFactoryWithCertificate,DOCKER_CONTAINER_VERSION_V8,true);
