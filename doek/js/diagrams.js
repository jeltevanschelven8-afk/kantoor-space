/* =========================================================
   Doek (gemaakt door JJ van Schelven) — diagrammen: SmartArt-achtige indelingen
   Vaste, regelgebaseerde indelingen (geen AI): het niveau van een item in de
   overzichtslijst bepaalt zijn plaats in het diagram. layout() maakt er gewone
   vormen van (OOXML-presetnamen); de renderer tekent die met de vormenbibliotheek.
   ========================================================= */
'use strict';

(() => {
  const D = App.Diagrams = {};
  const PT = 4 / 3, SEC = 0.78, MIN = 8, MAX = 40;   // px per pt, tekst van subitems t.o.v. het hoofditem, grenzen (pt)
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r2 = (v) => Math.round(v * 100) / 100;
  const T = (s) => (App.t ? App.t(s) : s);
  const ang = (deg) => Math.round((((deg % 360) + 360) % 360) * 60000) % 21600000;   // graden → OOXML-hoek
  const pct = (v) => Math.round(clamp(v, 0, 1e6) * 1e5);                               // deel → OOXML-aanpassing
  let seq = 0;
  D.uid = () => 'd' + (Date.now() % 1e8).toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
  // binair zoeken naar de grootste waarde waarvoor ok() waar is
  const search = (lo, hi, ok, n = 22) => {
    if (!ok(lo)) return lo;
    if (ok(hi)) return hi;
    for (let k = 0; k < n; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return lo;
  };

  /* ---------- Tekst meten en passend maken ---------- */
  // breedte in px bij 10 pt (schaalt lineair met de grootte), met cache
  const mkMeasure = (ctx) => {
    const fn = ctx && typeof ctx.measure === 'function' ? ctx.measure : null, cache = new Map();
    return (t, b) => {
      const k = (b ? '1' : '0') + t;
      let v = cache.get(k);
      if (v === undefined) {
        v = fn ? +fn(t, 10, !!b) : NaN;
        if (!Number.isFinite(v)) v = t.length * 0.56 * 10 * PT * (b ? 1.06 : 1);
        cache.set(k, v);
      }
      return v;
    };
  };
  // aantal regels van één alinea bij sz (pt) en breedte maxW (px); -1 = een woord past niet
  const lineCount = (t, sz, maxW, M) => {
    const f = sz / 10, sp = M(' ') * f;
    let n = 0;
    for (const ln of String(t).split(/[\v\n]/)) {
      let cur = 0;
      n++;
      for (const wd of ln.split(/\s+/)) {
        if (!wd) continue;
        const ww = M(wd) * f;
        if (ww > maxW + 0.01) return -1;
        if (cur && cur + sp + ww > maxW + 0.01) { n++; cur = ww; } else cur = cur ? cur + sp + ww : ww;
      }
    }
    return n;
  };
  const paraSz = (s, p, sz) => Math.max(MIN, p.lvl && s._mix ? sz * SEC : sz);
  // hoogte van alle alinea's bij breedte aw (px); -1 = een woord past niet
  const textH = (s, sz, aw, M) => {
    let tot = 0;
    for (const p of s.text) {
      const z = paraSz(s, p, sz), px = z * PT, ind = p.bullet ? px * (0.9 + 0.7 * (p.ind || 0)) : 0;
      const n = lineCount(p.t, z, aw - ind, M);
      if (n < 0) return -1;
      tot += (tot ? px * 0.15 : 0) + n * px * 1.3;
    }
    return tot;
  };
  const fits = (s, sz, M) => {
    if (s._wf) {
      // tekstvak dat meegroeit met de tekst (ellips, driehoek, piramidelaag): breedte hangt af van de hoogte
      let th = sz * PT * 1.3;
      for (let k = 0; k < 16; k++) {
        const b = s._wf(th + 2);
        if (!b || b.w < 4) return false;
        const need = textH(s, sz, b.w - 3, M);
        if (need < 0) return false;
        if (need <= th + 0.01) { s._box = Object.assign({ h: th + 2 }, b); return true; }
        th = need;
      }
      return false;
    }
    const i = s.ins, ex = s._ex || 0, aw = s.w - i.l - i.r - 2 * ex, ah = s.h - i.t - i.b - 2 * ex;
    if (aw < 2 || ah < 2) return false;
    const need = textH(s, sz, aw, M);
    return need >= 0 && need <= ah - 2;
  };
  // tekstvakken die meegroeien: binnenmarges volgens het gevonden vak
  const placeBox = (s, M) => {
    if (!s._wf) return;
    let b = fits(s, s.sz, M) ? s._box : null;
    if (!b) { for (const th of [s.h * 0.5, s.h * 0.3, s.h * 0.15]) { const q = s._wf(th); if (q && q.w > 2) { b = Object.assign({ h: th }, q); break; } } }
    if (!b) b = { x: s.w * 0.15, y: s.h * 0.15, w: s.w * 0.7, h: s.h * 0.7 };
    s.ins = { l: r2(Math.max(0, b.x)), t: r2(Math.max(0, b.y)), r: r2(Math.max(0, s.w - b.x - b.w)), b: r2(Math.max(0, s.h - b.y - b.h)) };
    s.vAlign = 'ctr';
  };
  const maxSize = (s, cap, M) => {
    if (!fits(s, MIN, M)) return MIN;
    if (fits(s, cap, M)) return cap;
    let lo = MIN, hi = cap;
    for (let k = 0; k < 9; k++) { const m = (lo + hi) / 2; if (fits(s, m, M)) lo = m; else hi = m; }
    return lo;
  };
  // één tekengrootte per tekstgroep (_k, bijv. 'n0' = knopen van niveau 1): de grootste die overal past
  const fitText = (shapes, M, free) => {
    const groups = new Map();
    shapes.forEach((s) => {
      if (!s.text || !s.text.length) return;
      const k = s._k || 'n0';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    });
    const size = new Map();
    groups.forEach((list, k) => {
      let best = MAX;
      list.forEach((s) => { best = Math.min(best, maxSize(s, Math.min(MAX, s._max || MAX), M)); });
      size.set(k, best);
    });
    // tekst in aparte vakken voor subitems is nooit groter dan 0,85 × die van de hoofditems (zoals SmartArt)
    if (!free && size.has('s') && size.has('n0')) size.set('s', Math.min(size.get('s'), Math.max(MIN, size.get('n0') * 0.85)));
    groups.forEach((list, k) => {
      const best = clamp(Math.floor(size.get(k) * 2) / 2, MIN, MAX);
      list.forEach((s) => { s.sz = best; s.text.forEach((p) => { p.sz = Math.round(paraSz(s, p, best) * 2) / 2; }); placeBox(s, M); });
    });
  };
  // meegroeiende tekstvakken: ellips (gecentreerd), driehoek (punt boven of onder), piramidelaag (smal boven of onder)
  const wfEll = (w, h) => (th) => {
    const rx = (w / 2) * 0.93, ry = (h / 2) * 0.93;
    if (th >= 2 * ry) return null;
    const bw = 2 * rx * Math.sqrt(1 - (th / 2 / ry) ** 2);
    return { x: (w - bw) / 2, y: (h - th) / 2, w: bw };
  };
  const wfTri = (w, h, inv) => (th) => {
    const m = h * 0.07, yt = inv ? m : h - m - th;
    if (yt < 0 || yt + th > h) return null;
    const bw = w * (inv ? (h - yt - th) / h : yt / h) * 0.9;
    return { x: (w - bw) / 2, y: yt, w: bw };
  };
  const wfBand = (nw, ww, h, inv) => (th) => {
    if (nw < 1) return wfTri(ww, h, inv)(th);
    const m = h * 0.06;
    if (th > h - 2 * m) return null;
    const yt = (h - th) / 2, yn = inv ? yt + th : yt, bw = (inv ? ww - ((ww - nw) * yn) / h : nw + ((ww - nw) * yn) / h) * 0.92;
    return { x: (ww - bw) / 2, y: yt, w: bw };
  };

  /* ---------- Kleuren en stijlen ---------- */
  // geeft alleen ColorRefs ('accent1', 'accent1/l40' …); de renderer zet ze om
  const mkPaint = (color, look) => {
    const c = color || 'accent1', lk = look || 'flat', ol = c === 'outline';
    const base = (i) => (c === 'colorful1' ? 'accent' + (1 + (i % 6)) : c === 'colorful2' ? 'accent' + (2 + (i % 5))
      : c === 'dark' ? 'dk2' : /^accent[1-6]$/.test(c) ? c : 'accent1');
    // opvulling en tekstkleur volgens de kleur; rand en schaduw volgens de stijl
    const fx = (fill, txt, edge, dark) => {
      if (ol) return { fill: null, line: edge, lineW: 1.5, color: 'tx1' };
      if (lk === 'outline') return { fill: 'bg1', line: edge, lineW: 1.5, color: 'tx1' };
      if (lk === 'subtle') return { fill, line: 'lt1', lineW: 1, color: txt };
      if (lk === 'intense') return { fill, line: dark, lineW: 1.25, shadow: true, color: txt };
      return { fill, line: null, color: txt };
    };
    const thin = (b) => (ol ? { fill: null, line: b, lineW: 1, color: 'tx1' } : null);
    return {
      multi: c === 'colorful1' || c === 'colorful2',
      base,
      node: (i) => { const b = base(i); return fx(b, 'lt1', b, b + '/d25'); },
      tint: (i, t) => { const b = base(i); return fx(t > 0 ? b + '/l' + Math.round(t) : b, t >= 40 ? 'tx1' : 'lt1', b, b + '/d25'); },
      light: (i) => { const b = base(i), o = fx(b + '/l80', 'tx1', b + '/l40', b + '/l40'); delete o.shadow; return o; },
      alpha: (i) => { const b = base(i), o = fx(b, 'tx1', b, b + '/d25'); delete o.shadow; if (o.fill) o.alpha = 0.5; return o; },
      arrow: (i) => { const b = base(i); return thin(b + '/l40') || { fill: b + '/l40', line: null, color: 'tx1' }; },
      deco: (i) => { const b = base(i); return thin(b + '/l40') || { fill: b + '/l60', line: null, color: 'tx1' }; },
      solid: (i) => { const b = base(i); return thin(b) || { fill: b, line: null, color: 'lt1' }; },
      stroke: (i, w = 1.5) => ({ fill: null, line: base(i), lineW: w, color: 'tx1' }),
      text: () => ({ fill: null, line: null, color: 'tx1' }),
    };
  };

  /* ---------- Vormen maken ---------- */
  const PH = () => T('[Tekst]');
  const para = (it, lvl, bullet) => {
    const p = { t: it.text || PH(), lvl, bullet };
    if (it.id) p.id = it.id;
    if (!it.text) p.ph = true;
    if (lvl && it.d > 1) p.ind = it.d - 1;
    return p;
  };
  // tekst staat in de vorm zelf alleen bij rechthoek-achtige presets; anders in een eigen tekstvak erboven
  const INLINE = { rect: 0, roundRect: 0.05, round2SameRect: 0.05, snip1Rect: 0.05 };
  const mk = (E, o) => {
    const s = Object.assign({ role: 'node', geom: 'rect', x: 0, y: 0, w: 0, h: 0, fill: null, line: null, color: 'tx1', align: 'ctr', vAlign: 'ctr' }, o);
    ['x', 'y', 'w', 'h'].forEach((k) => { s[k] = Number.isFinite(s[k]) ? s[k] : 0; });
    s.w = Math.max(0, s.w); s.h = Math.max(0, s.h);
    const ti = s.wf ? {} : s.ti || {}, wf = s.wf;
    delete s.ti;
    delete s.wf;
    if (!s.flipH) delete s.flipH;
    if (!s.flipV) delete s.flipV;
    if (!s.rot) delete s.rot;
    if (s.opaque && !s.fill && s.line) s.fill = 'bg1';   // ligt over andere vormen: niet doorzichtig
    delete s.opaque;
    if (s.text && s.text.length && !(s.geom in INLINE)) {
      // aparte vorm voor de tekst, precies op het tekstgebied
      const tx = s.x + (ti.l || 0), ty = s.y + (ti.t || 0), tw = s.w - (ti.l || 0) - (ti.r || 0), th = s.h - (ti.t || 0) - (ti.b || 0);
      const lab = { role: s.role, geom: 'rect', x: tx, y: ty, w: tw, h: th, fill: null, line: null, label: true };
      if (wf) lab._wf = wf;
      ['text', 'color', 'align', 'vAlign', 'itemId', 'lvl', '_k', '_mix', '_max'].forEach((k) => { if (s[k] !== undefined) lab[k] = s[k]; });
      ['text', 'align', 'vAlign', '_k', '_mix', '_max'].forEach((k) => delete s[k]);
      E.out.push(s);
      return mk(E, lab);
    }
    if (s.text && s.text.length) {
      const aw = s.w - (ti.l || 0) - (ti.r || 0), ah = s.h - (ti.t || 0) - (ti.b || 0), p = clamp(Math.min(aw, ah) * 0.07, 1.5, 9);
      s.ins = { l: r2(p + (ti.l || 0)), t: r2(p + (ti.t || 0)), r: r2(p + (ti.r || 0)), b: r2(p + (ti.b || 0)) };
      if (INLINE[s.geom]) s._ex = Math.min(s.w, s.h) * INLINE[s.geom];   // eigen tekstrand van de preset
    }
    E.out.push(s);
    return s;
  };
  // knoop voor een item; kids: subitems als opsommingstekens in dezelfde vorm
  const node = (E, it, x, y, w, h, o = {}) => {
    const { kids: withKids, ci, st, ...rest } = o;
    const kids = withKids ? it.kids : [];
    const text = [para(it, 0, false)].concat(kids.map((k) => para(k, 1, true)));
    const style = st || E.P.node(ci != null ? ci : it.ix);
    return mk(E, Object.assign({ role: 'node', geom: 'rect', x, y, w, h, itemId: it.id, lvl: it.lvl, text, _k: 'n' + it.lvl, _mix: kids.length > 0, align: kids.length ? 'l' : 'ctr' }, style, rest));
  };
  // vak met alleen de subitems van een item
  const kidBox = (E, it, x, y, w, h, o = {}) => {
    const { ci, st, ...rest } = o;
    const style = st || E.P.light(ci != null ? ci : it.ix);
    return mk(E, Object.assign({ role: 'node', geom: 'rect', x, y, w, h, itemId: it.id, lvl: it.lvl + 1, text: it.kids.map((k) => para(k, 1, true)), _k: 's', align: 'l', vAlign: 't' }, style, rest));
  };
  // knoop voor één subitem (eigen vak, zonder opsommingsteken)
  const kidNode = (E, k, x, y, w, h, st, o = {}) => mk(E, Object.assign({ role: 'node', geom: 'rect', x, y, w, h, itemId: k.id, lvl: k.lvl, text: [para(k, 1, false)], _k: 's' }, st, o));
  const deco = (E, geom, x, y, w, h, st, o) => mk(E, Object.assign({ role: 'deco', geom, x, y, w, h }, st, o));
  const conn = (E, geom, x, y, w, h, st, o) => mk(E, Object.assign({ role: 'connector', geom, x, y, w, h }, st, o));
  // rechte lijn van (x1, y1) naar (x2, y2); pts staat er ook bij
  const seg = (E, x1, y1, x2, y2, st, role = 'connector') => mk(E, Object.assign({ role, geom: 'line', x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, pts: [[r2(x1), r2(y1)], [r2(x2), r2(y2)]] }, st));

  /* ---------- Overzicht → boom ---------- */
  const tree = (items) => {
    const roots = [], stack = [], all = [];
    (Array.isArray(items) ? items : []).forEach((src) => {
      if (!src || typeof src !== 'object') return;
      const lvl = clamp(Math.floor(+src.lvl) || 0, 0, stack.length);
      const n = { id: src.id, text: src.text == null ? '' : String(src.text), lvl, asst: !!src.asst, ch: [], ix: 0, gi: all.length };
      stack.length = lvl;
      if (lvl) { const p = stack[lvl - 1]; n.parent = p; n.ix = p.ch.length; p.ch.push(n); } else { n.ix = roots.length; roots.push(n); }
      stack.push(n);
      all.push(n);
    });
    // kids = alle afstammelingen in volgorde, met diepte d (1 = direct kind)
    const desc = (n, d, acc) => { n.ch.forEach((c) => { acc.push({ id: c.id, text: c.text, lvl: c.lvl, d }); desc(c, d + 1, acc); }); return acc; };
    all.forEach((n) => { n.kids = desc(n, 1, []); });
    return { roots, all };
  };

  /* ---------- Raster ---------- */
  // n vakken in E.W × E.H: verhouding h/b tussen lo en hi, tussenruimte gx/gy als deel van de vakbreedte.
  // o.cols = vast aantal kolommen, o.cm = kolomsgewijs vullen, o.pen = straf voor extra rijen (of kolommen bij cm), o.wrap = straf voor meer rijen én kolommen, o.row = liever één rij dan één kolom (tenzij het vlak hoog is),
  // o.gyh = extra verticale tussenruimte als deel van de vakhoogte, o.snake = oneven rijen van rechts naar links, o.left = laatste rij niet centreren
  const grid = (E, n, lo, hi, gx, gy = gx, o = {}) => {
    let best = null;
    for (let c = 1; c <= n; c++) {
      if (o.cols && c !== Math.min(o.cols, n)) continue;
      let r = Math.ceil(n / c), cc = c;
      if (o.cm) cc = Math.ceil(n / r);
      const rh = r + (o.gyh || 0) * (r - 1);
      let cw = E.W / (cc + gx * (cc - 1)), ar = (E.H / cw - gy * (r - 1)) / rh;
      if (ar < lo) { ar = lo; cw = E.H / (rh * lo + gy * (r - 1)); }
      ar = Math.min(ar, hi);
      const sc = cw * cw * ar * Math.pow(o.cm ? cc : r, -(o.pen || 0)) * (o.wrap && cc > 1 && r > 1 ? Math.pow(r, -o.wrap) : 1) * (o.row && cc === 1 && r > 1 && E.H < E.W * 1.15 ? 0.35 : 1);
      if (!best || sc > best.sc * 1.0001) best = { sc, c: cc, r, cw, ch: cw * ar };
    }
    const { c, r, cw, ch } = best, g = gx * cw, gv = gy * cw + (o.gyh || 0) * ch;
    const tw = c * cw + (c - 1) * g, th = r * ch + (r - 1) * gv, x0 = E.X + (E.W - tw) / 2, y0 = E.Y + (E.H - th) / 2;
    return {
      c, r, cw, ch, g, gv, x0, y0,
      cell: (i) => {
        const row = o.cm ? i % r : Math.floor(i / c), col = o.cm ? Math.floor(i / r) : i % c;
        let x = x0 + col * (cw + g);
        if (o.snake && row % 2) x = x0 + (c - 1 - col) * (cw + g);
        else if (!o.cm && !o.left && row === r - 1) x += ((c - (n - row * c)) * (cw + g)) / 2;
        return { x, y: y0 + row * (ch + gv), row, col };
      },
    };
  };
  // blokpijl in de ruimte tussen twee vakken
  const harrow = (E, x1, x2, cy, hmax, st, left) => {
    const gw = x2 - x1, w = gw * 0.62, h = Math.min(hmax, w * 1.1);
    if (w < 2 || h < 2) return;
    conn(E, left ? 'leftArrow' : 'rightArrow', x1 + (gw - w) / 2, cy - h / 2, w, h, st, { adj: { adj1: 60000, adj2: 50000 } });
  };
  const varrow = (E, y1, y2, cx, wmax, st, up) => {
    const gh = y2 - y1, h = gh * 0.62, w = Math.min(wmax, h * 1.1);
    if (w < 2 || h < 2) return;
    conn(E, up ? 'upArrow' : 'downArrow', cx - w / 2, y1 + (gh - h) / 2, w, h, st, { adj: { adj1: 60000, adj2: 50000 } });
  };
  // pijl van vak a naar vak b (zelfde rij → horizontaal, recht eronder → omlaag); bh = hoogte van de band voor de pijl
  const link = (E, g, a, b, st, bh) => {
    const hb = bh || g.ch;
    if (a.row === b.row && !(Math.abs(a.x - b.x) < 0.5)) {
      const l = a.x < b.x;
      harrow(E, (l ? a.x : b.x) + g.cw, l ? b.x : a.x, a.y + hb / 2, hb * 0.45, st, !l);
    } else if (Math.abs(a.x - b.x) < 0.5 && b.y > a.y) varrow(E, a.y + g.ch, b.y, a.x + g.cw / 2, g.cw * 0.4, st);
  };

  /* =========================================================
     Lijst
     ========================================================= */
  const L = {};
  L.basicBlockList = (E) => {
    const g = grid(E, E.n, 0.6, 0.6, 0.1);
    E.roots.forEach((it, i) => { const c = g.cell(i); node(E, it, c.x, c.y, g.cw, g.ch, { kids: true }); });
  };
  // rijen (eenheden per item, tussenruimte gapU) over kolommen verdelen zodat de eenheid u zo groot mogelijk wordt; cap(kolombreedte) = grootste u
  const colSplit = (E, units, gapU, cap) => {
    const n = units.length, gx = 0.04, tot = units.reduce((a, b) => a + b, 0);
    let best = null;
    for (let c = 1; c <= n; c++) {
      const cols = [[]];
      let acc = 0;
      units.forEach((u, i) => {
        if (cols[cols.length - 1].length && acc + u / 2 > (tot / c) * cols.length && cols.length < c) cols.push([]);
        cols[cols.length - 1].push(i);
        acc += u;
      });
      const cw = (E.W * (1 - gx * (cols.length - 1))) / cols.length;
      const need = Math.max(...cols.map((cl) => cl.reduce((s, i) => s + units[i], 0) + gapU * (cl.length - 1)));
      const u = Math.min(E.H / need, cap(cw));
      if (!best || u > best.u * 1.03) best = { u, cols, cw, need, x: (ci) => E.X + ci * (cw + E.W * gx), y0: E.Y + (E.H - need * u) / 2 };
    }
    return best;
  };
  L.verticalBulletList = (E) => {
    // balken onder elkaar (bij brede vlakken in kolommen); subitems in een licht vak direct onder de balk
    const kh = (it) => (it.kids.length ? 0.2 + it.kids.length * 0.62 : 0), gap = 0.15;
    const S = colSplit(E, E.roots.map((it) => 1 + kh(it)), gap, (cw) => cw * 0.2), u = S.u;
    S.cols.forEach((cl, ci) => {
      let y = S.y0;
      cl.forEach((i) => {
        const it = E.roots[i];
        node(E, it, S.x(ci), y, S.cw, u, { geom: 'roundRect', align: 'l' });
        y += u;
        if (it.kids.length) { kidBox(E, it, S.x(ci), y, S.cw, kh(it) * u); y += kh(it) * u; }
        y += gap * u;
      });
    });
  };
  L.stackedList = (E) => {
    // kolommen: cirkel met de tekst bovenop een hoog vak met de subitems
    const g = grid(E, E.n, 1.3, 2.8, 0.12);
    E.free = true;
    E.roots.forEach((it, i) => {
      const c = g.cell(i), d = Math.min(g.cw * 0.86, g.ch * 0.46), top = c.y + d * 0.5;
      if (it.kids.length) kidBox(E, it, c.x, top, g.cw, g.ch - d * 0.5, { geom: 'roundRect', ti: { t: d * 0.55 } });
      else deco(E, 'roundRect', c.x, top, g.cw, g.ch - d * 0.5, E.P.light(it.ix), { itemId: it.id });
      node(E, it, c.x + (g.cw - d) / 2, c.y, d, d, { geom: 'ellipse', wf: wfEll(d, d), opaque: true });
    });
  };
  L.horizontalBulletList = (E) => {
    // kolommen: kop met de tekst, daaronder een licht vak met de subitems
    const any = E.roots.some((it) => it.kids.length);
    const g = grid(E, E.n, any ? 1.1 : 0.3, any ? 2.6 : 0.75, 0.08);
    E.roots.forEach((it, i) => {
      const c = g.cell(i), hh = any ? Math.min(g.ch * 0.3, g.cw * 0.45) : g.ch;
      node(E, it, c.x, c.y, g.cw, hh);
      if (!any) return;
      if (it.kids.length) kidBox(E, it, c.x, c.y + hh, g.cw, g.ch - hh);
      else deco(E, 'rect', c.x, c.y + hh, g.cw, g.ch - hh, E.P.light(it.ix), { itemId: it.id });
    });
  };
  L.tabList = (E) => {
    // rijen: tab met de tekst links op een lijn, subitems rechts ervan (bij brede vlakken in kolommen)
    const rh = (it) => Math.max(1, it.kids.length * 0.62 + 0.2), gap = 0.3;
    const S = colSplit(E, E.roots.map(rh), gap, (cw) => cw * 0.16), u = S.u, tw = Math.min(S.cw * 0.32, u * 4);
    S.cols.forEach((cl, ci) => {
      let y = S.y0;
      const x = S.x(ci);
      cl.forEach((i) => {
        const it = E.roots[i], h = rh(it) * u, ly = y + h;
        seg(E, x, ly, x + S.cw, ly, E.P.stroke(it.ix, 1.5), 'deco');
        node(E, it, x, ly - u, tw, u, { geom: 'round2SameRect' });
        if (it.kids.length) kidBox(E, it, x + tw + u * 0.15, y, S.cw - tw - u * 0.15, h, { st: E.P.text(), vAlign: 'ctr' });
        y += h + gap * u;
      });
    });
  };
  L.linedList = (E) => {
    // dikke lijn bovenaan; per item de tekst links, de subitems rechts met dunne lijnen ertussen (bij brede vlakken in kolommen)
    const rows = (it) => Math.max(1, it.kids.length);
    const S = colSplit(E, E.roots.map(rows), 0, (cw) => cw * 0.14), u = S.u, lw = S.cw * 0.36;
    S.cols.forEach((cl, ci) => {
      let y = S.y0;
      const x = S.x(ci), w = S.cw;
      seg(E, x, y, x + w, y, E.P.stroke(0, 3), 'deco');
      cl.forEach((i) => {
        const it = E.roots[i], h = rows(it) * u;
        node(E, it, x, y, lw, h, { st: E.P.text(), align: 'l', vAlign: 't' });
        it.kids.forEach((k, j) => {
          const ky = y + j * u, ind = (k.d - 1) * u * 0.4;
          kidNode(E, k, x + lw + ind, ky, w - lw - ind, u, E.P.text(), { align: 'l' });
          if (j < it.kids.length - 1) seg(E, x + lw, ky + u, x + w, ky + u, E.P.stroke(it.ix, 0.75), 'deco');
        });
        y += h;
        seg(E, x, y, x + w, y, E.P.stroke(it.ix, 1), 'deco');
      });
    });
  };
  L.groupingList = (E) => {
    // groepen: kop bovenaan, subitems als blokjes in een licht groepsvlak
    const mk1 = Math.max(1, ...E.roots.map((it) => it.kids.length));
    const g = grid(E, E.n, 0.9, 3.2, 0.1);
    E.roots.forEach((it, i) => {
      const c = g.cell(i), hh = Math.min(g.ch / (1.25 + 0.95 * mk1), g.cw * 0.42), kh = hh * 0.8, gp = hh * 0.15, ix = g.cw * 0.08;
      deco(E, 'roundRect', c.x, c.y + hh * 0.5, g.cw, g.ch - hh * 0.5, E.P.light(it.ix), { itemId: it.id });
      node(E, it, c.x + ix, c.y, g.cw - 2 * ix, hh, { geom: 'roundRect', opaque: true });
      it.kids.forEach((k, j) => kidNode(E, k, c.x + ix, c.y + hh + gp + j * (kh + gp), g.cw - 2 * ix, kh, E.P.tint(it.ix, 40), { geom: 'roundRect', opaque: true }));
    });
  };
  L.trapezoidList = (E) => {
    // trapezia naast elkaar, smal aan de bovenkant; subitems als opsommingstekens erin
    const g = grid(E, E.n, 0.9, 1.5, 0.04);
    E.roots.forEach((it, i) => {
      const c = g.cell(i), sl = g.cw * 0.16, ss = Math.min(g.cw, g.ch);
      node(E, it, c.x, c.y, g.cw, g.ch, { geom: 'trapezoid', adj: { adj: pct(sl / ss) }, kids: true, ti: { l: sl * 0.85, r: sl * 0.85, t: g.ch * 0.04, b: g.ch * 0.04 } });
    });
  };

  /* =========================================================
     Proces
     ========================================================= */
  // vakken in leesvolgorde met pijlen ertussen (zelfde rij of recht eronder)
  const links = (E, g, cs, bh) => cs.forEach((c, i) => { if (i) link(E, g, cs[i - 1], c, E.P.arrow(i - 1), bh); });
  L.basicProcess = (E) => {
    const g = grid(E, E.n, 0.6, 0.6, 0.42, 0, { wrap: 2.5, row: true, gyh: 0.55 }), cs = E.roots.map((_, i) => g.cell(i));
    links(E, g, cs);
    E.roots.forEach((it, i) => node(E, it, cs[i].x, cs[i].y, g.cw, g.ch, { kids: true }));
  };
  L.accentProcess = (E) => {
    // kop met de tekst die over een licht vak met de subitems valt
    const any = E.roots.some((it) => it.kids.length);
    if (E.H > E.W * 1.25 && E.n > 1) {
      // hoge vlakken: stappen onder elkaar, de subitems rechts van de kop
      const gp = 0.4, rh = Math.min(E.H / (E.n + gp * (E.n - 1)), E.W * 0.3), y0 = E.Y + (E.H - rh * (E.n + gp * (E.n - 1))) / 2, hw = any ? E.W * 0.42 : E.W;
      E.roots.forEach((it, i) => {
        const y = y0 + i * rh * (1 + gp);
        if (i) varrow(E, y - rh * (gp + 0.3), y, E.X + hw / 2, hw * 0.4, E.P.arrow(i - 1));
        if (it.kids.length) kidBox(E, it, E.X + hw * 0.85, y + rh * 0.2, E.W - hw * 0.85, rh * 0.8, { ti: { l: hw * 0.15 } });
        node(E, it, E.X, y, hw, any ? rh * 0.7 : rh, { opaque: true });
      });
      return;
    }
    const g = grid(E, E.n, any ? 1.0 : 0.42, any ? 1.9 : 0.62, 0.3, 0.12, { pen: 2 }), cs = E.roots.map((_, i) => g.cell(i));
    const hh = any ? Math.min(g.ch * 0.3, g.cw * 0.42) : g.ch;
    links(E, g, cs, hh);
    E.roots.forEach((it, i) => {
      const c = cs[i];
      if (it.kids.length) kidBox(E, it, c.x + g.cw * 0.14, c.y + hh * 0.55, g.cw * 0.86, g.ch - hh * 0.55, { ti: { t: hh * 0.45 } });
      node(E, it, c.x, c.y, any ? g.cw * 0.86 : g.cw, hh, { opaque: true });
    });
  };
  // punthaken (in elkaar grijpend) of gesloten pijlvormen; subitems in een tekstvak eronder
  const chevrons = (E, geom) => {
    const any = E.roots.some((it) => it.kids.length), ca = 0.4, nest = geom === 'chevron';
    if (E.H > E.W * 1.25 && E.n > 1) {
      // hoge vlakken: pijlvormen onder elkaar, de subitems rechts ernaast
      const gp = 0.22, rh = Math.min(E.H / (E.n + gp * (E.n - 1)), E.W * 0.3), cw = Math.min(any ? E.W * 0.45 : E.W, rh * 2.6), d = rh * 0.5;
      const y0 = E.Y + (E.H - rh * (E.n + gp * (E.n - 1))) / 2, x0 = any ? E.X : E.X + (E.W - cw) / 2;
      E.roots.forEach((it, i) => {
        const y = y0 + i * rh * (1 + gp);
        node(E, it, x0, y, cw, rh, { geom, adj: { adj: 50000 }, ti: nest ? { l: d, r: d } : { r: d * 0.75 } });
        if (it.kids.length) kidBox(E, it, x0 + cw + rh * 0.15, y, E.W - cw - rh * 0.15, rh, { st: E.P.text(), vAlign: 'ctr' });
      });
      return;
    }
    const g = grid(E, E.n, any ? 1.15 : ca, any ? 1.6 : ca, nest ? -ca * 0.42 : 0.05, 0.16, { pen: 2 });
    const ch = any ? g.cw * ca : g.ch, d = ch * 0.5;
    E.roots.forEach((it, i) => {
      const c = g.cell(i);
      node(E, it, c.x, c.y, g.cw, ch, { geom, adj: { adj: 50000 }, ti: nest ? { l: d, r: d } : { r: d * 0.75 } });
      if (it.kids.length) kidBox(E, it, c.x + (nest ? d * 0.6 : 0), c.y + ch + g.cw * 0.03, g.cw - (nest ? d * 1.2 : d * 0.5), g.ch - ch - g.cw * 0.03, { st: E.P.text() });
    });
  };
  L.basicChevronProcess = (E) => chevrons(E, 'chevron');
  L.closedChevronProcess = (E) => chevrons(E, 'homePlate');
  L.continuousArrowProcess = (E) => {
    // brede pijl op de achtergrond, de stappen erop
    const n = E.n, v = E.H > E.W * 1.15, A = v ? E.H : E.W, B = v ? E.W : E.H;
    const ab = Math.min(B, A * 0.5), head = Math.min(ab * 0.5, A * 0.15), o = (B - ab) / 2;
    const st = E.P.deco(0), adj = { adj1: 70000, adj2: pct(head / Math.min(A, ab)) };
    if (v) deco(E, 'downArrow', E.X + o, E.Y, ab, A, st, { adj });
    else deco(E, 'rightArrow', E.X, E.Y + o, A, ab, st, { adj });
    const a0 = A * 0.03, span = A - head - A * 0.05, gp = 0.12, nl = span / (n + gp * (n - 1)), nb = Math.min(ab * 0.6, nl * (v ? 1.6 : 1));
    E.roots.forEach((it, i) => {
      const a = a0 + i * nl * (1 + gp), b = o + (ab - nb) / 2;
      if (v) node(E, it, E.X + b, E.Y + a, nb, nl, { geom: 'roundRect', kids: true, opaque: true });
      else node(E, it, E.X + a, E.Y + b, nl, nb, { geom: 'roundRect', kids: true, opaque: true });
    });
  };
  L.verticalProcess = (E) => {
    // stappen onder elkaar met pijlen omlaag; bij brede vlakken in meer kolommen
    const g = grid(E, E.n, 0.2, 0.5, 0.12, 0, { cm: true, pen: 1, gyh: 0.5 }), cs = E.roots.map((_, i) => g.cell(i));
    links(E, g, cs);
    E.roots.forEach((it, i) => node(E, it, cs[i].x, cs[i].y, g.cw, g.ch, { geom: 'roundRect', kids: true }));
  };
  L.stepUpProcess = (E) => {
    // treden die van links naar rechts oplopen, tekst bovenaan elke trede
    const n = E.n, gp = 0.06, cw = E.W / (n + gp * (n - 1));
    if (E.H > E.W * 1.2 && n > 1) {
      const bh = E.H / (n + 0.08 * (n - 1)), bw = E.W * 0.62, dx = (E.W - bw) / (n - 1);
      E.roots.forEach((it, i) => node(E, it, E.X + i * dx, E.Y + E.H - (i + 1) * bh - i * 0.08 * bh, bw, bh, { kids: true }));
      return;
    }
    E.roots.forEach((it, i) => {
      const h = E.H * (n === 1 ? 1 : 0.4 + (0.6 * i) / (n - 1));
      node(E, it, E.X + i * cw * (1 + gp), E.Y + E.H - h, cw, h, { kids: true, vAlign: 't' });
    });
  };
  L.basicTimeline = (E) => {
    // tijdlijn: pijl door het midden, punten erop, tekst om en om aan beide kanten
    const n = E.n, v = E.H > E.W * 1.2, A = v ? E.H : E.W, B = v ? E.W : E.H;
    const th = clamp(B * 0.09, 4, 36), mid = B / 2, head = Math.min(th * 1.4, A * 0.1), step = (A - head) / n;
    const dm = Math.min(th * 1.05, step * 0.6), gap = th * 0.35, lb = mid - th / 2 - gap;
    const box = (a, b, la, lb2) => (v ? [E.X + b, E.Y + a, lb2, la] : [E.X + a, E.Y + b, la, lb2]);
    const adj = { adj1: 50000, adj2: pct(head / Math.min(A, th)) };
    deco(E, v ? 'downArrow' : 'rightArrow', ...box(0, mid - th / 2, A, th), E.P.deco(0), { adj });
    E.roots.forEach((it, i) => {
      const a = step * (i + 0.5), first = i % 2 === 0;
      deco(E, 'ellipse', ...box(a - dm / 2, mid - dm / 2, dm, dm), E.P.node(it.ix), { itemId: it.id });
      // breedte: tot bijna twee stappen (buren aan dezelfde kant staan twee stappen verder), binnen de randen
      const la = Math.min(step * (n <= 2 ? 2 : 1.9), 2 * a, 2 * (A - a));
      node(E, it, ...box(a - la / 2, first ? 0 : mid + th / 2 + gap, la, lb), { st: E.P.text(), kids: true, vAlign: v ? 'ctr' : first ? 'b' : 't', align: v ? 'l' : 'ctr' });
    });
  };
  L.basicBendingProcess = (E) => {
    // slang: rijen om en om van links en van rechts, pijl omlaag aan het eind van een rij
    const g = grid(E, E.n, 0.6, 0.6, 0.42, 0, { snake: true, left: true, gyh: 0.55 }), cs = E.roots.map((_, i) => g.cell(i));
    links(E, g, cs);
    E.roots.forEach((it, i) => node(E, it, cs[i].x, cs[i].y, g.cw, g.ch, { kids: true }));
  };

  /* =========================================================
     Cyclus
     ========================================================= */
  // n knopen (breedte bw, h/b = ar) gelijk verdeeld over een ellips, rechtsom vanaf a0 (graden; -90 = boven).
  // sep = minimale afstand tussen knopen (× maat), o.round = ronde knopen, o.inner(q) = minimale straal
  const ring = (E, n, ar, sep, o = {}) => {
    const cx = E.X + E.W / 2, cy = E.Y + E.H / 2, ecc = o.ecc || clamp((Math.max(E.W, E.H) / Math.min(E.W, E.H)) * 0.9, 1.8, 4);
    const a0 = o.a0 != null ? o.a0 : n === 2 && E.W > E.H ? 180 : -90;
    const angs = Array.from({ length: n }, (_, k) => (a0 + (360 * k) / n) * RAD);
    const geo = (bw) => {
      const bh = bw * ar;
      let rx = (E.W - bw) / 2, ry = (E.H - bh) / 2;
      if (n === 1) rx = ry = 0;
      rx = Math.min(rx, ry * ecc); ry = Math.min(ry, rx * ecc);
      return { bw, bh, rx, ry, cx, cy, pts: angs.map((a) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), a })) };
    };
    const ok = (bw) => {
      const q = geo(bw);
      if (q.rx < 0 || q.ry < 0) return false;
      if (o.inner && n > 1 && Math.min(q.rx, q.ry) < o.inner(q)) return false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = Math.abs(q.pts[i].x - q.pts[j].x), dy = Math.abs(q.pts[i].y - q.pts[j].y);
        if (o.round ? Math.hypot(dx, dy) < bw * sep : dx < bw * sep && dy < q.bh * sep) return false;
      }
      return true;
    };
    return geo(search(1, Math.min(E.W, E.H / ar) * (n === 1 ? o.one || 0.6 : 1), ok));
  };
  // circularArrow over de ellips van q van hoek a1 naar a2 (graden, rechtsom); de punt eindigt bij a2
  const arcArrow = (E, q, a1, sweep, th, role, st) => {
    const hh = th * 1.15, rm = Math.max(1, Math.min(q.rx, q.ry)), w = 2 * (q.rx + hh), h = 2 * (q.ry + hh), ss = Math.min(w, h);
    const aA = Math.min((hh * 1.6) / rm / RAD, sweep * 0.5);
    return mk(E, Object.assign({ role, geom: 'circularArrow', x: q.cx - w / 2, y: q.cy - h / 2, w, h,
      adj: { adj1: pct(th / ss), adj2: ang(aA), adj3: ang(a1 + sweep - aA), adj4: ang(a1), adj5: pct(hh / ss) } }, st));
  };
  // gebogen pijlen tussen opeenvolgende knopen: langs de ellips vanaf de rand van de ene knoop tot de rand van de volgende
  const arcs = (E, q, thf) => {
    const n = q.pts.length, rm = Math.min(q.rx, q.ry);
    if (n < 2 || rm < 6) return;
    const th = clamp(rm * thf, 1.5, q.bh * 0.4), mg = th * 1.15 + 2;
    const at = (t) => [q.cx + q.rx * Math.cos(t), q.cy + q.ry * Math.sin(t)];
    const inBox = (p, c) => Math.abs(p[0] - c.x) < q.bw / 2 + mg && Math.abs(p[1] - c.y) < q.bh / 2 + mg;
    const vis = (t) => Math.atan2(q.ry * Math.sin(t), q.rx * Math.cos(t)) / RAD;   // OOXML-hoeken zijn echte richtingen
    q.pts.forEach((p, i) => {
      const nx = q.pts[(i + 1) % n];
      let t1 = nx.a;
      while (t1 <= p.a) t1 += 2 * Math.PI;
      const st = (t1 - p.a) / 240;
      let ta = p.a, tb = t1;
      while (ta < t1 && inBox(at(ta), p)) ta += st;
      while (tb > ta && inBox(at(tb), nx)) tb -= st;
      const sweep = (((vis(tb) - vis(ta)) % 360) + 360) % 360;
      if (tb - ta > 0.04 && sweep > 3 && sweep < 359) arcArrow(E, q, vis(ta), sweep, th, 'connector', E.P.arrow(i));
    });
  };
  // meegroeiend tekstvak in een taartpunt (a1 tot a2 graden, hoogstens 180°) van een cirkel met straal R in een vak van 2R:
  // voor tekst van hoogte th het breedste vak langs de middellijn van de punt
  const wfSlice = (R, a1, a2) => {
    const m = ((a1 + a2) / 2) * RAD, cm = Math.cos(m), sm = Math.sin(m), mg = R * 0.025;
    const c1 = Math.cos(a1 * RAD), s1 = Math.sin(a1 * RAD), c2 = Math.cos(a2 * RAD), s2 = Math.sin(a2 * RAD);
    const inside = (x, y) => Math.hypot(x, y) <= R * 0.97 && c1 * y - s1 * x >= mg && s2 * x - c2 * y >= mg;
    return (th) => {
      let best = null;
      for (const f of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
        const px = R * f * cm, py = R * f * sm;
        const w = search(0, R * 2, (ww) => inside(px - ww / 2, py - th / 2) && inside(px + ww / 2, py - th / 2) && inside(px - ww / 2, py + th / 2) && inside(px + ww / 2, py + th / 2), 12);
        if (w > 0 && (!best || w > best.w)) best = { x: R + px - w / 2, y: R + py - th / 2, w };
      }
      return best;
    };
  };
  L.basicCycle = (E) => {
    // ronde knopen in een kring met pijlen ertussen
    const n = E.n, q = ring(E, n, 1, 1.5, { round: true, inner: n === 2 ? (z) => z.bh * 0.4 : null });
    if (n > 1) q.pts.forEach((p, i) => {
      const nx = q.pts[(i + 1) % n];
      let a2 = nx.a;
      while (a2 <= p.a) a2 += 2 * Math.PI;
      const am = (p.a + a2) / 2, mx = q.cx + q.rx * Math.cos(am), my = q.cy + q.ry * Math.sin(am);
      const len = Math.min((Math.hypot(nx.x - p.x, nx.y - p.y) - q.bw) * 0.6, q.bw * 0.5), hh = len * 0.75;
      if (len < 3) return;
      const rot = Math.atan2(q.ry * Math.cos(am), -q.rx * Math.sin(am)) / RAD;
      conn(E, 'rightArrow', mx - len / 2, my - hh / 2, len, hh, E.P.arrow(i), { rot: r2(rot), adj: { adj1: 60000, adj2: 50000 } });
    });
    E.roots.forEach((it, i) => node(E, it, q.pts[i].x - q.bw / 2, q.pts[i].y - q.bh / 2, q.bw, q.bh, { geom: 'ellipse', kids: true, wf: wfEll(q.bw, q.bh) }));
  };
  L.textCycle = (E) => {
    // alleen tekst in een kring, gebogen pijlen ertussen
    const n = E.n, q = ring(E, n, 0.5, 1.25, { one: 0.75, inner: n === 2 ? (z) => z.bh * 0.9 : null });
    arcs(E, q, 0.07);
    E.roots.forEach((it, i) => node(E, it, q.pts[i].x - q.bw / 2, q.pts[i].y - q.bh / 2, q.bw, q.bh, { st: E.P.text(), kids: true }));
  };
  L.segmentedCycle = (E) => {
    // cirkel in taartpunten; elke punt is een item
    const n = E.n, R0 = Math.min(E.W, E.H) / 2, cx = E.X + E.W / 2, cy = E.Y + E.H / 2;
    if (n === 1) { node(E, E.roots[0], cx - R0, cy - R0, 2 * R0, 2 * R0, { geom: 'ellipse', kids: true, wf: wfEll(2 * R0, 2 * R0) }); return; }
    const ex = R0 * 0.03, R = R0 - ex, step = 360 / n;
    E.roots.forEach((it, i) => {
      const a1 = -90 + i * step, m = (a1 + step / 2) * RAD, x = cx - R + Math.cos(m) * ex, y = cy - R + Math.sin(m) * ex;
      node(E, it, x, y, 2 * R, 2 * R, { geom: 'pie', adj: { adj1: ang(a1), adj2: ang(a1 + step) }, kids: true, wf: wfSlice(R, a1, a1 + step) });
    });
  };
  L.basicRadial = (E) => {
    // middelpunt (eerste item) met de subitems eromheen, verbonden met lijnen
    const c = E.roots[0], sat = c.ch.concat(E.roots.slice(1)), k = sat.length, cf = 1.2;
    let cx = E.X + E.W / 2, cy = E.Y + E.H / 2, q, cd;
    if (!k) { const d = Math.min(E.W, E.H) * 0.6; node(E, c, cx - d / 2, cy - d / 2, d, d, { geom: 'ellipse', wf: wfEll(d, d) }); return; }
    if (k === 1) {
      // middelpunt en één satelliet naast (of onder) elkaar
      const v = E.H > E.W, A = v ? E.H : E.W, B = v ? E.W : E.H, s = Math.min(A / (cf + 1.6), B / cf), a0 = (A - s * (cf + 1.6)) / 2;
      cd = s * cf;
      const ca = a0 + cd / 2, sa = a0 + cd + s * 1.1;
      cx = E.X + (v ? B / 2 : ca); cy = E.Y + (v ? ca : B / 2);
      q = { bw: s, bh: s, pts: [{ x: E.X + (v ? B / 2 : sa), y: E.Y + (v ? sa : B / 2) }] };
    } else {
      q = ring(E, k, 1, 1.1, { round: true, inner: (z) => z.bw * (cf / 2 + 0.5 + 0.22) });
      cd = q.bw * cf;
    }
    q.pts.forEach((p, i) => {
      const dx = p.x - cx, dy = p.y - cy, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
      seg(E, cx + ux * cd / 2, cy + uy * cd / 2, p.x - ux * q.bw / 2, p.y - uy * q.bw / 2, E.P.stroke(i + 1, 1.5));
    });
    node(E, c, cx - cd / 2, cy - cd / 2, cd, cd, { geom: 'ellipse', wf: wfEll(cd, cd) });
    sat.forEach((it, i) => node(E, it, q.pts[i].x - q.bw / 2, q.pts[i].y - q.bh / 2, q.bw, q.bh, { geom: 'ellipse', kids: true, ci: i + 1, wf: wfEll(q.bw, q.bh), _k: 's' }));
  };
  L.continuousCycle = (E) => {
    // een doorlopende ringpijl met de knopen erop
    const n = E.n, ar = 0.55, q = ring(E, n, ar, 1.12, { one: 0.45 });
    if (n === 1) { const R = Math.min(E.W, E.H) / 2; q.rx = q.ry = R * 0.84; q.bw = Math.min(q.bw, (R * 1.3) / Math.hypot(1, ar)); q.bh = q.bw * ar; }
    const rm = Math.min(q.rx, q.ry), th = clamp(rm * 0.14, 2, q.bh * 0.42);
    if (rm > 6) arcArrow(E, q, -90 + 12, 360 - 30, th, 'deco', E.P.deco(0));
    E.roots.forEach((it, i) => node(E, it, q.pts[i].x - q.bw / 2, q.pts[i].y - q.bh / 2, q.bw, q.bh, { geom: 'roundRect', kids: true, opaque: true }));
  };
  L.blockCycle = (E) => {
    // blokken in een kring met gebogen pijlen ertussen
    const n = E.n, q = ring(E, n, 0.6, 1.42, { inner: n === 2 ? (z) => z.bh * 0.9 : null });
    arcs(E, q, 0.1);
    E.roots.forEach((it, i) => node(E, it, q.pts[i].x - q.bw / 2, q.pts[i].y - q.bh / 2, q.bw, q.bh, { geom: 'roundRect', kids: true }));
  };

  /* =========================================================
     Hiërarchie
     ========================================================= */
  // boom in eenheden: b = dwars (knoop is 1 breed), d = diepte (knoop is nd diep); sg = ruimte tussen broers,
  // lg = ruimte tussen niveaus. o.asst: assistenten naast de stam; o.hang: bladkinderen in twee kolommen; o.elbow: haakse lijnen
  const tidy = (roots, nd, sg, lg, o) => {
    const row = nd + lg, nodes = [], lines = [];
    const isA = (c) => !!(o.asst && c.asst && !c.ch.length);
    const regs = (n) => n.ch.filter((c) => !isA(c)), asts = (n) => n.ch.filter(isA);
    const meas = (n) => {
      const rs = regs(n), as = asts(n);
      rs.forEach(meas);
      n._hang = !!(o.hang && rs.length > 1 && !as.length && rs.every((c) => !c.ch.length));
      const cw = n._hang ? 2 + sg * 1.5 : rs.reduce((s, c) => s + c._sw, 0) + sg * Math.max(0, rs.length - 1);
      n._sw = Math.max(1, cw, as.length ? 2 + sg * 2 : 0);
    };
    const place = (n, b0, d, depth) => {
      const rs = regs(n), as = asts(n), tb = b0 + n._sw / 2;
      nodes.push({ n, b: tb - 0.5, d, depth });
      let cd = d + row, end = -Infinity;
      as.forEach((a, k) => {
        const ad = d + row * (Math.floor(k / 2) + 1), left = k % 2 === 0, ab = left ? tb - 1 - sg * 0.6 : tb + sg * 0.6;
        nodes.push({ n: a, b: ab, d: ad, depth: depth + 1 });
        lines.push([tb, ad + nd / 2, left ? ab + 1 : ab, ad + nd / 2]);
        end = Math.max(end, ad + nd / 2);
      });
      if (as.length) cd += row * Math.ceil(as.length / 2);
      if (n._hang) {
        rs.forEach((c, k) => {
          const left = k % 2 === 0, cb = left ? tb - 1 - sg * 0.75 : tb + sg * 0.75, ccd = cd + Math.floor(k / 2) * (nd + lg * 0.6);
          nodes.push({ n: c, b: cb, d: ccd, depth: depth + 1 });
          lines.push([tb, ccd + nd / 2, left ? cb + 1 : cb, ccd + nd / 2]);
          end = Math.max(end, ccd + nd / 2);
        });
      } else if (rs.length) {
        const cw = rs.reduce((s, c) => s + c._sw, 0) + sg * (rs.length - 1), bus = cd - lg / 2, mids = [];
        let b = b0 + (n._sw - cw) / 2;
        rs.forEach((c) => { place(c, b, cd, depth + 1); mids.push(b + c._sw / 2); b += c._sw + sg; });
        if (o.elbow) {
          end = Math.max(end, bus);
          lines.push([Math.min(tb, ...mids), bus, Math.max(tb, ...mids), bus]);
          mids.forEach((m) => lines.push([m, bus, m, cd]));
        } else mids.forEach((m) => lines.push([tb, d + nd, m, cd]));
      }
      if (end > d + nd) lines.push([tb, d + nd, tb, end]);
    };
    let b = 0;
    roots.forEach((r) => { meas(r); place(r, b, 0, 0); b += r._sw + sg * 1.5; });
    const bw = Math.max(1, b - sg * 1.5), dw = nodes.reduce((m, q) => Math.max(m, q.d + nd), nd);
    return { nodes, lines: lines.filter((l) => Math.abs(l[2] - l[0]) + Math.abs(l[3] - l[1]) > 1e-6), bw, dw };
  };
  // boom tekenen: o.horiz = van links naar rechts
  const treeLayout = (E, o) => {
    const ar = o.horiz ? 0.5 : 0.6, nd = o.horiz ? 1 / ar : ar, sg = o.horiz ? 0.22 : 0.18, lg = o.horiz ? 0.55 : 0.4;
    const AB = o.horiz ? E.H : E.W, AD = o.horiz ? E.W : E.H, cap = Math.min(AB, AD / nd) * 0.42;
    // elke boom apart; meerdere bomen (hoofditems) eventueel over rijen verdeeld als dat grotere knopen geeft
    const run = (hang) => {
      const trees = E.roots.map((r) => tidy([r], nd, sg, lg, { asst: o.asst, hang, elbow: o.elbow })), tg = sg * 1.5, rg = lg * 1.5;
      const tot = trees.reduce((s, t) => s + t.bw, 0) + tg * (trees.length - 1);
      let best = null;
      for (let R = 1; R <= trees.length; R++) {
        const rows = [[]];
        let wsum = 0;
        trees.forEach((t) => {
          if (rows[rows.length - 1].length && wsum + t.bw > (tot / R) * 1.02 && rows.length < R) { rows.push([]); wsum = 0; }
          rows[rows.length - 1].push(t); wsum += t.bw + tg;
        });
        const rw = rows.map((r) => r.reduce((s, t) => s + t.bw, 0) + tg * (r.length - 1)), rh = rows.map((r) => Math.max(...r.map((t) => t.dw)));
        const bw = Math.max(...rw), dw = rh.reduce((a, b) => a + b, 0) + rg * (rows.length - 1), s = Math.min(AB / bw, AD / dw, cap);
        if (!best || s > best.s * 1.0001) best = { s, rows, rw, rh, dw, tg, rg };
      }
      return best;
    };
    const A = run(false), B = o.hang ? run(true) : null, R = B && B.s > A.s * 1.08 ? B : A, s = R.s;
    let d0 = (AD - R.dw * s) / 2;
    R.rows.forEach((row, ri) => {
      let b0 = (AB - R.rw[ri] * s) / 2;
      row.forEach((t) => {
        const bb = b0, at = (b, d) => (o.horiz ? [E.X + d0 + d * s, E.Y + bb + b * s] : [E.X + bb + b * s, E.Y + d0 + d * s]);
        t.lines.forEach((l) => { const p = at(l[0], l[1]), q = at(l[2], l[3]); seg(E, p[0], p[1], q[0], q[1], E.P.stroke(0, 1.25)); });
        t.nodes.forEach((q) => {
          const p = at(q.b, q.d);
          node(E, q.n, p[0], p[1], o.horiz ? nd * s : s, o.horiz ? s : nd * s, { geom: o.geom, ci: q.depth, _k: 'n' + q.depth });
        });
        b0 += (t.bw + R.tg) * s;
      });
      d0 += (R.rh[ri] + R.rg) * s;
    });
  };
  L.orgChart = (E) => treeLayout(E, { geom: 'rect', asst: true, elbow: true, hang: true });
  L.hierarchy = (E) => treeLayout(E, { geom: 'roundRect', hang: true });
  L.horizontalHierarchy = (E) => treeLayout(E, { geom: 'roundRect', elbow: true, horiz: true });
  L.hierarchyList = (E) => {
    // per hoofditem een kolom: kop bovenaan, onderliggende items ingesprongen eronder, met lijnen
    const mr = Math.max(0, ...E.roots.map((it) => it.kids.length));
    // aantal kolommen: zo dat de vakken (eenheid u) zo groot mogelijk worden
    let bc = 1, bu = 0;
    for (let c = 1; c <= E.n; c++) {
      const r = Math.ceil(E.n / c), cw = E.W / (c + 0.1 * (c - 1)), u = Math.min((E.H - 0.1 * cw * (r - 1)) / r / (1 + mr), cw * 0.45);
      if (u > bu * 1.02) { bu = u; bc = c; }
    }
    const g = grid(E, E.n, 0.2, 20, 0.1, 0.1, { cols: bc }), u = Math.min(g.ch / (1 + mr), g.cw * 0.45), ind = Math.min(g.cw * 0.12, u * 0.7);
    E.roots.forEach((it, i) => {
      const c = g.cell(i), rows = [], pos = new Map();
      const walk = (n, d) => n.ch.forEach((k) => { rows.push({ k, d }); walk(k, d + 1); });
      walk(it, 1);
      pos.set(it, { x: c.x, y: c.y, w: g.cw, h: u });
      rows.forEach((r, j) => pos.set(r.k, { x: c.x + ind * r.d, y: c.y + u * (1.25 + j), w: g.cw - ind * r.d, h: u * 0.75 }));
      [it].concat(rows.map((r) => r.k)).forEach((p) => {
        if (!p.ch.length) return;
        const pp = pos.get(p), tx = pp.x + ind * 0.5, last = pos.get(p.ch[p.ch.length - 1]), st = E.P.stroke(it.ix, 1);
        seg(E, tx, pp.y + pp.h, tx, last.y + last.h / 2, st);
        p.ch.forEach((k) => { const kp = pos.get(k); seg(E, tx, kp.y + kp.h / 2, kp.x, kp.y + kp.h / 2, st); });
      });
      node(E, it, c.x, c.y, g.cw, u, { geom: 'roundRect' });
      rows.forEach((r) => { const p = pos.get(r.k); node(E, r.k, p.x, p.y, p.w, p.h, { geom: 'roundRect', st: E.P.tint(it.ix, r.d === 1 ? 40 : 60) }); });
    });
  };

  /* =========================================================
     Relatie
     ========================================================= */
  L.basicVenn = (E) => {
    // overlappende cirkels rond het midden; tekst in het deel dat niet overlapt
    const n = E.n, k = n === 1 ? 0 : 0.36 / Math.sin(Math.PI / n), a0 = n === 2 ? 180 : -90;
    const u = E.roots.map((_, i) => { const a = (a0 + (i * 360) / n) * RAD; return [k * Math.cos(a), k * Math.sin(a), a]; });
    const xs = u.map((p) => p[0]), ys = u.map((p) => p[1]), mx = Math.min(...xs), my = Math.min(...ys);
    const sx = Math.max(...xs) - mx + 1, sy = Math.max(...ys) - my + 1, d = Math.min(E.W / sx, E.H / sy);
    const ox = E.X + (E.W - sx * d) / 2 + (0.5 - mx) * d, oy = E.Y + (E.H - sy * d) / 2 + (0.5 - my) * d;
    E.roots.forEach((it, i) => {
      const cx = ox + u[i][0] * d, cy = oy + u[i][1] * d, a = u[i][2], off = n === 1 ? 0 : d * 0.2;
      const tw = d * (n === 1 ? 0.7 : n <= 3 ? 0.5 : 0.42), th = d * (n === 1 ? 0.6 : 0.36);
      const l = d / 2 + Math.cos(a) * off - tw / 2, t = d / 2 + Math.sin(a) * off - th / 2;
      node(E, it, cx - d / 2, cy - d / 2, d, d, { geom: 'ellipse', st: E.P.alpha(it.ix), kids: true, ti: { l, t, r: d - l - tw, b: d - t - th } });
    });
  };
  L.linearVenn = (E) => {
    // cirkels op een rij die elkaar overlappen
    const n = E.n, v = E.H > E.W * 1.1, A = v ? E.H : E.W, B = v ? E.W : E.H, st = 0.72;
    const d = Math.min(B, A / (1 + st * (n - 1))), tot = d * (1 + st * (n - 1)), ov = n > 1 ? d * 0.2 : d * 0.15, sd = d * 0.15;
    E.roots.forEach((it, i) => {
      const a = (A - tot) / 2 + i * st * d, b = (B - d) / 2;
      node(E, it, E.X + (v ? b : a), E.Y + (v ? a : b), d, d, { geom: 'ellipse', st: E.P.alpha(it.ix), kids: true, ti: v ? { l: sd, r: sd, t: ov, b: ov } : { l: ov, r: ov, t: sd, b: sd } });
    });
  };
  L.stackedVenn = (E) => {
    // cirkels in elkaar, onderaan gelijk; tekst bovenin elke ring
    const n = E.n, D0 = Math.min(E.W, E.H), cx = E.X + E.W / 2, bot = E.Y + (E.H + D0) / 2;
    const dia = (i) => (D0 * (n - i + 0.6)) / (n + 0.6);
    E.roots.forEach((it, i) => {
      const d = dia(i), r = d / 2;
      const o = { geom: 'ellipse', st: E.P.alpha(it.ix), kids: true, wf: wfEll(d, d) };
      if (i < n - 1) { const band = d - dia(i + 1), t1 = band / 3, cw = 2 * Math.sqrt(t1 * (2 * r - t1)) * 0.94; o.ti = { l: r - cw / 2, r: r - cw / 2, t: t1, b: d - band }; delete o.wf; }
      node(E, it, cx - r, bot - d, d, d, o);
    });
  };
  L.balance = (E) => {
    // wip: twee koppen bovenaan, subitems als blokken op de uiteinden; de zwaarste kant zakt
    const R = E.roots, side = [[], []];
    R.forEach((it, i) => { if (i < 2) side[i].push(...it.kids); else side[i % 2].push({ id: it.id, text: it.text, lvl: it.lvl, d: 1 }, ...it.kids); });
    const W = E.W, H = E.H, cx = E.X + W / 2, hw = W * 0.4, hh = Math.min(H * 0.17, hw * 0.4);
    R.slice(0, 2).forEach((it, i) => node(E, it, i ? E.X + W - hw : E.X, E.Y, hw, hh, { geom: 'roundRect' }));
    const ft = Math.min(W, H) * 0.16, fy = E.Y + H - ft, bl = W * 0.84, bt = clamp(H * 0.025, 2, 10), by = fy - bt / 2;
    const rmax = Math.asin(clamp((ft * 0.85) / (bl / 2), 0, 1)) / RAD, rot = clamp((side[1].length - side[0].length) * 4, -Math.min(12, rmax), Math.min(12, rmax));
    deco(E, 'triangle', cx - ft * 0.6, fy, ft * 1.2, ft, E.P.solid(0));
    deco(E, 'rect', cx - bl / 2, by - bt / 2, bl, bt, E.P.solid(0), { rot: r2(rot) });
    const bw = W * 0.3, tn = Math.tan(rot * RAD), ex = [cx - bl / 2 + bw / 2 + W * 0.02, cx + bl / 2 - bw / 2 - W * 0.02];
    const top = ex.map((x) => Math.min(by + tn * (x - bw / 2 - cx), by + tn * (x + bw / 2 - cx)) - bt / 2 - bt * 0.6 - (bw / 2) * Math.abs(Math.sin(rot * RAD)) * 0.1);
    const mxk = Math.max(1, side[0].length, side[1].length), gp = H * 0.015;
    const bh = Math.max(1, Math.min(...top.map((t) => (t - (E.Y + hh + gp * 2) - gp * (mxk - 1)) / mxk), bw * 0.4));
    side.forEach((ks, s) => ks.forEach((k, j) => kidNode(E, k, ex[s] - bw / 2, top[s] - (j + 1) * bh - j * gp, bw, bh, E.P.tint(s, 30), { geom: 'roundRect' })));
  };
  L.convergingRadial = (E) => {
    // subitems in een boog boven het middelpunt; pijlen wijzen naar het midden
    const c = E.roots[0], sat = c.ch.concat(E.roots.slice(1)), k = sat.length, ar = 0.6, cf = 1.2, cx = E.X + E.W / 2;
    if (!k) { const d = Math.min(E.W, E.H) * 0.6; node(E, c, cx - d / 2, E.Y + (E.H - d) / 2, d, d, { geom: 'ellipse', wf: wfEll(d, d) }); return; }
    const spread = k === 1 ? 0 : Math.min(160, 40 * (k - 1)), angs = sat.map((_, i) => (k === 1 ? -90 : -90 - spread / 2 + (spread * i) / (k - 1)) * RAD);
    const mc = Math.max(0.05, ...angs.map((a) => Math.abs(Math.cos(a))));
    const edge = (ux, uy, w, h) => Math.min(Math.abs(ux) > 1e-9 ? w / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? h / 2 / Math.abs(uy) : Infinity);
    const geo = (s) => {
      const bh = s * ar, cd = s * cf, rx0 = (E.W - s) / 2 / mc, ry = Math.min(E.H - cd / 2 - bh / 2, Math.max(rx0, s * 2) * 1.25), rx = Math.min(rx0, ry * 2.2);
      const cy = E.Y + (E.H - ry - bh / 2 - cd / 2) / 2 + ry + bh / 2;
      return { s, bh, cd, cy, rx, ry, pts: angs.map((a) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })) };
    };
    const ok = (s) => {
      const q = geo(s);
      if (q.ry <= 0 || q.rx < 0) return false;
      for (const p of q.pts) {
        const dx = p.x - cx, dy = p.y - q.cy, dl = Math.hypot(dx, dy) || 1;
        if (dl - q.cd / 2 - edge(dx / dl, dy / dl, s, q.bh) < s * 0.55) return false;
        if (p.y + q.bh / 2 > E.Y + E.H + 0.5) return false;
      }
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (Math.abs(q.pts[i].x - q.pts[j].x) < s * 1.08 && Math.abs(q.pts[i].y - q.pts[j].y) < q.bh * 1.08) return false;
      return true;
    };
    const q = geo(search(2, Math.min(E.W, E.H), ok));
    q.pts.forEach((p, i) => {
      const dx = p.x - cx, dy = p.y - q.cy, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
      const a = q.cd / 2 + q.s * 0.08, b = dl - edge(ux, uy, q.s, q.bh) - q.s * 0.08, len = (b - a) * 0.8, hh = Math.min(len * 0.6, q.s * 0.3);
      if (len < 3) return;
      const m = (a + b) / 2, mx = cx + ux * m, my = q.cy + uy * m;
      conn(E, 'rightArrow', mx - len / 2, my - hh / 2, len, hh, E.P.arrow(i + 1), { rot: r2(Math.atan2(-uy, -ux) / RAD), adj: { adj1: 60000, adj2: 50000 } });
    });
    node(E, c, cx - q.cd / 2, q.cy - q.cd / 2, q.cd, q.cd, { geom: 'ellipse', wf: wfEll(q.cd, q.cd) });
    sat.forEach((it, i) => node(E, it, q.pts[i].x - q.s / 2, q.pts[i].y - q.bh / 2, q.s, q.bh, { geom: 'roundRect', kids: true, ci: i + 1, _k: 's' }));
  };
  L.basicTarget = (E) => {
    // ringen om hetzelfde midden; tekst bovenin elke ring
    const n = E.n, D0 = Math.min(E.W, E.H), cx = E.X + E.W / 2, cy = E.Y + E.H / 2, band = D0 / (2 * n);
    E.roots.forEach((it, i) => {
      const d = (D0 * (n - i)) / n, r = d / 2;
      const st = E.P.multi ? E.P.node(it.ix) : E.P.tint(it.ix, n > 1 ? (60 * i) / (n - 1) : 0), o = { geom: 'ellipse', st, kids: true, wf: wfEll(d, d) };
      if (i < n - 1) { const t1 = band / 3, cw = 2 * Math.sqrt(t1 * (2 * r - t1)) * 0.94; o.ti = { l: r - cw / 2, r: r - cw / 2, t: t1, b: d - band }; delete o.wf; }
      node(E, it, cx - r, cy - r, d, d, o);
    });
  };
  L.opposingArrows = (E) => {
    // twee tegengestelde pijlen in het midden, de tekst ernaast
    const R = E.roots, ns = Math.min(2, R.length), v = E.H > E.W * 1.2;
    const sides = R.slice(0, ns).map((it) => Object.assign({}, it, { kids: it.kids.slice() }));
    R.slice(2).forEach((it, i) => sides[i % 2].kids.push({ id: it.id, text: it.text, lvl: it.lvl, d: 1 }, ...it.kids));
    const A = v ? E.H : E.W, B = v ? E.W : E.H, aw = Math.min(A * 0.13, B * 0.32), gap = aw * 0.25, mid = A / 2;
    const box = (a, b, la, lb) => (v ? [E.X + b, E.Y + a, lb, la] : [E.X + a, E.Y + b, la, lb]);
    sides.forEach((it, s) => {
      const a = s ? mid + gap / 2 : mid - gap / 2 - aw, geom = v ? (s ? 'leftArrow' : 'rightArrow') : s ? 'downArrow' : 'upArrow';
      deco(E, geom, ...box(a, 0, aw, B), E.P.solid(it.ix), { itemId: it.id, adj: { adj1: 50000, adj2: 90000 } });
      const ta = s ? a + aw + gap : 0, tl = s ? A - ta : a - gap;
      node(E, it, ...box(ta, 0, tl, B), { st: E.P.text(), kids: true });
    });
  };

  /* =========================================================
     Matrix
     ========================================================= */
  // tekstgebied in vak c dat gat h vermijdt: de grootste vrije strook (als inspringing t.o.v. c)
  const freeRect = (c, h) => {
    const ix = Math.max(c.x, h.x), iy = Math.max(c.y, h.y), ix2 = Math.min(c.x + c.w, h.x + h.w), iy2 = Math.min(c.y + c.h, h.y + h.h);
    if (ix >= ix2 || iy >= iy2) return {};
    const opts = [
      { a: (h.x - c.x) * c.h, ti: { r: c.x + c.w - h.x } }, { a: (c.x + c.w - h.x - h.w) * c.h, ti: { l: h.x + h.w - c.x } },
      { a: (h.y - c.y) * c.w, ti: { b: c.y + c.h - h.y } }, { a: (c.y + c.h - h.y - h.h) * c.w, ti: { t: h.y + h.h - c.y } },
    ];
    opts[2].a *= 1.35; opts[3].a *= 1.35;
    return opts.reduce((m, o) => (o.a > m.a ? o : m)).ti;
  };
  // vakken van een 2×2-matrix voor 1 tot 4 items (delen van het vlak: x, y, b, h)
  const QUADS = { 1: [[0, 0, 1, 1]], 2: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]], 3: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1, 0.5]], 4: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] };
  L.basicMatrix = (E) => {
    const n = E.n, g = grid(E, n, 0.62, 1, 0.04, 0.04, { cols: n <= 4 ? Math.min(n, 2) : 0 });
    E.roots.forEach((it, i) => { const c = g.cell(i); node(E, it, c.x, c.y, g.cw, g.ch, { kids: true }); });
  };
  L.titledMatrix = (E) => {
    // titel (eerste item) in het midden, de subitems als kwadranten eromheen
    const t = E.roots[0], qs = t.ch.concat(E.roots.slice(1)), k = qs.length;
    if (k > 4) {
      // veel kwadranten: titel als balk boven een raster
      const th = Math.min(E.H * 0.2, E.W * 0.15), gp = th * 0.2, E2 = Object.assign({}, E, { Y: E.Y + th + gp, H: E.H - th - gp });
      node(E, t, E.X, E.Y, E.W, th, { geom: 'roundRect', st: E.P.light(0) });
      const g = grid(E2, k, 0.5, 1.2, 0.04);
      qs.forEach((it, i) => { const c = g.cell(i); node(E, it, c.x, c.y, g.cw, g.ch, { kids: true, ci: i + 1, _k: 's' }); });
      return;
    }
    const mw = Math.min(E.W, E.H * 1.6), mh = Math.min(E.H, E.W * 1.6), x0 = E.X + (E.W - mw) / 2, y0 = E.Y + (E.H - mh) / 2, gp = Math.min(mw, mh) * 0.02;
    const tw = k ? mw * 0.44 : mw, th = k ? mh * 0.3 : mh, hole = { x: x0 + (mw - tw) / 2, y: y0 + (mh - th) / 2, w: tw, h: th };
    (QUADS[k] || []).forEach(([fx, fy, fw, fh], i) => {
      const c = { x: x0 + fx * mw + gp / 2, y: y0 + fy * mh + gp / 2, w: fw * mw - gp, h: fh * mh - gp };
      node(E, qs[i], c.x, c.y, c.w, c.h, { kids: true, ci: i + 1, _k: 's', ti: freeRect(c, hole) });
    });
    node(E, t, hole.x, hole.y, hole.w, hole.h, { geom: 'roundRect', st: E.P.light(0), _k: 'n0', opaque: true });
  };
  L.gridMatrix = (E) => {
    // assen door het midden met de items in de vakken ertussen
    const n = E.n;
    if (n > 4) { const g = grid(E, n, 0.5, 1, 0.06); E.roots.forEach((it, i) => { const c = g.cell(i); node(E, it, c.x, c.y, g.cw, g.ch, { geom: 'roundRect', kids: true }); }); return; }
    const mw = Math.min(E.W, E.H * 1.6), mh = Math.min(E.H, E.W * 1.6), cx = E.X + E.W / 2, cy = E.Y + E.H / 2, ah = Math.min(mw, mh) * 0.1, g = ah * 0.75;
    const st = E.P.deco(0), adj = { adj1: 40000, adj2: 50000 };
    deco(E, 'leftRightArrow', cx - mw / 2, cy - ah / 2, mw, ah, st, { adj });
    deco(E, 'upDownArrow', cx - ah / 2, cy - mh / 2, ah, mh, st, { adj });
    const cw = mw / 2 - g, ch = mh / 2 - g, pos = [[cx - g - cw, cy - g - ch], [cx + g, cy - g - ch], [cx - g - cw, cy + g], [cx + g, cy + g]];
    E.roots.forEach((it, i) => node(E, it, pos[i][0], pos[i][1], cw, ch, { geom: 'roundRect', kids: true }));
  };
  L.cycleMatrix = (E) => {
    // taartpunten in het midden (de items), lichte vakken eromheen met de subitems
    const n = E.n, cx = E.X + E.W / 2, cy = E.Y + E.H / 2;
    let R;
    E.free = true;
    if (n <= 4) {
      const sw = Math.min(E.W, E.H * 1.5), sh = Math.min(E.H, E.W * 1.5), x0 = cx - sw / 2, y0 = cy - sh / 2, gp = Math.min(sw, sh) * 0.02;
      R = Math.min(sw, sh) * 0.4;
      const hole = { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R };
      QUADS[n].forEach(([fx, fy, fw, fh], i) => {
        const it = E.roots[n === 4 ? [0, 1, 3, 2][i] : i], c = { x: x0 + fx * sw + gp / 2, y: y0 + fy * sh + gp / 2, w: fw * sw - gp, h: fh * sh - gp };
        if (it.kids.length) kidBox(E, it, c.x, c.y, c.w, c.h, { geom: 'roundRect', ti: freeRect(c, hole), vAlign: 'ctr' });
        else deco(E, 'roundRect', c.x, c.y, c.w, c.h, E.P.light(it.ix), { itemId: it.id });
      });
    } else {
      // meer dan vier: vakken in een kring om de cirkel
      const mn = Math.min(E.W, E.H), q = ring(E, n, 0.6, 1.1, { inner: (z) => Math.hypot(z.bw, z.bh) / 2 + mn * 0.2 });
      R = Math.max(mn * 0.08, Math.min(q.rx, q.ry) - Math.hypot(q.bw, q.bh) / 2 - mn * 0.02);
      E.roots.forEach((it, i) => {
        const p = q.pts[i];
        if (it.kids.length) kidBox(E, it, p.x - q.bw / 2, p.y - q.bh / 2, q.bw, q.bh, { geom: 'roundRect', vAlign: 'ctr' });
        else deco(E, 'roundRect', p.x - q.bw / 2, p.y - q.bh / 2, q.bw, q.bh, E.P.light(it.ix), { itemId: it.id });
      });
    }
    if (n === 1) { node(E, E.roots[0], cx - R, cy - R, 2 * R, 2 * R, { geom: 'ellipse', wf: wfEll(2 * R, 2 * R), opaque: true }); return; }
    const a0 = n === 2 ? 90 : n <= 4 ? 180 : -90 - 180 / n, step = 360 / n, ex = R * 0.04, Rp = R - ex;
    E.roots.forEach((it, i) => {
      const a1 = a0 + i * step, m = (a1 + step / 2) * RAD;
      node(E, it, cx - Rp + Math.cos(m) * ex, cy - Rp + Math.sin(m) * ex, 2 * Rp, 2 * Rp, { geom: 'pie', adj: { adj1: ang(a1), adj2: ang(a1 + step) }, wf: wfSlice(Rp, a1, a1 + step), opaque: true });
    });
  };

  /* =========================================================
     Piramide
     ========================================================= */
  const pyramid = (E, inv) => {
    const n = E.n, pw = Math.min(E.W, E.H * 2.6), ph = Math.min(E.H, pw / 0.9), cx = E.X + E.W / 2, y0 = E.Y + (E.H - ph) / 2;
    const gp = ph * 0.015, hb = (ph - gp * (n - 1)) / n;
    E.roots.forEach((it, i) => {
      const yt = i * (hb + gp), w1 = (pw * (inv ? ph - yt : yt)) / ph, w2 = (pw * (inv ? ph - yt - hb : yt + hb)) / ph;
      const ww = Math.max(w1, w2), nw = Math.min(w1, w2), tri = nw < 0.5;
      const o = { geom: tri ? 'triangle' : 'trapezoid', flipV: inv, kids: true, wf: wfBand(nw, ww, hb, inv) };
      if (!tri) o.adj = { adj: pct((ww - nw) / 2 / Math.min(ww, hb)) };
      node(E, it, cx - ww / 2, y0 + yt, ww, hb, o);
    });
  };
  L.basicPyramid = (E) => pyramid(E, false);
  L.invertedPyramid = (E) => pyramid(E, true);
  L.segmentedPyramid = (E) => {
    // driehoek opgedeeld in kleinere driehoeken (rij r heeft 2r + 1 stukken), gevuld van boven naar beneden
    const n = E.n, k = Math.ceil(Math.sqrt(n)), pw = Math.min(E.W, E.H / 0.87), ph = pw * 0.87, cx = E.X + E.W / 2, y0 = E.Y + (E.H - ph) / 2;
    const wb = pw / k, hr = ph / k, f = 0.94;
    let idx = 0;
    for (let r = 0; r < k; r++) for (let j = 0; j <= 2 * r && idx < n; j++, idx++) {
      const up = j % 2 === 0, left = cx - ((r + 1) * wb) / 2, bx = left + (up ? j / 2 : (j - 1) / 2 + 0.5) * wb, by = y0 + r * hr;
      const gx = bx + wb / 2, gy = by + (up ? (2 * hr) / 3 : hr / 3), w = wb * f, h = hr * f, y = gy - (up ? (2 * h) / 3 : h / 3);
      node(E, E.roots[idx], gx - w / 2, y, w, h, { geom: 'triangle', flipV: !up, kids: true, wf: wfTri(w, h, !up) });
    }
  };
  L.pyramidList = (E) => {
    // driehoek op de achtergrond, de items als balken eroverheen
    const n = E.n, pw = Math.min(E.W / 1.12, E.H * 2), ph = Math.min(E.H, pw * 0.95), tx = E.X + (E.W - pw * 1.12) / 2, ty = E.Y + (E.H - ph) / 2;
    deco(E, 'triangle', tx, ty, pw, ph, E.P.solid(0));
    const sh = (ph * 0.86) / n, bh = sh * 0.78;
    E.roots.forEach((it, i) => node(E, it, tx + pw * 0.37, ty + ph * 0.14 + i * sh + (sh - bh) / 2, pw * 0.75, bh, { geom: 'roundRect', st: E.P.light(it.ix), kids: true, opaque: true }));
  };

  /* =========================================================
     Overzicht bewerken (SmartArt › Vorm toevoegen, Promoveren, Degraderen, Omhoog/Omlaag)
     ========================================================= */
  // geldig overzicht: eerste item niveau 0, nooit meer dan één niveau dieper dan het vorige; elk item een id
  const norm = (items) => {
    let prev = -1;
    return (Array.isArray(items) ? items : []).filter((it) => it && typeof it === 'object').map((it) => {
      const lvl = clamp(Math.floor(+it.lvl) || 0, 0, prev + 1);
      prev = lvl;
      const o = Object.assign({}, it, { lvl, text: it.text == null ? '' : String(it.text) });
      if (!o.id) o.id = D.uid();
      if (!o.asst) delete o.asst;
      return o;
    });
  };
  D.normalize = norm;
  const subEnd = (a, i) => { let j = i + 1; while (j < a.length && a[j].lvl > a[i].lvl) j++; return j; };
  const find = (a, id) => a.findIndex((it) => it.id === id);
  const shift = (a, i, dl) => { const e = subEnd(a, i); for (let k = i; k < e; k++) a[k].lvl += dl; };
  // mode: 'after' | 'before' | 'above' (nieuwe ouder) | 'below' (nieuw kind) | 'assistant'; out.newId = id van het nieuwe item
  D.addItem = (items, refId, mode = 'after') => {
    const a = norm(items), i = find(a, refId), it = { id: D.uid(), text: '', lvl: 0 };
    if (i < 0) a.push(it);
    else {
      const ref = a[i], e = subEnd(a, i);
      if (mode === 'before') { it.lvl = ref.lvl; if (ref.asst) it.asst = true; a.splice(i, 0, it); }
      else if (mode === 'below') { it.lvl = ref.lvl + 1; a.splice(e, 0, it); }
      else if (mode === 'assistant') {
        it.lvl = ref.lvl + 1; it.asst = true;
        let j = i + 1;
        while (j < e && a[j].lvl === ref.lvl + 1 && a[j].asst) j = subEnd(a, j);
        a.splice(j, 0, it);
      } else if (mode === 'above') {
        it.lvl = ref.lvl;
        if (ref.asst) { it.asst = true; delete ref.asst; }
        shift(a, i, 1);
        a.splice(i, 0, it);
      } else { it.lvl = ref.lvl; if (ref.asst) it.asst = true; a.splice(e, 0, it); }
    }
    const out = norm(a);
    out.newId = it.id;
    return out;
  };
  D.promote = (items, id) => { const a = norm(items), i = find(a, id); if (i >= 0 && a[i].lvl > 0) { shift(a, i, -1); delete a[i].asst; } return norm(a); };
  D.demote = (items, id) => { const a = norm(items), i = find(a, id); if (i > 0 && a[i - 1].lvl >= a[i].lvl) { shift(a, i, 1); delete a[i].asst; } return norm(a); };
  // dir < 0 of 'up' = omhoog; het item verwisselt met zijn broer, inclusief onderliggende items
  D.move = (items, id, dir) => {
    const a = norm(items), i = find(a, id);
    if (i < 0) return a;
    const up = dir === 'up' || +dir < 0, lv = a[i].lvl, e = subEnd(a, i);
    if (up) {
      let j = i - 1;
      while (j >= 0 && a[j].lvl > lv) j--;
      if (j < 0 || a[j].lvl !== lv) return a;
      a.splice(j, 0, ...a.splice(i, e - i));
    } else {
      if (e >= a.length || a[e].lvl !== lv) return a;
      a.splice(i, 0, ...a.splice(e, subEnd(a, e) - e));
    }
    return norm(a);
  };
  // "Converteren naar SmartArt": inspringniveau = niveau in het diagram; lege alinea's vallen weg
  D.fromParas = (paras) => {
    const rows = (Array.isArray(paras) ? paras : []).map((p) => ({ t: ((p && p.runs) || []).map((r) => (r && r.t) || '').join(''), lvl: Math.max(0, Math.floor(+(p && p.lvl)) || 0) })).filter((r) => r.t.trim());
    const base = rows.reduce((m, r) => Math.min(m, r.lvl), Infinity);
    return norm(rows.map((r) => ({ id: D.uid(), text: r.t, lvl: r.lvl - base })));
  };
  // "Converteren naar tekst": één alinea per item met opsommingsteken
  D.toParas = (items) => norm(items).map((it) => ({ runs: [{ t: it.text }], lvl: it.lvl, bullet: { type: 'char', char: '•' }, marL: 24 + it.lvl * 30, indent: -24 }));

  /* =========================================================
     Indelingen, kleuren en stijlen
     ========================================================= */
  D.CATS = [{ id: 'list', name: 'Lijst' }, { id: 'process', name: 'Proces' }, { id: 'cycle', name: 'Cyclus' }, { id: 'hierarchy', name: 'Hiërarchie' },
    { id: 'relationship', name: 'Relatie' }, { id: 'matrix', name: 'Matrix' }, { id: 'pyramid', name: 'Piramide' }];
  // id, naam, categorie, omschrijving, voorbeeld (niveau per item; a = assistent), ov = vormen overlappen bewust
  const DEF = [
    ['basicBlockList', 'Basisbloklijst', 'list', 'Toont niet-opeenvolgende of gegroepeerde informatie in blokken van gelijke grootte.', '00000'],
    ['verticalBulletList', 'Lijst met verticale opsommingstekens', 'list', 'Balken onder elkaar, met de subitems als opsommingstekens eronder.', '0101'],
    ['stackedList', 'Gestapelde lijst', 'list', 'Kolommen met een cirkel bovenop en de subitems in een hoog vak.', '011011'],
    ['horizontalBulletList', 'Horizontale lijst met opsommingstekens', 'list', 'Kolommen met een kop en de subitems als opsommingstekens eronder.', '011011011'],
    ['tabList', 'Lijst met tabbladen', 'list', 'Tabbladen op een lijn met de subitems ernaast.', '010101'],
    ['linedList', 'Lijst met accenten', 'list', 'Tekst met lijnen ertussen; subitems rechts van het hoofditem.', '011011'],
    ['groupingList', 'Gegroepeerde lijst', 'list', 'Groepen met een kop en de subitems als blokken in een groepsvlak.', '011011011'],
    ['trapezoidList', 'Trapeziumlijst', 'list', 'Gelijkwaardige items als trapezia naast elkaar.', '010101'],
    ['basicProcess', 'Basisproces', 'process', 'Stappen in een taak, proces of werkstroom met pijlen ertussen.', '000'],
    ['accentProcess', 'Accentproces', 'process', 'Stappen met een kop die over een vak met de subitems valt.', '010101'],
    ['basicChevronProcess', 'Proces met punthaken', 'process', 'Stappen als punthaken die in elkaar grijpen.', '000', 1],
    ['closedChevronProcess', 'Gesloten punthakenproces', 'process', 'Stappen als gesloten pijlvormen naast elkaar.', '000'],
    ['continuousArrowProcess', 'Doorlopende pijl', 'process', 'Stappen op één brede pijl: een tijdlijn of opeenvolging.', '000'],
    ['verticalProcess', 'Verticaal proces', 'process', 'Stappen van boven naar beneden met pijlen ertussen.', '000'],
    ['stepUpProcess', 'Stappen omhoog', 'process', 'Treden die oplopen: groei of vooruitgang in stappen.', '000'],
    ['basicTimeline', 'Proces met tijdlijn', 'process', 'Gebeurtenissen langs een tijdlijn, om en om boven en onder.', '00000'],
    ['basicBendingProcess', 'Gebogen proces', 'process', 'Stappen die als een slang heen en weer lopen.', '000000'],
    ['basicCycle', 'Basiscyclus', 'cycle', 'Fasen in een doorlopende kringloop.', '00000'],
    ['textCycle', 'Tekstcyclus', 'cycle', 'Alleen tekst in een kring, met gebogen pijlen ertussen.', '00000'],
    ['segmentedCycle', 'Gesegmenteerde cyclus', 'cycle', 'Delen van een geheel als taartpunten van een cirkel.', '000', 1],
    ['basicRadial', 'Radiale cyclus', 'cycle', 'Een middelpunt met de subitems eromheen.', '01111'],
    ['continuousCycle', 'Doorlopende cyclus', 'cycle', 'Fasen op één doorlopende ringpijl.', '00000'],
    ['blockCycle', 'Blokcyclus', 'cycle', 'Fasen als blokken in een kring met gebogen pijlen.', '00000'],
    ['orgChart', 'Organigram', 'hierarchy', 'Een organisatie met leidinggevenden, assistenten en medewerkers.', '0a111'],
    ['hierarchy', 'Hiërarchie', 'hierarchy', 'Een boom van boven naar beneden met rechte lijnen.', '012212'],
    ['horizontalHierarchy', 'Horizontale hiërarchie', 'hierarchy', 'Een boom van links naar rechts.', '012212'],
    ['hierarchyList', 'Hiërarchielijst', 'hierarchy', 'Kolommen met de onderliggende items ingesprongen eronder.', '011011'],
    ['basicVenn', 'Venndiagram', 'relationship', 'Overlappende cirkels: overeenkomsten en verbanden.', '000', 1],
    ['linearVenn', 'Lineair venndiagram', 'relationship', 'Overlappende cirkels op een rij.', '0000', 1],
    ['stackedVenn', 'Gestapeld venndiagram', 'relationship', 'Cirkels in elkaar: groei of opbouw.', '0000', 1],
    ['balance', 'Evenwicht', 'relationship', 'Twee kanten die tegen elkaar worden afgewogen.', '01101'],
    ['convergingRadial', 'Convergerend radiaal', 'relationship', 'Onderdelen die samenkomen in een middelpunt.', '0111'],
    ['basicTarget', 'Doelwit', 'relationship', 'Ringen om een midden: insluiting of stappen naar een doel.', '000', 1],
    ['opposingArrows', 'Tegengestelde pijlen', 'relationship', 'Twee tegengestelde ideeën of richtingen.', '00'],
    ['basicMatrix', 'Basismatrix', 'matrix', 'Vier kwadranten van een geheel.', '0000'],
    ['titledMatrix', 'Matrix met titel', 'matrix', 'Een titel in het midden met vier kwadranten eromheen.', '01111', 1],
    ['gridMatrix', 'Rastermatrix', 'matrix', 'Items in vakken langs twee assen.', '0000'],
    ['cycleMatrix', 'Cyclusmatrix', 'matrix', 'Taartpunten in het midden met de subitems in de hoeken.', '01010101', 1],
    ['basicPyramid', 'Basispiramide', 'pyramid', 'Lagen van een piramide, van smal naar breed.', '000'],
    ['invertedPyramid', 'Omgekeerde piramide', 'pyramid', 'Lagen die van breed naar smal lopen.', '000'],
    ['segmentedPyramid', 'Gesegmenteerde piramide', 'pyramid', 'Een driehoek opgedeeld in kleinere driehoeken.', '0000', 1],
    ['pyramidList', 'Piramidelijst', 'pyramid', 'Een piramide met de items als balken ernaast.', '000'],
  ];
  const BY = {};
  D.LAYOUTS = DEF.map(([id, name, cat, desc, smp, ov]) => { const l = { id, name, cat, desc, icon: '', ov: !!ov }; BY[id] = { l, smp, fn: L[id] }; return l; });
  D.COLORS = [1, 2, 3, 4, 5, 6].map((i) => ({ id: 'accent' + i, name: 'Accentkleur ' + i, sw: ['accent' + i, 'accent' + i + '/l40', 'accent' + i + '/l80'] })).concat([
    { id: 'colorful1', name: 'Kleurrijk - accentkleuren', sw: ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] },
    { id: 'colorful2', name: 'Kleurrijk - accentkleuren 2 tot 6', sw: ['accent2', 'accent3', 'accent4', 'accent5', 'accent6'] },
    { id: 'dark', name: 'Donker', sw: ['dk2', 'dk2/l40', 'dk2/l80'] },
    { id: 'outline', name: 'Alleen omtrek', sw: ['bg1', 'accent1'] },
  ]);
  D.LOOKS = [{ id: 'flat', name: 'Eenvoudig' }, { id: 'subtle', name: 'Subtiel effect' }, { id: 'intense', name: 'Intens effect' }, { id: 'outline', name: 'Omtrek' }];
  D.byId = (id) => (BY[id] ? BY[id].l : null);
  // voorbeelditems voor een nieuwe indeling: lege tekst, het diagram toont dan '[Tekst]'
  D.sample = (id) => (BY[id] || BY.basicBlockList).smp.split('').map((ch) => {
    const o = { id: D.uid(), text: '', lvl: ch === 'a' ? 1 : +ch };
    if (ch === 'a') o.asst = true;
    return o;
  });
  const clean = (s) => {
    ['_k', '_mix', '_max', '_ex', '_wf', '_box'].forEach((k) => delete s[k]);
    ['x', 'y', 'w', 'h'].forEach((k) => { s[k] = r2(s[k]); });
    return s;
  };
  // vormen voor diagram dia in een vlak van w × h px (coördinaten binnen het diagram)
  D.layout = (dia, w, h, ctx) => {
    ctx = ctx || {};
    if (dia && dia.dia) { if (w == null) { w = dia.w; h = dia.h; } dia = dia.dia; }
    w = +w; h = +h;
    if (!dia || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return [];
    const def = BY[dia.layout] || BY.basicBlockList, { roots } = tree(dia.items);
    if (!roots.length) return [];
    const m = Math.min(clamp(Math.min(w, h) * 0.02, 1, 8), w / 4, h / 4);
    const E = { w, h, X: m, Y: m, W: w - 2 * m, H: h - 2 * m, roots, n: roots.length, P: mkPaint(dia.color, dia.look), out: [] };
    def.fn(E);
    if (!ctx.noText) fitText(E.out, mkMeasure(ctx), E.free);
    return E.out.map(clean);
  };

  /* ---------- Voorbeeld als SVG (pictogrammen in de galerie, eenvoudige benadering van de presets) ---------- */
  const gpath = (g, w, h, a = {}) => {
    const ss = Math.min(w, h), V = (k, d) => (a[k] != null ? a[k] : d), A = (k, d) => V(k, d) / 1e5;
    const f = (p) => r2(p[0]) + ' ' + r2(p[1]), P = (pts) => 'M' + pts.map(f).join('L') + 'Z';
    const fl = (pts, fx, fy) => pts.map(([x, y]) => [fx ? w - x : x, fy ? h - y : y]);
    switch (g) {
      case 'triangle': return P([[w / 2, 0], [w, h], [0, h]]);
      case 'trapezoid': { const x = Math.min(w / 2, ss * A('adj', 25000)); return P([[0, h], [x, 0], [w - x, 0], [w, h]]); }
      case 'chevron': { const x = Math.min(w, ss * A('adj', 50000)); return P([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h], [x, h / 2]]); }
      case 'homePlate': { const x = Math.min(w, ss * A('adj', 50000)); return P([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h]]); }
      case 'rightArrow': case 'leftArrow': {
        const t = (h * A('adj1', 50000)) / 2, x = w - Math.min(w, ss * A('adj2', 50000));
        return P(fl([[0, h / 2 - t], [x, h / 2 - t], [x, 0], [w, h / 2], [x, h], [x, h / 2 + t], [0, h / 2 + t]], g === 'leftArrow', false));
      }
      case 'downArrow': case 'upArrow': {
        const t = (w * A('adj1', 50000)) / 2, y = h - Math.min(h, ss * A('adj2', 50000));
        return P(fl([[w / 2 - t, 0], [w / 2 - t, y], [0, y], [w / 2, h], [w, y], [w / 2 + t, y], [w / 2 + t, 0]], false, g === 'upArrow'));
      }
      case 'leftRightArrow': { const t = (h * A('adj1', 50000)) / 2, x = Math.min(w / 2, ss * A('adj2', 50000)); return P([[0, h / 2], [x, 0], [x, h / 2 - t], [w - x, h / 2 - t], [w - x, 0], [w, h / 2], [w - x, h], [w - x, h / 2 + t], [x, h / 2 + t], [x, h]]); }
      case 'upDownArrow': { const t = (w * A('adj1', 50000)) / 2, y = Math.min(h / 2, ss * A('adj2', 50000)); return P([[w / 2, 0], [w, y], [w / 2 + t, y], [w / 2 + t, h - y], [w, h - y], [w / 2, h], [0, h - y], [w / 2 - t, h - y], [w / 2 - t, y], [0, y]]); }
      case 'round2SameRect': { const r = Math.min(ss / 2, ss * A('adj1', 16667)); return `M0 ${r2(h)}V${r2(r)}Q0 0 ${r2(r)} 0H${r2(w - r)}Q${r2(w)} 0 ${r2(w)} ${r2(r)}V${r2(h)}Z`; }
      case 'pie': {
        const a1 = V('adj1', 0) / 60000, sw = (((V('adj2', 16200000) / 60000 - a1) % 360) + 360) % 360 || 360, a2 = a1 + sw;
        const pt = (d) => { const t = Math.atan2((w / 2) * Math.sin(d * RAD), (h / 2) * Math.cos(d * RAD)); return [w / 2 + (w / 2) * Math.cos(t), h / 2 + (h / 2) * Math.sin(t)]; };
        return `M${r2(w / 2)} ${r2(h / 2)}L${f(pt(a1))}A${r2(w / 2)} ${r2(h / 2)} 0 ${sw > 180 ? 1 : 0} 1 ${f(pt(a2))}Z`;
      }
      case 'circularArrow': {
        const st = V('adj4', 10800000) / 60000, en = V('adj3', 20457681) / 60000, th = ss * A('adj1', 12500), hh = ss * A('adj5', 12500), aA = V('adj2', 1142319) / 60000;
        const mx = w / 2 - hh, my = h / 2 - hh, sw = (((en - st) % 360) + 360) % 360, lg = sw > 180 ? 1 : 0;
        const pt = (d, o) => { const t = Math.atan2(mx * Math.sin(d * RAD), my * Math.cos(d * RAD)); return [w / 2 + (mx + o) * Math.cos(t), h / 2 + (my + o) * Math.sin(t)]; };
        return `M${f(pt(st, th / 2))}A${r2(mx + th / 2)} ${r2(my + th / 2)} 0 ${lg} 1 ${f(pt(en, th / 2))}L${f(pt(en, hh))}L${f(pt(en + aA, 0))}L${f(pt(en, -hh))}L${f(pt(en, -th / 2))}A${r2(mx - th / 2)} ${r2(my - th / 2)} 0 ${lg} 0 ${f(pt(st, -th / 2))}Z`;
      }
      default: return `M0 0H${r2(w)}V${r2(h)}H0Z`;
    }
  };
  // opaciteit voor lichtere tinten, zodat het pictogram met één kleur (currentColor) werkt
  const op = (ref) => { const m = /\/l(\d+)/.exec(ref || ''); return m ? clamp(1 - (+m[1] / 100) * 0.9, 0.2, 1) : 1; };
  const svgShape = (s, k) => {
    if (s.label) return '';
    const sw = r2(Math.max(0.6, (s.lineW || 1) * k));
    if (s.geom === 'line') {
      const p = s.pts || [[s.x, s.y], [s.x + s.w, s.y + s.h]];
      return `<line x1="${r2(p[0][0])}" y1="${r2(p[0][1])}" x2="${r2(p[1][0])}" y2="${r2(p[1][1])}" stroke="currentColor" stroke-width="${sw}" stroke-opacity="${r2(op(s.line) * 0.8)}"/>`;
    }
    if (!s.fill && !s.line) {
      if (!s.text) return '';
      const lw = Math.min(s.w * 0.7, 16), y = s.y + s.h / 2, x = s.x + (s.w - lw) / 2;
      return `<g fill="currentColor" fill-opacity=".55"><rect x="${r2(x)}" y="${r2(y - 2)}" width="${r2(lw)}" height="1.3"/><rect x="${r2(x)}" y="${r2(y + 1)}" width="${r2(lw * 0.7)}" height="1.3"/></g>`;
    }
    let tr = `translate(${r2(s.x)} ${r2(s.y)})`;
    if (s.rot) tr += ` rotate(${r2(s.rot)} ${r2(s.w / 2)} ${r2(s.h / 2)})`;
    if (s.flipH || s.flipV) tr += ` translate(${s.flipH ? r2(s.w) : 0} ${s.flipV ? r2(s.h) : 0}) scale(${s.flipH ? -1 : 1} ${s.flipV ? -1 : 1})`;
    const paint = (s.fill ? `fill="currentColor" fill-opacity="${r2(op(s.fill) * (s.alpha == null ? 1 : s.alpha))}"` : 'fill="none"')
      + (s.line && s.line !== 'lt1' ? ` stroke="currentColor" stroke-width="${sw}" stroke-opacity="${r2(op(s.line))}"` : '');
    const ss = Math.min(s.w, s.h);
    let el;
    if (s.geom === 'rect') el = `<rect width="${r2(s.w)}" height="${r2(s.h)}"/>`;
    else if (s.geom === 'roundRect') el = `<rect width="${r2(s.w)}" height="${r2(s.h)}" rx="${r2(ss * ((s.adj && s.adj.adj) || 16667) / 1e5)}"/>`;
    else if (s.geom === 'ellipse') el = `<ellipse cx="${r2(s.w / 2)}" cy="${r2(s.h / 2)}" rx="${r2(s.w / 2)}" ry="${r2(s.h / 2)}"/>`;
    else el = `<path d="${gpath(s.geom, s.w, s.h, s.adj)}"/>`;
    return `<g transform="${tr}" ${paint}>${el}</g>`;
  };
  // het diagram als losse SVG (alleen vormen, geen tekst); handig voor galerieën en voorbeelden
  D.preview = (dia, w = 48, h = 36) => {
    const sh = D.layout(dia, w, h, { noText: true }), k = Math.min(w, h) / 120;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${sh.map((s) => svgShape(s, k)).join('')}</svg>`;
  };
  D.LAYOUTS.forEach((l) => { l.icon = D.preview({ layout: l.id, items: D.sample(l.id), color: 'accent1', look: 'flat' }, 48, 36); });
  D._geomPath = gpath;
})();
