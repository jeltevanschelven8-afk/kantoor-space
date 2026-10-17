/* Doek — tests voor js/charts.js in node: regressie, schalen, getalnotatie, tekenen van alle soorten en randgevallen.
   Uitvoeren: node doek/test/charts-node.js (exitcode 1 bij een fout) */
'use strict';
global.window = global;
global.App = {};
require('../js/lang/en-charts.js');
require('../js/charts.js');
const C = App.Charts, DICT = window.KANTOOR_DICT;
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FOUT:', msg); } };
const near = (a, b, tol, msg) => ok(Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

/* ---------- regressie ---------- */
const X6 = [1, 2, 3, 4, 5, 6];
let r = C.trend(X6, X6.map((x) => 2.1 * x + 3.5), { type: 'linear', locale: 'nl' });
near(r.b, 2.1, 1e-12, 'lineair helling'); near(r.a, 3.5, 1e-12, 'lineair snijpunt'); near(r.r2, 1, 1e-12, 'lineair R²');
eq(r.eq, 'y = 2,1x + 3,5', 'lineair vergelijking nl');
eq(C.trend(X6, X6.map((x) => 2.1 * x + 3.5), { type: 'linear', locale: 'en' }).eq, 'y = 2.1x + 3.5', 'lineair vergelijking en');
eq(C.trend(X6, X6.map((x) => -2 * x + 1), { locale: 'en' }).eq, 'y = -2x + 1', 'lineair negatief');
eq(C.trend(X6, X6.map((x) => x - 4), { locale: 'en' }).eq, 'y = x - 4', 'coëfficiënt 1 weggelaten');
r = C.trend([1, 2, 3, 4, 5], [2, 4, 5, 4, 5], { type: 'linear' });
near(r.b, 0.6, 1e-12, 'ruis helling'); near(r.a, 2.2, 1e-12, 'ruis snijpunt'); near(r.r2, 0.6, 1e-12, 'ruis R²');
r = C.trend(X6, X6.map((x) => 2 * Math.exp(0.5 * x)), { type: 'exp', locale: 'nl' });
near(r.a, 2, 1e-10, 'exp a'); near(r.b, 0.5, 1e-10, 'exp b'); near(r.r2, 1, 1e-10, 'exp R²'); eq(r.eq, 'y = 2e^0,5x', 'exp vergelijking');
near(r.f(8), 2 * Math.exp(4), 1e-9, 'exp voorspelling');
r = C.trend(X6, X6.map((x) => 0.5 * x * x + 2 * x + 1), { type: 'poly', order: 2, locale: 'nl' });
near(r.coef[2], 0.5, 1e-9, 'poly x²'); near(r.coef[1], 2, 1e-9, 'poly x'); near(r.coef[0], 1, 1e-9, 'poly c'); near(r.r2, 1, 1e-12, 'poly R²');
eq(r.eq, 'y = 0,5x^2 + 2x + 1', 'poly vergelijking');
eq(C.trend(X6, X6.map((x) => x ** 3 - 2 * x), { type: 'poly', order: 3, locale: 'en' }).eq, 'y = x^3 - 2x', 'poly orde 3');
r = C.trend([0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6].map((x) => x ** 6 - 3 * x ** 2 + 1), { type: 'poly', order: 6 });
ok(r.ok && Math.abs(r.r2 - 1) < 1e-9 && Math.abs(r.f(7) - (7 ** 6 - 3 * 49 + 1)) < 1e-3, 'poly orde 6 exact');
r = C.trend([2000, 2001, 2002, 2003, 2004, 2005], [0, 1, 4, 9, 16, 25], { type: 'poly', order: 2 });
near(r.f(2010), 100, 1e-6, 'poly met jaartallen stabiel');
r = C.trend(X6, X6.map((x) => 3 * x * x), { type: 'power', locale: 'nl' });
near(r.a, 3, 1e-10, 'macht a'); near(r.b, 2, 1e-10, 'macht b'); near(r.r2, 1, 1e-10, 'macht R²'); eq(r.eq, 'y = 3x^2', 'macht vergelijking');
r = C.trend(X6, X6.map((x) => 2.1 * Math.log(x) + 3.5), { type: 'log', locale: 'nl' });
near(r.b, 2.1, 1e-10, 'log b'); near(r.a, 3.5, 1e-10, 'log a'); eq(r.eq, 'y = 2,1ln(x) + 3,5', 'log vergelijking');
r = C.trend(X6, [1, 3, 5, 7, 9, 11], { type: 'movavg', period: 3 });
eq(r.pts, [[3, 3], [4, 5], [5, 7], [6, 9]], 'zwevend gemiddelde'); near(r.f(3.5), 4, 1e-12, 'zwevend gemiddelde tussenwaarde');
ok(!C.trend([1], [2]).ok, 'één punt: geen trend'); ok(!C.trend([2, 2, 2], [1, 2, 3]).ok, 'gelijke x: geen trend');
ok(!C.trend([1, 2], [-1, -2], { type: 'exp' }).ok, 'exp zonder positieve y'); ok(!C.trend([1, 2], [1, 2], { type: 'poly', order: 3 }).ok, 'poly te weinig punten');
ok(C.trend([1, null, 3, 'x', 5], [2, 4, null, 8, 10]).ok, 'trend slaat lege waarden over');

/* ---------- schalen ---------- */
eq(C.niceScale(0, 5.25), { min: 0, max: 6, step: 1 }, 'schaal 0–5,25');
eq(C.niceScale(0, 1e9), { min: 0, max: 1e9, step: 2e8 }, 'schaal 1e9');
eq(C.niceScale(-3, 7), { min: -4, max: 8, step: 2 }, 'schaal negatief');
eq(C.niceScale(0, 0), { min: 0, max: 1, step: 0.2 }, 'schaal nul');
eq(C.niceScale(5, 5), { min: 0, max: 5, step: 1 }, 'schaal één waarde');
eq(C.niceScale(-5, -5), { min: -5, max: 0, step: 1 }, 'schaal één negatieve waarde');
eq(C.niceScale(10, 0), { min: 0, max: 10, step: 2 }, 'schaal omgedraaid');
eq(C.niceScale(0, 1, 10), { min: 0, max: 1, step: 0.1 }, 'schaal 10 stappen');
[[0.0001, 0.00035], [-1e300, 1e300], [123456, 123789], [-0.5, 0.25], [1e-12, 5e-12], [NaN, Infinity], [3, 97, 4], [-1234.5, -2]].forEach(([a, b, m]) => {
  const s = C.niceScale(a, b, m), n = (s.max - s.min) / s.step;
  ok([s.min, s.max, s.step].every(Number.isFinite) && s.step > 0 && n <= (m || 6) + 1e-9 && Math.abs(n - Math.round(n)) < 1e-6, `schaal ${a}..${b} → ${JSON.stringify(s)}`);
  if (Number.isFinite(a) && Number.isFinite(b)) ok(s.min <= Math.min(a, b) + 1e-12 * Math.abs(a) && s.max >= Math.max(a, b) - 1e-12 * Math.abs(b), `schaal omvat ${a}..${b}`);
});

/* ---------- getalnotatie en getallen lezen ---------- */
[[4.3, undefined, 'nl', '4,3'], [4.3, 'General', 'en', '4.3'], [1234.5, '0', 'nl', '1235'], [4.25, '0.0', 'nl', '4,3'], [1.005, '0.00', 'en', '1.01'],
  [0.256, '0%', 'nl', '26%'], [0.256, '0.0%', 'en', '25.6%'], [1234567.891, '#,##0', 'nl', '1.234.568'], [1234567.891, '#,##0', 'en', '1,234,568'],
  [1234.5, '#,##0.00', 'nl', '1.234,50'], [1234.5, '#,##0.00', 'en', '1,234.50'], [1234, '€ #,##0', 'nl', '€ 1.234'], [-1234.567, '€ #,##0.00', 'nl', '-€ 1.234,57'],
  [1234, '$#,##0', 'en', '$1,234'], [-0.001, '0', 'en', '0'], [0, '0.00', 'nl', '0,00'], [1e15, undefined, 'en', '1E+15'], [123456789012, 'General', 'nl', '1,23457E+11'],
  [1 / 3, undefined, 'nl', '0,3333333333'], [12345.678, '0.00E+00', 'en', '1.23E+04'], [1234567, '#,##0,"k"', 'en', '1,235k'], [null, '0', 'nl', ''], [NaN, '0', 'nl', '']]
  .forEach(([v, f, l, want]) => eq(C.fmt(v, f, l), want, `fmt(${v}, ${f}, ${l})`));
[['1.234,5', 'nl', 1234.5], ['1,234.5', 'en', 1234.5], ['4,3', 'nl', 4.3], ['4,3', 'en', 4.3], ['1.234', 'nl', 1234], ['1,234', 'en', 1234], ['0.125', 'nl', 0.125],
  ['€ 1.234,56', 'nl', 1234.56], ['12%', 'en', 0.12], ['(1.234)', 'nl', -1234], ['-€ 2,5', 'nl', -2.5], ['1,5E+3', 'nl', 1500], ['1 234 567', 'en', 1234567], ['abc', 'nl', null], ['', 'nl', null], ['1-1-2024', 'nl', null]]
  .forEach(([s, l, want]) => eq(C.parseNum(s, l), want, `parseNum(${s}, ${l})`));

/* ---------- tekenen ---------- */
const PAL = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948'];
const resolve = (ref) => { const m = /^accent([1-6])/.exec(ref); return m ? PAL[m[1] - 1] : /^#/.test(ref) ? ref : ref === 'tx1' ? '#262626' : '#ffffff'; };
const LIGHT = { color: resolve, palette: PAL, font: 'Inter', text: '#404040', grid: '#d9d9d9', axis: '#bfbfbf', bg: null, scale: 1, locale: 'nl' };
const DARK = Object.assign({}, LIGHT, { text: '#e8e8e8', grid: '#4a4a4a', axis: '#6b6b6b', bg: '#1e1e1e', locale: 'en' });
const xmlCheck = (s) => {   // kleine controle op goedgevormde XML: tags in balans, attributen en entiteiten geldig
  const st = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '<') {
      const j = s.indexOf('>', i);
      if (j < 0) return 'tag niet gesloten';
      const tag = s.slice(i + 1, j);
      let m;
      if ((m = /^\/([a-zA-Z][\w:-]*)$/.exec(tag))) { const top = st.pop(); if (top !== m[1]) return `sluit ${m[1]} maar open is ${top}`; }
      else if ((m = /^([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)$/.exec(tag))) {
        const seen = new Set();
        for (const [, n, v] of m[2].matchAll(/([\w:-]+)="([^"]*)"/g)) { if (seen.has(n)) return 'dubbel attribuut ' + n; seen.add(n); if (/&(?!(amp|lt|gt|quot|#39);)/.test(v)) return 'ongeldige entiteit'; }
        if (!m[3]) st.push(m[1]);
      } else return 'ongeldige tag: ' + tag.slice(0, 80);
      i = j + 1;
    } else {
      const j = s.indexOf('<', i), t = s.slice(i, j < 0 ? s.length : j);
      if (/&(?!(amp|lt|gt|quot|#39);)/.test(t)) return 'ongeldige entiteit in tekst';
      i = j < 0 ? s.length : j;
    }
  }
  return st.length ? 'niet gesloten: ' + st.join(',') : '';
};
const check = (chart, w, h, ctx, name) => {
  let s;
  try { s = C.render(chart, w, h, ctx); } catch (e) { ok(false, `${name}: gooit ${e.message}`); return ''; }
  ok(typeof s === 'string' && s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && s.endsWith('</svg>'), `${name}: geen svg`);
  const bad = /NaN|undefined|Infinity|\bnull\b|\[object/.exec(s);
  ok(!bad, `${name}: bevat ${bad && bad[0]}`);
  ok(!s.includes('data-error'), `${name}: foutmelding getekend`);
  const x = xmlCheck(s);
  ok(!x, `${name}: XML ${x}`);
  return s;
};
C.KINDS.forEach((k) => {
  ok(k.name && k.kind && /^<svg[^>]+viewBox="0 0 24 24"[^>]*>/.test(k.icon) && !xmlCheck(k.icon) && k.icon.includes('currentColor'), `${k.id}: pictogram`);
  const ch = C.sample(k);
  [LIGHT, DARK].forEach((ctx, d) => {
    const s = check(ch, 420, 260, ctx, `${k.id}${d ? ' donker' : ''}`);
    const n = (s.match(/data-series="/g) || []).length;
    ok(n === (k.kind === 'pie' ? 1 : ch.series.length) || (k.kind === 'doughnut' && n === ch.series.length), `${k.id}: data-series ${n}`);
  });
  eq(C.kindOf(ch) && C.kindOf(ch).id, k.id, `${k.id}: kindOf(sample)`);
  ok(C.CATS.some((c) => c.id === k.cat), `${k.id}: groep bestaat`);
});
const cats50 = Array.from({ length: 50 }, (_, i) => 'Categorie ' + (i + 1));
global.LAYOUT_LATER = [];   // randgevallen: indeling pas controleren als de controlefunctie bestaat
const EDGE = {
  'geen reeksen': { series: [] }, 'lege reeks': { series: [{ name: 'Leeg', vals: [] }] }, 'alles leeg': { series: [{ vals: [null, null, null] }, { vals: [] }] },
  'één punt': { cats: ['A'], series: [{ vals: [3] }] }, negatief: { series: [{ vals: [-4, -2.5, -8, -1] }, { vals: [-1, -3, -2, -6] }] },
  gemengd: { series: [{ vals: [-4, 2.5, -1, 6] }, { vals: [3, -3, 2, -6] }] }, nullen: { series: [{ vals: [0, 0, 0, 0] }] },
  miljard: { series: [{ vals: [1e9, 2.5e9, 7e8, 3.3e9] }, { vals: [5e8, 1e9, 2e9, 4e9] }] }, reuzen: { series: [{ vals: [1e300, -1e300, 5e299] }] },
  piepklein: { series: [{ vals: [1e-12, 3e-12, 2.5e-12] }] }, '50 categorieën': { cats: cats50, series: [{ vals: cats50.map((_, i) => Math.sin(i / 4) * 10 + 12) }, { vals: cats50.map((_, i) => i % 7) }] },
  gaten: { series: [{ vals: [1, null, 3, null, null, 6, 2] }, { vals: [null, 2, 2, 5] }] }, tekst: { cats: [1, null, '<b>&"\''], series: [{ name: '<script>', vals: ['4,5', 'x', '1e3'] }] },
};
const KINDS0 = ['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'bubble', 'radar', 'combo'];
KINDS0.forEach((kind) => {
  Object.entries(EDGE).forEach(([name, e]) => {
    const ch = Object.assign(C.sample(kind), e, { kind });
    if ((kind === 'scatter' || kind === 'bubble') && e.series) ch.series = e.series.map((s) => Object.assign({}, s, { xs: s.vals.map((_, i) => i * 1.5 - 2), sizes: s.vals.map((_, i) => i + 1) }));
    ['clustered', 'stacked', 'percent'].forEach((sub) => { const nm = `${kind}/${sub}/${name}`, s = check(Object.assign({}, ch, { sub, labels: { on: true, cat: name === 'gaten' } }), 420, 260, LIGHT, nm); if (s) global.LAYOUT_LATER.push([nm, s]); });
  });
  check(C.sample(kind), 60, 40, LIGHT, `${kind} piepklein vak`);
  check(C.sample(kind), 1600, 900, Object.assign({}, LIGHT, { scale: 2 }), `${kind} groot vak`);
  for (let st = 1; st <= 8; st++) check(Object.assign(C.sample(kind), { style: st, palette: ['theme', 'colorful2', 'colorful3', 'colorful4', 'mono1', 'mono3', 'mono6', 'x'][st - 1] }), 420, 260, LIGHT, `${kind} stijl ${st}`);
  ['r', 'l', 't', 'b', 'none'].forEach((lg) => check(Object.assign(C.sample(kind), { legend: lg, labels: { on: true, val: true, cat: true, ser: true, pct: true } }), 420, 260, DARK, `${kind} legenda ${lg}`));
  ['out', 'in', 'ctr', 'base', 'best'].forEach((pos) => check(Object.assign(C.sample(kind), { labels: { on: true, pos } }), 420, 260, LIGHT, `${kind} labels ${pos}`));
});
['linear', 'exp', 'log', 'poly', 'power', 'movavg'].forEach((type) => ['column', 'line', 'scatter', 'bubble', 'bar'].forEach((kind) => {
  const ch = C.sample(kind);
  ch.series.forEach((s) => { s.trend = { type, order: 3, period: 2, eq: true, r2: true, fwd: 2, back: 0.5 }; });
  const s = check(ch, 520, 320, LIGHT, `trend ${type} op ${kind}`);
  ok(s.includes('class="trend"'), `trend ${type} op ${kind}: lijn getekend`);
}));
const many = C.sample('column');
many.series = Array.from({ length: 14 }, (_, i) => ({ name: 'Reeks met een lange naam ' + (i + 1), vals: [i, i + 1, 2, 3] }));
const ms = check(many, 640, 360, LIGHT, '14 reeksen');
ok(new Set((ms.match(/fill="#[0-9a-f]{6}"/g) || [])).size >= 12, '14 reeksen: kleuren na zes varianten');
check(Object.assign(C.sample('line'), { axes: { val: { log: true, title: 'Waarde' }, cat: { title: 'Categorie', rev: true, grid: true } } }), 420, 260, LIGHT, 'log-as');
check(Object.assign(C.sample('column'), { axes: { val: { min: 1, max: 4, major: 0.5, fmt: '€ #,##0.00', title: true } } }), 420, 260, LIGHT, 'eigen grenzen');
check(Object.assign(C.sample('combo', 'colLine2'), { axes: { val2: { title: 'Rechts', fmt: '0%' } } }), 420, 260, LIGHT, 'secundaire as');
check(Object.assign(C.sample('pie'), { firstAng: 90, series: [{ name: 'V', vals: [5, 0, 1e-9, 3, -2], explode: [0.2, 0, 0, 0.5, 0.1], labels: true }] }), 420, 260, LIGHT, 'cirkel uitgelicht');
check(Object.assign(C.sample('pie'), { series: [{ vals: [7] }] }), 420, 260, LIGHT, 'cirkel één punt');
check(Object.assign(C.sample('doughnut'), { hole: 75, series: [{ vals: [1, 2, 3] }, { vals: [3, 2, 1] }, { vals: [0, 0, 5] }] }), 420, 260, LIGHT, 'ring met drie ringen');
['x', null, undefined, 42, [], { kind: 'onbekend', series: 'x', cats: 5, axes: 3, labels: 'ja', title: 'x' }].forEach((v, i) => check(v, 300, 200, i % 2 ? undefined : LIGHT, `onzin ${i}`));
check(C.sample('column'), -5, NaN, LIGHT, 'onzinmaten');
const big = { kind: 'line', cats: [], series: [{ vals: Array.from({ length: 4000 }, (_, i) => Math.sin(i / 50)) }] };
const t0 = Date.now();
check(big, 800, 400, LIGHT, '4000 punten');
ok(Date.now() - t0 < 1500, '4000 punten snel genoeg');

/* ---------- indeling: teksten overlappen niet en vallen niet buiten de grafiek ---------- */
const boxes = (svg) => [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" font-size="([\d.]+)"[^>]*?(?: text-anchor="(\w+)")?(?: font-weight="(\d+)")?(?: transform="rotate\(([-\d.]+)[^"]*")?>(.*?)<\/text>/g)]
  .map(([, x, y, s, an, wt, rot, body]) => {
    const size = +s, t = body.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, 'x'), w = C.textWidth(t, size) * (wt ? 1.05 : 1);
    const l = an === 'middle' ? +x - w / 2 : an === 'end' ? +x - w : +x;
    return { t, rot: +rot || 0, x0: l, x1: l + w, y0: +y - size * 0.75, y1: +y + size * 0.22, ax: +x, ay: +y, w, size };
  });
const layout = (name, svg, W, H) => {
  const B = boxes(svg), flat = B.filter((b) => !b.rot && b.t.trim());
  flat.forEach((b) => ok(b.x0 >= -1 && b.x1 <= W + 1 && b.y0 >= -1 && b.y1 <= H + 1, `${name}: '${b.t}' valt buiten de grafiek (${b.x0.toFixed(1)}..${b.x1.toFixed(1)}, ${b.y0.toFixed(1)}..${b.y1.toFixed(1)})`));
  // schuin (−45° om het anker op de middellijn): links x − 0,707·w − 0,28·grootte, onder midden + 0,707·w + 0,40·grootte
  B.filter((b) => b.rot === -45).forEach((b) => ok(b.ax - b.w * 0.7071 - b.size * 0.283 >= -1 && b.ay - b.size * 0.35 + b.w * 0.7071 + b.size * 0.403 <= H + 1, `${name}: schuin label '${b.t}' valt buiten de grafiek`));
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) {
    const a = flat[i], b = flat[j], dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    ok(!(dx > 1.5 && dy > 1.5), `${name}: '${a.t}' overlapt '${b.t}'`);
  }
};
C.KINDS.forEach((k) => [[420, 260], [640, 360], [960, 540], [300, 200]].forEach(([w, h]) => layout(`${k.id} ${w}×${h}`, C.render(C.sample(k), w, h, LIGHT), w, h)));
global.LAYOUT_LATER.forEach(([nm, s]) => layout(nm, s, 420, 260));
['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter', 'bubble', 'radar', 'combo'].forEach((kind) => {
  ['r', 'l', 't'].forEach((lg) => layout(`${kind} legenda ${lg}`, C.render(Object.assign(C.sample(kind), { legend: lg }), 520, 320, LIGHT), 520, 320));
  layout(`${kind} labels`, C.render(Object.assign(C.sample(kind), { labels: { on: true } }), 640, 400, LIGHT), 640, 400);
  layout(`${kind} astitels`, C.render(Object.assign(C.sample(kind), { axes: { cat: { title: 'Horizontaal' }, val: { title: 'Verticaal' } } }), 520, 320, LIGHT), 520, 320);
  layout(`${kind} 50 categorieën`, C.render(Object.assign(C.sample(kind), { cats: cats50, series: [{ name: 'A', vals: cats50.map((_, i) => i % 9), xs: cats50.map((_, i) => i), sizes: cats50.map((_, i) => (i % 5) + 1) }] }), 640, 360, LIGHT), 640, 360);
});
// willekeurige grafieken (vaste zaadwaarde, dus herhaalbaar)
let seed = 20261016;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pickR = (a) => a[Math.floor(rnd() * a.length)];
const WORDS = ['Noord', 'Zuid', 'Q1', 'januari', 'Productlijn', 'A', 'Totaal 2026', 'Ééntje', 'kosten & baten', 'Gemiddelde temperatuur'];
for (let n = 0; n < 1000; n++) {
  const kind = pickR(KINDS0), nc = Math.floor(rnd() * (rnd() < 0.2 ? 60 : 9)), ns = Math.floor(rnd() * 7);
  const big = rnd() < 0.15 ? 1e9 : rnd() < 0.15 ? 1e-4 : 10, neg = rnd() < 0.3;
  const ch = {
    kind, sub: pickR(['clustered', 'stacked', 'percent', 'markers', 'smooth', 'filled', 'colLine2', undefined]),
    cats: Array.from({ length: nc }, () => pickR(WORDS) + (rnd() < 0.5 ? ' ' + Math.floor(rnd() * 100) : '')),
    series: Array.from({ length: ns }, (_, i) => ({ name: pickR(WORDS), axis: rnd() < 0.2 ? 2 : 1, kind: pickR(['column', 'line', 'area']), marker: pickR(['none', 'circle', 'square', 'diamond', 'triangle', 'auto', undefined]),
      vals: Array.from({ length: nc || 5 }, () => (rnd() < 0.1 ? null : (rnd() - (neg ? 0.5 : 0)) * big)), xs: Array.from({ length: nc || 5 }, () => rnd() * big), sizes: Array.from({ length: nc || 5 }, () => rnd() * 20),
      trend: rnd() < 0.2 ? { type: pickR(['linear', 'exp', 'log', 'poly', 'power', 'movavg']), eq: true, r2: true, fwd: rnd() < 0.5 ? 2 : 0 } : undefined, explode: [rnd() * 0.3] })),
    title: { on: rnd() < 0.7, text: rnd() < 0.5 ? '' : pickR(WORDS) + ' ' + pickR(WORDS) }, legend: pickR(['r', 'b', 't', 'l', 'none', undefined]),
    labels: { on: rnd() < 0.4, cat: rnd() < 0.2, pct: rnd() < 0.3, pos: pickR(['out', 'in', 'ctr', 'base', 'best', undefined]) },
    axes: { cat: { title: rnd() < 0.3 ? 'Categorie' : '', rev: rnd() < 0.2 }, val: { title: rnd() < 0.3 ? 'Waarde' : '', log: rnd() < 0.1 } },
    style: 1 + Math.floor(rnd() * 8), palette: pickR(['theme', 'colorful3', 'mono2']), hole: 20 + rnd() * 70, firstAng: rnd() * 360,
  };
  const w = Math.round(220 + rnd() * 1000), h = Math.round(160 + rnd() * 640), ctx = Object.assign({}, rnd() < 0.5 ? LIGHT : DARK, { scale: pickR([0.5, 0.75, 1, 1, 1.5, 2]) });
  const name = `toeval ${n} (${kind}, ${w}×${h}, ${nc} cat., ${ns} reeksen)`, s = check(ch, w, h, ctx, name);
  if (s) layout(name, s, w, h);
}
const one = C.render({ kind: 'line', cats: ['A'], series: [{ vals: [4] }] }, 400, 250, LIGHT);
ok(/>0<\/text>/.test(one), 'één waarde: as begint bij nul');
const none = C.render({ kind: 'column', cats: ['A', 'B'], series: [] }, 400, 250, LIGHT);
const ticks = [...none.matchAll(/text-anchor="end">([^<]+)</g)].map((m) => C.parseNum(m[1], 'nl'));
ok(Math.max(...ticks) === 1 && Math.min(...ticks) === 0, 'geen gegevens: as 0–1 ' + ticks);
const lab = C.render(Object.assign(C.sample('column'), { labels: { on: true } }), 500, 300, LIGHT);
ok(lab.indexOf('class="labels" data-series="0"') > lab.lastIndexOf('class="series" data-series="2"'), 'labels boven alle reeksen');
const lg14 = C.render(many, 640, 360, Object.assign({}, LIGHT)), lgR = C.render(Object.assign({}, many, { legend: 'r' }), 520, 360, LIGHT);
ok((lg14.match(/data-legend="/g) || []).length === 14 && (lgR.match(/data-legend="/g) || []).length === 14, 'legenda toont alle 14 reeksen');

/* ---------- tabel heen en terug ---------- */
const col = C.sample('column');
col.series[1].color = 'accent4'; col.series[2].trend = { type: 'linear' };
let tb = C.toTable(col);
eq(tb[0], ['', 'Reeks 1', 'Reeks 2', 'Reeks 3'], 'tabel kop'); eq(tb[1], ['Categorie 1', 4.3, 2.4, 2], 'tabel rij');
let back = C.fromTable(tb, col);
eq(back.series.map((s) => s.vals), col.series.map((s) => s.vals), 'tabel terug: waarden'); eq(back.cats, col.cats, 'tabel terug: categorieën');
ok(back.series[1].color === 'accent4' && back.series[2].trend.type === 'linear' && back.kind === 'column' && back.sub === 'clustered', 'tabel terug: opties blijven');
back = C.fromTable([['', 'A', '', 'C'], ['x', '1.234,5', 'tekst', ''], ['y', '', '7', '-2%'], ['', '', '', ''], ['', '', '', '']], col);
eq(back.series.map((s) => s.name), ['A', 'Reeks 2', 'C'], 'lege naam → standaardnaam');
eq(back.series.map((s) => s.vals), [[1234.5, null], [null, 7], [null, -0.02]], 'tekst en lege cellen → null');
eq(back.cats, ['x', 'y'], 'lege rijen aan het eind weg');
const sc = C.sample('scatter'), bu = C.sample('bubble');
eq(C.fromTable(C.toTable(sc), sc).series[0].xs, sc.series[0].xs, 'spreiding x heen en terug');
tb = C.toTable(bu);
eq(tb[0], ['X-waarden', 'Y-waarden', 'Grootte'], 'bellen kop');
back = C.fromTable(tb, bu);
eq([back.series[0].xs, back.series[0].vals, back.series[0].sizes], [bu.series[0].xs, bu.series[0].vals, bu.series[0].sizes], 'bellen heen en terug');
eq(C.parseTsv('a\tb\r\n"x\ty"\t"he ""zei"""\r\n'), [['a', 'b'], ['x\ty', 'he "zei"']], 'tabgescheiden plakken');
const cv = C.convert(col, 'scatterSmooth');
ok(cv.kind === 'scatter' && cv.sub === 'smooth' && cv.series.every((s) => s.xs.length === 4), 'omzetten naar spreiding');
ok(C.convert(cv, 'colClustered').cats.length === 4, 'omzetten terug naar kolom');
ok(C.convert(col, 'comboColLine2').series[2].axis === 2, 'omzetten naar combinatie');

/* ---------- vertaling ---------- */
const keys = new Set(Object.keys(DICT)), pat = (s) => keys.has(s) || [...keys].some((k) => /\{\d\}/.test(k) && new RegExp('^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\d\\\}/g, '.+?') + '$').test(s));
[...C.KINDS, ...C.CATS, ...C.TRENDS, ...C.STYLES, ...C.PALETTES, ...C.FORMATS].forEach((k) => ok(pat(k.name), `woordenboek mist '${k.name}'`));
['Categorie 1', 'Reeks 2', 'Grafiektitel', 'Astitel', 'X-waarden', 'Lineair (Reeks 1)', '3 per. zw. gem. (Reeks 1)', 'Grafiekgegevens bewerken'].forEach((s) => ok(pat(s), `woordenboek mist '${s}'`));
// elke T('…') en T(`…${x}…`) in de broncode, en de teksten van de knoppen en uitleg in de gegevenseditor
const SRC = require('fs').readFileSync(require('path').join(__dirname, '../js/charts.js'), 'utf8');
const lits = [...SRC.matchAll(/\bT\('((?:[^'\\]|\\.)+)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"))
  .concat([...SRC.matchAll(/\bT\(`([^`]+)`\)/g)].map((m) => { let k = 0; return m[1].replace(/\$\{[^}]+\}/g, () => `{${k++}}`); }))
  .concat([...SRC.matchAll(/B\('[^']+', '[^']+', '([^']+)', '([^']+)'\)/g)].flatMap((m) => [m[1], m[2]]))
  .concat([...SRC.matchAll(/'((?:Kolom A|Rij 1|Plak gegevens)[^']+)'/g)].map((m) => m[1]));
ok(lits.length > 30, 'teksten in de broncode gevonden: ' + lits.length);
lits.filter((s) => s !== '{0} ({1})').forEach((s) => ok(keys.has(s) || pat(s.replace(/\{\d\}/g, 'x')), `woordenboek mist '${s}' (uit charts.js)`));
C.TRENDS.filter((t) => t.type !== 'movavg').forEach((t) => ok(pat(`${t.name} (Reeks 1)`), `woordenboek mist '${t.name} ({0})'`));   // samengesteld: naam + reeks
App.t = (s) => { if (DICT[s] !== undefined) return DICT[s]; for (const k of keys) { if (!/\{\d\}/.test(k)) continue; const re = new RegExp('^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d)\\\}/g, '(.*?)') + '$'), m = re.exec(s); if (m) return DICT[k].replace(/\{(\d)\}/g, (_, d) => m[+d + 1]); } return s; };
const en = C.sample('column');
eq([en.cats[0], en.series[0].name], ['Category 1', 'Series 1'], 'voorbeeld in het Engels');
ok(C.render(Object.assign(en, { title: { on: true, text: '' } }), 400, 250, DARK).includes('>Chart Title<'), 'standaardtitel in het Engels');
delete App.t;

console.log(`${pass} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
