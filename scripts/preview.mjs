import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.mp3':'audio/mpeg' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Forbidden');
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(47832, '127.0.0.1', () => console.log('Prévia sem acesso ao computador: http://127.0.0.1:47832'));
