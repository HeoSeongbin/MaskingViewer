import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const source = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const destination = new URL('../public/pdfjs/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(new URL(`${name}/`, source), new URL(`${name}/`, destination), {
    recursive: true,
  });
}
await cp(new URL('LICENSE', source), new URL('LICENSE', destination));
console.log(
  `PDF.js local assets ready: ${join(root.pathname, 'public/pdfjs')}`,
);
