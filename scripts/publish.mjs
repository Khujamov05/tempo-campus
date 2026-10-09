import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const outputs = [
  'docs/index.html',
  'docs/.nojekyll',
  'docs/favicon.svg',
  'docs/assets',
  'standalone/index.html',
];

if (git(['branch', '--show-current']) !== 'main') {
  throw new Error('Публикация выполняется из main. Сначала перенесите изменения в main.');
}
if (!existsSync(join(root, 'docs/index.html')) || !existsSync(join(root, 'docs/.nojekyll'))) {
  throw new Error('Сначала выполните npm run build.');
}

const changed = [
  ...git(['diff', '--name-only', '-z']).split('\0'),
  ...git(['diff', '--cached', '--name-only', '-z']).split('\0'),
  ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
].filter(Boolean);
const sourceChanges = changed.filter(
  (path) => !outputs.some((output) => path === output || path.startsWith(output + '/')),
);
if (sourceChanges.length) {
  throw new Error(
    `Сначала закоммитьте изменения исходников:\n${[...new Set(sourceChanges)].join('\n')}`,
  );
}

git(['add', '--', ...outputs]);
const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root });
if (diff.status === 1) {
  git(['commit', '-m', 'Update production build for GitHub Pages']);
} else if (diff.status !== 0) {
  throw new Error('Не удалось проверить изменения сборки.');
}
git(['push', 'origin', 'HEAD:main']);
console.log('main отправлена в GitHub. Pages автоматически публикует папку /docs из main.');
