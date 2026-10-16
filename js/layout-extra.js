/* =========================================================
   Inkt — Indeling: sectie-einden, regelnummers, tabstops, liniaal, schikken
   ========================================================= */
'use strict';

/* ---------- Sectie-einden ---------- */
// Volgende pagina = pagina-einde met sectiemarkering (paginering en afdrukken werken als bij een pagina-einde).
// Doorlopend = onzichtbare markering; de sectie erna kan een eigen kolomindeling krijgen.
App.makeSectionBreak = (type) => {
  const el = document.createElement('div');
  el.className = type === 'next' ? 'page-break section-break' : 'section-break';
  el.dataset.type = type;
  el.contentEditable = 'false';
  return el;
};
App.defEdit('sectionBreak', (type) => {
  const sb = App.makeSectionBreak(type === 'continuous' ? 'continuous' : 'next');
  App.insertBlockAtCaret(sb, { keepEmpty: true });
  if (sb.nextElementSibling && sb.nextElementSibling.textContent.length && type !== 'continuous') {
    const p = document.createElement('p'); p.innerHTML = '<br>'; sb.after(p); App.placeCaret(p, 0);
  }
});
// Backspace na / Delete vóór een doorlopend sectie-einde verwijdert het (pagina-einden doet layout.js al)
App.ed.addEventListener('keydown', (e) => {
  if ((e.key !== 'Backspace' && e.key !== 'Delete') || e.ctrlKey || e.altKey || e.shiftKey || App.state.protect || App.state.track) return;
  const r = App.getRange(); if (!r || !r.collapsed) return;
  const b = App.blockOf(r.startContainer); if (!b || b.parentNode !== App.ed) return;
  const off = App.textOffset(r.startContainer, r.startOffset, b), len = b.textContent.length;
  const sib = e.key === 'Backspace' ? (off === 0 ? b.previousElementSibling : null) : (off >= len ? b.nextElementSibling : null);
  if (!sib || !sib.matches('.section-break:not(.page-break)')) return;
  e.preventDefault();
  App.run(() => { sib.remove(); App.setSelOffsets({ s: off, e: off, root: b }); });
});
App.sectionBreaks = () => $$(':scope > .section-break', App.ed);
// Sectienummer van een knooppunt (1 = eerste sectie)
App.sectionOf = (node) => {
  const top = node && App.topBlock(node);
  if (!top) return 1;
  let n = 1;
  App.sectionBreaks().forEach((sb) => { if (sb.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING) n++; });
  return n;
};
// Bovenste blokken van de sectie waarin de cursor staat
App.sectionBlocks = (node) => {
  const top = node && App.topBlock(node);
  if (!top) return [];
  let a = top; while (a.previousElementSibling && !a.previousElementSibling.matches('.section-break')) a = a.previousElementSibling;
  const out = [];
  for (let n = a; n && !n.matches('.section-break, .footnotes, .endnotes'); n = n.nextElementSibling) out.push(n);
  return out;
};
// Kolommen: zonder selectie gelden ze voor de hele sectie (zoals Word)
(() => {
  const orig = App.commands.columns.fn;
  App.defEdit('columns', (n) => {
    const r = App.getRange() || App.lastRange;
    if (!r || !r.collapsed || App.closest(r.startContainer, '.cols', App.ed)) return orig(n);
    const blocks = App.sectionBlocks(r.startContainer);
    if (n === '1') {
      blocks.filter((b) => b.matches('.cols')).forEach((c) => App.unwrap(c));
      return;
    }
    if (!blocks.length) return orig(n);
    const marks = App.markSel();
    const cls = { 2: 'c2', 3: 'c3', left: 'cl', right: 'cr' }[n];
    const wrap = document.createElement('div');
    wrap.className = 'cols ' + cls;
    blocks[0].before(wrap);
    blocks.forEach((b) => { if (b.matches('.cols')) { while (b.firstChild) wrap.appendChild(b.firstChild); b.remove(); } else wrap.appendChild(b); });
    if (!wrap.nextElementSibling || wrap.nextElementSibling.matches('.footnotes, .endnotes')) { const p = document.createElement('p'); p.innerHTML = '<br>'; wrap.after(p); }
    App.restoreMarks(marks);
    const g = App.geom();
    if (wrap.getBoundingClientRect().height / App.state.zoom > g.H - g.mt - g.mb) {
      App.toast('Let op: kolommen worden in Inkt niet over meerdere pagina\'s verdeeld. Voeg sectie-einden toe om kortere stukken in kolommen te zetten.', 'view_column', { ms: 6000 });
    }
  });
})();
App.menuBuilders['m-breaks'] = () => `<div class="menu-title">Pagina-einden</div>
  <button data-cmd="pageBreak"><b>Pagina</b><small>Het punt markeren waar een pagina eindigt en de volgende begint</small></button>
  <button data-cmd="columnBreak"><b>Kolom</b><small>Tekst na het kolomeinde begint in de volgende kolom</small></button>
  <button data-cmd="lineBreak"><b>Tekstterugloop</b><small>Tekst scheiden (regeleinde, Shift+Enter)</small></button>
  <div class="menu-title">Sectie-einden</div>
  <button data-cmd="sectionBreak" data-arg="next"><b>Volgende pagina</b><small>Een sectie-einde invoegen en de nieuwe sectie op de volgende pagina beginnen</small></button>
  <button data-cmd="sectionBreak" data-arg="continuous"><b>Doorlopend</b><small>Een sectie-einde invoegen en de nieuwe sectie op dezelfde pagina beginnen (bv. voor een andere kolomindeling)</small></button>
  <div class="menu-empty" style="max-width:330px;white-space:normal">Afdrukstand en marges gelden in Inkt voor het hele document, niet per sectie.</div>`;

/* ---------- Regelnummers ---------- */
// meta.lineNumbers = { mode: 'none'|'continuous'|'page'|'section', start, countBy, distance (cm, 0 = automatisch) }
App.lnSettings = () => App.doc.meta.lineNumbers || { mode: 'none', start: 1, countBy: 1, distance: 0 };
App.LN_SKIP = 'table, .footnotes, .endnotes, .toc, .tof, .index-field, .toa, .bibliography, .page-break, .section-break';
App.lnBlocks = () => $$('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote', App.ed)
  .filter((b) => !b.closest(App.LN_SKIP) && !b.querySelector('p, li, h1, h2, h3, h4, blockquote, ul, ol'));
// Regels van een blok: rechthoeken van de tekst, gegroepeerd per regel
App.lineTopsOf = (b, edTop, z) => {
  const r = document.createRange(); r.selectNodeContents(b);
  const rects = Array.from(r.getClientRects()).filter((x) => x.height > 0).sort((a, c) => a.top - c.top);
  if (!rects.length) { const br = b.getBoundingClientRect(); return br.height ? [{ top: (br.top - edTop) / z, h: Math.min(br.height / z, 24) }] : []; }
  const lines = [];
  rects.forEach((x) => {
    const last = lines[lines.length - 1];
    if (last && x.top < last.bottom - 2) { last.bottom = Math.max(last.bottom, x.bottom); last.minH = Math.min(last.minH, x.height); return; }
    lines.push({ top: x.top, bottom: x.bottom, minH: x.height });
  });
  // het nummer staat bij de tekst onderaan de regel (niet midden naast een hoge afbeelding)
  return lines.map((l) => ({ top: (l.bottom - l.minH - edTop) / z, h: l.minH / z }));
};
App.computeLineNumbers = () => {
  const s = App.lnSettings();
  if (!s.mode || s.mode === 'none' || App.state.view !== 'print') return [];
  const z = App.state.zoom, edTop = App.ed.getBoundingClientRect().top;
  const P = App.geom().H + App.GAP;
  const breaks = s.mode === 'section' ? App.sectionBreaks() : [];
  let n = (s.start || 1) - 1, page = -1, sec = 0;
  const out = [];
  App.lnBlocks().forEach((b) => {
    if (s.mode === 'section') {
      let k = 0; breaks.forEach((sb) => { if (sb.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) k++; });
      if (k !== sec) { sec = k; n = (s.start || 1) - 1; }
    }
    const skip = !!b.closest('.no-ln');
    App.lineTopsOf(b, edTop, z).forEach((ln) => {
      const p = Math.floor(ln.top / P);
      if (s.mode === 'page' && p !== page) { page = p; n = (s.start || 1) - 1; }
      if (skip) return;
      n++;
      if (n % (s.countBy || 1) === 0) out.push({ n, top: ln.top, h: ln.h, b });
    });
  });
  return out;
};
App.renderLineNumbers = () => {
  let layer = $('#ln-layer');
  const list = App.computeLineNumbers();
  if (!list.length) { if (layer) layer.remove(); return; }
  if (!layer) { layer = document.createElement('div'); layer.id = 'ln-layer'; $('#pages').insertBefore(layer, $('#editor')); }
  const g = App.geom(), s = App.lnSettings();
  const dist = s.distance ? App.cm2px(s.distance) : App.cm2px(0.64);
  const right = g.W - g.ml + dist;
  layer.style.width = g.W + 'px';
  layer.style.fontFamily = getComputedStyle(App.ed).getPropertyValue('--doc-font');
  layer.innerHTML = list.map((l) => `<span style="top:${l.top.toFixed(1)}px;line-height:${l.h.toFixed(1)}px;right:${right.toFixed(1)}px">${l.n}</span>`).join('');
};
// Na elke (geplande) layout bijwerken; niet bij elke toetsaanslag
(() => {
  const orig = App.layout;
  App.layout = (from) => {
    if (App.applyTabs) App.applyTabs();
    orig(from);
    App.renderLineNumbers();
  };
})();
// Afdrukken: nummers tijdelijk in de alinea's zetten (de browser pagineert opnieuw; ze bewegen mee met hun alinea)
window.addEventListener('beforeprint', () => {
  $$('.ln-print', App.ed).forEach((x) => x.remove());
  const s = App.lnSettings();
  if (!s.mode || s.mode === 'none') return;
  const z = App.state.zoom, edR = App.ed.getBoundingClientRect(), g = App.geom();
  const dist = s.distance ? App.cm2px(s.distance) : App.cm2px(0.64);
  const marks = App.computeLineNumbers().map((l) => {
    const br = l.b.getBoundingClientRect();
    return { l, y: l.top - (br.top - edR.top) / z, left: (br.left - edR.left) / z - g.ml };
  });
  App.ed.classList.add('ln-printing');
  marks.forEach(({ l, y, left }) => {
    const sp = document.createElement('span');
    sp.className = 'ln-print'; sp.contentEditable = 'false'; sp.textContent = l.n;
    sp.style.cssText = `top:${y.toFixed(1)}px;right:calc(100% + ${(left + dist).toFixed(1)}px);line-height:${l.h.toFixed(1)}px`;
    l.b.appendChild(sp);
  });
});
window.addEventListener('afterprint', () => { $$('.ln-print', App.ed).forEach((x) => x.remove()); App.ed.classList.remove('ln-printing'); });
App.defEdit('lineNumbers', (mode) => {
  if (mode === 'suppress') {
    const bs = App.getSelectedBlocks();
    const on = !bs.every((b) => b.classList.contains('no-ln'));
    bs.forEach((b) => { b.classList.toggle('no-ln', on); if (!b.className) b.removeAttribute('class'); });
    return;
  }
  App.doc.meta.lineNumbers = { ...App.lnSettings(), mode };
});
App.menuBuilders['m-linenumbers'] = () => {
  const m = App.lnSettings().mode || 'none';
  const it = (v, l) => `<button data-cmd="lineNumbers" data-arg="${v}"><span class="i">${m === v ? 'check' : ''}</span> ${l}</button>`;
  const r = App.lastRange, b = r && App.blockOf(r.startContainer);
  return it('none', 'Geen') + it('continuous', 'Doorlopend') + it('page', 'Elke pagina opnieuw') + it('section', 'Elke sectie opnieuw')
    + `<hr><button data-cmd="lineNumbers" data-arg="suppress"><span class="i">${b && b.closest('.no-ln') ? 'check' : ''}</span> Niet voor huidige alinea</button>
    <hr><button data-cmd="lineNumberOptions"><span class="i">format_list_numbered</span> Opties voor regelnummering…</button>`;
};
App.def('lineNumberOptions', () => {
  const s = App.lnSettings();
  App.dialog({
    title: 'Regelnummers',
    body: `<div class="checks"><label><input type="checkbox" id="ln-on" ${s.mode && s.mode !== 'none' ? 'checked' : ''}> Regelnummering toevoegen</label></div>
      <div class="fields-3">
        <label class="field"><span>Beginnen bij</span><input id="ln-start" type="number" min="1" value="${s.start || 1}"></label>
        <label class="field"><span>Vanaf tekst (cm, 0 = Auto)</span><input id="ln-dist" type="number" min="0" step="0.1" value="${s.distance || 0}"></label>
        <label class="field"><span>Interval</span><input id="ln-by" type="number" min="1" value="${s.countBy || 1}"></label></div>
      <label class="field"><span>Nummering</span><select id="ln-mode">
        <option value="page" ${s.mode === 'page' ? 'selected' : ''}>Elke pagina opnieuw</option>
        <option value="section" ${s.mode === 'section' ? 'selected' : ''}>Elke sectie opnieuw</option>
        <option value="continuous" ${!s.mode || s.mode === 'continuous' || s.mode === 'none' ? 'selected' : ''}>Doorlopend</option></select></label>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.run(() => {
      App.doc.meta.lineNumbers = {
        mode: d.$('#ln-on').checked ? d.$('#ln-mode').value : 'none',
        start: Math.max(1, parseInt(d.$('#ln-start').value, 10) || 1),
        countBy: Math.max(1, parseInt(d.$('#ln-by').value, 10) || 1),
        distance: Math.max(0, App.parseNum(d.$('#ln-dist').value) || 0),
      };
    }) }],
  });
});
if (!App.history.LOOK.includes('lineNumbers')) App.history.LOOK.push('lineNumbers');

/* ---------- Tabstops ---------- */
// Opgeslagen per alinea in data-tabs="2.5:l:none;8:r:dot" (positie in cm vanaf de linkermarge van de alinea-container)
App.DEFAULT_TAB_CM = 1.25;
App.getTabs = (b) => (b && b.dataset.tabs ? b.dataset.tabs.split(';').filter(Boolean).map((t) => {
  const [pos, align, leader] = t.split(':');
  return { pos: parseFloat(pos), align: align || 'l', leader: leader || 'none' };
}).filter((t) => t.pos >= 0).sort((a, c) => a.pos - c.pos) : []);
App.setTabs = (b, tabs) => {
  const s = tabs.slice().sort((a, c) => a.pos - c.pos).map((t) => `${Math.round(t.pos * 100) / 100}:${t.align}:${t.leader || 'none'}`).join(';');
  if (s) b.dataset.tabs = s; else delete b.dataset.tabs;
};
App.unitPx = () => (App.settings.unit === 'inch' ? 96 : App.CM);
App.unitName = () => (App.settings.unit === 'inch' ? 'inch' : 'cm');
// Linkerrand van de container van een alinea (in schermpixels) = waar de tabposities vanaf tellen
App.blockOrigin = (b) => {
  const cs = getComputedStyle(b), r = b.getBoundingClientRect();
  const z = App.state.zoom;
  return { left: r.left - (parseFloat(cs.marginLeft) || 0) * z, right: r.right + (parseFloat(cs.marginRight) || 0) * z, cs, r };
};
// Breedte van elke tab uitrekenen (links/midden/rechts/decimaal, met opvulteken)
App.applyTabs = (only) => {
  const spans = only ? $$('span.tab', only) : $$('span.tab', App.ed);
  if (!spans.length) return;
  const z = App.state.zoom;
  const cache = new Map();
  spans.forEach((sp) => {
    const b = App.blockOf(sp); if (!b) return;
    let info = cache.get(b);
    if (!info) {
      const o = App.blockOrigin(b);
      const pl = (parseFloat(o.cs.paddingLeft) || 0);
      info = { o, tabs: App.getTabs(b), hang: pl ? (o.r.left - o.left) / z + pl : 0 };
      cache.set(b, info);
    }
    sp.style.width = '0px';
    const x = (sp.getBoundingClientRect().left - info.o.left) / z;   // in px vanaf container
    const U = App.CM;
    let stop = info.tabs.find((t) => t.align !== 'bar' && t.pos * U > x + 1);
    let target, align = 'l', leader = 'none';
    if (stop) { target = stop.pos * U; align = stop.align; leader = stop.leader; }
    else if (info.hang > x + 1) target = info.hang;
    else { const d = (App.doc.meta.defaultTab || App.DEFAULT_TAB_CM) * U; target = (Math.floor(x / d) + 1) * d; }
    let w = target - x;
    if (align !== 'l' && align !== 'bar') {
      // tekst na de tab tot de volgende tab of het eind van de regel meten
      const rr = document.createRange(); rr.setStartAfter(sp);
      const next = $$('span.tab', b).find((t) => t !== sp && (sp.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (next) rr.setEndBefore(next); else rr.setEnd(b, b.childNodes.length);
      if (align === 'd') {
        // alleen tot het decimaalteken (komma of punt) meten
        const s0 = App.textOffset(rr.startContainer, rr.startOffset, b);
        const k = rr.toString().search(/[.,]/);
        if (k >= 0) { const p1 = App.pointAt(s0 + k, b); try { rr.setEnd(p1.node, p1.offset); } catch { /* niets */ } }
      }
      let segW = 0;
      const top0 = sp.getBoundingClientRect().top;
      Array.from(rr.getClientRects()).forEach((rc) => { if (Math.abs(rc.top - top0) < 4) segW += rc.width; });
      segW /= z;
      w -= align === 'c' ? segW / 2 : segW;
    }
    w = Math.max(align === 'l' ? 1 : 0, w);
    sp.style.width = w.toFixed(1) + 'px';
    sp.classList.remove('ld-dot', 'ld-dash', 'ld-line');
    if (leader !== 'none') sp.classList.add('ld-' + leader);
  });
};
// Tijdens typen alleen de alinea met de cursor (goedkoop) bijwerken
App.on('change', App.debounce((o) => {
  const r = App.getRange(); const b = r && App.blockOf(r.startContainer);
  if (b && b.querySelector('span.tab')) App.applyTabs(b);
}, 120));
App.TAB_ALIGN = { l: 'Links', c: 'Centreren', r: 'Rechts', d: 'Decimaal', bar: 'Lijn' };
App.TAB_LEADER = { none: '1 Geen', dot: '2 .......', dash: '3 -------', line: '4 _______' };
App.fmtUnit = (cm) => App.fmtNum(App.settings.unit === 'inch' ? cm / 2.54 : cm, 2) + ' ' + App.unitName();
App.parseUnit = (s) => { const v = App.parseNum(s); if (!(v >= 0)) return NaN; return /inch|"|in\b/.test(s) || (App.settings.unit === 'inch' && !/cm/.test(s)) ? v * 2.54 : v; };
App.def('tabsDialog', () => {
  App.restoreRange();
  const blocks = App.getSelectedBlocks();
  if (!blocks.length) { App.toast('Zet de cursor eerst in een alinea', 'info'); return; }
  let tabs = App.getTabs(blocks[0]);
  let sel = -1;
  const d = App.dialog({
    title: 'Tabs',
    body: `<div class="fields-2">
        <div><label class="field"><span>Tabstoppositie</span><input id="tb-pos" placeholder="bv. 2,5 ${App.unitName()}"></label>
          <div class="list-rows" id="tb-list" style="height:120px"></div></div>
        <div><label class="field"><span>Standaardtabstops</span><input id="tb-def" value="${App.fmtUnit(App.doc.meta.defaultTab || App.DEFAULT_TAB_CM)}"></label>
          <p class="muted small" style="margin:0">Te wissen tabstops:</p><p class="small" id="tb-clr" style="margin:2px 0 0;min-height:16px"></p></div>
      </div>
      <div class="fields-2">
        <div class="field"><span>Uitlijning</span><div class="checks" id="tb-align" style="flex-direction:column;gap:3px">${Object.entries(App.TAB_ALIGN).map(([k, v], i) => `<label><input type="radio" name="tb-a" value="${k}" ${i ? '' : 'checked'}> ${v}</label>`).join('')}</div></div>
        <div class="field"><span>Opvulteken</span><div class="checks" id="tb-lead" style="flex-direction:column;gap:3px">${Object.entries(App.TAB_LEADER).map(([k, v], i) => `<label><input type="radio" name="tb-l" value="${k}" ${i ? '' : 'checked'}> ${v}</label>`).join('')}</div></div>
      </div>
      <div style="display:flex;gap:8px"><button class="btn small" id="tb-set">Instellen</button><button class="btn small" id="tb-del">Wissen</button><button class="btn small" id="tb-all">Alles wissen</button></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: () => {
      if (d.$('#tb-pos').value.trim()) setTab();
      App.run(() => {
        blocks.forEach((b) => App.setTabs(b, tabs));
        const def = App.parseUnit(d.$('#tb-def').value);
        if (def > 0.05) App.doc.meta.defaultTab = Math.round(def * 100) / 100;
      });
    } }],
    noEnter: false,
  });
  const cleared = [];
  const render = () => {
    d.$('#tb-list').innerHTML = tabs.map((t, i) => `<div class="list-row ${i === sel ? 'sel' : ''}" data-i="${i}" style="cursor:pointer;padding:3px 8px">${App.fmtUnit(t.pos)}<span class="muted small" style="margin-left:auto">${App.TAB_ALIGN[t.align]}${t.leader !== 'none' ? ' · ' + App.TAB_LEADER[t.leader].slice(2) : ''}</span></div>`).join('');
    d.$('#tb-clr').textContent = cleared.map(App.fmtUnit).join('; ');
  };
  const choose = (i) => {
    sel = i; const t = tabs[i]; if (!t) return;
    d.$('#tb-pos').value = App.fmtUnit(t.pos);
    d.$(`[name=tb-a][value="${t.align}"]`).checked = true;
    d.$(`[name=tb-l][value="${t.leader}"]`).checked = true;
    render();
  };
  const setTab = () => {
    const pos = App.parseUnit(d.$('#tb-pos').value);
    if (!(pos >= 0)) { App.toast('Geen geldige tabstoppositie', 'error'); return; }
    const t = { pos, align: d.$('[name=tb-a]:checked').value, leader: d.$('[name=tb-l]:checked').value };
    tabs = tabs.filter((x) => Math.abs(x.pos - pos) > 0.01).concat(t).sort((a, c) => a.pos - c.pos);
    sel = tabs.indexOf(t); render();
  };
  d.$('#tb-list').addEventListener('click', (e) => { const row = e.target.closest('[data-i]'); if (row) choose(+row.dataset.i); });
  d.$('#tb-set').onclick = setTab;
  d.$('#tb-del').onclick = () => { if (tabs[sel]) { cleared.push(tabs[sel].pos); tabs.splice(sel, 1); sel = -1; d.$('#tb-pos').value = ''; render(); } };
  d.$('#tb-all').onclick = () => { tabs.forEach((t) => cleared.push(t.pos)); tabs = []; sel = -1; render(); };
  render();
  if (tabs.length) choose(0);
});
if (!App.history.LOOK.includes('defaultTab')) App.history.LOOK.push('defaultTab');

/* ---------- Liniaal: inspringmarkeringen en tabstops ---------- */
App.tabKind = 'l';
App.TAB_KINDS = ['l', 'c', 'r', 'd', 'bar', 'first', 'hang'];
App.TAB_KIND_NAMES = { l: 'Linkstab', c: 'Centreertab', r: 'Rechtstab', d: 'Decimale tab', bar: 'Lijntab', first: 'Inspringing eerste regel', hang: 'Verkeerd-om-inspringing' };
// Maten van een alinea in pixels vanaf de linkerkant van de pagina (zonder zoom)
App.indentInfo = (b) => {
  const z = App.state.zoom, o = App.blockOrigin(b), edL = App.ed.getBoundingClientRect().left;
  const cs = o.cs, pl = parseFloat(cs.paddingLeft) || 0;
  const base = (o.left - edL) / z;                     // linkerkant van de container
  const left = (o.r.left - edL) / z + pl;              // regels 2 en verder
  const first = left + (parseFloat(cs.textIndent) || 0);
  const right = (o.r.right - edL) / z;
  return { base, left, first, right, cright: (o.right - edL) / z };
};
// Inspringing instellen vanuit posities (px vanaf de container): links (regels 2+), eerste regel, rechts
App.setIndents = (b, L, F, R) => {
  L = Math.max(-200, L); F = Math.max(-200, F);
  const px = (v) => (Math.abs(v) < 0.5 ? '' : v.toFixed(1) + 'px');
  if (F >= L) { b.style.marginLeft = px(L); b.style.paddingLeft = ''; b.style.textIndent = px(F - L); }
  else { b.style.marginLeft = px(F); b.style.paddingLeft = px(L - F); b.style.textIndent = px(F - L); }
  if (R != null) b.style.marginRight = px(Math.max(-200, R));
  if (!b.getAttribute('style')) b.removeAttribute('style');
};
App.drawTabGlyph = (c, x, y, kind, color) => {
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.5; c.beginPath();
  if (kind === 'l') { c.moveTo(x, y - 6); c.lineTo(x, y); c.lineTo(x + 5, y); }
  else if (kind === 'r') { c.moveTo(x, y - 6); c.lineTo(x, y); c.lineTo(x - 5, y); }
  else if (kind === 'c' || kind === 'd') { c.moveTo(x, y - 6); c.lineTo(x, y); c.moveTo(x - 4, y); c.lineTo(x + 4, y); }
  else if (kind === 'bar') { c.moveTo(x, y - 7); c.lineTo(x, y); }
  c.stroke();
  if (kind === 'd') c.fillRect(x + 2, y - 4, 2, 2);
  c.restore();
};
App.drawRulerExtras = (c, { z, H, col, block: b }) => {
  App._ruler = null;
  if (!b || App.state.view === 'web') return;
  const ii = App.indentInfo(b);
  const X = (px) => px * z;
  // standaardtabstops (lichte streepjes) na de laatste eigen tab
  const tabs = App.getTabs(b);
  const U = App.CM, def = (App.doc.meta.defaultTab || App.DEFAULT_TAB_CM) * U;
  const lastTab = tabs.length ? tabs[tabs.length - 1].pos * U : 0;
  c.fillStyle = col.text;
  for (let p = def; ii.base + p < ii.cright; p += def) if (p > lastTab) c.fillRect(X(ii.base + p) - 0.5, H - 4, 1, 2);
  tabs.forEach((t) => App.drawTabGlyph(c, X(ii.base + t.pos * U), H - 4, t.align, col.marker === '#7a7a7a' ? '#333' : '#ddd'));
  // markeringen
  c.fillStyle = col.body; c.strokeStyle = col.marker; c.lineWidth = 1;
  const tri = (x, up, y0) => { c.beginPath(); if (up) { c.moveTo(x - 4.5, y0 + 5); c.lineTo(x + 4.5, y0 + 5); c.lineTo(x, y0); } else { c.moveTo(x - 4.5, y0); c.lineTo(x + 4.5, y0); c.lineTo(x, y0 + 5); } c.closePath(); c.fill(); c.stroke(); };
  const fx = X(ii.first), lx = X(ii.left), rx = X(ii.right);
  tri(fx, false, 1);                         // eerste regel
  tri(lx, true, 11);                         // verkeerd om
  c.fillRect(lx - 4.5, 16.5, 9, 4); c.strokeRect(lx - 4.5, 16.5, 9, 4);   // links
  tri(rx, true, 14);                         // rechts
  App._ruler = { b, ii, fx, lx, rx, tabs, z };
};
// Tabkiezer linksboven de liniaal
(() => {
  const wrap = $('#ruler-wrap'); if (!wrap) return;
  const btn = document.createElement('button');
  btn.id = 'tab-kind'; btn.type = 'button';
  wrap.appendChild(btn);
  const paint = () => {
    const k = App.tabKind;
    btn.title = App.TAB_KIND_NAMES[k] + ' — klik om te wisselen, klik daarna op de liniaal om een tabstop te plaatsen';
    const svg = { l: '<path d="M6 3v9h7"/>', r: '<path d="M12 3v9H5"/>', c: '<path d="M9 3v9M4 12h10"/>', d: '<path d="M9 3v9M4 12h10"/><rect x="11" y="7" width="2" height="2"/>', bar: '<path d="M9 2v12"/>', first: '<path d="M4 4h10L9 9z" fill="currentColor"/>', hang: '<path d="M4 13h10L9 8z" fill="currentColor"/>' }[k];
    btn.innerHTML = `<svg viewBox="0 0 18 16" width="16" height="14" fill="none" stroke="currentColor" stroke-width="1.6">${svg}</svg>`;
  };
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => { App.tabKind = App.TAB_KINDS[(App.TAB_KINDS.indexOf(App.tabKind) + 1) % App.TAB_KINDS.length]; paint(); });
  paint();
})();
// Slepen op de liniaal: markeringen, tabstops; klikken plaatst een tabstop van de gekozen soort
(() => {
  const cv = $('#ruler'); if (!cv) return;
  const hit = (x, y) => {
    const R = App._ruler; if (!R) return null;
    if (Math.abs(x - R.fx) < 5 && y < 9) return { kind: 'first' };
    if (Math.abs(x - R.lx) < 5 && y >= 16) return { kind: 'left' };
    if (Math.abs(x - R.lx) < 5 && y >= 9) return { kind: 'hang' };
    if (Math.abs(x - R.rx) < 5 && y >= 9) return { kind: 'right' };
    const U = App.CM;
    const ti = R.tabs.findIndex((t) => Math.abs(x - (R.ii.base + t.pos * U) * R.z) < 4);
    if (ti >= 0 && y >= 9) return { kind: 'tab', index: ti };
    return null;
  };
  const tip = { first: 'Inspringing eerste regel', left: 'Inspringing links', hang: 'Verkeerd-om-inspringing', right: 'Inspringing rechts', tab: 'Tabstop (slepen om te verplaatsen, van de liniaal slepen om te wissen, dubbelklikken voor Tabs)' };
  cv.addEventListener('mousemove', (e) => {
    const h = hit(e.offsetX, e.offsetY);
    if (h) { cv.style.cursor = 'default'; cv.title = tip[h.kind]; }
  });
  const snap = (px, alt) => { const q = App.CM / 4; return alt ? px : Math.round(px / q) * q; };
  cv.addEventListener('mousedown', (e) => {
    const R = App._ruler; if (!R || e.button !== 0) return;
    const g = App.geom();
    let h = hit(e.offsetX, e.offsetY);
    const inBody = e.offsetX > g.ml * R.z + 4 && e.offsetX < (g.W - g.mr) * R.z - 4 && e.offsetY >= 8;
    if (!h && !inBody) return;   // marges verslepen doet layout.js
    e.preventDefault(); e.stopImmediatePropagation();
    App.history.flush();
    if (App.clearPushes) App.clearPushes();
    const blocks = App.getSelectedBlocks().filter((b) => App.ed.contains(b));
    if (!blocks.length) return;
    const ii = R.ii, z = R.z, U = App.CM;
    const cvLeft = cv.getBoundingClientRect().left;
    const posAt = (ev) => (ev.clientX - cvLeft) / z;          // px vanaf de pagina
    let tabs = App.getTabs(R.b), tab = null, removed = false;
    if (!h) {
      if (App.tabKind === 'first' || App.tabKind === 'hang') {
        h = { kind: App.tabKind };
      } else {
        tab = { pos: snap(posAt(e) - ii.base, e.altKey) / U, align: App.tabKind, leader: 'none' };
        tabs.push(tab); h = { kind: 'tab' };
      }
    } else if (h.kind === 'tab') tab = tabs[h.index];
    const start = { L: ii.left - ii.base, F: ii.first - ii.base, R: ii.cright - ii.right };
    const apply = (ev) => {
      const p = snap(posAt(ev) - ii.base, ev.altKey);
      if (h.kind === 'tab') {
        removed = Math.abs(ev.clientY - cv.getBoundingClientRect().top - 11) > 26;
        tab.pos = Math.max(0, p / U);
        const list = removed ? tabs.filter((t) => t !== tab) : tabs;
        blocks.forEach((b) => App.setTabs(b, list));
      } else {
        let { L, F, R: Rt } = start;
        if (h.kind === 'first') F = p;
        else if (h.kind === 'hang') L = p;
        else if (h.kind === 'left') { F += p - L; L = p; }
        else if (h.kind === 'right') Rt = (ii.cright - ii.base) - p;
        blocks.forEach((b) => App.setIndents(b, L, F, Rt));
      }
      if (App.applyTabs) App.applyTabs(R.b);
      App.drawRuler();
    };
    apply(e);
    const up = () => {
      document.removeEventListener('mousemove', apply); document.removeEventListener('mouseup', up);
      App.changed({ immediate: true });
    };
    document.addEventListener('mousemove', apply); document.addEventListener('mouseup', up);
  }, true);
  cv.addEventListener('dblclick', (e) => { const h = hit(e.offsetX, e.offsetY); if (h && h.kind === 'tab') App.exec('tabsDialog'); });
})();

/* ---------- Schikken: positie, naar voren/achteren, uitlijnen ---------- */
App.WRAP_CLASSES = ['wrap-left', 'wrap-right', 'wrap-center', 'wrap-front', 'wrap-behind'];
App.isAbsObj = (img) => img.classList.contains('wrap-front') || img.classList.contains('wrap-behind');
App.objPageInfo = (img) => {
  const z = App.state.zoom, g = App.geom(), P = g.H + App.GAP;
  const top = (img.getBoundingClientRect().top - App.ed.getBoundingClientRect().top) / z;
  const page = App.clamp(Math.floor(top / P), 0, Math.max(0, App.pages.count - 1));
  return { g, P, page, pageTop: page * P };
};
// Voor de tekst / achter de tekst: absoluut gepositioneerd op de pagina (positie vast op de pagina)
App.makeAbs = (img, cls) => {
  const z = App.state.zoom, er = App.ed.getBoundingClientRect(), r = img.getBoundingClientRect();
  const x = (r.left - er.left) / z, y = (r.top - er.top) / z, w = r.width / z;
  img.classList.remove(...App.WRAP_CLASSES);
  img.classList.add(cls);
  // aan het begin van een alinea op het hoogste niveau hangen (zo is de editor het referentiepunt)
  if (img.closest('td, th, .cols, .textbox')) { const top = App.topBlock(img); if (top) { const p = document.createElement('p'); p.innerHTML = '<br>'; top.before(p); p.prepend(img); } }
  img.style.width = Math.round(w) + 'px';
  img.style.left = Math.round(x) + 'px';
  img.style.top = Math.round(y) + 'px';
  if (!img.style.zIndex) img.style.zIndex = cls === 'wrap-front' ? 3 : -1;
  else img.style.zIndex = cls === 'wrap-front' ? Math.max(3, +img.style.zIndex) : Math.min(-1, +img.style.zIndex);
};
App.clearAbs = (img) => { ['left', 'top', 'zIndex'].forEach((p) => { img.style[p] = ''; }); };
App.setWrap = (img, cls) => {
  if (cls === 'wrap-front' || cls === 'wrap-behind') { App.makeAbs(img, cls); return; }
  img.classList.remove(...App.WRAP_CLASSES); App.clearAbs(img);
  if (cls) img.classList.add(cls);
  if (!img.className) img.removeAttribute('class');
};
// Verticaal op de pagina zetten voor zwevende (float) objecten: naar de alinea boven/midden/onder op die pagina verplaatsen
App.moveObjVert = (img, where) => {
  const { page } = App.objPageInfo(img);
  const units = App.pageUnits().filter((u) => App.pages.map.get(u) === page && /^(P|H[1-6]|LI|BLOCKQUOTE)$/.test(u.tagName) && u !== img);
  if (!units.length) return;
  const u = where === 'top' ? units[0] : where === 'bottom' ? units[units.length - 1] : units[Math.floor((units.length - 1) / 2)];
  if (u.firstChild && u.firstChild.nodeName === 'BR' && u.childNodes.length === 1) u.innerHTML = '';
  u.prepend(img);
};
App.objCmd('objPosition', (img, arg) => {
  if (arg === 'inline') { App.setWrap(img, ''); return; }
  const [v, h] = arg.split('-');
  if (App.isAbsObj(img)) { App.alignAbs(img, h); App.alignAbs(img, v); return; }
  App.setWrap(img, { left: 'wrap-left', center: 'wrap-center', right: 'wrap-right' }[h]);
  App.moveObjVert(img, v);
});
App.alignAbs = (img, how) => {
  const { g, pageTop } = App.objPageInfo(img);
  const z = App.state.zoom, r = img.getBoundingClientRect(), w = r.width / z, hgt = r.height / z;
  if (how === 'left') img.style.left = Math.round(g.ml) + 'px';
  if (how === 'center') img.style.left = Math.round((g.W - w) / 2) + 'px';
  if (how === 'right') img.style.left = Math.round(g.W - g.mr - w) + 'px';
  if (how === 'top') img.style.top = Math.round(pageTop + g.mt) + 'px';
  if (how === 'middle') img.style.top = Math.round(pageTop + (g.H - hgt) / 2) + 'px';
  if (how === 'bottom') img.style.top = Math.round(pageTop + g.H - g.mb - hgt) + 'px';
};
App.objCmd('objAlign', (img, how) => {
  if (App.isAbsObj(img)) { App.alignAbs(img, how); return; }
  if (how === 'left' || how === 'center' || how === 'right') App.setWrap(img, 'wrap-' + how);
  else App.moveObjVert(img, how);
});
App.objCmd('objWrap', (img, cls) => App.setWrap(img, cls));
App.absObjs = () => $$('img.wrap-front, img.wrap-behind', App.ed);
App.objCmd('objOrder', (img, how) => {
  if (how === 'front-text') { App.setWrap(img, 'wrap-front'); return; }
  if (how === 'behind-text') { App.setWrap(img, 'wrap-behind'); return; }
  if (!App.isAbsObj(img)) { App.setWrap(img, how === 'forward' || how === 'front' ? 'wrap-front' : 'wrap-behind'); App.toast(how === 'forward' || how === 'front' ? 'Het object staat nu voor de tekst' : 'Het object staat nu achter de tekst', 'info'); return; }
  const front = img.classList.contains('wrap-front');
  const same = App.absObjs().filter((o) => o.classList.contains(front ? 'wrap-front' : 'wrap-behind'));
  const zs = same.map((o) => +o.style.zIndex || 0);
  let zi = +img.style.zIndex || 0;
  if (how === 'front') zi = Math.max(...zs) + 1;
  else if (how === 'back') zi = Math.min(...zs) - 1;
  else if (how === 'forward') zi += 1;
  else if (how === 'backward') zi -= 1;
  img.style.zIndex = front ? Math.max(3, zi) : Math.min(-1, zi);
});
// Bestaande terugloop-knoppen ook laten werken voor objecten voor/achter de tekst
[['wrapInline', ''], ['wrapLeft', 'wrap-left'], ['wrapRight', 'wrap-right'], ['wrapCenter', 'wrap-center'], ['wrapFront', 'wrap-front'], ['wrapBehind', 'wrap-behind']].forEach(([cmd, cls]) => {
  App.objCmd(cmd, (img) => App.setWrap(img, cls));
  App.stateFns[cmd] = () => { const img = App.selectedObj; if (!img) return false; return cls ? img.classList.contains(cls) : !App.WRAP_CLASSES.some((c) => img.classList.contains(c)); };
});
// Objecten voor/achter de tekst verslepen
App.ed.addEventListener('mousedown', (e) => {
  const img = e.target;
  if (e.button !== 0 || img.tagName !== 'IMG' || !App.isAbsObj(img) || App.state.protect) return;
  e.preventDefault();
  App.selectObj(img);
  App.history.flush();
  const z = App.state.zoom, x0 = e.clientX, y0 = e.clientY;
  const l0 = parseFloat(img.style.left) || 0, t0 = parseFloat(img.style.top) || 0;
  let moved = false;
  const move = (ev) => {
    const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    moved = true;
    img.style.left = Math.round(l0 + dx) + 'px'; img.style.top = Math.round(t0 + dy) + 'px';
    App.positionObjOverlay();
  };
  const up = () => {
    document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
    if (moved) { App.changed({ immediate: true }); App.selectObj(img); }
  };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
}, true);
App.POS_NAMES = { top: 'Boven', middle: 'Midden', bottom: 'Onder', left: 'links', center: 'in het midden', right: 'rechts' };
App.menuBuilders['m-position'] = () => {
  const cell = (v, h) => `<button data-cmd="objPosition" data-arg="${v}-${h}" title="${App.POS_NAMES[v]} ${App.POS_NAMES[h]} met vierkante tekstterugloop"><svg viewBox="0 0 30 38" width="30" height="38"><rect x=".5" y=".5" width="29" height="37" fill="#fff" stroke="#999"/>${[6, 10, 14, 18, 22, 26, 30].map((y) => `<path d="M4 ${y}h22" stroke="#bbb"/>`).join('')}<rect x="${{ left: 4, center: 10, right: 16 }[h]}" y="${{ top: 4, middle: 14, bottom: 24 }[v]}" width="10" height="9" fill="#5b9bd5"/></svg></button>`;
  return `<div class="menu-title">In lijn met tekst</div><button data-cmd="objPosition" data-arg="inline"><span class="i">format_align_left</span> In lijn met tekst</button>
    <div class="menu-title">Met tekstterugloop</div><div class="grid-menu" style="grid-template-columns:repeat(3,40px)">${['top', 'middle', 'bottom'].map((v) => ['left', 'center', 'right'].map((h) => cell(v, h)).join('')).join('')}</div>
    <hr><button data-cmd="layoutOptions"><span class="i">tune</span> Meer indelingsopties…</button>`;
};
App.menuBuilders['m-wrap2'] = () => [['wrapInline', 'format_align_left', 'In lijn met tekst'], ['wrapLeft', 'format_image_left', 'Vierkant (links)'], ['wrapRight', 'format_image_right', 'Vierkant (rechts)'], ['wrapCenter', 'vertical_align_center', 'Boven en onder'], ['wrapBehind', 'flip_to_back', 'Achter de tekst'], ['wrapFront', 'flip_to_front', 'Voor de tekst']]
  .map(([c, i, l]) => `<button data-cmd="${c}"><span class="i">${i}</span> ${l}</button>`).join('');
App.menuBuilders['m-forward'] = () => `<button data-cmd="objOrder" data-arg="forward"><span class="i">flip_to_front</span> Naar voren</button>
  <button data-cmd="objOrder" data-arg="front"><span class="i">flip_to_front</span> Op voorgrond plaatsen</button>
  <button data-cmd="objOrder" data-arg="front-text"><span class="i">text_select_move_forward_character</span> Voor de tekst plaatsen</button>`;
App.menuBuilders['m-backward'] = () => `<button data-cmd="objOrder" data-arg="backward"><span class="i">flip_to_back</span> Naar achteren</button>
  <button data-cmd="objOrder" data-arg="back"><span class="i">flip_to_back</span> Op achtergrond plaatsen</button>
  <button data-cmd="objOrder" data-arg="behind-text"><span class="i">text_select_move_back_character</span> Achter de tekst plaatsen</button>`;
App.menuBuilders['m-objalign'] = () => [['left', 'align_horizontal_left', 'Links uitlijnen'], ['center', 'align_horizontal_center', 'Centreren'], ['right', 'align_horizontal_right', 'Rechts uitlijnen'], ['top', 'align_vertical_top', 'Boven uitlijnen'], ['middle', 'align_vertical_center', 'Midden uitlijnen'], ['bottom', 'align_vertical_bottom', 'Onder uitlijnen']]
  .map(([a, i, l], k) => `${k === 3 ? '<hr>' : ''}<button data-cmd="objAlign" data-arg="${a}"><span class="i">${i}</span> ${l}</button>`).join('')
  + '<hr><div class="menu-empty" style="padding:4px 10px">Uitlijnen ten opzichte van de marge</div>';
App.def('layoutOptions', () => {
  const img = App.selectedObj;
  if (!img) { App.toast('Selecteer eerst een afbeelding of vorm', 'image'); return; }
  const z = App.state.zoom, cm = (px) => App.fmtNum(App.px2cm(px), 2);
  const abs = App.isAbsObj(img), r = img.getBoundingClientRect();
  const { pageTop } = App.objPageInfo(img);
  App.dialog({
    title: 'Indeling',
    body: `<label class="field"><span>Tekstterugloop</span><select id="lo-wrap">${[['', 'In lijn met tekst'], ['wrap-left', 'Vierkant (links)'], ['wrap-right', 'Vierkant (rechts)'], ['wrap-center', 'Boven en onder'], ['wrap-behind', 'Achter de tekst'], ['wrap-front', 'Voor de tekst']].map(([v, l]) => `<option value="${v}" ${(v ? img.classList.contains(v) : !App.WRAP_CLASSES.some((c) => img.classList.contains(c))) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="fields-3"><label class="field"><span>Breedte (cm)</span><input id="lo-w" value="${cm(r.width / z)}"></label>
      <label class="field"><span>Horizontaal t.o.v. pagina (cm)</span><input id="lo-x" value="${abs ? cm(parseFloat(img.style.left) || 0) : ''}" ${abs ? '' : 'disabled'}></label>
      <label class="field"><span>Verticaal t.o.v. pagina (cm)</span><input id="lo-y" value="${abs ? cm((parseFloat(img.style.top) || 0) - pageTop) : ''}" ${abs ? '' : 'disabled'}></label></div>
      <p class="muted small" style="margin:0">Een exacte positie op de pagina kan bij ‘Voor de tekst’ en ‘Achter de tekst’. Die objecten blijven op hun plek op de pagina staan als de tekst verschuift.</p>`,
    onOpen: (d) => d.$('#lo-wrap').addEventListener('change', () => { const a = /front|behind/.test(d.$('#lo-wrap').value); d.$('#lo-x').disabled = d.$('#lo-y').disabled = !a; }),
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      App.run(() => {
        App.setWrap(img, d.$('#lo-wrap').value);
        const w = App.parseNum(d.$('#lo-w').value); if (w > 0) { img.style.width = App.cm2px(w).toFixed(0) + 'px'; img.style.height = ''; }
        if (App.isAbsObj(img)) {
          const x = App.parseNum(d.$('#lo-x').value), y = App.parseNum(d.$('#lo-y').value);
          if (x >= 0 || x < 0) img.style.left = App.cm2px(x).toFixed(0) + 'px';
          if (y >= 0 || y < 0) img.style.top = (App.objPageInfo(img).pageTop + App.cm2px(y)).toFixed(0) + 'px';
        }
      });
      App.selectObj(img);
    } }],
  });
});

/* ---------- Deelvensters rechts (zoals Word: toegankelijkheid, revisie, wizard) ---------- */
App.taskPane = (id, title, opts = {}) => {
  let el = document.getElementById('tp-' + id);
  $$('.taskpane').forEach((p) => { if (p !== el) App.closeTaskPane(p.dataset.id); });
  if (!el) {
    el = document.createElement('aside');
    el.className = 'taskpane'; el.id = 'tp-' + id; el.dataset.id = id;
    el.innerHTML = `<div class="pane-head"><strong></strong><button class="qb" data-close title="Sluiten"><span class="i">close</span></button></div><div class="tp-body"></div>`;
    $('#workspace').appendChild(el);
    el.querySelector('[data-close]').addEventListener('click', () => App.closeTaskPane(id));
    if (opts.width) el.style.width = opts.width + 'px';
    requestAnimationFrame(() => App.layout());
  }
  el.querySelector('.pane-head strong').textContent = title;
  el.onclose = opts.onClose || null;
  return el.querySelector('.tp-body');
};
App.closeTaskPane = (id) => {
  const el = document.getElementById('tp-' + id);
  if (!el) return;
  if (el.onclose) el.onclose();
  el.remove();
  App.layout();
  App.scheduleState();
};
App.paneOpen = (id) => !!document.getElementById('tp-' + id);
// Knoppen in deelvensters houden de cursor in het document (zoals het lint)
document.addEventListener('mousedown', (e) => {
  const b = e.target.closest('.taskpane button');
  if (b && !e.target.closest('input, select, textarea')) e.preventDefault();
}, true);
