/* =========================================================
   Doek (gemaakt door JJ van Schelven) — tests voor js/geo.js (paden, afvlakken,
   booleaanse bewerkingen). Starten met: node doek/test/geo-node.js
   ========================================================= */
'use strict';

global.window = global;
global.App = {};
require('../js/geo.js');
const G = App.Geo;

/* ---------- Mini-testkader ---------- */
let pass = 0, fail = 0, group = '';
const t = (name) => { group = name; };
const ok = (cond, name, extra) => {
  if (cond) { pass++; return true; }
  fail++;
  console.log('FOUT [' + group + '] ' + name + (extra !== undefined ? ' — ' + extra : ''));
  return false;
};
const near = (a, b, tol, name) => ok(Math.abs(a - b) <= tol, name, a + ' ≠ ' + b + ' (tol ' + tol + ')');
const rel = (a, b, r, name) => ok(Math.abs(a - b) <= r * Math.max(Math.abs(b), 1e-9), name, a + ' ≠ ' + b + ' (rel ' + r + ')');
const areaOf = (polys) => polys.reduce((s, r) => s + G.area(r), 0);
const ptsOf = (subs) => subs.map((s) => s.pts.map((p) => [p.x, p.y]));
const samePts = (a, b, tol) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!!a[i].closed !== !!b[i].closed || a[i].pts.length !== b[i].pts.length) return false;
    for (let j = 0; j < a[i].pts.length; j++) {
      const p = a[i].pts[j], q = b[i].pts[j];
      if (Math.abs(p.x - q.x) > tol || Math.abs(p.y - q.y) > tol || !!p.c1 !== !!q.c1) return false;
      if (p.c1 && (Math.abs(p.c1[0] - q.c1[0]) > tol || Math.abs(p.c1[1] - q.c1[1]) > tol || Math.abs(p.c2[0] - q.c2[0]) > tol || Math.abs(p.c2[1] - q.c2[1]) > tol)) return false;
    }
  }
  return true;
};
// Herhaalbare toevalsgetallen
let seed = 12345;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };

/* ---------- Vormen ---------- */
const sq = (x, y, s, s2 = s) => [[[x, y], [x + s, y], [x + s, y + s2], [x, y + s2]]];
const ngon = (cx, cy, r, n, a0 = 0) => { const p = []; for (let i = 0; i < n; i++) { const a = a0 + i * 2 * Math.PI / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
const circlePath = (cx, cy, r) => `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;
const circle = (cx, cy, r, tol = 0.25) => G.flatten(G.parse(circlePath(cx, cy, r)), tol);
const pentagram = (cx, cy, R) => { const p = []; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 4 * Math.PI / 5; p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return [p]; };

/* ---------- 1. parse ---------- */
t('parse');
{
  let s = G.parse('M10-20L30-40');
  ok(s.length === 1 && s[0].pts.length === 2 && s[0].pts[0].x === 10 && s[0].pts[0].y === -20 && s[0].pts[1].y === -40, 'M10-20L30-40');
  s = G.parse('M1e-3.5 L2E+2-3e1');
  ok(s[0].pts[0].x === 0.001 && s[0].pts[0].y === 0.5 && s[0].pts[1].x === 200 && s[0].pts[1].y === -30, 'exponenten en .5.5', JSON.stringify(s));
  s = G.parse('M+.5e1-.5L.5.5');
  ok(s[0].pts[0].x === 5 && s[0].pts[0].y === -0.5 && s[0].pts[1].x === 0.5 && s[0].pts[1].y === 0.5, '+.5e1 en .5.5');
  s = G.parse('m10 10 l10 0 0 10 -10 0z');
  ok(s.length === 1 && s[0].closed && JSON.stringify(ptsOf(s)) === '[[[10,10],[20,10],[20,20],[10,20]]]', 'relatief vierkant', JSON.stringify(ptsOf(s)));
  s = G.parse('M0 0 h10 v10 H0 V0 z');
  ok(JSON.stringify(ptsOf(s)) === '[[[0,0],[10,0],[10,10],[0,10]]]' && s[0].closed, 'H/V en overbodig sluitpunt', JSON.stringify(ptsOf(s)));
  s = G.parse('M0 0 10 0 10 10');
  ok(s[0].pts.length === 3 && !s[0].closed && s[0].pts[2].y === 10, 'impliciete L na M');
  s = G.parse('m10 10 20 0 0 20');
  ok(JSON.stringify(ptsOf(s)) === '[[[10,10],[30,10],[30,30]]]', 'impliciete l na m', JSON.stringify(ptsOf(s)));
  s = G.parse('M10 10 l10 0 l0 10 z l5 5');
  ok(s.length === 2 && s[0].closed && !s[1].closed && s[1].pts[0].x === 10 && s[1].pts[1].x === 15 && s[1].pts[1].y === 15, 'na z begint een nieuw subpad bij het beginpunt', JSON.stringify(ptsOf(s)));
  s = G.parse('M0 0 L10 10 X 5 5');
  ok(s.length === 1 && s[0].pts.length === 2, 'stoppen bij een fout');
  ok(G.parse('').length === 0 && G.parse('L10 10').length === 0 && G.parse(null).length === 0, 'leeg of zonder M');
  s = G.parse('M1,2L3,4,5,6');
  ok(s[0].pts.length === 3 && s[0].pts[2].x === 5, 'komma’s');
  s = G.parse('M0 0 m5 5 l1 1');
  ok(s.length === 1 && s[0].pts[0].x === 5 && s[0].pts[1].x === 6, 'losse M zonder lijn valt weg');
  ok(samePts(G.parse('M0 0a10 10 0 1020 0'), G.parse('M0 0 a10 10 0 1 0 20 0'), 1e-12), 'boogvlaggen zonder scheiding');
  ok(samePts(G.parse('M0,0A10,10,0,0,1,20,0'), G.parse('M0 0 A 10 10 0 0 1 20 0'), 1e-12), 'boog met komma’s');
  let b = G.bbox(G.parse('M0 0 A10 10 0 0 1 20 0'));
  ok(Math.abs(b.x) < 1e-9 && Math.abs(b.y + 10) < 1e-9 && Math.abs(b.w - 20) < 1e-9 && Math.abs(b.h - 10) < 1e-9, 'halve cirkel met sweep 1 gaat over de bovenkant', JSON.stringify(b));
  b = G.bbox(G.parse('M0 0 A10 10 0 0 0 20 0'));
  ok(Math.abs(b.y) < 1e-9 && Math.abs(b.h - 10) < 1e-9, 'halve cirkel met sweep 0 gaat over de onderkant', JSON.stringify(b));
  s = G.parse('M0 0 A10 10 0 1 1 10 10');
  ok(s[0].pts.length === 4 && s[0].pts[3].x === 10 && s[0].pts[3].y === 10, 'grote boog van 270° in drie stukken');
  const c0 = s[0].pts.slice(1).every((p) => Math.abs(Math.hypot(p.x - 10, p.y) - 10) < 1e-9 || Math.abs(Math.hypot(p.x, p.y - 10) - 10) < 1e-9);
  ok(c0, 'eindpunten van de boogstukken op de cirkel');
  b = G.bbox(G.parse('M0 0 A1 1 0 0 1 10 0'));
  near(b.h, 5, 1e-9, 'te kleine straal wordt opgeschaald');
  b = G.bbox(G.parse('M-20 0 A20 10 0 1 0 20 0 A20 10 0 1 0 -20 0 Z'));
  ok(Math.abs(b.x + 20) < 1e-9 && Math.abs(b.y + 10) < 1e-9 && Math.abs(b.w - 40) < 1e-9 && Math.abs(b.h - 20) < 1e-9, 'ellips', JSON.stringify(b));
  b = G.bbox(G.parse('M0 -20 A20 10 90 1 0 0 20 A20 10 90 1 0 0 -20 Z'));
  ok(Math.abs(b.x + 10) < 1e-9 && Math.abs(b.w - 20) < 1e-9 && Math.abs(b.h - 40) < 1e-9, 'gedraaide ellips', JSON.stringify(b));
  b = G.bbox(G.parse('M10 0 A20 10 45 0 1 -10 0'));
  ok(b.w > 19 && b.h > 1, 'gedraaide boog geeft een curve', JSON.stringify(b));
  s = G.parse('M0 0 A0 5 0 0 1 10 10');
  ok(s[0].pts.length === 2 && !s[0].pts[1].c1, 'straal 0 wordt een lijn');
  s = G.parse('M0 0 A5 5 0 0 1 0 0 L1 1');
  ok(s[0].pts.length === 2, 'boog naar hetzelfde punt wordt overgeslagen');
  s = G.parse('M0 0 Q10 10 20 0');
  const q = s[0].pts[1];
  ok(Math.abs(q.c1[0] - 20 / 3) < 1e-12 && Math.abs(q.c1[1] - 20 / 3) < 1e-12 && Math.abs(q.c2[0] - 40 / 3) < 1e-12 && Math.abs(q.c2[1] - 20 / 3) < 1e-12, 'Q naar kubisch');
  s = G.parse('M0 0 Q10 10 20 0 T40 0');
  ok(Math.abs(s[0].pts[2].c1[0] - (20 + 20 / 3)) < 1e-12 && Math.abs(s[0].pts[2].c1[1] + 20 / 3) < 1e-12, 'T spiegelt het vorige controlepunt');
  s = G.parse('M0 0 T10 0');
  ok(Math.abs(s[0].pts[1].c1[0]) < 1e-12 && Math.abs(s[0].pts[1].c1[1]) < 1e-12, 'T zonder Q ervoor: controlepunt = huidig punt');
  s = G.parse('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
  ok(s[0].pts[2].c1[0] === 10 && s[0].pts[2].c1[1] === -10, 'S spiegelt c2');
  ok(samePts(G.parse('M0 0 c0 10 10 10 10 0 s10 -10 10 0'), s, 1e-12), 's relatief');
  s = G.parse('M0 0 L5 5 S20 -10 20 0');
  ok(s[0].pts[2].c1[0] === 5 && s[0].pts[2].c1[1] === 5, 'S na L: c1 = huidig punt');
  s = G.parse('M0 0 c1 1 2 2 3 3 1 1 2 2 3 3');
  ok(s[0].pts.length === 3 && s[0].pts[2].x === 6 && s[0].pts[2].c1[0] === 4, 'impliciete herhaling van c');
  s = G.parse('M0 0 C0 -10 10 -10 0 0 Z');
  ok(s[0].pts.length === 2 && s[0].closed && s[0].pts[1].c1, 'curve terug naar het begin blijft staan');
  s = G.parse('M 0,0 L 10,0 L 10,10 L 0,0 Z M 20 20 l 5 0 l 0 5 z');
  ok(s.length === 2 && s[0].pts.length === 3 && s[1].pts[0].x === 20, 'twee subpaden');
}

/* ---------- 2. toD en heen-en-terug ---------- */
t('toD');
{
  ok(G.toD(G.parse('m10 10 l10 0 0 10 -10 0z')) === 'M10 10 L20 10 L20 20 L10 20 Z', 'eenvoudig', G.toD(G.parse('m10 10 l10 0 0 10 -10 0z')));
  ok(G.toD([{ closed: false, pts: [{ x: 1.23456, y: -0.0001 }, { x: 2, y: 3, c1: [1, 1], c2: [2, 2] }] }]) === 'M1.23 0 C1 1 2 2 2 3', 'afronden en -0', G.toD([{ closed: false, pts: [{ x: 1.23456, y: -0.0001 }, { x: 2, y: 3, c1: [1, 1], c2: [2, 2] }] }]));
  ok(G.toD([{ closed: true, pts: [{ x: 0, y: 0, c1: [5, -5], c2: [-5, -5] }, { x: 10, y: 0 }] }]) === 'M0 0 L10 0 C5 -5 -5 -5 0 0 Z', 'curve als sluitstuk');
  const tricky = [
    'M10-20L30-40', 'm10 10 l10 0 0 10 -10 0z', 'M0 0 A10 10 0 1 1 10 10', 'M0 0a10 10 0 1020 0', 'M-20 0 A20 10 30 1 0 20 0 A20 10 30 1 0 -20 0 Z',
    'M0 0 Q10 10 20 0 T40 0 t20 0', 'M0 0 C0 10 10 10 10 0 S20 -10 20 0 s10 10 10 0', 'M1e-3.5 L2E+2-3e1 h-5 v.5 H0 V0 z',
    'M10 10 l10 0 l0 10 z l5 5 m3 3 l1 1', circlePath(50, 50, 40),
  ];
  for (const d of tricky) {
    const a = G.parse(d), d1 = G.toD(a, 6), b = G.parse(d1);
    ok(samePts(a, b, 1e-6), 'heen en terug: ' + d, d1);
    ok(G.toD(b, 6) === d1, 'toD stabiel: ' + d);
  }
}

/* ---------- 3. matrices ---------- */
t('matrix');
{
  let m = G.objMatrix(100, 50, 200, 100, 90, false, false), p = G.apply(m, 0, 0);
  ok(Math.abs(p[0] - 250) < 1e-9 && Math.abs(p[1]) < 1e-9, '90° rechtsom: linksboven → rechtsboven', p);
  p = G.apply(m, 100, 50);
  ok(Math.abs(p[0] - 200) < 1e-9 && Math.abs(p[1] - 100) < 1e-9, 'midden blijft staan');
  m = G.objMatrix(10, 20, 30, 40, 0, true, false); p = G.apply(m, 0, 0);
  ok(p[0] === 40 && p[1] === 20, 'horizontaal spiegelen', p);
  m = G.objMatrix(10, 20, 30, 40, 0, false, true); p = G.apply(m, 0, 0);
  ok(p[0] === 10 && p[1] === 60, 'verticaal spiegelen', p);
  m = G.objMatrix(10, 20, 30, 40, 0); p = G.apply(m, 5, 5);
  ok(p[0] === 15 && p[1] === 25, 'alleen verschuiven');
  // spiegelen gebeurt vóór draaien: flipH + 90° = punt (0, 0) → rechtsonder
  m = G.objMatrix(0, 0, 100, 100, 90, true, false); p = G.apply(m, 0, 0);
  ok(Math.abs(p[0] - 100) < 1e-9 && Math.abs(p[1] - 100) < 1e-9, 'eerst spiegelen, dan draaien', p);
  m = G.objMatrix(13, -7, 120, 80, 33, true, true);
  const id = G.multiply(G.invert(m), m);
  ok([1, 0, 0, 1, 0, 0].every((v, i) => Math.abs(v - id[i]) < 1e-9), 'invert', id);
  const sub = G.transform(G.parse('M0 0 C10 0 20 10 20 20'), m), back = G.transform(sub, G.invert(m));
  ok(samePts(back, G.parse('M0 0 C10 0 20 10 20 20'), 1e-9), 'transform heen en terug (met controlepunten)');
  const ex = G.transform([{ closed: true, pts: [{ x: 1, y: 2, t: 'smooth' }] }], [1, 0, 0, 1, 5, 5]);
  ok(ex[0].pts[0].t === 'smooth' && ex[0].pts[0].x === 6, 'extra velden blijven behouden');
}

/* ---------- 4. bbox ---------- */
t('bbox');
{
  let b = G.bbox(G.parse('M0 0 C0 -100 100 -100 100 0'));
  ok(Math.abs(b.x) < 1e-12 && Math.abs(b.y + 75) < 1e-9 && Math.abs(b.w - 100) < 1e-12 && Math.abs(b.h - 75) < 1e-9, 'boog-Bézier', JSON.stringify(b));
  b = G.bbox(G.parse(circlePath(50, 50, 50)));
  ok(Math.abs(b.x) < 1e-9 && Math.abs(b.y) < 1e-9 && Math.abs(b.w - 100) < 1e-9 && Math.abs(b.h - 100) < 1e-9, 'cirkel', JSON.stringify(b));
  // willekeurige curven tegen dichte bemonstering
  let worst = 0, outside = 0;
  for (let k = 0; k < 200; k++) {
    const P = Array.from({ length: 8 }, () => rnd() * 200 - 100);
    const s = [{ closed: false, pts: [{ x: P[0], y: P[1] }, { x: P[6], y: P[7], c1: [P[2], P[3]], c2: [P[4], P[5]] }] }];
    const bb = G.bbox(s);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i <= 4000; i++) {
      const u = i / 4000, m = 1 - u, x = m * m * m * P[0] + 3 * m * m * u * P[2] + 3 * m * u * u * P[4] + u * u * u * P[6], y = m * m * m * P[1] + 3 * m * m * u * P[3] + 3 * m * u * u * P[5] + u * u * u * P[7];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (bb.x > x0 + 1e-9 || bb.y > y0 + 1e-9 || bb.x + bb.w < x1 - 1e-9 || bb.y + bb.h < y1 - 1e-9) outside++;
    worst = Math.max(worst, x0 - bb.x, y0 - bb.y, bb.x + bb.w - x1, bb.y + bb.h - y1);
  }
  ok(outside === 0, 'begrenzing bevat de hele curve', outside);
  ok(worst < 1e-3, 'begrenzing strak om de curve', worst);
  b = G.bbox([]);
  ok(b.w === 0 && b.h === 0, 'leeg');
}

/* ---------- 5. afvlakken ---------- */
t('flatten');
{
  const subs = G.parse(circlePath(0, 0, 100));
  for (const tol of [0.25, 0.05, 1]) {
    const poly = G.flatten(subs, tol)[0];
    // afstand van de echte curve (dicht bemonsterd) tot de veelhoek
    let dev = 0, rmin = Infinity, rmax = 0;
    for (const p of poly) { const r = Math.hypot(p[0], p[1]); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
    const pts = subs[0].pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i];
      for (let k = 0; k <= 400; k++) {
        const u = k / 400, m = 1 - u;
        const x = m * m * m * a.x + 3 * m * m * u * c.c1[0] + 3 * m * u * u * c.c2[0] + u * u * u * c.x;
        const y = m * m * m * a.y + 3 * m * m * u * c.c1[1] + 3 * m * u * u * c.c2[1] + u * u * u * c.y;
        let best = Infinity;
        for (let j = 0, n = poly.length, l = n - 1; j < n; l = j++) {
          const [px, py] = poly[l], [qx, qy] = poly[j], dx = qx - px, dy = qy - py, L = dx * dx + dy * dy;
          let w = L ? ((x - px) * dx + (y - py) * dy) / L : 0;
          w = Math.max(0, Math.min(1, w));
          best = Math.min(best, Math.hypot(px + w * dx - x, py + w * dy - y));
        }
        dev = Math.max(dev, best);
      }
    }
    ok(dev <= tol + 1e-9, 'afwijking ≤ tol ' + tol, dev);
    ok(dev >= tol * 0.15, 'niet onnodig fijn bij tol ' + tol, dev);
    ok(rmin > 100 - 1e-9 && rmax < 100.03, 'punten liggen op de curve', rmin + ' ' + rmax);
    rel(Math.abs(G.area(poly)), Math.PI * 1e4, tol * 0.015, 'oppervlakte cirkel bij tol ' + tol);
  }
  const n = G.flatten(subs)[0].length;
  ok(n >= 30 && n <= 200, 'aantal punten redelijk', n);
  ok(G.flatten(G.parse('M0 0 L10 0 L10 10')).length === 0, 'open subpaden tellen niet mee');
  ok(G.flatten(G.parse('M0 0 L10 0 Z')).length === 0, 'gesloten pad zonder oppervlakte valt weg');
  const sq2 = G.flatten(G.parse('M0 0 L10 0 L10 10 L0 10 L0 0 Z'))[0];
  ok(sq2.length === 4, 'geen dubbel eindpunt', JSON.stringify(sq2));
  ok(G.flatten([{ closed: true, pts: [{ x: 0, y: 0, c1: [5, -5], c2: [-5, -5] }, { x: 10, y: 0 }] }])[0].length > 4, 'curve als sluitstuk wordt afgevlakt');
}

/* ---------- 6. area, contains, simplify, toSubs, toLocal ---------- */
t('hulpjes');
{
  ok(G.area([[0, 0], [10, 0], [10, 10], [0, 10]]) === 100 && G.area([[0, 0], [0, 10], [10, 10], [10, 0]]) === -100, 'area met teken');
  const donut = [[[0, 0], [10, 0], [10, 10], [0, 10]], [[3, 3], [7, 3], [7, 7], [3, 7]]];   // zelfde richting
  ok(G.contains(donut, 1, 1) && G.contains(donut, 5, 5) && !G.contains(donut, 5, 5, 'evenodd') && !G.contains(donut, 11, 5), 'contains nonzero/evenodd');
  ok(G.contains(pentagram(0, 0, 100), 0, 0) && !G.contains(pentagram(0, 0, 100), 0, 0, 'evenodd'), 'ster: midden wel bij nonzero, niet bij evenodd');
  const sp = G.simplify([[0, 0], [5, 0], [10, 0], [10, 0], [10, 10], [5, 10.01], [0, 10], [0, 5]]);
  ok(JSON.stringify(sp) === '[[0,0],[10,0],[10,10],[0,10]]', 'simplify', JSON.stringify(sp));
  ok(G.simplify([[0, 0], [5, 0], [10, 0]]).length === 0, 'simplify: lijn wordt leeg');
  ok(G.simplify([[0, 0], [10, 0], [20, 0], [10, 0.001], [10, 10]]).length === 3, 'simplify: uitsteeksel weg');
  const subs = G.toSubs([[[0, 0], [1, 0], [1, 1]]]);
  ok(subs.length === 1 && subs[0].closed && subs[0].pts.length === 3 && subs[0].pts[2].y === 1, 'toSubs');
  const loc = G.toLocal(G.parse('M110 220 L130 220 C140 220 140 240 130 240 Z'));
  ok(loc.subs[0].pts[0].x === 0 && loc.subs[0].pts[0].y === 0 && loc.h === 20 && Math.abs(loc.w - 27.5) < 1e-9 && loc.subs[0].pts[2].c1[0] === 30, 'toLocal', JSON.stringify(loc));
  const box = G.bbox(G.parse('M110 220 L130 220 L130 240 Z'));
  ok(box.x === 110 && box.y === 220 && box.w === 20 && box.h === 20, 'bbox van rechte lijnen');
}

/* ---------- 7. booleaanse bewerkingen op oppervlakte ---------- */
const ops = ['union', 'intersect', 'subtract', 'xor'];
const check = (name, a, b, exp, tol = 1e-6) => {
  ops.forEach((op, i) => {
    const r = G.boolean(op, a, b);
    if (exp[i] !== null) near(areaOf(r), exp[i], tol * Math.max(1, Math.abs(exp[i])), name + ' ' + op);
    // uitkomst: geen dubbele punten, ringen ≥ 3 punten, eindig
    ok(r.every((ring) => ring.length >= 3 && ring.every((p, k) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && (p[0] !== ring[(k + 1) % ring.length][0] || p[1] !== ring[(k + 1) % ring.length][1]))), name + ' ' + op + ' geldige ringen');
  });
};
t('boolean');
{
  check('overlappende vierkanten', sq(0, 0, 10), sq(5, 5, 10), [175, 25, 75, 150]);
  check('vierkant in vierkant', sq(0, 0, 10), sq(2, 2, 6), [100, 36, 64, 64]);
  check('vierkant om vierkant', sq(2, 2, 6), sq(0, 0, 10), [100, 36, 0, 64]);
  check('los van elkaar', sq(0, 0, 10), sq(20, 0, 10), [200, 0, 100, 200]);
  check('gelijk', sq(0, 0, 10), sq(0, 0, 10), [100, 100, 0, 0]);
  check('gedeelde rand', sq(0, 0, 10), [[[10, 0], [20, 0], [20, 10], [10, 10]]], [200, 0, 100, 200]);
  check('gedeelde halve rand', sq(0, 0, 10), sq(10, 5, 10), [200, 0, 100, 200]);
  check('raken in een hoek', sq(0, 0, 10), sq(10, 10, 10), [200, 0, 100, 200]);
  check('omgekeerde richting', sq(0, 0, 10), [sq(5, 5, 10)[0].slice().reverse()], [175, 25, 75, 150]);
  check('leeg', sq(0, 0, 10), [], [100, 0, 100, 100]);
  // vormen van de uitkomst
  let r = G.boolean('union', sq(0, 0, 10), sq(5, 5, 10));
  ok(r.length === 1 && r[0].length === 8 && G.area(r[0]) > 0, 'vereniging: één ring met 8 punten, positief', JSON.stringify(r));
  r = G.boolean('union', sq(0, 0, 10), [[[10, 0], [20, 0], [20, 10], [10, 10]]]);
  ok(r.length === 1 && r[0].length === 4, 'gedeelde rand: één rechthoek met 4 punten', JSON.stringify(r));
  r = G.boolean('union', sq(0, 0, 10), sq(10, 10, 10));
  ok(r.length === 2 && r.every((x) => x.length === 4), 'raken in een hoek: twee losse ringen', JSON.stringify(r));
  r = G.boolean('subtract', sq(0, 0, 10), sq(2, 2, 6));
  ok(r.length === 2 && r.filter((x) => G.area(x) > 0).length === 1 && r.filter((x) => G.area(x) < 0).length === 1, 'gat is negatief', JSON.stringify(r));
  r = G.boolean('subtract', sq(0, 0, 10), [[[0, 3], [3, 0], [6, 3], [3, 6]]]);  // gat raakt de buitenrand in (0, 3)
  near(areaOf(r), 82, 1e-9, 'gat dat de rand raakt');
  ok(r.every((x) => { const k = new Set(x.map((p) => p.join(','))); return k.size === x.length; }), 'raakpunt geeft losse ringen zonder herhaalde punten', JSON.stringify(r));
  // bijna samenvallende randen (afrondingsruis) worden één rand
  r = G.boolean('union', sq(0, 0, 10), [[[10 + 1e-9, 0], [20, 0], [20, 10], [10 - 1e-9, 10]]]);
  ok(r.length === 1 && r[0].length === 4, 'randen die 1e-9 verschillen', JSON.stringify(r));
  // gedraaide vierkanten (zwevende kommagetallen)
  const rot = (poly, deg, cx, cy) => { const m = G.objMatrix(cx - 50, cy - 50, 100, 100, deg); return poly.map((ring) => ring.map((p) => G.apply(m, p[0], p[1]))); };
  const s1 = rot(sq(0, 0, 100), 30, 0, 0), s2 = rot(sq(0, 0, 100), 30, 0, 0);
  check('gelijke gedraaide vierkanten', s1, s2, [1e4, 1e4, 0, 0]);
  check('vierkant en hetzelfde vierkant 45° gedraaid', sq(-50, -50, 100), rot(sq(0, 0, 100), 45, 0, 0), [null, null, null, null]);
  const oct = areaOf(G.boolean('intersect', sq(-50, -50, 100), rot(sq(0, 0, 100), 45, 0, 0)));
  near(oct, 2 * (Math.SQRT2 - 1) * 1e4, 1e-4 * 1e4, 'regelmatige achthoek');
}
t('cirkels');
{
  const R = 100;
  const lens = (d) => 2 * R * R * Math.acos(d / (2 * R)) - (d / 2) * Math.sqrt(4 * R * R - d * d);
  for (const d of [100, 60, 150]) {
    const a = circle(0, 0, R, 0.1), b = circle(d, 0, R, 0.1), ca = Math.PI * R * R;   // afvlakken op 0,1 px: ruim binnen 0,5%
    rel(areaOf(G.boolean('intersect', a, b)), lens(d), 0.005, 'lens d=' + d);
    rel(areaOf(G.boolean('union', a, b)), 2 * ca - lens(d), 0.005, 'vereniging d=' + d);
    rel(areaOf(G.boolean('subtract', a, b)), ca - lens(d), 0.005, 'verschil d=' + d);
    rel(areaOf(G.boolean('xor', a, b)), 2 * ca - 2 * lens(d), 0.005, 'xor d=' + d);
  }
}
t('ring met gat');
{
  const donut = [[[0, 0], [100, 0], [100, 100], [0, 100]], [[25, 25], [75, 25], [75, 75], [25, 75]]];   // beide dezelfde richting
  near(areaOf(G.boolean('union', donut, [])), 7500, 1e-6, 'oppervlakte na richting gelijktrekken');
  check('ring en vierkant', donut, [[[50, 0], [150, 0], [150, 100], [50, 100]]], [13750, 3750, 3750, 10000]);
  const r = G.boolean('union', donut, [[[50, 0], [150, 0], [150, 100], [50, 100]]]);
  ok(r.length === 2 && r.filter((x) => G.area(x) < 0).length === 1, 'vereniging houdt een gat', JSON.stringify(r));
  const island = [...donut, [[40, 40], [60, 40], [60, 60], [40, 60]]];       // eiland in het gat
  near(areaOf(G.boolean('union', island, [])), 7900, 1e-6, 'eiland in het gat');
}
t('ster');
{
  const R = 100, r = R * Math.cos(2 * Math.PI / 5) / Math.cos(Math.PI / 5), star = 5 * R * r * Math.sin(Math.PI / 5);
  const st = pentagram(0, 0, R);
  near(areaOf(G.boolean('union', st, [])), star, star * 1e-6, 'zelfsnijdende ster (nonzero, met midden)');
  check('ster en groot vierkant', st, sq(-200, -200, 400), [160000, star, 0, 160000 - star], 1e-6);
  check('ster en rechterhelft', st, sq(0, -200, 200, 400), [80000 + star / 2, star / 2, star / 2, 80000], 1e-6);
  check('ster en klein vierkant in het midden', st, sq(-10, -10, 20), [star, 400, star - 400, star - 400], 1e-6);
}

/* ---------- 8. samenvoegen en fragmenteren ---------- */
t('merge');
{
  const A = sq(0, 0, 10), B = sq(5, 0, 10, 10), C = sq(0, 5, 10, 10);
  const am = (subs) => areaOf(G.flatten(subs));
  near(am(G.merge('union', [A, B, C])), 200, 1e-6, 'union van drie');
  near(am(G.merge('intersect', [A, B, C])), 25, 1e-6, 'intersect van drie');
  near(am(G.merge('subtract', [A, B, C])), 25, 1e-6, 'subtract: eerste min de rest');
  near(am(G.merge('combine', [A, B, C])), 150, 1e-6, 'combine: oneven aantal keer bedekt');
  const fr = G.merge('fragment', [A, B, C]);
  ok(fr.length === 6, 'fragment van drie vierkanten: 6 delen', fr.length);
  near(fr.reduce((s, p) => s + am(p), 0), 200, 1e-6, 'fragmenten samen = vereniging');
  const u = G.merge('union', [G.parse(circlePath(0, 0, 50)), G.parse(circlePath(60, 0, 50))]);
  ok(u.length === 1 && u[0].closed && u[0].pts.length > 20, 'merge accepteert ook subs');
  const two = [circle(0, 0, 100), circle(100, 0, 100)];
  const f2 = G.fragment(two), U2 = areaOf(G.boolean('union', two[0], two[1]));
  ok(f2.length === 3, 'fragment van twee cirkels: 3 delen', f2.length);
  rel(f2.reduce((s, p) => s + areaOf(p.polys), 0), U2, 1e-6, 'twee cirkels: totaal = vereniging');
  ok(JSON.stringify(f2.map((p) => p.cover.join('+')).sort()) === '["0","0+1","1"]', 'welke vormen elk deel bedekken', JSON.stringify(f2.map((p) => p.cover)));
  const three = [circle(0, 0, 100), circle(100, 0, 100), circle(50, 85, 100)];
  const f3 = G.merge('fragment', three), U3 = am(G.merge('union', three));
  ok(f3.length === 7, 'fragment van drie cirkels: 7 delen', f3.length);
  rel(f3.reduce((s, p) => s + am(p), 0), U3, 1e-6, 'drie cirkels: totaal = vereniging');
  const fd = G.fragment([[[[0, 0], [100, 0], [100, 100], [0, 100]], [[25, 25], [75, 25], [75, 75], [25, 75]]], sq(40, 40, 20), sq(80, 40, 40)]);
  ok(fd.length === 4, 'fragment met gat en eiland', fd.length + ' ' + JSON.stringify(fd.map((p) => [p.cover, areaOf(p.polys)])));
  near(fd.reduce((s, p) => s + areaOf(p.polys), 0), 7500 + 400 + 1600 - 800, 1e-6, 'fragment met gat: totaal');
  ok(fd.every((p) => G.area(p.polys[0]) > 0 && p.polys.slice(1).every((h) => G.area(h) < 0)), 'per deel eerst de buitenrand, dan de gaten');
  ok(G.merge('union', []).length === 0 && G.merge('fragment', []).length === 0, 'lege selectie');
  ok(G.merge('intersect', [sq(0, 0, 10), sq(20, 20, 5)]).length === 0, 'geen overlap: leeg');
  let threw = false;
  try { G.merge('bestaat-niet', [sq(0, 0, 1)]); } catch (e) { threw = true; }
  ok(threw, 'onbekende bewerking geeft een fout');
  // regressie: heel dunne driehoek door een hoek van een vierkant (twee snijpunten 1 rastereenheid uit elkaar)
  const thin = [[[3.9742834749631584, 9.329748130403459], [63.97428347496316, 69.32974813040346], [63.97428347496316, 69.33074813040346]]];
  near(areaOf(G.boolean('subtract', sq(5, 5, 6), thin)), 36, 1e-3, 'dunne driehoek: hoek blijft heel');
  const ft = G.fragment([sq(5, 5, 6), thin]);
  rel(ft.reduce((s, p) => s + areaOf(p.polys), 0), areaOf(G.boolean('union', sq(5, 5, 6), thin)), 1e-5, 'dunne driehoek: fragmenten = vereniging (op splinters na)');
}

/* ---------- 9. willekeurige paren ---------- */
t('willekeurig');
{
  const starPoly = (cx, cy, r0, r1, n) => {
    const as = Array.from({ length: n }, (_, i) => (i + rnd() * 0.9) * 2 * Math.PI / n);   // stervormig rond het midden
    return as.map((a) => { const r = r0 + rnd() * (r1 - r0); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  };
  const gridPoly = (n, s) => Array.from({ length: n }, () => [Math.floor(rnd() * (s + 1)), Math.floor(rnd() * (s + 1))]);
  const gen = (k) => {
    const kind = k % 6;
    if (kind === 0) return { set: [starPoly(rnd() * 40, rnd() * 40, 5, 30, 3 + Math.floor(rnd() * 30))], rule: 'nonzero' };
    if (kind === 1) return { set: [gridPoly(3 + Math.floor(rnd() * 6), 8)], rule: 'nonzero' };            // ontaard, zelfsnijdend
    if (kind === 2) { const x = Math.floor(rnd() * 6), y = Math.floor(rnd() * 6); return { set: sq(x, y, 1 + Math.floor(rnd() * 5), 1 + Math.floor(rnd() * 5)), rule: 'nonzero' }; }
    if (kind === 3) {                                                                                     // buitenrand met gat, zelfde richting
      const cx = rnd() * 40, cy = rnd() * 40, o = starPoly(cx, cy, 10, 30, 5 + Math.floor(rnd() * 20));   // gat = 0,4 × buitenrand
      return { set: [o, o.map((p) => [cx + (p[0] - cx) * 0.4, cy + (p[1] - cy) * 0.4])], rule: 'evenodd' };
    }
    if (kind === 4) return { set: [Array.from({ length: 4 + Math.floor(rnd() * 8) }, () => [rnd() * 50, rnd() * 50])], rule: 'nonzero' };   // zelfsnijdend
    const m = G.objMatrix(rnd() * 30, rnd() * 30, 20, 20, rnd() * 360);
    return { set: sq(0, 0, 20).map((r) => r.map((p) => G.apply(m, p[0], p[1]))), rule: 'nonzero' };
  };
  const edgeDist = (set, x, y) => {
    let d = Infinity;
    for (const r of set) for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) {
      const [ax, ay] = r[j], [bx, by] = r[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      let w = L ? ((x - ax) * dx + (y - ay) * dy) / L : 0;
      w = Math.max(0, Math.min(1, w));
      d = Math.min(d, Math.hypot(ax + w * dx - x, ay + w * dy - y));
    }
    return d;
  };
  let idFail = 0, ptFail = 0, ptTotal = 0, ringFail = 0, worst = 0;
  const T0 = Date.now();
  for (let k = 0; k < 300; k++) {
    const A = gen(k), B = gen(k * 7 + 3 + Math.floor(rnd() * 5));
    const aA = areaOf(G.boolean('union', A.set, [])), aB = areaOf(G.boolean('union', B.set, []));
    const R = {}, ar = {};
    for (const op of ops) { R[op] = G.boolean(op, A.set, B.set); ar[op] = areaOf(R[op]); }
    const scale = Math.max(1, aA + aB), tol = 1e-5 * scale;
    const e1 = Math.abs(ar.union - (aA + aB - ar.intersect)), e2 = Math.abs(ar.subtract - (aA - ar.intersect)), e3 = Math.abs(ar.xor - (ar.union - ar.intersect));
    worst = Math.max(worst, (e1 + e2 + e3) / scale);
    if (e1 > tol || e2 > tol || e3 > tol || ar.intersect < -tol || ar.subtract < -tol) {
      idFail++;
      if (idFail <= 3) console.log('  oppervlakte klopt niet in geval ' + k, JSON.stringify({ aA, aB, ar, A: A.set, B: B.set }));
    }
    for (const op of ops) if (!R[op].every((r) => r.length >= 3 && r.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])))) ringFail++;
    // punten: alle ringen samen → binnen volgens nonzero; evenodd moet hetzelfde zeggen (geen overlappende ringen)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of [...A.set, ...B.set]) for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const S = Math.max(x1 - x0, y1 - y0, 1e-9);
    for (let i = 0; i < 200; i++) {
      const x = x0 - 0.05 * S + rnd() * 1.1 * S, y = y0 - 0.05 * S + rnd() * 1.1 * S;
      if (edgeDist(A.set, x, y) < 1e-5 * S || edgeDist(B.set, x, y) < 1e-5 * S) continue;
      const ia = G.contains(A.set, x, y, A.rule), ib = G.contains(B.set, x, y, B.rule);
      const exp = { union: ia || ib, intersect: ia && ib, subtract: ia && !ib, xor: ia !== ib };
      for (const op of ops) {
        ptTotal++;
        const got = G.contains(R[op], x, y), got2 = G.contains(R[op], x, y, 'evenodd');
        if (got !== exp[op] || got2 !== got) {
          ptFail++;
          if (ptFail <= 3) console.log('  punt klopt niet in geval ' + k + ' ' + op + ' (' + x + ', ' + y + ')', JSON.stringify({ exp: exp[op], got, got2, A: A.set, B: B.set, R: R[op] }));
        }
      }
    }
  }
  ok(idFail === 0, '300 paren: oppervlakte-identiteiten', idFail + ' fout, grootste relatieve afwijking ' + worst);
  ok(ptFail === 0, '300 paren: punt-in-veelhoek (' + ptTotal + ' punten)', ptFail + ' fout');
  ok(ringFail === 0, '300 paren: geldige ringen', ringFail);
  console.log('  willekeurige paren: ' + (Date.now() - T0) + ' ms, grootste relatieve afwijking ' + worst.toExponential(2) + ', ' + ptTotal + ' punten');

  // 100 keer 3 of 4 vormen: alle samenvoegbewerkingen en elk fragment per punt
  let mFail = 0, fFail = 0, aFail = 0, mPts = 0;
  for (let k = 0; k < 100; k++) {
    const S = Array.from({ length: 3 + (k % 2) }, (_, i) => gen(k * 5 + i * 11 + Math.floor(rnd() * 6)));
    const sets = S.map((s) => s.set), N = sets.length;
    const M = {};
    for (const op of ['union', 'intersect', 'subtract', 'combine']) M[op] = G.flatten(G.merge(op, sets));
    const F = G.fragment(sets);
    if (Math.abs(areaOf(M.union) - F.reduce((s, p) => s + areaOf(p.polys), 0)) > 1e-5 * Math.max(1, areaOf(M.union))) aFail++;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sets) for (const r of s) for (const p of r) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const D = Math.max(x1 - x0, y1 - y0, 1e-9);
    for (let i = 0; i < 100; i++) {
      const x = x0 - 0.05 * D + rnd() * 1.1 * D, y = y0 - 0.05 * D + rnd() * 1.1 * D;
      if (S.some((s) => edgeDist(s.set, x, y) < 1e-5 * D)) continue;
      mPts++;
      const ins = S.map((s) => G.contains(s.set, x, y, s.rule)), cnt = ins.filter(Boolean).length;
      const exp = { union: cnt > 0, intersect: cnt === N, subtract: ins[0] && cnt === 1, combine: cnt % 2 === 1 };
      for (const op in exp) if (G.contains(M[op], x, y) !== exp[op]) mFail++;
      const hit = F.filter((p) => G.contains(p.polys, x, y)), want = ins.map((v, j) => (v ? j : -1)).filter((j) => j >= 0).join('+');
      if (cnt === 0 ? hit.length !== 0 : hit.length !== 1 || hit[0].cover.join('+') !== want) fFail++;
    }
  }
  ok(mFail === 0, '100 × 3-4 vormen: union/intersect/subtract/combine per punt (' + mPts + ' punten)', mFail + ' fout');
  ok(fFail === 0, '100 × 3-4 vormen: elk punt in precies één fragment met de juiste vormen', fFail + ' fout');
  ok(aFail === 0, '100 × 3-4 vormen: fragmenten samen = vereniging', aFail + ' fout');
}

/* ---------- 10. snelheid ---------- */
t('snelheid');
{
  const time = (fn, n) => { fn(); fn(); const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(); return Number(process.hrtime.bigint() - t0) / 1e6 / n; };
  const a = [ngon(0, 0, 100, 300)], b = [ngon(80, 30, 100, 300, 0.01)];
  const t1 = time(() => G.boolean('union', a, b), 20);
  ok(t1 < 20, 'twee 300-hoeken samenvoegen < 20 ms', t1.toFixed(2) + ' ms');
  let s0 = 777; const r2 = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const wild = (cx, n) => { const as = Array.from({ length: n }, () => r2() * 2 * Math.PI).sort((p, q) => p - q); return [as.map((t) => { const r = 40 + r2() * 60; return [cx + r * Math.cos(t), r * Math.sin(t)]; })]; };
  const wa = wild(0, 300), wb = wild(50, 300);
  const t2 = time(() => G.boolean('intersect', wa, wb), 10);
  ok(t2 < 20, 'twee grillige 300-hoeken (veel snijpunten) < 20 ms', t2.toFixed(2) + ' ms');
  const ten = Array.from({ length: 10 }, (_, i) => [ngon(Math.cos(i * 0.628) * 120, Math.sin(i * 0.628) * 120, 90, 100, i * 0.1)]);
  const t3 = time(() => G.merge('union', ten), 10), t4 = time(() => G.merge('fragment', ten), 10), t5 = time(() => G.merge('combine', ten), 10);
  ok(t3 < 100, 'tien 100-hoeken: union < 100 ms', t3.toFixed(2) + ' ms');
  ok(t4 < 100, 'tien 100-hoeken: fragment < 100 ms', t4.toFixed(2) + ' ms');
  ok(t5 < 100, 'tien 100-hoeken: combine < 100 ms', t5.toFixed(2) + ' ms');
  console.log('  snelheid: 2×300 ' + t1.toFixed(2) + ' ms, 2×300 grillig ' + t2.toFixed(2) + ' ms, 10×100 union ' + t3.toFixed(2) + ' ms, fragment ' + t4.toFixed(2) + ' ms, combine ' + t5.toFixed(2) + ' ms');
}

console.log((fail ? 'MISLUKT' : 'GESLAAGD') + ': ' + pass + ' geslaagd, ' + fail + ' mislukt');
process.exit(fail ? 1 : 0);
