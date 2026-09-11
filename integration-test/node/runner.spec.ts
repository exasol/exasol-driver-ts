import { basicTests } from '../testcases/basic.spec';
import { createNodeRuntime } from './test-runtime';

basicTests(createNodeRuntime());
