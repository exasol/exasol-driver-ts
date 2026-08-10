import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { basicTests } from '../testcases/basic.spec';

basicTests("Browser", createWebsocketFactoryNoCert);
