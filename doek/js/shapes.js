/* =========================================================
   Doek (gemaakt door JJ van Schelven) — vormenbibliotheek: alle OOXML-voorinstellingen (prstGeom)
   met aanpassingswaarden, grepen, tekstvak en verbindingspunten. Paden alleen met M, L, C en Z.
   De definities volgen de opzet van presetShapeDefinitions (ECMA-376): gidsen met formules,
   paden, grepen (ahXY/ahPolar), tekstrechthoek en verbindingspunten.
   ========================================================= */
'use strict';

(() => {
  /* ---------- Formules (gidsen) ---------- */
  const RAD = Math.PI / 10800000;                 // 1/60000 graad → radialen
  const TAU = Math.PI * 2;
  const cl = (v) => (v > 1e9 ? 1e9 : v < -1e9 ? -1e9 : v || 0);   // NaN → 0, nooit oneindig
  const OPS = {
    '*/': (x, y, z) => (z ? x * y / z : 0),
    '+-': (x, y, z) => x + y - z,
    '+/': (x, y, z) => (z ? (x + y) / z : 0),
    '?:': (x, y, z) => (x > 0 ? y : z),
    abs: (x) => Math.abs(x),
    at2: (x, y) => Math.atan2(y, x) / RAD,
    cat2: (x, y, z) => x * Math.cos(Math.atan2(z, y)),
    cos: (x, y) => x * Math.cos(y * RAD),
    max: (x, y) => (x > y ? x : y),
    min: (x, y) => (x < y ? x : y),
    mod: (x, y, z) => Math.sqrt(x * x + y * y + z * z),
    pin: (x, y, z) => (y < x ? x : y > z ? z : y),
    sat2: (x, y, z) => x * Math.sin(Math.atan2(z, y)),
    sin: (x, y) => x * Math.sin(y * RAD),
    sqrt: (x) => (x > 0 ? Math.sqrt(x) : 0),
    tan: (x, y) => x * Math.tan(y * RAD),
    val: (x) => x,
  };
  // vaste namen uit de specificatie
  const base = (w, h) => {
    const ss = w < h ? w : h;
    return { w, h, l: 0, t: 0, r: w, b: h, hc: w / 2, vc: h / 2, ss, ls: w > h ? w : h,
      wd2: w / 2, wd3: w / 3, wd4: w / 4, wd5: w / 5, wd6: w / 6, wd8: w / 8, wd10: w / 10, wd12: w / 12, wd16: w / 16, wd32: w / 32,
      hd2: h / 2, hd3: h / 3, hd4: h / 4, hd5: h / 5, hd6: h / 6, hd8: h / 8, hd10: h / 10, hd12: h / 12, hd16: h / 16, hd32: h / 32,
      ssd2: ss / 2, ssd4: ss / 4, ssd6: ss / 6, ssd8: ss / 8, ssd16: ss / 16, ssd32: ss / 32,
      cd2: 10800000, cd4: 5400000, cd8: 2700000, '3cd4': 16200000, '3cd8': 8100000, '5cd8': 13500000, '7cd8': 18900000 };
  };

  /* ---------- Definities: D(id, av, gidsen, paden, tekstvak, grepen, verbindingspunten) ----------
     av:      'adj1=18750 adj2=50000'
     gidsen:  'naam op a b c;…'      (op: maal-deel, +-, +/, ?:, abs, at2, cat2, cos, max, min, mod, pin, sat2, sin, sqrt, tan, val)
     paden:   'M x y L x y A wR hR stAng swAng Q x1 y1 x y C x1 y1 x2 y2 x y Z | …'
              voorvoegsels per pad: ~n geen vulling, ~s geen lijn, ~d donker, ~D iets donkerder, ~l licht, ~L iets lichter,
              ~w21600 ~h21600 eigen coördinatenruimte van het pad, ~i pictogram (0..16 in een vierkant van 3/4 ss)
     tekstvak: 'l t r b'
     grepen:  'X ref min max x y' | 'Y ref min max x y' | 'XY refX minX maxX refY minY maxY x y' | 'P refR minR maxR refAng minAng maxAng x y'
     verbindingspunten: 'hoek x y;…' of 'R' (midden van de vier zijden) */
  const DEF = Object.create(null), CMP = Object.create(null), BAD = [];
  const D = (id, av, gd, pth, rect, ah, cxn) => { DEF[id] = [av, gd, pth, rect, ah, cxn]; };
  const R4 = '3cd4 hc t;cd2 l vc;cd4 hc b;0 r vc';
  const tk = (s) => (/^[-+]?(\d|\.\d)/.test(s) ? +s : s);
  const sp = (s) => (s ? s.trim().split(/\s+/).filter(Boolean) : []);
  const NARG = { M: 2, L: 2, A: 4, Q: 4, C: 6, Z: 0 };
  const FILLS = { n: 'none', d: 'darken', D: 'darkenLess', l: 'lighten', L: 'lightenLess' };

  const compile = (id) => {
    const d = DEF[id];
    const av = {};
    sp(d[0]).forEach((p) => { const i = p.indexOf('='); av[p.slice(0, i)] = +p.slice(i + 1); });
    const gd = (d[1] || '').split(';').map(sp).filter((g) => g.length > 1).map((g) => {
      if (!OPS[g[1]]) BAD.push(id + ': onbekende formule ' + g.join(' '));
      return [g[0], OPS[g[1]] || OPS.val, tk(g[2] ?? '0'), tk(g[3] ?? '0'), tk(g[4] ?? '0')];
    });
    const paths = (d[2] || '').split('|').map((ps) => {
      const p = { fill: 'norm', stroke: true, w: 0, h: 0, c: [] };
      const t = sp(ps);
      for (let i = 0; i < t.length; i++) {
        const k = t[i];
        if (k[0] === '~') {
          const m = k.slice(1);
          if (m === 's') p.stroke = false;
          else if (m === 'i') p.i = true;
          else if (FILLS[m]) p.fill = FILLS[m];
          else if (m[0] === 'w') p.w = +m.slice(1);
          else if (m[0] === 'h') p.h = +m.slice(1);
          else BAD.push(id + ': onbekend voorvoegsel ' + k);
          continue;
        }
        const n = NARG[k];
        if (n === undefined) { BAD.push(id + ': onbekend padcommando ' + k); continue; }
        const a = t.slice(i + 1, i + 1 + n).map(tk);
        if (a.length < n || a.some((x) => NARG[x] !== undefined)) BAD.push(id + ': te weinig argumenten bij ' + k);
        p.c.push([k, a]);
        i += n;
      }
      if (!p.c.length || p.c[0][0] !== 'M') BAD.push(id + ': pad begint niet met M');
      return p;
    });
    const rect = sp(d[3] || 'l t r b').map(tk);
    const g = (x) => (x === undefined || x === '-' ? null : tk(x));
    const ah = (d[4] || '').split(';').map(sp).filter((a) => a.length).map((a) => {
      if (a[0] === 'X' && a.length === 6) return { k: 'xy', rx: a[1], x0: g(a[2]), x1: g(a[3]), px: tk(a[4]), py: tk(a[5]) };
      if (a[0] === 'Y' && a.length === 6) return { k: 'xy', ry: a[1], y0: g(a[2]), y1: g(a[3]), px: tk(a[4]), py: tk(a[5]) };
      if (a[0] === 'XY' && a.length === 9) return { k: 'xy', rx: a[1], x0: g(a[2]), x1: g(a[3]), ry: a[4], y0: g(a[5]), y1: g(a[6]), px: tk(a[7]), py: tk(a[8]) };
      if (a[0] === 'P' && a.length === 9) return { k: 'p', rr: a[1] === '-' ? null : a[1], r0: g(a[2]), r1: g(a[3]), ra: a[4] === '-' ? null : a[4], a0: g(a[5]), a1: g(a[6]), px: tk(a[7]), py: tk(a[8]) };
      BAD.push(id + ': ongeldige greep ' + a.join(' '));
      return null;
    }).filter(Boolean);
    const cx = (d[5] === 'R' ? R4 : d[5] || '').split(';').map(sp).filter((a) => a.length);
    cx.forEach((a) => { if (a.length !== 3) BAD.push(id + ': ongeldig verbindingspunt ' + a.join(' ')); });
    return { id, av, gd, paths, rect, ah, cxn: cx.filter((a) => a.length === 3).map((a) => a.map(tk)) };
  };
  const get = (id) => CMP[id] || (CMP[id] = compile(id));

  /* ---------- Rekenen ---------- */
  const num = (v, t) => (typeof t === 'number' ? t : v[t] || 0);
  const adjVal = (x, dflt) => {
    if (typeof x === 'number') return Number.isFinite(x) ? x : dflt;
    if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(+x)) return +x;
    return dflt;
  };
  const evalS = (s, w, h, adj) => {
    const v = base(w, h);
    for (const k in s.av) v[k] = adj ? adjVal(adj[k], s.av[k]) : s.av[k];
    const gd = s.gd;
    for (let i = 0; i < gd.length; i++) { const g = gd[i]; v[g[0]] = cl(g[1](num(v, g[2]), num(v, g[3]), num(v, g[4]))); }
    return v;
  };

  /* ---------- Paden: boog en kwadratische curve → kubische Bézier ---------- */
  const f2 = (x) => {
    x = x > 1e7 ? 1e7 : x < -1e7 ? -1e7 : x || 0;
    x = Math.round(x * 100) / 100;
    return x === 0 ? '0' : '' + x;
  };
  const P = (x, y) => f2(x) + ' ' + f2(y);
  // OOXML arcTo: begint in het huidige punt; stAng/swAng zijn zichtbare hoeken (rechtsom) op de ellips wR × hR
  const arc = (st, wR, hR, a0, sw) => {
    if (!sw) return;
    const pa = (a) => Math.atan2(wR * Math.sin(a), hR * Math.cos(a));
    const s1 = a0 * RAD, s2 = (a0 + sw) * RAD, swr = sw * RAD;
    const t1 = pa(s1);
    let dt;
    if (Math.abs(swr) >= TAU - 1e-7) dt = swr > 0 ? TAU : -TAU;
    else {
      dt = pa(s2) - t1;
      if (swr > 0 && dt < 0) dt += TAU;
      else if (swr < 0 && dt > 0) dt -= TAU;
    }
    const cx = st.x - wR * Math.cos(t1), cy = st.y - hR * Math.sin(t1);
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), step = dt / n;
    const k = 4 / 3 * Math.tan(step / 4);
    let ca = Math.cos(t1), sa = Math.sin(t1);
    for (let i = 1; i <= n; i++) {
      const b = t1 + step * i, cb = Math.cos(b), sb = Math.sin(b);
      st.d += ' C' + P(cx + wR * (ca - k * sa), cy + hR * (sa + k * ca)) + ' ' + P(cx + wR * (cb + k * sb), cy + hR * (sb - k * cb)) + ' ' + P(cx + wR * cb, cy + hR * sb);
      ca = cb; sa = sb;
    }
    st.x = cx + wR * ca; st.y = cy + hR * sa;
  };
  const buildPaths = (s, v, w, h) => s.paths.map((p) => {
    const q = p.i ? 0.75 * Math.min(w, h) / 16 : 0;
    const sx = p.i ? q : p.w ? w / p.w : 1, sy = p.i ? q : p.h ? h / p.h : 1;
    const ox = p.i ? w / 2 - 8 * q : 0, oy = p.i ? h / 2 - 8 * q : 0;
    const X = (t) => ox + num(v, t) * sx, Y = (t) => oy + num(v, t) * sy;
    const st = { d: '', x: 0, y: 0 };
    let mx = 0, my = 0;
    for (let i = 0; i < p.c.length; i++) {
      const c = p.c[i][0], a = p.c[i][1];
      if (c === 'M' || c === 'L') {
        st.x = X(a[0]); st.y = Y(a[1]);
        if (c === 'M') { mx = st.x; my = st.y; }
        st.d += (st.d ? ' ' : '') + c + P(st.x, st.y);
      } else if (c === 'Z') { st.d += ' Z'; st.x = mx; st.y = my; }
      else if (c === 'A') arc(st, num(v, a[0]) * sx, num(v, a[1]) * sy, num(v, a[2]), num(v, a[3]));
      else if (c === 'Q') {
        const x1 = X(a[0]), y1 = Y(a[1]), x2 = X(a[2]), y2 = Y(a[3]);
        st.d += ' C' + P(st.x + (x1 - st.x) * 2 / 3, st.y + (y1 - st.y) * 2 / 3) + ' ' + P(x2 + (x1 - x2) * 2 / 3, y2 + (y1 - y2) * 2 / 3) + ' ' + P(x2, y2);
        st.x = x2; st.y = y2;
      } else if (c === 'C') {
        const x3 = X(a[4]), y3 = Y(a[5]);
        st.d += ' C' + P(X(a[0]), Y(a[1])) + ' ' + P(X(a[2]), Y(a[3])) + ' ' + P(x3, y3);
        st.x = x3; st.y = y3;
      }
    }
    return { d: st.d, fill: p.fill, stroke: p.stroke };
  });

  /* ---------- Rechthoeken ---------- */
  const CIRC = 'M l vc A wd2 hd2 cd2 cd4 A wd2 hd2 3cd4 cd4 A wd2 hd2 0 cd4 A wd2 hd2 cd4 cd4 Z';
  const IBOX = 'idx cos wd2 2700000;idy sin hd2 2700000;il +- hc 0 idx;ir +- hc idx 0;it +- vc 0 idy;ib +- vc idy 0';
  const ECX = '3cd4 hc t;3cd4 il it;cd2 l vc;cd4 il ib;cd4 hc b;cd4 ir ib;0 r vc;3cd4 ir it';
  D('rect', '', '', 'M l t L r t L r b L l b Z', 'l t r b', '', 'R');
  D('roundRect', 'adj=16667', 'a pin 0 adj 50000;x1 */ ss a 100000;x2 +- r 0 x1;y2 +- b 0 x1;il */ x1 29289 100000;ir +- r 0 il;ib +- b 0 il',
    'M l x1 A x1 x1 cd2 cd4 L x2 t A x1 x1 3cd4 cd4 L r y2 A x1 x1 0 cd4 L x1 b A x1 x1 cd4 cd4 Z', 'il il ir ib', 'X adj 0 50000 x1 t', 'R');
  D('snip1Rect', 'adj=16667', 'a pin 0 adj 50000;dx1 */ ss a 100000;x1 +- r 0 dx1;it */ dx1 1 2;ir +/ x1 r 2',
    'M l t L x1 t L r dx1 L r b L l b Z', 'l it ir b', 'X adj 0 50000 x1 t', 'R');
  D('snip2SameRect', 'adj1=16667 adj2=0', 'a1 pin 0 adj1 50000;a2 pin 0 adj2 50000;tx1 */ ss a1 100000;tx2 +- r 0 tx1;bx1 */ ss a2 100000;bx2 +- r 0 bx1;by1 +- b 0 bx1;d +- tx1 0 bx1;dx ?: d tx1 bx1;il */ dx 1 2;ir +- r 0 il;it */ tx1 1 2;ib +/ by1 b 2',
    'M tx1 t L tx2 t L r tx1 L r by1 L bx2 b L bx1 b L l by1 L l tx1 Z', 'il it ir ib', 'X adj1 0 50000 tx2 t;X adj2 0 50000 bx1 b', 'R');
  D('snip2DiagRect', 'adj1=0 adj2=16667', 'a1 pin 0 adj1 50000;a2 pin 0 adj2 50000;lx1 */ ss a1 100000;lx2 +- r 0 lx1;ly1 +- b 0 lx1;rx1 */ ss a2 100000;rx2 +- r 0 rx1;ry1 +- b 0 rx1;d +- lx1 0 rx1;dx ?: d lx1 rx1;il */ dx 1 2;ir +- r 0 il;ib +- b 0 il',
    'M lx1 t L rx2 t L r rx1 L r ly1 L lx2 b L rx1 b L l ry1 L l lx1 Z', 'il il ir ib', 'X adj1 0 50000 lx1 t;X adj2 0 50000 rx2 t', 'R');
  D('snipRoundRect', 'adj1=16667 adj2=16667', 'a1 pin 0 adj1 50000;a2 pin 0 adj2 50000;x1 */ ss a1 100000;dx2 */ ss a2 100000;x2 +- r 0 dx2;il */ x1 29289 100000;ir +/ x2 r 2',
    'M x1 t L x2 t L r dx2 L r b L l b L l x1 A x1 x1 cd2 cd4 Z', 'il il ir b', 'X adj1 0 50000 x1 t;X adj2 0 50000 x2 t', 'R');
  D('round1Rect', 'adj=16667', 'a pin 0 adj 50000;dx1 */ ss a 100000;x1 +- r 0 dx1;idx */ dx1 29289 100000;ir +- r 0 idx',
    'M l t L x1 t A dx1 dx1 3cd4 cd4 L r b L l b Z', 'l t ir b', 'X adj 0 50000 x1 t', 'R');
  D('round2SameRect', 'adj1=16667 adj2=0', 'a1 pin 0 adj1 50000;a2 pin 0 adj2 50000;tx1 */ ss a1 100000;tx2 +- r 0 tx1;bx1 */ ss a2 100000;bx2 +- r 0 bx1;by1 +- b 0 bx1;d +- tx1 0 bx1;tdx */ tx1 29289 100000;bdx */ bx1 29289 100000;il ?: d tdx bdx;ir +- r 0 il;ib +- b 0 bdx',
    'M tx1 t L tx2 t A tx1 tx1 3cd4 cd4 L r by1 A bx1 bx1 0 cd4 L bx1 b A bx1 bx1 cd4 cd4 L l tx1 A tx1 tx1 cd2 cd4 Z', 'il tdx ir ib', 'X adj1 0 50000 tx2 t;X adj2 0 50000 bx1 b', 'R');
  D('round2DiagRect', 'adj1=16667 adj2=0', 'a1 pin 0 adj1 50000;a2 pin 0 adj2 50000;x1 */ ss a1 100000;y1 +- b 0 x1;a */ ss a2 100000;x2 +- r 0 a;y2 +- b 0 a;dx1 */ x1 29289 100000;dx2 */ a 29289 100000;d +- dx1 0 dx2;dx ?: d dx1 dx2;ir +- r 0 dx;ib +- b 0 dx',
    'M x1 t L x2 t A a a 3cd4 cd4 L r y1 A x1 x1 0 cd4 L a b A a a cd4 cd4 L l x1 A x1 x1 cd2 cd4 Z', 'dx dx ir ib', 'X adj1 0 50000 x1 t;X adj2 0 50000 x2 t', 'R');

  /* ---------- Basisvormen: veelhoeken ---------- */
  D('ellipse', '', IBOX, CIRC, 'il it ir ib', '', ECX);
  D('triangle', 'adj=50000', 'a pin 0 adj 100000;x1 */ w a 200000;x2 */ w a 100000;x3 +- x1 wd2 0',
    'M l b L x2 t L r b Z', 'x1 vc x3 b', 'X adj 0 100000 x2 t', '3cd4 x2 t;cd2 x1 vc;cd4 l b;cd4 x2 b;cd4 r b;0 x3 vc');
  D('rtTriangle', '', 'it */ h 7 12;ir */ w 7 12;ib */ h 11 12', 'M l b L l t L r b Z', 'l it ir ib', '', '3cd4 l t;cd2 l vc;cd4 l b;cd4 hc b;0 r b;0 hc vc');
  D('diamond', '', 'ir */ w 3 4;ib */ h 3 4', 'M l vc L hc t L r vc L hc b Z', 'wd4 hd4 ir ib', '', 'R');
  D('parallelogram', 'adj=25000', 'maxAdj */ 100000 w ss;a pin 0 adj maxAdj;x1 */ ss a 200000;x2 */ ss a 100000;x6 +- r 0 x2;x5 +- r 0 x1;q1 */ 5 a maxAdj;q2 +/ 1 q1 12;il */ q2 w 1;it */ q2 h 1;ir +- r 0 il;ib +- b 0 it',
    'M l b L x2 t L r t L x6 b Z', 'il it ir ib', 'X adj 0 maxAdj x2 t', '3cd4 hc t;cd2 x1 vc;cd4 hc b;0 x5 vc');
  D('trapezoid', 'adj=25000', 'maxAdj */ 50000 w ss;a pin 0 adj maxAdj;x1 */ ss a 200000;x2 */ ss a 100000;x3 +- r 0 x2;x4 +- r 0 x1;il */ wd3 a maxAdj;it */ hd3 a maxAdj;ir +- r 0 il',
    'M l b L x2 t L x3 t L r b Z', 'il it ir b', 'X adj 0 maxAdj x2 t', '3cd4 hc t;cd2 x1 vc;cd4 hc b;0 x4 vc');
  D('nonIsoscelesTrapezoid', 'adj1=25000 adj2=25000', 'maxAdj */ 50000 w ss;a1 pin 0 adj1 maxAdj;a2 pin 0 adj2 maxAdj;x1 */ ss a1 200000;x2 */ ss a1 100000;dx3 */ ss a2 100000;x3 +- r 0 dx3;dx4 */ ss a2 200000;x4 +- r 0 dx4;il */ wd3 a1 maxAdj;it */ hd3 a1 maxAdj;dr */ wd3 a2 maxAdj;ir +- r 0 dr',
    'M l b L x2 t L x3 t L r b Z', 'il it ir b', 'X adj1 0 maxAdj x2 t;X adj2 0 maxAdj x3 t', '3cd4 hc t;cd2 x1 vc;cd4 hc b;0 x4 vc');
  D('pentagon', 'hf=105146 vf=110557', 'swd2 */ wd2 hf 100000;shd2 */ hd2 vf 100000;svc */ vc vf 100000;dx1 cos swd2 1080000;dx2 cos swd2 18360000;dy1 sin shd2 1080000;dy2 sin shd2 18360000;x1 +- hc 0 dx1;x2 +- hc 0 dx2;x3 +- hc dx2 0;x4 +- hc dx1 0;y1 +- svc 0 dy1;y2 +- svc 0 dy2;it */ y1 dx2 dx1',
    'M x1 y1 L hc t L x4 y1 L x3 y2 L x2 y2 Z', 'x2 it x3 y2', '', '3cd4 hc t;cd2 x1 y1;cd4 x2 y2;cd4 x3 y2;0 x4 y1');
  D('hexagon', 'adj=25000 vf=115470', 'maxAdj */ 50000 w ss;a pin 0 adj maxAdj;shd2 */ hd2 vf 100000;x1 */ ss a 100000;x2 +- r 0 x1;dy1 sin shd2 3600000;y1 +- vc 0 dy1;y2 +- vc dy1 0;q1 */ maxAdj -1 2;q2 +- a q1 0;q3 ?: q2 4 2;q4 ?: q2 3 2;q5 ?: q2 q1 0;q6 +/ a q5 q1;q7 */ q6 q4 -1;q8 +- q3 q7 0;il */ w q8 24;it */ h q8 24;ir +- r 0 il;ib +- b 0 it',
    'M l vc L x1 y1 L x2 y1 L r vc L x2 y2 L x1 y2 Z', 'il it ir ib', 'X adj 0 maxAdj x1 t', '0 r vc;cd4 x2 y2;cd4 x1 y2;cd2 l vc;3cd4 x1 y1;3cd4 x2 y1');
  D('heptagon', 'hf=102572 vf=105210', 'swd2 */ wd2 hf 100000;shd2 */ hd2 vf 100000;svc */ vc vf 100000;dx1 */ swd2 97493 100000;dx2 */ swd2 78183 100000;dx3 */ swd2 43388 100000;dy1 */ shd2 62349 100000;dy2 */ shd2 22252 100000;dy3 */ shd2 90097 100000;x1 +- hc 0 dx1;x2 +- hc 0 dx2;x3 +- hc 0 dx3;x4 +- hc dx3 0;x5 +- hc dx2 0;x6 +- hc dx1 0;y1 +- svc 0 dy1;y2 +- svc dy2 0;y3 +- svc dy3 0;ib +/ y2 y3 2',
    'M x1 y2 L x2 y1 L hc t L x5 y1 L x6 y2 L x4 y3 L x3 y3 Z', 'x2 y1 x5 ib', '', '3cd4 hc t;cd2 x2 y1;cd2 x1 y2;cd4 x3 y3;cd4 x4 y3;0 x6 y2;0 x5 y1');
  D('octagon', 'adj=29289', 'a pin 0 adj 50000;x1 */ ss a 100000;x2 +- r 0 x1;y2 +- b 0 x1;il */ x1 1 2;ir +- r 0 il;ib +- b 0 il',
    'M l x1 L x1 t L x2 t L r x1 L r y2 L x2 b L x1 b L l y2 Z', 'il il ir ib', 'X adj 0 50000 x1 t', '0 r x1;0 r y2;cd4 x2 b;cd4 x1 b;cd2 l y2;cd2 l x1;3cd4 x1 t;3cd4 x2 t');
  D('decagon', 'vf=105146', 'shd2 */ hd2 vf 100000;dx1 cos wd2 2160000;dx2 cos wd2 4320000;x1 +- hc 0 dx1;x2 +- hc 0 dx2;x3 +- hc dx2 0;x4 +- hc dx1 0;dy1 sin shd2 4320000;dy2 sin shd2 2160000;y1 +- vc 0 dy1;y2 +- vc 0 dy2;y3 +- vc dy2 0;y4 +- vc dy1 0',
    'M l vc L x1 y2 L x2 y1 L x3 y1 L x4 y2 L r vc L x4 y3 L x3 y4 L x2 y4 L x1 y3 Z', 'x1 y2 x4 y3', '', '0 r vc;cd4 x4 y3;cd4 x3 y4;cd4 x2 y4;cd2 x1 y3;cd2 l vc;cd2 x1 y2;3cd4 x2 y1;3cd4 x3 y1;0 x4 y2');
  D('dodecagon', '', 'x1 */ w 2894 21600;x2 */ w 7906 21600;x3 */ w 13694 21600;x4 */ w 18706 21600;y1 */ h 2894 21600;y2 */ h 7906 21600;y3 */ h 13694 21600;y4 */ h 18706 21600',
    'M l y2 L x1 y1 L x2 t L x3 t L x4 y1 L r y2 L r y3 L x4 y4 L x3 b L x2 b L x1 y4 L l y3 Z', 'x1 y1 x4 y4', '', '0 r y2;0 r y3;cd4 x4 y4;cd4 x3 b;cd4 x2 b;cd4 x1 y4;cd2 l y3;cd2 l y2;3cd4 x1 y1;3cd4 x2 t;3cd4 x3 t;3cd4 x4 y1');

  /* ---------- Basisvormen: eenvoudige vlakken ---------- */
  D('plaque', 'adj=16667', 'a pin 0 adj 50000;x1 */ ss a 100000;x2 +- r 0 x1;y2 +- b 0 x1;il */ x1 70711 100000;ir +- r 0 il;ib +- b 0 il',
    'M l x1 A x1 x1 cd4 -5400000 L x2 t A x1 x1 cd2 -5400000 L r y2 A x1 x1 3cd4 -5400000 L x1 b A x1 x1 0 -5400000 Z', 'il il ir ib', 'X adj 0 50000 x1 t', 'R');
  D('teardrop', 'adj=100000', 'a pin 0 adj 200000;r2 sqrt 2;tw */ r2 wd2 1;th */ r2 hd2 1;sw */ tw a 100000;sh */ th a 100000;dx1 cos sw 2700000;dy1 sin sh 2700000;x1 +- hc dx1 0;y1 +- vc 0 dy1;x2 +/ hc x1 2;y2 +/ vc y1 2;' + IBOX,
    'M l vc A wd2 hd2 cd2 cd4 Q x2 t x1 y1 Q r y2 r vc A wd2 hd2 0 cd4 A wd2 hd2 cd4 cd4 Z', 'il it ir ib', 'X adj 0 200000 x1 t', 'R');
  D('frame', 'adj1=12500', 'a1 pin 0 adj1 50000;x1 */ ss a1 100000;x4 +- r 0 x1;y4 +- b 0 x1',
    'M l t L r t L r b L l b Z M x1 x1 L x1 y4 L x4 y4 L x4 x1 Z', 'x1 x1 x4 y4', 'X adj1 0 50000 x1 t', 'R');
  D('halfFrame', 'adj1=33333 adj2=33333', 'maxAdj2 */ 100000 w ss;a2 pin 0 adj2 maxAdj2;x1 */ ss a2 100000;g1 */ h x1 w;g2 +- h 0 g1;maxAdj1 */ 100000 g2 ss;a1 pin 0 adj1 maxAdj1;y1 */ ss a1 100000;dx2 */ y1 w h;x2 +- r 0 dx2;dy2 */ x1 h w;y2 +- b 0 dy2;cx1 */ x1 1 2;cy1 +/ y2 b 2;cx2 +/ x2 r 2;cy2 */ y1 1 2',
    'M l t L r t L x2 y1 L x1 y1 L x1 y2 L l b Z', 'l t r b', 'Y adj1 0 maxAdj1 l y1;X adj2 0 maxAdj2 x1 t', '0 cx2 cy2;cd4 cx1 cy1;cd2 l vc;3cd4 hc t');
  D('corner', 'adj1=50000 adj2=50000', 'maxAdj1 */ 100000 h ss;maxAdj2 */ 100000 w ss;a1 pin 0 adj1 maxAdj1;a2 pin 0 adj2 maxAdj2;x1 */ ss a2 100000;dy1 */ ss a1 100000;y1 +- b 0 dy1;cx1 */ x1 1 2;cy1 +/ y1 b 2;d +- w 0 h;it ?: d y1 t;ir ?: d r x1',
    'M l t L x1 t L x1 y1 L r y1 L r b L l b Z', 'l it ir b', 'Y adj1 0 maxAdj1 l y1;X adj2 0 maxAdj2 x1 t', '0 r cy1;cd4 hc b;cd2 l vc;3cd4 cx1 t');
  D('diagStripe', 'adj=50000', 'a pin 0 adj 100000;x2 */ w a 100000;x1 */ x2 1 2;x3 +/ x2 r 2;y2 */ h a 100000;y1 */ y2 1 2;y3 +/ y2 b 2',
    'M l y2 L x2 t L r t L l b Z', 'l t x3 y3', 'Y adj 0 100000 l y2', '3cd4 x3 t;cd2 l y3;cd2 x1 y1;0 hc vc');
  D('plus', 'adj=25000', 'a pin 0 adj 50000;x1 */ ss a 100000;x2 +- r 0 x1;y2 +- b 0 x1;d +- w 0 h;il ?: d l x1;ir ?: d r x2;it ?: d x1 t;ib ?: d y2 b',
    'M l x1 L x1 x1 L x1 t L x2 t L x2 x1 L r x1 L r y2 L x2 y2 L x2 b L x1 b L x1 y2 L l y2 Z', 'il it ir ib', 'X adj 0 50000 x1 t', 'R');
  /* ---------- Basisvormen: bogen en cirkeldelen ---------- */
  const ANG2 = 'stAng pin 0 adj1 21599999;enAng pin 0 adj2 21599999;sw1 +- enAng 0 stAng;sw2 +- sw1 21600000 0;swAng ?: sw1 sw1 sw2;wt1 sin wd2 stAng;ht1 cos hd2 stAng;dx1 cat2 wd2 ht1 wt1;dy1 sat2 hd2 ht1 wt1;x1 +- hc dx1 0;y1 +- vc dy1 0;wt2 sin wd2 enAng;ht2 cos hd2 enAng;dx2 cat2 wd2 ht2 wt2;dy2 sat2 hd2 ht2 wt2;x2 +- hc dx2 0;y2 +- vc dy2 0;';
  const PH2 = 'P - - - adj1 0 21599999 x1 y1;P - - - adj2 0 21599999 x2 y2';
  D('pie', 'adj1=0 adj2=16200000', ANG2 + IBOX, 'M x1 y1 A wd2 hd2 stAng swAng L hc vc Z', 'il it ir ib', PH2, '0 x1 y1;0 x2 y2;0 hc vc');
  D('chord', 'adj1=2700000 adj2=16200000', ANG2 + 'x3 +/ x1 x2 2;y3 +/ y1 y2 2;midAng0 */ swAng 1 2;midAng +- stAng midAng0 cd2;' + IBOX,
    'M x1 y1 A wd2 hd2 stAng swAng Z', 'il it ir ib', PH2, 'stAng x1 y1;enAng x2 y2;midAng x3 y3');
  D('arc', 'adj1=16200000 adj2=0', ANG2 + IBOX, '~s M x1 y1 A wd2 hd2 stAng swAng L hc vc Z | ~n M x1 y1 A wd2 hd2 stAng swAng', 'il it ir ib', PH2, 'stAng x1 y1;enAng x2 y2');
  D('pieWedge', '', 'g1 cos w 13500000;g2 sin h 13500000;x1 +- r g1 0;y1 +- b g2 0', 'M l b A w h cd2 cd4 L r b Z', 'x1 y1 r b', '', '3cd4 r t;cd4 hc b;cd2 l b;0 r vc');
  D('blockArc', 'adj1=10800000 adj2=0 adj3=25000', 'stAng pin 0 adj1 21599999;istAng pin 0 adj2 21599999;a3 pin 0 adj3 50000;sw11 +- istAng 0 stAng;sw12 +- sw11 21600000 0;swAng ?: sw11 sw11 sw12;iswAng +- 0 0 swAng;wt1 sin wd2 stAng;ht1 cos hd2 stAng;wt3 sin wd2 istAng;ht3 cos hd2 istAng;dx1 cat2 wd2 ht1 wt1;dy1 sat2 hd2 ht1 wt1;dx3 cat2 wd2 ht3 wt3;dy3 sat2 hd2 ht3 wt3;x1 +- hc dx1 0;y1 +- vc dy1 0;x3 +- hc dx3 0;y3 +- vc dy3 0;dr */ ss a3 100000;iwd2 +- wd2 0 dr;ihd2 +- hd2 0 dr;wt2 sin iwd2 istAng;ht2 cos ihd2 istAng;wt4 sin iwd2 stAng;ht4 cos ihd2 stAng;dx2 cat2 iwd2 ht2 wt2;dy2 sat2 ihd2 ht2 wt2;dx4 cat2 iwd2 ht4 wt4;dy4 sat2 ihd2 ht4 wt4;x2 +- hc dx2 0;y2 +- vc dy2 0;x4 +- hc dx4 0;y4 +- vc dy4 0;' + IBOX,
    'M x1 y1 A wd2 hd2 stAng swAng L x2 y2 A iwd2 ihd2 istAng iswAng Z', 'il it ir ib', 'P - - - adj1 0 21599999 x1 y1;P adj3 0 50000 adj2 0 21599999 x2 y2', 'stAng x1 y1;istAng x3 y3;istAng x2 y2;stAng x4 y4');
  D('donut', 'adj=25000', 'a pin 0 adj 50000;dr */ ss a 100000;iwd2 +- wd2 0 dr;ihd2 +- hd2 0 dr;' + IBOX,
    CIRC + ' M dr vc A iwd2 ihd2 cd2 -5400000 A iwd2 ihd2 cd4 -5400000 A iwd2 ihd2 0 -5400000 A iwd2 ihd2 3cd4 -5400000 Z', 'il it ir ib', 'X adj 0 50000 dr vc', ECX);
  D('noSmoking', 'adj=18750', 'a pin 0 adj 50000;dr */ ss a 100000;iwd2 +- wd2 0 dr;ihd2 +- hd2 0 dr;ang at2 w h;ct cos ihd2 ang;st sin iwd2 ang;m mod ct st 0;n */ iwd2 ihd2 m;drd2 */ dr 1 2;dang at2 n drd2;dang2 */ dang 2 1;swAng +- -10800000 dang2 0;t3 at2 w h;stAng1 +- t3 0 dang;stAng2 +- stAng1 0 cd2;ct1 cos ihd2 stAng1;st1 sin iwd2 stAng1;m1 mod ct1 st1 0;n1 */ iwd2 ihd2 m1;dx1 cos n1 stAng1;dy1 sin n1 stAng1;x1 +- hc dx1 0;y1 +- vc dy1 0;x2 +- hc 0 dx1;y2 +- vc 0 dy1;' + IBOX,
    CIRC + ' M x1 y1 A iwd2 ihd2 stAng1 swAng Z M x2 y2 A iwd2 ihd2 stAng2 swAng Z', 'il it ir ib', 'X adj 0 50000 dr vc', ECX);

  /* ---------- Basisvormen: ruimtelijk ---------- */
  D('can', 'adj=25000', 'maxAdj */ 50000 h ss;a pin 0 adj maxAdj;y1 */ ss a 200000;y2 +- y1 y1 0;y3 +- b 0 y1',
    '~s M l y1 A wd2 y1 cd2 -10800000 L r y3 A wd2 y1 0 cd2 Z | ~s ~l M l y1 A wd2 y1 cd2 cd2 A wd2 y1 0 cd2 Z | ~n M r y1 A wd2 y1 0 cd2 A wd2 y1 cd2 cd2 L r y3 A wd2 y1 0 cd2 L l y1',
    'l y2 r y3', 'Y adj 0 maxAdj hc y2', '3cd4 hc y2;cd2 l vc;cd4 hc b;0 r vc');
  D('cube', 'adj=25000', 'a pin 0 adj 100000;y1 */ ss a 100000;y4 +- b 0 y1;y2 */ y4 1 2;y3 +/ y1 b 2;x4 +- r 0 y1;x2 */ x4 1 2;x3 +/ y1 r 2',
    '~s M l y1 L x4 y1 L x4 b L l b Z | ~s ~D M x4 y1 L r t L r y4 L x4 b Z | ~s ~L M l y1 L y1 t L r t L x4 y1 Z | ~n M l y1 L y1 t L r t L r y4 L x4 b L l b Z M l y1 L x4 y1 L r t M x4 y1 L x4 b',
    'l y1 x4 b', 'Y adj 0 100000 l y1', '3cd4 x3 t;cd2 x2 y1;cd2 l y3;cd4 x2 b;0 x4 y3;0 r y2');
  D('bevel', 'adj=12500', 'a pin 0 adj 50000;x1 */ ss a 100000;x2 +- r 0 x1;y2 +- b 0 x1',
    '~s M x1 x1 L x2 x1 L x2 y2 L x1 y2 Z | ~s ~L M l t L r t L x2 x1 L x1 x1 Z | ~s ~d M l b L x1 y2 L x2 y2 L r b Z | ~s ~l M l t L x1 x1 L x1 y2 L l b Z | ~s ~D M r t L r b L x2 y2 L x2 x1 Z | ~n M l t L r t L r b L l b Z M x1 x1 L x2 x1 L x2 y2 L x1 y2 Z M l t L x1 x1 M l b L x1 y2 M r t L x2 x1 M r b L x2 y2',
    'x1 x1 x2 y2', 'X adj 0 50000 x1 t', '0 r vc;cd4 hc b;cd2 l vc;3cd4 hc t');
  D('foldedCorner', 'adj=16667', 'a pin 0 adj 50000;dy2 */ ss a 100000;dy1 */ dy2 1 5;x1 +- r 0 dy2;x2 +- x1 dy1 0;y2 +- b 0 dy2;y1 +- y2 dy1 0',
    '~s M l t L r t L r y2 L x1 b L l b Z | ~s ~D M x1 b L x2 y1 L r y2 Z | ~n M x1 b L x2 y1 L r y2 L x1 b L l b L l t L r t L r y2',
    'l t r y2', 'X adj 0 50000 x1 b', 'R');

  /* ---------- Basisvormen: symbolen ---------- */
  D('smileyFace', 'adj=4653', 'a pin -4653 adj 4653;x1 */ w 4813 21600;x2 */ w 6215 21600;x3 */ w 13135 21600;x4 */ w 16786 21600;y1 */ h 7425 21600;y3 */ h 16515 21600;dy2 */ h a 100000;y2 +- y3 0 dy2;y4 +- y3 dy2 0;dy3 */ h a 50000;y5 +- y4 dy3 0;wR */ w 1125 21600;hR */ h 1125 21600;' + IBOX,
    CIRC + ' | ~D M x2 y1 A wR hR cd2 21600000 Z M x3 y1 A wR hR cd2 21600000 Z | ~n M x1 y2 Q hc y5 x4 y2 | ~n ' + CIRC,
    'il it ir ib', 'Y adj -4653 4653 hc y4', ECX);
  D('heart', '', 'dx1 */ w 49 48;dx2 */ w 10 48;x1 +- hc 0 dx1;x2 +- hc 0 dx2;x3 +- hc dx2 0;x4 +- hc dx1 0;y1 +- t 0 hd3;il */ w 1 6;ir */ w 5 6;ib */ h 2 3',
    'M hc hd4 C x3 y1 x4 hd4 hc b C x1 hd4 x2 y1 hc hd4 Z', 'il hd4 ir ib', '', '3cd4 hc hd4;cd4 hc b');
  D('lightningBolt', '', 'x1 */ w 5022 21600;x3 */ w 8472 21600;x4 */ w 8757 21600;x5 */ w 10012 21600;x8 */ w 12860 21600;x9 */ w 13917 21600;x11 */ w 16577 21600;y1 */ h 3890 21600;y2 */ h 6080 21600;y4 */ h 7437 21600;y6 */ h 9705 21600;y7 */ h 12007 21600;y10 */ h 14277 21600;y11 */ h 14915 21600',
    '~w21600 ~h21600 M 8472 0 L 12860 6080 L 11050 6797 L 16577 12007 L 14767 12877 L 21600 21600 L 10012 14915 L 12222 13987 L 5022 9705 L 7602 8382 L 0 3890 Z',
    'x4 y4 x9 y10', '', '3cd4 x3 t;cd2 l y1;cd2 x1 y6;cd4 x5 y11;cd4 r b;0 x11 y7;0 x8 y2');
  D('sun', 'adj=25000', 'a pin 12500 adj 46875;g0 +- 50000 0 a;g1 */ g0 30274 32768;g2 */ g0 12540 32768;g5 +- 50000 0 g1;g6 +- 50000 0 g2;g7 */ g0 23170 32768;g8 +- 50000 g7 0;g9 +- 50000 0 g7;g10 */ g5 3 4;g11 */ g6 3 4;g12 +- g10 3662 0;g13 +- g11 3662 0;g14 +- g11 12500 0;g15 +- 100000 0 g10;g16 +- 100000 0 g12;g17 +- 100000 0 g13;g18 +- 100000 0 g14;ox1 */ w 18436 21600;oy1 */ h 3163 21600;ox2 */ w 3163 21600;oy2 */ h 18436 21600;x8 */ w g8 100000;x9 */ w g9 100000;x10 */ w g10 100000;x12 */ w g12 100000;x13 */ w g13 100000;x14 */ w g14 100000;x15 */ w g15 100000;x16 */ w g16 100000;x17 */ w g17 100000;x18 */ w g18 100000;x19 */ w a 100000;wR */ w g0 100000;hR */ h g0 100000;y8 */ h g8 100000;y9 */ h g9 100000;y10 */ h g10 100000;y12 */ h g12 100000;y13 */ h g13 100000;y14 */ h g14 100000;y15 */ h g15 100000;y16 */ h g16 100000;y17 */ h g17 100000;y18 */ h g18 100000',
    'M r vc L x15 y18 L x15 y14 Z M ox1 oy1 L x16 y13 L x17 y12 Z M hc t L x18 y10 L x14 y10 Z M ox2 oy1 L x13 y12 L x12 y13 Z M l vc L x10 y14 L x10 y18 Z M ox2 oy2 L x12 y17 L x13 y16 Z M hc b L x14 y15 L x18 y15 Z M ox1 oy2 L x17 y16 L x16 y17 Z M x19 vc A wR hR cd2 21600000 Z',
    'x9 y9 x8 y8', 'X adj 12500 46875 x19 vc', 'R');
  D('moon', 'adj=50000', 'a pin 0 adj 87500;g0 */ ss a 100000;g0w */ g0 w ss;g1 +- ss 0 g0;g2 */ g0 g0 g1;g3 */ ss ss g1;g4 */ g3 2 1;g5 +- g4 0 g2;g6 +- g5 0 g0;g6w */ g6 w ss;g7 */ g5 1 2;g8 +- g7 0 g0;dy1 */ g8 hd2 ss;g12 */ g0 9598 32768;g12w */ g12 w ss;g13 +- ss 0 g12;q1 */ ss ss 1;q2 */ g13 g13 1;q3 +- q1 0 q2;q4 sqrt q3;dy4 */ q4 hd2 ss;g15h +- vc 0 dy4;g16h +- vc dy4 0;g17w +- g6w 0 g0w;g18w */ g17w 1 2;dx2p +- g0w g18w w;dx2 */ dx2p -1 1;dy2 */ hd2 -1 1;stAng1 at2 dx2 dy2;enAngp1 at2 dx2 hd2;enAng1 +- enAngp1 0 21600000;swAng1 +- enAng1 0 stAng1',
    'M r b A w hd2 cd4 cd2 A g18w dy1 stAng1 swAng1 Z', 'g12w g15h g0w g16h', 'X adj 0 87500 g0w vc', '3cd4 r t;cd2 l vc;cd4 r b;0 g0w vc');
  const CLOUD = 'M 3900 14370 A 6753 9190 -11429249 7426832 A 5333 7267 -8646143 5396714 A 4365 5945 -8748475 5983381 A 4857 6595 -7859164 7034504 A 5333 7273 -4722533 6541615 A 6775 9220 -2776035 7816140 A 5785 7867 37501 6842000 A 6752 9215 1347096 6910353 A 7720 10543 3974558 4542661 A 4360 5918 -16496525 8804134 A 4345 5945 -14809710 9151131 Z';
  const CLOUD2 = 'M 4693 26177 A 4345 5945 5204520 1585770 M 6928 34899 A 4360 5918 4416628 686848 M 16478 39090 A 6752 9215 8257449 844866 M 28827 34751 A 6752 9215 387196 959901 M 34129 22954 A 5785 7867 -4217541 4255042 M 41798 15354 A 5333 7273 1819082 1665090 M 38324 5426 A 4857 6595 -824660 891534 M 29078 3952 A 4857 6595 -8950887 1091722 M 22141 4720 A 4365 5945 -9809656 1061181 M 14000 5192 A 6753 9190 -4002417 739161 M 4127 15789 A 6753 9190 9459261 711490';
  const CLOUDG = 'il */ w 2977 21600;it */ h 3262 21600;ir */ w 17087 21600;ib */ h 17337 21600;g27 */ w 67 21600;g28 */ h 21577 21600;g29 */ w 21582 21600;g30 */ h 1235 21600;cx1 */ w 16740 43200;cy1 */ h 41500 43200;cx2 */ w 42900 43200;cy2 */ h 21100 43200;cx3 */ w 300 43200;cy3 */ h 19800 43200;cx4 */ w 23500 43200;cy4 */ h 2200 43200;';
  D('cloud', '', CLOUDG, '~w43200 ~h43200 ' + CLOUD + ' | ~n ~w43200 ~h43200 ' + CLOUD2, 'il it ir ib', '', '0 cx2 cy2;cd4 cx1 cy1;cd2 cx3 cy3;3cd4 cx4 cy4');

  /* ---------- Haken en accolades ---------- */
  D('bracketPair', 'adj=16667', 'a pin 0 adj 50000;x1 */ ss a 100000;x2 +- r 0 x1;y2 +- b 0 x1;il */ x1 29289 100000;ir +- r 0 il;ib +- b 0 il',
    '~s M l x1 A x1 x1 cd2 cd4 L x2 t A x1 x1 3cd4 cd4 L r y2 A x1 x1 0 cd4 L x1 b A x1 x1 cd4 cd4 Z | ~n M x1 b A x1 x1 cd4 cd4 L l x1 A x1 x1 cd2 cd4 M x2 t A x1 x1 3cd4 cd4 L r y2 A x1 x1 0 cd4',
    'il il ir ib', 'X adj 0 50000 l x1', 'R');
  const BRP = 'M x2 b A x1 x1 cd4 cd4 L x1 y3 A x1 x1 0 -5400000 A x1 x1 cd4 -5400000 L x1 x1 A x1 x1 cd2 cd4 ';
  const BRQ = 'x3 t A x1 x1 3cd4 cd4 L x4 y2 A x1 x1 cd2 -5400000 A x1 x1 3cd4 -5400000 L x4 y4 A x1 x1 0 cd4';
  D('bracePair', 'adj=8333', 'a pin 0 adj 25000;x1 */ ss a 100000;x2 */ ss a 50000;x3 +- r 0 x2;x4 +- r 0 x1;y2 +- vc 0 x1;y3 +- vc x1 0;y4 +- b 0 x1;it */ x1 29289 100000;il +- x1 it 0;ir +- r 0 il;ib +- b 0 it',
    '~s ' + BRP + 'L ' + BRQ + ' Z | ~n ' + BRP + 'M ' + BRQ, 'il il ir ib', 'Y adj 0 25000 l x1', 'R');
  D('leftBracket', 'adj=8333', 'maxAdj */ 50000 h ss;a pin 0 adj maxAdj;y1 */ ss a 100000;y2 +- b 0 y1;dx1 cos w 2700000;dy1 sin y1 2700000;il +- r 0 dx1;it +- y1 0 dy1;ib +- b dy1 y1',
    '~s M r b A w y1 cd4 cd4 L l y1 A w y1 cd2 cd4 Z | ~n M r b A w y1 cd4 cd4 L l y1 A w y1 cd2 cd4', 'il it r ib', 'Y adj 0 maxAdj l y1', '3cd4 r t;cd2 l vc;cd4 r b');
  D('rightBracket', 'adj=8333', 'maxAdj */ 50000 h ss;a pin 0 adj maxAdj;y1 */ ss a 100000;y2 +- b 0 y1;dx1 cos w 2700000;dy1 sin y1 2700000;ir +- l dx1 0;it +- y1 0 dy1;ib +- b dy1 y1',
    '~s M l t A w y1 3cd4 cd4 L r y2 A w y1 0 cd4 Z | ~n M l t A w y1 3cd4 cd4 L r y2 A w y1 0 cd4', 'l it ir ib', 'Y adj 0 maxAdj r y1', '3cd4 l t;cd4 l b;0 r vc');
  const BRG = 'a2 pin 0 adj2 100000;q1 +- 100000 0 a2;q2 min q1 a2;q3 */ q2 1 2;maxAdj1 */ q3 h ss;a1 pin 0 adj1 maxAdj1;y1 */ ss a1 100000;y3 */ h a2 100000;y2 +- y3 0 y1;y4 +- y3 y1 0;y5 +- b 0 y1;dx1 cos wd2 2700000;dy1 sin y1 2700000;il +- r 0 dx1;ir +- l dx1 0;it +- y1 0 dy1;ib +- b dy1 y1';
  const LBR = 'M r b A wd2 y1 cd4 cd4 L hc y4 A wd2 y1 0 -5400000 A wd2 y1 cd4 -5400000 L hc y1 A wd2 y1 cd2 cd4';
  const RBR = 'M l t A wd2 y1 3cd4 cd4 L hc y2 A wd2 y1 cd2 -5400000 A wd2 y1 3cd4 -5400000 L hc y5 A wd2 y1 0 cd4';
  D('leftBrace', 'adj1=8333 adj2=50000', BRG, '~s ' + LBR + ' Z | ~n ' + LBR, 'il it r ib', 'Y adj1 0 maxAdj1 hc y1;Y adj2 0 100000 l y3', '3cd4 r t;cd2 l y3;cd4 r b');
  D('rightBrace', 'adj1=8333 adj2=50000', BRG, '~s ' + RBR + ' Z | ~n ' + RBR, 'l it ir ib', 'Y adj1 0 maxAdj1 hc y1;Y adj2 0 100000 r y3', '3cd4 l t;cd4 l b;0 r y3');
  /* ---------- Blokpijlen: rechte pijlen ---------- */
  D('rightArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 100000 w ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;dx1 */ ss a2 100000;x1 +- r 0 dx1;dy1 */ h a1 200000;y1 +- vc 0 dy1;y2 +- vc dy1 0;dx2 */ y1 dx1 hd2;x2 +- x1 dx2 0',
    'M l y1 L x1 y1 L x1 t L r vc L x1 b L x1 y2 L l y2 Z', 'l y1 x2 y2', 'Y adj1 0 100000 l y1;X adj2 0 maxAdj2 x1 t', '3cd4 x1 t;cd2 l vc;cd4 x1 b;0 r vc');
  D('leftArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 100000 w ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;dx2 */ ss a2 100000;x2 +- l dx2 0;dy1 */ h a1 200000;y1 +- vc 0 dy1;y2 +- vc dy1 0;dx1 */ y1 dx2 hd2;x1 +- x2 0 dx1',
    'M l vc L x2 t L x2 y1 L r y1 L r y2 L x2 y2 L x2 b Z', 'x1 y1 r y2', 'Y adj1 0 100000 r y1;X adj2 0 maxAdj2 x2 t', '3cd4 x2 t;cd2 l vc;cd4 x2 b;0 r vc');
  D('upArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 100000 h ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;dy2 */ ss a2 100000;y2 +- t dy2 0;dx1 */ w a1 200000;x1 +- hc 0 dx1;x2 +- hc dx1 0;dy1 */ x1 dy2 wd2;y1 +- y2 0 dy1',
    'M l y2 L hc t L r y2 L x2 y2 L x2 b L x1 b L x1 y2 Z', 'x1 y1 x2 b', 'X adj1 0 100000 x1 b;Y adj2 0 maxAdj2 l y2', '3cd4 hc t;cd2 l y2;cd4 hc b;0 r y2');
  D('downArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 100000 h ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;dy1 */ ss a2 100000;y1 +- b 0 dy1;dx1 */ w a1 200000;x1 +- hc 0 dx1;x2 +- hc dx1 0;dy2 */ x1 dy1 wd2;y2 +- y1 dy2 0',
    'M l y1 L x1 y1 L x1 t L x2 t L x2 y1 L r y1 L hc b Z', 'x1 t x2 y2', 'X adj1 0 100000 x1 t;Y adj2 0 maxAdj2 r y1', '3cd4 hc t;cd2 l y1;cd4 hc b;0 r y1');
  D('leftRightArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 50000 w ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;x2 */ ss a2 100000;x3 +- r 0 x2;dy */ h a1 200000;y1 +- vc 0 dy;y2 +- vc dy 0;dx1 */ y1 x2 hd2;x1 +- x2 0 dx1;x4 +- x3 dx1 0',
    'M l vc L x2 t L x2 y1 L x3 y1 L x3 t L r vc L x3 b L x3 y2 L x2 y2 L x2 b Z', 'x1 y1 x4 y2', 'Y adj1 0 100000 x3 y1;X adj2 0 maxAdj2 x2 t', '3cd4 x2 t;3cd4 x3 t;cd2 l vc;cd4 x2 b;cd4 x3 b;0 r vc');
  D('upDownArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 50000 h ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;y2 */ ss a2 100000;y3 +- b 0 y2;dx1 */ w a1 200000;x1 +- hc 0 dx1;x2 +- hc dx1 0;dy1 */ x1 y2 wd2;y1 +- y2 0 dy1;y4 +- y3 dy1 0',
    'M l y2 L hc t L r y2 L x2 y2 L x2 y3 L r y3 L hc b L l y3 L x1 y3 L x1 y2 Z', 'x1 y1 x2 y4', 'X adj1 0 100000 x1 y3;Y adj2 0 maxAdj2 l y2', '3cd4 hc t;cd2 l y2;cd2 l y3;cd4 hc b;0 r y3;0 r y2');
  D('quadArrow', 'adj1=22500 adj2=22500 adj3=22500', 'a2 pin 0 adj2 50000;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;q1 +- 100000 0 maxAdj1;maxAdj3 */ q1 1 2;a3 pin 0 adj3 maxAdj3;x1 */ ss a3 100000;dx2 */ ss a2 100000;x2 +- hc 0 dx2;x5 +- hc dx2 0;dx3 */ ss a1 200000;x3 +- hc 0 dx3;x4 +- hc dx3 0;x6 +- r 0 x1;y2 +- vc 0 dx2;y5 +- vc dx2 0;y3 +- vc 0 dx3;y4 +- vc dx3 0;y6 +- b 0 x1;il */ dx3 x1 dx2;ir +- r 0 il',
    'M l vc L x1 y2 L x1 y3 L x3 y3 L x3 x1 L x2 x1 L hc t L x5 x1 L x4 x1 L x4 y3 L x6 y3 L x6 y2 L r vc L x6 y5 L x6 y4 L x4 y4 L x4 y6 L x5 y6 L hc b L x2 y6 L x3 y6 L x3 y4 L x1 y4 L x1 y5 Z',
    'il y3 ir y4', 'X adj1 0 maxAdj1 x3 x1;X adj2 0 50000 x2 t;Y adj3 0 maxAdj3 r x1', 'R');
  D('leftRightUpArrow', 'adj1=25000 adj2=25000 adj3=25000', 'a2 pin 0 adj2 50000;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;q1 +- 100000 0 maxAdj1;maxAdj3 */ q1 1 2;a3 pin 0 adj3 maxAdj3;x1 */ ss a3 100000;dx2 */ ss a2 100000;x2 +- hc 0 dx2;x5 +- hc dx2 0;dx3 */ ss a1 200000;x3 +- hc 0 dx3;x4 +- hc dx3 0;x6 +- r 0 x1;dy2 */ ss a2 50000;y2 +- b 0 dy2;y4 +- b 0 dx2;y3 +- y4 0 dx3;y5 +- y4 dx3 0;il */ dx3 x1 dx2;ir +- r 0 il',
    'M l y4 L x1 y2 L x1 y3 L x3 y3 L x3 x1 L x2 x1 L hc t L x5 x1 L x4 x1 L x4 y3 L x6 y3 L x6 y2 L r y4 L x6 b L x6 y5 L x1 y5 L x1 b Z',
    'il y3 ir y5', 'X adj1 0 maxAdj1 x3 x1;X adj2 0 50000 x2 t;Y adj3 0 maxAdj3 r x1', '3cd4 hc t;cd2 l y4;cd4 hc y5;0 r y4');
  D('leftUpArrow', 'adj1=25000 adj2=25000 adj3=25000', 'a2 pin 0 adj2 50000;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;maxAdj3 +- 100000 0 maxAdj1;a3 pin 0 adj3 maxAdj3;x1 */ ss a3 100000;dx2 */ ss a2 50000;x2 +- r 0 dx2;y2 +- b 0 dx2;dx4 */ ss a2 100000;x4 +- r 0 dx4;y4 +- b 0 dx4;dx3 */ ss a1 200000;x3 +- x4 0 dx3;x5 +- x4 dx3 0;y3 +- y4 0 dx3;y5 +- y4 dx3 0;il */ dx3 x1 dx4;cx1 +/ x1 x5 2;cy1 +/ x1 y5 2',
    'M l y4 L x1 y2 L x1 y3 L x3 y3 L x3 x1 L x2 x1 L x4 t L r x1 L x5 x1 L x5 y5 L x1 y5 L x1 b Z',
    'il y3 x4 y5', 'X adj1 0 maxAdj1 x3 y3;X adj2 0 50000 x2 t;Y adj3 0 maxAdj3 x3 x1', '3cd4 x4 t;cd2 x2 x1;3cd4 x1 y2;cd2 l y4;cd4 x1 b;cd4 cx1 y5;0 x5 cy1;0 r x1');
  D('bentUpArrow', 'adj1=25000 adj2=25000 adj3=25000', 'a1 pin 0 adj1 50000;a2 pin 0 adj2 50000;a3 pin 0 adj3 50000;y1 */ ss a3 100000;dx1 */ ss a2 50000;x1 +- r 0 dx1;dx3 */ ss a2 100000;x3 +- r 0 dx3;dx2 */ ss a1 200000;x2 +- x3 0 dx2;x4 +- x3 dx2 0;dy2 */ ss a1 100000;y2 +- b 0 dy2;x0 */ x4 1 2;y3 +/ y2 b 2;y15 +/ y1 b 2',
    'M l y2 L x2 y2 L x2 y1 L x1 y1 L x3 t L r y1 L x4 y1 L x4 b L l b Z', 'l y2 x4 b', 'Y adj1 0 50000 l y2;X adj2 0 50000 x1 t;Y adj3 0 50000 x3 y1', '3cd4 x3 t;cd2 x1 y1;cd2 l y3;cd4 x0 b;0 x4 y15;0 r y1');
  D('bentArrow', 'adj1=25000 adj2=25000 adj3=25000 adj4=43750', 'a2 pin 0 adj2 50000;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;a3 pin 0 adj3 50000;th */ ss a1 100000;aw2 */ ss a2 100000;th2 */ th 1 2;dh2 +- aw2 0 th2;ah */ ss a3 100000;bw +- r 0 ah;bh +- b 0 dh2;bs min bw bh;maxAdj4 */ 100000 bs ss;a4 pin 0 adj4 maxAdj4;bd */ ss a4 100000;bd3 +- bd 0 th;bd2 max bd3 0;x3 +- th bd2 0;x4 +- r 0 ah;y3 +- dh2 th 0;y4 +- y3 dh2 0;y5 +- dh2 bd 0;y6 +- y3 bd2 0',
    'M l b L l y5 A bd bd cd2 cd4 L x4 dh2 L x4 t L r aw2 L x4 y4 L x4 y3 L x3 y3 A bd2 bd2 3cd4 -5400000 L th b Z', 'l t r b',
    'X adj1 0 maxAdj1 th b;Y adj2 0 50000 r y4;X adj3 0 50000 x4 t;X adj4 0 maxAdj4 bd t', '3cd4 x4 t;cd4 x4 y4;cd4 th2 b;0 r aw2');
  D('uturnArrow', 'adj1=25000 adj2=25000 adj3=25000 adj4=43750 adj5=75000', 'a2 pin 0 adj2 25000;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;q2 */ a1 ss h;q3 +- 100000 0 q2;maxAdj3 */ q3 h ss;a3 pin 0 adj3 maxAdj3;q1 +- a3 a1 0;minAdj5 */ q1 ss h;a5 pin minAdj5 adj5 100000;th */ ss a1 100000;aw2 */ ss a2 100000;th2 */ th 1 2;dh2 +- aw2 0 th2;y5 */ h a5 100000;ah */ ss a3 100000;y4 +- y5 0 ah;x9 +- r 0 dh2;bw */ x9 1 2;bs min bw y4;maxAdj4 */ bs 100000 ss;a4 pin 0 adj4 maxAdj4;bd */ ss a4 100000;bd3 +- bd 0 th;bd2 max bd3 0;x3 +- th bd2 0;x8 +- r 0 aw2;x6 +- x8 0 aw2;x7 +- x6 dh2 0;x4 +- x9 0 bd;x5 +- x7 0 bd2;cx +/ th x7 2',
    'M l b L l bd A bd bd cd2 cd4 L x4 t A bd bd 3cd4 cd4 L x9 y4 L r y4 L x8 y5 L x6 y4 L x7 y4 L x7 x3 A bd2 bd2 0 -5400000 L x3 th A bd2 bd2 3cd4 -5400000 L th b Z',
    'l t x9 y4', 'X adj1 0 maxAdj1 th b;X adj2 0 25000 x6 b;Y adj3 0 maxAdj3 x6 y4;X adj4 0 maxAdj4 bd t;Y adj5 minAdj5 100000 r y5', '3cd4 hc t;cd4 th2 b;cd4 x8 y5');
  D('stripedRightArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 84375 w ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;x4 */ ss 5 32;dx5 */ ss a2 100000;x5 +- r 0 dx5;dy1 */ h a1 200000;y1 +- vc 0 dy1;y2 +- vc dy1 0;dx6 */ dy1 dx5 hd2;x6 +- r 0 dx6',
    'M l y1 L ssd32 y1 L ssd32 y2 L l y2 Z M ssd16 y1 L ssd8 y1 L ssd8 y2 L ssd16 y2 Z M x4 y1 L x5 y1 L x5 t L r vc L x5 b L x5 y2 L x4 y2 Z', 'x4 y1 x6 y2',
    'Y adj1 0 100000 l y1;X adj2 0 maxAdj2 x5 t', '3cd4 x5 t;cd2 l vc;cd4 x5 b;0 r vc');
  D('notchedRightArrow', 'adj1=50000 adj2=50000', 'maxAdj2 */ 100000 w ss;a1 pin 0 adj1 100000;a2 pin 0 adj2 maxAdj2;dx2 */ ss a2 100000;x2 +- r 0 dx2;dy1 */ h a1 200000;y1 +- vc 0 dy1;y2 +- vc dy1 0;x1 */ dy1 dx2 hd2;x3 +- r 0 x1',
    'M l y1 L x2 y1 L x2 t L r vc L x2 b L x2 y2 L l y2 L x1 vc Z', 'x1 y1 x3 y2', 'Y adj1 0 100000 r y1;X adj2 0 maxAdj2 x2 t', '3cd4 x2 t;cd2 x1 vc;cd4 x2 b;0 r vc');
  D('homePlate', 'adj=50000', 'maxAdj */ 100000 w ss;a pin 0 adj maxAdj;dx1 */ ss a 100000;x1 +- r 0 dx1;ir +/ x1 r 2;x2 */ x1 1 2',
    'M l t L x1 t L r vc L x1 b L l b Z', 'l t ir b', 'X adj 0 maxAdj x1 t', '3cd4 x2 t;cd2 l vc;cd4 x2 b;0 r vc');
  D('chevron', 'adj=50000', 'maxAdj */ 100000 w ss;a pin 0 adj maxAdj;x1 */ ss a 100000;x2 +- r 0 x1;x3 */ x2 1 2;dx +- x2 0 x1;il ?: dx x1 l;ir ?: dx x2 r',
    'M l t L x2 t L r vc L x2 b L l b L x1 vc Z', 'il t ir b', 'X adj 0 maxAdj x2 t', '3cd4 x3 t;cd2 x1 vc;cd4 x3 b;0 r vc');

  /* ---------- Blokpijlen: toelichtingen met pijl ---------- */
  const ACH = 'maxAdj2 */ 50000 h ss;a2 pin 0 adj2 maxAdj2;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;dy1 */ ss a2 100000;dy2 */ ss a1 200000;y1 +- vc 0 dy1;y2 +- vc 0 dy2;y3 +- vc dy2 0;y4 +- vc dy1 0;';
  const ACV = 'maxAdj2 */ 50000 w ss;a2 pin 0 adj2 maxAdj2;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;dx1 */ ss a2 100000;dx2 */ ss a1 200000;x1 +- hc 0 dx1;x2 +- hc 0 dx2;x3 +- hc dx2 0;x4 +- hc dx1 0;';
  D('rightArrowCallout', 'adj1=25000 adj2=25000 adj3=25000 adj4=64977', ACH + 'maxAdj3 */ 100000 w ss;a3 pin 0 adj3 maxAdj3;q2 */ a3 ss w;maxAdj4 +- 100000 0 q2;a4 pin 0 adj4 maxAdj4;dx3 */ ss a3 100000;x3 +- r 0 dx3;x2 */ w a4 100000;x1 */ x2 1 2',
    'M l t L x2 t L x2 y2 L x3 y2 L x3 y1 L r vc L x3 y4 L x3 y3 L x2 y3 L x2 b L l b Z', 'l t x2 b',
    'Y adj1 0 maxAdj1 x3 y2;Y adj2 0 maxAdj2 r y1;X adj3 0 maxAdj3 x3 t;X adj4 0 maxAdj4 x2 b', '3cd4 x1 t;cd2 l vc;cd4 x1 b;0 r vc');
  D('leftArrowCallout', 'adj1=25000 adj2=25000 adj3=25000 adj4=64977', ACH + 'maxAdj3 */ 100000 w ss;a3 pin 0 adj3 maxAdj3;q2 */ a3 ss w;maxAdj4 +- 100000 0 q2;a4 pin 0 adj4 maxAdj4;x1 */ ss a3 100000;dx2 */ w a4 100000;x2 +- r 0 dx2;x3 +/ x2 r 2',
    'M l vc L x1 y1 L x1 y2 L x2 y2 L x2 t L r t L r b L x2 b L x2 y3 L x1 y3 L x1 y4 Z', 'x2 t r b',
    'Y adj1 0 maxAdj1 x1 y2;Y adj2 0 maxAdj2 l y1;X adj3 0 maxAdj3 x1 t;X adj4 0 maxAdj4 x2 b', '3cd4 x3 t;cd2 l vc;cd4 x3 b;0 r vc');
  D('upArrowCallout', 'adj1=25000 adj2=25000 adj3=25000 adj4=64977', ACV + 'maxAdj3 */ 100000 h ss;a3 pin 0 adj3 maxAdj3;q2 */ a3 ss h;maxAdj4 +- 100000 0 q2;a4 pin 0 adj4 maxAdj4;y1 */ ss a3 100000;dy2 */ h a4 100000;y2 +- b 0 dy2;y3 +/ y2 b 2',
    'M l y2 L x2 y2 L x2 y1 L x1 y1 L hc t L x4 y1 L x3 y1 L x3 y2 L r y2 L r b L l b Z', 'l y2 r b',
    'X adj1 0 maxAdj1 x2 y1;X adj2 0 maxAdj2 x1 t;Y adj3 0 maxAdj3 r y1;Y adj4 0 maxAdj4 l y2', '3cd4 hc t;cd2 l y3;cd4 hc b;0 r y3');
  D('downArrowCallout', 'adj1=25000 adj2=25000 adj3=25000 adj4=64977', ACV + 'maxAdj3 */ 100000 h ss;a3 pin 0 adj3 maxAdj3;q2 */ a3 ss h;maxAdj4 +- 100000 0 q2;a4 pin 0 adj4 maxAdj4;dy3 */ ss a3 100000;y3 +- b 0 dy3;y2 */ h a4 100000;y1 */ y2 1 2',
    'M l t L r t L r y2 L x3 y2 L x3 y3 L x4 y3 L hc b L x1 y3 L x2 y3 L x2 y2 L l y2 Z', 'l t r y2',
    'X adj1 0 maxAdj1 x2 y3;X adj2 0 maxAdj2 x1 b;Y adj3 0 maxAdj3 r y3;Y adj4 0 maxAdj4 l y2', '3cd4 hc t;cd2 l y1;cd4 hc b;0 r y1');
  D('leftRightArrowCallout', 'adj1=25000 adj2=25000 adj3=25000 adj4=48123', ACH + 'maxAdj3 */ 50000 w ss;a3 pin 0 adj3 maxAdj3;q2 */ a3 ss wd2;maxAdj4 +- 100000 0 q2;a4 pin 0 adj4 maxAdj4;x1 */ ss a3 100000;x4 +- r 0 x1;dx2 */ w a4 200000;x2 +- hc 0 dx2;x3 +- hc dx2 0',
    'M l vc L x1 y1 L x1 y2 L x2 y2 L x2 t L x3 t L x3 y2 L x4 y2 L x4 y1 L r vc L x4 y4 L x4 y3 L x3 y3 L x3 b L x2 b L x2 y3 L x1 y3 L x1 y4 Z', 'x2 t x3 b',
    'Y adj1 0 maxAdj1 x1 y2;Y adj2 0 maxAdj2 l y1;X adj3 0 maxAdj3 x1 t;X adj4 0 maxAdj4 x2 b', 'R');
  D('upDownArrowCallout', 'adj1=25000 adj2=25000 adj3=25000 adj4=48123', ACV + 'maxAdj3 */ 50000 h ss;a3 pin 0 adj3 maxAdj3;q2 */ a3 ss hd2;maxAdj4 +- 100000 0 q2;a4 pin 0 adj4 maxAdj4;y1 */ ss a3 100000;y4 +- b 0 y1;dy2 */ h a4 200000;y2 +- vc 0 dy2;y3 +- vc dy2 0',
    'M l y2 L x2 y2 L x2 y1 L x1 y1 L hc t L x4 y1 L x3 y1 L x3 y2 L r y2 L r y3 L x3 y3 L x3 y4 L x4 y4 L hc b L x1 y4 L x2 y4 L x2 y3 L l y3 Z', 'l y2 r y3',
    'X adj1 0 maxAdj1 x2 y1;X adj2 0 maxAdj2 x1 t;Y adj3 0 maxAdj3 r y1;Y adj4 0 maxAdj4 l y2', 'R');
  D('quadArrowCallout', 'adj1=18515 adj2=18515 adj3=18515 adj4=48123', 'a2 pin 0 adj2 50000;maxAdj1 */ a2 2 1;a1 pin 0 adj1 maxAdj1;maxAdj3 +- 50000 0 a2;a3 pin 0 adj3 maxAdj3;q2 */ a3 2 1;maxAdj4 +- 100000 0 q2;a4 pin a1 adj4 maxAdj4;dx2 */ ss a2 100000;dx3 */ ss a1 200000;ah */ ss a3 100000;dx1 */ w a4 200000;dy1 */ h a4 200000;x8 +- r 0 ah;x2 +- hc 0 dx1;x7 +- hc dx1 0;x3 +- hc 0 dx2;x6 +- hc dx2 0;x4 +- hc 0 dx3;x5 +- hc dx3 0;y8 +- b 0 ah;y2 +- vc 0 dy1;y7 +- vc dy1 0;y3 +- vc 0 dx2;y6 +- vc dx2 0;y4 +- vc 0 dx3;y5 +- vc dx3 0',
    'M l vc L ah y3 L ah y4 L x2 y4 L x2 y2 L x4 y2 L x4 ah L x3 ah L hc t L x6 ah L x5 ah L x5 y2 L x7 y2 L x7 y4 L x8 y4 L x8 y3 L r vc L x8 y6 L x8 y5 L x7 y5 L x7 y7 L x5 y7 L x5 y8 L x6 y8 L hc b L x3 y8 L x4 y8 L x4 y7 L x2 y7 L x2 y5 L ah y5 L ah y6 Z',
    'x2 y2 x7 y7', 'X adj1 0 maxAdj1 x4 ah;X adj2 0 50000 x3 t;Y adj3 0 maxAdj3 r ah;Y adj4 a1 maxAdj4 l y2', 'R');
  /* ---------- Blokpijlen: gekromde pijlen ---------- */
  const CRV_H = 'maxAdj2 */ 50000 h ss;a2 pin 0 adj2 maxAdj2;a1 pin 0 adj1 a2;th */ ss a1 100000;aw */ ss a2 100000;q1 +/ th aw 4;hR +- hd2 0 q1;q7 */ hR 2 1;q8 */ q7 q7 1;q9 */ th th 1;q10 +- q8 0 q9;q11 sqrt q10;idx */ q11 w q7;maxAdj3 */ 100000 idx ss;a3 pin 0 adj3 maxAdj3;ah */ ss a3 100000;y3 +- hR th 0;q2 */ w w 1;q3 */ ah ah 1;q4 +- q2 0 q3;q5 sqrt q4;dy */ q5 hR w;y5 +- hR dy 0;y7 +- y3 dy 0;q6 +- aw 0 th;dh */ q6 1 2;y4 +- y5 0 dh;y8 +- y7 dh 0;aw2 */ aw 1 2;y6 +- b 0 aw2;swAng at2 ah dy;mswAng +- 0 0 swAng;iy +/ hR y3 2;q12 */ th 1 2;dang2 at2 idx q12;';
  D('curvedRightArrow', 'adj1=25000 adj2=50000 adj3=25000', CRV_H + 'x1 +- r 0 ah;stAng +- cd2 0 swAng;ix +- r 0 idx;swAng2 +- dang2 0 cd4;swAng3 +- cd4 dang2 0;stAng3 +- cd2 0 dang2',
    '~s M l hR A w hR cd2 mswAng L x1 y4 L r y6 L x1 y8 L x1 y7 A w hR stAng swAng Z | ~s ~D M r th A w hR 3cd4 swAng2 A w hR stAng3 swAng3 Z | ~n M l hR A w hR cd2 mswAng L x1 y4 L r y6 L x1 y8 L x1 y7 A w hR stAng swAng L l hR A w hR cd2 cd4 L r th A w hR 3cd4 swAng2',
    'l t r b', 'Y adj1 0 a2 x1 y5;Y adj2 0 maxAdj2 r y4;X adj3 0 maxAdj3 x1 b', 'cd2 l hR;3cd4 x1 y4;0 r y6;cd4 x1 y8');
  D('curvedLeftArrow', 'adj1=25000 adj2=50000 adj3=25000', CRV_H + 'x1 +- l ah 0;ix +- l idx 0;swAng2 +- cd4 0 dang2;q13 +- cd4 dang2 0;swAng3 +- 0 0 q13',
    '~s M r hR A w hR 0 swAng L x1 y4 L l y6 L x1 y8 L x1 y7 A w hR swAng mswAng Z | ~s ~D M l th A w hR 3cd4 swAng2 A w hR dang2 swAng3 Z | ~n M r hR A w hR 0 swAng L x1 y4 L l y6 L x1 y8 L x1 y7 A w hR swAng mswAng L r hR A w hR 0 -5400000 L l th A w hR 3cd4 swAng2',
    'l t r b', 'Y adj1 0 a2 x1 y5;Y adj2 0 maxAdj2 l y4;X adj3 0 maxAdj3 x1 b', 'cd2 l y6;3cd4 x1 y4;0 r hR;cd4 x1 y8');
  const CRV_V = 'maxAdj2 */ 50000 w ss;a2 pin 0 adj2 maxAdj2;a1 pin 0 adj1 100000;th */ ss a1 100000;aw */ ss a2 100000;q1 +/ th aw 4;wR +- wd2 0 q1;q7 */ wR 2 1;q8 */ q7 q7 1;q9 */ th th 1;q10 +- q8 0 q9;q11 sqrt q10;idy */ q11 h q7;maxAdj3 */ 100000 idy ss;a3 pin 0 adj3 maxAdj3;ah */ ss a3 100000;x3 +- wR th 0;q2 */ h h 1;q3 */ ah ah 1;q4 +- q2 0 q3;q5 sqrt q4;dx */ q5 wR h;x5 +- wR dx 0;x7 +- x3 dx 0;q6 +- aw 0 th;dh */ q6 1 2;x4 +- x5 0 dh;x8 +- x7 dh 0;aw2 */ aw 1 2;x6 +- r 0 aw2;swAng at2 ah dx;mswAng +- 0 0 swAng;ix +/ wR x3 2;q12 */ th 1 2;dang2 at2 idy q12;';
  D('curvedDownArrow', 'adj1=25000 adj2=50000 adj3=25000', CRV_V + 'y1 +- b 0 ah;iy +- b 0 idy;stAng +- 3cd4 swAng 0;stAng2 +- 3cd4 0 dang2;swAng2 +- dang2 0 cd4;swAng3 +- cd4 dang2 0',
    '~s M x6 b L x4 y1 L x5 y1 A wR h stAng mswAng L x3 t A wR h 3cd4 swAng L x8 y1 Z | ~s ~D M ix iy A wR h stAng2 swAng2 L l b A wR h cd2 swAng3 Z | ~n M ix iy A wR h stAng2 swAng2 L l b A wR h cd2 cd4 L x3 t A wR h 3cd4 swAng L x8 y1 L x6 b L x4 y1 L x5 y1 A wR h stAng mswAng',
    'l t r b', 'X adj1 0 100000 x7 y1;X adj2 0 maxAdj2 x4 b;Y adj3 0 maxAdj3 r y1', '3cd4 ix iy;cd4 wR b;cd4 x6 b;0 x8 y1');
  D('curvedUpArrow', 'adj1=25000 adj2=50000 adj3=25000', CRV_V + 'y1 +- t ah 0;iy +- t idy 0;stAng +- cd4 0 swAng;stAng2 +- cd4 dang2 0;swAng2 +- cd4 0 dang2;q13 +- cd4 dang2 0;swAng3 +- 0 0 q13',
    '~s M x6 t L x4 y1 L x5 y1 A wR h stAng swAng L x3 b A wR h cd4 mswAng L x8 y1 Z | ~s ~D M ix iy A wR h stAng2 swAng2 L l t A wR h cd2 swAng3 Z | ~n M ix iy A wR h stAng2 swAng2 L l t A wR h cd2 -5400000 L x3 b A wR h cd4 mswAng L x8 y1 L x6 t L x4 y1 L x5 y1 A wR h stAng swAng',
    'l t r b', 'X adj1 0 100000 x7 y1;X adj2 0 maxAdj2 x4 t;Y adj3 0 maxAdj3 r y1', '3cd4 x6 t;cd4 wR b;cd2 ix iy;0 x8 y1');
  D('swooshArrow', 'adj1=25000 adj2=16667', 'a1 pin 1 adj1 75000;maxAdj2 */ 70000 w ss;a2 pin 0 adj2 maxAdj2;ad1 */ h a1 100000;ad2 */ ss a2 100000;xB +- r 0 ad2;yB +- t ssd8 0;alfa */ cd4 1 14;dx0 tan ssd8 alfa;xC +- xB 0 dx0;dx1 tan ad1 alfa;yF +- yB ad1 0;xF +- xB dx1 0;xE +- xF dx0 0;yE +- yF ssd8 0;dy2 +- yE 0 t;dy22 */ dy2 1 2;dy3 */ h 1 20;yD +- t dy22 dy3;dy4 */ hd6 1 1;yP1 +- hd6 dy4 0;xP1 val wd6;dy5 */ hd6 1 2;yP2 +- yF dy5 0;xP2 val wd4',
    'M l b Q xP1 yP1 xB yB L xC t L r yD L xE yE L xF yF Q xP2 yP2 l b Z', 'l t r b', 'Y adj1 0 75000 xF yF;X adj2 0 maxAdj2 xB yB', '3cd4 xC t;cd2 l b;0 r yD;cd4 xE yE');
  /* ---------- Blokpijlen: ronde pijlen (circularArrow e.a.) ----------
     band tussen ellips rw1×rh1 (buiten) en rw2×rh2 (binnen); pijlpunt met basis op hoek E en punt op hoek P */
  const CA_BASE = 'a5 pin 0 adj5 25000;maxAdj1 */ a5 2 1;a1 pin 0 adj1 maxAdj1;th */ ss a1 100000;thh */ ss a5 100000;th2 */ th 1 2;rw1 +- wd2 th2 thh;rh1 +- hd2 th2 thh;rw2 +- rw1 0 th;rh2 +- rh1 0 th;rw3 +- rw2 th2 0;rh3 +- rh2 th2 0;rI min rw2 rh2;rO min rw1 rh1;';
  const sfx = (s, src) => src.replace(/\$/g, s);
  const CA_H = (s, E) => sfx(s, `wtH$ sin rw3 ${E};htH$ cos rh3 ${E};dxH$ cat2 rw3 htH$ wtH$;dyH$ sat2 rh3 htH$ wtH$;xH$ +- hc dxH$ 0;yH$ +- vc dyH$ 0;`);
  const CA_MAX = 'u1 */ dxH dxH 1;u2 */ dyH dyH 1;u3 */ rI rI 1;u4 +- u1 0 u3;u5 +- u2 0 u3;u6 */ u4 u5 u1;u7 */ u6 1 u2;u8 +- 1 0 u7;u9 sqrt u8;u10 */ u4 1 dxH;u11 */ u10 1 dyH;u12 +/ 1 u9 u11;u13 at2 1 u12;u14 +- u13 21600000 0;u15 ?: u13 u13 u14;u16 +- u15 0 enAng;u17 +- u16 21600000 0;u18 ?: u16 u16 u17;u19 +- u18 0 cd2;u20 +- u18 0 21600000;u21 ?: u19 u20 u18;maxAng abs u21;';
  const CA_R = (s, P) => sfx(s, `wtA$ sin rw3 ${P};htA$ cos rh3 ${P};dxA$ cat2 rw3 htA$ wtA$;dyA$ sat2 rh3 htA$ wtA$;xA$ +- hc dxA$ 0;yA$ +- vc dyA$ 0;` +
    `dxG$ cos thh ${P};dyG$ sin thh ${P};xG$ +- xH$ dxG$ 0;yG$ +- yH$ dyG$ 0;xB$ +- xH$ 0 dxG$;yB$ +- yH$ 0 dyG$;sx1$ +- xB$ 0 hc;sy1$ +- yB$ 0 vc;sx2$ +- xG$ 0 hc;sy2$ +- yG$ 0 vc;` +
    // snijpunt van de basislijn met de buitenste ellips (dichtst bij G)
    `x1O$ */ sx1$ rO rw1;y1O$ */ sy1$ rO rh1;x2O$ */ sx2$ rO rw1;y2O$ */ sy2$ rO rh1;dxO$ +- x2O$ 0 x1O$;dyO$ +- y2O$ 0 y1O$;dO$ mod dxO$ dyO$ 0;q1$ */ x1O$ y2O$ 1;q2$ */ x2O$ y1O$ 1;DO$ +- q1$ 0 q2$;q3$ */ rO rO 1;q4$ */ dO$ dO$ 1;q5$ */ q3$ q4$ 1;q6$ */ DO$ DO$ 1;q7$ +- q5$ 0 q6$;q8$ max q7$ 0;sdelO$ sqrt q8$;ndyO$ */ dyO$ -1 1;sdyO$ ?: ndyO$ -1 1;` +
    `q9$ */ sdyO$ dxO$ 1;q10$ */ q9$ sdelO$ 1;q11$ */ DO$ dyO$ 1;dxF1$ +/ q11$ q10$ q4$;q12$ +- q11$ 0 q10$;dxF2$ */ q12$ 1 q4$;adyO$ abs dyO$;q13$ */ adyO$ sdelO$ 1;q14$ */ DO$ dxO$ -1;dyF1$ +/ q14$ q13$ q4$;q15$ +- q14$ 0 q13$;dyF2$ */ q15$ 1 q4$;` +
    `q16$ +- x2O$ 0 dxF1$;q17$ +- x2O$ 0 dxF2$;q18$ +- y2O$ 0 dyF1$;q19$ +- y2O$ 0 dyF2$;q20$ mod q16$ q18$ 0;q21$ mod q17$ q19$ 0;q22$ +- q21$ 0 q20$;dxF$ ?: q22$ dxF1$ dxF2$;dyF$ ?: q22$ dyF1$ dyF2$;sdxF$ */ dxF$ rw1 rO;sdyF$ */ dyF$ rh1 rO;xF$ +- hc sdxF$ 0;yF$ +- vc sdyF$ 0;` +
    // snijpunt met de binnenste ellips (dichtst bij B)
    `x1I$ */ sx1$ rI rw2;y1I$ */ sy1$ rI rh2;x2I$ */ sx2$ rI rw2;y2I$ */ sy2$ rI rh2;dxI$ +- x2I$ 0 x1I$;dyI$ +- y2I$ 0 y1I$;dI$ mod dxI$ dyI$ 0;v1$ */ x1I$ y2I$ 1;v2$ */ x2I$ y1I$ 1;DI$ +- v1$ 0 v2$;v3$ */ rI rI 1;v4$ */ dI$ dI$ 1;v5$ */ v3$ v4$ 1;v6$ */ DI$ DI$ 1;v7$ +- v5$ 0 v6$;v8$ max v7$ 0;sdelI$ sqrt v8$;` +
    `v9$ */ sdyO$ dxI$ 1;v10$ */ v9$ sdelI$ 1;v11$ */ DI$ dyI$ 1;dxC1$ +/ v11$ v10$ v4$;v12$ +- v11$ 0 v10$;dxC2$ */ v12$ 1 v4$;adyI$ abs dyI$;v13$ */ adyI$ sdelI$ 1;v14$ */ DI$ dxI$ -1;dyC1$ +/ v14$ v13$ v4$;v15$ +- v14$ 0 v13$;dyC2$ */ v15$ 1 v4$;` +
    `v16$ +- x1I$ 0 dxC1$;v17$ +- x1I$ 0 dxC2$;v18$ +- y1I$ 0 dyC1$;v19$ +- y1I$ 0 dyC2$;v20$ mod v16$ v18$ 0;v21$ mod v17$ v19$ 0;v22$ +- v21$ 0 v20$;dxC$ ?: v22$ dxC1$ dxC2$;dyC$ ?: v22$ dyC1$ dyC2$;sdxC$ */ dxC$ rw2 rI;sdyC$ */ dyC$ rh2 rI;xC$ +- hc sdxC$ 0;yC$ +- vc sdyC$ 0;` +
    // smalle pijlpunt: dan vallen G en B samen met F en C
    `p1$ +- xF$ 0 xC$;p2$ +- yF$ 0 yC$;p3$ mod p1$ p2$ 0;p4$ */ p3$ 1 2;p5$ +- p4$ 0 thh;xGp$ ?: p5$ xF$ xG$;yGp$ ?: p5$ yF$ yG$;xBp$ ?: p5$ xC$ xB$;yBp$ ?: p5$ yC$ yB$;` +
    `en0$ at2 sdxF$ sdyF$;en1$ +- en0$ 21600000 0;enF$ ?: en0$ en0$ en1$;ic0$ at2 sdxC$ sdyC$;ic1$ +- ic0$ 21600000 0;enC$ ?: ic0$ ic0$ ic1$;`);
  const CA_E = 'wtE sin rw1 stAng;htE cos rh1 stAng;dxE cat2 rw1 htE wtE;dyE sat2 rh1 htE wtE;xE +- hc dxE 0;yE +- vc dyE 0;sw0 +- enF 0 stAng;sw1 +- sw0 21600000 0;swAng ?: sw0 sw0 sw1;istAng val enC;isw1 +- stAng 0 istAng;isw2 +- isw1 0 21600000;iswAng ?: isw1 isw2 isw1;idx cos rw1 2700000;idy sin rh1 2700000;il +- hc 0 idx;ir +- hc idx 0;it +- vc 0 idy;ib +- vc idy 0;wtI sin rw3 stAng;htI cos rh3 stAng;dxJ cat2 rw3 htI wtI;dyJ sat2 rh3 htI wtI;xI +- hc dxJ 0;yI +- vc dyJ 0;aI +- stAng 0 cd4;aA +- ptAng cd4 0;aB +- ptAng cd2 0;';
  D('circularArrow', 'adj1=12500 adj2=1142319 adj3=20457681 adj4=10800000 adj5=12500',
    CA_BASE + 'enAng pin 1 adj3 21599999;stAng pin 0 adj4 21599999;' + CA_H('', 'enAng') + CA_MAX + 'aAng pin 0 adj2 maxAng;ptAng +- enAng aAng 0;' + CA_R('', 'ptAng') + CA_E,
    'M xE yE A rw1 rh1 stAng swAng L xGp yGp L xA yA L xBp yBp L xC yC A rw2 rh2 istAng iswAng Z', 'il it ir ib',
    'P - - - adj2 0 maxAng xA yA;P - - - adj4 0 21599999 xE yE;P adj1 0 maxAdj1 adj3 0 21599999 xF yF;P adj5 0 25000 - - - xB yB', 'aI xI yI;ptAng xGp yGp;aA xA yA;aB xBp yBp');
  // tegen de klok in: gespiegelde versie van circularArrow (hoeken en y gespiegeld)
  D('leftCircularArrow', 'adj1=12500 adj2=-1142319 adj3=1142319 adj4=10800000 adj5=12500',
    CA_BASE + 'e0 pin 1 adj3 21599999;enAng +- 21600000 0 e0;s0 pin 0 adj4 21599999;s1 +- 21600000 0 s0;stAng ?: s0 s1 0;' + CA_H('', 'enAng') + CA_MAX + 'minAng */ maxAng -1 1;na2 */ adj2 -1 1;aAng pin 0 na2 maxAng;ptAng +- enAng aAng 0;' + CA_R('', 'ptAng') + CA_E +
    'myE +- b 0 yE;myGp +- b 0 yGp;myA +- b 0 yA;myBp +- b 0 yBp;myC +- b 0 yC;myF +- b 0 yF;myB +- b 0 yB;myI +- b 0 yI;mst +- 0 0 stAng;msw +- 0 0 swAng;mist +- 0 0 istAng;misw +- 0 0 iswAng;maI +- 0 0 aI;mpt +- 0 0 ptAng;maA +- 0 0 aA;maB +- 0 0 aB',
    'M xE myE A rw1 rh1 mst msw L xGp myGp L xA myA L xBp myBp L xC myC A rw2 rh2 mist misw Z', 'il it ir ib',
    'P - - - adj2 minAng 0 xA myA;P - - - adj4 0 21599999 xE myE;P adj1 0 maxAdj1 adj3 0 21599999 xF myF;P adj5 0 25000 - - - xB myB', 'maI xI myI;mpt xGp myGp;maA xA myA;maB xBp myBp');
  // twee pijlpunten: einde op adj3 (rechtsom), begin op adj4 (linksom)
  D('leftRightCircularArrow', 'adj1=12500 adj2=1142319 adj3=20457681 adj4=11942319 adj5=12500',
    CA_BASE + 'enAng pin 1 adj3 21599999;stAng pin 0 adj4 21599999;' + CA_H('', 'enAng') + CA_MAX + 'sp0 +- enAng 0 stAng;sp1 +- sp0 21600000 0;span ?: sp0 sp0 sp1;maxAng2 */ span 1 2;maxAng3 min maxAng maxAng2;aAng pin 0 adj2 maxAng3;ptAng +- enAng aAng 0;ptAng2 +- stAng 0 aAng;' +
    CA_R('', 'ptAng') + CA_H('2', 'stAng') + CA_R('2', 'ptAng2') +
    'sw0 +- enF 0 enF2;sw1 +- sw0 21600000 0;swAng ?: sw0 sw0 sw1;isw1 +- enC2 0 enC;isw2 +- isw1 0 21600000;iswAng ?: isw1 isw2 isw1;idx cos rw1 2700000;idy sin rh1 2700000;il +- hc 0 idx;ir +- hc idx 0;it +- vc 0 idy;ib +- vc idy 0;aA +- ptAng cd4 0;aA2 +- ptAng2 0 cd4',
    'M xA2 yA2 L xGp2 yGp2 L xF2 yF2 A rw1 rh1 enF2 swAng L xGp yGp L xA yA L xBp yBp L xC yC A rw2 rh2 enC iswAng L xBp2 yBp2 Z', 'il it ir ib',
    'P - - - adj2 0 maxAng3 xA yA;P - - - adj4 0 21599999 xF2 yF2;P adj1 0 maxAdj1 adj3 0 21599999 xF yF;P adj5 0 25000 - - - xB yB', 'aA xA yA;aA2 xA2 yA2');
  /* ---------- Stroomdiagram ---------- */
  const SQ1 = '~w1 ~h1 M 0 0 L 1 0 L 1 1 L 0 1 Z';
  D('flowChartProcess', '', '', SQ1, 'l t r b', '', 'R');
  D('flowChartAlternateProcess', '', 'x2 +- r 0 ssd6;y2 +- b 0 ssd6;il */ ssd6 29289 100000;ir +- r 0 il;ib +- b 0 il',
    'M l ssd6 A ssd6 ssd6 cd2 cd4 L x2 t A ssd6 ssd6 3cd4 cd4 L r y2 A ssd6 ssd6 0 cd4 L ssd6 b A ssd6 ssd6 cd4 cd4 Z', 'il il ir ib', '', 'R');
  D('flowChartDecision', '', 'ir */ w 3 4;ib */ h 3 4', '~w2 ~h2 M 0 1 L 1 0 L 2 1 L 1 2 Z', 'wd4 hd4 ir ib', '', 'R');
  D('flowChartInputOutput', '', 'x3 */ w 2 5;x4 */ w 3 5;x5 */ w 4 5;x6 */ w 9 10', '~w5 ~h5 M 0 5 L 1 0 L 5 0 L 4 5 Z', 'wd5 t x5 b', '', '3cd4 x3 t;3cd4 hc t;cd2 wd10 vc;cd4 hc b;cd4 x4 b;0 x6 vc');
  D('flowChartPredefinedProcess', '', 'x2 */ w 7 8', '~s ' + SQ1 + ' | ~n ~w8 ~h8 M 1 0 L 1 8 M 7 0 L 7 8 | ~n ' + SQ1, 'wd8 t x2 b', '', 'R');
  D('flowChartInternalStorage', '', '', '~s ' + SQ1 + ' | ~n ~w4 ~h4 M 1 0 L 1 4 M 0 1 L 4 1 | ~n ' + SQ1, 'wd8 hd8 r b', '', 'R');
  D('flowChartDocument', '', 'y1 */ h 17322 21600;y2 */ h 20172 21600', '~w21600 ~h21600 M 0 0 L 21600 0 L 21600 17322 C 10800 17322 10800 23922 0 20172 Z', 'l t r y1', '', '3cd4 hc t;cd2 l vc;cd4 hc y2;0 r vc');
  const MD1 = 'M 0 20782 C 9298 23542 9298 18022 18595 18022 L 18595 3675 L 0 3675 Z M 1532 3675 L 1532 1815 L 20000 1815 L 20000 16252 C 19298 16252 18595 16352 18595 16352 L 18595 3675 Z M 2972 1815 L 2972 0 L 21600 0 L 21600 14392 C 20800 14392 20000 14467 20000 14467 L 20000 1815 Z';
  const MD2 = 'M 0 3675 L 18595 3675 L 18595 18022 C 9298 18022 9298 23542 0 20782 Z M 1532 3675 L 1532 1815 L 20000 1815 L 20000 16252 C 19298 16252 18595 16352 18595 16352 M 2972 1815 L 2972 0 L 21600 0 L 21600 14392 C 20800 14392 20000 14467 20000 14467';
  D('flowChartMultidocument', '', 'y1 */ h 3675 21600;y2 */ h 20782 21600;y8 */ h 18022 21600;x5 */ w 18595 21600;x6 */ w 9298 21600',
    '~s ~w21600 ~h21600 ' + MD1 + ' | ~n ~w21600 ~h21600 ' + MD2, 'l y1 x5 y8', '', '3cd4 hc t;cd2 l vc;cd4 x6 y2;0 r vc');
  D('flowChartTerminator', '', 'il */ w 1018 21600;ir */ w 20582 21600;it */ h 3163 21600;ib */ h 18437 21600',
    '~w21600 ~h21600 M 3475 0 L 18125 0 A 3475 10800 3cd4 cd2 L 3475 21600 A 3475 10800 cd4 cd2 Z', 'il it ir ib', '', 'R');
  D('flowChartPreparation', '', 'x2 */ w 4 5', '~w10 ~h10 M 0 5 L 2 0 L 8 0 L 10 5 L 8 10 L 2 10 Z', 'wd5 t x2 b', '', 'R');
  D('flowChartManualInput', '', '', '~w5 ~h5 M 0 1 L 5 0 L 5 5 L 0 5 Z', 'l hd5 r b', '', '3cd4 hc hd10;cd2 l vc;cd4 hc b;0 r vc');
  D('flowChartManualOperation', '', 'x3 */ w 4 5;x4 */ w 9 10', '~w5 ~h5 M 0 0 L 5 0 L 4 5 L 1 5 Z', 'wd5 t x3 b', '', '3cd4 hc t;cd2 wd10 vc;cd4 hc b;0 x4 vc');
  D('flowChartConnector', '', IBOX, CIRC, 'il it ir ib', '', ECX);
  D('flowChartOffpageConnector', '', 'y1 */ h 4 5', '~w10 ~h10 M 0 0 L 10 0 L 10 8 L 5 10 L 0 8 Z', 'l t r y1', '', 'R');
  D('flowChartPunchedCard', '', '', '~w5 ~h5 M 0 1 L 1 0 L 5 0 L 5 5 L 0 5 Z', 'l hd5 r b', '', 'R');
  D('flowChartPunchedTape', '', 'y2 */ h 9 10;ib */ h 4 5', '~w20 ~h20 M 0 2 A 5 2 cd2 -10800000 A 5 2 cd2 cd2 L 20 18 A 5 2 0 -10800000 A 5 2 0 cd2 Z', 'l hd5 r ib', '', '3cd4 hc hd10;cd2 l vc;cd4 hc y2;0 r vc');
  D('flowChartSummingJunction', '', IBOX, '~s ' + CIRC + ' | ~n M il it L ir ib M ir it L il ib | ~n ' + CIRC, 'il it ir ib', '', ECX);
  D('flowChartOr', '', IBOX, '~s ' + CIRC + ' | ~n M hc t L hc b M l vc L r vc | ~n ' + CIRC, 'il it ir ib', '', ECX);
  D('flowChartCollate', '', 'ir */ w 3 4;ib */ h 3 4', '~w2 ~h2 M 0 0 L 2 0 L 1 1 L 2 2 L 0 2 L 1 1 Z', 'wd4 hd4 ir ib', '', '3cd4 hc t;0 hc vc;cd4 hc b');
  D('flowChartSort', '', 'ir */ w 3 4;ib */ h 3 4', '~s ~w2 ~h2 M 0 1 L 1 0 L 2 1 L 1 2 Z | ~n ~w2 ~h2 M 0 1 L 2 1 | ~n ~w2 ~h2 M 0 1 L 1 0 L 2 1 L 1 2 Z', 'wd4 hd4 ir ib', '', 'R');
  D('flowChartExtract', '', 'x2 */ w 3 4', '~w2 ~h2 M 0 2 L 1 0 L 2 2 Z', 'wd4 vc x2 b', '', '3cd4 hc t;cd2 wd4 vc;cd4 hc b;0 x2 vc');
  D('flowChartMerge', '', 'x2 */ w 3 4', '~w2 ~h2 M 0 0 L 2 0 L 1 2 Z', 'wd4 t x2 vc', '', '3cd4 hc t;cd2 wd4 vc;cd4 hc b;0 x2 vc');
  D('flowChartOfflineStorage', '', 'x4 */ w 3 4', '~s ~w2 ~h2 M 0 0 L 2 0 L 1 2 Z | ~n ~w5 ~h5 M 2 4 L 3 4 | ~n ~w2 ~h2 M 0 0 L 2 0 L 1 2 Z', 'wd4 t x4 vc', '', '3cd4 hc t;cd2 wd4 vc;cd4 hc b;0 x4 vc');
  D('flowChartOnlineStorage', '', 'x2 */ w 5 6', '~w6 ~h6 M 1 0 L 6 0 A 1 3 3cd4 -10800000 L 1 6 A 1 3 cd4 cd2 Z', 'wd6 t x2 b', '', '3cd4 hc t;cd2 l vc;cd4 hc b;0 x2 vc');
  D('flowChartMagneticTape', '', IBOX + ';ang1 at2 w h', 'M hc b A wd2 hd2 cd4 cd4 A wd2 hd2 cd2 cd4 A wd2 hd2 3cd4 cd4 A wd2 hd2 0 ang1 L r ib L r b Z', 'il it ir ib', '', 'R');
  const DSK = '~w6 ~h6 M 0 1 A 3 1 cd2 cd2 L 6 5 A 3 1 0 cd2 Z';
  D('flowChartMagneticDisk', '', 'y2 */ h 1 3;y3 */ h 5 6', '~s ' + DSK + ' | ~n ~w6 ~h6 M 6 1 A 3 1 0 cd2 | ~n ' + DSK, 'l y2 r y3', '', 'R');
  const DRM = '~w6 ~h6 M 1 0 L 5 0 A 1 3 3cd4 cd2 L 1 6 A 1 3 cd4 cd2 Z';
  D('flowChartMagneticDrum', '', 'x2 */ w 2 3', '~s ' + DRM + ' | ~n ~w6 ~h6 M 5 6 A 1 3 cd4 cd2 | ~n ' + DRM, 'wd6 t x2 b', '', 'R');
  D('flowChartDisplay', '', 'x2 */ w 5 6', '~w6 ~h6 M 0 3 L 1 0 L 5 0 A 1 3 3cd4 cd2 L 1 6 Z', 'wd6 t x2 b', '', 'R');
  D('flowChartDelay', '', IBOX, 'M l t L hc t A wd2 hd2 3cd4 cd2 L l b Z', 'l it ir ib', '', 'R');
  /* ---------- Sterren: n punten op ellips swd2 × shd2 rond (hc, svc); binnenstraal = adj/50000 ---------- */
  const STAR = (id, n, av) => {
    const hf = /hf=/.test(av) ? 'hf' : 100000, vf = /vf=/.test(av) ? 'vf' : 100000;
    const g = ['a pin 0 adj 50000', `swd2 */ wd2 ${hf} 100000`, `shd2 */ hd2 ${vf} 100000`, `svc */ vc ${vf} 100000`, 'iwd2 */ swd2 a 50000', 'ihd2 */ shd2 a 50000', 'yAdj +- svc 0 ihd2'];
    const inner = [], cx = [];
    let p = '';
    for (let k = 0; k < 2 * n; k++) {
      const deg = -90 + k * 180 / n, ang = Math.round((((deg % 360) + 360) % 360) * 60000), o = k % 2 === 0;
      g.push(`dx${k} cos ${o ? 'swd2' : 'iwd2'} ${ang}`, `dy${k} sin ${o ? 'shd2' : 'ihd2'} ${ang}`, `x${k} +- hc dx${k} 0`, `y${k} +- svc dy${k} 0`);
      p += (k ? ' L ' : 'M ') + `x${k} y${k}`;
      if (o) cx.push(`${ang} x${k} y${k}`);
      else inner.push([k, Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)]);
    }
    const pick = (i, sg) => inner.reduce((m, q) => (q[i] * sg > m[i] * sg + 1e-9 ? q : m))[0];
    D(id, av, g.join(';'), p + ' Z', `x${pick(1, -1)} y${pick(2, -1)} x${pick(1, 1)} y${pick(2, 1)}`, 'Y adj 0 50000 hc yAdj', n <= 10 ? cx.join(';') : 'R');
  };
  STAR('star4', 4, 'adj=12500');
  STAR('star5', 5, 'adj=19098 hf=105146 vf=110557');
  STAR('star6', 6, 'adj=28868 hf=115470');
  STAR('star7', 7, 'adj=34601 hf=102572 vf=105210');
  STAR('star8', 8, 'adj=38268');
  STAR('star10', 10, 'adj=42533 hf=105146');
  STAR('star12', 12, 'adj=37500');
  STAR('star16', 16, 'adj=37500');
  STAR('star24', 24, 'adj=37500');
  STAR('star32', 32, 'adj=37500');

  /* ---------- Explosies ---------- */
  const PTS = (s) => s.split(' ').map((q, i) => (i ? 'L ' : 'M ') + q.replace(',', ' ')).join(' ') + ' Z';
  D('irregularSeal1', '', 'x5 */ w 4627 21600;x12 */ w 8485 21600;x21 */ w 16702 21600;x24 */ w 14522 21600;y3 */ h 6320 21600;y6 */ h 8615 21600;y9 */ h 13290 21600;y15 */ h 14935 21600',
    '~w21600 ~h21600 ' + PTS('10800,5800 14522,0 14155,5325 18380,4457 16702,7315 21097,8137 17607,10475 21600,13290 16837,12942 18145,18095 14020,14457 13247,19737 10532,14935 8485,21600 7715,15627 4762,17617 5667,13937 135,14587 3722,11775 0,8615 4627,7617 370,2295 7312,6320 8352,2295'),
    'x5 y3 x21 y15', '', '3cd4 x24 t;cd2 l y6;cd4 x12 b;0 r y9');
  D('irregularSeal2', '', 'x2 */ w 14790 21600;x5 */ w 5372 21600;x16 */ w 16380 21600;x18 */ w 4917 21600;y2 */ h 6532 21600;y6 */ h 6645 21600;y12 */ h 12877 21600;y15 */ h 15370 21600',
    '~w21600 ~h21600 ' + PTS('11462,4342 14790,0 14525,5777 18007,3172 16380,6532 21600,6645 16985,9402 18270,11290 16380,12310 18877,15632 14640,14350 14942,17370 12180,15935 11612,18842 9872,17370 8700,19712 7527,18125 4917,21600 4805,18240 1285,17825 3330,15370 0,12877 3935,11592 1172,8270 5372,7817 4502,3625 8550,6382 9722,1887'),
    'x5 y2 x16 y15', '', '3cd4 x2 t;cd2 l y12;cd4 x18 b;0 r y6');

  /* ---------- Golven ---------- */
  const WV = 'y1 */ h a1 100000;dy2 */ y1 10 3;y2 +- y1 0 dy2;y3 +- y1 dy2 0;y4 +- b 0 y1;y5 +- y4 0 dy2;y6 +- y4 dy2 0;dx1 */ w a2 100000;of2 */ w a2 50000;x1 abs dx1;dx2 ?: of2 0 of2;x2 +- l 0 dx2;';
  D('wave', 'adj1=12500 adj2=0', 'a1 pin 0 adj1 20000;a2 pin -10000 adj2 10000;' + WV + 'dx5 ?: of2 of2 0;x5 +- r 0 dx5;dx3 +/ dx2 x5 3;x3 +- x2 dx3 0;x4 +/ x3 x5 2;x6 +- l dx5 0;x10 +- r dx2 0;x7 +- x6 dx3 0;x8 +/ x7 x10 2;x9 +- r 0 x1;xAdj +- hc dx1 0;il max x2 x6;ir min x5 x10;it */ h a1 50000;ib +- b 0 it',
    'M x2 y1 C x3 y2 x4 y3 x5 y1 L x10 y4 C x8 y6 x7 y5 x6 y4 Z', 'il it ir ib', 'Y adj1 0 20000 l y1;X adj2 -10000 10000 xAdj b', '3cd4 hc y1;cd2 il vc;cd4 hc y4;0 ir vc');
  D('doubleWave', 'adj1=6250 adj2=0', 'a1 pin 0 adj1 12500;a2 pin -10000 adj2 10000;' + WV + 'dx8 ?: of2 of2 0;x8 +- r 0 dx8;dx3 +/ dx2 x8 6;x3 +- x2 dx3 0;dx4 +/ dx2 x8 3;x4 +- x2 dx4 0;x5 +/ x2 x8 2;x6 +- x5 dx3 0;x7 +/ x6 x8 2;x9 +- l dx8 0;x15 +- r dx2 0;x10 +- x9 dx3 0;x11 +- x9 dx4 0;x12 +/ x9 x15 2;x13 +- x12 dx3 0;x14 +/ x13 x15 2;x16 +- r 0 x1;xAdj +- hc dx1 0;il max x2 x9;ir min x8 x15;it */ h a1 50000;ib +- b 0 it',
    'M x2 y1 C x3 y2 x4 y3 x5 y1 C x6 y2 x7 y3 x8 y1 L x15 y4 C x14 y6 x13 y5 x12 y4 C x11 y6 x10 y5 x9 y4 Z', 'il it ir ib', 'Y adj1 0 12500 l y1;X adj2 -10000 10000 xAdj b', '3cd4 hc y1;cd2 il vc;cd4 hc y4;0 ir vc');
  /* ---------- Linten ---------- */
  const RB = 'a1 pin 0 adj1 33333;a2 pin 25000 adj2 75000;x10 +- r 0 wd8;dx2 */ w a2 200000;x2 +- hc 0 dx2;x9 +- hc dx2 0;x3 +- x2 wd32 0;x8 +- x9 0 wd32;x5 +- x2 wd8 0;x6 +- x9 0 wd8;x4 +- x5 0 wd32;x7 +- x6 wd32 0;hR */ h a1 400000;';
  const RB1 = 'M l t L x4 t A wd32 hR 3cd4 cd2 L x3 y1 A wd32 hR 3cd4 -10800000 L x8 y2 A wd32 hR cd4 -10800000 L x7 y1 A wd32 hR cd4 cd2 L r t L x10 y3 L r y4 L x9 y4 L x9 y5 A wd32 hR 0 cd4 L x3 b A wd32 hR cd4 cd4 L x2 y4 L l y4 L wd8 y3 Z';
  D('ribbon', 'adj1=16667 adj2=50000', RB + 'y1 */ h a1 200000;y2 */ h a1 100000;y4 +- b 0 y2;y3 */ y4 1 2;y5 +- b 0 hR;y6 +- y2 0 hR',
    '~s ' + RB1 + ' | ~s ~D M x5 hR A wd32 hR 0 cd4 L x3 y1 A wd32 hR 3cd4 -10800000 L x5 y2 Z M x6 hR A wd32 hR cd2 -5400000 L x8 y1 A wd32 hR 3cd4 cd2 L x6 y2 Z | ~n ' + RB1 + ' M x5 hR L x5 y2 M x6 y2 L x6 hR M x2 y4 L x2 y6 M x9 y6 L x9 y4',
    'x2 y2 x9 b', 'Y adj1 0 33333 hc y2;X adj2 25000 75000 x2 t', '3cd4 hc y2;cd2 wd8 y3;cd4 hc b;0 x10 y3');
  const RB2 = 'M l b L x4 b A wd32 hR cd4 -10800000 L x3 y1 A wd32 hR cd4 cd2 L x8 y2 A wd32 hR 3cd4 cd2 L x7 y1 A wd32 hR 3cd4 -10800000 L r b L x10 y3 L r y4 L x9 y4 L x9 hR A wd32 hR 0 -5400000 L x3 t A wd32 hR 3cd4 -5400000 L x2 y4 L l y4 L wd8 y3 Z';
  D('ribbon2', 'adj1=16667 adj2=50000', RB + 'dy1 */ h a1 200000;y1 +- b 0 dy1;dy2 */ h a1 100000;y2 +- b 0 dy2;y4 +- t dy2 0;y3 +/ y4 b 2;y6 +- b 0 hR;y7 +- y1 0 hR',
    '~s ' + RB2 + ' | ~s ~D M x5 y6 A wd32 hR 0 -5400000 L x3 y1 A wd32 hR cd4 cd2 L x5 y2 Z M x6 y6 A wd32 hR cd2 cd4 L x8 y1 A wd32 hR cd4 -10800000 L x6 y2 Z | ~n ' + RB2 + ' M x5 y2 L x5 y6 M x6 y6 L x6 y2 M x2 y7 L x2 y4 M x9 y4 L x9 y7',
    'x2 t x9 y2', 'Y adj1 0 33333 hc y2;X adj2 25000 75000 x2 b', '3cd4 hc t;cd2 wd8 y3;cd4 hc y2;0 x10 y3');
  // gebogen linten: randen zijn parabolen (kwadratische curven)
  const ER = 'a1 pin 0 adj1 100000;a2 pin 25000 adj2 75000;q10 +- 100000 0 a1;q11 */ q10 1 2;q12 +- a1 0 q11;minAdj3 max 0 q12;a3 pin minAdj3 adj3 a1;dx2 */ w a2 200000;x2 +- hc 0 dx2;x3 +- x2 wd8 0;x4 +- r 0 x3;x5 +- r 0 x2;x6 +- r 0 wd8;dy1 */ h a3 100000;f1 */ 4 dy1 w;q1 */ x3 x3 w;q2 +- x3 0 q1;y1 */ f1 q2 1;cx1 */ x3 1 2;cy1 */ f1 cx1 1;cx2 +- r 0 cx1;qa */ h a1 100000;dy3 +- qa 0 dy1;q3 */ x2 x2 w;q4 +- x2 0 q3;q5 */ f1 q4 1;y3 +- q5 dy3 0;q6 +- dy1 dy3 y3;q7 +- q6 dy1 0;cy3 +- q7 dy3 0;rh +- b 0 qa;q8 */ dy1 14 16;y2 +/ q8 rh 2;y5 +- q5 rh 0;y6 +- y3 rh 0;cx4 */ x2 1 2;q9 */ f1 cx4 1;cy4 +- q9 rh 0;cx5 +- r 0 cx4;cy6 +- cy3 rh 0;y7 +- y1 dy3 0;y8 +- b 0 dy1;u1 */ f1 x2 w;s2 +- f1 0 u1;s3 +- s2 0 u1;cx6 +- x2 wd16 0;cx7 +- r 0 cx6;u2 */ s3 wd16 1;cy8 +- y3 u2 0;yb +/ y6 cy6 2;';
  const ER1 = 'M l t Q cx1 cy1 x3 y1 L x2 y3 Q hc cy3 x5 y3 L x4 y1 Q cx2 cy1 r t L x6 y2 L r rh Q cx5 cy4 x5 y5 L x5 y6 Q hc cy6 x2 y6 L x2 y5 Q cx4 cy4 l rh L wd8 y2 Z';
  D('ellipseRibbon', 'adj1=25000 adj2=50000 adj3=12500', ER,
    '~s ' + ER1 + ' | ~s ~d M x3 y7 L x3 y1 L x2 y3 Q cx6 cy8 x3 y7 Z M x4 y7 L x4 y1 L x5 y3 Q cx7 cy8 x4 y7 Z | ~n ' + ER1 + ' M x2 y5 L x2 y3 M x5 y3 L x5 y5 M x3 y1 L x3 y7 M x4 y7 L x4 y1',
    'x2 qa x5 y6', 'Y adj1 0 100000 hc qa;X adj2 25000 75000 x2 t;Y adj3 minAdj3 a1 l y8', '3cd4 hc qa;cd2 wd8 y2;cd4 hc yb;0 x6 y2');
  const MIR = (names) => names.split(' ').map((n) => `m${n} +- b 0 ${n}`).join(';');
  const ER2 = 'M l b Q cx1 mcy1 x3 my1 L x2 my3 Q hc mcy3 x5 my3 L x4 my1 Q cx2 mcy1 r b L x6 my2 L r mrh Q cx5 mcy4 x5 my5 L x5 my6 Q hc mcy6 x2 my6 L x2 my5 Q cx4 mcy4 l mrh L wd8 my2 Z';
  D('ellipseRibbon2', 'adj1=25000 adj2=50000 adj3=12500', ER + MIR('y1 y2 y3 y5 y6 y7 y8 cy1 cy3 cy4 cy6 cy8 rh qa yb'),
    '~s ' + ER2 + ' | ~s ~d M x3 my7 L x3 my1 L x2 my3 Q cx6 mcy8 x3 my7 Z M x4 my7 L x4 my1 L x5 my3 Q cx7 mcy8 x4 my7 Z | ~n ' + ER2 + ' M x2 my5 L x2 my3 M x5 my3 L x5 my5 M x3 my1 L x3 my7 M x4 my7 L x4 my1',
    'x2 my6 x5 mqa', 'Y adj1 0 100000 hc mqa;X adj2 25000 75000 x2 b;Y adj3 minAdj3 a1 l dy1', '3cd4 hc myb;cd2 wd8 my2;cd4 hc mqa;0 x6 my2');
  const LRR = 'M l ly2 L x1 t L x1 ly1 L hc ly1 A wd32 hR 3cd4 cd2 A wd32 hR 3cd4 -10800000 L x4 ry2 L x4 ry1 L r ry3 L x4 b L x4 ry4 L hc ry4 A wd32 hR cd4 cd4 L x2 ly3 L x1 ly3 L x1 ly4 Z';
  D('leftRightRibbon', 'adj1=50000 adj2=50000 adj3=16667', 'a3 pin 0 adj3 33333;maxAdj1 +- 100000 0 a3;a1 pin 0 adj1 maxAdj1;w1 +- wd2 0 wd32;maxAdj2 */ 100000 w1 ss;a2 pin 0 adj2 maxAdj2;x1 */ ss a2 100000;x4 +- r 0 x1;dy1 */ h a1 200000;dy2 */ h a3 -200000;ly1 +- vc dy2 dy1;ry4 +- vc dy1 dy2;ly2 +- ly1 dy1 0;ry3 +- b 0 ly2;ly4 */ ly2 2 1;ry1 +- b 0 ly4;ly3 +- ly4 0 ly1;ry2 +- b 0 ly3;hR */ a3 h 400000;x2 +- hc 0 wd32;x3 +- hc wd32 0;y1 +- ly1 hR 0;y2 +- ry2 0 hR',
    '~s ' + LRR + ' | ~s ~D M x3 y1 A wd32 hR 0 cd4 A wd32 hR 3cd4 -10800000 L x3 ry2 Z | ~n ' + LRR + ' M x3 y1 L x3 ry2 M x2 y2 L x2 ly3',
    'x1 ly1 x4 ry4', 'Y adj1 0 maxAdj1 x3 ly1;X adj2 0 maxAdj2 x1 t;Y adj3 0 33333 r ry3', 'cd2 l ly2;0 r ry3');

  /* ---------- Perkamentrollen ---------- */
  D('verticalScroll', 'adj=12500', 'a pin 0 adj 25000;ch */ ss a 100000;ch2 */ ch 1 2;ch4 */ ch 1 4;x3 +- ch ch2 0;x4 +- ch ch 0;x6 +- r 0 ch;x7 +- r 0 ch2;x5 +- x6 0 ch2;y3 +- b 0 ch;y4 +- b 0 ch2',
    '~s M ch2 b A ch2 ch2 cd4 -5400000 L ch2 y4 A ch4 ch4 cd4 -10800000 L ch y3 L ch ch2 A ch2 ch2 cd2 cd4 L x7 t A ch2 ch2 3cd4 cd2 L x6 ch L x6 y4 A ch2 ch2 0 cd4 Z M x4 ch2 A ch2 ch2 0 cd4 A ch4 ch4 cd4 cd2 Z' +
    ' | ~s ~D M x4 ch2 A ch2 ch2 0 cd4 A ch4 ch4 cd4 cd2 Z M ch y4 A ch2 ch2 0 3cd4 A ch4 ch4 3cd4 cd2 Z' +
    ' | ~n M ch y3 L ch ch2 A ch2 ch2 cd2 cd4 L x7 t A ch2 ch2 3cd4 cd2 L x6 ch L x6 y4 A ch2 ch2 0 cd4 L ch2 b A ch2 ch2 cd4 cd2 Z M x3 t A ch2 ch2 3cd4 cd2 A ch4 ch4 cd4 cd2 L x4 ch2 M x6 ch L x3 ch M ch2 y3 A ch4 ch4 3cd4 cd2 L ch y4 M ch2 b A ch2 ch2 cd4 -5400000 L ch y3',
    'ch ch x6 y4', 'Y adj 0 25000 l ch', '3cd4 hc ch;cd2 ch vc;cd4 hc y4;0 x6 vc');
  D('horizontalScroll', 'adj=12500', 'a pin 0 adj 25000;ch */ ss a 100000;ch2 */ ch 1 2;ch4 */ ch 1 4;y3 +- ch ch2 0;y4 +- ch ch 0;y6 +- b 0 ch;y7 +- b 0 ch2;y5 +- y6 0 ch2;x3 +- r 0 ch;x4 +- r 0 ch2',
    '~s M r ch2 A ch2 ch2 0 cd4 L x4 ch2 A ch4 ch4 0 cd2 L x3 ch L ch2 ch A ch2 ch2 3cd4 -5400000 L l y7 A ch2 ch2 cd2 -10800000 L ch y6 L x4 y6 A ch2 ch2 cd4 -5400000 Z M ch2 y4 A ch2 ch2 cd4 -5400000 A ch4 ch4 0 -10800000 Z' +
    ' | ~s ~D M ch2 y4 A ch2 ch2 cd4 -5400000 A ch4 ch4 0 -10800000 Z M x4 ch A ch2 ch2 cd4 -16200000 A ch4 ch4 cd2 -10800000 Z' +
    ' | ~n M x3 ch L ch2 ch A ch2 ch2 3cd4 -5400000 L l y7 A ch2 ch2 cd2 -10800000 L ch y6 L x4 y6 A ch2 ch2 cd4 -5400000 L r ch2 A ch2 ch2 0 -10800000 Z M l y3 A ch2 ch2 cd2 -10800000 A ch4 ch4 0 -10800000 L ch2 y4 M ch y6 L ch y3 M x3 ch2 A ch4 ch4 cd2 -10800000 L x4 ch M r ch2 A ch2 ch2 0 cd4 L x3 ch',
    'ch ch x4 y6', 'X adj 0 25000 ch t', 'cd2 ch vc;3cd4 hc ch;0 x4 vc;cd4 hc y6');
  /* ---------- Toelichtingen: tekstballonnen ---------- */
  const BIG = '-2147483647 2147483647';
  const TAIL = `XY adj1 ${BIG} adj2 ${BIG} xPos yPos`;
  const WG = 'dxPos */ w adj1 100000;dyPos */ h adj2 100000;xPos +- hc dxPos 0;yPos +- vc dyPos 0;';
  const WR = WG + 'dx */ dxPos h 1;dy */ dyPos w 1;adx abs dx;ady abs dy;dq +- adx 0 ady;xg1 ?: dxPos 7 2;xg2 ?: dxPos 10 5;x1 */ w xg1 12;x2 */ w xg2 12;yg1 ?: dyPos 7 2;yg2 ?: dyPos 10 5;y1 */ h yg1 12;y2 */ h yg2 12;t1 ?: dxPos l xPos;xl ?: dq t1 l;t2 ?: dyPos x1 xPos;xt ?: dq x1 t2;t3 ?: dxPos xPos r;xr ?: dq r t3;t4 ?: dyPos xPos x1;xb ?: dq t4 x1;t5 ?: dxPos y1 yPos;yl ?: dq y1 t5;t6 ?: dyPos t yPos;yt ?: dq t6 t;t7 ?: dxPos yPos y1;yr ?: dq y1 t7;t8 ?: dyPos yPos b;yb ?: dq t8 b;';
  D('wedgeRectCallout', 'adj1=-20833 adj2=62500', WR,
    'M l t L x1 t L xt yt L x2 t L r t L r y1 L xr yr L r y2 L r b L x2 b L xb yb L x1 b L l b L l y2 L xl yl L l y1 Z', 'l t r b', TAIL, R4 + ';cd4 xPos yPos');
  D('wedgeRoundRectCallout', 'adj1=-20833 adj2=62500 adj3=16667', WR + 'u1 */ ss adj3 100000;u2 +- r 0 u1;v2 +- b 0 u1;il */ u1 29289 100000;ir +- r 0 il;ib +- b 0 il',
    'M l u1 A u1 u1 cd2 cd4 L x1 t L xt yt L x2 t L u2 t A u1 u1 3cd4 cd4 L r y1 L xr yr L r y2 L r v2 A u1 u1 0 cd4 L x2 b L xb yb L x1 b L u1 b A u1 u1 cd4 cd4 L l y2 L xl yl L l y1 Z',
    'il il ir ib', TAIL, R4 + ';cd4 xPos yPos');
  D('wedgeEllipseCallout', 'adj1=-20833 adj2=62500', WG + 'sdx */ dxPos h 1;sdy */ dyPos w 1;pang at2 sdx sdy;stAng +- pang 660000 0;enAng +- pang 0 660000;dx1 cos wd2 stAng;dy1 sin hd2 stAng;x1 +- hc dx1 0;y1 +- vc dy1 0;dx2 cos wd2 enAng;dy2 sin hd2 enAng;x2 +- hc dx2 0;y2 +- vc dy2 0;stAng1 at2 dx1 dy1;enAng1 at2 dx2 dy2;swAng1 +- enAng1 0 stAng1;swAng2 +- swAng1 21600000 0;swAng ?: swAng1 swAng1 swAng2;' + IBOX,
    'M xPos yPos L x1 y1 A wd2 hd2 stAng1 swAng Z', 'il it ir ib', TAIL, ECX + ';cd4 xPos yPos');
  D('cloudCallout', 'adj1=-20833 adj2=62500', WG + 'ht cat2 hd2 dxPos dyPos;wt sat2 wd2 dxPos dyPos;g2 cat2 wd2 ht wt;g3 sat2 hd2 ht wt;g4 +- hc g2 0;g5 +- vc g3 0;g6 +- g4 0 xPos;g7 +- g5 0 yPos;g8 mod g6 g7 0;g9 */ ss 6600 21600;g10 +- g8 0 g9;g11 */ g10 1 3;g12 */ ss 1800 21600;g13 +- g11 g12 0;g14 */ g13 g6 g8;g15 */ g13 g7 g8;g16 +- g14 xPos 0;g17 +- g15 yPos 0;g18 */ ss 4800 21600;g19 */ g11 2 1;g20 +- g18 g19 0;g21 */ g20 g6 g8;g22 */ g20 g7 g8;g23 +- g21 xPos 0;g24 +- g22 yPos 0;g25 */ ss 1200 21600;g26 */ ss 600 21600;x23 +- xPos g26 0;x24 +- g16 g25 0;x25 +- g23 g12 0;' + CLOUDG,
    '~w43200 ~h43200 ' + CLOUD + ' | M x23 yPos A g26 g26 0 21600000 Z | M x24 g17 A g25 g25 0 21600000 Z | M x25 g24 A g12 g12 0 21600000 Z | ~n ~w43200 ~h43200 ' + CLOUD2,
    'il it ir ib', TAIL, '0 cx2 cy2;cd4 cx1 cy1;cd2 cx3 cy3;3cd4 cx4 cy4;cd4 xPos yPos');

  /* ---------- Toelichtingen met lijn (callout1-3, accent-, rand-) ---------- */
  const COAV = ['', 'adj1=18750 adj2=-8333 adj3=112500 adj4=-38333', 'adj1=18750 adj2=-8333 adj3=18750 adj4=-16667 adj5=112500 adj6=-46667',
    'adj1=18750 adj2=-8333 adj3=18750 adj4=-16667 adj5=100000 adj6=-16667 adj7=112963 adj8=-8333'];
  const RECT = 'M l t L r t L r b L l b Z';
  [1, 2, 3].forEach((n) => {
    const gd = [], ln = [], ah = [];
    for (let i = 1; i <= n + 1; i++) {
      gd.push(`y${i} */ h adj${2 * i - 1} 100000`, `x${i} */ w adj${2 * i} 100000`);
      ln.push((i > 1 ? 'L' : 'M') + ` x${i} y${i}`);
      ah.push(`XY adj${2 * i} ${BIG} adj${2 * i - 1} ${BIG} x${i} y${i}`);
    }
    const L = ' | ~n ' + ln.join(' '), BAR = ' | ~n M x1 t L x1 b';
    D('callout' + n, COAV[n], gd.join(';'), '~s ' + RECT + L, 'l t r b', ah.join(';'), 'R');
    D('accentCallout' + n, COAV[n], gd.join(';'), '~s ' + RECT + BAR + L, 'l t r b', ah.join(';'), 'R');
    D('borderCallout' + n, COAV[n], gd.join(';'), RECT + L, 'l t r b', ah.join(';'), 'R');
    D('accentBorderCallout' + n, COAV[n], gd.join(';'), RECT + BAR + L, 'l t r b', ah.join(';'), 'R');
  });
  /* ---------- Vergelijkingsvormen ---------- */
  D('mathPlus', 'adj1=23520', 'a1 pin 0 adj1 73490;dx1 */ w 73490 200000;dy1 */ h 73490 200000;dx2 */ ss a1 200000;x1 +- hc 0 dx1;x2 +- hc 0 dx2;x3 +- hc dx2 0;x4 +- hc dx1 0;y1 +- vc 0 dy1;y2 +- vc 0 dx2;y3 +- vc dx2 0;y4 +- vc dy1 0',
    'M x1 y2 L x2 y2 L x2 y1 L x3 y1 L x3 y2 L x4 y2 L x4 y3 L x3 y3 L x3 y4 L x2 y4 L x2 y3 L x1 y3 Z', 'x1 y2 x4 y3', 'Y adj1 0 73490 l y2', '0 x4 vc;cd4 hc y4;cd2 x1 vc;3cd4 hc y1');
  D('mathMinus', 'adj1=23520', 'a1 pin 0 adj1 100000;dy1 */ h a1 200000;dx1 */ w 73490 200000;y1 +- vc 0 dy1;y2 +- vc dy1 0;x1 +- hc 0 dx1;x2 +- hc dx1 0',
    'M x1 y1 L x2 y1 L x2 y2 L x1 y2 Z', 'x1 y1 x2 y2', 'Y adj1 0 100000 l y1', '0 x2 vc;cd4 hc y2;cd2 x1 vc;3cd4 hc y1');
  D('mathMultiply', 'adj1=23520', 'a1 pin 0 adj1 51965;th */ ss a1 100000;a at2 w h;sa sin 1 a;ca cos 1 a;ta tan 1 a;dl mod w h 0;rw */ dl 51965 100000;lM +- dl 0 rw;xM */ ca lM 2;yM */ sa lM 2;dxAM */ sa th 2;dyAM */ ca th 2;xA +- xM 0 dxAM;yA +- yM dyAM 0;xB +- xM dxAM 0;yB +- yM 0 dyAM;xBC +- hc 0 xB;yBC */ xBC ta 1;yC +- yBC yB 0;xD +- r 0 xB;xE +- r 0 xA;yFE +- vc 0 yA;xFE */ yFE 1 ta;xF +- xE 0 xFE;xL +- xA xFE 0;yG +- b 0 yA;yH +- b 0 yB;yI +- b 0 yC;xC2 +- r 0 xM;yC3 +- b 0 yM',
    'M xA yA L xB yB L hc yC L xD yB L xE yA L xF vc L xE yG L xD yH L hc yI L xB yH L xA yG L xL vc Z', 'xA yB xE yH', 'X adj1 0 51965 xA yA', 'cd2 xM yM;3cd4 xC2 yM;0 xC2 yC3;cd4 xM yC3');
  D('mathDivide', 'adj1=23520 adj2=5880 adj3=11760', 'a1 pin 1000 adj1 36745;ma1 +- 36745 0 a1;ma3h +/ 73490 ma1 4;ma3w */ 36745 w h;maxAdj3 min ma3h ma3w;a3 pin 1000 adj3 maxAdj3;m4a3 */ -4 a3 1;maxAdj2 +- 73490 m4a3 a1;a2 pin 0 adj2 maxAdj2;dy1 */ h a1 200000;yg */ h a2 100000;rad */ h a3 100000;dx1 */ w 73490 200000;y3 +- vc 0 dy1;y4 +- vc dy1 0;a +- yg rad 0;y2 +- y3 0 a;y1 +- y2 0 rad;y5 +- b 0 y1;x1 +- hc 0 dx1;x3 +- hc dx1 0;x2 +- hc 0 rad',
    'M hc y1 A rad rad 3cd4 21600000 Z M hc y5 A rad rad cd4 21600000 Z M x1 y3 L x3 y3 L x3 y4 L x1 y4 Z', 'x1 y3 x3 y4', 'Y adj1 1000 36745 l y3;Y adj2 0 maxAdj2 r y2;X adj3 1000 maxAdj3 x2 t', '3cd4 hc y1;cd4 hc y5;cd2 x1 vc;0 x3 vc');
  D('mathEqual', 'adj1=23520 adj2=11760', 'a1 pin 0 adj1 36745;a1x2 */ a1 2 1;mAdj2 +- 100000 0 a1x2;a2 pin 0 adj2 mAdj2;dy1 */ h a1 100000;dy2 */ h a2 200000;dx1 */ w 73490 200000;y2 +- vc 0 dy2;y3 +- vc dy2 0;y1 +- y2 0 dy1;y4 +- y3 dy1 0;x1 +- hc 0 dx1;x2 +- hc dx1 0;yC1 +/ y1 y2 2;yC2 +/ y3 y4 2',
    'M x1 y1 L x2 y1 L x2 y2 L x1 y2 Z M x1 y3 L x2 y3 L x2 y4 L x1 y4 Z', 'x1 y1 x2 y4', 'Y adj1 0 36745 l y1;Y adj2 0 mAdj2 r y2', '0 x2 yC1;0 x2 yC2;cd4 hc y4;cd2 x1 yC1;cd2 x1 yC2;3cd4 hc y1');
  D('mathNotEqual', 'adj1=23520 adj2=6600000 adj3=11760', 'a1 pin 0 adj1 50000;crAng pin 4200000 adj2 6600000;a1x2 */ a1 2 1;maxAdj3 +- 100000 0 a1x2;a3 pin 0 adj3 maxAdj3;dy1 */ h a1 100000;dy2 */ h a3 200000;dx1 */ w 73490 200000;x1 +- hc 0 dx1;x8 +- hc dx1 0;y2 +- vc 0 dy2;y3 +- vc dy2 0;y1 +- y2 0 dy1;y4 +- y3 dy1 0;cadj2 +- crAng 0 cd4;xadj2 tan hd2 cadj2;len mod xadj2 hd2 0;bhw */ len dy1 hd2;bhw2 */ bhw 1 2;x7 +- hc xadj2 bhw2;dx67 */ xadj2 y1 hd2;x6 +- x7 0 dx67;dx57 */ xadj2 y2 hd2;x5 +- x7 0 dx57;dx47 */ xadj2 y3 hd2;x4 +- x7 0 dx47;dx37 */ xadj2 y4 hd2;x3 +- x7 0 dx37;rx7 +- x7 bhw 0;rx6 +- x6 bhw 0;rx5 +- x5 bhw 0;rx4 +- x4 bhw 0;rx3 +- x3 bhw 0;dx7 */ dy1 hd2 len;rxt +- x7 dx7 0;lxt +- rx7 0 dx7;rx ?: cadj2 rxt rx7;lx ?: cadj2 x7 lxt;dy3 */ dy1 xadj2 len;dy4 +- 0 0 dy3;ry ?: cadj2 dy3 t;ly ?: cadj2 t dy4;dlx +- w 0 rx;drx +- w 0 lx;dly +- h 0 ry;dry +- h 0 ly;xC1 +/ rx lx 2;xC2 +/ drx dlx 2;yC1 +/ ry ly 2;yC2 +/ y1 y2 2;yC3 +/ y3 y4 2;yC4 +/ dry dly 2',
    'M x1 y1 L x6 y1 L lx ly L rx ry L rx6 y1 L x8 y1 L x8 y2 L rx5 y2 L rx4 y3 L x8 y3 L x8 y4 L rx3 y4 L drx dry L dlx dly L x3 y4 L x1 y4 L x1 y3 L x4 y3 L x5 y2 L x1 y2 Z',
    'x1 y1 x8 y4', 'Y adj1 0 50000 l y1;P - - - adj2 4200000 6600000 lx t;Y adj3 0 maxAdj3 r y2', '0 x8 yC2;cd4 xC2 yC4;cd2 x1 yC2;3cd4 xC1 yC1;0 x8 yC3;cd2 x1 yC3');

  /* ---------- Actieknoppen: pictogram in een vierkant van 3/4 ss (~i = eenheden 0..16) ---------- */
  const AB = (id, icon, line) => D(id, '', '', '~s ' + RECT + (icon ? ' | ' + icon + ' | ~n ' + (line || '~i ' + icon.replace(/~\S+ /g, '').replace(/\|/g, '')) : '') + ' | ~n M r t L r b L l b L l t Z', 'l t r b', '', 'R');
  const DK = '~s ~d ~i ', DL = '~s ~D ~i ', LT = '~s ~l ~i ';
  AB('actionButtonBlank', '');
  AB('actionButtonHome', DL + 'M 8 1.5 L 1.5 8 L 3.5 8 L 3.5 14.5 L 12.5 14.5 L 12.5 8 L 14.5 8 Z M 10.5 2.5 L 12.5 2.5 L 12.5 6 L 10.5 4 Z | ' + DK + 'M 7 10 L 9 10 L 9 14.5 L 7 14.5 Z',
    '~i M 8 1.5 L 1.5 8 L 3.5 8 L 3.5 14.5 L 12.5 14.5 L 12.5 8 L 14.5 8 Z M 10.5 3.9 L 10.5 2.5 L 12.5 2.5 L 12.5 6 M 7 14.5 L 7 10 L 9 10 L 9 14.5');
  AB('actionButtonHelp', DK + 'M 4 6 A 4 4 cd2 13500000 L 9 10.2 L 9 11.5 L 7 11.5 L 7 9.4 L 9.41 7.41 A 2 2 2700000 -13500000 Z M 9.2 13.8 A 1.2 1.2 0 21600000 Z');
  AB('actionButtonInformation', DL + 'M 1 8 A 7 7 cd2 21600000 Z | ' + LT + 'M 9.3 4.2 A 1.3 1.3 0 21600000 Z M 6.4 6.8 L 9.2 6.8 L 9.2 12 L 10 12 L 10 13 L 6 13 L 6 12 L 6.8 12 L 6.8 7.8 L 6.4 7.8 Z',
    '~i M 1 8 A 7 7 cd2 21600000 Z M 9.3 4.2 A 1.3 1.3 0 21600000 Z M 6.4 6.8 L 9.2 6.8 L 9.2 12 L 10 12 L 10 13 L 6 13 L 6 12 L 6.8 12 L 6.8 7.8 L 6.4 7.8 Z');
  AB('actionButtonForwardNext', DK + 'M 16 8 L 0 0 L 0 16 Z');
  AB('actionButtonBackPrevious', DK + 'M 0 8 L 16 0 L 16 16 Z');
  AB('actionButtonEnd', DK + 'M 12 8 L 0 0 L 0 16 Z M 14 0 L 16 0 L 16 16 L 14 16 Z');
  AB('actionButtonBeginning', DK + 'M 4 8 L 16 0 L 16 16 Z M 2 0 L 0 0 L 0 16 L 2 16 Z');
  AB('actionButtonReturn', DK + 'M 13.5 3 L 13.5 10 A 5.5 5.5 0 cd2 L 2.5 7 L 0.5 7 L 4 2.5 L 7.5 7 L 5.5 7 L 5.5 10 A 2.5 2.5 cd2 -10800000 L 10.5 3 Z');
  AB('actionButtonDocument', DL + 'M 3 0 L 10 0 L 13 3 L 13 16 L 3 16 Z | ' + DK + 'M 10 0 L 10 3 L 13 3 Z', '~i M 3 0 L 10 0 L 13 3 L 13 16 L 3 16 Z M 10 0 L 10 3 L 13 3');
  AB('actionButtonSound', DK + 'M 1 5.5 L 4.5 5.5 L 9 1.5 L 9 14.5 L 4.5 10.5 L 1 10.5 Z', '~i M 1 5.5 L 4.5 5.5 L 9 1.5 L 9 14.5 L 4.5 10.5 L 1 10.5 Z M 11 5 L 15 3 M 11 8 L 15.5 8 M 11 11 L 15 13');
  AB('actionButtonMovie', DK + 'M 0 4.5 L 10.5 4.5 L 10.5 7 L 15.5 4 L 15.5 12 L 10.5 9 L 10.5 11.5 L 0 11.5 Z | ' + DL + 'M 1 2.75 A 1.75 1.75 cd2 21600000 Z M 5.5 2.75 A 1.75 1.75 cd2 21600000 Z',
    '~i M 0 4.5 L 10.5 4.5 L 10.5 7 L 15.5 4 L 15.5 12 L 10.5 9 L 10.5 11.5 L 0 11.5 Z M 1 2.75 A 1.75 1.75 cd2 21600000 Z M 5.5 2.75 A 1.75 1.75 cd2 21600000 Z');

  /* ---------- Overige basisvormen: tandwielen, trechter, tabs, grafiekmarkeringen ---------- */
  const GEAR = (id, n, av, max1, max2) => {
    const pitch = 360 / n, ab = pitch / 4, A = (d) => Math.round((((d % 360) + 360) % 360) * 60000);
    const g = [`a1 pin 0 adj1 ${max1}`, `a2 pin 0 adj2 ${max2}`, 'th */ ss a1 100000', 'lFD */ ss a2 100000', 'rw +- wd2 0 th', 'rh +- hd2 0 th', 'dA at2 ssd2 lFD', `aT0 +- ${A(ab)} 0 dA`, 'aT max aT0 0',
      'idx cos rw 2700000', 'idy sin rh 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy', 'ib +- vc idy 0'];
    const pt = (nm, rx, ry, ang) => g.push(`w${nm} sin ${rx} ${ang}`, `h${nm} cos ${ry} ${ang}`, `dx${nm} cat2 ${rx} h${nm} w${nm}`, `dy${nm} sat2 ${ry} h${nm} w${nm}`, `x${nm} +- hc dx${nm} 0`, `y${nm} +- vc dy${nm} 0`);
    let p = '';
    for (let k = 0; k < n; k++) {
      const c = -90 + k * pitch;
      g.push(`p${k} +- ${A(c)} 0 aT`, `q${k} +- ${A(c)} aT 0`);
      pt('b' + k, 'rw', 'rh', A(c - ab)); pt('t' + k, 'wd2', 'hd2', 'p' + k); pt('u' + k, 'wd2', 'hd2', 'q' + k); pt('e' + k, 'rw', 'rh', A(c + ab));
      p += (k ? ' L ' : 'M ') + `xb${k} yb${k} L xt${k} yt${k} L xu${k} yu${k} L xe${k} ye${k} A rw rh ${A(c + ab)} ${Math.round((pitch - 2 * ab) * 60000)}`;
    }
    D(id, av, g.join(';'), p + ' Z', 'il it ir ib', `Y adj1 0 ${max1} xb0 yb0;X adj2 0 ${max2} xt0 yt0`, 'R');
  };
  GEAR('gear6', 6, 'adj1=15000 adj2=3526', 20000, 5359);
  GEAR('gear9', 9, 'adj1=10000 adj2=1763', 20000, 2679);
  D('funnel', '', 'd */ ss 1 20;rw2 +- wd2 0 d;rh2 +- hd4 0 d;t1 cos wd2 480000;t2 sin hd4 480000;da at2 t1 t2;da2 */ da 2 1;stAng1 +- cd2 0 da;swAng1 +- cd2 da2 0;swAng3 +- cd2 0 da2;rw3 */ wd2 1 4;rh3 */ hd4 1 4;ct1 cos hd4 stAng1;st1 sin wd2 stAng1;m1 mod ct1 st1 0;n1 */ wd2 hd4 m1;dx1 cos n1 stAng1;dy1 sin n1 stAng1;x1 +- hc dx1 0;y1 +- hd4 dy1 0;ct3 cos rh3 da;st3 sin rw3 da;m3 mod ct3 st3 0;n3 */ rw3 rh3 m3;dx3 cos n3 da;dy3 sin n3 da;x3 +- hc dx3 0;vc3 +- b 0 rh3;y2 +- vc3 dy3 0;x2 +- wd2 0 rw2',
    'M x1 y1 A wd2 hd4 stAng1 swAng1 L x3 y2 A rw3 rh3 da swAng3 Z M x2 hd4 A rw2 rh2 cd2 -21600000 Z', 'l t r b', '', '3cd4 hc t;cd2 l hd4;cd4 hc b;0 r hd4');
  const TABG = 'md mod w h 0;dx */ 1 md 20;y1 +- 0 b dx;x1 +- 0 r dx';
  D('cornerTabs', '', TABG, 'M l t L dx t L l dx Z M l y1 L dx b L l b Z M x1 t L r t L r dx Z M r y1 L r b L x1 b Z', 'dx dx x1 y1', '', 'cd2 l t;cd2 l b;0 r t;0 r b');
  D('squareTabs', '', TABG, 'M l t L dx t L dx dx L l dx Z M l y1 L dx y1 L dx b L l b Z M x1 t L r t L r dx L x1 dx Z M x1 y1 L r y1 L r b L x1 b Z', 'dx dx x1 y1', '', 'cd2 l t;cd2 l b;0 r t;0 r b');
  D('plaqueTabs', '', TABG, 'M l t L dx t A dx dx 0 cd4 L l dx Z M l y1 A dx dx 3cd4 cd4 L dx b L l b Z M r t L r dx A dx dx cd4 cd4 L x1 t Z M x1 b A dx dx cd2 cd4 L r y1 L r b Z', 'dx dx x1 y1', '', 'cd2 l t;cd2 l b;0 r t;0 r b');
  const SQ10 = '~s ~w10 ~h10 M 0 0 L 10 0 L 10 10 L 0 10 Z | ~n ~w10 ~h10 ';
  D('chartX', '', '', SQ10 + 'M 0 0 L 10 10 M 0 10 L 10 0', 'l t r b', '', 'R');
  D('chartStar', '', '', SQ10 + 'M 0 0 L 10 10 M 0 10 L 10 0 M 5 0 L 5 10', 'l t r b', '', 'R');
  D('chartPlus', '', '', SQ10 + 'M 5 0 L 5 10 M 0 5 L 10 5', 'l t r b', '', 'R');

  /* ---------- Lijnen en verbindingslijnen ---------- */
  const LC = 'cd4 l t;3cd4 r b';
  D('line', '', '', '~n M l t L r b', 'l t r b', '', LC);
  D('lineInv', '', '', '~n M l b L r t', 'l t r b', '', 'cd4 l b;3cd4 r t');
  D('straightConnector1', '', '', '~n M l t L r b', 'l t r b', '', LC);
  D('bentConnector2', '', '', '~n M l t L r t L r b', 'l t r b', '', LC);
  D('bentConnector3', 'adj1=50000', 'x1 */ w adj1 100000', '~n M l t L x1 t L x1 b L r b', 'l t r b', `X adj1 ${BIG} x1 vc`, LC);
  D('bentConnector4', 'adj1=50000 adj2=50000', 'x1 */ w adj1 100000;x2 +/ x1 r 2;y2 */ h adj2 100000;y1 +/ t y2 2', '~n M l t L x1 t L x1 y2 L r y2 L r b', 'l t r b', `X adj1 ${BIG} x1 y1;Y adj2 ${BIG} x2 y2`, LC);
  D('bentConnector5', 'adj1=50000 adj2=50000 adj3=50000', 'x1 */ w adj1 100000;x3 */ w adj3 100000;x2 +/ x1 x3 2;y2 */ h adj2 100000;y1 +/ t y2 2;y3 +/ b y2 2', '~n M l t L x1 t L x1 y2 L x3 y2 L x3 b L r b', 'l t r b', `X adj1 ${BIG} x1 y1;Y adj2 ${BIG} x2 y2;X adj3 ${BIG} x3 y3`, LC);
  D('curvedConnector2', '', '', '~n M l t C wd2 t r hd2 r b', 'l t r b', '', LC);
  D('curvedConnector3', 'adj1=50000', 'x2 */ w adj1 100000;x1 +/ l x2 2;x3 +/ r x2 2;y3 */ h 3 4', '~n M l t C x1 t x2 hd4 x2 vc C x2 y3 x3 b r b', 'l t r b', `X adj1 ${BIG} x2 vc`, LC);
  D('curvedConnector4', 'adj1=50000 adj2=50000', 'x2 */ w adj1 100000;x1 +/ l x2 2;x3 +/ r x2 2;x4 +/ x2 x3 2;x5 +/ x3 r 2;y4 */ h adj2 100000;y1 +/ t y4 2;y2 +/ t y1 2;y3 +/ y1 y4 2;y5 +/ b y4 2',
    '~n M l t C x1 t x2 y2 x2 y1 C x2 y3 x4 y4 x3 y4 C x5 y4 r y5 r b', 'l t r b', `X adj1 ${BIG} x2 y1;Y adj2 ${BIG} x3 y4`, LC);
  D('curvedConnector5', 'adj1=50000 adj2=50000 adj3=50000', 'x3 */ w adj1 100000;x6 */ w adj3 100000;x1 +/ x3 x6 2;x2 +/ l x3 2;x4 +/ x3 x1 2;x5 +/ x6 x1 2;x7 +/ x6 r 2;y4 */ h adj2 100000;y1 +/ t y4 2;y2 +/ t y1 2;y3 +/ y1 y4 2;y5 +/ b y4 2;y6 +/ y5 y4 2;y7 +/ y5 b 2',
    '~n M l t C x2 t x3 y2 x3 y1 C x3 y3 x4 y4 x1 y4 C x5 y4 x6 y6 x6 y5 C x6 y7 x7 b r b', 'l t r b', `X adj1 ${BIG} x3 y1;Y adj2 ${BIG} x1 y4;X adj3 ${BIG} x6 y5`, LC);

  /* ---------- Galerij: categorieën en volgorde zoals Invoegen › Vormen ---------- */
  const CATS = [{ id: 'lines', name: 'Lijnen' }, { id: 'rect', name: 'Rechthoeken' }, { id: 'basic', name: 'Basisvormen' },
    { id: 'arrows', name: 'Blokpijlen' }, { id: 'eq', name: 'Vergelijkingsvormen' }, { id: 'flow', name: 'Stroomdiagram' },
    { id: 'stars', name: 'Sterren en banners' }, { id: 'callouts', name: 'Toelichtingen' }, { id: 'action', name: 'Actieknoppen' }];
  const G = {
    lines: [['line', 'Lijn'], ['straightConnector1', 'Lijn met pijl', 'end'], ['straightConnector1', 'Lijn met dubbele pijl', 'both'],
      ['bentConnector3', 'Verbindingslijn: haaks'], ['bentConnector3', 'Verbindingslijn: haaks met pijl', 'end'], ['bentConnector3', 'Verbindingslijn: haaks met dubbele pijl', 'both'],
      ['curvedConnector3', 'Verbindingslijn: gebogen'], ['curvedConnector3', 'Verbindingslijn: gebogen met pijl', 'end'], ['curvedConnector3', 'Verbindingslijn: gebogen met dubbele pijl', 'both'],
      ['freeform', 'Vrije vorm: vorm', '*'], ['scribble', 'Vrije vorm: krabbel', '*'],
      ['lineInv', 'Lijn: omgekeerd'], ['bentConnector2', 'Verbindingslijn: één knik'], ['bentConnector4', 'Verbindingslijn: drie knikken'], ['bentConnector5', 'Verbindingslijn: vier knikken'],
      ['curvedConnector2', 'Verbindingslijn: één bocht'], ['curvedConnector4', 'Verbindingslijn: drie bochten'], ['curvedConnector5', 'Verbindingslijn: vier bochten']],
    rect: [['rect', 'Rechthoek'], ['roundRect', 'Rechthoek: afgeronde hoeken'], ['snip1Rect', 'Rechthoek: één hoek afgeknipt'], ['snip2SameRect', 'Rechthoek: bovenhoeken afgeknipt'],
      ['snip2DiagRect', 'Rechthoek: diagonale hoeken afgeknipt'], ['snipRoundRect', 'Rechthoek: bovenhoek afgeknipt en afgerond'], ['round1Rect', 'Rechthoek: één hoek afgerond'],
      ['round2SameRect', 'Rechthoek: bovenhoeken afgerond'], ['round2DiagRect', 'Rechthoek: diagonale hoeken afgerond']],
    basic: [['ellipse', 'Ovaal'], ['triangle', 'Gelijkbenige driehoek'], ['rtTriangle', 'Rechthoekige driehoek'], ['parallelogram', 'Parallellogram'], ['trapezoid', 'Trapezium'],
      ['diamond', 'Ruit'], ['pentagon', 'Regelmatige vijfhoek'], ['hexagon', 'Zeshoek'], ['heptagon', 'Zevenhoek'], ['octagon', 'Achthoek'], ['decagon', 'Tienhoek'], ['dodecagon', 'Twaalfhoek'],
      ['pie', 'Gedeeltelijke cirkel'], ['chord', 'Koorde'], ['teardrop', 'Traan'], ['frame', 'Kader'], ['halfFrame', 'Half kader'], ['corner', 'L-vorm'], ['diagStripe', 'Diagonale streep'],
      ['plus', 'Kruis'], ['plaque', 'Plaquette'], ['can', 'Cilinder'], ['cube', 'Kubus'], ['bevel', 'Schuine rand'], ['donut', 'Donut'], ['noSmoking', 'Verbodssymbool'], ['blockArc', 'Blokboog'],
      ['foldedCorner', 'Gevouwen hoek'], ['smileyFace', 'Smiley'], ['heart', 'Hart'], ['lightningBolt', 'Bliksemschicht'], ['sun', 'Zon'], ['moon', 'Maan'], ['cloud', 'Wolk'], ['arc', 'Boog'],
      ['bracketPair', 'Dubbele haak'], ['bracePair', 'Dubbele accolade'], ['leftBracket', 'Linkerhaak'], ['rightBracket', 'Rechterhaak'], ['leftBrace', 'Linkeraccolade'], ['rightBrace', 'Rechteraccolade'],
      ['nonIsoscelesTrapezoid', 'Trapezium: niet gelijkbenig'], ['pieWedge', 'Taartpunt'], ['gear6', 'Tandwiel: 6 tanden'], ['gear9', 'Tandwiel: 9 tanden'], ['funnel', 'Trechter'],
      ['cornerTabs', 'Hoektabs'], ['squareTabs', 'Vierkante tabs'], ['plaqueTabs', 'Plaquettetabs'], ['chartX', 'Grafiekteken: X'], ['chartStar', 'Grafiekteken: ster'], ['chartPlus', 'Grafiekteken: plus']],
    arrows: [['rightArrow', 'Pijl: rechts'], ['leftArrow', 'Pijl: links'], ['upArrow', 'Pijl: omhoog'], ['downArrow', 'Pijl: omlaag'], ['leftRightArrow', 'Pijl: links en rechts'],
      ['upDownArrow', 'Pijl: omhoog en omlaag'], ['quadArrow', 'Pijl: vier richtingen'], ['leftRightUpArrow', 'Pijl: links, rechts en omhoog'], ['bentArrow', 'Pijl: gebogen'], ['uturnArrow', 'Pijl: U-bocht'],
      ['leftUpArrow', 'Pijl: links en omhoog'], ['bentUpArrow', 'Pijl: gebogen omhoog'], ['curvedRightArrow', 'Pijl: gekromd naar rechts'], ['curvedLeftArrow', 'Pijl: gekromd naar links'],
      ['curvedUpArrow', 'Pijl: gekromd omhoog'], ['curvedDownArrow', 'Pijl: gekromd omlaag'], ['stripedRightArrow', 'Pijl: gestreept naar rechts'], ['notchedRightArrow', 'Pijl: gekerfd naar rechts'],
      ['homePlate', 'Pijl: vijfhoek'], ['chevron', 'Pijl: punthaak'], ['rightArrowCallout', 'Toelichting: pijl naar rechts'], ['downArrowCallout', 'Toelichting: pijl omlaag'],
      ['leftArrowCallout', 'Toelichting: pijl naar links'], ['upArrowCallout', 'Toelichting: pijl omhoog'], ['leftRightArrowCallout', 'Toelichting: pijl links en rechts'],
      ['upDownArrowCallout', 'Toelichting: pijl omhoog en omlaag'], ['quadArrowCallout', 'Toelichting: pijl vier richtingen'], ['circularArrow', 'Pijl: rond'],
      ['leftCircularArrow', 'Pijl: rond naar links'], ['leftRightCircularArrow', 'Pijl: rond in twee richtingen'], ['swooshArrow', 'Pijl: zwaai']],
    eq: [['mathPlus', 'Plusteken'], ['mathMinus', 'Minteken'], ['mathMultiply', 'Maalteken'], ['mathDivide', 'Deelteken'], ['mathEqual', 'Is gelijk aan'], ['mathNotEqual', 'Is niet gelijk aan']],
    flow: [['flowChartProcess', 'Stroomdiagram: proces'], ['flowChartAlternateProcess', 'Stroomdiagram: alternatief proces'], ['flowChartDecision', 'Stroomdiagram: beslissing'],
      ['flowChartInputOutput', 'Stroomdiagram: gegevens'], ['flowChartPredefinedProcess', 'Stroomdiagram: vooraf gedefinieerd proces'], ['flowChartInternalStorage', 'Stroomdiagram: interne opslag'],
      ['flowChartDocument', 'Stroomdiagram: document'], ['flowChartMultidocument', 'Stroomdiagram: meerdere documenten'], ['flowChartTerminator', 'Stroomdiagram: eindpunt'],
      ['flowChartPreparation', 'Stroomdiagram: voorbereiding'], ['flowChartManualInput', 'Stroomdiagram: handmatige invoer'], ['flowChartManualOperation', 'Stroomdiagram: handmatige bewerking'],
      ['flowChartConnector', 'Stroomdiagram: verbindingspunt'], ['flowChartOffpageConnector', 'Stroomdiagram: verbinding naar andere pagina'], ['flowChartPunchedCard', 'Stroomdiagram: ponskaart'],
      ['flowChartPunchedTape', 'Stroomdiagram: ponsband'], ['flowChartSummingJunction', 'Stroomdiagram: somknooppunt'], ['flowChartOr', 'Stroomdiagram: of'], ['flowChartCollate', 'Stroomdiagram: vergaren'],
      ['flowChartSort', 'Stroomdiagram: sorteren'], ['flowChartExtract', 'Stroomdiagram: uitpakken'], ['flowChartMerge', 'Stroomdiagram: samenvoegen'], ['flowChartOnlineStorage', 'Stroomdiagram: opgeslagen gegevens'],
      ['flowChartDelay', 'Stroomdiagram: vertraging'], ['flowChartMagneticTape', 'Stroomdiagram: opslag met sequentiële toegang'], ['flowChartMagneticDisk', 'Stroomdiagram: magneetschijf'],
      ['flowChartMagneticDrum', 'Stroomdiagram: opslag met directe toegang'], ['flowChartDisplay', 'Stroomdiagram: weergave'], ['flowChartOfflineStorage', 'Stroomdiagram: offline opslag']],
    stars: [['irregularSeal1', 'Explosie: 8 punten'], ['irregularSeal2', 'Explosie: 14 punten'], ['star4', 'Ster: 4 punten'], ['star5', 'Ster: 5 punten'], ['star6', 'Ster: 6 punten'],
      ['star7', 'Ster: 7 punten'], ['star8', 'Ster: 8 punten'], ['star10', 'Ster: 10 punten'], ['star12', 'Ster: 12 punten'], ['star16', 'Ster: 16 punten'], ['star24', 'Ster: 24 punten'],
      ['star32', 'Ster: 32 punten'], ['ribbon2', 'Lint: schuin omhoog'], ['ribbon', 'Lint: schuin omlaag'], ['ellipseRibbon2', 'Lint: gebogen en schuin omhoog'],
      ['ellipseRibbon', 'Lint: gebogen en schuin omlaag'], ['verticalScroll', 'Perkamentrol: verticaal'], ['horizontalScroll', 'Perkamentrol: horizontaal'], ['wave', 'Golf'], ['doubleWave', 'Dubbele golf'],
      ['leftRightRibbon', 'Lint: links en rechts']],
    callouts: [['wedgeRectCallout', 'Tekstballon: rechthoek'], ['wedgeRoundRectCallout', 'Tekstballon: rechthoek met afgeronde hoeken'], ['wedgeEllipseCallout', 'Tekstballon: ovaal'],
      ['cloudCallout', 'Gedachteballon: wolk'], ['borderCallout1', 'Toelichting: lijn'], ['borderCallout2', 'Toelichting: gebogen lijn'], ['borderCallout3', 'Toelichting: dubbel gebogen lijn'],
      ['accentCallout1', 'Toelichting: lijn met accentbalk'], ['accentCallout2', 'Toelichting: gebogen lijn met accentbalk'], ['accentCallout3', 'Toelichting: dubbel gebogen lijn met accentbalk'],
      ['callout1', 'Toelichting: lijn zonder rand'], ['callout2', 'Toelichting: gebogen lijn zonder rand'], ['callout3', 'Toelichting: dubbel gebogen lijn zonder rand'],
      ['accentBorderCallout1', 'Toelichting: lijn met rand en accentbalk'], ['accentBorderCallout2', 'Toelichting: gebogen lijn met rand en accentbalk'],
      ['accentBorderCallout3', 'Toelichting: dubbel gebogen lijn met rand en accentbalk']],
    action: [['actionButtonBackPrevious', 'Actieknop: vorige'], ['actionButtonForwardNext', 'Actieknop: volgende'], ['actionButtonBeginning', 'Actieknop: naar begin'],
      ['actionButtonEnd', 'Actieknop: naar einde'], ['actionButtonHome', 'Actieknop: naar start'], ['actionButtonInformation', 'Actieknop: informatie'], ['actionButtonReturn', 'Actieknop: terug'],
      ['actionButtonMovie', 'Actieknop: video'], ['actionButtonDocument', 'Actieknop: document'], ['actionButtonSound', 'Actieknop: geluid'], ['actionButtonHelp', 'Actieknop: help'],
      ['actionButtonBlank', 'Actieknop: leeg']],
  };
  const LIST = [];
  CATS.forEach((c) => G[c.id].forEach(([id, name, x]) => LIST.push(x === '*' ? { id, name, cat: c.id, special: true } : x ? { id, name, cat: c.id, arrows: x } : { id, name, cat: c.id })));
  const NAMES = {};
  LIST.forEach((e) => { if (!e.special && !e.arrows && !NAMES[e.id]) NAMES[e.id] = e.name; });

  /* ---------- API ---------- */
  const has = (id) => !!DEF[id];
  const shapeOf = (id) => get(DEF[id] ? id : 'rect');
  const defaults = (id) => Object.assign({}, DEF[id] ? get(id).av : {});
  const cache = new Map();
  const fin2 = (x) => (Number.isFinite(x) ? x : 0);
  const geometry = (id, w, h, adj) => {
    w = Math.abs(+w) || 0; h = Math.abs(+h) || 0;
    const key = id + '|' + w + '|' + h + '|' + (adj ? JSON.stringify(adj) : '');
    let g = cache.get(key);
    if (g) return g;
    const s = shapeOf(id), v = evalS(s, w, h, adj);
    let l = num(v, s.rect[0]), t = num(v, s.rect[1]), r = num(v, s.rect[2]), b = num(v, s.rect[3]);
    if (l > r) { const q = l; l = r; r = q; }
    if (t > b) { const q = t; t = b; b = q; }
    g = {
      paths: buildPaths(s, v, w, h),
      text: { l: fin2(l), t: fin2(t), r: fin2(r), b: fin2(b) },
      handles: s.ah.map((a) => ({ x: fin2(num(v, a.px)), y: fin2(num(v, a.py)) })),
      sites: s.cxn.map((c) => ({ x: fin2(num(v, c[1])), y: fin2(num(v, c[2])), ang: ((Math.round(num(v, c[0]) / 60000 * 100) / 100) % 360 + 360) % 360 })),
    };
    if (cache.size > 600) cache.clear();
    cache.set(key, g);
    return g;
  };

  // greep slepen: zoek per aanpassingswaarde de waarde waarbij de greep het dichtst bij (px, py) komt
  const solve = (lo, hi, v0, f) => {
    if (lo > hi) { const q = lo; lo = hi; hi = q; }
    const pin = (x) => (x < lo ? lo : x > hi ? hi : x);
    let a = pin(v0), fa = f(a), best = a, bf = Math.abs(fa);
    if (bf > 1e-3 && hi > lo) {
      const d0 = Math.max(1, Math.min(1000, (hi - lo) / 100));
      let b = pin(a + d0 <= hi ? a + d0 : a - d0), fb = f(b);
      for (let i = 0; i < 14; i++) {
        if (Math.abs(fb) < bf) { bf = Math.abs(fb); best = b; }
        if (bf < 1e-3 || fb === fa) break;
        const c = pin(b - fb * (b - a) / (fb - fa));
        if (Math.abs(c - b) < 1e-6) break;
        a = b; fa = fb; b = c; fb = f(b);
      }
      if (Math.abs(fb) < bf) { bf = Math.abs(fb); best = b; }
      if (bf > 0.05) {   // terugval: bemonsteren en verfijnen (werkt ook bij knikken en sprongen)
        const L = Math.max(lo, -1000000), H = Math.min(hi, 1000000), N = 48, st = (H - L) / N;
        let bi = best, be = bf;
        for (let i = 0; i <= N; i++) { const x = L + st * i, e = Math.abs(f(x)); if (e < be - 1e-9) { be = e; bi = x; } }
        let p = Math.max(L, bi - st), q = Math.min(H, bi + st);
        for (let i = 0; i < 40 && q - p > 0.25; i++) {
          const m1 = p + (q - p) / 3, m2 = q - (q - p) / 3;
          if (Math.abs(f(m1)) <= Math.abs(f(m2))) q = m2; else p = m1;
        }
        const m = (p + q) / 2, em = Math.abs(f(m));
        if (em < be) { be = em; bi = m; }
        if (be < bf) { bf = be; best = bi; }
      }
    }
    return Math.round(best);
  };
  const adjust = (id, w, h, adj, i, px, py) => {
    const s = shapeOf(id), cur = {};
    for (const k in s.av) cur[k] = adj ? adjVal(adj[k], s.av[k]) : s.av[k];
    const hd = s.ah[i];
    if (!hd) return cur;
    w = Math.abs(+w) || 0; h = Math.abs(+h) || 0; px = +px || 0; py = +py || 0;
    const sc = () => evalS(s, w, h, cur);
    const pos = (v) => [num(v, hd.px), num(v, hd.py)];
    const lim = (a, dflt) => (a === null || a === undefined ? dflt : num(sc(), a));
    const run = (key, a0, a1, err) => {
      if (!key || !(key in cur)) return;
      cur[key] = solve(lim(a0, -2147483647), lim(a1, 2147483647), cur[key], (x) => { cur[key] = x; return err(sc()); });
    };
    if (hd.k === 'xy') {
      const fx = () => run(hd.rx, hd.x0, hd.x1, (v) => pos(v)[0] - px);
      const fy = () => run(hd.ry, hd.y0, hd.y1, (v) => pos(v)[1] - py);
      fx(); fy(); if (hd.rx && hd.ry) fx();
    } else {
      const v0 = sc(), ta = Math.atan2(py - v0.vc, px - v0.hc), tr = Math.hypot(px - v0.hc, py - v0.vc);
      const fa = () => run(hd.ra, hd.a0, hd.a1, (v) => { const p = pos(v); let d = Math.atan2(p[1] - v.vc, p[0] - v.hc) - ta; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d * 180 / Math.PI; });
      const fr = () => run(hd.rr, hd.r0, hd.r1, (v) => { const p = pos(v); return Math.hypot(p[0] - v.hc, p[1] - v.vc) - tr; });
      fa(); fr(); if (hd.ra && hd.rr) fa();
    }
    return cur;
  };

  /* ---------- Pictogram voor de galerij ---------- */
  const WIDE = /Arrow$|^(homePlate|chevron|swooshArrow)$|Callout|^flowChart(?!Connector|OffpageConnector|Or|SummingJunction|Collate|Sort|Extract|Merge|OfflineStorage)|Rect$|^rect$|ibbon|Scroll|ave$|^(ellipse|parallelogram|trapezoid|nonIsoscelesTrapezoid|can|plaque|bracketPair|bracePair|frame|funnel)$/;
  const TALL = /^(up|down|upDown)(Arrow|ArrowCallout)$|^(leftBracket|rightBracket|leftBrace|rightBrace|verticalScroll|curvedLeftArrow|curvedRightArrow)$/;
  const FILLOK = /^(accentC|c)allout\d$/;
  const icon = (id, size = 26, arrows) => {
    if (id && typeof id === 'object') { arrows = id.arrows; id = id.id; }
    const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
    if (id === 'freeform') return svg('0 0 20 20', '<path vector-effect="non-scaling-stroke" d="M3 16 L5 6 L10 9 L15 3 L17 13 L9 17 Z"/>');
    if (id === 'scribble') return svg('0 0 20 20', '<path vector-effect="non-scaling-stroke" d="M2 14 C4 4 7 4 8 10 C9 16 12 16 13 9 C14 3 17 4 18 8"/>');
    const isLine = /^(line|lineInv|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(id);
    const W = isLine ? 18 : WIDE.test(id) && !TALL.test(id) ? 22 : TALL.test(id) ? 12 : 18, H = isLine ? 18 : TALL.test(id) ? 20 : WIDE.test(id) ? 15 : 18;
    const g = geometry(DEF[id] ? id : 'rect', W, H);
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    const strokeAny = g.paths.some((p) => p.stroke);
    let body = '';
    g.paths.forEach((p) => {
      const nums = p.d.match(/-?[\d.]+(e-?\d+)?/g) || [];
      for (let k = 0; k + 1 < nums.length; k += 2) { const x = +nums[k], y = +nums[k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      let f = 'none', op = '';
      if (p.fill === 'darken') { f = 'currentColor'; op = ' fill-opacity=".38"'; } else if (p.fill === 'darkenLess') { f = 'currentColor'; op = ' fill-opacity=".22"'; }
      if (!p.stroke) {
        if (p.fill === 'norm' && (FILLOK.test(id) || !strokeAny)) body += `<path d="${p.d}" fill="currentColor" fill-opacity=".14" stroke="none"/>`;
        else if (f !== 'none') body += `<path d="${p.d}" fill="${f}"${op} stroke="none"/>`;
        return;
      }
      body += `<path vector-effect="non-scaling-stroke" d="${p.d}" fill="${f}"${op}/>`;
    });
    if (isLine && arrows) {
      const end = id === 'straightConnector1' ? [W, H, Math.atan2(H, W)] : [W, H, 0];
      const head = (x, y, a) => { const L = 4.2, s = 0.45; return `<path d="M${f2(x)} ${f2(y)} L${f2(x - L * Math.cos(a - s))} ${f2(y - L * Math.sin(a - s))} L${f2(x - L * Math.cos(a + s))} ${f2(y - L * Math.sin(a + s))} Z" fill="currentColor" stroke="none"/>`; };
      body += head(end[0], end[1], end[2]);
      if (arrows === 'both') body += head(0, 0, end[2] + Math.PI);
    }
    const pad = 1.5;
    return svg(`${f2(x0 - pad)} ${f2(y0 - pad)} ${f2(x1 - x0 + 2 * pad)} ${f2(y1 - y0 + 2 * pad)}`, body);
  };

  App.Shapes = { CATS, LIST, has, defaults, geometry, adjust, icon, name: (id) => NAMES[id] || id, ids: () => Object.keys(DEF), _bad: BAD, _compileAll: () => { Object.keys(DEF).forEach(get); return BAD; } };
})();
