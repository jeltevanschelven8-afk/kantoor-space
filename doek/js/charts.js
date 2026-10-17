/* =========================================================
   Doek (gemaakt door JJ van Schelven) — grafieken: soorten, voorbeeldgegevens, tekenen als SVG,
   trendlijnen, getalnotatie en grafiekgegevens bewerken
   ========================================================= */
'use strict';

(() => {
  const T = (s) => (App.t ? App.t(s) : s);
  const C = App.Charts = {};

  /* ---------- Hulpjes ---------- */
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BAD = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;   // tekens die niet in XML mogen
  const esc = (s) => String(s ?? '').replace(BAD, '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nn = (v) => (Number.isFinite(v) ? Math.round(clamp(v, -1e6, 1e6) * 100) / 100 || 0 : 0);   // coördinaat in de SVG
  const str = (v) => (v == null ? '' : String(v)).replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(BAD, '');
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const arr = (a) => (Array.isArray(a) ? a : []);
  const uiLang = () => (App.LANG === 'en' ? 'en' : 'nl');
  const locKey = (l) => (typeof l === 'string' && /^en/i.test(l) ? 'en' : typeof l === 'string' && /^nl/i.test(l) ? 'nl' : uiLang());
  const LOC = { nl: { dec: ',', thou: '.', sep: '; ' }, en: { dec: '.', thou: ',', sep: ', ' } };
  const MAXN = 4000, MAXS = 255;   // grenzen voor punten per reeks en aantal reeksen

  /* ---------- Kleuren ---------- */
  const DEF_PAL = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948'];
  const okColor = (c) => typeof c === 'string' && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%+-]+\)|[a-z]{3,20})$/i.test(c.trim());
  const hexRgb = (h) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
    if (!m) return null;
    const n = parseInt(m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return x && y ? rgbHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t) : a; };
  const luma = (c) => {
    const x = hexRgb(c);
    if (!x) return 0.5;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(x[0]) + 0.7152 * f(x[1]) + 0.0722 * f(x[2]);
  };
  const ink = (bg) => (luma(bg) > 0.3 ? '#262626' : '#ffffff');   // leesbare tekst op een gekleurd vlak
  // lichter of donkerder zoals OOXML: lumMod/lumOff op de helderheid (HSL)
  const lumMod = (hex, mod, off = 0) => {
    const x = hexRgb(hex);
    if (!x) return hex;
    const [r, g, b] = x.map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
    }
    const L = clamp(l * mod + off, 0, 1);
    if (!s) return rgbHex(L * 255, L * 255, L * 255);
    const q = L < 0.5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
    const hue = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return rgbHex(hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255);
  };
  // paletten: volgorde van de accentkleuren; na zes reeksen donkerder/lichter zoals in kantoorpakketten
  const ORDER = { theme: [0, 1, 2, 3, 4, 5], colorful1: [0, 1, 2, 3, 4, 5], colorful2: [1, 3, 5, 0, 2, 4], colorful3: [2, 4, 0, 1, 3, 5], colorful4: [5, 4, 3, 2, 1, 0] };
  const VARS = [[1, 0], [0.6, 0], [0.8, 0.2], [0.8, 0], [0.6, 0.4], [0.5, 0], [0.7, 0.3], [0.7, 0], [0.5, 0.5]];
  const palFn = (name, base) => {
    const m = /^mono([1-6])$/.exec(name || '');
    if (m) {
      const c = base[+m[1] - 1];
      return (i, n) => { if (!(n > 1)) return c; const t = -0.45 + 0.9 * clamp(i, 0, n - 1) / (n - 1); return t < 0 ? lumMod(c, 1 + t) : lumMod(c, 1 - t, t); };
    }
    const ord = ORDER[name] || ORDER.theme;
    return (i) => { const v = VARS[Math.floor(i / 6) % VARS.length], c = base[ord[i % 6]]; return v[0] === 1 ? c : lumMod(c, v[0], v[1]); };
  };
  const basePal = (ctx) => DEF_PAL.map((d, i) => (ctx && Array.isArray(ctx.palette) && okColor(ctx.palette[i]) ? ctx.palette[i].trim() : d));

  /* ---------- Tekstmaten (gemeten aan Inter; andere lettertypen lijken er genoeg op) ---------- */
  const CWT = {};   // breedte per teken in em
  [['abcdefghijklmnopqrstuvwxyz', [56, 61, 57, 61, 58, 37, 61, 59, 24, 24, 55, 24, 88, 59, 60, 61, 61, 38, 53, 33, 59, 56, 82, 55, 56, 55]],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', [69, 65, 73, 72, 60, 59, 75, 74, 27, 57, 67, 57, 90, 75, 77, 64, 77, 64, 64, 65, 74, 69, 99, 68, 68, 63]],
    ['0123456789', [63, 41, 61, 62, 65, 59, 62, 57, 62, 62]],
    [' .,:;!|\'`()[]{}/\\"-%@€$#+=&*?_<>~^…', [28, 29, 29, 29, 30, 29, 33, 30, 32, 37, 37, 37, 37, 43, 43, 36, 36, 47, 46, 98, 97, 67, 64, 63, 66, 66, 64, 50, 51, 46, 66, 66, 66, 47, 86]]]
    .forEach(([s, w]) => [...s].forEach((c, i) => { CWT[c] = w[i] / 100; }));
  const cw = (c) => CWT[c] ?? (c.codePointAt(0) > 0x2e7f ? 1 : CWT[c.normalize('NFD')[0]] ?? 0.6);
  const tw = (s, size) => { let w = 0; for (const c of String(s)) w += cw(c); return w * size; };
  const fit = (s, size, max) => {   // inkorten met … tot de tekst past
    s = String(s);
    if (tw(s, size) <= max) return s;
    let w = tw('…', size), out = '';
    for (const c of s) { const d = cw(c) * size; if (w + d > max) break; w += d; out += c; }
    return out ? out.trimEnd() + '…' : '';
  };
  const wrapText = (s, size, max) => {   // regels die passen; een te lang woord blijft heel
    const out = [];
    String(s).split('\n').forEach((para) => {
      let line = '';
      para.split(/ +/).forEach((w) => { const t = line ? line + ' ' + w : w; if (!line || tw(t, size) <= max) line = t; else { out.push(line); line = w; } });
      out.push(line);
    });
    return out;
  };

  /* ---------- Getallen lezen ---------- */
  // tekst → getal; begrijpt 1.234,5 en 1,234.5, valuta, procenten, (negatief) en E-notatie; anders null
  const parseNum = (s, loc) => {
    if (isNum(s)) return s;
    if (typeof s !== 'string') return null;
    let t = s.trim().replace(/[\s   ']/g, '').replace(/[−‒–]/g, '-');
    if (!t) return null;
    let neg = false, pct = false, exp = 0;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (/^[+-]/.test(t)) { neg = neg !== (t[0] === '-'); t = t.slice(1); }
    t = t.replace(/^(€|\$|£|¥|EUR|USD)/i, '').replace(/(€|\$|£|¥|EUR|USD)$/i, '');
    if (t[0] === '-') { neg = !neg; t = t.slice(1); }
    if (t.endsWith('%')) { pct = true; t = t.slice(0, -1); }
    const m = /^(.*\d)[eE]([+-]?\d{1,3})$/.exec(t);
    if (m) { t = m[1]; exp = +m[2]; }
    if (!/^[\d.,]*\d[\d.,]*$/.test(t)) return null;
    const dots = t.split('.').length - 1, commas = t.split(',').length - 1;
    let dec = null;
    if (dots && commas) dec = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ',';
    else if (dots + commas === 1) {
      const sep = dots ? '.' : ',', [a, b] = t.split(sep);
      // 1.234 (nl) of 1,234 (en) is een duizendtal, anders een decimaalteken
      dec = sep === LOC[locKey(loc)].dec || !(b.length === 3 && a.length >= 1 && a.length <= 3 && a !== '0') ? sep : null;
    }
    let ip = t, fp = '';
    if (dec) { const k = t.lastIndexOf(dec); ip = t.slice(0, k); fp = t.slice(k + 1); }
    if (/[.,]/.test(fp)) return null;
    let v = parseFloat(`${ip.replace(/[.,]/g, '') || '0'}.${fp || '0'}e${exp}`);
    if (pct) v /= 100;
    if (neg) v = -v;
    return Number.isFinite(v) ? clamp(v, -1e300, 1e300) : null;
  };
  C.parseNum = parseNum;
  const num = (v) => (isNum(v) ? clamp(v, -1e300, 1e300) : typeof v === 'string' ? parseNum(v) : null);

  /* ---------- Getallen opmaken ---------- */
  const fixedStr = (a, d) => {   // a ≥ 0 → tekst met precies d decimalen (met punt), zonder zwevendekommafouten
    if (a >= 1e21) return BigInt(Math.round(a)).toString() + (d ? '.' + '0'.repeat(d) : '');
    if (a >= 1e15 || a < 1e-6 || a * 10 ** d >= 1e21) return a.toFixed(d);
    const k = Math.round(+(a.toPrecision(15) + 'e' + d));
    if (!d) return String(k);
    const s = String(k).padStart(d + 1, '0');
    return s.slice(0, -d) + '.' + s.slice(-d);
  };
  const sciStr = (v, d, L, trim, ed = 2) => {
    if (v === 0) return '0';
    const a = Math.abs(v);
    let e = Math.floor(Math.log10(a));
    const man = (k) => fixedStr(k < -300 ? a * 1e300 * 10 ** (-k - 300) : a / 10 ** k, d);
    let m = man(e);
    if (+m >= 10) { e++; m = man(e); }
    if (trim && m.includes('.')) m = m.replace(/\.?0+$/, '');
    return (v < 0 ? '-' : '') + m.replace('.', L.dec) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(ed, '0');
  };
  const general = (v, L) => {   // zoals 'Standaard' in rekenbladen: hooguit tien cijfers, anders E-notatie
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e11 || a < 1e-9) return sciStr(v, 5, L, true);
    const s = String(+v.toPrecision(10));
    return /e/i.test(s) ? sciStr(v, 5, L, true) : s.replace('.', L.dec);
  };
  const splitSecs = (c) => {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
      if (ch === '"') q = !q;
      if (ch === '\\' && !q) { cur += ch + (c[i + 1] || ''); i++; continue; }
      if (ch === ';' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const parseSec = (s) => {   // één sectie van een getalnotatie zoals '€ #,##0.00' of '0.0%'
    const toks = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i], rest = s.slice(i);
      if (c === '"') { const j = s.indexOf('"', i + 1); toks.push({ lit: j < 0 ? s.slice(i + 1) : s.slice(i + 1, j) }); i = j < 0 ? s.length : j; }
      else if (c === '\\') { toks.push({ lit: s[i + 1] || '' }); i++; }
      else if (c === '[') { const j = s.indexOf(']', i); const m = /^\$([^-\]]*)/.exec(j < 0 ? '' : s.slice(i + 1, j)); if (m) toks.push({ lit: m[1] }); i = j < 0 ? s.length : j; }
      else if (c === '_') { toks.push({ lit: ' ' }); i++; }
      else if (c === '*') i++;
      else if (/^(general|standaard)/i.test(rest)) { toks.push({ ch: 'G' }); i += /^general/i.test(rest) ? 6 : 8; }
      else if ((c === 'E' || c === 'e') && /[+-]/.test(s[i + 1] || '')) { toks.push({ ch: 'E', sign: s[i + 1] }); i++; }
      else if ('0#?.,%'.includes(c)) toks.push({ ch: c });
      else toks.push({ lit: c });
    }
    const ph = (t) => !!t.ch && '0#?G'.includes(t.ch);
    const lit = (t) => t.lit ?? (t.ch === '%' || t.ch === '.' || t.ch === ',' ? t.ch : '');
    const f = { pre: '', post: '', dec: 0, minDec: 0, minInt: 0, thou: false, pct: 0, scale: 0, sci: false, ed: 2, esign: '+', gen: false, lit: false };
    toks.forEach((t) => { if (t.ch === '%') f.pct++; });
    const iE = toks.findIndex((t) => t.ch === 'E'), end = iE >= 0 ? iE : toks.length;
    let a = -1, b = -1;
    for (let i = 0; i < end; i++) if (ph(toks[i])) { if (a < 0) a = i; b = i; }
    if (a < 0) { f.lit = true; f.pre = toks.map(lit).join(''); return f; }
    let j = b + 1;
    while (j < end && toks[j].ch === ',') { f.scale++; j++; }   // komma's na het getal: delen door 1000
    let dot = false;
    for (let i = a; i <= b; i++) {
      const t = toks[i];
      if (t.ch === 'G') f.gen = true;
      else if (t.ch === '.') dot = true;
      else if (t.ch === ',') { if (!dot) f.thou = true; }
      else if (ph(t)) { if (dot) { f.dec++; if (t.ch === '0') f.minDec = f.dec; } else if (t.ch === '0') f.minInt++; }
    }
    if (iE >= 0) {
      let k = iE + 1, n = 0;
      while (k < toks.length && ph(toks[k])) { n++; k++; }
      Object.assign(f, { sci: true, ed: Math.max(1, n), esign: toks[iE].sign });
      j = k;
    }
    f.pre = toks.slice(0, a).map(lit).join('');
    f.post = toks.slice(j).map(lit).join('');
    return f;
  };
  const CODES = new Map();
  C.fmt = (value, code, locale) => {
    const L = LOC[locKey(locale)];
    let v = value;
    if (v === null || v === undefined || v === '') return '';
    if (typeof v !== 'number') { const p = num(v); if (p === null) return str(v); v = p; }
    if (!Number.isFinite(v)) return '';
    const c = typeof code === 'string' ? code.trim() : '';
    if (!c || /^(general|standaard)$/i.test(c)) return general(v, L);
    let secs = CODES.get(c);
    if (!secs) { secs = splitSecs(c).slice(0, 3).map(parseSec); if (CODES.size > 500) CODES.clear(); CODES.set(c, secs); }
    let f = secs[0], neg = v < 0;
    if (v < 0 && secs[1]) { f = secs[1]; neg = false; } else if (v === 0 && secs[2]) f = secs[2];
    if (f.lit) return f.pre;
    const x = Math.abs(v) * 100 ** f.pct / 1000 ** f.scale;
    let s;
    if (f.gen) s = general(x, L);
    else if (f.sci) {
      s = x === 0 ? '0' + (f.dec ? L.dec + '0'.repeat(f.dec) : '') + 'E+' + '0'.repeat(f.ed) : sciStr(x, f.dec, L, false, f.ed);
      if (f.esign === '-') s = s.replace('E+', 'E');
    } else {
      let [ip, fp = ''] = fixedStr(x, f.dec).split('.');
      if (f.dec > f.minDec) fp = fp.replace(new RegExp(`0{1,${f.dec - f.minDec}}$`), '');
      if (ip === '0' && f.minInt === 0) ip = '';
      ip = ip.padStart(f.minInt, '0');
      if (f.thou) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, L.thou);
      s = ip + (fp ? L.dec + fp : '');
    }
    return (neg && /[1-9]/.test(s) ? '-' : '') + f.pre + s + f.post;
  };
  const stepDec = (st) => { let d = 0; while (d < 6 && Math.abs(st * 10 ** d - Math.round(st * 10 ** d)) > 1e-6 * Math.max(1, st * 10 ** d)) d++; return d; };
  const autoFmt = (sc, loc) => {   // aslabels: vaste decimalen volgens de stap, duizendtallen gescheiden
    const L = LOC[locKey(loc)];
    if (sc.log) return (v) => (v >= 1 && v < 1e9 ? C.fmt(v, '#,##0', loc) : general(v, L));
    const a = Math.max(Math.abs(sc.min), Math.abs(sc.max));
    if (a >= 1e12 || (a > 0 && a < 1e-6)) {
      const d = clamp(Math.floor(Math.log10(a)) - Math.floor(Math.log10(sc.step) + 1e-9), 0, 4);
      return (v) => (v === 0 ? '0' : sciStr(v, d, L, false));
    }
    const d = stepDec(sc.step), code = '#,##0' + (d ? '.' + '0'.repeat(d) : '');
    return (v) => C.fmt(v, code, loc);
  };

  /* ---------- Schalen ---------- */
  C.niceScale = (min, max, maxTicks = 6) => {
    if (!isNum(min)) min = isNum(max) ? Math.min(0, max) : 0;
    if (!isNum(max)) max = min + 1;
    if (min > max) [min, max] = [max, min];
    min = clamp(min, -1e300, 1e300); max = clamp(max, -1e300, 1e300);
    const mt = Math.max(1, Math.floor(isNum(maxTicks) ? maxTicks : 6));
    if (min === max) { if (min === 0) max = 1; else if (min > 0) min = 0; else max = 0; }
    const span = max - min;
    let mag = 10 ** Math.floor(Math.log10(span / mt));
    if (!(mag > 0) || !isNum(mag)) mag = span / mt || 1;
    let step = mag, lo = min, hi = max;
    for (const m of [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) {
      step = m * mag;
      lo = Math.floor(min / step + 1e-9) * step;
      hi = Math.ceil(max / step - 1e-9) * step;
      if (Math.round((hi - lo) / step) <= mt) break;
    }
    const cl = (v) => +v.toPrecision(12) || 0;
    return { min: cl(lo), max: cl(hi), step: cl(step) };
  };
  const linScale = (sc) => { const d = sc.max - sc.min || 1; sc.f = (v) => (v - sc.min) / d; return sc; };
  const logScale = (lo, hi, o) => {   // logaritmische as: machten van het grondtal
    const base = isNum(o.log) && o.log > 1 ? o.log : 10, lb = Math.log(base);
    if (!(hi > 0)) { lo = 1; hi = base; }
    if (!(lo > 0)) lo = hi / base;
    let a = Math.floor(Math.log(lo) / lb + 1e-9), b = Math.ceil(Math.log(hi) / lb - 1e-9);
    if (isNum(o.min) && o.min > 0) a = Math.log(o.min) / lb;
    if (isNum(o.max) && o.max > 0) b = Math.log(o.max) / lb;
    if (!(b > a)) b = a + 1;
    if (b - a > 600) a = b - 600;
    const sc = { log: true, base, a, b, min: base ** a, max: base ** b, step: base, every: 1 };
    sc.f = (v) => (v > 0 ? (Math.log(v) / lb - a) / (b - a) : NaN);
    return sc;
  };
  const ticksOf = (sc) => {
    const out = [];
    if (sc.log) {
      for (let k = Math.ceil(sc.a - 1e-9); k <= sc.b + 1e-9 && out.length < 400; k += sc.every) out.push(+(sc.base ** k).toPrecision(12));
      return out;
    }
    const n = Math.floor((sc.max - sc.min) / sc.step + 1e-9);
    for (let i = 0; i <= n && i < 400; i++) { const v = sc.min + i * sc.step; out.push(Math.abs(v) < sc.step * 1e-9 ? 0 : +v.toPrecision(12)); }
    return out;
  };
  // waardeas: nul erbij (of de 5/6-regel), 5% ruimte, eigen grenzen en stap; horizontaal: labels mogen niet botsen
  const mkAxis = (e, len, o, opt, X) => {
    const fs = X.fs, fmtOf = (sc) => (o.fmt ? (v) => C.fmt(v, o.fmt, X.loc) : opt.pct ? (v) => C.fmt(v, '0%', X.loc) : autoFmt(sc, X.loc));
    let lo = e ? e[0] : 0, hi = e ? e[1] : 1;
    const own = (k) => isNum(o[k]) && !(isNum(o.min) && isNum(o.max) && o.min >= o.max);
    if (o.log && !opt.pct) {
      const sc = logScale(lo, hi, o), cnt = sc.b - sc.a, room = opt.horizontal ? len / (fs * 4) : len / (fs * 1.6);
      sc.every = Math.max(1, Math.ceil(cnt / Math.max(1, room)));
      const f = fmtOf(sc);
      return { sc, f, ticks: ticksOf(sc) };
    }
    if (opt.pct) { hi = hi > 1e-9 ? 1 : Math.max(0, hi); lo = lo < -1e-9 ? Math.max(-1, lo) : 0; if (lo === 0 && hi === 0) hi = 1; }
    else {
      if (lo === hi) { if (lo > 0) lo = 0; else if (hi < 0) hi = 0; }   // één waarde: as vanaf nul
      if (opt.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
      else { if (lo >= 0 && lo < hi * 5 / 6) lo = 0; if (hi <= 0 && hi > lo * 5 / 6) hi = 0; }
      const span = hi - lo;
      if (span > 0 && e) {
        if (hi > 0 && !own('max')) hi += span * 0.05;
        if (lo !== 0 && !own('min')) lo = lo > 0 ? Math.max(0, lo - span * 0.05) : lo - span * 0.05;
      }
    }
    if (own('min')) lo = o.min;
    if (own('max')) hi = o.max;
    if (!(hi > lo)) hi = lo + (Math.abs(lo) || 1);
    let mt = clamp(Math.floor(len / (fs * (opt.horizontal ? 3.4 : 2.3))), 1, 10), sc, f, ticks;
    for (;;) {
      sc = C.niceScale(lo, hi, mt);
      if (own('min') && o.min < sc.max) sc.min = o.min;
      if (own('max') && o.max > sc.min) sc.max = o.max;
      if (isNum(o.major) && o.major > 0 && (sc.max - sc.min) / o.major <= 200) sc.step = o.major;
      linScale(sc);
      f = fmtOf(sc);
      ticks = ticksOf(sc);
      if (!opt.horizontal || mt <= 1) break;
      const wmax = Math.max(0, ...ticks.map((v) => tw(f(v), fs)));
      if (wmax + fs * 0.8 <= len / Math.max(1, ticks.length - 1)) break;
      mt--;
    }
    return { sc, f, ticks };
  };

  /* ---------- Trendlijnen (kleinste kwadraten, geen benadering) ---------- */
  const TRENDS = ['linear', 'exp', 'log', 'poly', 'power', 'movavg'];
  const ols = (xs, ys) => {   // y = a + b·x
    const n = xs.length;
    if (n < 2) return null;
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    if (!(sxx > 0)) return null;
    const b = sxy / sxx, a = my - b * mx;
    let ssr = 0;
    for (let i = 0; i < n; i++) { const e = ys[i] - a - b * xs[i]; ssr += e * e; }
    return { a, b, r2: syy > 1e-20 * my * my * n ? clamp(1 - ssr / syy, 0, 1) : 1 };
  };
  const gauss = (A) => {   // A: n × (n+1); rijvegen met spilkeuze
    const n = A.length;
    let big = 0;
    A.forEach((r) => r.forEach((v) => { big = Math.max(big, Math.abs(v)); }));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (!(Math.abs(A[p][c]) > big * 1e-13)) return null;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = A[r][n]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
    return x.every(Number.isFinite) ? x : null;
  };
  const polyFit = (xs, ys, k) => {   // normaalvergelijkingen op geschaalde x (stabiel), daarna terug naar x
    const n = xs.length;
    if (n <= k) return null;
    let mx = 0, sd = 0;
    xs.forEach((x) => { mx += x; }); mx /= n;
    xs.forEach((x) => { sd += (x - mx) ** 2; }); sd = Math.sqrt(sd / n) || 1;
    const t = xs.map((x) => (x - mx) / sd), m = k + 1, pw = new Array(2 * k + 1).fill(0), A = [];
    t.forEach((u) => { let p = 1; for (let e = 0; e <= 2 * k; e++) { pw[e] += p; p *= u; } });
    for (let r = 0; r < m; r++) { A.push([]); for (let c = 0; c < m; c++) A[r].push(pw[r + c]); A[r].push(0); }
    t.forEach((u, i) => { let p = 1; for (let r = 0; r < m; r++) { A[r][m] += p * ys[i]; p *= u; } });
    const c = gauss(A);
    if (!c) return null;
    const f = (x) => { const u = (x - mx) / sd; let y = 0; for (let j = k; j >= 0; j--) y = y * u + c[j]; return y; };
    const co = new Array(m).fill(0);   // Σ c_j·((x − mx)/sd)^j uitgewerkt
    for (let j = 0; j < m; j++) { const g = c[j] / sd ** j; let bin = 1; for (let i = 0; i <= j; i++) { co[i] += g * bin * (-mx) ** (j - i); bin = (bin * (j - i)) / (i + 1); } }
    return { f, co };
  };
  const r2Of = (xs, ys, f) => {
    let my = 0, ssr = 0, sst = 0;
    ys.forEach((y) => { my += y; }); my /= ys.length;
    ys.forEach((y, i) => { ssr += (y - f(xs[i])) ** 2; sst += (y - my) ** 2; });
    return sst > 1e-20 * my * my * ys.length ? clamp(1 - ssr / sst, 0, 1) : 1;
  };
  const coef = (v, L) => {   // ongeveer vier significante cijfers, zoals in rekenbladen
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e9 || a < 1e-4) return sciStr(v, 4, L, true);
    let s = fixedStr(a, clamp(3 - Math.floor(Math.log10(a)), 0, 10));
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    return (v < 0 ? '-' : '') + s.replace('.', L.dec);
  };
  const terms = (list, L) => {   // [{ c, x: 'x^2' }] → 'y = 0,5x^2 + 2x + 1'
    let s = '';
    list.forEach(({ c, x }) => {
      let m = coef(Math.abs(c), L);
      if (m === '0') return;
      if (m === '1' && x) m = '';
      s += s ? (c < 0 ? ' - ' : ' + ') + m + x : (c < 0 ? '-' : '') + m + x;
    });
    return 'y = ' + (s || '0');
  };
  C.trend = (xs, ys, spec) => {
    const sp = spec && typeof spec === 'object' ? spec : {};
    const type = TRENDS.includes(sp.type) ? sp.type : 'linear', L = LOC[locKey(sp.locale)];
    const X = [], Y = [];
    for (let i = 0, n = Math.min(arr(xs).length, arr(ys).length); i < n; i++) {
      const x = num(xs[i]), y = num(ys[i]);
      if (x === null || y === null) continue;
      if ((type === 'log' || type === 'power') && x <= 0) continue;
      if ((type === 'exp' || type === 'power') && y <= 0) continue;
      X.push(x); Y.push(y);
    }
    const no = { f: () => NaN, eq: '', r2: 0, ok: false, type };
    const ln = (a) => a.map(Math.log);
    const sx = Math.max(1e-300, ...X.map(Math.abs)), sy = Math.max(1e-300, ...Y.map(Math.abs));
    const tiny = (c, p) => Math.abs(c) * sx ** p < 1e-10 * sy;   // verwaarloosbare term in het gegevensbereik
    if (type === 'linear') {
      const r = ols(X, Y);
      if (!r) return no;
      return { f: (x) => r.a + r.b * x, eq: terms([{ c: tiny(r.b, 1) ? 0 : r.b, x: 'x' }, { c: tiny(r.a, 0) ? 0 : r.a, x: '' }], L), r2: r.r2, ok: true, type, a: r.a, b: r.b };
    }
    if (type === 'exp' || type === 'power') {
      const r = ols(type === 'exp' ? X : ln(X), ln(Y));
      if (!r) return no;
      const A = Math.exp(r.a), B = r.b, ca = coef(A, L), cb = coef(B, L);
      const f = type === 'exp' ? (x) => A * Math.exp(B * x) : (x) => (x > 0 ? A * x ** B : NaN);
      const eq = type === 'exp' ? 'y = ' + (ca === '1' ? '' : ca) + 'e^' + cb + 'x' : 'y = ' + (ca === '1' ? '' : ca) + 'x' + (cb === '1' ? '' : '^' + cb);
      return { f, eq, r2: r.r2, ok: true, type, a: A, b: B };
    }
    if (type === 'log') {
      const r = ols(ln(X), Y);
      if (!r) return no;
      return { f: (x) => (x > 0 ? r.a + r.b * Math.log(x) : NaN), eq: terms([{ c: r.b, x: 'ln(x)' }, { c: tiny(r.a, 0) ? 0 : r.a, x: '' }], L), r2: r.r2, ok: true, type, a: r.a, b: r.b };
    }
    if (type === 'poly') {
      const k = clamp(Math.round(+sp.order || 2), 2, 6), r = polyFit(X, Y, k);
      if (!r) return no;
      const list = [];
      for (let j = k; j >= 0; j--) list.push({ c: tiny(r.co[j], j) ? 0 : r.co[j], x: j > 1 ? 'x^' + j : j ? 'x' : '' });
      return { f: r.f, eq: terms(list, L), r2: r2Of(X, Y, r.f), ok: true, type, coef: r.co };
    }
    // zwevend gemiddelde over 'period' punten, op volgorde van x
    const idx = X.map((_, i) => i).sort((a, b) => X[a] - X[b] || a - b), p = clamp(Math.round(+sp.period || 2), 2, Math.max(2, X.length));
    const pts = [];
    for (let i = p - 1; i < idx.length; i++) { let s = 0; for (let k = i - p + 1; k <= i; k++) s += Y[idx[k]]; pts.push([X[idx[i]], s / p]); }
    if (!pts.length) return no;
    const f = (x) => {
      if (!(x >= pts[0][0] && x <= pts[pts.length - 1][0])) return NaN;
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
      return pts[pts.length - 1][1];
    };
    return { f, eq: '', r2: null, ok: true, type, pts };
  };
  /* ---------- Weergave: model en omgeving ---------- */
  const KIND_SET = new Set(['column', 'bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'bubble', 'radar', 'combo']);
  const G3 = ['clustered', 'stacked', 'percent'];
  const SUBS = { column: G3, bar: G3, line: G3, area: G3, radar: ['plain', 'markers', 'filled'], scatter: ['markers', 'lines', 'linesMarkers', 'smooth', 'smoothMarkers'], combo: ['colLine', 'colLine2', 'areaCol'] };
  const normSub = (kind, sub) => { const l = SUBS[kind]; return l ? (l.includes(sub) ? sub : l[0]) : undefined; };
  // stijlen 1–8: 1 standaard, 2 waarden zonder raster, 3 lichte vulling met rand, 4 afgerond en dik, 5 gearceerd vlak,
  // 6 rand en gestippeld raster, 7 zachte kleuren, 8 donker
  const STYLES = { 1: {}, 2: { dl: true, noGrid: true, noVal: true, gapK: 0.6 }, 3: { tint: true }, 4: { round: true, thick: true }, 5: { band: true }, 6: { outline: true, dash: true }, 7: { soft: true, thick: true }, 8: { dark: true } };
  const MARKS = ['circle', 'square', 'diamond', 'triangle'];
  const isPie = (ch) => ch.kind === 'pie' || ch.kind === 'doughnut';
  const obj = (o) => (o && typeof o === 'object' ? o : {});
  const normChart = (src) => {
    const ch = obj(src), kind = KIND_SET.has(ch.kind) ? ch.kind : 'column', series = [];
    const list = (a) => arr(a).slice(0, MAXN).map(num);
    arr(ch.series).slice(0, MAXS).forEach((s, i) => {
      if (!s || typeof s !== 'object') return;
      series.push({ src: s, i, name: s.name == null || s.name === '' ? T(`Reeks ${i + 1}`) : str(s.name), vals: list(s.vals), xs: Array.isArray(s.xs) ? list(s.xs) : null, sizes: Array.isArray(s.sizes) ? list(s.sizes) : null });
    });
    const ax = obj(ch.axes);
    return {
      kind, sub: normSub(kind, ch.sub), cats: arr(ch.cats).slice(0, MAXN).map(str), series,
      title: ch.title, legend: ch.legend, labels: ch.labels, axes: { cat: obj(ax.cat), val: obj(ax.val), val2: obj(ax.val2) },
      gap: ch.gap, overlap: ch.overlap, hole: ch.hole, firstAng: ch.firstAng, style: ch.style, palette: ch.palette, font: obj(ch.font),
    };
  };
  const mkCtx = (ctx, ch) => {
    const scale = isNum(ctx.scale) && ctx.scale > 0 ? clamp(ctx.scale, 0.05, 20) : 1;
    const pt = isNum(ch.font.sz) && ch.font.sz > 0 ? clamp(ch.font.sz, 4, 120) : 12;
    const res = (ref) => {   // ColorRef → kleur via de omgeving
      if (typeof ref !== 'string' || !ref) return null;
      let c = null;
      try { c = typeof ctx.color === 'function' ? ctx.color(ref) : null; } catch (e) { c = null; }
      return okColor(c) ? c.trim() : /^#[0-9a-f]{6}$/i.test(ref) ? ref : null;
    };
    const st = STYLES[ch.style] || STYLES[1];
    let text = res(ch.font.color) || (okColor(ctx.text) ? ctx.text.trim() : '#404040');
    let grid = okColor(ctx.grid) ? ctx.grid.trim() : '#d9d9d9', axis = okColor(ctx.axis) ? ctx.axis.trim() : '#bfbfbf';
    let bg = okColor(ctx.bg) ? ctx.bg.trim() : null, fill = null;
    if (st.dark) { fill = bg = '#262626'; if (!ch.font.color) text = '#f2f2f2'; grid = '#4a4a4a'; axis = '#737373'; }
    if (!bg) bg = luma(text) < 0.35 ? '#ffffff' : '#1f1f1f';   // aangenomen achtergrond (voor scheidingslijnen)
    const font = typeof ctx.font === 'string' && ctx.font.trim() ? ctx.font.trim().replace(/["'<>;]/g, '') : 'Inter';
    const X = {
      fs: (pt * 4) / 3 * scale, sc: scale, text, text2: mix(text, bg, 0.18), grid, axis, bg, fill, sep: bg, res, st, loc: locKey(ctx.locale),
      fam: (/^[\w-]+$/.test(font) ? font : `'${font}'`) + ', sans-serif',
      lw1: Math.max(0.5, scale), lw: 3 * scale * (st.thick ? 1.35 : 1), mr: 3.5 * scale * (st.thick ? 1.2 : 1),
      pal: palFn(ch.palette, basePal(ctx)), W: 0, H: 0,
    };
    X.gridC = st.band ? bg : grid;
    X.band = mix(text, bg, 0.93);
    X.fillOf = (c) => (st.tint ? mix(c, bg, 0.55) : st.soft ? mix(c, '#ffffff', 0.22) : c);
    X.lineOf = (c) => (st.soft ? mix(c, '#ffffff', 0.22) : c);
    X.edge = (c) => (st.tint ? ` stroke="${esc(c)}" stroke-width="${nn(1.5 * scale)}"` : st.outline ? ` stroke="${esc(lumMod(c, 0.7))}" stroke-width="${nn(scale)}"` : '');
    return X;
  };
  const sColor = (s, X, nS) => X.res(s.src.color) || X.pal(s.i, nS);
  const pColor = (s, j, X, nS, nP, pie) => X.res(arr(s.src.pointColors)[j]) || (pie ? X.pal(j, nP) : sColor(s, X, nS));

  /* ---------- Weergave: tekst, markeringen, paden ---------- */
  const supText = (s, size) => {   // 'x^2' → verhoogde 2, werkt met elk lettertype
    let out = '', up = false;
    String(s).split(/(\^\S+)/).forEach((p) => {
      if (!p) return;
      if (p[0] === '^') { out += `<tspan dy="${nn(-size * 0.4)}" font-size="${nn(size * 0.72)}">${esc(p.slice(1))}</tspan>`; up = true; }
      else { out += up ? `<tspan dy="${nn(size * 0.4)}">${esc(p)}</tspan>` : esc(p); up = false; }
    });
    return out;
  };
  const supW = (s, size) => String(s).split(/\^(\S+)/).reduce((w, p, i) => w + tw(p, i % 2 ? size * 0.72 : size), 0);
  const text = (x, y, s, o) => {   // y = midden van de regel
    let a = `<text x="${nn(x)}" y="${nn(y + o.size * 0.35)}" font-size="${nn(o.size)}" fill="${esc(o.color)}"`;
    if (o.anchor && o.anchor !== 'start') a += ` text-anchor="${o.anchor}"`;
    if (o.weight) a += ` font-weight="${o.weight}"`;
    if (o.rot) a += ` transform="rotate(${nn(o.rot)} ${nn(x)} ${nn(y)})"`;
    return a + '>' + (o.sup ? supText(s, o.size) : esc(s)) + '</text>';
  };
  const marker = (type, x, y, r, fill, X, j) => {
    const a = ` fill="${esc(fill)}" stroke="${esc(X.sep)}" stroke-width="${nn(X.sc)}"${j === undefined ? '' : ` data-point="${j}"`}`;
    if (type === 'square') return `<rect x="${nn(x - r * 0.9)}" y="${nn(y - r * 0.9)}" width="${nn(r * 1.8)}" height="${nn(r * 1.8)}"${a}/>`;
    if (type === 'diamond') { const q = r * 1.3; return `<path d="M${nn(x)} ${nn(y - q)}L${nn(x + q)} ${nn(y)}L${nn(x)} ${nn(y + q)}L${nn(x - q)} ${nn(y)}Z"${a}/>`; }
    if (type === 'triangle') { const q = r * 1.35; return `<path d="M${nn(x)} ${nn(y - q)}L${nn(x + q * 0.87)} ${nn(y + q * 0.5)}L${nn(x - q * 0.87)} ${nn(y + q * 0.5)}Z"${a}/>`; }
    return `<circle cx="${nn(x)}" cy="${nn(y)}" r="${nn(r)}"${a}/>`;
  };
  const mkType = (s, def) => { const m = s.src.marker; return m === 'none' ? null : MARKS.includes(m) ? m : m === 'auto' ? 'circle' : def; };
  const okPt = (p) => !!p && isNum(p[0]) && isNum(p[1]);
  const segs = (pts) => { const out = []; let cur = []; pts.forEach((p) => { if (okPt(p)) cur.push(p); else if (cur.length) { out.push(cur); cur = []; } }); if (cur.length) out.push(cur); return out; };
  const linePath = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + nn(p[0]) + ' ' + nn(p[1])).join('');
  const monoPath = (pts) => {   // vloeiend door de punten zonder door te schieten (monotone kubische spline)
    const n = pts.length;
    if (n < 3) return linePath(pts);
    const m = [], t = [];
    for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1][0] - pts[i][0]; m.push(dx ? (pts[i + 1][1] - pts[i][1]) / dx : 0); }
    t.push(m[0]);
    for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (!m[i]) { t[i] = t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${nn(pts[0][0])} ${nn(pts[0][1])}`;
    for (let i = 0; i < n - 1; i++) {
      const h = (pts[i + 1][0] - pts[i][0]) / 3;
      d += `C${nn(pts[i][0] + h)} ${nn(pts[i][1] + t[i] * h)} ${nn(pts[i + 1][0] - h)} ${nn(pts[i + 1][1] - t[i + 1] * h)} ${nn(pts[i + 1][0])} ${nn(pts[i + 1][1])}`;
    }
    return d;
  };
  const crPath = (pts) => {   // Catmull-Rom door alle punten (spreiding: punten in willekeurige volgorde)
    if (pts.length < 3) return linePath(pts);
    let d = `M${nn(pts[0][0])} ${nn(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${nn(p1[0] + (p2[0] - p0[0]) / 6)} ${nn(p1[1] + (p2[1] - p0[1]) / 6)} ${nn(p2[0] - (p3[0] - p1[0]) / 6)} ${nn(p2[1] - (p3[1] - p1[1]) / 6)} ${nn(p2[0])} ${nn(p2[1])}`;
    }
    return d;
  };
  const clipSeg = (a, b, r) => {   // Liang-Barsky
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1], P = [-dx, dx, -dy, dy], Q = [a[0] - r.x0, r.x1 - a[0], a[1] - r.y0, r.y1 - a[1]];
    for (let k = 0; k < 4; k++) {
      if (P[k] === 0) { if (Q[k] < 0) return null; continue; }
      const t = Q[k] / P[k];
      if (P[k] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy], t1 < 1];
  };
  const clipPoly = (pts, r) => {   // lijn bijsnijden tot het tekengebied → losse delen
    const out = [], lim = (p) => [clamp(p[0], -1e7, 1e7), clamp(p[1], -1e7, 1e7)];
    let cur = [];
    const flush = () => { if (cur.length > 1) out.push(cur); cur = []; };
    for (let i = 0; i < pts.length - 1; i++) {
      const c = okPt(pts[i]) && okPt(pts[i + 1]) ? clipSeg(lim(pts[i]), lim(pts[i + 1]), r) : null;
      if (!c) { flush(); continue; }
      const l = cur[cur.length - 1];
      if (l && Math.abs(l[0] - c[0][0]) + Math.abs(l[1] - c[0][1]) > 0.01) flush();
      if (!cur.length) cur.push(c[0]);
      cur.push(c[1]);
      if (c[2]) flush();
    }
    flush();
    return out;
  };
  // labels zonder overlap: elk blok krijgt de eerste vrije plek uit een lijst verschuivingen
  const placer = (X, bounds) => {   // bounds: gebied waarbinnen de labels blijven (standaard de hele grafiek)
    const rs = [], B = bounds || { x0: 0, y0: 0, x1: X.W, y1: X.H };
    const hit = (r) => rs.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
    return {
      add: (r) => rs.push(r),
      put(lines, cx, cy, size, color, tries = [[0, 0]], o = {}) {
        const lh = size * 1.2, w = Math.max(...lines.map((l) => (o.sup ? supW(l, size) : tw(l, size)))) + size * 0.3, h = lines.length * lh;
        for (const [dx, dy] of tries) {
          const r = { x: clamp(cx + dx - w / 2, B.x0, Math.max(B.x0, B.x1 - w)), y: clamp(cy + dy - h / 2, B.y0, Math.max(B.y0, B.y1 - h)), w, h };
          if (hit(r)) continue;
          rs.push(r);
          return (o.bg ? `<rect x="${nn(r.x)}" y="${nn(r.y)}" width="${nn(w)}" height="${nn(h)}" rx="${nn(size * 0.2)}" fill="${esc(o.bg)}" fill-opacity="0.85"/>` : '')
            + lines.map((l, k) => text(r.x + w / 2, r.y + lh * (k + 0.5), l, { size, anchor: 'middle', color: typeof color === 'function' ? color(r) : color, sup: o.sup })).join('');
        }
        return '';
      },
    };
  };
  /* ---------- Weergave: legenda, titel, gegevenslabels ---------- */
  const TREND_NAME = { linear: 'Lineair', exp: 'Exponentieel', log: 'Logaritmisch', poly: 'Polynoom', power: 'Macht', movavg: 'Zwevend gemiddelde' };
  const trendOf = (s) => { const t = s.src.trend; return t && typeof t === 'object' && TRENDS.includes(t.type) ? t : null; };
  const trendName = (t, s) => (t.name ? str(t.name) : t.type === 'movavg' ? T(`${clamp(Math.round(+t.period || 2), 2, 999)} per. zw. gem. (${s.name})`) : T(`${TREND_NAME[t.type]} (${s.name})`));
  const canTrend = (ch) => !isPie(ch) && ch.kind !== 'radar' && !(ch.sub === 'stacked' || ch.sub === 'percent');
  const look = (ch, s) => {   // hoe een reeks in de legenda staat
    const k = ch.kind === 'combo' ? (s.src.kind === 'line' || s.src.kind === 'area' ? s.src.kind : 'column') : ch.kind;
    if (k === 'line') return { type: 'line', marker: mkType(s, null) };
    if (k === 'scatter') { const mk = mkType(s, ch.sub === 'markers' || /Markers$/.test(ch.sub) ? 'circle' : null); return ch.sub === 'markers' ? { type: 'marker', marker: mk || 'circle' } : { type: 'line', marker: mk }; }
    if (k === 'bubble') return { type: 'marker', marker: 'circle' };
    if (k === 'radar') return ch.sub === 'filled' ? { type: 'rect' } : { type: 'line', marker: mkType(s, ch.sub === 'markers' ? 'circle' : null) };
    return { type: 'rect' };
  };
  const legendItems = (ch, X) => {
    const nS = ch.series.length;
    if (isPie(ch)) {
      const s = ch.series[0];
      if (!s) return [];
      const n = Math.max(ch.cats.length, s.vals.length);
      return Array.from({ length: n }, (_, j) => ({ label: ch.cats[j] || String(j + 1), color: X.fillOf(pColor(s, j, X, nS, n, true)), type: 'rect', pt: j }));
    }
    const out = ch.series.map((s) => Object.assign({ label: s.name, idx: s.i }, look(ch, s), { color: sColor(s, X, nS) }));
    out.forEach((it) => { if (it.type === 'rect') it.color = X.fillOf(it.color); });
    if (canTrend(ch)) ch.series.forEach((s) => { const t = trendOf(s); if (t) out.push({ label: trendName(t, s), color: sColor(s, X, nS), idx: s.i, type: 'line', dash: true }); });
    return out;
  };
  const swW = (it, fs) => (it.type === 'line' ? fs * 1.6 : it.type === 'marker' ? fs * 0.76 : fs * 0.72);
  const swatch = (it, x, y, X) => {
    const fs = X.fs;
    if (it.type === 'line') {
      const len = fs * 1.6;
      return `<path d="M${nn(x)} ${nn(y)}h${nn(len)}" fill="none" stroke="${esc(X.lineOf(it.color))}" stroke-width="${nn(Math.min(X.lw, fs * 0.2))}" stroke-linecap="round"${it.dash ? ` stroke-dasharray="${nn(fs * 0.3)} ${nn(fs * 0.25)}"` : ''}/>`
        + (it.marker ? marker(it.marker, x + len / 2, y, Math.min(X.mr, fs * 0.27), it.color, X) : '');
    }
    if (it.type === 'marker') return marker(it.marker || 'circle', x + fs * 0.38, y, fs * 0.3, it.color, X);
    const s = fs * 0.72;
    return `<rect x="${nn(x)}" y="${nn(y - s / 2)}" width="${nn(s)}" height="${nn(s)}" rx="${nn(s * 0.18)}" fill="${esc(it.color)}"/>`;
  };
  const legendLayout = (items, pos, box, X) => {
    if (!items.length) return null;
    const fs = X.fs, lh = fs * 1.4, sp = fs * 1.1, gap = fs * 0.4, horiz = pos === 'b' || pos === 't';
    const mk = (cap) => items.map((it) => { const label = fit(it.label, fs, Math.max(fs * 2, cap - swW(it, fs) - gap)); return Object.assign({}, it, { label, w: swW(it, fs) + gap + tw(label, fs) }); });
    const item = (it, x, y) => `<g class="legend-item"${it.pt === undefined ? ` data-legend="${it.idx}"` : ` data-legend-point="${it.pt}"`}>${swatch(it, x, y, X)}${text(x + swW(it, fs) + gap, y, it.label, { size: fs, color: X.text2 })}</g>`;
    if (horiz) {   // rijen naast elkaar, gecentreerd; bij veel reeksen teruglopen en lange namen inkorten tot alles past
      const maxRows = Math.max(1, Math.floor((box.h * 0.3) / lh));
      let rows = [];
      for (const cap of [box.w, box.w * 0.5, box.w * 0.34, box.w * 0.25, box.w * 0.18, fs * 5]) {
        rows = [];
        let row = [], rw = 0;
        mk(cap).forEach((it) => { if (row.length && rw + sp + it.w > box.w) { rows.push({ row, rw }); row = []; rw = 0; } rw += (row.length ? sp : 0) + it.w; row.push(it); });
        if (row.length) rows.push({ row, rw });
        if (rows.length <= maxRows) break;
      }
      const shown = rows.slice(0, maxRows);
      return { w: box.w, h: shown.length * lh, draw: (x0, y0) => shown.map((r, k) => { let x = x0 + (box.w - r.rw) / 2; return r.row.map((it) => { const s = item(it, x, y0 + lh * (k + 0.5)); x += it.w + sp; return s; }).join(''); }).join('') };
    }
    const per = Math.max(1, Math.floor(box.h / lh));   // kolommen naast elkaar (hooguit de halve breedte); namen zo nodig korter
    let nc = clamp(Math.ceil(items.length / per), 1, 4), its = null, colW = 0;
    for (; nc >= 1; nc--) {
      its = mk(Math.min(box.w * 0.32, (box.w * 0.5 - (nc - 1) * sp) / nc));
      colW = Math.max(...its.map((i) => i.w));
      if (nc === 1 || nc * colW + (nc - 1) * sp <= box.w * 0.5 + 0.5) break;
    }
    const shown = its.slice(0, nc * per), rowsN = Math.ceil(shown.length / nc);
    return { w: nc * colW + (nc - 1) * sp, h: rowsN * lh, draw: (x0, y0) => shown.map((it, k) => item(it, x0 + Math.floor(k / rowsN) * (colW + sp), y0 + lh * ((k % rowsN) + 0.5))).join('') };
  };
  const titleOf = (ch) => {
    const t = ch.title;
    if (!t || typeof t !== 'object' || !t.on) return '';
    const s = str(t.text).trim();
    if (s) return s;
    return ch.series[0] && (ch.series.length === 1 || isPie(ch)) ? ch.series[0].name : T('Grafiektitel');
  };
  const legendPos = (ch) => (['r', 'b', 't', 'l', 'none'].includes(ch.legend) ? ch.legend : ch.series.length > 1 || isPie(ch) ? 'b' : 'none');
  const axTitle = (o) => {
    const t = o.title;
    if (typeof t === 'string') return str(t).trim();
    if (t === true) return T('Astitel');
    return t && typeof t === 'object' && t.on ? str(t.text).trim() || T('Astitel') : '';
  };
  const dlCfg = (ch, X) => {   // gegevenslabels van de hele grafiek
    let L = ch.labels;
    if (L === true) L = { on: true };
    L = obj(L);
    const any = !!(L.val || L.cat || L.pct || L.ser);
    return { on: L.on === undefined ? !!X.st.dl : !!L.on, val: any ? !!L.val : null, cat: !!L.cat, pct: !!L.pct, ser: !!L.ser, pos: typeof L.pos === 'string' ? L.pos : null };
  };
  const dlOn = (s, D) => (typeof s.src.labels === 'boolean' ? s.src.labels : D.on);

  /* ---------- Weergave: samenstellen ---------- */
  const DRAW = {};   // per soort, hieronder gevuld
  const wrapSvg = (W, H, X, body, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${nn(W)}" height="${nn(H)}" viewBox="0 0 ${nn(W)} ${nn(H)}" font-family="${esc(X.fam)}" class="pd-chart" role="img"${label ? ` aria-label="${esc(label)}"` : ''}>${body}</svg>`;
  // lv 0 alles, 1 zonder astitels, 2 zonder legenda, 3 zonder titel, 4 zonder aslabels, 5 tekenen wat past
  const compose = (ch, W, H, X, lv) => {
    const fs = X.fs, force = lv >= 5;
    X.W = W; X.H = H;
    const pad = Math.max(2, Math.min(fs * 0.6, W * 0.05, H * 0.05));
    const box = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
    let head = X.fill ? `<rect class="chart-bg" width="${nn(W)}" height="${nn(H)}" fill="${esc(X.fill)}"/>` : '';
    if (box.w < 8 || box.h < 8) return force ? wrapSvg(W, H, X, head, '') : null;
    const title = lv < 3 ? titleOf(ch) : '';
    if (title) {
      const tfs = fs * 1.55, tl = tfs * 1.2;
      let lines = wrapText(title, tfs, box.w);
      if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
      lines = lines.map((l) => fit(l, tfs, box.w));
      const th = lines.length * tl;
      if (th > box.h * 0.4 && !force) return null;
      head += '<g class="title">' + lines.map((l, k) => text(box.x + box.w / 2, box.y + tl * (k + 0.5), l, { size: tfs, anchor: 'middle', color: X.text, weight: 600 })).join('') + '</g>';
      box.y += th + fs * 0.5; box.h -= th + fs * 0.5;
    }
    let leg = '';
    const lp = lv < 2 ? legendPos(ch) : 'none';
    if (lp !== 'none') {
      const L = legendLayout(legendItems(ch, X), lp, box, X), g = fs * 0.6;
      if (L) {
        let x = box.x, y = box.y;
        if (lp === 'b') { y = box.y + box.h - L.h; box.h -= L.h + g; }
        else if (lp === 't') { box.y += L.h + g; box.h -= L.h + g; }
        else if (lp === 'r') { x = box.x + box.w - L.w; y = box.y + (box.h - L.h) / 2; box.w -= L.w + g; }
        else { y = box.y + (box.h - L.h) / 2; box.x += L.w + g; box.w -= L.w + g; }
        leg = `<g class="legend">${L.draw(x, y)}</g>`;
      }
    }
    if ((box.w < fs * 2 || box.h < fs * 2) && !force) return null;
    const body = (DRAW[ch.kind] || DRAW.column)(ch, X, box, lv, force);
    if (body === null && !force) return null;
    return wrapSvg(W, H, X, head + (body || '') + leg, title);
  };
  const failSvg = (W, H) => `<svg xmlns="http://www.w3.org/2000/svg" width="${nn(W)}" height="${nn(H)}" viewBox="0 0 ${nn(W)} ${nn(H)}" class="pd-chart" data-error="1"><text x="${nn(W / 2)}" y="${nn(H / 2)}" text-anchor="middle" font-size="12" fill="#888888" font-family="sans-serif">${esc(T('Grafiek kan niet worden weergegeven'))}</text></svg>`;
  C.render = (chart, w, h, ctx) => {
    const W = isNum(+w) && +w > 0 ? Math.min(+w, 20000) : 1, H = isNum(+h) && +h > 0 ? Math.min(+h, 20000) : 1;
    try {
      const ch = normChart(chart), X = mkCtx(obj(ctx), ch);
      for (let lv = 0; lv < 5; lv++) { const s = compose(ch, W, H, X, lv); if (s) return s; }
      return compose(ch, W, H, X, 5);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('Doek: grafiek niet getekend', e);
      return failSvg(W, H);
    }
  };
  /* ---------- Gedeelde onderdelen voor grafieken met assen ---------- */
  // categorielabels onder een liggende as. lenOf(overL, overR) geeft de lengte van de as als de labels zoveel buiten de randen
  // uitsteken; elke manier (één regel, twee regels, overslaan, schuin) wordt zo getoetst aan de ruimte die hij zelf overlaat
  const catLayout = (labels, lenOf, slots, onTicks, X, box, rot) => {
    const fs = X.fs, lh = fs * 1.2, ws = labels.map((s) => tw(s, fs)), maxW = Math.max(0, ...ws), multi = labels.some((s) => s.includes('\n'));
    const bandOf = (len) => (onTicks ? len / Math.max(1, slots - 1) : len / Math.max(1, slots));
    const lw = (ls) => Math.max(0, ...(ls || []).map((l) => tw(l, fs)));
    const fitFlat = (lines) => {   // overhang volgens de breedste regel van het eerste en laatste label (hangt bij 'tussen' van de bandbreedte af)
      let band = bandOf(lenOf(0, 0)), o = [0, 0];
      for (let k = 0; k < 3; k++) {
        const wf = lw(lines[0]), wl = lw(lines[lines.length - 1]);
        o = onTicks ? [wf / 2, wl / 2] : [Math.max(0, (wf - band) / 2), Math.max(0, (wl - band) / 2)];
        band = bandOf(lenOf(o[0], o[1]));
      }
      return { band, o };
    };
    const flat = (lines, step, F) => ({ mode: 'h', lines, step, h: lh * Math.max(1, ...lines.map((l) => l.length)), overL: F.o[0], overR: F.o[1] });
    if (!rot && !multi) { const lines = labels.map((s) => [s]), F = fitFlat(lines); if (maxW <= F.band - fs * 0.4) return flat(lines, 1, F); }
    if (!rot) {   // op twee regels, evenwichtig gesplitst zodat gelijke labels er gelijk uitzien
      const room0 = bandOf(lenOf(0, 0)) - fs * 0.4;
      const wr = labels.map((s) => (s.includes('\n') ? wrapText(s, fs, room0) : tw(s, fs) > room0 * 0.6 ? balance(s, fs) : [s])), F = fitFlat(wr), room = F.band - fs * 0.3;
      if (room >= fs * 2.2 && wr.every((ls) => ls.length <= 2 && ls.every((l) => tw(l, fs) <= room + 0.5))) return flat(wr, 1, F);
    }
    if (!rot && !multi && maxW <= fs * 3.2) { const lines = labels.map((s) => [s]), F = fitFlat(lines); return flat(lines, Math.max(1, Math.ceil((maxW + fs * 0.6) / F.band)), F); }   // korte labels: overslaan
    const capH = (frac) => (box.h * frac) / 0.7071 - fs;   // schuin (45°), zo nodig overslaan; het tekengebied houdt genoeg hoogte
    let cap = Math.max(fs * 2, Math.min(maxW, capH(0.36), box.w * 0.45));
    if (maxW <= cap * 1.15 && maxW <= capH(0.42)) cap = maxW;   // bijna even lange labels allemaal heel laten
    const items = labels.map((s) => fit(s.replace(/\n/g, ' '), fs, cap)), L = Math.max(0, ...items.map((s) => tw(s, fs)));
    let band = bandOf(lenOf(0, 0)), oL = 0;
    for (let k = 0; k < 3; k++) { oL = Math.max(0, (L + fs * 0.5) * 0.7071 - (onTicks ? 0 : band / 2)); band = bandOf(lenOf(oL, 0)); }
    return { mode: 'r', items, step: Math.max(1, Math.ceil((lh * 0.95) / (band * 0.7071))), h: (L + fs) * 0.7071, overL: oL, overR: 0 };
  };
  const balance = (s, size) => {   // twee regels met de splitsing zo dicht mogelijk bij het midden
    const w = s.split(/ +/);
    if (w.length < 2) return [s];
    let best = null;
    for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(' '), b = w.slice(k).join(' '), m = Math.max(tw(a, size), tw(b, size)); if (!best || m < best.m) best = { m, l: [a, b] }; }
    return best.l;
  };
  const roundBar = (x, y, w, h, r, side) => {   // balk met afgeronde hoeken aan de waardekant
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const A = (a, b) => `A${nn(r)} ${nn(r)} 0 0 1 ${nn(a)} ${nn(b)}`;
    if (side === 't') return `M${nn(x)} ${nn(y + h)}V${nn(y + r)}${A(x + r, y)}H${nn(x + w - r)}${A(x + w, y + r)}V${nn(y + h)}Z`;
    if (side === 'b') return `M${nn(x)} ${nn(y)}H${nn(x + w)}V${nn(y + h - r)}${A(x + w - r, y + h)}H${nn(x + r)}${A(x, y + h - r)}Z`;
    if (side === 'r') return `M${nn(x)} ${nn(y)}H${nn(x + w - r)}${A(x + w, y + r)}V${nn(y + h - r)}${A(x + w - r, y + h)}H${nn(x)}Z`;
    return `M${nn(x + w)} ${nn(y)}V${nn(y + h)}H${nn(x + r)}${A(x, y + h - r)}V${nn(y + r)}${A(x + r, y)}Z`;
  };
  // trendlijn: gestreept in de kleur van de reeks, bijgesneden tot het tekengebied, met vergelijking en R² bij het einde
  const trendSvg = (r, t, x0, x1, toPx, color, X, P, pl) => {
    let pts = [];
    if (r.pts) pts = r.pts.map(([x, y]) => toPx(x, y));
    else {
      if (r.type === 'log' || r.type === 'power') x0 = Math.max(x0, x1 * 1e-3, Number.MIN_VALUE);
      const n = r.type === 'linear' ? 2 : 120;
      for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * i) / (n - 1); pts.push(toPx(x, r.f(x))); }
    }
    const pieces = clipPoly(pts, P);
    if (!pieces.length) return '';
    let s = `<path class="trend" d="${pieces.map(linePath).join('')}" fill="none" stroke="${esc(color)}" stroke-width="${nn(2 * X.sc)}" stroke-dasharray="${nn(6 * X.sc)} ${nn(4 * X.sc)}" stroke-linecap="round"/>`;
    let lines = [], size = X.fs * 0.9;
    if (t.eq && r.eq) lines.push(r.eq);
    if (t.r2 && isNum(r.r2)) lines.push('R² = ' + C.fmt(r.r2, '0.0000', X.loc));
    const room = P.x1 - P.x0, need = Math.max(0, ...lines.map((l) => supW(l, size))) + size * 0.3;
    if (need > room) size *= Math.max(0.6, room / need);   // te breed: kleiner, en wat dan nog niet past weglaten
    lines = lines.filter((l) => supW(l, size) + size * 0.3 <= room + 0.5);
    if (lines.length) {
      const last = pieces[pieces.length - 1], [ex, ey] = last[last.length - 1], h = lines.length * size * 1.2;
      const w = Math.max(...lines.map((l) => supW(l, size))) + size * 0.3, cx = clamp(ex - w / 2 - size * 0.3, P.x0 + w / 2, Math.max(P.x0 + w / 2, P.x1 - w / 2));
      const above = ey - h / 2 - size * 0.6, below = ey + h / 2 + size * 0.6, y = above - h / 2 >= P.y0 ? above : below, flip = y === above ? 1 : -1;
      s += pl.put(lines, cx, y, size, X.text, [[0, 0], [0, flip * (h + size * 1.2)], [-w * 0.6, 0], [-w * 0.6, flip * (h + size * 1.2)]], { sup: true, bg: X.bg });
    }
    return s;
  };
  const cross = (sc) => (sc.log ? sc.min : sc.min <= 0 && sc.max >= 0 ? 0 : sc.min > 0 ? sc.min : sc.max);   // waar de andere as kruist
  const gridPath = (d, X) => (d ? `<path class="grid" d="${d}" fill="none" stroke="${esc(X.gridC)}" stroke-width="${nn(X.lw1)}"${X.st.dash ? ` stroke-dasharray="${nn(3 * X.sc)} ${nn(3 * X.sc)}"` : ''}/>` : '');
  const axisLine = (d, X) => `<path class="axis" d="${d}" fill="none" stroke="${esc(X.axis)}" stroke-width="${nn(X.lw1)}"/>`;

  /* ---------- Kolom, staaf, lijn, vlak en combinatie ---------- */
  DRAW.column = DRAW.bar = DRAW.line = DRAW.area = DRAW.combo = (ch, X, box, lv, force) => {
    const fs = X.fs, lh = fs * 1.2, gp = fs * 0.4, S = ch.series, nS = S.length;
    const horiz = ch.kind === 'bar', combo = ch.kind === 'combo', grp = combo ? 'clustered' : ch.sub || 'clustered';
    const stk = grp !== 'clustered', pct = grp === 'percent', oC = ch.axes.cat, o1 = ch.axes.val, o2 = ch.axes.val2, rev = !!oC.rev, onTicks = ch.kind === 'area';
    S.forEach((s) => {
      s.k = horiz ? 'bar' : combo ? (s.src.kind === 'line' || s.src.kind === 'area' ? s.src.kind : 'column') : ch.kind;
      s.ax = !horiz && s.src.axis === 2 ? 2 : 1;
    });
    if (nS && !S.some((s) => s.ax === 1)) S.forEach((s) => { s.ax = 1; });
    const has2 = S.some((s) => s.ax === 2), oAx = (ax) => (ax === 2 ? o2 : o1), lg = (ax) => !pct && !!oAx(ax).log;
    const nData = Math.max(ch.cats.length, 0, ...S.map((s) => s.vals.length));
    let extF = 0, extB = 0;   // extra vakken voor de voorspelling van trendlijnen
    if (!stk) S.forEach((s) => { const t = trendOf(s); if (t && t.type !== 'movavg') { extF = Math.max(extF, Math.ceil(clamp(+t.fwd || 0, 0, 500))); extB = Math.max(extB, Math.ceil(clamp(+t.back || 0, 0, 500))); } });
    const slots = Math.max(1, nData + extF + extB);
    // stapelen per soort en as; positief en negatief apart; 100%: aandeel in de som van de absolute waarden
    const groups = new Map();
    S.forEach((s) => { const key = (s.k === 'bar' ? 'column' : s.k) + s.ax; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(s); });
    groups.forEach((list) => {
      const bars = list[0].k === 'column' || list[0].k === 'bar';
      const tot = new Array(nData).fill(0), pos = new Array(nData).fill(0), neg = new Array(nData).fill(0), cum = new Array(nData).fill(0);
      if (pct) list.forEach((s) => s.vals.forEach((v, j) => { if (v !== null && j < nData) tot[j] += Math.abs(v); }));
      list.forEach((s) => {
        s.pt = [];
        for (let j = 0; j < nData; j++) {
          let v = j < s.vals.length ? s.vals[j] : null;
          if (lg(s.ax) && v !== null && v <= 0) v = null;
          const area = s.k === 'area';
          if (!stk) { s.pt.push(v === null ? (area ? { v: null, a: null, b: null } : null) : { v, a: null, b: v }); continue; }
          const w = v === null ? 0 : pct ? (tot[j] ? v / tot[j] : 0) : v;
          if (bars) { if (v === null) s.pt.push(null); else if (w >= 0) s.pt.push({ v, a: pos[j], b: (pos[j] += w), sh: w }); else s.pt.push({ v, a: neg[j], b: (neg[j] += w), sh: w }); }
          else { const a = cum[j]; cum[j] += w; s.pt.push(v === null && !area ? null : { v, a, b: cum[j], sh: w }); }
        }
      });
    });
    const ext = (ax) => {
      let lo = Infinity, hi = -Infinity;
      S.forEach((s) => { if (s.ax === ax) s.pt.forEach((p) => { if (p) [p.a, p.b].forEach((v) => { if (v === null || !isNum(v) || (lg(ax) && v <= 0)) return; if (v < lo) lo = v; if (v > hi) hi = v; }); }); });
      return lo <= hi ? [lo, hi] : null;
    };
    const zero = (ax) => stk || S.some((s) => s.ax === ax && s.k !== 'line');
    const catLabels = [];
    for (let j = 0; j < slots; j++) { const d = j - extB; catLabels.push(d >= 0 && d < nData ? (ch.cats.length ? ch.cats[d] || '' : String(d + 1)) : ''); }
    const showC = oC.on !== false && lv < 4, show1 = (o1.on === undefined ? !X.st.noVal : o1.on !== false) && lv < 4, show2 = has2 && o2.on !== false && lv < 4;
    const tC = lv < 1 ? axTitle(oC) : '', t1 = lv < 1 ? axTitle(o1) : '', t2 = lv < 1 && has2 ? axTitle(o2) : '';
    let rot = false;
    const pass = (P) => {   // schalen en labels voor tekengebied P → het tekengebied dat daarbij hoort
      const pw = Math.max(1, P.x1 - P.x0), ph = Math.max(1, P.y1 - P.y0), vlen = horiz ? pw : ph;
      const A1 = mkAxis(ext(1), vlen, o1, { zero: zero(1), pct, horizontal: horiz }, X), A2 = has2 ? mkAxis(ext(2), vlen, o2, { zero: zero(2), pct }, X) : null;
      const w1 = show1 ? Math.max(0, ...A1.ticks.map((v) => tw(A1.f(v), fs))) : 0, w2 = show2 ? Math.max(0, ...A2.ticks.map((v) => tw(A2.f(v), fs))) : 0;
      if (!horiz) {
        const xl = box.x + (show1 ? w1 + gp : 0) + (t1 ? lh + gp : 0), xr = box.x + box.w - (show2 ? w2 + gp : 0) - (t2 ? lh + gp : 0);
        const lenOf = (oL, oR) => Math.max(1, Math.min(xr, box.x + box.w - oR) - Math.max(xl, box.x + oL));
        const cl = showC ? catLayout(catLabels, lenOf, slots, onTicks, X, box, rot) : null;
        if (cl && cl.mode === 'r') rot = true;   // eenmaal schuin blijft schuin: anders kan de indeling heen en weer springen
        return { A1, A2, cl, P: {
          x0: Math.max(xl, box.x + (cl ? cl.overL : 0)), y0: box.y + (show1 || show2 ? fs * 0.6 : 0),
          x1: Math.min(xr, box.x + box.w - (cl ? cl.overR : 0)), y1: box.y + box.h - (cl ? cl.h + gp : 0) - (tC ? lh + gp : 0),
        } };
      }
      const items = showC ? catLabels.map((s) => fit(s.replace(/\n/g, ' '), fs, box.w * 0.32)) : null, half = (v) => tw(A1.f(v), fs) / 2, tk = show1 ? A1.ticks : [];
      const cl = items ? { items, step: Math.max(1, Math.ceil(lh / Math.max(ph / slots, 1e-6))), w: Math.max(0, ...items.map((s) => tw(s, fs))) } : null;
      return { A1, A2, cl, P: {
        x0: Math.max(box.x + (cl ? cl.w + gp : 0) + (tC ? lh + gp : 0), box.x + (tk.length ? half(tk[0]) : 0)), y0: box.y + fs * 0.3,
        x1: box.x + box.w - (tk.length ? half(tk[tk.length - 1]) : 0), y1: box.y + box.h - (show1 ? lh + gp : 0) - (t1 ? lh + gp : 0),
      } };
    };
    let P = { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h };
    for (let it = 0; it < 6; it++) {   // marges hangen af van de labels en andersom: bijstellen tot het niet meer verandert
      const n = pass(P).P, d = Math.abs(n.x0 - P.x0) + Math.abs(n.x1 - P.x1) + Math.abs(n.y0 - P.y0) + Math.abs(n.y1 - P.y1);
      P = n;
      if (d < 0.5) break;
    }
    const fin = pass(P), A1 = fin.A1, A2 = fin.A2, cl = fin.cl;   // labels en schalen passend bij het uiteindelijke tekengebied
    if (!horiz) P = Object.assign({}, P, { y1: fin.P.y1 }); else P = Object.assign({}, P, { x0: Math.max(P.x0, fin.P.x0) });
    const pw = P.x1 - P.x0, ph = P.y1 - P.y0;
    if (!force && (pw < fs * 2.5 || ph < fs * 2)) return null;
    if (!(pw > 0 && ph > 0)) return '';
    const sc1 = A1.sc, sc2 = A2 ? A2.sc : null, scOf = (s) => (s.ax === 2 ? sc2 : sc1);
    const vp = (sc, v) => { const t = sc.f(v); return horiz ? P.x0 + t * pw : P.y1 - t * ph; };
    const spf = (j) => { let t = onTicks ? (slots > 1 ? j / (slots - 1) : 0.5) : (j + 0.5) / slots; if (rev) t = 1 - t; return horiz ? P.y1 - t * ph : P.x0 + t * pw; };
    const XY = (c, v) => (horiz ? [v, c] : [c, v]);
    let out = X.st.band ? `<rect x="${nn(P.x0)}" y="${nn(P.y0)}" width="${nn(pw)}" height="${nn(ph)}" fill="${esc(X.band)}"/>` : '';
    if (o1.grid === undefined ? !X.st.noGrid : o1.grid) out += gridPath(A1.ticks.map((v) => { const p = vp(sc1, v); return !isNum(p) ? '' : horiz ? `M${nn(p)} ${nn(P.y0)}V${nn(P.y1)}` : `M${nn(P.x0)} ${nn(p)}H${nn(P.x1)}`; }).join(''), X);
    if (oC.grid) {
      let d = '';
      for (let j = 0, n = onTicks ? slots : slots + 1; j < n; j++) { const t = onTicks ? (slots > 1 ? j / (slots - 1) : 0.5) : j / slots; d += horiz ? `M${nn(P.x0)} ${nn(P.y1 - t * ph)}H${nn(P.x1)}` : `M${nn(P.x0 + t * pw)} ${nn(P.y0)}V${nn(P.y1)}`; }
      out += gridPath(d, X);
    }
    const lbl = (x, y, s, anchor, rot) => text(x, y, s, { size: fs, anchor, color: X.text2, rot });
    if (show1) A1.ticks.forEach((v) => { const p = vp(sc1, v); out += horiz ? lbl(p, P.y1 + gp + lh / 2, A1.f(v), 'middle') : lbl(P.x0 - gp, p, A1.f(v), 'end'); });
    if (show2) A2.ticks.forEach((v) => { out += lbl(P.x1 + gp, vp(sc2, v), A2.f(v), 'start'); });
    if (cl) for (let j = 0; j < slots; j++) {
      if ((j - extB) % cl.step) continue;
      const p = spf(j);
      if (horiz) out += lbl(P.x0 - gp, p, cl.items[j], 'end');
      else if (cl.mode === 'r') out += lbl(p, P.y1 + gp + fs * 0.36, cl.items[j], 'end', -45);
      else cl.lines[j].forEach((l, k) => { out += lbl(p, P.y1 + gp + lh * (k + 0.5), l, 'middle'); });
    }
    const tt = (x, y, s, rot, len) => text(x, y, fit(s, fs, len), { size: fs, anchor: 'middle', color: X.text2, rot });
    if (t1) out += horiz ? tt(P.x0 + pw / 2, box.y + box.h - lh / 2, t1, 0, pw) : tt(box.x + lh / 2, P.y0 + ph / 2, t1, -90, ph);
    if (t2) out += tt(box.x + box.w - lh / 2, P.y0 + ph / 2, t2, 90, ph);
    if (tC) out += horiz ? tt(box.x + lh / 2, P.y0 + ph / 2, tC, -90, ph) : tt(P.x0 + pw / 2, box.y + box.h - lh / 2, tC, 0, pw);
    // reeksen: vlakken achter, dan kolommen, lijnen voor
    const D = dlCfg(ch, X), pl = placer(X, { x0: P.x0, x1: horiz ? X.W : P.x1, y0: P.y0 - fs * 0.6, y1: P.y1 }), dfs = fs * 0.92, parts = [];
    const fmtL = (s) => { const c = oAx(s.ax).fmt; return (v) => C.fmt(v, c || 'General', X.loc); };
    const label = (s, j, p, f) => {
      const a = [];
      if (D.ser) a.push(s.name);
      if (D.cat) a.push(ch.cats.length ? ch.cats[j] || '' : String(j + 1));
      if (D.val !== false && p.v !== null) a.push(f(p.v));
      if (D.pct && pct && isNum(p.sh)) a.push(C.fmt(p.sh, '0%', X.loc));
      return a.filter((x) => x !== '').join(LOC[X.loc].sep);
    };
    const colS = S.filter((s) => s.k === 'column' || s.k === 'bar');
    if (colS.length) {
      const nC = stk ? 1 : colS.length, ov = stk ? 1 : (isNum(ch.overlap) ? clamp(ch.overlap, -100, 100) : 0) / 100;
      const gap = ((isNum(ch.gap) ? clamp(ch.gap, 0, 500) : 150) / 100) * (X.st.gapK || 1);
      const band = (horiz ? ph : pw) / slots, bw = band / Math.max(0.01, nC - (nC - 1) * ov + gap), cw = bw * (nC - (nC - 1) * ov), fromStart = horiz ? rev : !rev;
      const lo = horiz ? P.x0 : P.y0, hi = horiz ? P.x1 : P.y1;
      colS.forEach((s, k) => {
        const kk = stk ? 0 : k, sc = scOf(s), base = cross(sc), f = fmtL(s), show = dlOn(s, D);
        let g = '', lab = '';
        s.pt.forEach((p, j) => {
          if (!p) return;
          const c = spf(j + extB), o = fromStart ? c - cw / 2 + kk * bw * (1 - ov) : c + cw / 2 - kk * bw * (1 - ov) - bw;
          const v1 = clamp(vp(sc, p.a === null ? base : p.a), lo, hi), v2 = clamp(vp(sc, p.b), lo, hi);
          if (!isNum(v1) || !isNum(v2)) return;
          const col = pColor(s, j, X, nS, 0, false), fc = X.fillOf(col), a = Math.min(v1, v2), len = Math.abs(v2 - v1);
          const [x, y, w, h] = horiz ? [a, o, len, bw] : [o, a, bw, len], up = horiz ? v2 >= v1 : v2 <= v1;
          g += X.st.round && !stk && len > 0.5
            ? `<path d="${roundBar(x, y, w, h, Math.min(bw * 0.3, 6 * X.sc), horiz ? (up ? 'r' : 'l') : up ? 't' : 'b')}" fill="${esc(fc)}"${X.edge(col)} data-point="${j}"/>`
            : `<rect x="${nn(x)}" y="${nn(y)}" width="${nn(w)}" height="${nn(h)}" fill="${esc(fc)}"${X.edge(col)} data-point="${j}"/>`;
          const t = show ? label(s, j, p, f) : '';
          if (!t) return;
          let pos = D.pos && D.pos !== 'best' ? D.pos : stk ? 'ctr' : 'out';   // buiten, binnen het einde, midden, binnen de basis
          if (stk && pos === 'out') pos = 'in';
          const tW = tw(t, dfs) + dfs * 0.3, tH = dfs * 1.2, ext = horiz ? tW : tH, dir = horiz ? (up ? 1 : -1) : up ? -1 : 1;
          const at = pos === 'out' ? v2 + dir * (ext / 2 + gp * 0.5) : pos === 'in' ? v2 - dir * (ext / 2 + gp * 0.4) : pos === 'base' ? v1 + dir * (ext / 2 + gp * 0.4) : (v1 + v2) / 2;
          const inside = pos !== 'out' && len >= ext + 2 && (horiz ? bw >= tH * 0.9 : bw >= tW * 0.9);
          const [cx, cy] = horiz ? [at, o + bw / 2] : [o + bw / 2, at];
          lab += pl.put([t], cx, cy, dfs, inside ? ink(fc) : X.text, pos !== 'out' ? [[0, 0]] : horiz ? [[0, 0], [0, -tH * 0.9], [0, tH * 0.9]] : [[0, 0], [0, dir * tH], [0, dir * 2 * tH]]);
        });
        parts.push({ z: 1, i: s.i, svg: g, top: lab });
      });
    }
    S.filter((s) => s.k === 'line').forEach((s) => {
      const sc = scOf(s), col = X.lineOf(sColor(s, X, nS)), mk = mkType(s, null), f = fmtL(s), show = dlOn(s, D);
      const pts = s.pt.map((p, j) => (p ? [spf(j + extB), vp(sc, p.b)] : null));
      const d = segs(pts).map((q) => (s.src.smooth ? monoPath(q) : linePath(q))).join('');
      let g = d ? `<path d="${d}" fill="none" stroke="${esc(col)}" stroke-width="${nn(X.lw)}" stroke-linejoin="round" stroke-linecap="round"/>` : '', lab = '';
      pts.forEach((q, j) => {
        if (!okPt(q)) return;
        if (mk) g += marker(mk, q[0], q[1], X.mr, pColor(s, j, X, nS, 0, false), X, j);
        const t = show ? label(s, j, s.pt[j], f) : '';
        if (!t) return;
        const off = (mk ? X.mr : X.lw / 2) + dfs * 0.75;
        const tries = D.pos === 'ctr' ? [[0, 0]] : D.pos === 'in' ? [[0, off], [0, -off]] : D.pos === 'base' ? [[tw(t, dfs) / 2 + off, 0]] : [[0, -off], [0, off], [0, -off * 2]];
        lab += pl.put([t], q[0], q[1], dfs, X.text, tries);
      });
      parts.push({ z: 2, i: s.i, svg: g, top: lab });
    });
    const areaS = S.filter((s) => s.k === 'area');
    areaS.forEach((s) => {
      const sc = scOf(s), col = sColor(s, X, nS), fc = X.fillOf(col), base = cross(sc), f = fmtL(s), show = dlOn(s, D);
      const vb = (v) => clamp(vp(sc, v === null ? base : v), P.y0, P.y1);
      let top = s.pt.map((p, j) => [spf(j + extB), vb(p.b)]), bot = s.pt.map((p, j) => [spf(j + extB), vb(p.a)]);
      if (top.length === 1) { top = [[P.x0, top[0][1]], [P.x1, top[0][1]]]; bot = [[P.x0, bot[0][1]], [P.x1, bot[0][1]]]; }
      const op = stk ? 1 : areaS.length > 1 || combo ? 0.75 : 0.9;
      let g = top.length ? `<path class="area" d="${linePath(top)}${linePath(bot.slice().reverse()).replace('M', 'L')}Z" fill="${esc(fc)}"${op < 1 ? ` fill-opacity="${op}"` : ''}${X.edge(col)}/>` : '';
      if (op < 1 && top.length) g += `<path d="${linePath(top)}" fill="none" stroke="${esc(X.lineOf(col))}" stroke-width="${nn(1.5 * X.sc)}" stroke-linejoin="round"/>`;   // scherpe bovenrand
      let lab = '';
      if (show) s.pt.forEach((p, j) => { const t = p.v === null ? '' : label(s, j, p, f); if (t) lab += pl.put([t], top.length === s.pt.length ? top[j][0] : spf(j + extB), (vb(p.a) + vb(p.b)) / 2, dfs, stk ? ink(fc) : X.text, [[0, 0], [0, -dfs * 1.2]]); });
      parts.push({ z: 0, i: s.i, svg: g, top: lab });
    });
    if (!stk) S.forEach((s) => {   // trendlijnen; x = 1, 2, 3 … zoals in rekenbladen
      const t = trendOf(s);
      if (!t) return;
      const xs = [], ys = [];
      s.vals.forEach((v, j) => { if (v !== null && j < nData) { xs.push(j + 1); ys.push(v); } });
      const r = C.trend(xs, ys, Object.assign({}, t, { locale: X.loc }));
      if (!r.ok) return;
      const sc = scOf(s), svg = trendSvg(r, t, 1 - clamp(+t.back || 0, 0, 500), nData + clamp(+t.fwd || 0, 0, 500), (x, y) => XY(spf(x - 1 + extB), vp(sc, y)), sColor(s, X, nS), X, P, pl);
      const part = parts.find((q) => q.i === s.i);
      if (part) part.top = svg + part.top; else parts.push({ z: 3, i: s.i, svg: '', top: svg });
    });
    parts.sort((a, b) => a.z - b.z || a.i - b.i);
    out += parts.map((q) => `<g class="series" data-series="${q.i}">${q.svg}</g>`).join('');
    const c1 = vp(sc1, cross(sc1));
    if (isNum(c1)) out += axisLine(horiz ? `M${nn(c1)} ${nn(P.y0)}V${nn(P.y1)}` : `M${nn(P.x0)} ${nn(c1)}H${nn(P.x1)}`, X);
    return out + topLayer(parts);
  };
  // gegevenslabels en trendlijnen boven alle reeksen, per reeks gegroepeerd (zelfde data-series)
  const topLayer = (parts) => parts.filter((q) => q.top).sort((a, b) => a.i - b.i).map((q) => `<g class="labels" data-series="${q.i}">${q.top}</g>`).join('');
  /* ---------- Cirkel en ring ---------- */
  const arcPath = (cx, cy, r0, r1, a0, a1) => {   // hoeken vanaf 12 uur, met de klok mee
    const P = (r, a) => `${nn(cx + r * Math.sin(a))} ${nn(cy - r * Math.cos(a))}`;
    if (a1 - a0 >= 2 * Math.PI - 1e-9) {   // één punt is alles: hele cirkel (ring: tegengesteld binnenpad = gat)
      const ring = (r, sw) => `M${P(r, 0)}A${nn(r)} ${nn(r)} 0 1 ${sw} ${P(r, Math.PI)}A${nn(r)} ${nn(r)} 0 1 ${sw} ${P(r, 0)}Z`;
      return ring(r1, 1) + (r0 > 0 ? ring(r0, 0) : '');
    }
    const big = a1 - a0 > Math.PI ? 1 : 0;
    return `M${P(r1, a0)}A${nn(r1)} ${nn(r1)} 0 ${big} 1 ${P(r1, a1)}` + (r0 > 0 ? `L${P(r0, a1)}A${nn(r0)} ${nn(r0)} 0 ${big} 0 ${P(r0, a0)}Z` : `L${nn(cx)} ${nn(cy)}Z`);
  };
  DRAW.pie = DRAW.doughnut = (ch, X, box, lv, force) => {
    const fs = X.fs, dfs = fs * 0.92, dl = dfs * 1.2, gp = fs * 0.5, dough = ch.kind === 'doughnut', nS = ch.series.length;
    const rings = dough ? ch.series : ch.series.slice(0, 1), n = Math.max(ch.cats.length, 0, ...rings.map((s) => s.vals.length));
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R0 = Math.min(box.w, box.h) / 2;
    if (!force && R0 < fs * 1.5) return null;
    const hole = dough ? clamp(isNum(ch.hole) ? ch.hole : 50, 10, 90) / 100 : 0;
    rings.forEach((s) => { s.pv = []; s.tot = 0; for (let j = 0; j < n; j++) { const v = s.vals[j], a = v == null ? 0 : Math.abs(v); s.pv.push(a); s.tot += a; } });
    if (!rings.some((s) => s.tot > 0)) {   // nog geen gegevens: lege omtrek
      const ring = (r) => `<circle cx="${nn(cx)}" cy="${nn(cy)}" r="${nn(r)}" fill="none" stroke="${esc(X.grid)}" stroke-width="${nn(X.lw1 * 1.5)}"/>`;
      return ring(Math.max(1, R0 * 0.9)) + (dough ? ring(Math.max(1, R0 * 0.9 * hole)) : '');
    }
    const a0 = ((((isNum(ch.firstAng) ? ch.firstAng : 0) % 360) + 360) % 360) * Math.PI / 180, outer = rings[rings.length - 1];
    const expl = (j) => (rings.length === 1 ? clamp(+arr(outer.src.explode)[j] || 0, 0, 1) : 0);
    let maxE = 0;
    for (let j = 0; j < n; j++) maxE = Math.max(maxE, expl(j));
    const slices = (s) => { let acc = 0; return s.pv.map((v, j) => { const st = a0 + (acc / s.tot) * 2 * Math.PI; acc += v; const en = a0 + (acc / s.tot) * 2 * Math.PI; return { j, v, st, en, mid: (st + en) / 2, sw: en - st, p: s.tot ? v / s.tot : 0 }; }); };
    const D = dlCfg(ch, X), pos = D.pos || 'best', labs = [];
    rings.forEach((s) => {
      if (!dlOn(s, D) || !(s.tot > 0)) return;
      slices(s).forEach((q) => {
        if (!(q.v > 0)) return;
        const L = [];
        if (D.ser) L.push(s.name);
        if (D.cat) L.push(ch.cats[q.j] || String(q.j + 1));
        if (D.val) L.push(C.fmt(s.vals[q.j], ch.axes.val.fmt || 'General', X.loc));
        if (D.pct || D.val === null) L.push(C.fmt(q.p, '0%', X.loc));   // standaard: percentage
        if (L.length) labs.push({ s, q, L, w: Math.max(...L.map((l) => tw(l, dfs))) + dfs * 0.3, h: L.length * dl, outerRing: s === outer });
      });
    });
    const rIn = (k, R) => (dough ? R * hole + ((R - R * hole) * k) / rings.length : 0), rOut = (k, R) => (dough ? R * hole + ((R - R * hole) * (k + 1)) / rings.length : R);
    const midR = (l, R) => { const k = rings.indexOf(l.s); return dough ? (rIn(k, R) + rOut(k, R)) / 2 : R * (pos === 'in' ? 0.72 : pos === 'ctr' ? 0.5 : 0.62); };
    const fits = (l, R) => {
      const r = midR(l, R), k = rings.indexOf(l.s), chord = 2 * r * Math.sin(Math.min(l.q.sw, Math.PI) / 2);
      return l.q.sw > 0.2 && chord >= l.w && (dough ? rOut(k, R) - rIn(k, R) >= l.h * 0.95 : (R - r) * 2 >= l.h);
    };
    let R = R0 / (1 + maxE);
    for (let it = 0; it < 3; it++) {   // labels die niet passen komen buiten de cirkel; daarvoor wordt de cirkel kleiner
      labs.forEach((l) => { l.out = l.outerRing && (pos === 'out' || (pos === 'best' && !fits(l, R))); });
      const outs = labs.filter((l) => l.out);
      const r = outs.length ? Math.min(box.w / 2 - Math.max(...outs.map((l) => l.w)) - gp, box.h / 2 - Math.max(...outs.map((l) => l.h)) - gp * 0.5) : R0;
      R = Math.max(r, Math.min(R0, fs * 2)) / (1 + maxE);
    }
    const pl = placer(X), G = rings.map(() => '');
    rings.forEach((s, k) => {
      const r0 = rIn(k, R), r1 = rOut(k, R);
      slices(s).forEach((q) => {
        if (!(q.v > 0)) return;
        const e = expl(q.j) * R;
        G[k] += `<path d="${arcPath(cx + e * Math.sin(q.mid), cy - e * Math.cos(q.mid), r0, r1, q.st, q.en)}" fill="${esc(X.fillOf(pColor(s, q.j, X, nS, n, true)))}" stroke="${esc(X.sep)}" stroke-width="${nn(1.5 * X.sc)}" stroke-linejoin="round" data-point="${q.j}"/>`;
      });
    });
    labs.filter((l) => !l.out).forEach((l) => {   // binnen de cirkel of ring
      const ok = fits(l, R);
      if (!ok && !l.outerRing) return;
      const k = rings.indexOf(l.s), r = midR(l, R) + expl(l.q.j) * R, col = X.fillOf(pColor(l.s, l.q.j, X, nS, n, true));
      G[k] += pl.put(l.L, cx + r * Math.sin(l.q.mid), cy - r * Math.cos(l.q.mid), dfs, ok ? ink(col) : X.text);
    });
    const outs = labs.filter((l) => l.out);   // buiten: per kant op volgorde, zonder overlap en zonder verbindingslijnen
    outs.forEach((l) => { const c = Math.cos(l.q.mid); l.rr = R * (1 + expl(l.q.j)) + gp * 0.6; l.side = Math.sin(l.q.mid) >= 0 ? 1 : -1; l.y = cy - l.rr * c - (Math.abs(Math.sin(l.q.mid)) < 0.3 ? (c * l.h) / 2 : 0); });
    [1, -1].forEach((side) => {
      let sum = 0;   // passen niet alle labels aan deze kant, dan vallen die van de kleinste punten weg
      const L = outs.filter((l) => l.side === side).sort((a, b) => b.q.v - a.q.v).filter((l) => (sum += l.h) <= box.h).sort((a, b) => a.y - b.y);
      for (let i = 1; i < L.length; i++) L[i].y = Math.max(L[i].y, L[i - 1].y + (L[i - 1].h + L[i].h) / 2);
      for (let i = L.length - 1; i >= 0; i--) L[i].y = Math.min(L[i].y, i === L.length - 1 ? box.y + box.h - L[i].h / 2 : L[i + 1].y - (L[i + 1].h + L[i].h) / 2);
      L.forEach((l) => {
        l.y = Math.max(l.y, box.y + l.h / 2);
        const dy = l.y - cy, near = Math.abs(Math.sin(l.q.mid)) < 0.3 && Math.abs(dy) >= l.rr * 0.9, up = dy < 0 ? -1 : 1;
        const x = near ? cx + l.rr * Math.sin(l.q.mid) : cx + side * Math.sqrt(Math.max(0, l.rr * l.rr - dy * dy)) + (side * l.w) / 2;
        // laatste controle met dezelfde plaatser als de labels binnen: nooit overlap (bovenaan/onderaan botsen de twee kanten soms)
        G[G.length - 1] += pl.put(l.L, clamp(x, l.w / 2, X.W - l.w / 2), l.y, dfs, X.text, [[0, 0], [side * l.w * 0.5, 0], [0, up * l.h], [side * l.w * 0.5, up * l.h]]);
      });
    });
    return rings.map((s, k) => `<g class="series" data-series="${s.i}">${G[k]}</g>`).join('');
  };

  /* ---------- Radar ---------- */
  DRAW.radar = (ch, X, box, lv, force) => {
    const fs = X.fs, lh = fs * 1.2, gp = fs * 0.45, dfs = fs * 0.92, S = ch.series, nS = S.length, oC = ch.axes.cat, o1 = ch.axes.val;
    const n = Math.max(ch.cats.length, 0, ...S.map((s) => s.vals.length));
    if (!n) return '';
    const filled = ch.sub === 'filled', showC = oC.on !== false && lv < 4, show1 = (o1.on === undefined ? !X.st.noVal : o1.on !== false) && lv < 4;
    const cats = Array.from({ length: n }, (_, j) => (ch.cats.length ? ch.cats[j] || '' : String(j + 1)));
    const items = showC ? cats.map((s) => fit(s.replace(/\n/g, ' '), fs, box.w * 0.24)) : [];
    const ang = (j) => (2 * Math.PI * j) / n, iw = items.map((s) => tw(s, fs));
    let shown = items.map(() => true);
    const lrect = (j, R) => {   // labelvak t.o.v. het midden
      const sx = Math.sin(ang(j)), sy = -Math.cos(ang(j)), ax = (R + gp) * sx, ay = (R + gp) * sy + (sy * lh) / 2;
      return { x: ax + (sx > 0.15 ? 0 : sx < -0.15 ? -iw[j] : -iw[j] / 2), y: ay - lh / 2, w: iw[j], h: lh };
    };
    const ext = (R) => {   // hoe ver spaken en labels bij straal R uitsteken t.o.v. het midden
      const e = { l: 0, r: 0, t: 0, b: 0 };
      cats.forEach((_, j) => {
        const sx = Math.sin(ang(j)), sy = -Math.cos(ang(j));
        e.l = Math.min(e.l, R * sx); e.r = Math.max(e.r, R * sx); e.t = Math.min(e.t, R * sy); e.b = Math.max(e.b, R * sy);
        if (j >= items.length || !shown[j]) return;
        const q = lrect(j, R);
        e.l = Math.min(e.l, q.x); e.r = Math.max(e.r, q.x + q.w); e.t = Math.min(e.t, q.y); e.b = Math.max(e.b, q.y + q.h);
      });
      return e;
    };
    const fitR = () => {   // grootste straal die past; het midden mag daarvoor verschuiven
      let a = 0, b = Math.min(box.w, box.h) / 2;
      for (let k = 0; k < 32; k++) { const m = (a + b) / 2, e = ext(m); if (e.r - e.l <= box.w && e.b - e.t <= box.h) a = m; else b = m; }
      return a;
    };
    let rFit = 0;
    for (let step = Math.max(1, Math.ceil(items.length / 72)); ; step++) {   // bij veel categorieën: elk n-de label, zonder overlap
      shown = items.map((_, j) => j % step === 0);
      rFit = fitR();
      const rs = items.map((_, j) => (shown[j] ? lrect(j, rFit) : null)).filter(Boolean);
      if (step >= items.length || !rs.some((a, i) => rs.some((b, k) => k > i && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y))) break;
    }
    if (!force && rFit < fs * 2) return null;
    const R = Math.max(rFit, 1), E = ext(R), cx = box.x - E.l + (box.w - (E.r - E.l)) / 2, cy = box.y - E.t + (box.h - (E.b - E.t)) / 2;
    let lo = Infinity, hi = -Infinity;
    S.forEach((s) => s.vals.forEach((v) => { if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    const A = mkAxis(lo <= hi ? [lo, hi] : null, R * 1.4, o1, { zero: true }, X), sc = A.sc;
    const rad = (v) => { const t = sc.f(v); return isNum(t) ? clamp(t, 0, 1.05) * R : null; };
    const pt = (j, r) => [cx + r * Math.sin(ang(j)), cy - r * Math.cos(ang(j))];
    const poly = (r) => (n >= 3 ? linePath(cats.map((_, j) => pt(j, r))) + 'Z' : `M${nn(cx)} ${nn(cy - r)}A${nn(r)} ${nn(r)} 0 1 1 ${nn(cx)} ${nn(cy + r)}A${nn(r)} ${nn(r)} 0 1 1 ${nn(cx)} ${nn(cy - r)}Z`);
    let out = '';
    if (o1.grid === undefined ? !X.st.noGrid : o1.grid) out += gridPath(A.ticks.map(rad).filter((r) => r > 0.5).map(poly).join(''), X);
    out += gridPath(cats.map((_, j) => { const p = pt(j, R); return `M${nn(cx)} ${nn(cy)}L${nn(p[0])} ${nn(p[1])}`; }).join(''), X);
    const pl = placer(X);
    items.forEach((s, j) => {
      if (!shown[j]) return;
      const sx = Math.sin(ang(j)), p = pt(j, R + gp), anchor = sx > 0.15 ? 'start' : sx < -0.15 ? 'end' : 'middle', y = p[1] - (Math.cos(ang(j)) * lh) / 2, w = tw(s, fs);
      out += text(p[0], y, s, { size: fs, anchor, color: X.text2 });
      pl.add({ x: anchor === 'start' ? p[0] : anchor === 'end' ? p[0] - w : p[0] - w / 2, y: y - lh / 2, w, h: lh });
    });
    if (show1) A.ticks.forEach((v) => { const r = rad(v), s = A.f(v); if (r !== null) out += pl.put([s], cx - gp - tw(s, fs * 0.85) / 2, cy - r, fs * 0.85, X.text2); });
    const D = dlCfg(ch, X), parts = [];
    S.forEach((s) => {
      const col = sColor(s, X, nS), mk = mkType(s, ch.sub === 'markers' ? 'circle' : null), show = dlOn(s, D);
      let lab = '';
      const pts = cats.map((_, j) => { const v = s.vals[j], r = v === null || v === undefined ? null : rad(v); return r === null ? (filled ? pt(j, 0) : null) : pt(j, r); });
      const st = ` stroke="${esc(X.lineOf(col))}" stroke-width="${nn(filled ? X.lw * 0.7 : X.lw)}" stroke-linejoin="round" stroke-linecap="round"`;
      let g = pts.every(okPt) ? `<path d="${linePath(pts)}Z" fill="${filled ? esc(X.fillOf(col)) : 'none'}"${filled ? ' fill-opacity="0.45"' : ''}${st}/>` : `<path d="${segs(pts.concat([pts[0]])).map(linePath).join('')}" fill="none"${st}/>`;
      pts.forEach((p, j) => {
        const v = s.vals[j];
        if (!okPt(p) || v === null || v === undefined) return;
        if (mk) g += marker(mk, p[0], p[1], X.mr, pColor(s, j, X, nS, 0, false), X, j);
        if (!show) return;
        const a = [];
        if (D.ser) a.push(s.name);
        if (D.cat) a.push(cats[j]);
        if (D.val !== false) a.push(C.fmt(v, o1.fmt || 'General', X.loc));
        const t = a.filter((x) => x !== '').join(LOC[X.loc].sep), sx = Math.sin(ang(j)), sy = -Math.cos(ang(j));
        if (t) lab += pl.put([t], p[0] + sx * dfs, p[1] + sy * dfs, dfs, X.text, [[0, 0], [sx * dfs, sy * dfs], [-sx * dfs * 2, -sy * dfs * 2]]);
      });
      out += `<g class="series" data-series="${s.i}">${g}</g>`;
      parts.push({ i: s.i, top: lab });
    });
    return out + topLayer(parts);
  };
  /* ---------- Spreiding en bellen ---------- */
  DRAW.scatter = DRAW.bubble = (ch, X, box, lv, force) => {
    const fs = X.fs, lh = fs * 1.2, gp = fs * 0.4, dfs = fs * 0.92, S = ch.series, nS = S.length, bub = ch.kind === 'bubble';
    const oX = ch.axes.cat, oY = ch.axes.val, sub = ch.sub || 'markers', logX = !!oX.log, logY = !!oY.log;
    const lines = !bub && sub !== 'markers', smooth = /^smooth/.test(sub), mkDef = bub ? null : sub === 'markers' || /Markers$/.test(sub) ? 'circle' : null;
    let zmax = 0, xl = Infinity, xh = -Infinity, yl = Infinity, yh = -Infinity;
    S.forEach((s) => {   // zonder x-waarden: 1, 2, 3 … zoals in rekenbladen
      const xs = s.xs && s.xs.some((v) => v !== null) ? s.xs : null;
      s.P = s.vals.map((y, j) => {
        const x = xs ? (j < xs.length ? xs[j] : null) : j + 1, z = bub ? (s.sizes ? s.sizes[j] : null) : 1;
        if (x === null || y === null || (logX && x <= 0) || (logY && y <= 0) || (bub && !(isNum(z) && z > 0))) return null;
        if (bub) zmax = Math.max(zmax, z);
        xl = Math.min(xl, x); xh = Math.max(xh, x); yl = Math.min(yl, y); yh = Math.max(yh, y);
        return { x, y, z, j };
      });
    });
    const has = xl <= xh;
    if (has) S.forEach((s) => {   // voorspelling van trendlijnen verlengt de x-as
      const t = trendOf(s), xs = s.P.filter(Boolean).map((p) => p.x);
      if (t && t.type !== 'movavg' && xs.length) { xl = Math.min(xl, Math.min(...xs) - clamp(+t.back || 0, 0, 1e12)); xh = Math.max(xh, Math.max(...xs) + clamp(+t.fwd || 0, 0, 1e12)); }
    });
    if (bub && has) {   // ruimte voor de bellen aan de randen
      const px = (xh - xl) * 0.12 || Math.abs(xh) * 0.12 || 1, py = (yh - yl) * 0.12 || Math.abs(yh) * 0.12 || 1;
      if (!logX) { xl -= px; xh += px; }
      if (!logY) { yl -= py; yh += py; }
    }
    const showX = oX.on !== false && lv < 4, showY = (oY.on === undefined ? !X.st.noVal : oY.on !== false) && lv < 4;
    const tX = lv < 1 ? axTitle(oX) : '', tY = lv < 1 ? axTitle(oY) : '';
    let P = { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h }, AX = null, AY = null;
    for (let it = 0; it < 3; it++) {
      const pw = Math.max(1, P.x1 - P.x0), ph = Math.max(1, P.y1 - P.y0);
      AX = mkAxis(has ? [xl, xh] : null, pw, oX, { zero: false, horizontal: true }, X);
      AY = mkAxis(has ? [yl, yh] : null, ph, oY, { zero: false }, X);
      const wy = showY ? Math.max(0, ...AY.ticks.map((v) => tw(AY.f(v), fs))) : 0, tk = showX ? AX.ticks : [], half = (v) => tw(AX.f(v), fs) / 2;
      P = {
        x0: Math.max(box.x + (showY ? wy + gp : 0) + (tY ? lh + gp : 0), box.x + (tk.length ? half(tk[0]) : 0)), y0: box.y + (showY ? fs * 0.6 : 0),
        x1: box.x + box.w - (tk.length ? half(tk[tk.length - 1]) : 0), y1: box.y + box.h - (showX ? lh + gp : 0) - (tX ? lh + gp : 0),
      };
    }
    const pw = P.x1 - P.x0, ph = P.y1 - P.y0;
    if (!force && (pw < fs * 2.5 || ph < fs * 2)) return null;
    if (!(pw > 0 && ph > 0)) return '';
    const xp = (v) => P.x0 + AX.sc.f(v) * pw, yp = (v) => P.y1 - AY.sc.f(v) * ph;
    let out = X.st.band ? `<rect x="${nn(P.x0)}" y="${nn(P.y0)}" width="${nn(pw)}" height="${nn(ph)}" fill="${esc(X.band)}"/>` : '';
    if (oY.grid === undefined ? !X.st.noGrid : oY.grid) out += gridPath(AY.ticks.map((v) => `M${nn(P.x0)} ${nn(yp(v))}H${nn(P.x1)}`).join(''), X);
    if (oX.grid === undefined ? !X.st.noGrid : oX.grid) out += gridPath(AX.ticks.map((v) => `M${nn(xp(v))} ${nn(P.y0)}V${nn(P.y1)}`).join(''), X);
    if (showY) AY.ticks.forEach((v) => { out += text(P.x0 - gp, yp(v), AY.f(v), { size: fs, anchor: 'end', color: X.text2 }); });
    if (showX) AX.ticks.forEach((v) => { out += text(xp(v), P.y1 + gp + lh / 2, AX.f(v), { size: fs, anchor: 'middle', color: X.text2 }); });
    if (tY) out += text(box.x + lh / 2, P.y0 + ph / 2, fit(tY, fs, ph), { size: fs, anchor: 'middle', color: X.text2, rot: -90 });
    if (tX) out += text(P.x0 + pw / 2, box.y + box.h - lh / 2, fit(tX, fs, pw), { size: fs, anchor: 'middle', color: X.text2 });
    const D = dlCfg(ch, X), pl = placer(X, { x0: P.x0, x1: P.x1, y0: P.y0 - fs * 0.6, y1: P.y1 }), maxR = Math.max(2, Math.min(pw, ph) * 0.12);
    const yf = (v) => C.fmt(v, oY.fmt || 'General', X.loc), xf = (v) => C.fmt(v, oX.fmt || 'General', X.loc);
    const parts = [];
    S.forEach((s) => {
      const col = sColor(s, X, nS), mk = mkType(s, mkDef), show = dlOn(s, D), pts = s.P.map((p) => (p ? [xp(p.x), yp(p.y)] : null)), mr = X.mr * (lines ? 1 : 1.3);
      const rOf = (p) => Math.max(1.5 * X.sc, maxR * Math.sqrt(p.z / (zmax || 1)));
      let g = '', lab = '';
      if (lines) {
        const sm = typeof s.src.smooth === 'boolean' ? s.src.smooth : smooth, d = segs(pts).map((q) => (sm ? crPath(q) : linePath(q))).join('');
        if (d) g += `<path d="${d}" fill="none" stroke="${esc(X.lineOf(col))}" stroke-width="${nn(X.lw * 0.85)}" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (bub) s.P.map((p, j) => j).filter((j) => s.P[j] && okPt(pts[j])).sort((a, b) => s.P[b].z - s.P[a].z).forEach((j) => {   // grote bellen eerst
        const c = pColor(s, j, X, nS, 0, false);
        g += `<circle cx="${nn(pts[j][0])}" cy="${nn(pts[j][1])}" r="${nn(rOf(s.P[j]))}" fill="${esc(X.fillOf(c))}" fill-opacity="0.78" stroke="${esc(lumMod(c, 0.8))}" stroke-width="${nn(X.sc)}" data-point="${j}"/>`;
      });
      else if (mk) pts.forEach((q, j) => { if (okPt(q)) g += marker(mk, q[0], q[1], mr, pColor(s, j, X, nS, 0, false), X, j); });
      if (show) s.P.forEach((p, j) => {
        if (!p || !okPt(pts[j])) return;
        const a = [];
        if (D.ser) a.push(s.name);
        if (D.cat) a.push(xf(p.x));
        if (D.val !== false) a.push(yf(p.y));
        const t = a.filter((x) => x !== '').join(LOC[X.loc].sep);
        if (!t) return;
        const r = bub ? rOf(p) : mk ? mr : X.lw / 2, off = r + dfs * 0.75, side = [tw(t, dfs) / 2 + r + dfs * 0.4, 0];
        if (bub) {
          const inside = tw(t, dfs) < r * 1.8 && dfs * 1.2 < r * 1.8;
          lab += pl.put([t], pts[j][0], pts[j][1], dfs, inside ? ink(X.fillOf(pColor(s, j, X, nS, 0, false))) : X.text, inside ? [[0, 0]] : [[0, -off], side, [0, off]]);
        } else lab += pl.put([t], pts[j][0], pts[j][1], dfs, X.text, D.pos === 'ctr' ? [[0, 0]] : D.pos === 'in' ? [[0, off], [0, -off]] : D.pos === 'base' ? [side] : [[0, -off], [0, off], side]);
      });
      const t = trendOf(s), ok = s.P.filter(Boolean);
      if (t && ok.length) {
        const r = C.trend(ok.map((p) => p.x), ok.map((p) => p.y), Object.assign({}, t, { locale: X.loc })), xs = ok.map((p) => p.x);
        if (r.ok) lab = trendSvg(r, t, Math.min(...xs) - clamp(+t.back || 0, 0, 1e12), Math.max(...xs) + clamp(+t.fwd || 0, 0, 1e12), (x, y) => [xp(x), yp(y)], col, X, P, pl) + lab;
      }
      out += `<g class="series" data-series="${s.i}">${g}</g>`;
      parts.push({ i: s.i, top: lab });
    });
    const c = yp(cross(AY.sc));
    if (isNum(c)) out += axisLine(`M${nn(P.x0)} ${nn(c)}H${nn(P.x1)}`, X);
    return out + topLayer(parts);
  };

  /* ---------- Soorten voor het dialoogvenster Grafiek invoegen ---------- */
  const ic = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">${b}</svg>`;
  const R = (x, y, w, h, o, rx = 0.5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${o ? ` opacity="${o}"` : ''}/>`;
  const LN = (d, o) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${o ? ` opacity="${o}"` : ''}/>`;
  const DOTS = (pts, o) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7"${o ? ` opacity="${o}"` : ''}/>`).join('');
  const BASE = '<path d="M2.5 21.25h19" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45"/>';
  const BASEV = '<path d="M2.75 2.5v19" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45"/>';
  const XYAX = '<path d="M3 3v18h18" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45"/>';
  const stack = (cols, horiz) => cols.map(([p, parts]) => { let at = 0; return parts.map(([len, o]) => { const s = horiz ? R(3.5 + at, p, len, 4, o, 0) : R(p, 20.5 - at - len, 4, len, o, 0); at += len; return s; }).join(''); }).join('');
  const L1 = 'M3 16.5l4.5-5 4 3 4.5-7 5 4', L1P = [[3, 16.5], [7.5, 11.5], [11.5, 14.5], [16, 7.5], [21, 11.5]];
  const L2 = 'M3 19l4.5-2.5 4 1 4.5-4 5 1.5', L2P = [[3, 19], [7.5, 16.5], [11.5, 17.5], [16, 13.5], [21, 15]];
  const LS1 = 'M3 11l4.5-3 4 2 4.5-5 5 2', LS1P = [[3, 11], [7.5, 8], [11.5, 10], [16, 5], [21, 7]];
  const LP1 = 'M3 4.5h18', LP1P = [[3, 4.5], [7.5, 4.5], [11.5, 4.5], [16, 4.5], [21, 4.5]];
  const CURVE = 'M5 17C8 9 11 9 13 13S17 15 20 6', CURVEP = [[5, 17], [9.4, 10.5], [13, 13], [16.1, 14.4], [20, 6]];
  const POLY = 'M5 17L9.5 10.5 13 13l3.5 1.5L20 6', POLYP = [[5, 17], [9.5, 10.5], [13, 13], [16.5, 14.5], [20, 6]];
  const PENT = '<path d="M12 3.5l8.56 6.22-3.27 10.06H6.71L3.44 9.72z" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/>';
  const RAD = 'M12 5.5l4.76 5.46-1.23 6.39-5.59-2.02-3.65-4.68z', RADP = [[12, 5.5], [16.76, 10.96], [15.53, 17.35], [9.94, 15.33], [6.29, 10.65]];
  const IC = {
    col1: BASE + R(3.5, 11, 3, 9.5) + R(7, 6, 3, 14.5, '.5') + R(13.5, 8, 3, 12.5) + R(17, 3.5, 3, 17, '.5'),
    col2: BASE + stack([[4, [[6.5, 0], [5, '.55'], [3, '.3']]], [10, [[9.5, 0], [5, '.55'], [3, '.3']]], [16, [[5.5, 0], [4, '.55'], [3, '.3']]]]),
    col3: BASE + stack([[4, [[7.5, 0], [6, '.55'], [4, '.3']]], [10, [[10.5, 0], [4, '.55'], [3, '.3']]], [16, [[6.5, 0], [6, '.55'], [5, '.3']]]]),
    bar1: BASEV + R(3.5, 3.5, 9.5, 3) + R(3.5, 7, 14.5, 3, '.5') + R(3.5, 13.5, 12.5, 3) + R(3.5, 17, 17, 3, '.5'),
    bar2: BASEV + stack([[4, [[6.5, 0], [5, '.55'], [3, '.3']]], [10, [[9.5, 0], [5, '.55'], [3, '.3']]], [16, [[5.5, 0], [4, '.55'], [3, '.3']]]], true),
    bar3: BASEV + stack([[4, [[7.5, 0], [6, '.55'], [4, '.3']]], [10, [[10.5, 0], [4, '.55'], [3, '.3']]], [16, [[6.5, 0], [6, '.55'], [5, '.3']]]], true),
    line1: BASE + LN(L1) + LN(L2, '.5'), line2: BASE + LN(LS1) + LN(L2, '.5'), line3: BASE + LN(LP1) + LN(LS1.replace('M3 11', 'M3 13'), '.5'),
    line1m: BASE + LN(L1) + LN(L2, '.5') + DOTS(L1P) + DOTS(L2P, '.5'),
    line2m: BASE + LN(LS1) + LN(L2, '.5') + DOTS(LS1P) + DOTS(L2P, '.5'),
    line3m: BASE + LN(LP1) + LN(LS1.replace('M3 11', 'M3 13'), '.5') + DOTS(LP1P) + DOTS(LS1P.map(([x, y]) => [x, y + 2]), '.5'),
    pie: '<path d="M11 4a8.5 8.5 0 1 0 8.5 8.5H11z"/><path d="M13 2a8.5 8.5 0 0 1 8.5 8.5H13z" opacity=".55"/>',
    ring: '<path d="M11 4a8.5 8.5 0 1 0 8.5 8.5h-4a4.5 4.5 0 1 1-4.5-4.5z"/><path d="M13 2a8.5 8.5 0 0 1 8.5 8.5h-4A4.5 4.5 0 0 0 13 6z" opacity=".55"/>',
    area1: BASE + '<path d="M3 20.5V10l5-4 5 5 4-3 4 3v9.5z" opacity=".45"/><path d="M3 20.5v-5l5-3 4 3 5-4 4 2v7z"/>',
    area2: BASE + '<path d="M3 20.5V14l5-3 4 2 5-4 4 2v9.5z"/><path d="M3 14V8l5-4 4 3 5-3 4 2v5l-4-2-5 4-4-2-5 3z" opacity=".45"/>',
    area3: BASE + '<path d="M3 20.5V12l5-2 4 3 5-4 4 2v9.5z"/><path d="M3 3h18v8l-4-2-5 4-4-3-5 2z" opacity=".45"/>',
    sc: XYAX + DOTS([[7, 16], [9.5, 12], [12, 14.5], [14.5, 8.5], [17, 11], [19, 5.5]]),
    scSm: XYAX + LN(CURVE) + DOTS(CURVEP), scS: XYAX + LN(CURVE), scLm: XYAX + LN(POLY) + DOTS(POLYP), scL: XYAX + LN(POLY),
    bub: XYAX + '<circle cx="8.5" cy="14" r="4"/><circle cx="15" cy="8.5" r="3.2" opacity=".5"/><circle cx="17.5" cy="16.5" r="2"/>',
    rad: PENT + LN(RAD), radM: PENT + LN(RAD) + DOTS(RADP), radF: PENT + `<path d="${RAD}" opacity=".85"/>`,
    combo1: BASE + R(4, 12, 4, 8.5, '.5') + R(10, 9, 4, 11.5, '.5') + R(16, 13, 4, 7.5, '.5') + LN('M4 9l6-4 6 3 5-5'),
    combo2: BASE + R(4, 12, 4, 8.5, '.5') + R(10, 9, 4, 11.5, '.5') + R(15, 13, 4, 7.5, '.5') + LN('M4 9l6-4 5 3 4-4') + '<path d="M21.5 3v17.5M20.5 6h1M20.5 11h1M20.5 16h1" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/>',
    combo3: BASE + '<path d="M3 20.5V12l6-3 6 2 6-4v13.5z" opacity=".35"/>' + R(5, 13, 3.5, 7.5) + R(11, 10, 3.5, 10.5) + R(17, 14, 3.5, 6.5),
  };
  const K = (id, cat, kind, sub, name, icon, opt) => Object.assign({ id, cat, kind, sub, name, icon: ic(IC[icon]) }, opt ? { opt } : {});
  C.KINDS = [
    K('colClustered', 'column', 'column', 'clustered', 'Gegroepeerde kolom', 'col1'),
    K('colStacked', 'column', 'column', 'stacked', 'Gestapelde kolom', 'col2'),
    K('colPercent', 'column', 'column', 'percent', '100% gestapelde kolom', 'col3'),
    K('line', 'line', 'line', 'clustered', 'Lijn', 'line1', { marker: 'none' }),
    K('lineStacked', 'line', 'line', 'stacked', 'Gestapelde lijn', 'line2', { marker: 'none' }),
    K('linePercent', 'line', 'line', 'percent', '100% gestapelde lijn', 'line3', { marker: 'none' }),
    K('lineMarkers', 'line', 'line', 'clustered', 'Lijn met markeringen', 'line1m', { marker: 'circle' }),
    K('lineStackedMarkers', 'line', 'line', 'stacked', 'Gestapelde lijn met markeringen', 'line2m', { marker: 'circle' }),
    K('linePercentMarkers', 'line', 'line', 'percent', '100% gestapelde lijn met markeringen', 'line3m', { marker: 'circle' }),
    K('pie', 'pie', 'pie', undefined, 'Cirkel', 'pie'),
    K('doughnut', 'pie', 'doughnut', undefined, 'Ring', 'ring'),
    K('barClustered', 'bar', 'bar', 'clustered', 'Gegroepeerde staaf', 'bar1'),
    K('barStacked', 'bar', 'bar', 'stacked', 'Gestapelde staaf', 'bar2'),
    K('barPercent', 'bar', 'bar', 'percent', '100% gestapelde staaf', 'bar3'),
    K('area', 'area', 'area', 'clustered', 'Vlak', 'area1'),
    K('areaStacked', 'area', 'area', 'stacked', 'Gestapeld vlak', 'area2'),
    K('areaPercent', 'area', 'area', 'percent', '100% gestapeld vlak', 'area3'),
    K('scatter', 'scatter', 'scatter', 'markers', 'Spreiding', 'sc'),
    K('scatterSmoothMarkers', 'scatter', 'scatter', 'smoothMarkers', 'Spreiding met vloeiende lijnen en markeringen', 'scSm'),
    K('scatterSmooth', 'scatter', 'scatter', 'smooth', 'Spreiding met vloeiende lijnen', 'scS'),
    K('scatterLinesMarkers', 'scatter', 'scatter', 'linesMarkers', 'Spreiding met rechte lijnen en markeringen', 'scLm'),
    K('scatterLines', 'scatter', 'scatter', 'lines', 'Spreiding met rechte lijnen', 'scL'),
    K('bubble', 'scatter', 'bubble', undefined, 'Bellen', 'bub'),
    K('radar', 'radar', 'radar', 'plain', 'Radar', 'rad'),
    K('radarMarkers', 'radar', 'radar', 'markers', 'Radar met markeringen', 'radM'),
    K('radarFilled', 'radar', 'radar', 'filled', 'Gevulde radar', 'radF'),
    K('comboColLine', 'combo', 'combo', 'colLine', 'Combinatie: kolom en lijn', 'combo1'),
    K('comboColLine2', 'combo', 'combo', 'colLine2', 'Combinatie: kolom en lijn op secundaire as', 'combo2'),
    K('comboAreaCol', 'combo', 'combo', 'areaCol', 'Combinatie: vlak en kolom', 'combo3'),
  ];
  const BY_ID = {};
  C.KINDS.forEach((k) => { BY_ID[k.id] = k; });
  C.CATS = [['column', 'Kolom'], ['line', 'Lijn'], ['pie', 'Cirkel'], ['bar', 'Staaf'], ['area', 'Vlak'], ['scatter', 'Spreiding (X, Y)'], ['radar', 'Radar'], ['combo', 'Combinatie']]
    .map(([id, name]) => ({ id, name, icon: C.KINDS.find((k) => k.cat === id).icon }));
  // keuzelijsten voor opmaakvensters
  C.DEFAULTS = { gap: 150, overlap: 0, hole: 50, firstAng: 0, legend: 'b', style: 1, palette: 'theme', fontSize: 12 };
  C.TRENDS = TRENDS.map((type) => ({ type, name: TREND_NAME[type] }));
  C.STYLES = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, name: `Stijl ${id}` }));
  C.PALETTES = [{ id: 'theme', name: 'Kleurrijk palet 1' }, { id: 'colorful2', name: 'Kleurrijk palet 2' }, { id: 'colorful3', name: 'Kleurrijk palet 3' }, { id: 'colorful4', name: 'Kleurrijk palet 4' }]
    .concat([1, 2, 3, 4, 5, 6].map((k) => ({ id: 'mono' + k, name: `Monochroom palet ${k}` })));
  C.FORMATS = [['General', 'Standaard'], ['0', 'Getal'], ['0.0', 'Getal, 1 decimaal'], ['0.00', 'Getal, 2 decimalen'], ['#,##0', 'Getal met scheidingsteken'], ['#,##0.00', 'Getal met scheidingsteken, 2 decimalen'],
    ['0%', 'Percentage'], ['0.0%', 'Percentage, 1 decimaal'], ['€ #,##0', 'Valuta (€)'], ['€ #,##0.00', 'Valuta (€), 2 decimalen'], ['$#,##0', 'Valuta ($)'], ['0.00E+00', 'Wetenschappelijk']].map(([code, name]) => ({ code, name }));
  C.textWidth = (s, px) => tw(str(s), isNum(px) ? px : 16);   // geschatte tekstbreedte in px (Inter), ook voor de app bruikbaar
  C.paletteColors = (id, ctx, n = 6) => { const f = palFn(id, basePal(ctx)); return Array.from({ length: Math.max(0, n | 0) }, (_, i) => f(i, n)); };
  C.seriesColors = (chart, ctx) => {   // kleur per reeks (cirkel/ring: per punt), zoals getekend
    const ch = normChart(chart), X = mkCtx(obj(ctx), ch), nS = ch.series.length;
    if (isPie(ch)) { const s = ch.series[0], n = s ? Math.max(ch.cats.length, s.vals.length) : 0; return s ? Array.from({ length: n }, (_, j) => pColor(s, j, X, nS, n, true)) : []; }
    return ch.series.map((s) => sColor(s, X, nS));
  };
  /* ---------- Voorbeeldgegevens en van soort wisselen ---------- */
  const entryOf = (kind, sub, opt) => {   // (soort, variant) of een KINDS-item of -id → { kind, sub, opt }
    const e = kind && typeof kind === 'object' ? kind : typeof kind === 'string' && BY_ID[kind] && !KIND_SET.has(kind) ? BY_ID[kind] : null;
    if (e) return { kind: KIND_SET.has(e.kind) ? e.kind : 'column', sub: normSub(e.kind, e.sub), opt: Object.assign({}, e.opt, opt) };
    const k = KIND_SET.has(kind) ? kind : 'column';
    return { kind: k, sub: normSub(k, sub), opt: Object.assign({}, opt) };
  };
  const applyOpt = (series, kind, sub, opt) => {
    series.forEach((s, i) => {
      if (kind === 'combo') {   // kolommen en een lijn (eventueel op de secundaire as), of vlakken met kolommen
        const last = i === series.length - 1 && series.length > 1;
        s.kind = sub === 'areaCol' ? (last ? 'column' : 'area') : last ? 'line' : 'column';
        if (sub === 'colLine2' && last) s.axis = 2; else delete s.axis;
      }
      if (kind === 'line' && opt.marker) s.marker = opt.marker;
      if (kind === 'scatter' || kind === 'radar') { delete s.marker; delete s.smooth; }
      if (opt.smooth !== undefined) s.smooth = !!opt.smooth;
    });
  };
  C.sample = (kind, sub, opt) => {
    const e = entryOf(kind, sub, opt), k = e.kind;
    const ser = (n, vals) => ({ name: T(`Reeks ${n}`), vals });
    const cats = (n) => Array.from({ length: n }, (_, j) => T(`Categorie ${j + 1}`));
    let ch;
    if (k === 'pie' || k === 'doughnut') ch = { cats: ['1e kwartaal', '2e kwartaal', '3e kwartaal', '4e kwartaal'].map(T), series: [{ name: T('Verkoop'), vals: [8.2, 3.2, 1.4, 1.2] }] };
    else if (k === 'scatter') ch = { cats: [], series: [{ name: T('Y-waarden'), xs: [0.7, 1.8, 2.6, 3.4, 4.1, 5.2], vals: [2.7, 3.2, 0.8, 3.9, 3.1, 4.6] }] };
    else if (k === 'bubble') ch = { cats: [], series: [{ name: T('Y-waarden'), xs: [0.7, 1.8, 2.6, 3.6], vals: [2.7, 3.2, 0.8, 2.2], sizes: [10, 4, 8, 6] }] };
    else if (k === 'radar' || k === 'area') ch = { cats: cats(5), series: [ser(1, [32, 32, 28, 12, 15]), ser(2, [12, 12, 12, 21, 28])] };
    else ch = { cats: cats(4), series: [ser(1, [4.3, 2.5, 3.5, 4.5]), ser(2, [2.4, 4.4, 1.8, 2.8]), ser(3, k === 'combo' && e.sub === 'colLine2' ? [14, 19, 32, 45] : [2, 2, 3, 5])] };
    applyOpt(ch.series, k, e.sub, e.opt);
    const out = Object.assign({ kind: k }, e.sub === undefined ? {} : { sub: e.sub }, ch, { title: { on: true, text: '' }, legend: 'b' });
    return out;
  };
  C.convert = (chart, kind, sub, opt) => {   // andere soort, zelfde gegevens en opties
    const e = entryOf(kind, sub, opt), old = clone(obj(chart)), ch = Object.assign(old, { kind: e.kind });
    if (e.sub === undefined) delete ch.sub; else ch.sub = e.sub;
    const S = (ch.series = arr(ch.series).filter((s) => s && typeof s === 'object'));
    const fromXY = chart && (chart.kind === 'scatter' || chart.kind === 'bubble'), toXY = e.kind === 'scatter' || e.kind === 'bubble';
    if (toXY && !fromXY) {   // categorieën worden x-waarden als het getallen zijn, anders 1, 2, 3 …
      const nums = arr(ch.cats).map((c) => num(c)), n = Math.max(0, ...S.map((s) => arr(s.vals).length));
      const xs = nums.length && nums.every((v) => v !== null) ? nums : Array.from({ length: n }, (_, i) => i + 1);
      S.forEach((s) => { s.xs = xs.slice(); });
    }
    if (fromXY && !toXY && S[0] && Array.isArray(S[0].xs)) ch.cats = S[0].xs.map((x) => (x == null ? '' : C.fmt(x, 'General', uiLang())));
    if (e.kind === 'bubble') S.forEach((s) => { if (!Array.isArray(s.sizes)) s.sizes = arr(s.vals).map((v) => (isNum(v) && v !== 0 ? Math.abs(v) : 1)); });
    if (e.kind !== 'combo') S.forEach((s) => { delete s.kind; });
    if (!['column', 'line', 'area', 'combo'].includes(e.kind)) S.forEach((s) => { delete s.axis; });
    applyOpt(S, e.kind, e.sub, e.opt);
    return ch;
  };
  C.kindOf = (chart) => {   // het KINDS-item dat bij een grafiek hoort (voor 'Ander grafiektype')
    const ch = obj(chart), k = KIND_SET.has(ch.kind) ? ch.kind : 'column', sub = normSub(k, ch.sub);
    if (k === 'line') { const m = arr(ch.series).some((s) => s && s.marker && s.marker !== 'none'); return C.KINDS.find((e) => e.kind === 'line' && e.sub === sub && (e.opt.marker !== 'none') === m); }
    return C.KINDS.find((e) => e.kind === k && e.sub === sub) || C.KINDS.find((e) => e.kind === k) || null;
  };

  /* ---------- Gegevens als tabel (voor de gegevenseditor) ---------- */
  C.toTable = (chart) => {
    const ch = obj(chart), S = arr(ch.series).filter((s) => s && typeof s === 'object'), cats = arr(ch.cats), nm = (s) => (s.name == null ? '' : String(s.name));
    const cell = (v) => (isNum(v) ? v : null);
    if (ch.kind === 'scatter' || ch.kind === 'bubble') {   // eerste kolom x-waarden; bellen: per reeks y en grootte
      const bub = ch.kind === 'bubble', head = [T('X-waarden')];
      S.forEach((s) => { head.push(nm(s)); if (bub) head.push(T('Grootte')); });
      const xs = S[0] && Array.isArray(S[0].xs) ? S[0].xs : null, n = Math.max(0, ...S.map((s) => Math.max(arr(s.vals).length, arr(s.xs).length, bub ? arr(s.sizes).length : 0)));
      const rows = [head];
      for (let j = 0; j < n; j++) { const r = [xs ? cell(xs[j]) : j + 1]; S.forEach((s) => { r.push(cell(arr(s.vals)[j])); if (bub) r.push(cell(arr(s.sizes)[j])); }); rows.push(r); }
      return rows;
    }
    const n = Math.max(cats.length, 0, ...S.map((s) => arr(s.vals).length)), rows = [[''].concat(S.map(nm))];
    for (let j = 0; j < n; j++) rows.push([cats[j] == null ? '' : String(cats[j])].concat(S.map((s) => cell(arr(s.vals)[j]))));
    return rows;
  };
  C.fromTable = (rows, chart) => {
    const base = clone(obj(chart)), kind = KIND_SET.has(base.kind) ? base.kind : 'column', xy = kind === 'scatter' || kind === 'bubble', bub = kind === 'bubble';
    const R0 = arr(rows).map((r) => (Array.isArray(r) ? r : [])), empty = (v) => v == null || (typeof v === 'string' && !v.trim());
    let nr = R0.length, nc = Math.max(0, ...R0.map((r) => r.length));
    while (nr > 1 && R0[nr - 1].every(empty)) nr--;   // lege rijen en kolommen aan het eind weglaten
    while (nc > 1 && R0.slice(0, nr).every((r) => empty(r[nc - 1]))) nc--;
    const head = R0[0] || [], body = R0.slice(1, nr), old = arr(base.series).filter((s) => s && typeof s === 'object');
    const toNum = (v) => (isNum(v) ? clamp(v, -1e300, 1e300) : typeof v === 'string' ? parseNum(v, uiLang()) : null);
    const name = (v, i) => (empty(v) ? T(`Reeks ${i + 1}`) : String(v).trim());
    const keep = (i) => {   // opties van de reeks blijven; nieuwe reeksen nemen soort, as en markering over van de laatste
      const o = old[i] ? Object.assign({}, old[i]) : old.length ? (({ kind: k, axis, marker, smooth, labels }) => JSON.parse(JSON.stringify({ kind: k, axis, marker, smooth, labels })))(old[old.length - 1]) : {};
      delete o.vals; delete o.xs; delete o.sizes;
      return o;
    };
    const series = [];
    if (xy) {
      const xs = body.map((r) => toNum(r[0]));
      for (let c = 1, i = 0; c < nc; c += bub ? 2 : 1, i++) {
        const s = Object.assign(keep(i), { name: name(head[c], i), xs: xs.slice(), vals: body.map((r) => toNum(r[c])) });
        if (bub) s.sizes = body.map((r) => toNum(r[c + 1]));
        series.push(s);
      }
      base.cats = [];
    } else {
      base.cats = body.map((r) => (empty(r[0]) ? '' : isNum(r[0]) ? C.fmt(r[0], 'General', uiLang()) : String(r[0]).trim()));
      for (let c = 1; c < nc; c++) series.push(Object.assign(keep(c - 1), { name: name(head[c], c - 1), vals: body.map((r) => toNum(r[c])) }));
    }
    base.kind = kind;
    base.series = series;
    return base;
  };
  /* ---------- Grafiekgegevens bewerken: dialoogvenster met een klein rekenblad ---------- */
  const CSS = `.pd-cd{display:flex;flex-direction:column;gap:10px}
.pd-cd-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pd-cd-bar .btn .i{font-size:17px}
.pd-cd-main{display:flex;gap:16px;align-items:flex-start}
.pd-cd-wrap{flex:1;min-width:0;max-height:min(56vh,440px);overflow:auto;border:1px solid var(--line-strong,#c4c4c4);border-radius:4px}
.pd-cd-grid{width:auto;border-collapse:separate;border-spacing:0}
.pd-cd-grid th,.pd-cd-grid td{border:0;border-right:1px solid var(--line,#e0e0e0);border-bottom:1px solid var(--line,#e0e0e0);padding:0}
.pd-cd-grid th{background:var(--hover,#f0f0f0);color:var(--muted,#616161);font-weight:400;font-size:11px;text-align:center}
.pd-cd-grid thead th{position:sticky;top:0;z-index:2;height:22px}
.pd-cd-grid tbody th{position:sticky;left:0;z-index:1;min-width:34px}
.pd-cd-grid thead th:first-child{left:0;z-index:3}
.pd-cd-grid th.on{background:var(--accent-soft,#e2f1e8);color:var(--accent,#107c41);font-weight:600}
.pd-cd-grid input{width:104px;min-width:104px;border:0;background:var(--panel,#fff);color:var(--text,#242424);padding:5px 7px;outline:none;font:inherit;font-size:12.5px}
.pd-cd-grid input:focus{box-shadow:inset 0 0 0 2px var(--accent,#107c41)}
.pd-cd-grid td.num input{text-align:right;font-variant-numeric:tabular-nums}
.pd-cd-grid tr.hd input,.pd-cd-grid td.c0 input{font-weight:600}
.pd-cd-grid input[readonly]{background:var(--hover,#f0f0f0);color:var(--muted,#616161);font-weight:400}
.pd-cd-grid input.sw{box-shadow:inset 0 3px 0 var(--sw)}
.pd-cd-grid input.sw:focus{box-shadow:inset 0 0 0 2px var(--accent,#107c41),inset 0 5px 0 var(--sw)}
.pd-cd-grid input.bad{color:#c50f1f;text-decoration:underline wavy #c50f1f}
.pd-cd-side{flex:0 0 362px;display:flex;flex-direction:column;gap:8px}
.pd-cd-prev{width:362px;height:222px;border:1px solid var(--line,#e0e0e0);border-radius:4px;overflow:hidden;background:#fff}
.pd-cd-prev svg{display:block}
.pd-cd-hint{margin:0;line-height:1.45}
@media (max-width:880px){.pd-cd-main{flex-direction:column}.pd-cd-side{flex-basis:auto}}`;
  const parseTsv = (t) => {   // tabgescheiden tekst uit Excel, Google Spreadsheets of Cel (cellen eventueel tussen aanhalingstekens)
    t = String(t || '').replace(/\r\n?/g, '\n');
    if (t.endsWith('\n')) t = t.slice(0, -1);
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell === '') q = true;
      else if (c === '\t') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); rows.push(row);
    return rows;
  };
  C.parseTsv = parseTsv;
  const colName = (c) => { let s = ''; for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };
  C.getCtx = null;   // de app kan hier een functie zetten die de omgeving (thema) voor het voorbeeld geeft
  C.editData = (chart, apply, ctx) => {
    if (typeof document === 'undefined' || typeof App.dialog !== 'function') return null;
    if (!document.getElementById('pd-charts-css')) { const st = document.createElement('style'); st.id = 'pd-charts-css'; st.textContent = CSS; document.head.appendChild(st); }
    const base = clone(chart && typeof chart === 'object' ? chart : C.sample('column'));
    const xy = base.kind === 'scatter' || base.kind === 'bubble', bub = base.kind === 'bubble', pie = base.kind === 'pie' || base.kind === 'doughnut', loc = uiLang();
    let pctx = obj(ctx || (typeof C.getCtx === 'function' ? C.getCtx() : null) || { palette: DEF_PAL, font: 'Inter', text: '#404040', grid: '#d9d9d9', axis: '#bfbfbf', bg: '#ffffff', locale: loc });
    pctx = Object.assign({}, pctx, { scale: (isNum(pctx.scale) ? pctx.scale : 1) * 0.72 });
    const G = C.toTable(base).map((r) => r.map((v) => (v == null ? '' : isNum(v) ? String(v).replace('.', LOC[loc].dec) : String(v))));
    const width = () => Math.max(2, ...G.map((r) => r.length));
    const fill = () => { const w = width(); G.forEach((r) => { while (r.length < w) r.push(''); }); while (G.length < 2) G.push(new Array(w).fill('')); };
    const make = () => C.fromTable(G, base);
    const fixed = (r, c) => (r === 0 && c === 0) || (bub && r === 0 && c > 0 && c % 2 === 0);   // vaste kopjes
    const isNumCell = (r, c) => r > 0 && (c > 0 || xy);
    const bad = (r, c) => isNumCell(r, c) && G[r][c].trim() !== '' && parseNum(G[r][c], loc) === null;
    let cur = { r: 1, c: 1 }, raf = 0, dlg = null;
    const body = document.createElement('div');
    body.className = 'pd-cd';
    const B = (a, icon, label, title) => `<button type="button" class="btn small" data-a="${a}" title="${esc(T(title))}"><span class="i">${icon}</span>${esc(T(label))}</button>`;
    const hint = xy ? (bub ? 'Kolom A bevat de x-waarden; daarna heeft elke reeks een kolom y-waarden en een kolom grootte.' : 'Kolom A bevat de x-waarden; elke volgende kolom is een reeks y-waarden.') : 'Rij 1 bevat de namen van de reeksen en kolom A de categorieën.';
    body.innerHTML = `<div class="pd-cd-bar">${B('row+', 'add_row_below', 'Rij invoegen', 'Lege rij invoegen onder de huidige rij')}${B('row-', 'delete', 'Rij verwijderen', 'Huidige rij verwijderen')}`
      + `${B('col+', 'add_column_right', 'Reeks invoegen', 'Nieuwe reeks invoegen rechts van de huidige kolom')}${B('col-', 'delete', 'Reeks verwijderen', 'Huidige reeks verwijderen')}`
      + `${xy ? '' : B('swap', 'swap_horiz', 'Rijen en kolommen wisselen', 'Reeksen worden categorieën en omgekeerd')}</div>`
      + `<div class="pd-cd-main"><div class="pd-cd-wrap"><table class="data-table pd-cd-grid"></table></div><div class="pd-cd-side"><div class="pd-cd-prev notranslate" translate="no"></div>`
      + `<p class="muted small pd-cd-hint">${esc(T(hint))} ${esc(T('Plak gegevens uit Excel, Google Spreadsheets of Cel met Ctrl+V. Lege cellen en cellen zonder getal worden overgeslagen.'))}</p></div></div>`;
    const tbl = body.querySelector('table'), prev = body.querySelector('.pd-cd-prev');
    prev.style.background = okColor(pctx.bg) ? pctx.bg : '#ffffff';
    const build = () => {
      fill();
      const w = width(), cols = pie ? [] : C.seriesColors(make(), pctx);
      const swOf = (c) => (c < 1 ? null : bub ? (c % 2 ? cols[(c - 1) / 2] : null) : cols[c - 1]);
      let h = '<thead><tr><th></th>';
      for (let c = 0; c < w; c++) h += `<th data-hc="${c}">${colName(c)}</th>`;
      h += '</tr></thead><tbody>';
      G.forEach((row, r) => {
        h += `<tr${r ? '' : ' class="hd"'}><th data-hr="${r}">${r + 1}</th>`;
        row.forEach((v, c) => {
          const sw = r === 0 ? swOf(c) : null, cls = [bad(r, c) ? 'bad' : '', sw ? 'sw' : ''].filter(Boolean).join(' ');
          h += `<td class="${isNumCell(r, c) ? 'num' : ''}${c === 0 ? ' c0' : ''}"><input data-r="${r}" data-c="${c}" value="${esc(v)}"${cls ? ` class="${cls}"` : ''}${sw ? ` style="--sw:${esc(sw)}"` : ''}`
            + `${fixed(r, c) ? ' readonly tabindex="-1"' : ''}${r === 1 && c === 1 && !dlg ? ' autofocus' : ''} spellcheck="false" autocomplete="off" aria-label="${colName(c)}${r + 1}"></td>`;
        });
        h += '</tr>';
      });
      tbl.innerHTML = h + '</tbody>';
    };
    const mark = () => {
      tbl.querySelectorAll('th.on').forEach((t) => t.classList.remove('on'));
      [`th[data-hr="${cur.r}"]`, `th[data-hc="${cur.c}"]`].forEach((q) => { const t = tbl.querySelector(q); if (t) t.classList.add('on'); });
    };
    const go = (r, c) => {
      r = clamp(r, 0, G.length - 1); c = clamp(c, 0, width() - 1);
      if (r === 0 && c === 0) c = 1;
      const el = tbl.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
      if (el) { el.focus(); el.select(); }
    };
    const preview = () => {
      if (raf) return;
      raf = (window.requestAnimationFrame || setTimeout)(() => { raf = 0; prev.innerHTML = C.render(make(), 360, 220, pctx); });
    };
    const addRowAfter = (r) => { G.splice(r + 1, 0, new Array(width()).fill('')); build(); };
    const act = (a) => {
      const w = width(), { r, c } = cur;
      if (a === 'row+') { const at = Math.max(1, r + 1); addRowAfter(at - 1); go(at, 0); }
      else if (a === 'row-') { if (G.length > 2 && r >= 1) { G.splice(r, 1); build(); go(Math.min(r, G.length - 1), c); } }
      else if (a === 'col+') {
        const at = Math.min(w, bub ? (c >= 1 ? 1 + 2 * (Math.floor((c - 1) / 2) + 1) : w) : Math.max(1, c + 1));
        G.forEach((row, i) => row.splice(at, 0, ...(bub ? ['', i ? '' : T('Grootte')] : [''])));
        build(); go(0, at);
      } else if (a === 'col-') {
        const k = bub ? 2 : 1, at = bub ? 1 + 2 * Math.floor((Math.max(1, c) - 1) / 2) : c;
        if (w - 1 > k && c >= 1) { G.forEach((row) => row.splice(at, k)); build(); go(r, Math.min(at, width() - 1)); }
      } else if (a === 'swap' && !xy) {
        const t = Array.from({ length: w }, (_, j) => G.map((row) => row[j] ?? ''));
        G.length = 0; t.forEach((row) => G.push(row)); build(); go(1, 1);
      }
      preview();
    };
    tbl.addEventListener('focusin', (e) => { const el = e.target.closest('input'); if (el) { cur = { r: +el.dataset.r, c: +el.dataset.c }; mark(); } });
    tbl.addEventListener('input', (e) => {
      const el = e.target.closest('input');
      if (!el) return;
      const r = +el.dataset.r, c = +el.dataset.c;
      G[r][c] = el.value;
      el.classList.toggle('bad', bad(r, c));
      preview();
    });
    tbl.addEventListener('keydown', (e) => {   // Tab/Enter/pijltjes zoals in een rekenblad; Ctrl+Enter = OK
      const el = e.target.closest('input');
      if (!el) return;
      const r = +el.dataset.r, c = +el.dataset.c, k = e.key, n = el.value.length, s0 = el.selectionStart, s1 = el.selectionEnd, w = width();
      const all = s0 === 0 && s1 === n, more = () => { if (r === G.length - 1 && G[r].some((v) => v.trim())) addRowAfter(r); };
      if (k === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (dlg && dlg.primary) dlg.primary.click(); }
      else if (k === 'Enter') { e.preventDefault(); if (e.shiftKey) go(r - 1, c); else { more(); go(r + 1, c); } }
      else if (k === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) { if (c > 0 && !(r === 0 && c === 1)) go(r, c - 1); else if (r > 0) go(r - 1, w - 1); }
        else if (c < w - 1) go(r, c + 1); else { more(); go(r + 1, 0); }
      } else if (k === 'ArrowUp') { e.preventDefault(); go(r - 1, c); }
      else if (k === 'ArrowDown') { e.preventDefault(); go(r + 1, c); }
      else if (k === 'ArrowLeft' && (all || (s0 === 0 && s1 === 0))) { e.preventDefault(); go(r, c - 1); }
      else if (k === 'ArrowRight' && (all || (s0 === n && s1 === n))) { e.preventDefault(); go(r, c + 1); }
    });
    tbl.addEventListener('paste', (e) => {   // blok uit een rekenblad plakken vanaf de huidige cel; het raster groeit mee
      const el = e.target.closest('input');
      if (!el) return;
      const block = parseTsv((e.clipboardData && e.clipboardData.getData('text/plain')) || '');
      if (block.length < 2 && block[0].length < 2) return;   // één waarde: gewoon plakken
      e.preventDefault();
      const r0 = +el.dataset.r, c0 = +el.dataset.c;
      block.forEach((row, i) => row.forEach((v, j) => {
        const r = r0 + i, c = c0 + j;
        while (G.length <= r) G.push([]);
        while (G[r].length <= c) G[r].push('');
        if (!fixed(r, c)) G[r][c] = v.trim();
      }));
      build(); go(r0, c0); preview();
    });
    body.querySelector('.pd-cd-bar').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
    build();
    dlg = App.dialog({
      title: T('Grafiekgegevens bewerken'), xwide: true, noEnter: true, body,
      buttons: [{ label: T('Annuleren') }, { label: T('OK'), primary: true, action: () => { if (typeof apply === 'function') apply(make()); } }],
    });
    preview();
    return dlg;
  };
})();
