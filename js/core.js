/* =========================================================
   Inkt — kern: namespace, selectie, geschiedenis, commando's
   ========================================================= */
'use strict';

const App = window.App = {
  commands: {},
  state: {
    view: 'print',          // print | web | read | focus
    zoom: 1,
    marks: false,
    painter: null,          // { styles, sticky }
    track: false,
    markup: 'all',
    protect: false,
    speaking: false,
    mergePreview: false,
    mergeHL: false,
    mergeIndex: 0,
    hfEditing: null,        // { el, kind }
    lastColors: { foreColor: '#ff0000', hiliteColor: '#ffff00', shading: '#e8e8e8', cellShading: '#e8e8e8' },
  },
  settings: {
    author: 'Ik',
    initials: 'IK',
    autosave: true,
    dark: false,
    ruler: true,
    nav: false,
    spell: true,
    defaultFont: 'Aptos',
    defaultSize: 12,
  },
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
App.$ = $; App.$$ = $$;

App.ed = document.getElementById('editor');
App.ed.classList.add('doc');

/* ---------- Hulpjes ---------- */
App.uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9);
App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.CM = 96 / 2.54;            // px per cm
App.PT = 96 / 72;              // px per pt
App.cm2px = (cm) => cm * App.CM;
App.px2cm = (px) => px / App.CM;
App.fmtNum = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ',');
App.parseNum = (s) => parseFloat(String(s).replace(',', '.'));
App.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
App.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
App.today = () => new Date();
App.fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString('nl-NL', opts);
App.fmtDateTime = (d) => new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

App.store = {
  get(k, fallback = null) {
    try { const v = localStorage.getItem('inkt.' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('inkt.' + k, JSON.stringify(v)); return true; } catch (e) { return false; }
  },
  del(k) { try { localStorage.removeItem('inkt.' + k); } catch { /* niets */ } },
};

App.loadScript = (() => {
  const cache = {};
  return (url) => cache[url] || (cache[url] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res;
    s.onerror = () => { delete cache[url]; rej(new Error('Kon ' + url + ' niet laden')); };
    document.head.appendChild(s);
  }));
})();
App.loadCss = (url) => {
  if ($$('link').some((l) => l.href === url)) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l);
};

App.readFile = (file, as = 'text') => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  if (as === 'dataurl') r.readAsDataURL(file);
  else if (as === 'buffer') r.readAsArrayBuffer(file);
  else r.readAsText(file);
});

App.pickFile = (accept, multiple = false) => new Promise((res) => {
  const inp = document.getElementById('file-input');
  inp.value = ''; inp.accept = accept || ''; inp.multiple = multiple;
  inp.onchange = () => res(multiple ? Array.from(inp.files) : inp.files[0]);
  inp.click();
});

App.download = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

/* ---------- Selectie ---------- */
App.lastRange = null;

App.inEditor = (node) => !!node && (node === App.ed || App.ed.contains(node));
App.editRoot = () => (App.state.hfEditing ? App.state.hfEditing.el : App.ed);
App.inRoot = (node) => { const r = App.editRoot(); return !!node && (node === r || r.contains(node)); };

App.getRange = () => {
  const sel = window.getSelection();
  if (sel.rangeCount && App.inRoot(sel.getRangeAt(0).commonAncestorContainer)) return sel.getRangeAt(0);
  return null;
};

App.saveRange = () => {
  const r = App.getRange();
  if (r) App.lastRange = r.cloneRange();
};

App.setRange = (r) => {
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  App.lastRange = r.cloneRange();
};

App.restoreRange = () => {
  const root = App.editRoot();
  const saved = App.lastRange;
  const cr = App.getRange();
  const current = cr ? cr.cloneRange() : null;
  if (document.activeElement !== root && !(root.contains(document.activeElement))) root.focus({ preventScroll: true });
  if (current) { if (!App.getRange()) App.setRange(current); return App.getRange(); }
  if (saved && App.inRoot(saved.commonAncestorContainer)) {
    App.setRange(saved);
    return saved;
  }
  // Geen bekende selectie: aan het einde van het document plaatsen
  const r = document.createRange();
  const last = root.lastElementChild || root;
  r.selectNodeContents(last); r.collapse(false);
  App.setRange(r);
  return r;
};

App.isVisible = (el) => {
  const sc = document.getElementById('canvas-scroll');
  if (!sc || !el.getBoundingClientRect) return true;
  const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
  return r.bottom > s.top + 20 && r.top < s.bottom - 20;
};
App.placeCaret = (node, offset = 0) => {
  const r = document.createRange();
  r.setStart(node, offset); r.collapse(true);
  App.setRange(r);
};
App.caretAtEnd = (el) => {
  // Bij voorkeur in het laatste tekstknooppunt (betrouwbaarder voor invoegen)
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('[contenteditable="false"]') && n.parentElement.closest('[contenteditable="false"]') !== el.closest('[contenteditable="false"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let last = null, n;
  while ((n = w.nextNode())) last = n;
  const r = document.createRange();
  if (last && last.data.length) { r.setStart(last, last.length); r.collapse(true); } else { r.selectNodeContents(el); r.collapse(false); }
  App.setRange(r);
};
App.selectNode = (el) => { const r = document.createRange(); r.selectNode(el); App.setRange(r); };
App.selectContents = (el) => { const r = document.createRange(); r.selectNodeContents(el); App.setRange(r); };

App.closest = (node, sel, root = App.editRoot()) => {
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== root && n !== document) {
    if (n.nodeType === 1 && n.matches(sel)) return n;
    n = n.parentNode;
  }
  return null;
};
App.selClosest = (sel) => {
  const r = App.getRange() || App.lastRange;
  return r ? App.closest(r.startContainer, sel) : null;
};

/* Paden: knooppunt <-> lijst met indexen vanaf de editor */
App.nodePath = (node, root = App.ed) => {
  const path = [];
  while (node && node !== root) {
    const p = node.parentNode;
    if (!p) return null;
    path.unshift(Array.prototype.indexOf.call(p.childNodes, node));
    node = p;
  }
  return node === root ? path : null;
};
App.fromPath = (path, root = App.ed) => {
  let n = root;
  for (const i of path || []) { if (!n.childNodes[i]) return null; n = n.childNodes[i]; }
  return n;
};
App.getSelPath = () => {
  const r = App.getRange() || App.lastRange;
  if (!r || !App.inEditor(r.startContainer)) return null;
  return { s: App.nodePath(r.startContainer), so: r.startOffset, e: App.nodePath(r.endContainer), eo: r.endOffset };
};
App.setSelPath = (p) => {
  if (!p) return false;
  const s = App.fromPath(p.s), e = App.fromPath(p.e);
  if (!s || !e) return false;
  try {
    const r = document.createRange();
    r.setStart(s, Math.min(p.so, s.nodeType === 3 ? s.length : s.childNodes.length));
    r.setEnd(e, Math.min(p.eo, e.nodeType === 3 ? e.length : e.childNodes.length));
    App.setRange(r);
    return true;
  } catch { return false; }
};

/* Tekstposities: robuust bij herstructureren */
App.textOffset = (container, offset, root = App.ed) => {
  const r = document.createRange();
  r.selectNodeContents(root);
  try { r.setEnd(container, offset); } catch { return 0; }
  return r.toString().length;
};
App.getSelOffsets = (root = App.ed) => {
  const r = App.getRange() || App.lastRange;
  if (!r) return null;
  return { s: App.textOffset(r.startContainer, r.startOffset, root), e: App.textOffset(r.endContainer, r.endOffset, root), root };
};
App.pointAt = (pos, root = App.ed, preferNext = false) => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n, acc = 0, last = null;
  while ((n = w.nextNode())) {
    const len = n.length;
    if (pos < acc + len || (pos === acc + len && !preferNext)) return { node: n, offset: pos - acc };
    acc += len; last = n;
  }
  if (last) return { node: last, offset: last.length };
  return { node: root, offset: 0 };
};
App.setSelOffsets = (o) => {
  if (!o) return;
  const s = App.pointAt(o.s, o.root, o.s !== o.e), e = App.pointAt(o.e, o.root);
  try {
    const r = document.createRange();
    r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
    App.setRange(r);
  } catch { /* niets */ }
};

/* Selectie bewaren met tijdelijke markeringen (overleeft herstructureren) */
App.markSel = () => {
  const r = App.getRange() || App.lastRange;
  if (!r) return null;
  const mk = () => { const s = document.createElement('span'); s.className = '__sel'; return s; };
  const end = mk();
  const er = r.cloneRange(); er.collapse(false); er.insertNode(end);
  let start = null;
  if (!r.collapsed) { start = mk(); const sr = r.cloneRange(); sr.collapse(true); sr.insertNode(start); }
  return { start, end };
};
App.restoreMarks = (m) => {
  if (!m) return;
  const idx = (n) => Array.prototype.indexOf.call(n.parentNode.childNodes, n);
  const a = m.start && m.start.isConnected ? m.start : m.end;
  if (!a.isConnected) { $$('.__sel').forEach((s) => s.remove()); return; }
  const sp = a.parentNode, si = idx(a);
  if (m.start) m.start.remove();
  const ep = m.end.parentNode, ei = idx(m.end);
  m.end.remove();
  $$('.__sel').forEach((s) => s.remove());
  try {
    const r = document.createRange();
    r.setStart(sp, Math.min(si, sp.childNodes.length));
    r.setEnd(ep, Math.min(ei, ep.childNodes.length));
    App.setRange(r);
  } catch { /* niets */ }
};

/* Blokken (alinea's) */
App.BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th,div.textbox';
App.LEAF_BLOCK = 'p,h1,h2,h3,h4,h5,h6,pre';
App.blockOf = (node) => {
  const root = App.editRoot();
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== root) {
    if (n.nodeType === 1 && n.matches(App.BLOCK)) return n;
    n = n.parentNode;
  }
  return null;
};
App.ensureBlocks = () => {
  // Losse tekst direct in de editor in een <p> zetten
  const ed = App.ed;
  if (!ed.firstChild || ed.innerHTML === '<br>') { ed.innerHTML = '<p><br></p>'; return true; }
  let changed = false, cur = null;
  Array.from(ed.childNodes).forEach((n) => {
    const inline = n.nodeType === 3 ? n.textContent.trim() !== '' || cur : (n.nodeType === 1 && /^(SPAN|B|I|U|S|STRONG|EM|A|FONT|SUB|SUP|BR|IMG|MARK|CODE|INS|DEL|SMALL)$/.test(n.tagName));
    if (inline) {
      if (!cur) { cur = document.createElement('p'); ed.insertBefore(cur, n); changed = true; }
      cur.appendChild(n);
    } else if (n.nodeType === 3) {
      n.remove();
    } else { cur = null; }
  });
  return changed;
};
App.getSelectedBlocks = () => {
  const r = App.getRange() || App.lastRange;
  if (!r) return [];
  const root = App.editRoot();
  if (root !== App.ed) return [root];
  if (r.collapsed) {
    const b = App.blockOf(r.startContainer);
    return b ? [b] : [];
  }
  const all = $$(App.BLOCK, root).filter((b) => r.intersectsNode(b));
  // Containers die zelf alinea's bevatten weglaten (bv. li met p, td met p)
  const res = all.filter((b) => !b.querySelector(App.LEAF_BLOCK + ',li,blockquote'));
  // Randgeval: selectie eindigt precies aan het begin van een blok
  if (res.length > 1) {
    const last = res[res.length - 1];
    const rr = document.createRange(); rr.selectNodeContents(last);
    if (r.compareBoundaryPoints(Range.END_TO_START, rr) === 0) res.pop();
  }
  return res.length ? res : (App.blockOf(r.startContainer) ? [App.blockOf(r.startContainer)] : []);
};

/* Tekstknooppunten binnen een bereik omhullen (voor opmerkingen, wijzigingen) */
App.textNodesIn = (range) => {
  const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
  const out = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  let n; while ((n = w.nextNode())) out.push(n);
  return out;
};
App.splitRangeText = (range) => {
  // Splitst begin/eind-tekstknooppunten zodat het bereik precies hele knooppunten omvat
  let { startContainer: sc, startOffset: so, endContainer: ec, endOffset: eo } = range;
  if (ec.nodeType === 3 && eo < ec.length) { ec.splitText(eo); }
  if (sc.nodeType === 3 && so > 0) {
    const nn = sc.splitText(so);
    if (ec === sc) { ec = nn; eo = eo - so; }
    sc = nn; so = 0;
  }
  const r = document.createRange();
  if (sc.nodeType === 3) r.setStart(sc, 0); else r.setStart(sc, so);
  if (ec.nodeType === 3) r.setEnd(ec, ec.length); else r.setEnd(ec, eo);
  return r;
};
App.wrapRange = (range, make, skip) => {
  const r = App.splitRangeText(range);
  const nodes = App.textNodesIn(r).filter((n) => n.length > 0 && (!skip || !skip(n)));
  const wrappers = [];
  nodes.forEach((n) => {
    // Alleen tekst binnen het bereik
    const nr = document.createRange(); nr.selectNodeContents(n);
    if (r.compareBoundaryPoints(Range.START_TO_END, nr) <= 0 || r.compareBoundaryPoints(Range.END_TO_START, nr) >= 0) return;
    const w = make();
    n.parentNode.insertBefore(w, n);
    w.appendChild(n);
    wrappers.push(w);
  });
  return wrappers;
};
App.unwrap = (el) => {
  const p = el.parentNode;
  if (!p) return;
  while (el.firstChild) p.insertBefore(el.firstChild, el);
  el.remove();
  p.normalize();
};

/* ---------- execCommand-hulp ---------- */
App.ex = (cmd, val = null, css = false) => {
  try { document.execCommand('styleWithCSS', false, css); } catch { /* niets */ }
  return document.execCommand(cmd, false, val);
};

/* HTML invoegen op de cursor. Inline-fragmenten voegen we zelf in, omdat de
   browser niet-bewerkbare elementen (velden, vergelijkingen) anders buiten de alinea zet. */
App.BLOCK_RE = /<(p|div|h[1-6]|ul|ol|li|table|tbody|tr|td|th|blockquote|pre|hr|section|figure)[\s>/]/i;
App.insertHTML = (html) => {
  if (App.BLOCK_RE.test(html)) return App.ex('insertHTML', html);
  let r = App.restoreRange();
  if (!r.collapsed) r.deleteContents();
  const block = App.blockOf(r.startContainer);
  if (block && !block.textContent && block.querySelectorAll('img,[contenteditable="false"]').length === 0 && block.querySelector('br')) {
    block.innerHTML = '';
    r = document.createRange(); r.setStart(block, 0); r.collapse(true);
  }
  const frag = r.createContextualFragment(html);
  const last = frag.lastChild;
  if (!last) return false;
  r.insertNode(frag);
  const nr = document.createRange(); nr.setStartAfter(last); nr.collapse(true);
  App.setRange(nr);
  return true;
};

/* ---------- Commando's ---------- */
App.def = (name, fn, meta = {}) => { App.commands[name] = { fn, edit: false, ...meta }; };
App.defEdit = (name, fn, meta = {}) => { App.commands[name] = { fn, edit: true, ...meta }; };
App.exec = (name, arg, el) => {
  const c = App.commands[name];
  if (!c) { App.toast('Deze functie is nog niet beschikbaar: ' + name, 'info'); return; }
  if (c.edit) {
    if (App.state.protect && !c.allowProtected) { App.toast('Het document is beveiligd. Hef de beveiliging op via Controleren.', 'lock'); return; }
    App.run(() => c.fn(arg, el));
  } else {
    c.fn(arg, el);
  }
};
App.run = (fn) => {
  App.history.flush();
  // Paginerings-duwtjes weghalen, zodat commando's de echte marges zien en zetten
  // (de layout zet ze vóór het volgende beeld weer terug)
  if (App.clearPushes) App.clearPushes();
  App.restoreRange();
  App.history.mark();
  let res;
  try { res = fn(); } catch (e) { console.error(e); App.toast('Er ging iets mis: ' + e.message, 'error'); }
  App.changed({ immediate: true });
  return res;
};

/* ---------- Geschiedenis (eigen ongedaan maken) ---------- */
App.history = {
  stack: [], i: -1, timer: null, max: 300,
  imgs: [], imgIdx: new Map(),
  /* HTML zonder paginerings-duwtjes en met grote data-URL's (afbeeldingen) vervangen
     door een verwijzing, zodat 300 stappen niet 300 kopieën van elke afbeelding bewaren. */
  pack() {
    let html;
    if (App.ed.querySelector('[data-pg], tr.pg-row')) {
      const c = App.ed.cloneNode(true);
      if (App.clearRows) App.clearRows(c);
      c.querySelectorAll('[data-pg]').forEach((el) => {
        el.style.marginTop = el.dataset.pgOrig || '';
        el.removeAttribute('data-pg'); el.removeAttribute('data-pg-orig');
        if (!el.getAttribute('style')) el.removeAttribute('style');
      });
      html = c.innerHTML;
    } else html = App.ed.innerHTML;
    return html.replace(/="(data:[^"]{400,})"/g, (m, url) => {
      let id = this.imgIdx.get(url);
      if (id === undefined) { id = this.imgs.length; this.imgs.push(url); this.imgIdx.set(url, id); }
      return `="inkt-img:${id}"`;
    });
  },
  unpack(html) { return html.replace(/="inkt-img:(\d+)"/g, (m, id) => `="${this.imgs[+id] || ''}"`); },
  // Pagina-instelling, kop/voettekst en ontwerp horen ook bij ongedaan maken (zoals in Word)
  LOOK: ['page', 'header', 'footer', 'headerFirst', 'footerFirst', 'firstDiff', 'theme', 'themeFonts', 'themeColors', 'spacing', 'watermark', 'pageColor', 'pageBorder', 'hyphen', 'comments'],
  lookJson() { const m = App.doc.meta, o = {}; this.LOOK.forEach((k) => { o[k] = k === 'comments' ? (m.comments || []).filter((c) => !c.draft).map(({ editing, ...c }) => c) : m[k]; }); return JSON.stringify(o); },
  snapshot() {
    return { html: this.pack(), meta: this.lookJson(), sel: App.getSelPath() };
  },
  /* Cursorpositie vlak vóór een bewerking: daar zet ongedaan maken de cursor terug (zoals Word) */
  mark() { if (!this.timer && !this.before) this.before = App.getSelPath(); },
  push() {
    clearTimeout(this.timer); this.timer = null;
    const s = this.snapshot();
    s.before = this.before; this.before = null;
    const cur = this.stack[this.i];
    if (cur && cur.html === s.html && cur.meta === s.meta) { cur.sel = s.sel || cur.sel; return; }
    this.stack = this.stack.slice(0, this.i + 1);
    this.stack.push(s);
    if (this.stack.length > this.max) this.stack.shift();
    this.i = this.stack.length - 1;
  },
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 450); },
  flush() { if (this.timer) this.push(); },
  reset() { this.stack = []; this.i = -1; this.imgs = []; this.imgIdx = new Map(); this.before = null; this.push(); },
  restore(s, sel) {
    if (s.meta && s.meta !== this.lookJson()) {
      Object.assign(App.doc.meta, JSON.parse(s.meta));
      if (App.applyDocLook) App.applyDocLook();
      if (App.renderComments) { App.doc.meta.comments = App.doc.meta.comments || []; document.body.classList.toggle('comments-on', App.doc.meta.comments.length > 0); this.restoreComments = true; }
      App._forceSheets = true;
    }
    App.ed.innerHTML = this.unpack(s.html);
    App.ed.focus({ preventScroll: true });
    if (!(sel && App.setSelPath(sel)) && !App.setSelPath(s.sel)) App.caretAtEnd(App.ed.lastElementChild || App.ed);
    App.changed({ noRecord: true });
    if (this.restoreComments) { this.restoreComments = false; App.renderComments(); }
    const r = App.getRange();
    if (r) { const el = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; if (el && el.scrollIntoView && !App.isVisible(el)) el.scrollIntoView({ block: 'center' }); }
  },
  undo() {
    if (App.state.hfEditing) { document.execCommand('undo'); return; }
    this.flush();
    if (this.i > 0) { const undone = this.stack[this.i]; this.i--; this.restore(this.stack[this.i], undone.before); }
    else App.toast('Niets meer om ongedaan te maken', 'undo');
  },
  redo() {
    if (App.state.hfEditing) { document.execCommand('redo'); return; }
    this.flush();
    if (this.i < this.stack.length - 1) { this.i++; this.restore(this.stack[this.i]); }
  },
};

/* ---------- Wijzigingsmelding ---------- */
App.hooks = { change: [], selection: [], layout: [] };
App.on = (evt, fn) => App.hooks[evt].push(fn);
App.emit = (evt, ...a) => App.hooks[evt].forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });

App.changed = (opts = {}) => {
  if (App.ensureBlocks()) { /* structuur hersteld */ }
  if (!opts.noRecord) {
    if (opts.immediate) App.history.push(); else App.history.schedule();
  }
  App.markDirty();
  App.emit('change', opts);
  if (opts.typing) App.layoutHint();
  App.scheduleLayout(!opts.typing);
  App.scheduleState();
};

/* Paginering inplannen. Bij gewoon typen onthouden we alleen welk blok veranderde:
   als dat blok even hoog blijft, verschuift er niets en slaan we de (dure) layout over. */
App._layoutFull = true;
App._layoutHints = new Set();
App.unitOf = (node) => {
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  if (!n || n === App.ed || !App.ed.contains(n)) return null;
  while (n.parentNode && n.parentNode !== App.ed) {
    if (n.tagName === 'LI' && /^(UL|OL)$/.test(n.parentNode.tagName) && n.parentNode.parentNode === App.ed) return n;
    n = n.parentNode;
  }
  return n.parentNode === App.ed ? n : null;
};
App.layoutHint = () => {
  const r = App.getRange();
  const u = r && App.unitOf(r.startContainer);
  if (u) App._layoutHints.add(u); else App._layoutFull = true;
};
App.layoutStillValid = () => {
  if (App._layoutFull || !App.pages || !App.pages.h || !App._layoutHints.size) return false;
  if (App.pageUnits().length !== App.pages.n) return false;   // blok erbij of weg
  const z = App.state.zoom;
  for (const u of App._layoutHints) {
    const h0 = u.isConnected ? App.pages.h.get(u) : undefined;
    if (h0 === undefined || Math.abs(u.getBoundingClientRect().height / z - h0) > 0.1) return false;
  }
  return true;
};
App.scheduleLayout = (() => {
  let raf = 0;
  return (full = true) => {
    if (full) App._layoutFull = true;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const skip = App.layoutStillValid();
      const from = !App._layoutFull && App._layoutHints.size === 1 ? [...App._layoutHints][0] : null;
      App._layoutFull = false; App._layoutHints.clear();
      if (skip) return;
      App.layout && App.layout(from && from.isConnected ? from : undefined); App.emit('layout');
    });
  };
})();
App.scheduleState = (() => {
  let raf = 0;
  return () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; App.updateState && App.updateState(); }); };
})();

/* ---------- Document (metadata) ---------- */
App.defaultMeta = () => ({
  page: { size: 'A4', orient: 'portrait', margins: { t: 2.54, r: 2.54, b: 2.54, l: 2.54 } },
  header: '', footer: '', headerFirst: '', footerFirst: '', firstDiff: false,
  theme: 'inkt', themeColors: null, themeFonts: null, spacing: 'normal',
  watermark: '', pageColor: '', pageBorder: '', hyphen: false,
  lang: 'nl-NL', citeStyle: 'apa',
  comments: [], sources: [],
  mail: { fields: [], records: [] },
  author: '', created: Date.now(), modified: Date.now(),
});
App.doc = { id: App.uid('d'), title: 'Naamloos document', meta: App.defaultMeta() };

App.markDirty = () => {
  App.doc.dirty = true;
  App.doc.meta.modified = Date.now();
  const s = $('#save-state');
  if (s) { s.textContent = App.settings.autosave ? 'Opslaan…' : 'Niet opgeslagen'; s.classList.add('dirty'); }
  if (App.settings.autosave) App.autosave();
};
App.autosave = App.debounce(() => App.saveLocal && App.saveLocal(true), 1200);
