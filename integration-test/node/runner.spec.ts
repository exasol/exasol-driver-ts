import { basicTests } from '../testcases/basic.spec';
import { connectionStringTests } from '../testcases/connection-string.spec';
import { createNodeRuntime } from './test-runtime';

basicTests(createNodeRuntime());
connectionStringTests(createNodeRuntime());
