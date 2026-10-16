/* =========================================================
   Inkt — Verwijzingen: inhoudsopgave, voetnoten, citaten, bijschriften
   ========================================================= */
'use strict';

App.pageOfEl = (el) => {
  if (App.state.view === 'web') return 1;
  const top = (el.getBoundingClientRect().top - App.ed.getBoundingClientRect().top) / App.state.zoom;
  return Math.floor(top / (App.geom().H + App.GAP)) + 1;
};

/* ---------- Inhoudsopgave ---------- */
App.buildToc = (el) => {
  const levels = +el.dataset.levels || 3;
  const hs = $$('h1,h2,h3,h4', App.ed).filter((h) => +h.tagName[1] <= levels && h.textContent.trim() && !h.closest('.toc, .cover') && h.dataset.toc !== '0');
  hs.forEach((h) => { if (!h.id) h.id = App.uid('h-'); });
  let html = `<p class="toc-title">${App.t('Inhoudsopgave')}</p>`;
  html += hs.length
    ? hs.map((h) => `<a class="toc-entry lvl${h.tagName[1]}" href="#${h.id}"><span class="t">${App.esc(h.textContent.trim())}</span><span class="dots"></span><span class="pg">${App.pageOfEl(h)}</span></a>`).join('')
    : '<p class="toc-empty">Geen koppen gevonden. Gebruik de stijlen Kop 1 t/m Kop 3 en klik daarna op Bijwerken.</p>';
  if (el.innerHTML !== html) { el.innerHTML = html; return true; }
  return false;
};
App.defEdit('insertToc', (levels) => {
  App.ed.querySelectorAll('.toc').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toc'; t.contentEditable = 'false'; t.dataset.levels = levels || 3;
  App.insertBlockAtCaret(t, { keepEmpty: true });
  App.buildToc(t);
  // de inhoudsopgave zelf duwt de koppen naar beneden: eerst opnieuw opmaken, dan de paginanummers bepalen
  App.layout(); App.buildToc(t);
});
App.defEdit('updateToc', () => {
  const ts = $$('.toc', App.ed);
  const fs = $$('.tof', App.ed);
  if (!ts.length && !fs.length) { App.toast('Er is nog geen inhoudsopgave. Kies Inhoudsopgave om er een in te voegen.', 'toc'); return; }
  App.layout();
  ts.forEach(App.buildToc); fs.forEach(App.buildTof);
  App.toast('Inhoudsopgave bijgewerkt', 'ok');
});
App.defEdit('removeToc', () => $$('.toc', App.ed).forEach((t) => t.remove()));

/* ---------- Voetnoten ---------- */
App.renumberFootnotes = () => {
  const refs = $$('sup.fn-ref', App.ed);
  refs.forEach((r, i) => { const n = String(i + 1); if (r.textContent !== n) r.textContent = n; });
  let sec = App.ed.querySelector(':scope > .footnotes');
  if (!refs.length) { if (sec) sec.remove(); return; }
  if (!sec) { sec = document.createElement('div'); sec.className = 'footnotes'; sec.contentEditable = 'false'; App.ed.appendChild(sec); }
  const en = App.ed.querySelector(':scope > .endnotes');   // eindnoten (references-extra.js) staan helemaal achteraan
  if (en) { if (sec.nextElementSibling !== en) en.before(sec); } else if (sec !== App.ed.lastElementChild) App.ed.appendChild(sec);
  const prev = sec.previousElementSibling;
  if (!prev || !/^(P|H\d|UL|OL|BLOCKQUOTE)$/.test(prev.tagName)) { const p = document.createElement('p'); p.innerHTML = '<br>'; sec.before(p); }
  const html = `<hr><p class="fn-title">${App.t('Voetnoten')}</p><ol>${refs.map((r) => `<li data-fn="${r.dataset.fn}">${App.esc(r.dataset.note)}</li>`).join('')}</ol>`;
  if (sec.innerHTML !== html) sec.innerHTML = html;
};
App.footnoteDialog = (ref) => {
  App.restoreRange();
  App.dialog({
    title: ref ? 'Voetnoot bewerken' : 'Voetnoot invoegen',
    body: `<label class="field"><span>Tekst van de voetnoot</span><textarea id="fn-t" autofocus>${App.esc(ref ? ref.dataset.note : '')}</textarea></label>`,
    buttons: [
      ...(ref ? [{ label: 'Verwijderen', danger: true, left: true, action: () => App.run(() => { ref.remove(); App.renumberFootnotes(); }) }] : []),
      { label: 'Annuleren' },
      {
        label: 'OK', primary: true, action: (d) => {
          const t = d.$('#fn-t').value.trim();
          if (!t) return false;
          App.run(() => {
            if (ref) ref.dataset.note = t;
            else App.insertHTML(`<sup class="fn-ref" contenteditable="false" data-fn="${App.uid('fn')}" data-note="${App.esc(t)}">#</sup>`);
            App.renumberFootnotes();
          });
        },
      },
    ],
  });
};
App.def('footnote', () => App.footnoteDialog(null));
App.ed.addEventListener('click', (e) => {
  const ref = e.target.closest && e.target.closest('sup.fn-ref');
  if (ref && App.ed.contains(ref)) { e.preventDefault(); App.footnoteDialog(ref); return; }
  const li = e.target.closest && e.target.closest('.footnotes li[data-fn]');
  if (li) { const r = App.ed.querySelector(`sup.fn-ref[data-fn="${li.dataset.fn}"]`); if (r) App.scrollToEl(r); }
});
App.def('nextFootnote', () => {
  const refs = $$('sup.fn-ref', App.ed);
  if (!refs.length) { App.toast('Er zijn geen voetnoten', 'info'); return; }
  const cur = App.lastRange;
  const next = refs.find((r) => cur && cur.comparePoint(r, 0) > 0) || refs[0];
  App.scrollToEl(next);
  App.ed.focus({ preventScroll: true });
  const r = document.createRange(); r.setStartAfter(next); r.collapse(true); App.setRange(r);
});
App.def('showFootnotes', () => {
  const s = App.ed.querySelector('.footnotes');
  if (s) App.scrollToEl(s); else App.toast('Er zijn geen voetnoten', 'info');
});

/* ---------- Citaten & bibliografie ---------- */
App.SOURCE_TYPES = { book: 'Boek', web: 'Website', article: 'Tijdschriftartikel', report: 'Rapport' };
App.authorsOf = (s) => (s.author || 'Onbekend').split(';').map((a) => a.trim()).filter(Boolean);
App.lastName = (a) => (a.includes(',') ? a.split(',')[0] : a.split(' ').slice(-1)[0]).trim();
App.citeText = (s, style = App.doc.meta.citeStyle) => {
  if (!s) return '(Bron ontbreekt)';
  const as = App.authorsOf(s).map(App.lastName);
  const who = as.length > 2 ? `${as[0]} et al.` : as.join(style === 'apa' ? ' & ' : ' en ');
  const y = s.year || 'z.d.';
  if (style === 'mla') return `(${who})`;
  if (style === 'chicago') return `(${who} ${y})`;
  return `(${who}, ${y})`;
};
App.bibEntry = (s, style = App.doc.meta.citeStyle) => {
  const e = App.esc;
  const auth = e(App.authorsOf(s).join(style === 'apa' ? ', ' : '; '));
  const y = e(s.year || 'z.d.');
  const t = e(s.title || 'Zonder titel');
  const pub = e(s.publisher || ''), url = s.url ? ` ${e(s.url)}` : '';
  const acc = s.accessed ? ` (geraadpleegd op ${e(s.accessed)})` : '';
  if (s.type === 'article') {
    const j = e(s.journal || ''), pg = s.pages ? `, ${e(s.pages)}` : '';
    if (style === 'mla') return `${auth}. "${t}." <i>${j}</i>, ${y}${pg}.`;
    if (style === 'chicago') return `${auth}. ${y}. "${t}." <i>${j}</i>${pg}.`;
    return `${auth} (${y}). ${t}. <i>${j}</i>${pg}.${url}`;
  }
  if (s.type === 'web') {
    if (style === 'mla') return `${auth}. "${t}." <i>${pub}</i>, ${y}.${url}${acc}.`;
    if (style === 'chicago') return `${auth}. ${y}. "${t}." ${pub}.${url}.`;
    return `${auth} (${y}). <i>${t}</i>. ${pub}.${url}${acc}`;
  }
  const city = s.city ? e(s.city) + ': ' : '';
  if (style === 'mla') return `${auth}. <i>${t}</i>. ${pub}, ${y}.`;
  if (style === 'chicago') return `${auth}. ${y}. <i>${t}</i>. ${city}${pub}.`;
  return `${auth} (${y}). <i>${t}</i>. ${pub}.${url}`;
};
App.refreshCitations = () => {
  const src = (id) => App.doc.meta.sources.find((s) => s.id === id);
  $$('.cite', App.ed).forEach((c) => { const t = App.citeText(src(c.dataset.src)); if (c.textContent !== t) c.textContent = t; });
  $$('.bibliography', App.ed).forEach(App.buildBib);
};
App.buildBib = (el) => {
  const list = [...App.doc.meta.sources].sort((a, b) => App.lastName(App.authorsOf(a)[0] || '').localeCompare(App.lastName(App.authorsOf(b)[0] || ''), 'nl'));
  const title = App.t(App.doc.meta.citeStyle === 'mla' ? 'Geciteerde werken' : 'Bibliografie');
  const html = `<p class="bib-title">${title}</p>` + (list.length ? list.map((s) => `<p>${App.bibEntry(s)}</p>`).join('') : `<p><i>${App.t('Er zijn nog geen bronnen. Voeg ze toe via Verwijzingen › Bronnen.')}</i></p>`);
  if (el.innerHTML !== html) el.innerHTML = html;
};
App.sourceForm = (s, onSave) => {
  s = s || { id: App.uid('src'), type: 'book' };
  const f = (k, label, ph = '') => `<label class="field"><span>${label}</span><input data-k="${k}" value="${App.esc(s[k] || '')}" placeholder="${ph}"></label>`;
  const d = App.dialog({
    title: s.title ? 'Bron bewerken' : 'Nieuwe bron', wide: true,
    body: `<label class="field"><span>Type bron</span><select data-k="type">${Object.entries(App.SOURCE_TYPES).map(([k, v]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${f('author', 'Auteur(s) — scheid met ;', 'Jansen, P.; De Vries, A.')}
      ${f('title', 'Titel')}
      <div class="fields-3">${f('year', 'Jaar')}${f('publisher', 'Uitgever / website')}${f('city', 'Plaats')}</div>
      <div class="fields-3">${f('journal', 'Tijdschrift')}${f('pages', "Pagina's")}${f('accessed', 'Geraadpleegd op')}</div>
      ${f('url', 'URL', 'https://…')}`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'Opslaan', primary: true, action: (dd) => {
        dd.$$('[data-k]').forEach((i) => { s[i.dataset.k] = i.value.trim(); });
        if (!s.title && !s.author) { App.toast('Vul minstens een auteur of titel in', 'error'); return false; }
        const list = App.doc.meta.sources;
        const i = list.findIndex((x) => x.id === s.id);
        if (i >= 0) list[i] = s; else list.push(s);
        App.markDirty();
        App.refreshCitations();
        onSave && onSave(s);
      },
    }],
  });
  return d;
};
App.def('manageSources', () => {
  const d = App.dialog({
    title: 'Bronnen beheren', wide: true,
    body: `<div class="list-rows" id="src-list"></div>`,
    buttons: [{ label: 'Nieuwe bron', left: true, action: () => { App.sourceForm(null, () => setTimeout(() => App.exec('manageSources'), 50)); } }, { label: 'Sluiten', primary: true }],
  });
  const render = () => {
    const list = App.doc.meta.sources;
    d.$('#src-list').innerHTML = list.length ? list.map((s, i) => `<div class="list-row"><span class="i">${{ book: 'menu_book', web: 'language', article: 'article', report: 'summarize' }[s.type] || 'description'}</span>
      <div class="grow"><b>${App.esc(s.title || '(zonder titel)')}</b><div class="muted small">${App.esc(s.author || '')} · ${App.esc(s.year || 'z.d.')}</div></div>
      <button class="btn small" data-ins="${i}">Citeren</button><button class="btn small" data-ed="${i}">Bewerken</button><button class="btn small danger" data-del="${i}">Verwijderen</button></div>`).join('') : '<div class="list-row muted">Nog geen bronnen. Klik op “Nieuwe bron”.</div>';
  };
  render();
  d.$('#src-list').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const list = App.doc.meta.sources;
    if (b.dataset.ins) { d.close(); App.exec('insertCitation', list[+b.dataset.ins].id); }
    if (b.dataset.ed) { d.close(); App.sourceForm(list[+b.dataset.ed], () => setTimeout(() => App.exec('manageSources'), 50)); }
    if (b.dataset.del) { list.splice(+b.dataset.del, 1); App.markDirty(); App.refreshCitations(); render(); }
  });
});
App.menuBuilders['m-cite'] = () => {
  const list = App.doc.meta.sources;
  return (list.length ? '<div class="menu-title">Bron citeren</div>' + list.map((s) => `<button data-cmd="insertCitation" data-arg="${s.id}"><span class="i">format_quote</span><span><b>${App.esc(App.citeText(s))}</b><small>${App.esc((s.title || '').slice(0, 50))}</small></span></button>`).join('') + '<hr>' : '')
    + '<button data-cmd="newSourceCite"><span class="i">add</span> Nieuwe bron toevoegen…</button><button data-cmd="manageSources"><span class="i">library_books</span> Bronnen beheren…</button>';
};
App.def('newSourceCite', () => { App.saveRange(); App.sourceForm(null, (s) => App.exec('insertCitation', s.id)); });
App.defEdit('insertCitation', (id) => {
  const s = App.doc.meta.sources.find((x) => x.id === id);
  App.insertHTML(`<span class="cite" contenteditable="false" data-src="${id}">${App.esc(App.citeText(s))}</span>&nbsp;`);
});
App.ed.addEventListener('click', (e) => {
  const c = e.target.closest && e.target.closest('.cite');
  if (c && App.ed.contains(c)) {
    const s = App.doc.meta.sources.find((x) => x.id === c.dataset.src);
    if (s) App.sourceForm(s);
  }
});
App.def('citeStyle', (v) => { App.doc.meta.citeStyle = v; App.run(() => App.refreshCitations()); });
App.defEdit('bibliography', () => {
  let b = App.ed.querySelector('.bibliography');
  if (!b) {
    b = document.createElement('div'); b.className = 'bibliography'; b.contentEditable = 'false';
    App.insertBlockAtCaret(b, { keepEmpty: true });
  }
  App.buildBib(b);
});

/* ---------- Bijschriften ---------- */
App.renumberCaptions = () => {
  const counters = {};
  $$('p.caption[data-cap]', App.ed).forEach((p) => {
    const label = p.dataset.cap;
    counters[label] = (counters[label] || 0) + 1;
    const n = p.querySelector('.cap-num');
    if (n && n.textContent !== String(counters[label])) n.textContent = counters[label];
  });
};
App.def('caption', () => {
  const img = App.selectedObj;
  App.restoreRange();
  const inTable = App.curTable && App.curTable();
  App.dialog({
    title: 'Bijschrift invoegen',
    body: `<div class="fields-2">
        <label class="field"><span>Label</span><select id="cp-l"><option ${!inTable ? 'selected' : ''}>Figuur</option><option ${inTable ? 'selected' : ''}>Tabel</option><option>Vergelijking</option><option>Grafiek</option></select></label>
        <label class="field"><span>Positie</span><select id="cp-p"><option value="below" ${!inTable ? 'selected' : ''}>Onder het geselecteerde item</option><option value="above" ${inTable ? 'selected' : ''}>Boven het geselecteerde item</option></select></label></div>
      <label class="field"><span>Bijschrift</span><input id="cp-t" placeholder="bv. Overzicht van de resultaten" autofocus></label>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'Invoegen', primary: true, action: (d) => App.run(() => {
        const label = d.$('#cp-l').value;
        const p = document.createElement('p');
        p.className = 'caption'; p.dataset.cap = label;
        p.innerHTML = `<span class="cap-label">${App.t(label)}</span> <span class="cap-num" contenteditable="false">1</span>: ${App.esc(d.$('#cp-t').value)}`;
        const anchor = img ? App.topBlock(img) : inTable || null;
        if (anchor) { if (d.$('#cp-p').value === 'above') anchor.before(p); else anchor.after(p); App.caretAtEnd(p); }
        else App.insertBlockAtCaret(p, { keepEmpty: true, caretIn: p });
        if (img && img.classList.contains('wrap-center')) p.style.textAlign = 'center';
        App.renumberCaptions();
      }),
    }],
  });
});
App.buildTof = (el) => {
  const label = el.dataset.label || 'Figuur';
  const caps = $$(`p.caption[data-cap="${label}"]`, App.ed);
  const html = `<p class="tof-title">${App.t(`Lijst met ${label === 'Figuur' ? 'afbeeldingen' : label.toLowerCase() + 'len'}`)}</p>` + (caps.length
    ? caps.map((p) => { if (!p.id) p.id = App.uid('cap-'); return `<a class="toc-entry" href="#${p.id}" style="display:flex;gap:4px;color:inherit;text-decoration:none"><span class="t">${App.esc(p.textContent.trim())}</span><span class="dots" style="flex:1;border-bottom:1px dotted #999;transform:translateY(-3px)"></span><span class="pg">${App.pageOfEl(p)}</span></a>`; }).join('')
    : `<p class="toc-empty" style="color:#999;font-style:italic">Geen bijschriften met label “${label}” gevonden.</p>`);
  if (el.innerHTML !== html) el.innerHTML = html;
};
App.def('tableOfFigures', async () => {
  App.saveRange();
  App.dialog({
    title: 'Lijst met afbeeldingen',
    body: `<label class="field"><span>Bijschriftlabel</span><select id="tof-l"><option>Figuur</option><option>Tabel</option><option>Vergelijking</option><option>Grafiek</option></select></label>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'Invoegen', primary: true, action: (d) => App.run(() => {
        const el = document.createElement('div');
        el.className = 'tof toc-like'; el.contentEditable = 'false'; el.dataset.label = d.$('#tof-l').value;
        App.insertBlockAtCaret(el, { keepEmpty: true });
        App.buildTof(el);
      }),
    }],
  });
});
App.ed.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('.tof a[href]');
  if (a) { e.preventDefault(); const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) App.scrollToEl(t); }
});

/* Automatisch bijhouden van nummers en paginanummers */
App.on('layout', App.debounce(() => {
  if (App.state.view === 'web') return;
  App.renumberCaptions();
  $$('.toc', App.ed).forEach(App.buildToc);
  $$('.tof', App.ed).forEach(App.buildTof);
}, 900));
App.on('change', App.debounce(() => { App.renumberFootnotes(); App.renumberCaptions(); }, 500));
