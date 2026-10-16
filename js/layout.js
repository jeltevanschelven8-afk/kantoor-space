/* =========================================================
   Inkt — pagina-indeling, kop/voettekst, liniaal, zoom, weergaven, ontwerp
   ========================================================= */
'use strict';

App.PAGE_SIZES = { A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6], B5: [176, 250], DL: [220, 110] };
App.GAP = 26;
App.geom = () => {
  const p = App.doc.meta.page;
  let [w, h] = App.PAGE_SIZES[p.size] || App.PAGE_SIZES.A4;
  if (p.orient === 'landscape' && h > w) [w, h] = [h, w];
  if (p.orient === 'portrait' && w > h) [w, h] = [h, w];
  const mm = 96 / 25.4;
  const m = p.margins;
  return { W: w * mm, H: h * mm, wmm: w, hmm: h, mt: App.cm2px(m.t), mb: App.cm2px(m.b), ml: App.cm2px(m.l), mr: App.cm2px(m.r) };
};
App.pages = { count: 1, map: new WeakMap() };

/* ---------- Paginering ---------- */
// Bovenmarge van een blok zonder paginerings-duwtje (voor dialogen en invoervelden)
App.naturalMarginTop = (b) => {
  if (!b.dataset.pg) return parseFloat(getComputedStyle(b).marginTop) || 0;
  const cur = b.style.marginTop;
  b.style.marginTop = b.dataset.pgOrig || '';
  const v = parseFloat(getComputedStyle(b).marginTop) || 0;
  b.style.marginTop = cur;
  return v;
};
// Rijen van een lange tabel die op de volgende pagina zijn begonnen (zie fastPass) weer vrijgeven
App.clearRows = (scope) => {
  $$('tr.pg-row', scope || App.ed).forEach((tr) => {
    tr.classList.remove('pg-row'); if (!tr.classList.length) tr.removeAttribute('class');
    ['--pg-push', '--pg-a', '--pg-b'].forEach((k) => tr.style.removeProperty(k));
    if (!tr.getAttribute('style')) tr.removeAttribute('style');
  });
};
App.clearPushes = () => {
  App.clearRows();
  $$('[data-pg]', App.ed).forEach((el) => {
    el.style.marginTop = el.dataset.pgOrig || '';
    delete el.dataset.pg; delete el.dataset.pgOrig;
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
};
App.pageUnits = () => {
  const units = [];
  Array.from(App.ed.children).forEach((el) => {
    if ((el.tagName === 'UL' || el.tagName === 'OL') && el.children.length) {
      Array.from(el.children).forEach((li) => { if (li.tagName === 'LI') units.push(li); });
    } else units.push(el);
  });
  return units;
};
/* fromUnit (optioneel): alleen dit blok is veranderd (typen). Blokken daarvóór staan dan nog
   goed; we pagineren pas vanaf dit blok opnieuw. Scheelt veel bij lange documenten. */
App.layout = (fromUnit) => {
  const ed = App.ed, g = App.geom(), z = App.state.zoom;
  const view = App.state.view;
  const pagesEl = $('#pages'), sizer = $('#zoom-sizer');
  const units = App.pageUnits();
  let startIdx = 0;
  const prev = App.pages;
  if (fromUnit && view !== 'web' && prev.st && prev.units && prev.units.length === units.length && prev.geomKey === App.geomKey()) {
    const i = units.indexOf(fromUnit);
    if (i > 0 && prev.units[i] === fromUnit && prev.st[i]) startIdx = i;
  }
  if (startIdx) {
    for (let k = startIdx; k < units.length; k++) {
      const el = units[k];
      if (el.tagName === 'TABLE') App.clearRows(el);
      if (!el.dataset.pg) continue;
      el.style.marginTop = el.dataset.pgOrig || '';
      delete el.dataset.pg; delete el.dataset.pgOrig;
      if (!el.getAttribute('style')) el.removeAttribute('style');
    }
  } else App.clearPushes();

  if (view === 'web') {
    App.pages.h = null;
    const avail = $('#canvas-scroll').clientWidth - 48 - App.commentPaneWidth();
    const w = Math.max(320, avail / z);
    ed.style.width = w + 'px';
    ed.style.padding = '40px 56px';
    ed.style.minHeight = Math.max(400, ($('#canvas-scroll').clientHeight - 60) / z) + 'px';
    pagesEl.style.width = w + 'px';
    const h = ed.offsetHeight;
    pagesEl.style.height = h + 'px';
    sizer.style.width = w * z + 'px'; sizer.style.height = h * z + 'px';
    App.pages.count = 1;
    App.renderSheets(0);
    App.positionAfterLayout();
    return;
  }

  ed.style.width = g.W + 'px';
  ed.style.padding = `${g.mt}px ${g.mr}px ${g.mb}px ${g.ml}px`;
  ed.style.minHeight = g.H + 'px';
  pagesEl.style.width = g.W + 'px';

  const P = g.H + App.GAP;
  const bodyH = g.H - g.mt - g.mb;
  const edTop = () => ed.getBoundingClientRect().top;
  if (!startIdx) { App.pages.h = new WeakMap(); App.pages.st = []; }   // hoogte per blok: om bij typen de layout te kunnen overslaan
  App.pages.n = units.length;
  App.pages.units = units;
  App.pages.geomKey = App.geomKey();
  // Op welke pagina hoort een blok, en moet het naar beneden geduwd worden?
  const decide = (top, h, lastPage, breakPage) => {
    let p = Math.max(lastPage, Math.floor(top / P)), target = null;
    if (breakPage >= 0) { p = breakPage + 1; target = p * P + g.mt; } else {
      const bodyTop = p * P + g.mt, bodyBottom = p * P + g.H - g.mb;
      if (top < bodyTop - 0.5) target = bodyTop;
      else if (top >= bodyBottom - 0.5) { p++; target = p * P + g.mt; }
      else if (top + h > bodyBottom + 0.5 && h <= bodyH && top > bodyTop + 0.5) { p++; target = p * P + g.mt; }
    }
    return { p, target };
  };
  const unpush = (el) => {
    if (el.tagName === 'TABLE') App.clearRows(el);
    if (!el.dataset.pg) return;
    el.style.marginTop = el.dataset.pgOrig || '';
    delete el.dataset.pg; delete el.dataset.pgOrig;
    if (!el.getAttribute('style')) el.removeAttribute('style');
  };
  // Grootste aangrenzende marge (marges vallen samen): zo groot moet de nieuwe bovenmarge minstens zijn
  const mtop = (el) => parseFloat(getComputedStyle(el).marginTop) || 0;
  const mbot = (el) => parseFloat(getComputedStyle(el).marginBottom) || 0;
  const flat = (el, side) => { const cs = getComputedStyle(el); return !parseFloat(cs['padding' + side]) && !parseFloat(cs['border' + side + 'Width']) && cs.display === 'block'; };
  const adjoin = (u) => {
    let v = mtop(u), n = u;
    while (n.parentNode !== ed && n === n.parentNode.firstElementChild && flat(n.parentNode, 'Top')) { n = n.parentNode; v = Math.max(v, mtop(n)); }
    let pr = n.previousElementSibling;
    while (pr) {
      v = Math.max(v, mbot(pr));
      // leeg blok zonder hoogte (bv. pagina-einde): marges vallen er doorheen
      if (!pr.offsetHeight && flat(pr, 'Top') && flat(pr, 'Bottom')) { v = Math.max(v, mtop(pr)); pr = pr.previousElementSibling; continue; }
      if (pr.lastElementChild && flat(pr, 'Bottom')) pr = pr.lastElementChild; else break;
    }
    return v;
  };
  // Snelle doorgang: alles in één keer meten, duwtjes uitrekenen en in één keer schrijven.
  // Geeft de index terug van het eerste blok waar de voorspelling niet klopte (-1 = alles goed).
  let lastPage = 0;
  const fastPass = (from) => {
    let { lastPage: lp, breakPage: bp } = App.pages.st[from] || { lastPage: 0, breakPage: -1 };
    const base = edTop();
    const rects = [];
    for (let k = from; k < units.length; k++) rects[k] = units[k].getBoundingClientRect();
    let shift = 0;
    const plan = [], rowPlan = [];
    for (let k = from; k < units.length; k++) {
      const u = units[k], rect = rects[k];
      App.pages.st[k] = { lastPage: lp, breakPage: bp };
      if (u.classList.contains('page-break')) {
        bp = Math.max(lp, Math.floor(((rect.top - base) / z + shift) / P));
        App.pages.map.set(u, bp);
        continue;
      }
      if (!rect.height && !rect.width && u.offsetParent === null) continue;
      let top = (rect.top - base) / z + shift;
      let h = rect.height / z;
      const { p, target } = decide(top, h, lp, bp);
      bp = -1;
      if (target != null && Math.abs(target - top) > 0.5) {
        // Een kop blijft bij de alinea erna (zoals in Word): staat de kop nog op de vorige pagina en past hij
        // samen met deze alinea op de nieuwe, dan schuift de kop mee in plaats van alleen de alinea.
        const pu = k > from ? units[k - 1] : null;
        const puTop = pu ? (rects[k - 1].top - base) / z + shift : 0;
        if (pu && /^H[1-6]$/.test(pu.tagName) && target > top && App.pages.map.get(pu) === p - 1 && !plan.some((x) => x[0] === pu)
            && puTop > (p - 1) * P + g.mt + 0.5 && top + h - puTop <= bodyH) {
          const d = target - puTop;
          plan.push([pu, d, target, k - 1]); shift += d; top += d; App.pages.map.set(pu, p);
        } else { plan.push([u, target - top, target, k]); shift += target - top; top = target; }
      }
      // Lange tabel: een rij die over de onderrand van de pagina valt begint op de volgende pagina
      if (u.tagName === 'TABLE' && h > bodyH) {
        let rs = 0;
        for (const tr of $$('tr', u)) {
          if (tr.closest('table') !== u) continue;
          const rr = tr.getBoundingClientRect();
          const rt = top + (rr.top - rect.top) / z + rs, rh = rr.height / z;
          const rp = Math.floor(rt / P);
          if (rt + rh > rp * P + g.H - g.mb + 0.5 && rh <= bodyH && rt > rp * P + g.mt + 0.5) {
            const d = (rp + 1) * P + g.mt - rt;
            rowPlan.push([tr, d, rp * P + g.H - rt]);
            rs += d;
          }
        }
        shift += rs; h += rs;
      }
      App.pages.h.set(u, h);
      App.pages.map.set(u, p);
      lp = Math.max(p, Math.floor((top + h - 1) / P));
    }
    const ms = plan.map(([u, d]) => adjoin(u) + d);
    plan.forEach(([u], i) => { u.dataset.pgOrig = u.style.marginTop || ''; u.dataset.pg = '1'; u.style.marginTop = ms[i].toFixed(2) + 'px'; });
    rowPlan.forEach(([tr, d, a]) => { tr.classList.add('pg-row'); tr.style.setProperty('--pg-push', d.toFixed(2) + 'px'); tr.style.setProperty('--pg-a', a.toFixed(2) + 'px'); tr.style.setProperty('--pg-b', (a + App.GAP).toFixed(2) + 'px'); });
    lastPage = lp;
    if (plan.length) {
      const b2 = edTop();
      for (const [u, , target, k] of plan) if (Math.abs((u.getBoundingClientRect().top - b2) / z - target) > 1) return k;
    }
    return -1;
  };
  // Langzame, meet-na-elke-stap doorgang (vangnet voor bijzondere gevallen zoals zwevende objecten)
  const slowPass = (from) => {
    let { lastPage: lp, breakPage: bp } = App.pages.st[from] || { lastPage: 0, breakPage: -1 };
    let base = edTop();
    for (let k = from; k < units.length; k++) {
      const u = units[k];
      App.pages.st[k] = { lastPage: lp, breakPage: bp };
      if (u.classList.contains('page-break')) {
        bp = Math.max(lp, Math.floor((u.getBoundingClientRect().top - base) / z / P));
        App.pages.map.set(u, bp);
        continue;
      }
      let rect = u.getBoundingClientRect();
      if (!rect.height && !rect.width && u.offsetParent === null) continue;
      let top = (rect.top - base) / z;
      const h = rect.height / z;
      App.pages.h.set(u, h);
      const { p, target } = decide(top, h, lp, bp);
      bp = -1;
      if (target != null && Math.abs(target - top) > 0.5) {
        u.dataset.pgOrig = u.style.marginTop || '';
        u.dataset.pg = '1';
        let m = mtop(u);
        for (let i = 0; i < 3; i++) {
          const delta = target - top;
          if (Math.abs(delta) < 0.5) break;
          m += delta;
          u.style.marginTop = m.toFixed(2) + 'px';
          rect = u.getBoundingClientRect();
          top = (rect.top - edTop()) / z;
        }
        base = edTop();
      }
      App.pages.map.set(u, p);
      lp = Math.max(p, Math.floor((top + h - 1) / P));
    }
    lastPage = lp;
  };
  const bad = fastPass(startIdx);
  App.pages.slowFrom = bad;
  if (bad >= 0) {
    for (let k = bad; k < units.length; k++) unpush(units[k]);
    slowPass(bad);
  }
  const contentBottom = (ed.scrollHeight);
  const count = Math.max(lastPage + 1, Math.ceil((contentBottom - 1) / P), 1);
  App.pages.count = count;
  const total = count * P - App.GAP;
  ed.style.minHeight = total + 'px';
  pagesEl.style.height = total + 'px';
  sizer.style.width = g.W * z + 'px';
  sizer.style.height = total * z + 'px';
  App.renderSheets(count);
  App.positionAfterLayout();
};
App.geomKey = () => { const g = App.geom(); return [g.W, g.H, g.mt, g.mb, g.ml, g.mr, App.state.zoom, App.state.view].join('|'); };
App.positionAfterLayout = () => {
  App.drawRuler();
  App.updatePageStatus();
  App.positionObjOverlay && App.positionObjOverlay();
  App.layoutComments && App.layoutComments();
};
window.addEventListener('resize', App.debounce(() => { App.layout(); }, 120));

/* ---------- Pagina's tekenen (vellen, kop/voet, watermerk) ---------- */
App.hfFieldText = (fld, page, count) => {
  switch (fld) {
    case 'page': return String(page);
    case 'pages': return String(count);
    case 'date': return App.fmtDate(Date.now(), { day: 'numeric', month: 'long', year: 'numeric' });
    case 'title': return App.doc.title;
    default: return '';
  }
};
App.fillFields = (el, page, count) => {
  el.querySelectorAll('.fld').forEach((f) => { f.textContent = App.hfFieldText(f.dataset.fld, page, count); });
};
App.renderSheets = (count) => {
  const host = $('#sheets');
  const m = App.doc.meta, g = App.geom();
  const sig = [count, g.W, g.H, g.mt, g.mb, g.ml, g.mr, m.header, m.footer, m.headerFirst, m.footerFirst, m.firstDiff, m.watermark, m.pageColor, m.pageBorder, App.state.grid, App.doc.title].join('|');
  if (host.dataset.sig === sig && !App._forceSheets) return;
  App._forceSheets = false;
  host.dataset.sig = sig;
  const editing = App.state.hfEditing;
  const P = g.H + App.GAP;
  const hfDist = App.cm2px(1.25);
  while (host.children.length > count) host.lastElementChild.remove();
  for (let i = 0; i < count; i++) {
    let s = host.children[i];
    if (!s) {
      s = document.createElement('div');
      s.className = 'sheet';
      s.innerHTML = `<div class="wm"><span></span></div><div class="pb-frame"></div>
        <span class="hf-tag ht">Koptekst</span><div class="hf header" data-kind="header" data-ph="Dubbelklik om koptekst toe te voegen"></div>
        <span class="hf-tag ft">Voettekst</span><div class="hf footer" data-kind="footer" data-ph="Dubbelklik om voettekst toe te voegen"></div>`;
      host.appendChild(s);
    }
    s.dataset.page = i;
    Object.assign(s.style, { top: i * P + 'px', width: g.W + 'px', height: g.H + 'px', backgroundColor: m.pageColor || '#fff' });
    s.classList.toggle('grid', !!App.state.grid);
    const wm = s.querySelector('.wm');
    wm.hidden = !m.watermark;
    wm.firstElementChild.textContent = m.watermark || '';
    wm.firstElementChild.style.fontSize = Math.min(110, (g.W * 1.1) / Math.max(4, (m.watermark || '').length)) + 'px';
    const pb = s.querySelector('.pb-frame');
    const inset = 24;
    Object.assign(pb.style, { left: inset + 'px', top: inset + 'px', right: inset + 'px', bottom: inset + 'px', border: App.pageBorderCss(m.pageBorder) });
    const first = m.firstDiff && i === 0;
    const hd = s.querySelector('.hf.header'), ft = s.querySelector('.hf.footer');
    [hd, ft].forEach((el) => { el.dataset.first = first ? '1' : '0'; });
    Object.assign(hd.style, { left: g.ml + 'px', right: g.mr + 'px', top: hfDist + 'px', maxHeight: Math.max(20, g.mt - hfDist - 4) + 'px' });
    Object.assign(ft.style, { left: g.ml + 'px', right: g.mr + 'px', bottom: hfDist + 'px', maxHeight: Math.max(20, g.mb - hfDist - 4) + 'px' });
    const ht = s.querySelector('.ht'), ftg = s.querySelector('.ft');
    Object.assign(ht.style, { left: g.ml + 'px', top: (hfDist - 18) + 'px' });
    Object.assign(ftg.style, { left: g.ml + 'px', bottom: (hfDist - 18) + 'px' });
    ht.textContent = first ? 'Koptekst eerste pagina' : 'Koptekst';
    ftg.textContent = first ? 'Voettekst eerste pagina' : 'Voettekst';
    if (!editing || editing.el !== hd) { hd.innerHTML = first ? m.headerFirst : m.header; App.fillFields(hd, i + 1, count); }
    if (!editing || editing.el !== ft) { ft.innerHTML = first ? m.footerFirst : m.footer; App.fillFields(ft, i + 1, count); }
  }
};
App.pageBorderCss = (v) => ({
  thin: '1px solid #555', thick: '3px solid #333', double: '4px double #444', dashed: '1.5px dashed #666', accent: '3px solid var(--doc-accent)',
}[v] || 'none');

App.updatePageStatus = () => {
  const n = App.pages.count;
  let cur = 1;
  const r = App.getRange() || App.lastRange;
  if (r && App.inEditor(r.startContainer) && App.state.view !== 'web') {
    const rects = r.getClientRects();
    const rect = rects.length ? rects[0] : (App.blockOf(r.startContainer) || App.ed).getBoundingClientRect();
    const top = (rect.top - App.ed.getBoundingClientRect().top) / App.state.zoom;
    cur = App.clamp(Math.floor(top / (App.geom().H + App.GAP)) + 1, 1, n);
  }
  App.pages.current = cur;
  $('#sb-page').textContent = App.state.view === 'web' ? 'Webweergave' : `Pagina ${cur} van ${n}`;
};
App.on('selection', () => App.updatePageStatus());

/* ---------- Kop- en voettekst bewerken ---------- */
App.editHF = (el) => {
  if (App.state.protect) { App.toast('Het document is beveiligd', 'lock'); return; }
  if (App.state.hfEditing && App.state.hfEditing.el === el) return;
  if (App.state.hfEditing) App.closeHF(true);
  const m = App.doc.meta;
  const kind = el.dataset.kind, first = el.dataset.first === '1';
  const key = kind + (first ? 'First' : '');
  App.state.hfEditing = { el, kind, first, key };
  document.body.classList.add('hf-editing');
  el.classList.add('editing');
  el.innerHTML = m[key] || '<p><br></p>';
  const page = +el.closest('.sheet').dataset.page;
  App.fillFields(el, page + 1, App.pages.count);
  el.querySelectorAll('.fld').forEach((f) => f.setAttribute('contenteditable', 'false'));
  el.contentEditable = 'true';
  el.style.maxHeight = 'none';
  el.focus();
  App.caretAtEnd(el.lastElementChild || el);
  $('#chk-firstdiff').checked = !!m.firstDiff;
  App.setContext({ ...App.context, hf: true });
};
App.closeHF = (silent) => {
  const st = App.state.hfEditing;
  if (!st) return;
  const el = st.el;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.fld').forEach((f) => { f.textContent = ''; });
  let html = clone.innerHTML.trim();
  if (html === '<p><br></p>' || html === '<br>' || !clone.textContent.trim() && !clone.querySelector('.fld,img')) html = '';
  App.doc.meta[st.key] = html;
  el.contentEditable = 'false';
  el.classList.remove('editing');
  document.body.classList.remove('hf-editing');
  App.state.hfEditing = null;
  App._forceSheets = true;
  App.setContext({ ...App.context, hf: false });
  App.changed({ immediate: true });
  if (!silent) App.ed.focus({ preventScroll: true });
};
$('#sheets').addEventListener('dblclick', (e) => {
  const hf = e.target.closest('.hf');
  if (hf) { e.preventDefault(); App.editHF(hf); }
});
$('#sheets').addEventListener('input', (e) => { if (e.target.closest('.hf.editing')) App.markDirty(); });
App.ed.addEventListener('mousedown', () => { if (App.state.hfEditing) App.closeHF(true); });
App.sheetForCaret = () => {
  const i = (App.pages.current || 1) - 1;
  return $('#sheets').children[i] || $('#sheets').firstElementChild;
};
App.def('editHeader', () => { if (App.state.view !== 'print') App.exec('viewPrint'); const s = App.sheetForCaret(); if (s) App.editHF(s.querySelector('.hf.header')); });
App.def('editFooter', () => { if (App.state.view !== 'print') App.exec('viewPrint'); const s = App.sheetForCaret(); if (s) App.editHF(s.querySelector('.hf.footer')); });
App.def('gotoHeader', () => { const st = App.state.hfEditing; if (st) App.editHF(st.el.closest('.sheet').querySelector('.hf.header')); });
App.def('gotoFooter', () => { const st = App.state.hfEditing; if (st) App.editHF(st.el.closest('.sheet').querySelector('.hf.footer')); });
App.def('closeHF', () => App.closeHF());
App.def('hfField', (fld) => {
  if (!App.state.hfEditing) App.exec('editFooter');
  App.restoreRange();
  App.insertHTML(`<span class="fld" data-fld="${fld}" contenteditable="false">${App.esc(App.hfFieldText(fld, App.pages.current || 1, App.pages.count))}</span>&nbsp;`);
  App.markDirty();
});
App.def('toggleFirstDiff', (on) => {
  const st = App.state.hfEditing;
  App.doc.meta.firstDiff = !!on;
  if (st) {
    const kind = st.kind;
    App.closeHF(true);
    App.renderSheets(App.pages.count);
    const s = $('#sheets').firstElementChild;
    App.editHF(s.querySelector('.hf.' + kind));
  } else App.changed({ immediate: true });
});
App.def('pageNumber', (pos) => {
  const m = App.doc.meta;
  if (App.state.hfEditing && pos !== 'remove') { App.exec('hfField', 'page'); return; }
  const fld = (f) => `<span class="fld" data-fld="${f}" contenteditable="false"></span>`;
  if (pos === 'remove') {
    ['header', 'footer', 'headerFirst', 'footerFirst'].forEach((k) => {
      const d = document.createElement('div'); d.innerHTML = m[k] || '';
      const had = d.querySelector('.fld[data-fld="page"]');
      d.querySelectorAll('.fld[data-fld="page"], .fld[data-fld="pages"]').forEach((f) => f.remove());
      if (had) d.querySelectorAll('p').forEach((p) => { if (/^\s*(Pagina\s*(van)?)?\s*$/.test(p.textContent) && !p.querySelector('.fld,img')) p.remove(); });
      m[k] = d.textContent.trim() || d.querySelector('img,.fld') ? d.innerHTML : '';
    });
  } else {
    const [where, align] = pos.split('-');
    const content = align === 'of' ? `Pagina ${fld('page')} van ${fld('pages')}` : fld('page');
    const a = align === 'of' ? 'center' : align;
    m[where] = `<p style="text-align:${a}">${content}</p>`;
    if (m.firstDiff) m[where + 'First'] = m[where + 'First'] || '';
  }
  App._forceSheets = true;
  App.changed({ immediate: true });
  App.toast(pos === 'remove' ? 'Paginanummers verwijderd' : 'Paginanummers toegevoegd', 'ok');
});

/* ---------- Liniaal ---------- */
App.drawRuler = () => {
  const cv = $('#ruler');
  if (!cv || !document.body.classList.contains('ruler-on') || App.state.view === 'web') return;
  const g = App.geom(), z = App.state.zoom;
  const W = g.W * z, H = 22, dpr = devicePixelRatio || 1;
  const wrap = $('#ruler-wrap'), sizer = $('#zoom-sizer');
  cv.style.marginLeft = (sizer.getBoundingClientRect().left - wrap.getBoundingClientRect().left) + 'px';
  cv.style.width = W + 'px'; cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const col = App.rulerColors();
  c.fillStyle = col.margin; c.fillRect(0, 3, W, H - 6);
  c.fillStyle = col.body; c.fillRect(g.ml * z, 3, (g.W - g.ml - g.mr) * z, H - 6);
  c.fillStyle = col.text;
  c.font = '9px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const cmPx = (App.settings.unit === 'inch' ? 96 : App.CM) * z;
  const start = g.ml * z;
  for (let k = -Math.floor(start / (cmPx / 4)); start + k * cmPx / 4 <= W; k++) {
    const x = start + k * cmPx / 4;
    if (x < 0) continue;
    if (k % 4 === 0) { if (k !== 0) c.fillText(String(Math.abs(k / 4)), x, H / 2); }
    else if (k % 2 === 0) c.fillRect(x - 0.5, H / 2 - 3, 1, 6);
    else c.fillRect(x - 0.5, H / 2 - 1.5, 1, 3);
  }
  // inspringmarkering van huidige alinea
  const r = App.getRange() || App.lastRange;
  const b = r && App.inEditor(r.startContainer) && App.blockOf(r.startContainer);
  if (App.drawRulerExtras) App.drawRulerExtras(c, { g, z, H, W, col, block: b });   // inspringmarkeringen en tabstops (layout-extra.js)
  else if (b) {
    const bl = (b.getBoundingClientRect().left - App.ed.getBoundingClientRect().left) / z;
    const br = (App.ed.getBoundingClientRect().right - b.getBoundingClientRect().right) / z;
    const ti = parseFloat(getComputedStyle(b).textIndent) || 0;
    c.fillStyle = col.marker;
    const tri = (x, up) => { c.beginPath(); if (up) { c.moveTo(x - 4, H - 1); c.lineTo(x + 4, H - 1); c.lineTo(x, H - 7); } else { c.moveTo(x - 4, 1); c.lineTo(x + 4, 1); c.lineTo(x, 7); } c.fill(); };
    tri((bl + ti) * z, false); tri(bl * z, true); tri((g.W - br) * z, true);
  }
  App.drawVRuler();
};
App.rulerColors = () => (document.body.classList.contains('dark')
  ? { margin: '#333333', body: '#4a4a4a', text: '#c8c8c8', marker: '#b0b0b0' }
  : { margin: '#e1e1e1', body: '#ffffff', text: '#444444', marker: '#7a7a7a' });
/* Verticale liniaal: toont de pagina die midden in beeld staat, met boven- en ondermarge */
App.vrulerPage = () => {
  const sc = $('#canvas-scroll'), sheets = $('#sheets');
  if (!sc || !sheets || !sheets.children.length) return null;
  const s = sc.getBoundingClientRect(), mid = s.top + s.height / 2;
  let best = sheets.children[0];
  for (const sh of sheets.children) { const r = sh.getBoundingClientRect(); best = sh; if (r.bottom >= mid) break; }
  return best;
};
App.drawVRuler = () => {
  const cv = $('#vruler'), wrap = $('#vruler-wrap');
  if (!cv || !wrap || !document.body.classList.contains('ruler-on') || App.state.view !== 'print' || !wrap.offsetWidth) return;
  const g = App.geom(), z = App.state.zoom, dpr = devicePixelRatio || 1;
  const Wd = wrap.clientWidth || 22, Hd = wrap.clientHeight;
  cv.style.width = Wd + 'px'; cv.style.height = Hd + 'px'; cv.style.top = '0px';
  cv.width = Wd * dpr; cv.height = Hd * dpr;
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const sheet = App.vrulerPage();
  if (!sheet) return;
  const wr = wrap.getBoundingClientRect(), sr = sheet.getBoundingClientRect(), scr = $('#canvas-scroll').getBoundingClientRect();
  const clipTop = Math.max(0, scr.top - wr.top);
  c.save(); c.beginPath(); c.rect(0, clipTop, Wd, Hd - clipTop); c.clip();
  const y0 = sr.top - wr.top, PH = g.H * z;
  const col = App.rulerColors();
  const x0 = 3, bw = Wd - 6;
  c.fillStyle = col.margin; c.fillRect(x0, y0, bw, PH);
  c.fillStyle = col.body; c.fillRect(x0, y0 + g.mt * z, bw, (g.H - g.mt - g.mb) * z);
  c.fillStyle = col.text; c.font = '9px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const q = (App.settings.unit === 'inch' ? 96 : App.CM) * z / 4, start = y0 + g.mt * z, cx = Wd / 2;
  for (let k = -Math.floor(g.mt * z / q); start + k * q <= y0 + PH; k++) {
    const y = start + k * q;
    if (y < y0) continue;
    if (k % 4 === 0) { if (k !== 0) c.fillText(String(Math.abs(k / 4)), cx, y); }
    else if (k % 2 === 0) c.fillRect(cx - 3, y - 0.5, 6, 1);
    else c.fillRect(cx - 1.5, y - 0.5, 3, 1);
  }
  c.restore();
  App._vr = { y0, z };
};
(() => {
  const sc = $('#canvas-scroll');
  let raf = 0;
  if (sc) sc.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; App.drawVRuler(); }); }, { passive: true });
  const cv = $('#vruler');
  if (!cv) return;
  // Boven-/ondermarge verslepen op de verticale liniaal (zoals in Word)
  let drag = null;
  const hit = (y) => {
    const v = App._vr; if (!v) return null;
    const g = App.geom();
    if (Math.abs(y - (v.y0 + g.mt * v.z)) < 5) return 't';
    if (Math.abs(y - (v.y0 + (g.H - g.mb) * v.z)) < 5) return 'b';
    return null;
  };
  cv.addEventListener('mousemove', (e) => { if (!drag) { const h = hit(e.offsetY); cv.style.cursor = h ? 'ns-resize' : 'default'; cv.title = h ? 'Sleep om de marge aan te passen' : ''; } });
  cv.addEventListener('mousedown', (e) => {
    const h = hit(e.offsetY);
    if (!h) return;
    e.preventDefault();
    App.history.flush();
    drag = { side: h, y0: e.clientY, m0: App.doc.meta.page.margins[h] };
    const move = (ev) => {
      const dcm = App.px2cm((ev.clientY - drag.y0) / App.state.zoom) * (drag.side === 't' ? 1 : -1);
      App.doc.meta.page.margins[drag.side] = Math.round(App.clamp(drag.m0 + dcm, 0, 10) * 20) / 20;
      App.layout();
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); drag = null; App.changed({ immediate: true }); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
})();
App.on('selection', App.debounce(() => App.drawRuler(), 60));
(() => {
  const cv = $('#ruler');
  let drag = null;
  const hit = (x) => {
    const g = App.geom(), z = App.state.zoom;
    if (Math.abs(x - g.ml * z) < 5) return 'l';
    if (Math.abs(x - (g.W - g.mr) * z) < 5) return 'r';
    return null;
  };
  cv.addEventListener('mousemove', (e) => { if (!drag) cv.style.cursor = hit(e.offsetX) ? 'ew-resize' : 'default'; cv.title = hit(e.offsetX) ? 'Sleep om de marge aan te passen' : ''; });
  cv.addEventListener('mousedown', (e) => {
    const h = hit(e.offsetX);
    if (!h) return;
    e.preventDefault();
    App.history.flush();
    drag = { side: h, x0: e.clientX, m0: App.doc.meta.page.margins[h] };
    const move = (ev) => {
      const dcm = App.px2cm((ev.clientX - drag.x0) / App.state.zoom) * (drag.side === 'l' ? 1 : -1);
      App.doc.meta.page.margins[drag.side] = Math.round(App.clamp(drag.m0 + dcm, 0, 10) * 20) / 20;
      App.layout();
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); drag = null; App.changed({ immediate: true }); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
})();

/* ---------- Zoom ---------- */
App.setZoom = (z) => {
  z = App.clamp(Math.round(z * 100) / 100, 0.25, 3);
  const sc = $('#canvas-scroll');
  const ratio = sc.scrollTop / Math.max(1, sc.scrollHeight);
  App.state.zoom = z;
  $('#pages').style.transform = `scale(${z})`;
  $('#zoom-range').value = Math.round(z * 100);
  $('#zoom-label').textContent = Math.round(z * 100) + '%';
  App.layout();
  $('#comment-pane').style.left = `calc(100% + 16px)`;
  sc.scrollTop = ratio * sc.scrollHeight;
};
App.def('zoomSet', (v) => App.setZoom(v / 100));
App.def('zoomIn', () => App.setZoom(App.state.zoom + 0.1));
App.def('zoomOut', () => App.setZoom(App.state.zoom - 0.1));
App.def('zoom100', () => App.setZoom(1));
App.commentPaneWidth = () => (getComputedStyle($('#comment-pane')).display !== 'none' ? 276 : 0);
App.def('zoomWidth', () => { const sc = $('#canvas-scroll'); const extra = App.commentPaneWidth(); App.setZoom((sc.clientWidth - 52 - extra) / App.geom().W); });
App.def('zoomPage', () => { const sc = $('#canvas-scroll'); App.setZoom(Math.min((sc.clientHeight - 60) / App.geom().H, (sc.clientWidth - 60) / App.geom().W)); });
App.def('zoomMulti', () => App.setZoom(0.5));
App.def('zoomDialog', () => {
  App.dialog({
    title: 'In-/uitzoomen',
    body: `<div class="seg" id="zd-seg">${[200, 150, 125, 100, 75, 50].map((v) => `<button data-z="${v}" class="${Math.round(App.state.zoom * 100) === v ? 'on' : ''}">${v}%</button>`).join('')}</div>
      <label class="field"><span>Percentage</span><input id="zd-v" type="number" min="25" max="300" value="${Math.round(App.state.zoom * 100)}"></label>`,
    onOpen: (d) => d.$('#zd-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (b) d.$('#zd-v').value = b.dataset.z; }),
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.setZoom((+d.$('#zd-v').value || 100) / 100) }],
  });
});
$('#canvas-scroll').addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  App.setZoom(App.state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
}, { passive: false });
$('#canvas-scroll').addEventListener('scroll', () => App.minibar.hide());

/* ---------- Weergaven ---------- */
App.setView = (v) => {
  const b = document.body;
  b.classList.remove('view-web', 'view-read', 'view-focus', 'sepia');
  if (v !== 'print') b.classList.add('view-' + v);
  $('#read-bar').hidden = v !== 'read';
  App.state.view = v;
  App.ed.contentEditable = (v === 'read' || App.state.protect) ? 'false' : 'true';
  if (v === 'read' && App.state.zoom < 1) App.setZoom(1);
  App.layout();
  App.scheduleState();
};
App.def('viewPrint', () => { App.setView('print'); App.ed.focus({ preventScroll: true }); });
App.def('viewWeb', () => App.setView('web'));
App.def('viewRead', () => App.setView('read'));
App.def('viewFocus', () => { App.setView('focus'); App.toast('Focusmodus — druk op Esc om terug te gaan', 'center_focus_strong'); });
App.def('readFontUp', () => App.setZoom(App.state.zoom + 0.1));
App.def('readFontDown', () => App.setZoom(App.state.zoom - 0.1));
App.def('readSepia', () => document.body.classList.toggle('sepia'));
App.stateFns.viewPrint = () => App.state.view === 'print';
App.stateFns.viewWeb = () => App.state.view === 'web';
App.def('toggleRuler', (on) => {
  App.settings.ruler = on === undefined ? !App.settings.ruler : !!on;
  document.body.classList.toggle('ruler-on', App.settings.ruler);
  $('#chk-ruler').checked = App.settings.ruler;
  App.saveSettings(); App.drawRuler();
});
App.def('toggleGrid', (on) => { App.state.grid = !!on; App.layout(); });
App.def('toggleNav', (on) => {
  App.settings.nav = on === undefined ? !App.settings.nav : !!on;
  $('#navpane').hidden = !App.settings.nav;
  $('#chk-nav').checked = App.settings.nav;
  App.saveSettings();
  App.renderNav();
  App.layout();
});

/* ---------- Navigatievenster ---------- */
App.navTab = 'headings';
App.renderNav = () => {
  if ($('#navpane').hidden) return;
  const body = $('#nav-body');
  $$('.nav-tab').forEach((t) => t.classList.toggle('active', t.dataset.navtab === App.navTab));
  if (App.navTab === 'headings') {
    const hs = $$('h1,h2,h3,h4', App.ed).filter((h) => !h.closest('.toc') && h.textContent.trim());
    if (!hs.length) { body.innerHTML = `<div class="nav-empty">Maak een overzicht van je document door de stijlen <b>Kop 1</b>, <b>Kop 2</b> en <b>Kop 3</b> te gebruiken. De koppen verschijnen dan hier.</div>`; return; }
    const curB = App.selClosest('h1,h2,h3,h4');
    body.innerHTML = hs.map((h, i) => `<button class="nav-item l${h.tagName[1]} ${h === curB ? 'current' : ''}" data-i="${i}" title="${App.esc(h.textContent)}">${App.esc(h.textContent)}</button>`).join('');
    body.onclick = (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const h = hs[+b.dataset.i];
      App.scrollToEl(h);
      App.ed.focus({ preventScroll: true }); App.caretAtEnd(h);
    };
  } else if (App.navTab === 'pages') {
    const n = App.pages.count;
    body.innerHTML = `<div class="nav-pages">${Array.from({ length: n }, (_, i) => `<div class="nav-page ${App.pages.current === i + 1 ? 'current' : ''}" data-p="${i}"><div class="lines"></div>${i + 1}</div>`).join('')}</div>`;
    body.onclick = (e) => {
      const p = e.target.closest('[data-p]'); if (!p) return;
      App.scrollToPage(+p.dataset.p);
    };
  } else {
    const q = $('#nav-search').value;
    const ms = App.find.run(q);
    App.find.cur = -1; App.find.paint();
    if (!q) { body.innerHTML = `<div class="nav-empty">Typ hierboven om in het document te zoeken.</div>`; return; }
    if (!ms.length) { body.innerHTML = `<div class="nav-empty">Geen resultaten voor “${App.esc(q)}”.</div>`; return; }
    body.innerHTML = `<div class="nav-empty" style="padding:4px 8px 8px">${ms.length} resultaten</div>` + ms.slice(0, 200).map((r, i) => {
      const t = r.startContainer.data || '';
      const s = r.startOffset;
      const pre = t.slice(Math.max(0, s - 30), s), hit = r.toString(), post = (r.endContainer.data || '').slice(r.endOffset, r.endOffset + 40);
      return `<button class="nav-result" data-i="${i}">${s > 30 ? '…' : ''}${App.esc(pre)}<mark>${App.esc(hit)}</mark>${App.esc(post)}…</button>`;
    }).join('');
    body.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) App.find.go(+b.dataset.i); };
  }
};
$$('.nav-tab').forEach((t) => t.addEventListener('click', () => { App.navTab = t.dataset.navtab; App.renderNav(); }));
$('#nav-search').addEventListener('input', () => { App.navTab = 'results'; App.renderNav(); });
App.on('change', App.debounce(() => App.renderNav(), 400));
App.on('selection', App.debounce(() => { if (App.navTab !== 'results') App.renderNav(); }, 300));
App.scrollToEl = (el) => {
  const sc = $('#canvas-scroll');
  const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
  sc.scrollTo({ top: sc.scrollTop + r.top - s.top - 60, behavior: 'smooth' });
};
App.scrollToPage = (i) => {
  const sc = $('#canvas-scroll');
  const top = i * (App.geom().H + App.GAP) * App.state.zoom;
  sc.scrollTo({ top: top + $('#zoom-sizer').offsetTop - 12, behavior: 'smooth' });
};
App.def('gotoDialog', async () => {
  const v = await App.prompt('Ga naar', 'Paginanummer', App.pages.current || 1, { hint: `Het document heeft ${App.pages.count} pagina('s).` });
  if (v == null) return;
  App.scrollToPage(App.clamp(parseInt(v, 10) || 1, 1, App.pages.count) - 1);
});

/* ---------- Woorden tellen in statusbalk ---------- */
App.countText = (t) => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-.@]*/gu) || []).length;
App.updateWords = App.debounce(() => {
  App.stats = { words: App.countText(App.ed.innerText) };
  App.showWordStatus();
}, 300);
App.showWordStatus = () => {
  const r = App.getRange();
  const total = App.stats ? App.stats.words : 0;
  if (r && !r.collapsed) {
    const sel = App.countText(r.toString());
    $('#sb-words').textContent = `${sel} van ${total} woorden`;
  } else $('#sb-words').textContent = `${total} ${total === 1 ? 'woord' : 'woorden'}`;
};
App.on('change', () => App.updateWords());
App.on('selection', () => App.showWordStatus());

/* ---------- Pagina-instelling ---------- */
App.defEdit('margins', (arg) => {
  const [t, r, b, l] = arg.split(',').map(Number);
  App.doc.meta.page.margins = { t, r, b, l };
}, { allowProtected: false });
App.defEdit('orientation', (o) => { App.doc.meta.page.orient = o; });
App.defEdit('pageSize', (s) => { App.doc.meta.page.size = s; });
App.def('pageSetup', () => {
  const p = App.doc.meta.page;
  App.dialog({
    title: 'Pagina-instelling', wide: true,
    body: `
      <div class="field"><span>Marges (cm)</span></div>
      <div class="fields-4">
        <label class="field"><span>Boven</span><input id="ps-t" type="number" step="0.1" min="0" value="${p.margins.t}"></label>
        <label class="field"><span>Onder</span><input id="ps-b" type="number" step="0.1" min="0" value="${p.margins.b}"></label>
        <label class="field"><span>Links</span><input id="ps-l" type="number" step="0.1" min="0" value="${p.margins.l}"></label>
        <label class="field"><span>Rechts</span><input id="ps-r" type="number" step="0.1" min="0" value="${p.margins.r}"></label>
      </div>
      <div class="fields-2">
        <label class="field"><span>Afdrukstand</span><select id="ps-o"><option value="portrait" ${p.orient === 'portrait' ? 'selected' : ''}>Staand</option><option value="landscape" ${p.orient === 'landscape' ? 'selected' : ''}>Liggend</option></select></label>
        <label class="field"><span>Papierformaat</span><select id="ps-s">${Object.keys(App.PAGE_SIZES).map((k) => `<option ${k === p.size ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      </div>
      <p class="muted small">Tip: je kunt de linker- en rechtermarge ook verslepen op de liniaal.</p>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (d) => App.run(() => {
        const g = (id) => Math.max(0, App.parseNum(d.$(id).value) || 0);
        p.margins = { t: g('#ps-t'), b: g('#ps-b'), l: g('#ps-l'), r: g('#ps-r') };
        p.orient = d.$('#ps-o').value; p.size = d.$('#ps-s').value;
      }),
    }],
  });
});
App.defEdit('columns', (n) => {
  const r = App.getRange() || App.lastRange;
  const curCols = r && App.closest(r.startContainer, '.cols', App.ed);
  if (n === '1') {
    if (curCols) App.unwrap(curCols);
    else App.toast('Er staan hier geen kolommen', 'info');
    return;
  }
  const cls = { 2: 'c2', 3: 'c3', left: 'cl', right: 'cr' }[n];
  if (curCols) { curCols.className = 'cols ' + cls; return; }
  if (!r || r.collapsed) { App.toast('Selecteer eerst de alinea\'s die in kolommen moeten komen', 'view_column'); return; }
  const tops = [];
  App.getSelectedBlocks().forEach((b) => {
    let t = b; while (t.parentNode !== App.ed) t = t.parentNode;
    if (!tops.includes(t)) tops.push(t);
  });
  if (!tops.length) return;
  const marks = App.markSel();
  const wrap = document.createElement('div');
  wrap.className = 'cols ' + cls;
  tops[0].before(wrap);
  tops.forEach((t) => wrap.appendChild(t));
  App.restoreMarks(marks);
});
App.topBlock = (node) => {
  let n = node.nodeType === 3 ? node.parentNode : node;
  if (n === App.ed) return null;
  while (n && n.parentNode !== App.ed) n = n.parentNode;
  return n;
};
App.insertBlockAtCaret = (el, opts = {}) => {
  // Voegt een blokelement in op de cursorpositie (splitst de alinea indien nodig)
  const r = App.restoreRange();
  if (!r.collapsed) r.collapse(false);   // nooit geselecteerde tekst wissen; invoegen achter de selectie
  let top = App.topBlock(r.startContainer);
  if (!top) { App.ed.appendChild(el); }
  else if (/^(TABLE|DIV|UL|OL)$/.test(top.tagName) && !top.classList.contains('page-break') && top.tagName !== 'P') {
    top.after(el);
  } else {
    const b = App.blockOf(r.startContainer) || top;
    const pos = App.textOffset(r.startContainer, r.startOffset, b);
    const len = b.textContent.length;
    if (len === 0 && top === b && opts.replaceEmpty !== false && !opts.keepEmpty) { top.after(el); if (!opts.keepEmpty) top.remove(); }
    else if (pos === 0 && len > 0) top.before(el);
    else if (pos >= len) top.after(el);
    else {
      App.ex('insertParagraph');
      const r2 = App.getRange();
      const t2 = App.topBlock(r2.startContainer);
      t2.before(el);
    }
  }
  let next = el.nextElementSibling;
  if (!next || next.classList.contains('footnotes') || next.classList.contains('page-break')) {
    next = document.createElement('p'); next.innerHTML = '<br>'; el.after(next);
  }
  if (opts.caretIn) App.caretAtEnd(opts.caretIn); else App.placeCaret(next, 0);
  return el;
};
App.defEdit('pageBreak', () => {
  const pb = document.createElement('div');
  pb.className = 'page-break'; pb.contentEditable = 'false';
  // Word: aan het eind van een alinea komt de cursor in een nieuwe, lege alinea op de volgende pagina
  const r = App.restoreRange();
  const b = r.collapsed && App.blockOf(r.startContainer);
  const atEnd = b && b.parentNode === App.ed && b.textContent.length && App.textOffset(r.startContainer, r.startOffset, b) >= b.textContent.length;
  App.insertBlockAtCaret(pb, { keepEmpty: true });
  if (atEnd && pb.nextElementSibling && pb.nextElementSibling.textContent.length) {
    const p = document.createElement('p'); p.innerHTML = '<br>';
    pb.after(p); App.placeCaret(p, 0);
  }
});
// Backspace direct na / Delete direct vóór een pagina- of kolomeinde verwijdert dat einde (zoals in Word)
App.ed.addEventListener('keydown', (e) => {
  if ((e.key !== 'Backspace' && e.key !== 'Delete') || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || App.state.protect || App.state.track || e.defaultPrevented) return;
  const r = App.getRange();
  if (!r || !r.collapsed) return;
  const b = App.blockOf(r.startContainer);
  if (!b || b.parentNode !== App.ed) return;
  const off = App.textOffset(r.startContainer, r.startOffset, b), len = b.textContent.length;
  const sib = e.key === 'Backspace' ? (off === 0 ? b.previousElementSibling : null) : (off >= len ? b.nextElementSibling : null);
  if (!sib || !sib.matches('.page-break, .col-break')) return;
  e.preventDefault();
  App.run(() => { sib.remove(); App.setSelOffsets({ s: off, e: off, root: b }); });
});
App.defEdit('blankPage', () => {
  const r = App.restoreRange();
  const mk = () => { const pb = document.createElement('div'); pb.className = 'page-break'; pb.contentEditable = 'false'; return pb; };
  const pb1 = mk();
  App.insertBlockAtCaret(pb1, { keepEmpty: true });
  const p = document.createElement('p'); p.innerHTML = '<br>';
  pb1.after(p);
  const pb2 = mk();
  p.after(pb2);
  App.placeCaret(p, 0);
  void r;
});
App.defEdit('columnBreak', () => {
  const cb = document.createElement('div'); cb.className = 'col-break';
  App.insertBlockAtCaret(cb, { keepEmpty: true });
});
App.defEdit('lineBreak', () => App.ex('insertLineBreak'));
App.def('toggleHyphen', () => {
  App.doc.meta.hyphen = !App.doc.meta.hyphen;
  App.applyDocLook();
  App.changed({ immediate: true });
});
App.stateFns.hyphen = () => App.doc.meta.hyphen;

/* ---------- Ontwerp: thema's ---------- */
App.THEMES = {
  inkt: { name: 'Standaard', body: 'Aptos', head: 'Aptos Display', color: '#0f4761', accent: '#156082', accent2: '#e97132' },
  klassiek: { name: 'Klassiek', body: 'Georgia', head: 'Georgia', color: '#3d2b1f', accent: '#8a4b2a', accent2: '#c08552' },
  modern: { name: 'Modern', body: 'Inter', head: 'Montserrat', color: '#0f4e49', accent: '#0f766e', accent2: '#14b8a6' },
  elegant: { name: 'Elegant', body: 'Lora', head: 'Playfair Display', color: '#4a1d6e', accent: '#7e3fb0', accent2: '#d6a2e8' },
  zakelijk: { name: 'Zakelijk', body: 'Arial', head: 'Arial', color: '#1d3f8a', accent: '#1d4ed8', accent2: '#60a5fa' },
  warm: { name: 'Warm', body: 'Nunito', head: 'Poppins', color: '#9a3412', accent: '#ea580c', accent2: '#fbbf24' },
  minimaal: { name: 'Minimaal', body: 'Source Serif 4', head: 'Inter', color: '#111111', accent: '#444444', accent2: '#999999' },
  natuur: { name: 'Natuur', body: 'Open Sans', head: 'Merriweather', color: '#245c2c', accent: '#2f9e44', accent2: '#94d82d' },
};
App.FONT_PAIRS = [['Aptos', 'Aptos Display'], ['Calibri', 'Calibri'], ['Georgia', 'Georgia'], ['Inter', 'Montserrat'], ['Lora', 'Playfair Display'], ['Arial', 'Arial'], ['Nunito', 'Poppins'], ['Source Serif 4', 'Inter'], ['Open Sans', 'Merriweather'], ['Roboto', 'Roboto'], ['Lato', 'Raleway'], ['Times New Roman', 'Times New Roman'], ['Cambria', 'Cambria']];
App.COLOR_SETS = [
  ['Standaard', '#0f4761', '#156082', '#e97132'], ['Oceaan', '#0b4f6c', '#0582ca', '#00a6fb'], ['Bos', '#245c2c', '#2f9e44', '#94d82d'],
  ['Zonsondergang', '#9a3412', '#ea580c', '#fbbf24'], ['Bes', '#7a1f4b', '#c2255c', '#f06595'], ['Leisteen', '#1f2937', '#475569', '#94a3b8'],
  ['Koninklijk', '#3b0764', '#7e22ce', '#c084fc'], ['Aarde', '#5c4033', '#a0522d', '#d2a679'], ['Monochroom', '#111111', '#444444', '#999999'],
];
App.SPACING = { none: [1.0, 0], compact: [1.0, 4], normal: [1.15, 8], open: [1.5, 10], double: [2.0, 12] };
App.applyDocLook = () => {
  const m = App.doc.meta;
  const th = App.THEMES[m.theme] || App.THEMES.inkt;
  const fonts = m.themeFonts || { body: th.body, head: th.head };
  const cols = m.themeColors || { head: th.color, accent: th.accent, accent2: th.accent2 };
  const sp = App.SPACING[m.spacing] || App.SPACING.normal;
  const s = App.ed.style;
  s.setProperty('--doc-font', App.fontStack(fonts.body));
  s.setProperty('--doc-head-font', App.fontStack(fonts.head));
  s.setProperty('--doc-head-color', cols.head);
  s.setProperty('--doc-accent', cols.accent);
  s.setProperty('--doc-accent-2', cols.accent2 || cols.accent);
  s.setProperty('--doc-line', sp[0]);
  s.setProperty('--doc-after', sp[1] + 'pt');
  App.ed.classList.toggle('hyphen', !!m.hyphen);
  App.ed.lang = m.lang || 'nl-NL';
  App.ed.style.backgroundColor = App.state.view === 'web' && m.pageColor ? m.pageColor : '';
  $$('#theme-gallery .theme-chip').forEach((c) => c.classList.toggle('on', c.dataset.arg === m.theme && !m.themeFonts && !m.themeColors));
  App._forceSheets = true;
};
(() => {
  $('#theme-gallery').innerHTML = Object.entries(App.THEMES).map(([id, t]) => `
    <button class="theme-chip" data-cmd="theme" data-arg="${id}" title="Thema ${t.name}">
      <span class="th-h" style="font-family:${App.fontStack(t.head).replace(/"/g, "'")};color:${t.color}">Aa</span>
      <span class="th-b" style="font-family:${App.fontStack(t.body).replace(/"/g, "'")}">${t.head}</span>
      <span class="th-sw"><i style="background:${t.color}"></i><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i></span>
      <span class="th-n">${t.name}</span>
    </button>`).join('');
})();
App.menuBuilders['m-fonts'] = () => '<div class="menu-title">Lettertypen (kop / tekst)</div>' + App.FONT_PAIRS.map(([b, h]) => `<button data-cmd="themeFonts" data-arg="${b}|${h}"><span style="font-family:${App.fontStack(h).replace(/"/g, "'")};font-size:15px;width:26px">Aa</span><span><b style="font-family:${App.fontStack(h).replace(/"/g, "'")}">${h}</b><small style="font-family:${App.fontStack(b).replace(/"/g, "'")}">${b}</small></span></button>`).join('');
App.menuBuilders['m-colors'] = () => '<div class="menu-title">Themakleuren</div>' + App.COLOR_SETS.map(([n, a, b, c]) => `<button data-cmd="themeColors" data-arg="${a}|${b}|${c}"><span style="display:flex;gap:2px"><i style="width:14px;height:14px;border-radius:3px;background:${a}"></i><i style="width:14px;height:14px;border-radius:3px;background:${b}"></i><i style="width:14px;height:14px;border-radius:3px;background:${c}"></i></span>${n}</button>`).join('');
App.defEdit('theme', (id) => { const m = App.doc.meta; m.theme = id; m.themeFonts = null; m.themeColors = null; App.applyDocLook(); });
App.defEdit('themeFonts', (arg) => { const [body, head] = arg.split('|'); App.doc.meta.themeFonts = { body, head }; App.applyDocLook(); });
App.defEdit('themeColors', (arg) => { const [head, accent, accent2] = arg.split('|'); App.doc.meta.themeColors = { head, accent, accent2 }; App.applyDocLook(); });
App.defEdit('docSpacing', (v) => { App.doc.meta.spacing = v; App.applyDocLook(); });
App.defEdit('watermark', (t) => { App.doc.meta.watermark = t; });
App.def('watermarkCustom', async () => {
  const t = await App.prompt('Aangepast watermerk', 'Tekst', App.doc.meta.watermark || 'CONCEPT');
  if (t != null) App.exec('watermark', t.toUpperCase());
});
App.defEdit('pageColor', (c) => { App.doc.meta.pageColor = c; App.applyDocLook(); });
App.defEdit('pageBorder', (v) => { App.doc.meta.pageBorder = v; });

/* ---------- Afdrukken (paginakop/voet via @page) ---------- */
App.cssStr = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ') + '"';
App.hfToMarginBoxes = (html) => {
  // Zet kop/voettekst-HTML om naar CSS-content per uitlijning
  const d = document.createElement('div'); d.innerHTML = html || '';
  const out = { left: [], center: [], right: [] };
  const blocks = d.querySelectorAll('p,div,h1,h2,h3').length ? Array.from(d.querySelectorAll('p,div,h1,h2,h3')) : [d];
  blocks.forEach((b) => {
    const a = (b.style.textAlign || 'left').replace('justify', 'left').replace('start', 'left');
    const parts = [];
    const walk = (n) => {
      n.childNodes.forEach((c) => {
        if (c.nodeType === 3) parts.push(App.cssStr(c.data));
        else if (c.classList && c.classList.contains('fld')) {
          const f = c.dataset.fld;
          if (f === 'page') parts.push('counter(page)');
          else if (f === 'pages') parts.push('counter(pages)');
          else parts.push(App.cssStr(App.hfFieldText(f, 1, 1)));
        } else if (c.tagName === 'BR') parts.push('"\\A "');
        else walk(c);
      });
    };
    walk(b);
    if (parts.length) out[a in out ? a : 'left'].push(parts.join(' '));
  });
  return out;
};
App.preparePrint = () => {
  if (App.state.hfEditing) App.closeHF(true);
  if (App.buildToc) { $$('.toc', App.ed).forEach(App.buildToc); $$('.tof', App.ed).forEach(App.buildTof); }
  App.clearPushes();
  const m = App.doc.meta, g = App.geom(), p = m.page;
  const font = getComputedStyle(App.ed).getPropertyValue('--doc-font');
  const boxes = (html, where, all) => {
    const b = App.hfToMarginBoxes(html);
    return ['left', 'center', 'right'].map((a) => (b[a].length
      ? `@${where}-${a} { content: ${b[a].join(' "\\A " ')}; font: 9.5pt ${font}; color: #555; white-space: pre; vertical-align: ${where === 'top' ? 'bottom' : 'top'}; }`
      : all ? `@${where}-${a} { content: none; }` : '')).join('\n');
  };
  let css = `@page { size: ${g.wmm}mm ${g.hmm}mm; margin: ${p.margins.t}cm ${p.margins.r}cm ${p.margins.b}cm ${p.margins.l}cm; ${boxes(m.header, 'top')} ${boxes(m.footer, 'bottom')} }`;
  if (m.firstDiff) css += `@page :first { ${boxes(m.headerFirst, 'top', true)} ${boxes(m.footerFirst, 'bottom', true)} }`;
  if (m.pageColor) css += `html { background: ${m.pageColor} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
  css += `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
  let st = $('#print-style');
  if (!st) { st = document.createElement('style'); st.id = 'print-style'; document.head.appendChild(st); }
  st.textContent = `@media print { ${css} }`;
  $$('.print-wm, .print-border').forEach((e) => e.remove());
  if (m.watermark) {
    const w = document.createElement('div'); w.className = 'print-wm'; w.innerHTML = `<span>${App.esc(m.watermark)}</span>`; document.body.appendChild(w);
  }
  if (m.pageBorder) {
    const b = document.createElement('div'); b.className = 'print-border'; b.style.border = App.pageBorderCss(m.pageBorder).replace('var(--doc-accent)', getComputedStyle(App.ed).getPropertyValue('--doc-accent')); document.body.appendChild(b);
  }
  App.ed.classList.remove('show-marks');
};
App.afterPrint = () => {
  $$('.print-wm, .print-border').forEach((e) => e.remove());
  App.ed.classList.toggle('show-marks', App.state.marks);
  App.layout();
};
window.addEventListener('beforeprint', App.preparePrint);
window.addEventListener('afterprint', App.afterPrint);
