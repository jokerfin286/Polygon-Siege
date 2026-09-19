import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const temp = await mkdtemp(path.join(tmpdir(), 'polygon-coop-'));
try {
  const outfile = path.join(temp, 'cooptest.mjs');
  await build({
    entryPoints: [fileURLToPath(new URL('./cooptest.ts', import.meta.url))],
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(temp, { recursive: true, force: true });
}
