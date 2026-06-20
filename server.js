// Pool multiplayer host: serves the built web AND relays messages between the two players.
// Run with: npm start  (builds the site, then launches this on port 8080)
// ponytail: pure relay — the host browser runs the authoritative physics, this just forwards bytes.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = 8080;
const DIST = join(process.cwd(), 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path === '/') path = '/index.html';
  const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(await readFile(join(DIST, 'index.html')));
    } catch {
      res.writeHead(404); res.end('Not found — run "npm run build" first.');
    }
  }
});

const wss = new WebSocketServer({ server });
let clients = []; // [player1 (host), player2 (guest)]

wss.on('connection', (ws) => {
  if (clients.length >= 2) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
  ws.role = clients.length === 0 ? 1 : 2;
  clients.push(ws);
  ws.send(JSON.stringify({ type: 'role', role: ws.role }));
  if (ws.role === 2) clients.find((c) => c.role === 1)?.send(JSON.stringify({ type: 'peer-joined' }));

  ws.on('message', (data) => {
    const other = clients.find((c) => c !== ws);
    if (other && other.readyState === other.OPEN) other.send(data.toString());
  });
  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
    clients[0]?.send(JSON.stringify({ type: 'peer-left' }));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Pool corriendo:`);
  console.log(`  - Tú:        http://localhost:${PORT}`);
  console.log(`  - Tu amigo:  http://192.168.1.35:${PORT}  (misma red WiFi)\n`);
});
