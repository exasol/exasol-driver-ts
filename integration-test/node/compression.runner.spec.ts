import { DOCKER_CONTAINER_VERSION } from '../runner.config';
import { basicCompressionTests } from '../testcases/compression.basic.spec';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';

basicCompressionTests('Node', createWebsocketFactoryWithCertificate, DOCKER_CONTAINER_VERSION);
