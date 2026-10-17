/* =========================================================
   Doek (gemaakt door JJ van Schelven) — opmaak van vormen: opvulling, omtrek,
   effecten (schaduw, gloed, weerspiegeling, zachte randen, schuine rand, 3D),
   snelle stijlen, opmaak kopiëren, vormen samenvoegen en alternatieve tekst
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const sel = () => App.selObjs().filter((o) => !o.locked || true);
  const each = (fn, filter) => { const objs = sel().filter(filter || (() => true)); if (!objs.length) return false; App.run(() => objs.forEach(fn)); return true; };
  // In een tabel geldt opvulling voor de geselecteerde cellen
  const cellsOrObjs = (fnObj, fnCell) => {
    const o = App.sel1();
    if (o && o.type === 'table' && App.tables && fnCell) { App.run(() => App.tables.eachSelCell(o, fnCell)); return; }
    each(fnObj);
  };

  /* ---------- Opvulling ---------- */
  App.def('shapeFill', (c) => {
    if (c === undefined || c === null) c = App.state.lastColors.fill;
    cellsOrObjs((o) => { if (o.type === 'line') return; o.fill = c ? { type: 'solid', color: c } : { type: 'none' }; if (o.type === 'icon' && c) o.color = c; },
      (cell) => { if (c) cell.fill = { type: 'solid', color: c }; else cell.fill = { type: 'none' }; });
  });
  App.def('cellFill', (c) => App.exec('shapeFill', c));
  App.menuBuilders['m-fill'] = () => false;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-menu="m-fill"], [data-menu="m-outline"], [data-menu="m-textfill"], [data-menu="m-textoutline"]');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const which = b.dataset.menu;
    if (which === 'm-fill') App.colorMenu(b, 'shapeFill', null, { extra: `<hr><button class="mi" data-cmd="fillPicture"><span class="i">image</span> ${App.t('Afbeelding…')}</button><button class="mi" data-menu-sub="m-gradient" data-cmd="noop"><span class="i">gradient</span> ${App.t('Kleurovergang')} ›</button><button class="mi" data-cmd="togglePane" data-arg="format"><span class="i">texture</span> ${App.t('Patroon en meer opvulopties…')}</button>` });
    else if (which === 'm-outline') App.colorMenu(b, 'shapeLine', null, { extra: `<hr><button class="mi" data-menu-sub="m-weight" data-cmd="noop"><span class="i">line_weight</span> ${App.t('Dikte')} ›</button><button class="mi" data-menu-sub="m-dash" data-cmd="noop"><span class="i">line_style</span> ${App.t('Streepjes')} ›</button><button class="mi" data-menu-sub="m-arrows" data-cmd="noop"><span class="i">arrow_right_alt</span> ${App.t('Pijlen')} ›</button>` });
    else if (which === 'm-textfill') App.colorMenu(b, 'textFill', null, { extra: `<hr><button class="mi" data-menu-sub="m-textgradient" data-cmd="noop"><span class="i">gradient</span> ${App.t('Kleurovergang')} ›</button>` });
    else App.colorMenu(b, 'textOutline', null, { extra: `<hr><button class="mi" data-menu-sub="m-textweight" data-cmd="noop"><span class="i">line_weight</span> ${App.t('Dikte')} ›</button>` });
  }, true);
  const gradPresets = (base) => [
    { n: 'Lineair omlaag', f: { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: base + '/l40' }, { p: 1, color: base }] } },
    { n: 'Lineair omhoog', f: { type: 'grad', kind: 'linear', angle: 270, stops: [{ p: 0, color: base + '/l40' }, { p: 1, color: base }] } },
    { n: 'Lineair naar rechts', f: { type: 'grad', kind: 'linear', angle: 0, stops: [{ p: 0, color: base + '/l40' }, { p: 1, color: base }] } },
    { n: 'Lineair diagonaal', f: { type: 'grad', kind: 'linear', angle: 45, stops: [{ p: 0, color: base + '/l60' }, { p: 1, color: base + '/d25' }] } },
    { n: 'Vanuit het midden', f: { type: 'grad', kind: 'radial', stops: [{ p: 0, color: base + '/l60' }, { p: 1, color: base }] } },
    { n: 'Van rechtsboven', f: { type: 'grad', kind: 'radial', cx: 1, cy: 0, stops: [{ p: 0, color: base + '/l60' }, { p: 1, color: base }] } },
    { n: 'Donker lineair', f: { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: base }, { p: 1, color: base + '/d50' }] } },
    { n: 'Twee kleuren', f: { type: 'grad', kind: 'linear', angle: 0, stops: [{ p: 0, color: base }, { p: 1, color: 'accent2' }] } },
  ];
  const baseColor = () => { const o = App.sel1(); const f = o && App.objFill(o); return f && f.type === 'solid' && f.color && f.color[0] !== '#' ? f.color.split('/')[0] : 'accent1'; };
  App.menuBuilders['m-gradient'] = () => { const th = App.theme(); return `<div class="menu-title">${App.t('Kleurovergangen')}</div><div style="display:grid;grid-template-columns:repeat(4,44px);gap:4px;padding:6px">${gradPresets(baseColor()).map((g, i) => `<button data-cmd="fillGradient" data-arg="${i}" title="${App.esc(App.t(g.n))}" style="height:44px;border:1px solid var(--line);background:${App.gradCss(g.f, th)}"></button>`).join('')}</div><button data-cmd="fillGradient" data-arg="none">${App.t('Geen kleurovergang')}</button><button data-cmd="togglePane" data-arg="format">${App.t('Meer kleurovergangen…')}</button>`; };
  App.def('fillGradient', (i) => {
    if (i === 'none') { each((o) => { const f = App.objFill(o); if (f.type === 'grad') o.fill = { type: 'solid', color: f.stops[f.stops.length - 1].color }; }); return; }
    const g = gradPresets(baseColor())[+i]; if (!g) return;
    each((o) => { if (o.type !== 'line') o.fill = App.clone(g.f); });
  });
  App.def('fillPicture', async () => {
    const f = await App.pickFile('image/*'); if (!f) return;
    const fit = await App.fitImageUrl(await App.readFile(f, 'dataurl'));
    const id = App.addMedia(fit.url, null, f.name, { nat: { w: fit.w, h: fit.h } });
    each((o) => { if (o.type !== 'line') o.fill = { type: 'img', media: id, mode: 'stretch' }; });
  });

  /* ---------- Omtrek ---------- */
  App.def('shapeLine', (c) => {
    if (c === undefined || c === null) c = App.state.lastColors.line;
    cellsOrObjs((o) => { const l = { ...App.objLine(o) }; if (!c) { o.line = { type: 'none' }; return; } o.line = { ...l, type: 'solid', color: c, w: l.w || 1 }; },
      (cell) => { cell.bd = cell.bd || {}; ['l', 'r', 't', 'b'].forEach((k) => { cell.bd[k] = c ? { type: 'solid', color: c, w: 1 } : { type: 'none' }; }); });
  });
  const WEIGHTS = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];
  App.menuBuilders['m-weight'] = () => WEIGHTS.map((w) => `<button data-cmd="lineWeight" data-arg="${w}"><span style="display:inline-block;width:70px;border-top:${Math.max(1, w * App.PT)}px solid currentColor"></span> ${App.fmtNum(w, 2)} pt</button>`).join('') + `<hr><button data-cmd="togglePane" data-arg="format">${App.t('Meer lijnen…')}</button>`;
  App.def('lineWeight', (w) => each((o) => { const l = App.objLine(o); o.line = { ...l, type: 'solid', color: l.color || 'tx1', w: +w }; }));
  const DASHES = [['solid', 'Doorgetrokken'], ['sysDot', 'Ronde punt'], ['sysDash', 'Vierkante punt'], ['dash', 'Streepje'], ['dashDot', 'Streepje punt'], ['lgDash', 'Lang streepje'], ['lgDashDot', 'Lang streepje punt'], ['lgDashDotDot', 'Lang streepje punt punt']];
  App.menuBuilders['m-dash'] = () => DASHES.map(([d, n]) => `<button data-cmd="lineDash" data-arg="${d}" title="${App.esc(App.t(n))}"><svg width="90" height="8"><line x1="0" y1="4" x2="90" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="${({ solid: '', sysDot: '2 2', sysDash: '6 2', dash: '8 6', dashDot: '8 6 2 6', lgDash: '16 6', lgDashDot: '16 6 2 6', lgDashDotDot: '16 6 2 6 2 6' })[d]}"/></svg> ${App.esc(App.t(n))}</button>`).join('');
  App.def('lineDash', (d) => each((o) => { const l = App.objLine(o); o.line = { ...l, type: 'solid', color: l.color || 'tx1', w: l.w || 1, dash: d }; }));
  const ARROWS = [[null, null, 'Geen pijlen'], [null, 'triangle', 'Pijl aan het einde'], ['triangle', null, 'Pijl aan het begin'], ['triangle', 'triangle', 'Pijlen aan beide kanten'], [null, 'stealth', 'Scherpe pijl aan het einde'], [null, 'arrow', 'Open pijl aan het einde'], ['oval', 'oval', 'Rondjes aan beide kanten'], ['diamond', 'diamond', 'Ruiten aan beide kanten'], ['oval', 'triangle', 'Rondje en pijl']];
  App.menuBuilders['m-arrows'] = () => ARROWS.map(([h, t, n], i) => `<button data-cmd="lineArrows" data-arg="${i}" title="${App.esc(App.t(n))}"><svg width="70" height="12"><line x1="${h ? 10 : 2}" y1="6" x2="${t ? 60 : 68}" y2="6" stroke="currentColor" stroke-width="2"/>${t ? '<path d="M68 6 L58 1 L58 11 Z" fill="currentColor"/>' : ''}${h ? '<path d="M2 6 L12 1 L12 11 Z" fill="currentColor"/>' : ''}</svg> ${App.esc(App.t(n))}</button>`).join('');
  App.def('lineArrows', (i) => { const [h, t] = ARROWS[+i] || []; each((o) => { const l = { ...App.objLine(o), type: 'solid' }; l.color = l.color || 'tx1'; l.w = l.w || 1; if (h) l.head = { type: h }; else delete l.head; if (t) l.tail = { type: t }; else delete l.tail; o.line = l; }); });

  /* ---------- Effecten ---------- */
  const SHADOWS = [
    ['Geen schaduw', null],
    ['Buiten: rechtsonder', { type: 'outer', color: '#000000', alpha: 0.4, blur: 5, dist: 4, dir: 45 }],
    ['Buiten: onder', { type: 'outer', color: '#000000', alpha: 0.4, blur: 5, dist: 4, dir: 90 }],
    ['Buiten: linksonder', { type: 'outer', color: '#000000', alpha: 0.4, blur: 5, dist: 4, dir: 135 }],
    ['Buiten: midden (zacht)', { type: 'outer', color: '#000000', alpha: 0.35, blur: 14, dist: 0, dir: 0 }],
    ['Buiten: groot en zacht', { type: 'outer', color: '#000000', alpha: 0.3, blur: 22, dist: 10, dir: 90 }],
    ['Binnen: linksboven', { type: 'inner', color: '#000000', alpha: 0.5, blur: 6, dist: 4, dir: 225 }],
    ['Binnen: midden', { type: 'inner', color: '#000000', alpha: 0.45, blur: 12, dist: 0, dir: 0 }],
  ];
  const GLOWS = [['Geen gloed', null], ...[5, 8, 11, 18].flatMap((s) => ['accent1', 'accent2', 'accent4', 'accent6'].map((c) => [`Gloed ${s} pt, ${c}`, { color: c, alpha: 0.6, size: s * App.PT }]))];
  const SOFTS = [['Geen zachte randen', 0], ['1 pt', 1], ['2,5 pt', 2.5], ['5 pt', 5], ['10 pt', 10], ['25 pt', 25], ['50 pt', 50]];
  const REFLS = [['Geen weerspiegeling', null], ['Strak, klein', { alpha: 0.5, size: 0.3, dist: 0, blur: 0 }], ['Strak, half', { alpha: 0.5, size: 0.5, dist: 2, blur: 0 }], ['Strak, volledig', { alpha: 0.45, size: 1, dist: 4, blur: 0 }]];
  const BEVELS = [['Geen schuine rand', null], ['Cirkel', { type: 'circle', w: 6, h: 6 }], ['Zacht ronddraaien', { type: 'softRound', w: 8, h: 8 }], ['Hoek', { type: 'angle', w: 6, h: 6 }]];
  const ROTS = [['Geen draaiing', null], ['Perspectief links', { x: 0, y: 25, persp: 900 }], ['Perspectief rechts', { x: 0, y: -25, persp: 900 }], ['Perspectief boven', { x: 25, y: 0, persp: 900 }], ['Perspectief onder', { x: -25, y: 0, persp: 900 }], ['Isometrisch links', { x: 20, y: 35, persp: 1500 }], ['Isometrisch rechts', { x: 20, y: -35, persp: 1500 }]];
  App.EFFECTS = { shadow: SHADOWS, glow: GLOWS, soft: SOFTS, refl: REFLS, bevel: BEVELS, rot3d: ROTS };
  const fxSub = (key, title) => `<button data-menu-sub="m-fx-${key}" data-cmd="noop"><span class="i">${{ shadow: 'shadow', glow: 'flare', soft: 'blur_on', refl: 'flip', bevel: 'deployed_code', rot3d: '3d_rotation' }[key]}</span> ${App.esc(App.t(title))} ›</button>`;
  App.menuBuilders['m-effects'] = () => [fxSub('shadow', 'Schaduw'), fxSub('refl', 'Weerspiegeling'), fxSub('glow', 'Gloed'), fxSub('soft', 'Zachte randen'), fxSub('bevel', 'Schuine rand'), fxSub('rot3d', '3D-draaiing'), `<hr><button data-cmd="togglePane" data-arg="effects"><span class="i">tune</span> ${App.t('Opties voor effecten…')}</button>`].join('');
  Object.keys(App.EFFECTS).forEach((key) => {
    App.menuBuilders['m-fx-' + key] = () => App.EFFECTS[key].map(([n], i) => `<button data-cmd="effect" data-arg="${key}:${i}">${App.esc(App.t(n))}</button>`).join('');
  });
  App.def('effect', (arg) => {
    const [key, i] = String(arg).split(':');
    const val = (App.EFFECTS[key] || [])[+i]; if (!val) return;
    const v = App.clone(val[1]);
    const isText = key === 'textfx';
    void isText;
    each((o) => {
      o.fx = { ...(o.fx || {}) };
      if (!v) delete o.fx[key]; else o.fx[key] = v;
      if (!Object.keys(o.fx).length) delete o.fx;
    });
  });

  /* ---------- Snelle stijlen (vormstijlen) ---------- */
  const STYLE_COLORS = ['tx1', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const styleOf = (row, c) => {
    const dark = c === 'tx1';
    switch (row) {
      case 0: return { fill: { type: 'solid', color: 'bg1' }, line: { type: 'solid', color: c, w: 1 }, text: c };
      case 1: return { fill: { type: 'solid', color: c }, line: { type: 'solid', color: c + '/d25', w: 1 }, text: 'bg1' };
      case 2: return { fill: { type: 'solid', color: dark ? 'tx1/l80' : c + '/l80' }, line: { type: 'solid', color: c, w: 1 }, text: c };
      case 3: return { fill: { type: 'solid', color: dark ? 'tx1/l60' : c + '/l60' }, line: { type: 'none' }, text: 'tx1' };
      case 4: return { fill: { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: c + '/l40' }, { p: 1, color: c }] }, line: { type: 'none' }, text: 'bg1', fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.3, blur: 5, dist: 3, dir: 90 } } };
      default: return { fill: { type: 'solid', color: c }, line: { type: 'none' }, text: 'bg1', fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.4, blur: 8, dist: 4, dir: 90 }, bevel: { type: 'circle', w: 6, h: 6 } } };
    }
  };
  App.shapeStyle = styleOf;
  const swatch = (row, c) => { const s = styleOf(row, c); const th = App.theme(); const bg = s.fill.type === 'grad' ? App.gradCss(s.fill, th) : App.color(s.fill.color, th); const bd = s.line.type === 'none' ? 'transparent' : App.color(s.line.color, th); return `<button class="style-sw" data-cmd="quickStyle" data-arg="${row}:${c}" title="${App.esc(App.t(['Gekleurde omtrek', 'Gekleurde opvulling', 'Lichte opvulling', 'Subtiel effect', 'Gemiddeld effect', 'Intens effect'][row]))} – ${App.esc(App.colorName(c))}" style="background:${bg};border:1px solid ${bd};color:${App.color(s.text, th)};${s.fx && s.fx.shadow ? 'box-shadow:0 2px 3px rgba(0,0,0,.35)' : ''}">Abc</button>`; };
  App.menuBuilders['m-quickstyles'] = () => `<div style="display:grid;grid-template-columns:repeat(7,40px);gap:4px;padding:6px">${[0, 1, 2, 3, 4, 5].map((r) => STYLE_COLORS.map((c) => swatch(r, c)).join('')).join('')}</div>`;
  App.fillStyleGallery = () => { const g = $('#g-shapestyles'); if (g && App.pres) g.innerHTML = [1, 2, 4].map((r) => STYLE_COLORS.map((c) => swatch(r, c)).join('')).join(''); };
  App.def('quickStyle', (arg) => {
    const [row, c] = String(arg).split(':');
    const s = styleOf(+row, c);
    each((o) => {
      if (o.type === 'line') { o.line = { ...(o.line || {}), type: 'solid', color: c, w: +row === 5 ? 2.25 : 1.5 }; return; }
      o.fill = App.clone(s.fill); o.line = App.clone(s.line);
      if (s.fx) o.fx = App.clone(s.fx); else delete o.fx;
      if (o.text) o.text.paras.forEach((p) => p.runs.forEach((r) => { r.color = s.text; }));
    });
  });

  /* ---------- Tekstopvulling en -omtrek (WordArt) ---------- */
  App.def('textFill', (c) => {
    if (c === undefined || c === null) c = App.state.lastColors.font;
    App.applyRun((r) => { if (!c) r.fill = { type: 'none' }; else { delete r.fill; r.color = c; } });
  });
  App.menuBuilders['m-textgradient'] = () => { const th = App.theme(); const base = 'accent1'; return `<div style="display:grid;grid-template-columns:repeat(4,44px);gap:4px;padding:6px">${gradPresets(base).map((g, i) => `<button data-cmd="textGradient" data-arg="${i}" style="height:44px;border:1px solid var(--line);background:${App.gradCss(g.f, th)}"></button>`).join('')}</div>`; };
  App.def('textGradient', (i) => { const g = gradPresets('accent1')[+i]; if (g) App.applyRun((r) => { r.fill = App.clone(g.f); }); });
  App.def('textOutline', (c) => {
    if (c === undefined) c = 'tx1';
    App.applyRun((r) => { if (!c) delete r.ln; else r.ln = { type: 'solid', color: c, w: (r.ln && r.ln.w) || 0.75 }; });
  });
  App.menuBuilders['m-textweight'] = () => WEIGHTS.slice(0, 7).map((w) => `<button data-cmd="textOutlineW" data-arg="${w}">${App.fmtNum(w, 2)} pt</button>`).join('');
  App.def('textOutlineW', (w) => App.applyRun((r) => { r.ln = { type: 'solid', color: (r.ln && r.ln.color) || 'tx1', w: +w }; }));
  const TEXTFX = [['Schaduw', { shadow: { type: 'outer', color: '#000000', alpha: 0.4, blur: 4, dist: 3, dir: 45 } }], ['Gloed', { glow: { color: 'accent1', alpha: 0.6, size: 10 } }], ['Weerspiegeling', { refl: { alpha: 0.45, size: 0.5, dist: 0 } }], ['Geen effecten', null]];
  App.menuBuilders['m-texteffects'] = () => TEXTFX.map(([n], i) => `<button data-cmd="textEffect" data-arg="${i}">${App.esc(App.t(n))}</button>`).join('') + `<hr><button data-menu-sub="m-warp" data-cmd="noop"><span class="i">gesture</span> ${App.t('Transformeren')} ›</button>`;
  App.def('textEffect', (i) => { const fx = (TEXTFX[+i] || [])[1]; App.applyRun((r) => { if (!fx) delete r.fx; else r.fx = { ...(r.fx || {}), ...App.clone(fx) }; }); });
  App.WARPS = [['textNoShape', 'Geen transformatie'], ['textArchUp', 'Boog omhoog'], ['textArchDown', 'Boog omlaag'], ['textCircle', 'Cirkel'], ['textWave1', 'Golf'], ['textInflate', 'Opblazen'], ['textDeflate', 'Leeglopen'], ['textSlantUp', 'Schuin omhoog'], ['textSlantDown', 'Schuin omlaag'], ['textTriangle', 'Driehoek'], ['textChevron', 'Punthaak']];
  App.menuBuilders['m-warp'] = () => App.WARPS.map(([k, n]) => `<button data-cmd="textWarp" data-arg="${k}">${App.esc(App.t(n))}</button>`).join('');
  App.def('textWarp', (k) => App.applyBodyProps((b) => { if (k === 'textNoShape') delete b.warp; else b.warp = k; }));

  /* ---------- Opmaak kopiëren (kwast) ---------- */
  const copyFormat = () => {
    if (App.state.edit) {
      const r = (App.curRuns() || [])[0];
      const p = (App.curParaStyles() || [])[0];
      if (!r) return null;
      const run = {}; App.RUN_KEYS.forEach((k) => { if (r[k] !== undefined && k !== 'lang') run[k] = App.clone(r[k]); });
      const para = {}; if (p) ['align', 'lnSpc', 'spcBef', 'spcAft', 'bullet', 'marL', 'indent'].forEach((k) => { if (p[k] !== undefined) para[k] = App.clone(p[k]); });
      return { run, para };
    }
    const o = App.sel1(); if (!o) return null;
    const r = (App.curRuns() || [])[0];
    const run = {}; if (r) App.RUN_KEYS.forEach((k) => { if (r[k] !== undefined && k !== 'lang') run[k] = App.clone(r[k]); });
    return { obj: { fill: App.clone(o.fill), line: App.clone(o.line), fx: App.clone(o.fx), pic: App.clone(o.pic), type: o.type }, run };
  };
  const pasteFormat = (f, target) => {
    if (!f) return;
    if (App.state.edit && f.run) { App.textEdit.applyRuns((r) => Object.assign(r, App.clone(f.run))); if (f.para) App.textEdit.applyParas((p) => Object.assign(p, App.clone(f.para))); return; }
    const objs = target ? [target] : App.selObjs();
    App.run(() => objs.forEach((o) => {
      if (f.obj) {
        if (o.type !== 'line' && f.obj.type !== 'line') { if (f.obj.fill !== undefined) o.fill = App.clone(f.obj.fill); }
        if (f.obj.line !== undefined) o.line = App.clone(f.obj.line); else delete o.line;
        if (f.obj.fx) o.fx = App.clone(f.obj.fx); else delete o.fx;
        if (o.type === 'image' && f.obj.pic) o.pic = App.clone(f.obj.pic);
      }
      if (f.run && Object.keys(f.run).length) App.bodiesOf(o).forEach((b) => b.paras.forEach((p) => p.runs.forEach((r) => Object.assign(r, App.clone(f.run)))));
    }));
  };
  App.def('formatPainter', (mode) => {
    if (mode === 'copy') { App.state.fmtClip = copyFormat(); App.toast(App.t('Opmaak gekopieerd. Ctrl+Shift+V plakt de opmaak.'), 'format_paint'); return; }
    if (mode === 'paste') { pasteFormat(App.state.fmtClip); return; }
    if (App.state.painter && mode !== 'sticky') { App.state.painter = null; document.body.classList.remove('painting'); App.scheduleState(); return; }
    const f = copyFormat(); if (!f) { App.toast(App.t('Selecteer eerst iets waarvan je de opmaak wilt kopiëren.'), 'info'); return; }
    App.state.painter = { f, sticky: mode === 'sticky' };
    document.body.classList.add('painting');
    App.scheduleState();
  });
  App.stateFns.painter = () => !!App.state.painter;
  // klikken met de kwast: opmaak op het aangeklikte object of de geselecteerde tekst
  document.addEventListener('mouseup', (e) => {
    const pt = App.state.painter; if (!pt) return;
    if (!e.target.closest('#stage')) return;
    setTimeout(() => {
      if (App.state.edit) { const s = window.getSelection(); if (s && !s.isCollapsed) pasteFormat(pt.f); else return; }
      else { const id = App.pickObj && App.pickObj(e.target); if (!id) return; pasteFormat(pt.f, App.obj(id)); }
      if (!pt.sticky) { App.state.painter = null; document.body.classList.remove('painting'); App.scheduleState(); }
    }, 0);
  });

  /* ---------- Vormen samenvoegen (vaste geometrie, zie geo.js) ---------- */
  const objPolys = (o) => {
    const wb = App.worldBox(o.id);
    const g = App.geo(o, wb.w, wb.h);
    const m = App.Geo.objMatrix(wb.x, wb.y, wb.w, wb.h, wb.rot, o.flipH, o.flipV);
    const subs = g.paths.filter((p) => p.fill !== 'none').flatMap((p) => App.Geo.parse(p.d));
    return App.Geo.flatten(App.Geo.transform(subs, m), 0.35);
  };
  App.def('mergeShapes', (op) => {
    if (!App.Geo || !App.Geo.merge) { App.toast(App.t('Vormen samenvoegen is nog niet beschikbaar.'), 'info'); return; }
    const objs = App.selObjs().filter((o) => o.type === 'shape' && !o.ph);
    if (objs.length < 2) { App.toast(App.t('Selecteer twee of meer vormen om samen te voegen.'), 'info'); return; }
    const first = App.obj(App.state.sel[0]) || objs[0];
    const ordered = [first, ...objs.filter((o) => o !== first)];
    let result;
    try { result = App.Geo.merge(op === 'combine' ? 'combine' : op, ordered.map(objPolys)); } catch (e) { console.error(e); App.toast(App.t('Samenvoegen is niet gelukt.'), 'error'); return; }
    const pieces = op === 'fragment' ? result : [result];
    const valid = pieces.filter((subs) => subs && subs.length && subs.some((s) => s.pts.length > 2));
    if (!valid.length) { App.toast(App.t('Er blijft geen vorm over (de vormen overlappen niet).'), 'info'); return; }
    App.run(() => {
      const list = App.ownerList(first.id);
      const at = list.indexOf(first);
      const made = valid.map((subs) => {
        const bb = App.Geo.bbox(subs);
        const loc = App.Geo.toLocal(subs, bb);
        const o = App.newObj('shape', { geom: 'custom', path: { w: loc.w, h: loc.h, subs: loc.subs }, x: App.round(bb.x, 2), y: App.round(bb.y, 2), w: App.round(bb.w, 2), h: App.round(bb.h, 2), name: App.objName(App.t('Vrije vorm')) });
        ['fill', 'line', 'fx'].forEach((k) => { if (first[k]) o[k] = App.clone(first[k]); });
        if (first.text && !App.isEmptyText(first)) o.text = App.clone(first.text);
        return o;
      });
      App.removeObjs(ordered.map((o) => o.id));
      list.splice(Math.min(at, list.length), 0, ...made);
      App.state.sel = made.map((o) => o.id);
    });
    App.select(App.state.sel);
  });

  /* ---------- Alternatieve tekst (altijd handmatig) ---------- */
  App.def('altText', () => {
    const o = App.sel1();
    if (!o) { App.toast(App.t('Selecteer eerst een object.'), 'info'); return; }
    App.dialog({
      title: App.t('Alternatieve tekst'),
      body: `<p class="muted small" style="margin:0 0 10px;line-height:1.5">${App.t('Beschrijf in een paar zinnen wat er te zien is en waarom het belangrijk is. Mensen die de dia niet kunnen zien, krijgen deze tekst voorgelezen. Doek vult dit nooit zelf in.')}</p>
        <label class="field"><textarea id="alt-t" maxlength="2000" style="min-height:110px">${App.esc(o.alt || '')}</textarea></label>
        <label class="chk"><input type="checkbox" id="alt-d" ${o.decorative ? 'checked' : ''}> ${App.t('Markeren als decoratief (geen beschrijving nodig)')}</label>`,
      onOpen: (d) => { const sync = () => { d.$('#alt-t').disabled = d.$('#alt-d').checked; }; d.$('#alt-d').onchange = sync; sync(); },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { const t = d.$('#alt-t').value.trim(), dec = d.$('#alt-d').checked; App.run(() => { if (t && !dec) o.alt = t; else delete o.alt; if (dec) o.decorative = true; else delete o.decorative; }); } }],
    });
  });
})();
