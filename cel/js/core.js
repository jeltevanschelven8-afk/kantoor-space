/* =========================================================
   Cel (gemaakt door JJ van Schelven) — kern: namespace, werkmap-model, adressen, geschiedenis, commando's
   ========================================================= */
'use strict';

const App = window.App = {
  commands: {},
  state: {
    zoom: 1,
    painter: null,          // { styles, sticky }
    editing: null,          // { r, c, mode: 'enter' | 'edit', src: 'cell' | 'bar' }
    clip: null,             // interne klembordinhoud
    speaking: false,
    showFormulas: false,
    notes: false,
    view: 'normal',         // normal | breaks
    lastColors: { fontColor: '#ff0000', fillColor: '#ffff00', tabColor: '#107c41' },
    lastBorder: 'bottom',
  },
  settings: {
    autosave: true,
    dark: false,
    fbar: true,
    stats: { avg: true, count: true, sum: true, min: false, max: false, numcount: false },
    recentFns: ['SUM', 'AVERAGE', 'IF', 'VLOOKUP', 'COUNT', 'MAX', 'MIN', 'ROUND'],
  },
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
App.$ = $; App.$$ = $$;

/* ---------- Hulpjes ---------- */
App.uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9);
App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.CM = 96 / 2.54;
App.fmtNum = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ',');
App.parseNum = (s) => parseFloat(String(s).replace(',', '.'));
App.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
App.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
App.fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString('nl-NL', opts);
App.fmtDateTime = (d) => new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
App.clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

App.store = {
  get(k, fallback = null) {
    try { const v = localStorage.getItem('cel.' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('cel.' + k, JSON.stringify(v)); return true; } catch (e) { return false; }
  },
  del(k) { try { localStorage.removeItem('cel.' + k); } catch { /* niets */ } },
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

/* ---------- Adressen ---------- */
App.MAXR = 1048576;
App.MAXC = 16384;
App.colName = (c) => {
  let s = ''; c += 1;
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
};
App.colIndex = (s) => {
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
App.addr = (r, c) => App.colName(c) + (r + 1);
App.parseAddr = (s) => {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(s).trim());
  if (!m) return null;
  const c = App.colIndex(m[1]), r = +m[2] - 1;
  if (r < 0 || r >= App.MAXR || c < 0 || c >= App.MAXC) return null;
  return { r, c };
};
App.norm = (g) => ({ r1: Math.min(g.r1, g.r2), c1: Math.min(g.c1, g.c2), r2: Math.max(g.r1, g.r2), c2: Math.max(g.c1, g.c2) });
App.rangeStr = (g) => {
  if (g.c1 === 0 && g.c2 === App.MAXC - 1) return (g.r1 + 1) + ':' + (g.r2 + 1);
  if (g.r1 === 0 && g.r2 === App.MAXR - 1) return App.colName(g.c1) + ':' + App.colName(g.c2);
  const a = App.addr(g.r1, g.c1);
  return g.r1 === g.r2 && g.c1 === g.c2 ? a : a + ':' + App.addr(g.r2, g.c2);
};
App.absRangeStr = (g) => {
  const a = '$' + App.colName(g.c1) + '$' + (g.r1 + 1);
  return g.r1 === g.r2 && g.c1 === g.c2 ? a : a + ':$' + App.colName(g.c2) + '$' + (g.r2 + 1);
};
App.parseRange = (s) => {
  s = String(s).trim().replace(/\$/g, '');
  let m = /^([A-Za-z]{1,3}\d+)(?::([A-Za-z]{1,3}\d+))?$/.exec(s);
  if (m) {
    const a = App.parseAddr(m[1]), b = m[2] ? App.parseAddr(m[2]) : a;
    if (!a || !b) return null;
    return App.norm({ r1: a.r, c1: a.c, r2: b.r, c2: b.c });
  }
  m = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(s);
  if (m) return App.norm({ r1: 0, c1: App.colIndex(m[1]), r2: App.MAXR - 1, c2: App.colIndex(m[2]) });
  m = /^(\d+):(\d+)$/.exec(s);
  if (m) return App.norm({ r1: +m[1] - 1, c1: 0, r2: +m[2] - 1, c2: App.MAXC - 1 });
  return null;
};
App.inRange = (g, r, c) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
App.rangesOverlap = (a, b) => a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
App.sheetRef = (name) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && !App.parseAddr(name) ? name : "'" + name.replace(/'/g, "''") + "'");

/* ---------- Werkmap en bladen ---------- */
App.DEF_W = 64;
App.DEF_H = 20;
App.DEF_FONT = 'Aptos Narrow';
App.DEF_SIZE = 11;
App.newSheet = (name) => ({
  id: App.uid('s'), name,
  data: new Map(),           // r -> Map(c -> cel)
  colW: {}, rowH: {}, rowManual: {},
  hidR: {}, hidC: {}, fhid: {},
  colS: {}, rowS: {},
  merges: [], freeze: { r: 0, c: 0 }, sparks: [], pivots: [],
  filter: null, cf: [], dv: [], objs: [],
  tab: '', hidden: false, protect: false,
  grid: true, heads: true, zoom: 1,
  defW: App.DEF_W, defH: App.DEF_H,
  page: { size: 'A4', orient: 'portrait', margins: { t: 1.9, r: 1.8, b: 1.9, l: 1.8 }, fitW: 0, scale: 100, grid: false, heads: false, header: '', footer: '', center: false },
  printArea: null, printTitles: null,
  sel: { ranges: [{ r1: 0, c1: 0, r2: 0, c2: 0 }], ar: 0, ac: 0, ri: 0 },
  scroll: { x: 0, y: 0 },
});
App.newBook = (title = 'Map1') => ({
  id: App.uid('b'), title,
  sheets: [App.newSheet('Blad1')],
  active: 0, names: {}, calc: 'auto',
  created: Date.now(), modified: Date.now(),
});
App.book = App.newBook();
App.media = {};                // id -> data-URL (afbeeldingen, buiten de geschiedenis)
App.sh = () => App.book.sheets[App.book.active];
App.sheetByName = (name) => {
  const n = String(name).toLowerCase();
  return App.book.sheets.find((s) => s.name.toLowerCase() === n) || null;
};
App.uniqueSheetName = (base = 'Blad') => {
  let i = App.book.sheets.length + 1;
  while (App.sheetByName(base + i)) i++;
  return base + i;
};

/* Cellen */
App.getCell = (sh, r, c) => { const row = sh.data.get(r); return row ? row.get(c) : undefined; };
App.cellAt = (sh, r, c) => {
  let row = sh.data.get(r);
  if (!row) { row = new Map(); sh.data.set(r, row); }
  let cell = row.get(c);
  if (!cell) { cell = {}; row.set(c, cell); }
  return cell;
};
App.delCell = (sh, r, c) => {
  const row = sh.data.get(r);
  if (!row) return;
  row.delete(c);
  if (!row.size) sh.data.delete(r);
};
App.cleanCell = (sh, r, c) => {
  const cell = App.getCell(sh, r, c);
  if (!cell) return;
  if (cell.s && !Object.keys(cell.s).length) delete cell.s;
  if ((cell.v === undefined || cell.v === null || cell.v === '') && !cell.f && !cell.s && !cell.n && !cell.l) App.delCell(sh, r, c);
};
App.eachCell = (sh, fn) => { sh.data.forEach((row, r) => row.forEach((cell, c) => fn(r, c, cell))); };
App.cellCount = (sh) => { let n = 0; sh.data.forEach((row) => { n += row.size; }); return n; };
/* Alle bestaande cellen in een bereik (sparse, ook voor hele kolommen) */
App.eachInRange = (sh, g, fn) => {
  const rows = g.r2 - g.r1 + 1;
  if (rows > sh.data.size * 2) {
    const keys = Array.from(sh.data.keys()).filter((r) => r >= g.r1 && r <= g.r2).sort((a, b) => a - b);
    for (const r of keys) {
      const row = sh.data.get(r);
      const cs = Array.from(row.keys()).filter((c) => c >= g.c1 && c <= g.c2).sort((a, b) => a - b);
      for (const c of cs) fn(r, c, row.get(c));
    }
  } else {
    for (let r = g.r1; r <= g.r2; r++) {
      const row = sh.data.get(r);
      if (!row) continue;
      if (g.c2 - g.c1 + 1 > row.size * 2) {
        const cs = Array.from(row.keys()).filter((c) => c >= g.c1 && c <= g.c2).sort((a, b) => a - b);
        for (const c of cs) fn(r, c, row.get(c));
      } else {
        for (let c = g.c1; c <= g.c2; c++) { const cell = row.get(c); if (cell) fn(r, c, cell); }
      }
    }
  }
};
App.hasValue = (cell) => !!cell && (cell.f || (cell.v !== undefined && cell.v !== null && cell.v !== ''));
App.valueOf = (cell) => (!cell ? null : cell.f ? cell.cv : cell.v);
App.usedRange = (sh, withStyles = false) => {
  let r1 = Infinity, c1 = Infinity, r2 = -1, c2 = -1;
  App.eachCell(sh, (r, c, cell) => {
    if (!withStyles && !App.hasValue(cell)) return;
    if (r < r1) r1 = r; if (r > r2) r2 = r; if (c < c1) c1 = c; if (c > c2) c2 = c;
  });
  return r2 < 0 ? null : { r1, c1, r2, c2 };
};
/* Laatste gebruikte rij en kolom (voor Ctrl+End en schuifbereik) */
App.extent = (sh) => {
  let r2 = 0, c2 = 0;
  App.eachCell(sh, (r, c) => { if (r > r2) r2 = r; if (c > c2) c2 = c; });
  sh.merges.forEach((m) => { r2 = Math.max(r2, m.r2); c2 = Math.max(c2, m.c2); });
  return { r: r2, c: c2 };
};

/* Effectieve celstijl: kolom- en rijstijl met de celstijl erover */
App.EMPTY_STYLE = Object.freeze({});
App.styleAt = (sh, r, c, cell) => {
  if (cell === undefined) cell = App.getCell(sh, r, c);
  const cs = sh.colS[c], rs = sh.rowS[r], s = cell && cell.s;
  if (!cs && !rs) return s || App.EMPTY_STYLE;
  return Object.assign({}, cs, rs, s);
};

/* Samengevoegde cellen */
App.mergeAt = (sh, r, c) => {
  for (const m of sh.merges) if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m;
  return null;
};
App.expandMerges = (sh, g) => {
  g = { ...g };
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of sh.merges) {
      if (App.rangesOverlap(m, g) && (m.r1 < g.r1 || m.c1 < g.c1 || m.r2 > g.r2 || m.c2 > g.c2)) {
        g = { r1: Math.min(g.r1, m.r1), c1: Math.min(g.c1, m.c1), r2: Math.max(g.r2, m.r2), c2: Math.max(g.c2, m.c2) };
        changed = true;
      }
    }
  }
  return g;
};

/* ---------- Selectie ---------- */
App.sel = () => App.sh().sel;
App.selRange = () => { const s = App.sel(); return s.ranges[s.ri] || s.ranges[0]; };
App.selRanges = () => App.sel().ranges;
App.activeCell = () => { const s = App.sel(); return { r: s.ar, c: s.ac }; };
App.setSel = (g, ar, ac, add = false) => {
  const sh = App.sh();
  g = App.expandMerges(sh, App.norm(g));
  const s = sh.sel;
  if (add) { s.ranges.push(g); s.ri = s.ranges.length - 1; } else { s.ranges = [g]; s.ri = 0; }
  s.ar = ar ?? g.r1; s.ac = ac ?? g.c1;
  App.selChanged();
};
App.selectCell = (r, c, add = false) => {
  const sh = App.sh();
  r = App.clamp(r, 0, App.MAXR - 1); c = App.clamp(c, 0, App.MAXC - 1);
  const m = App.mergeAt(sh, r, c);
  if (m) App.setSel(m, m.r1, m.c1, add); else App.setSel({ r1: r, c1: c, r2: r, c2: c }, r, c, add);
};
App.selChanged = () => {
  App.emit('selection');
  App.scheduleRender();
  App.scheduleState();
};
/* Alle geselecteerde cellen (zonder dubbelingen bij overlap), begrensd tot het gebruikte deel */
App.selBounded = (g, sh = App.sh()) => {
  if (g.r2 - g.r1 < 5000 && g.c2 - g.c1 < 500) return g;
  const e = App.extent(sh);
  return { r1: g.r1, c1: g.c1, r2: Math.min(g.r2, Math.max(g.r1, e.r)), c2: Math.min(g.c2, Math.max(g.c1, e.c)) };
};
App.isFullRow = (g) => g.c1 === 0 && g.c2 === App.MAXC - 1;
App.isFullCol = (g) => g.r1 === 0 && g.r2 === App.MAXR - 1;

/* ---------- Commando's ---------- */
App.def = (name, fn, meta = {}) => { App.commands[name] = { fn, edit: false, ...meta }; };
App.defEdit = (name, fn, meta = {}) => { App.commands[name] = { fn, edit: true, ...meta }; };
App.exec = (name, arg, el) => {
  const c = App.commands[name];
  if (!c) { App.toast('Deze functie is nog niet beschikbaar: ' + name, 'info'); return; }
  if (c.edit) {
    if (App.state.editing && !c.keepEdit) App.commitEdit && App.commitEdit();
    if (App.sh().protect && !c.allowProtected && App.selLocked()) { App.toast('Het blad is beveiligd. Hef de beveiliging op via Controleren › Blad beveiligen.', 'lock'); return; }
    return App.run(() => c.fn(arg, el), c);
  }
  return c.fn(arg, el);
};
App.selLocked = () => {
  const sh = App.sh();
  return App.selRanges().some((g) => {
    g = App.selBounded(g, sh);
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (App.styleAt(sh, r, c).unlocked !== true) return true;
    return false;
  });
};
App.run = (fn, meta = {}) => {
  App.history.flush();
  let res;
  try { res = fn(); } catch (e) { console.error(e); App.toast('Er ging iets mis: ' + e.message, 'error'); }
  if (res && typeof res.then === 'function') {
    return res.then((v) => { if (v !== false) App.changed(meta); return v; });
  }
  if (res !== false) App.changed(meta);
  return res;
};

/* ---------- Geschiedenis (ongedaan maken) ----------
   Elke stap bewaart een momentopname van de werkmap. Per blad wordt de JSON
   hergebruikt als dat blad sinds de vorige stap niet is gewijzigd. */
App.touch = (sh = App.sh()) => { sh._dirty = true; };
App.touchAll = () => App.book.sheets.forEach((s) => { s._dirty = true; });
App.history = {
  stack: [], i: -1, max: 120, timer: null,
  sheetJson(sh) {
    if (!sh._json || sh._dirty) { sh._json = JSON.stringify(App.serializeSheet(sh, true)); sh._dirty = false; }
    return sh._json;
  },
  snapshot() {
    const b = App.book;
    return {
      sheets: b.sheets.map((s) => this.sheetJson(s)),
      book: JSON.stringify({ names: b.names, active: b.active, title: b.title }),
    };
  },
  push() {
    clearTimeout(this.timer); this.timer = null;
    const s = this.snapshot();
    const cur = this.stack[this.i];
    if (cur && cur.book === s.book && cur.sheets.length === s.sheets.length && cur.sheets.every((x, k) => x === s.sheets[k])) return;
    this.stack = this.stack.slice(0, this.i + 1);
    this.stack.push(s);
    if (this.stack.length > this.max) this.stack.shift();
    this.i = this.stack.length - 1;
  },
  flush() { if (this.timer) this.push(); },
  reset() { this.stack = []; this.i = -1; App.touchAll(); this.push(); },
  restore(s) {
    const meta = JSON.parse(s.book);
    const views = new Map(App.book.sheets.map((x) => [x.id, { scroll: x.scroll, zoom: x.zoom }]));
    App.book.sheets = s.sheets.map((j) => {
      const sh = App.deserializeSheet(JSON.parse(j));
      sh._json = j; sh._dirty = false;
      const v = views.get(sh.id);
      if (v) { sh.scroll = v.scroll; sh.zoom = v.zoom; }
      return sh;
    });
    App.book.names = meta.names || {};
    App.book.active = App.clamp(meta.active, 0, App.book.sheets.length - 1);
    App.book.title = meta.title || App.book.title;
    $('#doc-title').value = App.book.title;
    App.cancelEdit && App.cancelEdit(true);
    App.deselectObj && App.deselectObj();
    App.recalc();
    App.markDirty();
    App.afterSheetSwitch && App.afterSheetSwitch();
  },
  undo() {
    if (App.state.editing) { App.cancelEdit(); return; }
    this.flush();
    if (this.i > 0) { this.i--; this.restore(this.stack[this.i]); } else App.toast('Niets meer om ongedaan te maken', 'undo');
  },
  redo() {
    if (App.state.editing) return;
    this.flush();
    if (this.i < this.stack.length - 1) { this.i++; this.restore(this.stack[this.i]); }
  },
};

/* ---------- Opslaan als gegevens ---------- */
App.serializeSheet = (sh, forHistory = false) => {
  const cells = [];
  App.eachCell(sh, (r, c, cell) => {
    const o = {};
    if (cell.v !== undefined && cell.v !== null && cell.v !== '') o.v = cell.v;
    if (cell.f) o.f = cell.f;
    if (cell.s) o.s = cell.s;
    if (cell.n) o.n = cell.n;
    if (cell.l) o.l = cell.l;
    if (cell.legacy && cell.f) o.legacy = 1;
    if (Object.keys(o).length) cells.push([r, c, o]);
  });
  const o = {};
  for (const k of Object.keys(sh)) {
    if (k === 'data' || k[0] === '_') continue;
    if (!forHistory || (k !== 'scroll' && k !== 'zoom')) o[k] = sh[k];
  }
  o.cells = cells;
  return o;
};
App.deserializeSheet = (o) => {
  const sh = Object.assign(App.newSheet(o.name || 'Blad'), o);
  sh.data = new Map();
  (o.cells || []).forEach(([r, c, cell]) => {
    let row = sh.data.get(r);
    if (!row) { row = new Map(); sh.data.set(r, row); }
    row.set(c, { ...cell });
  });
  delete sh.cells;
  sh.page = Object.assign(App.newSheet('x').page, o.page || {});
  sh.sel = o.sel && o.sel.ranges && o.sel.ranges.length ? o.sel : { ranges: [{ r1: 0, c1: 0, r2: 0, c2: 0 }], ar: 0, ac: 0, ri: 0 };
  sh.scroll = o.scroll || { x: 0, y: 0 };
  ['colW', 'rowH', 'rowManual', 'hidR', 'hidC', 'fhid', 'colS', 'rowS'].forEach((k) => { sh[k] = sh[k] || {}; });
  ['merges', 'cf', 'dv', 'objs', 'sparks', 'pivots'].forEach((k) => { sh[k] = sh[k] || []; });
  sh.freeze = sh.freeze || { r: 0, c: 0 };
  return sh;
};
App.serializeBook = () => {
  const b = App.book;
  const used = new Set();
  b.sheets.forEach((s) => s.objs.forEach((o) => { if (o.media) used.add(o.media); }));
  const media = {};
  used.forEach((id) => { if (App.media[id]) media[id] = App.media[id]; });
  return { format: 'cel', version: 1, id: b.id, title: b.title, active: b.active, names: b.names, calc: b.calc, created: b.created, modified: b.modified, sheets: b.sheets.map((s) => App.serializeSheet(s)), media };
};
App.deserializeBook = (o) => {
  const b = App.newBook(o.title || 'Map1');
  b.id = o.id || b.id;
  b.sheets = (o.sheets && o.sheets.length ? o.sheets : [App.serializeSheet(App.newSheet('Blad1'))]).map(App.deserializeSheet);
  b.active = App.clamp(o.active || 0, 0, b.sheets.length - 1);
  if (b.sheets[b.active].hidden) b.active = Math.max(0, b.sheets.findIndex((s) => !s.hidden));
  b.names = o.names || {};
  b.calc = o.calc || 'auto';
  b.created = o.created || Date.now();
  b.modified = o.modified || Date.now();
  Object.assign(App.media, o.media || {});
  return b;
};

/* ---------- Wijzigingsmelding ---------- */
App.hooks = { change: [], selection: [], render: [], sheet: [] };
App.on = (evt, fn) => App.hooks[evt].push(fn);
App.emit = (evt, ...a) => App.hooks[evt].forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });

App.changed = (opts = {}) => {
  App.touch();
  if (opts.touchAll) App.touchAll();
  if (App.book.calc === 'auto' || opts.forceCalc) App.recalc(); else { $('#sb-calc').hidden = false; }
  App.invalidateDims && App.invalidateDims();
  if (!opts.noRecord) App.history.push();
  App.markDirty();
  App.emit('change', opts);
  App.scheduleRender();
  App.scheduleState();
};
App.scheduleRender = (() => {
  let raf = 0;
  return () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; App.render && App.render(); App.emit('render'); }); };
})();
App.scheduleState = (() => {
  let raf = 0;
  return () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; App.updateState && App.updateState(); }); };
})();

App.markDirty = () => {
  App.book.dirty = true;
  App.book.modified = Date.now();
  const s = $('#save-state');
  if (s) { s.textContent = App.settings.autosave ? 'Opslaan…' : 'Niet opgeslagen'; s.classList.add('dirty'); }
  if (App.settings.autosave) App.autosave();
};
App.autosave = App.debounce(() => App.saveLocal && App.saveLocal(true), 1200);
