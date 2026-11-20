import { connectionStringTests } from '../testcases/connection-string.spec';
import { createNodeRuntime } from './test-runtime';

connectionStringTests(createNodeRuntime());
