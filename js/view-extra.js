/* =========================================================
   Inkt — Beeld: overzicht, concept, insluitende lezer, naast elkaar, splitsen
   ========================================================= */
'use strict';


/* ---------- Extra weergaven: Overzicht, Concept, Insluitende lezer ---------- */
App.FLOW_VIEWS = ['outline', 'draft', 'immersive'];
App.VIEW_NAMES = { outline: 'Overzichtsweergave', draft: 'Conceptweergave', immersive: 'Insluitende lezer' };
// Contextueel tabblad dat pas bestaat als de weergave aan staat (zoals in Word)
App.ensureCtxTab = (id, label, panelHtml) => {
  let tab = $(`#tabs .tab[data-tab="${id}"]`);
  if (!tab) {
    tab = document.createElement('button');
    tab.className = 'tab ctx'; tab.dataset.tab = id; tab.textContent = label; tab.hidden = true;
    $('#tabs .tabs-spacer').before(tab);
    const p = document.createElement('div');
    p.className = 'panel'; p.dataset.panel = id; p.innerHTML = panelHtml;
    $('#ribbon').appendChild(p);
  }
  return tab;
};
App.showCtxTab = (id, on) => {
  const tab = $(`#tabs .tab[data-tab="${id}"]`); if (!tab) return;
  tab.hidden = !on;
  if (on) App.showTab(id); else if (App.activeTab === id) App.showTab('view');
};
(() => {
  const origSet = App.setView;
  App.setView = (v) => {
    const prev = App.state.view;
    document.body.classList.remove('view-outline', 'view-draft', 'view-immersive');
    if (prev === 'outline' && v !== 'outline') App.outlineOff();
    if (prev === 'immersive' && v !== 'immersive') App.immersiveOff();
    origSet(v);
    if (App.FLOW_VIEWS.includes(v)) {
      document.body.classList.add('view-' + v);
      if (v === 'immersive') App.ed.contentEditable = 'false';
      App.layout();
    }
    App.showCtxTab('outline', v === 'outline');
    App.showCtxTab('immersive', v === 'immersive');
  };
  // Doorlopende weergaven: geen pagina's, de tekst loopt door (zoals Word)
  const origLayout = App.layout;
  App.layout = (from) => {
    const v = App.state.view;
    if (!App.FLOW_VIEWS.includes(v)) return origLayout(from);
    const ed = App.ed, g = App.geom(), z = App.state.zoom, sc = $('#canvas-scroll');
    App.clearPushes();
    App.pages.h = null;
    let w;
    if (v === 'draft') w = g.W - g.ml - g.mr + 48;
    else if (v === 'immersive') w = { narrow: 380, small: 520, medium: 700, wide: 920 }[App.imm.width] || 700;
    else w = Math.max(360, (sc.clientWidth - 48 - App.commentPaneWidth()) / z);
    ed.style.width = w + 'px';
    ed.style.padding = v === 'immersive' ? '48px 40px' : '24px 24px 24px ' + (v === 'outline' ? 44 : 24) + 'px';
    ed.style.minHeight = Math.max(300, (sc.clientHeight - 40) / z) + 'px';
    $('#pages').style.width = w + 'px';
    if (v === 'outline') App.outlineDecorate();
    if (App.applyTabs) App.applyTabs();
    const h = ed.offsetHeight;
    $('#pages').style.height = h + 'px';
    $('#zoom-sizer').style.width = w * z + 'px'; $('#zoom-sizer').style.height = h * z + 'px';
    App.pages.count = 1;
    App.renderSheets(0);
    if (App.renderLineNumbers) App.renderLineNumbers();
    App.positionAfterLayout();
  };
  const origStatus = App.updatePageStatus;
  App.updatePageStatus = () => { origStatus(); if (App.FLOW_VIEWS.includes(App.state.view)) $('#sb-page').textContent = App.VIEW_NAMES[App.state.view]; };
})();
App.stateFns.viewOutline = () => App.state.view === 'outline';
App.stateFns.viewDraft = () => App.state.view === 'draft';
App.def('viewDraft', () => { App.setView('draft'); App.ed.focus({ preventScroll: true }); });
App.def('viewOutline', () => { App.setView('outline'); App.ed.focus({ preventScroll: true }); });
// Opruimen: hulpklassen van de weergaven niet opslaan
(() => {
  const orig = App.cleanHtml;
  App.cleanHtml = (fx) => orig(fx).replace(/ ?\bol-(?:l\d|body|hidden|sub|collapsed)\b/g, '').replace(/ class=""/g, '');
})();

/* ---------- Overzichtsweergave ---------- */
App.ol = { show: 10, plain: false, first: false };
App.olLevel = (b) => (/^H[1-6]$/.test(b.tagName) && !b.closest('.toc') ? +b.tagName[1] : 10);
App.olBlocks = () => Array.from(App.ed.children).filter((b) => !b.matches('.footnotes, .endnotes'));
// Inspringing, plus/min-tekens en ingeklapte delen aanbrengen
App.outlineDecorate = () => {
  const blocks = App.olBlocks();
  let cur = 0;           // niveau van de laatste kop
  let hideUntil = 0;     // ingeklapt: verbergen tot een kop van dit niveau of hoger
  blocks.forEach((b, i) => {
    const lvl = App.olLevel(b);
    b.classList.remove('ol-l1', 'ol-l2', 'ol-l3', 'ol-l4', 'ol-l5', 'ol-l6', 'ol-l7', 'ol-body', 'ol-hidden', 'ol-sub');
    if (hideUntil && lvl <= hideUntil) hideUntil = 0;
    const indent = lvl === 10 ? Math.min(cur, 6) + 1 : lvl;
    b.classList.add('ol-l' + indent);
    if (lvl === 10) b.classList.add('ol-body');
    let hidden = !!hideUntil || lvl > App.ol.show;
    if (lvl === 10 && App.ol.show < 10) hidden = true;
    if (hidden) b.classList.add('ol-hidden');
    if (lvl < 10) {
      cur = lvl;
      const nx = blocks[i + 1];
      if (nx && App.olLevel(nx) > lvl) b.classList.add('ol-sub');
      if (b.classList.contains('ol-collapsed') && !hideUntil) hideUntil = lvl;
    }
  });
  App.ed.classList.toggle('ol-plain', !!App.ol.plain);
  App.ed.classList.toggle('ol-first', !!App.ol.first);
};
App.outlineOff = () => {
  App.olBlocks().forEach((b) => b.classList.remove('ol-l1', 'ol-l2', 'ol-l3', 'ol-l4', 'ol-l5', 'ol-l6', 'ol-l7', 'ol-body', 'ol-hidden', 'ol-sub', 'ol-collapsed'));
  App.ed.classList.remove('ol-plain', 'ol-first');
};
// Onderdelen van een kop (de kop zelf + alles tot de volgende kop van hetzelfde of hoger niveau)
App.olSubtree = (h) => {
  const lvl = App.olLevel(h), out = [h];
  if (lvl === 10) return out;
  for (let n = h.nextElementSibling; n && !n.matches('.footnotes, .endnotes') && App.olLevel(n) > lvl; n = n.nextElementSibling) out.push(n);
  return out;
};
App.olSelTops = () => {
  const tops = [];
  App.getSelectedBlocks().forEach((b) => { const t = App.topBlock(b); if (t && !tops.includes(t)) tops.push(t); });
  return tops;
};
App.setLevel = (b, lvl) => {
  const tag = lvl === 10 ? 'p' : 'h' + lvl;
  if (b.tagName.toLowerCase() === tag || !/^(P|H[1-6])$/.test(b.tagName)) return b;
  const n = document.createElement(tag);
  Array.from(b.attributes).forEach((a) => n.setAttribute(a.name, a.value));
  if (lvl !== 10) n.classList.remove('title', 'subtitle', 'nospace', 'caption');
  while (b.firstChild) n.appendChild(b.firstChild);
  b.replaceWith(n);
  return n;
};
App.defEdit('olLevel', (how) => {
  const marks = App.markSel();
  App.olSelTops().forEach((b) => {
    const lvl = App.olLevel(b);
    const group = b.classList.contains('ol-collapsed') ? App.olSubtree(b) : [b];
    let delta = 0, target = null;
    if (how === 'top') target = 1;
    else if (how === 'body') target = 10;
    else if (how === 'up') { if (lvl === 10) { let p = b.previousElementSibling; while (p && App.olLevel(p) === 10) p = p.previousElementSibling; target = p ? App.olLevel(p) : 1; } else delta = -1; }
    else if (how === 'down') { if (lvl < 10) delta = 1; }
    else if (/^\d+$/.test(how)) target = +how;
    group.forEach((el, k) => {
      const l = App.olLevel(el);
      if (k > 0 && l === 10) return;
      const nl = target != null ? (k === 0 ? target : App.clamp(l + (target - lvl), 1, 6)) : App.clamp(l + delta, 1, 6);
      if (nl !== l) App.setLevel(el, nl);
    });
  });
  App.restoreMarks(marks);
});
App.defEdit('olMove', (dir) => {
  const tops = App.olSelTops(); if (!tops.length) return;
  const first = tops[0], last = tops[tops.length - 1];
  const group = tops.length === 1 && first.classList.contains('ol-collapsed') ? App.olSubtree(first) : tops;
  const marks = App.markSel();
  if (dir === 'up') {
    let p = group[0].previousElementSibling;
    while (p && p.classList.contains('ol-hidden')) p = p.previousElementSibling;
    if (p) group.forEach((g) => p.before(g));
  } else {
    let n = group[group.length - 1].nextElementSibling;
    while (n && n.classList.contains('ol-hidden')) n = n.nextElementSibling;
    if (n && !n.matches('.footnotes, .endnotes')) { if (n.classList.contains('ol-collapsed')) n = App.olSubtree(n).pop(); n.after(...group); }
  }
  void last;
  App.restoreMarks(marks);
});
App.def('olCollapse', (how) => {
  const tops = App.olSelTops();
  const heads = tops.length ? tops : [];
  heads.forEach((b) => {
    let h = b; while (h && App.olLevel(h) === 10) h = h.previousElementSibling;
    if (!h) return;
    if (how === 'collapse') h.classList.add('ol-collapsed'); else h.classList.remove('ol-collapsed');
  });
  App.layout();
});
App.def('olShow', (n) => { App.ol.show = +n || 10; App.layout(); });
App.def('olPlain', (on) => { App.ol.plain = !on; App.layout(); });
App.def('olFirst', (on) => { App.ol.first = !!on; App.layout(); });
// Klikken op het plus-teken links van een kop: in-/uitklappen (dubbelklik in Word)
App.ed.addEventListener('dblclick', (e) => {
  if (App.state.view !== 'outline') return;
  const b = App.topBlock(e.target);
  if (b && App.olLevel(b) < 10 && e.offsetX < 4) { e.preventDefault(); b.classList.toggle('ol-collapsed'); App.layout(); }
});
// Alt+Shift+pijlen: niveau en volgorde (werkt in elke weergave, zoals Word)
document.addEventListener('keydown', (e) => {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || !App.inEditor(document.activeElement)) return;
  const map = { ArrowLeft: ['olLevel', 'up'], ArrowRight: ['olLevel', 'down'], ArrowUp: ['olMove', 'up'], ArrowDown: ['olMove', 'down'] };
  if (map[e.key]) { e.preventDefault(); App.exec(...map[e.key]); return; }
  if (App.state.view === 'outline' && (e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')) { e.preventDefault(); App.exec('olCollapse', 'expand'); }
  if (App.state.view === 'outline' && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) { e.preventDefault(); App.exec('olCollapse', 'collapse'); }
});
App.ensureCtxTab('outline', 'Overzicht', `
  <div class="grp"><div class="grp-body rows">
    <div class="row">
      <button class="rb" data-cmd="olLevel" data-arg="top" title="Bevorderen tot Kop 1"><span class="i">keyboard_double_arrow_left</span></button>
      <button class="rb" data-cmd="olLevel" data-arg="up" title="Bevorderen (Alt+Shift+Pijl-links)"><span class="i">arrow_back</span></button>
      <select class="rsel" id="ol-level-sel" data-cmd="olLevel" title="Overzichtsniveau" style="width:110px"><option value="1">Niveau 1</option><option value="2">Niveau 2</option><option value="3">Niveau 3</option><option value="4">Niveau 4</option><option value="5">Niveau 5</option><option value="6">Niveau 6</option><option value="body">Platte tekst</option></select>
      <button class="rb" data-cmd="olLevel" data-arg="down" title="Degraderen (Alt+Shift+Pijl-rechts)"><span class="i">arrow_forward</span></button>
      <button class="rb" data-cmd="olLevel" data-arg="body" title="Degraderen tot platte tekst"><span class="i">keyboard_double_arrow_right</span></button>
    </div>
    <div class="row">
      <button class="rb" data-cmd="olMove" data-arg="up" title="Omhoog (Alt+Shift+Pijl-omhoog)"><span class="i">arrow_upward</span></button>
      <button class="rb" data-cmd="olMove" data-arg="down" title="Omlaag (Alt+Shift+Pijl-omlaag)"><span class="i">arrow_downward</span></button>
      <button class="rb" data-cmd="olCollapse" data-arg="expand" title="Uitvouwen (Alt+Shift++)"><span class="i">add</span></button>
      <button class="rb" data-cmd="olCollapse" data-arg="collapse" title="Samenvouwen (Alt+Shift+-)"><span class="i">remove</span></button>
    </div></div><div class="grp-label">Overzichtsprogramma</div></div>
  <div class="grp"><div class="grp-body col">
    <label class="rb wide sel-wrap">Niveau weergeven <select data-cmd="olShow" id="ol-show"><option value="10">Alle niveaus</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">Niveau ${n}</option>`).join('')}</select></label>
    <label class="chk"><input type="checkbox" data-cmd="olPlain" checked> Tekstopmaak weergeven</label>
    <label class="chk"><input type="checkbox" data-cmd="olFirst"> Alleen eerste regel weergeven</label>
  </div><div class="grp-label">Weergeven</div></div>
  <div class="grp"><div class="grp-body"><button class="rb lg" data-cmd="viewPrint" title="Overzichtsweergave sluiten"><span class="i">close</span><span>Overzichtsweergave sluiten</span></button></div><div class="grp-label">Sluiten</div></div>`);
App.on('selection', () => {
  if (App.state.view !== 'outline') return;
  const r = App.getRange() || App.lastRange, b = r && App.topBlock(r.startContainer), s = $('#ol-level-sel');
  if (b && s && document.activeElement !== s) { const l = App.olLevel(b); s.value = l === 10 ? 'body' : String(l); }
});

/* ---------- Insluitende lezer ---------- */
App.imm = Object.assign({ width: 'medium', color: '', focus: 0, spacing: false }, (App.store.get('settings', {}) || {}).imm || {});
App.IMM_COLORS = [['', 'Geen'], ['#f4ecd8', 'Sepia'], ['#000000', 'Omkeren'], ['#fdf6e3', 'Crème'], ['#e8f4ea', 'Mint'], ['#e6f0fa', 'Lichtblauw'], ['#fbe9e7', 'Roze'], ['#efe9f7', 'Lavendel'], ['#fff9c4', 'Geel']];
App.applyImmersive = () => {
  const b = document.body, c = App.imm.color;
  b.style.setProperty('--imm-bg', c || '#ffffff');
  b.style.setProperty('--imm-fg', c === '#000000' ? '#f5f5f5' : '#1a1a1a');
  b.classList.toggle('imm-spacing', !!App.imm.spacing);
  App.settings.imm = App.imm; App.saveSettings();
  App.renderLineFocus();
  App.layout();
};
App.def('viewImmersive', () => { App.setView('immersive'); App.applyImmersive(); });
App.immersiveOff = () => { App.immSpeakStop(); $$('.imm-mask').forEach((m) => m.remove()); };
App.def('immWidth', (w) => { App.imm.width = w; App.applyImmersive(); });
App.def('immColor', (c) => { App.imm.color = c; App.applyImmersive(); });
App.def('immFocus', (n) => { App.imm.focus = +n || 0; App.applyImmersive(); });
App.def('immSpacing', () => { App.imm.spacing = !App.imm.spacing; App.applyImmersive(); });
App.stateFns.immSpacing = () => !!App.imm.spacing;
App.stateFns.immSpeaking = () => !!App._immUtter;
// Regelfocus: alles buiten 1, 3 of 5 regels in het midden van het venster wordt gedimd
App.renderLineFocus = () => {
  $$('.imm-mask').forEach((m) => m.remove());
  if (App.state.view !== 'immersive' || !App.imm.focus) return;
  const sc = $('#canvas-scroll');
  const lh = parseFloat(getComputedStyle(App.ed.querySelector('p') || App.ed).lineHeight) * App.state.zoom || 24;
  const band = lh * App.imm.focus + 8;
  const r = sc.getBoundingClientRect();
  const mid = r.top + r.height / 2;
  [['top', r.top, mid - band / 2 - r.top], ['bottom', mid + band / 2, r.bottom - (mid + band / 2)]].forEach(([k, top, h]) => {
    const m = document.createElement('div');
    m.className = 'imm-mask ' + k;
    Object.assign(m.style, { top: top + 'px', height: Math.max(0, h) + 'px', left: r.left + 'px', width: r.width + 'px' });
    document.body.appendChild(m);
  });
};
window.addEventListener('resize', App.debounce(() => App.renderLineFocus(), 150));
// Pijltoetsen verschuiven de tekst één regel door de focusband
document.addEventListener('keydown', (e) => {
  if (App.state.view !== 'immersive' || !App.imm.focus || e.target.matches('input, select, textarea')) return;
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const lh = parseFloat(getComputedStyle(App.ed.querySelector('p') || App.ed).lineHeight) * App.state.zoom || 24;
  $('#canvas-scroll').scrollBy({ top: e.key === 'ArrowDown' ? lh : -lh });
});
// Voorlezen met markering van het woord dat wordt uitgesproken
App._immUtter = null;
App.immSpeakStop = () => { if (App._immUtter) { App._immUtter = null; speechSynthesis.cancel(); App.scheduleState(); } };
App.def('immSpeak', () => {
  if (!('speechSynthesis' in window)) { App.toast('Voorlezen wordt niet ondersteund', 'error'); return; }
  if (App._immUtter) { App.immSpeakStop(); return; }
  const r = App.lastRange;
  const startOff = r && App.inEditor(r.startContainer) ? App.textOffset(r.startContainer, r.startOffset) : 0;
  const text = App.ed.textContent.slice(startOff);
  if (!text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = App.doc.meta.lang || 'nl-NL';
  const v = speechSynthesis.getVoices().find((x) => x.lang.replace('_', '-').startsWith(u.lang.slice(0, 2))); if (v) u.voice = v;
  u.rate = App.settings.immRate || 1;
  u.onboundary = (ev) => {
    if (ev.name && ev.name !== 'word') return;
    const s = startOff + ev.charIndex, len = ev.charLength || (text.slice(ev.charIndex).match(/^\S+/) || [''])[0].length;
    const a = App.pointAt(s, App.ed, true), b = App.pointAt(s + len, App.ed);
    try { const rr = document.createRange(); rr.setStart(a.node, a.offset); rr.setEnd(b.node, b.offset); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rr); const el = a.node.parentElement; if (el && !App.isVisible(el)) el.scrollIntoView({ block: 'center' }); } catch { /* niets */ }
  };
  u.onend = u.onerror = () => { App._immUtter = null; App.scheduleState(); };
  App._immUtter = u; App.scheduleState();
  speechSynthesis.speak(u);
});
App.ensureCtxTab('immersive', 'Insluitende lezer', `
  <div class="grp"><div class="grp-body">
    <button class="rb lg" data-menu="m-immwidth" title="Kolombreedte"><span class="i">width_normal</span><span>Kolombreedte</span></button>
    <button class="rb lg" data-menu="m-immcolor" title="Paginakleur"><span class="i">format_color_fill</span><span>Paginakleur</span></button>
    <button class="rb lg" data-menu="m-immfocus" title="Regelfocus"><span class="i">horizontal_split</span><span>Regelfocus</span></button>
    <button class="rb lg" data-cmd="immSpacing" data-state="immSpacing" title="Tekstafstand"><span class="i">format_letter_spacing</span><span>Tekstafstand</span></button>
    <button class="rb lg" data-cmd="immSpeak" data-state="immSpeaking" title="Voorlezen (woord voor woord gemarkeerd)"><span class="i">record_voice_over</span><span>Voorlezen</span></button>
  </div><div class="grp-label">Insluitende lezer</div></div>
  <div class="grp"><div class="grp-body"><button class="rb lg" data-cmd="viewPrint" title="Insluitende lezer sluiten"><span class="i">close</span><span>Insluitende lezer sluiten</span></button></div><div class="grp-label">Sluiten</div></div>`);
App.menuBuilders['m-immwidth'] = () => [['narrow', 'Zeer smal'], ['small', 'Smal'], ['medium', 'Gemiddeld'], ['wide', 'Breed']].map(([k, l]) => `<button data-cmd="immWidth" data-arg="${k}"><span class="i">${App.imm.width === k ? 'check' : ''}</span> ${l}</button>`).join('');
App.menuBuilders['m-immcolor'] = () => `<div class="grid-menu" style="grid-template-columns:repeat(3,1fr);gap:6px;padding:6px">${App.IMM_COLORS.map(([c, l]) => `<button data-cmd="immColor" data-arg="${c}" title="${l}" style="height:46px;border:1px solid var(--line-strong);background:${c || '#fff'};color:${c === '#000000' ? '#fff' : '#222'};font-size:11px;${App.imm.color === c ? 'outline:2px solid var(--accent)' : ''}">${l}</button>`).join('')}</div>`;
App.menuBuilders['m-immfocus'] = () => [[0, 'Geen'], [1, 'Eén regel'], [3, 'Drie regels'], [5, 'Vijf regels']].map(([n, l]) => `<button data-cmd="immFocus" data-arg="${n}"><span class="i">${App.imm.focus === n ? 'check' : ''}</span> ${l}</button>`).join('');
App.on('layout', () => { if (App.state.view === 'immersive') App.renderLineFocus(); });

/* ---------- Kopie van de weergave (voor Splitsen en Naast elkaar) ---------- */
App.cloneView = () => {
  const src = $('#zoom-sizer');
  const c = document.createElement('div');
  c.className = 'clone-sizer';
  c.style.cssText = `position:relative;margin:0 auto;width:${src.style.width};height:${src.style.height}`;
  const pages = $('#pages').cloneNode(false);
  pages.removeAttribute('id'); pages.className = 'clone-pages';
  pages.style.cssText = $('#pages').style.cssText + ';position:absolute;top:0;left:0;transform-origin:0 0';
  const sheets = $('#sheets').cloneNode(true); sheets.removeAttribute('id'); sheets.className = 'clone-sheets';
  const ed = App.ed.cloneNode(true); ed.removeAttribute('id'); ed.contentEditable = 'false'; ed.classList.add('clone-editor');
  ed.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
  const ln = $('#ln-layer'); if (ln) { const l2 = ln.cloneNode(true); l2.removeAttribute('id'); l2.className = 'clone-ln'; pages.appendChild(l2); }
  pages.appendChild(sheets); pages.appendChild(ed);
  c.appendChild(pages);
  return c;
};

/* ---------- Splitsen: twee delen van hetzelfde document ---------- */
App.def('splitWindow', () => {
  let sp = $('#split-view');
  if (sp) { sp.remove(); document.body.classList.remove('split-on'); App.layout(); App.scheduleState(); return; }
  sp = document.createElement('div');
  sp.id = 'split-view';
  sp.innerHTML = '<div class="split-bar" title="Sleep om de splitsing te verplaatsen; dubbelklik om op te heffen"></div><div class="split-scroll"></div><div class="split-note">Alleen-lezen kopie die meeloopt · bewerk in het bovenste deel</div>';
  $('#workspace').appendChild(sp);
  document.body.classList.add('split-on');
  App.refreshSplit();
  const bar = sp.querySelector('.split-bar');
  bar.addEventListener('dblclick', () => App.exec('splitWindow'));
  bar.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const ws = $('#workspace').getBoundingClientRect();
    const move = (ev) => { const h = App.clamp(ws.bottom - ev.clientY, 80, ws.height - 120); document.body.style.setProperty('--split-h', h + 'px'); };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); App.layout(); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  // klikken in de kopie zet de cursor op die plek in het bovenste deel
  sp.querySelector('.split-scroll').addEventListener('click', (e) => {
    const clone = sp.querySelector('.clone-editor'); if (!clone) return;
    const r = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!r || !clone.contains(r.startContainer)) return;
    const off = App.textOffset(r.startContainer, r.startOffset, clone);
    App.ed.focus({ preventScroll: true }); App.setSelOffsets({ s: off, e: off, root: App.ed });
    const n = App.getRange() && App.getRange().startContainer; const el = n && (n.nodeType === 3 ? n.parentElement : n);
    if (el) App.scrollToEl(el);
  });
  App.layout(); App.scheduleState();
});
App.stateFns.splitOn = () => !!$('#split-view');
App.refreshSplit = () => {
  const sp = $('#split-view'); if (!sp) return;
  const box = sp.querySelector('.split-scroll'), top = box.scrollTop;
  box.innerHTML = ''; box.appendChild(App.cloneView());
  box.scrollTop = top;
};
App.on('layout', App.debounce(() => App.refreshSplit(), 250));
App.on('change', App.debounce(() => App.refreshSplit(), 400));

/* ---------- Paginaverplaatsing: naast elkaar ---------- */
App.def('pageMove', (mode) => {
  const on = mode === 'side';
  document.body.classList.toggle('side-on', on);
  let sv = $('#side-view');
  if (!on) { if (sv) sv.remove(); App.scheduleState(); return; }
  if (App.state.view !== 'print') App.setView('print');
  if (!sv) { sv = document.createElement('div'); sv.id = 'side-view'; $('#workspace').appendChild(sv); }
  App.renderSide();
  App.scheduleState();
});
App.stateFns.pageSide = () => document.body.classList.contains('side-on');
App.stateFns.pageVert = () => !document.body.classList.contains('side-on');
App.renderSide = () => {
  const sv = $('#side-view'); if (!sv) return;
  const g = App.geom(), z0 = App.state.zoom, n = App.pages.count, P = g.H + App.GAP;
  const k = Math.min(1, (sv.clientHeight - 70) / g.H);
  const left = sv.scrollLeft;
  sv.innerHTML = `<div class="side-strip" style="height:${g.H * k}px"></div><div class="side-note">Pagina's naast elkaar · klik op een pagina om daar verder te bewerken · <button class="btn small" data-cmd="pageMove" data-arg="vertical">Verticaal</button></div>`;
  const strip = sv.firstElementChild;
  const base = App.cloneView();
  const pagesClone = base.querySelector('.clone-pages');
  pagesClone.style.transform = '';
  for (let i = 0; i < n; i++) {
    const f = document.createElement('div');
    f.className = 'side-page'; f.dataset.p = i;
    f.style.cssText = `width:${g.W * k}px;height:${g.H * k}px`;
    const inner = (i === 0 ? pagesClone : pagesClone.cloneNode(true));
    inner.style.transform = `scale(${k}) translateY(${-i * P}px)`;
    f.appendChild(inner);
    strip.appendChild(f);
  }
  void z0;
  sv.scrollLeft = left;
  strip.onclick = (e) => { const f = e.target.closest('.side-page'); if (!f) return; App.exec('pageMove', 'vertical'); App.scrollToPage(+f.dataset.p); };
};
App.on('layout', App.debounce(() => { if ($('#side-view')) App.renderSide(); }, 300));
$('#workspace').addEventListener('wheel', (e) => { const sv = $('#side-view'); if (sv && sv.contains(e.target) && !e.ctrlKey) { e.preventDefault(); sv.scrollLeft += e.deltaY + e.deltaX; } }, { passive: false });

/* ---------- Venster: nieuw venster, alles schikken, naast elkaar, synchroon schuiven ---------- */
// Inkt draait in één programmavenster. "Nieuw venster" opent een tweede venster met hetzelfde document
// (alleen lezen, wordt bijgewerkt zodra het document wordt opgeslagen).
App.win = { child: null, sync: false, chan: ('BroadcastChannel' in window) ? new BroadcastChannel('inkt-vensters') : null };
App.def('newWindow', () => {
  if (App.doc.dirty) App.saveLocal(true);
  const url = location.href.split('#')[0] + '#venster=' + encodeURIComponent(App.doc.id);
  const w = window.open(url, 'inkt-' + App.doc.id, 'popup,width=900,height=700');
  if (!w) { App.toast('Er kon geen nieuw venster worden geopend', 'error'); return null; }
  App.win.child = w;
  App.toast('Tweede venster geopend (alleen lezen, loopt mee met dit document)', 'open_in_new', { ms: 3500 });
  return w;
});
App.def('arrangeAll', () => {
  const w = App.win.child && !App.win.child.closed ? App.win.child : App.exec('newWindow') || App.win.child;
  if (!w) return;
  try { const H = screen.availHeight; w.moveTo(0, Math.round(H / 2)); w.resizeTo(screen.availWidth, Math.round(H / 2)); } catch { /* niets */ }
  App.toast('Het tweede venster staat onder in beeld. Het hoofdvenster van Inkt kan een webpagina niet zelf verplaatsen: zet het boven met Windows-toets + Pijl-omhoog of door te slepen.', 'info', { ms: 7000 });
});
App.def('sideBySide', () => {
  const w = App.win.child && !App.win.child.closed ? App.win.child : App.exec('newWindow') || App.win.child;
  if (!w) return;
  try { w.moveTo(Math.round(screen.availWidth / 2), 0); w.resizeTo(Math.round(screen.availWidth / 2), screen.availHeight); } catch { /* niets */ }
  App.win.sync = true; App.scheduleState();
  App.toast('Naast elkaar: het tweede venster staat rechts en Synchroon schuiven staat aan. Zet dit venster links met Windows-toets + Pijl-links.', 'info', { ms: 7000 });
});
App.def('syncScroll', () => { App.win.sync = !App.win.sync; App.scheduleState(); if (App.win.chan) App.win.chan.postMessage({ type: 'sync', on: App.win.sync, id: App.doc.id }); });
App.stateFns.syncScroll = () => App.win.sync;
App.def('resetWindows', () => { const w = App.win.child; if (w && !w.closed) { try { w.moveTo(Math.round(screen.availWidth / 2), 0); w.resizeTo(Math.round(screen.availWidth / 2), screen.availHeight); } catch { /* niets */ } } else App.toast('Er is geen tweede venster geopend', 'info'); });
$('#canvas-scroll').addEventListener('scroll', () => {
  if (!App.win.sync || !App.win.chan || App._winScrolling) return;
  const sc = $('#canvas-scroll');
  App.win.chan.postMessage({ type: 'scroll', id: App.doc.id, r: sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight) });
}, { passive: true });
if (App.win.chan) App.win.chan.onmessage = (e) => {
  const m = e.data || {};
  if (m.id !== App.doc.id) return;
  if (m.type === 'sync') { App.win.sync = !!m.on; App.scheduleState(); }
  if (m.type === 'scroll' && App.win.sync) { const sc = $('#canvas-scroll'); App._winScrolling = true; sc.scrollTop = m.r * (sc.scrollHeight - sc.clientHeight); setTimeout(() => { App._winScrolling = false; }, 60); }
};
// Dit is zelf een tweede venster: document laden, alleen lezen, bijwerken bij opslaan in het hoofdvenster
setTimeout(() => {
  const m = location.hash.match(/^#venster=(.+)$/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const load = () => {
    const data = App.store.get('doc.' + id); if (!data) return;
    const sc = $('#canvas-scroll'), top = sc.scrollTop;
    App.loadDoc(data);
    App.doc.title = data.title + ':2'; document.title = App.doc.title + ' — Inkt';
    App.setProtect(true); App.doc.dirty = false;
    App.saveLocal = () => true;   // dit venster slaat nooit op
    sc.scrollTop = top;
  };
  load();
  document.body.classList.add('second-window');
  App.toast('Tweede venster: alleen lezen. Wijzigingen in het hoofdvenster verschijnen hier zodra ze zijn opgeslagen.', 'info', { ms: 5000 });
  window.addEventListener('storage', (e) => { if (e.key === 'inkt.doc.' + id) load(); });
}, 0);
App.menuBuilders['m-pagemove'] = () => `<button data-cmd="pageMove" data-arg="vertical"><span class="i">${document.body.classList.contains('side-on') ? '' : 'check'}</span> Verticaal</button><button data-cmd="pageMove" data-arg="side"><span class="i">${document.body.classList.contains('side-on') ? 'check' : ''}</span> Naast elkaar</button>`;
