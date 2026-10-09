import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const root = realpathSync(resolve(import.meta.dirname, '..'));
const dist = join(root, 'dist');
const pages = join(root, 'docs');
const assets = join(pages, 'assets');
if (!existsSync(join(dist, 'index.html')))
  throw new Error('Сначала соберите приложение через Vite.');

mkdirSync(pages, { recursive: true });
// Clean only generated assets; keep source notes and screenshots in docs.
if (realpathSync(pages) !== pages || !assets.startsWith(root + sep)) {
  throw new Error('Папка публикации должна находиться внутри проекта.');
}
if (existsSync(assets)) {
  if (realpathSync(assets) !== assets) throw new Error('Папка assets не должна быть ссылкой.');
  rmSync(assets, { recursive: true, force: true });
}
for (const entry of ['index.html', 'favicon.svg', 'assets']) {
  cpSync(join(dist, entry), join(pages, entry), { recursive: true });
}
writeFileSync(join(pages, '.nojekyll'), '');
console.log('GitHub Pages build: docs/index.html (publish from main /docs)');
