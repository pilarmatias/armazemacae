import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, symlink, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.TEST_RUNTIME === 'java' ? 'java' : 'node';
let child;
let base;
let output = '';

before(async () => {
  child = spawn(runtime === 'java' ? 'java' : process.execPath,
    [runtime === 'java' ? 'server/DevServer.java' : 'scripts/server.mjs'], {
      cwd: root,
      env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`Servidor não iniciou: ${output}`)), 20000);
    const finish = (error) => {
      clearTimeout(timer);
      error ? fail(error) : done();
    };
    child.on('error', finish);
    child.on('exit', code => finish(new Error(`Servidor encerrou (${code}): ${output}`)));
    child.stderr.on('data', data => { output += data; });
    child.stdout.on('data', data => {
      output += data;
      const address = output.match(/Armazém da Construção: (http:\/\/127\.0\.0\.1:\d+)/);
      if (address) {
        base = address[1];
        finish();
      }
    });
  });
});

after(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit');
    child.kill('SIGTERM');
    await stopped;
  }
});

test('health check confirma projeto e runtime', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', project: 'armazemacae', runtime });
});

test('página inicial entrega exatamente o HTML do projeto', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(await response.text(), await readFile(resolve(root, 'public/index.html'), 'utf8'));
});

test('CSS, JavaScript e JSON são servidos com conteúdo e MIME corretos', async () => {
  for (const [file, type] of [['styles.css', 'text/css'], ['app.js', 'text/javascript'], ['data/site.json', 'application/json']]) {
    const response = await fetch(`${base}/${file}`);
    assert.equal(response.status, 200, file);
    assert.ok(response.headers.get('content-type').includes(type), file);
    assert.equal(await response.text(), await readFile(resolve(root, 'public', file), 'utf8'), file);
  }
});

test('catálogo da loja sincroniza com o HTML independente', async () => {
  const [pageResponse, dataResponse] = await Promise.all([
    fetch(base),
    fetch(`${base}/data/site.json`),
  ]);
  const page = await pageResponse.text();
  const content = await dataResponse.json();
  const embedded = page.match(/<script id="site-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(embedded, 'HTML independente deve conter dados embutidos');
  assert.deepEqual(JSON.parse(embedded[1]), content);
  assert.match(page, /Armazém da Construção/);
  assert.match(page, /Produtos para obra/);
  assert.equal(content.products.length, 23);
  assert.equal(new Set(content.products.map(product => product.id)).size, content.products.length);
  assert.equal(content.categories.length, 10);
  assert.equal(content.offers.length, 4);
  assert.ok(content.products.every(product =>
    Number.isFinite(product.price) && product.price > 0 && product.image.startsWith('https://')));
});

test('HEAD retorna os cabeçalhos sem corpo', async () => {
  const response = await fetch(base, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.ok(Number(response.headers.get('content-length')) > 0);
  assert.equal(await response.text(), '');
});

test('arquivos inexistentes e diretórios não viram páginas válidas', async () => {
  for (const path of ['/nao-existe', '/data/']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
  }
});

test('POST não é aceito no servidor estático', async () => {
  const response = await fetch(base, { method: 'POST', body: 'teste' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});

test('arquivos do repositório e caminhos codificados não escapam de public', async () => {
  for (const path of ['/.git/config', '/package.json', '/%2e%2e%2fREADME.md', '/%2e%2e%5cREADME.md']) {
    const response = await fetch(`${base}${path}`);
    assert.ok([400, 404].includes(response.status), `${path}: ${response.status}`);
  }
});

test('links simbólicos para fora de public não expõem arquivos', async (context) => {
  const link = resolve(root, 'public', `escape-test-${runtime}.txt`);
  try {
    await symlink(resolve(root, 'README.md'), link);
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      context.skip('Criação de links simbólicos não permitida neste ambiente.');
      return;
    }
    throw error;
  }
  try {
    const response = await fetch(`${base}/escape-test-${runtime}.txt`);
    assert.equal(response.status, 404);
  } finally {
    await unlink(link);
  }
});

test('codificação inválida retorna erro e preserva o servidor', async () => {
  for (const path of ['/%ZZ', '/%00']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 400, path);
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
});
