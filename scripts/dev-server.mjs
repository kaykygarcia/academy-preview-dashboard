import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestGet } from '../functions/api/overview.js';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch { /* .env não existe; token é opcional */ }

const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  try {
    if (url.pathname === '/api/overview') {
      const response = await onRequestGet({
        request: new Request(url),
        env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN || '' },
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const full = resolve(root, `.${requested}`);
    if (!full.startsWith(root + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const info = await stat(full);
    if (!info.isFile()) throw new Error('Not a file');
    const data = await readFile(full);
    res.writeHead(200, { 'content-type': types[extname(full)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`\nKayky Deployments: http://127.0.0.1:${port}\n`);
  console.log('Fonte: GitHub API pública (GITHUB_TOKEN opcional)');
});
