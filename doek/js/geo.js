/* =========================================================
   Doek (gemaakt door JJ van Schelven) — geometrie: paden lezen en schrijven,
   afvlakken, begrenzing en booleaanse bewerkingen (vormen samenvoegen,
   combineren, snijden, aftrekken en fragmenteren) voor punten bewerken
   ========================================================= */
'use strict';

(() => {
  /* Padmodel (absolute px): subs = [{ closed, pts: [{ x, y, c1?: [x, y], c2?: [x, y] }] }]
     Een punt met c1/c2 = kubische Bézier vanaf het vorige punt naar dit punt, anders een rechte lijn.
     Heeft het eerste punt van een gesloten subpad c1/c2, dan is het sluitstuk een curve.
     Veelhoek = [[x, y], …] zonder herhaald eindpunt; veelhoekset = lijst ringen.
     Uitkomsten van booleaanse bewerkingen: buitenranden hebben een positieve oppervlakte volgens
     area() (tegen de klok in met de y-as omhoog, dus met de klok mee op het scherm), gaten een negatieve. */
  const G = {};

  /* ---------- Kleine hulpjes ---------- */
  const ctl = (p) => (p.c1 || p.c2 ? [p.c1 || p.c2, p.c2 || p.c1] : null);
  // Alle stukken van een subpad: fn(x0, y0, c, x, y) met c = [c1, c2] of null (rechte lijn)
  const eachSeg = (s, fn) => {
    const pts = s.pts || [], n = pts.length;
    for (let i = 1; i < n; i++) fn(pts[i - 1].x, pts[i - 1].y, ctl(pts[i]), pts[i].x, pts[i].y);
    if (s.closed && n > 1) {
      const a = pts[n - 1], b = pts[0], c = ctl(b);
      if (c || a.x !== b.x || a.y !== b.y) fn(a.x, a.y, c, b.x, b.y);
    }
  };
  const bez = (a, b, c, d, t) => { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d; };
  // Kwadraat van de afstand van punt p tot lijnstuk ab
  const segD2 = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - px, ey = ay + t * dy - py;
    return ex * ex + ey * ey;
  };

  /* ---------- SVG-pad lezen ---------- */
  const NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  const NPAR = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

  // Boog in eindpuntnotatie → kubische stukken van hoogstens 90° (SVG-specificatie, bijlage F.6)
  const arcToCubic = (x1, y1, rx, ry, deg, large, sweep, x2, y2) => {
    const phi = deg * Math.PI / 180, co = Math.cos(phi), si = Math.sin(phi);
    const hx = (x1 - x2) / 2, hy = (y1 - y2) / 2, xp = co * hx + si * hy, yp = -si * hx + co * hy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }   // straal te klein: opschalen
    const rx2 = rx * rx, ry2 = ry * ry, den = rx2 * yp * yp + ry2 * xp * xp;
    let f = den ? Math.sqrt(Math.max(0, (rx2 * ry2 - den) / den)) : 0;
    if (large === sweep) f = -f;
    const cxp = f * rx * yp / ry, cyp = -f * ry * xp / rx;
    const cx = co * cxp - si * cyp + (x1 + x2) / 2, cy = si * cxp + co * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const ux = (xp - cxp) / rx, uy = (yp - cyp) / ry;
    const t1 = ang(1, 0, ux, uy);
    let dt = ang(ux, uy, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-7)), da = dt / n, k = 4 / 3 * Math.tan(da / 4);
    const map = (u, v) => [cx + co * rx * u - si * ry * v, cy + si * rx * u + co * ry * v];
    const out = [];
    for (let i = 0; i < n; i++) {
      const a1 = t1 + i * da, a2 = a1 + da, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
      const p1 = map(c1 - k * s1, s1 + k * c1), p2 = map(c2 + k * s2, s2 - k * c2), e = i === n - 1 ? [x2, y2] : map(c2, s2);
      out.push([p1[0], p1[1], p2[0], p2[1], e[0], e[1]]);
    }
    return out;
  };

  // Volledige SVG-padsyntaxis → subs (Q/T/A worden kubisch). Bij een fout: alles tot daar.
  G.parse = (d) => {
    const subs = [];
    if (typeof d !== 'string') return subs;
    const n = d.length;
    let i = 0, cmd = '', sub = null, cx = 0, cy = 0, sx = 0, sy = 0, pc = null, pq = null, first = true;
    const skip = () => { while (i < n) { const c = d.charCodeAt(i); if (c === 32 || c === 44 || (c >= 9 && c <= 13)) i++; else break; } };
    const num = () => { skip(); NUM.lastIndex = i; const m = NUM.exec(d); if (!m) return NaN; i = NUM.lastIndex; return +m[0]; };
    const flag = () => { skip(); const c = d[i]; if (c !== '0' && c !== '1') return NaN; i++; return c === '1' ? 1 : 0; };
    const done = () => { if (sub && sub.pts.length > 1) subs.push(sub); sub = null; };
    const open = () => { if (!sub) sub = { closed: false, pts: [{ x: cx, y: cy }] }; };
    const line = (x, y) => { open(); sub.pts.push({ x, y }); cx = x; cy = y; };
    const curve = (x1, y1, x2, y2, x, y) => { open(); sub.pts.push({ x, y, c1: [x1, y1], c2: [x2, y2] }); cx = x; cy = y; };
    for (;;) {
      skip();
      if (i >= n) break;
      const ch = d[i];
      if ('MmLlHhVvCcSsQqTtAaZz'.indexOf(ch) >= 0) { cmd = ch; i++; }
      else if (!cmd || cmd === 'Z' || cmd === 'z') break;           // getal zonder opdracht: fout
      const C = cmd.toUpperCase(), rel = cmd !== C;
      if (first && C !== 'M') break;                                 // een pad begint altijd met M
      first = false;
      if (C === 'Z') {
        if (sub) {
          const pts = sub.pts, a = pts[0], b = pts[pts.length - 1];
          // expliciete lijn terug naar het begin is overbodig: Z sluit al
          if (pts.length > 1 && !b.c1 && !b.c2 && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
          sub.closed = true;
          done();
        }
        cx = sx; cy = sy; pc = pq = null;
        continue;
      }
      const p = [];
      for (let k = 0; k < NPAR[C]; k++) p.push(C === 'A' && (k === 3 || k === 4) ? flag() : num());
      if (p.some(Number.isNaN)) break;
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      if (C === 'M') {
        done();
        cx = sx = p[0] + ox; cy = sy = p[1] + oy;
        sub = { closed: false, pts: [{ x: cx, y: cy }] };
        cmd = rel ? 'l' : 'L'; pc = pq = null;
      } else if (C === 'L') { line(p[0] + ox, p[1] + oy); pc = pq = null; }
      else if (C === 'H') { line(p[0] + ox, cy); pc = pq = null; }
      else if (C === 'V') { line(cx, p[0] + oy); pc = pq = null; }
      else if (C === 'C') {
        curve(p[0] + ox, p[1] + oy, p[2] + ox, p[3] + oy, p[4] + ox, p[5] + oy);
        pc = [p[2] + ox, p[3] + oy]; pq = null;
      } else if (C === 'S') {
        const x1 = pc ? 2 * cx - pc[0] : cx, y1 = pc ? 2 * cy - pc[1] : cy;
        curve(x1, y1, p[0] + ox, p[1] + oy, p[2] + ox, p[3] + oy);
        pc = [p[0] + ox, p[1] + oy]; pq = null;
      } else if (C === 'Q' || C === 'T') {
        let qx, qy, x, y;
        if (C === 'Q') { qx = p[0] + ox; qy = p[1] + oy; x = p[2] + ox; y = p[3] + oy; }
        else { qx = pq ? 2 * cx - pq[0] : cx; qy = pq ? 2 * cy - pq[1] : cy; x = p[0] + ox; y = p[1] + oy; }
        curve(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y);
        pq = [qx, qy]; pc = null;
      } else if (C === 'A') {
        const x = p[5] + ox, y = p[6] + oy;
        if (x !== cx || y !== cy) {
          if (!p[0] || !p[1]) line(x, y);
          else for (const c of arcToCubic(cx, cy, p[0], p[1], p[2], p[3], p[4], x, y)) curve(c[0], c[1], c[2], c[3], c[4], c[5]);
        }
        pc = pq = null;
      }
    }
    done();
    return subs;
  };

  /* ---------- SVG-pad schrijven (alleen absolute M, L, C, Z) ---------- */
  const fmt = (v, k) => {
    if (!Number.isFinite(v)) return '0';
    let s = v.toFixed(k);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  };
  G.toD = (subs, digits = 2) => {
    const pt = (x, y) => fmt(x, digits) + ' ' + fmt(y, digits), parts = [];
    const seg = (c, x, y) => (c ? ' C' + pt(c[0][0], c[0][1]) + ' ' + pt(c[1][0], c[1][1]) + ' ' : ' L') + pt(x, y);
    for (const s of subs || []) {
      const pts = s.pts || [];
      if (!pts.length) continue;
      let d = 'M' + pt(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) d += seg(ctl(pts[i]), pts[i].x, pts[i].y);
      if (s.closed && pts.length > 1 && ctl(pts[0])) d += seg(ctl(pts[0]), pts[0].x, pts[0].y);
      if (s.closed) d += ' Z';
      parts.push(d);
    }
    return parts.join(' ');
  };

  /* ---------- Matrices [a, b, c, d, e, f] zoals in SVG ---------- */
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  G.apply = (m, x, y) => ap(m, x, y);
  G.multiply = (m, n) => [               // eerst n, dan m
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  G.transform = (subs, m) => (subs || []).map((s) => ({ ...s, closed: !!s.closed, pts: (s.pts || []).map((p) => {
    const q = { ...p }, xy = ap(m, p.x, p.y);
    q.x = xy[0]; q.y = xy[1];
    if (p.c1) q.c1 = ap(m, p.c1[0], p.c1[1]);
    if (p.c2) q.c2 = ap(m, p.c2[0], p.c2[1]);
    return q;
  }) }));
  // Vormcoördinaten (0..w, 0..h) → dia: spiegelen om het midden, dan rot graden rechtsom om het midden, dan verschuiven
  G.objMatrix = (x, y, w, h, rot = 0, flipH = false, flipV = false) => {
    const r = (rot || 0) * Math.PI / 180, fx = flipH ? -1 : 1, fy = flipV ? -1 : 1;
    const clean = (v) => (Math.abs(v) < 1e-15 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-15 ? Math.sign(v) : v);
    const co = clean(Math.cos(r)), si = clean(Math.sin(r));
    const a = co * fx, b = si * fx, c = -si * fy, d = co * fy, hw = w / 2, hh = h / 2;
    return [a, b, c, d, x + hw - a * hw - c * hh, y + hh - b * hw - d * hh];
  };
  G.invert = (m) => {
    const [a, b, c, d, e, f] = m, det = a * d - b * c;
    if (!det || !Number.isFinite(det)) return [1, 0, 0, 1, 0, 0];   // niet omkeerbaar
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  };

  /* ---------- Begrenzing (exact voor curven: met de uitersten van de Bézier) ---------- */
  // Waarden van t in (0, 1) waar de afgeleide van één coördinaat van een kubische Bézier nul is
  const extremaT = (p0, p1, p2, p3) => {
    const a = p3 - 3 * p2 + 3 * p1 - p0, b = 2 * (p2 - 2 * p1 + p0), c = p1 - p0, out = [];
    const sc = Math.abs(a) + Math.abs(b) + Math.abs(c);
    if (!sc) return out;
    if (Math.abs(a) <= 1e-12 * sc) { if (b) out.push(-c / b); }
    else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) { const q = Math.sqrt(disc); out.push((-b + q) / (2 * a), (-b - q) / (2 * a)); }
    }
    return out.filter((t) => t > 0 && t < 1);
  };
  G.bbox = (subs) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const s of subs || []) {
      const pts = s.pts || [];
      if (pts.length) add(pts[0].x, pts[0].y);
      eachSeg(s, (ax, ay, c, bx, by) => {
        add(bx, by);
        if (!c) return;
        const ts = extremaT(ax, c[0][0], c[1][0], bx).concat(extremaT(ay, c[0][1], c[1][1], by));
        for (const t of ts) add(bez(ax, c[0][0], c[1][0], bx, t), bez(ay, c[0][1], c[1][1], by, t));
      });
    }
    return x1 >= x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
  };

  /* ---------- Afvlakken (adaptief opdelen tot de curve binnen tol px van de koorde blijft) ---------- */
  const flatCubic = (out, x0, y0, x1, y1, x2, y2, x3, y3, t2, depth) => {
    // controlepunten dicht bij de koorde → de hele curve ook (ligt binnen het convexe omhulsel)
    if (depth >= 14 || (segD2(x1, y1, x0, y0, x3, y3) <= t2 && segD2(x2, y2, x0, y0, x3, y3) <= t2)) { out.push([x3, y3]); return; }
    const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2, bx = (x1 + x2) / 2, by = (y1 + y2) / 2, cx = (x2 + x3) / 2, cy = (y2 + y3) / 2;
    const dx = (ax + bx) / 2, dy = (ay + by) / 2, ex = (bx + cx) / 2, ey = (by + cy) / 2, mx = (dx + ex) / 2, my = (dy + ey) / 2;
    flatCubic(out, x0, y0, ax, ay, dx, dy, mx, my, t2, depth + 1);
    flatCubic(out, mx, my, ex, ey, cx, cy, x3, y3, t2, depth + 1);
  };
  // Dubbele opeenvolgende punten en het herhaalde eindpunt weghalen
  const dedupe = (r) => {
    const out = [];
    for (const p of r) {
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      const q = out[out.length - 1];
      if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
    }
    while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
    return out;
  };
  G.flatten = (subs, tol = 0.25) => {
    const out = [], t2 = Math.max(+tol || 0.25, 1e-6) ** 2;
    for (const s of subs || []) {
      if (!s.closed || !s.pts || s.pts.length < 2) continue;      // open subpaden tellen niet mee
      const ring = [[s.pts[0].x, s.pts[0].y]];
      eachSeg(s, (ax, ay, c, bx, by) => {
        if (c) flatCubic(ring, ax, ay, c[0][0], c[0][1], c[1][0], c[1][1], bx, by, t2, 0);
        else ring.push([bx, by]);
      });
      const r = dedupe(ring);
      if (r.length >= 3) out.push(r);
    }
    return out;
  };

  /* ---------- Oppervlakte, punt-in-veelhoek, vereenvoudigen ---------- */
  G.area = (poly) => {
    let a = 0;
    for (let i = 0, n = poly.length, j = n - 1; i < n; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    return a / 2;
  };
  G.contains = (polys, x, y, rule = 'nonzero') => {
    let w = 0;
    for (const r of polys || []) {
      for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) {
        const ax = r[j][0], ay = r[j][1], bx = r[i][0], by = r[i][1];
        if (ay <= y) { if (by > y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) > 0) w++; }
        else if (by <= y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) < 0) w--;
      }
    }
    return rule === 'evenodd' ? (w & 1) === 1 : w !== 0;
  };
  // Punten van een ring weghalen zolang drop(a, b, c) waar is voor punt b met zijn huidige buren a en c.
  // Gekoppelde lijst: na elke verwijdering worden de buren opnieuw bekeken. Geeft de indexen die blijven.
  const prune = (n, drop) => {
    const prv = new Int32Array(n), nxt = new Int32Array(n), dead = new Uint8Array(n), st = [];
    for (let i = 0; i < n; i++) { prv[i] = (i + n - 1) % n; nxt[i] = (i + 1) % n; st.push(n - 1 - i); }
    let alive = n;
    while (st.length && alive > 2) {
      const i = st.pop();
      if (dead[i]) continue;
      const a = prv[i], c = nxt[i];
      if (!drop(a, i, c)) continue;
      dead[i] = 1; alive--; nxt[a] = c; prv[c] = a; st.push(c, a);
    }
    if (alive <= 2) return [];
    const keep = [];
    let s = 0;
    while (dead[s]) s++;
    for (let i = s; ; ) { keep.push(i); i = nxt[i]; if (i === s) break; }
    return keep;
  };
  // Dubbele punten en punten (bijna) op de lijn tussen hun buren weghalen; [] als er niets overblijft
  G.simplify = (poly, eps = 0.05) => {
    const p = dedupe(poly || []), e2 = eps * eps;
    const keep = prune(p.length, (a, b, c) => {
      const A = p[a], B = p[b], C = p[c], dx = C[0] - A[0], dy = C[1] - A[1], l2 = dx * dx + dy * dy;
      const bx = B[0] - A[0], by = B[1] - A[1], cr = dx * by - dy * bx;
      return bx * bx + by * by <= e2 || (l2 ? cr * cr / l2 : bx * bx + by * by) <= e2;
    });
    return keep.length >= 3 ? keep.map((i) => p[i]) : [];
  };
  G.toSubs = (polys) => (polys || []).filter((r) => r.length >= 2).map((r) => ({ closed: true, pts: r.map((p) => ({ x: p[0], y: p[1] })) }));
  // Naar eigen coördinaten van de vorm: begrenzing begint op 0,0; de nieuwe x/y/w/h van de vorm = box
  G.toLocal = (subs, box) => {
    const b = box || G.bbox(subs), r = (v) => Math.round(v * 1e4) / 1e4;
    const s = G.transform(subs, [1, 0, 0, 1, -b.x, -b.y]);
    for (const sub of s) for (const p of sub.pts) {
      p.x = r(p.x); p.y = r(p.y);
      if (p.c1) p.c1 = [r(p.c1[0]), r(p.c1[1])];
      if (p.c2) p.c2 = [r(p.c2[0]), r(p.c2[1])];
    }
    return { w: r(b.w), h: r(b.h), subs: s };
  };

  /* ---------- Booleaanse bewerkingen ----------
     Werkwijze: alle punten op een geheel raster (ongeveer 1e-7 van de grootte, zodat oriëntatietests
     exact zijn), punten die (bijna) samenvallen samennemen, alle snijpunten zoeken en de randen daar
     splitsen (herhalen tot er nergens meer een kruising of T-aansluiting is), gelijke randen samenvoegen
     met per vorm een richtingstelling, met een veegbeweging van links naar rechts het windingsgetal per
     vorm rechts van elke rand bepalen, en de randen houden waar binnen en buiten verschillen. Die worden
     tot ringen gekoppeld (steeds de scherpste bocht naar links), zodat raakpunten losse ringen geven. */
  const K = 16777216;                                   // 2^24: sleutel voor een rasterpunt = X * K + Y
  const orient = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const area2 = (f) => {                                // twee keer de oppervlakte van een platte ring [x, y, x, y, …]
    let a = 0;
    for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) a += f[j] * f[i + 1] - f[i] * f[j + 1];
    return a;
  };
  const ringBox = (f) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < f.length; i += 2) {
      if (f[i] < x0) x0 = f[i];
      if (f[i] > x1) x1 = f[i];
      if (f[i + 1] < y0) y0 = f[i + 1];
      if (f[i + 1] > y1) y1 = f[i + 1];
    }
    return [x0, y0, x1, y1];
  };
  const reverse = (f) => { const r = []; for (let i = f.length - 2; i >= 0; i -= 2) r.push(f[i], f[i + 1]); return r; };
  // Windingsgetal van (x, y) ten opzichte van ring f; NaN als het punt op de rand ligt
  const windAt = (f, x, y) => {
    let w = 0;
    for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) {
      const ax = f[j], ay = f[j + 1], bx = f[i], by = f[i + 1], o = orient(ax, ay, bx, by, x, y);
      if (o === 0 && (ax < bx ? ax <= x && x <= bx : bx <= x && x <= ax) && (ay < by ? ay <= y && y <= by : by <= y && y <= ay)) return NaN;
      if (ay <= y) { if (by > y && o > 0) w++; } else if (by <= y && o < 0) w--;
    }
    return w;
  };
  // Ligt ring f helemaal binnen ring g (punten op de rand tellen mee, minstens één echt erbinnen)?
  const ringInside = (f, g) => {
    let strict = false;
    for (let i = 0; i < f.length; i += 2) {
      const w = windAt(g, f[i], f[i + 1]);
      if (w === 0) return false;
      if (w === w) strict = true;
    }
    return strict;
  };
  // Richting gelijktrekken: ring binnen een oneven aantal andere ringen = gat (negatief), anders buitenrand (positief)
  const normalize = (rings) => {
    const boxes = rings.map(ringBox);
    return rings.map((f, i) => {
      const b = boxes[i];
      let depth = 0;
      for (let j = 0; j < rings.length; j++) {
        const c = boxes[j];
        if (j === i || b[0] < c[0] || b[1] < c[1] || b[2] > c[2] || b[3] > c[3]) continue;
        if (ringInside(f, rings[j])) depth++;
      }
      const a = area2(f);
      return (depth % 2 ? a > 0 : a < 0) ? reverse(f) : f;
    });
  };

  // Veelhoeksets → gehele ringen per vorm, met het raster om terug te rekenen
  const prep = (sets) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const set of sets) for (const r of set) for (const p of r) {
      const x = p[0], y = p[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const S = Math.max(x1 - x0, y1 - y0);
    if (!(S > 0) || !Number.isFinite(S)) return null;
    const g = Math.pow(2, Math.ceil(Math.log2(S)) - 23), ox = Math.floor(x0 / g) * g, oy = Math.floor(y0 / g) * g;
    const own = new Map(), seen = new Map();
    // punten binnen 1 rastereenheid van een eerder punt worden dat punt
    const snap = (x, y) => {
      const X = Math.round((x - ox) / g), Y = Math.round((y - oy) / g), k = X * K + Y;
      let r = seen.get(k);
      if (r) return r;
      for (let dx = -1; dx <= 1 && !r; dx++) for (let dy = -1; dy <= 1 && !r; dy++) r = own.get(k + dx * K + dy);
      if (!r) { r = [X, Y]; own.set(k, r); }
      seen.set(k, r);
      return r;
    };
    const shapes = sets.map((set) => {
      const rings = [];
      for (const r of set) {
        const f = [];
        for (const p of r) {
          if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
          const q = snap(p[0], p[1]), n = f.length;
          if (!n || f[n - 2] !== q[0] || f[n - 1] !== q[1]) f.push(q[0], q[1]);
        }
        while (f.length >= 4 && f[0] === f[f.length - 2] && f[1] === f[f.length - 1]) f.length -= 2;
        if (f.length >= 6) rings.push(f);
      }
      return normalize(rings);
    });
    return { shapes, g, ox, oy };
  };

  // Randen met het kleinste eindpunt (x, dan y) als a; w = +1 als de ring van a naar b loopt
  const buildSegs = (shapes) => {
    const segs = [];
    shapes.forEach((rings, sh) => {
      for (const f of rings) for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) {
        const ax = f[j], ay = f[j + 1], bx = f[i], by = f[i + 1];
        if (ax === bx && ay === by) continue;
        segs.push(ax < bx || (ax === bx && ay < by) ? { ax, ay, bx, by, sh, w: 1, nw: true } : { ax: bx, ay: by, bx: ax, by: ay, sh, w: -1, nw: true });
      }
    });
    return segs;
  };
  // Eén paar randen testen: echte kruising (afgerond snijpunt) of een eindpunt op/vlak bij de andere rand
  const touch = (s, x, y, o, cut) => {                  // punt hoogstens 1 rastereenheid van het binnenste van s
    const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy, p = (x - s.ax) * dx + (y - s.ay) * dy;
    if (p > 0 && p < l2 && o * o <= l2) cut(s, x, y);
  };
  const pairCuts = (s, t, cut) => {
    const d1 = orient(s.ax, s.ay, s.bx, s.by, t.ax, t.ay), d2 = orient(s.ax, s.ay, s.bx, s.by, t.bx, t.by);
    const d3 = orient(t.ax, t.ay, t.bx, t.by, s.ax, s.ay), d4 = orient(t.ax, t.ay, t.bx, t.by, s.bx, s.by);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      const k = d3 / (d3 - d4), x = Math.round(s.ax + k * (s.bx - s.ax)), y = Math.round(s.ay + k * (s.by - s.ay));
      cut(s, x, y); cut(t, x, y);
      return;
    }
    touch(s, t.ax, t.ay, d1, cut); touch(s, t.bx, t.by, d2, cut); touch(t, s.ax, s.ay, d3, cut); touch(t, s.bx, s.by, d4, cut);
  };
  const applyCuts = (segs, cuts) => {
    const out = [];
    for (const s of segs) {
      const l = cuts.get(s);
      if (!l) { out.push(s); continue; }
      const dx = s.bx - s.ax, dy = s.by - s.ay, pts = [];
      for (let i = 0; i < l.length; i += 2) pts.push([l[i], l[i + 1], (l[i] - s.ax) * dx + (l[i + 1] - s.ay) * dy]);
      pts.sort((p, q) => p[2] - q[2]);
      let px = s.ax, py = s.ay;
      const piece = (x, y) => {
        if (x === px && y === py) return;
        out.push(x > px || (x === px && y > py) ? { ax: px, ay: py, bx: x, by: y, sh: s.sh, w: s.w, nw: true }
          : { ax: x, ay: y, bx: px, by: py, sh: s.sh, w: -s.w, nw: true });
        px = x; py = y;
      };
      for (const p of pts) piece(p[0], p[1]);
      piece(s.bx, s.by);
    }
    return out;
  };
  // Splitsen tot er geen kruisingen meer zijn; na de eerste ronde alleen paren met een nieuw stuk testen
  const splitSegs = (segs) => {
    for (let it = 0; it < 64; it++) {
      const n = segs.length, order = segs.slice().sort((p, q) => p.ax - q.ax);
      let cuts = null;
      const cut = (s, x, y) => {
        if ((x === s.ax && y === s.ay) || (x === s.bx && y === s.by)) return;
        if (!cuts) cuts = new Map();
        const l = cuts.get(s);
        if (l) l.push(x, y); else cuts.set(s, [x, y]);
      };
      for (let i = 0; i < n; i++) {
        const s = order[i], xe = s.bx + 1, y0 = Math.min(s.ay, s.by) - 1, y1 = Math.max(s.ay, s.by) + 1;
        for (let j = i + 1; j < n; j++) {
          const t = order[j];
          if (t.ax > xe) break;
          if ((!s.nw && !t.nw) || (t.ay < y0 && t.by < y0) || (t.ay > y1 && t.by > y1)) continue;
          pairCuts(s, t, cut);
        }
      }
      for (const s of segs) s.nw = false;
      if (!cuts) break;
      segs = applyCuts(segs, cuts);
    }
    return segs;
  };
  // Gelijke randen samenvoegen; d[vorm] = netto aantal keer van a naar b doorlopen
  const mergeSegs = (segs, N) => {
    segs.sort((p, q) => p.ax - q.ax || p.ay - q.ay || p.bx - q.bx || p.by - q.by);
    const edges = [];
    let e = null;
    for (const s of segs) {
      if (!e || e.ax !== s.ax || e.ay !== s.ay || e.bx !== s.bx || e.by !== s.by) {
        e = { ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, d: new Array(N).fill(0), wr: null };
        edges.push(e);
      }
      e.d[s.sh] += s.w;
    }
    return edges.filter((x) => x.d.some((v) => v !== 0));
  };
  // Veegbeweging: windingsgetallen rechts van elke rand (rechts van a→b; dat is onder, of rechts bij een
  // verticale rand) volgen uit de rand er direct onder
  const sweep = (edges, N) => {
    const E = edges.length, ev = new Array(2 * E);
    for (let i = 0; i < E; i++) { ev[2 * i] = i; ev[2 * i + 1] = ~i; }
    const ex = (v) => (v >= 0 ? edges[v].ax : edges[~v].bx), ey = (v) => (v >= 0 ? edges[v].ay : edges[~v].by);
    ev.sort((u, v) => ex(u) - ex(v) || ey(u) - ey(v) || (u >= 0) - (v >= 0));   // einde vóór begin
    const st = [], zero = new Array(N).fill(0), starts = [];
    for (let i = 0; i < ev.length;) {
      const x = ex(ev[i]), y = ey(ev[i]);
      starts.length = 0;
      for (; i < ev.length && ex(ev[i]) === x && ey(ev[i]) === y; i++) {
        const v = ev[i];
        if (v >= 0) starts.push(edges[v]);
        else { const k = st.indexOf(edges[~v]); if (k >= 0) st.splice(k, 1); }
      }
      // randen die hier beginnen van onder naar boven invoegen, zodat de rand eronder al klaar is
      starts.sort((p, q) => -orient(x, y, p.bx, p.by, q.bx, q.by));
      for (const e of starts) {
        let lo = 0, hi = st.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1, t = st[mid];
          let o = orient(t.ax, t.ay, t.bx, t.by, x, y);
          if (o === 0) o = orient(t.ax, t.ay, t.bx, t.by, e.bx, e.by);
          if (o < 0) hi = mid; else lo = mid + 1;
        }
        const b = lo > 0 ? st[lo - 1] : null;
        e.wr = b ? b.wr.map((w, k) => w + b.d[k]) : zero;
        st.splice(lo, 0, e);
      }
    }
  };
  const arrange = (sets) => {
    const P = prep(sets);
    if (!P) return null;
    const N = sets.length, edges = mergeSegs(splitSegs(buildSegs(P.shapes)), N);
    sweep(edges, N);
    return { edges, N, g: P.g, ox: P.ox, oy: P.oy };
  };

  // Halve randen [x1, y1, x2, y2, label] (binnenkant links) koppelen tot ringen; raakpunten → losse ringen
  const splitWalk = (w) => {
    const res = [], st = [], pos = new Map();
    for (let i = 0; i < w.length; i += 2) {
      const k = w[i] * K + w[i + 1], p = pos.get(k);
      if (p !== undefined) {
        const loop = st.splice(p);
        for (let j = 0; j < loop.length; j += 2) pos.delete(loop[j] * K + loop[j + 1]);
        res.push(loop);
      }
      pos.set(k, st.length); st.push(w[i], w[i + 1]);
    }
    if (st.length) res.push(st);
    return res;
  };
  const link = (hs) => {
    const out = new Map(), rings = [];
    hs.forEach((h, i) => { const k = h[0] * K + h[1], l = out.get(k); if (l) l.push(i); else out.set(k, [i]); });
    // volgende rand: de eerste rechtsom vanaf de terugweg (exacte hoekvergelijking met kruisproducten)
    const next = (h) => {
      const l = out.get(h[2] * K + h[3]);
      if (!l) return -1;
      if (l.length === 1) return l[0];
      const rx = h[0] - h[2], ry = h[1] - h[3];
      let best = -1, bh = 0, bx = 0, by = 0;
      for (const i of l) {
        const q = hs[i], dx = q[2] - q[0], dy = q[3] - q[1], c = rx * dy - ry * dx;
        const half = c < 0 || (c === 0 && rx * dx + ry * dy < 0) ? 0 : 1;
        if (best < 0 || half < bh || (half === bh && bx * dy - by * dx > 0)) { best = i; bh = half; bx = dx; by = dy; }
      }
      return best;
    };
    const used = new Uint8Array(hs.length);
    for (let i0 = 0; i0 < hs.length; i0++) {
      if (used[i0]) continue;
      const walk = [];
      for (let i = i0; i >= 0 && !used[i]; i = next(hs[i])) { used[i] = 1; walk.push(hs[i][0], hs[i][1]); }
      for (const f of splitWalk(walk)) rings.push({ f, lab: hs[i0][4] });
    }
    return rings;
  };
  // Punten (bijna) op één lijn weghalen; null voor ringen zonder oppervlakte of hoogstens enkele eenheden breed
  const cleanRing = (g) => {
    const keep = prune(g.length >> 1, (a, b, c) => {
      const ax = g[2 * a], ay = g[2 * a + 1], bx = g[2 * b], by = g[2 * b + 1], cx = g[2 * c], cy = g[2 * c + 1];
      const o = orient(ax, ay, cx, cy, bx, by), l2 = (cx - ax) * (cx - ax) + (cy - ay) * (cy - ay);
      return o * o <= l2 || (bx === ax && by === ay);
    });
    if (keep.length < 3) return null;
    const f = [];
    for (const i of keep) f.push(g[2 * i], g[2 * i + 1]);
    let per = 0;
    for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) per += Math.hypot(f[i] - f[j], f[i + 1] - f[j + 1]);
    return Math.abs(area2(f)) <= 4 * per ? null : f;
  };
  const toFloat = (A, f) => {
    const r = [];
    for (let i = 0; i < f.length; i += 2) r.push([A.ox + f[i] * A.g, A.oy + f[i + 1] * A.g]);
    return r;
  };
  const asSet = (v) => {
    if (!Array.isArray(v) || !v.length) return [];
    const f = v[0];
    if (f && f.pts) return G.flatten(v);                              // subs: eerst afvlakken
    if (Array.isArray(f) && typeof f[0] === 'number') return [v];     // losse ring
    return v.filter((r) => Array.isArray(r) && r.length >= 3);
  };
  const RULES = {
    union: (w) => w.some((v) => v !== 0),
    intersect: (w) => w.every((v) => v !== 0),
    subtract: (w) => w[0] !== 0 && w.every((v, i) => !i || v === 0),
    xor: (w) => w.reduce((c, v) => c + (v !== 0 ? 1 : 0), 0) % 2 === 1,
  };
  RULES.combine = RULES.xor;
  const run = (op, sets) => {
    const fn = RULES[op];
    if (!fn) throw new Error('Geo: onbekende bewerking ' + op);
    const A = arrange(sets.map(asSet));
    if (!A) return [];
    const hs = [];
    for (const e of A.edges) {
      const inR = fn(e.wr), inL = fn(e.wr.map((w, i) => w + e.d[i]));
      if (inL && !inR) hs.push([e.ax, e.ay, e.bx, e.by]);
      else if (inR && !inL) hs.push([e.bx, e.by, e.ax, e.ay]);
    }
    const res = [];
    for (const r of link(hs)) { const f = cleanRing(r.f); if (f) res.push(toFloat(A, f)); }
    return res;
  };
  G.boolean = (op, a, b) => run(op, [a, b]);

  // Fragmenteren: elk deel van de indeling met een eigen combinatie van vormen; gaten bij de kleinste omringende rand
  G.fragment = (shapes) => {
    const A = arrange((shapes || []).map(asSet));
    if (!A) return [];
    const hs = [], key = (w) => w.map((v) => (v ? '1' : '0')).join('');
    for (const e of A.edges) {
      const kr = key(e.wr), kl = key(e.wr.map((w, i) => w + e.d[i]));
      if (kl === kr) continue;
      if (kl.indexOf('1') >= 0) hs.push([e.ax, e.ay, e.bx, e.by, kl]);
      if (kr.indexOf('1') >= 0) hs.push([e.bx, e.by, e.ax, e.ay, kr]);
    }
    const outers = [], holes = [];
    for (const r of link(hs)) {
      const f = cleanRing(r.f);
      if (!f) continue;
      const a = area2(f), o = { f, lab: r.lab, a, box: ringBox(f), holes: [] };
      (a > 0 ? outers : holes).push(o);
    }
    for (const h of holes) {
      let best = null;
      for (const o of outers) {
        if (o.lab !== h.lab || (best && o.a >= best.a)) continue;
        const b = o.box, c = h.box;
        if (c[0] < b[0] || c[1] < b[1] || c[2] > b[2] || c[3] > b[3]) continue;
        // midden van een rand van het gat: ligt nooit op een rand van een deel met dezelfde vormen
        let w = NaN;
        for (let i = 0, n = h.f.length; i < n && w !== w; i += 2) w = windAt(o.f, (h.f[i] + h.f[(i + 2) % n]) / 2, (h.f[i + 1] + h.f[(i + 3) % n]) / 2);
        if (w) best = o;
      }
      if (best) best.holes.push(h.f);
    }
    return outers.sort((p, q) => p.box[1] - q.box[1] || p.box[0] - q.box[0]).map((o) => ({
      polys: [o.f, ...o.holes].map((f) => toFloat(A, f)),
      cover: [...o.lab].map((c, i) => (c === '1' ? i : -1)).filter((i) => i >= 0),
    }));
  };

  // Vormen samenvoegen zoals in PowerPoint; shapes = veelhoeksets in diacoördinaten, in selectievolgorde
  G.merge = (op, shapes) => {
    shapes = shapes || [];
    if (op === 'fragment') return G.fragment(shapes).map((p) => G.toSubs(p.polys));
    return G.toSubs(run(op, shapes));
  };

  App.Geo = G;
})();
