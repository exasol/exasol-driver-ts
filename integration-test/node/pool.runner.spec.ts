import { basicPoolTests } from '../testcases/pool.basic.spec';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';
basicPoolTests('Node', createWebsocketFactoryWithCertificate);
