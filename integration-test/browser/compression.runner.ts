import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { basicCompressionTests } from '../testcases/compression.basic.spec';

basicCompressionTests('Browser', createWebsocketFactoryNoCert);
