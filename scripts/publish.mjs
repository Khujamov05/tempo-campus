import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) throw new Error('Сначала выполните npm run build.');

const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const remote = git(['remote', 'get-url', 'origin']);
const temporary = mkdtempSync(join(tmpdir(), 'tempo-publish-'));

try {
  if (git(['ls-remote', '--heads', remote, 'gh-pages'])) {
    git(['clone', '--depth', '1', '--single-branch', '--branch', 'gh-pages', remote, temporary]);
    git(['rm', '-r', '--ignore-unmatch', '.'], temporary);
  } else {
    git(['init', '--initial-branch=gh-pages'], temporary);
    git(['remote', 'add', 'origin', remote], temporary);
  }

  for (const entry of readdirSync(dist))
    cpSync(join(dist, entry), join(temporary, entry), { recursive: true });
  writeFileSync(join(temporary, '.nojekyll'), '');
  git(['add', '.'], temporary);
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: temporary });
  if (diff.status === 0) {
    console.log('Опубликованная сборка уже актуальна.');
  } else if (diff.status === 1) {
    git(['commit', '-m', 'Publish Tempo website'], temporary);
    git(['push', 'origin', 'HEAD:gh-pages'], temporary);
    console.log('Сборка отправлена в gh-pages. GitHub Pages обновит сайт автоматически.');
  } else {
    throw new Error('Не удалось проверить изменения сборки.');
  }
} finally {
  // Only remove the temporary checkout created by this script, never the project.
  if (
    dirname(resolve(temporary)) === resolve(tmpdir()) &&
    basename(temporary).startsWith('tempo-publish-')
  ) {
    rmSync(temporary, { recursive: true, force: true });
  }
}
