// Local dev server: serves this repo on http://localhost:8080 so the game
// can be played and the screenshots taken in a browser. Static files only,
// no build step — the game runs as ES modules straight from game/.
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || url.pathname === '/index.html') file = path.join(root, 'game', 'index.html');
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Solara Bay dev server: http://localhost:${port}/`);
  console.log('Screenshots: ?shot=cover|drive|city|title&seed=20261121');
});
