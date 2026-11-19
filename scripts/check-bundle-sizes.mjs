import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// [impl->dsn~runtime-bundle-budgets~1]
const maxRaw = 400_000;
const maxGzip = 110_000;
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'exasol-driver-bundle-'));
const nodeBuiltins = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];
/** @type {{name: string, entryPoint: string, platform: import('esbuild').Platform, external: string[]}[]} */
const targets = [
  { name: 'node', entryPoint: 'src/index.ts', platform: 'node', external: nodeBuiltins },
  { name: 'browser', entryPoint: 'src/browser.ts', platform: 'browser', external: [] },
];

try {
  for (const { name, entryPoint, platform, external } of targets) {
    const outfile = join(temporaryDirectory, `${name}.mjs`);
    await build({
      entryPoints: [entryPoint],
      outfile,
      platform,
      format: 'esm',
      bundle: true,
      minify: true,
      external,
      logLevel: 'silent',
    });
    const bundle = await readFile(outfile);
    const raw = bundle.length;
    const gzip = gzipSync(bundle).length;
    console.log(`${name}: ${raw} raw bytes, ${gzip} gzip bytes`);
    if (raw > maxRaw || gzip > maxGzip) {
      throw new Error(`${name} bundle exceeds ${maxRaw} raw or ${maxGzip} gzip bytes`);
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
