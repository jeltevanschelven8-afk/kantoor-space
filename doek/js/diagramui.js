/* =========================================================
   Doek (gemaakt door JJ van Schelven) — diagrammen in de app: invoegen, het huidige item,
   vormen toevoegen, promoveren, degraderen en verplaatsen, het tekstvenster, indelingen,
   kleuren en stijlen, converteren (naar vormen, naar tekst) en tekst omzetten in een diagram
   ========================================================= */
'use strict';

(() => {
  const D = App.Diagrams, st = App.state;
  if (!D) return;
  const esc = App.esc, T = (s) => App.t(s);

  /* ---------- Opmaak (eigen stijlblad) ---------- */
  const STYLE = `
.pd-dia-hi { position: absolute; pointer-events: none; }
.pd-dia-hi-box { position: absolute; border: 2px solid var(--accent); border-radius: 3px; box-shadow: 0 0 0 1px rgba(255,255,255,.9); }
.pd-dchip { width: 52px; height: 37px; padding: 0; border: 1px solid transparent; border-radius: 2px; background: #fff; display: inline-flex; align-items: center; justify-content: center; }
.pd-dchip:hover { border-color: var(--line-strong); }
.pd-dchip.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.pd-dchip svg { width: 44px; height: 33px; display: block; }
.menu.pd-dmenu { max-height: min(72vh, 600px); overflow: auto; }
.pd-dmenu .pd-dgrid { display: grid; grid-template-columns: repeat(6, 54px); gap: 3px; padding: 2px 6px 8px; }
.pd-dmenu .pd-dgrid .pd-dchip { width: 54px; height: 41px; border-color: var(--line); }
.pd-dmenu .pd-dgrid .pd-dchip.on { border-color: var(--accent); }
.menu.grid-menu.dialayouts { grid-template-columns: repeat(4, 58px); }
.menu.grid-menu.dialayouts > button { height: 46px; padding: 0; background: #fff; border-color: var(--line); }
.menu.grid-menu.dialayouts > button svg { width: 48px; height: 36px; }
.menu.grid-menu.dialayouts > button.pd-more { grid-column: 1 / -1; height: 30px; background: transparent; border-color: transparent; justify-content: flex-start; padding: 0 8px; gap: 6px; font-size: 13px; color: var(--text); }
.menu.grid-menu.dialayouts > .menu-empty { grid-column: 1 / -1; }
.menu > button.pd-dcol { gap: 8px; }
.pd-dsw { display: inline-flex; gap: 2px; }
.pd-dsw i { width: 14px; height: 14px; border: 1px solid rgba(0,0,0,.18); display: inline-block; }
.menu > button.pd-dlook { gap: 10px; }
.pd-dlook svg { width: 40px; height: 26px; flex: none; }
.pd-dd { display: grid; grid-template-columns: 150px 1fr 236px; gap: 12px; height: min(440px, 62vh); }
.pd-dd-cats { display: flex; flex-direction: column; gap: 1px; overflow: auto; border-right: 1px solid var(--line); padding-right: 8px; }
.pd-dd-cats button { text-align: left; padding: 6px 10px; border: 0; background: none; border-radius: 3px; font-size: 13px; color: var(--text); }
.pd-dd-cats button:hover { background: var(--hover); }
.pd-dd-cats button.on { background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }
.pd-dd-tiles { overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, 78px); grid-auto-rows: 62px; gap: 6px; align-content: start; padding: 2px; }
.pd-dd-tiles button { border: 1px solid var(--line); background: #fff; border-radius: 3px; display: flex; align-items: center; justify-content: center; padding: 0; }
.pd-dd-tiles button:hover { border-color: var(--line-strong); }
.pd-dd-tiles button.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.pd-dd-tiles svg { width: 64px; height: 48px; }
.pd-dd-side { display: flex; flex-direction: column; gap: 8px; border-left: 1px solid var(--line); padding-left: 12px; min-width: 0; }
.pd-dd-prev { background: #fff; border: 1px solid var(--line); border-radius: 3px; height: 152px; display: flex; align-items: center; justify-content: center; flex: none; }
.pd-dd-prev svg { width: 210px; height: 140px; }
.pd-dd-name { font-weight: 600; font-size: 14px; }
.pd-dd-desc { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.pd-dt-hint { font-size: 12px; color: var(--muted); padding: 0 2px 6px; }
.pd-dt-list { display: flex; flex-direction: column; gap: 1px; }
.pd-dt-row { display: flex; align-items: center; gap: 4px; padding: 1px 4px; border-radius: 3px; border: 1px solid transparent; }
.pd-dt-row:hover { background: var(--hover); }
.pd-dt-row.cur { background: var(--accent-soft); border-color: var(--accent); }
.pd-dt-b { width: 10px; color: var(--muted); font-size: 12px; text-align: center; flex: none; }
.pd-dt-row input { flex: 1; min-width: 0; border: 0; background: transparent; padding: 4px 2px; font-size: 13px; color: var(--text); outline: none; }
.pd-dt-foot { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); line-height: 1.45; }
.pd-dt-foot b { color: var(--text); font-weight: 600; display: block; }
.pd-dt-keys { margin-top: 6px; }
`;
  if (!document.getElementById('pd-diagramui-css')) { const s = document.createElement('style'); s.id = 'pd-diagramui-css'; s.textContent = STYLE; document.head.appendChild(s); }

  /* ---------- Hulpjes ---------- */
  const diaObj = () => { const o = App.sel1 && App.pres ? App.sel1() : null; return o && o.type === 'diagram' && o.dia ? o : null; };
  const itemsOf = (o) => (o && o.dia && Array.isArray(o.dia.items) ? o.dia.items : []);
  // het huidige item: aangeklikt in het diagram of in het tekstvenster; anders het laatste item
  const curItem = (o) => {
    const a = itemsOf(o);
    return a.find((it) => it.id === st.diaItem && st.diaItemOf === o.id) || a[a.length - 1] || null;
  };
  const setCur = (o, id) => { st.diaItem = id || null; st.diaItemOf = o && id ? o.id : null; };
  const accent = () => { const th = App.pres ? App.theme() : null; return th ? App.color('accent1', th) : '#156082'; };
  const chip = (l, cur, col, cmd = 'diaLayout') => `<button type="button" class="pd-dchip${l.id === cur ? ' on' : ''}" data-cmd="${cmd}" data-arg="${l.id}" title="${esc(T(l.name))}" style="color:${col}">${l.icon}</button>`;
  App.diaCurItem = () => { const o = diaObj(); return o ? curItem(o) : null; };

  /* ---------- Huidig item op het werkvlak aanwijzen ---------- */
  const drawItem = () => {
    const ov = $('#overlay');
    if (!ov) return;
    ov.querySelectorAll('.pd-dia-hi').forEach((e) => e.remove());
    const o = diaObj();
    if (!o || !st.diaItem || st.diaItemOf !== o.id || st.edit || st.sel.length !== 1) return;
    const wb = App.worldBox(o.id);
    if (!wb) return;
    let sh = [];
    try { sh = D.layout(o.dia, wb.w, wb.h, { noText: true }); } catch (e) { return; }
    let mine = sh.filter((s) => s.itemId === st.diaItem && s.role !== 'connector');
    if (!mine.length) mine = sh.filter((s) => s.text && s.text.some((p) => p.id === st.diaItem));   // subitem als opsommingsteken
    if (!mine.length) return;
    const x1 = Math.min(...mine.map((s) => s.x)), y1 = Math.min(...mine.map((s) => s.y));
    const x2 = Math.max(...mine.map((s) => s.x + s.w)), y2 = Math.max(...mine.map((s) => s.y + s.h)), z = App.zoom();
    const fr = document.createElement('div');
    fr.className = 'pd-dia-hi';
    fr.style.cssText = `left:${wb.x * z}px;top:${wb.y * z}px;width:${wb.w * z}px;height:${wb.h * z}px;${wb.rot ? `transform:rotate(${wb.rot}deg)` : ''}`;
    const b = document.createElement('div');
    b.className = 'pd-dia-hi-box';
    b.style.cssText = `left:${x1 * z - 3}px;top:${y1 * z - 3}px;width:${(x2 - x1) * z + 6}px;height:${(y2 - y1) * z + 6}px`;
    fr.appendChild(b);
    ov.appendChild(fr);
  };
  if (App.drawSelection) {
    const draw0 = App.drawSelection;
    App.drawSelection = (...a) => { const r = draw0(...a); try { drawItem(); } catch (e) { console.error(e); } return r; };
  }
  const refreshCur = () => { App.drawSelection && App.drawSelection(); markRow(); };

  // klik op een vorm in een diagram: dat item wordt het huidige (de editor selecteert daarna het diagram zelf)
  const stage = $('#stage');
  if (stage) stage.addEventListener('mousedown', (e) => {
    const ob = e.target.closest && e.target.closest('.ob.diagram');
    if (!ob || !ob.closest('#stage-slide')) return;
    const el = e.target.closest('[data-item]');
    st.diaItem = (el && el.dataset.item) || null;
    st.diaItemOf = st.diaItem ? ob.dataset.id : null;
    if (st.sel.includes(ob.dataset.id)) setTimeout(refreshCur, 0);
  }, true);
  // Delete op een geselecteerd item verwijdert alleen dat item; Esc laat het item los (het diagram blijft geselecteerd)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Escape') return;
    if (!App.pres || st.edit || $('.backdrop') || $('#backstage')) return;
    if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    const o = diaObj();
    if (!o || st.diaItemOf !== o.id || !itemsOf(o).some((it) => it.id === st.diaItem)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { setCur(null, null); refreshCur(); return; }
    App.exec('diaRemove');
  }, true);

  /* ---------- Diagram invoegen ---------- */
  // in een lege placeholder (obj/dgm, of phId) of gecentreerd op de dia (2/3 van de breedte); daarna het tekstvenster
  App.insertDiagram = (layoutId, phId, opts = {}) => {
    const P = App.pres, lay = D.byId(layoutId) ? layoutId : 'basicBlockList';
    let o = null;
    App.run(() => {
      const sel = App.sel1();
      const ph = phId ? App.obj(phId) : sel && sel.ph && /^(obj|dgm)$/.test(sel.ph.type) && App.isEmptyText(sel) ? sel : null;
      const W = P.size.w, H = P.size.h;
      const b = ph ? App.box(ph, App.surface().owner) : { x: W / 6, y: H * 0.19, w: W * 2 / 3, h: H * 0.62 };
      o = App.newObj('diagram', { x: b.x, y: b.y, w: b.w, h: b.h, name: App.objName(T('Diagram')), dia: { layout: lay, items: opts.items || D.sample(lay), color: opts.color || 'accent1', look: opts.look || 'flat' } });
      if (ph) { const list = App.ownerList(ph.id); list.splice(list.indexOf(ph), 1, o); st.sel = [o.id]; } else App.addObj(o);
    });
    if (!o) return null;
    setCur(o, o.dia.items[0] && o.dia.items[0].id);
    App.select([o.id]);
    App.setContext({ diagramDesign: true, auto: true });
    if (!opts.noPane) openText(true);
    return o;
  };

  /* ---------- Bewerken (één stap ongedaan maken) ---------- */
  const edit = (fn) => {
    const o = diaObj();
    if (!o) return false;
    const before = JSON.stringify(o.dia);
    fn(o);
    if (JSON.stringify(o.dia) === before) return false;
    return undefined;
  };
  App.defEdit('diaAdd', (mode) => edit((o) => {
    const cur = curItem(o), out = D.addItem(o.dia.items, cur ? cur.id : null, mode || 'after');
    o.dia.items = out.slice();
    setCur(o, out.newId);
  }));
  App.defEdit('diaLevel', (d) => edit((o) => { const cur = curItem(o); if (cur) o.dia.items = (+d < 0 ? D.promote : D.demote)(o.dia.items, cur.id); }));
  App.defEdit('diaMove', (d) => edit((o) => { const cur = curItem(o); if (cur) o.dia.items = D.move(o.dia.items, cur.id, +d < 0 ? -1 : 1); }));
  // item verwijderen; de subitems schuiven een niveau op (zoals SmartArt); het laatste item wordt alleen leeggemaakt
  App.defEdit('diaRemove', () => edit((o) => {
    const a = D.normalize(o.dia.items), i = a.findIndex((it) => it.id === (curItem(o) || {}).id);
    if (i < 0) return;
    if (a.length === 1) { a[0].text = ''; o.dia.items = a; return; }
    let j = i + 1;
    while (j < a.length && a[j].lvl > a[i].lvl) { a[j].lvl -= 1; j++; }
    a.splice(i, 1);
    o.dia.items = D.normalize(a);
    const next = o.dia.items[Math.max(0, i - 1)];
    setCur(o, next && next.id);
  }));
  App.defEdit('diaLayout', (id) => edit((o) => { if (D.byId(id)) o.dia.layout = id; }));
  App.defEdit('diaColor', (id) => edit((o) => { if (D.COLORS.some((c) => c.id === id)) o.dia.color = id; }));
  App.defEdit('diaLook', (id) => edit((o) => { if (D.LOOKS.some((l) => l.id === id)) o.dia.look = id; }));

  /* ---------- Converteren ---------- */
  // het object op dezelfde plek in de lijst vervangen; animaties gaan mee naar het nieuwe object
  const replaceObj = (old, nu) => {
    const list = App.ownerList(old.id), slide = App.surface().owner;
    list.splice(list.indexOf(old), 1, nu);
    (slide.anims || []).forEach((a) => { if (a.obj === old.id) a.obj = nu.id; if (a.trig && a.trig.obj === old.id) a.trig.obj = nu.id; });
    st.sel = [nu.id];
  };
  App.def('diaConvert', (kind) => {
    const o = diaObj();
    if (!o) return;
    let n = null;
    App.run(() => {
      const b = App.box(o, App.surface().owner);
      if (kind === 'text') {
        const paras = D.toParas(o.dia.items);
        n = App.newObj('shape', { geom: 'rect', txbox: true, fill: { type: 'none' }, line: { type: 'none' }, name: App.objName(T('Tekstvak')), x: b.x, y: b.y, w: b.w, h: b.h, rot: o.rot, text: { paras: paras.length ? paras : [App.emptyPara()], wrap: true } });
      } else {
        const kids = App.diagramObjs(o, b.w, b.h, { mode: 'edit', noPrompt: true }).map((c, k) => {
          const x = { ...c, id: App.uid('o'), name: T(c.type === 'line' ? 'Rechte verbindingslijn' : c._label ? 'Tekstvak' : 'Vorm') + ' ' + (k + 1) };
          delete x._item; delete x._label;
          Object.keys(x).forEach((key) => { if (x[key] === undefined) delete x[key]; });
          return x;
        });
        if (!kids.length) return false;
        n = App.newObj('group', { x: b.x, y: b.y, w: b.w, h: b.h, rot: o.rot, name: App.objName(T('Groep')), objs: kids, cw: b.w, ch: b.h });
      }
      if (!n.rot) delete n.rot;
      replaceObj(o, n);
    });
    if (n) App.select([n.id]);
  });
  // tekst (alinea's met inspringniveaus) van het geselecteerde tekstvak of de placeholder omzetten in een diagram
  App.def('textToDiagram', (layoutId) => {
    if (st.edit && App.textEdit) App.textEdit.stop();
    const s = App.sel1();
    if (!s || s.type !== 'shape' || !s.text) { App.toast(T('Selecteer eerst een tekstvak of tijdelijke aanduiding met tekst.'), 'info'); return; }
    const items = D.fromParas(s.text.paras);
    if (!items.length) { App.toast(T('Er is geen tekst om naar een diagram te converteren.'), 'info'); return; }
    let o = null;
    App.run(() => {
      const b = App.box(s, App.surface().owner);
      o = App.newObj('diagram', { x: b.x, y: b.y, w: b.w, h: b.h, rot: s.rot, name: App.objName(T('Diagram')), dia: { layout: D.byId(layoutId) ? layoutId : 'verticalBulletList', items, color: 'accent1', look: 'flat' } });
      if (!o.rot) delete o.rot;
      replaceObj(s, o);
    });
    if (!o) return;
    setCur(o, items[0].id);
    App.select([o.id]);
    App.setContext({ diagramDesign: true, auto: true });
  });

  /* ---------- Menu's en de galerie in het lint ---------- */
  App.menuBuilders['m-diaadd'] = () => {
    const o = diaObj(), org = !!(o && o.dia.layout === 'orgChart');
    const b = (mode, icon, label, on = true) => `<button data-cmd="diaAdd" data-arg="${mode}" ${on && o ? '' : 'disabled'}><span class="i">${icon}</span> ${esc(T(label))}</button>`;
    return b('after', 'east', 'Vorm erna toevoegen') + b('before', 'west', 'Vorm ervoor toevoegen') + b('above', 'north', 'Vorm erboven toevoegen')
      + b('below', 'south', 'Vorm eronder toevoegen') + b('assistant', 'person_add', 'Assistent toevoegen', org);
  };
  App.menuBuilders['m-dialayouts'] = () => {
    const o = diaObj(), cur = o && o.dia.layout, col = accent();
    return D.CATS.map((c) => `<div class="menu-title">${esc(T(c.name))}</div><div class="pd-dgrid">${D.LAYOUTS.filter((l) => l.cat === c.id).map((l) => chip(l, cur, col)).join('')}</div>`).join('')
      + `<hr><button data-cmd="diagramDialog" data-arg="change"><span class="i">account_tree</span> ${esc(T('Meer indelingen…'))}</button>`;
  };
  App.menuBuilders['m-dialayouts'].cls = 'pd-dmenu';
  App.menuBuilders['m-diacolors'] = () => {
    const o = diaObj(), cur = (o && o.dia.color) || 'accent1', th = App.theme();
    return `<div class="menu-title">${esc(T('Kleuren wijzigen'))}</div>` + D.COLORS.map((c) => `<button data-cmd="diaColor" data-arg="${c.id}" class="pd-dcol"><span class="i">${c.id === cur ? 'check' : ''}</span><span class="pd-dsw">${(c.sw || []).map((r) => `<i style="background:${App.color(r, th)}"></i>`).join('')}</span> ${esc(T(c.name))}</button>`).join('');
  };
  // klein voorbeeld van een stijl: vlak, subtiel (witte rand), intens (schaduw en donkere rand), omtrek
  const lookSvg = (id, th) => {
    const a = App.color('accent1', th), d = App.color('accent1/d25', th), bg = App.color('bg1', th);
    const fill = id === 'outline' ? bg : a, stroke = id === 'outline' ? a : id === 'subtle' ? '#ffffff' : id === 'intense' ? d : 'none';
    return `<svg viewBox="0 0 40 26" width="40" height="26">${id === 'intense' ? '<rect x="5" y="6" width="32" height="18" rx="3" fill="#000" opacity=".28"/>' : ''}<rect x="3" y="3" width="32" height="18" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${id === 'flat' ? 0 : 1.6}"/>${id === 'subtle' ? `<rect x="2" y="2" width="34" height="20" rx="4" fill="none" stroke="${a}" stroke-width=".6"/>` : ''}</svg>`;
  };
  App.menuBuilders['m-dialooks'] = () => {
    const o = diaObj(), cur = (o && o.dia.look) || 'flat', th = App.theme();
    return `<div class="menu-title">${esc(T('Diagramstijl'))}</div>` + D.LOOKS.map((l) => `<button data-cmd="diaLook" data-arg="${l.id}" class="pd-dlook"><span class="i">${l.id === cur ? 'check' : ''}</span>${lookSvg(l.id, th)} ${esc(T(l.name))}</button>`).join('');
  };
  App.menuBuilders['m-diaconvert'] = () => `<button data-cmd="diaConvert" data-arg="shapes" ${diaObj() ? '' : 'disabled'}><span class="i">category</span> ${esc(T('Converteren naar vormen'))}</button><button data-cmd="diaConvert" data-arg="text" ${diaObj() ? '' : 'disabled'}><span class="i">notes</span> ${esc(T('Converteren naar tekst'))}</button>`;
  // Start › Converteren naar diagram: een greep uit de indelingen en 'Meer diagrammen…'
  const QUICK = ['verticalBulletList', 'basicBlockList', 'horizontalBulletList', 'stackedList', 'basicProcess', 'basicChevronProcess', 'basicTimeline', 'basicBendingProcess',
    'basicCycle', 'basicRadial', 'orgChart', 'hierarchy', 'basicVenn', 'basicMatrix', 'basicPyramid', 'groupingList'];
  App.menuBuilders['m-todiagram'] = () => {
    const s = App.sel1();
    if (!s || s.type !== 'shape' || !s.text || App.isEmptyText(s)) return `<div class="menu-empty">${esc(T('Selecteer een tekstvak of tijdelijke aanduiding met tekst om die om te zetten in een diagram.'))}</div>`;
    const col = accent();
    return QUICK.map((id) => D.byId(id)).filter(Boolean).map((l) => `<button data-cmd="textToDiagram" data-arg="${l.id}" title="${esc(T(l.name))}" style="color:${col}">${l.icon}</button>`).join('')
      + `<button class="pd-more" data-cmd="diagramDialog" data-arg="convert"><span class="i">account_tree</span> ${esc(T('Meer diagrammen…'))}</button>`;
  };
  // galerie Indelingen: de indelingen uit de categorie van het geselecteerde diagram
  App.fillDiagramGallery = () => {
    const g = $('#g-dialayouts');
    if (!g) return;
    const o = diaObj();
    if (!o) { g.innerHTML = ''; return; }
    const cur = D.byId(o.dia.layout) || D.LAYOUTS[0], col = accent();
    g.innerHTML = D.LAYOUTS.filter((l) => l.cat === cur.cat).map((l) => chip(l, cur.id, col)).join('');
  };

  /* ---------- Dialoog Diagram kiezen ---------- */
  // links de categorieën (Alle + de zeven groepen), in het midden de indelingen, rechts een voorbeeld met naam en uitleg
  const pickDialog = (title, curId, onOk) => {
    let cat = 'all', cur = D.byId(curId) || D.LAYOUTS[0];
    const col = accent(), cats = [{ id: 'all', name: 'Alle' }].concat(D.CATS);
    const body = document.createElement('div');
    body.className = 'pd-dd';
    body.innerHTML = `<div class="pd-dd-cats" role="tablist">${cats.map((c) => `<button type="button" data-cat="${c.id}" role="tab">${esc(T(c.name))}</button>`).join('')}</div>
      <div class="pd-dd-tiles" role="listbox" aria-label="${esc(T('Indelingen'))}"></div>
      <div class="pd-dd-side"><div class="pd-dd-prev notranslate"></div><div class="pd-dd-name"></div><div class="pd-dd-desc"></div></div>`;
    const tiles = body.querySelector('.pd-dd-tiles');
    const side = () => {
      tiles.querySelectorAll('[data-lay]').forEach((b) => { const on = b.dataset.lay === cur.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      const prev = body.querySelector('.pd-dd-prev');
      prev.innerHTML = D.preview({ layout: cur.id, items: D.sample(cur.id), color: 'accent1', look: 'flat' }, 210, 140);
      prev.style.color = col;
      body.querySelector('.pd-dd-name').textContent = T(cur.name);
      body.querySelector('.pd-dd-desc').textContent = T(cur.desc);
    };
    const show = () => {
      body.querySelectorAll('[data-cat]').forEach((b) => { const on = b.dataset.cat === cat; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      const list = D.LAYOUTS.filter((l) => cat === 'all' || l.cat === cat);
      if (!list.includes(cur)) cur = list[0];
      tiles.innerHTML = list.map((l) => `<button type="button" data-lay="${l.id}" role="option" title="${esc(T(l.name))}" style="color:${col}">${l.icon}</button>`).join('');
      side();
      const on = tiles.querySelector('.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    };
    body.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { cat = c.dataset.cat; show(); return; }
      const l = e.target.closest('[data-lay]');
      if (l) { cur = D.byId(l.dataset.lay) || cur; side(); }
    });
    body.addEventListener('dblclick', (e) => { if (e.target.closest('[data-lay]')) { d.close(); onOk(cur.id); } });
    // pijltjestoetsen in de tegels: vorige/volgende indeling
    tiles.addEventListener('keydown', (e) => {
      const btns = [...tiles.querySelectorAll('[data-lay]')], i = btns.findIndex((b) => b.dataset.lay === cur.id);
      const per = Math.max(1, Math.round(tiles.clientWidth / 84));
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: per, ArrowUp: -per }[e.key];
      if (!step || i < 0) return;
      e.preventDefault();
      const nb = btns[App.clamp(i + step, 0, btns.length - 1)];
      cur = D.byId(nb.dataset.lay) || cur; side(); nb.focus();
    });
    const d = App.dialog({ title: T(title), body, wide: true, buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: () => onOk(cur.id) }] });
    if (curId) cat = cur.cat;
    show();
    return d;
  };
  // arg: placeholder-id (invoegen in die placeholder), 'change' (indeling van het geselecteerde diagram) of 'convert' (tekst omzetten)
  App.def('diagramDialog', (arg) => {
    if (arg === 'change') { const o = diaObj(); if (o) pickDialog('Indeling wijzigen', o.dia.layout, (id) => App.exec('diaLayout', id)); return; }
    if (arg === 'convert') { pickDialog('Converteren naar diagram', 'verticalBulletList', (id) => App.exec('textToDiagram', id)); return; }
    const phId = typeof arg === 'string' && arg && App.obj(arg) ? arg : null;
    pickDialog('Diagram kiezen', null, (id) => App.insertDiagram(id, phId));
  });

  /* ---------- Tekstvenster (zoals het tekstvenster van SmartArt) ---------- */
  // één regel per item, ingesprongen volgens het niveau; Enter = nieuw item, Tab / Shift+Tab = degraderen / promoveren,
  // Backspace aan het begin = samenvoegen met de vorige regel (lege regel verwijderen), pijltjes = vorige / volgende regel
  let paneSig = '';
  const sig = (o) => (o ? o.id + '|' + itemsOf(o).map((it) => it.id + ':' + it.lvl + (it.asst ? 'a' : '')).join(',') + '|' + o.dia.layout : '');
  const markRow = () => {
    const list = $('#pane .pd-dt-list');
    if (!list) return;
    list.querySelectorAll('.pd-dt-row').forEach((r) => r.classList.toggle('cur', r.dataset.id === st.diaItem));
    const r = list.querySelector('.pd-dt-row.cur');
    if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
  };
  const focusRow = (id, pos) => requestAnimationFrame(() => {
    const inp = $(`#pane .pd-dt-list input[data-id="${CSS.escape(id || '')}"]`);
    if (!inp) return;
    inp.focus({ preventScroll: true });
    const p = pos == null ? inp.value.length : Math.min(pos, inp.value.length);
    try { inp.setSelectionRange(p, p); } catch (e) { /* niets */ }
  });
  const openText = (focus) => {
    if (st.pane !== 'diatext') App.panes.open('diatext'); else App.panes.refresh(true);
    const o = diaObj(), it = o && curItem(o);
    if (it) { setCur(o, it.id); refreshCur(); if (focus) focusRow(it.id); }
  };
  // vanuit het lint wisselt de knop het venster; dubbelklikken op een diagram opent het altijd
  App.def('diaText', (arg, el) => {
    if (el && st.pane === 'diatext') { App.panes.close(); return; }
    if (!diaObj()) { App.toast(T('Selecteer eerst een diagram.'), 'info'); return; }
    openText(true);
  });
  App.stateFns.diaText = () => st.pane === 'diatext';
  // wijziging aan de structuur (nieuw item, niveau, samenvoegen): één stap ongedaan maken, daarna de juiste regel focussen
  const structural = (fn) => {
    let res = null;
    App.run(() => {
      const o = diaObj();
      if (!o) return false;
      const before = JSON.stringify(o.dia.items);
      res = fn(o);
      if (!res || JSON.stringify(o.dia.items) === before) return false;
      return undefined;
    });
    if (!res) return;
    const o = diaObj();
    if (o) setCur(o, res.id);
    App.panes.refresh(true);
    focusRow(res.id, res.pos);
  };
  const onKey = (e) => {
    const inp = e.target.closest && e.target.closest('input[data-id]');
    if (!inp || e.isComposing) return;
    const id = inp.dataset.id, v = inp.value, a = inp.selectionStart || 0, b = inp.selectionEnd || 0;
    const idx = (o) => o.dia.items.findIndex((x) => x.id === id);
    if (e.key === 'Enter') {
      e.preventDefault();
      // regel splitsen bij de cursor; het nieuwe item komt direct na deze regel op hetzelfde niveau
      structural((o) => {
        const A = o.dia.items, i = idx(o);
        if (i < 0) return null;
        const nu = { id: D.uid(), text: v.slice(b), lvl: A[i].lvl };
        if (A[i].asst) nu.asst = true;
        A[i].text = v.slice(0, a);
        A.splice(i + 1, 0, nu);
        o.dia.items = D.normalize(A);
        return { id: nu.id, pos: 0 };
      });
    } else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      structural((o) => { o.dia.items = (e.shiftKey ? D.promote : D.demote)(o.dia.items, id); return { id, pos: a }; });
    } else if (e.key === 'Backspace' && a === 0 && b === 0) {
      const o = diaObj();
      if (!o || idx(o) <= 0) return;
      e.preventDefault();
      structural((x) => {
        const A = x.dia.items, i = idx(x), prev = A[i - 1], pos = prev.text.length;
        prev.text += v;
        A.splice(i, 1);
        x.dia.items = D.normalize(A);
        return { id: prev.id, pos };
      });
    } else if (e.key === 'Delete' && a === v.length && b === v.length) {
      const o = diaObj();
      if (!o || idx(o) < 0 || idx(o) >= o.dia.items.length - 1) return;
      e.preventDefault();
      structural((x) => {
        const A = x.dia.items, i = idx(x);
        A[i].text = v + A[i + 1].text;
        A.splice(i + 1, 1);
        x.dia.items = D.normalize(A);
        return { id, pos: v.length };
      });
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.ctrlKey) {
      const up = e.key === 'ArrowUp';
      if (e.altKey) { e.preventDefault(); structural((o) => { o.dia.items = D.move(o.dia.items, id, up ? -1 : 1); return { id, pos: a }; }); return; }
      const rows = [...inp.closest('.pd-dt-list').querySelectorAll('input[data-id]')], t = rows[rows.indexOf(inp) + (up ? -1 : 1)];
      if (!t) return;
      e.preventDefault();
      t.focus();
      const p = Math.min(a, t.value.length);
      t.setSelectionRange(p, p);
    }
  };
  const bindRows = (list) => {
    list.addEventListener('focusin', (e) => {
      const inp = e.target.closest('input[data-id]'), o = diaObj();
      if (!inp || !o) return;
      setCur(o, inp.dataset.id);
      refreshCur();
    });
    // typen: tekst meteen in het diagram; na een pauze één stap in de geschiedenis
    list.addEventListener('input', (e) => {
      const inp = e.target.closest('input[data-id]'), o = diaObj();
      const it = o && o.dia.items.find((x) => x.id === inp.dataset.id);
      if (!it) return;
      it.text = inp.value;
      App.touch(); App.markDirty(); App.history.later(700); App.scheduleRender();
    });
    list.addEventListener('keydown', onKey);
  };
  const PANE = {
    title: 'Tekstvenster',
    light: true,
    render(body) {
      const o = diaObj();
      paneSig = sig(o);
      if (!o) { body.innerHTML = `<div class="pane-empty">${esc(T('Selecteer een diagram om de tekst te bewerken.'))}</div>`; return; }
      const l = D.byId(o.dia.layout) || D.LAYOUTS[0];
      body.innerHTML = `<div class="pd-dt-hint">${esc(T('Typ hier uw tekst'))}</div>
        <div class="pd-dt-list">${itemsOf(o).map((it) => `<div class="pd-dt-row" data-id="${esc(it.id)}" style="padding-left:${4 + it.lvl * 16}px"><span class="pd-dt-b">${it.asst ? '◦' : '•'}</span><input type="text" class="notranslate" data-id="${esc(it.id)}" value="${esc(it.text)}" placeholder="${esc(T('[Tekst]'))}" aria-label="${esc(T('Tekst van het item'))}" spellcheck="true"></div>`).join('')}</div>
        <div class="pd-dt-foot"><b>${esc(T(l.name))}</b>${esc(T(l.desc))}<div class="pd-dt-keys">${esc(T('Enter = nieuw item · Tab = degraderen · Shift+Tab = promoveren · Alt+pijltjes = verplaatsen'))}</div></div>`;
      bindRows(body.querySelector('.pd-dt-list'));
      markRow();
    },
    // lichte verversing: zelfde items → alleen teksten en de huidige regel bijwerken
    update(body) {
      const o = diaObj();
      if (sig(o) !== paneSig || !body.querySelector('.pd-dt-list') !== !o) { PANE.render(body); return; }
      itemsOf(o).forEach((it) => { const inp = body.querySelector(`input[data-id="${CSS.escape(it.id)}"]`); if (inp && inp !== document.activeElement && inp.value !== it.text) inp.value = it.text; });
      markRow();
    },
  };
  App.panes.register('diatext', PANE);

  /* ---------- Gebeurtenissen ---------- */
  const gallerySoon = App.debounce(() => App.fillDiagramGallery(), 120);
  App.on('selection', () => {
    const o = diaObj();
    if (!o || st.diaItemOf !== o.id) { st.diaItem = null; st.diaItemOf = null; }
    App.fillDiagramGallery();
  });
  App.on('change', () => { if (diaObj()) gallerySoon(); });
  if (App.pres) App.fillDiagramGallery();
})();
