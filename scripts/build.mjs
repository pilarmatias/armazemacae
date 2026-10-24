import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public');
const destination = join(root, 'dist');

// O HTML exportado também funciona por duplo clique, sem servidor ou rede.
const [template, css, javascript, favicon, json, logo] = await Promise.all([
  readFile(join(source, 'index.html'), 'utf8'),
  readFile(join(source, 'styles.css'), 'utf8'),
  readFile(join(source, 'app.js'), 'utf8'),
  readFile(join(source, 'favicon.svg'), 'utf8'),
  readFile(join(source, 'data/site.json'), 'utf8'),
  readFile(join(source, 'logo-armazem.png')),
]);
const content = JSON.stringify(JSON.parse(json)).replaceAll('<', '\\u003c');
const logoDataUri = `data:image/png;base64,${logo.toString('base64')}`;
let standalone = template.replace('<html lang="pt-BR">', '<html lang="pt-BR" data-standalone="true">');
const replacements = [
  [/<link rel="icon" href="\.\/favicon\.svg" type="image\/svg\+xml">/, `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}" type="image/svg+xml">`],
  [/src="\.\/logo-armazem\.png"/g, `src="${logoDataUri}"`],
  [/<link rel="stylesheet" href="\.\/styles\.css">/, `<style>\n${css}\n</style>`],
  [/<script id="site-data" type="application\/json">[\s\S]*?<\/script>/, `<script id="site-data" type="application/json">${content}</script>`],
  [/<script src="\.\/app\.js" defer><\/script>/, `<script>document.addEventListener('DOMContentLoaded', () => {\n${javascript}\n});</script>`],
];
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(standalone)) throw new Error('O template mudou: atualize a exportação independente.');
  standalone = standalone.replace(pattern, () => replacement);
}

const temporary = await mkdtemp(join(root, '.build-'));
try {
  await mkdir(join(temporary, 'site'));
  await cp(source, join(temporary, 'site'), { recursive: true });
  await writeFile(join(temporary, 'site', 'index.html'), standalone);
  await rm(destination, { recursive: true, force: true });
  await rename(join(temporary, 'site'), destination);
  console.log('Build estático concluído em dist/.');
  if (process.argv.includes('--export-root')) {
    await copyFile(join(destination, 'index.html'), join(root, 'index.html'));
    console.log('index.html independente exportado na raiz; abra por duplo clique.');
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
