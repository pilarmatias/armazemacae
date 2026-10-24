import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = await realpath(resolve(projectRoot, 'public'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT deve ser um número inteiro entre 0 e 65535.');
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
};

function insideRoot(path) {
  const child = relative(publicRoot, path);
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

const server = createServer(async (request, response) => {
  const head = request.method === 'HEAD';
  function send(status, body, type = 'text/plain; charset=utf-8') {
    response.writeHead(status, {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(head ? undefined : body);
  }

  if (request.method !== 'GET' && !head) {
    response.setHeader('Allow', 'GET, HEAD');
    send(405, 'Método não permitido.');
    return;
  }

  try {
    const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    if (pathname.includes('\0') || pathname.includes('\\')) {
      send(400, 'Caminho inválido.');
      return;
    }
    if (pathname === '/api/health') {
      send(200, JSON.stringify({ status: 'ok', project: 'armazemacae', runtime: 'node' }), types['.json']);
      return;
    }
    if (!pathname.startsWith('/') || pathname.split('/').some(part => part.startsWith('.'))) {
      send(404, 'Página não encontrada.');
      return;
    }

    const requestedPath = resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!insideRoot(requestedPath)) {
      send(404, 'Página não encontrada.');
      return;
    }
    const file = await realpath(requestedPath);
    if (!insideRoot(file) || !(await stat(file)).isFile()) {
      send(404, 'Página não encontrada.');
      return;
    }
    send(200, await readFile(file), types[extname(file)] || 'application/octet-stream');
  } catch (error) {
    if (error instanceof URIError) {
      send(400, 'Caminho inválido.');
    } else if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) {
      send(404, 'Página não encontrada.');
    } else {
      console.error('Falha ao atender requisição:', error.message);
      send(500, 'Erro interno.');
    }
  }
});

server.on('error', error => {
  console.error(`Não foi possível iniciar o servidor: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Armazém Acaé: http://${host}:${server.address().port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close());
}
