import { basicPoolTests } from '../testcases/pool.basic.spec';
import { createNodeRuntime } from './test-runtime';

basicPoolTests(createNodeRuntime());
