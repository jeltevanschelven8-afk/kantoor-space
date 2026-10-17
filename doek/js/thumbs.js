/* =========================================================
   Doek (gemaakt door JJ van Schelven) — miniaturen en diasorteerder:
   luie weergave (alleen wat in beeld is wordt getekend), slepen om te ordenen,
   secties, rechtsklikmenu, en de commando's voor dia's
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const list = $('#thumb-list'), sorter = $('#sorter');
  const cache = new Map();          // slide-id → { stamp, el }
  let collapsed = new Set();        // ingeklapte secties

  const stampOf = (s) => (s._json && !s._dirty ? s._json.length + ':' + App.hash(s._json) : 'v' + Math.random()) + '|' + (App.pres._mjson ? App.pres._mjson.length : 0) + '|' + App.slideIndex(s.id) + '|' + JSON.stringify(App.pres.hf || {}) + '|' + (App.settings.gray || '');
  const thumbFor = (s, w) => {
    const c = cache.get(s.id);
    const stamp = stampOf(s) + '|' + w;
    if (c && c.stamp === stamp) return c.el;
    const el = App.slideThumb(s, w);
    cache.set(s.id, { stamp, el });
    return el;
  };
  App.invalidateThumbs = (id) => { if (id) cache.delete(id); else cache.clear(); };

  /* ---------- Lijst opbouwen ---------- */
  const sectionOf = (s) => (s.sec && App.pres.sections.some((x) => x.id === s.sec) ? s.sec : null);
  const groups = () => {
    const P = App.pres, out = [];
    let cur = null;
    P.slides.forEach((s, i) => {
      const sec = P.sections.length ? (sectionOf(s) || P.sections[0].id) : null;
      if (!cur || cur.sec !== sec) { cur = { sec, slides: [] }; out.push(cur); }
      cur.slides.push({ s, i });
    });
    return out;
  };
  let io = null;
  const observe = (el) => {
    if (!io) io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) paint(en.target); }), { root: null, rootMargin: '300px 0px' });
    io.observe(el);
  };
  const paint = (box) => {
    const id = box.dataset.slide; const s = App.slideById(id); if (!s) return;
    const w = box.clientWidth || box.parentElement.clientWidth;
    if (!w) return;
    const el = thumbFor(s, w);
    if (box.firstChild !== el) box.replaceChildren(el);
    box.dataset.painted = '1';
  };
  const badges = (s) => {
    const anims = (s.anims || []).length, trans = s.trans && s.trans.type && s.trans.type !== 'none';
    return (anims || trans ? `<span class="i" title="${App.esc(App.t('Deze dia heeft animaties of een overgang (klik voor een voorbeeld)'))}" data-preview="${s.id}">auto_awesome</span>` : '') + ((s.comments || []).length ? `<span class="i" title="${App.esc(App.t('Opmerkingen'))}">comment</span>` : '');
  };
  App.thumbs = {
    refresh(full) {
      if (!App.pres) return;
      if (st.view === 'sorter') { buildSorter(full); return; }
      if (st.view === 'master') { buildMasterList(full); return; }
      build(full);
    },
    refreshSoon: App.debounce(() => { const s = App.cur(); if (s) { cache.delete(s.id); const box = list.querySelector(`.box[data-slide="${CSS.escape(s.id)}"]`); if (box) paint(box); } }, 350),
  };
  const build = (full) => {
    const P = App.pres;
    const w = Math.max(60, (App.settings.thumbW || 200) - 40);
    const h = Math.round(w * P.size.h / P.size.w);
    const key = P.slides.map((s) => s.id + (s.hidden ? 'h' : '') + (s.sec || '')).join(',') + '|' + P.sections.map((x) => x.id + x.name).join(',') + '|' + [...collapsed].join(',') + '|' + w + '|' + st.view;
    if (full || list.dataset.key !== key) {
      list.dataset.key = key;
      const parts = [];
      groups().forEach((g) => {
        if (g.sec) {
          const sec = P.sections.find((x) => x.id === g.sec);
          const col = collapsed.has(g.sec);
          parts.push(`<div class="sec-head" data-sec="${g.sec}" tabindex="-1"><span class="i">${col ? 'chevron_right' : 'expand_more'}</span><span class="sn">${App.esc(sec ? sec.name : '')}</span><span class="cnt">(${g.slides.length})</span></div>`);
          if (col) return;
        }
        g.slides.forEach(({ s, i }) => {
          parts.push(`<div class="th${s.hidden ? ' hidden' : ''}" data-i="${i}" data-id="${s.id}" draggable="true"><div class="no">${i + 1}${badges(s)}</div><div class="box" data-slide="${s.id}" style="height:${h + 2}px" role="button" aria-label="${App.esc(App.t('Dia {0}').replace('{0}', i + 1))}"></div></div>`);
        });
      });
      list.innerHTML = parts.join('');
      list.querySelectorAll('.box').forEach(observe);
    }
    // selectie markeren en zichtbare miniaturen bijwerken
    const sel = new Set(st.sorterSel && st.sorterSel.length ? st.sorterSel : [App.cur() && App.cur().id]);
    list.querySelectorAll('.th').forEach((t) => { t.classList.toggle('cur', +t.dataset.i === st.slide); t.classList.toggle('sel', sel.has(t.dataset.id)); });
    const lr = list.getBoundingClientRect();
    list.querySelectorAll('.box').forEach((b) => { const r = b.getBoundingClientRect(); if (r.bottom > lr.top - 300 && r.top < lr.bottom + 300) paint(b); });
    const cur = list.querySelector('.th.cur');
    if (cur && App._scrollThumb !== st.slide) { App._scrollThumb = st.slide; const r = cur.getBoundingClientRect(); if (r.top < lr.top || r.bottom > lr.bottom) cur.scrollIntoView({ block: 'nearest' }); }
  };
  App.on('slide', () => { App._scrollThumb = -1; });

  /* ---------- Diamodel: master en indelingen in het linkervenster ---------- */
  const buildMasterList = () => {
    const P = App.pres;
    const w = Math.max(60, (App.settings.thumbW || 200) - 40);
    const parts = [];
    P.masters.forEach((m, mi) => {
      parts.push(`<div class="th${st.master.mi === mi && st.master.li < 0 ? ' cur' : ''}" data-mi="${mi}" data-li="-1"><div class="no">${mi + 1}</div><div class="box" data-master="${mi}" title="${App.esc(App.t('Diamodel') + ': ' + m.name)}"></div></div>`);
      m.layouts.forEach((l, li) => parts.push(`<div class="th${st.master.mi === mi && st.master.li === li ? ' cur' : ''}" data-mi="${mi}" data-li="${li}" style="padding-left:18px"><div class="no"></div><div class="box" data-master="${mi}" data-layout="${li}" title="${App.esc(App.t(l.name))}"></div></div>`));
    });
    list.innerHTML = parts.join('');
    list.dataset.key = '';
    list.querySelectorAll('.box').forEach((b) => {
      const m = P.masters[+b.dataset.master];
      const owner = b.dataset.layout !== undefined ? m.layouts[+b.dataset.layout] : m;
      const bw = b.dataset.layout !== undefined ? w - 18 : w;
      b.style.height = Math.round(bw * P.size.h / P.size.w) + 2 + 'px';
      b.appendChild(App.slideThumb(owner, bw));
    });
  };

  /* ---------- Diasorteerder ---------- */
  const buildSorter = () => {
    const P = App.pres;
    const w = App.settings.sorterW || 220;
    const h = Math.round(w * P.size.h / P.size.w);
    const sel = new Set(st.sorterSel && st.sorterSel.length ? st.sorterSel : [App.cur().id]);
    const parts = ['<div class="so-grid">'];
    groups().forEach((g) => {
      if (g.sec) { const sec = P.sections.find((x) => x.id === g.sec); parts.push(`<div class="so-sec sec-head" data-sec="${g.sec}"><span class="i">${collapsed.has(g.sec) ? 'chevron_right' : 'expand_more'}</span>${App.esc(sec ? sec.name : '')} <span class="cnt">(${g.slides.length})</span></div>`); if (collapsed.has(g.sec)) return; }
      g.slides.forEach(({ s, i }) => {
        const dur = s.trans && s.trans.after ? App.fmtNum(s.trans.after, 2).replace(/,?0+$/, '') + ' s' : '';
        parts.push(`<div class="so th${s.hidden ? ' hidden' : ''}${i === st.slide ? ' cur' : ''}${sel.has(s.id) ? ' sel' : ''}" data-i="${i}" data-id="${s.id}" draggable="true" style="--so-w:${w}px"><div class="box" data-slide="${s.id}" style="height:${h}px"></div><div class="meta"><span>${badges(s)} ${dur}</span><span>${s.hidden ? '<span class="i" style="font-size:14px">visibility_off</span> ' : ''}${i + 1}</span></div></div>`);
      });
    });
    parts.push('</div>');
    sorter.innerHTML = parts.join('');
    sorter.querySelectorAll('.box').forEach(observe);
  };
  sorter.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); App.settings.sorterW = App.clamp((App.settings.sorterW || 220) * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 100, 640); App.saveSettings(); buildSorter(); }, { passive: false });

  /* ---------- Klikken, slepen, toetsen ---------- */
  let anchor = null;
  const onClick = (e) => {
    const prev = e.target.closest('[data-preview]');
    if (prev) { e.stopPropagation(); const i = App.slideIndex(prev.dataset.preview); App.gotoSlide(i); App.exec('previewAnims', 'all'); return; }
    const sh = e.target.closest('.sec-head');
    if (sh) { const id = sh.dataset.sec; if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); App.thumbs.refresh(true); return; }
    const t = e.target.closest('.th'); if (!t) return;
    if (st.view === 'master') { st.master = { mi: +t.dataset.mi, li: +t.dataset.li }; st.sel = []; App.renderStage(true); App.drawSelection(); App.thumbs.refresh(); App.updateStatus(); App.updateContext(); App.panes && App.panes.refresh(); return; }
    const i = +t.dataset.i, id = t.dataset.id;
    if (e.shiftKey && anchor !== null) {
      const a = Math.min(anchor, i), b = Math.max(anchor, i);
      st.sorterSel = App.pres.slides.slice(a, b + 1).map((s) => s.id);
      App.gotoSlide(i, { keepSorterSel: true });
    } else if (e.ctrlKey || e.metaKey) {
      const set = new Set(st.sorterSel && st.sorterSel.length ? st.sorterSel : [App.cur().id]);
      if (set.has(id) && set.size > 1) set.delete(id); else set.add(id);
      st.sorterSel = App.pres.slides.filter((s) => set.has(s.id)).map((s) => s.id);
      App.gotoSlide(i, { keepSorterSel: true });
    } else { anchor = i; App.gotoSlide(i); }
    if (st.view === 'sorter') buildSorter();
  };
  list.addEventListener('click', onClick);
  sorter.addEventListener('click', onClick);
  sorter.addEventListener('dblclick', (e) => { const t = e.target.closest('.th'); if (t) { App.gotoSlide(+t.dataset.i); App.exec('view', 'normal'); } });
  // slepen om te ordenen (ook meerdere dia's en naar een andere sectie)
  let dragIds = null;
  const onDragStart = (e) => {
    const t = e.target.closest('.th'); if (!t || st.view === 'master') return;
    const sel = st.sorterSel && st.sorterSel.includes(t.dataset.id) ? st.sorterSel.slice() : [t.dataset.id];
    dragIds = sel;
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', 'doek-slides');
  };
  const clearDrop = (root) => root.querySelectorAll('.drop-before, .drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
  const onDragOver = (root, horiz) => (e) => {
    if (!dragIds) return;
    e.preventDefault();
    clearDrop(root);
    const t = e.target.closest('.th, .sec-head'); if (!t) return;
    const r = t.getBoundingClientRect();
    const after = t.classList.contains('sec-head') ? false : horiz ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    t.classList.add(after ? 'drop-after' : 'drop-before');
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
  };
  const onDrop = (root) => (e) => {
    if (!dragIds) return;
    e.preventDefault();
    const t = root.querySelector('.drop-before, .drop-after');
    clearDrop(root);
    const ids = dragIds; dragIds = null;
    if (!t) return;
    const P = App.pres;
    let idx, sec;
    if (t.classList.contains('sec-head')) { sec = t.dataset.sec; const first = P.slides.find((s) => (sectionOf(s) || (P.sections[0] && P.sections[0].id)) === sec); idx = first ? P.slides.indexOf(first) : P.slides.length; }
    else { const i = +t.dataset.i; idx = t.classList.contains('drop-after') ? i + 1 : i; const ref = P.slides[t.classList.contains('drop-after') ? i : i]; sec = ref ? sectionOf(ref) : null; }
    App.run(() => App.moveSlides(ids, idx, sec, e.ctrlKey), { all: true });
    App.thumbs.refresh(true);
  };
  [[list, false], [sorter, true]].forEach(([root, horiz]) => {
    root.addEventListener('dragstart', onDragStart);
    root.addEventListener('dragover', onDragOver(root, horiz));
    root.addEventListener('dragleave', (e) => { if (!root.contains(e.relatedTarget)) clearDrop(root); });
    root.addEventListener('drop', onDrop(root));
    root.addEventListener('dragend', () => { dragIds = null; clearDrop(root); });
  });
  App.moveSlides = (ids, idx, sec, copy) => {
    const P = App.pres;
    const moving = P.slides.filter((s) => ids.includes(s.id));
    let items = moving;
    if (copy) items = moving.map((s) => App.cloneSlide(s));
    else { const before = P.slides.slice(0, idx).filter((s) => ids.includes(s.id)).length; P.slides = P.slides.filter((s) => !ids.includes(s.id)); idx -= before; }
    if (P.sections.length) items.forEach((s) => { if (sec !== undefined) s.sec = sec || P.sections[0].id; });
    P.slides.splice(App.clamp(idx, 0, P.slides.length), 0, ...items);
    normalizeSections();
    st.slide = P.slides.indexOf(items[0]);
    st.sorterSel = items.map((s) => s.id);
  };
  // dia's binnen een sectie houden het sectielabel; volgorde van secties volgt de eerste dia
  const normalizeSections = () => {
    const P = App.pres;
    if (!P.sections.length) { P.slides.forEach((s) => delete s.sec); return; }
    // dia zonder (geldige) sectie: sectie van de dia ervoor
    let last = P.sections[0].id;
    P.slides.forEach((s) => { if (!sectionOf(s)) s.sec = last; last = s.sec; });
    // secties aaneengesloten maken (stabiel sorteren op volgorde van eerste voorkomen)
    const order = [];
    P.slides.forEach((s) => { if (!order.includes(s.sec)) order.push(s.sec); });
    P.sections.forEach((x) => { if (!order.includes(x.id)) order.push(x.id); });
    P.sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const rank = new Map(P.sections.map((x, i) => [x.id, i]));
    P.slides = P.slides.map((s, i) => ({ s, i })).sort((a, b) => rank.get(a.s.sec) - rank.get(b.s.sec) || a.i - b.i).map((x) => x.s);
  };
  App.normalizeSections = normalizeSections;
  const listKeys = (e) => {
    if (!App.pres || st.edit) return;
    const P = App.pres, k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (App.globalKeys(e)) return;
    if (k === 'ArrowDown' || k === 'ArrowRight' && st.view === 'sorter' || k === 'PageDown') { e.preventDefault(); App.gotoSlide(st.slide + 1); return; }
    if (k === 'ArrowUp' || k === 'ArrowLeft' && st.view === 'sorter' || k === 'PageUp') { e.preventDefault(); App.gotoSlide(st.slide - 1); return; }
    if (k === 'Home') { e.preventDefault(); App.gotoSlide(0); return; }
    if (k === 'End') { e.preventDefault(); App.gotoSlide(P.slides.length - 1); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); App.exec('deleteSlides'); return; }
    if (k === 'Enter' && st.view !== 'sorter') { e.preventDefault(); App.exec('newSlide'); return; }
    if (k === 'Enter' && st.view === 'sorter') { e.preventDefault(); App.exec('view', 'normal'); return; }
    if (ctrl && k.toLowerCase() === 'c') { e.preventDefault(); App.exec('copySlides'); return; }
    if (ctrl && k.toLowerCase() === 'x') { e.preventDefault(); App.exec('cutSlides'); return; }
    if (ctrl && k.toLowerCase() === 'v') { /* via het paste-event */ }
  };
  list.addEventListener('keydown', listKeys);
  sorter.addEventListener('keydown', listKeys);
  list.addEventListener('mousedown', () => setTimeout(() => list.focus({ preventScroll: true }), 0));
  sorter.addEventListener('mousedown', () => setTimeout(() => sorter.focus({ preventScroll: true }), 0));
  list.addEventListener('scroll', App.debounce(() => App.thumbs.refresh(), 60), { passive: true });

  /* ---------- Rechtsklikmenu ---------- */
  const ctxMenu = (e) => {
    e.preventDefault();
    const it = (cmd, icon, label, arg, kbd) => `<button data-cmd="${cmd}"${arg !== undefined ? ` data-arg="${App.esc(arg)}"` : ''}><span class="i">${icon}</span> ${App.esc(App.t(label))}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;
    const sh = e.target.closest('.sec-head');
    if (sh) {
      App.state.ctxSection = sh.dataset.sec;
      App.openPopup({ x: e.clientX, y: e.clientY }, [it('sectionRename', 'edit', 'Naam van sectie wijzigen'), it('sectionRemove', 'remove', 'Sectie verwijderen'), it('sectionRemoveSlides', 'delete', 'Sectie en dia\'s verwijderen'), it('sectionRemoveAll', 'delete_sweep', 'Alle secties verwijderen'), '<hr>', it('sectionMove', 'arrow_upward', 'Sectie omhoog verplaatsen', '-1'), it('sectionMove', 'arrow_downward', 'Sectie omlaag verplaatsen', '1'), '<hr>', it('sectionCollapse', 'unfold_less', 'Alles samenvouwen', 'all'), it('sectionCollapse', 'unfold_more', 'Alles uitvouwen', 'none')].join(''), 'ctx-menu');
      return;
    }
    if (st.view === 'master') {
      App.openPopup({ x: e.clientX, y: e.clientY }, [it('masterInsertLayout', 'add_box', 'Indeling invoegen'), it('masterDuplicateLayout', 'content_copy', 'Indeling dupliceren'), it('masterRenameLayout', 'edit', 'Naam van indeling wijzigen'), it('masterDeleteLayout', 'delete', 'Indeling verwijderen'), '<hr>', it('togglePane', 'wallpaper', 'Achtergrond opmaken…', 'background')].join(''), 'ctx-menu');
      return;
    }
    const t = e.target.closest('.th');
    if (t && !(st.sorterSel || []).includes(t.dataset.id)) { App.gotoSlide(+t.dataset.i); }
    const cur = App.cur();
    App.openPopup({ x: e.clientX, y: e.clientY }, [
      it('cutSlides', 'content_cut', 'Knippen', undefined, 'Ctrl+X'), it('copySlides', 'content_copy', 'Kopiëren', undefined, 'Ctrl+C'), it('pasteSlides', 'content_paste', 'Plakken', undefined, 'Ctrl+V'), '<hr>',
      it('newSlide', 'add_box', 'Nieuwe dia', undefined, 'Ctrl+M'), it('duplicateSlide', 'library_add', 'Dia dupliceren', undefined, 'Ctrl+D'), it('deleteSlides', 'delete', 'Dia verwijderen', undefined, 'Delete'), it('sectionAdd', 'view_agenda', 'Sectie toevoegen'), '<hr>',
      `<button data-menu-sub="m-layout" data-cmd="noop"><span class="i">dashboard</span> ${App.t('Indeling')} ›</button>`, it('resetSlide', 'restart_alt', 'Dia opnieuw instellen'), it('togglePane', 'wallpaper', 'Achtergrond opmaken…', 'background'), '<hr>',
      it('hideSlide', cur && cur.hidden ? 'visibility' : 'visibility_off', cur && cur.hidden ? 'Dia zichtbaar maken' : 'Dia verbergen'), it('newComment', 'add_comment', 'Nieuwe opmerking'),
    ].join(''), 'ctx-menu');
  };
  list.addEventListener('contextmenu', ctxMenu);
  sorter.addEventListener('contextmenu', ctxMenu);

  /* ---------- Dia-commando's ---------- */
  const selSlides = () => { const ids = st.sorterSel && st.sorterSel.length ? st.sorterSel : [App.cur().id]; return App.pres.slides.filter((s) => ids.includes(s.id)); };
  App.selSlides = selSlides;
  App.cloneSlide = (s, P = App.pres) => {
    const c = App.clone(App.cleanForSave(s));
    c.id = App.uid('s');
    const map = {};
    const fresh = (o) => { const n = App.uid('o'); map[o.id] = n; o.id = n; if (o.objs) o.objs.forEach(fresh); };
    c.objs.forEach(fresh);
    c.anims = (c.anims || []).map((a) => ({ ...a, id: App.uid('a'), obj: map[a.obj] || a.obj, trig: a.trig && a.trig.obj ? { ...a.trig, obj: map[a.trig.obj] || a.trig.obj } : a.trig }));
    App.walkObjs(c.objs, (o) => { if (o.conn) { if (o.conn.st) o.conn.st.obj = map[o.conn.st.obj] || o.conn.st.obj; if (o.conn.end) o.conn.end.obj = map[o.conn.end.obj] || o.conn.end.obj; } });
    (c.comments || []).forEach((x) => { x.id = App.uid('c'); });
    void P;
    return c;
  };
  const insertAfterCurrent = (slides) => {
    const P = App.pres;
    const cur = App.cur();
    const at = st.view === 'master' ? P.slides.length : (P.slides.indexOf(selSlides().slice(-1)[0] || cur) + 1);
    if (cur && P.sections.length) slides.forEach((s) => { s.sec = s.sec && P.sections.some((x) => x.id === s.sec) ? s.sec : cur.sec; });
    P.slides.splice(at, 0, ...slides);
    normalizeSections();
    st.slide = P.slides.indexOf(slides[0]);
    st.sorterSel = slides.map((s) => s.id);
    st.sel = [];
  };
  App.layoutForNew = () => {
    const cur = App.cur(); const m = App.masterOf(cur);
    const l = cur ? App.layoutOf(cur) : null;
    if (!l || l.type === 'title') return m.layouts.find((x) => x.type === 'obj') || m.layouts[0];
    return l;
  };
  App.defEdit('newSlide', (layoutId) => {
    if (st.view === 'master') { App.exec('masterInsertLayout'); return false; }
    if (st.edit) App.textEdit.stop();
    const P = App.pres;
    let layout = null;
    if (layoutId) P.masters.forEach((m) => { const l = m.layouts.find((x) => x.id === layoutId); if (l) layout = l; });
    const s = App.newSlide(layout || App.layoutForNew());
    insertAfterCurrent([s]);
    setTimeout(() => { App.gotoSlide(st.slide); App.thumbs.refresh(true); }, 0);
  }, { all: true });
  App.defEdit('duplicateSlide', () => {
    const copies = selSlides().map((s) => App.cloneSlide(s));
    insertAfterCurrent(copies);
    setTimeout(() => { App.gotoSlide(st.slide, { keepSorterSel: true }); App.thumbs.refresh(true); }, 0);
  }, { all: true });
  App.defEdit('deleteSlides', () => {
    const P = App.pres;
    const del = new Set(selSlides().map((s) => s.id));
    if (del.size >= P.slides.length) { App.toast(App.t('Een presentatie heeft minstens één dia.'), 'info'); return false; }
    const first = P.slides.findIndex((s) => del.has(s.id));
    P.slides = P.slides.filter((s) => !del.has(s.id));
    // koppelingen naar verwijderde dia's weghalen
    App.pres.slides.forEach((s) => App.walkObjs(s.objs, (o) => { if (o.link && o.link.kind === 'slide' && del.has(o.link.slide)) delete o.link; }));
    P.shows.forEach((x) => { x.slides = x.slides.filter((id) => !del.has(id)); });
    st.slide = App.clamp(first, 0, P.slides.length - 1);
    st.sorterSel = [P.slides[st.slide].id]; st.sel = [];
    del.forEach((id) => cache.delete(id));
    setTimeout(() => { App.gotoSlide(st.slide); App.thumbs.refresh(true); }, 0);
  }, { all: true });
  App.defEdit('hideSlide', () => {
    const sl = selSlides();
    const hide = !sl.every((s) => s.hidden);
    sl.forEach((s) => { if (hide) s.hidden = true; else delete s.hidden; App.touch(s); });
    App.thumbs.refresh(true);
  }, { noTouch: true });
  App.stateFns.slideHidden = () => !!(App.cur() && App.cur().hidden);
  App.defEdit('layoutSlide', (layoutId) => {
    const P = App.pres;
    let layout = null;
    P.masters.forEach((m) => { const l = m.layouts.find((x) => x.id === layoutId); if (l) layout = l; });
    if (!layout) return false;
    selSlides().forEach((s) => { App.applyLayout(s, layout); App.touch(s); });
    st.sel = [];
  }, { noTouch: true });
  App.defEdit('resetSlide', () => {
    selSlides().forEach((s) => {
      const layout = App.layoutOf(s);
      s.objs.forEach((o) => {
        if (!o.ph) return;
        ['x', 'y', 'w', 'h', 'rot', 'flipH', 'flipV', 'fill', 'line', 'fx'].forEach((k) => delete o[k]);
        if (o.text) {
          ['vAlign', 'ins', 'fit', 'scale', 'cols', 'vert', 'lst'].forEach((k) => delete o.text[k]);
          o.text.paras.forEach((p) => { ['align', 'marL', 'indent', 'lnSpc', 'spcBef', 'spcAft', 'bullet'].forEach((k) => delete p[k]); p.runs.forEach((r) => ['sz', 'font', 'color', 'b', 'i', 'u', 's', 'spc', 'caps', 'hl', 'fill', 'ln', 'fx'].forEach((k) => delete r[k])); });
        }
      });
      // ontbrekende placeholders van de indeling weer toevoegen
      App.newSlide(layout).objs.forEach((n) => { if (!s.objs.some((o) => o.ph && o.ph.type === n.ph.type && o.ph.idx === n.ph.idx)) s.objs.unshift(n); });
      App.touch(s);
    });
  }, { noTouch: true });
  App.def('gotoDialog', async () => {
    const v = await App.prompt(App.t('Ga naar dia'), App.t('Dianummer (1 tot {0})').replace('{0}', App.pres.slides.length), String(st.slide + 1));
    if (v === null) return;
    const n = parseInt(v, 10);
    if (n >= 1 && n <= App.pres.slides.length) App.gotoSlide(n - 1);
  });

  /* ---------- Dia's kopiëren en plakken ---------- */
  const packSlides = (slides) => {
    const media = {};
    const scan = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(scan); Object.keys(x).forEach((k) => { if ((k === 'media' || k === 'poster' || k === 'sound') && App.media[x[k]]) media[x[k]] = App.media[x[k]]; else if (typeof x[k] === 'object') scan(x[k]); }); };
    const data = slides.map((s) => App.clone(App.cleanForSave(s)));
    scan(data);
    // indelingen meegeven (op type), voor plakken in een andere presentatie
    const layouts = {};
    slides.forEach((s) => { const l = App.layoutOf(s); layouts[s.layout] = { type: l.type, name: l.name }; });
    return { kind: 'slides', slides: data, media, layouts, pres: App.pres.id, master: App.clone(App.cleanForSave(App.masterOf(slides[0]))) };
  };
  App.def('copySlides', async (cut) => {
    const slides = selSlides();
    const clip = packSlides(slides);
    st.clip = clip;
    try {
      const json = JSON.stringify(clip);
      const html = `<meta charset="utf-8"><div data-doek-clip="${btoa(unescape(encodeURIComponent(json)))}">${App.esc(slides.map((s) => App.slideTitle(s)).join('\n'))}</div>`;
      if (navigator.clipboard && window.ClipboardItem && json.length < 25e6) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([slides.map((s) => App.slideTitle(s)).join('\n')], { type: 'text/plain' }) })]);
    } catch { /* intern klembord */ }
    if (cut === true) App.exec('deleteSlides');
  });
  App.def('cutSlides', () => App.exec('copySlides', true));
  App.pasteSlidesClip = (clip, keepSource) => {
    App.run(() => {
      const P = App.pres;
      Object.assign(App.media, App.cleanMedia ? App.cleanMedia(clip.media || {}) : clip.media || {});
      let master = App.masterOf(App.cur());
      if (keepSource && clip.master && clip.pres !== P.id) {
        const m = App.cleanMaster ? App.cleanMaster(clip.master) : clip.master;
        if (!P.masters.some((x) => x.id === m.id)) P.masters.push(m);
        master = P.masters.find((x) => x.id === m.id);
      }
      const slides = clip.slides.map((s0) => {
        const s = App.cloneSlide(App.cleanSlide ? App.cleanSlide(s0) : s0);
        const own = P.masters.some((m) => m.layouts.some((l) => l.id === s.layout));
        if (!own || (!keepSource && clip.pres !== P.id)) {
          const info = clip.layouts && clip.layouts[s0.layout];
          const l = master.layouts.find((x) => info && x.type === info.type) || master.layouts.find((x) => x.type === 'obj') || master.layouts[0];
          s.layout = l.id;
        }
        delete s.sec;
        return s;
      });
      insertAfterCurrent(slides);
    }, { all: true });
    App.gotoSlide(st.slide, { keepSorterSel: true });
    App.thumbs.refresh(true);
  };
  App.def('pasteSlides', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) if (it.types.includes('text/html')) { const html = await (await it.getType('text/html')).text(); const m = /data-doek-clip="([^"]+)"/.exec(html); if (m) { const clip = JSON.parse(decodeURIComponent(escape(atob(m[1])))); if (clip.kind === 'slides') { App.pasteSlidesClip(clip); return; } if (clip.kind === 'objs') { App.run(() => App.pasteClip(App.cleanClip(clip))); return; } } }
      }
    } catch { /* intern klembord */ }
    if (st.clip && st.clip.kind === 'slides') App.pasteSlidesClip(st.clip);
    else if (st.clip && st.clip.kind === 'objs') App.run(() => App.pasteClip(st.clip));
  });
  App.slideTitle = (s) => {
    const t = s.objs.find((o) => o.ph && App.phFamily(o.ph.type) === 'title');
    const txt = t ? App.plainText(t.text, ' ').trim() : '';
    if (txt) return txt;
    const any = s.objs.map(App.objText).find((x) => x && x.trim());
    return any ? any.trim().split('\n')[0].slice(0, 80) : App.t('Dia {0}').replace('{0}', App.slideIndex(s.id) + 1);
  };

  /* ---------- Secties ---------- */
  App.defEdit('sectionAdd', async () => {
    const name = await App.prompt(App.t('Naam van sectie wijzigen'), App.t('Naam van sectie'), App.t('Sectie zonder titel'));
    if (name === null) return false;
    App.run(() => {
      const P = App.pres;
      const sec = { id: App.uid('x'), name: name.trim() || App.t('Sectie zonder titel') };
      if (!P.sections.length) {
        // eerste sectie: dia's ervoor komen in "Standaardsectie"
        const def = { id: App.uid('x'), name: App.t('Standaardsectie') };
        P.sections.push(def);
        P.slides.forEach((s) => { s.sec = def.id; });
        if (st.slide === 0) { P.sections[0] = sec; P.slides.forEach((s) => { s.sec = sec.id; }); }
        else { P.sections.push(sec); P.slides.forEach((s, i) => { if (i >= st.slide) s.sec = sec.id; }); }
      } else {
        const cur = App.cur();
        const idx = P.sections.findIndex((x) => x.id === cur.sec);
        P.sections.splice(idx + 1, 0, sec);
        let after = false;
        P.slides.forEach((s) => { if (s === cur) after = true; if (after && s.sec === cur.sec) s.sec = sec.id; else if (after && s.sec !== sec.id) after = false; });
      }
      normalizeSections();
    }, { all: true });
    App.thumbs.refresh(true);
    return false;
  });
  const ctxSec = () => App.state.ctxSection || (App.cur() && App.cur().sec);
  App.def('sectionRename', async () => {
    const P = App.pres; const sec = P.sections.find((x) => x.id === ctxSec()); if (!sec) { App.toast(App.t('Er zijn nog geen secties.'), 'info'); return; }
    const name = await App.prompt(App.t('Naam van sectie wijzigen'), App.t('Naam van sectie'), sec.name);
    if (name === null) return;
    App.run(() => { sec.name = name.trim() || sec.name; }, { noTouch: true });
    App.thumbs.refresh(true);
  });
  App.defEdit('sectionRemove', () => {
    const P = App.pres; const id = ctxSec(); const i = P.sections.findIndex((x) => x.id === id); if (i < 0) return false;
    const target = P.sections[i - 1] || P.sections[i + 1];
    P.sections.splice(i, 1);
    P.slides.forEach((s) => { if (s.sec === id) { if (target) s.sec = target.id; else delete s.sec; } });
    normalizeSections(); App.state.ctxSection = null;
    setTimeout(() => App.thumbs.refresh(true), 0);
  }, { all: true });
  App.defEdit('sectionRemoveSlides', () => {
    const P = App.pres; const id = ctxSec();
    const rest = P.slides.filter((s) => s.sec !== id);
    if (!rest.length) { App.toast(App.t('Een presentatie heeft minstens één dia.'), 'info'); return false; }
    P.slides = rest; P.sections = P.sections.filter((x) => x.id !== id);
    normalizeSections(); st.slide = App.clamp(st.slide, 0, P.slides.length - 1); App.state.ctxSection = null;
    setTimeout(() => { App.gotoSlide(st.slide); App.thumbs.refresh(true); }, 0);
  }, { all: true });
  App.defEdit('sectionRemoveAll', () => { App.pres.sections = []; App.pres.slides.forEach((s) => delete s.sec); setTimeout(() => App.thumbs.refresh(true), 0); }, { all: true });
  App.defEdit('sectionMove', (d) => {
    const P = App.pres; const id = ctxSec(); const i = P.sections.findIndex((x) => x.id === id); const j = i + (+d);
    if (i < 0 || j < 0 || j >= P.sections.length) return false;
    const [x] = P.sections.splice(i, 1); P.sections.splice(j, 0, x);
    const rank = new Map(P.sections.map((s, k) => [s.id, k]));
    P.slides = P.slides.map((s, k) => ({ s, k })).sort((a, b) => rank.get(a.s.sec) - rank.get(b.s.sec) || a.k - b.k).map((y) => y.s);
    setTimeout(() => App.thumbs.refresh(true), 0);
  }, { all: true });
  App.def('sectionCollapse', (m) => { collapsed = m === 'all' ? new Set(App.pres.sections.map((x) => x.id)) : new Set(); App.thumbs.refresh(true); });

  /* ---------- Galerij met indelingen ---------- */
  const layoutGallery = (cmd, withExtra) => {
    const P = App.pres;
    const cur = App.cur();
    const curLayout = cur ? cur.layout : null;
    let html = '';
    P.masters.forEach((m) => {
      html += `<div class="menu-title">${App.esc(m.name)}</div><div class="lm-grid">`;
      m.layouts.forEach((l) => { html += `<button class="lm${l.id === curLayout && cmd === 'layoutSlide' ? ' on' : ''}" data-cmd="${cmd}" data-arg="${l.id}"><span class="lm-thumb" data-lthumb="${l.id}"></span><span>${App.esc(App.t(l.name))}</span></button>`; });
      html += '</div>';
    });
    if (withExtra) html += `<hr><button data-cmd="duplicateSlide"><span class="i">library_add</span> ${App.t('Geselecteerde dia\'s dupliceren')}</button><button data-cmd="slidesFromOutline"><span class="i">format_list_bulleted</span> ${App.t('Dia\'s uit overzicht…')}</button><button data-cmd="reuseSlides"><span class="i">recycling</span> ${App.t('Dia\'s opnieuw gebruiken…')}</button>`;
    return html;
  };
  const fillLayoutThumbs = (m) => {
    const P = App.pres;
    m.querySelectorAll('[data-lthumb]').forEach((sp) => {
      let layout = null; P.masters.forEach((ms) => { const l = ms.layouts.find((x) => x.id === sp.dataset.lthumb); if (l) layout = l; });
      if (layout) sp.appendChild(App.slideThumb(layout, 136, { mode: 'thumb' }));
    });
  };
  App.menuBuilders['m-layout'] = () => layoutGallery('layoutSlide', false);
  App.menuBuilders['m-layout'].cls = 'layouts-menu';
  App.menuBuilders['m-newslide'] = () => layoutGallery('newSlide', true);
  App.menuBuilders['m-newslide'].cls = 'layouts-menu';
  App.menuAfter['m-layout'] = fillLayoutThumbs;
  App.menuAfter['m-newslide'] = fillLayoutThumbs;

  /* ---------- Dia's uit een overzicht (tekstbestand met inspringingen) ---------- */
  App.def('slidesFromOutline', async () => {
    const f = await App.pickFile('.txt,.md,.text');
    if (!f) return;
    let text = await App.readFile(f);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
    if (!lines.length) return;
    App.run(() => {
      const m = App.masterOf(App.cur());
      const layout = m.layouts.find((l) => l.type === 'obj') || m.layouts[0];
      const slides = [];
      let cur = null;
      lines.forEach((l) => {
        const md = /^(#+)\s+(.*)$/.exec(l);
        const ind = (l.match(/^[\t ]*/)[0].replace(/\t/g, '    ').length);
        const txt = (md ? md[2] : l.trim().replace(/^[-*•]\s+/, ''));
        if (ind === 0 && !/^[-*•]\s/.test(l.trim()) || (md && md[1].length === 1)) {
          cur = App.newSlide(layout);
          const t = cur.objs.find((o) => o.ph && App.phFamily(o.ph.type) === 'title');
          if (t) t.text = { paras: [{ runs: [{ t: txt }] }] };
          cur._body = [];
          slides.push(cur);
        } else if (cur) cur._body.push({ runs: [{ t: txt }], lvl: Math.min(8, Math.max(0, Math.round((md ? md[1].length - 2 : ind / 4 - (/^[-*•]/.test(l.trim()) && ind === 0 ? 0 : 1))) || 0)) });
      });
      slides.forEach((s) => { const b = s.objs.find((o) => o.ph && App.phFamily(o.ph.type) === 'body'); if (b && s._body.length) b.text = { paras: s._body }; delete s._body; });
      insertAfterCurrent(slides);
    }, { all: true });
    App.gotoSlide(st.slide);
    App.thumbs.refresh(true);
  });
})();
