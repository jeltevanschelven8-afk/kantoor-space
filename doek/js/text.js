/* =========================================================
   Doek (gemaakt door JJ van Schelven) — tekst: model ↔ weergave.
   Alinea's en runs (zoals OOXML) met overerving van de master-tekststijlen,
   opsommingstekens en nummering, velden, WordArt-effecten en automatisch passend maken.
   ========================================================= */
'use strict';

(() => {
  const PT = App.PT;

  /* ---------- Effectieve opmaak ---------- */
  const RUN_KEYS = ['b', 'i', 'u', 's', 'base', 'caps', 'sz', 'font', 'color', 'alpha', 'hl', 'spc', 'kern', 'fill', 'ln', 'fx', 'lang', 'ot'];
  const PARA_KEYS = ['align', 'lvl', 'marL', 'indent', 'lnSpc', 'spcBef', 'spcAft', 'bullet', 'tabs', 'rtl'];
  App.RUN_KEYS = RUN_KEYS; App.PARA_KEYS = PARA_KEYS;
  // Basis per niveau, met een cache per tekening (de keten master → indeling → object verandert niet tijdens het tekenen)
  App.paraStyle = (obj, owner, para, cache) => {
    const lvl = App.clamp(para.lvl || 0, 0, 8);
    let base = cache && cache[lvl];
    if (!base) { base = App.lvlBase(obj, owner, lvl); if (cache) cache[lvl] = base; }
    const out = {};
    PARA_KEYS.forEach((k) => { out[k] = para[k] !== undefined ? para[k] : base[k]; });
    out.lvl = lvl;
    out.base = base;
    return out;
  };
  App.runStyle = (run, ps) => {
    const out = {};
    RUN_KEYS.forEach((k) => { out[k] = run && run[k] !== undefined ? run[k] : ps.base[k]; });
    if (out.sz === undefined) out.sz = 18;
    return out;
  };

  /* ---------- Nummering ---------- */
  const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  const roman = (n) => { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
  const alpha = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(97 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  App.SCHEMES = {
    arabicPeriod: (n) => n + '.', arabicParenR: (n) => n + ')', arabicParenBoth: (n) => '(' + n + ')', arabicPlain: (n) => String(n),
    alphaLcPeriod: (n) => alpha(n) + '.', alphaUcPeriod: (n) => alpha(n).toUpperCase() + '.', alphaLcParenR: (n) => alpha(n) + ')', alphaUcParenR: (n) => alpha(n).toUpperCase() + ')',
    alphaLcParenBoth: (n) => '(' + alpha(n) + ')', alphaUcParenBoth: (n) => '(' + alpha(n).toUpperCase() + ')',
    romanLcPeriod: (n) => roman(n) + '.', romanUcPeriod: (n) => roman(n).toUpperCase() + '.', romanLcParenR: (n) => roman(n) + ')', romanUcParenR: (n) => roman(n).toUpperCase() + ')',
    circleNumDbPlain: (n) => (n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : String(n)),
  };
  App.numberLabel = (scheme, n) => (App.SCHEMES[scheme] || App.SCHEMES.arabicPeriod)(Math.max(1, n));
  // Nummers per alinea uitrekenen (opeenvolgende alinea's op hetzelfde niveau tellen door)
  App.numbering = (paras, styles) => {
    const counters = new Array(9).fill(0), schemes = new Array(9).fill(null);
    return paras.map((p, i) => {
      const st = styles[i]; const lvl = st.lvl; const b = st.bullet;
      for (let k = lvl + 1; k < 9; k++) { counters[k] = 0; schemes[k] = null; }
      if (b && b.type === 'auto') {
        if (schemes[lvl] !== b.scheme) { counters[lvl] = 0; schemes[lvl] = b.scheme; }
        if (counters[lvl] === 0) counters[lvl] = (b.start || 1) - 1;
        counters[lvl]++;
        return counters[lvl];
      }
      const empty = p.runs.every((r) => !r.t);
      if (!empty) { counters[lvl] = 0; schemes[lvl] = null; }
      return 0;
    });
  };

  /* ---------- Velden ---------- */
  App.fieldText = (fld, ctx) => {
    if (!fld) return null;
    if (fld.type === 'slidenum') return String(ctx && ctx.num ? ctx.num : '‹nr.›');
    if (/^datetime/.test(fld.type)) {
      const d = new Date();
      const loc = App.LANG === 'en' ? 'en-US' : 'nl-NL';
      const f = fld.type;
      if (f === 'datetime1' || f === 'datetime') return d.toLocaleDateString(loc);
      if (f === 'datetime2') return d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (f === 'datetime3') return d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
      if (f === 'datetime10' || f === 'datetime11') return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString(loc);
    }
    return null;
  };

  /* ---------- CSS van een run ---------- */
  const UL = { sng: 'solid', dbl: 'double', heavy: 'solid', dotted: 'dotted', dottedHeavy: 'dotted', dash: 'dashed', dashHeavy: 'dashed', dashLong: 'dashed', dotDash: 'dashed', dotDotDash: 'dashed', wavy: 'wavy', wavyHeavy: 'wavy', wavyDbl: 'wavy', words: 'solid' };
  App.runCss = (rs, theme, opts = {}) => {
    const scale = opts.fontScale || 1;
    const css = [];
    const isTitle = opts.isTitle;
    css.push('font-family:' + App.cssFont(App.fontName(rs.font, theme, isTitle)));
    let sz = rs.sz * scale;
    if (rs.base) sz *= 0.66;
    css.push('font-size:' + App.round(sz * PT, 3) + 'px');
    if (rs.b) css.push('font-weight:700');
    if (rs.i) css.push('font-style:italic');
    const deco = [];
    if (rs.u && rs.u !== 'none') deco.push('underline');
    if (rs.s && rs.s !== 'noStrike') deco.push('line-through');
    if (deco.length) {
      css.push('text-decoration-line:' + deco.join(' '));
      const st = rs.u && rs.u !== 'none' ? (UL[rs.u] || 'solid') : rs.s === 'dbl' ? 'double' : 'solid';
      css.push('text-decoration-style:' + st);
      if (/heavy|Heavy/.test(rs.u || '')) css.push('text-decoration-thickness:0.12em');
      css.push('text-underline-offset:0.12em');
    }
    if (rs.base) css.push('vertical-align:' + (rs.base > 0 ? '0.55em' : '-0.25em'), 'line-height:0');
    if (rs.caps === 'all') css.push('text-transform:uppercase');
    else if (rs.caps === 'small') css.push('font-variant-caps:small-caps');
    if (rs.spc) css.push('letter-spacing:' + App.round(rs.spc * PT * scale, 2) + 'px');
    if (rs.kern === 0) css.push('font-kerning:none');
    const feat = [];
    if (rs.ot) { if (rs.ot.liga === false) feat.push('"liga" 0'); if (rs.ot.smcp) feat.push('"smcp" 1'); if (rs.ot.onum) feat.push('"onum" 1'); if (rs.ot.tnum) feat.push('"tnum" 1'); if (rs.ot.dlig) feat.push('"dlig" 1'); }
    if (feat.length) css.push('font-feature-settings:' + feat.join(','));
    // kleur, of WordArt-opvulling
    const fill = rs.fill;
    if (fill && fill.type === 'grad' && fill.stops && fill.stops.length) {
      css.push('background-image:' + App.gradCss(fill, theme), '-webkit-background-clip:text', 'background-clip:text', 'color:transparent', '-webkit-text-fill-color:transparent');
    } else if (fill && fill.type === 'none') {
      css.push('color:transparent', '-webkit-text-fill-color:transparent');
    } else {
      const c = fill && fill.type === 'solid' ? fill.color : rs.color;
      const a = fill && fill.type === 'solid' && fill.alpha !== undefined ? fill.alpha : rs.alpha;
      css.push('color:' + App.rgba(c || 'tx1', a === undefined ? 1 : a, theme));
    }
    if (rs.link) css.push('text-decoration-line:underline');
    if (rs.ln && rs.ln.type === 'solid') css.push('-webkit-text-stroke:' + App.round(Math.max(0.3, (rs.ln.w || 0.75) * PT * scale), 2) + 'px ' + App.rgba(rs.ln.color || 'tx1', rs.ln.alpha === undefined ? 1 : rs.ln.alpha, theme), 'paint-order:stroke fill');
    const sh = [];
    if (rs.fx) {
      const s = rs.fx.shadow;
      if (s && s.type !== 'inner') { const r = (s.dir || 0) * Math.PI / 180, d = s.dist || 0; sh.push(`${App.round(Math.cos(r) * d * scale, 2)}px ${App.round(Math.sin(r) * d * scale, 2)}px ${App.round((s.blur || 0) * scale, 2)}px ${App.rgba(s.color || '#000000', s.alpha === undefined ? 0.4 : s.alpha, theme)}`); }
      const g = rs.fx.glow;
      if (g) { const c = App.rgba(g.color || 'accent1', g.alpha === undefined ? 0.6 : g.alpha, theme); sh.push(`0 0 ${App.round(g.size * scale, 1)}px ${c}`, `0 0 ${App.round(g.size * 0.5 * scale, 1)}px ${c}`); }
      if (rs.fx.refl) css.push(`-webkit-box-reflect:below ${App.round((rs.fx.refl.dist || 0) * scale, 1)}px linear-gradient(transparent ${Math.round((1 - (rs.fx.refl.size || 0.5)) * 100)}%, rgba(255,255,255,${rs.fx.refl.alpha || 0.4}))`);
    }
    if (sh.length) css.push('text-shadow:' + sh.join(','));
    if (rs.hl) css.push('background-color:' + App.color(rs.hl, theme));
    return css.join(';');
  };
  App.gradCss = (fill, theme, kindOverride) => {
    const stops = (fill.stops || []).slice().sort((a, b) => a.p - b.p).map((s) => `${App.rgba(s.color, s.alpha === undefined ? 1 : s.alpha, theme)} ${App.round(s.p * 100, 2)}%`).join(', ');
    const kind = kindOverride || fill.kind || 'linear';
    if (kind === 'linear') return `linear-gradient(${App.round((fill.angle || 0) + 90, 2)}deg, ${stops})`;
    if (kind === 'rect') return `radial-gradient(closest-side, ${stops})`;
    return `radial-gradient(circle at ${fill.cx !== undefined ? fill.cx * 100 : 50}% ${fill.cy !== undefined ? fill.cy * 100 : 50}%, ${stops})`;
  };

  /* ---------- Tekst tekenen ---------- */
  // Geeft een <div class="tx"> met alinea's terug. ctx: { theme, num (dianummer), mode, fontScale, spcScale, isTitle, split: 'word'|'letter' }
  App.renderParas = (obj, owner, body, ctx = {}) => {
    const theme = ctx.theme || App.theme(owner);
    const cache = {};
    const paras = body && body.paras && body.paras.length ? body.paras : [App.emptyPara()];
    const styles = paras.map((p) => App.paraStyle(obj, owner, p, cache));
    const nums = App.numbering(paras, styles);
    const fontScale = ctx.fontScale || 1, spcScale = ctx.spcScale !== undefined ? ctx.spcScale : 1;
    const split = typeof ctx.split === 'function' ? ctx.split(obj) : ctx.split;
    const frag = document.createDocumentFragment();
    const isTitle = obj.ph && App.phFamily(obj.ph.type) === 'title';
    paras.forEach((p, i) => {
      const ps = styles[i];
      const el = document.createElement('p');
      el.className = 'pa';
      el.dataset.p = i;
      const css = [];
      const al = { l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[ps.align] || 'left';
      css.push('text-align:' + al);
      if (ps.align === 'dist') css.push('text-align-last:justify');
      const marL = App.num(ps.marL, 0), indent = App.num(ps.indent, 0);
      css.push(`padding-left:${App.round(marL, 2)}px`, `text-indent:${App.round(indent, 2)}px`);
      if (ps.rtl) css.push('direction:rtl');
      const firstRun = p.runs.find((r) => r.t) || p.runs[0] || {};
      const rs0 = App.runStyle(p.end && !p.runs.some((r) => r.t) ? { ...firstRun, ...p.end } : firstRun, ps);
      const sz = rs0.sz * fontScale;
      if (ps.lnSpc && ps.lnSpc.pt) css.push('line-height:' + App.round(ps.lnSpc.pt * PT * fontScale, 2) + 'px');
      else { const pct = (ps.lnSpc && ps.lnSpc.pct ? ps.lnSpc.pct : 1) * spcScale; css.push('line-height:' + App.round(pct * 1.2, 4)); }
      if (i > 0 && ps.spcBef) css.push('margin-top:' + App.round(ps.spcBef * PT * spcScale, 2) + 'px');
      if (ps.spcAft) css.push('margin-bottom:' + App.round(ps.spcAft * PT * spcScale, 2) + 'px');
      css.push('font-size:' + App.round(sz * PT, 3) + 'px');
      if (ps.tabs && ps.tabs.length) css.push('tab-size:' + App.round(ps.tabs[0].pos, 1) + 'px');
      el.style.cssText = css.join(';');
      // opsommingsteken of nummer
      const b = ps.bullet;
      const hasText = p.runs.some((r) => r.t);
      if (b && b.type !== 'none' && (hasText || ctx.mode === 'edit')) {
        const bu = document.createElement('span');
        bu.className = 'bu';
        bu.contentEditable = 'false';
        let label = '';
        if (b.type === 'char') label = b.char || '•';
        else if (b.type === 'auto') label = App.numberLabel(b.scheme, nums[i] || 1);
        bu.textContent = label;
        const bcss = [];
        const bsz = (b.sz || 1) * sz;
        bcss.push('font-size:' + App.round(bsz * PT, 2) + 'px');
        if (b.font && b.type === 'char') bcss.push('font-family:' + App.cssFont(b.font));
        else bcss.push('font-family:' + App.cssFont(App.fontName(rs0.font, theme, isTitle)));
        bcss.push('color:' + App.rgba(b.color || rs0.color || 'tx1', 1, theme));
        if (b.type === 'auto' && rs0.b) bcss.push('font-weight:700');
        const w = indent < 0 ? -indent : 0;
        bcss.push('min-width:' + App.round(w, 2) + 'px', 'text-indent:0');
        if (!hasText && ctx.mode === 'edit') bcss.push('opacity:.45');
        bu.style.cssText = bcss.join(';');
        el.appendChild(bu);
      }
      // runs
      let any = false;
      p.runs.forEach((r, ri) => {
        let t = r.t;
        if (r.fld) t = App.fieldText(r.fld, ctx) ?? t;
        if (!t) return;
        any = true;
        const rs = App.runStyle(r, ps);
        const span = document.createElement(r.link && ctx.mode === 'show' ? 'a' : 'span');
        span.className = 'r';
        span.dataset.r = ri;
        if (r.link) { span.dataset.link = '1'; rs.link = r.link; if (!r.color) rs.color = 'hlink'; }
        if (r.fld) { span.dataset.fld = r.fld.type; span.contentEditable = 'false'; }
        span.style.cssText = App.runCss(rs, theme, { fontScale, isTitle });
        if (r.lang) span.lang = r.lang;
        App.fillRunText(span, t, split);
        el.appendChild(span);
      });
      // een regeleinde aan het eind van de alinea heeft een extra <br> nodig om zichtbaar te zijn
      if (any && /\v$/.test(p.runs.map((r) => r.t).join(''))) el.appendChild(document.createElement('br'));
      if (!any) {
        // lege alinea: hoogte van het eindteken (en een plek voor de cursor)
        el.appendChild(document.createElement('br'));
      }
      frag.appendChild(el);
    });
    return frag;
  };
  // Tekst in een run zetten; '\v' = regeleinde; per woord/letter splitsen voor animaties
  App.fillRunText = (span, t, split) => {
    const parts = String(t).split('\v');
    parts.forEach((part, k) => {
      if (k) span.appendChild(document.createElement('br'));
      if (!split || split === 'all') { if (part) span.appendChild(document.createTextNode(part)); return; }
      const pieces = split === 'word' ? part.split(/(\s+)/) : Array.from(part);
      pieces.forEach((pc) => {
        if (!pc) return;
        if (/^\s+$/.test(pc)) { span.appendChild(document.createTextNode(pc)); return; }
        const u = document.createElement('span'); u.className = 'u'; u.textContent = pc; span.appendChild(u);
      });
    });
  };

  // Hele tekstruimte van een object (met marges, uitlijning, kolommen, verticale tekst)
  App.renderTextBox = (obj, owner, rect, ctx = {}) => {
    const bp = App.bodyProps(obj, owner);
    const box = document.createElement('div');
    box.className = 'tx';
    const ins = bp.ins || { l: 9.6, t: 4.8, r: 9.6, b: 4.8 };
    const css = [`left:${App.round(rect.x, 2)}px`, `top:${App.round(rect.y, 2)}px`, `width:${App.round(Math.max(0, rect.w), 2)}px`, `height:${App.round(Math.max(0, rect.h), 2)}px`,
      `padding:${ins.t}px ${ins.r}px ${ins.b}px ${ins.l}px`,
      'justify-content:' + ({ t: 'flex-start', ctr: 'center', b: 'flex-end' }[bp.vAlign] || 'flex-start')];
    if (bp.wrap === false) css.push('white-space:pre');
    if (bp.vert === 'vert' || bp.vert === 'eaVert') css.push('writing-mode:vertical-rl');
    else if (bp.vert === 'vert270') css.push('writing-mode:vertical-rl', 'transform:rotate(180deg)');
    if (bp.rtl) css.push('direction:rtl');
    box.style.cssText = css.join(';');
    const inner = document.createElement('div');
    inner.className = 'txi';
    if (bp.cols && bp.cols.n > 1) inner.style.cssText = `column-count:${bp.cols.n};column-gap:${bp.cols.gap || 0}px;height:100%`;
    const scale = obj.text && obj.text.scale;
    inner.appendChild(App.renderParas(obj, owner, obj.text, { ...ctx, fontScale: scale ? scale.font : 1, spcScale: scale ? scale.spc : 1 }));
    box.appendChild(inner);
    return box;
  };

  /* ---------- Hulpjes voor het tekstmodel ---------- */
  App.plainText = (body, sep = '\n') => (body && body.paras ? body.paras.map((p) => p.runs.map((r) => r.t.replace(/\v/g, ' ')).join('')).join(sep) : '');
  App.objText = (o) => {
    if (!o) return '';
    if (o.text) return App.plainText(o.text);
    if (o.type === 'table') return o.rows.map((r) => r.cells.map((c) => App.plainText(c.text, ' ')).join('\t')).join('\n');
    if (o.type === 'group') return o.objs.map(App.objText).filter(Boolean).join('\n');
    if (o.type === 'diagram') return o.dia.items.map((i) => i.text).join('\n');
    if (o.type === 'chart' && o.chart.title && o.chart.title.on) return o.chart.title.text || '';
    return '';
  };
  // Opeenvolgende runs met dezelfde opmaak samenvoegen; lege runs weghalen (behalve als enige)
  const sameProps = (a, b) => { for (const k of RUN_KEYS.concat(['link', 'fld'])) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false; } return true; };
  App.sameRunProps = sameProps;
  App.normalizePara = (p) => {
    const out = [];
    for (const r of p.runs || []) {
      if (!r) continue;
      if (typeof r.t !== 'string') r.t = String(r.t ?? '');
      if (!r.t && !r.fld) continue;
      const last = out[out.length - 1];
      if (last && !last.fld && !r.fld && sameProps(last, r)) last.t += r.t; else out.push({ ...r });
    }
    if (!out.length) { const first = (p.runs || [])[0] || {}; const keep = { ...first, t: '' }; delete keep.fld; delete keep.link; out.push(keep); }
    p.runs = out;
    return p;
  };
  App.normalizeBody = (body) => { if (!body.paras || !body.paras.length) body.paras = [App.emptyPara()]; body.paras.forEach(App.normalizePara); return body; };

  /* ---------- Automatisch passend maken ----------
     'shrink': tekengrootte en regelafstand verkleinen tot de tekst past (vaste stappen, zoals 90%, 80% …)
     'resize': de hoogte van de vorm aanpassen aan de tekst. */
  let meas = null;
  const measureBox = () => {
    if (!meas) { meas = document.createElement('div'); meas.id = 'measure'; meas.className = 'sl measure'; document.body.appendChild(meas); }
    return meas;
  };
  App.textHeight = (obj, owner, w, scale) => {
    const m = measureBox();
    const bp = App.bodyProps(obj, owner);
    const ins = bp.ins || { l: 9.6, t: 4.8, r: 9.6, b: 4.8 };
    const box = document.createElement('div');
    box.className = 'tx';
    box.style.cssText = `position:absolute;left:0;top:0;width:${Math.max(1, w)}px;height:auto;padding:${ins.t}px ${ins.r}px ${ins.b}px ${ins.l}px;${bp.wrap === false ? 'white-space:pre;' : ''}`;
    const inner = document.createElement('div'); inner.className = 'txi';
    inner.appendChild(App.renderParas(obj, owner, obj.text, { mode: 'measure', fontScale: scale ? scale.font : 1, spcScale: scale ? scale.spc : 1 }));
    box.appendChild(inner);
    m.appendChild(box);
    const h = box.offsetHeight;
    const wNeeded = bp.wrap === false ? box.scrollWidth : w;
    box.remove();
    return { h, w: wNeeded };
  };
  // Geeft true als er iets aan het object is veranderd
  App.autofit = (obj, owner) => {
    if (!obj.text || obj.type !== 'shape') return false;
    const bp = App.bodyProps(obj, owner);
    const b = App.box(obj, owner);
    const tr = App.textRect(obj, b);
    if (bp.vert && bp.vert !== 'horz') return false;
    if (bp.fit === 'resize') {
      const { h, w } = App.textHeight(obj, owner, tr.w, null);
      const extra = b.h - tr.h;
      let changed = false;
      const nh = Math.max(App.round(h + extra, 2), 10);
      if (Math.abs(nh - b.h) > 0.5) { App.fixBox(obj, owner); obj.h = nh; changed = true; }
      if (bp.wrap === false) { const nw = App.round(w + (b.w - tr.w), 2); if (Math.abs(nw - b.w) > 0.5) { App.fixBox(obj, owner); obj.w = nw; changed = true; } }
      if (obj.text.scale) { delete obj.text.scale; changed = true; }
      return changed;
    }
    if (bp.fit === 'shrink') {
      const steps = [[1, 1], [0.925, 0.9], [0.85, 0.8], [0.775, 0.8], [0.7, 0.8], [0.625, 0.8], [0.55, 0.8], [0.475, 0.8], [0.4, 0.8], [0.325, 0.8], [0.25, 0.8]];
      let pick = steps[steps.length - 1];
      for (const [f, s] of steps) { if (App.textHeight(obj, owner, tr.w, { font: f, spc: s }).h <= tr.h + 0.5) { pick = [f, s]; break; } }
      const prev = obj.text.scale;
      if (pick[0] === 1) { if (prev) { delete obj.text.scale; return true; } return false; }
      if (prev && prev.font === pick[0] && prev.spc === pick[1]) return false;
      obj.text.scale = { font: pick[0], spc: pick[1] };
      return true;
    }
    if (obj.text.scale) { delete obj.text.scale; return true; }
    return false;
  };
  // Tekstrechthoek van een vorm (in px binnen het object)
  App.textRect = (obj, b) => {
    if (obj.type === 'shape' && obj.geom && obj.geom !== 'rect' && App.Shapes && !obj.txbox && !obj.ph) {
      const g = App.Shapes.geometry(obj.geom, b.w, b.h, obj.adj || {});
      if (g && g.text) return { x: g.text.l, y: g.text.t, w: Math.max(0, g.text.r - g.text.l), h: Math.max(0, g.text.b - g.text.t) };
    }
    return { x: 0, y: 0, w: b.w, h: b.h };
  };
})();
