import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const revision =
  process.env.GITHUB_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty =
  !process.env.GITHUB_SHA &&
  execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
    .length > 0;
const info = {
  version: packageJson.version,
  revision,
  dirty,
  basePath: process.env.VITE_BASE_PATH || '/',
  builtAt: new Date().toISOString(),
};
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../public/build-info.json', import.meta.url),
  JSON.stringify(info, null, 2) + '\n',
);
console.log(
  `Build identity ready: ${info.version} ${revision.slice(0, 7)} ${info.basePath}`,
);
