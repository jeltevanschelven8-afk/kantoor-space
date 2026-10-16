/* =========================================================
   Inkt / Cel (made by JJ van Schelven) — language layer
   The interface is written in Dutch; this layer translates every visible
   text to English at run time (default). The dictionaries live in js/lang/.
   Also sets App.LOCALE (numbers, dates, formula separators) and the
   language option in File › Options. Same file for Inkt and Cel.
   ========================================================= */
'use strict';

(() => {
  const isCel = !!App.book;
  const KEY = 'kantoor.lang';
  let lang = 'en';
  try { lang = localStorage.getItem(KEY) || 'en'; } catch { /* no storage */ }
  if (lang !== 'nl' && lang !== 'en') lang = 'en';
  App.LANG = lang;
  App.LOCALES = {
    en: { code: 'en-US', dec: '.', thou: ',', sep: ',', bool: ['TRUE', 'FALSE'], dateFmt: 'm/d/yyyy', dateLong: 'dddd, mmmm d, yyyy', dateMonth: 'mmm-yy', dateTime: 'm/d/yyyy h:mm', time: 'h:mm:ss', currency: '€', docLang: 'en-US', name: 'English', untitled: isCel ? 'Book' : 'Untitled document', sheet: 'Sheet' },
    nl: { code: 'nl-NL', dec: ',', thou: '.', sep: ';', bool: ['WAAR', 'ONWAAR'], dateFmt: 'd-m-yyyy', dateLong: 'dddd d mmmm yyyy', dateMonth: 'mmm-yy', dateTime: 'd-m-yyyy h:mm', time: 'h:mm:ss', currency: '€', docLang: 'nl-NL', name: 'Nederlands', untitled: isCel ? 'Map' : 'Naamloos document', sheet: 'Blad' },
  };
  App.LOCALE = App.LOCALES[lang];
  document.documentElement.lang = lang;
  App.setLanguage = (l) => { try { localStorage.setItem(KEY, l); } catch { /* none */ } location.reload(); };

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
        const nums = [];   // the digits of the key, in order: {3}{4} in the key may be {3}{4} or {0}{1} in the value
        // generic keys such as "{0} van {1}" only match numbers, otherwise they would translate names ("JJ van Schelven")
        const group = /^\{\d\}( van \{\d\}| gevonden)$/.test(k) ? '([\\d.,]+)' : '(.*?)';
        patterns.push({ re: new RegExp('^' + esc(k).replace(/\\\{(\d)\\\}/g, (_, d) => { nums.push(d); return group; }) + '$', 's'), v, nums });
      } else exact.set(k, v);
    }
    // most specific pattern first: "{0} van {1} woorden" before "{0} van {1}"
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
  // Translate a string, keeping leading/trailing whitespace. Returns null when unknown.
  const tr = (s) => {
    if (!s) return null;
    compile();
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const core = m[2];
    if (!core) return null;
    let r = exact.get(core);                       // also for keys without letters, such as "€ 100,00"
    if (r === undefined) {
      if (!/[A-Za-zÀ-ÿ]/.test(core)) return null;
      r = trCore(core);
      if (r === null && /\s/.test(core)) r = trCore(core.replace(/\s+/g, ' '));
    }
    return r === null ? null : m[1] + r + m[3];
  };
  App.t = (s) => (lang === 'en' ? (tr(String(s)) ?? s) : s);
  App.untranslated = new Set();   // for checking: Dutch texts without a translation
  // Contents of templates (lang/en-*-tpl.js) have their own dictionary, consulted first while a template is translated
  const TPL = window.KANTOOR_TPL_DICT || {};
  let tplMode = false;
  const tt = (s) => { const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); const h = TPL[m[2]]; return h === undefined ? null : m[1] + h + m[3]; };
  const trAny = (s) => { if (tplMode) { const h = tt(s); if (h !== null) return h; } return tr(s); };
  App.tt = (s) => (lang === 'en' ? (tt(String(s)) ?? App.t(s)) : s);

  if (lang !== 'en') { addLanguageOption(); return; }

  /* ---------- DOM translation ---------- */
  // Elements whose contents are the user's own data (never translated)
  const SKIP = 'style, script, #editor, [contenteditable], textarea, input, #print-area, #sheet-tabs, .obj, .fm-list, .dv-menu, .ss-name b, .recent-row .rn, .lv-col, #pv-fields select, .nf-sample, .sym-grid, .c-text, .c-who, .nav-item, .nav-result, .sheet .hf, .note-pop, code, pre, .mini, .mini-sheet, #sm-list .grow, .sh-doc b, #chart-palettes, .tstyle-chip, .theme-chip, .style-chip, .list-row .grow b, #nf-list, #nf-code, .ac-desc i';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'data-ph', 'alt'];
  const isSkipped = (el) => !!(el && el.closest && el.closest(SKIP));
  const noteMiss = (s) => { if (/[a-zà-ÿ]{3,}/i.test(s) && !/^[A-Z][A-Z0-9._]*$/.test(s)) App.untranslated.add(s.trim()); };
  // <span>Afdruk-<br>bereik</span>: ribbon labels on two lines are translated as a whole and spread over the lines again
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
    const r = trAny(v);
    if (r !== null) { if (r !== v) n.nodeValue = r; } else noteMiss(v);
  };
  const element = (el) => {
    if (isSkipped(el) && !el.matches('input, textarea')) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      const r = trAny(v);
      if (r !== null) { if (r !== v) el.setAttribute(a, r); } else noteMiss(v);
    }
    if ((el.tagName === 'INPUT' && /^(button|submit)$/.test(el.type)) && el.value) { const r = tr(el.value); if (r !== null) el.value = r; }
  };
  const walk = (root) => {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) element(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
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

  /* ---------- templates and the welcome document in English ---------- */
  // The templates are written in Dutch; their contents are translated after building (dictionary in lang/en-*-tpl.js).
  const trHtml = (html) => { const el = document.createElement('div'); el.innerHTML = html; tplMode = true; try { walk(el); } finally { tplMode = false; } return el.innerHTML; };
  if (isCel) {
    const fixNf = (nf) => (nf === 'd-m-yyyy' ? App.LOCALE.dateFmt : nf === 'd-m-yyyy h:mm' ? App.LOCALE.dateTime : nf);
    const localizeSheet = (sh) => {
      const oldName = sh.name;
      sh.name = App.tt(sh.name);
      sh.data.forEach((row) => row.forEach((cell) => {
        if (typeof cell.v === 'string') cell.v = App.tt(cell.v);
        if (cell.f) cell.f = cell.f.replace(/"([^"]*)"/g, (m, s) => '"' + App.tt(s) + '"');
        if (cell.s && cell.s.nf) cell.s.nf = fixNf(cell.s.nf);
      }));
      (sh.cf || []).forEach((rule) => ['v1', 'v2'].forEach((k) => { if (typeof rule[k] === 'string') rule[k] = /^-?\d+,\d+$/.test(rule[k]) ? rule[k].replace(',', '.') : App.tt(rule[k]); }));
      (sh.dv || []).forEach((rule) => { if (rule.list && rule.list[0] !== '=') rule.list = rule.list.split(';').map((x) => App.tt(x)).join(';'); });
      (sh.objs || []).forEach((o) => {
        if (!o.chart) return;
        if (o.chart.title) o.chart.title = App.tt(o.chart.title);
        if (o.chart.range && oldName !== sh.name) o.chart.range = o.chart.range.replace(new RegExp('^' + esc(oldName) + '!'), sh.name + '!');
      });
    };
    App.localizeSheet = localizeSheet;
    (App.TEMPLATES || []).forEach((t) => { if (t.build) { const b = t.build; t.build = (sh) => { b(sh); localizeSheet(sh); }; } });
    if (App.WELCOME) { const w = App.WELCOME; App.WELCOME = () => { const book = w(); book.title = App.tt(book.title); book.sheets.forEach(localizeSheet); return book; }; }
  } else {
    (App.TEMPLATES || []).forEach((t) => {
      if (t.html) { const h = t.html; t.html = () => trHtml(h()); }
      if (t.meta) { if (t.meta.header) t.meta.header = trHtml(t.meta.header); if (t.meta.footer) t.meta.footer = trHtml(t.meta.footer); }
    });
    if (App.WELCOME) { const w = App.WELCOME; App.WELCOME = () => trHtml(w()); }
  }

  /* ---------- default names, dates ---------- */
  const DEFAULT_NAMES = isCel ? /^Map(\d+)$/ : /^Naamloos document$/;
  const fixTitle = () => {
    const d = isCel ? App.book : App.doc;
    const m = DEFAULT_NAMES.exec(d.title || '');
    if (!m) return;
    d.title = isCel ? 'Book' + m[1] : 'Untitled document';
    const inp = document.getElementById('doc-title'); if (inp) inp.value = d.title;
    document.title = d.title + ' — ' + (isCel ? 'Cel' : 'Inkt');
  };
  const loadName = isCel ? 'loadBook' : 'loadDoc';
  const origLoad = App[loadName];
  App[loadName] = (...a) => { const r = origLoad(...a); fixTitle(); if (isCel) { App.book.sheets.forEach((s, i) => { const m = /^Blad(\d+)$/.exec(s.name); if (m && !App.book.sheets.some((x) => x.name === 'Sheet' + m[1])) s.name = 'Sheet' + m[1]; }); App.renderSheetTabs && App.renderSheetTabs(); } return r; };
  if (isCel) {
    const origNew = App.newSheet;
    App.newSheet = (name) => origNew(typeof name === 'string' ? name.replace(/^Blad(\d+)$/, 'Sheet$1') : name);
    const origUnique = App.uniqueSheetName;
    App.uniqueSheetName = (base) => origUnique(base === undefined || base === 'Blad' ? 'Sheet' : base);
  } else {
    // new documents get the English spelling language
    const od = App.defaultMeta; App.defaultMeta = () => Object.assign(od(), { lang: 'en-US' });
    if (App.ed) { App.ed.lang = 'en-US'; App.ed.setAttribute('lang', 'en-US'); }
  }
  // Dates and numbers written with the Dutch locale elsewhere in the code follow the interface language
  const remap = (proto, name) => { const o = proto[name]; proto[name] = function (loc, ...rest) { return o.call(this, loc === 'nl-NL' || loc === 'nl' ? 'en-US' : loc, ...rest); }; };
  remap(Date.prototype, 'toLocaleDateString'); remap(Date.prototype, 'toLocaleTimeString'); remap(Date.prototype, 'toLocaleString'); remap(Number.prototype, 'toLocaleString');
  // Cel: function names are shown in English
  if (isCel && App.FN) { Object.keys(App.FN).forEach((k) => { App.FN[k].nl = k; App.FN_NL[k] = k; }); }
  if (isCel && App.FN_CATS) App.FN_CATS.fin = 'Financial';   // the number format "Financieel" is "Accounting" in English, the function category "Financial"
  App.fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString('en-US', opts);
  App.fmtDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  App.fmtNum = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString();
  App.parseNum = (s) => parseFloat(String(s).replace(/,/g, ''));
  setTimeout(fixTitle, 0);

  /* ---------- language option in File › Options and on the Account page ---------- */
  function addLanguageOption() {
    const orig = App.renderBackstage;
    if (!orig) return;
    App.renderBackstage = (sec) => {
      orig(sec);
      if (sec !== 'options' && sec !== 'about' && sec !== 'account') return;
      const main = document.querySelector('#backstage .bs-main');
      if (!main || main.querySelector('#kantoor-lang')) return;
      const html = `<div class="opt-line" id="kantoor-lang-row"><span>${lang === 'en' ? 'Language / Taal' : 'Taal / Language'}</span><select id="kantoor-lang"><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="nl" ${lang === 'nl' ? 'selected' : ''}>Nederlands</option></select></div>`;
      const host = main.querySelector('.opt-body') || main.querySelector('.props') || main;
      if (host.classList && host.classList.contains('props')) host.insertAdjacentHTML('beforeend', `<span class="k">${lang === 'en' ? 'Language' : 'Taal'}</span><label class="chk" style="padding:0"><select id="kantoor-lang" style="height:28px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--panel);color:var(--text);padding:0 6px"><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="nl" ${lang === 'nl' ? 'selected' : ''}>Nederlands</option></select></label>`);
      else host.insertAdjacentHTML('beforeend', html);
      main.querySelector('#kantoor-lang').addEventListener('change', (e) => App.setLanguage(e.target.value));
    };
  }
  addLanguageOption();
})();
