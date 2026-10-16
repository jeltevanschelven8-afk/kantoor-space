/* =========================================================
   Inkt — Controleren: toegankelijkheid, combineren, revisiedeelvenster, markeringsfilter, vergrendelen
   ========================================================= */
'use strict';


/* ---------- Toegankelijkheidscontrole ---------- */
App.lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
App.parseRgb = (css) => { const m = String(css).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length >= 3 ? [p[0], p[1], p[2], p[3] ?? 1] : null; };
App.bgOf = (el) => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const c = App.parseRgb(getComputedStyle(n).backgroundColor);
    if (c && c[3] > 0.5) return c;
    if (n === App.ed) break;
  }
  // geen eigen achtergrond: de paginakleur (of wit)
  if (!App.doc.meta.pageColor) return [255, 255, 255, 1];
  const d = document.createElement('div'); d.style.color = App.doc.meta.pageColor; document.body.appendChild(d);
  const c = App.parseRgb(getComputedStyle(d).color); d.remove();
  return c || [255, 255, 255, 1];
};
App.contrast = (a, b) => { const la = App.lum(a), lb = App.lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
App.A11Y_VAGUE = ['klik hier', 'hier', 'lees meer', 'meer', 'link', 'deze link', 'klik', 'meer info', 'click here', 'here', 'read more', 'more'];
App.a11yCheck = () => {
  const issues = [];
  const add = (level, kind, el, text, fix) => issues.push({ level, kind, el, text, fix });
  $$('img', App.ed).forEach((img) => { if (!(img.getAttribute('alt') || '').trim() && img.getAttribute('role') !== 'presentation') add('err', 'Alternatieve tekst ontbreekt', img, img.dataset.shape ? 'Vorm' : img.dataset.chart ? 'Grafiek' : 'Afbeelding', 'alt'); });
  $$('table', App.ed).forEach((t, i) => { const r = t.rows[0]; if (r && !r.querySelector('th')) add('err', 'Geen kopregel opgegeven', t, `Tabel ${i + 1}`, 'header'); });
  const seen = new Set();
  $$('*', App.ed).forEach((el) => {
    if (el.closest('.toc, .footnotes, .endnotes, .xe, .ta, del') || !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.data.trim())) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const fg = App.parseRgb(cs.color), bg = App.bgOf(el);
    if (!fg || !bg) return;
    const size = parseFloat(cs.fontSize) * 0.75, bold = +cs.fontWeight >= 600;
    const need = size >= 18 || (size >= 14 && bold) ? 3 : 4.5;
    const ratio = App.contrast(fg, bg);
    const key = (App.blockOf(el) || el);
    if (ratio < need && !seen.has(key)) { seen.add(key); add('warn', 'Slecht leesbaar tekstcontrast', el, `“${el.textContent.trim().slice(0, 40)}” (contrast ${ratio.toFixed(1)}:1)`, 'select'); }
  });
  $$('a[href]', App.ed).forEach((a) => {
    const t = a.textContent.trim().toLowerCase();
    if (!t || App.A11Y_VAGUE.includes(t) || /^(https?:\/\/|www\.)/.test(t)) add('warn', 'Onduidelijke koppelingstekst', a, `“${a.textContent.trim().slice(0, 50) || '(leeg)'}”`, 'link');
  });
  let lastLvl = 0;
  $$('h1, h2, h3, h4, h5, h6', App.ed).filter((h) => !h.closest('.toc')).forEach((h) => {
    const lvl = +h.tagName[1];
    if (!h.textContent.trim()) add('warn', 'Lege kop', h, `Kop ${lvl} zonder tekst`, 'select');
    else if (lvl > lastLvl + 1) add('tip', 'Overgeslagen kopniveau', h, `Kop ${lvl} “${h.textContent.trim().slice(0, 40)}” na ${lastLvl ? 'Kop ' + lastLvl : 'het begin van het document'}`, 'select');
    if (h.textContent.trim()) lastLvl = lvl;
  });
  return issues;
};
App.a11yStatus = () => { const n = App.a11yCheck().filter((i) => i.level !== 'tip').length; return n ? 'Toegankelijkheid: onderzoeken' : 'Toegankelijkheid: goed om te gaan'; };
App.renderA11y = () => {
  if (!App.paneOpen('a11y')) return;
  const body = App.taskPane('a11y', 'Toegankelijkheid');
  const list = App.a11yCheck();
  App._a11y = list;
  const groups = [['err', 'Fouten', 'error'], ['warn', 'Waarschuwingen', 'warning'], ['tip', 'Tips', 'lightbulb']];
  const html = groups.map(([lv, title, icon]) => {
    const items = list.map((it, i) => [it, i]).filter(([it]) => it.level === lv);
    if (!items.length) return '';
    const kinds = [...new Set(items.map(([it]) => it.kind))];
    return `<h4>${title}</h4>` + kinds.map((k) => `<div class="muted" style="margin:6px 0 2px">${k} (${items.filter(([it]) => it.kind === k).length})</div>` + items.filter(([it]) => it.kind === k).map(([it, i]) => `<button class="tp-item" data-a="${i}"><span class="i" style="color:${lv === 'err' ? '#c50f1f' : lv === 'warn' ? '#bc4b09' : 'var(--accent)'}">${icon}</span><span>${App.esc(it.text)}${it.fix === 'alt' ? '<small>Klik om een beschrijving toe te voegen</small>' : it.fix === 'header' ? '<small>Klik om de eerste rij als kopregel te gebruiken</small>' : ''}</span></button>`).join('')).join('');
  }).join('');
  body.innerHTML = (html || `<div style="text-align:center;padding:30px 0"><span class="i" style="font-size:40px;color:#107c10">check_circle</span><p><b>Geen toegankelijkheidsproblemen gevonden.</b><br><span class="muted">Mensen met een handicap kunnen dit document waarschijnlijk goed lezen.</span></p></div>`)
    + `<div class="tp-actions"><label class="chk"><input type="checkbox" id="a11y-live" ${App.settings.a11yLive !== false ? 'checked' : ''}> Controle blijven uitvoeren terwijl ik werk</label></div>
    <h4>Meer informatie</h4><p class="muted" style="margin:0">Waarom toegankelijkheid? Schermlezers lezen alternatieve tekst voor, kopregels helpen bij het navigeren in tabellen en duidelijke koppen en koppelingen maken het document voor iedereen beter te volgen.</p>`;
  body.onclick = (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const it = App._a11y[+b.dataset.a]; if (!it || !it.el.isConnected) { App.renderA11y(); return; }
    App.scrollToEl(it.el);
    if (it.fix === 'alt') { App.selectObj(it.el); App.exec('imgAlt'); return; }
    if (it.fix === 'header') { App.run(() => App.setHeaderRow(it.el, true)); App.renderA11y(); return; }
    App.ed.focus({ preventScroll: true }); App.selectContents(it.el);
  };
  body.onchange = (e) => { if (e.target.id === 'a11y-live') { App.settings.a11yLive = e.target.checked; App.saveSettings(); } };
};
App.def('accessibilityCheck', () => { App.taskPane('a11y', 'Toegankelijkheid'); App.renderA11y(); });
App.on('change', App.debounce(() => { if (App.paneOpen('a11y') && App.settings.a11yLive !== false) App.renderA11y(); }, 900));

/* ---------- Documenten combineren ---------- */
// Wijzigingen van twee auteurs in één document: bestaande bijgehouden wijzigingen blijven staan,
// nieuwe verschillen krijgen de naam van de revisor.
App.paraTokens = (html, defAuthor = 'Onbekend') => {
  const div = document.createElement('div'); div.innerHTML = html;
  div.querySelectorAll('.footnotes, .endnotes, .toc, .xe, .ta').forEach((x) => x.remove());
  return $$('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote', div).filter((b) => !b.querySelector('p,li,td')).map((b) => {
    const toks = [];
    const walk = (n, kind, author) => n.childNodes.forEach((c) => {
      if (c.nodeType === 3) c.data.replace(/​/g, '').split(/(\s+)/).filter(Boolean).forEach((t) => toks.push({ t: t.replace(/\s+/g, ' '), kind, author }));
      else if (c.nodeType === 1) {
        if (c.matches('ins.trk')) walk(c, 'ins', c.dataset.author || defAuthor);
        else if (c.matches('del.trk')) walk(c, 'del', c.dataset.author || defAuthor);
        else if (c.tagName === 'BR') toks.push({ t: ' ', kind, author });
        else walk(c, kind, author);
      }
    });
    walk(b, '=', '');
    return { tag: /^(H[1-6]|PRE|BLOCKQUOTE)$/.test(b.tagName) ? b.tagName.toLowerCase() : 'p', toks };
  }).filter((p) => p.toks.length);
};
App.finalText = (p) => p.toks.filter((t) => t.kind !== 'del').map((t) => t.t).join('').trim();
App.combineParas = (A, B, label) => {
  const out = [];
  const emitAll = (p, kind) => out.push({ tag: p.tag, toks: p.toks.map((t) => (t.kind === 'del' ? t : { ...t, kind, author: t.kind === 'ins' && kind === 'ins' ? t.author : label })) });
  const pd = App.diffTokens(A.map(App.finalText), B.map(App.finalText)) || [...A.map((p) => ['-', p]), ...B.map((p) => ['+', p])];
  let ia = 0, ib = 0;
  for (let k = 0; k < pd.length; k++) {
    const [op] = pd[k];
    if (op === '=') { out.push(App.mergeTokens(A[ia++], B[ib++], label)); continue; }
    if (op === '-' && pd[k + 1] && pd[k + 1][0] === '+') { out.push(App.mergeTokens(A[ia++], B[ib++], label)); k++; continue; }
    if (op === '-') emitAll(A[ia++], 'del'); else emitAll(B[ib++], 'ins');
  }
  return out;
};
App.mergeTokens = (pa, pb, label) => {
  const A = pa.toks, B = pb.toks;
  const af = A.filter((t) => t.kind !== 'del'), bf = B.filter((t) => t.kind !== 'del');
  const ops = App.diffTokens(af.map((t) => t.t), bf.map((t) => t.t)) || [...af.map((t) => ['-', t.t]), ...bf.map((t) => ['+', t.t])];
  const res = [];
  let ia = 0, ib = 0;
  const flushA = () => { while (ia < A.length && A[ia].kind === 'del') res.push(A[ia++]); };
  const flushB = () => { while (ib < B.length && B[ib].kind === 'del') res.push(B[ib++]); };
  ops.forEach(([op]) => {
    if (op === '=') { flushA(); flushB(); const a = A[ia++], b = B[ib++]; res.push(b && b.kind === 'ins' && a.kind === '=' ? b : a); }
    else if (op === '-') { flushA(); const a = A[ia++]; res.push({ t: a.t, kind: 'del', author: label }); }
    else { flushB(); const b = B[ib++]; res.push(b.kind === 'ins' ? b : { t: b.t, kind: 'ins', author: label }); }
  });
  flushA(); flushB();
  return { tag: pb.tag || pa.tag, toks: res };
};
App.tokensHtml = (paras) => {
  const e = App.esc;
  let changes = 0;
  const html = paras.map((p) => {
    let s = '', cur = null, buf = '';
    const flush = () => {
      if (!buf) return;
      if (!cur || cur.kind === '=') s += e(buf);
      else { changes++; s += `<${cur.kind} class="trk" data-author="${e(cur.author)}" data-time="${Date.now()}" style="--trk:${App.authorColor(cur.author)}" title="${cur.kind === 'ins' ? 'Ingevoegd' : 'Verwijderd'} door ${e(cur.author)}">${e(buf)}</${cur.kind}>`; }
      buf = '';
    };
    p.toks.forEach((t) => { if (!cur || t.kind !== cur.kind || t.author !== cur.author) { flush(); cur = t; } buf += t.t; });
    flush();
    return `<${p.tag}>${s || '<br>'}</${p.tag}>`;
  }).join('');
  return { html, changes };
};
App.def('combineDocs', () => {
  const docs = (App.store.get('index', []) || []);
  const opt = (sel) => docs.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${App.esc(x.title)}${x.id === App.doc.id ? ' (huidig)' : ''}</option>`).join('');
  const other = docs.find((x) => x.id !== App.doc.id);
  const files = {};
  const d = App.dialog({
    title: 'Documenten combineren', wide: true,
    body: `<p style="margin-top:0;line-height:1.5">Voeg revisies van meerdere auteurs samen in één document. Wijzigingen die al in de documenten worden bijgehouden blijven behouden; nieuwe verschillen worden gemarkeerd met de naam hieronder.</p>
      <div class="fields-2">
        <div><label class="field"><span>Origineel document</span><select id="cb-a">${opt(other ? other.id : App.doc.id)}<option value="file">Bestand kiezen…</option></select></label>
          <label class="field"><span>Wijzigingen zonder label markeren met</span><input id="cb-la" value="Origineel"></label></div>
        <div><label class="field"><span>Gereviseerd document</span><select id="cb-b">${opt(App.doc.id)}<option value="file">Bestand kiezen…</option></select></label>
          <label class="field"><span>Wijzigingen zonder label markeren met</span><input id="cb-lb" value="${App.esc(App.settings.author)}"></label></div>
      </div>
      <p class="muted small" style="margin:0">Het resultaat opent als nieuw document. Tekstopmaak (vet, kleuren) wordt in het resultaat niet overgenomen, net als bij Vergelijken.</p>`,
    onOpen: (dd) => ['#cb-a', '#cb-b'].forEach((id) => dd.$(id).addEventListener('change', async (e) => {
      if (e.target.value !== 'file') return;
      const f = await App.pickFile('.docx,.inkt,.html,.htm,.txt,.md');
      if (!f) { e.target.selectedIndex = 0; return; }
      try { const r = await App.fileToDoc(f); files[id] = { html: r.html, title: f.name }; const o = document.createElement('option'); o.value = 'f:' + id; o.textContent = f.name; o.selected = true; e.target.appendChild(o); } catch { App.toast('Kon het bestand niet lezen', 'error'); }
    })),
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (dd) => {
      const get = (id) => { const v = dd.$(id).value; if (v.startsWith('f:')) return files[id]; if (v === App.doc.id) return { html: App.cleanHtml(), title: App.doc.title }; const x = App.store.get('doc.' + v); return x ? { html: x.html, title: x.title } : null; };
      const a = get('#cb-a'), b = get('#cb-b');
      if (!a || !b) { App.toast('Kies twee documenten', 'error'); return false; }
      const res = App.tokensHtml(App.combineParas(App.paraTokens(a.html, dd.$('#cb-la').value.trim() || 'Origineel'), App.paraTokens(b.html, dd.$('#cb-lb').value.trim() || 'Revisor'), dd.$('#cb-lb').value.trim() || 'Revisor'));
      App.newDocFromHtml(res.html, `Gecombineerd — ${a.title} + ${b.title}`);
      App.toast(`${res.changes} revisies in het gecombineerde document`, 'merge');
      if (App.openReviewPane) App.openReviewPane('vertical');
    } }],
  });
  void d;
});

/* ---------- Revisiedeelvenster (verticaal of horizontaal) ---------- */
App.reviewMode = null;
App.openReviewPane = (mode) => {
  App.reviewMode = mode;
  let el = $('#review-pane');
  if (!el) {
    el = document.createElement('aside'); el.id = 'review-pane';
    el.innerHTML = '<div class="pane-head"><strong>Revisies</strong><button class="qb" data-close title="Sluiten"><span class="i">close</span></button></div><div class="rp-sum"></div><div class="rp-body"></div>';
    $('#workspace').insertBefore(el, $('#workspace').firstChild);
    el.querySelector('[data-close]').onclick = () => App.closeReviewPane();
    el.querySelector('.rp-body').addEventListener('click', App.reviewPaneClick);
  }
  el.className = mode === 'horizontal' ? 'horizontal' : 'vertical';
  document.body.classList.toggle('rp-horizontal', mode === 'horizontal');
  App.renderReviewPane();
  App.layout(); App.scheduleState();
};
App.closeReviewPane = () => { const el = $('#review-pane'); if (el) el.remove(); App.reviewMode = null; document.body.classList.remove('rp-horizontal'); App.layout(); App.scheduleState(); };
App.reviewItems = () => {
  const items = [];
  const cmts = App.doc.meta.comments.filter((c) => !c.draft);
  $$('ins.trk, del.trk, .cmt', App.ed).forEach((el) => {
    if (el.classList.contains('cmt')) {
      const c = cmts.find((x) => x.id === el.dataset.cid);
      if (c && !items.some((i) => i.c === c)) items.push({ type: 'cmt', el, c, author: c.author, time: c.date });
      return;
    }
    items.push({ type: el.tagName === 'INS' ? 'ins' : 'del', el, author: el.dataset.author || 'Onbekend', time: +el.dataset.time || 0 });
  });
  return items;
};
App.renderReviewPane = () => {
  const el = $('#review-pane'); if (!el) return;
  const items = App.reviewItems().filter((i) => App.markupVisible(i));
  App._rpItems = items;
  const n = (t) => items.filter((i) => i.type === t).length;
  el.querySelector('.rp-sum').innerHTML = `<b>${items.length} ${items.length === 1 ? 'revisie' : 'revisies'}</b><span class="muted"> · ${n('ins')} invoegingen · ${n('del')} verwijderingen · ${n('cmt')} opmerkingen</span>`;
  el.querySelector('.rp-body').innerHTML = items.length ? items.map((it, i) => {
    const col = App.authorColor(it.author);
    const what = it.type === 'cmt' ? 'Opmerking' : it.type === 'ins' ? 'Ingevoegd' : 'Verwijderd';
    const text = it.type === 'cmt' ? it.c.text + (it.c.replies.length ? ` (${it.c.replies.length} ${it.c.replies.length === 1 ? 'antwoord' : 'antwoorden'})` : '') : it.el.textContent;
    return `<button class="rp-item" data-i="${i}"><span class="c-av" style="background:${col};width:22px;height:22px;font-size:9px">${App.initialsOf(it.author)}</span>
      <span class="rp-txt"><span class="rp-head"><b>${App.esc(it.author)}</b> ${what}${it.time ? ` <span class="muted">${App.fmtDateTime(it.time)}</span>` : ''}</span><span class="rp-t ${it.type}">${App.esc(text.slice(0, 300))}</span></span></button>`;
  }).join('') : '<p class="muted" style="padding:10px 14px">Er zijn geen revisies in dit document.</p>';
};
App.reviewPaneClick = (e) => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  const it = App._rpItems[+b.dataset.i]; if (!it || !it.el.isConnected) return;
  App.scrollToEl(it.el);
  if (it.type === 'cmt') { document.body.classList.add('comments-on'); App.layout(); App.renderComments(); App.setActiveComment(it.c.id); }
  else { App.ed.focus({ preventScroll: true }); App.selectContents(it.el); }
};
App.on('change', App.debounce(() => App.renderReviewPane(), 500));
App.def('reviewPane', (mode) => { if (App.reviewMode && (!mode || mode === App.reviewMode)) App.closeReviewPane(); else App.openReviewPane(mode || 'vertical'); });
App.stateFns.reviewPane = () => !!App.reviewMode;
App.menuBuilders['m-reviewpane'] = () => `<button data-cmd="reviewPane" data-arg="vertical"><span class="i">${App.reviewMode === 'vertical' ? 'check' : 'view_sidebar'}</span> Revisiedeelvenster verticaal…</button>
  <button data-cmd="reviewPane" data-arg="horizontal"><span class="i">${App.reviewMode === 'horizontal' ? 'check' : 'call_to_action'}</span> Revisiedeelvenster horizontaal…</button>`;

/* ---------- Markeringen weergeven (filter) ---------- */
App.mkFilter = { comments: true, insdel: true, hidden: new Set() };
App.markupVisible = (it) => {
  const f = App.mkFilter;
  if (f.hidden.has(it.author)) return false;
  return it.type === 'cmt' ? f.comments : f.insdel;
};
App.applyMarkupFilter = () => {
  const f = App.mkFilter;
  App.ed.classList.toggle('hide-insdel', !f.insdel);
  App.ed.classList.toggle('hide-cmts', !f.comments);
  document.body.classList.toggle('hide-cmt-pane', !f.comments);
  $$('ins.trk, del.trk', App.ed).forEach((el) => el.classList.toggle('trk-off', f.hidden.has(el.dataset.author || 'Onbekend')));
  const hiddenC = new Set(App.doc.meta.comments.filter((c) => f.hidden.has(c.author)).map((c) => c.id));
  $$('.cmt', App.ed).forEach((a) => a.classList.toggle('cmt-off', hiddenC.has(a.dataset.cid)));
  $$('#comment-pane .c-card').forEach((c) => c.classList.toggle('cmt-off', hiddenC.has(c.dataset.id)));
  App.renderReviewPane();
};
App.on('change', App.debounce(() => { if (!App.mkFilter.insdel || !App.mkFilter.comments || App.mkFilter.hidden.size) App.applyMarkupFilter(); }, 200));
App.on('layout', () => { if (App.mkFilter.hidden.size) App.applyMarkupFilter(); });
App.reviewAuthors = () => [...new Set([...$$('ins.trk, del.trk', App.ed).map((e) => e.dataset.author || 'Onbekend'), ...App.doc.meta.comments.filter((c) => !c.draft).map((c) => c.author)])].sort((a, b) => a.localeCompare(b, 'nl'));
App.def('markupFilter', (k) => {
  const f = App.mkFilter;
  if (k === 'comments' || k === 'insdel') f[k] = !f[k];
  else if (k === 'all') { const all = App.reviewAuthors(); if (f.hidden.size) f.hidden.clear(); else all.forEach((a) => f.hidden.add(a)); }
  else if (k && k.startsWith('p:')) { const a = k.slice(2); if (f.hidden.has(a)) f.hidden.delete(a); else f.hidden.add(a); }
  App.applyMarkupFilter();
});
App.menuBuilders['m-showmarkup'] = () => {
  const f = App.mkFilter, ck = (on) => `<span class="i">${on ? 'check_box' : 'check_box_outline_blank'}</span>`;
  const people = App.reviewAuthors();
  return `<button data-cmd="markupFilter" data-arg="comments">${ck(f.comments)} Opmerkingen</button>
    <button data-cmd="markupFilter" data-arg="insdel">${ck(f.insdel)} Invoegingen en verwijderingen</button>
    <button disabled title="Inkt houdt opmaakwijzigingen niet bij">${ck(false)} Opmaak (wordt niet bijgehouden)</button>
    <div class="menu-title">Specifieke personen</div>
    <button data-cmd="markupFilter" data-arg="all">${ck(!f.hidden.size)} Alle revisoren</button>
    ${people.map((p) => `<button data-cmd="markupFilter" data-arg="p:${App.esc(p)}">${ck(!f.hidden.has(p))} <span class="c-av" style="background:${App.authorColor(p)};width:16px;height:16px;font-size:8px;display:inline-grid">${App.initialsOf(p)}</span> ${App.esc(p)}</button>`).join('') || '<div class="menu-empty">Nog geen revisoren</div>'}`;
};
// Filterklassen niet mee opslaan
(() => {
  const orig = App.cleanHtml;
  App.cleanHtml = (forExport) => orig(forExport).replace(/ (trk-off|cmt-off)(?=[\s"])/g, '');
})();

/* ---------- Bijhouden vergrendelen ---------- */
App.sha256 = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('inkt:' + s)))).map((b) => b.toString(16).padStart(2, '0')).join('');
App.trackLocked = () => !!App.doc.meta.trackLock;
App.def('lockTracking', () => {
  if (App.trackLocked()) {
    App.dialog({
      title: 'Bijhouden ontgrendelen',
      body: '<label class="field"><span>Wachtwoord</span><input id="lt-pw" type="password" autofocus></label>',
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: async (d) => {
        const h = await App.sha256(d.$('#lt-pw').value);
        if (h !== App.doc.meta.trackLock) { App.toast('Het wachtwoord is onjuist', 'error'); return; }
        delete App.doc.meta.trackLock; App.markDirty(); App.scheduleState();
        App.toast('Bijhouden is ontgrendeld', 'lock_open');
      } }],
    });
    return;
  }
  App.dialog({
    title: 'Bijhouden vergrendelen',
    body: `<p style="margin-top:0;line-height:1.5">Voorkom dat anderen Wijzigingen bijhouden uitschakelen. Laat het wachtwoord leeg om zonder wachtwoord te vergrendelen.</p>
      <label class="field"><span>Wachtwoord (optioneel)</span><input id="lt-a" type="password" autofocus></label>
      <label class="field"><span>Wachtwoord bevestigen</span><input id="lt-b" type="password"></label>
      <p class="muted small" style="margin:0">Dit is geen beveiligingsfunctie: het wachtwoord voorkomt alleen dat het bijhouden per ongeluk wordt uitgezet.</p>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: async (d) => {
      const a = d.$('#lt-a').value, b = d.$('#lt-b').value;
      if (a !== b) { App.toast('De wachtwoorden komen niet overeen', 'error'); return false; }
      App.doc.meta.trackLock = await App.sha256(a);
      if (!App.state.track) App.exec('toggleTrack');
      App.markDirty(); App.scheduleState();
      App.toast('Wijzigingen bijhouden is vergrendeld', 'lock');
    } }],
  });
});
App.stateFns.trackLock = () => App.trackLocked();
(() => {
  const guard = (name, msg) => {
    const c = App.commands[name]; if (!c) return;
    const fn = c.fn;
    c.fn = (...a) => { if (App.trackLocked() && (name !== 'toggleTrack' || App.state.track)) { App.toast(msg, 'lock', { ms: 3500 }); return undefined; } return fn(...a); };
  };
  guard('toggleTrack', 'Wijzigingen bijhouden is vergrendeld. Ontgrendel via Bijhouden › Bijhouden vergrendelen.');
  ['acceptChange', 'rejectChange', 'acceptAll', 'rejectAll', 'acceptAllStop'].forEach((n) => guard(n, 'Accepteren en weigeren kan niet zolang Bijhouden vergrendeld is.'));
})();
App.menuBuilders['m-track'] = () => `<button data-cmd="toggleTrack"><span class="i">${App.state.track ? 'check' : 'track_changes'}</span> Voor iedereen</button>
  <button data-cmd="lockTracking"><span class="i">${App.trackLocked() ? 'lock' : 'lock_open'}</span> ${App.trackLocked() ? 'Bijhouden ontgrendelen…' : 'Bijhouden vergrendelen…'}</button>`;
App.menuBuilders['m-compare'] = () => `<button data-cmd="compareDocs"><span class="i">compare</span><span><b>Vergelijken…</b><small>Twee versies van een document vergelijken</small></span></button>
  <button data-cmd="combineDocs"><span class="i">merge</span><span><b>Combineren…</b><small>Revisies van meerdere auteurs in één document samenvoegen</small></span></button>`;
