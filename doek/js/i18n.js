/* =========================================================
   Doek (made by JJ van Schelven) — language layer (same design as Inkt and Cel)
   The interface is written in Dutch; this layer translates every visible
   text to English at run time (default). The dictionaries live in js/lang/.
   The contents of slides are the user's own data and are never translated.
   ========================================================= */
'use strict';

(() => {
  const KEY = 'kantoor.lang';
  let lang = 'en';
  try { lang = localStorage.getItem(KEY) || 'en'; } catch { /* no storage */ }
  if (lang !== 'nl' && lang !== 'en') lang = 'en';
  App.LANG = lang;
  App.LOCALES = {
    en: { code: 'en-US', dec: '.', thou: ',', name: 'English', untitled: 'Presentation' },
    nl: { code: 'nl-NL', dec: ',', thou: '.', name: 'Nederlands', untitled: 'Presentatie' },
  };
  App.LOCALE = App.LOCALES[lang];
  document.documentElement.lang = lang;
  App.setLanguage = (l) => { try { localStorage.setItem(KEY, l); } catch { /* none */ } if (App.pres && App.pres.dirty && App.saveLocal) App.saveLocal(true); location.reload(); };

  /* ---------- dictionary (Dutch → English) ---------- */
  const DICT = window.KANTOOR_DICT = window.KANTOOR_DICT || {};
  const exact = new Map();
  const patterns = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let compiledSize = -1;
  const compile = () => {
    if (compiledSize === Object.keys(DICT).length) return;
    exact.clear(); patterns.length = 0;
    for (const k of Object.keys(DICT)) {
      const v = DICT[k];
      if (/\{\d\}/.test(k)) {
        const nums = [];
        const group = /^\{\d\}( van \{\d\}| gevonden)$/.test(k) ? '([\\d.,]+)' : '(.*?)';
        patterns.push({ re: new RegExp('^' + esc(k).replace(/\\\{(\d)\\\}/g, (_, d) => { nums.push(d); return group; }) + '$', 's'), v, nums });
      } else exact.set(k, v);
    }
    patterns.sort((a, b) => b.re.source.length - a.re.source.length);
    compiledSize = Object.keys(DICT).length;
  };
  const trCore = (s) => {
    const hit = exact.get(s);
    if (hit !== undefined) return hit;
    for (const p of patterns) {
      const m = p.re.exec(s);
      if (m) return p.v.replace(/\{(\d)\}/g, (_, i) => { let gi = p.nums.indexOf(i); if (gi < 0) gi = +i; const cap = m[gi + 1]; if (cap === undefined) return ''; const t = exact.get(cap.trim()); return t === undefined ? cap : cap.replace(cap.trim(), t); });
    }
    return null;
  };
  const tr = (s) => {
    if (!s) return null;
    compile();
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const core = m[2];
    if (!core || core.length > 4000) return null;
    let r = exact.get(core);
    if (r === undefined) {
      if (!/[A-Za-zÀ-ÿ]/.test(core)) return null;
      r = trCore(core);
      if (r === null && /\s/.test(core)) r = trCore(core.replace(/\s+/g, ' '));
    }
    return r === null ? null : m[1] + r + m[3];
  };
  App.t = (s) => (s === null || s === undefined ? s : lang === 'en' ? (tr(String(s)) ?? String(s)) : String(s));
  App.untranslated = new Set();
  const TPL = window.KANTOOR_TPL_DICT || {};
  const tt = (s) => { const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); const h = TPL[m[2]]; return h === undefined ? null : m[1] + h + m[3]; };
  App.tt = (s) => (lang === 'en' ? (tt(String(s)) ?? App.t(s)) : s);

  if (lang !== 'en') { addLanguageOption(); return; }

  /* ---------- DOM translation ---------- */
  // Elements whose contents are the user's own data (never translated)
  const SKIP = 'style, script, .sl, #notes, [contenteditable="true"], textarea, input, #print-area, .thumb-wrap, .recent-row .rn, .ss-name b, .pl-row .grow, .cmt-text, .cmt-who, code, pre, .sym-grid, .icon-grid, .eq-strip, .sh-doc b, #sm-list .grow, .list-row .grow b, .fp-row #find-count, .pv-notes, .anim-name, .pd-cd-prev, .notranslate, [translate="no"]';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'data-ph', 'alt'];
  const isSkipped = (el) => !!(el && el.closest && el.closest(SKIP));
  const noteMiss = (s) => { if (/[a-zà-ÿ]{3,}/i.test(s) && /\b(de|het|een|van|en|naar|voor|met|niet|op|je|dia|bij|uit|aan|of|te)\b/i.test(s)) App.untranslated.add(s.trim()); };
  const multiLine = (p) => {
    const nodes = Array.from(p.childNodes);
    if (!nodes.some((n) => n.nodeType === 1 && n.tagName === 'BR')) return false;
    if (!nodes.every((n) => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === 'BR'))) return false;
    const texts = nodes.filter((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (texts.length < 2) return false;
    const full = texts.map((n) => n.nodeValue.trim()).reduce((a, b) => (a.endsWith('-') ? a.slice(0, -1) + b : a + ' ' + b));
    const r = tr(full);
    if (r === null) return false;
    p.__kantoorLines = true;
    if (r === full) return true;
    const words = r.split(' ');
    const per = Math.ceil(words.length / texts.length);
    texts.forEach((n, i) => { n.nodeValue = words.slice(i * per, (i + 1) * per).join(' '); });
    return true;
  };
  const textNode = (n) => {
    const p = n.parentElement;
    if (!p || p.classList.contains('i') || isSkipped(p)) return;
    const v = n.nodeValue;
    if (!v || !/[A-Za-zÀ-ÿ€]/.test(v)) return;
    if (p.__kantoorLines) return;
    if (p.childNodes.length > 1 && multiLine(p)) return;
    const r = tr(v);
    if (r !== null) { if (r !== v) n.nodeValue = r; } else noteMiss(v);
  };
  const element = (el) => {
    if (isSkipped(el) && !el.matches('input, textarea')) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      const r = tr(v);
      if (r !== null) { if (r !== v) el.setAttribute(a, r); } else noteMiss(v);
    }
    if (el.tagName === 'OPTGROUP' && el.label) { const r = tr(el.label); if (r !== null) el.label = r; }
  };
  const walk = (root) => {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) { if (isSkipped(root) && !root.matches('input, textarea')) return; element(root); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeType === 1 && n.matches && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else element(n); }
  };
  App.translateDom = walk;
  let observer = null;
  const start = () => {
    walk(document.documentElement);
    observer = new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'characterData') textNode(r.target);
        else if (r.type === 'attributes') element(r.target);
        else r.addedNodes.forEach((n) => walk(n));
      }
      observer.takeRecords();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ---------- names, dates, numbers ---------- */
  const fixTitle = () => {
    const P = App.pres; if (!P) return;
    const m = /^Presentatie(\d*)$/.exec(P.title || '');
    if (!m) return;
    P.title = 'Presentation' + m[1];
    const inp = document.getElementById('doc-title'); if (inp) inp.value = P.title;
    document.title = P.title + ' — Doek';
  };
  if (App.loadPres) { const origLoad = App.loadPres; App.loadPres = (...a) => { const r = origLoad(...a); fixTitle(); return r; }; }
  App.on && App.on('load', fixTitle);
  const remap = (proto, name) => { const o = proto[name]; proto[name] = function (loc, ...rest) { return o.call(this, loc === 'nl-NL' || loc === 'nl' ? 'en-US' : loc, ...rest); }; };
  remap(Date.prototype, 'toLocaleDateString'); remap(Date.prototype, 'toLocaleTimeString'); remap(Date.prototype, 'toLocaleString'); remap(Number.prototype, 'toLocaleString');
  App.fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString('en-US', opts);
  App.fmtDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  App.fmtNum = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString();
  App.parseNum = (s) => parseFloat(String(s).replace(/,/g, '.'));

  /* ---------- language option in File › Options and on the Account page ---------- */
  function addLanguageOption() {
    const orig = App.renderBackstage;
    if (!orig) return;
    App.renderBackstage = (sec) => {
      orig(sec);
      if (sec !== 'options' && sec !== 'about') return;
      const main = document.querySelector('#backstage .bs-main');
      if (!main || main.querySelector('#kantoor-lang')) return;
      const html = `<div class="opt-line" id="kantoor-lang-row"><span>${lang === 'en' ? 'Language / Taal' : 'Taal / Language'}</span><select id="kantoor-lang"><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="nl" ${lang === 'nl' ? 'selected' : ''}>Nederlands</option></select></div>`;
      const host = main.querySelector('.opt-body') || main.querySelector('.props') || main;
      if (host.classList && host.classList.contains('props')) host.insertAdjacentHTML('beforeend', `<span class="k">${lang === 'en' ? 'Language' : 'Taal'}</span><label class="chk" style="padding:0"><select id="kantoor-lang" style="height:28px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--panel);color:var(--text);padding:0 6px"><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="nl" ${lang === 'nl' ? 'selected' : ''}>Nederlands</option></select></label>`);
      else host.insertAdjacentHTML('afterbegin', html);
      main.querySelector('#kantoor-lang').addEventListener('change', (e) => App.setLanguage(e.target.value));
    };
  }
  addLanguageOption();
})();
