/* =========================================================
   Doek (gemaakt door JJ van Schelven) — thema's, kleur- en lettertypesets,
   master met de 11 standaardindelingen (zoals OOXML), nieuwe presentaties en dia's
   ========================================================= */
'use strict';

(() => {
  const S = { w: 1280, h: 720 };   // referentieformaat: indelingen worden geschaald naar het echte diaformaat

  /* ---------- Kleursets (eigen ontwerpen) ---------- */
  const cs = (name, dk2, lt2, a, dk1 = '#1b1b1f', lt1 = '#ffffff') => ({ name, colors: { dk1, lt1, dk2, lt2, accent1: a[0], accent2: a[1], accent3: a[2], accent4: a[3], accent5: a[4], accent6: a[5], hlink: a[6] || a[0], folHlink: a[7] || a[4] } });
  App.COLOR_SETS = [
    cs('Kantoor', '#1f3a5f', '#eef1f5', ['#2f6fde', '#f28c28', '#2fa36b', '#f4c430', '#7a4bd1', '#e5484d']),
    cs('Blauw', '#17406d', '#dfe9f5', ['#1f5fbf', '#3a8fd9', '#55b4e6', '#1b3d6e', '#5b6ee1', '#2bb3c0']),
    cs('Blauwgroen', '#0f4c4c', '#dcf0ef', ['#138d90', '#1fb6a6', '#5ccfb0', '#0e6d7a', '#2a9d8f', '#8fd694']),
    cs('Groen', '#21452b', '#e4f1e6', ['#2e8b4e', '#5aa95c', '#9cc36b', '#1d6b3c', '#c9b458', '#4c9a8a']),
    cs('Geel', '#4a3b0b', '#fbf4dc', ['#e6b422', '#f2c94c', '#c58f19', '#8c6d1f', '#d97b29', '#7a9a3a']),
    cs('Oranje', '#4d2611', '#fbe9dd', ['#e8732b', '#f29b38', '#c9541f', '#f5c16c', '#9c3d1c', '#d9a25b']),
    cs('Rood', '#4f1517', '#f8e1e1', ['#d23a3a', '#e8705a', '#a82424', '#f2a65a', '#7c1d4f', '#c9767a']),
    cs('Roodpaars', '#4a1638', '#f6e0ee', ['#c2337a', '#e05a9b', '#8e2b8f', '#f08fb8', '#5d2a8a', '#d86a6a']),
    cs('Paars', '#2e1f57', '#ebe5f7', ['#6a4bc9', '#9b6fe0', '#4d3a9e', '#c3a4f0', '#2f6fde', '#d364b4']),
    cs('Grijstinten', '#262626', '#ededed', ['#595959', '#7f7f7f', '#a6a6a6', '#404040', '#8c8c8c', '#262626'], '#000000'),
    cs('Warm', '#4a2c1d', '#f7ede4', ['#c8553d', '#f28f3b', '#ffd5c2', '#588b8b', '#93a8ac', '#e3b505']),
    cs('Koel', '#1d2b45', '#e6ecf5', ['#3d5a80', '#98c1d9', '#5aa9a5', '#293241', '#7d8cc4', '#57cc99']),
    cs('Pastel', '#3d3d5c', '#f4f1fa', ['#8ab4f8', '#f6aec2', '#a8e6cf', '#ffd3a5', '#c5a3ff', '#ffaaa5']),
    cs('Aarde', '#3b2f22', '#f1ebe1', ['#8c6239', '#b5835a', '#6b8f71', '#c2a878', '#5e548e', '#a44a3f']),
    cs('Zee', '#0b2e4f', '#e2eef7', ['#0077b6', '#00b4d8', '#48cae4', '#023e8a', '#90e0ef', '#f4a261']),
    cs('Bos', '#1e2d24', '#e7efe9', ['#2d6a4f', '#40916c', '#74c69d', '#1b4332', '#b7924c', '#8d5b4c']),
    cs('Zonsondergang', '#3a1c32', '#fbe8e3', ['#f46036', '#e71d36', '#ff9f1c', '#c5283d', '#2e294e', '#ffbf69']),
    cs('Nacht', '#e8ecf6', '#1c2333', ['#5aa9ff', '#ff8f6b', '#5fd3a3', '#ffd166', '#b392f0', '#ff6b8b'], '#f5f7fb', '#121826'),
  ];

  /* ---------- Lettertypesets ---------- */
  App.FONT_SETS = [
    { name: 'Inter', major: 'Inter', minor: 'Inter' },
    { name: 'Georgia – Inter', major: 'Georgia', minor: 'Inter' },
    { name: 'Calibri Light – Calibri', major: 'Calibri Light', minor: 'Calibri' },
    { name: 'Cambria – Calibri', major: 'Cambria', minor: 'Calibri' },
    { name: 'Segoe UI', major: 'Segoe UI Semibold', minor: 'Segoe UI' },
    { name: 'Trebuchet MS', major: 'Trebuchet MS', minor: 'Trebuchet MS' },
    { name: 'Century Gothic', major: 'Century Gothic', minor: 'Century Gothic' },
    { name: 'Bahnschrift – Inter', major: 'Bahnschrift', minor: 'Inter' },
    { name: 'Verdana', major: 'Verdana', minor: 'Verdana' },
    { name: 'Garamond', major: 'Garamond', minor: 'Garamond' },
    { name: 'Palatino Linotype', major: 'Palatino Linotype', minor: 'Palatino Linotype' },
    { name: 'Franklin Gothic', major: 'Franklin Gothic Medium', minor: 'Franklin Gothic Book' },
    { name: 'Arial', major: 'Arial', minor: 'Arial' },
    { name: 'Times New Roman', major: 'Times New Roman', minor: 'Times New Roman' },
    { name: 'Consolas – Inter', major: 'Consolas', minor: 'Inter' },
  ];

  /* ---------- Tekststijlen van de master ---------- */
  const bodyLvls = (base = 28) => {
    const sizes = [base, base - 4, base - 8, base - 10, base - 10, base - 10, base - 10, base - 10, base - 10].map((v) => Math.max(10, v));
    return sizes.map((sz, i) => ({ marL: 24 + i * 48, indent: -24, sz, font: '+mn', color: 'tx1', lnSpc: { pct: 0.9 }, spcBef: i ? 5 : 10, bullet: { type: 'char', char: i % 2 ? '–' : '•', font: 'Arial' }, align: 'l' }));
  };
  const otherLvls = () => Array.from({ length: 9 }, (_, i) => ({ marL: i * 48, indent: 0, sz: 18, font: '+mn', color: 'tx1', align: 'l' }));
  App.defaultTx = (opts = {}) => ({
    title: [{ sz: opts.titleSz || 44, font: '+mj', color: opts.titleColor || 'tx1', lnSpc: { pct: 0.9 }, align: opts.titleAlign || 'l', b: !!opts.titleBold, caps: opts.titleCaps || undefined }],
    body: bodyLvls(opts.bodySz || 28),
    other: otherLvls(),
  });

  /* ---------- Placeholders en indelingen ---------- */
  const ph = (type, idx, x, y, w, h, extra = {}) => ({ id: App.uid('o'), type: 'shape', geom: 'rect', name: PH_NAMES[type] || 'Tijdelijke aanduiding', ph: { type, idx }, x, y, w, h, ...extra });
  const PH_NAMES = { title: 'Titel', ctrTitle: 'Titel', subTitle: 'Ondertitel', body: 'Tijdelijke aanduiding voor tekst', obj: 'Tijdelijke aanduiding voor inhoud', pic: 'Tijdelijke aanduiding voor afbeelding', dt: 'Tijdelijke aanduiding voor datum', ftr: 'Tijdelijke aanduiding voor voettekst', sldNum: 'Tijdelijke aanduiding voor dianummer', chart: 'Tijdelijke aanduiding voor grafiek', tbl: 'Tijdelijke aanduiding voor tabel', media: 'Tijdelijke aanduiding voor media' };
  App.PH_NAMES = PH_NAMES;
  const tb = (extra) => ({ paras: [App.emptyPara()], ...extra });
  const lst0 = (props) => ({ 0: props });
  const noBullet = { bullet: { type: 'none' }, marL: 0, indent: 0 };
  // Standaardposities voor 16:9 (1280 × 720 px); andere formaten worden geschaald
  App.LAYOUT_DEFS = [
    { type: 'title', name: 'Titeldia', objs: () => [
      ph('ctrTitle', 0, 160, 117.8, 960, 250.6, { text: tb({ vAlign: 'b', lst: lst0({ sz: 60, align: 'ctr' }) }) }),
      ph('subTitle', 1, 160, 378.1, 960, 173.8, { text: tb({ lst: lst0({ ...noBullet, sz: 24, align: 'ctr' }) }) }),
    ] },
    { type: 'obj', name: 'Titel en object', objs: () => [ph('title', 0, 88, 38.3, 1104, 139.2), ph('obj', 1, 88, 191.7, 1104, 456.9)] },
    { type: 'secHead', name: 'Sectiekop', objs: () => [
      ph('title', 0, 87.3, 179.6, 1104, 299.7, { text: tb({ vAlign: 'b', lst: lst0({ sz: 60 }) }) }),
      ph('body', 1, 87.3, 482.1, 1104, 157.6, { text: tb({ lst: lst0({ ...noBullet, sz: 24, color: 'tx1/l25' }) }) }),
    ] },
    { type: 'twoObj', name: 'Twee objecten', objs: () => [ph('title', 0, 88, 38.3, 1104, 139.2), ph('obj', 1, 88, 191.7, 544, 456.9), ph('obj', 2, 648, 191.7, 544, 456.9)] },
    { type: 'twoTxTwoObj', name: 'Vergelijking', objs: () => [
      ph('title', 0, 88.2, 38.3, 1104, 139.2),
      ph('body', 1, 88.2, 176.5, 541.5, 82.3, { text: tb({ vAlign: 'b', lst: lst0({ ...noBullet, sz: 24, b: true }) }) }),
      ph('obj', 2, 88.2, 258.8, 541.5, 368.1),
      ph('body', 3, 648, 176.5, 544.2, 82.3, { text: tb({ vAlign: 'b', lst: lst0({ ...noBullet, sz: 24, b: true }) }) }),
      ph('obj', 4, 648, 258.8, 544.2, 368.1),
    ] },
    { type: 'titleOnly', name: 'Alleen titel', objs: () => [ph('title', 0, 88, 38.3, 1104, 139.2)] },
    { type: 'blank', name: 'Leeg', objs: () => [] },
    { type: 'objTx', name: 'Inhoud met bijschrift', objs: () => [
      ph('title', 0, 88.2, 48, 412.8, 168, { text: tb({ vAlign: 'b', lst: lst0({ sz: 32 }) }) }),
      ph('obj', 1, 544.2, 103.7, 648, 511.8),
      ph('body', 2, 88.2, 216, 412.8, 400.3, { text: tb({ lst: lst0({ ...noBullet, sz: 16 }) }) }),
    ] },
    { type: 'picTx', name: 'Afbeelding met bijschrift', objs: () => [
      ph('title', 0, 88.2, 48, 412.8, 168, { text: tb({ vAlign: 'b', lst: lst0({ sz: 32 }) }) }),
      ph('pic', 1, 544.2, 103.7, 648, 511.8),
      ph('body', 2, 88.2, 216, 412.8, 400.3, { text: tb({ lst: lst0({ ...noBullet, sz: 16 }) }) }),
    ] },
    { type: 'vertTx', name: 'Titel en verticale tekst', objs: () => [ph('title', 0, 88, 38.3, 1104, 139.2), ph('body', 1, 88, 191.7, 1104, 456.9, { text: tb({ vert: 'vert' }) })] },
    { type: 'vertTitleAndTx', name: 'Verticale titel en tekst', objs: () => [
      ph('title', 0, 916, 38.3, 276, 610.3, { text: tb({ vert: 'vert' }) }),
      ph('body', 1, 88, 38.3, 812, 610.3, { text: tb({ vert: 'vert' }) }),
    ] },
  ];
  App.LAYOUT_NAMES = Object.fromEntries(App.LAYOUT_DEFS.map((d) => [d.type, d.name]));
  App.PROMPTS = {
    title: 'Klik om titel toe te voegen', ctrTitle: 'Klik om titel toe te voegen', subTitle: 'Klik om ondertitel toe te voegen',
    body: 'Klik om tekst toe te voegen', obj: 'Klik om tekst toe te voegen', pic: 'Klik op het pictogram om een afbeelding toe te voegen',
    chart: 'Klik om een grafiek toe te voegen', tbl: 'Klik om een tabel toe te voegen', media: 'Klik om media toe te voegen',
    dt: 'Datum', ftr: 'Voettekst', sldNum: '‹nr.›',
  };
  const masterPhs = () => [
    ph('title', 0, 88, 38.3, 1104, 139.2, { text: tb({ vAlign: 'ctr' }) }),
    ph('body', 1, 88, 191.7, 1104, 456.9, { text: tb({ vAlign: 't' }) }),
    ph('dt', 10, 88, 667.4, 288, 38.3, { text: tb({ vAlign: 'ctr', lst: lst0({ sz: 12, color: 'tx1/l50', align: 'l' }) }) }),
    ph('ftr', 11, 424, 667.4, 432, 38.3, { text: tb({ vAlign: 'ctr', lst: lst0({ sz: 12, color: 'tx1/l50', align: 'ctr' }) }) }),
    ph('sldNum', 12, 904, 667.4, 288, 38.3, { text: tb({ vAlign: 'ctr', lst: lst0({ sz: 12, color: 'tx1/l50', align: 'r' }) }) }),
  ];
  // Geometrie schalen naar een ander diaformaat
  const scaleObjs = (objs, sx, sy) => objs.forEach((o) => {
    if (o.x !== undefined) { o.x *= sx; o.y *= sy; o.w *= sx; o.h *= sy; }
    if (o.pts) o.pts = o.pts.map(([x, y]) => [x * sx, y * sy]);
  });
  App.scaleObjs = scaleObjs;

  /* ---------- Thema's (eigen ontwerpen) ----------
     decor(add) voegt decoraties toe: add(waar, object) met waar = 'master' of een indelingstype. */
  const shp = (geom, x, y, w, h, fill, extra = {}) => ({ id: App.uid('o'), type: 'shape', geom, name: 'Decoratie', x, y, w, h, fill, line: { type: 'none' }, locked: true, decorative: true, ...extra });
  const solid = (color, alpha) => (alpha === undefined ? { type: 'solid', color } : { type: 'solid', color, alpha });
  const grad = (angle, ...stops) => ({ type: 'grad', kind: 'linear', angle, stops: stops.map(([p, color, alpha]) => (alpha === undefined ? { p, color } : { p, color, alpha })) });
  const radial = (...stops) => ({ type: 'grad', kind: 'radial', stops: stops.map(([p, color, alpha]) => (alpha === undefined ? { p, color } : { p, color, alpha })) });
  App.THEMES = [
    { id: 'kantoor', name: 'Kantoor', colors: [0, 1, 11, 10], fonts: 0, bg: solid('bg1'), decor: () => {} },
    { id: 'horizon', name: 'Horizon', colors: [1, 14, 2, 16], fonts: 1, bg: solid('bg1'), decor: (add) => {
      add('master', shp('rect', 0, 704, 1280, 16, grad(0, [0, 'accent1'], [0.5, 'accent2'], [1, 'accent3'])));
      add('title', shp('rect', 0, 0, 1280, 720, grad(90, [0, 'accent1/d25'], [1, 'accent1'])), { hideMaster: true, titleColor: 'bg1' });
      add('title', shp('wave', -40, 560, 1360, 200, solid('bg1', 0.18), { adj: { adj1: 6000, adj2: 0 } }));
      add('secHead', shp('rect', 0, 0, 1280, 720, grad(90, [0, 'accent1/d25'], [1, 'accent1'])), { hideMaster: true, titleColor: 'bg1' });
    } },
    { id: 'noorderlicht', name: 'Noorderlicht', colors: [17, 8, 14, 2], fonts: 0, dark: true, bg: grad(120, [0, 'bg1'], [1, 'bg2']), decor: (add) => {
      add('master', shp('ellipse', 820, -260, 760, 620, radial([0, 'accent3', 0.35], [1, 'accent3', 0])));
      add('master', shp('ellipse', -260, 380, 760, 620, radial([0, 'accent5', 0.3], [1, 'accent5', 0])));
      add('title', shp('ellipse', 300, -200, 900, 700, radial([0, 'accent1', 0.4], [1, 'accent1', 0])));
    } },
    { id: 'polder', name: 'Polder', colors: [3, 15, 2, 12], fonts: 6, bg: solid('bg1'), decor: (add) => {
      add('master', shp('rect', 0, 0, 28, 720, solid('accent1')));
      add('master', shp('rect', 28, 0, 10, 720, solid('accent2')));
      add('title', shp('rect', 0, 470, 1280, 250, solid('accent1')), { hideMaster: true });
      add('title', shp('rect', 0, 456, 1280, 14, solid('accent2')));
    } },
    { id: 'delta', name: 'Delta', colors: [2, 1, 14, 11], fonts: 7, bg: solid('bg1'), decor: (add) => {
      add('master', shp('rtTriangle', 1100, 540, 180, 180, solid('accent1'), { flipH: true }));
      add('master', shp('rtTriangle', 1180, 620, 100, 100, solid('accent2'), { flipH: true }));
      add('title', shp('rtTriangle', 0, 0, 520, 720, solid('accent1', 0.9)), { hideMaster: true });
      add('title', shp('rtTriangle', 0, 0, 300, 720, solid('accent2', 0.85)));
      add('title', shp('triangle', 1040, 470, 300, 260, solid('accent3', 0.7)));
    } },
    { id: 'kustlijn', name: 'Kustlijn', colors: [14, 1, 2, 11], fonts: 1, bg: solid('bg1'), decor: (add) => {
      add('master', shp('wave', -20, 650, 1320, 90, solid('accent1', 0.85), { adj: { adj1: 12500, adj2: 0 } }));
      add('master', shp('wave', -20, 672, 1320, 70, solid('accent2', 0.6), { adj: { adj1: 12500, adj2: 3000 } }));
      add('title', shp('rect', 0, 0, 1280, 720, grad(90, [0, 'bg2'], [1, 'bg1'])), { hideMaster: false });
    } },
    { id: 'tulp', name: 'Tulp', colors: [7, 6, 16, 12], fonts: 7, bg: solid('bg1'), decor: (add) => {
      add('master', shp('rect', 0, 0, 1280, 22, solid('accent1')));
      add('master', shp('ellipse', 1170, 610, 160, 160, solid('accent2', 0.85)));
      add('title', shp('rect', 0, 0, 1280, 720, solid('accent1')), { hideMaster: true, titleColor: 'bg1' });
      add('title', shp('ellipse', 900, 330, 520, 520, solid('accent2', 0.9)));
      add('title', shp('ellipse', -160, -180, 420, 420, solid('accent3', 0.8)));
    } },
    { id: 'atelier', name: 'Atelier', colors: [10, 13, 5, 0], fonts: 1, bg: solid('bg2'), decor: (add) => {
      add('master', shp('rect', 64, 172, 220, 4, solid('accent1')));
      add('master', shp('rect', 0, 0, 1280, 720, { type: 'none' }, { line: { type: 'solid', color: 'accent1', w: 1.5 }, x: 28, y: 28, w: 1224, h: 664 }));
      add('title', shp('rect', 0, 0, 1280, 720, { type: 'none' }, { line: { type: 'solid', color: 'accent1', w: 3 }, x: 40, y: 40, w: 1200, h: 640 }), { hideMaster: true });
    } },
    { id: 'metro', name: 'Metro', colors: [9, 1, 5, 11], fonts: 4, bg: solid('bg1'), titleColor: 'bg1', decor: (add) => {
      add('master', shp('rect', 0, 0, 1280, 178, solid('tx2')));
      add('master', shp('rect', 0, 178, 1280, 8, solid('accent1')));
      add('title', shp('rect', 0, 0, 1280, 720, solid('tx2')), { hideMaster: true, titleColor: 'bg1' });
      add('title', shp('rect', 160, 372, 300, 8, solid('accent1')));
      add('secHead', shp('rect', 0, 0, 1280, 720, solid('accent1')), { hideMaster: true, titleColor: 'bg1' });
    } },
    { id: 'lumen', name: 'Lumen', colors: [12, 8, 1, 2], fonts: 0, bg: radial([0, 'bg1'], [1, 'bg2']), decor: (add) => {
      add('title', shp('ellipse', 380, 60, 520, 520, radial([0, 'accent1', 0.25], [1, 'accent1', 0])));
    } },
    { id: 'mozaiek', name: 'Mozaïek', colors: [16, 0, 4, 10], fonts: 5, bg: solid('bg1'), decor: (add) => {
      const sq = [[0, 0, 'accent1'], [1, 0, 'accent2'], [0, 1, 'accent3'], [1, 1, 'accent4'], [0, 2, 'accent5'], [1, 2, 'accent6'], [0, 3, 'accent1/l40'], [1, 3, 'accent2/l40']];
      sq.forEach(([cx, cy, c]) => add('title', shp('rect', 1000 + cx * 140, cy * 180, 140, 180, solid(c))));
      add('title', shp('rect', 0, 0, 1, 1, { type: 'none' }), { hideMaster: true });
      [['accent1', 0], ['accent2', 1], ['accent3', 2]].forEach(([c, i]) => add('master', shp('rect', 1220, 20 + i * 44, 40, 40, solid(c))));
    } },
    { id: 'studio', name: 'Studio', colors: [17, 9, 8, 14], fonts: 7, dark: true, bg: solid('bg1'), decor: (add) => {
      add('master', shp('rect', 88, 176, 120, 5, solid('accent1')));
      add('title', shp('rect', 160, 372, 960, 3, grad(0, [0, 'accent1'], [1, 'accent2'])));
    } },
    { id: 'pastel', name: 'Pastel', colors: [12, 2, 8, 6], fonts: 6, bg: solid('bg1'), decor: (add) => {
      add('master', shp('roundRect', 1120, -60, 220, 220, solid('accent1', 0.5), { adj: { adj: 30000 }, rot: 20 }));
      add('master', shp('ellipse', -70, 640, 200, 200, solid('accent2', 0.5)));
      add('title', shp('roundRect', 880, -120, 520, 520, solid('accent1', 0.55), { adj: { adj: 30000 }, rot: 18 }));
      add('title', shp('ellipse', -120, 420, 420, 420, solid('accent3', 0.55)));
      add('title', shp('ellipse', 980, 520, 260, 260, solid('accent2', 0.6)));
    } },
    { id: 'duin', name: 'Duin', colors: [13, 10, 16, 5], fonts: 1, bg: grad(90, [0, 'bg1'], [1, 'bg2']), decor: (add) => {
      add('master', shp('wave', -40, 640, 1360, 120, solid('accent1', 0.25), { adj: { adj1: 10000, adj2: -2000 } }));
      add('title', shp('wave', -40, 500, 1360, 260, solid('accent1', 0.35), { adj: { adj1: 12000, adj2: 2000 } }));
      add('title', shp('wave', -40, 560, 1360, 220, solid('accent2', 0.35), { adj: { adj1: 9000, adj2: -3000 } }));
      add('title', shp('ellipse', 980, 70, 170, 170, solid('accent4', 0.9)));
    } },
  ];
  App.themeDef = (id) => App.THEMES.find((t) => t.id === id) || App.THEMES[0];

  /* ---------- Een master bouwen ---------- */
  App.buildMaster = (themeId = 'kantoor', opts = {}) => {
    const def = App.themeDef(themeId);
    const setIdx = opts.colors !== undefined ? opts.colors : def.colors[opts.variant || 0];
    const set = App.COLOR_SETS[setIdx] || App.COLOR_SETS[0];
    const fset = App.FONT_SETS[opts.fonts !== undefined ? opts.fonts : def.fonts] || App.FONT_SETS[0];
    const size = opts.size || S;
    const m = {
      id: App.uid('m'), name: def.name,
      theme: { id: def.id, name: def.name, colors: { ...set.colors }, fonts: { major: fset.major, minor: fset.minor }, variant: opts.variant || 0, colorSet: set.name, fontSet: fset.name },
      bg: App.clone(def.bg),
      objs: masterPhs(),
      tx: App.defaultTx({ titleColor: def.titleColor }),
      layouts: [],
    };
    m.layouts = App.LAYOUT_DEFS.map((d) => ({ id: App.uid('l'), name: d.name, type: d.type, objs: d.objs() }));
    // decoraties en eigen opties per indeling
    const layoutOpts = {};
    def.decor((where, obj, lopts) => {
      if (where === 'master') m.objs.splice(m.objs.filter((o) => !o.ph).length, 0, obj);
      else {
        const l = m.layouts.find((x) => x.type === where);
        if (!l) return;
        if (obj.w > 1 || obj.h > 1) l.objs.splice(l.objs.filter((o) => !o.ph).length, 0, obj);
        if (lopts) layoutOpts[where] = { ...(layoutOpts[where] || {}), ...lopts };
      }
    });
    Object.entries(layoutOpts).forEach(([type, lo]) => {
      const l = m.layouts.find((x) => x.type === type);
      if (lo.hideMaster) l.hideMaster = true;
      if (lo.titleColor) l.objs.forEach((o) => { if (o.ph && /title|ctrTitle|subTitle|body/.test(o.ph.type)) { o.text = o.text || tb(); o.text.lst = o.text.lst || {}; o.text.lst[0] = { ...(o.text.lst[0] || {}), color: lo.titleColor }; } });
    });
    if (def.titleColor) m.objs.forEach((o) => { if (o.ph && o.ph.type === 'title') { o.text.lst = { 0: { color: def.titleColor } }; } });
    if (size.w !== S.w || size.h !== S.h) {
      const sx = size.w / S.w, sy = size.h / S.h;
      scaleObjs(m.objs, sx, sy);
      m.layouts.forEach((l) => scaleObjs(l.objs, sx, sy));
    }
    return m;
  };

  /* ---------- Nieuwe presentatie en dia's ---------- */
  App.newPres = (opts = {}) => {
    const kind = opts.size || '16:9';
    const size = App.SIZES[kind] ? { w: App.SIZES[kind].w, h: App.SIZES[kind].h, kind } : { w: 1280, h: 720, kind: '16:9' };
    const P = {
      format: 'doek', version: 1, id: App.uid('p'), title: opts.title || 'Presentatie1',
      size, masters: [App.buildMaster(opts.theme || 'kantoor', { variant: opts.variant || 0, size })],
      slides: [], sections: [], shows: [],
      hf: { dt: false, dtAuto: true, dtFmt: 'short', dtText: '', sldNum: false, ftr: false, ftrText: '', notTitle: true },
      show: { type: 'speaker', loop: false, timings: true, anims: true, range: null, custom: null, pen: '#e5484d', laser: '#ff2020' },
      guides: [], lang: App.LANG === 'en' ? 'en-US' : 'nl-NL',
      props: { created: Date.now(), modified: Date.now() },
    };
    if (opts.empty !== true) P.slides.push(App.newSlide(P.masters[0].layouts.find((l) => l.type === 'title'), P));
    return P;
  };
  // Dia maken volgens een indeling: lege placeholders die hun plaats van de indeling erven
  App.newSlide = (layout, P = App.pres) => {
    if (!layout) { const m = P.masters[0]; layout = m.layouts.find((l) => l.type === 'obj') || m.layouts[0]; }
    const s = { id: App.uid('s'), layout: layout.id, objs: [], anims: [] };
    let n = 1;
    layout.objs.forEach((o) => {
      if (!o.ph || /^(dt|ftr|sldNum)$/.test(o.ph.type)) return;
      s.objs.push({ id: App.uid('o'), type: 'shape', geom: 'rect', name: (PH_NAMES[o.ph.type] || 'Tijdelijke aanduiding') + ' ' + n++, ph: { type: o.ph.type, idx: o.ph.idx }, text: { paras: [App.emptyPara()] } });
    });
    return s;
  };
  // Indeling van een bestaande dia wijzigen: placeholders opnieuw koppelen, inhoud behouden
  App.applyLayout = (slide, layout) => {
    const old = slide.objs.filter((o) => o.ph);
    const keep = slide.objs.filter((o) => !o.ph);
    const fresh = App.newSlide(layout).objs;
    const used = new Set();
    const family = (t) => (t === 'ctrTitle' || t === 'title' ? 'title' : t === 'pic' ? 'pic' : 'body');
    fresh.forEach((f) => {
      const match = old.find((o) => !used.has(o) && o.ph.type === f.ph.type && o.ph.idx === f.ph.idx)
        || old.find((o) => !used.has(o) && family(o.ph.type) === family(f.ph.type));
      if (match) {
        used.add(match);
        match.ph = { ...f.ph };
        delete match.x; delete match.y; delete match.w; delete match.h; delete match.rot;
        Object.assign(f, match, { ph: f.ph });
        ['x', 'y', 'w', 'h', 'rot'].forEach((k) => delete f[k]);
      }
    });
    // placeholders zonder plek in de nieuwe indeling: met inhoud bewaren als gewoon object op de oude plek
    old.filter((o) => !used.has(o) && !App.isEmptyText(o)).forEach((o) => {
      const b = App.box(o, slide);
      const n = { ...o, x: b.x, y: b.y, w: b.w, h: b.h, txbox: true }; delete n.ph;
      keep.push(n);
    });
    slide.layout = layout.id;
    slide.objs = [...fresh, ...keep];
  };

  /* ---------- Placeholders: erven van indeling en master ---------- */
  const family = (t) => (t === 'ctrTitle' || t === 'title' ? 'title' : /^(dt|ftr|sldNum)$/.test(t) ? t : 'body');
  App.phFamily = family;
  const findPh = (objs, ph, byIdx = true) => {
    if (!objs) return null;
    if (byIdx && ph.idx !== undefined) { const h = objs.find((o) => o.ph && o.ph.idx === ph.idx && (o.ph.type === ph.type || family(o.ph.type) === family(ph.type))); if (h) return h; }
    return objs.find((o) => o.ph && o.ph.type === ph.type) || objs.find((o) => o.ph && family(o.ph.type) === family(ph.type) && (family(ph.type) !== 'body' || o.ph.type !== 'subTitle' || ph.type === 'subTitle')) || null;
  };
  // { layout, master }-placeholder waar een object op een dia/indeling van erft
  App.phChain = (obj, owner) => {
    if (!obj.ph || !App.pres) return { lph: null, mph: null };
    const master = App.masterOf(owner);
    let lph = null;
    if (owner && owner.layout !== undefined) { const layout = App.layoutOf(owner); lph = findPh(layout.objs, obj.ph); }
    const mph = owner && owner.layouts ? null : findPh(master.objs, { type: family(obj.ph.type) === 'title' ? 'title' : family(obj.ph.type) === 'body' ? 'body' : obj.ph.type }, false);
    return { lph: lph === obj ? null : lph, mph: mph === obj ? null : mph };
  };
  App.box = (obj, owner) => {
    if (obj.x !== undefined && obj.y !== undefined) return { x: obj.x, y: obj.y, w: obj.w, h: obj.h, rot: obj.rot || 0 };
    const { lph, mph } = App.phChain(obj, owner);
    const src = (lph && lph.x !== undefined ? lph : null) || (mph && mph.x !== undefined ? mph : null);
    if (src) return { x: src.x, y: src.y, w: src.w, h: src.h, rot: obj.rot || src.rot || 0 };
    const P = App.pres;
    return { x: P.size.w * 0.1, y: P.size.h * 0.25, w: P.size.w * 0.8, h: P.size.h * 0.5, rot: 0 };
  };
  // Geometrie vastzetten (bij slepen van een placeholder die nog erft)
  App.fixBox = (obj, owner) => { if (obj.x === undefined) Object.assign(obj, App.box(obj, owner || App.surface().owner)); if (!obj.rot) delete obj.rot; };
  App.isEmptyText = (o) => !o.text || o.text.paras.every((p) => p.runs.every((r) => !r.t));

  // Stijl van tekstniveau lvl voor een object: alle lagen samengevoegd
  App.lvlBase = (obj, owner, lvl = 0) => {
    const master = App.masterOf(owner);
    const fam = obj.ph ? family(obj.ph.type) : 'other';
    const tx = master.tx || App.defaultTx();
    const base = fam === 'title' ? tx.title[0] : fam === 'body' ? tx.body[Math.min(lvl, 8)] : (tx.other[Math.min(lvl, 8)] || tx.other[0]);
    const out = { ...(base || {}) };
    if (fam === 'title') delete out.bullet;
    if (/^(dt|ftr|sldNum)$/.test(fam)) { delete out.bullet; out.marL = 0; out.indent = 0; out.sz = 12; }
    // gewone vormen: lichte, gecentreerde tekst (standaardvormstijl)
    if (!obj.ph && obj.type === 'shape' && !obj.txbox) { out.color = 'lt1'; out.align = 'ctr'; }
    if (obj.ph) {
      const { lph, mph } = App.phChain(obj, owner);
      [mph, lph].forEach((p) => { if (p && p.text && p.text.lst && p.text.lst[lvl]) Object.assign(out, p.text.lst[lvl]); else if (p && p.text && p.text.lst && lvl > 0 && p.text.lst[0] && fam !== 'body') Object.assign(out, p.text.lst[0]); });
    }
    if (obj.text && obj.text.lst && obj.text.lst[lvl]) Object.assign(out, obj.text.lst[lvl]);
    return out;
  };
  // Eigenschappen van de tekstruimte (uitlijning, marges, passend maken) met overerving
  App.bodyProps = (obj, owner) => {
    const out = { vAlign: 't', ins: { l: 9.6, t: 4.8, r: 9.6, b: 4.8 }, fit: obj.ph ? 'shrink' : obj.txbox ? 'resize' : 'none', wrap: true, vert: 'horz' };
    if (obj.type === 'shape' && !obj.txbox && !obj.ph) out.vAlign = 'ctr';
    if (obj.ph) {
      const { lph, mph } = App.phChain(obj, owner);
      [mph, lph].forEach((p) => { if (p && p.text) ['vAlign', 'ins', 'fit', 'wrap', 'vert', 'cols', 'rtl'].forEach((k) => { if (p.text[k] !== undefined) out[k] = p.text[k]; }); });
      if (family(obj.ph.type) === 'title' && !(lph && lph.text && lph.text.vAlign) && !(mph && mph.text && mph.text.vAlign)) out.vAlign = 'ctr';
    }
    if (obj.text) ['vAlign', 'ins', 'fit', 'wrap', 'vert', 'cols', 'rtl', 'warp', 'scale'].forEach((k) => { if (obj.text[k] !== undefined) out[k] = obj.text[k]; });
    return out;
  };
  // Achtergrond van een dia (dia → indeling → master)
  App.bgOf = (owner) => {
    if (!owner) return { type: 'solid', color: 'bg1' };
    if (owner.bg) return owner.bg;
    if (owner.layout !== undefined) { const l = App.layoutOf(owner); if (l.bg) return l.bg; }
    const m = App.masterOf(owner);
    return m.bg || { type: 'solid', color: 'bg1' };
  };

  /* ---------- Thema toepassen ---------- */
  // Bestaande dia's houden hun inhoud; de indelingen worden op type gekoppeld aan die van het nieuwe thema
  App.applyTheme = (themeId, opts = {}) => {
    const P = App.pres;
    const old = opts.master || P.masters[0];
    const m = App.buildMaster(themeId, { variant: opts.variant || 0, size: P.size, colors: opts.colors, fonts: opts.fonts });
    if (opts.keepColors) m.theme.colors = { ...old.theme.colors };
    const map = {};
    old.layouts.forEach((l) => { const n = m.layouts.find((x) => x.type === l.type) || m.layouts.find((x) => x.type === 'obj'); map[l.id] = n.id; });
    m.id = old.id;
    const idx = P.masters.indexOf(old);
    P.masters[idx] = m;
    P.slides.forEach((s) => { if (map[s.layout]) s.layout = map[s.layout]; });
    App.touchAll();
  };
  App.applyColorSet = (setIdx, master = App.pres.masters[0]) => {
    const set = App.COLOR_SETS[setIdx]; if (!set) return;
    master.theme.colors = { ...set.colors }; master.theme.colorSet = set.name;
    App.touchAll();
  };
  App.applyFontSet = (fIdx, master = App.pres.masters[0]) => {
    const f = App.FONT_SETS[fIdx]; if (!f) return;
    master.theme.fonts = { major: f.major, minor: f.minor }; master.theme.fontSet = f.name;
    App.touchAll();
  };
})();
