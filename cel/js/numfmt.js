/* =========================================================
   Cel (gemaakt door JJ van Schelven) — getalnotaties (Excel-notatiecodes) en invoer herkennen
   Notatiecodes worden bewaard zoals in Excel (punt = decimaal, komma = duizendtal)
   en getoond met Nederlandse scheidingstekens.
   ========================================================= */
'use strict';

App.NF = (() => {
  // Scheidingstekens en namen volgen de taal van de interface (App.LOCALE, zie i18n.js)
  const NL = { dec: ',', thou: '.', months: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'], monthsS: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'], days: ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'], daysS: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], bool: ['WAAR', 'ONWAAR'], dateFmt: 'd-m-yyyy', dateShortNoYear: 'd-mmm', dateMonthText: 'd-mmm-yy', dateLongText: 'd mmmm yyyy', dateTime: 'd-m-yyyy h:mm', mdy: false, errNl: true };
  const EN = { dec: '.', thou: ',', months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], monthsS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], daysS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], bool: ['TRUE', 'FALSE'], dateFmt: 'm/d/yyyy', dateShortNoYear: 'd-mmm', dateMonthText: 'd-mmm-yy', dateLongText: 'mmmm d, yyyy', dateTime: 'm/d/yyyy h:mm', mdy: true, errNl: false };
  let DEC = ',', THOU = '.', MONTHS = NL.months, MONTHS_S = NL.monthsS, DAYS = NL.days, DAYS_S = NL.daysS, LOC = NL;
  const sync = () => {
    const l = App.LANG === 'en' ? EN : NL;
    if (l === LOC && DEC === l.dec) return;
    LOC = l; DEC = l.dec; THOU = l.thou; MONTHS = l.months; MONTHS_S = l.monthsS; DAYS = l.days; DAYS_S = l.daysS;
    Object.assign(PRESETS, l.mdy ? { shortDate: 'm/d/yyyy', longDate: 'dddd, mmmm d, yyyy' } : { shortDate: 'd-m-yyyy', longDate: 'dddd d mmmm yyyy' });
    const dateCat = CATEGORIES.find((c) => c[0] === 'date');
    dateCat[2] = l.mdy ? ['m/d/yyyy', 'mm/dd/yyyy', 'm/d/yy', 'd-mmm', 'd-mmm-yy', 'mmmm d, yyyy', 'dddd, mmmm d, yyyy', 'mmm-yy', 'mmmm yyyy', 'yyyy-mm-dd', 'm/d/yyyy h:mm'] : ['d-m-yyyy', 'dd-mm-yyyy', 'd-m-yy', 'd-mmm', 'd-mmm-yy', 'd mmmm yyyy', 'dddd d mmmm yyyy', 'mmm-yy', 'mmmm yyyy', 'yyyy-mm-dd', 'd-m-yyyy h:mm'];
    cache.clear();
  };
  const COLORS = { black: '#000000', zwart: '#000000', red: '#ff0000', rood: '#ff0000', green: '#00a000', groen: '#00a000', blue: '#0000ff', blauw: '#0000ff', yellow: '#ffff00', geel: '#ffff00', magenta: '#ff00ff', cyan: '#00ffff', white: '#ffffff', wit: '#ffffff' };
  const ERR_NL = { '#DIV/0!': '#DEEL/0!', '#N/A': '#N/B', '#VALUE!': '#WAARDE!', '#REF!': '#VERW!', '#NAME?': '#NAAM?', '#NUM!': '#GETAL!', '#NULL!': '#LEEG!', '#SPILL!': '#OVERLOOP!', '#CALC!': '#BEREKENING!' };

  /* Datums: Excel-serienummers (1900-systeem) */
  const EPOCH = Date.UTC(1899, 11, 30);
  const serialToDate = (n) => new Date(EPOCH + Math.round(n * 86400000));
  const dateToSerial = (y, m, d, h = 0, mi = 0, s = 0) => (Date.UTC(y, m, d, h, mi, s) - EPOCH) / 86400000;
  const jsToSerial = (dt) => dateToSerial(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds());

  /* Notatiecode opdelen in secties en tokens (met cache) */
  const cache = new Map();
  const splitSections = (fmt) => {
    const out = []; let cur = '', q = false, br = false;
    for (let i = 0; i < fmt.length; i++) {
      const ch = fmt[i];
      if (ch === '"' && !br) q = !q;
      else if (!q && ch === '[') br = true;
      else if (!q && ch === ']') br = false;
      else if (!q && !br && ch === '\\') { cur += ch + (fmt[i + 1] || ''); i++; continue; }
      if (ch === ';' && !q && !br) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const tokenize = (sec) => {
    const t = []; let color = null, cond = null, i = 0, elapsed = false;
    const lit = (s) => { const last = t[t.length - 1]; if (last && last.k === 'lit') last.v += s; else t.push({ k: 'lit', v: s }); };
    while (i < sec.length) {
      const ch = sec[i], rest = sec.slice(i);
      if (ch === '"') { const j = sec.indexOf('"', i + 1); lit(sec.slice(i + 1, j < 0 ? sec.length : j)); i = j < 0 ? sec.length : j + 1; continue; }
      if (ch === '\\') { lit(sec[i + 1] || ''); i += 2; continue; }
      if (ch === '_') { lit(' '); i += 2; continue; }
      if (ch === '*') { i += 2; continue; }
      if (ch === '[') {
        const j = sec.indexOf(']', i); const inner = sec.slice(i + 1, j < 0 ? sec.length : j); i = j < 0 ? sec.length : j + 1;
        const lc = inner.toLowerCase();
        if (COLORS[lc]) color = COLORS[lc];
        else if (/^color\d+$/.test(lc)) color = null;
        else if (/^[<>=]/.test(inner)) { const m = /^([<>]=?|=|<>)(-?[\d.]+)$/.exec(inner); if (m) cond = { op: m[1], v: +m[2] }; }
        else if (/^\$/.test(inner)) lit(inner.slice(1).split('-')[0]);
        else if (/^(h+|m+|s+)$/i.test(inner)) { t.push({ k: 'el', v: lc[0], n: lc.length }); elapsed = true; }
        continue;
      }
      let m;
      if ((m = /^(am\/pm|a\/p)/i.exec(rest))) { t.push({ k: 'ampm', v: m[1] }); i += m[1].length; continue; }
      if ((m = /^[eE][+-]/.exec(rest))) { t.push({ k: 'E', v: m[0][1] }); i += 2; continue; }
      if ((m = /^(y+)/i.exec(rest))) { t.push({ k: 'y', n: m[1].length }); i += m[1].length; continue; }
      if ((m = /^(j+)/.exec(rest))) { t.push({ k: 'y', n: m[1].length }); i += m[1].length; continue; }
      if ((m = /^d+/i.exec(rest))) { t.push({ k: 'd', n: m[0].length }); i += m[0].length; continue; }
      if ((m = /^(h+|u+)/i.exec(rest))) { t.push({ k: 'h', n: m[1].length }); i += m[1].length; continue; }
      if ((m = /^m+/i.exec(rest))) { t.push({ k: 'm', n: m[0].length }); i += m[0].length; continue; }
      if ((m = /^s+/i.exec(rest))) { t.push({ k: 's', n: m[0].length }); i += m[0].length; continue; }
      if (ch === '0' || ch === '#' || ch === '?') { t.push({ k: 'dig', v: ch }); i++; continue; }
      if (ch === '.') { t.push({ k: 'dot' }); i++; continue; }
      if (ch === ',') { t.push({ k: 'comma' }); i++; continue; }
      if (ch === '%') { t.push({ k: 'pct' }); i++; continue; }
      if (ch === '/') { t.push({ k: 'slash' }); i++; continue; }
      if (ch === '@') { t.push({ k: 'at' }); i++; continue; }
      if (/^general|^standaard/i.test(rest)) { t.push({ k: 'gen' }); i += /^general/i.test(rest) ? 7 : 9; continue; }
      lit(ch); i++;
    }
    // m na h of vóór s betekent minuten
    for (let k = 0; k < t.length; k++) {
      if (t[k].k !== 'm' || t[k].n > 2) continue;
      let prev = null, next = null;
      for (let j = k - 1; j >= 0; j--) if (/^(h|s|d|y|el)$/.test(t[j].k)) { prev = t[j]; break; }
      for (let j = k + 1; j < t.length; j++) if (/^(h|s|d|y|el)$/.test(t[j].k)) { next = t[j]; break; }
      if ((prev && (prev.k === 'h' || (prev.k === 'el' && prev.v === 'h'))) || (next && next.k === 's')) t[k].k = 'min';
    }
    const isDate = t.some((x) => /^(y|d|h|min|s|m|ampm|el)$/.test(x.k));
    // seconde-decimalen bij tijden: .0
    return { t, color, cond, isDate, elapsed, isText: t.some((x) => x.k === 'at'), hasGen: t.some((x) => x.k === 'gen') };
  };
  const compile = (fmt) => {
    sync();
    let c = cache.get(fmt);
    if (c) return c;
    const secs = splitSections(fmt || 'General').map(tokenize);
    c = { secs, isDate: secs[0].isDate, isText: secs.length === 1 && secs[0].isText };
    cache.set(fmt, c);
    return c;
  };

  const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, THOU);

  /* Standaardnotatie: maximaal ongeveer 11 tekens */
  const general = (n) => {
    sync();
    if (!isFinite(n)) return LOC.errNl ? '#GETAL!' : '#NUM!';
    if (n === 0) return '0';
    const a = Math.abs(n);
    if (a >= 1e11 || a < 1e-9) {
      let s = n.toExponential(5).replace(/\.?0+e/, 'e');
      const [m, e] = s.split('e');
      const ex = +e;
      return m.replace('.', DEC) + 'E' + (ex < 0 ? '-' : '+') + String(Math.abs(ex)).padStart(2, '0');
    }
    let s = String(+n.toPrecision(10));
    if (/e/.test(s)) s = n.toFixed(10).replace(/\.?0+$/, '');
    if (s.length > 11) {
      const intLen = String(Math.trunc(a)).length + (n < 0 ? 1 : 0);
      const dec = Math.max(0, 10 - intLen);
      s = String(+n.toFixed(dec));
    }
    return s.replace('.', DEC);
  };

  const fmtNumberSection = (val, sec, signed) => {
    const t = sec.t;
    let v = val;
    const pct = t.filter((x) => x.k === 'pct').length;
    v *= 100 ** pct;
    const eIdx = t.findIndex((x) => x.k === 'E');
    const slashIdx = t.findIndex((x) => x.k === 'slash');
    const neg = v < 0 && signed;
    v = Math.abs(v);
    // trailing komma's na de laatste cijferplek: delen door 1000
    let lastDig = -1; t.forEach((x, k) => { if (x.k === 'dig') lastDig = k; });
    let scale = 0;
    for (let k = lastDig + 1; k < t.length && t[k].k === 'comma'; k++) scale++;
    v /= 1000 ** scale;
    if (slashIdx >= 0 && eIdx < 0) return (neg ? '-' : '') + fraction(v, t, slashIdx);
    const dotIdx = t.findIndex((x) => x.k === 'dot');
    const intEnd = dotIdx >= 0 ? dotIdx : eIdx >= 0 ? eIdx : t.length;
    const decTok = dotIdx >= 0 ? t.slice(dotIdx + 1, eIdx >= 0 ? eIdx : t.length).filter((x) => x.k === 'dig') : [];
    const decN = decTok.length;
    let exp = 0;
    if (eIdx >= 0) {
      const intDigs = t.slice(0, intEnd).filter((x) => x.k === 'dig').length || 1;
      if (v !== 0) { exp = Math.floor(Math.log10(v)); exp -= ((exp % intDigs) + intDigs) % intDigs; v /= 10 ** exp; }
      if (+v.toFixed(decN) >= 10 ** intDigs) { v /= 10; exp += 1; }
    }
    const rounded = v.toFixed(decN);
    let [ip, dp = ''] = rounded.split('.');
    const intToks = t.slice(0, intEnd);
    const grouping = intToks.some((x, k) => x.k === 'comma' && intToks.slice(0, k).some((y) => y.k === 'dig') && intToks.slice(k + 1).some((y) => y.k === 'dig'));
    const minInt = intToks.filter((x) => x.k === 'dig' && x.v === '0').length;
    if (ip === '0' && !intToks.some((x) => x.k === 'dig' && x.v === '0')) ip = '';
    if (ip.length < minInt) ip = ip.padStart(minInt, '0');
    // decimalen: # en ? achteraan weglaten/vervangen
    let dArr = dp.split('');
    for (let k = decN - 1; k >= 0; k--) {
      if (dArr[k] !== '0') break;
      if (decTok[k].v === '#') dArr[k] = '';
      else if (decTok[k].v === '?') dArr[k] = ' ';
      else break;
    }
    dp = dArr.join('');
    let out = '';
    const digCount = intToks.filter((x) => x.k === 'dig').length;
    if (grouping || digCount === 0) {
      let placed = false;
      for (const x of intToks) {
        if (x.k === 'dig') { if (!placed) { out += grouping ? group(ip) : ip; placed = true; } }
        else if (x.k === 'lit') out += x.v;
        else if (x.k === 'pct') out += '%';
      }
      if (!placed) out += ip;
    } else {
      // rechts-naar-links invullen (bv. 000-000)
      let digits = ip.split('');
      const parts = [];
      let seen = 0;
      for (let k = intToks.length - 1; k >= 0; k--) {
        const x = intToks[k];
        if (x.k === 'dig') {
          seen++;
          if (seen === digCount) { parts.unshift(digits.join('')); digits = []; }
          else { const d = digits.pop(); parts.unshift(d !== undefined ? d : x.v === '0' ? '0' : x.v === '?' ? ' ' : ''); }
        } else if (x.k === 'lit') parts.unshift(x.v);
        else if (x.k === 'pct') parts.unshift('%');
      }
      out = parts.join('');
    }
    if (dotIdx >= 0) {
      out += dp.length || decN === 0 ? DEC + dp : '';
      if (decN && !dp.replace(/ /g, '').length && !dp.length) out = out.replace(new RegExp('\\' + DEC + '$'), '');
      // tokens na de decimalen (literal, %)
      const after = t.slice(dotIdx + 1, eIdx >= 0 ? eIdx : t.length);
      after.forEach((x) => { if (x.k === 'lit') out += x.v; else if (x.k === 'pct') out += '%'; });
    }
    if (eIdx >= 0) {
      const expDigs = t.slice(eIdx + 1).filter((x) => x.k === 'dig').length || 1;
      out += 'E' + (exp < 0 ? '-' : t[eIdx].v === '+' ? '+' : '') + String(Math.abs(exp)).padStart(expDigs, '0');
      t.slice(eIdx + 1).forEach((x) => { if (x.k === 'lit') out += x.v; });
    }
    if (neg && /[1-9]/.test(out)) out = '-' + out;
    return out;
  };
  const fraction = (v, t, slashIdx) => {
    const denTok = t.slice(slashIdx + 1).filter((x) => x.k === 'dig');
    const fixedDen = (() => { const after = t.slice(slashIdx + 1); const lit = after.find((x) => x.k === 'lit' && /^\d+/.test(x.v)); return lit ? parseInt(lit.v, 10) : 0; })();
    const before = t.slice(0, slashIdx);
    // "# ?/?" : geheel deel + breuk; "?/?" : alleen breuk
    const litSpace = before.findIndex((x) => x.k === 'lit' && /\s/.test(x.v));
    const hasWhole = litSpace > 0 && before.slice(0, litSpace).some((x) => x.k === 'dig');
    let whole = hasWhole ? Math.floor(v) : 0;
    let frac = v - whole;
    const maxDen = fixedDen || 10 ** Math.max(1, denTok.length) - 1;
    let bn = 0, bd = 1, best = Infinity;
    if (fixedDen) { bn = Math.round(frac * fixedDen); bd = fixedDen; } else {
      for (let d = 1; d <= maxDen; d++) { const n = Math.round(frac * d); const e = Math.abs(frac - n / d); if (e < best - 1e-12) { best = e; bn = n; bd = d; } if (e < 1e-9) break; }
    }
    if (bn === bd) { whole += 1; bn = 0; }
    if (!hasWhole && whole === 0 && bn === 0) return '0';
    if (bn === 0) return hasWhole ? String(whole) : '0';
    return (hasWhole && whole ? whole + ' ' : '') + bn + '/' + bd;
  };

  const fmtDateSection = (val, sec) => {
    const t = sec.t;
    if (val < 0 || val > 2958465) return '#'.repeat(8);
    const hasMs = false;
    const dt = serialToDate(val);
    let y = dt.getUTCFullYear(), mo = dt.getUTCMonth(), d = dt.getUTCDate(), wd = dt.getUTCDay();
    let h = dt.getUTCHours(), mi = dt.getUTCMinutes(), s = dt.getUTCSeconds();
    const ampm = t.some((x) => x.k === 'ampm');
    let out = '';
    const p2 = (n) => String(n).padStart(2, '0');
    // decimalen na seconden (s.00)
    for (let k = 0; k < t.length; k++) {
      const x = t[k];
      switch (x.k) {
        case 'lit': out += x.v; break;
        case 'y': out += x.n <= 2 ? p2(y % 100) : String(y); break;
        case 'm': out += x.n === 1 ? mo + 1 : x.n === 2 ? p2(mo + 1) : x.n === 3 ? MONTHS_S[mo] : x.n === 4 ? MONTHS[mo] : MONTHS[mo][0]; break;
        case 'd': out += x.n === 1 ? d : x.n === 2 ? p2(d) : x.n === 3 ? DAYS_S[wd] : DAYS[wd]; break;
        case 'h': { let hh = h; if (ampm) { hh = h % 12; if (hh === 0) hh = 12; } out += x.n >= 2 ? p2(hh) : hh; break; }
        case 'min': out += x.n >= 2 ? p2(mi) : mi; break;
        case 's': {
          out += x.n >= 2 ? p2(s) : s;
          if (t[k + 1] && t[k + 1].k === 'dot') {
            let n = 0, j = k + 2; while (t[j] && t[j].k === 'dig') { n++; j++; }
            const frac = ((val * 86400) % 1).toFixed(n).slice(2);
            out += DEC + frac; k = j - 1;
          }
          break;
        }
        case 'el': {
          const tot = val * (x.v === 'h' ? 24 : x.v === 'm' ? 1440 : 86400);
          out += String(Math.floor(tot + 1e-9)).padStart(x.n, '0');
          break;
        }
        case 'ampm': out += h < 12 ? (x.v.length > 3 ? 'AM' : 'A') : (x.v.length > 3 ? 'PM' : 'P'); break;
        case 'dot': out += DEC; break;
        case 'comma': out += ','; break;
        case 'dig': out += x.v === '#' ? '' : x.v; break;
        case 'slash': out += '/'; break;
        case 'pct': out += '%'; break;
        default: break;
      }
    }
    void hasMs;
    return out;
  };

  /* Afronden van tijden op hele seconden voor weergave */
  const roundTime = (v) => Math.round(v * 86400) / 86400;

  const pickSection = (c, v) => {
    const s = c.secs;
    // voorwaarden
    if (s.some((x) => x.cond)) {
      for (let k = 0; k < Math.min(2, s.length); k++) {
        const cd = s[k].cond; if (!cd) continue;
        const ok = cd.op === '<' ? v < cd.v : cd.op === '<=' ? v <= cd.v : cd.op === '>' ? v > cd.v : cd.op === '>=' ? v >= cd.v : cd.op === '=' ? v === cd.v : v !== cd.v;
        if (ok) return { sec: s[k], signed: false };
      }
      return { sec: s[Math.min(2, s.length - 1)] || s[0], signed: true };
    }
    if (s.length === 1 || (s.length === 2 && s[1].isText) ) return { sec: s[0], signed: true };
    if (v > 0 || (v === 0 && s.length < 3)) return { sec: s[0], signed: true };
    if (v < 0) return { sec: s[1], signed: false };
    return { sec: s[2], signed: true };
  };

  /* Hoofdfunctie: waarde + notatie -> { text, color } */
  const format = (v, fmt) => {
    if (v === null || v === undefined || v === '') return { text: '' };
    sync();
    if (typeof v === 'object' && v.err) return { text: LOC.errNl ? (ERR_NL[v.err] || v.err) : v.err, err: true };
    if (typeof v === 'boolean') return { text: v ? LOC.bool[0] : LOC.bool[1] };
    const c = compile(fmt || 'General');
    if (typeof v === 'string') {
      const ts = c.secs[3] || c.secs.find((x) => x.isText);
      if (!ts) return { text: v };
      let out = '';
      ts.t.forEach((x) => { out += x.k === 'at' ? v : x.k === 'lit' ? x.v : ''; });
      return { text: out, color: ts.color };
    }
    if (typeof v !== 'number' || !isFinite(v)) return { text: String(v) };
    const { sec, signed } = pickSection(c, v);
    if (!sec || sec.hasGen || (!sec.t.some((x) => x.k !== 'lit' && x.k !== 'at') && !sec.t.length)) {
      let txt = general(v);
      if (sec && sec.t.length) { let pre = '', post = '', seen = false; sec.t.forEach((x) => { if (x.k === 'gen') seen = true; else if (x.k === 'lit') { if (seen) post += x.v; else pre += x.v; } }); txt = pre + (signed ? txt : txt.replace(/^-/, '')) + post; }
      return { text: txt, color: sec && sec.color, general: !sec || !sec.t.some((x) => x.k === 'lit') };
    }
    if (sec.isText && !sec.t.some((x) => x.k === 'dig')) return { text: general(v) };
    if (sec.isDate) return { text: fmtDateSection(sec.elapsed ? v : roundTime(v), sec), color: sec.color };
    if (!sec.t.some((x) => x.k === 'dig')) {
      let out = ''; sec.t.forEach((x) => { if (x.k === 'lit') out += x.v; });
      return { text: out, color: sec.color };
    }
    return { text: fmtNumberSection(v, sec, signed), color: sec.color };
  };

  const isDateFmt = (fmt) => !!fmt && compile(fmt).isDate;
  const isTextFmt = (fmt) => !!fmt && compile(fmt).isText;

  /* ---------- Invoer herkennen ---------- */
  const monthIdx = (s) => {
    s = s.toLowerCase().replace(/\.$/, '');
    let i = MONTHS.findIndex((m) => m === s); if (i >= 0) return i;
    i = MONTHS_S.findIndex((m) => m === s); if (i >= 0) return i;
    const en = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    i = en.findIndex((m) => s.startsWith(m)); if (i >= 0) return i;
    i = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'].findIndex((m) => m.startsWith(s) && s.length >= 3);
    if (i >= 0) return i;
    return ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].findIndex((m) => m.startsWith(s) && s.length >= 3);
  };
  const validDate = (y, m, d) => m >= 0 && m < 12 && d >= 1 && d <= new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const year2 = (y) => (y < 100 ? (y < 30 ? 2000 + y : 1900 + y) : y);
  const parseNumberTextRaw = (s) => {
    s = s.replace(/\s/g, '');
    if (LOC.mdy) {
      // Engels: punt als decimaalteken, komma als duizendtal
      let e = /^([-+]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d*))?(?:[eE]([-+]?\d+))?$/.exec(s);   // ook "5." is een getal
      if (e) return { n: parseFloat(e[1] + e[2].replace(/,/g, '') + (e[3] ? '.' + e[3] : '') + (e[4] ? 'e' + e[4] : '')), grouped: e[2].includes(','), dec: e[3] ? e[3].length : 0, sci: !!e[4] };
      e = /^([-+]?)(\d*)\.(\d+)$/.exec(s);
      if (e) return { n: parseFloat(e[1] + (e[2] || '0') + '.' + e[3]), grouped: false, dec: e[3].length };
      return null;
    }
    let m = /^([-+]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d*))?(?:[eE]([-+]?\d+))?$/.exec(s);   // ook "5," is een getal
    if (m) {
      const n = parseFloat(m[1] + m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '') + (m[4] ? 'e' + m[4] : ''));
      return { n, grouped: m[2].includes('.'), dec: m[3] ? m[3].length : 0, sci: !!m[4] };
    }
    m = /^([-+]?)(\d*)\.(\d+)$/.exec(s);   // Engelse decimaalpunt (1.5)
    if (m) return { n: parseFloat(m[1] + (m[2] || '0') + '.' + m[3]), grouped: false, dec: m[3].length };
    m = /^([-+]?)(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/.exec(s);   // 1,234.56
    if (m && m[2].length > 4) return { n: parseFloat(m[1] + m[2].replace(/,/g, '') + (m[3] ? '.' + m[3] : '')), grouped: true, dec: m[3] ? m[3].length : 0 };
    return null;
  };
  // Oneindig (1e309) of niet-berekenbaar: dan is het gewoon tekst
  const parseNumberText = (s) => { const r = parseNumberTextRaw(s); return r && !isFinite(r.n) ? null : r; };
  const decFmt = (base, dec) => (dec ? base + '.' + '0'.repeat(dec) : base);
  const parseInput = (raw) => {
    sync();
    const s = String(raw);
    if (s === '') return { v: null };
    let m, p;
    if (s[0] === "'") return { v: s.slice(1), text: true };
    if (LOC.mdy && (m = /^(-?)\s*\$\s*(-?[\d.,\s]+)$/.exec(s.trim())) && (p = parseNumberText(m[2]))) return { v: (m[1] === '-' ? -1 : 1) * p.n, nf: '"$"' + decFmt('#,##0', p.dec || 2) + ';"$"-' + decFmt('#,##0', p.dec || 2) };
    const t = s.trim();
    if (/^(waar|true)$/i.test(t)) return { v: true };
    if (/^(onwaar|false)$/i.test(t)) return { v: false };
    // procent
    if ((m = /^([-+]?[\d.,\s]+)\s*%$/.exec(t)) && (p = parseNumberText(m[1]))) return { v: p.n / 100, nf: decFmt('0', p.dec) + '%' };
    // valuta
    if ((m = /^(-?)\s*€\s*(-?[\d.,\s]+)$/.exec(t) || /^(-?)([\d.,\s]+)\s*€$/.exec(t)) && (p = parseNumberText(m[2]))) {
      const n = (m[1] === '-' ? -1 : 1) * p.n;
      return { v: n, nf: '"€" ' + decFmt('#,##0', p.dec || 2) + ';"€" -' + decFmt('#,##0', p.dec || 2) };
    }
    if ((p = parseNumberText(t))) return { v: p.n, nf: p.grouped ? decFmt('#,##0', p.dec) : p.sci ? '0.00E+00' : undefined };
    // boekhoudkundig negatief: (5) = -5
    if ((m = /^\(\s*([\d.,\s]+)\s*\)$/.exec(t)) && (p = parseNumberText(m[1]))) return { v: -p.n, nf: decFmt('#,##0', p.dec) + ';(' + decFmt('#,##0', p.dec) + ')' };
    // datum en tijd
    let date = null, time = null, rest = t;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]|$)/.exec(rest))) {
      const y = +m[1], mo = +m[2] - 1, d = +m[3];
      if (validDate(y, mo, d)) { date = { y, mo, d, fmt: LOC.dateFmt }; rest = rest.slice(m[0].length).trim(); }
    } else if ((m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?(?:\s+|$)/.exec(rest))) {
      const a = +m[1], b = +m[2], y = m[3] ? year2(+m[3]) : new Date().getFullYear();
      // Engels: maand/dag/jaar; Nederlands: dag-maand-jaar (de andere volgorde wordt geprobeerd als de eerste ongeldig is)
      const first = LOC.mdy ? [b, a - 1] : [a, b - 1], second = LOC.mdy ? [a, b - 1] : [b, a - 1];
      const pick = validDate(y, first[1], first[0]) ? first : validDate(y, second[1], second[0]) ? second : null;
      if (pick && !(m[0].includes('.') && !m[3])) { date = { y, mo: pick[1], d: pick[0], fmt: m[3] ? LOC.dateFmt : LOC.dateShortNoYear }; rest = rest.slice(m[0].length).trim(); }
    } else if ((m = /^(\d{1,2})[-\s]([A-Za-z]{3,10}\.?)(?:[-\s](\d{2,4}))?(?:\s+|$)/.exec(rest))) {
      const mo = monthIdx(m[2]), d = +m[1], y = m[3] ? year2(+m[3]) : new Date().getFullYear();
      if (mo >= 0 && validDate(y, mo, d)) { date = { y, mo, d, fmt: m[3] ? (m[2].length > 4 ? LOC.dateLongText : LOC.dateMonthText) : LOC.dateShortNoYear }; rest = rest.slice(m[0].length).trim(); }
    } else if (LOC.mdy && (m = /^([A-Za-z]{3,10}\.?)\s+(\d{1,2})(?:,?\s+(\d{2,4}))?(?:\s+|$)/.exec(rest))) {
      // Engels: January 5, 2026 / Jan 5
      const mo = monthIdx(m[1]), d = +m[2], y = m[3] ? year2(+m[3]) : new Date().getFullYear();
      if (mo >= 0 && validDate(y, mo, d)) { date = { y, mo, d, fmt: m[3] ? (m[1].length > 4 ? LOC.dateLongText : LOC.dateMonthText) : LOC.dateShortNoYear }; rest = rest.slice(m[0].length).trim(); }
    }
    if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(rest))) {
      let h = +m[1]; const mi = +m[2], se = m[3] ? +m[3] : 0;
      if (m[4]) { if (/pm/i.test(m[4]) && h < 12) h += 12; if (/am/i.test(m[4]) && h === 12) h = 0; }
      if (mi < 60 && se < 60) { time = { h, mi, se, fmt: (m[3] ? 'h:mm:ss' : 'h:mm') + (m[4] ? ' AM/PM' : '') }; rest = ''; }
    }
    if ((date || time) && rest === '') {
      if (date && time) return { v: dateToSerial(date.y, date.mo, date.d, time.h, time.mi, time.se), nf: LOC.dateTime };
      if (date) return { v: dateToSerial(date.y, date.mo, date.d), nf: date.fmt };
      if (time.h < 24) return { v: (time.h * 3600 + time.mi * 60 + time.se) / 86400, nf: time.fmt };
      return { v: (time.h * 3600 + time.mi * 60 + time.se) / 86400, nf: '[h]:mm:ss' };
    }
    return { v: s };
  };

  /* Tekst in de bewerkbalk voor een (niet-formule) waarde */
  const editText = (v, fmt) => {
    if (v === null || v === undefined) return '';
    sync();
    if (typeof v === 'boolean') return v ? LOC.bool[0] : LOC.bool[1];
    if (typeof v === 'object' && v.err) return LOC.errNl ? (ERR_NL[v.err] || v.err) : v.err;
    if (typeof v === 'string') return (parseInput(v).v !== v && !isTextFmt(fmt)) ? "'" + v : v;
    if (typeof v === 'number') {
      if (fmt && isDateFmt(fmt)) {
        const dt = serialToDate(v);
        const hasDate = Math.floor(v) !== 0;
        const hasTime = Math.abs(v % 1) > 1e-9 || /[hs]/i.test(fmt.replace(/"[^"]*"/g, ''));
        const ds = LOC.mdy ? `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}` : `${dt.getUTCDate()}-${dt.getUTCMonth() + 1}-${dt.getUTCFullYear()}`;
        const ts = `${dt.getUTCHours()}:${String(dt.getUTCMinutes()).padStart(2, '0')}:${String(dt.getUTCSeconds()).padStart(2, '0')}`;
        return hasDate && hasTime ? ds + ' ' + ts : hasDate ? ds : ts;
      }
      if (fmt && /%/.test(fmt.replace(/"[^"]*"/g, ''))) return String(+(v * 100).toPrecision(15)).replace('.', DEC) + '%';
      return String(+v.toPrecision(15)).replace('.', DEC).replace(/e\+?/, 'E');
    }
    return String(v);
  };

  /* Notatiecode voor weergave in dialogen: zoals in Excel bewaard */
  const PRESETS = {
    General: 'General',
    number: '0.00',
    comma: '#,##0.00',
    currency: '"€" #,##0.00;"€" -#,##0.00',
    accounting: '_ "€" * #,##0.00_ ;_ "€" * -#,##0.00_ ;_ "€" * "-"??_ ;_ @_ ',
    shortDate: 'd-m-yyyy',
    longDate: 'dddd d mmmm yyyy',
    time: 'h:mm:ss',
    percent: '0%',
    fraction: '# ?/?',
    scientific: '0.00E+00',
    text: '@',
  };
  const CATEGORIES = [
    ['General', 'Standaard', ['General']],
    ['number', 'Getal', ['0', '0.00', '#,##0', '#,##0.00', '#,##0.00;[Red]-#,##0.00', '0.000', '#,##0.0']],
    ['currency', 'Valuta', ['"€" #,##0.00;"€" -#,##0.00', '"€" #,##0.00;[Red]"€" -#,##0.00', '"€" #,##0;"€" -#,##0', '#,##0.00 "€"', '[$$-409]#,##0.00']],
    ['accounting', 'Financieel', ['_ "€" * #,##0.00_ ;_ "€" * -#,##0.00_ ;_ "€" * "-"??_ ;_ @_ ', '_ * #,##0.00_ ;_ * -#,##0.00_ ;_ * "-"??_ ;_ @_ ']],
    ['date', 'Datum', ['d-m-yyyy', 'dd-mm-yyyy', 'd-m-yy', 'd-mmm', 'd-mmm-yy', 'd mmmm yyyy', 'dddd d mmmm yyyy', 'mmm-yy', 'mmmm yyyy', 'yyyy-mm-dd', 'd-m-yyyy h:mm']],
    ['time', 'Tijd', ['h:mm', 'h:mm:ss', 'hh:mm', 'h:mm AM/PM', '[h]:mm:ss', 'mm:ss', 'mm:ss.0']],
    ['percent', 'Percentage', ['0%', '0.0%', '0.00%']],
    ['fraction', 'Breuk', ['# ?/?', '# ??/??', '# ?/2', '# ?/4', '# ?/8', '# ??/16', '# ?/10']],
    ['scientific', 'Wetenschappelijk', ['0.00E+00', '0.0E+00', '##0.0E+0']],
    ['text', 'Tekst', ['@']],
    ['special', 'Speciaal', ['0000 AA', '00000', '000-000000', '"NL"00 "BANK" 0000 0000 00']],
    ['custom', 'Aangepast', []],
  ];
  const categoryOf = (fmt) => {
    if (!fmt || fmt === 'General') return 'General';
    for (const [id, , list] of CATEGORIES) if (list.includes(fmt)) return id;
    if (isDateFmt(fmt)) return /[dy]/i.test(fmt) ? 'date' : 'time';
    if (/%/.test(fmt)) return 'percent';
    if (/E[+-]/.test(fmt)) return 'scientific';
    if (fmt === '@') return 'text';
    if (/€|\$/.test(fmt)) return /\*/.test(fmt) ? 'accounting' : 'currency';
    return 'custom';
  };
  /* Aantal decimalen aanpassen in een notatiecode */
  const adjustDecimals = (fmt, delta, sample) => {
    if (!fmt || fmt === 'General') {
      let dec = 0;
      if (typeof sample === 'number' && isFinite(sample)) { const s = general(sample); const i = s.indexOf(DEC); dec = i >= 0 ? s.length - i - 1 : 0; if (/E/.test(s)) dec = 2; }
      const nd = Math.max(0, dec + delta);
      return nd ? '0.' + '0'.repeat(nd) : '0';
    }
    if (isDateFmt(fmt)) return fmt;
    return splitSections(fmt).map((sec) => {
      const m = /(.*?[0#?])(\.([0#?]+))?(?![\s\S]*[0#?])/.exec(sec);
      if (!m) return sec;
      const before = sec.slice(0, m.index);
      const intPart = m[1];
      const dec = m[3] ? m[3].length : 0;
      const nd = Math.max(0, dec + delta);
      const after = sec.slice(m.index + m[0].length);
      return before + intPart + (nd ? '.' + '0'.repeat(nd) : '') + after;
    }).join(';');
  };

  return { format, general, parseInput, editText, isDateFmt, isTextFmt, serialToDate, dateToSerial, jsToSerial, PRESETS, CATEGORIES, categoryOf, adjustDecimals, ERR_NL, MONTHS, MONTHS_S, DAYS, DAYS_S, parseNumberText };
})();
