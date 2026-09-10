import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const declarationDirectory = 'dist';
const relativeSpecifierPattern = /((?:from\s*|import\()\s*['"])(\.\.?\/[^'"]+)(['"])/g;

// Temporary compatibility bridge for NodeNext consumers. Rollup preserves the
// extensionless specifiers from the TypeScript source in declaration output,
// but NodeNext requires explicit ESM extensions. Replace this with `.js`
// specifiers in source imports and exports as tracked in
// https://github.com/exasol/exasol-driver-ts/issues/106.
async function declarationFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return declarationFiles(entryPath);
    }
    return entry.name.endsWith('.d.ts') ? [entryPath] : [];
  }));
  return files.flat();
}

function addJsExtension(specifier) {
  return /\.(?:[cm]?js|json)$/u.test(specifier) ? specifier : `${specifier}.js`;
}

for (const declarationFile of await declarationFiles(declarationDirectory)) {
  const contents = await readFile(declarationFile, 'utf8');
  const updatedContents = contents.replace(relativeSpecifierPattern, (_, prefix, specifier, quote) =>
    `${prefix}${addJsExtension(specifier)}${quote}`,
  );
  if (updatedContents !== contents) {
    await writeFile(declarationFile, updatedContents);
  }
}
