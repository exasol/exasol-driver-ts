import { vi } from 'vitest';
import { basicCompressionTests } from '../testcases/compression.basic.spec';
import { createBrowserRuntime } from './test-runtime';

// [itest->dsn~runtime-browser-websocket~2]
// [itest->dsn~decision-use-vitest-browser-mode~1]
vi.setConfig({ testTimeout: 7_000_000 });
basicCompressionTests(createBrowserRuntime());
