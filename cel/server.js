// Cel (gemaakt door JJ van Schelven) — lokale webserver met deelfunctie (geen extra pakketten nodig)
// Starten: node server.js   (daarna openen: http://localhost:8081)
// Met --stil stopt de server vanzelf na 30 minuten zonder verzoeken (gebruikt door Cel.vbs).
//
// Delen: documenten die via Delen › Koppeling zijn gedeeld staan in de map 'gedeeld' naast dit bestand.
// Iedereen op hetzelfde netwerk opent zo'n koppeling (http://<dit-ip>:8081/?deel=...) in de browser.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const NAME = 'Cel';
const DEFAULT_PORT = 8081;
const root = __dirname;
const args = process.argv.slice(2);
const quiet = args.includes('--stil');
let port = +process.env.PORT || +args.find((a) => /^\d+$/.test(a)) || DEFAULT_PORT;
// In het Linux-programma (Electron) staat de app in een alleen-lezen map: gedeelde documenten gaan dan naar KANTOOR_SHARE_DIR
const embedded = !!process.env.KANTOOR_EMBEDDED;
const shareDir = process.env.KANTOOR_SHARE_DIR || path.join(root, 'gedeeld');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

let idle;
const resetIdle = () => {
  if (!quiet) return;
  clearTimeout(idle);
  idle = setTimeout(() => process.exit(0), 30 * 60 * 1000);
};

/* ---------- Delen ---------- */
const lanIp = () => {
  const all = os.networkInterfaces();
  let best = null;
  for (const name of Object.keys(all)) for (const a of all[name]) {
    if (a.family !== 'IPv4' || a.internal) continue;
    // echte netwerkkaarten (wifi/ethernet) gaan vóór virtuele (WSL, VirtualBox, Hyper-V)
    const virt = /wsl|virtual|vethernet|vmware|hyper-v|docker|virbr|veth|^br-|^tun|^tap|tailscale|zerotier|^zt/i.test(name);   // ook Linux-namen
    if (!best || (best.virt && !virt)) best = { ip: a.address, virt };
  }
  return best ? best.ip : '127.0.0.1';
};
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 60 * 1024 * 1024) { reject(new Error('Te groot')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});
const shareFile = (id) => (/^[a-z0-9]{8,16}$/.test(id) ? path.join(shareDir, id + '.json') : null);
const loadShare = (id) => { const f = shareFile(id); if (!f || !fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const saveShare = (s) => { fs.mkdirSync(shareDir, { recursive: true }); fs.writeFileSync(shareFile(s.id), JSON.stringify(s)); };
const publicInfo = (s) => ({ id: s.id, title: s.title, perm: s.perm, hasCode: !!s.code, by: s.by, created: s.created, modified: s.modified, version: s.version, app: NAME });
const isOwner = (s, req, q) => { const t = req.headers['x-eigenaar'] || q.get('eigenaar'); return !!t && t === s.owner; };
const codeOk = (s, req, q) => !s.code || (req.headers['x-code'] || q.get('code') || '') === s.code || isOwner(s, req, q);

const handleShare = async (req, res, p, q) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,X-Code,X-Eigenaar' }); return res.end(); }
  if (p === '/deel/info') return json(res, 200, { app: NAME, ip: lanIp(), port, origin: `http://${lanIp()}:${port}`, host: os.hostname() });
  if (p === '/deel/lijst') {
    const owner = req.headers['x-eigenaar'] || q.get('eigenaar') || '';
    const list = fs.existsSync(shareDir) ? fs.readdirSync(shareDir).filter((f) => f.endsWith('.json')).map((f) => loadShare(f.slice(0, -5))).filter(Boolean) : [];
    return json(res, 200, list.filter((s) => s.owner === owner).map(publicInfo));
  }
  if (p === '/deel' && req.method === 'POST') {
    let b; try { b = await readBody(req); } catch { return json(res, 400, { fout: 'Ongeldige gegevens' }); }
    if (!b || b.data === undefined) return json(res, 400, { fout: 'Geen document' });
    const s = {
      id: crypto.randomBytes(6).toString('hex').slice(0, 10), owner: crypto.randomBytes(12).toString('hex'),
      title: String(b.title || 'Naamloos').slice(0, 200), perm: b.perm === 'view' ? 'view' : 'edit', code: String(b.code || '').slice(0, 40),
      by: String(b.by || '').slice(0, 80), data: b.data, version: 1, created: Date.now(), modified: Date.now(),
    };
    saveShare(s);
    return json(res, 200, { ...publicInfo(s), owner: s.owner, link: `http://${lanIp()}:${port}/?deel=${s.id}${s.code ? '&code=' + encodeURIComponent(s.code) : ''}` });
  }
  const m = /^\/deel\/([a-z0-9]+)(\/versie)?$/.exec(p);
  if (!m) return json(res, 404, { fout: 'Onbekend' });
  const s = loadShare(m[1]);
  if (!s) return json(res, 404, { fout: 'Deze koppeling bestaat niet meer. De eigenaar is gestopt met delen.' });
  if (!codeOk(s, req, q)) return json(res, 403, { fout: 'code', hasCode: true, title: s.title, app: NAME });
  if (req.method === 'GET') {
    if (m[2]) return json(res, 200, { version: s.version, modified: s.modified, perm: s.perm, title: s.title });
    return json(res, 200, { ...publicInfo(s), data: s.data, link: `http://${lanIp()}:${port}/?deel=${s.id}${s.code ? '&code=' + encodeURIComponent(s.code) : ''}` });
  }
  if (req.method === 'PUT') {
    if (s.perm !== 'edit' && !isOwner(s, req, q)) return json(res, 403, { fout: 'Je mag dit document alleen bekijken.' });
    let b; try { b = await readBody(req); } catch { return json(res, 400, { fout: 'Ongeldige gegevens' }); }
    if (b.base !== undefined && b.base !== null && +b.base !== s.version) return json(res, 409, { fout: 'conflict', version: s.version, modified: s.modified, data: s.data });
    if (b.data !== undefined) s.data = b.data;
    if (b.title) s.title = String(b.title).slice(0, 200);
    s.version += 1; s.modified = Date.now();
    saveShare(s);
    return json(res, 200, { version: s.version, modified: s.modified });
  }
  if (req.method === 'PATCH') {
    if (!isOwner(s, req, q)) return json(res, 403, { fout: 'Alleen de eigenaar kan dit wijzigen.' });
    let b; try { b = await readBody(req); } catch { return json(res, 400, { fout: 'Ongeldige gegevens' }); }
    if (b.perm) s.perm = b.perm === 'view' ? 'view' : 'edit';
    if (b.code !== undefined) s.code = String(b.code || '').slice(0, 40);
    saveShare(s);
    return json(res, 200, { ...publicInfo(s), link: `http://${lanIp()}:${port}/?deel=${s.id}${s.code ? '&code=' + encodeURIComponent(s.code) : ''}` });
  }
  if (req.method === 'DELETE') {
    if (!isOwner(s, req, q)) return json(res, 403, { fout: 'Alleen de eigenaar kan stoppen met delen.' });
    try { fs.unlinkSync(shareFile(s.id)); } catch { /* al weg */ }
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { fout: 'Niet toegestaan' });
};

const server = http.createServer((req, res) => {
  resetIdle();
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/deel' || p.startsWith('/deel/')) { handleShare(req, res, p, url.searchParams).catch((e) => json(res, 500, { fout: e.message })); return; }
  if (p.startsWith('/gedeeld/')) { res.writeHead(403); return res.end('Geen toegang'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root) || path.basename(file).startsWith('.')) { res.writeHead(403); return res.end('Geen toegang'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
let tries = 0;
server.on('error', (e) => {
  // in het programma: bij een bezette poort de volgende proberen (8080 → 8082 → …) in plaats van te stoppen
  if (e.code === 'EADDRINUSE' && embedded && tries++ < 20) { port += 2; server.listen(port, '0.0.0.0'); return; }
  if (e.code === 'EADDRINUSE') { console.log(`Port ${port} is already in use — ${NAME} is probably already running at http://localhost:${port}`); process.exit(0); }
  throw e;
});
// 0.0.0.0: ook bereikbaar voor anderen op hetzelfde netwerk (nodig voor Delen). Windows vraagt de eerste keer of dat mag.
server.on('listening', () => {
  console.log(`${NAME} (made by JJ van Schelven) is running at http://localhost:${port}  (stop: Ctrl+C)`);
  console.log(`Share on this network via http://${lanIp()}:${port}`);
  resetIdle();
  if (embedded) process.emit('kantoor-server', port);
});
server.listen(port, '0.0.0.0');
