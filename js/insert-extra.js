/* =========================================================
   Inkt — tabblad Invoegen (uitbreidingen): velden, snelonderdelen,
   kruisverwijzingen, kop/voettekst-galerijen, paginanummers, initiaal,
   SmartArt, pictogrammen en schermafbeelding
   ========================================================= */
'use strict';

/* =================== VELDEN =================== */
App.PAGE_FORMATS = [['1', '1, 2, 3, …'], ['-1-', '- 1 -, - 2 -, - 3 -, …'], ['a', 'a, b, c, …'], ['A', 'A, B, C, …'], ['i', 'i, ii, iii, …'], ['I', 'I, II, III, …']];
App.roman = (n) => {
  if (n <= 0) return String(n);
  const t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  t.forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } });
  return s;
};
App.alpha = (n) => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s || '0'; };
App.fmtPageNum = (n) => {
  const pf = App.doc.meta.pageNumFormat || {};
  const v = n + ((pf.start || 1) - 1);
  switch (pf.fmt) {
    case '-1-': return `- ${v} -`;
    case 'a': return App.alpha(v);
    case 'A': return App.alpha(v).toUpperCase();
    case 'i': return App.roman(v);
    case 'I': return App.roman(v).toUpperCase();
    default: return String(v);
  }
};
App.FIELD_TYPES = [
  ['page', 'Page', 'Paginanummer'], ['pages', 'NumPages', 'Aantal pagina\'s'], ['date', 'Date', 'Datum van vandaag'], ['time', 'Time', 'Huidige tijd'],
  ['title', 'Title', 'Titel van het document'], ['author', 'Author', 'Auteur'], ['filename', 'FileName', 'Bestandsnaam'],
  ['created', 'CreateDate', 'Aanmaakdatum'], ['saved', 'SaveDate', 'Laatst opgeslagen'], ['words', 'NumWords', 'Aantal woorden'],
];
(() => {
  const orig = App.hfFieldText;
  App.hfFieldText = (fld, page, count) => {
    const m = App.doc.meta;
    switch (fld) {
      case 'page': return App.fmtPageNum(page);
      case 'author': return m.author || App.settings.author || '';
      case 'filename': return (App.doc.title || 'Naamloos document') + '.docx';
      case 'time': return new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      case 'created': return App.fmtDate(m.created || Date.now());
      case 'saved': return App.fmtDate(m.modified || Date.now());
      case 'words': return String(App.stats ? App.stats.words : App.countText(App.ed.innerText));
      case 'subject': return m.subject || '';
      case 'company': return m.company || '';
      default: return orig(fld, page, count);
    }
  };
  // Afdrukken: paginanummernotatie ook in de @page-kop/voettekst
  const origBoxes = App.hfToMarginBoxes;
  App.hfToMarginBoxes = (html) => {
    const out = origBoxes(html);
    const style = { a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' }[(App.doc.meta.pageNumFormat || {}).fmt];
    if (style) Object.keys(out).forEach((k) => { out[k] = out[k].map((s) => s.replace(/counter\(page\)/g, `counter(page, ${style})`)); });
    return out;
  };
})();
App.fieldHtml = (fld) => `<span class="fld" data-fld="${fld}" contenteditable="false">${App.esc(App.hfFieldText(fld, App.pages.current || 1, App.pages.count || 1))}</span>`;
// Velden in de documenttekst (niet in kop/voettekst) bijwerken
App.updateBodyFields = () => {
  const n = App.pages.count || 1;
  $$('.fld[data-fld]', App.ed).forEach((f) => {
    if (f.dataset.fmt != null && f.dataset.fld === 'date') return;    // eigen datumnotatie (Datum en tijd)
    const page = f.dataset.fld === 'page' ? App.pageOfEl(f) : 1;
    const t = App.hfFieldText(f.dataset.fld, page, n);
    if (t && f.textContent !== t) f.textContent = t;
  });
};

/* =================== KRUISVERWIJZINGEN =================== */
App.XREF_KINDS = {
  heading: { label: 'Kop', items: () => $$('h1,h2,h3,h4', App.ed).filter((h) => h.textContent.trim() && !h.closest('.toc')), name: (el) => el.textContent.trim(), shows: [['text', 'Koptekst'], ['page', 'Paginanummer'], ['above', 'Boven/onder']] },
  bookmark: { label: 'Bladwijzer', items: () => $$('[data-bm]', App.ed), name: (el) => el.dataset.bm, shows: [['text', 'Tekst van bladwijzer'], ['page', 'Paginanummer'], ['above', 'Boven/onder']] },
  figure: { label: 'Figuur', items: () => $$('p.caption[data-cap="Figuur"]', App.ed), name: (el) => el.textContent.trim(), shows: [['text', 'Volledig bijschrift'], ['label', 'Alleen label en nummer'], ['page', 'Paginanummer'], ['above', 'Boven/onder']] },
  table: { label: 'Tabel', items: () => $$('p.caption[data-cap="Tabel"]', App.ed), name: (el) => el.textContent.trim(), shows: [['text', 'Volledig bijschrift'], ['label', 'Alleen label en nummer'], ['page', 'Paginanummer'], ['above', 'Boven/onder']] },
  footnote: { label: 'Voetnoot', items: () => $$('sup.fn-ref', App.ed), name: (el) => el.textContent + '. ' + (el.dataset.note || ''), shows: [['number', 'Voetnootnummer'], ['page', 'Paginanummer'], ['above', 'Boven/onder']] },
};
App.xrefText = (a) => {
  const t = document.getElementById((a.getAttribute('href') || '').slice(1));
  if (!t || !App.ed.contains(t)) return 'Fout! Verwijzingsbron niet gevonden.';
  switch (a.dataset.show) {
    case 'page': return App.fmtPageNum(App.pageOfEl(t));
    case 'above': return (t.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'boven' : 'onder';
    case 'number': return t.textContent.trim();
    case 'label': { const l = t.querySelector('.cap-label'), n = t.querySelector('.cap-num'); return l && n ? `${l.textContent} ${n.textContent}` : t.textContent.trim(); }
    default: return t.dataset.bm && !t.matches('h1,h2,h3,h4,p.caption') ? t.textContent.trim() || t.dataset.bm : t.textContent.trim();
  }
};
App.updateXrefs = () => { $$('a.xref', App.ed).forEach((a) => { const t = App.xrefText(a); if (a.textContent !== t) a.textContent = t; }); };
App.on('layout', App.debounce(() => { if (App.state.view !== 'web') { App.updateBodyFields(); App.updateXrefs(); } }, 700));
App.def('updateFields', () => {
  App.history.flush();
  App.updateBodyFields(); App.updateXrefs(); App.updateDateFields && App.updateDateFields();
  $$('.toc', App.ed).forEach(App.buildToc); $$('.tof', App.ed).forEach(App.buildTof);
  App.changed({ immediate: true });
  App.toast('Velden bijgewerkt', 'ok');
});
document.addEventListener('keydown', (e) => { if (e.key === 'F9' && !e.ctrlKey && !e.altKey) { e.preventDefault(); App.exec('updateFields'); } });
if (!App.history.LOOK.includes('pageNumFormat')) App.history.LOOK.push('pageNumFormat');
App.def('crossReference', () => {
  App.restoreRange();
  let kind = 'heading', sel = 0;
  const d = App.dialog({
    title: 'Kruisverwijzing', wide: true,
    body: `<div class="fields-2">
        <label class="field"><span>Type verwijzing</span><select id="xr-kind">${Object.entries(App.XREF_KINDS).map(([k, x]) => `<option value="${k}">${x.label}</option>`).join('')}</select></label>
        <label class="field"><span>Verwijzing invoegen naar</span><select id="xr-show"></select></label>
      </div>
      <div class="checks"><label><input type="checkbox" id="xr-link" checked> Invoegen als hyperlink</label></div>
      <div class="field"><span id="xr-for">Voor welke kop</span><div class="list-rows xr-list" id="xr-list"></div></div>`,
    buttons: [{ label: 'Sluiten' }, { label: 'Invoegen', primary: true, action: (dd) => {
      const items = App.XREF_KINDS[kind].items();
      const t = items[sel];
      if (!t) { App.toast('Er is niets om naar te verwijzen', 'info'); return false; }
      App.run(() => {
        if (!t.id) t.id = App.uid(kind === 'heading' ? 'h-' : kind === 'footnote' ? 'fnr-' : 'ref-');
        const a = document.createElement('a');
        a.className = 'xref' + (dd.$('#xr-link').checked ? '' : ' nolink');
        a.href = '#' + t.id;
        a.dataset.show = dd.$('#xr-show').value;
        a.contentEditable = 'false';
        a.textContent = App.xrefText(a);
        App.insertHTML(a.outerHTML + '&#8203;');
        App.updateXrefs();
      });
      return false;   // zoals Word: venster blijft open voor meer verwijzingen
    } }],
  });
  const render = () => {
    const K = App.XREF_KINDS[kind];
    d.$('#xr-show').innerHTML = K.shows.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    d.$('#xr-for').textContent = { heading: 'Voor welke kop', bookmark: 'Voor welke bladwijzer', figure: 'Voor welk bijschrift', table: 'Voor welk bijschrift', footnote: 'Voor welke voetnoot' }[kind];
    const items = K.items();
    sel = Math.min(sel, Math.max(0, items.length - 1));
    d.$('#xr-list').innerHTML = items.length ? items.map((el, i) => `<div class="list-row${i === sel ? ' sel' : ''}" data-i="${i}" style="${kind === 'heading' ? `padding-left:${10 + (+el.tagName[1] - 1) * 14}px` : ''}">${App.esc(K.name(el).slice(0, 90))}</div>`).join('') : '<div class="list-row muted">Geen items van dit type in het document</div>';
  };
  d.$('#xr-kind').addEventListener('change', (e) => { kind = e.target.value; sel = 0; render(); });
  d.$('#xr-list').addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (!r) return; sel = +r.dataset.i; d.$$('#xr-list .list-row').forEach((x) => x.classList.toggle('sel', x === r)); });
  d.$('#xr-list').addEventListener('dblclick', () => d.primary.click());
  render();
});
App.ed.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a.xref');
  if (!a || !App.ed.contains(a) || a.classList.contains('nolink')) return;
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation(); const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) { App.scrollToEl(t); App.caretAtEnd(t); } }
}, true);

/* =================== SNELONDERDELEN =================== */
App.autoTexts = () => App.store.get('autotext', []) || [];
App.menuBuilders['m-quickparts'] = () => {
  const at = App.autoTexts();
  return `<div class="menu-title">AutoTekst</div>
    ${at.length ? at.map((t, i) => `<button data-cmd="insertAutoText" data-arg="${i}" title="${App.esc(t.text.slice(0, 200))}"><span class="i">text_snippet</span><span><b>${App.esc(t.name)}</b><small>${App.esc(t.text.slice(0, 60))}</small></span></button>`).join('') : '<div class="menu-empty">Nog geen AutoTekst. Selecteer tekst en kies hieronder “Selectie opslaan in AutoTekst-galerij”.</div>'}
    <button data-cmd="saveAutoText"><span class="i">bookmark_add</span> Selectie opslaan in AutoTekst-galerij…</button>
    <button data-cmd="manageAutoText" ${at.length ? '' : 'disabled'}><span class="i">tune</span> AutoTekst beheren…</button>
    <hr><div class="menu-title">Documenteigenschap</div>
    ${[['title', 'Titel'], ['author', 'Auteur'], ['subject', 'Onderwerp'], ['company', 'Bedrijf'], ['created', 'Aanmaakdatum'], ['filename', 'Bestandsnaam']].map(([k, l]) => `<button data-cmd="insertField" data-arg="${k}"><span class="i">sell</span> ${l}</button>`).join('')}
    <hr><button data-cmd="fieldDialog"><span class="i">data_object</span> Veld…</button>
    <button data-cmd="updateFields"><span class="i">refresh</span> Velden bijwerken <kbd>F9</kbd></button>`;
};
App.defEdit('insertField', (fld) => { App.insertHTML(App.fieldHtml(fld) + '&#8203;'); });
App.def('saveAutoText', async () => {
  const r = App.restoreRange();
  if (!r || r.collapsed) { App.toast('Selecteer eerst de tekst die je wilt opslaan', 'info'); return; }
  const div = document.createElement('div');
  div.appendChild(r.cloneContents());
  const html = div.innerHTML, text = div.textContent.trim();
  const name = await App.prompt('Nieuwe bouwsteen maken', 'Naam', text.split(/\s+/).slice(0, 3).join(' '));
  if (!name) return;
  App.store.set('autotext', [...App.autoTexts().filter((t) => t.name !== name), { name, html, text }].sort((a, b) => a.name.localeCompare(b.name, 'nl')));
  App.toast(`“${name}” opgeslagen in de AutoTekst-galerij`, 'ok');
});
App.defEdit('insertAutoText', (i) => {
  const t = App.autoTexts()[+i];
  if (t) App.insertHTML(App.sanitize ? App.sanitize(t.html) : t.html);
});
App.def('manageAutoText', () => {
  const d = App.dialog({ title: 'AutoTekst beheren', body: '<div class="list-rows" id="at-list"></div>', buttons: [{ label: 'Sluiten', primary: true }] });
  const render = () => {
    const at = App.autoTexts();
    d.$('#at-list').innerHTML = at.length ? at.map((t, i) => `<div class="list-row"><span class="i">text_snippet</span><span class="grow"><b>${App.esc(t.name)}</b><br><span class="muted small">${App.esc(t.text.slice(0, 80))}</span></span><button class="btn small" data-ins="${i}">Invoegen</button><button class="btn small danger" data-del="${i}">Verwijderen</button></div>`).join('') : '<div class="list-row muted">Geen bouwstenen</div>';
  };
  d.$('#at-list').addEventListener('click', (e) => {
    const x = e.target.closest('[data-del]'), y = e.target.closest('[data-ins]');
    if (x) { const at = App.autoTexts(); at.splice(+x.dataset.del, 1); App.store.set('autotext', at); render(); }
    if (y) { d.close(); App.exec('insertAutoText', y.dataset.ins); }
  });
  render();
});
App.def('fieldDialog', () => {
  App.restoreRange();
  let sel = 0;
  const d = App.dialog({
    title: 'Veld',
    body: `<div class="fields-2"><div class="field"><span>Veldnamen</span><div class="list-rows" id="fd-list" style="height:220px">${App.FIELD_TYPES.map(([k, n], i) => `<div class="list-row${i === 0 ? ' sel' : ''}" data-i="${i}" style="cursor:default">${n}</div>`).join('')}</div></div>
      <div class="field"><span>Beschrijving</span><p id="fd-desc" class="small" style="margin:4px 0 10px"></p><span>Voorbeeld</span><div class="preview-box" id="fd-prev" style="min-height:40px"></div></div></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: () => { App.exec('insertField', App.FIELD_TYPES[sel][0]); } }],
  });
  const show = () => { const [k, , desc] = App.FIELD_TYPES[sel]; d.$('#fd-desc').textContent = desc; d.$('#fd-prev').textContent = App.hfFieldText(k, App.pages.current || 1, App.pages.count || 1); };
  d.$('#fd-list').addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (!r) return; sel = +r.dataset.i; d.$$('#fd-list .list-row').forEach((x) => x.classList.toggle('sel', x === r)); show(); });
  d.$('#fd-list').addEventListener('dblclick', () => d.primary.click());
  show();
});

/* =================== KOP- EN VOETTEKSTGALERIJEN =================== */
App.HF_FLD = (f) => `<span class="fld" data-fld="${f}" contenteditable="false"></span>`;
App.HF_DESIGNS = {
  header: [
    ['Leeg', () => '<p>[Typ hier]</p>'],
    ['Leeg (drie kolommen)', () => '<p class="hf-3"><span>[Typ hier]</span><span>[Typ hier]</span><span>[Typ hier]</span></p>'],
    ['Met lijn', () => `<p style="border-bottom:1px solid #404040;padding-bottom:3pt">${App.HF_FLD('title')}</p>`],
    ['Titel en datum', () => `<p class="hf-3"><span>${App.HF_FLD('title')}</span><span></span><span>${App.HF_FLD('date')}</span></p>`],
    ['Accent (rechts)', () => `<p style="text-align:right;color:var(--doc-accent);font-weight:600;letter-spacing:.5pt">${App.HF_FLD('title')}</p>`],
    ['Band', () => `<p style="background:var(--doc-accent);color:#fff;padding:3pt 6pt">${App.HF_FLD('title')}</p>`],
  ],
  footer: [
    ['Leeg', () => '<p>[Typ hier]</p>'],
    ['Leeg (drie kolommen)', () => '<p class="hf-3"><span>[Typ hier]</span><span>[Typ hier]</span><span>[Typ hier]</span></p>'],
    ['Met lijn en paginanummer', () => `<p style="border-top:1px solid #404040;padding-top:3pt;text-align:right">${App.HF_FLD('page')}</p>`],
    ['Pagina X van Y', () => `<p style="text-align:center">Pagina ${App.HF_FLD('page')} van ${App.HF_FLD('pages')}</p>`],
    ['Auteur en pagina', () => `<p class="hf-3"><span>${App.HF_FLD('author')}</span><span></span><span>${App.HF_FLD('page')}</span></p>`],
    ['Band', () => `<p style="background:var(--doc-accent);color:#fff;padding:3pt 6pt;text-align:right">${App.HF_FLD('page')}</p>`],
  ],
};
App.hfMenu = (kind) => {
  const label = kind === 'header' ? 'Koptekst' : 'Voettekst';
  const prev = (html) => { const d = document.createElement('div'); d.innerHTML = html; App.fillFields(d, 1, 1); return d.innerHTML; };
  return `<div class="menu-title">Ingebouwd</div><div class="hf-gal">${App.HF_DESIGNS[kind].map(([n, f], i) => `<button data-cmd="hfDesign" data-arg="${kind}:${i}" title="${n}"><span class="hf-name">${n}</span><span class="hf-thumb doc ${kind}">${prev(f())}</span></button>`).join('')}</div>
    <hr><button data-cmd="${kind === 'header' ? 'editHeader' : 'editFooter'}"><span class="i">edit</span> ${label} bewerken</button>
    <button data-cmd="hfRemove" data-arg="${kind}"><span class="i">delete</span> ${label} verwijderen</button>`;
};
App.menuBuilders['m-header'] = () => App.hfMenu('header');
App.menuBuilders['m-footer'] = () => App.hfMenu('footer');
App.def('hfDesign', (arg) => {
  const [kind, i] = arg.split(':');
  const f = App.HF_DESIGNS[kind][+i];
  if (!f) return;
  if (App.state.hfEditing) App.closeHF(true);
  App.history.flush(); App.history.mark();
  App.doc.meta[kind] = f[1]();
  App._forceSheets = true;
  App.changed({ immediate: true });
  App.exec(kind === 'header' ? 'editHeader' : 'editFooter');
  // tijdelijke tekst [Typ hier] selecteren, zoals een inhoudsbesturingselement in Word
  setTimeout(() => {
    const el = App.state.hfEditing && App.state.hfEditing.el;
    if (!el) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const k = n.data.indexOf('[Typ hier]');
      if (k >= 0) { const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 10); App.setRange(r); break; }
    }
  }, 30);
});
App.def('hfRemove', (kind) => {
  if (App.state.hfEditing) App.closeHF(true);
  App.history.flush(); App.history.mark();
  App.doc.meta[kind] = ''; App.doc.meta[kind + 'First'] = '';
  App._forceSheets = true;
  App.changed({ immediate: true });
  App.toast(kind === 'header' ? 'Koptekst verwijderd' : 'Voettekst verwijderd', 'ok');
});

/* =================== PAGINANUMMERS OPMAKEN =================== */
App.menuBuilders['m-pagenum'] = () => $('#m-pagenum').innerHTML.replace('<hr>', '<hr><button data-cmd="pageNumFormat"><span class="i">format_list_numbered</span> Paginanummers opmaken…</button>');
App.def('pageNumFormat', () => {
  const pf = App.doc.meta.pageNumFormat || {};
  App.dialog({
    title: 'Paginanummers opmaken',
    body: `<label class="field"><span>Getalnotatie</span><select id="pn-fmt">${App.PAGE_FORMATS.map(([k, l]) => `<option value="${k}" ${k === (pf.fmt || '1') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="sd-h">Paginanummering</div>
      <div class="checks acd-checks">
        <label><input type="radio" name="pn-st" value="cont" ${(pf.start || 1) === 1 ? 'checked' : ''}> Doorgaan vanaf vorige sectie</label>
        <label><input type="radio" name="pn-st" value="at" ${(pf.start || 1) !== 1 ? 'checked' : ''}> Beginnen bij: <input id="pn-start" type="number" min="0" value="${pf.start || 1}" style="width:64px;height:24px;margin-left:6px"></label>
      </div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
      const at = d.$('input[name="pn-st"]:checked').value === 'at';
      App.history.flush(); App.history.mark();
      App.doc.meta.pageNumFormat = { fmt: d.$('#pn-fmt').value, start: at ? (parseInt(d.$('#pn-start').value, 10) || 1) : 1 };
      App.changed({ immediate: true });
      App._forceSheets = true;
      App.layout();
      App.updateBodyFields();
    } }],
  });
});

/* =================== INITIAAL =================== */
App.menuBuilders['m-dropcap'] = () => `<button data-cmd="dropCapMode" data-arg="none"><span class="i">format_clear</span> Geen</button>
  <button data-cmd="dropCapMode" data-arg="drop"><span class="i">format_size</span> Verwerkt</button>
  <button data-cmd="dropCapMode" data-arg="margin"><span class="i">format_indent_increase</span> In marge</button>
  <hr><button data-cmd="dropCapDialog"><span class="i">tune</span> Opties voor initialen…</button>`;
App.dropCapBlock = () => { const b = App.getSelectedBlocks()[0]; return b && b.tagName === 'P' ? b : null; };
App.setDropCap = (b, o) => {
  b.classList.toggle('dropcap', o.mode !== 'none');
  b.classList.toggle('dc-margin', o.mode === 'margin');
  ['--dc-lines', '--dc-font', '--dc-dist'].forEach((v) => b.style.removeProperty(v));
  if (o.mode !== 'none') {
    if (o.lines && +o.lines !== 3) b.style.setProperty('--dc-lines', o.lines);
    if (o.font) b.style.setProperty('--dc-font', App.fontStack(o.font));
    if (o.dist) b.style.setProperty('--dc-dist', o.dist + 'cm');
  }
  if (!b.getAttribute('style')) b.removeAttribute('style');
};
App.defEdit('dropCapMode', (mode) => {
  const b = App.dropCapBlock();
  if (!b) { App.toast('Plaats de cursor in een gewone alinea', 'info'); return; }
  App.setDropCap(b, { mode, lines: b.style.getPropertyValue('--dc-lines') || 3 });
});
App.def('dropCapDialog', () => {
  App.restoreRange();
  const b = App.dropCapBlock();
  if (!b) { App.toast('Plaats de cursor in een gewone alinea', 'info'); return; }
  const mode = !b.classList.contains('dropcap') ? 'none' : b.classList.contains('dc-margin') ? 'margin' : 'drop';
  const cur = { lines: b.style.getPropertyValue('--dc-lines').trim() || 3, dist: parseFloat(b.style.getPropertyValue('--dc-dist')) || 0 };
  App.dialog({
    title: 'Initiaal',
    body: `<div class="sd-h">Positie</div><div class="ba-set" id="dc-pos" style="flex-direction:row">${[['none', 'Geen', 'format_clear'], ['drop', 'Verwerkt', 'format_size'], ['margin', 'In marge', 'format_indent_increase']].map(([k, l, i]) => `<button class="ba-opt${k === mode ? ' on' : ''}" data-s="${k}"><span class="i">${i}</span>${l}</button>`).join('')}</div>
      <div class="sd-h">Opties</div>
      <label class="field"><span>Lettertype</span><select id="dc-font"><option value="">(zoals koppen)</option>${App.FONTS.map(([n]) => `<option>${n}</option>`).join('')}</select></label>
      <div class="fields-2"><label class="field"><span>Aantal regels voor initiaal</span><input id="dc-lines" type="number" min="1" max="10" value="${cur.lines}"></label>
      <label class="field"><span>Afstand tot tekst (cm)</span><input id="dc-dist" type="number" min="0" step="0.1" value="${cur.dist}"></label></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.run(() => {
      App.setDropCap(b, { mode: d.$('#dc-pos .on').dataset.s, lines: +d.$('#dc-lines').value || 3, font: d.$('#dc-font').value, dist: App.parseNum(d.$('#dc-dist').value) || 0 });
    }) }],
    onOpen: (d) => d.$('#dc-pos').addEventListener('click', (e) => { const o = e.target.closest('.ba-opt'); if (o) d.$$('#dc-pos .ba-opt').forEach((x) => x.classList.toggle('on', x === o)); }),
  });
});

/* =================== SMARTART =================== */
App.saParse = (text) => {
  const root = { children: [] }, stack = [{ node: root, level: -1 }];
  String(text || '').split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const m = line.match(/^(\s*)([-*•]\s+)?(.*)$/);
    const ind = m[1].replace(/\t/g, '  ').length;
    const level = Math.floor(ind / 2) + (m[2] && !ind ? 0 : 0);
    const node = { text: m[3].trim(), children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, level });
  });
  return root.children;
};
App.saColors = (scheme, n) => {
  const acc = (getComputedStyle(App.ed).getPropertyValue('--doc-accent').trim() || '#156082');
  const base = acc.length === 7 ? acc : '#156082';
  if (scheme === 'colorful') return Array.from({ length: n }, (_, i) => App.CHART_COLORS[i % App.CHART_COLORS.length]);
  if (scheme === 'dark') return Array.from({ length: n }, () => '#2a2a35');
  if (scheme === 'gradient') return Array.from({ length: n }, (_, i) => App.mix(base, n > 1 ? -0.35 + (i / (n - 1)) * 0.75 : 0));
  return Array.from({ length: n }, () => base);
};
App.saText = (txt, cx, cy, w, h, fs, color, bold) => {
  const words = String(txt).split(/\s+/).filter(Boolean);
  const maxC = Math.max(4, Math.floor(w / (fs * 0.55)));
  const lines = [];
  let cur = '';
  words.forEach((wd) => { if ((cur + ' ' + wd).trim().length > maxC && cur) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); });
  if (cur) lines.push(cur);
  const maxL = Math.max(1, Math.floor(h / (fs * 1.2)));
  if (lines.length > maxL) { lines.length = maxL; lines[maxL - 1] = lines[maxL - 1].replace(/.{0,2}$/, '…'); }
  const y0 = cy - ((lines.length - 1) * fs * 1.2) / 2 + fs * 0.35;
  return `<text x="${cx}" text-anchor="middle" font-size="${fs}" fill="${color}"${bold ? ' font-weight="600"' : ''}>${lines.map((l, i) => `<tspan x="${cx}" y="${(y0 + i * fs * 1.2).toFixed(1)}">${App.esc(l)}</tspan>`).join('')}</text>`;
};
App.saNodeText = (n) => n.text + (n.children.length ? ': ' + n.children.map((c) => c.text).join(', ') : '');
App.SA_LAYOUTS = {
  blocks: { cat: 'Lijst', name: 'Basisblokkenlijst' },
  vbullets: { cat: 'Lijst', name: 'Verticale lijst met opsommingstekens' },
  process: { cat: 'Proces', name: 'Basisproces' },
  chevron: { cat: 'Proces', name: 'Proces met chevrons' },
  cycle: { cat: 'Cyclus', name: 'Basiscyclus' },
  org: { cat: 'Hiërarchie', name: 'Organigram' },
  venn: { cat: 'Relatie', name: 'Basis-Venndiagram' },
  radial: { cat: 'Relatie', name: 'Basisradiaal' },
  matrix: { cat: 'Matrix', name: 'Basismatrix' },
  pyramid: { cat: 'Piramide', name: 'Basispiramide' },
};
App.SA_CATS = ['Lijst', 'Proces', 'Cyclus', 'Hiërarchie', 'Relatie', 'Matrix', 'Piramide'];
App.smartArtSvg = (spec) => {
  const items = App.saParse(spec.text);
  const W = 640, F = 'Aptos, Calibri, Segoe UI, Arial, sans-serif';
  const n = Math.max(1, items.length);
  const col = App.saColors(spec.colors, n + 4);
  let H = 360, s = '';
  const T = App.saText;
  const L = spec.layout;
  if (!items.length) s = `<text x="${W / 2}" y="180" text-anchor="middle" fill="#999" font-size="16">Typ tekst om de SmartArt te vullen</text>`;
  else if (L === 'blocks') {
    const cols = Math.min(n, n <= 4 ? n : n <= 6 ? 3 : 4), rows = Math.ceil(n / cols), g = 12;
    const bw = (W - g * (cols + 1)) / cols, bh = Math.min(120, (H - g * (rows + 1)) / rows);
    H = rows * bh + g * (rows + 1);
    items.forEach((it, i) => { const x = g + (i % cols) * (bw + g), y = g + Math.floor(i / cols) * (bh + g); s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${col[i]}"/>` + T(App.saNodeText(it), x + bw / 2, y + bh / 2, bw - 16, bh - 12, 16, '#fff'); });
  } else if (L === 'vbullets') {
    let y = 8;
    items.forEach((it, i) => {
      s += `<rect x="8" y="${y}" width="${W - 16}" height="40" rx="5" fill="${col[i]}"/>` + `<text x="24" y="${y + 26}" font-size="17" fill="#fff" font-weight="600">${App.esc(it.text)}</text>`;
      y += 46;
      if (it.children.length) {
        const h = it.children.length * 22 + 10;
        s += `<rect x="8" y="${y - 4}" width="${W - 16}" height="${h}" fill="${App.mix(col[i].length === 7 ? col[i] : '#156082', 0.85)}"/>`;
        it.children.forEach((c, k) => { s += `<text x="34" y="${y + 14 + k * 22}" font-size="14" fill="#333">• ${App.esc(c.text)}</text>`; });
        y += h + 4;
      }
      y += 6;
    });
    H = y;
  } else if (L === 'process' || L === 'chevron') {
    const g = L === 'chevron' ? -6 : 34, bw = (W - 16 - g * (n - 1)) / n, bh = L === 'chevron' ? 90 : 120, y = 20;
    H = bh + 40;
    items.forEach((it, i) => {
      const x = 8 + i * (bw + g);
      if (L === 'chevron') {
        const t = 26, first = i === 0;
        s += `<polygon points="${x},${y} ${x + bw - t},${y} ${x + bw},${y + bh / 2} ${x + bw - t},${y + bh} ${x},${y + bh} ${first ? x : x + t},${y + bh / 2}" fill="${col[i]}"/>` + T(App.saNodeText(it), x + bw / 2 + (first ? -6 : 6), y + bh / 2, bw - t * 2, bh - 10, 14, '#fff');
      } else {
        s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${col[i]}"/>` + T(App.saNodeText(it), x + bw / 2, y + bh / 2, bw - 14, bh - 12, 15, '#fff');
        if (i < n - 1) { const ax = x + bw + 6, ay = y + bh / 2; s += `<polygon points="${ax},${ay - 9} ${ax + 13},${ay - 9} ${ax + 13},${ay - 16} ${ax + 22},${ay} ${ax + 13},${ay + 16} ${ax + 13},${ay + 9} ${ax},${ay + 9}" fill="${App.mix(col[i].length === 7 ? col[i] : '#156082', 0.55)}"/>`; }
      }
    });
  } else if (L === 'cycle') {
    H = 400; const cx = W / 2, cy = H / 2, R = 140, r = Math.min(60, 360 / n);
    items.forEach((it, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const am = a + Math.PI / n, axp = cx + R * Math.cos(am), ayp = cy + R * Math.sin(am), deg = (am * 180) / Math.PI + 90;
      if (n > 1) s += `<polygon points="-9,-7 5,-7 5,-13 14,0 5,13 5,7 -9,7" transform="translate(${axp.toFixed(1)},${ayp.toFixed(1)}) rotate(${deg.toFixed(1)})" fill="${App.mix(col[i].length === 7 ? col[i] : '#156082', 0.5)}"/>`;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col[i]}"/>` + T(it.text, x, y, r * 1.6, r * 1.4, 14, '#fff');
    });
  } else if (L === 'org') {
    const leaves = (nd) => (nd.children.length ? nd.children.reduce((a, c) => a + leaves(c), 0) : 1);
    const depth = (nd) => 1 + (nd.children.length ? Math.max(...nd.children.map(depth)) : 0);
    const total = items.reduce((a, c) => a + leaves(c), 0), D = Math.max(...items.map(depth));
    const unit = (W - 16) / total, bh = 46, vg = 34, bw = Math.min(150, unit - 10);
    H = D * bh + (D - 1) * vg + 16;
    const place = (nd, x0, lvl, ci) => {
      const w = leaves(nd) * unit, cx = x0 + w / 2, y = 8 + lvl * (bh + vg);
      let kx = x0;
      nd.children.forEach((c) => { const cw = leaves(c) * unit, ccx = kx + cw / 2; s += `<path d="M${cx},${y + bh} V${y + bh + vg / 2} H${ccx} V${y + bh + vg}" fill="none" stroke="#888" stroke-width="1.5"/>`; place(c, kx, lvl + 1, ci); kx += cw; });
      s += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${lvl ? App.mix(col[ci].length === 7 ? col[ci] : '#156082', lvl * 0.18) : col[ci]}"/>` + T(nd.text, cx, y + bh / 2, bw - 10, bh - 6, 13, '#fff');
    };
    let x = 8; items.forEach((it, i) => { place(it, x, 0, i); x += leaves(it) * unit; });
  } else if (L === 'venn') {
    const m = Math.min(n, 4), cx = W / 2, cy = 180, R = 105, off = m === 1 ? 0 : 70;
    items.slice(0, m).forEach((it, i) => { const a = -Math.PI / 2 + (i / m) * Math.PI * 2, x = cx + off * Math.cos(a), y = cy + off * Math.sin(a); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}" fill="${col[i]}" fill-opacity=".55"/>`; });
    items.slice(0, m).forEach((it, i) => { const a = -Math.PI / 2 + (i / m) * Math.PI * 2, x = cx + (off + 45) * Math.cos(a), y = cy + (off + 45) * Math.sin(a); s += T(it.text, x, y, 110, 70, 15, '#fff', true); });
  } else if (L === 'radial') {
    const center = items.length === 1 ? items[0] : { text: items[0].text, children: items[0].children.length ? items[0].children : items.slice(1) };
    const kids = center.children, k = Math.max(1, kids.length), cx = W / 2, cy = 190, R = 135, r = 48;
    H = 380;
    kids.forEach((c, i) => { const a = -Math.PI / 2 + (i / k) * Math.PI * 2; s += `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" stroke="#999" stroke-width="2"/>`; });
    s += `<circle cx="${cx}" cy="${cy}" r="62" fill="${col[0]}"/>` + T(center.text, cx, cy, 110, 90, 16, '#fff', true);
    kids.forEach((c, i) => { const a = -Math.PI / 2 + (i / k) * Math.PI * 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col[(i + 1) % col.length]}"/>` + T(c.text, x, y, r * 1.6, r * 1.4, 13, '#fff'); });
  } else if (L === 'matrix') {
    const q = items.slice(0, 4), g = 8, bw = (W - 3 * g) / 2, bh = 150;
    H = bh * 2 + g * 3;
    q.forEach((it, i) => { const x = g + (i % 2) * (bw + g), y = g + Math.floor(i / 2) * (bh + g); s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${col[i]}"/>` + T(App.saNodeText(it), x + bw / 2, y + bh / 2, bw - 20, bh - 16, 16, '#fff'); });
  } else if (L === 'pyramid') {
    H = 380; const top = 10, bot = H - 10, lh = (bot - top) / n, cx = W / 2, half = 260;
    items.forEach((it, i) => {
      const y0 = top + i * lh, y1 = y0 + lh, w0 = (half * (y0 - top)) / (bot - top), w1 = (half * (y1 - top)) / (bot - top);
      s += `<polygon points="${cx - w0},${y0} ${cx + w0},${y0} ${cx + w1},${y1 - 3} ${cx - w1},${y1 - 3}" fill="${col[i]}"/>` + T(it.text, cx, y0 + lh / 2 + (i === 0 ? lh * 0.15 : 0), Math.max(60, w1 * 1.3), lh - 8, 15, '#fff');
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(H)}" width="${W}" height="${Math.ceil(H)}" font-family="${F}">${s}</svg>`;
};
App.SA_SAMPLE = 'Plan\nUitvoering\n  Taak A\n  Taak B\nControle\nVerbetering';
App.smartArtDialog = (img) => {
  App.restoreRange();
  const spec = img ? JSON.parse(img.dataset.smartart) : { layout: 'process', text: App.SA_SAMPLE, colors: 'accent' };
  let layout = spec.layout, cat = App.SA_LAYOUTS[layout].cat;
  const thumb = (k) => App.smartArtSvg({ layout: k, text: 'Een\nTwee\n  a\nDrie', colors: 'accent' });
  const d = App.dialog({
    title: img ? 'SmartArt bewerken' : 'SmartArt-afbeelding kiezen', xwide: true,
    body: `<div class="sa-wrap">
      <div class="sa-cats" id="sa-cats">${['Alle', ...App.SA_CATS].map((c) => `<button data-c="${c}">${c}</button>`).join('')}</div>
      <div class="sa-layouts" id="sa-layouts"></div>
      <div class="sa-side">
        <label class="field"><span>Typ hier je tekst (één item per regel; inspringen met Tab = lager niveau)</span><textarea id="sa-text" spellcheck="false">${App.esc(spec.text)}</textarea></label>
        <label class="field"><span>Kleuren</span><select id="sa-colors">${[['accent', 'Accentkleur'], ['gradient', 'Accentkleur, verloop'], ['colorful', 'Kleurrijk'], ['dark', 'Donker']].map(([k, l]) => `<option value="${k}" ${k === spec.colors ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="preview-box sa-prev" id="sa-prev"></div>
        <div class="muted small" id="sa-name"></div>
      </div></div>`,
    buttons: [{ label: 'Annuleren' }, { label: img ? 'Bijwerken' : 'OK', primary: true, action: (dd) => {
      const sp = { layout, text: dd.$('#sa-text').value, colors: dd.$('#sa-colors').value };
      const src = App.svgUrl(App.smartArtSvg(sp));
      const alt = 'SmartArt: ' + App.SA_LAYOUTS[layout].name;
      if (img) { App.run(() => { img.src = src; img.dataset.smartart = JSON.stringify(sp); img.alt = alt; }); App.selectObj(img); }
      else App.insertImageSrc(src, { width: Math.min(520, App.contentWidth()), alt, attrs: `data-smartart="${App.esc(JSON.stringify(sp))}"` });
    } }],
    noEnter: true,
  });
  const renderLayouts = () => {
    d.$$('#sa-cats button').forEach((b) => b.classList.toggle('on', b.dataset.c === cat));
    d.$('#sa-layouts').innerHTML = Object.entries(App.SA_LAYOUTS).filter(([, l]) => cat === 'Alle' || l.cat === cat)
      .map(([k, l]) => `<button data-l="${k}" class="${k === layout ? 'on' : ''}" title="${l.name}">${thumb(k)}<span>${l.name}</span></button>`).join('');
  };
  const prev = () => {
    d.$('#sa-prev').innerHTML = App.smartArtSvg({ layout, text: d.$('#sa-text').value, colors: d.$('#sa-colors').value });
    d.$('#sa-name').textContent = App.SA_LAYOUTS[layout].name;
  };
  d.$('#sa-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; renderLayouts(); } });
  d.$('#sa-layouts').addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; layout = b.dataset.l; d.$$('#sa-layouts button').forEach((x) => x.classList.toggle('on', x === b)); prev(); });
  const ta = d.$('#sa-text');
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const s = ta.selectionStart, ls = ta.value.lastIndexOf('\n', s - 1) + 1;
    if (e.shiftKey) { if (ta.value.slice(ls, ls + 2) === '  ') { ta.value = ta.value.slice(0, ls) + ta.value.slice(ls + 2); ta.selectionStart = ta.selectionEnd = Math.max(ls, s - 2); } }
    else { ta.value = ta.value.slice(0, ls) + '  ' + ta.value.slice(ls); ta.selectionStart = ta.selectionEnd = s + 2; }
    prev();
  });
  d.body.addEventListener('input', prev); d.body.addEventListener('change', prev);
  renderLayouts(); prev();
};
App.def('insertSmartArt', () => App.smartArtDialog(null));
App.def('editSmartArt', () => { if (App.selectedObj && App.selectedObj.dataset.smartart) App.smartArtDialog(App.selectedObj); });
App.ed.addEventListener('dblclick', (e) => { if (e.target.tagName === 'IMG' && e.target.dataset.smartart) { App.selectObj(e.target); App.exec('editSmartArt'); } });

/* =================== PICTOGRAMMEN =================== */
App.ICONS = ('home:huis woning thuis|person:persoon mens gebruiker|group:groep mensen team|groups:team vergadering|favorite:hart liefde favoriet|star:ster favoriet|check_circle:vinkje goed klaar|cancel:kruis fout annuleren|' +
  'warning:waarschuwing let op|info:informatie|help:vraag help|lightbulb:idee lamp|bolt:bliksem energie|schedule:klok tijd|calendar_month:kalender agenda datum|event:afspraak|alarm:wekker|hourglass_empty:zandloper wachten|' +
  'mail:mail post brief|call:telefoon bellen|chat:chat gesprek bericht|forum:discussie|send:versturen|share:delen|link:koppeling link|public:wereld internet|language:taal web|wifi:wifi netwerk|' +
  'shopping_cart:winkelwagen kopen|payments:geld betalen|euro:euro geld|savings:spaarpot sparen|account_balance:bank|credit_card:betaalkaart|receipt_long:bon factuur|trending_up:stijging groei|trending_down:daling|bar_chart:grafiek staaf|pie_chart:taartdiagram|show_chart:lijngrafiek|' +
  'school:school onderwijs|menu_book:boek lezen|science:wetenschap lab|calculate:rekenmachine|psychology:hoofd denken|work:werk koffer|business_center:zaken|apartment:gebouw flat|factory:fabriek|store:winkel|' +
  'directions_car:auto|directions_bike:fiets|directions_bus:bus|train:trein|flight:vliegtuig reizen|local_shipping:vrachtwagen bezorging|sailing:boot zeilen|map:kaart|location_on:locatie plaats|explore:kompas|' +
  'restaurant:restaurant eten|local_cafe:koffie cafe|cake:taart verjaardag|local_pizza:pizza|nutrition:voeding fruit|sports_soccer:voetbal sport|fitness_center:fitness sport|pool:zwemmen|hiking:wandelen|' +
  'pets:dier huisdier poot|park:park boom natuur|eco:blad milieu duurzaam|water_drop:water druppel|sunny:zon|cloud:wolk|ac_unit:sneeuw kou|thunderstorm:onweer|local_florist:bloem|forest:bos|' +
  'medical_services:dokter medisch|favorite_border:hart|healing:pleister|vaccines:vaccin|local_hospital:ziekenhuis|accessible:rolstoel toegankelijk|child_care:kind baby|elderly:ouderen|' +
  'computer:computer|laptop:laptop|smartphone:telefoon mobiel|tablet:tablet|keyboard:toetsenbord|mouse:muis|print:printer afdrukken|camera_alt:camera foto|videocam:video|mic:microfoon|headphones:koptelefoon muziek|music_note:muziek noot|' +
  'cloud_upload:uploaden|download:downloaden|folder:map|description:document bestand|attach_file:bijlage|search:zoeken|settings:instellingen tandwiel|build:gereedschap|construction:bouw|handyman:klusjes|' +
  'lock:slot beveiliging|lock_open:open slot|key:sleutel|security:schild veiligheid|visibility:oog zien|fingerprint:vingerafdruk|verified:geverifieerd|gavel:hamer recht|balance:weegschaal evenwicht|' +
  'flag:vlag doel|emoji_events:trofee prijs winnen|military_tech:medaille|rocket_launch:raket lancering|target:doel roos|extension:puzzel|hub:netwerk verbinding|account_tree:organigram structuur|' +
  'thumb_up:duim omhoog goed|thumb_down:duim omlaag|handshake:handdruk afspraak|celebration:feest|sentiment_satisfied:blij smiley|sentiment_dissatisfied:verdrietig|mood:lach|' +
  'arrow_forward:pijl rechts|arrow_back:pijl links|arrow_upward:pijl omhoog|arrow_downward:pijl omlaag|refresh:vernieuwen cyclus|sync:synchroniseren|autorenew:herhalen|swap_horiz:wisselen|' +
  'edit:potlood bewerken|draw:tekenen|brush:kwast verf|palette:palet kleur|photo:foto afbeelding|movie:film|theater_comedy:theater|newspaper:krant nieuws|campaign:megafoon aankondiging|' +
  'inventory_2:doos archief|package_2:pakket|recycling:recycling afval|delete:prullenbak verwijderen|bed:bed slapen|chair:stoel|kitchen:keuken|shower:douche|cottage:huisje|church:kerk|castle:kasteel|stadium:stadion').split('|').map((x) => { const [n, k] = x.split(':'); return { n, k: n.replace(/_/g, ' ') + ' ' + k }; });
App.iconToPng = async (name, color, size = 256) => {
  try { await document.fonts.load(`${size}px "Material Symbols Outlined"`, name); } catch { /* niets */ }
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.font = `${size}px "Material Symbols Outlined"`;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, size / 2, size / 2);
  return cv.toDataURL('image/png');
};
App.def('insertIcons', () => {
  App.restoreRange();
  const picked = new Set();
  const d = App.dialog({
    title: 'Pictogrammen invoegen', xwide: true,
    body: `<div class="ic-top"><div class="nav-search ic-search"><span class="i">search</span><input id="ic-q" placeholder="Zoeken naar pictogrammen" autocomplete="off"></div>
      <label class="sd-mini">Kleur <input type="color" id="ic-color" value="${(getComputedStyle(App.ed).getPropertyValue('--doc-accent').trim() || '#156082')}"></label></div>
      <div class="ic-grid" id="ic-grid"></div><div class="muted small" id="ic-count"></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'Invoegen', primary: true, action: (dd) => {
      if (!picked.size) { App.toast('Kies eerst een of meer pictogrammen', 'info'); return false; }
      const color = dd.$('#ic-color').value;
      (async () => {
        let last = null;
        for (const n of picked) {
          const src = await App.iconToPng(n, color);
          if (last && last.isConnected) { App.deselectObj(); const r = document.createRange(); r.setStartAfter(last); r.collapse(true); App.setRange(r); }
          last = await App.insertImageSrc(src, { width: 96, alt: n.replace(/_/g, ' '), attrs: `data-icon="${n}" data-icon-color="${color}"` });
        }
      })();
    } }],
  });
  const render = () => {
    const q = d.$('#ic-q').value.trim().toLowerCase();
    const list = App.ICONS.filter((i) => !q || i.k.includes(q));
    d.$('#ic-grid').innerHTML = list.map((i) => `<button data-n="${i.n}" class="${picked.has(i.n) ? 'on' : ''}" title="${i.k}"><span class="i">${i.n}</span></button>`).join('') || '<div class="muted" style="padding:20px">Geen pictogrammen gevonden</div>';
    d.$('#ic-count').textContent = picked.size ? `${picked.size} geselecteerd` : `${list.length} pictogrammen`;
    d.$('#ic-grid').style.color = d.$('#ic-color').value;
  };
  d.$('#ic-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (!b) return; if (picked.has(b.dataset.n)) picked.delete(b.dataset.n); else picked.add(b.dataset.n); render(); });
  d.$('#ic-grid').addEventListener('dblclick', (e) => { const b = e.target.closest('[data-n]'); if (b) { picked.add(b.dataset.n); d.primary.click(); } });
  d.body.addEventListener('input', render);
  render();
});
App.objCmd('iconColor', async (img, c) => { if (!img.dataset.icon) return; img.src = await App.iconToPng(img.dataset.icon, c); img.dataset.iconColor = c; });

/* =================== SCHERMAFBEELDING =================== */
App.menuBuilders['m-screenshot'] = () => `<div class="menu-title">Schermafbeelding</div>
  <button data-cmd="screenshot"><span class="i">screenshot_monitor</span><span><b>Scherm of venster…</b><small>Kies een scherm, venster of tabblad om vast te leggen</small></span></button>
  <button data-cmd="screenshot" data-arg="clip"><span class="i">screenshot_region</span><span><b>Schermknipsel</b><small>Leg vast en snij daarna bij</small></span></button>`;
App.def('screenshot', async (mode) => {
  App.saveRange();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { App.toast('Schermafbeeldingen maken wordt hier niet ondersteund.', 'error', { ms: 4000 }); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
  catch (e) { App.toast(e && e.name === 'NotAllowedError' ? 'Schermafbeelding geannuleerd' : 'Kon geen schermafbeelding maken: ' + ((e && e.message) || e), 'info', { ms: 4000 }); return; }
  try {
    const v = document.createElement('video');
    v.srcObject = stream; v.muted = true; v.playsInline = true;
    await v.play();
    await new Promise((r) => setTimeout(r, 300));
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d').drawImage(v, 0, 0);
    const src = await App.shrinkDataUrl(cv.toDataURL('image/png'), 'image/png');
    App.restoreRange();
    const img = await App.insertImageSrc(src, { alt: 'Schermafbeelding' });
    if (img && mode === 'clip') setTimeout(() => App.exec('imgCrop'), 50);
  } catch (e) {
    App.toast('Kon geen schermafbeelding maken: ' + e.message, 'error');
  } finally { stream.getTracks().forEach((t) => t.stop()); }
});
