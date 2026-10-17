/* =========================================================
   Doek (gemaakt door JJ van Schelven) — veilig inlezen van documentgegevens.
   Alles wat van buiten komt (.doek-bestand, gedeelde koppeling, klembord, opslag)
   gaat door deze filters: alleen bekende velden, getallen zijn echte getallen,
   kleuren zijn kleuren, adressen alleen veilige soorten, id's alleen letters en cijfers.
   Zo kan een document nooit code uitvoeren of de interface overnemen.
   ========================================================= */
'use strict';

(() => {
  const N = (v, d = 0, min = -1e7, max = 1e7) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const S = (v, max = 2000) => (v === undefined || v === null ? undefined : String(v).slice(0, max));
  const B = (v) => (v ? true : undefined);
  const C = (v, d) => (App.isColorRef(v) ? v : d);
  const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const strip = (o) => { Object.keys(o).forEach((k) => { if (o[k] === undefined) delete o[k]; }); return o; };
  let idMap = null;
  const ID = (v) => { if (typeof v === 'string' && ID_RE.test(v)) return v; const n = App.uid('x'); if (idMap && v !== undefined) idMap.set(String(v), n); return n; };
  const REF = (v) => (typeof v === 'string' ? (idMap && idMap.has(v) ? idMap.get(v) : ID_RE.test(v) ? v : undefined) : undefined);

  App.cleanFill = (f) => {
    if (!f || typeof f !== 'object') return undefined;
    if (f.type === 'none') return { type: 'none' };
    if (f.type === 'solid') return strip({ type: 'solid', color: C(f.color, 'accent1'), alpha: f.alpha === undefined ? undefined : N(f.alpha, 1, 0, 1) });
    if (f.type === 'grad') {
      const stops = (Array.isArray(f.stops) ? f.stops : []).slice(0, 20).map((s) => strip({ p: N(s && s.p, 0, 0, 1), color: C(s && s.color, '#000000'), alpha: s && s.alpha !== undefined ? N(s.alpha, 1, 0, 1) : undefined }));
      if (stops.length < 2) return { type: 'solid', color: stops[0] ? stops[0].color : 'accent1' };
      return strip({ type: 'grad', kind: pick(f.kind, ['linear', 'radial', 'rect', 'path'], 'linear'), angle: f.angle === undefined ? undefined : N(f.angle, 0, -3600, 3600), cx: f.cx === undefined ? undefined : N(f.cx, 0.5, 0, 1), cy: f.cy === undefined ? undefined : N(f.cy, 0.5, 0, 1), stops });
    }
    if (f.type === 'img') return strip({ type: 'img', media: REF(f.media) || null, mode: pick(f.mode, ['stretch', 'tile'], 'stretch'), alpha: f.alpha === undefined ? undefined : N(f.alpha, 1, 0, 1), sx: f.sx === undefined ? undefined : N(f.sx, 1, 0.01, 100), sy: f.sy === undefined ? undefined : N(f.sy, 1, 0.01, 100) });
    if (f.type === 'pattern') return { type: 'pattern', pat: /^[A-Za-z0-9]{1,20}$/.test(f.pat) ? f.pat : 'pct50', fg: C(f.fg, 'tx1'), bg: C(f.bg, 'bg1') };
    return undefined;
  };
  const ARROW = (a) => (a && typeof a === 'object' ? strip({ type: pick(a.type, ['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow'], 'none'), w: pick(a.w, ['sm', 'med', 'lg'], undefined), len: pick(a.len, ['sm', 'med', 'lg'], undefined) }) : undefined);
  App.cleanLine = (l) => {
    if (!l || typeof l !== 'object') return undefined;
    if (l.type === 'none') return { type: 'none' };
    return strip({ type: 'solid', color: C(l.color, 'tx1'), alpha: l.alpha === undefined ? undefined : N(l.alpha, 1, 0, 1), w: N(l.w, 0.75, 0, 1584),
      dash: pick(l.dash, ['solid', 'sysDot', 'sysDash', 'dash', 'dashDot', 'lgDash', 'lgDashDot', 'lgDashDotDot', 'sysDashDot', 'sysDashDotDot'], undefined),
      cap: pick(l.cap, ['flat', 'rnd', 'sq'], undefined), join: pick(l.join, ['round', 'bevel', 'miter'], undefined), cmpd: pick(l.cmpd, ['sng', 'dbl', 'thickThin', 'thinThick', 'tri'], undefined),
      head: ARROW(l.head), tail: ARROW(l.tail) });
  };
  App.cleanFx = (fx) => {
    if (!fx || typeof fx !== 'object') return undefined;
    const o = {};
    if (fx.shadow && typeof fx.shadow === 'object') o.shadow = strip({ type: pick(fx.shadow.type, ['outer', 'inner', 'persp'], 'outer'), color: C(fx.shadow.color, '#000000'), alpha: N(fx.shadow.alpha, 0.4, 0, 1), blur: N(fx.shadow.blur, 4, 0, 400), dist: N(fx.shadow.dist, 3, 0, 800), dir: N(fx.shadow.dir, 45, -3600, 3600) });
    if (fx.glow && typeof fx.glow === 'object') o.glow = { color: C(fx.glow.color, 'accent1'), alpha: N(fx.glow.alpha, 0.6, 0, 1), size: N(fx.glow.size, 8, 0, 400) };
    if (fx.soft) o.soft = N(fx.soft, 0, 0, 400) || undefined;
    if (fx.refl && typeof fx.refl === 'object') o.refl = strip({ alpha: N(fx.refl.alpha, 0.5, 0, 1), size: N(fx.refl.size, 0.5, 0, 1), dist: N(fx.refl.dist, 0, 0, 400), blur: N(fx.refl.blur, 0, 0, 200) });
    if (fx.rot3d && typeof fx.rot3d === 'object') o.rot3d = { x: N(fx.rot3d.x, 0, -360, 360), y: N(fx.rot3d.y, 0, -360, 360), persp: N(fx.rot3d.persp, 900, 50, 20000) };
    if (fx.bevel && typeof fx.bevel === 'object') o.bevel = { type: /^[A-Za-z]{1,20}$/.test(fx.bevel.type) ? fx.bevel.type : 'circle', w: N(fx.bevel.w, 6, 0, 200), h: N(fx.bevel.h, 6, 0, 200) };
    strip(o);
    return Object.keys(o).length ? o : undefined;
  };
  App.cleanLink = (l) => {
    if (!l || typeof l !== 'object') return undefined;
    if (l.kind === 'url') { const u = String(l.url || '').trim(); return /^(https?:|mailto:)/i.test(u) ? { kind: 'url', url: u.slice(0, 2000) } : undefined; }
    if (l.kind === 'slide') { const r = REF(l.slide); return r ? { kind: 'slide', slide: r } : undefined; }
    if (['first', 'last', 'next', 'prev', 'end', 'lastViewed'].includes(l.kind)) return { kind: l.kind };
    if (l.kind === 'show') { const r = REF(l.show); return r ? strip({ kind: 'show', show: r, ret: B(l.ret) }) : undefined; }
    return undefined;
  };
  const FONT = (f) => (typeof f === 'string' && f.length < 100 ? f.replace(/["\\;{}<>]/g, '') : undefined);
  const BULLET = (b) => {
    if (!b || typeof b !== 'object') return undefined;
    if (b.type === 'none') return { type: 'none' };
    if (b.type === 'char') return strip({ type: 'char', char: String(b.char || '•').slice(0, 2), font: FONT(b.font), color: b.color ? C(b.color, undefined) : undefined, sz: b.sz === undefined ? undefined : N(b.sz, 1, 0.25, 4) });
    if (b.type === 'auto') return strip({ type: 'auto', scheme: /^[A-Za-z]{1,30}$/.test(b.scheme) ? b.scheme : 'arabicPeriod', start: b.start === undefined ? undefined : N(b.start, 1, 1, 32767), color: b.color ? C(b.color, undefined) : undefined, sz: b.sz === undefined ? undefined : N(b.sz, 1, 0.25, 4) });
    return undefined;
  };
  App.cleanRunProps = (r, into = {}) => {
    if (!r || typeof r !== 'object') return into;
    if (r.b !== undefined) into.b = !!r.b; if (r.i !== undefined) into.i = !!r.i;
    if (r.u !== undefined) into.u = /^[A-Za-z]{1,20}$/.test(r.u) ? r.u : undefined;
    if (r.s !== undefined) into.s = pick(r.s, ['sng', 'dbl', 'noStrike'], undefined);
    if (r.base !== undefined) into.base = N(r.base, 0, -100, 100) || undefined;
    if (r.caps !== undefined) into.caps = pick(r.caps, ['all', 'small'], undefined);
    if (r.sz !== undefined) into.sz = N(r.sz, 18, 1, 4000);
    if (r.font !== undefined) into.font = FONT(r.font);
    if (r.color !== undefined) into.color = C(r.color, undefined);
    if (r.alpha !== undefined) into.alpha = N(r.alpha, 1, 0, 1);
    if (r.hl !== undefined) into.hl = C(r.hl, undefined);
    if (r.spc !== undefined) into.spc = N(r.spc, 0, -400, 1584) || undefined;
    if (r.kern !== undefined) into.kern = N(r.kern, 0, 0, 4000);
    if (r.fill !== undefined) into.fill = App.cleanFill(r.fill);
    if (r.ln !== undefined) into.ln = App.cleanLine(r.ln);
    if (r.fx !== undefined) into.fx = App.cleanFx(r.fx);
    if (r.lang !== undefined) into.lang = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(r.lang) ? r.lang : undefined;
    if (r.ot && typeof r.ot === 'object') into.ot = strip({ liga: r.ot.liga === false ? false : undefined, smcp: B(r.ot.smcp), onum: B(r.ot.onum), tnum: B(r.ot.tnum), dlig: B(r.ot.dlig) });
    return strip(into);
  };
  App.cleanParaProps = (p, into = {}) => {
    if (!p || typeof p !== 'object') return into;
    if (p.align !== undefined) into.align = pick(p.align, ['l', 'ctr', 'r', 'just', 'dist'], undefined);
    if (p.lvl !== undefined) into.lvl = N(p.lvl, 0, 0, 8) | 0;
    if (p.marL !== undefined) into.marL = N(p.marL, 0, -2000, 4000);
    if (p.indent !== undefined) into.indent = N(p.indent, 0, -2000, 4000);
    if (p.lnSpc !== undefined) into.lnSpc = p.lnSpc && p.lnSpc.pt !== undefined ? { pt: N(p.lnSpc.pt, 12, 0, 1584) } : { pct: N(p.lnSpc && p.lnSpc.pct, 1, 0, 13) };
    if (p.spcBef !== undefined) into.spcBef = N(p.spcBef, 0, 0, 1584);
    if (p.spcAft !== undefined) into.spcAft = N(p.spcAft, 0, 0, 1584);
    if (p.bullet !== undefined) into.bullet = BULLET(p.bullet);
    if (Array.isArray(p.tabs)) into.tabs = p.tabs.slice(0, 32).map((t) => ({ pos: N(t && t.pos, 0, 0, 10000), algn: pick(t && t.algn, ['l', 'ctr', 'r', 'dec'], 'l') }));
    if (p.rtl !== undefined) into.rtl = B(p.rtl);
    return strip(into);
  };
  App.cleanPara = (p) => {
    const out = App.cleanParaProps(p);
    out.runs = (Array.isArray(p && p.runs) ? p.runs : []).slice(0, 2000).map((r) => {
      const run = App.cleanRunProps(r, {});
      run.t = String((r && r.t) ?? '').replace(/[\u0000-\u0008\u000c\u000e-\u001f]/g, '').slice(0, 100000);
      if (r && r.link) run.link = App.cleanLink(r.link);
      if (r && r.fld && typeof r.fld === 'object') run.fld = { type: /^(slidenum|datetime\d{0,2})$/.test(r.fld.type) ? r.fld.type : 'slidenum' };
      return strip(run);
    });
    if (!out.runs.length) out.runs = [{ t: '' }];
    if (p && p.end) out.end = App.cleanRunProps(p.end, {});
    return strip(out);
  };
  const LST = (l) => {
    if (!l || typeof l !== 'object') return undefined;
    const o = {};
    Object.keys(l).slice(0, 10).forEach((k) => { if (/^[0-8]$/.test(k)) o[k] = App.cleanRunProps(l[k], App.cleanParaProps(l[k], {})); });
    return Object.keys(o).length ? o : undefined;
  };
  const INS = (i) => (i && typeof i === 'object' ? { l: N(i.l, 9.6, 0, 2000), t: N(i.t, 4.8, 0, 2000), r: N(i.r, 9.6, 0, 2000), b: N(i.b, 4.8, 0, 2000) } : undefined);
  App.cleanBody = (b) => {
    if (!b || typeof b !== 'object') return undefined;
    return strip({
      paras: (Array.isArray(b.paras) ? b.paras : []).slice(0, 5000).map(App.cleanPara),
      vAlign: pick(b.vAlign, ['t', 'ctr', 'b'], undefined), ins: INS(b.ins), fit: pick(b.fit, ['none', 'shrink', 'resize'], undefined),
      scale: b.scale && typeof b.scale === 'object' ? { font: N(b.scale.font, 1, 0.05, 1), spc: N(b.scale.spc, 1, 0.05, 1) } : undefined,
      wrap: b.wrap === false ? false : b.wrap === true ? true : undefined, cols: b.cols && typeof b.cols === 'object' ? { n: N(b.cols.n, 1, 1, 16) | 0, gap: N(b.cols.gap, 14, 0, 2000) } : undefined,
      vert: pick(b.vert, ['horz', 'vert', 'vert270', 'eaVert', 'stacked'], undefined), rtl: B(b.rtl), warp: /^text[A-Za-z0-9]{1,30}$/.test(b.warp || '') ? b.warp : undefined, lst: LST(b.lst),
    });
  };
  const TYPES = ['shape', 'line', 'image', 'table', 'chart', 'group', 'video', 'audio', 'diagram', 'equation', 'icon', 'ink', 'zoom'];
  const PH_TYPES = ['title', 'ctrTitle', 'subTitle', 'body', 'obj', 'dt', 'ftr', 'sldNum', 'pic', 'chart', 'tbl', 'media', 'clipArt', 'dgm', 'hdr', 'sldImg'];
  App.cleanObj = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || !TYPES.includes(o.type) || depth > 20) return null;
    const out = { id: ID(o.id), type: o.type, name: S(o.name, 200) || App.OBJ_NAMES[o.type] || 'Object' };
    ['x', 'y', 'w', 'h'].forEach((k) => { if (o[k] !== undefined) out[k] = N(o[k], k === 'w' || k === 'h' ? 100 : 0, -1e6, 1e6); });
    if (out.w !== undefined) out.w = Math.max(0, out.w); if (out.h !== undefined) out.h = Math.max(0, out.h);
    if (o.rot) out.rot = N(o.rot, 0, -3600, 3600) % 360 || undefined;
    out.flipH = B(o.flipH); out.flipV = B(o.flipV); out.hidden = B(o.hidden); out.locked = B(o.locked); out.lockAspect = o.lockAspect === false ? false : B(o.lockAspect);
    out.alt = S(o.alt, 2000); out.decorative = B(o.decorative); out.txbox = B(o.txbox);
    if (o.ph && typeof o.ph === 'object') out.ph = strip({ type: pick(o.ph.type, PH_TYPES, 'body'), idx: o.ph.idx === undefined ? undefined : N(o.ph.idx, 0, 0, 1e9) | 0, prompt: S(o.ph.prompt, 500) });
    out.fill = App.cleanFill(o.fill); out.line = App.cleanLine(o.line); out.fx = App.cleanFx(o.fx);
    out.link = App.cleanLink(o.link); out.hover = App.cleanLink(o.hover);
    if (o.text) out.text = App.cleanBody(o.text);
    if (o.geom !== undefined) out.geom = /^[A-Za-z0-9]{1,40}$/.test(o.geom) ? o.geom : 'rect';
    if (o.adj && typeof o.adj === 'object') { out.adj = {}; Object.keys(o.adj).slice(0, 12).forEach((k) => { if (/^adj\d{0,2}$/.test(k)) out.adj[k] = N(o.adj[k], 0, -1e7, 1e7); }); }
    if (o.path && typeof o.path === 'object') out.path = { w: N(o.path.w, 1, 0, 1e6), h: N(o.path.h, 1, 0, 1e6), subs: (Array.isArray(o.path.subs) ? o.path.subs : []).slice(0, 2000).map((s) => strip({ closed: B(s && s.closed), pts: (Array.isArray(s && s.pts) ? s.pts : []).slice(0, 20000).map((p) => strip({ x: N(p && p.x, 0), y: N(p && p.y, 0), c1: Array.isArray(p && p.c1) ? [N(p.c1[0]), N(p.c1[1])] : undefined, c2: Array.isArray(p && p.c2) ? [N(p.c2[0]), N(p.c2[1])] : undefined })) })) };
    switch (o.type) {
      case 'line':
        out.pts = Array.isArray(o.pts) && o.pts.length === 2 ? o.pts.map((p) => [N(p && p[0], 0), N(p && p[1], 0)]) : [[N(o.x), N(o.y)], [N(o.x) + N(o.w, 100), N(o.y) + N(o.h, 0)]];
        if (o.conn && typeof o.conn === 'object') { out.conn = {}; ['st', 'end'].forEach((k) => { const c = o.conn[k]; if (c && REF(c.obj)) out.conn[k] = { obj: REF(c.obj), site: N(c.site, 0, 0, 100) | 0 }; }); if (!Object.keys(out.conn).length) delete out.conn; }
        Object.assign(out, App.lineBox(out));
        break;
      case 'image':
        out.media = REF(o.media) || null;
        if (o.orig) out.orig = REF(o.orig);
        if (o.nat) out.nat = { w: N(o.nat.w, 100, 1, 1e6), h: N(o.nat.h, 100, 1, 1e6) };
        if (o.crop && typeof o.crop === 'object') out.crop = { l: N(o.crop.l, 0, -10, 0.99), t: N(o.crop.t, 0, -10, 0.99), r: N(o.crop.r, 0, -10, 0.99), b: N(o.crop.b, 0, -10, 0.99) };
        if (o.pic && typeof o.pic === 'object') out.pic = strip({ bright: o.pic.bright === undefined ? undefined : N(o.pic.bright, 0, -1, 1), contrast: o.pic.contrast === undefined ? undefined : N(o.pic.contrast, 0, -1, 1), sat: o.pic.sat === undefined ? undefined : N(o.pic.sat, 1, 0, 4), alpha: o.pic.alpha === undefined ? undefined : N(o.pic.alpha, 1, 0, 1), recolor: typeof o.pic.recolor === 'string' && (/^(gray|sepia|wash|bw|invert)$/.test(o.pic.recolor) || (/^duo:/.test(o.pic.recolor) && App.isColorRef(o.pic.recolor.slice(4)))) ? o.pic.recolor : undefined, blur: o.pic.blur === undefined ? undefined : N(o.pic.blur, 0, 0, 100), sharpen: o.pic.sharpen === undefined ? undefined : N(o.pic.sharpen, 0, 0, 1), art: pick(o.pic.art, ['pencil', 'edges', 'poster', 'glow'], undefined), chroma: C(o.pic.chroma, undefined) });
        break;
      case 'table': {
        out.cols = (Array.isArray(o.cols) ? o.cols : []).slice(0, 200).map((w) => N(w, 100, 1, 1e5));
        const nC = out.cols.length || 1;
        if (!out.cols.length) out.cols = [N(o.w, 300)];
        out.rows = (Array.isArray(o.rows) ? o.rows : []).slice(0, 1000).map((r) => ({ h: N(r && r.h, 40, 1, 1e5), cells: Array.from({ length: nC }, (_, c) => { const cell = (r && Array.isArray(r.cells) ? r.cells : [])[c] || {}; return strip({ text: App.cleanBody(cell.text) || { paras: [{ runs: [{ t: '' }] }] }, fill: App.cleanFill(cell.fill), bd: cell.bd && typeof cell.bd === 'object' ? strip({ l: App.cleanLine(cell.bd.l), r: App.cleanLine(cell.bd.r), t: App.cleanLine(cell.bd.t), b: App.cleanLine(cell.bd.b), d1: App.cleanLine(cell.bd.d1), d2: App.cleanLine(cell.bd.d2) }) : undefined, span: cell.span && typeof cell.span === 'object' ? { c: N(cell.span.c, 1, 1, 200) | 0, r: N(cell.span.r, 1, 1, 1000) | 0 } : undefined, merged: B(cell.merged), vAlign: pick(cell.vAlign, ['t', 'ctr', 'b'], undefined), ins: INS(cell.ins) }); }) }));
        if (!out.rows.length) out.rows = [{ h: 40, cells: Array.from({ length: nC }, () => ({ text: { paras: [{ runs: [{ t: '' }] }] } })) }];
        if (o.tstyle && typeof o.tstyle === 'object') out.tstyle = strip({ id: /^[A-Za-z0-9:_-]{1,40}$/.test(o.tstyle.id) ? o.tstyle.id : undefined, first: B(o.tstyle.first), last: B(o.tstyle.last), bandR: B(o.tstyle.bandR), bandC: B(o.tstyle.bandC), firstC: B(o.tstyle.firstC), lastC: B(o.tstyle.lastC) });
        break;
      }
      case 'chart': out.chart = App.cleanChart(o.chart); break;
      case 'group': out.objs = (Array.isArray(o.objs) ? o.objs : []).slice(0, 5000).map((c) => App.cleanObj(c, depth + 1)).filter(Boolean); if (o.cw) out.cw = N(o.cw, 0, 0, 1e6); if (o.ch) out.ch = N(o.ch, 0, 0, 1e6); break;
      case 'video': case 'audio':
        out.media = REF(o.media) || null; out.poster = REF(o.poster);
        if (o.trim) out.trim = { start: N(o.trim.start, 0, 0, 1e6), end: N(o.trim.end, 0, 0, 1e6) };
        if (o.fade) out.fade = { in: N(o.fade.in, 0, 0, 60), out: N(o.fade.out, 0, 0, 60) };
        out.play = pick(o.play, ['click', 'auto', 'seq'], 'seq'); out.loop = B(o.loop); out.rewind = B(o.rewind); out.hide = B(o.hide); out.full = B(o.full);
        if (o.vol !== undefined) out.vol = N(o.vol, 1, 0, 1);
        if (o.dur) out.dur = N(o.dur, 0, 0, 1e7);
        if (Array.isArray(o.marks)) out.marks = o.marks.slice(0, 100).map((m) => ({ t: N(m && m.t, 0, 0, 1e7), name: S(m && m.name, 100) || '' }));
        break;
      case 'diagram':
        out.dia = { layout: /^[A-Za-z0-9]{1,40}$/.test(o.dia && o.dia.layout) ? o.dia.layout : 'basicBlockList', items: (o.dia && Array.isArray(o.dia.items) ? o.dia.items : []).slice(0, 500).map((it) => ({ id: ID(it && it.id), text: S(it && it.text, 2000) || '', lvl: N(it && it.lvl, 0, 0, 8) | 0, ...(it && it.asst ? { asst: true } : {}) })), color: /^[A-Za-z0-9]{1,20}$/.test(o.dia && o.dia.color) ? o.dia.color : 'accent1', look: pick(o.dia && o.dia.look, ['flat', 'subtle', 'intense', 'outline'], 'flat') };
        break;
      case 'equation': out.tex = S(o.tex, 5000) || ''; out.color = C(o.color, undefined); if (o.sz) out.sz = N(o.sz, 28, 4, 400); break;
      case 'icon': out.icon = /^[a-z0-9_]{1,60}$/.test(o.icon) ? o.icon : 'star'; out.color = C(o.color, 'accent1'); out.filled = B(o.filled); if (o.alpha !== undefined) out.alpha = N(o.alpha, 1, 0, 1); break;
      case 'ink':
        out.strokes = (Array.isArray(o.strokes) ? o.strokes : []).slice(0, 5000).map((s) => strip({ pts: (Array.isArray(s && s.pts) ? s.pts : []).slice(0, 20000).map((p) => [N(p && p[0]), N(p && p[1]), N(p && p[2], 0.5, 0, 1)]), color: C(s && s.color, '#000000'), w: N(s && s.w, 3, 0.1, 200), alpha: s && s.alpha !== undefined ? N(s.alpha, 1, 0, 1) : undefined, hl: B(s && s.hl), t: Array.isArray(s && s.t) ? s.t.slice(0, 20000).map((v) => N(v, 0, 0, 1e9)) : undefined }));
        if (o.cw) out.cw = N(o.cw, 0, 0, 1e6); if (o.ch) out.ch = N(o.ch, 0, 0, 1e6);
        break;
      case 'zoom': out.slide = REF(o.slide); out.sec = REF(o.sec); out.ret = o.ret === false ? false : undefined; out.zkind = pick(o.zkind, ['slide', 'section', 'summary'], undefined); out.img = o.img === false ? false : undefined; break;
      default: break;
    }
    return strip(out);
  };
  App.cleanChart = (c) => {
    if (!c || typeof c !== 'object') return { kind: 'column', cats: [], series: [] };
    const nums = (a) => (Array.isArray(a) ? a.slice(0, 10000).map((v) => (v === null || v === undefined || v === '' ? null : N(v, null, -1e300, 1e300))) : []);
    const out = {
      kind: pick(c.kind, ['column', 'bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'bubble', 'radar', 'combo'], 'column'),
      sub: pick(c.sub, ['clustered', 'stacked', 'percent', 'plain', 'markers', 'filled', 'smooth', 'lines', 'linesMarkers', 'smoothMarkers', 'colLine', 'colLine2', 'areaCol'], undefined),
      cats: (Array.isArray(c.cats) ? c.cats : []).slice(0, 10000).map((x) => String(x ?? '').slice(0, 300)),
      series: (Array.isArray(c.series) ? c.series : []).slice(0, 255).map((s) => strip({ name: S(s && s.name, 300) || '', vals: nums(s && s.vals), xs: s && s.xs ? nums(s.xs) : undefined, sizes: s && s.sizes ? nums(s.sizes) : undefined, color: s && s.color ? C(s.color, undefined) : undefined, kind: pick(s && s.kind, ['column', 'line', 'area'], undefined), axis: s && s.axis === 2 ? 2 : undefined, smooth: B(s && s.smooth), marker: pick(s && s.marker, ['none', 'circle', 'square', 'diamond', 'triangle', 'auto'], undefined), labels: B(s && s.labels), explode: s && Array.isArray(s.explode) ? s.explode.slice(0, 1000).map((v) => N(v, 0, 0, 1)) : undefined, pointColors: s && Array.isArray(s.pointColors) ? s.pointColors.slice(0, 1000).map((v) => (v ? C(v, null) : null)) : undefined, trend: s && s.trend && typeof s.trend === 'object' ? strip({ type: pick(s.trend.type, ['linear', 'exp', 'log', 'poly', 'power', 'movavg'], 'linear'), order: s.trend.order ? N(s.trend.order, 2, 2, 6) | 0 : undefined, period: s.trend.period ? N(s.trend.period, 2, 2, 100) | 0 : undefined, eq: B(s.trend.eq), r2: B(s.trend.r2), fwd: s.trend.fwd ? N(s.trend.fwd, 0, 0, 1e6) : undefined, back: s.trend.back ? N(s.trend.back, 0, 0, 1e6) : undefined, name: S(s.trend.name, 200) }) : undefined })),
      title: c.title && typeof c.title === 'object' ? { on: !!c.title.on, text: S(c.title.text, 500) || '' } : undefined,
      legend: pick(c.legend, ['r', 'b', 't', 'l', 'none'], undefined),
      labels: c.labels && typeof c.labels === 'object' ? strip({ on: !!c.labels.on, val: B(c.labels.val), cat: B(c.labels.cat), pct: B(c.labels.pct), ser: B(c.labels.ser), pos: pick(c.labels.pos, ['out', 'in', 'ctr', 'base', 'best'], undefined) }) : undefined,
      gap: c.gap === undefined ? undefined : N(c.gap, 150, 0, 500), overlap: c.overlap === undefined ? undefined : N(c.overlap, 0, -100, 100), hole: c.hole === undefined ? undefined : N(c.hole, 50, 10, 90), firstAng: c.firstAng === undefined ? undefined : N(c.firstAng, 0, 0, 360),
      style: c.style === undefined ? undefined : N(c.style, 1, 1, 48) | 0, palette: typeof c.palette === 'string' && /^[a-z0-9]{1,20}$/.test(c.palette) ? c.palette : undefined,
      font: c.font && typeof c.font === 'object' ? strip({ sz: c.font.sz ? N(c.font.sz, 12, 4, 200) : undefined, color: c.font.color ? C(c.font.color, undefined) : undefined }) : undefined,
    };
    if (c.axes && typeof c.axes === 'object') {
      const ax = (a) => (a && typeof a === 'object' ? strip({ on: a.on === false ? false : undefined, title: S(a.title, 300), grid: a.grid === undefined ? undefined : !!a.grid, rev: B(a.rev), min: a.min === undefined || a.min === null ? undefined : N(a.min, 0, -1e300, 1e300), max: a.max === undefined || a.max === null ? undefined : N(a.max, 0, -1e300, 1e300), major: a.major ? N(a.major, 1, 1e-300, 1e300) : undefined, fmt: S(a.fmt, 60), log: B(a.log) }) : undefined);
      out.axes = strip({ cat: ax(c.axes.cat), val: ax(c.axes.val), val2: ax(c.axes.val2) });
    }
    return strip(out);
  };
  const cleanComment = (c) => (c && typeof c === 'object' ? strip({ id: ID(c.id), author: S(c.author, 80) || '', text: S(c.text, 10000) || '', t: N(c.t, Date.now(), 0, 1e15), x: c.x === undefined ? undefined : N(c.x, 0), y: c.y === undefined ? undefined : N(c.y, 0), done: B(c.done), obj: REF(c.obj), replies: (Array.isArray(c.replies) ? c.replies : []).slice(0, 500).map((r) => ({ id: ID(r && r.id), author: S(r && r.author, 80) || '', text: S(r && r.text, 10000) || '', t: N(r && r.t, Date.now(), 0, 1e15) })) }) : null);
  const cleanTrans = (t) => (t && typeof t === 'object' ? strip({ type: /^[A-Za-z0-9]{1,30}$/.test(t.type) ? t.type : 'fade', dir: /^[A-Za-z0-9]{1,20}$/.test(t.dir || '') ? t.dir : undefined, dur: N(t.dur, 0.7, 0.01, 59), click: t.click === false ? false : true, after: t.after === undefined || t.after === null ? undefined : N(t.after, 0, 0, 86400), sound: REF(t.sound), morphBy: pick(t.morphBy, ['obj', 'word', 'char'], undefined) }) : undefined);
  const cleanAnim = (a) => (a && typeof a === 'object' && REF(a.obj) ? strip({
    id: ID(a.id), obj: REF(a.obj), cls: pick(a.cls, ['entr', 'emph', 'exit', 'path'], 'entr'), eff: /^[A-Za-z0-9]{1,30}$/.test(a.eff) ? a.eff : 'fade', dir: /^[A-Za-z0-9]{1,20}$/.test(a.dir || '') ? a.dir : undefined,
    start: pick(a.start, ['click', 'with', 'after'], 'click'), dur: N(a.dur, 0.5, 0.01, 600), delay: N(a.delay, 0, 0, 600),
    rep: a.rep === 'next' || a.rep === 'end' ? a.rep : a.rep === undefined ? undefined : N(a.rep, 1, 1, 1000), rew: B(a.rew), seq: pick(a.seq, ['one', 'para'], undefined), by: pick(a.by, ['all', 'word', 'letter'], undefined), byDelay: a.byDelay === undefined ? undefined : N(a.byDelay, 0.1, 0, 1),
    after: a.after && typeof a.after === 'object' ? strip({ type: pick(a.after.type, ['none', 'dim', 'hide', 'hideClick'], 'none'), color: a.after.color ? C(a.after.color, undefined) : undefined }) : undefined,
    trig: a.trig && typeof a.trig === 'object' ? (a.trig.obj ? (REF(a.trig.obj) ? { obj: REF(a.trig.obj) } : undefined) : a.trig.media && REF(a.trig.media) ? { media: REF(a.trig.media), mark: S(a.trig.mark, 100) || '' } : undefined) : undefined,
    path: typeof a.path === 'string' && /^[MLCZmlcz0-9 .,eE+-]{1,20000}$/.test(a.path) ? a.path : undefined, pathRot: B(a.pathRot), pathLocked: B(a.pathLocked),
    emph: a.emph && typeof a.emph === 'object' ? strip({ color: a.emph.color ? C(a.emph.color, undefined) : undefined, scale: a.emph.scale === undefined ? undefined : N(a.emph.scale, 1.5, 0.01, 20), angle: a.emph.angle === undefined ? undefined : N(a.emph.angle, 360, -36000, 36000), alpha: a.emph.alpha === undefined ? undefined : N(a.emph.alpha, 0.5, 0, 1) }) : undefined,
    sound: REF(a.sound), para: a.para === undefined ? undefined : N(a.para, 0, 0, 10000) | 0,
  }) : null);
  App.cleanSlide = (s) => {
    if (!s || typeof s !== 'object') return null;
    const out = { id: ID(s.id), layout: REF(s.layout) || '', objs: (Array.isArray(s.objs) ? s.objs : []).slice(0, 5000).map((o) => App.cleanObj(o)).filter(Boolean), anims: [] };
    out.name = S(s.name, 200); out.bg = App.cleanFill(s.bg); out.hideMaster = B(s.hideMaster); out.hidden = B(s.hidden); out.sec = REF(s.sec);
    out.trans = cleanTrans(s.trans);
    out.notes = s.notes ? App.cleanBody(s.notes) : undefined;
    out.comments = Array.isArray(s.comments) ? s.comments.slice(0, 1000).map(cleanComment).filter(Boolean) : undefined;
    out._animsRaw = Array.isArray(s.anims) ? s.anims.slice(0, 5000) : [];
    return strip(out);
  };
  App.cleanLayout = (l) => (l && typeof l === 'object' ? strip({ id: ID(l.id), name: S(l.name, 200) || 'Indeling', type: /^[A-Za-z0-9]{1,30}$/.test(l.type) ? l.type : 'cust', bg: App.cleanFill(l.bg), hideMaster: B(l.hideMaster), noFtr: B(l.noFtr), objs: (Array.isArray(l.objs) ? l.objs : []).slice(0, 5000).map((o) => App.cleanObj(o)).filter(Boolean) }) : null);
  App.cleanMaster = (m) => {
    if (!m || typeof m !== 'object') return null;
    const th = m.theme || {};
    const colors = {};
    App.THEME_SLOTS.forEach((k) => { colors[k] = /^#[0-9a-f]{6}$/i.test(th.colors && th.colors[k]) ? th.colors[k].toLowerCase() : (App.COLOR_SETS[0].colors[k]); });
    const tx = m.tx && typeof m.tx === 'object' ? m.tx : App.defaultTx();
    const lvls = (a, n) => Array.from({ length: n }, (_, i) => { const x = Array.isArray(a) ? a[i] : null; return x ? App.cleanRunProps(x, App.cleanParaProps(x, {})) : {}; });
    const out = {
      id: ID(m.id), name: S(m.name, 200) || 'Thema',
      theme: { id: S(th.id, 60) || 'eigen', name: S(th.name, 200) || 'Thema', colors, fonts: { major: FONT(th.fonts && th.fonts.major) || 'Inter', minor: FONT(th.fonts && th.fonts.minor) || 'Inter' }, variant: N(th.variant, 0, 0, 100) | 0, colorSet: S(th.colorSet, 100), fontSet: S(th.fontSet, 100) },
      bg: App.cleanFill(m.bg) || { type: 'solid', color: 'bg1' },
      objs: (Array.isArray(m.objs) ? m.objs : []).slice(0, 5000).map((o) => App.cleanObj(o)).filter(Boolean),
      tx: { title: lvls(tx.title, 1), body: lvls(tx.body, 9), other: lvls(tx.other, 9) },
      layouts: (Array.isArray(m.layouts) ? m.layouts : []).slice(0, 200).map(App.cleanLayout).filter(Boolean),
    };
    if (!out.layouts.length) out.layouts = App.buildMaster('kantoor').layouts;
    return out;
  };
  App.cleanMedia = (media) => {
    const out = {};
    if (!media || typeof media !== 'object') return out;
    Object.keys(media).slice(0, 5000).forEach((k) => {
      const m = media[k];
      if (!ID_RE.test(k) || !m || typeof m.url !== 'string' || !App.safeUrl(m.url)) return;
      const mime = /^(image|video|audio)\/[a-z0-9.+-]{1,40}$/i.test(m.mime || '') ? m.mime : (m.url.slice(5, m.url.indexOf(';')) || 'application/octet-stream');
      out[k] = strip({ mime, url: m.url, name: S(m.name, 200), nat: m.nat ? { w: N(m.nat.w, 1, 1, 1e6), h: N(m.nat.h, 1, 1, 1e6) } : undefined, h: S(m.h, 40) });
    });
    return out;
  };
  // Hele presentatie inlezen (uit een bestand, de opslag, een koppeling of het klembord)
  App.deserializePres = (o, opts = {}) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error(App.t('Geen geldige presentatie'));
    idMap = new Map();
    try {
      const sizeKind = o.size && App.SIZES[o.size.kind] ? o.size.kind : 'custom';
      const P = {
        format: 'doek', version: 1, id: ID(o.id), title: S(o.title, 300) || App.t('Presentatie'),
        size: { w: N(o.size && o.size.w, 1280, 50, 20000), h: N(o.size && o.size.h, 720, 50, 20000), kind: sizeKind },
        masters: [], slides: [], sections: [], shows: [],
        hf: Object.assign({ dt: false, dtAuto: true, dtFmt: 'short', dtText: '', sldNum: false, ftr: false, ftrText: '', notTitle: true }, o.hf && typeof o.hf === 'object' ? strip({ dt: !!o.hf.dt, dtAuto: o.hf.dtAuto !== false, dtFmt: pick(o.hf.dtFmt, ['short', 'long'], 'short'), dtText: S(o.hf.dtText, 200) || '', sldNum: !!o.hf.sldNum, ftr: !!o.hf.ftr, ftrText: S(o.hf.ftrText, 500) || '', notTitle: o.hf.notTitle !== false }) : {}),
        show: Object.assign({ type: 'speaker', loop: false, timings: true, anims: true, range: null, custom: null, pen: '#e5484d', laser: '#ff2020' }, o.show && typeof o.show === 'object' ? strip({ type: pick(o.show.type, ['speaker', 'window', 'kiosk'], 'speaker'), loop: !!o.show.loop, timings: o.show.timings !== false, anims: o.show.anims !== false, narration: o.show.narration === false ? false : undefined, pen: C(o.show.pen, '#e5484d'), laser: C(o.show.laser, '#ff2020') }) : {}),
        guides: Array.isArray(o.guides) ? o.guides.slice(0, 100).map((g) => ({ dir: g && g.dir === 'h' ? 'h' : 'v', pos: N(g && g.pos, 0, -1e5, 1e5) })) : [],
        lang: /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(o.lang || '') ? o.lang : 'nl-NL',
        props: { created: N(o.props && o.props.created, Date.now(), 0, 1e15), modified: N(o.props && o.props.modified, Date.now(), 0, 1e15), subject: S(o.props && o.props.subject, 500), keywords: S(o.props && o.props.keywords, 500), category: S(o.props && o.props.category, 200) },
      };
      strip(P.props);
      P.masters = (Array.isArray(o.masters) ? o.masters : []).slice(0, 50).map(App.cleanMaster).filter(Boolean);
      if (!P.masters.length) P.masters = [App.buildMaster('kantoor', { size: P.size })];
      P.sections = (Array.isArray(o.sections) ? o.sections : []).slice(0, 500).map((x) => ({ id: ID(x && x.id), name: S(x && x.name, 200) || App.t('Sectie zonder titel') }));
      P.slides = (Array.isArray(o.slides) ? o.slides : []).slice(0, 5000).map(App.cleanSlide).filter(Boolean);
      // verwijzingen naar id's die zijn vervangen, opnieuw koppelen (nu de hele map bekend is)
      const fix = (v) => (typeof v === 'string' && idMap.has(v) ? idMap.get(v) : v);
      const allLayouts = new Set(P.masters.flatMap((m) => m.layouts.map((l) => l.id)));
      P.slides.forEach((s) => {
        s.layout = fix(s.layout);
        if (!allLayouts.has(s.layout)) { const l = P.masters[0].layouts.find((x) => x.type === 'obj') || P.masters[0].layouts[0]; s.layout = l.id; }
        s.anims = s._animsRaw.map(cleanAnim).filter(Boolean).map((a) => ({ ...a, obj: fix(a.obj) }));
        delete s._animsRaw;
        if (s.sec) s.sec = fix(s.sec);
        App.walkObjs(s.objs, (x) => { if (x.type === 'zoom') { x.slide = fix(x.slide); if (x.sec) x.sec = fix(x.sec); } if (x.link && x.link.kind === 'slide') x.link.slide = fix(x.link.slide); if (x.hover && x.hover.kind === 'slide') x.hover.slide = fix(x.hover.slide); if (x.text) x.text.paras.forEach((p) => p.runs.forEach((r) => { if (r.link && r.link.kind === 'slide') r.link.slide = fix(r.link.slide); })); });
      });
      const slideIds = new Set(P.slides.map((s) => s.id));
      P.shows = (Array.isArray(o.shows) ? o.shows : []).slice(0, 100).map((x) => ({ id: ID(x && x.id), name: S(x && x.name, 200) || App.t('Aangepaste voorstelling'), slides: (Array.isArray(x && x.slides) ? x.slides : []).map(fix).filter((id) => slideIds.has(id)) }));
      if (!P.slides.length) P.slides.push(App.newSlide(P.masters[0].layouts.find((l) => l.type === 'title') || P.masters[0].layouts[0], P));
      if (P.sections.length) { const secIds = new Set(P.sections.map((x) => x.id)); P.slides.forEach((s) => { if (!secIds.has(s.sec)) delete s.sec; }); }
      if (o.share && typeof o.share === 'object' && opts.keepShare !== false) P.share = strip({ id: /^[a-z0-9]{8,16}$/.test(o.share.id) ? o.share.id : undefined, owner: /^[a-z0-9]{8,48}$/.test(o.share.owner || '') ? o.share.owner : undefined, server: /^https?:\/\/[A-Za-z0-9.:[\]-]{1,100}$/.test(o.share.server || '') ? o.share.server : undefined, code: S(o.share.code, 40), perm: pick(o.share.perm, ['edit', 'view'], 'edit'), by: S(o.share.by, 80), link: /^https?:\/\//.test(o.share.link || '') ? S(o.share.link, 300) : undefined });
      if (P.share && (!P.share.id || !P.share.server)) delete P.share;
      if (o.media && opts.media !== false) Object.assign(App.media, App.cleanMedia(o.media));
      return P;
    } finally { idMap = null; }
  };
})();
