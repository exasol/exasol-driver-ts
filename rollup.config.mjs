import typescript from '@rollup/plugin-typescript';

import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

// [impl->dsn~decision-publish-cjs-and-esm~1]
export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
      },
      {
        file: pkg.module,
        format: 'esm',
      },
    ],
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      'node:fs', 'node:net', 'node:tls', 'node:path',
    ],
    plugins: [typescript()],
  },
];
