import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const readAsset = (reference) => {
  const path = resolve(dist, reference);
  if (!path.startsWith(dist + sep)) throw new Error('Asset must be inside dist.');
  return readFileSync(path, 'utf8');
};
let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_, path) => {
  const script = readAsset(path);
  if (/\b(?:import|export)\s[^;]*?from\s*["']\./.test(script) || /\bimport\(["']\./.test(script)) {
    throw new Error('Standalone build requires a single JavaScript bundle.');
  }
  return `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g, (_, path) => {
  // The portable file uses system fonts and does not need network requests.
  const css = readAsset(path).replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, '');
  return `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
});
const icon = encodeURIComponent(readFileSync(join(dist, 'favicon.svg'), 'utf8'));
html = html.replace(/href="[^"]*favicon\.svg"/, `href="data:image/svg+xml,${icon}"`);
if (/<(?:script|link)[^>]+(?:src|href)="\.\//.test(html)) throw new Error('Unbundled local asset.');
mkdirSync(join(root, 'standalone'), { recursive: true });
writeFileSync(join(root, 'standalone', 'index.html'), html);
console.log('Standalone file: standalone/index.html (open directly in your browser)');
