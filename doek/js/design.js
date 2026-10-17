/* =========================================================
   Doek (gemaakt door JJ van Schelven) — Ontwerpen: thema's en varianten,
   kleur- en lettertypesets (ook eigen sets), achtergrondstijlen, thema uit een
   bestand en de diagrootte (standaard, breedbeeld, aangepast)
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const curMaster = () => {
    const P = App.pres;
    return st.view === 'master' ? P.masters[App.clamp(st.master.mi, 0, P.masters.length - 1)] : App.masterOf(App.cur());
  };
  const after = () => { App.invalidateThumbs && App.invalidateThumbs(); App.scheduleRender(true); App.thumbs && App.thumbs.refresh(true); App.fillThemeGallery(); App.updateSwatches && App.updateSwatches(); };

  /* ---------- Voorbeelden van thema's ---------- */
  const cache = new Map();
  const themeTile = (id, variant, width) => {
    const P = App.pres;
    const key = [id, variant, width, P.size.w, P.size.h].join('|');
    if (!cache.has(key)) {
      const m = App.buildMaster(id, { variant, size: P.size });
      P.masters.push(m);   // tijdelijk, zodat de dia zijn indeling en thema vindt
      try {
        const l = m.layouts.find((x) => x.type === 'title') || m.layouts[0];
        const s = App.newSlide(l, P);
        s.objs.forEach((o) => { if (o.ph && /^(title|ctrTitle)$/.test(o.ph.type)) o.text = { paras: [{ runs: [{ t: 'Aa', sz: Math.round(1600 / Math.max(48, width)) * 10 }] }] }; });
        cache.set(key, App.slideThumb(s, width));
      } finally { P.masters.pop(); }
      if (cache.size > 300) cache.delete(cache.keys().next().value);
    }
    return cache.get(key).cloneNode(true);
  };
  const tile = (cmd, arg, title, el, on, cls = 'th-tile') => { const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.dataset.cmd = cmd; b.dataset.arg = arg; b.title = App.t(title); b.appendChild(el); return b; };
  App.fillThemeGallery = () => {
    const P = App.pres; if (!P) return;
    const m = curMaster(); const curId = m.theme.id, curVar = m.theme.variant || 0;
    const g = $('#g-themes');
    if (g) g.replaceChildren(...App.THEMES.map((t) => tile('applyTheme', t.id, t.name, themeTile(t.id, 0, 96), t.id === curId, 'theme-chip')));
    const v = $('#g-variants');
    if (v) { const def = App.themeDef(curId); v.replaceChildren(...def.colors.map((_, i) => tile('applyVariant', String(i), App.t('Variant') + ' ' + (i + 1), themeTile(def.id, i, 64), i === curVar, 'var-chip'))); }
  };
  App.on('load', () => { cache.clear(); setTimeout(App.fillThemeGallery, 50); });
  App.on('slide', () => { if (App.pres && App.pres.masters.length > 1) App.fillThemeGallery(); });

  App.menuBuilders['m-themes'] = () => {
    const used = App.pres.masters.length > 1 ? `<div class="menu-head">${App.t('In deze presentatie')}</div><div class="th-grid">${App.pres.masters.map((x, i) => `<button class="th-tile" data-cmd="applyMasterSel" data-arg="${i}" title="${App.esc(x.name)}"></button>`).join('')}</div>` : '';
    return used + `<div class="menu-head">${App.t('Ingebouwde thema\'s')}</div><div class="th-grid" id="th-all"></div><hr>
      <button data-cmd="themeFromFile"><span class="i">folder_open</span> ${App.t('Bladeren naar thema\'s…')}</button>
      <button data-cmd="saveTheme"><span class="i">save</span> ${App.t('Huidig thema opslaan…')}</button>
      ${st.view !== 'master' && App.selSlides().length > 0 ? `<hr><div class="menu-note">${App.t('Tip: houd Shift ingedrukt om een thema alleen op de geselecteerde dia\'s toe te passen.')}</div>` : ''}`;
  };
  App.menuAfter['m-themes'] = (menu) => {
    const m = curMaster();
    const all = menu.querySelector('#th-all');
    App.THEMES.forEach((t) => all.appendChild(tile('applyTheme', t.id, t.name, themeTile(t.id, 0, 132), t.id === m.theme.id)));
    menu.querySelectorAll('[data-cmd="applyMasterSel"]').forEach((b) => {
      const x = App.pres.masters[+b.dataset.arg];
      const l = x.layouts.find((y) => y.type === 'title') || x.layouts[0];
      b.appendChild(App.slideThumb(l, 132));
    });
  };
  // Shift+klik: alleen op de geselecteerde dia's
  let shiftDown = false;
  document.addEventListener('mousedown', (e) => { shiftDown = e.shiftKey; }, true);

  App.def('applyTheme', (id) => {
    if (!App.THEMES.some((t) => t.id === id)) return;
    if (shiftDown && st.view !== 'master') { App.exec('applyThemeSel', id); return; }
    App.run(() => { App.applyTheme(id, { master: curMaster(), variant: 0 }); }, { all: true, masters: true });
    after();
  });
  // thema alleen op de geselecteerde dia's: een extra master
  App.def('applyThemeSel', (id) => {
    const P = App.pres; const slides = App.selSlides(); if (!slides.length) return;
    App.run(() => {
      const m = App.buildMaster(id, { size: P.size });
      P.masters.push(m);
      slides.forEach((s) => { const old = App.layoutOf(s); const l = m.layouts.find((x) => x.type === old.type) || m.layouts.find((x) => x.type === 'obj') || m.layouts[0]; App.applyLayout(s, l); });
      dropUnused();
    }, { all: true, masters: true });
    after();
  });
  App.def('applyMasterSel', (i) => {
    const P = App.pres; const m = P.masters[+i]; if (!m) return;
    App.run(() => { App.selSlides().forEach((s) => { const old = App.layoutOf(s); const l = m.layouts.find((x) => x.type === old.type) || m.layouts[0]; App.applyLayout(s, l); }); dropUnused(); }, { all: true, masters: true });
    after();
  });
  // masters zonder dia's opruimen (de eerste blijft altijd)
  const dropUnused = () => {
    const P = App.pres;
    const used = new Set(P.slides.map((s) => App.masterOf(s)));
    P.masters = P.masters.filter((m, i) => i === 0 || used.has(m) || m.preserve);
    st.master.mi = App.clamp(st.master.mi, 0, P.masters.length - 1);
  };
  App.def('applyVariant', (i) => {
    const m = curMaster(); const def = App.themeDef(m.theme.id); const v = App.clamp(+i || 0, 0, def.colors.length - 1);
    // een variant wisselt alleen de kleuren; eigen wijzigingen in master en indelingen blijven
    const set = App.COLOR_SETS[def.colors[v]] || App.COLOR_SETS[0];
    App.run(() => { m.theme.colors = { ...set.colors }; m.theme.colorSet = set.name; m.theme.variant = v; App.touchAll(); }, { all: true, masters: true });
    after();
  });

  /* ---------- Thema uit een bestand, thema opslaan ---------- */
  App.def('themeFromFile', async () => {
    const f = await App.pickFile('.doek,.pptx,.potx,.thmx,application/json');
    if (!f) return;
    let other;
    try { other = await App.fileToPres(f); } catch (e) { App.toast(App.t('Kan het thema niet lezen: {0}').replace('{0}', e.message), 'error'); return; }
    const src = other && other.masters && other.masters[0];
    if (!src) { App.toast(App.t('Dit bestand bevat geen thema.'), 'error'); return; }
    App.run(() => {
      const P = App.pres; const old = curMaster();
      const m = App.clone(src);
      m.id = old.id;
      // indelingen koppelen op type, en de afmetingen aanpassen aan deze presentatie
      const sx = P.size.w / other.size.w, sy = P.size.h / other.size.h;
      if (sx !== 1 || sy !== 1) { App.scaleObjs(m.objs, sx, sy); m.layouts.forEach((l) => App.scaleObjs(l.objs, sx, sy)); }
      const map = {};
      old.layouts.forEach((l) => { const n = m.layouts.find((x) => x.type === l.type) || m.layouts.find((x) => x.type === 'obj') || m.layouts[0]; map[l.id] = n.id; });
      P.masters[P.masters.indexOf(old)] = m;
      P.slides.forEach((s) => { if (map[s.layout]) s.layout = map[s.layout]; });
    }, { all: true, masters: true });
    after();
    App.toast(App.t('Thema toegepast'), 'ok');
  });
  App.def('saveTheme', () => { App.toast(App.t('Het thema wordt opgeslagen als sjabloon (.potx) met alle indelingen.'), 'info'); App.exportAs('potx'); });

  /* ---------- Kleuren ---------- */
  const SLOT_NAMES = [['dk1', 'Tekst/achtergrond - donker 1'], ['lt1', 'Tekst/achtergrond - licht 1'], ['dk2', 'Tekst/achtergrond - donker 2'], ['lt2', 'Tekst/achtergrond - licht 2'], ['accent1', 'Accent 1'], ['accent2', 'Accent 2'], ['accent3', 'Accent 3'], ['accent4', 'Accent 4'], ['accent5', 'Accent 5'], ['accent6', 'Accent 6'], ['hlink', 'Hyperlink'], ['folHlink', 'Gevolgde hyperlink']];
  const customColors = () => App.store.get('kleursets', []) || [];
  const customFonts = () => App.store.get('lettersets', []) || [];
  const swatches = (c) => ['dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((k) => `<i style="background:${App.esc(c[k])}"></i>`).join('');
  App.menuBuilders['m-colorsets'] = () => {
    const cur = curMaster().theme.colorSet;
    const row = (cmd, arg, name, colors) => `<button class="cs-row${name === cur ? ' on' : ''}" data-cmd="${cmd}" data-arg="${App.esc(arg)}"><span class="cs-sw">${swatches(colors)}</span><span class="notranslate">${App.esc(App.t(name))}</span></button>`;
    const own = customColors();
    return `<div class="cs-list">${own.length ? `<div class="menu-head">${App.t('Aangepast')}</div>${own.map((c, i) => row('applyCustomColors', String(i), c.name, c.colors)).join('')}<div class="menu-head">${App.t('Ingebouwd')}</div>` : ''}${App.COLOR_SETS.map((c, i) => row('applyColorSet', String(i), c.name, c.colors)).join('')}</div><hr><button data-cmd="customColorsDialog"><span class="i">palette</span> ${App.t('Kleuren aanpassen…')}</button>`;
  };
  App.def('applyColorSet', (i) => { App.run(() => App.applyColorSet(+i, curMaster()), { all: true, masters: true }); after(); });
  App.def('applyCustomColors', (i) => { const c = customColors()[+i]; if (!c) return; App.run(() => { const m = curMaster(); m.theme.colors = { ...c.colors }; m.theme.colorSet = c.name; App.touchAll(); }, { all: true, masters: true }); after(); });
  App.def('customColorsDialog', () => {
    const m = curMaster(); const c = { ...m.theme.colors };
    const body = `<div class="cc-grid">${SLOT_NAMES.map(([k, n]) => `<label class="cc-row"><span>${App.esc(App.t(n))}</span><input type="color" data-k="${k}" value="${App.esc(c[k] || '#000000')}"></label>`).join('')}</div>
      <div class="cc-prev" id="cc-prev"></div>
      <label class="field"><span>${App.t('Naam')}</span><input id="cc-name" value="${App.esc(App.t('Aangepast') + ' ' + (customColors().length + 1))}"></label>`;
    App.dialog({
      title: App.t('Nieuwe themakleuren maken'), body, wide: true,
      onOpen: (d) => {
        const prev = () => { d.$('#cc-prev').innerHTML = `<div style="background:${c.lt1};color:${c.dk1};padding:10px 14px;border:1px solid var(--line)"><b style="color:${c.dk2}">${App.t('Tekst')}</b> · <span style="color:${c.hlink};text-decoration:underline">${App.t('Hyperlink')}</span><div style="display:flex;gap:4px;margin-top:8px">${['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((k) => `<i style="flex:1;height:22px;background:${c[k]}"></i>`).join('')}</div></div>`; };
        prev();
        d.el.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k) { c[k] = e.target.value; prev(); } });
      },
      buttons: [{ label: 'Opnieuw instellen', left: true, action: (d) => { const set = App.COLOR_SETS.find((x) => x.name === m.theme.colorSet) || App.COLOR_SETS[0]; Object.assign(c, set.colors); d.$$('[data-k]').forEach((i) => { i.value = c[i.dataset.k]; }); return false; } },
        { label: 'Annuleren' },
        { label: 'Opslaan', primary: true, action: (d) => {
          const name = d.$('#cc-name').value.trim().slice(0, 60) || App.t('Aangepast');
          const list = customColors().filter((x) => x.name !== name); list.unshift({ name, colors: { ...c } }); App.store.set('kleursets', list.slice(0, 40));
          App.run(() => { m.theme.colors = { ...c }; m.theme.colorSet = name; App.touchAll(); }, { all: true, masters: true });
          after();
        } }],
    });
  });

  /* ---------- Lettertypen ---------- */
  App.menuBuilders['m-fontsets'] = () => {
    const cur = curMaster().theme.fontSet;
    const row = (cmd, arg, f) => `<button class="fs-row${f.name === cur ? ' on' : ''}" data-cmd="${cmd}" data-arg="${App.esc(arg)}"><span class="fs-aa notranslate" style="font-family:${App.esc(App.cssFont(f.major))}">Aa</span><span class="fs-names notranslate"><b style="font-family:${App.esc(App.cssFont(f.major))}">${App.esc(f.major)}</b><small style="font-family:${App.esc(App.cssFont(f.minor))}">${App.esc(f.minor)}</small></span></button>`;
    const own = customFonts();
    return `<div class="fs-list">${own.length ? `<div class="menu-head">${App.t('Aangepast')}</div>${own.map((f, i) => row('applyCustomFonts', String(i), f)).join('')}<div class="menu-head">${App.t('Ingebouwd')}</div>` : ''}${App.FONT_SETS.map((f, i) => row('applyFontSet', String(i), f)).join('')}</div><hr><button data-cmd="customFontsDialog"><span class="i">text_fields</span> ${App.t('Lettertypen aanpassen…')}</button>`;
  };
  App.def('applyFontSet', (i) => { App.run(() => App.applyFontSet(+i, curMaster()), { all: true, masters: true }); after(); App.fillFontBox && App.fillFontBox(); });
  App.def('applyCustomFonts', (i) => { const f = customFonts()[+i]; if (!f) return; App.run(() => { const m = curMaster(); m.theme.fonts = { major: f.major, minor: f.minor }; m.theme.fontSet = f.name; App.touchAll(); }, { all: true, masters: true }); after(); });
  App.def('customFontsDialog', () => {
    const m = curMaster();
    const fonts = (App.fontList ? App.fontList() : ['Inter']).slice();
    const opts = (v) => fonts.concat(fonts.includes(v) ? [] : [v]).map((f) => `<option ${f === v ? 'selected' : ''}>${App.esc(f)}</option>`).join('');
    App.dialog({
      title: App.t('Nieuwe themalettertypen maken'),
      body: `<div class="fields-2"><label class="field"><span>${App.t('Lettertype voor kopteksten')}</span><select id="cf-major">${opts(m.theme.fonts.major)}</select></label><label class="field"><span>${App.t('Lettertype voor hoofdtekst')}</span><select id="cf-minor">${opts(m.theme.fonts.minor)}</select></label></div>
        <div class="cf-prev" id="cf-prev"></div><label class="field"><span>${App.t('Naam')}</span><input id="cf-name" value="${App.esc(App.t('Aangepast') + ' ' + (customFonts().length + 1))}"></label>`,
      onOpen: (d) => {
        const prev = () => { const a = d.$('#cf-major').value, b = d.$('#cf-minor').value; d.$('#cf-prev').innerHTML = `<div style="border:1px solid var(--line);padding:10px 14px"><div style="font:600 22px ${App.esc(App.cssFont(a))}">${App.t('Koptekst')}</div><div style="font:14px ${App.esc(App.cssFont(b))}">${App.t('Hoofdtekst van de presentatie: een paar regels als voorbeeld.')}</div></div>`; };
        prev(); d.el.addEventListener('change', prev);
      },
      buttons: [{ label: 'Annuleren' }, { label: 'Opslaan', primary: true, action: (d) => {
        const f = { name: d.$('#cf-name').value.trim().slice(0, 60) || App.t('Aangepast'), major: d.$('#cf-major').value, minor: d.$('#cf-minor').value };
        const list = customFonts().filter((x) => x.name !== f.name); list.unshift(f); App.store.set('lettersets', list.slice(0, 40));
        App.run(() => { m.theme.fonts = { major: f.major, minor: f.minor }; m.theme.fontSet = f.name; App.touchAll(); }, { all: true, masters: true });
        after(); App.fillFontBox && App.fillFontBox();
      } }],
    });
  });

  /* ---------- Varianten-menu: kleuren, lettertypen, achtergrondstijlen ---------- */
  App.menuBuilders['m-variants'] = () => `<button data-menu-sub="m-colorsets"><span class="i">palette</span> ${App.t('Kleuren')} <span class="i" style="margin-left:auto">chevron_right</span></button>
    <button data-menu-sub="m-fontsets"><span class="i">text_fields</span> ${App.t('Lettertypen')} <span class="i" style="margin-left:auto">chevron_right</span></button>
    <button data-menu-sub="m-bgstyles"><span class="i">format_color_fill</span> ${App.t('Achtergrondstijlen')} <span class="i" style="margin-left:auto">chevron_right</span></button>`;
  const BG_STYLES = [
    { type: 'solid', color: 'bg1' }, { type: 'solid', color: 'bg2' }, { type: 'solid', color: 'tx2' }, { type: 'solid', color: 'tx1' },
    { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: 'bg1' }, { p: 1, color: 'bg2' }] },
    { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: 'bg2' }, { p: 1, color: 'bg2/d10' }] },
    { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: 'tx2/l25' }, { p: 1, color: 'tx2' }] },
    { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: 'tx1/l25' }, { p: 1, color: 'tx1' }] },
    { type: 'grad', kind: 'radial', stops: [{ p: 0, color: 'bg1' }, { p: 1, color: 'bg2/d10' }] },
    { type: 'grad', kind: 'radial', stops: [{ p: 0, color: 'bg2' }, { p: 1, color: 'accent1/l60' }] },
    { type: 'grad', kind: 'radial', stops: [{ p: 0, color: 'tx2/l25' }, { p: 1, color: 'tx2/d25' }] },
    { type: 'grad', kind: 'radial', stops: [{ p: 0, color: 'tx1/l35' }, { p: 1, color: 'tx1' }] },
  ];
  App.menuBuilders['m-bgstyles'] = () => {
    const th = curMaster().theme;
    return `<div class="bgs-grid">${BG_STYLES.map((f, i) => `<button data-cmd="bgStyle" data-arg="${i}" title="${App.esc(App.t('Stijl') + ' ' + (i + 1))}" style="background:${App.fillCss(f, th)}"></button>`).join('')}</div><hr><button data-cmd="togglePane" data-arg="background"><span class="i">format_paint</span> ${App.t('Achtergrond opmaken…')}</button><button data-cmd="bgStyleReset"><span class="i">restart_alt</span> ${App.t('Achtergrond van dia opnieuw instellen')}</button>`;
  };
  App.def('bgStyle', (i) => {
    const f = BG_STYLES[+i]; if (!f) return;
    App.run(() => {
      if (shiftDown && st.view !== 'master') { App.selSlides().forEach((s) => { s.bg = App.clone(f); App.touch(s); }); return; }
      const m = curMaster(); m.bg = App.clone(f);
      App.pres.slides.forEach((s) => { if (App.masterOf(s) === m) delete s.bg; });
      m.layouts.forEach((l) => { delete l.bg; });
    }, { all: true, masters: true });
    after();
  });
  App.def('bgStyleReset', () => { App.run(() => App.selSlides().forEach((s) => { delete s.bg; App.touch(s); }), { all: true }); after(); });

  /* ---------- Diagrootte ---------- */
  App.menuBuilders['m-slidesize'] = () => {
    const P = App.pres; const r = P.size.w / P.size.h;
    return `<button data-cmd="slideSize" data-arg="4:3"><span class="i">${Math.abs(r - 4 / 3) < 0.01 ? 'check' : 'crop_7_5'}</span> ${App.t('Standaard (4:3)')}</button>
      <button data-cmd="slideSize" data-arg="16:9"><span class="i">${Math.abs(r - 16 / 9) < 0.01 ? 'check' : 'crop_16_9'}</span> ${App.t('Breedbeeld (16:9)')}</button><hr>
      <button data-cmd="slideSizeDialog"><span class="i">aspect_ratio</span> ${App.t('Aangepaste diagrootte…')}</button>`;
  };
  // alle sz-waarden in tekst (runs, stijlen, lijsten) met f vermenigvuldigen
  const scaleFonts = (x, f) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach((y) => scaleFonts(y, f)); return; }
    for (const k of Object.keys(x)) {
      if (k === 'sz' && typeof x[k] === 'number') x[k] = Math.max(1, Math.round(x[k] * f * 2) / 2);
      else if (typeof x[k] === 'object') scaleFonts(x[k], f);
    }
  };
  App.resizePres = (w, h, mode = 'fit', kind = 'custom') => {
    const P = App.pres;
    const sx = w / P.size.w, sy = h / P.size.h;
    if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return;
    // masters en indelingen rekken mee; inhoud van dia's schaalt gelijkmatig (passend of zo groot mogelijk) en wordt gecentreerd
    P.masters.forEach((m) => { App.scaleObjs(m.objs, sx, sy); m.layouts.forEach((l) => App.scaleObjs(l.objs, sx, sy)); });
    const u = mode === 'max' ? Math.max(sx, sy) : Math.min(sx, sy);
    const dx = (w - P.size.w * u) / 2, dy = (h - P.size.h * u) / 2;
    const fit = (o) => { if (o.x === undefined) return; o.x = o.x * u + dx; o.y = o.y * u + dy; o.w *= u; o.h *= u; if (o.pts) o.pts = o.pts.map(([x, y]) => [x * u + dx, y * u + dy]); };
    P.slides.forEach((s) => {
      s.objs.forEach((o) => {
        if (o.ph && o.x === undefined) return;   // erft van de indeling
        fit(o);
      });
      (s.comments || []).forEach((c) => { if (c.x !== undefined) { c.x = c.x * u + dx; c.y = c.y * u + dy; } });
      (s.anims || []).forEach((a) => { if (a.path && App.Anim && App.Anim.scalePath) a.path = App.Anim.scalePath(a.path, u, u); });
    });
    if (u < 0.98) { P.masters.forEach((m) => { scaleFonts(m.tx, u); scaleFonts(m.objs, u); m.layouts.forEach((l) => scaleFonts(l.objs, u)); }); P.slides.forEach((s) => scaleFonts(s.objs, u)); }
    P.guides.forEach((g) => { g.pos = g.dir === 'h' ? g.pos * sy : g.pos * sx; });
    P.size = { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100, kind };
    cache.clear();
  };
  const askMode = () => new Promise((res) => {
    App.dialog({
      title: App.t('Diagrootte wijzigen'),
      body: `<p style="margin:0 0 12px;line-height:1.5">${App.t('U schaalt naar een nieuwe diagrootte. Wilt u de grootte van uw inhoud maximaliseren of zorgen dat de inhoud op de nieuwe dia past?')}</p><div class="bs-cards" style="grid-template-columns:1fr 1fr"><button class="bs-card" data-m="max"><span class="i">open_in_full</span><div><b>${App.t('Maximaliseren')}</b><small>${App.t('Inhoud zo groot mogelijk; kan buiten de dia vallen.')}</small></div></button><button class="bs-card" data-m="fit"><span class="i">close_fullscreen</span><div><b>${App.t('Passend maken')}</b><small>${App.t('Alles blijft op de dia; inhoud wordt kleiner.')}</small></div></button></div>`,
      onOpen: (d) => d.body.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { d.close('x'); res(b.dataset.m); } }),
      onClose: (r) => { if (r !== 'x') res(null); },
      buttons: [{ label: 'Annuleren' }],
    });
  });
  const changeSize = async (w, h, kind) => {
    const P = App.pres;
    const sameRatio = Math.abs(w / h - P.size.w / P.size.h) < 0.005;
    const mode = sameRatio ? 'fit' : await askMode();
    if (!mode) return;
    if (st.edit) App.textEdit.stop();
    App.run(() => App.resizePres(w, h, mode, kind), { all: true, masters: true });
    App.zoomFit ? App.zoomFit() : App.exec('zoomFit');
    after();
  };
  App.def('slideSize', (kind) => {
    const P = App.pres; const sz = App.SIZES[kind]; if (!sz) return;
    if (Math.abs(sz.w / sz.h - P.size.w / P.size.h) < 0.005 && P.size.kind === kind) return;
    changeSize(sz.w, sz.h, kind);
  });
  App.def('slideSizeDialog', () => {
    const P = App.pres; const CM = App.CM || 37.795;
    const opts = Object.entries(App.SIZES).map(([k, s]) => `<option value="${k}" ${P.size.kind === k ? 'selected' : ''}>${App.esc(App.t(s.name))}</option>`).join('') + `<option value="custom" ${!App.SIZES[P.size.kind] ? 'selected' : ''}>${App.t('Aangepast')}</option>`;
    App.dialog({
      title: App.t('Diagrootte'),
      body: `<label class="field"><span>${App.t('Dia\'s met formaat')}</span><select id="sz-kind">${opts}</select></label>
        <div class="fields-2"><label class="field"><span>${App.t('Breedte (cm)')}</span><input id="sz-w" type="number" step="0.01" min="2.54" max="142.24" value="${App.round(P.size.w / CM, 2)}"></label><label class="field"><span>${App.t('Hoogte (cm)')}</span><input id="sz-h" type="number" step="0.01" min="2.54" max="142.24" value="${App.round(P.size.h / CM, 2)}"></label></div>
        <div class="radio-list" style="flex-direction:row;gap:16px"><label><input type="radio" name="sz-o" value="l" ${P.size.w >= P.size.h ? 'checked' : ''}> ${App.t('Liggend')}</label><label><input type="radio" name="sz-o" value="p" ${P.size.w < P.size.h ? 'checked' : ''}> ${App.t('Staand')}</label></div>`,
      onOpen: (d) => {
        const set = () => { const k = d.$('#sz-kind').value; const s = App.SIZES[k]; if (!s) return; let w = s.w, h = s.h; if (d.$('input[name="sz-o"]:checked').value === 'p' && w > h) [w, h] = [h, w]; d.$('#sz-w').value = App.round(w / CM, 2); d.$('#sz-h').value = App.round(h / CM, 2); };
        d.$('#sz-kind').onchange = set;
        d.$$('input[name="sz-o"]').forEach((r) => { r.onchange = () => { const w = d.$('#sz-w').value, h = d.$('#sz-h').value; const p = r.value === 'p'; if ((p && +w > +h) || (!p && +h > +w)) { d.$('#sz-w').value = h; d.$('#sz-h').value = w; } }; });
        d.$$('#sz-w, #sz-h').forEach((i) => { i.oninput = () => { d.$('#sz-kind').value = 'custom'; }; });
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const w = App.clamp(App.parseNum(d.$('#sz-w').value) || 0, 2.54, 142.24) * CM, h = App.clamp(App.parseNum(d.$('#sz-h').value) || 0, 2.54, 142.24) * CM;
        const k = d.$('#sz-kind').value;
        setTimeout(() => changeSize(w, h, App.SIZES[k] ? k : 'custom'), 0);
      } }],
    });
  });

  /* ---------- Opmaak van de galerijen ---------- */
  const css = document.createElement('style');
  css.id = 'pd-design-css';
  css.textContent = `.th-tile{padding:2px;border:1px solid var(--line);border-radius:3px;background:var(--panel);display:inline-flex;line-height:0}
.th-tile:hover{border-color:var(--brand)}.th-tile.on{outline:2px solid var(--brand);outline-offset:-1px}
.theme-chip .thumb-wrap,.var-chip .thumb-wrap,.th-tile .thumb-wrap{pointer-events:none}
.th-grid{display:grid;grid-template-columns:repeat(4,auto);gap:6px;padding:6px 8px;max-height:430px;overflow:auto}
.cs-list,.fs-list{max-height:430px;overflow:auto;min-width:300px}
.cs-row,.fs-row{display:flex;align-items:center;gap:10px;width:100%}
.cs-row.on,.fs-row.on{background:var(--hover)}
.cs-sw{display:inline-flex;gap:1px}.cs-sw i{width:14px;height:14px;display:inline-block;border:1px solid rgba(0,0,0,.08)}
.fs-aa{font-size:22px;width:40px;text-align:center}.fs-names{display:flex;flex-direction:column;line-height:1.25;text-align:left}.fs-names small{color:var(--muted)}
.bgs-grid{display:grid;grid-template-columns:repeat(4,64px);gap:6px;padding:8px}.bgs-grid button{height:38px;border:1px solid var(--line-strong);border-radius:2px;padding:0}
.bgs-grid button:hover{outline:2px solid var(--brand)}
.cc-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin-bottom:12px}.cc-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px}
.cc-row input{width:44px;height:26px;border:1px solid var(--line-strong);border-radius:3px;padding:0 2px;background:var(--panel)}
.cc-prev,.cf-prev{margin:4px 0 12px}`;
  document.head.appendChild(css);
})();
