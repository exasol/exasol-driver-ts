import { createWebsocketFactoryNoCert } from '../node/createWebsocketFactoryNoCert';
import { basicPoolTests } from '../testcases/pool.basic.spec';

basicPoolTests("Browser", createWebsocketFactoryNoCert);
