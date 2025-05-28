import { basicCompressionTests } from '../testcases/compression.basic.spec';
import { createWebsocketFactoryWithCertificate } from './createWebsocketFactoryWithCertificate';
basicCompressionTests('Node', createWebsocketFactoryWithCertificate);
