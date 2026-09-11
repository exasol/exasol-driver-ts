import { basicCompressionTests } from '../testcases/compression.basic.spec';
import { createNodeRuntime } from './test-runtime';

basicCompressionTests(createNodeRuntime());
