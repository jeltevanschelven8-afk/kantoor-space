/* =========================================================
   Doek (gemaakt door JJ van Schelven) — grafieken in de app: invoegen, ander type,
   gegevens bewerken, rij/kolom wisselen, grafiekonderdelen, snelle indelingen,
   kleuren, stijlen en het venster Grafiek opmaken
   ========================================================= */
'use strict';

(() => {
  const ctxNow = (extra) => App.chartCtx(App.theme(), extra);
  if (App.Charts) App.Charts.getCtx = () => ctxNow();
  const chartObj = () => { const o = App.sel1(); return o && o.type === 'chart' ? o : null; };
  const preview = (chart, w, h, scale) => { try { return App.Charts.render(chart, w, h, ctxNow({ scale })); } catch (e) { return ''; } };

  /* ---------- Grafiek invoegen / ander grafiektype ---------- */
  const kindDialog = (title, curId, data, onOk) => {
    const C = App.Charts;
    let entry = C.KINDS.find((k) => k.id === curId) || C.KINDS[0];
    const body = document.createElement('div');
    body.className = 'chd';
    body.innerHTML = `<div class="chd-cats">${C.CATS.map((c) => `<button type="button" data-cat="${c.id}"><span class="chd-ic">${c.icon}</span><span>${App.esc(App.t(c.name))}</span></button>`).join('')}</div>
      <div class="chd-main"><div class="chd-kinds"></div><div class="chd-name"></div><div class="chd-prev notranslate"></div></div>`;
    const show = () => {
      body.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === entry.cat));
      body.querySelector('.chd-kinds').innerHTML = C.KINDS.filter((k) => k.cat === entry.cat).map((k) => `<button type="button" data-kind="${k.id}" class="${k.id === entry.id ? 'on' : ''}" title="${App.esc(App.t(k.name))}">${k.icon}</button>`).join('');
      body.querySelector('.chd-name').textContent = App.t(entry.name);
      const ch = data ? C.convert(data, entry) : C.sample(entry);
      body.querySelector('.chd-prev').innerHTML = preview(ch, 440, 260, 0.8);
    };
    body.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]'); if (c) { entry = C.KINDS.find((k) => k.cat === c.dataset.cat); show(); return; }
      const k = e.target.closest('[data-kind]'); if (k) { entry = C.KINDS.find((x) => x.id === k.dataset.kind); show(); }
    });
    body.addEventListener('dblclick', (e) => { if (e.target.closest('[data-kind]')) { d.close(); onOk(entry); } });
    const d = App.dialog({ title: App.t(title), body, wide: true, buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: () => onOk(entry) }] });
    show();
  };
  App.def('chartDialog', (phId) => { if (!App.Charts) return; kindDialog('Grafiek invoegen', null, null, (entry) => App.insertChart(entry, typeof phId === 'string' ? phId : null)); });
  App.insertChart = (entry, phId, opts = {}) => {
    const P = App.pres;
    let o;
    App.run(() => {
      const sel = App.sel1();
      const ph = phId ? App.obj(phId) : sel && sel.ph && /^(obj|chart)$/.test(sel.ph.type) && App.isEmptyText(sel) ? sel : null;
      const b = ph ? App.box(ph, App.surface().owner) : { x: P.size.w * 0.19, y: P.size.h * 0.2, w: P.size.w * 0.62, h: P.size.h * 0.66 };
      o = App.newObj('chart', { x: b.x, y: b.y, w: b.w, h: b.h, name: App.objName(App.t('Grafiek')), chart: opts.chart || App.Charts.sample(entry) });
      if (ph) { const list = App.ownerList(ph.id); list.splice(list.indexOf(ph), 1, o); } else App.addObj(o);
    });
    App.select([o.id]);
    if (!opts.chart && !opts.noEdit) setTimeout(() => App.exec('chartEditData'), 60);
    return o;
  };
  App.def('chartType', () => {
    const o = chartObj(); if (!o) return;
    const cur = App.Charts.kindOf(o.chart);
    kindDialog('Grafiektype wijzigen', cur && cur.id, o.chart, (entry) => { const id = o.id; App.run(() => { const x = App.obj(id); if (x) x.chart = App.cleanChart(App.Charts.convert(x.chart, entry)); }); });
  });
  App.def('chartEditData', () => {
    const o = chartObj(); if (!o) return;
    const id = o.id;
    App.Charts.editData(o.chart, (ch) => App.run(() => { const x = App.obj(id); if (x) x.chart = App.cleanChart(ch); }), ctxNow());
  });
  App.defEdit('chartSwitch', () => {
    const o = chartObj(); if (!o) return false;
    if (o.chart.kind === 'scatter' || o.chart.kind === 'bubble') { App.toast(App.t('Bij een spreidingsgrafiek kunnen rijen en kolommen niet worden gewisseld.'), 'info'); return false; }
    const T = App.Charts.toTable(o.chart);
    const tr = (T[0] || []).map((_, c) => T.map((r) => r[c]));
    o.chart = App.cleanChart(App.Charts.fromTable(tr, o.chart));
  });

  /* ---------- Grafiekonderdelen ---------- */
  const isPie = (ch) => ch.kind === 'pie' || ch.kind === 'doughnut';
  const axes = (ch) => { ch.axes = ch.axes || {}; ch.axes.cat = ch.axes.cat || {}; ch.axes.val = ch.axes.val || {}; return ch.axes; };
  const setOpt = (ch, key, val) => {
    const A = axes(ch);
    switch (key) {
      case 'title': ch.title = { on: val !== 'off', text: (ch.title && ch.title.text) || '' }; break;
      case 'legend': ch.legend = val; break;
      case 'labels': if (val === 'none') ch.labels = { ...(ch.labels || {}), on: false }; else ch.labels = { ...(ch.labels || {}), on: true, pos: val }; ch.series.forEach((s) => { delete s.labels; }); break;
      case 'axcat': if (A.cat.on === false) delete A.cat.on; else A.cat.on = false; break;
      case 'axval': if (A.val.on === false) delete A.val.on; else A.val.on = false; break;
      case 'atcat': if (A.cat.title) delete A.cat.title; else A.cat.title = App.t('Astitel'); break;
      case 'atval': if (A.val.title) delete A.val.title; else A.val.title = App.t('Astitel'); break;
      case 'gridval': A.val.grid = !(A.val.grid === undefined ? (ch.style || 1) !== 2 : A.val.grid); break;
      case 'gridcat': A.cat.grid = !A.cat.grid; break;
      default: break;
    }
  };
  App.defEdit('chartOpt', (arg) => {
    const o = chartObj(); if (!o) return false;
    const [k, v] = String(arg).split('=');
    setOpt(o.chart, k, v);
    o.chart = App.cleanChart(o.chart);
  });
  const chk = (on) => `<span class="i">${on ? 'check' : ''}</span>`;
  const opt = (arg, label, on) => `<button data-cmd="chartOpt" data-arg="${arg}">${chk(on)} ${App.esc(App.t(label))}</button>`;
  const sub = (name, icon, label, enabled = true) => `<button data-menu-sub="${name}" ${enabled ? '' : 'disabled'}><span class="i">${icon}</span> ${App.esc(App.t(label))} <span class="i" style="margin-left:auto">chevron_right</span></button>`;
  App.menuBuilders['m-chartadd'] = () => {
    const o = chartObj(); if (!o) return `<div class="menu-note">${App.t('Selecteer eerst een grafiek.')}</div>`;
    const pie = isPie(o.chart), xy = o.chart.kind === 'scatter' || o.chart.kind === 'bubble';
    return sub('m-ch-axes', 'straighten', 'Assen', !pie) + sub('m-ch-at', 'title', 'Astitels', !pie) + sub('m-ch-title', 'text_fields', 'Grafiektitel') + sub('m-ch-labels', 'label', 'Gegevenslabels')
      + sub('m-ch-grid', 'grid_on', 'Rasterlijnen', !pie) + sub('m-ch-legend', 'list', 'Legenda') + sub('m-ch-trend', 'trending_up', 'Trendlijn', !pie && o.chart.kind !== 'radar' && o.chart.kind !== 'combo' || xy)
      + `<hr><button data-cmd="chartPane"><span class="i">tune</span> ${App.t('Meer opties…')}</button>`;
  };
  const C0 = () => (chartObj() || { chart: { axes: {} } }).chart;
  App.menuBuilders['m-ch-axes'] = () => { const A = C0().axes || {}; return opt('axcat', 'Primair horizontaal', !(A.cat && A.cat.on === false)) + opt('axval', 'Primair verticaal', !(A.val && A.val.on === false)); };
  App.menuBuilders['m-ch-at'] = () => { const A = C0().axes || {}; return opt('atcat', 'Primair horizontaal', !!(A.cat && A.cat.title)) + opt('atval', 'Primair verticaal', !!(A.val && A.val.title)); };
  App.menuBuilders['m-ch-title'] = () => { const t = C0().title; return opt('title=off', 'Geen', !(t && t.on)) + opt('title=on', 'Boven grafiek', !!(t && t.on)); };
  App.menuBuilders['m-ch-labels'] = () => {
    const ch = C0(), L = ch.labels || {}, on = !!L.on, pos = L.pos || (isPie(ch) ? 'best' : 'out');
    const list = isPie(ch) ? [['ctr', 'Midden'], ['in', 'Binnen einde'], ['out', 'Buiten einde'], ['best', 'Beste passend']] : [['ctr', 'Midden'], ['in', 'Binnen einde'], ['base', 'Binnen basis'], ['out', 'Buiten einde']];
    return opt('labels=none', 'Geen', !on) + list.map(([k, l]) => opt('labels=' + k, l, on && pos === k)).join('');
  };
  App.menuBuilders['m-ch-grid'] = () => { const ch = C0(), A = ch.axes || {}; const gv = A.val && A.val.grid !== undefined ? A.val.grid : (ch.style || 1) !== 2; return opt('gridval', 'Primaire horizontale hoofdrasterlijnen', gv) + opt('gridcat', 'Primaire verticale hoofdrasterlijnen', !!(A.cat && A.cat.grid)); };
  App.menuBuilders['m-ch-legend'] = () => { const ch = C0(); const cur = ch.legend || (ch.series && (ch.series.length > 1 || isPie(ch)) ? 'b' : 'none'); return [['none', 'Geen'], ['r', 'Rechts'], ['t', 'Boven'], ['l', 'Links'], ['b', 'Onder']].map(([k, l]) => opt('legend=' + k, l, cur === k)).join(''); };
  App.menuBuilders['m-ch-trend'] = () => { const s = (C0().series || [])[0] || {}; const t = s.trend && s.trend.type; return [['', 'Geen'], ['linear', 'Lineair'], ['exp', 'Exponentieel'], ['fwd', 'Lineaire prognose'], ['movavg', 'Zwevend gemiddelde']].map(([k, l]) => `<button data-cmd="chartTrend" data-arg="${k}">${chk(k === 'fwd' ? t === 'linear' && s.trend.fwd : k ? t === k && !(s.trend && s.trend.fwd) : !t)} ${App.esc(App.t(l))}</button>`).join(''); };
  App.def('chartTrend', (k) => {
    const o = chartObj(); if (!o) return;
    const apply = (idx) => App.run(() => {
      const x = App.obj(o.id); const s = x && x.chart.series[idx]; if (!s) return;
      if (!k) delete s.trend; else if (k === 'fwd') s.trend = { type: 'linear', fwd: 2 }; else if (k === 'movavg') s.trend = { type: 'movavg', period: 2 }; else s.trend = { type: k };
      x.chart = App.cleanChart(x.chart);
    });
    const S = o.chart.series || [];
    if (S.length <= 1) { apply(0); return; }
    App.dialog({
      title: App.t('Trendlijn toevoegen'),
      body: `<p>${App.t('Voeg een trendlijn toe op basis van reeks:')}</p><div class="radio-list notranslate">${S.map((s, i) => `<label><input type="radio" name="ct-s" value="${i}" ${i ? '' : 'checked'}> ${App.esc(s.name || App.t('Reeks') + ' ' + (i + 1))}</label>`).join('')}</div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => apply(+((d.$('input[name="ct-s"]:checked') || {}).value || 0)) }],
    });
  });

  /* ---------- Snelle indeling ---------- */
  const LAYOUTS = [
    { title: 'on', legend: 'r', labels: 'none', grid: true },
    { title: 'on', legend: 't', labels: 'out', grid: false, noVal: true },
    { title: 'on', legend: 'b', labels: 'none', grid: true },
    { title: 'off', legend: 'b', labels: 'ctr', grid: true },
    { title: 'on', legend: 'none', labels: 'none', grid: true, at: true },
    { title: 'on', legend: 'r', labels: 'none', grid: true, at: true },
    { title: 'on', legend: 'none', labels: 'out', grid: true },
    { title: 'off', legend: 'none', labels: 'out', grid: false },
  ];
  const withLayout = (ch0, L) => {
    const ch = App.clone(ch0); const A = axes(ch);
    ch.title = { on: L.title === 'on', text: (ch.title && ch.title.text) || '' };
    ch.legend = L.legend;
    ch.labels = L.labels === 'none' ? { on: false } : { on: true, pos: isPie(ch) && L.labels === 'base' ? 'best' : L.labels };
    ch.series.forEach((s) => { delete s.labels; });
    A.val.grid = !!L.grid;
    if (L.noVal) A.val.on = false; else delete A.val.on;
    if (L.at) { A.cat.title = A.cat.title || App.t('Astitel'); A.val.title = A.val.title || App.t('Astitel'); } else { delete A.cat.title; delete A.val.title; }
    return ch;
  };
  App.menuBuilders['m-chartquick'] = () => {
    const o = chartObj(); if (!o) return `<div class="menu-note">${App.t('Selecteer eerst een grafiek.')}</div>`;
    return `<div class="ch-quick notranslate">${LAYOUTS.map((L, i) => `<button data-cmd="chartLayout" data-arg="${i}" title="${App.esc(App.t('Indeling') + ' ' + (i + 1))}">${preview(withLayout(o.chart, L), 96, 64, 0.32)}</button>`).join('')}</div>`;
  };
  App.defEdit('chartLayout', (i) => { const o = chartObj(); const L = LAYOUTS[+i]; if (!o || !L) return false; o.chart = App.cleanChart(withLayout(o.chart, L)); });

  /* ---------- Kleuren en stijlen ---------- */
  App.menuBuilders['m-chartcolors'] = () => {
    const o = chartObj(); const ctx = ctxNow(); const cur = (o && o.chart.palette) || 'theme';
    const row = (p) => `<button data-cmd="chartPalette" data-arg="${p.id}" class="ch-pal${p.id === cur ? ' on' : ''}" title="${App.esc(App.t(p.name))}">${App.Charts.paletteColors(p.id, ctx, 6).map((c) => `<i style="background:${c}"></i>`).join('')}</button>`;
    const P = App.Charts.PALETTES;
    return `<div class="menu-head">${App.t('Kleurrijk')}</div>${P.filter((p) => !/^mono/.test(p.id)).map(row).join('')}<div class="menu-head">${App.t('Monochroom')}</div>${P.filter((p) => /^mono/.test(p.id)).map(row).join('')}`;
  };
  App.defEdit('chartPalette', (id) => { const o = chartObj(); if (!o) return false; if (id === 'theme') delete o.chart.palette; else o.chart.palette = id; o.chart.series.forEach((s) => { delete s.color; delete s.pointColors; }); });
  App.defEdit('chartStyle', (id) => { const o = chartObj(); if (!o) return false; o.chart.style = +id || 1; });
  App.fillChartStyles = () => {
    const g = $('#g-chartstyles'); if (!g) return;
    const o = chartObj(); if (!o) { g.innerHTML = ''; return; }
    const cur = o.chart.style || 1;
    g.innerHTML = App.Charts.STYLES.map((s) => `<button class="ch-style notranslate${s.id === cur ? ' on' : ''}" data-cmd="chartStyle" data-arg="${s.id}" title="${App.esc(App.t(s.name))}">${preview({ ...o.chart, style: s.id, title: { on: false } }, 64, 44, 0.24)}</button>`).join('');
  };
  const stylesSoon = App.debounce(() => { if (chartObj()) App.fillChartStyles(); }, 250);
  App.on('selection', () => { if (chartObj()) App.fillChartStyles(); });
  App.on('change', stylesSoon);

  /* ---------- Venster Grafiek opmaken ---------- */
  App.def('chartPane', () => App.panes.open('chart'));
  let paneSeries = 0;
  App.panes.register('chart', {
    title: 'Grafiek opmaken',
    render(body) {
      const H = App.paneH;
      const o = chartObj();
      if (!o) { body.innerHTML = `<div class="pane-empty">${App.t('Selecteer een grafiek om deze op te maken.')}</div>`; return; }
      const ch = o.chart, A = ch.axes || {}, ca = A.cat || {}, va = A.val || {}, L = ch.labels || {};
      const pie = isPie(ch), xy = ch.kind === 'scatter' || ch.kind === 'bubble', bars = /column|bar|combo/.test(ch.kind);
      const S = ch.series || [];
      if (paneSeries >= S.length) paneSeries = 0;
      const s = S[paneSeries] || {};
      const tr = s.trend || {};
      const fmts = App.Charts.FORMATS.map((f) => [f.code, f.name]);
      const textRow = (id, label, value) => `<div class="pr"><span>${App.esc(App.t(label))}</span><input type="text" id="${id}" value="${App.esc(value || '')}" class="notranslate"></div>`;
      let h = H.section('Grafiektitel', true, H.check('cp-title', 'Titel weergeven', !!(ch.title && ch.title.on)) + textRow('cp-title-text', 'Tekst', ch.title && ch.title.text));
      h += H.section('Legenda', false, H.select('cp-legend', 'Positie', ch.legend || (S.length > 1 || pie ? 'b' : 'none'), [['none', 'Geen'], ['r', 'Rechts'], ['t', 'Boven'], ['l', 'Links'], ['b', 'Onder']]));
      h += H.section('Gegevenslabels', false, H.check('cp-dl', 'Gegevenslabels weergeven', !!L.on) + H.check('cp-dl-val', 'Waarde', L.val !== false && (L.val || !(L.cat || L.pct || L.ser))) + H.check('cp-dl-cat', 'Categorienaam', !!L.cat) + H.check('cp-dl-ser', 'Reeksnaam', !!L.ser) + (pie ? H.check('cp-dl-pct', 'Percentage', !!L.pct) : '')
        + H.select('cp-dl-pos', 'Positie', L.pos || (pie ? 'best' : 'out'), pie ? [['ctr', 'Midden'], ['in', 'Binnen einde'], ['out', 'Buiten einde'], ['best', 'Beste passend']] : [['ctr', 'Midden'], ['in', 'Binnen einde'], ['base', 'Binnen basis'], ['out', 'Buiten einde']]));
      if (!pie) {
        h += H.section(xy ? 'Horizontale (waarde)as' : 'Categorieas', false, H.check('cp-ca-on', 'As weergeven', ca.on !== false) + textRow('cp-ca-title', 'Astitel', ca.title) + H.check('cp-ca-grid', 'Rasterlijnen', !!ca.grid) + (xy ? H.check('cp-ca-log', 'Logaritmische schaal', !!ca.log) + H.select('cp-ca-fmt', 'Getalnotatie', ca.fmt || 'General', fmts) : H.check('cp-ca-rev', 'Categorieën in omgekeerde volgorde', !!ca.rev)));
        h += H.section(xy ? 'Verticale (waarde)as' : 'Waardeas', false, H.check('cp-va-on', 'As weergeven', va.on !== false) + textRow('cp-va-title', 'Astitel', va.title) + H.check('cp-va-grid', 'Rasterlijnen', va.grid !== undefined ? va.grid : (ch.style || 1) !== 2)
          + H.num('cp-va-min', 'Minimum', va.min ?? '', 1) + H.num('cp-va-max', 'Maximum', va.max ?? '', 1) + H.num('cp-va-major', 'Hoofdeenheid', va.major ?? '', 1, 0) + H.check('cp-va-log', 'Logaritmische schaal', !!va.log) + H.select('cp-va-fmt', 'Getalnotatie', va.fmt || 'General', fmts)
          + `<div class="muted small" style="padding:2px 0 6px">${App.t('Laat minimum, maximum en hoofdeenheid leeg voor automatisch.')}</div>`);
      }
      if (S.length) {
        let sh = H.select('cp-ser', 'Reeks', paneSeries, S.map((x, i) => [i, x.name || App.t('Reeks') + ' ' + (i + 1)])) + H.color('cp-s-color', 'Kleur', s.color || null);
        if (/line|scatter|radar|combo/.test(ch.kind)) sh += H.select('cp-s-marker', 'Markering', s.marker || 'auto', [['auto', 'Automatisch'], ['none', 'Geen'], ['circle', 'Cirkel'], ['square', 'Vierkant'], ['diamond', 'Ruit'], ['triangle', 'Driehoek']]) + H.check('cp-s-smooth', 'Vloeiende lijn', !!s.smooth);
        if (ch.kind === 'combo') sh += H.select('cp-s-kind', 'Grafiektype van de reeks', s.kind || 'column', [['column', 'Kolom'], ['line', 'Lijn'], ['area', 'Vlak']]) + H.check('cp-s-axis', 'Secundaire as', s.axis === 2);
        sh += H.check('cp-s-labels', 'Gegevenslabels voor deze reeks', typeof s.labels === 'boolean' ? s.labels : !!L.on);
        if (!pie && ch.kind !== 'radar') sh += H.select('cp-s-trend', 'Trendlijn', tr.type || '', [['', 'Geen'], ['linear', 'Lineair'], ['exp', 'Exponentieel'], ['log', 'Logaritmisch'], ['poly', 'Polynoom'], ['power', 'Macht'], ['movavg', 'Zwevend gemiddelde']])
          + (tr.type ? (tr.type === 'poly' ? H.num('cp-t-order', 'Graad', tr.order || 2, 1, 2, 6) : '') + (tr.type === 'movavg' ? H.num('cp-t-period', 'Periode', tr.period || 2, 1, 2, 100) : '') + (tr.type !== 'movavg' ? H.num('cp-t-fwd', 'Prognose vooruit', tr.fwd || 0, 1, 0) + H.check('cp-t-eq', 'Vergelijking weergeven', !!tr.eq) + H.check('cp-t-r2', 'R-kwadraat weergeven', !!tr.r2) : '') : '');
        h += H.section('Reeksen', true, sh);
      }
      let oh = '';
      if (bars) oh += H.range('cp-gap', 'Breedte tussenruimte', ch.gap ?? 150, 0, 500) + H.range('cp-overlap', 'Overlapping reeksen', ch.overlap ?? 0, -100, 100);
      if (pie) oh += H.range('cp-ang', 'Hoek van eerste segment', ch.firstAng ?? 0, 0, 360, '°') + (ch.kind === 'doughnut' ? H.range('cp-hole', 'Grootte van ringgat', ch.hole ?? 50, 10, 90) : '');
      oh += H.num('cp-fsz', 'Tekengrootte', (ch.font && ch.font.sz) || 12, 1, 4, 200, 'pt') + H.color('cp-fcolor', 'Tekstkleur', (ch.font && ch.font.color) || null);
      h += H.section('Opties', !S.length, oh);
      body.innerHTML = h;
      const upd = (fn) => () => { const x = chartObj(); if (!x) return; fn(x.chart); x.chart = App.cleanChart(x.chart); };
      const ax = (ch2, k) => { const a = axes(ch2); return a[k]; };
      const ser = (ch2) => ch2.series[paneSeries];
      const num = (v) => (v === '' || !Number.isFinite(v) ? undefined : v);
      const hd = {
        'cp-title': (v) => upd((c) => { c.title = { on: v, text: (c.title && c.title.text) || '' }; })(),
        'cp-title-text': (v) => upd((c) => { c.title = { on: true, text: v }; })(),
        'cp-legend': (v) => upd((c) => { c.legend = v; })(),
        'cp-dl': (v) => upd((c) => { c.labels = { ...(c.labels || {}), on: v }; })(),
        'cp-dl-val': (v) => upd((c) => { c.labels = { ...(c.labels || {}), on: true, val: v }; })(),
        'cp-dl-cat': (v) => upd((c) => { c.labels = { ...(c.labels || {}), on: true, cat: v }; })(),
        'cp-dl-ser': (v) => upd((c) => { c.labels = { ...(c.labels || {}), on: true, ser: v }; })(),
        'cp-dl-pct': (v) => upd((c) => { c.labels = { ...(c.labels || {}), on: true, pct: v }; })(),
        'cp-dl-pos': (v) => upd((c) => { c.labels = { ...(c.labels || {}), on: true, pos: v }; })(),
        'cp-ca-on': (v) => upd((c) => { const a = ax(c, 'cat'); if (v) delete a.on; else a.on = false; })(),
        'cp-ca-title': (v) => upd((c) => { const a = ax(c, 'cat'); if (v) a.title = v; else delete a.title; })(),
        'cp-ca-grid': (v) => upd((c) => { ax(c, 'cat').grid = v; })(),
        'cp-ca-rev': (v) => upd((c) => { ax(c, 'cat').rev = v; })(),
        'cp-ca-log': (v) => upd((c) => { ax(c, 'cat').log = v; })(),
        'cp-ca-fmt': (v) => upd((c) => { ax(c, 'cat').fmt = v === 'General' ? undefined : v; })(),
        'cp-va-on': (v) => upd((c) => { const a = ax(c, 'val'); if (v) delete a.on; else a.on = false; })(),
        'cp-va-title': (v) => upd((c) => { const a = ax(c, 'val'); if (v) a.title = v; else delete a.title; })(),
        'cp-va-grid': (v) => upd((c) => { ax(c, 'val').grid = v; })(),
        'cp-va-min': (v) => upd((c) => { ax(c, 'val').min = num(v); })(),
        'cp-va-max': (v) => upd((c) => { ax(c, 'val').max = num(v); })(),
        'cp-va-major': (v) => upd((c) => { ax(c, 'val').major = num(v) > 0 ? v : undefined; })(),
        'cp-va-log': (v) => upd((c) => { ax(c, 'val').log = v; })(),
        'cp-va-fmt': (v) => upd((c) => { ax(c, 'val').fmt = v === 'General' ? undefined : v; })(),
        'cp-s-color': (col) => upd((c) => { const x = ser(c); if (x) { if (col) x.color = col; else delete x.color; } })(),
        'cp-s-marker': (v) => upd((c) => { const x = ser(c); if (x) { if (v === 'auto') delete x.marker; else x.marker = v; } })(),
        'cp-s-smooth': (v) => upd((c) => { const x = ser(c); if (x) x.smooth = v; })(),
        'cp-s-kind': (v) => upd((c) => { const x = ser(c); if (x) x.kind = v; })(),
        'cp-s-axis': (v) => upd((c) => { const x = ser(c); if (x) { if (v) x.axis = 2; else delete x.axis; } })(),
        'cp-s-labels': (v) => upd((c) => { const x = ser(c); if (x) x.labels = v; })(),
        'cp-s-trend': (v) => upd((c) => { const x = ser(c); if (x) { if (!v) delete x.trend; else x.trend = { ...(x.trend || {}), type: v }; } })(),
        'cp-t-order': (v) => upd((c) => { const x = ser(c); if (x && x.trend) x.trend.order = App.clamp(Math.round(v), 2, 6); })(),
        'cp-t-period': (v) => upd((c) => { const x = ser(c); if (x && x.trend) x.trend.period = App.clamp(Math.round(v), 2, 100); })(),
        'cp-t-fwd': (v) => upd((c) => { const x = ser(c); if (x && x.trend) x.trend.fwd = v > 0 ? v : undefined; })(),
        'cp-t-eq': (v) => upd((c) => { const x = ser(c); if (x && x.trend) x.trend.eq = v; })(),
        'cp-t-r2': (v) => upd((c) => { const x = ser(c); if (x && x.trend) x.trend.r2 = v; })(),
        'cp-gap': (v) => upd((c) => { c.gap = v; })(),
        'cp-overlap': (v) => upd((c) => { c.overlap = v; })(),
        'cp-ang': (v) => upd((c) => { c.firstAng = v; })(),
        'cp-hole': (v) => upd((c) => { c.hole = v; })(),
        'cp-fsz': (v) => upd((c) => { c.font = { ...(c.font || {}), sz: v }; })(),
        'cp-fcolor': (col) => upd((c) => { c.font = { ...(c.font || {}) }; if (col) c.font.color = col; else delete c.font.color; })(),
        __rebuild: ['cp-s-trend', 'cp-dl', 'cp-title'],
      };
      App.paneBind(body, hd);
      const sel = body.querySelector('#cp-ser');
      if (sel) sel.addEventListener('change', () => { paneSeries = +sel.value || 0; App.panes.refresh(true); });
    },
  });
  App.on('selection', () => { if (App.state.pane === 'chart') App.panes.refresh(); });
})();
