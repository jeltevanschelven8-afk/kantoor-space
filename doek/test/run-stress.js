// Draait test/stress.js (en test/stress2.js) in de echte app (headless Edge) en toont het resultaat.
// Gebruik: node test/run-stress.js [url]
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const url = process.argv[2] || 'http://localhost:8082/';
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-')); const port = 9500 + Math.floor(Math.random() * 400);
const p = spawn(edge, ['--headless=new', '--user-data-dir=' + prof, '--remote-debugging-port=' + port, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const files = ['stress.js', 'stress2.js'].filter((f) => fs.existsSync(path.join(__dirname, f)));
(async () => {
  let t; for (let i = 0; i < 60; i++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); if (t) break; } catch { /* nog niet klaar */ } await new Promise((r) => setTimeout(r, 250)); }
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = new Map(); const reqs = new Set();
  const send = (m, pr = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result || d.error); pend.delete(d.id); } else if (d.method === 'Network.requestWillBeSent') reqs.add(new URL(d.params.request.url).host); };
  await new Promise((r) => (ws.onopen = r));
  await send('Network.enable'); await send('Page.navigate', { url }); await new Promise((r) => setTimeout(r, 4000));
  // elke test los, met een tijdslimiet: een hangende test wordt gemeld in plaats van alles te blokkeren
  const run = async (pre) => { let v; for (const f of files) { const code = pre + fs.readFileSync(path.join(__dirname, f), 'utf8'); const r = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true, timeout: 15000 }); if (r.exceptionDetails) return { error: (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text || '').slice(0, 200) }; v = r.result && r.result.value; } return { v }; };
  const names = (await run('window.__list=true;window.__only=null;')).v || [];
  const v = { pass: 0, fail: 0, failures: [], total: names.length };
  for (const n of names) {
    const r = await run('window.__list=false;window.__only=' + JSON.stringify(n) + ';');
    console.log((r.error || (r.v && r.v.fail) ? 'X ' : 'ok ') + n + (r.error ? ' → ' + r.error.slice(0, 120) : r.v && r.v.fail ? ' → ' + r.v.failures[0] : ''));
    if (r.error) { v.fail++; v.failures.push(n + ' → ' + (/terminated/i.test(r.error) ? 'HANG (meer dan 15 s)' : r.error)); await send('Page.navigate', { url }); await new Promise((x) => setTimeout(x, 4000)); }
    else if (r.v && r.v.fail) { v.fail++; v.failures.push(...r.v.failures); } else v.pass++;
  }
  console.log('geslaagd ' + v.pass + '/' + v.total + ', mislukt ' + v.fail); v.failures.forEach((f) => console.log(' ✗', f));
  const ext = [...reqs].filter((h) => h && !/^(localhost|127\.0\.0\.1|doek\.local)(:|$)/.test(h));
  console.log('externe hosts:', ext.length ? ext.join(', ') : 'geen');
  ws.close(); p.kill(); setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch { /* niets */ } process.exit(v && v.fail ? 1 : 0); }, 800);
})();
