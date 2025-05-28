import { basicTests } from '../testcases/basic.spec';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';

basicTests('Node',createWebsocketFactoryWithCertificate);

