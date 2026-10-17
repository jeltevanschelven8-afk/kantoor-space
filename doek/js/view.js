/* =========================================================
   Doek (gemaakt door JJ van Schelven) — Beeld: weergaven (normaal, diasorteerder,
   notitiepagina, leesweergave, diamodel), indelingen in het diamodel bewerken,
   zoeken en vervangen, lettertypen vervangen
   ========================================================= */
'use strict';

(() => {
  const st = App.state;

  /* ---------- Weergaven ---------- */
  const notesView = document.createElement('div');
  notesView.id = 'notes-view'; notesView.hidden = true;
  ($('#center') || document.body).appendChild(notesView);
  const notesEl = $('#notes'), notesHome = $('#notes-wrap');
  const VIEWS = ['normal', 'sorter', 'notes', 'reading', 'master'];
  App.setView = (v) => {
    const P = App.pres; if (!P || !VIEWS.includes(v)) return;
    if (v === 'reading') { App.startShow(st.slide, { noFullscreen: true, reading: true }); return; }
    if (st.edit) App.textEdit.stop();
    App.closeFind && st.view !== v && v !== 'normal' && App.closeFind();
    const prev = st.view;
    if (prev === v && v !== 'master') return;
    if (v === 'master' && prev !== 'master') {
      const s = App.cur(); const m = App.masterOf(s);
      st.master = { mi: Math.max(0, P.masters.indexOf(m)), li: m.layouts.indexOf(App.layoutOf(s)) };
    }
    if (prev === 'master' && v !== 'master') { App.touchAll(); App.invalidateThumbs && App.invalidateThumbs(); }
    st.view = v; st.sel = []; st.crop = null; st.points = null; st.groupEdit = null;
    document.body.classList.toggle('view-sorter', v === 'sorter');
    document.body.classList.toggle('view-notes', v === 'notes');
    document.body.classList.toggle('view-master', v === 'master');
    if (v === 'sorter') st.sorterSel = [App.cur().id];
    if (v === 'notes') buildNotesPage(); else leaveNotesPage();
    App.updateContext && App.updateContext();
    if (v === 'master') App.showTab && App.showTab('masterTab');
    else if (prev === 'master') App.showTab && App.showTab('home');
    App.layoutStage && App.layoutStage();
    App.renderAll(true);
    App.thumbs && App.thumbs.refresh(true);
    App.renderNotes && App.renderNotes();
    App.updateStatus && App.updateStatus();
    App.fillThemeGallery && App.fillThemeGallery();
    App.scheduleState();
    App.emit('view', v);
    if (v === 'sorter') setTimeout(() => { const so = $('#sorter'); if (so) so.focus(); }, 30);
  };
  App.def('view', (v) => App.setView(v || 'normal'));

  /* ---------- Notitiepagina ---------- */
  const buildNotesPage = () => {
    const P = App.pres, s = App.cur(); if (!s) return;
    notesView.hidden = false;
    const W = Math.max(320, Math.min((notesView.clientWidth || 800) - 48, 780));
    const page = document.createElement('div');
    page.className = 'notes-page';
    page.style.width = W + 'px'; page.style.minHeight = Math.round(W * 25.4 / 19.05) + 'px';
    const sw = W - 140;
    const slide = document.createElement('div');
    slide.className = 'np-slide'; slide.style.width = sw + 'px'; slide.style.height = Math.round(sw * P.size.h / P.size.w) + 'px';
    slide.appendChild(App.slideThumb(s, sw));
    slide.title = App.t('Dubbelklik om de dia te bewerken');
    slide.ondblclick = () => App.setView('normal');
    const txt = document.createElement('div');
    txt.className = 'np-text';
    txt.appendChild(notesEl);
    const foot = document.createElement('div');
    foot.className = 'np-num muted small';
    foot.textContent = App.t('Dia {0} van {1}').replace('{0}', st.slide + 1).replace('{1}', P.slides.length);
    page.append(slide, txt, foot);
    notesView.replaceChildren(page);
    App.renderNotes && App.renderNotes();
  };
  const leaveNotesPage = () => {
    if (notesEl.parentElement !== notesHome) notesHome.prepend(notesEl);
    notesView.hidden = true; notesView.replaceChildren();
  };
  // bladeren met het muiswiel voorbij het einde van de pagina
  notesView.addEventListener('wheel', (e) => {
    if (st.view !== 'notes' || e.ctrlKey) return;
    const atEnd = notesView.scrollTop + notesView.clientHeight >= notesView.scrollHeight - 2, atTop = notesView.scrollTop <= 0;
    if (e.deltaY > 0 && atEnd && st.slide < App.pres.slides.length - 1) { e.preventDefault(); App.gotoSlide(st.slide + 1); notesView.scrollTop = 0; }
    else if (e.deltaY < 0 && atTop && st.slide > 0) { e.preventDefault(); App.gotoSlide(st.slide - 1); }
  }, { passive: false });
  const origGoto = App.gotoSlide;
  App.gotoSlide = (...a) => { const r = origGoto(...a); if (st.view === 'notes') buildNotesPage(); return r; };
  App.on('load', () => { if (st.view !== 'notes') leaveNotesPage(); });
  window.addEventListener('resize', App.debounce(() => { if (st.view === 'notes') buildNotesPage(); }, 150));
  App.on('change', App.debounce(() => { if (st.view === 'notes' && document.activeElement !== notesEl) buildNotesPage(); }, 300));

  /* ---------- Diamodel: indelingen en tijdelijke aanduidingen ---------- */
  const MV = () => { const P = App.pres; const m = P.masters[App.clamp(st.master.mi, 0, P.masters.length - 1)]; return { P, m, l: st.master.li >= 0 ? m.layouts[st.master.li] : null }; };
  const needMaster = () => { if (st.view !== 'master') { App.toast(App.t('Open eerst het diamodel (Beeld › Diamodel).'), 'info'); return false; } return true; };
  const phCopy = (src, type, idx) => ({ id: App.uid('o'), type: 'shape', geom: 'rect', name: App.t(App.PH_NAMES[type] || 'Tijdelijke aanduiding'), ph: { type, idx }, x: src.x, y: src.y, w: src.w, h: src.h, text: { paras: [App.emptyPara()] } });
  const refreshMaster = () => { App.renderStage(true); App.thumbs.refresh(true); App.updateStatus(); syncMasterUi(); };
  App.def('masterInsertLayout', () => {
    if (!needMaster()) return;
    App.run(() => {
      const { m } = MV();
      const t = m.objs.find((o) => o.ph && o.ph.type === 'title');
      const l = { id: App.uid('l'), name: App.t('Aangepaste indeling'), type: 'cust', objs: t ? [phCopy(t, 'title', 0)] : [] };
      const at = st.master.li >= 0 ? st.master.li + 1 : m.layouts.length;
      m.layouts.splice(at, 0, l);
      st.master.li = at; st.sel = [];
    }, { masters: true, noTouch: true });
    refreshMaster();
  });
  App.def('masterDuplicateLayout', () => {
    if (!needMaster()) return;
    const { m, l } = MV();
    App.run(() => {
      if (!l) {   // het diamodel zelf dupliceren: een tweede master
        const c = App.clone(m); c.id = App.uid('m'); c.name = '1_' + m.name;
        c.objs.forEach((o) => { o.id = App.uid('o'); }); c.layouts.forEach((x) => { x.id = App.uid('l'); x.objs.forEach((o) => { o.id = App.uid('o'); }); });
        c.preserve = true;
        App.pres.masters.splice(st.master.mi + 1, 0, c); st.master = { mi: st.master.mi + 1, li: -1 };
        return;
      }
      const c = App.clone(l); c.id = App.uid('l'); c.name = '1_' + l.name; c.type = 'cust';
      App.walkObjs(c.objs, (o) => { o.id = App.uid('o'); });
      m.layouts.splice(st.master.li + 1, 0, c); st.master.li++;
    }, { masters: true, noTouch: true });
    refreshMaster();
  });
  App.def('masterDeleteLayout', async () => {
    if (!needMaster()) return;
    const { P, m, l } = MV();
    if (!l) {
      if (P.masters.length < 2) { App.toast(App.t('Een presentatie heeft altijd minstens één diamodel.'), 'info'); return; }
      const n = P.slides.filter((s) => App.masterOf(s) === m).length;
      if (n) { App.toast(App.t('Dit diamodel wordt gebruikt door {0} dia\'s en kan niet worden verwijderd.').replace('{0}', n), 'info'); return; }
      App.run(() => { P.masters.splice(st.master.mi, 1); st.master = { mi: Math.max(0, st.master.mi - 1), li: -1 }; }, { masters: true, noTouch: true });
      refreshMaster(); return;
    }
    const n = P.slides.filter((s) => s.layout === l.id).length;
    if (n) { App.toast(App.t('Deze indeling wordt gebruikt door {0} dia\'s en kan niet worden verwijderd.').replace('{0}', n), 'info'); return; }
    if (m.layouts.length < 2) return;
    App.run(() => { m.layouts.splice(st.master.li, 1); st.master.li = Math.min(st.master.li, m.layouts.length - 1); st.sel = []; }, { masters: true, noTouch: true });
    refreshMaster();
  });
  App.def('masterRenameLayout', async () => {
    if (!needMaster()) return;
    const { m, l } = MV(); const target = l || m;
    const name = await App.prompt(App.t(l ? 'Indeling een andere naam geven' : 'Diamodel een andere naam geven'), App.t('Naam van de indeling:'), App.t(target.name));
    if (name === null || !name.trim()) return;
    App.run(() => { target.name = name.trim().slice(0, 200); }, { masters: true, noTouch: true });
    refreshMaster();
  });
  App.def('masterAddPh', (type) => {
    if (!needMaster()) return;
    const { P, l } = MV();
    if (!l) { App.toast(App.t('Kies eerst een indeling; op het diamodel zelf kunnen geen tijdelijke aanduidingen worden ingevoegd.'), 'info'); return; }
    let o;
    App.run(() => {
      const idx = Math.max(12, ...l.objs.filter((x) => x.ph).map((x) => x.ph.idx || 0)) + 1;
      const w = P.size.w * 0.42, h = P.size.h * 0.42;
      o = phCopy({ x: (P.size.w - w) / 2, y: (P.size.h - h) / 2, w, h }, /^(obj|body|pic|chart|tbl|media)$/.test(type) ? type : 'obj', idx);
      l.objs.push(o);
      st.sel = [o.id];
    }, { masters: true, noTouch: true });
    refreshMaster();
    App.select && App.select([o.id]);
  });
  App.def('masterToggle', (arg) => {
    if (!needMaster()) return;
    const k = arg && typeof arg === 'object' ? arg.key : arg;
    const { m, l } = MV(); if (!l) { syncMasterUi(); return; }
    App.run(() => {
      if (k === 'title') {
        const i = l.objs.findIndex((o) => o.ph && /^(title|ctrTitle)$/.test(o.ph.type));
        if (i >= 0) l.objs.splice(i, 1);
        else { const t = m.objs.find((o) => o.ph && o.ph.type === 'title'); if (t) l.objs.unshift(phCopy(t, 'title', 0)); }
      } else if (k === 'footers') { if (l.noFtr) delete l.noFtr; else l.noFtr = true; }
    }, { masters: true, noTouch: true });
    refreshMaster();
  });
  const syncMasterUi = () => {
    if (st.view !== 'master' || !App.pres) return;
    const { l } = MV();
    const t = $('#ms-title'), f = $('#ms-footers');
    if (t) { t.disabled = !l; t.checked = !!(l && l.objs.some((o) => o.ph && /^(title|ctrTitle)$/.test(o.ph.type))); }
    if (f) { f.disabled = !l; f.checked = !!(l && !l.noFtr); }
  };
  App.on('state', syncMasterUi);
  App.on('view', syncMasterUi);

  /* ---------- Zoeken en vervangen ---------- */
  const panel = $('#find-panel'), input = $('#find-input'), rinput = $('#replace-input'), count = $('#find-count');
  const F = { list: [], idx: -1, stale: true };
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opts = () => ({ cs: !!($('#find-case') && $('#find-case').checked), whole: !!($('#find-whole') && $('#find-whole').checked) });
  const makeRe = (q, o) => new RegExp((o.whole ? '(?<![\\p{L}\\p{N}_])' : '') + escRe(q) + (o.whole ? '(?![\\p{L}\\p{N}_])' : ''), 'gu' + (o.cs ? '' : 'i'));
  // alle treffers in tekstvakken, tabellen en notities, in volgorde van de dia's
  const collect = (q) => {
    const out = []; if (!q) return out;
    const re = makeRe(q, opts());
    const scan = (p, loc) => { const t = p.runs.map((r) => r.t || '').join(''); re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (!m[0].length) { re.lastIndex++; continue; } out.push({ ...loc, o: m.index, len: m[0].length }); } };
    App.pres.slides.forEach((s, si) => {
      App.walkObjs(s.objs, (o) => {
        if (o.type === 'table') (o.rows || []).forEach((row, r) => row.cells.forEach((c, k) => { if (!c.merged && c.text) c.text.paras.forEach((p, pi) => scan(p, { si, id: o.id, r, c: k, p: pi })); }));
        else if (o.text && o.text.paras) o.text.paras.forEach((p, pi) => scan(p, { si, id: o.id, p: pi }));
      });
      if (s.notes && s.notes.paras) s.notes.paras.forEach((p, pi) => scan(p, { si, notes: true, p: pi }));
    });
    return out;
  };
  // keepPos: dezelfde plek in de lijst houden (na typen of vervangen), anders beginnen bij de huidige dia
  const refresh = (keepPos) => {
    F.list = collect(input.value); F.stale = false;
    if (!F.list.length) F.idx = -1;
    else if (keepPos && F.idx >= 0) F.idx = Math.min(F.idx, F.list.length - 1);
    else { const i = F.list.findIndex((m) => m.si >= st.slide); F.idx = i >= 0 ? i : 0; }
    showCount(); highlight();
  };
  const showCount = () => { count.textContent = !input.value ? '' : F.list.length ? App.t('{0} van {1}').replace('{0}', F.idx + 1).replace('{1}', F.list.length) : App.t('Geen resultaten'); };
  // plaats in de weergegeven tekst (run-spans, <br> telt als één teken)
  const paraEl = (m) => {
    if (m.notes) return notesEl.children[m.p] || null;
    const ob = document.querySelector(`#stage-slide .ob[data-id="${CSS.escape(m.id)}"]`) || document.querySelector(`#stage .ob[data-id="${CSS.escape(m.id)}"]`); if (!ob) return null;
    const host = m.r !== undefined ? ob.querySelector(`td[data-r="${m.r}"][data-c="${m.c}"]`) : ob;
    return host ? host.querySelector(`.pa[data-p="${m.p}"]`) : null;
  };
  const locate = (pEl, off, para) => {
    const runs = para ? para.runs : null;
    const units = [];
    if (runs && !pEl.closest('#notes')) {
      let pos = 0;
      runs.forEach((r, ri) => { const span = pEl.querySelector(`.r[data-r="${ri}"]`); if (span) units.push({ el: span, start: pos }); pos += (r.t || '').length; });
    } else units.push({ el: pEl, start: 0 });
    for (let u = units.length - 1; u >= 0; u--) {
      if (off < units[u].start && u > 0) continue;
      let rest = off - units[u].start;
      const w = document.createTreeWalker(units[u].el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n, last = null;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) { if (rest <= n.nodeValue.length) return { node: n, off: rest }; rest -= n.nodeValue.length; last = n; }
        else if (n.tagName === 'BR') rest -= 1;
      }
      if (last) return { node: last, off: last.nodeValue.length };
    }
    return null;
  };
  const paraModel = (m) => {
    const s = App.pres.slides[m.si]; if (!s) return null;
    if (m.notes) return s.notes && s.notes.paras[m.p];
    const f = App.findObj(m.id, s.objs); const o = f && f.obj; if (!o) return null;
    const body = m.r !== undefined ? o.rows[m.r] && o.rows[m.r].cells[m.c] && o.rows[m.r].cells[m.c].text : o.text;
    return body && body.paras[m.p];
  };
  const rangeOf = (m) => {
    const pEl = paraEl(m); if (!pEl) return null;
    const para = paraModel(m);
    const a = locate(pEl, m.o, para), b = locate(pEl, m.o + m.len, para);
    if (!a || !b) return null;
    const r = new Range();
    try { r.setStart(a.node, a.off); r.setEnd(b.node, b.off); } catch { return null; }
    return r;
  };
  const HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  const highlight = () => {
    if (!HL) return;
    CSS.highlights.delete('pd-find'); CSS.highlights.delete('pd-find-cur');
    if (panel.hidden || !F.list.length) return;
    const all = [], cur = F.list[F.idx];
    F.list.forEach((m) => { if (m.si !== st.slide) return; const r = rangeOf(m); if (r) all.push(r); });
    if (all.length) CSS.highlights.set('pd-find', new Highlight(...all));
    if (cur && cur.si === st.slide) { const r = rangeOf(cur); if (r) CSS.highlights.set('pd-find-cur', new Highlight(r)); }
  };
  const goto = () => {
    const m = F.list[F.idx]; if (!m) return;
    if (st.view !== 'normal' && st.view !== 'notes') App.setView('normal');
    if (st.edit) App.textEdit.stop();
    if (m.si !== st.slide) App.gotoSlide(m.si);
    if (!m.notes && App.cur().objs.some((o) => o.id === m.id)) App.select([m.id]);
    showCount();
    requestAnimationFrame(() => {
      highlight();
      const r = rangeOf(m);
      if (r) { const b = r.getBoundingClientRect(); const sc = m.notes ? notesEl : $('#stage'); const sb = sc.getBoundingClientRect(); if (b.top < sb.top || b.bottom > sb.bottom) r.startContainer.parentElement.scrollIntoView({ block: 'center' }); }
      if (!HL) {   // zonder markeringen: de tekst echt selecteren
        if (m.notes) return;
        const o = App.obj(m.id); if (!o) return;
        if (m.r !== undefined) App.textEdit.cellStart(o, m.r, m.c); else App.textEdit.start(m.id);
        App.textEdit.setSel({ p: m.p, o: m.o }, { p: m.p, o: m.o + m.len });
      }
    });
  };
  const step = (d) => {
    if (F.stale) refresh(true);
    if (!F.list.length) { showCount(); return; }
    F.idx = (F.idx + d + F.list.length) % F.list.length;
    goto();
  };
  App.openFind = (q, replace) => {
    if (st.view !== 'normal') App.setView('normal');
    let sel = '';
    if (st.edit && App.textEdit.selectedText) sel = App.textEdit.selectedText() || '';
    panel.hidden = false;
    $('#replace-row').hidden = !replace;
    if (typeof q === 'string' && q) input.value = q; else if (sel && !/\n/.test(sel) && sel.length < 200) input.value = sel;
    if (st.edit) App.textEdit.stop(true);
    input.focus(); input.select();
    refresh(false);
    if (F.list.length) goto();
  };
  App.def('find', (q) => App.openFind(q, false));
  App.def('replace', (q) => App.openFind(q, true));
  App.def('findNext', () => step(1));
  App.def('findPrev', () => step(-1));
  App.def('toggleReplaceRow', () => { const r = $('#replace-row'); r.hidden = !r.hidden; if (!r.hidden) rinput.focus(); });
  App.closeFind = () => { panel.hidden = true; if (HL) { CSS.highlights.delete('pd-find'); CSS.highlights.delete('pd-find-cur'); } };
  App.def('closeFind', () => { const m = F.list[F.idx]; App.closeFind(); App.focusStage && App.focusStage(); if (m && !m.notes && m.si === st.slide && HL) { const o = App.obj(m.id); if (o && !o.locked) { if (m.r !== undefined) App.textEdit.cellStart(o, m.r, m.c); else App.textEdit.start(m.id); App.textEdit.setSel({ p: m.p, o: m.o }, { p: m.p, o: m.o + m.len }); } } });
  input.addEventListener('input', () => refresh(false));
  ['find-case', 'find-whole'].forEach((id) => { const e = $('#' + id); if (e) e.addEventListener('change', () => refresh(false)); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); App.exec('closeFind'); }
  });
  rinput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); App.exec('replaceOne'); } else if (e.key === 'Escape') { e.preventDefault(); App.exec('closeFind'); } });
  panel.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });   // knoppen nemen de focus niet over
  App.on('change', () => { F.stale = true; if (!panel.hidden) requestAnimationFrame(() => { refresh(true); }); });
  App.on('render', () => { if (!panel.hidden) highlight(); });

  // tekst in een alinea vervangen (model); de nieuwe tekst krijgt de opmaak van het begin van de treffer
  const replaceIn = (para, o, len, text) => {
    const a = App.splitRunsAt(para, o);          // eerste run van de treffer
    const b = App.splitRunsAt(para, o + len);    // eerste run na de treffer
    const base = para.runs[a] || para.runs[Math.max(0, a - 1)] || {};
    const nr = { ...base, t: text }; delete nr.fld;
    para.runs.splice(a, Math.max(0, b - a), nr);
    para.runs = para.runs.filter((r) => r.t);
    if (!para.runs.length) para.runs = [{ ...base, t: '' }];
    if (App.normalizePara) Object.assign(para, App.normalizePara(para));
  };
  const touchSlide = (si) => { const s = App.pres.slides[si]; if (s) App.touch(s); };
  App.def('replaceOne', () => {
    if (F.stale) refresh(true);
    const m = F.list[F.idx]; if (!m) return;
    if (App.readOnly && App.readOnly()) { App.toast(App.t('Deze presentatie kan alleen worden bekeken.'), 'lock'); return; }
    const para = paraModel(m); if (!para) return;
    const rep = rinput.value;
    App.run(() => { replaceIn(para, m.o, m.len, rep); touchSlide(m.si); }, { noTouch: true });
    App.renderStage(true); App.renderNotes && App.renderNotes();
    refresh(true);
    // bevat de nieuwe tekst de zoekterm zelf, dan niet opnieuw dezelfde plek kiezen
    const n = F.list[F.idx];
    if (n && n.si === m.si && n.id === m.id && n.notes === m.notes && n.r === m.r && n.c === m.c && n.p === m.p && n.o >= m.o && n.o < m.o + rep.length) F.idx = (F.idx + 1) % F.list.length;
    if (F.list.length) goto(); else showCount();
  });
  App.def('replaceAll', () => {
    if (F.stale) refresh(true);
    if (!F.list.length) { App.toast(App.t('Er is niets gevonden.'), 'info'); return; }
    if (App.readOnly && App.readOnly()) { App.toast(App.t('Deze presentatie kan alleen worden bekeken.'), 'lock'); return; }
    const n = F.list.length;
    const slides = new Set();
    App.run(() => {
      // van achter naar voren, zodat de posities van eerdere treffers kloppen
      F.list.slice().reverse().forEach((m) => { const p = paraModel(m); if (p) { replaceIn(p, m.o, m.len, rinput.value); slides.add(m.si); } });
      slides.forEach(touchSlide);
    }, { noTouch: true });
    App.scheduleRender(true); App.renderNotes && App.renderNotes(); App.thumbs && App.thumbs.refresh(true);
    refresh(false);
    App.toast(App.t('{0} vervangingen uitgevoerd').replace('{0}', n), 'ok');
  });

  /* ---------- Lettertypen vervangen ---------- */
  App.usedFonts = () => {
    const P = App.pres, set = new Set();
    P.masters.forEach((m) => { set.add(m.theme.fonts.major); set.add(m.theme.fonts.minor); });
    const scan = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(scan); return; } if (typeof x.font === 'string' && x.font) set.add(App.fontName ? App.fontName(x.font, P.masters[0].theme) : x.font); for (const k of Object.keys(x)) if (typeof x[k] === 'object') scan(x[k]); };
    scan(P.masters); scan(P.slides);
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  };
  App.def('replaceFonts', (from) => {
    const used = App.usedFonts();
    const fonts = App.fontList ? App.fontList() : used;
    App.dialog({
      title: App.t('Lettertypen vervangen'),
      body: `<label class="field"><span>${App.t('Vervangen')}</span><select id="rf-from" class="notranslate">${used.map((f) => `<option ${f === from ? 'selected' : ''}>${App.esc(f)}</option>`).join('')}</select></label>
        <label class="field"><span>${App.t('Door')}</span><input id="rf-to" list="rf-list" class="notranslate" value="${App.esc(fonts.includes('Inter') ? 'Inter' : fonts[0] || '')}"><datalist id="rf-list">${fonts.map((f) => `<option value="${App.esc(f)}">`).join('')}</datalist></label>
        <p class="muted small" style="margin:0;line-height:1.5">${App.t('Het lettertype wordt overal vervangen: in de tekst, in tabellen en in de themalettertypen.')}</p>`,
      buttons: [{ label: 'Sluiten' }, { label: 'Vervangen', primary: true, action: (d) => {
        const a = d.$('#rf-from').value, b = d.$('#rf-to').value.trim().replace(/["\\;{}<>]/g, '').slice(0, 99);
        if (!a || !b || a === b) return false;
        let n = 0;
        App.run(() => {
          const P = App.pres;
          P.masters.forEach((m) => { if (m.theme.fonts.major === a) { m.theme.fonts.major = b; n++; } if (m.theme.fonts.minor === a) { m.theme.fonts.minor = b; n++; } });
          const scan = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(scan); return; } if (x.font === a) { x.font = b; n++; } for (const k of Object.keys(x)) if (typeof x[k] === 'object') scan(x[k]); };
          scan(P.masters); scan(P.slides);
        }, { all: true, masters: true });
        App.scheduleRender(true); App.thumbs && App.thumbs.refresh(true); App.fillFontBox && App.fillFontBox();
        App.toast(App.t('{0} vervangen door {1}').replace('{0}', a).replace('{1}', b), 'ok');
      } }],
    });
  });

  /* ---------- Opmaak ---------- */
  const css = document.createElement('style');
  css.id = 'pd-view-css';
  css.textContent = `#notes-view{position:absolute;inset:0;overflow:auto;background:var(--canvas,#e9e9e9);z-index:2}
body.view-notes #stage-wrap,body.view-notes #find-panel{display:none!important}
.notes-page #notes{min-height:280px;outline:none;font-size:15px;line-height:1.55;padding:6px 8px;border:1px dashed transparent;color:#111;background:transparent}
.notes-page #notes:focus{border-color:#bbb}.notes-page #notes:empty::before{content:attr(data-ph);color:#888}
.notes-page .np-num{position:absolute;right:24px;bottom:14px}
.np-slide{cursor:pointer}
::highlight(pd-find){background-color:rgba(255,213,0,.5);color:inherit}
::highlight(pd-find-cur){background-color:#ff9632;color:#000}`;
  document.head.appendChild(css);
})();
