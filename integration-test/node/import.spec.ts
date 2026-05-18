
import { DOCKER_CONTAINER_VERSION_LATEST } from '../runner.config';
import { importTests } from '../testcases/import';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';
importTests('Node', createWebsocketFactoryWithCertificate, DOCKER_CONTAINER_VERSION_LATEST);
