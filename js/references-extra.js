/* =========================================================
   Inkt — Verwijzingen: eindnoten, tekst toevoegen, index, lijst met rechtsbronnen
   ========================================================= */
'use strict';


/* ---------- Eindnoten ---------- */
// Verwijzing: <sup class="en-ref" data-en data-note>; lijst helemaal aan het eind van het document (.endnotes)
App.roman = (n) => {
  const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = ''; m.forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } }); return s;
};
App.NOTE_FORMATS = { lowerRoman: ['i, ii, iii, …', App.roman], decimal: ['1, 2, 3, …', String], lowerLetter: ['a, b, c, …', (n) => String.fromCharCode(96 + ((n - 1) % 26) + 1).repeat(Math.ceil(n / 26))], upperRoman: ['I, II, III, …', (n) => App.roman(n).toUpperCase()] };
App.endnoteFmt = () => App.doc.meta.endnoteFormat || 'lowerRoman';
App.endnoteLabel = (n) => (App.NOTE_FORMATS[App.endnoteFmt()] || App.NOTE_FORMATS.lowerRoman)[1](n);
App.renumberEndnotes = () => {
  const refs = $$('sup.en-ref', App.ed);
  refs.forEach((r, i) => { const t = App.endnoteLabel(i + 1); if (r.textContent !== t) r.textContent = t; });
  let sec = App.ed.querySelector(':scope > .endnotes');
  if (!refs.length) { if (sec) sec.remove(); return; }
  if (!sec) { sec = document.createElement('div'); sec.className = 'endnotes'; sec.contentEditable = 'false'; App.ed.appendChild(sec); }
  if (sec !== App.ed.lastElementChild) App.ed.appendChild(sec);
  const prev = sec.previousElementSibling;
  // vóór de notenlijsten moet een gewone alinea staan om verder te kunnen typen
  if (!prev || (!prev.classList.contains('footnotes') && !/^(P|H\d|UL|OL|BLOCKQUOTE)$/.test(prev.tagName))) { const p = document.createElement('p'); p.innerHTML = '<br>'; sec.before(p); }
  const html = `<hr><p class="en-title">Eindnoten</p><ol>${refs.map((r, i) => `<li data-en="${r.dataset.en}"><span class="en-num">${App.endnoteLabel(i + 1)}</span>${App.esc(r.dataset.note)}</li>`).join('')}</ol>`;
  if (sec.innerHTML !== html) sec.innerHTML = html;
};
App.endnoteDialog = (ref) => {
  App.restoreRange();
  App.dialog({
    title: ref ? 'Eindnoot bewerken' : 'Eindnoot invoegen',
    body: `<label class="field"><span>Tekst van de eindnoot</span><textarea id="en-t" autofocus>${App.esc(ref ? ref.dataset.note : '')}</textarea></label>`,
    buttons: [
      ...(ref ? [{ label: 'Verwijderen', danger: true, left: true, action: () => App.run(() => { ref.remove(); App.renumberEndnotes(); }) }] : []),
      { label: 'Annuleren' },
      { label: 'OK', primary: true, action: (d) => {
        const t = d.$('#en-t').value.trim();
        if (!t) return false;
        App.run(() => {
          if (ref) ref.dataset.note = t;
          else App.insertHTML(`<sup class="en-ref" contenteditable="false" data-en="${App.uid('en')}" data-note="${App.esc(t)}">i</sup>`);
          App.renumberEndnotes();
        });
      } },
    ],
  });
};
App.def('endnote', () => App.endnoteDialog(null));
App.ed.addEventListener('click', (e) => {
  const ref = e.target.closest && e.target.closest('sup.en-ref');
  if (ref && App.ed.contains(ref)) { e.preventDefault(); App.endnoteDialog(ref); return; }
  const li = e.target.closest && e.target.closest('.endnotes li[data-en]');
  if (li) { const r = App.ed.querySelector(`sup.en-ref[data-en="${li.dataset.en}"]`); if (r) App.scrollToEl(r); }
});
App.on('change', App.debounce(() => App.renumberEndnotes(), 500));
// Ctrl+Alt+D = eindnoot (zoals Word)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && e.key.toLowerCase() === 'd' && App.inRoot(document.activeElement)) { e.preventDefault(); App.exec('endnote'); }
});
App.noteNav = (sel, dir) => {
  const refs = $$(sel, App.ed);
  if (!refs.length) { App.toast(sel.includes('en') ? 'Er zijn geen eindnoten' : 'Er zijn geen voetnoten', 'info'); return; }
  const cur = App.lastRange;
  const next = dir > 0 ? (refs.find((r) => cur && cur.comparePoint(r, 0) > 0) || refs[0]) : ([...refs].reverse().find((r) => cur && cur.comparePoint(r, 0) < 0 && !(cur.startContainer.nodeType === 1 && cur.startContainer.childNodes[cur.startOffset - 1] === r)) || refs[refs.length - 1]);
  App.scrollToEl(next);
  App.ed.focus({ preventScroll: true });
  const r = document.createRange(); r.setStartAfter(next); r.collapse(true); App.setRange(r);
};
App.def('nextEndnote', () => App.noteNav('sup.en-ref', 1));
App.def('prevEndnote', () => App.noteNav('sup.en-ref', -1));
App.def('prevFootnote', () => App.noteNav('sup.fn-ref', -1));
App.def('showEndnotes', () => { const s = App.ed.querySelector('.endnotes'); if (s) App.scrollToEl(s); else App.toast('Er zijn geen eindnoten', 'info'); });
App.menuBuilders['m-nextnote'] = () => `<button data-cmd="nextFootnote"><span class="i">arrow_downward</span> Volgende voetnoot</button>
  <button data-cmd="prevFootnote"><span class="i">arrow_upward</span> Vorige voetnoot</button>
  <button data-cmd="nextEndnote"><span class="i">arrow_downward</span> Volgende eindnoot</button>
  <button data-cmd="prevEndnote"><span class="i">arrow_upward</span> Vorige eindnoot</button>`;
App.menuBuilders['m-shownotes'] = () => `<button data-cmd="showFootnotes"><span class="i">notes</span> Voetnoten weergeven</button><button data-cmd="showEndnotes"><span class="i">notes</span> Eindnoten weergeven</button>`;
// Venster "Voetnoten en eindnoten": nummeropmaak van eindnoten, invoegen en omzetten
App.def('notesDialog', () => {
  App.restoreRange();
  const fmt = App.endnoteFmt();
  const nf = $$('sup.fn-ref', App.ed).length, ne = $$('sup.en-ref', App.ed).length;
  App.dialog({
    title: 'Voetnoten en eindnoten',
    body: `<div class="field"><span>Locatie</span><div class="checks" style="flex-direction:column;gap:4px">
        <label><input type="radio" name="nd-k" value="fn" checked> Voetnoten — onder aan de tekst (in Inkt aan het eind, in de .docx-export onder aan de pagina)</label>
        <label><input type="radio" name="nd-k" value="en"> Eindnoten — aan het einde van het document</label></div></div>
      <label class="field"><span>Nummeropmaak eindnoten</span><select id="nd-fmt">${Object.entries(App.NOTE_FORMATS).map(([k, [l]]) => `<option value="${k}" ${k === fmt ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="field"><span>Omzetten</span><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" id="nd-f2e" ${nf ? '' : 'disabled'}>Alle voetnoten naar eindnoten (${nf})</button>
        <button class="btn small" id="nd-e2f" ${ne ? '' : 'disabled'}>Alle eindnoten naar voetnoten (${ne})</button></div></div>`,
    onOpen: (d) => {
      const conv = (from, to) => App.run(() => {
        $$(from === 'fn' ? 'sup.fn-ref' : 'sup.en-ref', App.ed).forEach((r) => {
          const s = document.createElement('sup');
          s.className = to === 'fn' ? 'fn-ref' : 'en-ref'; s.contentEditable = 'false';
          s.dataset[to] = App.uid(to); s.dataset.note = r.dataset.note || ''; s.textContent = '#';
          r.replaceWith(s);
        });
        App.renumberFootnotes(); App.renumberEndnotes();
      });
      d.$('#nd-f2e').onclick = () => { conv('fn', 'en'); d.close(); App.toast('Voetnoten omgezet naar eindnoten', 'ok'); };
      d.$('#nd-e2f').onclick = () => { conv('en', 'fn'); d.close(); App.toast('Eindnoten omgezet naar voetnoten', 'ok'); };
    },
    buttons: [{ label: 'Annuleren' }, { label: 'Toepassen', action: (d) => { App.doc.meta.endnoteFormat = d.$('#nd-fmt').value; App.run(() => App.renumberEndnotes()); } },
      { label: 'Invoegen', primary: true, action: (d) => {
        App.doc.meta.endnoteFormat = d.$('#nd-fmt').value;
        const k = d.$('[name=nd-k]:checked').value;
        setTimeout(() => App.exec(k === 'en' ? 'endnote' : 'footnote'), 30);
      } }],
  });
});

/* ---------- Tekst toevoegen (niveau in de inhoudsopgave) ---------- */
App.defEdit('tocLevel', (lvl) => {
  const blocks = App.getSelectedBlocks().filter((b) => App.ed.contains(b) && /^(P|H[1-6])$/.test(b.tagName));
  if (!blocks.length) { App.toast('Zet de cursor in een alinea', 'info'); return; }
  if (lvl === '0') { blocks.forEach((b) => { if (/^H/.test(b.tagName)) b.dataset.toc = '0'; else b.removeAttribute('data-toc'); }); return; }
  const marks = App.markSel();
  blocks.forEach((b) => {
    const h = document.createElement('h' + lvl);
    Array.from(b.attributes).forEach((a) => { if (a.name !== 'data-toc' && a.name !== 'class') h.setAttribute(a.name, a.value); });
    while (b.firstChild) h.appendChild(b.firstChild);
    b.replaceWith(h);
  });
  App.restoreMarks(marks);
});
App.menuBuilders['m-addtext'] = () => {
  const r = App.lastRange, b = r && App.blockOf(r.startContainer);
  const cur = b && /^H[1-6]$/.test(b.tagName) && b.dataset.toc !== '0' ? b.tagName[1] : '0';
  const it = (v, l) => `<button data-cmd="tocLevel" data-arg="${v}"><span class="i">${cur === v ? 'check' : ''}</span> ${l}</button>`;
  return it('0', 'Niet weergeven in inhoudsopgave') + it('1', 'Niveau 1') + it('2', 'Niveau 2') + it('3', 'Niveau 3');
};
if (!App.history.LOOK.includes('endnoteFormat')) App.history.LOOK.push('endnoteFormat');

/* ---------- Index ---------- */
// Item markeren: verborgen XE-markering <span class="xe" data-entry data-sub data-see data-b data-i> (zichtbaar met Alles weergeven)
App.pageOfHidden = (el) => {
  if (App.state.view === 'web') return 1;
  let rect = null;
  const prev = el.previousSibling;
  if (prev && prev.nodeType === 3 && prev.length) { const r = document.createRange(); r.setStart(prev, prev.length - 1); r.setEnd(prev, prev.length); rect = r.getClientRects()[0]; }
  if (!rect) { const nx = el.nextSibling; if (nx && nx.nodeType === 3 && nx.length) { const r = document.createRange(); r.setStart(nx, 0); r.setEnd(nx, 1); rect = r.getClientRects()[0]; } }
  if (!rect) rect = (App.blockOf(el) || el.parentElement).getBoundingClientRect();
  const top = (rect.top - App.ed.getBoundingClientRect().top) / App.state.zoom;
  return Math.max(1, Math.floor(top / (App.geom().H + App.GAP)) + 1);
};
App.xeText = (d) => `{ XE "${d.entry}${d.sub ? ':' + d.sub : ''}"${d.see ? ` \\t "Zie ${d.see}"` : ''}${d.b ? ' \\b' : ''}${d.i ? ' \\i' : ''} }`;
App.xeHtml = (d) => `<span class="xe" contenteditable="false" data-entry="${App.esc(d.entry)}"${d.sub ? ` data-sub="${App.esc(d.sub)}"` : ''}${d.see ? ` data-see="${App.esc(d.see)}"` : ''}${d.b ? ' data-b="1"' : ''}${d.i ? ' data-i="1"' : ''}>${App.esc(App.xeText(d))}</span>`;
// Markering direct achter een bereik plaatsen
App.insertAfterRange = (r, html) => {
  const end = r.cloneRange(); end.collapse(false);
  const frag = end.createContextualFragment(html);
  end.insertNode(frag);
};
App.def('markIndexEntry', () => {
  App.restoreRange();
  const r = App.getRange();
  const sel = r && !r.collapsed ? r.toString().trim() : '';
  const d = App.dialog({
    title: 'Indexitem markeren',
    body: `<div class="fields-2"><label class="field"><span>Hoofditem</span><input id="xe-main" value="${App.esc(sel)}" autofocus></label>
      <label class="field"><span>Subitem</span><input id="xe-sub"></label></div>
      <div class="field"><span>Opties</span><div class="checks" style="flex-direction:column;gap:4px">
        <label><input type="radio" name="xe-o" value="page" checked> Huidige pagina</label>
        <label><input type="radio" name="xe-o" value="see"> Kruisverwijzing: Zie <input id="xe-see" class="inp" style="width:200px;height:24px;margin-left:4px"></label></div></div>
      <div class="field"><span>Opmaak paginanummer</span><div class="checks"><label><input type="checkbox" id="xe-b"> Vet</label><label><input type="checkbox" id="xe-i"> Cursief</label></div></div>
      <p class="muted small" style="margin:0">De markering is verborgen tekst; zet <b>Alles weergeven</b> (¶) aan om hem te zien. Kies daarna Verwijzingen › Index invoegen.</p>`,
    buttons: [
      { label: 'Alles markeren', left: true, action: (dd) => { mark(dd, true); return false; } },
      { label: 'Sluiten' },
      { label: 'Markeren', primary: true, action: (dd) => { mark(dd, false); return false; } },
    ],
  });
  const data = (dd) => ({ entry: dd.$('#xe-main').value.trim(), sub: dd.$('#xe-sub').value.trim(), see: dd.$('[name=xe-o]:checked').value === 'see' ? dd.$('#xe-see').value.trim() : '', b: dd.$('#xe-b').checked, i: dd.$('#xe-i').checked });
  const mark = (dd, all) => {
    const x = data(dd);
    if (!x.entry) { App.toast('Vul een hoofditem in', 'error'); return; }
    let n = 0;
    App.run(() => {
      if (all && sel) {
        // elke keer dat de geselecteerde tekst voorkomt (eerste per alinea, zoals Word)
        $$(App.LEAF_BLOCK + ',li,td,th', App.ed).filter((b) => !b.closest('.toc, .index-field, .toa, .footnotes, .endnotes') && !b.querySelector('p,li')).forEach((b) => {
          const t = b.textContent;
          let k = t.indexOf(sel), s = null;
          while (k >= 0) { s = App.pointAt(k, b, true); if (!s.node.parentElement.closest('.xe, .ta, [contenteditable="false"]')) break; k = t.indexOf(sel, k + 1); }
          if (k < 0) return;
          const e = App.pointAt(k + sel.length, b);
          const rr = document.createRange(); rr.setStart(s.node, s.offset); rr.setEnd(e.node, e.offset);
          App.insertAfterRange(rr, App.xeHtml(x)); n++;
        });
      } else {
        const rr = App.getRange() || App.lastRange;
        if (rr) { App.insertAfterRange(rr, App.xeHtml(x)); n = 1; }
      }
    });
    App.toast(n === 1 ? 'Indexitem gemarkeerd' : `${n} indexitems gemarkeerd`, 'ok');
  };
  void d;
});
// Index opbouwen uit alle XE-markeringen
App.buildIndex = (el) => {
  const map = new Map();   // hoofditem -> { pages: Map(page -> {b,i}), see, subs: Map }
  const get = (m, k) => { if (!m.has(k)) m.set(k, { pages: new Map(), see: '', subs: new Map() }); return m.get(k); };
  $$('.xe', App.ed).forEach((x) => {
    const main = get(map, x.dataset.entry || '');
    const node = x.dataset.sub ? get(main.subs, x.dataset.sub) : main;
    if (x.dataset.see) { node.see = x.dataset.see; return; }
    const p = App.pageOfHidden(x);
    const prev = node.pages.get(p) || {};
    node.pages.set(p, { b: prev.b || !!x.dataset.b, i: prev.i || !!x.dataset.i });
  });
  const right = el.dataset.right === '1';
  const pagesHtml = (n) => {
    const ps = [...n.pages.entries()].sort((a, b) => a[0] - b[0]).map(([p, f]) => { let s = String(p); if (f.b) s = `<b>${s}</b>`; if (f.i) s = `<i>${s}</i>`; return s; });
    const see = n.see ? `<i>Zie</i> ${App.esc(n.see)}` : '';
    return [ps.join(', '), see].filter(Boolean).join('. ');
  };
  const line = (label, n, lvl) => right
    ? `<p class="ix-entry ix${lvl}"><span class="t">${App.esc(label)}</span><span class="dots ${el.dataset.leader || 'dot'}"></span><span class="pg">${pagesHtml(n)}</span></p>`
    : `<p class="ix-entry ix${lvl}">${App.esc(label)}${pagesHtml(n) ? ', ' + pagesHtml(n) : ''}</p>`;
  const coll = (a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' });
  const keys = [...map.keys()].sort(coll);
  let html = '', letter = '';
  keys.forEach((k) => {
    const L = (k[0] || '').toUpperCase();
    if (el.dataset.letters === '1' && L !== letter) { letter = L; html += `<p class="ix-letter">${App.esc(L)}</p>`; }
    const n = map.get(k);
    html += line(k, n, 1);
    [...n.subs.keys()].sort(coll).forEach((s) => { html += line(s, n.subs.get(s), 2); });
  });
  if (!keys.length) html = '<p class="toc-empty">Geen indexitems gevonden. Markeer eerst items met Verwijzingen › Item markeren.</p>';
  const out = `<div class="ix-body" style="column-count:${+el.dataset.cols || 2}">${html}</div>`;
  if (el.innerHTML !== out) { el.innerHTML = out; return true; }
  return false;
};
App.def('insertIndex', () => {
  App.restoreRange();
  const ex = App.ed.querySelector('.index-field');
  App.dialog({
    title: 'Index',
    body: `<div class="fields-3"><label class="field"><span>Kolommen</span><input id="ix-cols" type="number" min="1" max="4" value="${ex ? ex.dataset.cols || 2 : 2}"></label>
      <label class="field"><span>Opvulteken</span><select id="ix-lead"><option value="dot">.......</option><option value="dash">-------</option><option value="line">_______</option><option value="none">(geen)</option></select></label><span></span></div>
      <div class="checks"><label><input type="checkbox" id="ix-right" ${ex && ex.dataset.right === '1' ? 'checked' : ''}> Paginanummers rechts uitlijnen</label>
      <label><input type="checkbox" id="ix-letters" ${ex && ex.dataset.letters === '1' ? 'checked' : ''}> Kopjes per letter</label></div>
      <p class="muted small" style="margin:0">${$$('.xe', App.ed).length} gemarkeerde indexitems in dit document.</p>`,
    buttons: [{ label: 'Item markeren…', left: true, action: () => { setTimeout(() => App.exec('markIndexEntry'), 30); } }, { label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.run(() => {
      let el = App.ed.querySelector('.index-field');
      if (!el) { el = document.createElement('div'); el.className = 'index-field'; el.contentEditable = 'false'; App.insertBlockAtCaret(el, { keepEmpty: true }); }
      el.dataset.cols = App.clamp(parseInt(d.$('#ix-cols').value, 10) || 2, 1, 4);
      el.dataset.right = d.$('#ix-right').checked ? '1' : '0';
      el.dataset.letters = d.$('#ix-letters').checked ? '1' : '0';
      el.dataset.leader = d.$('#ix-lead').value;
      App.layout();
      App.buildIndex(el);
    }) }],
  });
});
App.defEdit('updateIndex', () => {
  const els = $$('.index-field', App.ed);
  if (!els.length) { App.toast('Er is nog geen index. Kies Index invoegen.', 'info'); return; }
  App.layout(); els.forEach(App.buildIndex);
  App.toast('Index bijgewerkt', 'ok');
});

/* ---------- Lijst met rechtsbronnen ---------- */
// Citaat markeren: verborgen TA-markering <span class="ta" data-long data-short data-cat>
App.TOA_CATS = ['Rechtszaken', 'Statuten', 'Andere bronnen', 'Regels', 'Verhandelingen', 'Regelgevingen', 'Grondwettelijke bepalingen'];
App.taText = (d) => `{ TA \\l "${d.long}" \\s "${d.short}" \\c ${+d.cat + 1} }`;
App.taHtml = (d) => `<span class="ta" contenteditable="false" data-long="${App.esc(d.long)}" data-short="${App.esc(d.short)}" data-cat="${d.cat}">${App.esc(App.taText(d))}</span>`;
App.def('markCitation', () => {
  App.restoreRange();
  const r = App.getRange();
  const sel = r && !r.collapsed ? r.toString().trim() : '';
  if (!sel) { App.toast('Selecteer eerst het citaat (bv. de naam van een uitspraak of wet)', 'info'); return; }
  App.dialog({
    title: 'Citaat markeren', wide: true,
    body: `<label class="field"><span>Geselecteerde tekst / lang citaat</span><textarea id="ta-long" style="min-height:60px">${App.esc(sel)}</textarea></label>
      <div class="fields-2"><label class="field"><span>Categorie</span><select id="ta-cat">${App.TOA_CATS.map((c, i) => `<option value="${i}">${c}</option>`).join('')}</select></label>
      <label class="field"><span>Kort citaat</span><input id="ta-short" value="${App.esc(sel.slice(0, 60))}"></label></div>
      <p class="muted small" style="margin:0">De markering is verborgen tekst (zichtbaar met Alles weergeven). Voeg daarna de lijst in met Verwijzingen › Lijst invoegen.</p>`,
    buttons: [
      { label: 'Alles markeren', left: true, action: (d) => { mark(d, true); return false; } },
      { label: 'Sluiten' },
      { label: 'Markeren', primary: true, action: (d) => { mark(d, false); return false; } },
    ],
  });
  const mark = (d, all) => {
    const x = { long: d.$('#ta-long').value.trim().replace(/\s+/g, ' '), short: d.$('#ta-short').value.trim(), cat: d.$('#ta-cat').value };
    if (!x.long) return;
    if (!x.short) x.short = x.long;
    let n = 0;
    App.run(() => {
      if (!all) { const rr = App.getRange() || App.lastRange; if (rr) { App.insertAfterRange(rr, App.taHtml(x)); n = 1; } return; }
      [sel, x.short].filter((v, i, a) => v && a.indexOf(v) === i).forEach((needle) => {
        $$(App.LEAF_BLOCK + ',li,td,th', App.ed).filter((b) => !b.closest('.toc, .index-field, .toa, .footnotes, .endnotes') && !b.querySelector('p,li')).forEach((b) => {
          const t = b.textContent;
          let k = t.indexOf(needle), s = null;
          while (k >= 0) { s = App.pointAt(k, b, true); if (!s.node.parentElement.closest('.xe, .ta, [contenteditable="false"]')) break; k = t.indexOf(needle, k + 1); }
          if (k < 0) return;
          const e = App.pointAt(k + needle.length, b);
          const nx = e.node.nextSibling;
          if (nx && nx.nodeType === 1 && nx.classList.contains('ta')) return;   // al gemarkeerd
          const rr = document.createRange(); rr.setStart(s.node, s.offset); rr.setEnd(e.node, e.offset);
          App.insertAfterRange(rr, App.taHtml(x)); n++;
        });
      });
    });
    App.toast(n === 1 ? 'Citaat gemarkeerd' : `${n} citaten gemarkeerd`, 'ok');
  };
});
App.buildToa = (el) => {
  const cat = el.dataset.cat || 'all';
  const passim = el.dataset.passim === '1';
  const groups = new Map();
  $$('.ta', App.ed).forEach((t) => {
    const c = +t.dataset.cat || 0;
    if (cat !== 'all' && +cat !== c) return;
    if (!groups.has(c)) groups.set(c, new Map());
    const g = groups.get(c), key = t.dataset.long;
    if (!g.has(key)) g.set(key, new Set());
    g.get(key).add(App.pageOfHidden(t));
  });
  let html = '';
  [...groups.keys()].sort((a, b) => a - b).forEach((c) => {
    html += `<p class="toa-cat">${App.esc(App.TOA_CATS[c] || 'Overig')}</p>`;
    [...groups.get(c).entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl')).forEach(([long, pages]) => {
      const ps = [...pages].sort((a, b) => a - b);
      html += `<p class="toa-entry"><span class="t">${App.esc(long)}</span><span class="dots"></span><span class="pg">${passim && ps.length >= 5 ? '<i>passim</i>' : ps.join(', ')}</span></p>`;
    });
  });
  if (!html) html = '<p class="toc-empty">Geen gemarkeerde citaten gevonden. Markeer eerst citaten met Verwijzingen › Citaat markeren.</p>';
  if (el.innerHTML !== html) { el.innerHTML = html; return true; }
  return false;
};
App.def('insertToa', () => {
  App.restoreRange();
  App.dialog({
    title: 'Lijst met rechtsbronnen',
    body: `<label class="field"><span>Categorie</span><select id="toa-cat"><option value="all">Alle</option>${App.TOA_CATS.map((c, i) => `<option value="${i}">${c}</option>`).join('')}</select></label>
      <div class="checks"><label><input type="checkbox" id="toa-passim" checked> Passim gebruiken (bij vijf of meer pagina's)</label></div>
      <p class="muted small" style="margin:0">${$$('.ta', App.ed).length} gemarkeerde citaten in dit document.</p>`,
    buttons: [{ label: 'Citaat markeren…', left: true, action: () => { setTimeout(() => App.exec('markCitation'), 30); } }, { label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.run(() => {
      const el = document.createElement('div');
      el.className = 'toa'; el.contentEditable = 'false';
      el.dataset.cat = d.$('#toa-cat').value; el.dataset.passim = d.$('#toa-passim').checked ? '1' : '0';
      App.insertBlockAtCaret(el, { keepEmpty: true });
      App.layout();
      App.buildToa(el);
    }) }],
  });
});
App.defEdit('updateToa', () => {
  const els = $$('.toa', App.ed);
  if (!els.length) { App.toast('Er is nog geen lijst met rechtsbronnen. Kies Lijst invoegen.', 'info'); return; }
  App.layout(); els.forEach(App.buildToa);
  App.toast('Lijst met rechtsbronnen bijgewerkt', 'ok');
});
// Bij afdrukken alle lijsten bijwerken (zoals Word "velden bijwerken voor afdrukken")
window.addEventListener('beforeprint', () => { if (App.settings.printUpdate === false) return; $$('.index-field', App.ed).forEach(App.buildIndex); $$('.toa', App.ed).forEach(App.buildToa); });
App.ed.addEventListener('click', (e) => {
  const x = e.target.closest && e.target.closest('.xe, .ta');
  if (x && App.ed.contains(x)) App.toast(x.classList.contains('xe') ? 'Indexmarkering — verwijder met Backspace/Delete, wijzigingen zie je na Index bijwerken' : 'Citaatmarkering — wijzigingen zie je na Lijst bijwerken', 'info');
});
// Alt+Shift+X = item markeren, Alt+Shift+I = citaat markeren (zoals Word)
document.addEventListener('keydown', (e) => {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || !App.inRoot(document.activeElement)) return;
  if (e.code === 'KeyX') { e.preventDefault(); App.exec('markIndexEntry'); }
  if (e.code === 'KeyI') { e.preventDefault(); App.exec('markCitation'); }
});
