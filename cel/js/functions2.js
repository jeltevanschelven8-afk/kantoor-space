/* =========================================================
   Cel (gemaakt door JJ van Schelven) — functiebibliotheek deel 2
   Dynamische matrices (FILTER, SORTEREN, UNIEK, REEKS …), LET en LAMBDA,
   extra wiskunde, statistiek, tekst (ook reguliere expressies),
   datum, financieel, technisch en database-functies.
   Namen volgens de Nederlandse Excel (support.microsoft.com, "Excel-functies per categorie").
   ========================================================= */
'use strict';

(() => {
  const F = App.F, NF = App.NF;
  const { err, isErr, isRef, isArr, toNum, toStr, toBool } = F;
  const def = (en, nl, cat, sig, desc, fn, opts = {}) => {
    App.FN[en] = { fn, cat, sig, desc, nl, ...opts };
    App.FN_NL[en] = nl;
    if (nl !== en) App.FN_EN[nl] = en;
  };
  const arr2 = (v) => (isRef(v) ? F.refToArray(v) : isArr(v) ? v : [[v]]);
  const val = (v) => (isRef(v) || isArr(v) ? F.deref(v) : v);
  const num = (v, d) => { if ((v === null || v === undefined) && d !== undefined) return d; v = val(v); if (v === null || v === undefined) return d !== undefined ? d : 0; return toNum(v); };
  const str = (v) => toStr(val(v));
  const bool = (v, d) => { if ((v === null || v === undefined) && d !== undefined) return d; return toBool(val(v)); };
  const anyErr = (...vs) => vs.find((v) => isErr(v)) || null;
  // Getallen uit argumenten (bereiken: alleen getallen; los: omzetten)
  const nums = (args, { text0 = false } = {}) => {
    const out = [];
    for (const a of args) {
      if (isRef(a) || isArr(a)) {
        for (const row of arr2(a)) for (const v of row) {
          if (isErr(v)) return v;
          if (typeof v === 'number') out.push(v);
          else if (text0 && typeof v === 'boolean') out.push(v ? 1 : 0);
          else if (text0 && typeof v === 'string') out.push(0);
        }
      } else if (a !== null && a !== undefined) { const n = toNum(a); if (isErr(n)) return n; out.push(n); }
    }
    return out;
  };
  const W = (fn, o) => (args) => { const n = nums(args, o); return isErr(n) ? n : fn(n); };
  const flat = (v) => arr2(v).flat();
  const width = (A) => (A[0] || []).length;
  const pad = (A, h, w, p) => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => ((A[i] || [])[j] !== undefined ? A[i][j] : p)));
  const T = (A) => A[0].map((_, j) => A.map((row) => row[j]));

  /* ---------- Dynamische matrices ---------- */
  def('FILTER', 'FILTER', 'lookup', 'matrix; opnemen; [indien_leeg]', 'Filtert een bereik op basis van voorwaarden; het resultaat loopt over naar de cellen eronder.', ([a, inc, empty]) => {
    const A = arr2(a), I = arr2(inc);
    let out;
    if (I.length === A.length && width(I) === 1) out = A.filter((_, i) => { const b = toBool(I[i][0]); return b === true; });
    else if (I.length === 1 && width(I) === width(A)) { const keep = I[0].map((x) => toBool(x) === true); out = A.map((row) => row.filter((_, j) => keep[j])); if (!out[0].length) out = []; }
    else return err('#VALUE!');
    if (!out.length) return empty !== undefined && empty !== null ? val(empty) : err('#CALC!');
    return out;
  });
  const sortRows = (A, keys) => A.map((row, i) => ({ row, i })).sort((x, y) => {
    for (const k of keys) { const d = F.cmpVals(k.col[x.i], k.col[y.i]); if (d) return d * k.ord; }
    return x.i - y.i;
  }).map((o) => o.row);
  def('SORT', 'SORTEREN', 'lookup', 'matrix; [sorteerindex]; [sorteervolgorde]; [op_kolom]', 'Sorteert een bereik (1 = oplopend, -1 = aflopend).', ([a, idx, ord, byCol]) => {
    let A = arr2(a);
    const k = num(idx, 1), o = num(ord, 1), bc = bool(byCol, false);
    if (anyErr(k, o)) return anyErr(k, o);
    if (bc) A = T(A);
    if (k < 1 || k > width(A)) return err('#VALUE!');
    let res = sortRows(A, [{ col: A.map((r) => r[k - 1]), ord: o < 0 ? -1 : 1 }]);
    if (bc) res = T(res);
    return res;
  });
  def('SORTBY', 'SORTEREN.OP', 'lookup', 'matrix; op_matrix1; [volgorde1]; …', 'Sorteert een bereik op basis van de waarden in een ander bereik.', ([a, ...rest]) => {
    const A = arr2(a);
    const keys = [];
    for (let k = 0; k < rest.length; k += 2) {
      const col = flat(rest[k]);
      if (col.length !== A.length) return err('#VALUE!');
      keys.push({ col, ord: num(rest[k + 1], 1) < 0 ? -1 : 1 });
    }
    return sortRows(A, keys);
  });
  def('UNIQUE', 'UNIEK', 'lookup', 'matrix; [op_kolom]; [exact_eenmaal]', 'Geeft de unieke waarden uit een bereik.', ([a, byCol, once]) => {
    let A = arr2(a);
    const bc = bool(byCol, false), one = bool(once, false);
    if (bc) A = T(A);
    const key = (row) => row.map((v) => (typeof v === 'string' ? 's' + v.toLowerCase() : JSON.stringify(v))).join('\u0001');
    const cnt = new Map();
    A.forEach((row) => { const k = key(row); cnt.set(k, (cnt.get(k) || 0) + 1); });
    const seen = new Set();
    let out = A.filter((row) => { const k = key(row); if (seen.has(k)) return false; seen.add(k); return !one || cnt.get(k) === 1; });
    if (!out.length) return err('#CALC!');
    if (bc) out = T(out);
    return out;
  });
  def('SEQUENCE', 'REEKS', 'math', 'rijen; [kolommen]; [begin]; [stap]', 'Maakt een lijst met opeenvolgende getallen.', ([r, c, st, sp]) => {
    const R = num(r), C = num(c, 1), S = num(st, 1), P = num(sp, 1);
    if (anyErr(R, C, S, P)) return anyErr(R, C, S, P);
    if (R < 1 || C < 1 || R * C > 1e6) return err('#VALUE!');
    return Array.from({ length: Math.floor(R) }, (_, i) => Array.from({ length: Math.floor(C) }, (_, j) => S + (i * Math.floor(C) + j) * P));
  });
  def('RANDARRAY', 'ASELECT.MATRIX', 'math', '[rijen]; [kolommen]; [min]; [max]; [geheel_getal]', 'Matrix met willekeurige getallen.', ([r, c, lo, hi, whole]) => {
    const R = num(r, 1), C = num(c, 1), L = num(lo, 0), H = num(hi, 1), wh = bool(whole, false);
    if (anyErr(R, C, L, H)) return anyErr(R, C, L, H);
    return Array.from({ length: R }, () => Array.from({ length: C }, () => (wh ? Math.floor(Math.random() * (Math.floor(H) - Math.ceil(L) + 1)) + Math.ceil(L) : L + Math.random() * (H - L))));
  });
  def('VSTACK', 'VERT.STAPELEN', 'lookup', 'matrix1; [matrix2]; …', 'Plaatst bereiken onder elkaar.', (args) => {
    const As = args.map(arr2); const w = Math.max(...As.map(width));
    return As.flatMap((A) => pad(A, A.length, w, err('#N/A')));
  });
  def('HSTACK', 'HOR.STAPELEN', 'lookup', 'matrix1; [matrix2]; …', 'Plaatst bereiken naast elkaar.', (args) => {
    const As = args.map(arr2); const h = Math.max(...As.map((A) => A.length));
    const P = As.map((A) => pad(A, h, width(A), err('#N/A')));
    return Array.from({ length: h }, (_, i) => P.flatMap((A) => A[i]));
  });
  const takeDrop = (take) => ([a, r, c]) => {
    let A = arr2(a);
    const R = r === null || r === undefined ? null : num(r), C = c === null || c === undefined ? null : num(c);
    if (anyErr(R, C)) return anyErr(R, C);
    const cut = (len, n) => (n === null ? [0, len] : take ? (n >= 0 ? [0, Math.min(len, n)] : [Math.max(0, len + n), len]) : (n >= 0 ? [Math.min(len, n), len] : [0, Math.max(0, len + n)]));
    const [r1, r2] = cut(A.length, R); A = A.slice(r1, r2);
    if (!A.length) return err('#CALC!');
    const [c1, c2] = cut(width(A), C); A = A.map((row) => row.slice(c1, c2));
    return width(A) ? A : err('#CALC!');
  };
  def('TAKE', 'NEMEN', 'lookup', 'matrix; rijen; [kolommen]', 'Neemt rijen of kolommen vanaf het begin (of eind bij negatief getal).', takeDrop(true));
  def('DROP', 'WEGLATEN', 'lookup', 'matrix; rijen; [kolommen]', 'Laat rijen of kolommen weg aan het begin (of eind bij negatief getal).', takeDrop(false));
  const choose = (cols) => ([a, ...idx]) => {
    let A = arr2(a); if (cols) A = T(A);
    const out = [];
    for (const x of idx.flatMap(flat)) { const n = toNum(x); if (isErr(n)) return n; const i = n < 0 ? A.length + n : n - 1; if (!A[i]) return err('#VALUE!'); out.push(A[i]); }
    return cols ? T(out) : out;
  };
  def('CHOOSECOLS', 'KIES.KOLOMMEN', 'lookup', 'matrix; kolom_getal1; [kolom_getal2]; …', 'Geeft de opgegeven kolommen uit een bereik.', choose(true));
  def('CHOOSEROWS', 'KIES.RIJEN', 'lookup', 'matrix; rij_getal1; [rij_getal2]; …', 'Geeft de opgegeven rijen uit een bereik.', choose(false));
  const toLine = (asRow) => ([a, ign, byCol]) => {
    let A = arr2(a); if (bool(byCol, false)) A = T(A);
    const ig = num(ign, 0);
    const out = A.flat().filter((v) => !((ig === 1 || ig === 3) && (v === null || v === '')) && !((ig === 2 || ig === 3) && isErr(v)));
    if (!out.length) return err('#CALC!');
    return asRow ? [out.map((v) => (v === null ? 0 : v))] : out.map((v) => [v === null ? 0 : v]);
  };
  def('TOCOL', 'NAAR.KOLOM', 'lookup', 'matrix; [negeren]; [scannen_op_kolom]', 'Zet een bereik om in één kolom.', toLine(false));
  def('TOROW', 'NAAR.RIJ', 'lookup', 'matrix; [negeren]; [scannen_op_kolom]', 'Zet een bereik om in één rij.', toLine(true));
  const wrap = (rows) => ([v, n, p]) => {
    const L = flat(v), k = num(n); if (isErr(k)) return k; if (k < 1) return err('#NUM!');
    const pv = p === undefined || p === null ? err('#N/A') : val(p);
    const out = []; for (let i = 0; i < L.length; i += k) out.push(L.slice(i, i + k));
    const P = pad(out, out.length, k, pv);
    return rows ? P : T(P);
  };
  def('WRAPROWS', 'OMLOOP.RIJEN', 'lookup', 'vector; aantal; [opvullen_met]', 'Verdeelt een lijst over rijen.', wrap(true));
  def('WRAPCOLS', 'OMLOOP.KOLOMMEN', 'lookup', 'vector; aantal; [opvullen_met]', 'Verdeelt een lijst over kolommen.', wrap(false));
  def('EXPAND', 'UITBREIDEN', 'lookup', 'matrix; rijen; [kolommen]; [opvullen_met]', 'Vergroot een bereik tot de opgegeven afmetingen.', ([a, r, c, p]) => {
    const A = arr2(a); const R = num(r, A.length), C = num(c, width(A));
    if (anyErr(R, C)) return anyErr(R, C);
    if (R < A.length || C < width(A)) return err('#VALUE!');
    return pad(A, R, C, p === undefined || p === null ? err('#N/A') : val(p));
  });
  def('TEXTSPLIT', 'TEKST.SPLITSEN', 'text', 'tekst; kolom_scheidingsteken; [rij_scheidingsteken]; [leeg_negeren]; [overeenkomstmodus]; [opvullen_met]', 'Splitst tekst over kolommen en/of rijen.', ([t, cd, rd, ign, mm, p]) => {
    const s = str(t);
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ci = num(mm, 0) === 1 ? 'i' : '';
    const mk = (d) => { const list = d === undefined || d === null ? [] : flat(d).map(toStr).filter((x) => x !== ''); return list.length ? new RegExp(list.map(esc).join('|'), ci) : null; };
    const cre = mk(cd), rre = mk(rd);
    let rows = rre ? s.split(rre) : [s];
    const ig = bool(ign, false);
    if (ig) rows = rows.filter((x) => x !== '');
    let out = rows.map((r) => { let cs = cre ? r.split(cre) : [r]; if (ig) cs = cs.filter((x) => x !== ''); return cs; });
    const w = Math.max(...out.map((r) => r.length));
    return pad(out, out.length, w, p === undefined || p === null ? err('#N/A') : val(p));
  });
  def('ARRAYTOTEXT', 'ARRAYTOTEXT', 'text', 'matrix; [notatie]', 'Zet een bereik om in tekst.', ([a, f]) => {
    const A = arr2(a), strict = num(f, 0) === 1;
    const t = (v) => (strict && typeof v === 'string' ? '"' + v + '"' : toStr(v === null ? '' : v));
    return strict ? '{' + A.map((r) => r.map(t).join(',')).join(';') + '}' : A.flat().map(t).join(', ');
  });
  def('VALUETOTEXT', 'VALUETOTEXT', 'text', 'waarde; [notatie]', 'Zet een waarde om in tekst.', ([a, f]) => { const v = val(a); return num(f, 0) === 1 && typeof v === 'string' ? '"' + v + '"' : toStr(v === null ? '' : v); });

  /* ---------- LET, LAMBDA en helpers ---------- */
  def('LET', 'LET', 'logic', 'naam1; waarde1; [naam2; waarde2]; …; berekening', 'Geeft namen aan tussenresultaten binnen een formule.', (a, ctx, ev) => {
    if (a.length < 3 || a.length % 2 === 0) return err('#VALUE!');
    const vars = { ...(ctx.vars || {}) };
    for (let k = 0; k + 1 < a.length; k += 2) {
      if (a[k].k !== 'name') return err('#NAME?');
      vars[a[k].v.toUpperCase()] = ev(a[k + 1], { ...ctx, vars });
    }
    return ev(a[a.length - 1], { ...ctx, vars });
  }, { lazy: true });
  def('LAMBDA', 'LAMBDA', 'logic', '[parameter1; …]; berekening', 'Maakt een eigen herbruikbare functie (bijv. als naam in Namen beheren).', (a, ctx) => {
    if (!a.length) return err('#VALUE!');
    const params = a.slice(0, -1).map((x) => (x.k === 'name' ? x.v.toUpperCase() : null));
    if (params.some((x) => !x)) return err('#VALUE!');
    return { lambda: true, params, body: a[a.length - 1], ctx };
  }, { lazy: true });
  const lam = (f) => (f && f.lambda ? f : null);
  def('MAP', 'KAART', 'logic', 'matrix1; [matrix2]; …; lambda', 'Past een LAMBDA toe op elke waarde.', (args) => {
    const fn = lam(args[args.length - 1]); if (!fn) return err('#VALUE!');
    const As = args.slice(0, -1).map(arr2);
    return As[0].map((row, i) => row.map((_, j) => F.deref(F.callLambda(fn, As.map((A) => (A[i] || [])[j] ?? null)))));
  });
  def('REDUCE', 'REDUCE', 'logic', '[beginwaarde]; matrix; lambda', 'Brengt een bereik terug tot één waarde met een LAMBDA.', ([init, a, f]) => {
    const fn = lam(f); if (!fn) return err('#VALUE!');
    let acc = val(init) ?? 0;
    for (const v of flat(a)) acc = F.deref(F.callLambda(fn, [acc, v]));
    return acc;
  });
  def('SCAN', 'SCAN', 'logic', '[beginwaarde]; matrix; lambda', 'Geeft alle tussenresultaten van een LAMBDA.', ([init, a, f]) => {
    const fn = lam(f); if (!fn) return err('#VALUE!');
    let acc = val(init) ?? 0;
    return arr2(a).map((row) => row.map((v) => (acc = F.deref(F.callLambda(fn, [acc, v])))));
  });
  def('BYROW', 'BYROW', 'logic', 'matrix; lambda', 'Past een LAMBDA toe op elke rij.', ([a, f]) => { const fn = lam(f); if (!fn) return err('#VALUE!'); return arr2(a).map((row) => [F.deref(F.callLambda(fn, [[row]]))]); });
  def('BYCOL', 'BYCOL', 'logic', 'matrix; lambda', 'Past een LAMBDA toe op elke kolom.', ([a, f]) => { const fn = lam(f); if (!fn) return err('#VALUE!'); return [T(arr2(a)).map((col) => F.deref(F.callLambda(fn, [col.map((v) => [v])])))]; });
  def('MAKEARRAY', 'MAKEARRAY', 'logic', 'rijen; kolommen; lambda', 'Maakt een matrix met een LAMBDA(rij; kolom).', ([r, c, f]) => {
    const fn = lam(f); const R = num(r), C = num(c); if (!fn || anyErr(R, C)) return err('#VALUE!');
    return Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => F.deref(F.callLambda(fn, [i + 1, j + 1]))));
  });
  def('ISOMITTED', 'ISOMITTED', 'info', 'argument', 'WAAR als een LAMBDA-argument is weggelaten.', ([a]) => a === null || a === undefined);

  /* ---------- Wiskunde ---------- */
  const m1 = (fn) => ([a]) => { const n = num(a); if (isErr(n)) return n; const r = fn(n); return typeof r === 'number' && !isFinite(r) ? err('#NUM!') : r; };
  def('ACOSH', 'BOOGCOSH', 'math', 'getal', 'Inverse cosinus hyperbolicus.', m1(Math.acosh));
  def('ASINH', 'BOOGSINH', 'math', 'getal', 'Inverse sinus hyperbolicus.', m1(Math.asinh));
  def('ATANH', 'BOOGTANH', 'math', 'getal', 'Inverse tangens hyperbolicus.', m1(Math.atanh));
  def('ACOT', 'BOOGCOT', 'math', 'getal', 'Boogcotangens.', m1((x) => Math.PI / 2 - Math.atan(x)));
  def('ACOTH', 'BOOGCOTH', 'math', 'getal', 'Inverse cotangens hyperbolicus.', m1((x) => 0.5 * Math.log((x + 1) / (x - 1))));
  def('COSH', 'COSH', 'math', 'getal', 'Cosinus hyperbolicus.', m1(Math.cosh));
  def('SINH', 'SINH', 'math', 'getal', 'Sinus hyperbolicus.', m1(Math.sinh));
  def('TANH', 'TANH', 'math', 'getal', 'Tangens hyperbolicus.', m1(Math.tanh));
  def('COT', 'COT', 'math', 'getal', 'Cotangens.', m1((x) => (x === 0 ? Infinity : 1 / Math.tan(x))));
  def('COTH', 'COTH', 'math', 'getal', 'Cotangens hyperbolicus.', m1((x) => 1 / Math.tanh(x)));
  def('CSC', 'COSEC', 'math', 'getal', 'Cosecans.', m1((x) => 1 / Math.sin(x)));
  def('CSCH', 'COSECH', 'math', 'getal', 'Cosecans hyperbolicus.', m1((x) => 1 / Math.sinh(x)));
  def('SEC', 'SEC', 'math', 'getal', 'Secans.', m1((x) => 1 / Math.cos(x)));
  def('SECH', 'SECH', 'math', 'getal', 'Secans hyperbolicus.', m1((x) => 1 / Math.cosh(x)));
  def('SQRTPI', 'WORTEL.PI', 'math', 'getal', 'Wortel van getal × pi.', m1((x) => (x < 0 ? NaN : Math.sqrt(x * Math.PI))));
  const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
  def('COMBIN', 'COMBINATIES', 'math', 'getal; aantal_gekozen', 'Aantal combinaties zonder herhaling.', ([a, b]) => { const n = num(a), k = num(b); if (anyErr(n, k)) return anyErr(n, k); return n < 0 || k < 0 || k > n ? err('#NUM!') : comb(Math.floor(n), Math.floor(k)); });
  def('COMBINA', 'COMBIN.A', 'math', 'getal; aantal_gekozen', 'Aantal combinaties met herhaling.', ([a, b]) => { const n = num(a), k = num(b); if (anyErr(n, k)) return anyErr(n, k); return comb(Math.floor(n) + Math.floor(k) - 1, Math.floor(k)); });
  def('PERMUT', 'PERMUTATIES', 'stat', 'getal; aantal_gekozen', 'Aantal permutaties.', ([a, b]) => { const n = Math.floor(num(a)), k = Math.floor(num(b)); if (isNaN(n) || isNaN(k)) return err('#VALUE!'); return k > n || k < 0 ? err('#NUM!') : fact(n) / fact(n - k); });
  def('PERMUTATIONA', 'PERMUTATIE.A', 'stat', 'getal; aantal_gekozen', 'Aantal permutaties met herhaling.', ([a, b]) => { const n = num(a), k = num(b); if (anyErr(n, k)) return anyErr(n, k); return Math.pow(Math.floor(n), Math.floor(k)); });
  def('FACTDOUBLE', 'DUBBELE.FACULTEIT', 'math', 'getal', 'Dubbele faculteit.', m1((n) => { n = Math.floor(n); if (n < -1) return NaN; let f = 1; for (let i = n; i > 1; i -= 2) f *= i; return f; }));
  def('MULTINOMIAL', 'MULTINOMIAAL', 'math', 'getal1; [getal2]; …', 'Multinomiaal van een reeks getallen.', W((n) => fact(n.reduce((a, b) => a + Math.floor(b), 0)) / n.reduce((a, b) => a * fact(Math.floor(b)), 1)));
  const ROM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  def('ROMAN', 'ROMEINS', 'math', 'getal; [vorm]', 'Zet een getal om in Romeinse cijfers.', ([a]) => { let n = Math.floor(num(a)); if (isNaN(n)) return err('#VALUE!'); if (n < 0 || n > 3999) return err('#VALUE!'); let s = ''; for (const [v, r] of ROM) while (n >= v) { s += r; n -= v; } return s; });
  def('ARABIC', 'ARABISCH', 'math', 'tekst', 'Zet Romeinse cijfers om in een getal.', ([a]) => { const s = str(a).toUpperCase().trim(); const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let t = 0; for (let i = 0; i < s.length; i++) { const v = map[s[i]], nx = map[s[i + 1]]; if (!v) return err('#VALUE!'); t += nx > v ? -v : v; } return t; });
  def('BASE', 'BASIS', 'math', 'getal; grondtal; [minimale_lengte]', 'Zet een getal om naar een ander talstelsel.', ([a, b, c]) => { const n = num(a), r = num(b), l = num(c, 0); if (anyErr(n, r, l)) return anyErr(n, r, l); if (r < 2 || r > 36 || n < 0) return err('#NUM!'); return Math.floor(n).toString(r).toUpperCase().padStart(l, '0'); });
  def('DECIMAL', 'DECIMAAL', 'math', 'tekst; grondtal', 'Zet tekst in een talstelsel om naar een getal.', ([a, b]) => { const r = num(b); const v = parseInt(str(a), r); return isNaN(v) ? err('#NUM!') : v; });
  const pairs2 = (a, b) => { const X = flat(a), Y = flat(b); if (X.length !== Y.length) return err('#N/A'); const p = []; X.forEach((x, i) => { if (typeof x === 'number' && typeof Y[i] === 'number') p.push([x, Y[i]]); }); return p; };
  def('SUMX2MY2', 'SOM.X2MINY2', 'math', 'x-matrix; y-matrix', 'Som van x² − y².', ([a, b]) => { const p = pairs2(a, b); return isErr(p) ? p : p.reduce((s, [x, y]) => s + x * x - y * y, 0); });
  def('SUMX2PY2', 'SOM.X2PLUSY2', 'math', 'x-matrix; y-matrix', 'Som van x² + y².', ([a, b]) => { const p = pairs2(a, b); return isErr(p) ? p : p.reduce((s, [x, y]) => s + x * x + y * y, 0); });
  def('SUMXMY2', 'SOM.XMINY.2', 'math', 'x-matrix; y-matrix', 'Som van (x − y)².', ([a, b]) => { const p = pairs2(a, b); return isErr(p) ? p : p.reduce((s, [x, y]) => s + (x - y) ** 2, 0); });
  const matNum = (a) => { const A = arr2(a); for (const r of A) for (const v of r) if (typeof v !== 'number') return null; return A; };
  const det = (M) => { const n = M.length; const A = M.map((r) => [...r]); let d = 1; for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; if (!A[p][i]) return 0; if (p !== i) { [A[p], A[i]] = [A[i], A[p]]; d = -d; } d *= A[i][i]; for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < n; j++) A[k][j] -= f * A[i][j]; } } return d; };
  def('MDETERM', 'DETERMINANTMAT', 'math', 'matrix', 'Determinant van een matrix.', ([a]) => { const M = matNum(a); if (!M || M.length !== width(M)) return err('#VALUE!'); return det(M); });
  def('MINVERSE', 'INVERSEMAT', 'math', 'matrix', 'Inverse van een matrix.', ([a]) => {
    const M = matNum(a); if (!M || M.length !== width(M)) return err('#VALUE!');
    const n = M.length; const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; if (Math.abs(A[p][i]) < 1e-14) return err('#NUM!'); [A[p], A[i]] = [A[i], A[p]]; const d = A[i][i]; for (let j = 0; j < 2 * n; j++) A[i][j] /= d; for (let k = 0; k < n; k++) if (k !== i) { const f = A[k][i]; for (let j = 0; j < 2 * n; j++) A[k][j] -= f * A[i][j]; } }
    return A.map((r) => r.slice(n));
  });
  def('MMULT', 'PRODUCTMAT', 'math', 'matrix1; matrix2', 'Matrixproduct van twee bereiken.', ([a, b]) => { const A = matNum(a), B = matNum(b); if (!A || !B || width(A) !== B.length) return err('#VALUE!'); return A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0))); });
  def('MUNIT', 'EENHEIDMAT', 'math', 'dimensie', 'Eenheidsmatrix.', ([a]) => { const n = num(a); if (isErr(n) || n < 1) return err('#VALUE!'); return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); });
  const AGG = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV.S', 8: 'STDEV.P', 9: 'SUM', 10: 'VAR.S', 11: 'VAR.P', 12: 'MEDIAN', 13: 'MODE.SNGL', 14: 'LARGE', 15: 'SMALL', 16: 'PERCENTILE.INC', 17: 'QUARTILE.INC', 18: 'PERCENTILE.EXC', 19: 'QUARTILE.EXC' };
  def('AGGREGATE', 'AGGREGAAT', 'math', 'functie; opties; ref1; [ref2]; …', 'Statistiek met de keuze om fouten en verborgen rijen te negeren.', ([f, o, ...rest]) => {
    const fn = AGG[num(f)]; if (!fn) return err('#VALUE!');
    const opt = num(o, 0);
    const skipErr = [2, 3, 6, 7].includes(opt), skipHidden = [1, 3, 5, 7].includes(opt);
    const clean = (a) => (isRef(a) || isArr(a) ? arr2(isRef(a) && skipHidden ? { ...a } : a).filter((_, i) => !(skipHidden && isRef(a) && (a.sh.hidR[a.r1 + i] || a.sh.fhid[a.r1 + i]))).map((row) => row.map((v) => (skipErr && isErr(v) ? null : v))) : a);
    const args = num(f) >= 14 ? [clean(rest[0]), rest[1]] : rest.map(clean);
    return App.FN[fn].fn(args);
  });
  def('ISO.CEILING', 'ISO.AFRONDEN.BOVEN', 'math', 'getal; [significantie]', 'Rondt naar boven af op een veelvoud.', ([a, b]) => { const n = num(a), s = Math.abs(num(b, 1)); if (anyErr(n, s)) return anyErr(n, s); return s ? Math.ceil(n / s) * s : 0; });
  def('CEILING.PRECISE', 'AFRONDEN.BOVEN.NAUWKEURIG', 'math', 'getal; [significantie]', 'Rondt naar boven af op een veelvoud.', ([a, b]) => { const n = num(a), s = Math.abs(num(b, 1)); if (anyErr(n, s)) return anyErr(n, s); return s ? Math.ceil(n / s) * s : 0; });
  def('FLOOR.PRECISE', 'AFRONDEN.BENEDEN.NAUWKEURIG', 'math', 'getal; [significantie]', 'Rondt naar beneden af op een veelvoud.', ([a, b]) => { const n = num(a), s = Math.abs(num(b, 1)); if (anyErr(n, s)) return anyErr(n, s); return s ? Math.floor(n / s) * s : 0; });
  def('SERIESSUM', 'SOM.MACHTREEKS', 'math', 'x; n; m; coëfficiënten', 'Som van een machtreeks.', ([x, n, m, c]) => { const X = num(x), N = num(n), M = num(m); const C = nums([c]); if (isErr(C)) return C; return C.reduce((s, a, i) => s + a * Math.pow(X, N + i * M), 0); });

  /* ---------- Statistiek ---------- */
  const mean = (n) => n.reduce((a, b) => a + b, 0) / n.length;
  const vari = (n, pop) => { if (n.length < (pop ? 1 : 2)) return err('#DIV/0!'); const m = mean(n); return n.reduce((a, b) => a + (b - m) ** 2, 0) / (n.length - (pop ? 0 : 1)); };
  def('AVEDEV', 'GEM.DEVIATIE', 'stat', 'getal1; [getal2]; …', 'Gemiddelde absolute afwijking.', W((n) => { if (!n.length) return err('#NUM!'); const m = mean(n); return mean(n.map((x) => Math.abs(x - m))); }));
  def('DEVSQ', 'DEV.KWAD', 'stat', 'getal1; [getal2]; …', 'Som van kwadraten van afwijkingen.', W((n) => { const m = mean(n); return n.reduce((a, b) => a + (b - m) ** 2, 0); }));
  def('KURT', 'KURTOSIS', 'stat', 'getal1; [getal2]; …', 'Kurtosis (welving).', W((n) => { const N = n.length; if (N < 4) return err('#DIV/0!'); const m = mean(n), s = Math.sqrt(vari(n, false)); const k = n.reduce((a, b) => a + ((b - m) / s) ** 4, 0); return (N * (N + 1)) / ((N - 1) * (N - 2) * (N - 3)) * k - (3 * (N - 1) ** 2) / ((N - 2) * (N - 3)); }));
  def('SKEW', 'SCHEEFHEID', 'stat', 'getal1; [getal2]; …', 'Scheefheid van een verdeling.', W((n) => { const N = n.length; if (N < 3) return err('#DIV/0!'); const m = mean(n), s = Math.sqrt(vari(n, false)); return N / ((N - 1) * (N - 2)) * n.reduce((a, b) => a + ((b - m) / s) ** 3, 0); }));
  def('SKEW.P', 'SCHEEFHEID.P', 'stat', 'getal1; [getal2]; …', 'Scheefheid van een populatie.', W((n) => { const m = mean(n), s = Math.sqrt(vari(n, true)); return mean(n.map((b) => ((b - m) / s) ** 3)); }));
  def('STDEVA', 'STDEVA', 'stat', 'waarde1; [waarde2]; …', 'Standaarddeviatie (steekproef); tekst telt als 0.', W((n) => { const v = vari(n, false); return isErr(v) ? v : Math.sqrt(v); }, { text0: true }));
  def('STDEVPA', 'STDEVPA', 'stat', 'waarde1; [waarde2]; …', 'Standaarddeviatie (populatie); tekst telt als 0.', W((n) => { const v = vari(n, true); return isErr(v) ? v : Math.sqrt(v); }, { text0: true }));
  def('VARA', 'VARA', 'stat', 'waarde1; [waarde2]; …', 'Variantie (steekproef); tekst telt als 0.', W((n) => vari(n, false), { text0: true }));
  def('VARPA', 'VARPA', 'stat', 'waarde1; [waarde2]; …', 'Variantie (populatie); tekst telt als 0.', W((n) => vari(n, true), { text0: true }));
  const pctExc = (n, k) => { const s = [...n].sort((a, b) => a - b); const h = (s.length + 1) * k - 1; if (h < 0 || h > s.length - 1) return err('#NUM!'); const lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
  def('PERCENTILE.EXC', 'PERCENTIEL.EXC', 'stat', 'matrix; k', 'Het k-de percentiel (exclusief).', ([a, b]) => { const n = nums([a]), k = num(b); if (anyErr(n, k)) return anyErr(n, k); return pctExc(n, k); });
  def('QUARTILE.EXC', 'KWARTIEL.EXC', 'stat', 'matrix; kwartiel', 'Kwartiel (exclusief).', ([a, b]) => { const n = nums([a]), q = num(b); if (anyErr(n, q)) return anyErr(n, q); return pctExc(n, q / 4); });
  const pctRank = (exc) => ([a, x, sig]) => {
    const n = nums([a]); const X = num(x); const d = num(sig, 3); if (anyErr(n, X)) return anyErr(n, X);
    const s = [...n].sort((p, q) => p - q); if (!s.length || X < s[0] || X > s[s.length - 1]) return err('#N/A');
    let lo = 0; while (lo < s.length - 1 && s[lo + 1] <= X) lo++;
    let r;
    const below = s.filter((v) => v < X).length;
    if (s[lo] === X) r = exc ? (below + 1) / (s.length + 1) : below / (s.length - 1);
    else { const f = (X - s[lo]) / (s[lo + 1] - s[lo]); r = exc ? (lo + 1 + f) / (s.length + 1) : (lo + f) / (s.length - 1); }
    const p = 10 ** d; return Math.floor(r * p + 1e-9) / p;
  };
  def('PERCENTRANK', 'PERCENT.RANG', 'stat', 'matrix; x; [significantie]', 'Rang als percentage.', pctRank(false));
  def('PERCENTRANK.INC', 'PROCENTRANG.INC', 'stat', 'matrix; x; [significantie]', 'Rang als percentage (inclusief).', pctRank(false));
  def('PERCENTRANK.EXC', 'PROCENTRANG.EXC', 'stat', 'matrix; x; [significantie]', 'Rang als percentage (exclusief).', pctRank(true));
  def('RANK.AVG', 'RANG.GEMIDDELDE', 'stat', 'getal; verw; [volgorde]', 'Rang; bij gelijke waarden het gemiddelde.', ([a, b, c]) => { const x = num(a), n = nums([b]); if (anyErr(x, n)) return anyErr(x, n); const asc = num(c, 0); const eq = n.filter((v) => v === x).length; if (!eq) return err('#N/A'); const better = n.filter((v) => (asc ? v < x : v > x)).length; return better + (eq + 1) / 2; });
  def('MODE.MULT', 'MODUS.MEERV', 'stat', 'getal1; [getal2]; …', 'Alle meest voorkomende waarden (loopt over).', W((n) => { const c = new Map(); n.forEach((x) => c.set(x, (c.get(x) || 0) + 1)); const mx = Math.max(...c.values()); if (mx < 2) return err('#N/A'); return [...c.entries()].filter(([, k]) => k === mx).map(([v]) => [v]); }));
  def('HARMEAN', 'HARM.GEM', 'stat', 'getal1; [getal2]; …', 'Harmonisch gemiddelde.', W((n) => (!n.length || n.some((x) => x <= 0) ? err('#NUM!') : n.length / n.reduce((a, b) => a + 1 / b, 0))));
  def('TRIMMEAN', 'GETRIMD.GEM', 'stat', 'matrix; percentage', 'Gemiddelde zonder de uiterste waarden.', ([a, p]) => { const n = nums([a]), P = num(p); if (anyErr(n, P)) return anyErr(n, P); if (P < 0 || P >= 1) return err('#NUM!'); const s = [...n].sort((x, y) => x - y); const k = Math.floor(s.length * P / 2); const t = s.slice(k, s.length - k); return mean(t); });
  // normale verdeling
  const erf = (x) => { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? y : -y; };
  const ncdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const npdf = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const ninv = (p) => {
    if (p <= 0 || p >= 1) return NaN;
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  const normDist = ([x, m, s, c]) => { const X = num(x), M = num(m), S = num(s), C = bool(c, true); if (anyErr(X, M, S)) return anyErr(X, M, S); if (S <= 0) return err('#NUM!'); const z = (X - M) / S; return C ? ncdf(z) : npdf(z) / S; };
  const normInv = ([p, m, s]) => { const P = num(p), M = num(m), S = num(s); if (anyErr(P, M, S)) return anyErr(P, M, S); if (P <= 0 || P >= 1 || S <= 0) return err('#NUM!'); return M + S * ninv(P); };
  def('NORM.DIST', 'NORM.VERD.N', 'stat', 'x; gemiddelde; standaarddev; cumulatief', 'Normale verdeling.', normDist);
  def('NORMDIST', 'NORM.VERD', 'stat', 'x; gemiddelde; standaarddev; cumulatief', 'Normale verdeling.', normDist);
  def('NORM.INV', 'NORM.INV.N', 'stat', 'kans; gemiddelde; standaarddev', 'Inverse van de normale verdeling.', normInv);
  def('NORMINV', 'NORM.INV', 'stat', 'kans; gemiddelde; standaarddev', 'Inverse van de normale verdeling.', normInv);
  def('NORM.S.DIST', 'NORM.S.VERD', 'stat', 'z; cumulatief', 'Standaardnormale verdeling.', ([z, c]) => { const Z = num(z); if (isErr(Z)) return Z; return bool(c, true) ? ncdf(Z) : npdf(Z); });
  def('NORMSDIST', 'STAND.NORM.VERD', 'stat', 'z', 'Standaardnormale verdeling (cumulatief).', ([z]) => { const Z = num(z); return isErr(Z) ? Z : ncdf(Z); });
  def('NORM.S.INV', 'NORM.S.INV', 'stat', 'kans', 'Inverse van de standaardnormale verdeling.', ([p]) => { const P = num(p); if (isErr(P)) return P; return P <= 0 || P >= 1 ? err('#NUM!') : ninv(P); });
  def('NORMSINV', 'STAND.NORM.INV', 'stat', 'kans', 'Inverse van de standaardnormale verdeling.', ([p]) => { const P = num(p); if (isErr(P)) return P; return P <= 0 || P >= 1 ? err('#NUM!') : ninv(P); });
  def('STANDARDIZE', 'NORMALISEREN', 'stat', 'x; gemiddelde; standaarddev', 'Genormaliseerde waarde (z-score).', ([x, m, s]) => { const X = num(x), M = num(m), S = num(s); if (anyErr(X, M, S)) return anyErr(X, M, S); return S <= 0 ? err('#NUM!') : (X - M) / S; });
  def('PHI', 'PHI', 'stat', 'x', 'Dichtheid van de standaardnormale verdeling.', m1(npdf));
  def('GAUSS', 'GAUSS', 'stat', 'z', 'Kans tussen het gemiddelde en z standaarddeviaties.', m1((z) => ncdf(z) - 0.5));
  const conf = ([a, s, n]) => { const A = num(a), S = num(s), N = num(n); if (anyErr(A, S, N)) return anyErr(A, S, N); return ninv(1 - A / 2) * S / Math.sqrt(N); };
  def('CONFIDENCE.NORM', 'BETROUWBAARHEID.NORM', 'stat', 'alfa; standaarddev; grootte', 'Betrouwbaarheidsinterval (normale verdeling).', conf);
  def('CONFIDENCE', 'BETROUWBAARHEID', 'stat', 'alfa; standaarddev; grootte', 'Betrouwbaarheidsinterval.', conf);
  const cov = (pop) => ([a, b]) => { const p = pairs2(a, b); if (isErr(p)) return p; const n = p.length; if (n < (pop ? 1 : 2)) return err('#DIV/0!'); const mx = mean(p.map((x) => x[0])), my = mean(p.map((x) => x[1])); return p.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / (n - (pop ? 0 : 1)); };
  def('COVARIANCE.P', 'COVARIANTIE.P', 'stat', 'matrix1; matrix2', 'Covariantie (populatie).', cov(true));
  def('COVARIANCE.S', 'COVARIANTIE.S', 'stat', 'matrix1; matrix2', 'Covariantie (steekproef).', cov(false));
  def('COVAR', 'COVARIANTIE', 'stat', 'matrix1; matrix2', 'Covariantie.', cov(true));
  const lin = (ya, xa) => { const p = pairs2(xa, ya); if (isErr(p)) return p; const n = p.length; const mx = mean(p.map((x) => x[0])), my = mean(p.map((x) => x[1])); let sxy = 0, sxx = 0, syy = 0; p.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }); const b = sxy / sxx; return { n, b, a: my - b * mx, r: sxy / Math.sqrt(sxx * syy), sxx, syy, sxy }; };
  def('PEARSON', 'PEARSON', 'stat', 'matrix1; matrix2', 'Correlatiecoëfficiënt van Pearson.', ([a, b]) => { const l = lin(b, a); return isErr(l) ? l : isFinite(l.r) ? l.r : err('#DIV/0!'); });
  def('RSQ', 'R.KWADRAAT', 'stat', 'y-bekend; x-bekend', 'Kwadraat van de correlatiecoëfficiënt.', ([a, b]) => { const l = lin(a, b); return isErr(l) ? l : isFinite(l.r) ? l.r * l.r : err('#DIV/0!'); });
  def('STEYX', 'STAND.FOUT.YX', 'stat', 'y-bekend; x-bekend', 'Standaardfout van de voorspelde y-waarde.', ([a, b]) => { const l = lin(a, b); if (isErr(l)) return l; if (l.n < 3) return err('#DIV/0!'); return Math.sqrt((l.syy - l.sxy * l.sxy / l.sxx) / (l.n - 2)); });
  def('TREND', 'TREND', 'stat', 'y-bekend; [x-bekend]; [x-nieuw]; [const]', 'Waarden volgens een lineaire trend (loopt over).', ([ya, xa, xn]) => {
    const Y = flat(ya); const X = xa === undefined || xa === null ? Y.map((_, i) => i + 1) : flat(xa);
    const l = lin(Y.map((v) => [v]), X.map((v) => [v])); if (isErr(l)) return l;
    const N = xn === undefined || xn === null ? arr2(xa === undefined || xa === null ? [X.map((v) => v)] : xa) : arr2(xn);
    const res = N.map((row) => row.map((x) => l.a + l.b * x));
    return xa === undefined || xa === null ? res[0].map((v) => [v]) : res;
  });
  def('GROWTH', 'GROEI', 'stat', 'y-bekend; [x-bekend]; [x-nieuw]', 'Waarden volgens een exponentiële groei (loopt over).', ([ya, xa, xn]) => {
    const Y = flat(ya); if (Y.some((v) => !(v > 0))) return err('#NUM!');
    const X = xa === undefined || xa === null ? Y.map((_, i) => i + 1) : flat(xa);
    const l = lin(Y.map((v) => [Math.log(v)]), X.map((v) => [v])); if (isErr(l)) return l;
    const N = xn === undefined || xn === null ? X.map((v) => [v]) : arr2(xn);
    return N.map((row) => row.map((x) => Math.exp(l.a + l.b * x)));
  });
  def('LINEST', 'LIJNSCH', 'stat', 'y-bekend; [x-bekend]', 'Richting en snijpunt van de regressielijn (loopt over).', ([ya, xa]) => { const Y = flat(ya); const X = xa === undefined || xa === null ? Y.map((_, i) => i + 1) : flat(xa); const l = lin(Y.map((v) => [v]), X.map((v) => [v])); return isErr(l) ? l : [[l.b, l.a]]; });
  def('FREQUENCY', 'INTERVAL', 'stat', 'gegevensmatrix; interval_verw', 'Telt hoe vaak waarden binnen intervallen vallen (loopt over).', ([a, b]) => { const n = nums([a]), bins = nums([b]); if (anyErr(n, bins)) return anyErr(n, bins); const s = [...bins].sort((x, y) => x - y); const out = new Array(s.length + 1).fill(0); n.forEach((v) => { let i = s.findIndex((x) => v <= x); if (i < 0) i = s.length; out[i]++; }); const order = bins.map((x) => s.indexOf(x)); return order.map((i) => [out[i]]).concat([[out[s.length]]]); });
  // gamma, beta
  const lgamma = (x) => { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x); x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < g + 2; i++) a += c[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); };
  const gammaFn = (x) => (x > 0 ? Math.exp(lgamma(x)) : Math.PI / (Math.sin(Math.PI * x) * Math.exp(lgamma(1 - x))));
  def('GAMMA', 'GAMMA', 'stat', 'getal', 'Gammafunctie.', m1((x) => (x <= 0 && Number.isInteger(x) ? NaN : gammaFn(x))));
  def('GAMMALN', 'GAMMA.LN', 'stat', 'x', 'Natuurlijke logaritme van de gammafunctie.', m1((x) => (x <= 0 ? NaN : lgamma(x))));
  def('GAMMALN.PRECISE', 'GAMMA.LN.NAUWKEURIG', 'stat', 'x', 'Natuurlijke logaritme van de gammafunctie.', m1((x) => (x <= 0 ? NaN : lgamma(x))));
  def('FISHER', 'FISHER', 'stat', 'x', 'Fisher-transformatie.', m1((x) => (Math.abs(x) >= 1 ? NaN : 0.5 * Math.log((1 + x) / (1 - x)))));
  def('FISHERINV', 'FISHER.INV', 'stat', 'y', 'Inverse van de Fisher-transformatie.', m1((y) => (Math.exp(2 * y) - 1) / (Math.exp(2 * y) + 1)));
  const betacf = (a, b, x) => { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; };
  const ibeta = (x, a, b) => { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
  const igamma = (a, x) => { if (x <= 0) return 0; if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); } let b = x + 1 - a, c = 1 / 1e-30, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30; c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; } return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h; };
  const tcdf = (t, df) => { const x = df / (df + t * t); const p = 0.5 * ibeta(x, df / 2, 0.5); return t > 0 ? 1 - p : p; };
  const tpdf = (t, df) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2);
  const bisect = (f, target, lo, hi) => { for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; } return (lo + hi) / 2; };
  def('T.DIST', 'T.VERD', 'stat', 'x; vrijheidsgraden; cumulatief', 'Student t-verdeling (linkszijdig).', ([x, d, c]) => { const X = num(x), D = num(d); if (anyErr(X, D)) return anyErr(X, D); if (D < 1) return err('#NUM!'); return bool(c, true) ? tcdf(X, D) : tpdf(X, D); });
  def('T.DIST.RT', 'T.VERD.RECHTS', 'stat', 'x; vrijheidsgraden', 'Student t-verdeling (rechtszijdig).', ([x, d]) => { const X = num(x), D = num(d); if (anyErr(X, D)) return anyErr(X, D); return 1 - tcdf(X, D); });
  def('T.DIST.2T', 'T.VERD.2T', 'stat', 'x; vrijheidsgraden', 'Student t-verdeling (tweezijdig).', ([x, d]) => { const X = num(x), D = num(d); if (anyErr(X, D)) return anyErr(X, D); if (X < 0) return err('#NUM!'); return 2 * (1 - tcdf(X, D)); });
  def('T.INV', 'T.INV', 'stat', 'kans; vrijheidsgraden', 'Inverse van de t-verdeling (linkszijdig).', ([p, d]) => { const P = num(p), D = num(d); if (anyErr(P, D)) return anyErr(P, D); if (P <= 0 || P >= 1) return err('#NUM!'); return bisect((t) => tcdf(t, D), P, -1e3, 1e3); });
  def('T.INV.2T', 'T.INV.2T', 'stat', 'kans; vrijheidsgraden', 'Inverse van de t-verdeling (tweezijdig).', ([p, d]) => { const P = num(p), D = num(d); if (anyErr(P, D)) return anyErr(P, D); if (P <= 0 || P > 1) return err('#NUM!'); return bisect((t) => tcdf(t, D), 1 - P / 2, -1e3, 1e3); });
  def('T.TEST', 'T.TEST', 'stat', 'matrix1; matrix2; zijden; type', 'Kans bij een t-toets (type 1 gepaard, 2 gelijke variantie, 3 ongelijke).', ([a, b, t, ty]) => {
    const A = nums([a]), B = nums([b]); const tails = num(t), type = num(ty); if (anyErr(A, B)) return anyErr(A, B);
    let tv, df;
    if (type === 1) { if (A.length !== B.length) return err('#N/A'); const d = A.map((x, i) => x - B[i]); const sd = Math.sqrt(vari(d, false)); tv = mean(d) / (sd / Math.sqrt(d.length)); df = d.length - 1; }
    else if (type === 2) { const n1 = A.length, n2 = B.length; const sp = ((n1 - 1) * vari(A, false) + (n2 - 1) * vari(B, false)) / (n1 + n2 - 2); tv = (mean(A) - mean(B)) / Math.sqrt(sp * (1 / n1 + 1 / n2)); df = n1 + n2 - 2; }
    else { const v1 = vari(A, false) / A.length, v2 = vari(B, false) / B.length; tv = (mean(A) - mean(B)) / Math.sqrt(v1 + v2); df = (v1 + v2) ** 2 / (v1 * v1 / (A.length - 1) + v2 * v2 / (B.length - 1)); }
    const p = 1 - tcdf(Math.abs(tv), df); return tails === 1 ? p : 2 * p;
  });
  def('CHISQ.DIST', 'CHIKW.VERD', 'stat', 'x; vrijheidsgraden; cumulatief', 'Chi-kwadraatverdeling.', ([x, d, c]) => { const X = num(x), D = num(d); if (anyErr(X, D)) return anyErr(X, D); return bool(c, true) ? igamma(D / 2, X / 2) : Math.exp((D / 2 - 1) * Math.log(X) - X / 2 - (D / 2) * Math.log(2) - lgamma(D / 2)); });
  def('CHISQ.DIST.RT', 'CHIKW.VERD.RECHTS', 'stat', 'x; vrijheidsgraden', 'Chi-kwadraatverdeling (rechtszijdig).', ([x, d]) => { const X = num(x), D = num(d); if (anyErr(X, D)) return anyErr(X, D); return 1 - igamma(D / 2, X / 2); });
  def('CHISQ.INV.RT', 'CHIKW.INV.RECHTS', 'stat', 'kans; vrijheidsgraden', 'Inverse van de rechtszijdige chi-kwadraatverdeling.', ([p, d]) => { const P = num(p), D = num(d); if (anyErr(P, D)) return anyErr(P, D); return bisect((x) => -(1 - igamma(D / 2, x / 2)), -P, 0, 1e4); });
  def('F.DIST.RT', 'F.VERD.RECHTS', 'stat', 'x; vrijheidsgraden1; vrijheidsgraden2', 'F-verdeling (rechtszijdig).', ([x, a, b]) => { const X = num(x), A = num(a), B = num(b); if (anyErr(X, A, B)) return anyErr(X, A, B); return 1 - ibeta(A * X / (A * X + B), A / 2, B / 2); });
  def('BINOM.DIST', 'BINOM.VERD', 'stat', 'aantal_gunstig; experimenten; kans_gunstig; cumulatief', 'Binomiale verdeling.', ([k, n, p, c]) => { const K = Math.floor(num(k)), N = Math.floor(num(n)), P = num(p); if (isNaN(K) || isNaN(N) || anyErr(P)) return err('#VALUE!'); if (K < 0 || K > N || P < 0 || P > 1) return err('#NUM!'); const f = (i) => comb(N, i) * P ** i * (1 - P) ** (N - i); if (!bool(c, false)) return f(K); let s = 0; for (let i = 0; i <= K; i++) s += f(i); return s; });
  App.FN.BINOMDIST = App.FN['BINOM.DIST'];
  def('POISSON.DIST', 'POISSON.VERD', 'stat', 'x; gemiddelde; cumulatief', 'Poissonverdeling.', ([x, m, c]) => { const X = Math.floor(num(x)), M = num(m); if (isNaN(X) || anyErr(M)) return err('#VALUE!'); if (X < 0 || M < 0) return err('#NUM!'); const f = (k) => Math.exp(-M + k * Math.log(M || 1e-300) - lgamma(k + 1)); if (!bool(c, false)) return f(X); let s = 0; for (let k = 0; k <= X; k++) s += f(k); return s; });
  def('POISSON', 'POISSON', 'stat', 'x; gemiddelde; cumulatief', 'Poissonverdeling.', (a) => App.FN['POISSON.DIST'].fn(a));
  def('EXPON.DIST', 'EXPON.VERD.N', 'stat', 'x; lambda; cumulatief', 'Exponentiële verdeling.', ([x, l, c]) => { const X = num(x), L = num(l); if (anyErr(X, L)) return anyErr(X, L); if (X < 0 || L <= 0) return err('#NUM!'); return bool(c, true) ? 1 - Math.exp(-L * X) : L * Math.exp(-L * X); });
  def('EXPONDIST', 'EXPON.VERD', 'stat', 'x; lambda; cumulatief', 'Exponentiële verdeling.', (a) => App.FN['EXPON.DIST'].fn(a));

  /* ---------- Tekst ---------- */
  def('DOLLAR', 'EURO', 'text', 'getal; [decimalen]', 'Zet een getal om in tekst met valutanotatie.', ([a, b]) => { const n = num(a), d = num(b, 2); if (anyErr(n, d)) return anyErr(n, d); const dd = Math.max(0, d); const f = 10 ** d; const r = Math.round(n * f) / f; return NF.format(r, `"€" #,##0${dd ? '.' + '0'.repeat(dd) : ''};"€" -#,##0${dd ? '.' + '0'.repeat(dd) : ''}`).text; });
  // Patronen met geneste herhaling, zoals (a+)+ of (\d*)*, kunnen de browser minutenlang laten vastlopen (catastrofaal terugkeren); die weigeren we.
  const unsafeRe = (p) => {
    let depth = 0; const q = [false];   // per groepsniveau: bevat de groep een herhaling?
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (ch === '\\') { i++; continue; }
      if (ch === '[') { i++; while (i < p.length && p[i] !== ']') { if (p[i] === '\\') i++; i++; } continue; }
      if (ch === '(') { depth++; q[depth] = false; continue; }
      if (ch === ')') { if (!depth) return true; const inner = q[depth]; depth--; const next = p[i + 1]; if (inner && (next === '+' || next === '*' || next === '{')) return true; if (inner) q[depth] = true; continue; }
      if (ch === '+' || ch === '*' || ch === '{') q[depth] = true;
    }
    return false;
  };
  const mkRe = (p, ci, g) => { if (p.length > 1000 || unsafeRe(p)) return null; try { return new RegExp(p, (ci ? 'i' : '') + (g ? 'g' : '')); } catch { return null; } };
  def('REGEXTEST', 'REGEXTEST', 'text', 'tekst; patroon; [hoofdlettergevoeligheid]', 'WAAR als de tekst overeenkomt met een reguliere expressie.', ([t, p, c]) => { const re = mkRe(str(p), num(c, 0) === 1); return re ? re.test(str(t)) : err('#VALUE!'); });
  def('REGEXEXTRACT', 'REGEXEXTRAHEREN', 'text', 'tekst; patroon; [retourmodus]; [hoofdlettergevoeligheid]', 'Haalt tekst op die overeenkomt met een reguliere expressie (0 eerste, 1 alle, 2 groepen).', ([t, p, m, c]) => {
    const mode = num(m, 0); const re = mkRe(str(p), num(c, 0) === 1, mode === 1); if (!re) return err('#VALUE!');
    const s = str(t);
    if (mode === 1) { const all = s.match(re); return all ? all.map((x) => [x]) : err('#N/A'); }
    const mm = re.exec(s); if (!mm) return err('#N/A');
    return mode === 2 ? [mm.slice(1)] : mm[0];
  });
  def('REGEXREPLACE', 'REGEXVERVANGEN', 'text', 'tekst; patroon; vervanging; [instantie]; [hoofdlettergevoeligheid]', 'Vervangt tekst met een reguliere expressie.', ([t, p, r, o, c]) => {
    const occ = num(o, 0); const re = mkRe(str(p), num(c, 0) === 1, true); if (!re) return err('#VALUE!');
    const rep = str(r);
    if (!occ) return str(t).replace(re, rep);
    let k = 0; const all = [...str(t).matchAll(re)]; const target = occ > 0 ? occ : all.length + occ + 1;
    return str(t).replace(re, (...m) => (++k === target ? m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), rep) : m[0]));
  });
  def('ENCODEURL', 'URL.CODEREN', 'text', 'tekst', 'Codeert tekst voor gebruik in een internetadres.', ([a]) => encodeURIComponent(str(a)));

  /* ---------- Datum ---------- */
  const ymd = (n) => { const d = NF.serialToDate(n); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() }; };
  def('DAYS360', 'DAGEN360', 'date', 'begindatum; einddatum; [methode]', 'Aantal dagen tussen twee datums op basis van 360 dagen per jaar.', ([a, b, m]) => {
    const s = num(a), e = num(b); if (anyErr(s, e)) return anyErr(s, e);
    const A = ymd(s), B = ymd(e); const eu = bool(m, false);
    let d1 = A.d, d2 = B.d;
    if (eu) { if (d1 === 31) d1 = 30; if (d2 === 31) d2 = 30; }
    else { const lastFeb = (x) => x.m === 2 && x.d === new Date(Date.UTC(x.y, 2, 0)).getUTCDate(); if (lastFeb(A)) d1 = 30; if (d1 >= 30 && d2 === 31) d2 = 30; if (d1 === 31) d1 = 30; }
    return (B.y - A.y) * 360 + (B.m - A.m) * 30 + d2 - d1;
  });
  const weekendMask = (w) => {
    if (w === null || w === undefined) return [0, 0, 0, 0, 0, 1, 1];
    const v = val(w);
    if (typeof v === 'string' && /^[01]{7}$/.test(v)) return v.split('').map(Number);
    const n = toNum(v);
    const pairs = { 1: [5, 6], 2: [6, 0], 3: [0, 1], 4: [1, 2], 5: [2, 3], 6: [3, 4], 7: [4, 5] };
    const m = [0, 0, 0, 0, 0, 0, 0];
    if (pairs[n]) pairs[n].forEach((i) => { m[i] = 1; }); else if (n >= 11 && n <= 17) m[n - 11] = 1; else return null;
    return m;
  };
  const isWork = (d, mask, hol) => mask[(ymd(d).wd + 6) % 7] === 0 && !hol.has(d);
  const hols = (h) => { const s = new Set(); if (h !== undefined && h !== null) flat(h).forEach((v) => { if (typeof v === 'number') s.add(Math.floor(v)); }); return s; };
  def('NETWORKDAYS.INTL', 'NETWERKDAGEN.INTL', 'date', 'begindatum; einddatum; [weekend]; [vakantiedagen]', 'Werkdagen tussen twee datums met een zelf te kiezen weekend.', ([a, b, w, h]) => {
    let s = Math.floor(num(a)), e = Math.floor(num(b)); const mask = weekendMask(w); if (!mask) return err('#NUM!');
    const sign = e < s ? -1 : 1; if (sign < 0) [s, e] = [e, s];
    const H = hols(h); let k = 0; for (let d = s; d <= e; d++) if (isWork(d, mask, H)) k++;
    return k * sign;
  });
  def('WORKDAY.INTL', 'WERKDAG.INTL', 'date', 'begindatum; dagen; [weekend]; [vakantiedagen]', 'Datum een aantal werkdagen verder met een zelf te kiezen weekend.', ([a, b, w, h]) => {
    let d = Math.floor(num(a)); const n = num(b); const mask = weekendMask(w); if (!mask || mask.every(Boolean)) return err('#NUM!');
    const H = hols(h); let left = Math.abs(Math.trunc(n)); const st = n < 0 ? -1 : 1;
    while (left > 0) { d += st; if (isWork(d, mask, H)) left--; }
    return d;
  });

  /* ---------- Informatie ---------- */
  def('CELL', 'CEL', 'info', 'infotype; [verw]', 'Informatie over een cel ("adres", "kolom", "rij", "inhoud", "type", "bestandsnaam", "notatie").', ([t, r], ctx) => {
    const type = str(t).toLowerCase();
    const ref = isRef(r) ? r : F.mkRef(ctx.sh, ctx.r, ctx.c, ctx.r, ctx.c);
    const cell = App.getCell(ref.sh, ref.r1, ref.c1);
    switch (type) {
      case 'address': case 'adres': return '$' + App.colName(ref.c1) + '$' + (ref.r1 + 1);
      case 'col': case 'kolom': return ref.c1 + 1;
      case 'row': case 'rij': return ref.r1 + 1;
      case 'contents': case 'inhoud': return F.cellValue(ref.sh, ref.r1, ref.c1) ?? 0;
      case 'type': return !cell || !App.hasValue(cell) ? 'b' : typeof App.valueOf(cell) === 'string' ? 'l' : 'v';
      case 'filename': case 'bestandsnaam': return '[' + App.book.title + ']' + ref.sh.name;
      case 'format': case 'notatie': { const nf = App.styleAt(ref.sh, ref.r1, ref.c1).nf || 'General'; return nf === 'General' ? 'G' : /%/.test(nf) ? 'P' + ((/\.(0+)/.exec(nf) || [, ''])[1].length) : NF.isDateFmt(nf) ? 'D1' : /€|\$/.test(nf) ? 'C2' : 'F' + ((/\.(0+)/.exec(nf) || [, ''])[1].length); }
      case 'width': case 'breedte': return Math.round(App.pxToChars ? App.pxToChars(App.colW(ref.c1, ref.sh)) : 8);
      default: return err('#VALUE!');
    }
  });
  def('ERROR.TYPE', 'TYPE.FOUT', 'info', 'foutwaarde', 'Nummer van een foutwaarde.', ([a]) => { const v = val(a); if (!isErr(v)) return err('#N/A'); return { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7, '#SPILL!': 9, '#CALC!': 14 }[v.err] || err('#N/A'); });
  def('SHEET', 'BLAD', 'info', '[waarde]', 'Bladnummer.', ([a], ctx) => { if (isRef(a)) return App.book.sheets.indexOf(a.sh) + 1; if (typeof a === 'string') { const s = App.sheetByName(a); return s ? App.book.sheets.indexOf(s) + 1 : err('#NA'); } return App.book.sheets.indexOf(ctx.sh) + 1; });
  def('SHEETS', 'BLADEN', 'info', '[verw]', 'Aantal bladen.', ([a]) => (isRef(a) ? 1 : App.book.sheets.length));
  def('AREAS', 'BEREIKEN', 'lookup', 'verw', 'Aantal bereiken in een verwijzing.', ([a]) => (isRef(a) ? 1 : err('#VALUE!')));
  def('INFO', 'INFO', 'info', 'type_tekst', 'Informatie over de omgeving ("directory", "numfile", "osversion", "release", "system").', ([a]) => ({ numfile: App.book.sheets.length, release: '16.0', system: 'pcdos', osversion: 'Windows', directory: '', recalc: App.book.calc === 'auto' ? 'Automatisch' : 'Handmatig' }[str(a).toLowerCase()] ?? err('#VALUE!')));

  /* ---------- Financieel ---------- */
  const fin = (args, n) => { const o = []; for (let i = 0; i < n; i++) { const v = num(args[i], 0); if (isErr(v)) return v; o.push(v); } return o; };
  const pmt = (r, n, pv, fv = 0, t = 0) => (r === 0 ? -(pv + fv) / n : -(r * (fv + pv * (1 + r) ** n)) / ((1 + r * t) * ((1 + r) ** n - 1)));
  const fvf = (r, n, p, pv = 0, t = 0) => (r === 0 ? -(pv + p * n) : -(pv * (1 + r) ** n + p * (1 + r * t) * ((1 + r) ** n - 1) / r));
  const ipmt = (r, per, n, pv, fv = 0, t = 0) => { const p = pmt(r, n, pv, fv, t); let i = -fvf(r, per - 1, p, pv, t) * r; if (t === 1) { if (per === 1) return 0; i /= 1 + r; } return i; };
  def('DB', 'DB', 'fin', 'kosten; restwaarde; duur; termijn; [maand]', 'Afschrijving met de vaste-degressieve methode.', (a) => {
    const x = fin(a, 4); if (isErr(x)) return x; const [c, s, l, p] = x; const m = num(a[4], 12);
    const rate = Math.round((1 - (s / c) ** (1 / l)) * 1000) / 1000;
    let tot = 0, dep = 0;
    for (let i = 1; i <= p; i++) { dep = i === 1 ? c * rate * m / 12 : i === l + 1 ? (c - tot) * rate * (12 - m) / 12 : (c - tot) * rate; tot += dep; }
    return dep;
  });
  const ddb = (c, s, l, p, f = 2) => { let tot = 0, dep = 0; for (let i = 1; i <= p; i++) { dep = Math.min((c - tot) * f / l, Math.max(0, c - s - tot)); tot += dep; } return dep; };
  def('DDB', 'DDB', 'fin', 'kosten; restwaarde; duur; termijn; [factor]', 'Afschrijving met de dubbel-degressieve methode.', (a) => { const x = fin(a, 4); if (isErr(x)) return x; return ddb(...x, num(a[4], 2)); });
  def('SYD', 'SYD', 'fin', 'kosten; restwaarde; duur; termijn', 'Afschrijving met de sum-of-years-digits-methode.', (a) => { const x = fin(a, 4); if (isErr(x)) return x; const [c, s, l, p] = x; return (c - s) * (l - p + 1) * 2 / (l * (l + 1)); });
  def('VDB', 'VDB', 'fin', 'kosten; restwaarde; duur; begin_termijn; einde_termijn; [factor]; [geen_omschakeling]', 'Afschrijving over een periode (variabel degressief).', (a) => {
    const x = fin(a, 5); if (isErr(x)) return x; const [c, s, l, st, en] = x; const f = num(a[5], 2), noSw = bool(a[6], false);
    let book = c, tot = 0;
    for (let p = 1; p <= Math.ceil(en); p++) {
      const d = book * f / l; const sl = (book - s) / (l - p + 1);
      let dep = !noSw && sl > d ? sl : d; dep = Math.max(0, Math.min(dep, book - s));
      const frac = Math.min(p, en) - Math.max(p - 1, st);
      if (frac > 0) tot += dep * frac;
      book -= dep;
    }
    return tot;
  });
  def('EFFECT', 'EFFECT.RENTE', 'fin', 'nominale_rente; termijnen_per_jaar', 'Effectieve jaarrente.', (a) => { const x = fin(a, 2); if (isErr(x)) return x; const [r, n] = x; return n < 1 ? err('#NUM!') : (1 + r / Math.floor(n)) ** Math.floor(n) - 1; });
  def('NOMINAL', 'NOMINALE.RENTE', 'fin', 'effectieve_rente; termijnen_per_jaar', 'Nominale jaarrente.', (a) => { const x = fin(a, 2); if (isErr(x)) return x; const [r, n] = x; return n < 1 ? err('#NUM!') : Math.floor(n) * ((1 + r) ** (1 / Math.floor(n)) - 1); });
  def('CUMIPMT', 'CUM.RENTE', 'fin', 'rente; aantal_termijnen; hw; begin_termijn; einde_termijn; type_getal', 'Totaal betaalde rente over een periode.', (a) => { const x = fin(a, 6); if (isErr(x)) return x; const [r, n, pv, s, e, t] = x; let tot = 0; for (let p = s; p <= e; p++) tot += ipmt(r, p, n, pv, 0, t); return tot; });
  def('CUMPRINC', 'CUM.HOOFDSOM', 'fin', 'rente; aantal_termijnen; hw; begin_termijn; einde_termijn; type_getal', 'Totaal afgeloste hoofdsom over een periode.', (a) => { const x = fin(a, 6); if (isErr(x)) return x; const [r, n, pv, s, e, t] = x; let tot = 0; const p0 = pmt(r, n, pv, 0, t); for (let p = s; p <= e; p++) tot += p0 - ipmt(r, p, n, pv, 0, t); return tot; });
  const xnpv = (r, V, D) => V.reduce((s, v, i) => s + v / (1 + r) ** ((D[i] - D[0]) / 365), 0);
  def('XNPV', 'NHW2', 'fin', 'rente; waarden; datums', 'Netto huidige waarde voor onregelmatige kasstromen.', ([r, v, d]) => { const R = num(r); const V = nums([v]), D = nums([d]); if (anyErr(R, V, D)) return anyErr(R, V, D); return V.length !== D.length ? err('#NUM!') : xnpv(R, V, D); });
  def('XIRR', 'IR.SCHEMA', 'fin', 'waarden; datums; [schatting]', 'Interne rentabiliteit voor onregelmatige kasstromen.', ([v, d, g]) => {
    const V = nums([v]), D = nums([d]); if (anyErr(V, D)) return anyErr(V, D);
    let r = num(g, 0.1);
    for (let i = 0; i < 200; i++) { const f = xnpv(r, V, D); const df = (xnpv(r + 1e-7, V, D) - f) / 1e-7; if (!df) break; const nr = r - f / df; if (Math.abs(nr - r) < 1e-12) return nr; r = nr; }
    return isFinite(r) ? r : err('#NUM!');
  });
  def('MIRR', 'GIR', 'fin', 'waarden; financieringsrente; herinvesteringsrente', 'Gewijzigde interne rentabiliteit.', ([v, f, re]) => {
    const V = nums([v]); const fr = num(f), rr = num(re); if (anyErr(V, fr, rr)) return anyErr(V, fr, rr);
    const n = V.length;
    const pos = V.reduce((s, x, i) => s + (x > 0 ? x * (1 + rr) ** (n - 1 - i) : 0), 0);
    const neg = V.reduce((s, x, i) => s + (x < 0 ? x / (1 + fr) ** i : 0), 0);
    return !neg || !pos ? err('#DIV/0!') : (pos / -neg) ** (1 / (n - 1)) - 1;
  });
  def('PDURATION', 'PDUUR', 'fin', 'rente; hw; tw', 'Aantal termijnen om een bepaalde waarde te bereiken.', (a) => { const x = fin(a, 3); if (isErr(x)) return x; const [r, pv, fv] = x; return r <= 0 || pv <= 0 || fv <= 0 ? err('#NUM!') : (Math.log(fv) - Math.log(pv)) / Math.log(1 + r); });
  def('RRI', 'RRI', 'fin', 'aantal_termijnen; hw; tw', 'Gelijkwaardige rente voor de groei van een investering.', (a) => { const x = fin(a, 3); if (isErr(x)) return x; const [n, pv, fv] = x; return n <= 0 ? err('#NUM!') : (fv / pv) ** (1 / n) - 1; });
  def('FVSCHEDULE', 'TOEK.WAARDE2', 'fin', 'hoofdsom; rentepercentages', 'Toekomstige waarde met een reeks rentepercentages.', ([p, s]) => { const P = num(p); const S = nums([s]); if (anyErr(P, S)) return anyErr(P, S); return S.reduce((acc, r) => acc * (1 + r), P); });
  def('ISPMT', 'ISBET', 'fin', 'rente; termijn; aantal_termijnen; hw', 'Rente voor een termijn bij een lineaire lening.', (a) => { const x = fin(a, 4); if (isErr(x)) return x; const [r, per, n, pv] = x; return pv * r * (per / n - 1); });

  /* ---------- Technisch ---------- */
  const toBase = (n, base, places, bits = 10) => {
    if (!Number.isInteger(n)) n = Math.trunc(n);
    const lim = base ** bits / 2;
    if (n < -lim || n >= lim) return err('#NUM!');
    let s = (n < 0 ? base ** bits + n : n).toString(base).toUpperCase();
    if (places !== null && places !== undefined) { if (n < 0) return s; const p = toNum(val(places)); if (isErr(p)) return p; if (s.length > p) return err('#NUM!'); s = s.padStart(p, '0'); }
    return s;
  };
  const fromBase = (s, base) => { s = toStr(val(s)).trim(); if (!s) return 0; if (s.length > 10 || !new RegExp('^[' + '0123456789ABCDEF'.slice(0, base) + ']+$', 'i').test(s)) return err('#NUM!'); let n = parseInt(s, base); if (s.length === 10 && n >= base ** 10 / 2) n -= base ** 10; return n; };
  const B = { BIN: 2, OCT: 8, DEC: 10, HEX: 16 };
  const NLB = { BIN: 'BIN', OCT: 'OCT', DEC: 'DEC', HEX: 'HEX' };
  Object.keys(B).forEach((from) => Object.keys(B).forEach((to) => {
    if (from === to) return;
    def(`${from}2${to}`, `${NLB[from]}.N.${NLB[to]}`, 'eng', to === 'DEC' ? 'getal' : 'getal; [aantal_tekens]', `Zet een ${from.toLowerCase()}-getal om naar ${to.toLowerCase()}.`, ([a, p]) => {
      const n = from === 'DEC' ? toNum(val(a)) : fromBase(a, B[from]);
      if (isErr(n)) return n;
      return to === 'DEC' ? n : toBase(n, B[to], p);
    });
  }));
  App.FN_CATS.eng = 'Technisch';
  App.FN_CATS.db = 'Database';
  App.FN_CATS.web = 'Web';
  const UNITS = {
    m: ['len', 1, true], in: ['len', 0.0254], ft: ['len', 0.3048], yd: ['len', 0.9144], mi: ['len', 1609.344], Nmi: ['len', 1852], ang: ['len', 1e-10, true], ly: ['len', 9.46073047258e15],
    g: ['mass', 1, true], lbm: ['mass', 453.59237], ozm: ['mass', 28.349523125], stone: ['mass', 6350.29318], ton: ['mass', 907184.74], u: ['mass', 1.66053906660e-24],
    l: ['vol', 1, true], L: ['vol', 1, true], tsp: ['vol', 0.00492892159375], tbs: ['vol', 0.01478676478125], oz: ['vol', 0.0295735295625], cup: ['vol', 0.2365882365], pt: ['vol', 0.473176473], qt: ['vol', 0.946352946], gal: ['vol', 3.785411784], m3: ['vol', 1000, true],
    sec: ['time', 1, true], s: ['time', 1, true], mn: ['time', 60], min: ['time', 60], hr: ['time', 3600], day: ['time', 86400], d: ['time', 86400], yr: ['time', 31557600],
    J: ['en', 1, true], cal: ['en', 4.1868, true], eV: ['en', 1.602176634e-19, true], Wh: ['en', 3600, true], BTU: ['en', 1055.05585262],
    W: ['pow', 1, true], HP: ['pow', 745.69987158227], PS: ['pow', 735.49875],
    Pa: ['pres', 1, true], atm: ['pres', 101325], bar: ['pres', 100000, true], mmHg: ['pres', 133.322387415], psi: ['pres', 6894.75729316836],
    m2: ['area', 1, true], ha: ['area', 10000], ar: ['area', 100], ft2: ['area', 0.09290304], in2: ['area', 0.00064516], mi2: ['area', 2589988.110336], uk_acre: ['area', 4046.8564224],
    'm/s': ['spd', 1, true], 'm/h': ['spd', 1 / 3600, true], 'm/hr': ['spd', 1 / 3600, true], mph: ['spd', 0.44704], kn: ['spd', 0.514444444],
    byte: ['info', 8, true], bit: ['info', 1, true],
  };
  const PFX = { Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 10, d: 0.1, c: 0.01, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18 };
  const unit = (u) => {
    if (UNITS[u]) return UNITS[u];
    for (const p of Object.keys(PFX).sort((x, y) => y.length - x.length)) if (u.startsWith(p) && UNITS[u.slice(p.length)] && UNITS[u.slice(p.length)][2]) { const b = UNITS[u.slice(p.length)]; const pow = /2$/.test(u) ? 2 : /3$/.test(u) ? 3 : 1; return [b[0], b[1] * PFX[p] ** pow]; }
    return null;
  };
  def('CONVERT', 'CONVERTEREN', 'eng', 'getal; van_eenheid; naar_eenheid', 'Zet een getal om naar een andere maateenheid, bv. "km" naar "mi" of "C" naar "F".', ([a, f, t]) => {
    const n = num(a); if (isErr(n)) return n;
    const from = str(f), to = str(t);
    const temp = { C: (x) => x, cel: (x) => x, F: (x) => (x - 32) * 5 / 9, fah: (x) => (x - 32) * 5 / 9, K: (x) => x - 273.15, kel: (x) => x - 273.15 };
    const tempBack = { C: (x) => x, cel: (x) => x, F: (x) => x * 9 / 5 + 32, fah: (x) => x * 9 / 5 + 32, K: (x) => x + 273.15, kel: (x) => x + 273.15 };
    if (temp[from] || temp[to]) return temp[from] && tempBack[to] ? tempBack[to](temp[from](n)) : err('#N/A');
    const A = unit(from), Bu = unit(to);
    if (!A || !Bu || A[0] !== Bu[0]) return err('#N/A');
    return n * A[1] / Bu[1];
  });
  def('DELTA', 'DELTA', 'eng', 'getal1; [getal2]', '1 als twee getallen gelijk zijn, anders 0.', ([a, b]) => { const x = num(a), y = num(b, 0); if (anyErr(x, y)) return anyErr(x, y); return x === y ? 1 : 0; });
  def('GESTEP', 'GROTER.DAN', 'eng', 'getal; [drempelwaarde]', '1 als het getal groter is dan of gelijk aan de drempel.', ([a, b]) => { const x = num(a), y = num(b, 0); if (anyErr(x, y)) return anyErr(x, y); return x >= y ? 1 : 0; });
  const bit = (fn) => ([a, b]) => { const x = num(a), y = num(b); if (anyErr(x, y)) return anyErr(x, y); if (x < 0 || y < 0 || x >= 2 ** 48 || y >= 2 ** 48) return err('#NUM!'); return fn(x, y); };
  def('BITAND', 'BIT.EN', 'eng', 'getal1; getal2', 'Bitsgewijze EN.', bit((x, y) => Number(BigInt(Math.floor(x)) & BigInt(Math.floor(y)))));
  def('BITOR', 'BIT.OF', 'eng', 'getal1; getal2', 'Bitsgewijze OF.', bit((x, y) => Number(BigInt(Math.floor(x)) | BigInt(Math.floor(y)))));
  def('BITXOR', 'BIT.EX.OF', 'eng', 'getal1; getal2', 'Bitsgewijze exclusieve OF.', bit((x, y) => Number(BigInt(Math.floor(x)) ^ BigInt(Math.floor(y)))));
  def('BITLSHIFT', 'BIT.VERSCHUIF.LINKS', 'eng', 'getal; verschuiving', 'Verschuift bits naar links.', ([a, b]) => { const x = num(a), y = num(b); if (anyErr(x, y)) return anyErr(x, y); return y >= 0 ? x * 2 ** y : Math.floor(x / 2 ** -y); });
  def('BITRSHIFT', 'BIT.VERSCHUIF.RECHTS', 'eng', 'getal; verschuiving', 'Verschuift bits naar rechts.', ([a, b]) => { const x = num(a), y = num(b); if (anyErr(x, y)) return anyErr(x, y); return y >= 0 ? Math.floor(x / 2 ** y) : x * 2 ** -y; });

  /* ---------- Database ---------- */
  // database: bereik met kopregel; veld: naam of nummer; criteria: bereik met kopregel (rijen = OF, kolommen = EN)
  const dbValues = (db, field, crit, numericOnly = true) => {
    const D = arr2(db), C = arr2(crit);
    if (D.length < 1 || C.length < 1) return err('#VALUE!');
    const heads = D[0].map((h) => toStr(h).toLowerCase().trim());
    let fi = null;
    if (field !== null && field !== undefined) {
      const fv = val(field);
      fi = typeof fv === 'number' ? fv - 1 : heads.indexOf(toStr(fv).toLowerCase().trim());
      if (fi < 0 || fi >= heads.length) return err('#VALUE!');
    }
    const cHeads = C[0].map((h) => heads.indexOf(toStr(h).toLowerCase().trim()));
    const conds = C.slice(1).map((row) => row.map((c, j) => (c === null || c === '' ? null : { col: cHeads[j], p: App.critFn(c) })).filter(Boolean));
    const rows = D.slice(1).filter((row) => !conds.length || conds.some((cs) => cs.every((x) => x.col >= 0 && x.p(row[x.col]))));
    if (fi === null) return rows;
    return rows.map((row) => row[fi]).filter((v) => !numericOnly || typeof v === 'number');
  };
  const DB = { DSUM: ['DBSOM', 'SUM'], DAVERAGE: ['DBGEMIDDELDE', 'AVERAGE'], DCOUNT: ['DBAANTAL', 'COUNT'], DCOUNTA: ['DBAANTALC', 'COUNTA'], DMAX: ['DBMAX', 'MAX'], DMIN: ['DBMIN', 'MIN'], DPRODUCT: ['DBPRODUCT', 'PRODUCT'], DSTDEV: ['DBSTDEV', 'STDEV.S'], DSTDEVP: ['DBSTDEVP', 'STDEV.P'], DVAR: ['DBVAR', 'VAR.S'], DVARP: ['DBVARP', 'VAR.P'] };
  Object.entries(DB).forEach(([en, [nl, base]]) => def(en, nl, 'db', 'database; veld; criteria', `${App.FN[base] ? App.FN[base].desc.replace(/\.$/, '') : base} van de records die aan de criteria voldoen.`, ([db, f, c]) => {
    const v = dbValues(db, f, c, en !== 'DCOUNTA' && en !== 'DCOUNT');
    if (isErr(v)) return v;
    if (en === 'DCOUNT' && (f === null || f === undefined)) return v.length;
    return App.FN[base].fn([[v.map((x) => x)]]);
  }));
  def('DGET', 'DBLEZEN', 'db', 'database; veld; criteria', 'Eén waarde uit een database die aan de criteria voldoet.', ([db, f, c]) => { const v = dbValues(db, f, c, false); if (isErr(v)) return v; return v.length === 1 ? v[0] : v.length ? err('#NUM!') : err('#VALUE!'); });

  /* Nieuwere functies krijgen in .xlsx een voorvoegsel */
  App.FN_XLWS = new Set(['FILTER', 'SORT']);
  ['SORTBY', 'UNIQUE', 'SEQUENCE', 'RANDARRAY', 'VSTACK', 'HSTACK', 'TAKE', 'DROP', 'CHOOSECOLS', 'CHOOSEROWS', 'TOCOL', 'TOROW', 'WRAPROWS', 'WRAPCOLS', 'EXPAND', 'TEXTSPLIT', 'ARRAYTOTEXT', 'VALUETOTEXT', 'LET', 'LAMBDA', 'MAP', 'REDUCE', 'SCAN', 'BYROW', 'BYCOL', 'MAKEARRAY', 'ISOMITTED', 'ACOT', 'ACOTH', 'COT', 'COTH', 'CSC', 'CSCH', 'SEC', 'SECH', 'COMBINA', 'PERMUTATIONA', 'ARABIC', 'BASE', 'DECIMAL', 'MUNIT', 'AGGREGATE', 'CEILING.PRECISE', 'FLOOR.PRECISE', 'SKEW.P', 'PERCENTILE.EXC', 'QUARTILE.EXC', 'PERCENTRANK.INC', 'PERCENTRANK.EXC', 'RANK.AVG', 'MODE.MULT', 'NORM.DIST', 'NORM.INV', 'NORM.S.DIST', 'NORM.S.INV', 'PHI', 'GAUSS', 'CONFIDENCE.NORM', 'COVARIANCE.P', 'COVARIANCE.S', 'GAMMA', 'GAMMALN.PRECISE', 'T.DIST', 'T.DIST.RT', 'T.DIST.2T', 'T.INV', 'T.INV.2T', 'T.TEST', 'CHISQ.DIST', 'CHISQ.DIST.RT', 'CHISQ.INV.RT', 'F.DIST.RT', 'BINOM.DIST', 'POISSON.DIST', 'EXPON.DIST', 'REGEXTEST', 'REGEXEXTRACT', 'REGEXREPLACE', 'ENCODEURL', 'DAYS360', 'NETWORKDAYS.INTL', 'WORKDAY.INTL', 'SHEET', 'SHEETS', 'PDURATION', 'RRI', 'BITAND', 'BITOR', 'BITXOR', 'BITLSHIFT', 'BITRSHIFT'].forEach((n) => App.FN_XLFN.add(n));
  void str; void bool;
})();
