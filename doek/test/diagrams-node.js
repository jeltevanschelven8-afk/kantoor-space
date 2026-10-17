/* Doek — test van de diagrammen (js/diagrams.js) zonder browser.
   Starten: node doek/test/diagrams-node.js   (stopt met code 1 bij een fout)
   Controleert alle indelingen met 1, 3, 7 en 12 items (en geneste hiërarchieën tot 30 knopen / 4 niveaus)
   in 800×450, 300×600 en 1000×200: geen NaN, knopen binnen de grenzen, geen ongewenste overlap,
   tekengrootte 8–40 pt, elk item zichtbaar; plus het bewerken van het overzicht en de woordenlijst. */
'use strict';
const path = require('path');
global.window = global;
global.App = {};
require(path.join(__dirname, '..', 'js', 'diagrams.js'));
require(path.join(__dirname, '..', 'js', 'lang', 'en-diagrams.js'));
const D = App.Diagrams;

let fails = 0, checks = 0;
const failMsgs = [];
const fail = (msg) => { fails++; if (failMsgs.length < 60) failMsgs.push(msg); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };

/* ---------- testgegevens ---------- */
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const WORDS = ['Plan', 'Uitvoering', 'Controle en bijsturing', 'Een langere omschrijving van deze stap in het proces', 'Klant', '', 'Resultaat', 'Onderzoek', 'Ontwerp', 'Bouwen', 'Testen', 'Oplevering'];
let uid = 0;
const item = (lvl, text) => ({ id: 'i' + (uid++), text: text != null ? text : WORDS[uid % WORDS.length], lvl });
const flat = (n) => Array.from({ length: n }, () => item(0));
// n hoofditems, om en om 0, 1 of 2 subitems
const withKids = (n) => { const a = []; for (let i = 0; i < n; i++) { a.push(item(0)); for (let k = 0; k < i % 3; k++) a.push(item(1)); } return a; };
// geneste boom: n knopen, maximaal 4 niveaus, één of meer hoofditems
const nested = (n, roots = 1) => {
  const a = [item(0)];
  for (let i = 1; i < n; i++) {
    const prev = a[a.length - 1].lvl, newRoot = roots > 1 && i % Math.ceil(n / roots) === 0;
    a.push(item(newRoot ? 0 : Math.max(1, Math.min(3, prev + 1, Math.floor(rnd() * (prev + 2))))));
  }
  return a;
};
const orgSample = (n) => { const a = nested(n); if (a.length > 2) { a.splice(1, 0, Object.assign(item(1), { asst: true })); } return a; };

const SIZES = [[800, 450], [300, 600], [1000, 200]];
const HIER = new Set(['orgChart', 'hierarchy', 'horizontalHierarchy', 'hierarchyList']);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/* ---------- vormen controleren ---------- */
const bbox = (s) => {
  if (!s.rot) return [s.x, s.y, s.x + s.w, s.y + s.h];
  const a = (s.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const hw = (s.w * c + s.h * sn) / 2, hh = (s.w * sn + s.h * c) / 2;
  return [cx - hw, cy - hh, cx + hw, cy + hh];
};
const checkShapes = (tag, def, items, shapes, w, h) => {
  ok(Array.isArray(shapes) && shapes.length > 0, `${tag}: geen vormen`);
  if (!Array.isArray(shapes)) return;
  const seen = new Set();
  shapes.forEach((s, k) => {
    const t = `${tag} #${k} ${s.role}/${s.geom}`;
    ok(['node', 'connector', 'deco'].includes(s.role), `${t}: onbekende rol`);
    ok(typeof s.geom === 'string' && s.geom, `${t}: geen geom`);
    ['x', 'y', 'w', 'h'].forEach((f) => ok(num(s[f]), `${t}: ${f} = ${s[f]}`));
    ok(s.w >= 0 && s.h >= 0, `${t}: negatieve maat`);
    ['rot', 'lineW', 'alpha', 'sz'].forEach((f) => { if (s[f] !== undefined) ok(num(s[f]), `${t}: ${f} = ${s[f]}`); });
    if (s.adj) Object.entries(s.adj).forEach(([k2, v]) => ok(num(v) && Number.isInteger(v), `${t}: adj.${k2} = ${v}`));
    if (s.ins) Object.entries(s.ins).forEach(([k2, v]) => ok(num(v) && v >= 0, `${t}: ins.${k2} = ${v}`));
    if (s.pts) s.pts.forEach((p) => ok(num(p[0]) && num(p[1]), `${t}: pts NaN`));
    // binnen de grenzen: knopen ±1 px, overige vormen ±2 px
    const b = bbox(s), tol = s.role === 'node' ? 1 : 2;
    ok(b[0] >= -tol && b[1] >= -tol && b[2] <= w + tol && b[3] <= h + tol, `${t}: buiten de grenzen [${b.map((v) => v.toFixed(1))}] in ${w}×${h}`);
    if (s.text) {
      ok(Array.isArray(s.text) && s.text.length, `${t}: lege tekst`);
      ok(num(s.sz) && s.sz >= 8 && s.sz <= 40, `${t}: sz = ${s.sz}`);
      ok(s.ins && num(s.ins.l), `${t}: geen ins`);
      ok(['ctr', 'l'].includes(s.align) && ['t', 'ctr', 'b'].includes(s.vAlign), `${t}: uitlijning ${s.align}/${s.vAlign}`);
      s.text.forEach((p) => {
        ok(typeof p.t === 'string' && p.t.length, `${t}: alinea zonder tekst`);
        ok(p.lvl === 0 || p.lvl === 1, `${t}: alinea-niveau ${p.lvl}`);
        ok(num(p.sz) && p.sz >= 8 && p.sz <= 40, `${t}: alinea sz = ${p.sz}`);
        if (p.id) seen.add(p.id);
      });
    }
    if (s.itemId) seen.add(s.itemId);
    ['fill', 'line', 'color'].forEach((f) => { if (s[f] != null) ok(/^(#[0-9a-f]{6}|(accent[1-6]|tx1|tx2|bg1|bg2|lt1|lt2|dk1|dk2)(\/[ld]\d{1,3})?)$/.test(s[f]), `${t}: kleur ${f} = ${s[f]}`); });
  });
  // elk item komt in het diagram terug (als vorm of als alinea)
  items.forEach((it) => ok(seen.has(it.id), `${tag}: item ${it.id} (niveau ${it.lvl}) ontbreekt`));
  // geen overlap tussen knopen van verschillende items (behalve waar de indeling dat bewust doet)
  if (!def.ov) {
    // tekstvakken op een vorm (label) liggen binnen die vorm en tellen niet mee; twee cirkels: echte afstand
    const nodes = shapes.filter((s) => s.role === 'node' && !s.label);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], c = nodes[j];
      if (a.itemId && a.itemId === c.itemId) continue;
      if (a.geom === 'ellipse' && c.geom === 'ellipse' && Math.abs(a.w - a.h) < 0.5 && Math.abs(c.w - c.h) < 0.5) {
        const dist = Math.hypot(a.x + a.w / 2 - c.x - c.w / 2, a.y + a.h / 2 - c.y - c.h / 2);
        ok(dist >= (a.w + c.w) / 2 - 1.5, `${tag}: cirkels ${a.itemId} en ${c.itemId} overlappen (${dist.toFixed(1)} < ${((a.w + c.w) / 2).toFixed(1)})`);
        continue;
      }
      const A = bbox(a), B = bbox(c), ix = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), iy = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
      if (ix <= 1.5 || iy <= 1.5) continue;
      const small = Math.min(a.w * a.h, c.w * c.h) || 1;
      ok((ix * iy) / small <= 0.02, `${tag}: knopen ${a.itemId} en ${c.itemId} overlappen ${((100 * ix * iy) / small).toFixed(0)}%`);
    }
  }
};

/* ---------- alle indelingen ---------- */
ok(D.LAYOUTS.length >= 30, `maar ${D.LAYOUTS.length} indelingen`);
const catIds = new Set(D.CATS.map((c) => c.id));
const t0 = Date.now();
let calls = 0;
D.LAYOUTS.forEach((def) => {
  ok(def.id && def.name && def.desc && catIds.has(def.cat), `${def.id}: onvolledige beschrijving`);
  ok(/^<svg[^>]*viewBox="0 0 48 36"/.test(def.icon) && def.icon.length > 80 && !/NaN/.test(def.icon), `${def.id}: pictogram ontbreekt of bevat NaN`);
  const smp = D.sample(def.id);
  ok(Array.isArray(smp) && smp.length >= 1 && smp[0].lvl === 0 && smp.every((it) => it.id && it.text === ''), `${def.id}: sample ongeldig`);
  const sets = [['sample', smp]];
  [1, 3, 7, 12].forEach((n) => { sets.push(['plat ' + n, flat(n)]); sets.push(['subitems ' + n, withKids(n)]); });
  if (HIER.has(def.id) || ['basicRadial', 'convergingRadial', 'titledMatrix'].includes(def.id)) {
    [5, 12, 20, 30].forEach((n) => sets.push(['boom ' + n, nested(n)]));
    sets.push(['bos 30', nested(30, 3)]);
    if (def.id === 'orgChart') [6, 15, 30].forEach((n) => sets.push(['organigram ' + n, orgSample(n)]));
  }
  sets.forEach(([name, items], si) => SIZES.forEach(([w, h], zi) => {
    const color = D.COLORS[(si + zi) % D.COLORS.length].id, look = D.LOOKS[(si + 2 * zi) % D.LOOKS.length].id;
    const dia = { layout: def.id, items, color, look }, tag = `${def.id} [${name}] ${w}×${h} ${color}/${look}`;
    let shapes;
    try { shapes = D.layout(dia, w, h); calls++; } catch (e) { fail(`${tag}: fout ${e.stack.split('\n').slice(0, 2).join(' ')}`); return; }
    checkShapes(tag, def, items, shapes, w, h);
    // eigen meetfunctie (zoals canvas.measureText) en hetzelfde resultaat bij opnieuw berekenen
    if (zi === 0 && si % 3 === 0) {
      const m = D.layout(dia, w, h, { measure: (t, sz, b) => t.length * sz * 0.62 * (b ? 1.05 : 1) });
      checkShapes(tag + ' (measure)', def, items, m, w, h);
      ok(JSON.stringify(D.layout(dia, w, h)) === JSON.stringify(shapes), `${tag}: niet hetzelfde bij opnieuw berekenen`);
    }
  }));
});
const ms = Date.now() - t0;
ok(ms / calls < 25, `te traag: ${(ms / calls).toFixed(1)} ms per diagram`);

/* ---------- randgevallen ---------- */
ok(D.layout({ layout: 'basicBlockList', items: [] }, 800, 450).length === 0, 'lege lijst geeft vormen');
ok(D.layout({ layout: 'basicBlockList', items: flat(3) }, 0, 450).length === 0, 'breedte 0 geeft vormen');
ok(D.layout({ layout: 'basicBlockList', items: flat(3) }, NaN, 450).length === 0, 'NaN-breedte geeft vormen');
ok(D.layout(null, 800, 450).length === 0, 'geen diagram geeft vormen');
const odd = [item(2, 'te diep'), item(0, 'a'), item(5, 'sprong'), { id: 'x1', lvl: 'x', text: null }, null];
checkShapes('onbekende indeling', {}, odd.filter(Boolean), D.layout({ layout: 'bestaatNiet', items: odd }, 640, 360), 640, 360);
const tiny = flat(4);
checkShapes('heel klein', {}, tiny, D.layout({ layout: 'basicCycle', items: tiny }, 40, 30), 40, 30);
ok(D.layout({ type: 'diagram', w: 400, h: 300, dia: { layout: 'basicProcess', items: flat(3) } }).length > 0, 'heel object als invoer');

/* ---------- overzicht bewerken ---------- */
const valid = (a, tag) => {
  ok(Array.isArray(a), `${tag}: geen lijst`);
  const ids = new Set();
  a.forEach((it, i) => {
    ok(it.id && !ids.has(it.id), `${tag}: id dubbel of leeg op ${i}`);
    ids.add(it.id);
    ok(Number.isInteger(it.lvl) && it.lvl >= 0 && it.lvl <= (i ? a[i - 1].lvl + 1 : 0), `${tag}: ongeldig niveau ${it.lvl} op ${i}`);
    ok(typeof it.text === 'string', `${tag}: tekst geen string op ${i}`);
  });
};
const paras = [{ runs: [{ t: 'Een' }], lvl: 1 }, { runs: [{ t: '' }], lvl: 1 }, { runs: [{ t: 'Twee' }, { t: ' delen' }], lvl: 2 }, { runs: [{ t: 'Drie' }], lvl: 4 }, { runs: [{ t: '   ' }] }, { runs: [{ t: 'Vier' }], lvl: 1 }];
const fp = D.fromParas(paras);
valid(fp, 'fromParas');
ok(JSON.stringify(fp.map((i) => [i.text, i.lvl])) === JSON.stringify([['Een', 0], ['Twee delen', 1], ['Drie', 2], ['Vier', 0]]), 'fromParas: ' + JSON.stringify(fp.map((i) => [i.text, i.lvl])));
const tree30 = nested(30, 2);
const back = D.fromParas(D.toParas(tree30));
ok(JSON.stringify(back.map((i) => [i.text, i.lvl])) === JSON.stringify(tree30.filter((i) => i.text.trim()).map((i) => [i.text, i.lvl])) || tree30.some((i) => !i.text.trim()), 'toParas → fromParas: niet gelijk');
const full = tree30.map((i, k) => Object.assign({}, i, { text: 'T' + k }));
const rt = D.fromParas(D.toParas(full));
ok(JSON.stringify(rt.map((i) => [i.text, i.lvl])) === JSON.stringify(full.map((i) => [i.text, i.lvl])), 'heen en terug: niet gelijk');
D.toParas(full).forEach((p, k) => ok(p.runs[0].t === 'T' + k && p.lvl === full[k].lvl && p.bullet && p.bullet.type === 'char', `toParas: alinea ${k}`));

// gerichte gevallen
let a = [item(0, 'A'), item(1, 'A1'), item(0, 'B')];
const [A, A1, B] = a;
let r = D.addItem(a, A.id, 'after');
ok(r.map((i) => i.text).join(',') === 'A,A1,,B' && r[2].lvl === 0 && r.newId === r[2].id, 'addItem after: ' + r.map((i) => i.text + i.lvl).join(','));
r = D.addItem(a, A.id, 'before'); ok(r[0].text === '' && r[0].lvl === 0 && r[1].id === A.id, 'addItem before');
r = D.addItem(a, A.id, 'below'); ok(r[2].text === '' && r[2].lvl === 1 && r[3].id === B.id, 'addItem below');
r = D.addItem(a, A.id, 'above'); ok(r[0].lvl === 0 && r[1].id === A.id && r[1].lvl === 1 && r[2].lvl === 2, 'addItem above: ' + r.map((i) => i.text + i.lvl).join(','));
r = D.addItem(a, A.id, 'assistant'); ok(r[1].asst === true && r[1].lvl === 1 && r[2].id === A1.id, 'addItem assistant');
r = D.addItem(a, 'onbekend'); ok(r.length === 4 && r[3].lvl === 0, 'addItem zonder geldig item');
r = D.promote(a, A1.id); ok(r[1].lvl === 0, 'promote');
r = D.promote(a, A.id); ok(r[0].lvl === 0, 'promote op niveau 0');
r = D.demote(a, B.id); ok(r[2].lvl === 1, 'demote');
r = D.demote(a, A.id); ok(r[0].lvl === 0, 'demote eerste item');
r = D.move(a, B.id, -1); ok(r.map((i) => i.text).join(',') === 'B,A,A1', 'move omhoog met subitems: ' + r.map((i) => i.text).join(','));
r = D.move(a, A.id, 'down'); ok(r.map((i) => i.text).join(',') === 'B,A,A1', 'move omlaag met subitems');
r = D.move(a, A1.id, 1); ok(r.map((i) => i.text).join(',') === 'A,A1,B', 'move zonder broer');
ok(a.map((i) => i.text).join(',') === 'A,A1,B', 'invoer is aangepast');
// willekeurige reeks bewerkingen
a = nested(8);
for (let k = 0; k < 400; k++) {
  const op = Math.floor(rnd() * 5), id = a.length ? a[Math.floor(rnd() * a.length)].id : null;
  if (op === 0) a = D.addItem(a, id, ['after', 'before', 'above', 'below', 'assistant'][Math.floor(rnd() * 5)]);
  else if (op === 1) a = D.promote(a, id);
  else if (op === 2) a = D.demote(a, id);
  else if (op === 3) a = D.move(a, id, rnd() < 0.5 ? -1 : 1);
  else if (a.length > 3) a = a.filter((i) => i.id !== id);
  a = D.normalize(a);
  valid(a, 'bewerking ' + k);
  if (a.length > 40) a = a.slice(0, 20);
}
checkShapes('na bewerkingen', D.byId('orgChart'), a, D.layout({ layout: 'orgChart', items: a }, 960, 540), 960, 540);

/* ---------- woordenlijst ---------- */
const dict = window.KANTOOR_DICT || {};
const nl = [].concat(D.CATS.map((c) => c.name), D.LAYOUTS.map((l) => l.name), D.LAYOUTS.map((l) => l.desc), D.COLORS.map((c) => c.name), D.LOOKS.map((l) => l.name), ['[Tekst]']);
nl.forEach((s) => ok(typeof dict[s] === 'string' && dict[s].length, `geen Engelse vertaling voor "${s}"`));
ok(new Set(D.LAYOUTS.map((l) => l.id)).size === D.LAYOUTS.length, 'dubbele indeling-id');

/* ---------- uitslag ---------- */
console.log(`${D.LAYOUTS.length} indelingen, ${calls} diagrammen in ${ms} ms (${(ms / calls).toFixed(2)} ms per diagram), ${checks} controles`);
if (fails) { console.log(`${fails} MISLUKT:`); failMsgs.forEach((m) => console.log('  ✗ ' + m)); process.exit(1); }
console.log('Alles geslaagd.');
