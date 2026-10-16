/* =========================================================
   Inkt — bestanden: opslaan, openen, exporteren, sjablonen, Bestand-scherm
   ========================================================= */
'use strict';

App.MAMMOTH = 'vendor/mammoth.browser.min.js';

/* ---------- Schone HTML (zonder schermhulpjes) ---------- */
App.cleanHtml = (forExport) => {
  const c = App.ed.cloneNode(true);
  if (forExport) c.querySelectorAll('img[data-orig], img[data-base]').forEach((im) => { im.removeAttribute('data-orig'); im.removeAttribute('data-base'); });
  if (App.clearRows) App.clearRows(c);
  c.querySelectorAll('[data-pg]').forEach((el) => {
    el.style.marginTop = el.dataset.pgOrig || '';
    el.removeAttribute('data-pg'); el.removeAttribute('data-pg-orig');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
  c.querySelectorAll('.cmt.active').forEach((el) => el.classList.remove('active'));
  c.querySelectorAll('.__sel').forEach((el) => el.remove());
  // markeringen van niet-geplaatste (lege) opmerkingen niet bewaren
  (App.doc.meta.comments || []).filter((x) => x.draft && !(x.text || '').trim()).forEach((x) => {
    c.querySelectorAll(`.cmt[data-cid="${x.id}"]`).forEach((a) => App.unwrapEl(a));
  });
  // achtergebleven hulptekens van opmaak zonder selectie opruimen
  const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  const zw = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.data.indexOf('\u200B') >= 0) zw.push(n);
  zw.forEach((n) => {
    n.data = n.data.replace(/\u200B/g, '');
    const p = n.parentNode;
    if (!n.length) { n.remove(); if (p && p.tagName === 'SPAN' && !p.childNodes.length) p.remove(); }
  });
  c.querySelectorAll('.mf').forEach((el) => { el.textContent = `«${el.dataset.field}»`; });
  return c.innerHTML;
};

/* ---------- Opslaan in de browser ---------- */
App.saveLocal = (auto) => {
  if (App.state.hfEditing) {
    // kop/voettekst die nog bewerkt wordt alvast vastleggen
    const st = App.state.hfEditing; const cl = st.el.cloneNode(true);
    cl.querySelectorAll('.fld').forEach((f) => { f.textContent = ''; });
    App.doc.meta[st.key] = cl.innerHTML;
  }
  const d = App.doc;
  const data = App.docData();
  if (!App.store.set('doc.' + d.id, data)) {
    // melding en reserve-opslag: zie opslag.js
    $('#save-state').textContent = 'Niet opgeslagen';
    return false;
  }
  App.markIndex(data);
  App.store.set('last', d.id);
  d.dirty = false;
  const s = $('#save-state');
  s.textContent = App.fileHandle ? 'Opgeslagen · ' + App.fileHandle.name : 'Opgeslagen';
  s.classList.remove('dirty');
  return true;
};
App.docData = () => {
  const d = App.doc;
  const meta = { ...d.meta, comments: (d.meta.comments || []).filter((x) => !(x.draft && !(x.text || '').trim())) };
  return { id: d.id, title: d.title, html: App.cleanHtml(), meta, modified: Date.now() };
};
App.markIndex = (data, extra) => {
  const d = App.doc;
  const idx = (App.store.get('index', []) || []).filter((x) => x.id !== d.id);
  idx.unshift({ id: d.id, title: d.title, modified: data.modified, words: App.stats ? App.stats.words : 0, ...(extra || {}) });
  App.store.set('index', idx.slice(0, 200));
};
App.def('save', async () => {
  const ok = App.saveLocal(false);
  if (App.fileHandle) {
    try {
      const blob = await App.buildBlob(App.fileKind);
      const w = await App.fileHandle.createWritable(); await w.write(blob); await w.close();
      App.toast(`Opgeslagen in ${App.fileHandle.name}`, 'save');
      return;
    } catch (e) { App.toast('Kon niet naar het bestand schrijven: ' + e.message, 'error'); }
  }
  if (ok) App.toast('Opgeslagen op deze computer', 'save', { action: 'Ook als .docx-bestand', onAction: () => App.exportAs('docx'), ms: 4000 });
});

/* ---------- Document laden / nieuw ---------- */
App.loadDoc = (data) => {
  if (App.state.hfEditing) App.closeHF(true);
  App.deselectObj && App.deselectObj();
  // let op: Object.assign overschrijft def.page; de standaardwaarden voor de pagina komen daarom uit een aparte kopie
  const def = App.defaultMeta(), base = App.defaultMeta();
  const meta = Object.assign(def, data.meta || {});
  meta.page = { ...base.page, ...(meta.page || {}), margins: { ...base.page.margins, ...((meta.page || {}).margins || {}) } };
  meta.mail = meta.mail || { fields: [], records: [] };
  meta.comments = meta.comments || []; meta.sources = meta.sources || [];
  meta.comments = meta.comments.filter((x) => !(x.draft && !(x.text || '').trim()));   // lege concepten uit oudere opslag
  App.doc = { id: data.id || App.uid('d'), title: data.title || 'Naamloos document', meta };
  App.fileHandle = data.fileHandle || null; App.fileKind = data.fileKind || null;
  App.ed.innerHTML = data.html || '<p><br></p>';
  App.ensureBlocks();
  $('#doc-title').value = App.doc.title;
  document.title = App.doc.title + ' — Inkt';
  App.state.track = !!meta.track; $('#sb-track').hidden = !App.state.track;
  App.state.mergePreview = false; App.state.mergeIndex = 0;
  App.ed.classList.remove('merge-preview');
  App.setProtect(!!meta.protect);
  App.applyDocLook();
  $('#sb-lang').textContent = App.LANGS[meta.lang] || meta.lang;
  $('#cite-style').value = meta.citeStyle || 'apa';
  $('#markup-mode').value = 'all'; App.exec('markupMode', 'all');
  document.body.classList.toggle('comments-on', meta.comments.length > 0);
  App.updateDateFields();
  if (App.ed.querySelector('.eq')) App.loadCss(App.KATEX + 'katex.min.css');
  App.updateMergeInfo();
  App.activeComment = null;
  App._forceSheets = true;
  App.history.reset();
  App.layout();
  if (App.state.view === 'print' && $('#canvas-scroll').clientWidth < App.geom().W * App.state.zoom + 40) App.exec('zoomWidth');
  if ($$('.toc, .tof', App.ed).length) { $$('.toc', App.ed).forEach(App.buildToc); $$('.tof', App.ed).forEach(App.buildTof); App.layout(); }
  App.renderComments();
  App.updateWords();
  App.renderNav();
  App.doc.dirty = false;
  const s = $('#save-state'); s.textContent = 'Opgeslagen'; s.classList.remove('dirty');
  $('#canvas-scroll').scrollTop = 0;
  App.ed.focus({ preventScroll: true });
  const first = App.ed.querySelector('p,h1,h2,h3,li,td') || App.ed.firstElementChild;
  if (first) App.placeCaret(first, 0);
  App.history.reset();
};
App.newDoc = (tplId = 'blank') => {
  if (App.doc.dirty) App.saveLocal(true);
  const tpl = App.TEMPLATES.find((t) => t.id === tplId) || App.TEMPLATES[0];
  const meta = Object.assign(App.defaultMeta(), JSON.parse(JSON.stringify(tpl.meta || {})));
  meta.author = App.settings.author;
  App.loadDoc({ id: App.uid('d'), title: tpl.id === 'blank' ? 'Naamloos document' : tpl.name, html: tpl.html(), meta });
};
App.newDocFromHtml = (html, title, opts = {}) => {
  if (App.doc.dirty) App.saveLocal(true);
  const meta = App.defaultMeta();
  if (opts.keepLook) ['page', 'theme', 'themeFonts', 'themeColors', 'spacing', 'header', 'footer', 'headerFirst', 'footerFirst', 'firstDiff', 'lang'].forEach((k) => { meta[k] = JSON.parse(JSON.stringify(App.doc.meta[k] ?? null)) ?? meta[k]; });
  if (opts.page) meta.page = opts.page;
  App.loadDoc({ id: App.uid('d'), title, html, meta });
  App.markDirty();
};
App.def('newDoc', () => { App.newDoc('blank'); App.closeBackstage(); });
App.def('openDocId', async (id) => {
  const data = App.loadStored ? await App.loadStored(id) : App.store.get('doc.' + id);
  if (!data) { App.toast('Dit document is niet meer gevonden', 'error'); return; }
  if (App.doc.dirty) App.saveLocal(true);
  App.loadDoc(data);
  App.store.set('last', id);
  App.closeBackstage();
});
$('#doc-title').addEventListener('change', (e) => {
  App.doc.title = e.target.value.trim() || 'Naamloos document';
  e.target.value = App.doc.title;
  document.title = App.doc.title + ' — Inkt';
  App._forceSheets = true;
  App.markDirty(); App.scheduleLayout();
});
$('#doc-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); App.ed.focus(); } });

/* ---------- Bestanden lezen ---------- */
App.mdInline = (s) => App.esc(s)
  .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<b>${a || b}</b>`)
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<i>$2</i>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>');
App.mdToHtml = (md) => {
  const lines = md.replace(/\r/g, '').split('\n');
  let out = '', i = 0;
  const isList = (l) => /^\s*([-*+]|\d+[.)])\s+/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out += `<pre>${App.esc(buf.join('\n'))}</pre>`; continue;
    }
    if (/^#{1,6}\s/.test(l)) { const n = Math.min(4, l.match(/^#+/)[0].length); out += `<h${n}>${App.mdInline(l.replace(/^#+\s*/, ''))}</h${n}>`; i++; continue; }
    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(l.trim())) { out += '<hr>'; i++; continue; }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out += `<blockquote>${App.mdInline(buf.join(' '))}</blockquote>`; continue; }
    if (/^\|.*\|\s*$/.test(l) && lines[i + 1] && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => App.mdInline(c.trim()));
      const head = row(l); i += 2;
      let t = `<table class="doc-table ts-grid"><tbody><tr>${head.map((h) => `<th>${h || '<br>'}</th>`).join('')}</tr>`;
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) t += `<tr>${row(lines[i++]).map((c) => `<td>${c || '<br>'}</td>`).join('')}</tr>`;
      out += t + '</tbody></table>'; continue;
    }
    if (isList(l)) {
      const ordered = /^\s*\d+[.)]/.test(l);
      let html = '';
      const stack = [];
      while (i < lines.length && isList(lines[i])) {
        const ln = lines[i];
        const depth = Math.floor(ln.match(/^\s*/)[0].length / 2);
        const tag = /^\s*\d+[.)]/.test(ln) ? 'ol' : 'ul';
        while (stack.length < depth + 1) { html += `<${tag}>`; stack.push(tag); }
        while (stack.length > depth + 1) html += `</${stack.pop()}>`;
        let txt = ln.replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        let cls = '';
        if (/^\[[ xX]\]\s/.test(txt)) { cls = /^\[[xX]\]/.test(txt) ? ' class="done"' : ''; txt = txt.slice(4); }
        html += `<li${cls}>${App.mdInline(txt)}</li>`;
        i++;
      }
      while (stack.length) html += `</${stack.pop()}>`;
      out += ordered ? html : html;
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\|)/.test(lines[i]) && !isList(lines[i])) buf.push(lines[i++]);
    out += `<p>${buf.map(App.mdInline).join('<br>')}</p>`;
  }
  return out || '<p><br></p>';
};
App.htmlToMd = (html) => {
  const d = document.createElement('div'); d.innerHTML = html;
  const inl = (n) => Array.from(n.childNodes).map((c) => {
    if (c.nodeType === 3) return c.data.replace(/\u200B/g, '');
    if (c.nodeType !== 1) return '';
    const t = c.tagName, inner = inl(c);
    if (c.classList.contains('fn-ref')) return `[^${c.textContent}]`;
    if (t === 'B' || t === 'STRONG' || (c.style && +c.style.fontWeight >= 600)) return inner.trim() ? `**${inner}**` : inner;
    if (t === 'I' || t === 'EM') return inner.trim() ? `*${inner}*` : inner;
    if (t === 'S' || t === 'STRIKE' || t === 'DEL') return `~~${inner}~~`;
    if (t === 'CODE') return '`' + inner + '`';
    if (t === 'A') return `[${inner}](${c.getAttribute('href')})`;
    if (t === 'IMG') return `![${c.alt || ''}](${(c.getAttribute('src') || '').startsWith('data:') ? 'afbeelding' : c.getAttribute('src')})`;
    if (t === 'BR') return '  \n';
    return inner;
  }).join('');
  const blk = (n, depth = 0) => Array.from(n.children).map((c) => {
    const t = c.tagName;
    if (/^H[1-6]$/.test(t)) return '#'.repeat(+t[1]) + ' ' + inl(c).trim();
    if (c.classList.contains('title')) return '# ' + inl(c).trim();
    if (t === 'P') return inl(c).trim();
    if (t === 'BLOCKQUOTE') return '> ' + inl(c).trim();
    if (t === 'PRE') return '```\n' + c.textContent + '\n```';
    if (t === 'HR') return '---';
    if (t === 'UL' || t === 'OL') return Array.from(c.children).map((li, k) => {
      const sub = Array.from(li.children).filter((x) => x.tagName === 'UL' || x.tagName === 'OL');
      const clone = li.cloneNode(true); clone.querySelectorAll('ul,ol').forEach((x) => x.remove());
      const mark = t === 'OL' ? `${k + 1}.` : c.classList.contains('checklist') ? (li.classList.contains('done') ? '- [x]' : '- [ ]') : '-';
      return '  '.repeat(depth) + mark + ' ' + inl(clone).trim() + (sub.length ? '\n' + sub.map((s) => blk({ children: [s] }, depth + 1)).join('\n') : '');
    }).join('\n');
    if (t === 'TABLE') {
      const rows = Array.from(c.rows).map((r) => '| ' + Array.from(r.cells).map((x) => inl(x).trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
      if (!rows.length) return '';
      const n2 = c.rows[0].cells.length;
      rows.splice(1, 0, '| ' + Array(n2).fill('---').join(' | ') + ' |');
      return rows.join('\n');
    }
    if (c.classList.contains('page-break')) return '\n---\n';
    if (c.classList.contains('toc')) return '**Inhoudsopgave**\n\n' + Array.from(c.querySelectorAll('a.toc-entry')).map((a) => '  '.repeat(((a.className.match(/lvl(\d)/) || [0, 1])[1]) - 1) + `- [${a.querySelector('.t').textContent}](${a.getAttribute('href')})`).join('\n');
    if (c.classList.contains('footnotes')) return Array.from(c.querySelectorAll('li')).map((li, k) => `[^${k + 1}]: ${li.textContent}`).join('\n');
    return blk(c, depth);
  }).filter((x) => x !== '').join('\n\n');
  return blk(d) + '\n';
};
App.fileToDoc = async (file) => {
  const name = file.name || 'document';
  const ext = name.split('.').pop().toLowerCase();
  const title = name.replace(/\.[^.]+$/, '');
  if (ext === 'inkt' || ext === 'json') {
    const d = JSON.parse(await App.readFile(file));
    if (!d.html) throw new Error('Geen geldig Inkt-document');
    return { html: d.html, title: d.title || title, meta: d.meta };
  }
  if (ext === 'docx') {
    const buf = await App.readFile(file, 'buffer');
    await App.loadScript(App.MAMMOTH);
    const res = await window.mammoth.convertToHtml({ arrayBuffer: buf }, {
      styleMap: [
        "p[style-name='Title'] => p.title:fresh", "p[style-name='Titel'] => p.title:fresh",
        "p[style-name='Subtitle'] => p.subtitle:fresh", "p[style-name='Ondertitel'] => p.subtitle:fresh",
        "p[style-name='Quote'] => blockquote:fresh", "p[style-name='Citaat'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote.intense:fresh", "p[style-name='Duidelijk citaat'] => blockquote.intense:fresh",
        "p[style-name='Caption'] => p.caption:fresh", "p[style-name='caption'] => p.caption:fresh", "p[style-name='Bijschrift'] => p.caption:fresh",
        "p[style-name='No Spacing'] => p.nospace:fresh", "p[style-name='Geen afstand'] => p.nospace:fresh",
        "p[style-name='Code'] => pre:separator('\\n')",
        'u => u', 'strike => s',
      ],
      ignoreEmptyParagraphs: false,   // lege alinea's blijven staan (en de extra opmaak kan alinea voor alinea worden gekoppeld)
    });
    const d = document.createElement('div');
    d.innerHTML = res.value;
    // uitlijning, kleuren, groottes, tabelbreedtes, pagina-einden: zie docx-import.js
    if (App.docxEnrich) { try { await App.docxEnrich(d, buf); } catch { /* dan alleen de basisweergave */ } }
    // de lege slotalinea van Word niet overnemen
    while (d.children.length > 1 && d.lastElementChild.tagName === 'P' && !d.lastElementChild.textContent.trim() && !d.lastElementChild.querySelector('img')) d.lastElementChild.remove();
    d.querySelectorAll('table').forEach((t) => { t.className = 'doc-table ts-grid'; t.querySelectorAll('td,th').forEach((c) => { if (c.children.length === 1 && c.firstElementChild.tagName === 'P') App.unwrapEl(c.firstElementChild); }); });
    d.querySelectorAll('li > p:only-child').forEach((p) => App.unwrapEl(p));
    let meta = {};
    try {
      const ex = await App.Docx.readExtras(buf);
      meta = { page: ex.page, header: ex.header || '', footer: ex.footer || '', headerFirst: ex.headerFirst || '', footerFirst: ex.footerFirst || '', firstDiff: !!ex.firstDiff };
      if (!meta.page) delete meta.page;
    } catch { /* geen extra's */ }
    return { html: d.innerHTML || '<p><br></p>', title, meta, warnings: res.messages };
  }
  if (ext === 'odt' && App.odtToHtml) return { html: await App.odtToHtml(await App.readFile(file, 'buffer')), title };
  const text = await App.readFile(file);
  if (ext === 'html' || ext === 'htm') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const metaEl = doc.getElementById('inkt-meta');
    let meta;
    if (metaEl) { try { meta = JSON.parse(metaEl.textContent); } catch { /* niets */ } }
    const main = doc.querySelector('main.doc') || doc.body;
    return { html: meta ? main.innerHTML : App.sanitize(main.innerHTML), title: doc.title || title, meta };
  }
  if (ext === 'md' || ext === 'markdown') return { html: App.mdToHtml(text), title };
  if (ext === 'rtf' && App.rtfToHtml) return { html: App.rtfToHtml(text), title };
  return { html: text.split(/\r?\n/).map((l) => `<p>${App.esc(l) || '<br>'}</p>`).join(''), title };
};
App.def('openFile', async () => {
  let file, handle = null;
  if (window.showOpenFilePicker) {
    try {
      [handle] = await window.showOpenFilePicker({ types: [{ description: 'Documenten', accept: { 'application/octet-stream': ['.docx', '.inkt', '.odt', '.rtf', '.html', '.htm', '.md', '.txt'] } }] });
      file = await handle.getFile();
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!file) file = await App.pickFile('.docx,.inkt,.odt,.rtf,.html,.htm,.md,.markdown,.txt,.json');
  if (!file) return;
  try {
    const r = await App.fileToDoc(file);
    if (App.doc.dirty) App.saveLocal(true);
    const ext = file.name.split('.').pop().toLowerCase();
    // .inkt en .docx: Ctrl+S schrijft daarna terug naar hetzelfde bestand
    const back = (ext === 'inkt' || ext === 'docx') && handle && handle.createWritable;
    App.loadDoc({ id: App.uid('d'), title: r.title, html: r.html, meta: r.meta, fileHandle: back ? handle : null, fileKind: back ? ext : null });
    App.saveLocal(true);
    App.closeBackstage();
    const lost = (r.warnings || []).filter((w) => w.type === 'warning' && !/Unrecognised (paragraph|run|table) style/i.test(w.message || '')).length;
    if (lost) App.toast(`“${file.name}” geopend. Niet alle onderdelen konden worden overgenomen; controleer de opmaak voordat je het bestand overschrijft.`, 'info', { ms: 7000 });
    else App.toast(`“${file.name}” geopend`, 'ok');
  } catch (e) {
    App.toast('Kon het bestand niet openen: ' + e.message, 'error', { ms: 5000 });
  }
});

/* ---------- Exporteren ---------- */
App.docCssText = () => {
  for (const s of Array.from(document.styleSheets)) {
    if (!/document\.css/.test(s.href || '')) continue;
    try { return Array.from(s.cssRules).map((r) => r.cssText).join('\n'); } catch { break; }
  }
  return `.doc{font-family:var(--doc-font);font-size:11pt;line-height:var(--doc-line);color:#1a1a1a}.doc p,.doc li{margin:0 0 var(--doc-after)}.doc h1,.doc h2,.doc h3,.doc h4{font-family:var(--doc-head-font);color:var(--doc-head-color);line-height:1.2;font-weight:600}.doc h1{font-size:20pt;margin:16pt 0 6pt}.doc h2{font-size:15pt;margin:12pt 0 4pt}.doc h3{font-size:12.5pt}.doc p.title{font-size:30pt;margin:0 0 6pt}.doc p.subtitle{font-size:14pt;color:#6a6a7a}.doc blockquote{border-left:3px solid var(--doc-accent);padding-left:12pt;font-style:italic;color:#444;margin-left:0}.doc table{border-collapse:collapse;width:100%}.doc td,.doc th{border:1px solid #b9b9c6;padding:4pt 6pt;vertical-align:top}.doc img{max-width:100%}.doc .page-break{break-after:page}.doc a{color:var(--doc-accent)}.doc pre{font-family:Consolas,monospace;background:#f4f4f8;padding:8pt}`;
};
App.buildBlob = async (kind) => {
  const t = App.doc.title;
  switch (kind) {
    case 'docx': return App.Docx.build();
    case 'inkt': return new Blob([JSON.stringify({ format: 'inkt', version: 1, title: t, html: App.cleanHtml(), meta: App.doc.meta })], { type: 'application/json' });
    case 'html': {
      const st = App.ed.style;
      const vars = ['--doc-font', '--doc-head-font', '--doc-head-color', '--doc-accent', '--doc-accent-2', '--doc-line', '--doc-after'].map((v) => `${v}:${st.getPropertyValue(v)}`).join(';');
      const metaJson = JSON.stringify(App.doc.meta).replace(/</g, '\\u003c');
      return new Blob([`<!doctype html>\n<html lang="${App.doc.meta.lang || 'nl'}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${App.esc(t)}</title>\n<style>\nbody{margin:0;background:#f3f3f6}\nmain.doc{max-width:${Math.round(App.contentWidth())}px;margin:40px auto;background:#fff;padding:60px 70px;box-shadow:0 2px 12px rgba(0,0,0,.08)}\n@media print{body{background:none}main.doc{box-shadow:none;margin:0;padding:0;max-width:none}}\n${App.docCssText()}\n</style>\n</head>\n<body>\n<main class="doc" style="${vars}">${App.cleanHtml(true)}</main>\n<script type="application/json" id="inkt-meta">${metaJson}</script>\n</body>\n</html>`], { type: 'text/html' });
    }
    case 'md': return new Blob([App.htmlToMd(App.cleanHtml(true))], { type: 'text/markdown' });
    case 'txt': return new Blob([App.ed.innerText.replace(/\u200B/g, '')], { type: 'text/plain' });
    default: throw new Error('Onbekend formaat');
  }
};
App.EXPORTS = {
  docx: { label: 'DOCX-document', ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: 'description', desc: 'Het gangbare documentformaat; te openen in vrijwel elke tekstverwerker. Met opmaak, tabellen, afbeeldingen, voetnoten, opmerkingen en wijzigingen.' },
  pdf: { label: 'PDF', ext: '.pdf', icon: 'picture_as_pdf', desc: "Vaste opmaak, ideaal om te delen of te printen. Kies in het afdrukvenster 'Opslaan als PDF'." },
  inkt: { label: 'Inkt-document', ext: '.inkt', mime: 'application/json', icon: 'ink_pen', desc: 'Bewaart alles precies zoals het is, inclusief opmerkingen, bronnen en adreslijsten.' },
  html: { label: 'Webpagina', ext: '.html', mime: 'text/html', icon: 'language', desc: 'Eén HTML-bestand dat in elke browser opent. Kan weer in Inkt worden geopend.' },
  md: { label: 'Markdown', ext: '.md', mime: 'text/markdown', icon: 'markdown', desc: 'Platte tekst met eenvoudige opmaak, handig voor websites en notities.' },
  txt: { label: 'Platte tekst', ext: '.txt', mime: 'text/plain', icon: 'text_snippet', desc: 'Alleen de tekst, zonder opmaak.' },
};
App.exportAs = async (kind) => {
  if (kind === 'pdf') { App.closeBackstage(); setTimeout(() => window.print(), 150); return; }
  const info = App.EXPORTS[kind];
  const name = (App.doc.title || 'document').replace(/[\\/:*?"<>|]+/g, '-') + info.ext;
  let handle = null;
  if (window.showSaveFilePicker) {
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: info.label, accept: { [info.mime]: [info.ext] } }] });
    } catch (e) { if (e.name === 'AbortError') return; handle = null; }
  }
  try {
    App.toast('Bezig met opslaan…', 'hourglass_top', { ms: 1200 });
    const blob = await App.buildBlob(kind);
    if (handle) {
      const w = await handle.createWritable(); await w.write(blob); await w.close();
      if (kind === 'docx' || kind === 'inkt') { App.fileHandle = handle; App.fileKind = kind; App.saveLocal(true); }
      App.toast(`Opgeslagen als ${handle.name}`, 'ok');
    } else {
      App.download(blob, name);
      App.toast(`${name} gedownload`, 'ok');
    }
  } catch (e) {
    console.error(e);
    App.toast('Opslaan mislukt: ' + e.message, 'error', { ms: 5000 });
  }
};
App.def('exportAs', (k) => App.exportAs(k));
App.def('print', () => { App.closeBackstage(); setTimeout(() => window.print(), 100); });

/* ---------- Sjablonen ---------- */
App.TEMPLATES = [
  { id: 'blank', name: 'Leeg document', html: () => '<p><br></p>' },
  {
    id: 'letter', name: 'Zakelijke brief', meta: { theme: 'zakelijk', spacing: 'compact' },
    html: () => `<p class="nospace" style="text-align:right"><b>Jouw Naam</b><br>Straatnaam 1<br>1234 AB Plaats<br>naam@voorbeeld.nl</p><p><br></p>
<p class="nospace">Naam ontvanger<br>Bedrijfsnaam<br>Adres 10<br>5678 CD Plaats</p><p><br></p>
<p>${App.fmtDate(Date.now())}</p><p><b>Betreft: onderwerp van de brief</b></p><p><br></p>
<p>Geachte heer/mevrouw,</p>
<p>Met deze brief wil ik u informeren over… Beschrijf hier kort en duidelijk de aanleiding van je brief.</p>
<p>In de tweede alinea licht je je punt verder toe. Houd het zakelijk en concreet.</p>
<p>Ik zie uw reactie graag tegemoet. Voor vragen ben ik bereikbaar via bovenstaande gegevens.</p><p><br></p>
<p>Met vriendelijke groet,</p><p><br></p><p><br></p><p>Jouw Naam</p>`,
  },
  {
    id: 'cv', name: 'Cv', meta: { theme: 'modern', spacing: 'compact', page: { size: 'A4', orient: 'portrait', margins: { t: 1.8, r: 2, b: 1.8, l: 2 } } },
    html: () => `<p class="title">Jouw Naam</p><p class="subtitle">Functietitel · Plaats · 06 12345678 · naam@voorbeeld.nl</p>
<h2>Profiel</h2><p>Gedreven professional met ervaring in… Beschrijf in twee of drie zinnen wie je bent en wat je zoekt.</p>
<h2>Werkervaring</h2><h3>Functie — Bedrijf</h3><p class="nospace" style="color:#666">2022 – heden · Utrecht</p>
<ul><li>Belangrijkste resultaat of verantwoordelijkheid</li><li>Nog een prestatie, liefst met cijfers</li></ul>
<h3>Functie — Bedrijf</h3><p class="nospace" style="color:#666">2018 – 2022 · Amsterdam</p><ul><li>Verantwoordelijkheid of resultaat</li></ul>
<h2>Opleiding</h2><h3>Opleiding — Onderwijsinstelling</h3><p class="nospace" style="color:#666">2014 – 2018</p><p><br></p>
<h2>Vaardigheden</h2><table class="doc-table b-none"><tbody><tr><td><b>Talen</b></td><td>Nederlands (moedertaal), Engels (vloeiend)</td></tr><tr><td><b>Software</b></td><td>Inkt, spreadsheets, presentaties</td></tr><tr><td><b>Overig</b></td><td>Projectmanagement, presenteren</td></tr></tbody></table>`,
  },
  {
    id: 'report', name: 'Rapport', meta: { theme: 'modern', header: '', footer: '<p style="text-align:center">Pagina <span class="fld" data-fld="page" contenteditable="false"></span> van <span class="fld" data-fld="pages" contenteditable="false"></span></p>', firstDiff: true },
    html: () => `<p style="margin-top:160pt" class="title">Titel van het rapport</p><p class="subtitle">Ondertitel of korte omschrijving</p><p style="margin-top:220pt;color:#555">${App.esc(App.settings.author)}<br>${App.fmtDate(Date.now())}</p>
<div class="page-break" contenteditable="false"></div><div class="toc" contenteditable="false" data-levels="3"></div><div class="page-break" contenteditable="false"></div>
<h1>Inleiding</h1><p>Beschrijf de aanleiding en het doel van dit rapport. Gebruik de stijlen Kop 1 en Kop 2: de inhoudsopgave wordt dan automatisch bijgewerkt.</p>
<h1>Methode</h1><h2>Aanpak</h2><p>Leg uit hoe het onderzoek is uitgevoerd.</p><h2>Gegevens</h2><p>Beschrijf de gebruikte gegevens.</p>
<h1>Resultaten</h1><table class="doc-table ts-accent banded"><tbody><tr><th>Onderdeel</th><th>Waarde</th><th>Opmerking</th></tr><tr><td>A</td><td>42</td><td><br></td></tr><tr><td>B</td><td>17</td><td><br></td></tr><tr><td>C</td><td>23</td><td><br></td></tr></tbody></table>
<p class="caption" data-cap="Tabel"><span class="cap-label">Tabel</span> <span class="cap-num" contenteditable="false">1</span>: Overzicht van de resultaten</p>
<h1>Conclusie</h1><p>Vat de belangrijkste bevindingen samen en geef aanbevelingen.</p>`,
  },
  {
    id: 'minutes', name: 'Notulen', meta: { theme: 'inkt', spacing: 'compact' },
    html: () => `<p class="title">Notulen</p><p class="subtitle">Overleg / werkgroep</p>
<table class="doc-table ts-soft"><tbody><tr><td style="width:28%"><b>Datum</b></td><td>${App.fmtDate(Date.now())}</td></tr><tr><td><b>Aanwezig</b></td><td><br></td></tr><tr><td><b>Afwezig</b></td><td><br></td></tr><tr><td><b>Notulist</b></td><td>${App.esc(App.settings.author)}</td></tr></tbody></table>
<h2>1. Opening en mededelingen</h2><p><br></p><h2>2. Notulen vorige vergadering</h2><p><br></p><h2>3. Agendapunt</h2><p><br></p><h2>4. Rondvraag en sluiting</h2><p><br></p>
<h2>Actiepunten</h2><table class="doc-table ts-accent"><tbody><tr><th>Actie</th><th>Wie</th><th>Wanneer</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>`,
  },
  {
    id: 'invoice', name: 'Factuur', meta: { theme: 'zakelijk', spacing: 'compact' },
    html: () => `<table class="doc-table b-none"><tbody><tr><td><p class="title" style="margin:0">FACTUUR</p></td><td style="text-align:right"><b>Jouw Bedrijf</b><br>Straat 1, 1234 AB Plaats<br>KvK 12345678 · btw NL000000000B01</td></tr></tbody></table><p><br></p>
<table class="doc-table b-none"><tbody><tr><td><b>Factuur aan</b><br>Klantnaam<br>Adres 10<br>5678 CD Plaats</td><td style="text-align:right"><b>Factuurnummer</b> 2026-001<br><b>Factuurdatum</b> ${App.fmtDate(Date.now())}<br><b>Vervaldatum</b> binnen 30 dagen</td></tr></tbody></table><p><br></p>
<table class="doc-table ts-dark"><tbody><tr><th style="width:50%">Omschrijving</th><th>Aantal</th><th>Prijs</th><th style="text-align:right">Bedrag</th></tr>
<tr><td>Dienst of product</td><td>1</td><td>€ 100,00</td><td style="text-align:right">€ 100,00</td></tr><tr><td>Dienst of product</td><td>2</td><td>€ 50,00</td><td style="text-align:right">€ 100,00</td></tr>
<tr><td><br></td><td><br></td><td><b>Subtotaal</b></td><td style="text-align:right">€ 200,00</td></tr><tr><td><br></td><td><br></td><td><b>Btw 21%</b></td><td style="text-align:right">€ 42,00</td></tr><tr><td><br></td><td><br></td><td><b>Totaal</b></td><td style="text-align:right"><b>€ 242,00</b></td></tr></tbody></table>
<p>Gelieve het totaalbedrag binnen 30 dagen over te maken op NL00 BANK 0123 4567 89 onder vermelding van het factuurnummer.</p>`,
  },
  {
    id: 'invite', name: 'Uitnodiging', meta: { theme: 'elegant' },
    html: () => `<p style="text-align:center;margin-top:90pt"><span class="wa wa-1" style="font-size:44pt">Je bent uitgenodigd!</span></p>
<p style="text-align:center" class="subtitle">voor een feestelijke middag</p><p style="text-align:center"><br></p>
<p style="text-align:center;font-size:16pt"><b>Zaterdag 14 november</b><br>15.00 – 19.00 uur</p><p style="text-align:center;font-size:14pt">Adres van de locatie<br>Plaats</p><p style="text-align:center"><br></p>
<blockquote class="intense">Laat even weten of je komt — we rekenen op je!</blockquote>`,
  },
  {
    id: 'essay', name: 'Werkstuk', meta: { theme: 'klassiek', spacing: 'double', header: '<p style="text-align:right">Achternaam <span class="fld" data-fld="page" contenteditable="false"></span></p>' },
    html: () => `<p class="title" style="text-align:center">Titel van het werkstuk</p><p style="text-align:center">${App.esc(App.settings.author)}<br>Opleiding / klas<br>${App.fmtDate(Date.now())}</p>
<h1>Inleiding</h1><p style="text-indent:1.25cm">Begin met een pakkende inleiding die de hoofdvraag introduceert. Gebruik Verwijzingen › Citaat om bronnen te vermelden.</p>
<h1>Kern</h1><p style="text-indent:1.25cm">Werk je argumenten uit in duidelijke alinea's.</p>
<h1>Conclusie</h1><p style="text-indent:1.25cm">Beantwoord de hoofdvraag.</p>`,
  },
];
App.WELCOME = () => `<p class="title">Welkom bij Inkt</p>
<p class="subtitle">Tekstverwerker · gemaakt door JJ van Schelven</p>
<h1>Aan de slag</h1>
<p>Begin met typen in dit document, of kies <b>Bestand › Nieuw</b> voor een leeg document of een sjabloon. Documenten worden automatisch op deze computer opgeslagen.</p>
<ul><li><b>Start</b> — lettertype, alinea, stijlen, zoeken en vervangen.</li>
<li><b>Invoegen</b> — tabellen, afbeeldingen, vormen, grafieken, koppelingen, vergelijkingen en symbolen.</li>
<li><b>Ontwerpen</b> en <b>Indeling</b> — thema's, watermerken, marges, paginaformaat en kolommen.</li>
<li><b>Verwijzingen</b> — inhoudsopgave, voetnoten, citaten en bijschriften.</li>
<li><b>Controleren</b> — spelling, opmerkingen en wijzigingen bijhouden.</li></ul>
<h2>Sneltoetsen</h2>
<table class="doc-table ts-accent banded"><tbody><tr><th>Actie</th><th>Toets</th></tr><tr><td>Zoeken naar een opdracht</td><td>Alt + Q</td></tr><tr><td>Opslaan</td><td>Ctrl + S</td></tr><tr><td>Afdrukken</td><td>Ctrl + P</td></tr><tr><td>Alle sneltoetsen</td><td>F1</td></tr></tbody></table>
<p>Een .docx-bestand openen: <b>Bestand › Openen</b>. Opslaan als .docx: <b>Bestand › Opslaan als</b>.</p>`;

/* ---------- Bestand-scherm (backstage) ---------- */
App.bsSection = 'home';
App.def('openBackstage', (section) => {
  if (App.state.hfEditing) App.closeHF(true);
  App.saveRange();
  let bs = $('#backstage');
  if (!bs) {
    bs = document.createElement('div');
    bs.id = 'backstage';
    bs.innerHTML = `<nav class="bs-nav">
      <button class="bs-back" data-bs="back" title="Terug naar het document (Esc)"><span class="i">arrow_back</span></button>
      <button data-bs="home"><span class="i">home</span> Start</button>
      <button data-bs="new"><span class="i">note_add</span> Nieuw</button>
      <button data-bs="open"><span class="i">folder_open</span> Openen</button>
      <div class="bs-sep"></div>
      <button data-bs="info">Info</button>
      <button data-bs="save">Opslaan</button>
      <button data-bs="export">Opslaan als</button>
      <button data-bs="print">Afdrukken</button>
      <div class="bs-fill"></div>
      <div class="bs-sep"></div>
      <button data-bs="options">Opties</button>
      <div class="bs-credit" style="font-size:11px;opacity:.75;padding:8px 14px 2px">Inkt · gemaakt door JJ van Schelven</div>
    </nav><div class="bs-main"></div>`;
    document.body.appendChild(bs);
    bs.querySelector('.bs-nav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-bs]'); if (!b) return;
      if (b.dataset.bs === 'back') App.closeBackstage(); else App.renderBackstage(b.dataset.bs);
    });
  }
  App.renderBackstage(typeof section === 'string' ? section : 'home');
});
App.closeBackstage = () => { const bs = $('#backstage'); if (bs) { bs.remove(); App.restoreRange(); } };
App.def('closeBackstage', () => App.closeBackstage());
App.tplCard = (t) => `<button class="tpl" data-tpl="${t.id}"><div class="thumb">${t.id === 'blank' ? '' : `<div class="mini doc">${t.html()}</div>`}</div><div class="tname">${t.name}</div></button>`;
App.recentRows = (limit, withDelete) => {
  const idx = (App.store.get('index', []) || []).slice(0, limit);
  if (!idx.length) return '<div class="recent-row" style="cursor:default"><span class="muted">Nog geen documenten. Begin met een nieuw document.</span></div>';
  return idx.map((d) => `<div class="recent-row" data-open="${d.id}"><span class="i">description</span><span class="rn">${App.esc(d.title)}${d.id === App.doc.id ? ' <span class="chip" style="margin-left:6px">geopend</span>' : ''}</span><span class="rd">${d.words != null ? d.words + ' woorden · ' : ''}${App.fmtDateTime(d.modified)}</span>${withDelete ? `<button class="qb" data-del="${d.id}" title="Verwijderen van deze computer"><span class="i">delete</span></button>` : ''}</div>`).join('');
};
App.renderBackstage = (sec) => {
  App.bsSection = sec;
  const bs = $('#backstage'), main = bs.querySelector('.bs-main');
  $$('.bs-nav [data-bs]', bs).forEach((b) => b.classList.toggle('on', b.dataset.bs === sec));
  const h = new Date().getHours();
  const greet = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
  const m = App.doc.meta;
  let html = '';
  if (sec === 'home') {
    html = `<h1>${greet}</h1><h3>Nieuw</h3><div class="tpl-grid">${App.TEMPLATES.slice(0, 6).map(App.tplCard).join('')}</div>
      <h3>Recent</h3><div class="recent-list">${App.recentRows(8)}</div>`;
  } else if (sec === 'new') {
    html = `<h1>Nieuw</h1><div class="tpl-grid">${App.TEMPLATES.map(App.tplCard).join('')}</div>`;
  } else if (sec === 'open') {
    html = `<h1>Openen</h1><div class="bs-cards" style="margin-bottom:8px"><button class="bs-card" data-act="openFile"><span class="i">folder_open</span><div><b>Bladeren…</b><small>Open een bestand van je computer: .docx, Inkt (.inkt), webpagina (.html), Markdown of tekst.</small></div></button></div>
      <h3>Documenten op deze computer</h3><div class="recent-list">${App.recentRows(200, true)}</div>`;
  } else if (sec === 'info') {
    const text = App.ed.innerText;
    html = `<h1>Info</h1><div class="props">
      <span class="k">Titel</span><input id="bs-title" value="${App.esc(App.doc.title)}">
      <span class="k">Auteur</span><input id="bs-author" value="${App.esc(m.author || App.settings.author)}">
      <span class="k">Gemaakt</span><span>${App.fmtDateTime(m.created)}</span>
      <span class="k">Laatst gewijzigd</span><span>${App.fmtDateTime(m.modified)}</span>
      <span class="k">Pagina's</span><span>${App.pages.count}</span>
      <span class="k">Woorden</span><span>${App.countText(text).toLocaleString('nl-NL')}</span>
      <span class="k">Tekens</span><span>${text.replace(/\n/g, '').length.toLocaleString('nl-NL')}</span>
      <span class="k">Opmerkingen</span><span>${m.comments.length}</span>
      <span class="k">Bijgehouden wijzigingen</span><span>${App.allChanges().length}</span>
      <span class="k">Formaat</span><span>${m.page.size}, ${m.page.orient === 'landscape' ? 'liggend' : 'staand'}</span></div>
      <h3>Document controleren</h3><div class="bs-cards">
        <button class="bs-card" data-act="toggleProtect"><span class="i">lock</span><div><b>${App.state.protect ? 'Beveiliging opheffen' : 'Document beveiligen'}</b><small>${App.state.protect ? 'Het document is nu alleen-lezen.' : 'Maak het document alleen-lezen om onbedoelde wijzigingen te voorkomen.'}</small></div></button>
        <button class="bs-card" data-act="deleteAllComments"><span class="i">comments_disabled</span><div><b>Opmerkingen verwijderen</b><small>Verwijder alle opmerkingen voordat je het document deelt.</small></div></button>
        <button class="bs-card" data-act="acceptAll"><span class="i">done_all</span><div><b>Alle wijzigingen accepteren</b><small>Verwerk alle bijgehouden wijzigingen in de tekst.</small></div></button>
      </div>`;
  } else if (sec === 'save') {
    html = `<h1>Opslaan</h1><div class="bs-cards">
      <button class="bs-card" data-act="saveNow"><span class="i">save</span><div><b>Nu opslaan</b><small>Bewaar het document op deze computer${App.fileHandle ? ' en in ' + App.esc(App.fileHandle.name) : ''}. (Ctrl+S)</small></div></button>
      <button class="bs-card" data-exp="docx"><span class="i">description</span><div><b>Opslaan op computer (.docx)</b><small>Sla op als .docx-bestand. Daarna slaat Ctrl+S direct op in dat bestand.</small></div></button>
      <button class="bs-card" data-exp="inkt"><span class="i">ink_pen</span><div><b>Opslaan als Inkt-bestand</b><small>Verliesvrij: alles blijft precies zoals het is.</small></div></button></div>
      <h3>Automatisch opslaan</h3><label class="chk" style="font-size:13px"><input type="checkbox" id="bs-autosave" ${App.settings.autosave ? 'checked' : ''}> Wijzigingen automatisch opslaan op deze computer</label>
      <p class="muted small" style="max-width:640px;line-height:1.5">Documenten blijven bewaard op deze computer. Wis je de gegevens van Inkt, dan zijn ze weg — sla belangrijke documenten daarom ook op als bestand.</p>`;
  } else if (sec === 'export') {
    html = `<h1>Opslaan als</h1><div class="bs-cards">${Object.entries(App.EXPORTS).map(([k, e]) => `<button class="bs-card" data-exp="${k}"><span class="i">${e.icon}</span><div><b>${e.label} <span class="muted small">${e.ext}</span></b><small>${e.desc}</small></div></button>`).join('')}</div>`;
  } else if (sec === 'print') {
    html = `<h1>Afdrukken</h1><div class="bs-cards"><button class="bs-card" data-act="print"><span class="i">print</span><div><b>Afdrukken…</b><small>Opent het afdrukvenster van de browser. Kies daar een printer of <b>Opslaan als PDF</b>.</small></div></button></div>
      <h3>Instellingen</h3><div class="props"><span class="k">Papier</span><span>${m.page.size}, ${m.page.orient === 'landscape' ? 'liggend' : 'staand'}</span>
      <span class="k">Marges</span><span>${['t', 'b', 'l', 'r'].map((k) => App.fmtNum(m.page.margins[k])).join(' / ')} cm (boven/onder/links/rechts)</span>
      <span class="k">Pagina's</span><span>${App.pages.count}</span><span class="k">Kop/voettekst</span><span>${m.header || m.footer ? 'Ja' : 'Nee'}</span></div>
      <p class="muted small" style="margin-top:14px">Tip: zet in het afdrukvenster ‘Kopteksten en voetteksten’ van de browser uit voor het mooiste resultaat.</p>`;
  } else if (sec === 'options') {
    html = `<h1>Opties</h1><div class="props">
      <span class="k">Naam bij opmerkingen (optioneel)</span><input id="op-author" value="${App.esc(App.settings.author)}">
      <span class="k">Weergave</span><label class="chk"><input type="checkbox" id="op-dark" ${App.settings.dark ? 'checked' : ''}> Donkere modus</label>
      <span class="k">Liniaal</span><label class="chk"><input type="checkbox" id="op-ruler" ${App.settings.ruler ? 'checked' : ''}> Liniaal tonen</label>
      <span class="k">Spelling</span><label class="chk"><input type="checkbox" id="op-spell" ${App.settings.spell ? 'checked' : ''}> Spelling controleren tijdens typen</label>
      <span class="k">Opslaan</span><label class="chk"><input type="checkbox" id="op-auto" ${App.settings.autosave ? 'checked' : ''}> Automatisch opslaan</label>
    </div>
    <h3>Gegevens</h3><div class="bs-cards"><button class="bs-card" data-act="wipe"><span class="i">delete_forever</span><div><b>Alle documenten op deze computer wissen</b><small>Verwijdert alle opgeslagen Inkt-documenten van deze computer. Dit kan niet ongedaan worden gemaakt.</small></div></button></div>`;
  }
  main.innerHTML = html;
  main.onclick = async (e) => {
    const tpl = e.target.closest('[data-tpl]');
    if (tpl) { App.newDoc(tpl.dataset.tpl); App.closeBackstage(); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del;
      const item = (App.store.get('index', []) || []).find((x) => x.id === id);
      if (!(await App.confirm('Document verwijderen', `“${App.esc(item ? item.title : '')}” definitief van deze computer verwijderen?`, 'Verwijderen', true))) return;
      App.store.del('doc.' + id); App.store.del('ver.' + id); if (App.bigStore) App.bigStore.del(id);
      App.store.set('index', (App.store.get('index', []) || []).filter((x) => x.id !== id));
      if (id === App.doc.id) App.doc.dirty = true;
      App.renderBackstage(sec);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { if (open.dataset.open === App.doc.id) App.closeBackstage(); else App.exec('openDocId', open.dataset.open); return; }
    const exp = e.target.closest('[data-exp]');
    if (exp) { App.exportAs(exp.dataset.exp); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'saveNow') { App.exec('save'); App.renderBackstage(sec); }
    else if (a === 'print') App.exec('print');
    else if (a === 'openFile') App.exec('openFile');
    else if (a === 'wipe') {
      if (!(await App.confirm('Alles wissen', 'Alle Inkt-documenten op deze computer worden verwijderd. Weet je het zeker?', 'Alles wissen', true))) return;
      (App.store.get('index', []) || []).forEach((d) => { App.store.del('doc.' + d.id); App.store.del('ver.' + d.id); if (App.bigStore) App.bigStore.del(d.id); });
      App.store.set('index', []);
      App.doc.dirty = true;
      App.toast('Alle documenten zijn gewist', 'ok');
    } else { App.closeBackstage(); App.exec(a); }
  };
  main.onchange = (e) => {
    const t = e.target;
    if (t.id === 'bs-title') { $('#doc-title').value = t.value; $('#doc-title').dispatchEvent(new Event('change')); }
    if (t.id === 'bs-author') { App.doc.meta.author = t.value; App.markDirty(); }
    if (t.id === 'bs-autosave' || t.id === 'op-auto') { App.settings.autosave = t.checked; App.saveSettings(); if (t.checked) App.saveLocal(true); }
    if (t.id === 'op-author') { App.settings.author = t.value.trim() || 'Ik'; App.settings.initials = App.initialsOf(App.settings.author); App.saveSettings(); }
    if (t.id === 'op-dark' && t.checked !== App.settings.dark) App.exec('toggleDark');
    if (t.id === 'op-ruler') App.exec('toggleRuler', t.checked);
    if (t.id === 'op-spell' && t.checked !== App.settings.spell) App.exec('toggleSpell');
  };
};
