/* =========================================================
   Doek (gemaakt door JJ van Schelven) — kern: namespace, hulpjes, kleuren,
   documentmodel (presentatie → dia's → objecten), commando's, geschiedenis
   ========================================================= */
'use strict';

const App = window.App = {
  commands: {},
  state: {
    slide: 0,               // huidige dia (index)
    sel: [],                // geselecteerde objecten (id's) op het huidige werkvlak
    edit: null,             // id van het object waarvan de tekst wordt bewerkt
    cell: null,             // tabel: { id, r, c, r2, c2 }
    view: 'normal',         // normal | sorter | notes | reading | master
    master: { mi: 0, li: -1 },   // in het diamodel: master mi, indeling li (-1 = de master zelf)
    zoom: 0,                // 0 = passend in venster
    painter: null,          // opmaak kopiëren: { obj?, run?, para?, sticky }
    clip: null,             // interne klembordinhoud
    lastColors: { fill: 'accent1', line: 'accent1/d25', font: '#c00000', hl: '#ffff00', glow: 'accent1' },
    pane: null,             // taakvenster rechts: format | anim | sel | comments | thesaurus | a11y | design
    sorterSel: [],          // dia-overzicht/miniaturen: geselecteerde dia-id's
  },
  settings: {
    autosave: true,
    dark: false,
    ruler: false,
    grid: false,
    guides: false,
    snapGrid: true,
    snapObjs: true,
    smartGuides: true,
    gridSize: 16,           // px (0,5 cm ≈ 18,9 px; 16 px = 1/6 inch)
    notes: true,            // notitiedeelvenster
    thumbW: 200,
    minibar: true,
    startScreen: true,
    author: '',             // optioneel, alleen voor opmerkingen; nooit gevraagd
    recentFonts: [],
    autocorrect: true,
    spell: true,
    gray: '',               // '' | 'gray' | 'bw' (weergave in kleur/grijstinten/zwart-wit)
  },
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
App.$ = $; App.$$ = $$;
App.MAKER = 'JJ van Schelven';
App.VERSION = '1.0';
App.NAME = 'Doek';

/* ---------- Hulpjes ---------- */
App.uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9) + (Date.now() % 1679616).toString(36);
App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
App.num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
App.round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
App.debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(t); return f; };
App.clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
App.fmtNum = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ',');
App.parseNum = (s) => parseFloat(String(s).replace(',', '.'));
App.fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(d).toLocaleDateString('nl-NL', opts);
App.fmtDateTime = (d) => new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
App.PT = 96 / 72;             // px per pt
App.EMU = 9525;               // EMU per px
App.CM = 96 / 2.54;           // px per cm

App.store = {
  get(k, fallback = null) {
    try { const v = localStorage.getItem('doek.' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('doek.' + k, JSON.stringify(v)); return true; } catch { return false; }
  },
  del(k) { try { localStorage.removeItem('doek.' + k); } catch { /* niets */ } },
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
App.safeName = (n, def = 'presentatie') => (String(n || def).replace(/[\\/:*?"<>|]+/g, '-').trim() || def);
// Snelle hash (FNV-1a) voor het herkennen van dubbele media
App.hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i += (s.length > 200000 ? 7 : 1)) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + s.length.toString(36); };

/* ---------- Kleuren ---------- */
App.hexToRgb = (hex) => {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [n >> 16, (n >> 8) & 255, n & 255] : [0, 0, 0];
};
App.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => App.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
App.rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};
App.hslToRgb = (h, s, l) => {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
};
// lumMod/lumOff zoals OOXML (in HSL)
App.lum = (hex, mod, off = 0) => {
  const [h, s, l] = App.rgbToHsl(...App.hexToRgb(hex));
  return App.rgbToHex(...App.hslToRgb(h, s, App.clamp(l * mod + off, 0, 1)));
};
App.mix = (hex, t) => {   // t > 0 = mengen met wit, t < 0 = mengen met zwart
  let [r, g, b] = App.hexToRgb(hex);
  if (t > 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; } else { r *= 1 + t; g *= 1 + t; b *= 1 + t; }
  return App.rgbToHex(r, g, b);
};
App.luminance = (hex) => {
  const c = App.hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
App.contrast = (a, b) => { const x = App.luminance(a), y = App.luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
App.THEME_SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
App.SLOT_ALIAS = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
App.isColorRef = (v) => typeof v === 'string' && (/^#[0-9a-f]{6}$/i.test(v) || /^(tx1|bg1|tx2|bg2|dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)(\/[ld](100|[1-9]?\d))?$/.test(v));
App.color = (ref, theme) => {
  if (!ref) return null;
  if (ref[0] === '#') return ref.length === 7 ? ref.toLowerCase() : App.rgbToHex(...App.hexToRgb(ref));
  const th = theme || App.theme();
  const [slot, mod] = String(ref).split('/');
  const base = (th && th.colors[App.SLOT_ALIAS[slot] || slot]) || '#000000';
  if (!mod) return base;
  const p = App.clamp(parseInt(mod.slice(1), 10) || 0, 0, 100) / 100;
  return mod[0] === 'l' ? App.lum(base, 1 - p, p) : App.lum(base, 1 - p, 0);
};
App.rgba = (ref, alpha = 1, theme) => {
  const hex = App.color(ref, theme) || '#000000';
  if (alpha >= 1) return hex;
  const [r, g, b] = App.hexToRgb(hex);
  return `rgba(${r},${g},${b},${App.round(App.clamp(alpha, 0, 1), 3)})`;
};
// Leesbare tekstkleur op een achtergrond
App.inkOn = (bgHex) => (App.luminance(bgHex) > 0.4 ? '#000000' : '#ffffff');

/* ---------- Lettertypen ---------- */
// Open vervangers voor bekende lettertypen (geen Microsoft-lettertypen meegeleverd)
App.FONT_SUBST = {
  'calibri': ['Carlito'], 'calibri light': ['Carlito'], 'cambria': ['Caladea'], 'arial': ['Liberation Sans', 'Arimo'],
  'helvetica': ['Liberation Sans', 'Arimo', 'Arial'], 'times new roman': ['Liberation Serif', 'Tinos'], 'courier new': ['Liberation Mono', 'Cousine'],
  'aptos': ['Inter'], 'aptos display': ['Inter'], 'segoe ui': ['Inter'], 'segoe ui light': ['Inter'], 'segoe ui semibold': ['Inter'],
  'century gothic': ['URW Gothic', 'Avant Garde', 'Montserrat'], 'gill sans mt': ['Gill Sans', 'Lato'], 'franklin gothic book': ['Libre Franklin'],
  'georgia': ['Gelasio', 'DejaVu Serif'], 'verdana': ['DejaVu Sans'], 'tahoma': ['DejaVu Sans'], 'trebuchet ms': ['Fira Sans'],
  'consolas': ['JetBrains Mono', 'DejaVu Sans Mono'], 'garamond': ['EB Garamond', 'Cormorant Garamond'], 'palatino linotype': ['Palatino', 'TeX Gyre Pagella'],
  'book antiqua': ['Palatino', 'TeX Gyre Pagella'], 'impact': ['Anton', 'Oswald'], 'comic sans ms': ['Comic Neue'],
};
App.fontName = (f, theme, isTitle) => {
  const th = theme || App.theme();
  if (!f) f = isTitle ? '+mj' : '+mn';
  if (f === '+mj' || f === '+mj-lt') return (th && th.fonts.major) || 'Inter';
  if (f === '+mn' || f === '+mn-lt') return (th && th.fonts.minor) || 'Inter';
  return f;
};
App.cssFont = (name) => {
  const n = String(name || 'Inter').replace(/["\\;{}<>]/g, '').slice(0, 80);
  const subs = App.FONT_SUBST[n.toLowerCase()] || [];
  const generic = /mono|consol|courier|code/i.test(n) ? 'monospace' : /serif|times|georgia|garamond|cambria|palatino|antiqua|playfair|lora|merriweather|caladea/i.test(n) && !/sans/i.test(n) ? 'serif' : 'sans-serif';
  return [n, ...subs, generic === 'sans-serif' ? 'Inter' : null, generic].filter(Boolean).map((x) => (/^(serif|sans-serif|monospace)$/.test(x) ? x : `"${x}"`)).join(', ');
};

/* ---------- Diaformaten ---------- */
App.SIZES = {
  '16:9': { w: 1280, h: 720, name: 'Breedbeeld (16:9)' },
  '4:3': { w: 960, h: 720, name: 'Standaard (4:3)' },
  '16:10': { w: 1152, h: 720, name: 'Breedbeeld (16:10)' },
  'A4': { w: 1123, h: 794, name: 'A4-papier (210 × 297 mm)' },
  'letter': { w: 1056, h: 816, name: 'Letter-papier (8,5 × 11 inch)' },
  'banner': { w: 768, h: 96, name: 'Banner' },
};

/* ---------- Het document ---------- */
App.pres = null;
App.media = {};               // id → { mime, url } (buiten de geschiedenis)
App.slides = () => App.pres.slides;
App.cur = () => App.pres.slides[App.state.slide] || App.pres.slides[0];
App.slideById = (id) => App.pres.slides.find((s) => s.id === id) || null;
App.slideIndex = (id) => App.pres.slides.findIndex((s) => s.id === id);
App.masterOf = (x) => {
  const P = App.pres;
  if (!x) return P.masters[0];
  if (x.layouts) return x;                                            // is zelf een master
  if (x.type !== undefined && x.objs && !x.layout) {                   // indeling
    return P.masters.find((m) => m.layouts.includes(x)) || P.masters[0];
  }
  const lid = x.layout;
  return P.masters.find((m) => m.layouts.some((l) => l.id === lid)) || P.masters[0];
};
App.layoutOf = (slide) => {
  for (const m of App.pres.masters) { const l = m.layouts.find((x) => x.id === slide.layout); if (l) return l; }
  const m = App.pres.masters[0];
  return m.layouts.find((l) => l.type === 'obj') || m.layouts[0];
};
App.theme = (x) => {
  if (!App.pres) return null;
  if (!x) x = App.surface().owner;
  return App.masterOf(x).theme;
};
// Het werkvlak dat nu wordt bewerkt: een dia, of in het diamodel een indeling of de master
App.surface = () => {
  const P = App.pres, st = App.state;
  if (st.view === 'master') {
    const m = P.masters[App.clamp(st.master.mi, 0, P.masters.length - 1)];
    if (st.master.li >= 0 && m.layouts[st.master.li]) return { kind: 'layout', owner: m.layouts[st.master.li], master: m, objs: m.layouts[st.master.li].objs };
    return { kind: 'master', owner: m, master: m, objs: m.objs };
  }
  const s = App.cur();
  return { kind: 'slide', owner: s, master: App.masterOf(s), objs: s.objs };
};
// Alle objecten van een werkvlak, ook binnen groepen
App.walkObjs = (objs, fn, parent = null) => {
  for (const o of objs || []) { if (fn(o, parent) === false) return false; if (o.type === 'group' && App.walkObjs(o.objs, fn, o) === false) return false; }
  return true;
};
App.findObj = (id, objs = App.surface().objs) => {
  let hit = null;
  App.walkObjs(objs, (o, p) => { if (o.id === id) { hit = { obj: o, parent: p }; return false; } return true; });
  return hit;
};
App.obj = (id) => { const h = App.findObj(id); return h ? h.obj : null; };
App.selObjs = () => App.state.sel.map((id) => App.obj(id)).filter(Boolean);
App.sel1 = () => { const s = App.selObjs(); return s.length === 1 ? s[0] : null; };
// De lijst waar een object in staat (dia of groep)
App.ownerList = (id, objs = App.surface().objs) => {
  const h = App.findObj(id, objs);
  return h ? (h.parent ? h.parent.objs : objs) : null;
};

/* ---------- Nieuwe objecten ---------- */
App.emptyPara = (extra) => ({ runs: [{ t: '' }], ...(extra || {}) });
App.textBody = (text = '', extra) => ({
  paras: String(text).split('\n').map((t) => ({ runs: [{ t }] })),
  ...(extra || {}),
});
App.objName = (base, objs = App.surface().objs) => {
  let n = 0;
  App.walkObjs(objs, () => { n++; });
  return base + ' ' + (n + 1);
};
App.newObj = (type, props = {}) => {
  const o = { id: App.uid('o'), type, name: props.name || App.objName(App.OBJ_NAMES[type] || 'Object'), x: 0, y: 0, w: 100, h: 100, ...props };
  if (type === 'shape' && !o.geom) o.geom = 'rect';
  return o;
};
App.OBJ_NAMES = { shape: 'Vorm', line: 'Rechte verbindingslijn', image: 'Afbeelding', table: 'Tabel', chart: 'Grafiek', group: 'Groep', video: 'Video', audio: 'Audio', diagram: 'Diagram', equation: 'Vergelijking', icon: 'Pictogram', ink: 'Inkt' };

/* ---------- Commando's ---------- */
App.def = (name, fn, meta = {}) => { App.commands[name] = { fn, edit: false, ...meta }; };
App.defEdit = (name, fn, meta = {}) => { App.commands[name] = { fn, edit: true, ...meta }; };
App.exec = (name, arg, el) => {
  const c = App.commands[name];
  if (!c) { App.toast(App.t('Deze functie is nog niet beschikbaar: {0}').replace('{0}', name), 'info'); return; }
  if (c.edit) {
    if (App.readOnly && App.readOnly() && !c.allowReadOnly) { App.toast(App.t('Deze presentatie kan alleen worden bekeken.'), 'lock'); return; }
    if (!c.noRepeat) App.state.lastCmd = { name, arg };
    return App.run(() => c.fn(arg, el), c);
  }
  return c.fn(arg, el);
};
App.run = (fn, meta = {}) => {
  // alleen bekijken (gedeeld met leesrechten): het model niet wijzigen
  if (App.readOnly && App.readOnly() && !meta.allowReadOnly) { App.toast(App.t('Deze presentatie kan alleen worden bekeken.'), 'lock'); return undefined; }
  App.history.flush();
  let res;
  try { res = fn(); } catch (e) { console.error(e); App.toast(App.t('Er ging iets mis: {0}').replace('{0}', e.message), 'error'); return undefined; }
  if (res && typeof res.then === 'function') return res.then((v) => { if (v !== false) App.changed(meta); return v; });
  if (res !== false) App.changed(meta);
  return res;
};
App.t = App.t || ((s) => s);   // vertaling (i18n.js vervangt dit)

/* ---------- Gebeurtenissen ---------- */
App.hooks = { change: [], selection: [], slide: [], render: [], view: [], load: [] };
App.on = (evt, fn) => { (App.hooks[evt] = App.hooks[evt] || []).push(fn); };
App.emit = (evt, ...a) => (App.hooks[evt] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });

/* ---------- Geschiedenis (ongedaan maken) ----------
   Elke stap bewaart een momentopname. Per dia wordt de JSON hergebruikt als die dia sinds
   de vorige stap niet is gewijzigd; zo blijft ook een presentatie met 500 dia's snel. */
App.touch = (slide) => { if (slide) slide._dirty = true; else { const s = App.surface(); if (s.kind === 'slide') s.owner._dirty = true; else App.pres._mdirty = true; } };
App.touchAll = () => { App.pres.slides.forEach((s) => { s._dirty = true; }); App.pres._mdirty = true; };
App.touchMasters = () => { App.pres._mdirty = true; };
const PRES_KEYS = ['title', 'size', 'sections', 'shows', 'hf', 'show', 'guides', 'lang', 'props'];
App.history = {
  stack: [], i: -1, max: 400, timer: null,
  slideJson(s) {
    if (!s._json || s._dirty) { s._json = JSON.stringify(App.cleanForSave(s)); s._dirty = false; }
    return s._json;
  },
  mastersJson() {
    const P = App.pres;
    if (!P._mjson || P._mdirty) { P._mjson = JSON.stringify(P.masters.map(App.cleanForSave)); P._mdirty = false; }
    return P._mjson;
  },
  snapshot() {
    const P = App.pres, rest = {};
    PRES_KEYS.forEach((k) => { rest[k] = P[k]; });
    return { slides: P.slides.map((s) => this.slideJson(s)), masters: this.mastersJson(), rest: JSON.stringify(rest), view: { slide: App.state.slide, sel: App.state.sel.slice() } };
  },
  push() {
    clearTimeout(this.timer); this.timer = null;
    const s = this.snapshot();
    const cur = this.stack[this.i];
    if (cur && cur.rest === s.rest && cur.masters === s.masters && cur.slides.length === s.slides.length && cur.slides.every((x, k) => x === s.slides[k])) { cur.view = s.view; return false; }
    this.stack = this.stack.slice(0, this.i + 1);
    this.stack.push(s);
    if (this.stack.length > this.max) this.stack.shift();
    this.i = this.stack.length - 1;
    return true;
  },
  // Wijziging zonder meteen een stap te maken (bijv. tijdens typen): na een pauze alsnog vastleggen
  later(ms = 700) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), ms); },
  flush() { if (this.timer) this.push(); },
  reset() { this.stack = []; this.i = -1; App.touchAll(); this.push(); },
  restore(s, which) {
    const P = App.pres;
    const rest = JSON.parse(s.rest);
    PRES_KEYS.forEach((k) => { if (k in rest) P[k] = rest[k]; else delete P[k]; });
    if (s.masters !== P._mjson) { P.masters = JSON.parse(s.masters); }
    P._mjson = s.masters; P._mdirty = false;
    const byJson = new Map();
    P.slides.forEach((x) => { if (x._json && !x._dirty) byJson.set(x._json, x); });
    P.slides = s.slides.map((j) => {
      const prev = byJson.get(j);
      if (prev) { byJson.delete(j); return prev; }   // ongewijzigd: hetzelfde object houden (miniatuur blijft geldig)
      const sl = JSON.parse(j); sl._json = j; sl._dirty = false; sl._v = (sl._v || 0) + 1;
      return sl;
    });
    const v = (which === 'undo' ? (this.stack[this.i + 1] || s) : s).view || s.view;
    App.state.slide = App.clamp(v.slide, 0, P.slides.length - 1);
    App.state.sel = (v.sel || []).filter((id) => App.findObj(id));
    App.state.edit = null; App.state.cell = null;
    App.markDirty();
    App.emit('change', { history: true });
    App.emit('slide');
    App.scheduleRender(true);
  },
  undo() {
    if (App.state.edit && App.textEdit && App.textEdit.undo && App.textEdit.undo()) return;
    if (App.textEdit && App.state.edit) App.textEdit.stop();
    this.flush();
    if (this.i > 0) { this.i--; this.restore(this.stack[this.i], 'undo'); } else App.toast(App.t('Niets meer om ongedaan te maken'), 'undo');
  },
  redo() {
    if (App.textEdit && App.state.edit) App.textEdit.stop();
    this.flush();
    if (this.i < this.stack.length - 1) { this.i++; this.restore(this.stack[this.i], 'redo'); }
    else if (App.state.lastCmd) App.exec(App.state.lastCmd.name, App.state.lastCmd.arg);   // F4/Ctrl+Y: laatste actie herhalen
  },
};

/* ---------- Wijzigingsmelding ---------- */
App.changed = (opts = {}) => {
  if (opts.all) App.touchAll(); else if (opts.slides) opts.slides.forEach((s) => App.touch(s)); else if (!opts.noTouch) App.touch();
  if (opts.masters) App.touchMasters();
  if (!opts.noRecord) App.history.push();
  App.markDirty();
  App.emit('change', opts);
  App.scheduleRender();
};
App.scheduleRender = (() => {
  let raf = 0, full = false;
  return (all) => {
    if (all) full = true;
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const f = full; full = false; if (App.renderAll) App.renderAll(f); App.emit('render'); });
  };
})();
App.markDirty = () => {
  App.pres.dirty = true;
  App.pres.props.modified = Date.now();
  const s = $('#save-state');
  if (s) { s.textContent = App.t(App.settings.autosave ? 'Opslaan…' : 'Niet opgeslagen'); s.classList.add('dirty'); }
  if (App.settings.autosave) App.autosave();
};
App.autosave = App.debounce(() => App.saveLocal && App.saveLocal(true), 1500);

/* ---------- Opslaan als gegevens ---------- */
// Tijdelijke velden (beginnend met _) niet bewaren
App.cleanForSave = (o) => {
  if (Array.isArray(o)) return o.map(App.cleanForSave);
  if (!o || typeof o !== 'object') return o;
  const out = {};
  for (const k of Object.keys(o)) { if (k[0] !== '_' && o[k] !== undefined) out[k] = App.cleanForSave(o[k]); }
  return out;
};
App.usedMedia = (P = App.pres) => {
  const used = new Set();
  const scan = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(scan); return; }
    for (const k of Object.keys(x)) {
      if ((k === 'media' || k === 'poster' || k === 'sound') && typeof x[k] === 'string') used.add(x[k]);
      else if (typeof x[k] === 'object') scan(x[k]);
    }
  };
  scan(P.masters); scan(P.slides);
  return used;
};
App.serializePres = (opts = {}) => {
  const P = App.pres;
  const o = { format: 'doek', version: 1, id: P.id };
  PRES_KEYS.forEach((k) => { if (P[k] !== undefined) o[k] = App.cleanForSave(P[k]); });
  o.masters = App.cleanForSave(P.masters);
  o.slides = App.cleanForSave(P.slides);
  if (P.share && !opts.noShare) o.share = P.share;
  if (opts.media !== false) {
    const media = {};
    App.usedMedia(P).forEach((id) => { if (App.media[id]) media[id] = App.media[id]; });
    o.media = media;
  }
  return o;
};
