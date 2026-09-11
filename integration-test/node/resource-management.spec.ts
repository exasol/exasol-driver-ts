import { resourceManagementTests } from '../testcases/resource-management.spec';
import { createNodeRuntime } from './test-runtime';

resourceManagementTests(createNodeRuntime());
