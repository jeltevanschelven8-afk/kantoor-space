/* =========================================================
   Doek (gemaakt door JJ van Schelven) — weergave van dia's en objecten.
   Eén renderer (DOM + SVG) voor bewerken, miniaturen, voorstelling, afdrukken en
   exporteren, zodat de dia overal precies hetzelfde is.
   Documentgegevens komen nooit als HTML in de pagina: alle tekst via textContent.
   ========================================================= */
'use strict';

(() => {
  const PT = App.PT;
  const NS = 'http://www.w3.org/2000/svg';
  let uidc = 0;
  const nid = (p) => p + (++uidc).toString(36);
  const r2 = (v) => App.round(v, 2);
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]); return e; };
  App.svgEl = svgEl;
  // Alleen veilige adressen voor afbeeldingen/media
  App.safeUrl = (u) => (typeof u === 'string' && /^(data:(image|video|audio)\/[a-z0-9.+-]+[;,]|blob:)/i.test(u) ? u : '');
  App.mediaUrl = (id) => (id && App.media[id] ? App.safeUrl(App.media[id].url) : '');

  /* ---------- Opvulling ---------- */
  const PATTERNS = {
    pct5: [[0, 0, 1, 1]], pct10: [[0, 0, 1, 1], [4, 4, 1, 1]], pct20: [[0, 0, 1, 1], [4, 4, 1, 1], [2, 2, 1, 1], [6, 6, 1, 1]],
    pct25: [[0, 0, 1, 1], [4, 0, 1, 1], [2, 2, 1, 1], [6, 2, 1, 1], [0, 4, 1, 1], [4, 4, 1, 1], [2, 6, 1, 1], [6, 6, 1, 1]],
    pct50: 'check1', pct75: 'inv25', pct90: 'inv10',
    horz: [[0, 0, 8, 1], [0, 4, 8, 1]], vert: [[0, 0, 1, 8], [4, 0, 1, 8]], ltHorz: [[0, 0, 8, 1], [0, 4, 8, 1]], ltVert: [[0, 0, 1, 8], [4, 0, 1, 8]],
    dkHorz: [[0, 0, 8, 2], [0, 4, 8, 2]], dkVert: [[0, 0, 2, 8], [4, 0, 2, 8]], narHorz: [[0, 0, 8, 1], [0, 2, 8, 1], [0, 4, 8, 1], [0, 6, 8, 1]], narVert: [[0, 0, 1, 8], [2, 0, 1, 8], [4, 0, 1, 8], [6, 0, 1, 8]],
    cross: [[0, 0, 8, 1], [0, 0, 1, 8]], smGrid: [[0, 0, 8, 1], [0, 0, 1, 8], [0, 4, 8, 1], [4, 0, 1, 8]], lgGrid: [[0, 0, 8, 1], [0, 0, 1, 8]],
    smCheck: 'check2', lgCheck: 'check4', dotGrid: [[0, 0, 1, 1], [2, 0, 1, 1], [4, 0, 1, 1], [6, 0, 1, 1], [0, 4, 1, 1], [2, 4, 1, 1], [4, 4, 1, 1], [6, 4, 1, 1]],
    dnDiag: 'dn', upDiag: 'up', ltDnDiag: 'dn', ltUpDiag: 'up', dkDnDiag: 'dn2', dkUpDiag: 'up2', wdDnDiag: 'dn3', wdUpDiag: 'up3', diagCross: 'x', dashDnDiag: 'dn', dashUpDiag: 'up',
  };
  const patternEl = (fill, theme) => {
    const id = nid('pt');
    const fg = App.color(fill.fg || 'tx1', theme), bg = App.color(fill.bg || 'bg1', theme);
    const p = svgEl('pattern', { id, width: 8, height: 8, patternUnits: 'userSpaceOnUse' });
    p.appendChild(svgEl('rect', { width: 8, height: 8, fill: bg }));
    const def = PATTERNS[fill.pat] || 'check1';
    const add = (x, y, w, h) => p.appendChild(svgEl('rect', { x, y, width: w, height: h, fill: fg }));
    if (Array.isArray(def)) def.forEach((r) => add(...r));
    else if (/^check(\d)$/.test(def)) { const s = +def.slice(5); for (let y = 0; y < 8; y += s) for (let x = 0; x < 8; x += s) if (((x + y) / s) % 2 === 0) add(x, y, s, s); }
    else if (def === 'inv25') { p.firstChild.setAttribute('fill', fg); [[0, 0], [4, 4]].forEach(([x, y]) => p.appendChild(svgEl('rect', { x, y, width: 1, height: 1, fill: bg }))); }
    else if (def === 'inv10') { p.firstChild.setAttribute('fill', fg); p.appendChild(svgEl('rect', { x: 0, y: 0, width: 1, height: 1, fill: bg })); }
    else {
      const w = { dn: 1, up: 1, dn2: 2, up2: 2, dn3: 3, up3: 3, x: 1 }[def] || 1;
      const ln = (x1, y1, x2, y2) => p.appendChild(svgEl('line', { x1, y1, x2, y2, stroke: fg, 'stroke-width': w, 'stroke-linecap': 'square' }));
      if (def[0] === 'd' || def === 'x') { ln(0, 0, 8, 8); ln(-4, 4, 4, 12); ln(4, -4, 12, 4); }
      if (def[0] === 'u' || def === 'x') { ln(0, 8, 8, 0); ln(-4, 4, 4, -4); ln(4, 12, 12, 4); }
    }
    return p;
  };
  // Geeft { paint, opacity } voor SVG en voegt zo nodig een verloop/patroon toe aan defs
  App.svgPaint = (fill, theme, defs, box) => {
    if (!fill || fill.type === 'none') return { paint: 'none' };
    if (fill.type === 'solid') return { paint: App.color(fill.color, theme) || '#000000', opacity: fill.alpha };
    if (fill.type === 'grad') {
      const id = nid('g');
      const stops = (fill.stops || []).slice().sort((a, b) => a.p - b.p);
      let g;
      if ((fill.kind || 'linear') === 'linear') {
        const a = ((fill.angle || 0) % 360) * Math.PI / 180;
        const cx = 0.5, cy = 0.5, dx = Math.cos(a) / 2, dy = Math.sin(a) / 2;
        g = svgEl('linearGradient', { id, x1: r2(cx - dx), y1: r2(cy - dy), x2: r2(cx + dx), y2: r2(cy + dy) });
      } else {
        g = svgEl('radialGradient', { id, cx: fill.cx !== undefined ? fill.cx : 0.5, cy: fill.cy !== undefined ? fill.cy : 0.5, r: fill.kind === 'rect' ? 0.5 : 0.71, fx: fill.cx, fy: fill.cy });
      }
      stops.forEach((s) => g.appendChild(svgEl('stop', { offset: r2(App.clamp(s.p, 0, 1)), 'stop-color': App.color(s.color, theme), 'stop-opacity': s.alpha === undefined ? 1 : s.alpha })));
      defs.appendChild(g);
      return { paint: `url(#${id})` };
    }
    if (fill.type === 'img') {
      const url = App.mediaUrl(fill.media);
      if (!url) return { paint: '#d9d9d9' };
      const id = nid('pi');
      const tile = fill.mode === 'tile';
      const nat = (App.media[fill.media] && App.media[fill.media].nat) || { w: 200, h: 200 };
      const w = tile ? nat.w * (fill.sx || 1) : box.w, h = tile ? nat.h * (fill.sy || 1) : box.h;
      const p = svgEl('pattern', { id, width: r2(w), height: r2(h), patternUnits: 'userSpaceOnUse' });
      p.appendChild(svgEl('image', { href: url, width: r2(w), height: r2(h), preserveAspectRatio: 'none' }));
      defs.appendChild(p);
      return { paint: `url(#${id})`, opacity: fill.alpha };
    }
    if (fill.type === 'pattern') { const p = patternEl(fill, theme); defs.appendChild(p); return { paint: `url(#${p.id})` }; }
    return { paint: 'none' };
  };
  // CSS-achtergrond voor HTML-elementen (dia-achtergrond, tabelcellen)
  App.fillCss = (fill, theme) => {
    if (!fill || fill.type === 'none') return 'transparent';
    if (fill.type === 'solid') return App.rgba(fill.color, fill.alpha === undefined ? 1 : fill.alpha, theme);
    if (fill.type === 'grad') return App.gradCss(fill, theme);
    if (fill.type === 'img') { const u = App.mediaUrl(fill.media); return u ? `url("${u}") center / ${fill.mode === 'tile' ? 'auto' : '100% 100%'} ${fill.mode === 'tile' ? 'repeat' : 'no-repeat'}` : '#d9d9d9'; }
    if (fill.type === 'pattern') return App.color(fill.bg || 'bg1', theme);
    return 'transparent';
  };

  /* ---------- Lijnen ---------- */
  const DASH = { solid: null, sysDot: [1, 1], sysDash: [3, 1], dash: [4, 3], dashDot: [4, 3, 1, 3], lgDash: [8, 3], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDashDot: [3, 1, 1, 1], sysDashDotDot: [3, 1, 1, 1, 1, 1] };
  App.strokeAttrs = (line, theme, defs, box) => {
    if (!line || line.type === 'none') return { stroke: 'none' };
    const w = Math.max(0.1, App.num(line.w, 0.75)) * PT;
    let paint = App.color(line.color || 'tx1', theme);
    if (line.type === 'grad' && defs) paint = App.svgPaint(line, theme, defs, box).paint;
    const a = { stroke: paint, 'stroke-width': r2(w), 'stroke-linejoin': line.join === 'bevel' ? 'bevel' : line.join === 'miter' ? 'miter' : 'round', 'stroke-linecap': line.cap === 'rnd' ? 'round' : line.cap === 'sq' ? 'square' : 'butt' };
    if (line.alpha !== undefined && line.alpha < 1) a['stroke-opacity'] = line.alpha;
    const d = DASH[line.dash];
    if (d) a['stroke-dasharray'] = d.map((v) => r2(v * w)).join(' ');
    return a;
  };
  // Pijlpunt aan een uiteinde: tip = punt, dir = richting vanaf de lijn naar de tip
  const arrowHead = (g, kind, tip, from, w, color, alpha) => {
    if (!kind || kind.type === 'none') return 0;
    const sz = { sm: 2, med: 3, lg: 5 };
    const lw = Math.max(1, w);
    const L = (sz[kind.len] || 3) * lw, W = (sz[kind.w] || 3) * lw;
    const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pt = (x, y) => [tip[0] + x * ca - y * sa, tip[1] + x * sa + y * ca];   // lokaal: x langs de lijn (negatief = terug), y dwars
    const P = (pts) => 'M' + pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join(' L') + ' Z';
    const op = alpha !== undefined && alpha < 1 ? alpha : undefined;
    if (kind.type === 'triangle') { g.appendChild(svgEl('path', { d: P([pt(0, 0), pt(-L, W / 2), pt(-L, -W / 2)]), fill: color, 'fill-opacity': op })); return L * 0.9; }
    if (kind.type === 'stealth') { g.appendChild(svgEl('path', { d: P([pt(0, 0), pt(-L, W / 2), pt(-L * 0.6, 0), pt(-L, -W / 2)]), fill: color, 'fill-opacity': op })); return L * 0.55; }
    if (kind.type === 'diamond') { g.appendChild(svgEl('path', { d: P([pt(L / 2, 0), pt(0, W / 2), pt(-L / 2, 0), pt(0, -W / 2)]), fill: color, 'fill-opacity': op })); return 0; }
    if (kind.type === 'oval') { const c = pt(0, 0); g.appendChild(svgEl('ellipse', { cx: r2(c[0]), cy: r2(c[1]), rx: r2(L / 2), ry: r2(W / 2), transform: `rotate(${r2(ang * 180 / Math.PI)} ${r2(c[0])} ${r2(c[1])})`, fill: color, 'fill-opacity': op })); return 0; }
    if (kind.type === 'arrow') { g.appendChild(svgEl('path', { d: 'M' + [pt(-L, W / 2), pt(0, 0), pt(-L, -W / 2)].map((p) => r2(p[0]) + ' ' + r2(p[1])).join(' L'), fill: 'none', stroke: color, 'stroke-width': r2(lw), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-opacity': op })); return lw / 2; }
    return 0;
  };

  /* ---------- Effecten (SVG-filter) ---------- */
  const effectFilter = (fx, theme, defs) => {
    if (!fx || (!fx.shadow && !fx.glow && !fx.soft)) return null;
    const id = nid('fx');
    const f = svgEl('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB' });
    let src = 'SourceGraphic';
    if (fx.soft) {
      f.appendChild(svgEl('feMorphology', { in: 'SourceAlpha', operator: 'erode', radius: r2(fx.soft / 3), result: 'er' }));
      f.appendChild(svgEl('feGaussianBlur', { in: 'er', stdDeviation: r2(fx.soft / 3), result: 'eb' }));
      f.appendChild(svgEl('feComposite', { in: 'SourceGraphic', in2: 'eb', operator: 'in', result: 'soft' }));
      src = 'soft';
    }
    const layers = [];
    if (fx.glow) {
      const g = fx.glow;
      f.appendChild(svgEl('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: r2(g.size / 3), result: 'gd' }));
      f.appendChild(svgEl('feGaussianBlur', { in: 'gd', stdDeviation: r2(g.size / 2.5), result: 'gb' }));
      f.appendChild(svgEl('feFlood', { 'flood-color': App.color(g.color || 'accent1', theme), 'flood-opacity': g.alpha === undefined ? 0.6 : g.alpha, result: 'gc' }));
      f.appendChild(svgEl('feComposite', { in: 'gc', in2: 'gb', operator: 'in', result: 'glow' }));
      layers.push('glow');
    }
    if (fx.shadow) {
      const s = fx.shadow;
      const r = (s.dir || 0) * Math.PI / 180, d = s.dist || 0;
      const color = App.color(s.color || '#000000', theme), op = s.alpha === undefined ? 0.4 : s.alpha;
      if (s.type === 'inner') {
        f.appendChild(svgEl('feOffset', { in: 'SourceAlpha', dx: r2(Math.cos(r) * d), dy: r2(Math.sin(r) * d), result: 'io' }));
        f.appendChild(svgEl('feGaussianBlur', { in: 'io', stdDeviation: r2((s.blur || 4) / 2), result: 'ib' }));
        f.appendChild(svgEl('feComposite', { in: 'SourceAlpha', in2: 'ib', operator: 'out', result: 'iinv' }));
        f.appendChild(svgEl('feFlood', { 'flood-color': color, 'flood-opacity': op, result: 'ic' }));
        f.appendChild(svgEl('feComposite', { in: 'ic', in2: 'iinv', operator: 'in', result: 'ish' }));
        f.appendChild(svgEl('feComposite', { in: 'ish', in2: 'SourceAlpha', operator: 'in', result: 'inner' }));
        const m = svgEl('feMerge'); [...layers, src, 'inner'].forEach((x) => m.appendChild(svgEl('feMergeNode', { in: x }))); f.appendChild(m);
        defs.appendChild(f); return id;
      }
      f.appendChild(svgEl('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: r2((s.blur || 0) / 2), result: 'sb' }));
      f.appendChild(svgEl('feOffset', { in: 'sb', dx: r2(Math.cos(r) * d), dy: r2(Math.sin(r) * d), result: 'so' }));
      f.appendChild(svgEl('feFlood', { 'flood-color': color, 'flood-opacity': op, result: 'sc' }));
      f.appendChild(svgEl('feComposite', { in: 'sc', in2: 'so', operator: 'in', result: 'shadow' }));
      layers.unshift('shadow');
    }
    const m = svgEl('feMerge'); [...layers, src].forEach((x) => m.appendChild(svgEl('feMergeNode', { in: x }))); f.appendChild(m);
    defs.appendChild(f);
    return id;
  };
  // CSS-effecten op het hele object: reflectie en 3D-draaiing
  const objCssFx = (fx) => {
    const css = [];
    if (fx && fx.refl) css.push(`-webkit-box-reflect:below ${r2(fx.refl.dist || 0)}px linear-gradient(transparent ${Math.round((1 - App.clamp(fx.refl.size || 0.5, 0.05, 1)) * 100)}%, rgba(255,255,255,${App.clamp(fx.refl.alpha === undefined ? 0.5 : fx.refl.alpha, 0, 1)}))`);
    return css;
  };

  /* ---------- Standaardstijl van vormen ---------- */
  App.objFill = (o) => {
    if (o.fill) return o.fill;
    if (o.type === 'shape' && !o.txbox && !o.ph) return { type: 'solid', color: 'accent1' };
    return { type: 'none' };
  };
  App.objLine = (o) => {
    if (o.line) return o.line;
    if (o.type === 'line') return { type: 'solid', color: 'accent1', w: 1 };
    if (o.type === 'shape' && !o.txbox && !o.ph) return { type: 'solid', color: 'accent1/d25', w: 1 };
    return { type: 'none' };
  };
  App.objTextColorDefault = (o) => (o.type === 'shape' && !o.txbox && !o.ph ? 'lt1' : null);

  /* ---------- Geometrie ---------- */
  const rectGeo = (w, h) => ({ paths: [{ d: `M0 0 L${r2(w)} 0 L${r2(w)} ${r2(h)} L0 ${r2(h)} Z`, fill: 'norm', stroke: true }], text: { l: 0, t: 0, r: w, b: h }, handles: [], sites: [] });
  App.geo = (o, w, h) => {
    if (o.path && o.path.subs) {
      const sx = o.path.w ? w / o.path.w : 1, sy = o.path.h ? h / o.path.h : 1;
      const d = o.path.subs.map((s) => {
        if (!s.pts.length) return '';
        let out = `M${r2(s.pts[0].x * sx)} ${r2(s.pts[0].y * sy)}`;
        for (let i = 1; i < s.pts.length; i++) {
          const p = s.pts[i];
          out += p.c1 && p.c2 ? ` C${r2(p.c1[0] * sx)} ${r2(p.c1[1] * sy)} ${r2(p.c2[0] * sx)} ${r2(p.c2[1] * sy)} ${r2(p.x * sx)} ${r2(p.y * sy)}` : ` L${r2(p.x * sx)} ${r2(p.y * sy)}`;
        }
        if (s.closed) { const p = s.pts[0], q = s.close; out += q && q.c1 ? ` C${r2(q.c1[0] * sx)} ${r2(q.c1[1] * sy)} ${r2(q.c2[0] * sx)} ${r2(q.c2[1] * sy)} ${r2(p.x * sx)} ${r2(p.y * sy)} Z` : ' Z'; }
        return out;
      }).join(' ');
      const open = o.path.subs.every((s) => !s.closed);
      return { paths: [{ d, fill: open ? 'none' : 'norm', stroke: true }], text: { l: 0, t: 0, r: w, b: h }, handles: [], sites: [] };
    }
    const g = o.geom || 'rect';
    if (g === 'rect' || !App.Shapes || !App.Shapes.geometry) return rectGeo(w, h);
    try { return App.Shapes.geometry(g, w, h, o.adj || {}) || rectGeo(w, h); } catch (e) { console.warn('geometrie', g, e); return rectGeo(w, h); }
  };

  /* ---------- Objecten ---------- */
  // ctx: { mode: 'edit'|'thumb'|'show'|'print'|'export', theme, owner, num, layer: 'master'|'layout'|'slide', split }
  App.renderObj = (o, ctx) => {
    if (o.hidden && ctx.mode !== 'edit') return null;
    const owner = ctx.owner;
    const b = ctx.inGroup ? { x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot || 0 } : App.box(o, owner);
    const el = document.createElement('div');
    el.className = 'ob ' + o.type + (o.ph ? ' ph ph-' + o.ph.type : '') + (o.hidden ? ' is-hidden' : '');
    el.dataset.id = o.id;
    const w = Math.max(0, App.num(b.w, 0)), h = Math.max(0, App.num(b.h, 0));
    const css = [`left:${r2(App.num(b.x, 0))}px`, `top:${r2(App.num(b.y, 0))}px`, `width:${r2(w)}px`, `height:${r2(h)}px`];
    const tf = [];
    if (o.fx && o.fx.rot3d) tf.push(`perspective(${r2(o.fx.rot3d.persp || 800)}px)`, `rotateX(${r2(o.fx.rot3d.x || 0)}deg)`, `rotateY(${r2(o.fx.rot3d.y || 0)}deg)`);
    if (b.rot) tf.push(`rotate(${r2(b.rot)}deg)`);
    if (tf.length) css.push('transform:' + tf.join(' '));
    css.push(...objCssFx(o.fx));
    el.style.cssText = css.join(';');
    const theme = ctx.theme;
    const fn = TYPES[o.type] || TYPES.shape;
    try { fn(el, o, { ...b, w, h }, ctx, theme); } catch (e) { console.error('tekenen mislukt', o.type, e); el.classList.add('broken'); }
    if (o.link && ctx.mode === 'show') el.classList.add('has-link');
    return el;
  };

  // SVG met de geometrie van een vorm (paden, opvulling, lijn, effecten); flip spiegelt alleen de geometrie
  const shapeSvg = (o, w, h, theme, opts = {}) => {
    const svg = svgEl('svg', { class: 'geo', width: r2(w), height: r2(h), viewBox: `0 0 ${r2(w) || 1} ${r2(h) || 1}`, overflow: 'visible' });
    const defs = svgEl('defs'); svg.appendChild(defs);
    const geo = App.geo(o, w, h);
    const fill = opts.fill || App.objFill(o), line = opts.line || App.objLine(o);
    const paint = App.svgPaint(fill, theme, defs, { w, h });
    const st = App.strokeAttrs(line, theme, defs, { w, h });
    const g = svgEl('g');
    if (o.flipH || o.flipV) g.setAttribute('transform', `translate(${o.flipH ? r2(w) : 0} ${o.flipV ? r2(h) : 0}) scale(${o.flipH ? -1 : 1} ${o.flipV ? -1 : 1})`);
    const fid = effectFilter(o.fx, theme, defs);
    if (fid) g.setAttribute('filter', `url(#${fid})`);
    geo.paths.forEach((p) => {
      const filled = p.fill !== 'none' && paint.paint !== 'none';
      if (filled) {
        g.appendChild(svgEl('path', { d: p.d, fill: paint.paint, 'fill-opacity': paint.opacity, stroke: 'none' }));
        const mod = { darken: ['#000', 0.4], darkenLess: ['#000', 0.2], lighten: ['#fff', 0.4], lightenLess: ['#fff', 0.2] }[p.fill];
        if (mod) g.appendChild(svgEl('path', { d: p.d, fill: mod[0], 'fill-opacity': mod[1] * (paint.opacity === undefined ? 1 : paint.opacity), stroke: 'none' }));
      }
      if (p.stroke !== false && st.stroke !== 'none') g.appendChild(svgEl('path', { d: p.d, fill: 'none', ...st }));
    });
    if (o.fx && o.fx.bevel && paint.paint !== 'none') {
      const id = nid('bv');
      const lg = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 });
      [[0, '#fff', 0.45], [0.45, '#fff', 0], [0.55, '#000', 0], [1, '#000', 0.3]].forEach(([p, c, a]) => lg.appendChild(svgEl('stop', { offset: p, 'stop-color': c, 'stop-opacity': a })));
      defs.appendChild(lg);
      geo.paths.filter((p) => p.fill !== 'none').forEach((p) => g.appendChild(svgEl('path', { d: p.d, fill: `url(#${id})`, stroke: 'none' })));
    }
    svg.appendChild(g);
    return { svg, geo };
  };
  App.shapeSvg = shapeSvg;

  const addText = (el, o, b, ctx, theme, rect) => {
    if (!o.text) return;
    const empty = App.isEmptyText(o);
    const owner = ctx.owner;
    if (empty && o.ph) {
      if (ctx.mode !== 'edit' || ctx.layer !== 'slide') {
        if (ctx.layer === 'layout' || ctx.layer === 'master') {
          // in het diamodel: de voorbeeldtekst van de placeholder laten zien
          const t = el.appendChild(App.renderTextBox({ ...o, text: { ...o.text, paras: promptParas(o, owner) } }, owner, rect, { ...ctx, mode: 'prompt' }));
          t.classList.add('prompt');
        }
        return;
      }
      const t = el.appendChild(App.renderTextBox({ ...o, text: { ...o.text, paras: promptParas(o, owner) } }, owner, rect, { ...ctx, mode: 'prompt' }));
      t.classList.add('prompt');
      return;
    }
    const box = App.renderTextBox(o, owner, rect, ctx);
    if (o.flipV && o.type === 'shape' && !o.ph) box.style.transform = (box.style.transform || '') + ' rotate(180deg)';
    el.appendChild(box);
  };
  const promptParas = (o, owner) => {
    let prompt = o.ph && o.ph.prompt;
    if (!prompt && o.ph) { const { lph } = App.phChain(o, owner); prompt = lph && lph.ph && lph.ph.prompt; }
    prompt = App.t(prompt || App.PROMPTS[o.ph.type] || App.PROMPTS.body);
    if (/^(obj|body)$/.test(o.ph.type) && owner && owner.layouts) {
      return [prompt, App.t('Tweede niveau'), App.t('Derde niveau'), App.t('Vierde niveau'), App.t('Vijfde niveau')].map((t, i) => ({ runs: [{ t }], lvl: i }));
    }
    return [{ runs: [{ t: prompt }] }];
  };

  const TYPES = {};
  App.RENDER_TYPES = TYPES;   // andere modules kunnen hier eigen objectsoorten aanmelden (bijv. zoom)
  TYPES.shape = (el, o, b, ctx, theme) => {
    const { svg } = shapeSvg(o, b.w, b.h, theme);
    el.appendChild(svg);
    const rect = App.textRect(o, b);
    // standaard tekstkleur in een gevulde vorm: licht (lt1)
    addText(el, o, b, ctx, theme, rect);
    if (o.ph && ctx.mode === 'edit' && ctx.layer === 'slide' && App.isEmptyText(o) && /^(obj|pic|chart|tbl|media)$/.test(o.ph.type)) el.appendChild(phInsertIcons(o.ph.type));
    if (o.ph && o.ph.type === 'pic' && ctx.layer === 'slide' && ctx.mode === 'edit' && !App.isEmptyText(o)) { /* tekst in een afbeeldingsplaceholder: niets extra */ }
  };
  const phInsertIcons = (type) => {
    const d = document.createElement('div');
    d.className = 'ph-ins';
    const all = [['table', 'table', 'Tabel invoegen'], ['chart', 'bar_chart', 'Grafiek invoegen'], ['diagram', 'account_tree', 'Diagram invoegen'], ['picture', 'image', 'Afbeeldingen'], ['icon', 'emoji_symbols', 'Pictogrammen invoegen'], ['video', 'movie', 'Video invoegen']];
    const pick = type === 'obj' ? all : all.filter(([k]) => ({ pic: 'picture', chart: 'chart', tbl: 'table', media: 'video' }[type] === k));
    pick.forEach(([k, ic, title]) => {
      const bt = document.createElement('button');
      bt.className = 'ph-btn'; bt.dataset.phins = k; bt.title = App.t(title);
      const s = document.createElement('span'); s.className = 'i'; s.textContent = ic; bt.appendChild(s);
      d.appendChild(bt);
    });
    return d;
  };

  TYPES.line = (el, o, b, ctx, theme) => {
    const pts = o.pts || [[b.x, b.y], [b.x + b.w, b.y + b.h]];
    const ox = b.x, oy = b.y;
    const p1 = [pts[0][0] - ox, pts[0][1] - oy], p2 = [pts[1][0] - ox, pts[1][1] - oy];
    const svg = svgEl('svg', { class: 'geo', width: r2(Math.max(1, b.w)), height: r2(Math.max(1, b.h)), overflow: 'visible' });
    const defs = svgEl('defs'); svg.appendChild(defs);
    const line = App.objLine(o);
    const st = App.strokeAttrs(line, theme, defs, b);
    const g = svgEl('g');
    const fid = effectFilter(o.fx, theme, defs);
    if (fid) g.setAttribute('filter', `url(#${fid})`);
    const lw = line.type === 'none' ? 0 : App.num(line.w, 0.75) * PT;
    const color = App.color(line.color || 'tx1', theme);
    // pad volgens het soort verbindingslijn
    const kind = o.geom || 'line';
    let d, from1 = p2, from2 = p1;
    if (/^bentConnector/.test(kind)) {
      const t = (o.adj && o.adj.adj1 !== undefined ? o.adj.adj1 : 50000) / 100000;
      const xm = p1[0] + (p2[0] - p1[0]) * t;
      d = `M${r2(p1[0])} ${r2(p1[1])} L${r2(xm)} ${r2(p1[1])} L${r2(xm)} ${r2(p2[1])} L${r2(p2[0])} ${r2(p2[1])}`;
      from1 = [xm, p1[1]]; from2 = [xm, p2[1]];
      if (Math.abs(p2[0] - xm) < 0.5) from2 = [xm, p1[1]];
      if (Math.abs(p1[0] - xm) < 0.5) from1 = [xm, p2[1]];
    } else if (/^curvedConnector/.test(kind)) {
      const xm = (p1[0] + p2[0]) / 2;
      d = `M${r2(p1[0])} ${r2(p1[1])} C${r2(xm)} ${r2(p1[1])} ${r2(xm)} ${r2(p2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
      from1 = [xm, p1[1]]; from2 = [xm, p2[1]];
    } else d = `M${r2(p1[0])} ${r2(p1[1])} L${r2(p2[0])} ${r2(p2[1])}`;
    if (line.type !== 'none') {
      const hg = svgEl('g');
      arrowHead(hg, line.head, p1, from1, lw, color, line.alpha);
      arrowHead(hg, line.tail, p2, from2, lw, color, line.alpha);
      g.appendChild(svgEl('path', { d, fill: 'none', ...st }));
      g.appendChild(hg);
    }
    svg.appendChild(g);
    el.appendChild(svg);
    // breed onzichtbaar pad om de lijn makkelijk te kunnen aanklikken
    if (ctx.mode === 'edit') { const hit = svgEl('path', { d, class: 'hit', fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(10, lw + 8) }); svg.appendChild(hit); }
  };
  App.arrowHead = arrowHead;

  /* Afbeeldingen: bijsnijden, bijsnijden naar vorm, kleur en filters (vaste algoritmes) */
  const imageFilter = (pic, defs) => {
    if (!pic) return null;
    const bright = App.num(pic.bright, 0), contrast = App.num(pic.contrast, 0), sat = pic.sat === undefined ? 1 : pic.sat;
    const rc = pic.recolor, blur = App.num(pic.blur, 0), sharp = App.num(pic.sharpen, 0), art = pic.art;
    if (!bright && !contrast && sat === 1 && !rc && !blur && !sharp && !art) return null;
    const id = nid('im');
    const f = svgEl('filter', { id, 'color-interpolation-filters': 'sRGB', x: '0', y: '0', width: '100%', height: '100%' });
    let last = 'SourceGraphic', n = 0;
    const step = (el) => { const r = 'r' + (++n); el.setAttribute('in', last); el.setAttribute('result', r); f.appendChild(el); last = r; return el; };
    if (blur) step(svgEl('feGaussianBlur', { stdDeviation: r2(blur) }));
    if (sharp) { const k = r2(sharp * 1.5); step(svgEl('feConvolveMatrix', { order: 3, kernelMatrix: `0 ${-k} 0 ${-k} ${r2(1 + 4 * k)} ${-k} 0 ${-k} 0`, preserveAlpha: 'true' })); }
    if (bright || contrast) {
      const c = Math.tan((App.clamp(contrast, -0.99, 0.99) + 1) * Math.PI / 4);
      const slope = c, icpt = 0.5 - 0.5 * c + bright;
      const ct = svgEl('feComponentTransfer');
      ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'linear', slope: r2(slope), intercept: App.round(icpt, 3) })));
      step(ct);
    }
    if (sat !== 1) step(svgEl('feColorMatrix', { type: 'saturate', values: r2(App.clamp(sat, 0, 4)) }));
    if (rc === 'gray') step(svgEl('feColorMatrix', { type: 'saturate', values: 0 }));
    else if (rc === 'sepia') step(svgEl('feColorMatrix', { type: 'matrix', values: '0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0' }));
    else if (rc === 'wash') { const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'linear', slope: 0.35, intercept: 0.62 }))); step(ct); }
    else if (rc === 'bw') {
      step(svgEl('feColorMatrix', { type: 'saturate', values: 0 }));
      const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'discrete', tableValues: '0 1' }))); step(ct);
    } else if (rc === 'invert') { const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'table', tableValues: '1 0' }))); step(ct); }
    else if (rc && rc.startsWith('duo:')) {
      const [cr, cg, cb] = App.hexToRgb(App.color(rc.slice(4))).map((v) => v / 255);
      step(svgEl('feColorMatrix', { type: 'saturate', values: 0 }));
      const ct = svgEl('feComponentTransfer');
      [['R', cr], ['G', cg], ['B', cb]].forEach(([ch, v]) => ct.appendChild(svgEl('feFunc' + ch, { type: 'table', tableValues: `${App.round(v * 0.25, 3)} ${App.round(Math.min(1, v + (1 - v) * 0.85), 3)}` })));
      step(ct);
    }
    if (art === 'poster') { const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'discrete', tableValues: '0 0.33 0.66 1' }))); step(ct); }
    else if (art === 'edges') { step(svgEl('feConvolveMatrix', { order: 3, kernelMatrix: '-1 -1 -1 -1 8 -1 -1 -1 -1', preserveAlpha: 'true' })); const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'table', tableValues: '1 0' }))); step(ct); }
    else if (art === 'pencil') { step(svgEl('feColorMatrix', { type: 'saturate', values: 0 })); step(svgEl('feConvolveMatrix', { order: 3, kernelMatrix: '-1 -1 -1 -1 8 -1 -1 -1 -1', preserveAlpha: 'true' })); const ct = svgEl('feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => ct.appendChild(svgEl('feFunc' + ch, { type: 'linear', slope: -2.2, intercept: 1 }))); step(ct); }
    else if (art === 'glow') { step(svgEl('feGaussianBlur', { stdDeviation: 3 })); const m = svgEl('feBlend', { in2: 'SourceGraphic', mode: 'screen' }); step(m); }
    defs.appendChild(f);
    return id;
  };
  TYPES.image = (el, o, b, ctx, theme) => {
    const url = App.mediaUrl(o.media);
    const svg = svgEl('svg', { class: 'geo', width: r2(b.w), height: r2(b.h), viewBox: `0 0 ${r2(b.w) || 1} ${r2(b.h) || 1}`, overflow: 'visible' });
    const defs = svgEl('defs'); svg.appendChild(defs);
    const geo = App.geo({ ...o, geom: o.geom || 'rect' }, b.w, b.h);
    const clip = svgEl('clipPath', { id: nid('cl') });
    geo.paths.filter((p) => p.fill !== 'none').forEach((p) => clip.appendChild(svgEl('path', { d: p.d })));
    defs.appendChild(clip);
    const outer = svgEl('g');
    const fid = effectFilter(o.fx, theme, defs);
    if (fid) outer.setAttribute('filter', `url(#${fid})`);
    const g = svgEl('g', { 'clip-path': `url(#${clip.id})` });
    if (o.flipH || o.flipV) g.setAttribute('transform', `translate(${o.flipH ? r2(b.w) : 0} ${o.flipV ? r2(b.h) : 0}) scale(${o.flipH ? -1 : 1} ${o.flipV ? -1 : 1})`);
    const c = o.crop || {};
    const cl = App.num(c.l, 0), ct = App.num(c.t, 0), cr = App.num(c.r, 0), cb = App.num(c.b, 0);
    const fw = 1 - cl - cr || 1, fh = 1 - ct - cb || 1;
    const iw = b.w / fw, ih = b.h / fh;
    if (url) {
      const img = svgEl('image', { href: url, x: r2(-cl * iw), y: r2(-ct * ih), width: r2(iw), height: r2(ih), preserveAspectRatio: 'none' });
      const ifid = imageFilter(o.pic, defs);
      if (ifid) img.setAttribute('filter', `url(#${ifid})`);
      if (o.pic && o.pic.alpha !== undefined && o.pic.alpha < 1) img.setAttribute('opacity', App.clamp(o.pic.alpha, 0, 1));
      g.appendChild(img);
    } else {
      g.appendChild(svgEl('rect', { width: r2(b.w), height: r2(b.h), fill: '#e8e8e8' }));
      if (ctx.mode === 'edit') { const t = svgEl('text', { x: r2(b.w / 2), y: r2(b.h / 2), 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#888', 'font-size': 14, 'font-family': 'Inter, sans-serif' }); t.textContent = App.t('Afbeelding ontbreekt'); g.appendChild(t); }
    }
    outer.appendChild(g);
    const line = o.line;
    if (line && line.type !== 'none') { const st = App.strokeAttrs(line, theme, defs, b); geo.paths.forEach((p) => outer.appendChild(svgEl('path', { d: p.d, fill: 'none', ...st }))); }
    svg.appendChild(outer);
    el.appendChild(svg);
    if (o.text && !App.isEmptyText(o)) addText(el, o, b, ctx, theme, { x: 0, y: 0, w: b.w, h: b.h });
  };

  /* Tabellen */
  TYPES.table = (el, o, b, ctx, theme) => {
    const t = document.createElement('table');
    t.className = 'tb';
    const cg = document.createElement('colgroup');
    (o.cols || []).forEach((w) => { const c = document.createElement('col'); c.style.width = r2(w) + 'px'; cg.appendChild(c); });
    t.appendChild(cg);
    const nR = o.rows.length, nC = (o.cols || []).length;
    const tstyle = App.tableStyle ? App.tableStyle(o, theme) : null;
    o.rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      tr.style.height = r2(row.h) + 'px';
      row.cells.forEach((cell, c) => {
        if (cell.merged) return;
        const td = document.createElement('td');
        td.dataset.r = r; td.dataset.c = c;
        if (cell.span) { if (cell.span.c > 1) td.colSpan = cell.span.c; if (cell.span.r > 1) td.rowSpan = cell.span.r; }
        const cs = tstyle ? tstyle(r, c, nR, nC) : {};
        const fill = cell.fill || cs.fill;
        const css = ['background:' + App.fillCss(fill, theme)];
        const ins = cell.ins || { l: 9.6, t: 4.8, r: 9.6, b: 4.8 };
        css.push(`padding:${ins.t}px ${ins.r}px ${ins.b}px ${ins.l}px`);
        css.push('vertical-align:' + ({ t: 'top', ctr: 'middle', b: 'bottom' }[cell.vAlign] || 'top'));
        const bd = { ...(cs.bd || {}), ...(cell.bd || {}) };
        ['l', 'r', 't', 'b'].forEach((k) => {
          const ln = bd[k];
          const side = { l: 'left', r: 'right', t: 'top', b: 'bottom' }[k];
          if (ln && ln.type !== 'none') css.push(`border-${side}:${r2(Math.max(0.5, App.num(ln.w, 1) * PT))}px ${ln.dash && ln.dash !== 'solid' ? 'dashed' : 'solid'} ${App.rgba(ln.color || 'tx1', ln.alpha === undefined ? 1 : ln.alpha, theme)}`);
          else css.push(`border-${side}:0 none`);
        });
        td.style.cssText = css.join(';');
        if (bd.d1 || bd.d2) td.classList.add('diag');
        const pseudo = { id: o.id + '-' + r + '-' + c, type: 'cell', text: cell.text };
        const inner = document.createElement('div');
        inner.className = 'cell-tx';
        const body = cell.text || { paras: [App.emptyPara()] };
        const styled = cs.color || cs.b ? { ...body, paras: body.paras.map((p) => ({ ...p, runs: p.runs.map((ru) => ({ ...(cs.color ? { color: cs.color } : {}), ...(cs.b ? { b: true } : {}), ...ru })) })) } : body;
        inner.appendChild(App.renderParas(pseudo, ctx.owner, styled, ctx));
        td.appendChild(inner);
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    el.appendChild(t);
  };

  /* Grafieken */
  App.chartCtx = (theme, extra = {}) => ({
    color: (ref) => App.color(ref, theme), palette: ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((k) => App.color(k, theme)),
    font: (theme && theme.fonts.minor) || 'Inter', text: App.color('tx1/l25', theme), grid: App.mix(App.color('bg1', theme), App.luminance(App.color('bg1', theme)) > 0.5 ? -0.15 : 0.18),
    axis: App.color('tx1/l50', theme), locale: App.LANG === 'en' ? 'en' : 'nl', ...extra,
  });
  TYPES.chart = (el, o, b, ctx, theme) => {
    if (!App.Charts || !App.Charts.render) { el.classList.add('pending'); return; }
    const box = document.createElement('div');
    box.className = 'chart-svg';
    try { box.innerHTML = App.Charts.render(o.chart, b.w, b.h, App.chartCtx(theme)); } catch (e) { console.error(e); box.textContent = App.t('Grafiek kan niet worden weergegeven'); }
    if (o.fill && o.fill.type !== 'none') box.style.background = App.fillCss(o.fill, theme);
    if (o.line && o.line.type !== 'none') box.style.outline = `${r2(App.num(o.line.w, 0.75) * PT)}px solid ${App.color(o.line.color || 'tx1', theme)}`;
    el.appendChild(box);
  };

  /* Groepen: kinderen in coördinaten binnen de groep */
  TYPES.group = (el, o, b, ctx) => {
    const sx = o.cw ? b.w / o.cw : 1, sy = o.ch ? b.h / o.ch : 1;
    const inner = document.createElement('div');
    inner.className = 'ob-grp';
    if (sx !== 1 || sy !== 1) inner.style.transform = `scale(${sx}, ${sy})`;
    (o.objs || []).forEach((c) => { const ce = App.renderObj(c, { ...ctx, inGroup: true }); if (ce) inner.appendChild(ce); });
    if (o.flipH || o.flipV) inner.style.transform = (inner.style.transform || '') + ` scale(${o.flipH ? -1 : 1}, ${o.flipV ? -1 : 1})`;
    el.appendChild(inner);
  };

  /* Video en geluid */
  TYPES.video = (el, o, b, ctx, theme) => {
    const poster = App.mediaUrl(o.poster);
    if (ctx.mode === 'show' || ctx.mode === 'preview') {
      const v = document.createElement('video');
      v.className = 'media';
      const url = App.mediaUrl(o.media);
      if (url) v.src = url;
      if (poster) v.poster = poster;
      v.preload = 'auto'; v.playsInline = true;
      if (o.vol !== undefined) v.volume = App.clamp(o.vol, 0, 1);
      el.appendChild(v);
    } else {
      const d = document.createElement('div');
      d.className = 'media-ph';
      if (poster) d.style.backgroundImage = `url("${poster}")`;
      else if (o._frame) d.style.backgroundImage = `url("${App.safeUrl(o._frame)}")`;
      if (ctx.mode === 'edit') { const p = document.createElement('span'); p.className = 'i play'; p.textContent = 'play_circle'; d.appendChild(p); }
      el.appendChild(d);
    }
    if (o.line && o.line.type !== 'none') el.style.outline = `${r2(App.num(o.line.w, 0.75) * PT)}px solid ${App.color(o.line.color || 'tx1', theme)}`;
  };
  TYPES.audio = (el, o, b, ctx) => {
    if (ctx.mode === 'show' || ctx.mode === 'preview') {
      const a = document.createElement('audio'); a.className = 'media';
      const url = App.mediaUrl(o.media); if (url) a.src = url;
      a.preload = 'auto';
      if (o.vol !== undefined) a.volume = App.clamp(o.vol, 0, 1);
      el.appendChild(a);
      if (o.hide) return;
    }
    const s = document.createElement('span'); s.className = 'i audio-ic'; s.textContent = 'volume_up';
    s.style.fontSize = r2(Math.min(b.w, b.h) * 0.8) + 'px';
    el.appendChild(s);
  };

  /* Diagrammen (SmartArt-achtig) */
  // diagram → losse vormen (objecten in het model); ook gebruikt door 'Converteren naar vormen'
  App.diagramObjs = (o, w, h, ctx = {}) => {
    let shapes = [];
    try { shapes = App.Diagrams.layout(o.dia, w, h, { measure: App.measureRun }) || []; } catch (e) { console.error(e); }
    return shapes.map((s, k) => {
      const so = { id: o.id + ':' + k, type: s.geom === 'line' || s.geom === 'straightConnector1' || /Connector/.test(s.geom || '') ? 'line' : 'shape', geom: s.geom || 'rect', adj: s.adj, x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot, flipH: s.flipH, flipV: s.flipV,
        fill: s.fill ? { type: 'solid', color: s.fill, alpha: s.alpha } : { type: 'none' },
        line: s.line ? { type: 'solid', color: s.line, w: s.lineW || 1, tail: s.geom === 'straightConnector1' ? { type: 'triangle' } : undefined } : { type: 'none' },
        fx: s.shadow ? { shadow: { type: 'outer', color: '#000000', alpha: 0.3, blur: 6, dist: 3, dir: 90 } } : undefined };
      if (so.type === 'line') so.pts = Array.isArray(s.pts) && s.pts.length > 1 ? s.pts : [[s.x, s.y], [s.x + s.w, s.y + s.h]];
      // '[Tekst]' (lege items) alleen tijdens het bewerken tonen, niet in de voorstelling of op papier
      const paras = (s.text || []).filter((t) => !t.ph || (!/^(show|print|export)$/.test(ctx.mode || '') && !ctx.noPrompt));
      if (paras.length) {
        so.text = { paras: paras.map((t) => ({ runs: [{ t: t.t, sz: t.sz || s.sz || 18, color: s.color || 'lt1' }], align: t.bullet ? 'l' : (s.align || 'ctr'), lvl: 0, marL: (t.bullet ? 14 : 0) + (t.ind || 0), indent: t.bullet ? -14 : 0, bullet: t.bullet ? { type: 'char', char: '•' } : { type: 'none' }, lnSpc: { pct: 0.9 } })), vAlign: s.vAlign || 'ctr', ins: s.ins || { l: 6, t: 4, r: 6, b: 4 }, fit: 'none' };
      }
      so.txbox = false;
      if (s.itemId) so._item = s.itemId;
      if (s.label) so._label = true;
      return so;
    });
  };
  TYPES.diagram = (el, o, b, ctx, theme) => {
    if (!App.Diagrams || !App.Diagrams.layout) { el.classList.add('pending'); return; }
    const inner = document.createElement('div'); inner.className = 'ob-grp';
    App.diagramObjs(o, b.w, b.h, ctx).forEach((so) => {
      const ce = App.renderObj(so, { ...ctx, inGroup: true, diagram: true });
      if (ce) { ce.dataset.item = so._item || ''; inner.appendChild(ce); }
    });
    el.appendChild(inner);
  };

  /* Vergelijkingen (KaTeX, meegeleverd) */
  TYPES.equation = (el, o, b, ctx, theme) => {
    const d = document.createElement('div');
    d.className = 'eq';
    d.style.color = App.color(o.color || 'tx1', theme);
    d.style.fontSize = r2((o.sz || 28) * PT) + 'px';
    if (window.katex) {
      try { window.katex.render(String(o.tex || ''), d, { throwOnError: false, displayMode: true, trust: false, strict: 'ignore', output: 'html' }); } catch { d.textContent = o.tex; }
    } else {
      d.textContent = o.tex;
      App.loadKatex && App.loadKatex().then(() => App.scheduleRender(true));
    }
    el.appendChild(d);
  };
  App.loadKatex = () => {
    if (window.katex) return Promise.resolve();
    if (!document.querySelector('link[data-katex]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/katex/katex.min.css'; l.dataset.katex = '1'; document.head.appendChild(l); }
    return App.loadScript('vendor/katex/katex.min.js');
  };

  /* Pictogrammen (Material Symbols, meegeleverd) */
  TYPES.icon = (el, o, b, ctx, theme) => {
    const s = document.createElement('span');
    s.className = 'i icon-glyph';
    s.textContent = String(o.icon || 'star').replace(/[^a-z0-9_]/g, '');
    s.style.cssText = `font-size:${r2(Math.min(b.w, b.h))}px;color:${App.rgba(o.color || 'accent1', o.alpha === undefined ? 1 : o.alpha, theme)};font-variation-settings:"FILL" ${o.filled ? 1 : 0},"wght" ${o.weight || 400},"GRAD" 0,"opsz" 48`;
    if (o.flipH || o.flipV) s.style.transform = `scale(${o.flipH ? -1 : 1}, ${o.flipV ? -1 : 1})`;
    el.appendChild(s);
  };

  /* Inkt (tekenen) */
  App.strokePath = (pts) => {
    if (!pts || !pts.length) return '';
    if (pts.length === 1) { const [x, y] = pts[0]; return `M${r2(x)} ${r2(y)} L${r2(x + 0.1)} ${r2(y + 0.1)}`; }
    let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${r2(pts[i][0])} ${r2(pts[i][1])} ${r2(mx)} ${r2(my)}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L${r2(l[0])} ${r2(l[1])}`;
  };
  TYPES.ink = (el, o, b, ctx, theme) => {
    const svg = svgEl('svg', { class: 'geo', width: r2(b.w), height: r2(b.h), overflow: 'visible' });
    const sx = o.cw ? b.w / o.cw : 1, sy = o.ch ? b.h / o.ch : 1;
    const g = svgEl('g', { transform: `scale(${r2(sx)} ${r2(sy)})` });
    (o.strokes || []).forEach((s) => {
      g.appendChild(svgEl('path', { d: App.strokePath(s.pts), fill: 'none', stroke: App.color(s.color || '#000000', theme), 'stroke-width': r2(s.w || 3), 'stroke-linecap': s.hl ? 'square' : 'round', 'stroke-linejoin': 'round', 'stroke-opacity': s.hl ? 0.45 : (s.alpha === undefined ? 1 : s.alpha), style: s.hl ? 'mix-blend-mode:multiply' : null, 'vector-effect': 'non-scaling-stroke' }));
    });
    svg.appendChild(g);
    el.appendChild(svg);
  };

  /* ---------- Tekstbreedte meten (voor diagrammen) ---------- */
  let mctx = null;
  App.measureRun = (text, sizePt, bold, font) => {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = `${bold ? 700 : 400} ${App.round(sizePt * PT, 2)}px ${App.cssFont(font || App.fontName('+mn'))}`;
    return mctx.measureText(String(text)).width;
  };

  /* ---------- Dia ---------- */
  App.slideNumber = (slide) => App.pres.slides.indexOf(slide) + 1;
  const bgEl = (owner, theme) => {
    const bg = App.bgOf(owner);
    const d = document.createElement('div');
    d.className = 'sl-bg';
    if (bg.type === 'pattern') {
      const svg = svgEl('svg', { width: '100%', height: '100%' });
      const defs = svgEl('defs'); svg.appendChild(defs);
      const p = patternEl(bg, theme); defs.appendChild(p);
      svg.appendChild(svgEl('rect', { width: '100%', height: '100%', fill: `url(#${p.id})` }));
      d.appendChild(svg);
    } else d.style.background = App.fillCss(bg, theme);
    if (bg.type === 'img' && bg.alpha !== undefined) { d.style.background = App.fillCss({ type: 'solid', color: 'bg1' }, theme); const i = document.createElement('div'); i.className = 'sl-bgimg'; i.style.cssText = `position:absolute;inset:0;opacity:${bg.alpha};background:${App.fillCss({ ...bg, alpha: undefined }, theme)}`; d.appendChild(i); }
    return d;
  };
  // Voetteksten (datum, voettekst, dianummer) van indeling of master
  const footerObjs = (slide, layout, master) => {
    const P = App.pres, hf = P.hf || {};
    if (!hf.dt && !hf.ftr && !hf.sldNum) return [];
    if (hf.notTitle && layout.type === 'title') return [];
    if (layout.noFtr) return [];   // voetteksten uitgezet in deze indeling (Diamodel)
    const out = [];
    const pick = (type) => layout.objs.find((o) => o.ph && o.ph.type === type) || master.objs.find((o) => o.ph && o.ph.type === type);
    const mk = (type, runs) => {
      const src = pick(type); if (!src) return;
      out.push({ ...src, id: 'hf-' + type, ph: { type, idx: src.ph.idx }, text: { ...(src.text || {}), paras: [{ runs, align: { dt: 'l', ftr: 'ctr', sldNum: 'r' }[type] }] }, x: src.x, y: src.y, w: src.w, h: src.h, _hf: true });
    };
    if (hf.dt) mk('dt', [hf.dtAuto !== false ? { t: '-', fld: { type: hf.dtFmt === 'long' ? 'datetime2' : 'datetime1' } } : { t: hf.dtText || '' }]);
    if (hf.ftr && hf.ftrText) mk('ftr', [{ t: hf.ftrText }]);
    if (hf.sldNum) mk('sldNum', [{ t: '‹nr.›', fld: { type: 'slidenum' } }]);
    return out;
  };
  // owner = dia, indeling of master. opts: { mode, num, scale, split, hide: Set(id) }
  App.renderSlide = (owner, opts = {}) => {
    const P = App.pres;
    const mode = opts.mode || 'thumb';
    const sl = document.createElement('div');
    sl.className = 'sl mode-' + mode + (App.settings.gray && mode === 'edit' ? ' view-' + App.settings.gray : '');
    sl.style.width = P.size.w + 'px'; sl.style.height = P.size.h + 'px';
    if (opts.scale && opts.scale !== 1) { sl.style.transform = `scale(${opts.scale})`; sl.style.transformOrigin = '0 0'; }
    const isSlide = owner.layout !== undefined;
    const isLayout = !isSlide && !owner.layouts;
    const master = App.masterOf(owner);
    const theme = master.theme;
    const num = opts.num || (isSlide ? App.slideNumber(owner) : 1);
    sl.appendChild(bgEl(owner, theme));
    const ctxBase = { mode, theme, num, split: opts.split, zoomDepth: opts.zoomDepth || 0 };
    const addAll = (objs, own, layer, onlyDecor) => {
      objs.forEach((o) => {
        if (onlyDecor && o.ph) return;
        if (opts.hide && opts.hide.has(o.id)) return;
        const e = App.renderObj(o, { ...ctxBase, owner: own, layer });
        if (e) { e.classList.add('ly-' + layer); sl.appendChild(e); }
      });
    };
    if (isSlide) {
      const layout = App.layoutOf(owner);
      // 'Achtergrondafbeeldingen verbergen' op de dia verbergt master én indeling; op de indeling alleen de master
      if (!owner.hideMaster) { if (!layout.hideMaster) addAll(master.objs, master, 'master', true); addAll(layout.objs, layout, 'layout', true); }
      footerObjs(owner, layout, master).forEach((o) => { const e = App.renderObj(o, { ...ctxBase, owner: layout, layer: 'hf' }); if (e) { e.classList.add('ly-hf'); sl.appendChild(e); } });
      addAll(owner.objs, owner, 'slide', false);
    } else if (isLayout) {
      if (!owner.hideMaster) addAll(master.objs, master, 'master', true);
      addAll(owner.objs, owner, mode === 'edit' ? 'slide' : 'layout', false);
      sl.classList.add('is-layout');
    } else {
      addAll(owner.objs, owner, mode === 'edit' ? 'slide' : 'master', false);
      sl.classList.add('is-master');
    }
    return sl;
  };
  // Hulpje: dia getekend op een bepaalde breedte (miniaturen, galerijen)
  App.slideThumb = (owner, width, opts = {}) => {
    const P = App.pres;
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';
    const h = width * P.size.h / P.size.w;
    wrap.style.cssText = `width:${r2(width)}px;height:${r2(h)}px`;
    wrap.appendChild(App.renderSlide(owner, { mode: 'thumb', scale: width / P.size.w, ...opts }));
    return wrap;
  };
})();
