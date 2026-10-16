/* =========================================================
   Cel (gemaakt door JJ van Schelven) — formules: tokenizer, vertalen (NL <-> Excel), parser,
   berekenen en verwijzingen verschuiven.
   Formules worden intern bewaard zoals Excel ze opslaat (Engelse
   functienamen, komma als scheidingsteken, punt als decimaal) en
   getoond zoals in de Nederlandse Excel (SOM(A1;2,5)).
   ========================================================= */
'use strict';

App.F = (() => {
  const ERRS = ['#DIV/0!', '#N/A', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!', '#SPILL!', '#CALC!'];
  const ERR_EN = { '#DEEL/0!': '#DIV/0!', '#N/B': '#N/A', '#WAARDE!': '#VALUE!', '#VERW!': '#REF!', '#NAAM?': '#NAME?', '#GETAL!': '#NUM!', '#LEEG!': '#NULL!', '#OVERLOOP!': '#SPILL!', '#BEREKENING!': '#CALC!' };
  const err = (e) => ({ err: e });
  const isErr = (v) => v !== null && typeof v === 'object' && !!v.err;
  const isRef = (v) => v !== null && typeof v === 'object' && v.ref === true;
  const isArr = (v) => Array.isArray(v);

  /* ---------- Tokenizer ---------- */
  const RE_ERR = /^#(DIV\/0!|N\/A|VALUE!|REF!|NAME\?|NUM!|NULL!|SPILL!|CALC!|DEEL\/0!|N\/B|WAARDE!|VERW!|NAAM\?|GETAL!|LEEG!|OVERLOOP!|BEREKENING!)/i;
  const RE_CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(.])/;
  const RE_COLS = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(.!])/;
  const RE_ROWS = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})(?![\d.,A-Za-z])/;
  const RE_NAME = /^[A-Za-z_\\À-ɏ][A-Za-z0-9_.\\À-ɏ]*/;

  const tokenize = (src, loc = 'en') => {
    const out = [];
    let i = 0;
    const nl = loc === 'nl';
    const prevSig = () => { for (let k = out.length - 1; k >= 0; k--) if (out[k].t !== 'ws') return out[k]; return null; };
    const readRef = (s, sheet) => {
      let m;
      if ((m = RE_COLS.exec(s))) {
        const c1 = App.colIndex(m[2]), c2 = App.colIndex(m[4]);
        if (c1 < App.MAXC && c2 < App.MAXC) return { len: m[0].length, tok: { t: 'ref', sheet, kind: 'col', r1: 0, r2: App.MAXR - 1, c1, c2, ac1: !!m[1], ac2: !!m[3], ar1: true, ar2: true } };
      }
      if ((m = RE_ROWS.exec(s))) {
        const r1 = +m[2] - 1, r2 = +m[4] - 1;
        if (r1 >= 0 && r2 >= 0 && r1 < App.MAXR && r2 < App.MAXR) return { len: m[0].length, tok: { t: 'ref', sheet, kind: 'row', r1, r2, c1: 0, c2: App.MAXC - 1, ar1: !!m[1], ar2: !!m[3], ac1: true, ac2: true } };
      }
      if ((m = RE_CELL.exec(s))) {
        const c1 = App.colIndex(m[2]), r1 = +m[4] - 1;
        if (c1 >= App.MAXC || r1 < 0 || r1 >= App.MAXR) return null;
        const tok = { t: 'ref', sheet, kind: 'cell', r1, c1, r2: r1, c2: c1, ac1: !!m[1], ar1: !!m[3], ac2: !!m[1], ar2: !!m[3] };
        let len = m[0].length;
        const rest = s.slice(len);
        const m2 = /^:(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(.])/.exec(rest);
        if (m2) {
          const c2 = App.colIndex(m2[2]), r2 = +m2[4] - 1;
          if (c2 < App.MAXC && r2 >= 0 && r2 < App.MAXR) {
            Object.assign(tok, { kind: 'range', c2, r2, ac2: !!m2[1], ar2: !!m2[3] });
            len += m2[0].length;
          }
        }
        return { len, tok };
      }
      return null;
    };
    while (i < src.length) {
      const ch = src[i];
      const s = src.slice(i);
      if (/\s/.test(ch)) { const m = /^\s+/.exec(s); out.push({ t: 'ws', v: m[0] }); i += m[0].length; continue; }
      if (ch === '"') {
        let j = i + 1, v = '';
        while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { v += '"'; j += 2; continue; } break; } v += src[j++]; }
        out.push({ t: 'str', v }); i = j + 1; continue;
      }
      if (ch === '#') {
        const m = RE_ERR.exec(s);
        if (m) { const up = m[0].toUpperCase(); out.push({ t: 'err', v: ERR_EN[up] || up }); i += m[0].length; continue; }
        // overloopbereik: A1# (alle cellen waarin de formule in A1 overloopt)
        const last = out[out.length - 1];
        if (last && last.t === 'ref' && last.kind === 'cell') { last.spill = true; i++; continue; }
      }
      // verwijzing met blad: 'Blad 1'!A1 of Blad1!A1
      if (ch === "'") {
        let j = i + 1, name = '';
        while (j < src.length) { if (src[j] === "'") { if (src[j + 1] === "'") { name += "'"; j += 2; continue; } break; } name += src[j++]; }
        if (src[j + 1] === '!') {
          const r = readRef(src.slice(j + 2), name);
          if (r) { out.push(r.tok); i = j + 2 + r.len; continue; }
          if (/^#REF!/i.test(src.slice(j + 2))) { out.push({ t: 'err', v: '#REF!' }); i = j + 2 + 5; continue; }
        }
      }
      {
        const m = /^([A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*)!/.exec(s);
        if (m) {
          const r = readRef(s.slice(m[0].length), m[1]);
          if (r) { out.push(r.tok); i += m[0].length + r.len; continue; }
          if (/^#REF!/i.test(s.slice(m[0].length))) { out.push({ t: 'err', v: '#REF!' }); i += m[0].length + 5; continue; }
        }
      }
      const prev = prevSig();
      const afterValue = prev && (prev.t === 'num' || prev.t === 'ref' || prev.t === 'str' || prev.t === ')' || prev.t === 'bool' || prev.t === 'err' || (prev.t === 'op' && prev.v === '%'));
      // bereik van rijen (1:3) gaat vóór getallen
      if (/[\d$]/.test(ch) && !afterValue) {
        const r = RE_ROWS.exec(s) ? readRef(s, null) : null;
        if (r && r.tok.kind === 'row') { out.push(r.tok); i += r.len; continue; }
      }
      if (/[\d]/.test(ch) || (ch === (nl ? ',' : '.') && /\d/.test(src[i + 1] || '') && !afterValue)) {
        const re = nl ? /^(?:\d+[.]\d+|\d*(?:,\d+)?)(?:[eE][-+]?\d+)?/ : /^\d*(?:\.\d+)?(?:[eE][-+]?\d+)?/;
        const m = re.exec(s);
        if (m && m[0]) {
          const txt = m[0];
          const v = parseFloat(txt.replace(',', '.'));
          out.push({ t: 'num', v, raw: txt.replace(',', '.') }); i += txt.length; continue;
        }
      }
      if (/[A-Za-z$_\\À-ɏ]/.test(ch)) {
        const r = readRef(s, null);
        if (r) { out.push(r.tok); i += r.len; continue; }
        const m = RE_NAME.exec(s);
        if (m) {
          const name = m[0];
          const up = name.toUpperCase();
          const isCall = /^\s*\(/.test(src.slice(i + name.length));
          if (!isCall && (up === 'TRUE' || up === 'WAAR')) out.push({ t: 'bool', v: true });
          else if (!isCall && (up === 'FALSE' || up === 'ONWAAR')) out.push({ t: 'bool', v: false });
          else if (isCall) {
            let canon = up.replace(/^_XLFN\.|^_XLWS\./, '');
            if (nl || !App.FN[canon]) canon = (App.FN_EN && App.FN_EN[canon]) || canon;
            out.push({ t: 'fn', v: canon, raw: name });
          } else out.push({ t: 'name', v: name });
          i += name.length; continue;
        }
      }
      if (ch === '(' || ch === ')') { out.push({ t: ch }); i++; continue; }
      // In de NL-notatie is ; het scheidingsteken; een losse komma (niet in een getal) mag ook
      if (ch === ';' || ch === ',') { out.push({ t: 'sep' }); i++; continue; }
      const op2 = s.slice(0, 2);
      if (op2 === '<>' || op2 === '<=' || op2 === '>=') { out.push({ t: 'op', v: op2 }); i += 2; continue; }
      if ('+-*/^&=<>%:@'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
      if (ch === '{' || ch === '}') { out.push({ t: 'bad', v: ch }); i++; continue; }
      out.push({ t: 'bad', v: ch }); i++;
    }
    return out;
  };

  /* Token weer als tekst */
  const refText = (t, loc) => {
    void loc;
    let s = '';
    if (t.sheet) s += App.sheetRef(t.sheet) + '!';
    const cr = (ac, c, ar, r) => (ac ? '$' : '') + App.colName(c) + (ar ? '$' : '') + (r + 1);
    if (t.kind === 'col') return s + (t.ac1 ? '$' : '') + App.colName(t.c1) + ':' + (t.ac2 ? '$' : '') + App.colName(t.c2);
    if (t.kind === 'row') return s + (t.ar1 ? '$' : '') + (t.r1 + 1) + ':' + (t.ar2 ? '$' : '') + (t.r2 + 1);
    s += cr(t.ac1, t.c1, t.ar1, t.r1);
    if (t.kind === 'range') s += ':' + cr(t.ac2, t.c2, t.ar2, t.r2);
    if (t.spill) s += '#';
    return s;
  };
  const untokenize = (toks, loc = 'en') => toks.map((t) => {
    switch (t.t) {
      case 'ws': return t.v;
      case 'str': return '"' + t.v.replace(/"/g, '""') + '"';
      case 'num': return loc === 'nl' ? t.raw.replace('.', ',') : t.raw;
      case 'bool': return loc === 'nl' ? (t.v ? 'WAAR' : 'ONWAAR') : (t.v ? 'TRUE' : 'FALSE');
      case 'err': return loc === 'nl' ? (App.NF.ERR_NL[t.v] || t.v) : t.v;
      case 'ref': return t.bad ? (loc === 'nl' ? '#VERW!' : '#REF!') : refText(t, loc);
      case 'fn': return loc === 'nl' ? ((App.FN_NL && App.FN_NL[t.v]) || t.v) : t.v;
      case 'name': return t.v;
      case 'sep': return loc === 'nl' ? ';' : ',';
      case 'op': case 'bad': return t.v;
      default: return t.t;
    }
  }).join('');

  // 'nl' = Nederlandse schrijfwijze (SOM(A1;2,5)), 'en' = Engelse (SUM(A1,2.5)); volgt de taal van de interface
  const LOC = () => (App.LANG === 'en' ? 'en' : 'nl');
  const toCanon = (local) => untokenize(tokenize(local, LOC()), 'en');
  const toLocal = (canon) => untokenize(tokenize(canon, 'en'), LOC());

  /* ---------- Parser ---------- */
  const parseCache = new Map();
  const parse = (canon) => {
    let ast = parseCache.get(canon);
    if (ast) return ast;
    const toks = tokenize(canon, 'en').filter((t) => t.t !== 'ws');
    let p = 0;
    const peek = () => toks[p];
    const eat = (t, v) => { const x = toks[p]; if (x && x.t === t && (v === undefined || x.v === v)) { p++; return x; } return null; };
    const fail = () => { throw new Error('syntax'); };
    const primary = () => {
      const x = toks[p];
      if (!x) fail();
      if (x.t === 'num') { p++; return { k: 'num', v: x.v }; }
      if (x.t === 'str') { p++; return { k: 'str', v: x.v }; }
      if (x.t === 'bool') { p++; return { k: 'bool', v: x.v }; }
      if (x.t === 'err') { p++; return { k: 'err', v: x.v }; }
      if (x.t === 'ref') { p++; return { k: 'ref', sheet: x.sheet, r1: x.r1, c1: x.c1, r2: x.r2, c2: x.c2, spill: !!x.spill }; }
      if (x.t === 'name') { p++; return { k: 'name', v: x.v }; }
      if (x.t === 'fn') {
        p++; eat('(');
        const args = [];
        if (!eat(')')) {
          for (;;) {
            const nx = peek();
            if (nx && (nx.t === 'sep' || nx.t === ')')) args.push({ k: 'missing' });
            else args.push(expr());
            if (eat('sep')) continue;
            if (eat(')')) break;
            fail();
          }
        }
        return { k: 'fn', name: x.v, args };
      }
      if (x.t === '(') { p++; const e = expr(); if (!eat(')')) fail(); return { k: 'paren', a: e }; }
      fail();
    };
    const rangeOp = () => { let a = primary(); while (eat('op', ':')) a = { k: 'range', a, b: primary() }; return a; };
    const percent = () => { let a = rangeOp(); while (eat('op', '%')) a = { k: 'pct', a }; return a; };
    const unary = () => {
      if (eat('op', '-')) return { k: 'neg', a: unary() };
      if (eat('op', '@')) return { k: 'ii', a: unary() };
      if (eat('op', '+')) return unary();
      return percent();
    };
    const power = () => { let a = unary(); while (eat('op', '^')) a = { k: 'bin', op: '^', a, b: unary() }; return a; };
    const mul = () => { let a = power(); for (;;) { const x = peek(); if (x && x.t === 'op' && (x.v === '*' || x.v === '/')) { p++; a = { k: 'bin', op: x.v, a, b: power() }; } else return a; } };
    const add = () => { let a = mul(); for (;;) { const x = peek(); if (x && x.t === 'op' && (x.v === '+' || x.v === '-')) { p++; a = { k: 'bin', op: x.v, a, b: mul() }; } else return a; } };
    const cat = () => { let a = add(); while (eat('op', '&')) a = { k: 'bin', op: '&', a, b: add() }; return a; };
    const cmp = () => { let a = cat(); for (;;) { const x = peek(); if (x && x.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(x.v)) { p++; a = { k: 'bin', op: x.v, a, b: cat() }; } else return a; } };
    const expr = () => cmp();
    try {
      if (toks.some((t) => t.t === 'bad')) throw new Error('bad');
      ast = expr();
      if (p < toks.length) fail();
    } catch { ast = { k: 'syntax' }; }
    parseCache.set(canon, ast);
    if (parseCache.size > 20000) parseCache.clear();
    return ast;
  };
  /* Controle bij invoer: geeft een foutmelding of null */
  const check = (canon) => {
    const ast = parse(canon);
    if (ast.k === 'syntax') {
      const toks = tokenize(canon, 'en');
      let depth = 0; toks.forEach((t) => { if (t.t === '(') depth++; if (t.t === ')') depth--; });
      if (depth > 0) return { fix: canon + ')'.repeat(depth) };
      return { msg: 'Er is een probleem met deze formule. Controleer haakjes, scheidingstekens (;) en aanhalingstekens.' };
    }
    return null;
  };

  /* ---------- Waarden omzetten ---------- */
  const toNum = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === null || v === undefined || v === '') return 0;
    if (isErr(v)) return v;
    if (typeof v === 'string') {
      const p = App.NF.parseInput(v.trim());
      if (typeof p.v === 'number') return p.v;
      return err('#VALUE!');
    }
    return err('#VALUE!');
  };
  const toStr = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'WAAR' : 'ONWAAR';
    if (typeof v === 'number') return App.NF.general(v);
    if (isErr(v)) return v;
    return String(v);
  };
  const toBool = (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v === null || v === undefined || v === '') return false;
    if (isErr(v)) return v;
    if (typeof v === 'string') { const u = v.toUpperCase(); if (u === 'TRUE' || u === 'WAAR') return true; if (u === 'FALSE' || u === 'ONWAAR') return false; }
    return err('#VALUE!');
  };

  /* ---------- Berekenen ----------
     Formules die een matrix opleveren "lopen over" naar de cellen eronder en
     rechts ervan (dynamische matrices zoals in Excel 365). Per blad houdt
     sh._spill bij welke cel bij welk overloopbereik hoort. */
  let pass = 0;
  let circular = null;
  const SK = (r, c) => r * 16384 + c;
  const isEmptyCell = (o) => !o || (!o.f && (o.v === undefined || o.v === null || o.v === ''));
  const registerSpill = (sh, r, c, cell, arr) => {
    const h = arr.length, w = arr[0].length;
    if (!sh._spill) sh._spill = new Map();
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      if (!i && !j) continue;
      const rr = r + i, cc = c + j;
      if (rr >= App.MAXR || cc >= App.MAXC) return false;
      const row = sh.data.get(rr);
      if (row && !isEmptyCell(row.get(cc))) return false;
      const m = sh._spill.get(SK(rr, cc));
      if (m && (m.r !== r || m.c !== c)) return false;
      if (App.mergeAt(sh, rr, cc)) return false;
    }
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) sh._spill.set(SK(r + i, c + j), { r, c });
    cell.sp = { h, w, vals: arr.map((row) => row.map((v) => (v === null || v === undefined ? 0 : v))) };
    return true;
  };
  const calcCell = (sh, r, c, cell) => {
    if (cell._p === pass) return cell.cv;
    if (cell._busy) { circular = circular || { sh, r, c }; return 0; }
    cell._busy = true;
    cell.sp = null;
    let v;
    try {
      const ast = parse(cell.f);
      const ctx = { sh, r, c };
      v = ast.k === 'syntax' ? err('#NAME?') : evaluate(ast, ctx);
      if (v && v.lambda) v = err('#CALC!');
      let arr = null;
      if (!cell.legacy) {
        if (isRef(v) && !(v.r1 === v.r2 && v.c1 === v.c2)) arr = refToArray(v);
        else if (isArr(v) && (v.length > 1 || (v[0] && v[0].length > 1))) arr = v;
      }
      if (arr && arr.length && arr[0].length && (arr.length > 1 || arr[0].length > 1)) {
        if (registerSpill(sh, r, c, cell, arr)) v = cell.sp.vals[0][0];
        else v = err('#SPILL!');
      } else v = deref(v, ctx);
      if (v && v.lambda) v = err('#CALC!');
      if (typeof v === 'number' && !isFinite(v)) v = err('#NUM!');
      if (v === null || v === undefined) v = 0;
    } catch (e) {
      if (e instanceof RangeError) v = err('#CALC!'); else { console.error(e); v = err('#VALUE!'); }
    }
    cell._busy = false;
    cell.cv = v; cell._p = pass;
    return v;
  };
  /* Overgelopen waarde in een (lege) cel, of undefined */
  const spillValue = (sh, r, c) => {
    const k = SK(r, c);
    let a = sh._spill && sh._spill.get(k);
    if (!a && sh._spillPrev) {
      const p = sh._spillPrev.get(k);
      if (p) { const row = sh.data.get(p.r); const ac = row && row.get(p.c); if (ac && ac.f) { calcCell(sh, p.r, p.c, ac); a = sh._spill && sh._spill.get(k); } }
    }
    if (!a) return undefined;
    const row = sh.data.get(a.r); const ac = row && row.get(a.c);
    if (!ac || !ac.sp) return undefined;
    const v = (ac.sp.vals[r - a.r] || [])[c - a.c];
    return v === undefined ? undefined : v;
  };
  const spillAnchor = (sh, r, c) => { const a = sh._spill && sh._spill.get(SK(r, c)); return a || null; };
  const cellValue = (sh, r, c) => {
    const row = sh.data.get(r);
    const cell = row && row.get(c);
    if (cell && cell.f) return calcCell(sh, r, c, cell);
    if (isEmptyCell(cell) && (sh._spill || sh._spillPrev)) { const sv = spillValue(sh, r, c); if (sv !== undefined) return sv; }
    if (!cell) return null;
    return cell.v === undefined ? null : cell.v;
  };
  const spillSig = (m) => (m ? m.size + ':' + Array.from(m.keys()).slice(0, 50000).join(',') : '0');
  const recalc = () => {
    circular = null;
    for (let iter = 0; iter < 3; iter++) {
      pass++;
      for (const sh of App.book.sheets) { sh._spillPrev = sh._spill || null; sh._spill = new Map(); }
      for (const sh of App.book.sheets) {
        const rows = Array.from(sh.data.keys()).sort((a, b) => a - b);
        for (const r of rows) {
          const row = sh.data.get(r);
          const cols = Array.from(row.keys()).sort((a, b) => a - b);
          for (const c of cols) { const cell = row.get(c); if (cell && cell.f) calcCell(sh, r, c, cell); }
        }
      }
      // nieuwe of veranderde overloopbereiken: nog een ronde zodat afhankelijke formules ze zien
      const changed = App.book.sheets.some((sh) => spillSig(sh._spill) !== spillSig(sh._spillPrev));
      App.book.sheets.forEach((sh) => { sh._spillPrev = null; });
      if (!changed) break;
    }
    if (circular && !App._circWarned) {
      App._circWarned = true;
      App.toast && App.toast(`Kringverwijzing in ${circular.sh.name}!${App.addr(circular.r, circular.c)}: een formule verwijst (via andere cellen) naar zichzelf.`, 'error', { ms: 6000 });
    } else if (!circular) App._circWarned = false;
    const sb = document.getElementById('sb-calc'); if (sb) sb.hidden = true;
  };
  /* LAMBDA aanroepen */
  const callLambda = (lam, args) => {
    const vars = { ...(lam.ctx.vars || {}) };
    lam.params.forEach((p, i) => { vars[p] = args[i] === undefined ? null : args[i]; });
    return evaluate(lam.body, { ...lam.ctx, vars });
  };

  const refSheet = (node, ctx) => {
    if (!node.sheet) return ctx.sh;
    return App.sheetByName(node.sheet);
  };
  const mkRef = (sh, r1, c1, r2, c2) => ({ ref: true, sh, r1, c1, r2, c2 });
  /* Verwijzing omzetten naar een waarde (of 2D-array) */
  const refToArray = (ref) => {
    const g = boundRef(ref);
    const out = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const row = [];
      for (let c = g.c1; c <= g.c2; c++) row.push(cellValue(ref.sh, r, c));
      out.push(row);
    }
    return out;
  };
  const boundRef = (ref) => {
    if (ref.r2 - ref.r1 < 20000 && ref.c2 - ref.c1 < 1000) return ref;
    const e = App.extent(ref.sh);
    return { r1: ref.r1, c1: ref.c1, r2: Math.min(ref.r2, e.r), c2: Math.min(ref.c2, e.c), sh: ref.sh, ref: true };
  };
  const deref = (v, ctx) => {
    if (isRef(v)) {
      if (v.r1 === v.r2 && v.c1 === v.c2) return cellValue(v.sh, v.r1, v.c1);
      // impliciete doorsnede met de rij/kolom van de formule
      if (ctx && v.sh === ctx.sh) {
        if (v.c1 === v.c2 && ctx.r >= v.r1 && ctx.r <= v.r2) return cellValue(v.sh, ctx.r, v.c1);
        if (v.r1 === v.r2 && ctx.c >= v.c1 && ctx.c <= v.c2) return cellValue(v.sh, v.r1, ctx.c);
      }
      return cellValue(v.sh, v.r1, v.c1);
    }
    if (isArr(v)) return v.length && v[0].length ? v[0][0] : null;
    return v;
  };
  const valArr = (v) => (isRef(v) ? refToArray(v) : isArr(v) ? v : null);
  /* Element-voor-element bewerking met arrays */
  const broadcast = (a, b, fn) => {
    const A = valArr(a), B = valArr(b);
    if (!A && !B) return fn(a, b);
    const ra = A ? A.length : 1, ca = A ? A[0].length : 1, rb = B ? B.length : 1, cb = B ? B[0].length : 1;
    const R = Math.max(ra, rb), C = Math.max(ca, cb);
    const out = [];
    for (let i = 0; i < R; i++) {
      const row = [];
      for (let j = 0; j < C; j++) {
        const x = A ? (A[ra === 1 ? 0 : i] || [])[ca === 1 ? 0 : j] : a;
        const y = B ? (B[rb === 1 ? 0 : i] || [])[cb === 1 ? 0 : j] : b;
        row.push(x === undefined || y === undefined ? err('#N/A') : fn(x, y));
      }
      out.push(row);
    }
    return out;
  };
  const map1 = (a, fn) => { const A = valArr(a); return A ? A.map((row) => row.map(fn)) : fn(a); };
  const cmpVals = (x, y) => {
    // Excel-volgorde: getallen < tekst < logisch; tekst hoofdletterongevoelig
    const rank = (v) => (v === null || v === undefined || v === '' ? 0 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 3 : 4);
    if (x === null || x === undefined) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
    if (y === null || y === undefined) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
    const rx = rank(x), ry = rank(y);
    if (rx !== ry) return rx - ry;
    if (typeof x === 'string') { const a = x.toLowerCase(), b = y.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
    if (typeof x === 'boolean') return (x ? 1 : 0) - (y ? 1 : 0);
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const binop = (op, x, y) => {
    if (isErr(x)) return x;
    if (isErr(y)) return y;
    switch (op) {
      case '+': case '-': case '*': case '/': case '^': {
        const a = toNum(x), b = toNum(y);
        if (isErr(a)) return a;
        if (isErr(b)) return b;
        if (op === '+') return a + b;
        if (op === '-') return a - b;
        if (op === '*') return a * b;
        if (op === '/') return b === 0 ? err('#DIV/0!') : a / b;
        const pw = Math.pow(a, b);
        return isNaN(pw) ? err('#NUM!') : pw;
      }
      case '&': return toStr(x) + toStr(y);
      case '=': return cmpVals(x, y) === 0;
      case '<>': return cmpVals(x, y) !== 0;
      case '<': return cmpVals(x, y) < 0;
      case '>': return cmpVals(x, y) > 0;
      case '<=': return cmpVals(x, y) <= 0;
      case '>=': return cmpVals(x, y) >= 0;
      default: return err('#VALUE!');
    }
  };
  const evaluate = (n, ctx) => {
    if (!n) return null;   // ontbrekend argument bij een "luie" functie, bv. =ALS()
    switch (n.k) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'err': return err(n.v);
      case 'missing': return null;
      case 'paren': return evaluate(n.a, ctx);
      case 'ref': {
        const sh = refSheet(n, ctx);
        if (!sh) return err('#REF!');
        if (n.spill) {
          const row = sh.data.get(n.r1); const ac = row && row.get(n.c1);
          if (ac && ac.f) calcCell(sh, n.r1, n.c1, ac);
          if (ac && ac.sp) return mkRef(sh, n.r1, n.c1, n.r1 + ac.sp.h - 1, n.c1 + ac.sp.w - 1);
          return ac && ac.f ? mkRef(sh, n.r1, n.c1, n.r1, n.c1) : err('#REF!');
        }
        return mkRef(sh, n.r1, n.c1, n.r2, n.c2);
      }
      case 'ii': return deref(evaluate(n.a, ctx), ctx);
      case 'name': {
        const vk = n.v.toUpperCase();
        if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, vk)) return ctx.vars[vk];
        const def = lookupName(n.v, ctx);
        if (def === undefined) return err('#NAME?');
        return def;
      }
      case 'range': {
        const a = evaluate(n.a, ctx), b = evaluate(n.b, ctx);
        if (!isRef(a) || !isRef(b) || a.sh !== b.sh) return err('#VALUE!');
        return mkRef(a.sh, Math.min(a.r1, b.r1), Math.min(a.c1, b.c1), Math.max(a.r2, b.r2), Math.max(a.c2, b.c2));
      }
      case 'neg': return map1(evaluate(n.a, ctx), (v) => { const x = toNum(v); return isErr(x) ? x : -x; });
      case 'pct': return map1(evaluate(n.a, ctx), (v) => { const x = toNum(v); return isErr(x) ? x : x / 100; });
      case 'bin': {
        const a = evaluate(n.a, ctx), b = evaluate(n.b, ctx);
        if (isRef(a) || isRef(b) || isArr(a) || isArr(b)) {
          // bij één cel gewoon de waarde
          const sa = isRef(a) && a.r1 === a.r2 && a.c1 === a.c2, sb = isRef(b) && b.r1 === b.r2 && b.c1 === b.c2;
          if ((sa || !(isRef(a) || isArr(a))) && (sb || !(isRef(b) || isArr(b)))) return binop(n.op, deref(a), deref(b));
          return broadcast(a, b, (x, y) => binop(n.op, x, y));
        }
        return binop(n.op, a, b);
      }
      case 'fn': {
        const f = App.FN[n.name];
        if (!f) {
          // zelfgemaakte functie: LET-variabele of naam met een LAMBDA
          let lam = ctx.vars && ctx.vars[n.name];
          if (!lam) lam = lookupName(n.name, ctx);
          if (lam && lam.lambda) return callLambda(lam, n.args.map((a) => evaluate(a, ctx)));
          return err('#NAME?');
        }
        if (f.lazy) return f.fn(n.args, ctx, evaluate);
        const args = n.args.map((a) => evaluate(a, ctx));
        return f.fn(args, ctx, n.args);
      }
      default: return err('#NAME?');
    }
  };
  const nameStack = new Set();
  const lookupName = (name, ctx) => {
    const key = Object.keys(App.book.names).find((k) => k.toLowerCase() === name.toLowerCase());
    if (!key) return undefined;
    if (nameStack.has(key)) return err('#REF!');
    nameStack.add(key);
    try {
      const ast = parse(App.book.names[key].replace(/^=/, ''));
      return ast.k === 'syntax' ? err('#NAME?') : evaluate(ast, { ...ctx, sh: ctx.sh });
    } finally { nameStack.delete(key); }
  };
  /* Een losse formule berekenen (voor doelzoeken, validatie, voorwaardelijke opmaak) */
  const evalText = (canon, ctx) => {
    const ast = parse(canon.replace(/^=/, ''));
    if (ast.k === 'syntax') return err('#NAME?');
    return deref(evaluate(ast, ctx), ctx);
  };

  /* ---------- Verwijzingen aanpassen ---------- */
  const transform = (canon, fn) => {
    const toks = tokenize(canon, 'en');
    let changed = false;
    toks.forEach((t) => {
      if (t.t !== 'ref' || t.bad) return;
      const before = JSON.stringify(t);
      fn(t);
      if (JSON.stringify(t) !== before) changed = true;
    });
    return changed ? untokenize(toks, 'en') : canon;
  };
  /* Kopiëren/doorvoeren: relatieve verwijzingen verschuiven */
  const shift = (canon, dr, dc) => transform(canon, (t) => {
    if (t.kind !== 'row') { if (!t.ac1) t.c1 += dc; if (!t.ac2) t.c2 += dc; }
    if (t.kind !== 'col') { if (!t.ar1) t.r1 += dr; if (!t.ar2) t.r2 += dr; }
    if (t.r1 < 0 || t.c1 < 0 || t.r2 >= App.MAXR || t.c2 >= App.MAXC || t.r2 < 0 || t.c2 < 0) t.bad = true;
    if (t.kind === 'cell') { t.r2 = t.r1; t.c2 = t.c1; }
  });
  /* Rijen/kolommen invoegen of verwijderen op een blad */
  const adjust = (canon, fSheetName, op) => transform(canon, (t) => {
    const target = (t.sheet || fSheetName).toLowerCase() === op.sheet.toLowerCase();
    if (!target) return;
    const isRow = op.type === 'row';
    if (isRow && t.kind === 'col') return;
    if (!isRow && t.kind === 'row') return;
    // cellen invoegen/verwijderen: alleen verwijzingen binnen de verschoven kolommen/rijen
    if (op.span && (isRow ? (t.c1 < op.span.c1 || t.c2 > op.span.c2) : (t.r1 < op.span.r1 || t.r2 > op.span.r2))) return;
    let a = isRow ? t.r1 : t.c1, b = isRow ? t.r2 : t.c2;
    if (op.count > 0) {
      if (a >= op.at) a += op.count;
      if (b >= op.at) b += op.count;
    } else {
      const d1 = op.at, d2 = op.at - op.count - 1;
      if (a >= d1 && b <= d2) { t.bad = true; return; }
      const fix = (x, isStart) => {
        if (x > d2) return x + op.count;
        if (x >= d1) return isStart ? d1 : d1 - 1;
        return x;
      };
      a = fix(a, true); b = fix(b, false);
      if (b < a) { t.bad = true; return; }
    }
    if (isRow) { t.r1 = a; t.r2 = b; } else { t.c1 = a; t.c2 = b; }
    if (t.r2 >= App.MAXR || t.c2 >= App.MAXC) t.bad = true;
  });
  /* Verplaatsen (knippen/plakken): verwijzingen naar het verplaatste gebied meeverhuizen */
  const moveRefs = (canon, fSheetName, src, dst, dr, dc) => transform(canon, (t) => {
    const sheet = (t.sheet || fSheetName).toLowerCase();
    if (sheet !== src.sheet.toLowerCase()) return;
    if (t.r1 >= src.r1 && t.r2 <= src.r2 && t.c1 >= src.c1 && t.c2 <= src.c2) {
      t.r1 += dr; t.r2 += dr; t.c1 += dc; t.c2 += dc;
      if (dst.sheet.toLowerCase() !== sheet) t.sheet = dst.sheet;
      else if (t.sheet && fSheetName.toLowerCase() === sheet) { /* blad blijft */ }
    }
  });
  const renameSheet = (canon, oldName, newName) => transform(canon, (t) => {
    if (t.sheet && t.sheet.toLowerCase() === oldName.toLowerCase()) t.sheet = newName;
  });
  const dropSheet = (canon, name) => transform(canon, (t) => {
    if (t.sheet && t.sheet.toLowerCase() === name.toLowerCase()) t.bad = true;
  });
  /* Verwijzingen in lokale tekst (voor kleuren tijdens bewerken) */
  const refsInLocal = (local) => {
    const toks = tokenize(local, LOC());
    let pos = 0;
    const out = [];
    toks.forEach((t) => {
      const txt = untokenize([t], LOC());
      if (t.t === 'ref' && !t.bad) out.push({ ...t, start: pos, end: pos + txt.length });
      pos += txt.length;
    });
    return out;
  };
  /* F4: absolute/relatieve verwijzing wisselen op de cursorpositie */
  const cycleAbs = (local, caret) => {
    const toks = tokenize(local, LOC());
    let pos = 0;
    for (const t of toks) {
      const txt = untokenize([t], LOC());
      if (t.t === 'ref' && caret >= pos && caret <= pos + txt.length) {
        const st = (t.ac1 ? 2 : 0) + (t.ar1 ? 1 : 0);   // 0 A1, 3 $A$1, 1 A$1, 2 $A1
        const next = { 0: 3, 3: 1, 1: 2, 2: 0 }[st];
        const ac = !!(next & 2), ar = !!(next & 1);
        if (t.kind !== 'row') { t.ac1 = ac; t.ac2 = ac; }
        if (t.kind !== 'col') { t.ar1 = ar; t.ar2 = ar; }
        const nt = untokenize([t], LOC());
        const text = local.slice(0, pos) + nt + local.slice(pos + txt.length);
        return { text, caret: pos + nt.length };
      }
      pos += txt.length;
    }
    return null;
  };
  /* Functienaam en argumentindex op de cursor (voor de tooltip) */
  const fnContext = (local, caret) => {
    const toks = tokenize(local.slice(0, caret), LOC());
    const stack = [];
    let lastFn = null;
    toks.forEach((t) => {
      if (t.t === 'fn') lastFn = t;
      else if (t.t === '(') { stack.push(lastFn ? { name: lastFn.v, arg: 0 } : null); lastFn = null; }
      else if (t.t === ')') { stack.pop(); lastFn = null; }
      else if (t.t === 'sep') { const top = stack[stack.length - 1]; if (top) top.arg++; }
      else if (t.t !== 'ws') lastFn = null;
    });
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k]) return stack[k];
    return null;
  };

  return {
    tokenize, untokenize, toCanon, toLocal, parse, check, evaluate, evalText, recalc, calcCell, cellValue, deref, refToArray, boundRef,
    toNum, toStr, toBool, isErr, isRef, isArr, err, cmpVals, valArr, mkRef, ERRS,
    callLambda, spillValue, spillAnchor, isEmptyCell,
    shift, adjust, moveRefs, renameSheet, dropSheet, transform, refsInLocal, cycleAbs, fnContext,
  };
})();
App.recalc = () => App.F.recalc();
