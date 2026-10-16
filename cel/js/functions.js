/* =========================================================
   Cel (gemaakt door JJ van Schelven) — functiebibliotheek (Engelse en Nederlandse namen)
   ========================================================= */
'use strict';

App.FN = {};
App.FN_NL = {};   // Engels -> Nederlands
App.FN_EN = {};   // Nederlands -> Engels
App.FN_CATS = {
  fin: 'Financieel', logic: 'Logisch', text: 'Tekst', date: 'Datum en tijd',
  lookup: 'Zoeken en verwijzen', math: 'Wiskunde en trigonometrie', stat: 'Statistisch', info: 'Informatie',
};

(() => {
  const F = App.F;
  const { err, isErr, isRef, isArr, toNum, toStr, toBool } = F;
  const NF = App.NF;

  const def = (en, nl, cat, sig, desc, fn, opts = {}) => {
    App.FN[en] = { fn, cat, sig, desc, nl, ...opts };
    App.FN_NL[en] = nl;
    if (nl !== en) App.FN_EN[nl] = en;
  };

  /* ---------- Hulpjes ---------- */
  // Alle waarden uit argumenten; bij verwijzingen alleen bestaande cellen
  const each = (args, fn) => {
    for (const a of args) {
      if (isRef(a)) {
        const g = F.boundRef(a);
        let stop = false;
        // bereik met overgelopen matrixwaarden: cel voor cel lezen
        if (a.sh._spill && a.sh._spill.size && (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1) <= 250000) {
          let hasSpill = false;
          for (const k of a.sh._spill.keys()) { const r = Math.floor(k / 16384), c = k % 16384; if (App.inRange(g, r, c)) { hasSpill = true; break; } }
          if (hasSpill) {
            for (let r = g.r1; r <= g.r2 && !stop; r++) {
              if (a.skipHidden && (a.sh.fhid[r] || (a.skipHidden === 'all' && a.sh.hidR[r]))) continue;
              for (let c = g.c1; c <= g.c2; c++) { const v = F.cellValue(a.sh, r, c); if (fn(v === undefined ? null : v, false) === false) { stop = true; break; } }
            }
            if (stop) return;
            continue;
          }
        }
        App.eachInRange(a.sh, g, (r, c, cell) => {
          if (stop) return;
          if (a.skipHidden && (a.sh.fhid[r] || (a.skipHidden === 'all' && a.sh.hidR[r]) || (cell.f && /^SUBTOTAL\(/i.test(cell.f)))) return;
          const v = cell.f ? F.calcCell(a.sh, r, c, cell) : cell.v;
          if (fn(v === undefined ? null : v, false) === false) stop = true;
        });
        if (stop) return;
      } else if (isArr(a)) {
        for (const row of a) for (const v of row) if (fn(v, false) === false) return;
      } else if (fn(a, true) === false) return;
    }
  };
  const numsOf = (args, { allText = false } = {}) => {
    const out = [];
    let e = null;
    each(args, (v, direct) => {
      if (isErr(v)) { e = v; return false; }
      if (typeof v === 'number') out.push(v);
      else if (direct) {
        if (v === null) return;
        const n = toNum(v);
        if (isErr(n)) { e = n; return false; }
        out.push(n);
      } else if (allText) {
        if (typeof v === 'boolean') out.push(v ? 1 : 0);
        else if (typeof v === 'string') out.push(0);
      }
    });
    return e || out;
  };
  const withNums = (fn, opts) => (args) => { const n = numsOf(args, opts); return isErr(n) ? n : fn(n); };
  const num = (v, dflt) => {
    if (v === null || v === undefined) { if (dflt !== undefined) return dflt; }
    if (isRef(v) || isArr(v)) v = F.deref(v);
    return toNum(v);
  };
  const str = (v) => { if (isRef(v) || isArr(v)) v = F.deref(v); return toStr(v); };
  const val = (v) => (isRef(v) || isArr(v) ? F.deref(v) : v);
  const bool = (v) => toBool(val(v));
  // Argumenten die getallen moeten zijn: fout teruggeven als er een fout in zit
  const nums = (...vs) => { for (const v of vs) if (isErr(v)) return v; return null; };
  const arr2 = (v) => (isRef(v) ? F.refToArray(v) : isArr(v) ? v : [[v]]);
  const flat = (v) => arr2(v).flat();

  /* Criteria (AANTAL.ALS e.d.) */
  const wildRe = (s) => new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/~\?/g, '\u0002').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\u0001/g, '\\*').replace(/\u0002/g, '\\?') + '$', 'i');
  const crit = (c) => {
    c = val(c);
    if (typeof c === 'number') return (v) => typeof v === 'number' ? v === c : typeof v === 'string' && toNum(v) === c;
    if (typeof c === 'boolean') return (v) => v === c;
    if (isErr(c)) return (v) => isErr(v) && v.err === c.err;
    const s = String(c ?? '');
    const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(s);
    const op = m[1] || '=', rhs = m[2];
    const p = NF.parseInput(rhs);
    const isNum = rhs !== '' && typeof p.v === 'number';
    if (isNum) {
      const n = p.v;
      return (v) => {
        if (typeof v !== 'number') return op === '<>' ? true : false;
        return op === '=' ? v === n : op === '<>' ? v !== n : op === '<' ? v < n : op === '>' ? v > n : op === '<=' ? v <= n : v >= n;
      };
    }
    if (rhs === '') {
      if (op === '=') return (v) => v === null || v === '';
      if (op === '<>') return (v) => v !== null && v !== '';
    }
    if (op === '=' || op === '<>') {
      const re = /[*?]/.test(rhs) ? wildRe(rhs) : null;
      const low = rhs.toLowerCase();
      const b = /^(waar|true)$/i.test(rhs) ? true : /^(onwaar|false)$/i.test(rhs) ? false : null;
      const eq = (v) => (b !== null && typeof v === 'boolean' ? v === b : typeof v === 'string' && (re ? re.test(v) : v.toLowerCase() === low));
      return op === '=' ? eq : (v) => !eq(v);
    }
    return (v) => {
      if (typeof v !== 'string') return false;
      const cmp = F.cmpVals(v, rhs);
      return op === '<' ? cmp < 0 : op === '>' ? cmp > 0 : op === '<=' ? cmp <= 0 : cmp >= 0;
    };
  };
  // Waarden in een bereik op positie (voor SOM.ALS met somberek)
  const cellsOf = (ref) => {
    const out = [];
    if (isRef(ref)) {
      const g = F.boundRef(ref);
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) out.push({ r: r - ref.r1, c: c - ref.c1, v: F.cellValue(ref.sh, r, c) });
    } else arr2(ref).forEach((row, r) => row.forEach((v, c) => out.push({ r, c, v })));
    return out;
  };
  const valueAtOffset = (ref, dr, dc) => {
    if (isRef(ref)) { const r = ref.r1 + dr, c = ref.c1 + dc; return F.cellValue(ref.sh, r, c); }
    const a = arr2(ref); return (a[dr] || [])[dc] ?? null;
  };
  // Cellen die aan alle criteria voldoen (…ALS.VOORWAARDEN)
  const multiMatch = (pairs) => {
    if (!isRef(pairs[0]) && !isArr(pairs[0])) return err('#VALUE!');
    const first = cellsOf(pairs[0]);
    const preds = [];
    for (let k = 0; k < pairs.length; k += 2) preds.push({ ref: pairs[k], p: crit(pairs[k + 1]) });
    // sneller pad: sparse bij grote bereiken met lege cellen
    return first.filter((x) => preds.every((q, k) => q.p(k === 0 ? x.v : valueAtOffset(q.ref, x.r, x.c))));
  };

  App.critFn = (c) => crit(c);
  App.wildRe = wildRe;
  const round = (n, d) => {
    const f = 10 ** d;
    const x = Math.abs(n) * f;
    const r = Math.round(+(x).toPrecision(15));
    return Math.sign(n) * r / f;
  };

  /* ---------- Wiskunde ---------- */
  def('SUM', 'SOM', 'math', 'getal1; [getal2]; …', 'Telt alle getallen in een bereik op.', withNums((n) => n.reduce((a, b) => a + b, 0)));
  def('PRODUCT', 'PRODUCT', 'math', 'getal1; [getal2]; …', 'Vermenigvuldigt alle getallen.', withNums((n) => (n.length ? n.reduce((a, b) => a * b, 1) : 0)));
  def('SUMSQ', 'KWADRATENSOM', 'math', 'getal1; [getal2]; …', 'Som van de kwadraten.', withNums((n) => n.reduce((a, b) => a + b * b, 0)));
  def('SUMPRODUCT', 'SOMPRODUCT', 'math', 'matrix1; [matrix2]; …', 'Vermenigvuldigt overeenkomstige waarden en telt de producten op.', (args) => {
    const arrs = args.map(arr2);
    const R = arrs[0].length, C = arrs[0][0].length;
    if (arrs.some((a) => a.length !== R || a[0].length !== C)) return err('#VALUE!');
    let s = 0;
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      let p = 1;
      for (const a of arrs) { const v = a[i][j]; if (isErr(v)) return v; p *= typeof v === 'number' ? v : typeof v === 'boolean' && arrs.length === 1 ? 0 : typeof v === 'boolean' ? (v ? 1 : 0) : 0; }
      s += p;
    }
    return s;
  });
  def('ROUND', 'AFRONDEN', 'math', 'getal; aantal_decimalen', 'Rondt een getal af op het opgegeven aantal decimalen.', ([a, b]) => { const n = num(a), d = num(b, 0); return nums(n, d) || round(n, Math.trunc(d)); });
  def('ROUNDUP', 'AFRONDEN.NAAR.BOVEN', 'math', 'getal; aantal_decimalen', 'Rondt een getal af, weg van nul.', ([a, b]) => { const n = num(a), d = num(b, 0); if (nums(n, d)) return nums(n, d); const f = 10 ** Math.trunc(d); return Math.sign(n) * Math.ceil(+(Math.abs(n) * f).toPrecision(15)) / f; });
  def('ROUNDDOWN', 'AFRONDEN.NAAR.BENEDEN', 'math', 'getal; aantal_decimalen', 'Rondt een getal af, naar nul toe.', ([a, b]) => { const n = num(a), d = num(b, 0); if (nums(n, d)) return nums(n, d); const f = 10 ** Math.trunc(d); return Math.sign(n) * Math.floor(+(Math.abs(n) * f).toPrecision(15)) / f; });
  def('MROUND', 'AFRONDEN.N.VEELVOUD', 'math', 'getal; veelvoud', 'Rondt af op het dichtstbijzijnde veelvoud.', ([a, b]) => { const n = num(a), m = num(b); if (nums(n, m)) return nums(n, m); if (m === 0) return 0; if (n * m < 0) return err('#NUM!'); return round(Math.round(n / m) * m, 10); });
  def('INT', 'INTEGER', 'math', 'getal', 'Rondt naar beneden af op het dichtstbijzijnde gehele getal.', ([a]) => { const n = num(a); return isErr(n) ? n : Math.floor(n); });
  def('TRUNC', 'GEHEEL', 'math', 'getal; [aantal_decimalen]', 'Kapt een getal af tot een geheel getal.', ([a, b]) => { const n = num(a), d = num(b, 0); if (nums(n, d)) return nums(n, d); const f = 10 ** d; return Math.trunc(n * f) / f; });
  def('ABS', 'ABS', 'math', 'getal', 'Absolute waarde van een getal.', ([a]) => { const n = num(a); return isErr(n) ? n : Math.abs(n); });
  def('SQRT', 'WORTEL', 'math', 'getal', 'Vierkantswortel.', ([a]) => { const n = num(a); return isErr(n) ? n : n < 0 ? err('#NUM!') : Math.sqrt(n); });
  def('POWER', 'MACHT', 'math', 'getal; macht', 'Verheft een getal tot een macht.', ([a, b]) => { const n = num(a), p = num(b); if (nums(n, p)) return nums(n, p); if (n === 0 && p < 0) return err('#DIV/0!'); return Math.pow(n, p); });
  def('MOD', 'REST', 'math', 'getal; deler', 'Rest na deling.', ([a, b]) => { const n = num(a), d = num(b); if (nums(n, d)) return nums(n, d); if (d === 0) return err('#DIV/0!'); return n - d * Math.floor(n / d); });
  def('QUOTIENT', 'QUOTIENT', 'math', 'teller; noemer', 'Geheel deel van een deling.', ([a, b]) => { const n = num(a), d = num(b); if (nums(n, d)) return nums(n, d); return d === 0 ? err('#DIV/0!') : Math.trunc(n / d); });
  def('PI', 'PI', 'math', '', 'Het getal pi.', () => Math.PI);
  def('RAND', 'ASELECT', 'math', '', 'Willekeurig getal tussen 0 en 1 (wordt bij elke berekening vernieuwd).', () => Math.random());
  def('RANDBETWEEN', 'ASELECTTUSSEN', 'math', 'onder; boven', 'Willekeurig geheel getal tussen twee waarden.', ([a, b]) => { const lo = num(a), hi = num(b); if (nums(lo, hi)) return nums(lo, hi); return Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1)) + Math.ceil(lo); });
  const ceil = ([a, b]) => { const n = num(a), s = num(b, n < 0 ? -1 : 1); if (nums(n, s)) return nums(n, s); if (s === 0) return 0; return round(Math.ceil(+(n / s).toPrecision(15)) * s, 10); };
  const floor = ([a, b]) => { const n = num(a), s = num(b, 1); if (nums(n, s)) return nums(n, s); if (s === 0) return err('#DIV/0!'); return round(Math.floor(+(n / s).toPrecision(15)) * s, 10); };
  def('CEILING', 'AFRONDEN.BOVEN', 'math', 'getal; significantie', 'Rondt naar boven af op een veelvoud.', ceil);
  def('CEILING.MATH', 'AFRONDEN.BOVEN.WISK', 'math', 'getal; [significantie]', 'Rondt naar boven af op een veelvoud.', ([a, b]) => ceil([a, b === undefined || b === null ? 1 : Math.abs(num(b))]));
  def('FLOOR', 'AFRONDEN.BENEDEN', 'math', 'getal; significantie', 'Rondt naar beneden af op een veelvoud.', floor);
  def('FLOOR.MATH', 'AFRONDEN.BENEDEN.WISK', 'math', 'getal; [significantie]', 'Rondt naar beneden af op een veelvoud.', ([a, b]) => floor([a, b === undefined || b === null ? 1 : Math.abs(num(b))]));
  def('SIGN', 'POS.NEG', 'math', 'getal', 'Teken van een getal: 1, 0 of -1.', ([a]) => { const n = num(a); return isErr(n) ? n : Math.sign(n); });
  def('EXP', 'EXP', 'math', 'getal', 'e tot de macht getal.', ([a]) => { const n = num(a); return isErr(n) ? n : Math.exp(n); });
  def('LN', 'LN', 'math', 'getal', 'Natuurlijke logaritme.', ([a]) => { const n = num(a); return isErr(n) ? n : n <= 0 ? err('#NUM!') : Math.log(n); });
  def('LOG', 'LOG', 'math', 'getal; [grondtal]', 'Logaritme met een grondtal (standaard 10).', ([a, b]) => { const n = num(a), g = num(b, 10); if (nums(n, g)) return nums(n, g); return n <= 0 || g <= 0 ? err('#NUM!') : Math.log(n) / Math.log(g); });
  def('LOG10', 'LOG10', 'math', 'getal', 'Logaritme met grondtal 10.', ([a]) => { const n = num(a); return isErr(n) ? n : n <= 0 ? err('#NUM!') : Math.log10(n); });
  [['SIN', 'SIN', Math.sin], ['COS', 'COS', Math.cos], ['TAN', 'TAN', Math.tan], ['ASIN', 'BOOGSIN', Math.asin], ['ACOS', 'BOOGCOS', Math.acos], ['ATAN', 'BOOGTAN', Math.atan]].forEach(([en, nl, f]) => {
    def(en, nl, 'math', 'getal', `Goniometrische functie ${en.toLowerCase()} (radialen).`, ([a]) => { const n = num(a); if (isErr(n)) return n; const r = f(n); return isNaN(r) ? err('#NUM!') : r; });
  });
  def('ATAN2', 'BOOGTAN2', 'math', 'x; y', 'Boogtangens van x- en y-coördinaten.', ([a, b]) => { const x = num(a), y = num(b); return nums(x, y) || (x === 0 && y === 0 ? err('#DIV/0!') : Math.atan2(y, x)); });
  def('DEGREES', 'GRADEN', 'math', 'hoek', 'Radialen naar graden.', ([a]) => { const n = num(a); return isErr(n) ? n : n * 180 / Math.PI; });
  def('RADIANS', 'RADIALEN', 'math', 'hoek', 'Graden naar radialen.', ([a]) => { const n = num(a); return isErr(n) ? n : n * Math.PI / 180; });
  def('FACT', 'FACULTEIT', 'math', 'getal', 'Faculteit van een getal.', ([a]) => { let n = num(a); if (isErr(n)) return n; n = Math.floor(n); if (n < 0 || n > 170) return err('#NUM!'); let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; });   // 171! past niet in een getal
  const gcd2 = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  def('GCD', 'GGD', 'math', 'getal1; [getal2]; …', 'Grootste gemene deler.', withNums((n) => n.map(Math.floor).reduce(gcd2, 0)));
  def('LCM', 'KGV', 'math', 'getal1; [getal2]; …', 'Kleinste gemene veelvoud.', withNums((n) => n.map(Math.floor).reduce((a, b) => (a && b ? a * b / gcd2(a, b) : 0), 1)));
  def('EVEN', 'EVEN', 'math', 'getal', 'Rondt af naar boven op het dichtstbijzijnde even getal.', ([a]) => { const n = num(a); if (isErr(n)) return n; const r = Math.ceil(Math.abs(n) / 2) * 2; return n < 0 ? -r : r; });
  def('ODD', 'ONEVEN', 'math', 'getal', 'Rondt af naar boven op het dichtstbijzijnde oneven getal.', ([a]) => { const n = num(a); if (isErr(n)) return n; let r = Math.ceil(Math.abs(n)); if (r % 2 === 0) r++; return n < 0 ? -r : r; });
  const SUBT = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV', 8: 'STDEVP', 9: 'SUM', 10: 'VAR', 11: 'VARP' };
  def('SUBTOTAL', 'SUBTOTAAL', 'math', 'functie; ref1; [ref2]; …', 'Subtotaal (9 = som, 1 = gemiddelde, 2 = aantal …); slaat gefilterde rijen over.', ([f, ...refs]) => {
    let n = num(f); if (isErr(n)) return n;
    const fname = SUBT[n > 100 ? n - 100 : n];
    if (!fname || !App.FN[fname]) return err('#VALUE!');
    // geneste SUBTOTAAL-cellen overslaan en verborgen rijen negeren
    const clean = refs.map((r) => (isRef(r) ? { ...r, skipHidden: n > 100 ? 'all' : 'filter' } : r));
    return App.FN[fname].fn(clean);
  });

  /* ---------- Statistisch ---------- */
  def('AVERAGE', 'GEMIDDELDE', 'stat', 'getal1; [getal2]; …', 'Rekenkundig gemiddelde.', withNums((n) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : err('#DIV/0!'))));
  def('AVERAGEA', 'GEMIDDELDEA', 'stat', 'waarde1; [waarde2]; …', 'Gemiddelde; tekst telt als 0.', withNums((n) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : err('#DIV/0!')), { allText: true }));
  def('MIN', 'MIN', 'stat', 'getal1; [getal2]; …', 'Kleinste getal.', withNums((n) => (n.length ? Math.min(...n) : 0)));
  def('MAX', 'MAX', 'stat', 'getal1; [getal2]; …', 'Grootste getal.', withNums((n) => (n.length ? Math.max(...n) : 0)));
  def('MINA', 'MINA', 'stat', 'waarde1; [waarde2]; …', 'Kleinste waarde; tekst telt als 0.', withNums((n) => (n.length ? Math.min(...n) : 0), { allText: true }));
  def('MAXA', 'MAXA', 'stat', 'waarde1; [waarde2]; …', 'Grootste waarde; tekst telt als 0.', withNums((n) => (n.length ? Math.max(...n) : 0), { allText: true }));
  def('COUNT', 'AANTAL', 'stat', 'waarde1; [waarde2]; …', 'Telt het aantal cellen met getallen.', (args) => { let k = 0; each(args, (v, direct) => { if (typeof v === 'number' || (direct && v !== null && !isErr(toNum(v)) && typeof v !== 'object')) k++; }); return k; });
  def('COUNTA', 'AANTALARG', 'stat', 'waarde1; [waarde2]; …', 'Telt het aantal niet-lege cellen.', (args) => { let k = 0; each(args, (v, direct) => { if ((v !== null && v !== '') || (direct && v === '')) k++; }); return k; });
  def('COUNTBLANK', 'AANTAL.LEGE.CELLEN', 'stat', 'bereik', 'Telt het aantal lege cellen.', ([a]) => {
    if (!isRef(a)) return err('#VALUE!');
    const g = F.boundRef(a); let filled = 0;
    App.eachInRange(a.sh, g, (r, c, cell) => { const v = cell.f ? F.calcCell(a.sh, r, c, cell) : cell.v; if (v !== null && v !== undefined && v !== '') filled++; });
    return (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1) - filled;
  });
  def('COUNTIF', 'AANTAL.ALS', 'stat', 'bereik; criterium', 'Telt de cellen die aan een criterium voldoen.', ([rng, c]) => {
    const p = crit(c); let k = 0;
    if (isRef(rng) && rng.r2 - rng.r1 > 5000 && !p(null)) { each([rng], (v) => { if (p(v)) k++; }); return k; }
    cellsOf(rng).forEach((x) => { if (p(x.v)) k++; }); return k;
  });
  def('COUNTIFS', 'AANTALLEN.ALS', 'stat', 'criteriumbereik1; criterium1; …', 'Telt de cellen die aan meerdere criteria voldoen.', (args) => { const m = multiMatch(args); return isErr(m) ? m : m.length; });
  def('SUMIF', 'SOM.ALS', 'math', 'bereik; criterium; [optellen_bereik]', 'Telt de cellen op die aan een criterium voldoen.', ([rng, c, sum]) => {
    const p = crit(c); let s = 0;
    cellsOf(rng).forEach((x) => { if (p(x.v)) { const v = sum ? valueAtOffset(sum, x.r, x.c) : x.v; if (typeof v === 'number') s += v; } });
    return s;
  });
  def('SUMIFS', 'SOMMEN.ALS', 'math', 'optellen_bereik; criteriumbereik1; criterium1; …', 'Telt de cellen op die aan meerdere criteria voldoen.', ([sum, ...pairs]) => {
    const m = multiMatch(pairs); if (isErr(m)) return m;
    let s = 0; m.forEach((x) => { const v = valueAtOffset(sum, x.r, x.c); if (typeof v === 'number') s += v; }); return s;
  });
  def('AVERAGEIF', 'GEMIDDELDE.ALS', 'stat', 'bereik; criterium; [gemiddelde_bereik]', 'Gemiddelde van de cellen die aan een criterium voldoen.', ([rng, c, avg]) => {
    const p = crit(c); let s = 0, k = 0;
    cellsOf(rng).forEach((x) => { if (p(x.v)) { const v = avg ? valueAtOffset(avg, x.r, x.c) : x.v; if (typeof v === 'number') { s += v; k++; } } });
    return k ? s / k : err('#DIV/0!');
  });
  def('AVERAGEIFS', 'GEMIDDELDEN.ALS', 'stat', 'gemiddelde_bereik; criteriumbereik1; criterium1; …', 'Gemiddelde van de cellen die aan meerdere criteria voldoen.', ([avg, ...pairs]) => {
    const m = multiMatch(pairs); if (isErr(m)) return m;
    let s = 0, k = 0; m.forEach((x) => { const v = valueAtOffset(avg, x.r, x.c); if (typeof v === 'number') { s += v; k++; } }); return k ? s / k : err('#DIV/0!');
  });
  def('MAXIFS', 'MAX.ALS.VOORWAARDEN', 'stat', 'max_bereik; criteriumbereik1; criterium1; …', 'Grootste waarde die aan de criteria voldoet.', ([rng, ...pairs]) => {
    const m = multiMatch(pairs); if (isErr(m)) return m;
    const v = m.map((x) => valueAtOffset(rng, x.r, x.c)).filter((x) => typeof x === 'number'); return v.length ? Math.max(...v) : 0;
  });
  def('MINIFS', 'MIN.ALS.VOORWAARDEN', 'stat', 'min_bereik; criteriumbereik1; criterium1; …', 'Kleinste waarde die aan de criteria voldoet.', ([rng, ...pairs]) => {
    const m = multiMatch(pairs); if (isErr(m)) return m;
    const v = m.map((x) => valueAtOffset(rng, x.r, x.c)).filter((x) => typeof x === 'number'); return v.length ? Math.min(...v) : 0;
  });
  const median = (n) => { if (!n.length) return err('#NUM!'); const s = [...n].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  def('MEDIAN', 'MEDIAAN', 'stat', 'getal1; [getal2]; …', 'Mediaan (middelste waarde).', withNums(median));
  const mode = (n) => { const cnt = new Map(); let best = null, bc = 1; n.forEach((x) => { const k = (cnt.get(x) || 0) + 1; cnt.set(x, k); if (k > bc) { bc = k; best = x; } }); return best === null ? err('#N/A') : best; };
  def('MODE', 'MODUS', 'stat', 'getal1; [getal2]; …', 'Meest voorkomende waarde.', withNums(mode));
  def('MODE.SNGL', 'MODUS.ENKELV', 'stat', 'getal1; [getal2]; …', 'Meest voorkomende waarde.', withNums(mode));
  const kth = (largest) => ([a, b]) => { const n = numsOf([a]); if (isErr(n)) return n; const k = num(b); if (isErr(k)) return k; const s = [...n].sort((x, y) => (largest ? y - x : x - y)); return k < 1 || k > s.length ? err('#NUM!') : s[Math.ceil(k) - 1]; };
  def('LARGE', 'GROOTSTE', 'stat', 'matrix; k', 'De k-de grootste waarde.', kth(true));
  def('SMALL', 'KLEINSTE', 'stat', 'matrix; k', 'De k-de kleinste waarde.', kth(false));
  const rank = ([a, b, c]) => { const x = num(a); if (isErr(x)) return x; const n = numsOf([b]); if (isErr(n)) return n; const asc = num(c, 0); if (!n.includes(x)) return err('#N/A'); return 1 + n.filter((v) => (asc ? v < x : v > x)).length; };
  def('RANK', 'RANG', 'stat', 'getal; verw; [volgorde]', 'Rangnummer van een getal in een lijst.', rank);
  def('RANK.EQ', 'RANG.GELIJK', 'stat', 'getal; verw; [volgorde]', 'Rangnummer van een getal in een lijst.', rank);
  const variance = (n, pop) => { if (n.length < (pop ? 1 : 2)) return err('#DIV/0!'); const m = n.reduce((a, b) => a + b, 0) / n.length; return n.reduce((a, b) => a + (b - m) ** 2, 0) / (n.length - (pop ? 0 : 1)); };
  def('VAR', 'VAR', 'stat', 'getal1; [getal2]; …', 'Variantie (steekproef).', withNums((n) => variance(n, false)));
  def('VAR.S', 'VAR.S', 'stat', 'getal1; [getal2]; …', 'Variantie (steekproef).', withNums((n) => variance(n, false)));
  def('VAR.P', 'VAR.P', 'stat', 'getal1; [getal2]; …', 'Variantie (populatie).', withNums((n) => variance(n, true)));
  def('VARP', 'VARP', 'stat', 'getal1; [getal2]; …', 'Variantie (populatie).', withNums((n) => variance(n, true)));
  const sd = (pop) => withNums((n) => { const v = variance(n, pop); return isErr(v) ? v : Math.sqrt(v); });
  def('STDEV', 'STDEV', 'stat', 'getal1; [getal2]; …', 'Standaarddeviatie (steekproef).', sd(false));
  def('STDEV.S', 'STDEV.S', 'stat', 'getal1; [getal2]; …', 'Standaarddeviatie (steekproef).', sd(false));
  def('STDEV.P', 'STDEV.P', 'stat', 'getal1; [getal2]; …', 'Standaarddeviatie (populatie).', sd(true));
  def('STDEVP', 'STDEVP', 'stat', 'getal1; [getal2]; …', 'Standaarddeviatie (populatie).', sd(true));
  const pct = ([a, b]) => { const n = numsOf([a]); if (isErr(n)) return n; const k = num(b); if (isErr(k)) return k; if (!n.length || k < 0 || k > 1) return err('#NUM!'); const s = [...n].sort((x, y) => x - y); const h = (s.length - 1) * k; const lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
  def('PERCENTILE', 'PERCENTIEL', 'stat', 'matrix; k', 'Het k-de percentiel (0 t/m 1).', pct);
  def('PERCENTILE.INC', 'PERCENTIEL.INC', 'stat', 'matrix; k', 'Het k-de percentiel (0 t/m 1).', pct);
  def('QUARTILE', 'KWARTIEL', 'stat', 'matrix; kwartiel', 'Kwartiel (0 t/m 4).', ([a, b]) => { const q = num(b); return isErr(q) ? q : pct([a, q / 4]); });
  def('QUARTILE.INC', 'KWARTIEL.INC', 'stat', 'matrix; kwartiel', 'Kwartiel (0 t/m 4).', ([a, b]) => { const q = num(b); return isErr(q) ? q : pct([a, q / 4]); });
  const pairsXY = (ya, xa) => { const Y = flat(ya), X = flat(xa); if (Y.length !== X.length) return err('#N/A'); const p = []; Y.forEach((y, i) => { if (typeof y === 'number' && typeof X[i] === 'number') p.push([X[i], y]); }); return p; };
  const linreg = (p) => { const n = p.length; if (n < 2) return null; const mx = p.reduce((a, b) => a + b[0], 0) / n, my = p.reduce((a, b) => a + b[1], 0) / n; let sxy = 0, sxx = 0, syy = 0; p.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }); return { slope: sxy / sxx, icpt: my - (sxy / sxx) * mx, r: sxy / Math.sqrt(sxx * syy) }; };
  def('CORREL', 'CORRELATIE', 'stat', 'matrix1; matrix2', 'Correlatiecoëfficiënt.', ([a, b]) => { const p = pairsXY(b, a); if (isErr(p)) return p; const l = linreg(p); return l && isFinite(l.r) ? l.r : err('#DIV/0!'); });
  def('SLOPE', 'RICHTING', 'stat', 'y-bekend; x-bekend', 'Richtingscoëfficiënt van de regressielijn.', ([a, b]) => { const p = pairsXY(a, b); if (isErr(p)) return p; const l = linreg(p); return l && isFinite(l.slope) ? l.slope : err('#DIV/0!'); });
  def('INTERCEPT', 'SNIJPUNT', 'stat', 'y-bekend; x-bekend', 'Snijpunt van de regressielijn met de y-as.', ([a, b]) => { const p = pairsXY(a, b); if (isErr(p)) return p; const l = linreg(p); return l && isFinite(l.icpt) ? l.icpt : err('#DIV/0!'); });
  const forecast = ([x, a, b]) => { const xv = num(x); if (isErr(xv)) return xv; const p = pairsXY(a, b); if (isErr(p)) return p; const l = linreg(p); return l && isFinite(l.slope) ? l.icpt + l.slope * xv : err('#DIV/0!'); };
  def('FORECAST', 'VOORSPELLEN', 'stat', 'x; y-bekend; x-bekend', 'Voorspelt een waarde met lineaire regressie.', forecast);
  def('FORECAST.LINEAR', 'VOORSPELLEN.LINEAR', 'stat', 'x; y-bekend; x-bekend', 'Voorspelt een waarde met lineaire regressie.', forecast);
  def('GEOMEAN', 'MEETK.GEM', 'stat', 'getal1; [getal2]; …', 'Meetkundig gemiddelde.', withNums((n) => (!n.length || n.some((x) => x <= 0) ? err('#NUM!') : Math.exp(n.reduce((a, b) => a + Math.log(b), 0) / n.length))));

  /* ---------- Logisch ---------- */
  def('IF', 'ALS', 'logic', 'logische_test; [waarde_als_waar]; [waarde_als_onwaar]', 'Geeft een waarde als de test WAAR is en een andere als hij ONWAAR is.', (a, ctx, ev) => {
    const t = toBool(F.deref(ev(a[0], ctx), ctx));
    if (isErr(t)) return t;
    if (t) return a.length > 1 ? (a[1].k === 'missing' ? 0 : ev(a[1], ctx)) : true;
    return a.length > 2 ? (a[2].k === 'missing' ? 0 : ev(a[2], ctx)) : false;
  }, { lazy: true });
  def('IFS', 'ALS.VOORWAARDEN', 'logic', 'test1; waarde1; [test2; waarde2]; …', 'Geeft de waarde bij de eerste test die WAAR is.', (a, ctx, ev) => {
    for (let k = 0; k + 1 < a.length; k += 2) { const t = toBool(F.deref(ev(a[k], ctx), ctx)); if (isErr(t)) return t; if (t) return ev(a[k + 1], ctx); }
    return err('#N/A');
  }, { lazy: true });
  def('IFERROR', 'ALS.FOUT', 'logic', 'waarde; waarde_als_fout', 'Geeft een andere waarde als de formule een fout oplevert.', (a, ctx, ev) => {
    const v = ev(a[0], ctx); const d = F.deref(v, ctx);
    return isErr(d) ? (a[1] ? ev(a[1], ctx) : '') : v;
  }, { lazy: true });
  def('IFNA', 'ALS.NB', 'logic', 'waarde; waarde_als_nb', 'Geeft een andere waarde bij #N/B.', (a, ctx, ev) => {
    const v = ev(a[0], ctx); const d = F.deref(v, ctx);
    return isErr(d) && d.err === '#N/A' ? (a[1] ? ev(a[1], ctx) : '') : v;
  }, { lazy: true });
  const logic = (comb) => (args) => {
    let acc = null, e = null;
    each(args, (v, direct) => {
      if (isErr(v)) { e = v; return false; }
      if (v === null || (typeof v === 'string' && !direct)) return;
      const b = toBool(v); if (isErr(b)) { e = b; return false; }
      acc = acc === null ? b : comb(acc, b);
    });
    return e || (acc === null ? err('#VALUE!') : acc);
  };
  def('AND', 'EN', 'logic', 'logisch1; [logisch2]; …', 'WAAR als alle argumenten WAAR zijn.', logic((a, b) => a && b));
  def('OR', 'OF', 'logic', 'logisch1; [logisch2]; …', 'WAAR als minstens één argument WAAR is.', logic((a, b) => a || b));
  def('XOR', 'EX.OF', 'logic', 'logisch1; [logisch2]; …', 'Exclusieve OF.', logic((a, b) => a !== b));
  def('NOT', 'NIET', 'logic', 'logisch', 'Keert een logische waarde om.', ([a]) => { const b = bool(a); return isErr(b) ? b : !b; });
  def('TRUE', 'WAAR', 'logic', '', 'De logische waarde WAAR.', () => true);
  def('FALSE', 'ONWAAR', 'logic', '', 'De logische waarde ONWAAR.', () => false);
  def('SWITCH', 'SCHAKELEN', 'logic', 'expressie; waarde1; resultaat1; …; [standaard]', 'Vergelijkt een expressie met een lijst waarden.', (a, ctx, ev) => {
    const x = F.deref(ev(a[0], ctx), ctx); if (isErr(x)) return x;
    let k = 1;
    for (; k + 1 < a.length; k += 2) { const v = F.deref(ev(a[k], ctx), ctx); if (F.cmpVals(x, v) === 0) return ev(a[k + 1], ctx); }
    return k < a.length ? ev(a[k], ctx) : err('#N/A');
  }, { lazy: true });

  /* ---------- Tekst ---------- */
  const joinArgs = (args) => { let s = '', e = null; each(args, (v) => { if (isErr(v)) { e = v; return false; } s += toStr(v); }); return e || s; };
  def('CONCATENATE', 'TEKST.SAMENVOEGEN', 'text', 'tekst1; [tekst2]; …', 'Voegt teksten samen.', (args) => { for (const a of args) if (isErr(val(a))) return val(a); return args.map(str).join(''); });
  def('CONCAT', 'TEKST.SAMENV', 'text', 'tekst1; [tekst2]; …', 'Voegt teksten en bereiken samen.', joinArgs);
  def('TEXTJOIN', 'TEKST.COMBINEREN', 'text', 'scheidingsteken; lege_negeren; tekst1; …', 'Voegt teksten samen met een scheidingsteken.', ([d, ign, ...rest]) => {
    const sep = str(d), skip = bool(ign); const parts = []; let e = null;
    each(rest, (v) => { if (isErr(v)) { e = v; return false; } const s = toStr(v); if (!(skip && s === '')) parts.push(s); });
    return e || parts.join(sep);
  });
  def('LEFT', 'LINKS', 'text', 'tekst; [aantal_tekens]', 'Eerste tekens van een tekst.', ([a, b]) => { const s = str(a), n = num(b, 1); return isErr(s) ? s : isErr(n) ? n : n < 0 ? err('#VALUE!') : s.slice(0, n); });
  def('RIGHT', 'RECHTS', 'text', 'tekst; [aantal_tekens]', 'Laatste tekens van een tekst.', ([a, b]) => { const s = str(a), n = num(b, 1); return isErr(s) ? s : isErr(n) ? n : n < 0 ? err('#VALUE!') : n === 0 ? '' : s.slice(-n); });
  def('MID', 'DEEL', 'text', 'tekst; begin_getal; aantal_tekens', 'Tekens uit het midden van een tekst.', ([a, b, c]) => { const s = str(a), st = num(b), n = num(c); if (isErr(s)) return s; if (nums(st, n)) return nums(st, n); return st < 1 || n < 0 ? err('#VALUE!') : s.substr(st - 1, n); });
  def('LEN', 'LENGTE', 'text', 'tekst', 'Aantal tekens in een tekst.', ([a]) => { const s = str(a); return isErr(s) ? s : s.length; });
  def('UPPER', 'HOOFDLETTERS', 'text', 'tekst', 'Zet tekst om in hoofdletters.', ([a]) => { const s = str(a); return isErr(s) ? s : s.toUpperCase(); });
  def('LOWER', 'KLEINE.LETTERS', 'text', 'tekst', 'Zet tekst om in kleine letters.', ([a]) => { const s = str(a); return isErr(s) ? s : s.toLowerCase(); });
  def('PROPER', 'BEGINLETTERS', 'text', 'tekst', 'Elk woord met een hoofdletter.', ([a]) => { const s = str(a); return isErr(s) ? s : s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, p, l) => p + l.toUpperCase()); });
  def('TRIM', 'SPATIES.WISSEN', 'text', 'tekst', 'Verwijdert overbodige spaties.', ([a]) => { const s = str(a); return isErr(s) ? s : s.replace(/ +/g, ' ').trim(); });
  def('CLEAN', 'WISSEN.CONTROL', 'text', 'tekst', 'Verwijdert niet-afdrukbare tekens.', ([a]) => { const s = str(a); return isErr(s) ? s : s.replace(/[\x00-\x1f]/g, ''); });
  def('SUBSTITUTE', 'SUBSTITUEREN', 'text', 'tekst; oud; nieuw; [instantie]', 'Vervangt tekst door andere tekst.', ([a, b, c, d]) => {
    const s = str(a), o = str(b), n = str(c); if (isErr(s)) return s;
    if (!o) return s;
    if (d === undefined || d === null) return s.split(o).join(n);
    const k = num(d); if (isErr(k)) return k;
    let idx = -1; for (let i = 0; i < k; i++) { idx = s.indexOf(o, idx + 1); if (idx < 0) return s; }
    return s.slice(0, idx) + n + s.slice(idx + o.length);
  });
  def('REPLACE', 'VERVANGEN', 'text', 'oude_tekst; begin_getal; aantal_tekens; nieuwe_tekst', 'Vervangt een deel van een tekst.', ([a, b, c, d]) => { const s = str(a), st = num(b), n = num(c); if (nums(st, n)) return nums(st, n); return s.slice(0, st - 1) + str(d) + s.slice(st - 1 + n); });
  const find = (ci) => ([a, b, c]) => {
    const needle = str(a), hay = str(b), st = num(c, 1); if (isErr(st)) return st;
    if (st < 1 || st > hay.length + 1) return err('#VALUE!');
    let idx;
    if (ci) { const re = /[*?]/.test(needle) ? new RegExp(wildRe(needle).source.slice(1, -1), 'i') : null; if (re) { const m = re.exec(hay.slice(st - 1)); idx = m ? m.index + st - 1 : -1; } else idx = hay.toLowerCase().indexOf(needle.toLowerCase(), st - 1); }
    else idx = hay.indexOf(needle, st - 1);
    return idx < 0 ? err('#VALUE!') : idx + 1;
  };
  def('FIND', 'VIND.ALLES', 'text', 'zoeken_tekst; in_tekst; [begin_getal]', 'Zoekt tekst (hoofdlettergevoelig).', find(false));
  def('SEARCH', 'VIND.SPEC', 'text', 'zoeken_tekst; in_tekst; [begin_getal]', 'Zoekt tekst (niet hoofdlettergevoelig, met jokertekens).', find(true));
  // Notatiecode in de NL-schrijfwijze (komma = decimaal) omzetten
  const localFmt = (f) => {
    if (App.LANG === 'en') return f;   // Engelse notatiecodes zijn al canoniek
    let out = '', q = false;
    for (const ch of f) { if (ch === '"') q = !q; out += q ? ch : ch === ',' ? '.' : ch === '.' ? ',' : ch; }
    return out;
  };
  def('TEXT', 'TEKST', 'text', 'waarde; notatie', 'Zet een getal om in tekst met een getalnotatie, bv. "0,00" of "dd-mm-jjjj".', ([a, b]) => {
    const v = val(a); if (isErr(v)) return v;
    const f = str(b);
    let x = v;
    if (typeof v === 'string') { const n = toNum(v); if (!isErr(n)) x = n; }
    return NF.format(x, localFmt(f)).text;
  });
  def('FIXED', 'VAST', 'text', 'getal; [decimalen]; [geen_punten]', 'Rondt af en geeft tekst met duizendtallen.', ([a, b, c]) => { const n = num(a), d = num(b, 2); if (nums(n, d)) return nums(n, d); return NF.format(round(n, d), (bool(c ?? false) === true ? '0' : '#,##0') + (d > 0 ? '.' + '0'.repeat(d) : '')).text; });
  def('VALUE', 'WAARDE', 'text', 'tekst', 'Zet tekst om in een getal.', ([a]) => { const v = val(a); if (typeof v === 'number') return v; return toNum(v); });
  def('NUMBERVALUE', 'NUMERIEKE.WAARDE', 'text', 'tekst; [decimaalteken]; [groepsscheidingsteken]', 'Zet tekst om in een getal met opgegeven scheidingstekens.', ([a, b, c]) => {
    let s = str(a); const dec = b != null ? str(b) : ',', grp = c != null ? str(c) : '.';
    s = s.split(grp).join('').replace(dec, '.').replace(/\s/g, '');
    const pctN = (s.match(/%/g) || []).length; s = s.replace(/%/g, '');
    const n = Number(s); return s === '' ? 0 : isNaN(n) ? err('#VALUE!') : n / 100 ** pctN;
  });
  def('REPT', 'HERHALING', 'text', 'tekst; aantal_keer', 'Herhaalt tekst.', ([a, b]) => { const n = num(b); if (isErr(n)) return n; const s = str(a); if (n < 0 || s.length * Math.floor(n) > 32767) return err('#VALUE!'); return s.repeat(Math.floor(n)); });
  def('EXACT', 'GELIJK', 'text', 'tekst1; tekst2', 'Vergelijkt twee teksten (hoofdlettergevoelig).', ([a, b]) => str(a) === str(b));
  def('CHAR', 'TEKEN', 'text', 'getal', 'Teken bij een codenummer.', ([a]) => { const n = num(a); return isErr(n) ? n : n < 1 || n > 255 ? err('#VALUE!') : String.fromCharCode(n); });
  def('CODE', 'CODE', 'text', 'tekst', 'Codenummer van het eerste teken.', ([a]) => { const s = str(a); return s ? s.charCodeAt(0) : err('#VALUE!'); });
  def('UNICHAR', 'UNITEKEN', 'text', 'getal', 'Unicode-teken bij een getal.', ([a]) => { const n = num(a); return isErr(n) ? n : String.fromCodePoint(n); });
  def('UNICODE', 'UNICODE', 'text', 'tekst', 'Unicode-getal van het eerste teken.', ([a]) => { const s = str(a); return s ? s.codePointAt(0) : err('#VALUE!'); });
  def('T', 'T', 'text', 'waarde', 'Geeft de tekst als de waarde tekst is.', ([a]) => { const v = val(a); return typeof v === 'string' ? v : ''; });
  def('N', 'N', 'info', 'waarde', 'Zet een waarde om in een getal.', ([a]) => { const v = val(a); return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : isErr(v) ? v : 0; });
  def('TEXTBEFORE', 'TEKST.VOOR', 'text', 'tekst; scheidingsteken; [instantie]', 'Tekst vóór een scheidingsteken.', ([a, b, c]) => { const s = str(a), d = str(b); let k = num(c, 1); if (isErr(k)) return k; let idx = -1; if (k > 0) { for (let i = 0; i < k; i++) { idx = s.indexOf(d, idx + 1); if (idx < 0) return err('#N/A'); } } else { idx = s.length; for (let i = 0; i < -k; i++) { idx = s.lastIndexOf(d, idx - 1); if (idx < 0) return err('#N/A'); } } return s.slice(0, idx); });
  def('TEXTAFTER', 'TEKST.NA', 'text', 'tekst; scheidingsteken; [instantie]', 'Tekst na een scheidingsteken.', ([a, b, c]) => { const s = str(a), d = str(b); let k = num(c, 1); if (isErr(k)) return k; let idx = -1; if (k > 0) { for (let i = 0; i < k; i++) { idx = s.indexOf(d, idx + 1); if (idx < 0) return err('#N/A'); } } else { idx = s.length; for (let i = 0; i < -k; i++) { idx = s.lastIndexOf(d, idx - 1); if (idx < 0) return err('#N/A'); } } return s.slice(idx + d.length); });

  /* ---------- Datum en tijd ---------- */
  const ymd = (n) => { const d = NF.serialToDate(n); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }; };
  const dnum = (v) => { v = val(v); if (typeof v === 'string') { const p = NF.parseInput(v); return typeof p.v === 'number' ? p.v : err('#VALUE!'); } return toNum(v); };
  def('TODAY', 'VANDAAG', 'date', '', 'De datum van vandaag.', () => { const d = new Date(); return NF.dateToSerial(d.getFullYear(), d.getMonth(), d.getDate()); });
  def('NOW', 'NU', 'date', '', 'De huidige datum en tijd.', () => NF.jsToSerial(new Date()));
  def('DATE', 'DATUM', 'date', 'jaar; maand; dag', 'Maakt een datum van jaar, maand en dag.', ([a, b, c]) => { let y = num(a); const m = num(b), d = num(c); if (nums(y, m, d)) return nums(y, m, d); if (y < 1900) y += 1900; return NF.dateToSerial(Math.trunc(y), Math.trunc(m) - 1, Math.trunc(d)); });
  def('TIME', 'TIJD', 'date', 'uur; minuut; seconde', 'Maakt een tijd.', ([a, b, c]) => { const h = num(a), m = num(b), s = num(c); if (nums(h, m, s)) return nums(h, m, s); const t = (h * 3600 + m * 60 + s) / 86400; return t - Math.floor(t); });
  def('YEAR', 'JAAR', 'date', 'serienummer', 'Jaar van een datum.', ([a]) => { const n = dnum(a); return isErr(n) ? n : ymd(n).y; });
  def('MONTH', 'MAAND', 'date', 'serienummer', 'Maand van een datum (1-12).', ([a]) => { const n = dnum(a); return isErr(n) ? n : ymd(n).m + 1; });
  def('DAY', 'DAG', 'date', 'serienummer', 'Dag van de maand.', ([a]) => { const n = dnum(a); return isErr(n) ? n : ymd(n).d; });
  def('HOUR', 'UUR', 'date', 'serienummer', 'Uur van een tijd.', ([a]) => { const n = dnum(a); return isErr(n) ? n : ymd(n + 1e-9).h; });
  def('MINUTE', 'MINUUT', 'date', 'serienummer', 'Minuut van een tijd.', ([a]) => { const n = dnum(a); return isErr(n) ? n : ymd(n + 1e-9).mi; });
  def('SECOND', 'SECONDE', 'date', 'serienummer', 'Seconde van een tijd.', ([a]) => { const n = dnum(a); return isErr(n) ? n : ymd(n + 1e-9).s; });
  def('WEEKDAY', 'WEEKDAG', 'date', 'serienummer; [type]', 'Dag van de week (1 = zondag; type 2: 1 = maandag).', ([a, b]) => { const n = dnum(a), t = num(b, 1); if (nums(n, t)) return nums(n, t); const wd = ymd(n).wd; if (t === 2 || t === 11) return ((wd + 6) % 7) + 1; if (t === 3) return (wd + 6) % 7; return wd + 1; });
  const isoWeek = (n) => { const d = NF.serialToDate(Math.floor(n)); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const fy = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - fy) / 86400000 - 3 + ((fy.getUTCDay() + 6) % 7)) / 7); };
  def('ISOWEEKNUM', 'ISO.WEEKNUMMER', 'date', 'datum', 'ISO-weeknummer (zoals in Nederland gebruikelijk).', ([a]) => { const n = dnum(a); return isErr(n) ? n : isoWeek(n); });
  def('WEEKNUM', 'WEEKNUMMER', 'date', 'serienummer; [type]', 'Weeknummer (type 21 = ISO).', ([a, b]) => {
    const n = dnum(a), t = num(b, 1); if (nums(n, t)) return nums(n, t);
    if (t === 21) return isoWeek(n);
    const { y } = ymd(n); const jan1 = NF.dateToSerial(y, 0, 1); const wd1 = ymd(jan1).wd; const start = t === 2 || t === 11 ? (wd1 + 6) % 7 : wd1;
    return Math.floor((Math.floor(n) - jan1 + start) / 7) + 1;
  });
  def('EDATE', 'ZELFDE.DAG', 'date', 'begindatum; maanden', 'Datum een aantal maanden ervoor of erna.', ([a, b]) => { const n = dnum(a), m = num(b); if (nums(n, m)) return nums(n, m); const d = ymd(n); const last = new Date(Date.UTC(d.y, d.m + Math.trunc(m) + 1, 0)).getUTCDate(); return NF.dateToSerial(d.y, d.m + Math.trunc(m), Math.min(d.d, last)); });
  def('EOMONTH', 'LAATSTE.DAG', 'date', 'begindatum; maanden', 'Laatste dag van de maand, een aantal maanden ervoor of erna.', ([a, b]) => { const n = dnum(a), m = num(b); if (nums(n, m)) return nums(n, m); const d = ymd(n); return NF.dateToSerial(d.y, d.m + Math.trunc(m) + 1, 0); });
  def('DATEDIF', 'DATUMVERSCHIL', 'date', 'begindatum; einddatum; eenheid', 'Verschil tussen twee datums in "Y", "M", "D", "MD", "YM" of "YD".', ([a, b, c]) => {
    const s = dnum(a), e = dnum(b); if (nums(s, e)) return nums(s, e);
    if (s > e) return err('#NUM!');
    const u = str(c).toUpperCase(); const A = ymd(s), B = ymd(e);
    let months = (B.y - A.y) * 12 + (B.m - A.m); if (B.d < A.d) months--;
    if (u === 'Y') return Math.floor(months / 12);
    if (u === 'M') return months;
    if (u === 'D') return Math.floor(e) - Math.floor(s);
    if (u === 'YM') return months % 12;
    if (u === 'MD') { let d = B.d - A.d; if (d < 0) d += new Date(Date.UTC(B.y, B.m, 0)).getUTCDate(); return d; }
    if (u === 'YD') { let y = B.y; let st = NF.dateToSerial(y, A.m, A.d); if (st > e) st = NF.dateToSerial(y - 1, A.m, A.d); return Math.floor(e - st); }
    return err('#NUM!');
  });
  def('DAYS', 'DAGEN', 'date', 'einddatum; begindatum', 'Aantal dagen tussen twee datums.', ([a, b]) => { const e = dnum(a), s = dnum(b); return nums(e, s) || Math.floor(e) - Math.floor(s); });
  def('YEARFRAC', 'JAAR.DEEL', 'date', 'begindatum; einddatum; [basis]', 'Deel van een jaar tussen twee datums.', ([a, b]) => { const s = dnum(a), e = dnum(b); return nums(s, e) || Math.abs(e - s) / 365.25; });
  const holidaySet = (h) => { const s = new Set(); if (h !== undefined && h !== null) each([h], (v) => { if (typeof v === 'number') s.add(Math.floor(v)); }); return s; };
  def('NETWORKDAYS', 'NETTO.WERKDAGEN', 'date', 'begindatum; einddatum; [vakantiedagen]', 'Aantal werkdagen tussen twee datums.', ([a, b, h]) => {
    let s = dnum(a), e = dnum(b); if (nums(s, e)) return nums(s, e);
    s = Math.floor(s); e = Math.floor(e); const sign = e < s ? -1 : 1; if (sign < 0) [s, e] = [e, s];
    const hol = holidaySet(h); let k = 0;
    for (let d = s; d <= e; d++) { const wd = ymd(d).wd; if (wd !== 0 && wd !== 6 && !hol.has(d)) k++; }
    return k * sign;
  });
  def('WORKDAY', 'WERKDAG', 'date', 'begindatum; aantal_dagen; [vakantiedagen]', 'Datum een aantal werkdagen ervoor of erna.', ([a, b, h]) => {
    let d = dnum(a); const n = num(b); if (nums(d, n)) return nums(d, n);
    d = Math.floor(d); const hol = holidaySet(h); let left = Math.abs(Math.trunc(n)); const step = n < 0 ? -1 : 1;
    while (left > 0) { d += step; const wd = ymd(d).wd; if (wd !== 0 && wd !== 6 && !hol.has(d)) left--; }
    return d;
  });
  def('DATEVALUE', 'DATUMWAARDE', 'date', 'datum_tekst', 'Zet tekst om in een datum.', ([a]) => { const p = NF.parseInput(str(a)); return typeof p.v === 'number' && p.nf && NF.isDateFmt(p.nf) ? Math.floor(p.v) : err('#VALUE!'); });
  def('TIMEVALUE', 'TIJDWAARDE', 'date', 'tijd_tekst', 'Zet tekst om in een tijd.', ([a]) => { const p = NF.parseInput(str(a)); return typeof p.v === 'number' && p.nf && NF.isDateFmt(p.nf) ? p.v % 1 : err('#VALUE!'); });

  /* ---------- Zoeken en verwijzen ---------- */
  const matchIn = (list, x, type) => {
    // list: 1D-array van waarden; type 0 = exact (met jokertekens), 1 = grootste <=, -1 = kleinste >=
    if (type === 0) {
      const re = typeof x === 'string' && /[*?]/.test(x) ? wildRe(x) : null;
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (re ? typeof v === 'string' && re.test(v) : (v !== null && F.cmpVals(v, x) === 0 && (typeof v === typeof x || (typeof v === 'number' && typeof x === 'number')))) return i;
      }
      return -1;
    }
    let best = -1;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (v === null || v === '' || (typeof v !== typeof x)) continue;
      const c = F.cmpVals(v, x);
      if (c === 0) { if (type === 1) best = i; else return i; }
      else if (type === 1 && c < 0) best = i;
      else if (type === 1 && c > 0) break;
      else if (type === -1 && c > 0) best = i;
      else if (type === -1 && c < 0) break;
    }
    return best;
  };
  def('VLOOKUP', 'VERT.ZOEKEN', 'lookup', 'zoekwaarde; tabelmatrix; kolomindex_getal; [benaderen]', 'Zoekt in de eerste kolom van een tabel en geeft een waarde uit dezelfde rij.', ([x, t, k, approx]) => {
    const xv = val(x); if (isErr(xv)) return xv;
    const A = arr2(t); const ci = num(k); if (isErr(ci)) return ci;
    if (ci < 1 || ci > (A[0] || []).length) return err('#REF!');
    const ap = approx === undefined || approx === null ? true : bool(approx);
    const i = matchIn(A.map((r) => r[0]), xv, ap ? 1 : 0);
    if (i < 0) return err('#N/A');
    const v = A[i][Math.floor(ci) - 1]; return v === null ? 0 : v;
  });
  def('HLOOKUP', 'HORIZ.ZOEKEN', 'lookup', 'zoekwaarde; tabelmatrix; rijindex_getal; [benaderen]', 'Zoekt in de eerste rij van een tabel en geeft een waarde uit dezelfde kolom.', ([x, t, k, approx]) => {
    const xv = val(x); if (isErr(xv)) return xv;
    const A = arr2(t); const ri = num(k); if (isErr(ri)) return ri;
    if (ri < 1 || ri > A.length) return err('#REF!');
    const ap = approx === undefined || approx === null ? true : bool(approx);
    const i = matchIn(A[0], xv, ap ? 1 : 0);
    if (i < 0) return err('#N/A');
    const v = A[Math.floor(ri) - 1][i]; return v === null ? 0 : v;
  });
  def('LOOKUP', 'ZOEKEN', 'lookup', 'zoekwaarde; zoekvector; [resultaatvector]', 'Zoekt een waarde in een rij of kolom.', ([x, a, b]) => {
    const xv = val(x); const L = flat(a); const R = b !== undefined ? flat(b) : L;
    const i = matchIn(L, xv, 1); return i < 0 ? err('#N/A') : (R[i] ?? err('#N/A'));
  });
  def('MATCH', 'VERGELIJKEN', 'lookup', 'zoekwaarde; zoeken_matrix; [criteriumtype]', 'Positie van een waarde in een bereik.', ([x, a, t]) => {
    const xv = val(x); if (isErr(xv)) return xv; const type = num(t, 1);
    const i = matchIn(flat(a), xv, type > 0 ? 1 : type < 0 ? -1 : 0); return i < 0 ? err('#N/A') : i + 1;
  });
  def('XMATCH', 'X.VERGELIJKEN', 'lookup', 'zoekwaarde; zoeken_matrix; [overeenkomstmodus]; [zoekmodus]', 'Positie van een waarde (standaard exact).', ([x, a, m, s]) => {
    const xv = val(x); if (isErr(xv)) return xv;
    let L = flat(a); const mode = num(m, 0), sm = num(s, 1);
    const rev = sm < 0; if (rev) L = [...L].reverse();
    let i;
    if (mode === 0 || mode === 2) i = matchIn(L, xv, 0);
    else { i = -1; let bestV = null; L.forEach((v, k) => { if (typeof v !== typeof xv) return; const c = F.cmpVals(v, xv); if (c === 0 && i < 0) { i = k; bestV = v; } else if (mode === -1 && c < 0 && (bestV === null || F.cmpVals(v, bestV) > 0) && !(bestV !== null && F.cmpVals(bestV, xv) === 0)) { i = k; bestV = v; } else if (mode === 1 && c > 0 && (bestV === null || F.cmpVals(v, bestV) < 0) && !(bestV !== null && F.cmpVals(bestV, xv) === 0)) { i = k; bestV = v; } }); }
    if (i < 0) return err('#N/A');
    return rev ? L.length - i : i + 1;
  });
  def('XLOOKUP', 'X.ZOEKEN', 'lookup', 'zoekwaarde; zoeken_matrix; matrix_retourneren; [indien_niet_gevonden]; [overeenkomstmodus]; [zoekmodus]', 'Zoekt een waarde en geeft de bijbehorende waarde uit een ander bereik.', ([x, a, r, nf, m, s]) => {
    const pos = App.FN.XMATCH.fn([x, a, m, s]);
    if (isErr(pos)) return nf !== undefined && nf !== null ? val(nf) : pos;
    if (isRef(r)) {
      const vertical = isRef(a) ? a.r2 - a.r1 > 0 || a.c1 === a.c2 : true;
      if (vertical) return F.mkRef(r.sh, r.r1 + pos - 1, r.c1, r.r1 + pos - 1, r.c2);
      return F.mkRef(r.sh, r.r1, r.c1 + pos - 1, r.r2, r.c1 + pos - 1);
    }
    return flat(r)[pos - 1] ?? err('#N/A');
  });
  def('INDEX', 'INDEX', 'lookup', 'matrix; rij_getal; [kolom_getal]', 'Waarde of verwijzing op een rij- en kolompositie.', ([a, b, c]) => {
    let r = num(b, 0), k = num(c, 0); if (nums(r, k)) return nums(r, k);
    if (isRef(a)) {
      const h = a.r2 - a.r1 + 1, w = a.c2 - a.c1 + 1;
      if (h === 1 && (c === undefined || c === null) && r) { k = r; r = 1; }
      if (r > h || k > w || r < 0 || k < 0) return err('#REF!');
      if (r === 0 && k === 0) return a;
      if (r === 0) return F.mkRef(a.sh, a.r1, a.c1 + k - 1, a.r2, a.c1 + k - 1);
      if (k === 0) return w === 1 ? F.mkRef(a.sh, a.r1 + r - 1, a.c1, a.r1 + r - 1, a.c1) : F.mkRef(a.sh, a.r1 + r - 1, a.c1, a.r1 + r - 1, a.c2);
      return F.mkRef(a.sh, a.r1 + r - 1, a.c1 + k - 1, a.r1 + r - 1, a.c1 + k - 1);
    }
    const A = arr2(a);
    if (A.length === 1 && !k) { k = r; r = 1; }
    const v = (A[(r || 1) - 1] || [])[(k || 1) - 1];
    return v === undefined ? err('#REF!') : v;
  });
  def('CHOOSE', 'KIEZEN', 'lookup', 'index_getal; waarde1; [waarde2]; …', 'Kiest een waarde uit een lijst.', (a, ctx, ev) => {
    const i = toNum(F.deref(ev(a[0], ctx), ctx)); if (isErr(i)) return i;
    const k = Math.floor(i); if (k < 1 || k >= a.length) return err('#VALUE!');
    return ev(a[k], ctx);
  }, { lazy: true });
  def('ROW', 'RIJ', 'lookup', '[verw]', 'Rijnummer van een verwijzing.', (args, ctx) => (args.length && isRef(args[0]) ? args[0].r1 + 1 : ctx.r + 1));
  def('COLUMN', 'KOLOM', 'lookup', '[verw]', 'Kolomnummer van een verwijzing.', (args, ctx) => (args.length && isRef(args[0]) ? args[0].c1 + 1 : ctx.c + 1));
  def('ROWS', 'RIJEN', 'lookup', 'matrix', 'Aantal rijen in een bereik.', ([a]) => (isRef(a) ? a.r2 - a.r1 + 1 : arr2(a).length));
  def('COLUMNS', 'KOLOMMEN', 'lookup', 'matrix', 'Aantal kolommen in een bereik.', ([a]) => (isRef(a) ? a.c2 - a.c1 + 1 : arr2(a)[0].length));
  def('OFFSET', 'VERSCHUIVING', 'lookup', 'verw; rijen; kolommen; [hoogte]; [breedte]', 'Verwijzing die een aantal rijen en kolommen is verschoven.', ([a, b, c, d, e]) => {
    if (!isRef(a)) return err('#VALUE!');
    const dr = num(b, 0), dc = num(c, 0), h = num(d, a.r2 - a.r1 + 1), w = num(e, a.c2 - a.c1 + 1);
    if (nums(dr, dc, h, w)) return nums(dr, dc, h, w);
    const r1 = a.r1 + dr, c1 = a.c1 + dc;
    if (r1 < 0 || c1 < 0 || h < 1 || w < 1) return err('#REF!');
    return F.mkRef(a.sh, r1, c1, r1 + h - 1, c1 + w - 1);
  }, { volatile: true });
  def('INDIRECT', 'INDIRECT', 'lookup', 'verw_tekst; [a1]', 'Verwijzing uit een tekst, bv. "B"&2 of "Blad2!A1".', ([a], ctx) => {
    const s = str(a).trim();
    const toks = F.tokenize(s, 'en').filter((t) => t.t !== 'ws');
    if (toks.length === 1 && toks[0].t === 'ref') { const t = toks[0]; const sh = t.sheet ? App.sheetByName(t.sheet) : ctx.sh; return sh ? F.mkRef(sh, t.r1, t.c1, t.r2, t.c2) : err('#REF!'); }
    if (toks.length === 1 && toks[0].t === 'name') { const v = F.evalText(s, ctx); return v; }
    return err('#REF!');
  });
  def('ADDRESS', 'ADRES', 'lookup', 'rij; kolom; [abs_getal]; [a1]; [blad]', 'Celadres als tekst.', ([a, b, c, d, e]) => {
    const r = num(a), k = num(b), t = num(c, 1); if (nums(r, k, t)) return nums(r, k, t);
    const ra = t === 1 || t === 2, ca = t === 1 || t === 3;
    return (e !== undefined && e !== null ? App.sheetRef(str(e)) + '!' : '') + (ca ? '$' : '') + App.colName(k - 1) + (ra ? '$' : '') + r;
  });
  def('HYPERLINK', 'HYPERLINK', 'lookup', 'koppeling; [naam]', 'Maakt een koppeling (de tekst wordt getoond).', ([a, b]) => (b !== undefined && b !== null ? val(b) : str(a)));
  def('TRANSPOSE', 'TRANSPONEREN', 'lookup', 'matrix', 'Draait een bereik om (rijen worden kolommen).', ([a]) => { const A = arr2(a); return A[0].map((_, j) => A.map((row) => row[j])); });
  def('FORMULATEXT', 'FORMULETEKST', 'lookup', 'verw', 'De formule als tekst.', ([a]) => { if (!isRef(a)) return err('#N/A'); const c = App.getCell(a.sh, a.r1, a.c1); return c && c.f ? '=' + F.toLocal(c.f) : err('#N/A'); });

  /* ---------- Informatie ---------- */
  const is = (pred) => ([a]) => pred(val(a), a);
  def('ISBLANK', 'ISLEEG', 'info', 'waarde', 'WAAR als de cel leeg is.', is((v) => v === null));
  def('ISNUMBER', 'ISGETAL', 'info', 'waarde', 'WAAR als de waarde een getal is.', is((v) => typeof v === 'number'));
  def('ISTEXT', 'ISTEKST', 'info', 'waarde', 'WAAR als de waarde tekst is.', is((v) => typeof v === 'string'));
  def('ISNONTEXT', 'ISGEENTEKST', 'info', 'waarde', 'WAAR als de waarde geen tekst is.', is((v) => typeof v !== 'string'));
  def('ISLOGICAL', 'ISLOGISCH', 'info', 'waarde', 'WAAR als de waarde WAAR of ONWAAR is.', is((v) => typeof v === 'boolean'));
  def('ISERROR', 'ISFOUT', 'info', 'waarde', 'WAAR als de waarde een foutwaarde is.', is((v) => isErr(v)));
  def('ISERR', 'ISFOUT2', 'info', 'waarde', 'WAAR bij een fout behalve #N/B.', is((v) => isErr(v) && v.err !== '#N/A'));
  def('ISNA', 'ISNB', 'info', 'waarde', 'WAAR bij #N/B.', is((v) => isErr(v) && v.err === '#N/A'));
  def('ISEVEN', 'IS.EVEN', 'info', 'getal', 'WAAR als het getal even is.', ([a]) => { const n = num(a); return isErr(n) ? n : Math.floor(Math.abs(n)) % 2 === 0; });
  def('ISODD', 'IS.ONEVEN', 'info', 'getal', 'WAAR als het getal oneven is.', ([a]) => { const n = num(a); return isErr(n) ? n : Math.floor(Math.abs(n)) % 2 === 1; });
  def('ISFORMULA', 'ISFORMULE', 'info', 'verw', 'WAAR als de cel een formule bevat.', ([a]) => { if (!isRef(a)) return err('#VALUE!'); const c = App.getCell(a.sh, a.r1, a.c1); return !!(c && c.f); });
  def('ISREF', 'ISVERWIJZING', 'info', 'waarde', 'WAAR als de waarde een verwijzing is.', ([a]) => isRef(a));
  def('NA', 'NB', 'info', '', 'De foutwaarde #N/B.', () => err('#N/A'));
  def('TYPE', 'TYPE', 'info', 'waarde', 'Type van een waarde (1 getal, 2 tekst, 4 logisch, 16 fout).', ([a]) => { const v = val(a); return typeof v === 'number' || v === null ? 1 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 4 : isErr(v) ? 16 : 64; });

  /* ---------- Financieel ---------- */
  const pmt = (rate, n, pv, fv = 0, type = 0) => (rate === 0 ? -(pv + fv) / n : -(rate * (fv + pv * (1 + rate) ** n)) / ((1 + rate * type) * ((1 + rate) ** n - 1)));
  const fvf = (rate, n, p, pv = 0, type = 0) => (rate === 0 ? -(pv + p * n) : -(pv * (1 + rate) ** n + p * (1 + rate * type) * ((1 + rate) ** n - 1) / rate));
  const finArgs = (args, k) => { const out = []; for (let i = 0; i < k; i++) { const v = num(args[i], 0); if (isErr(v)) return v; out.push(v); } return out; };
  def('PMT', 'BET', 'fin', 'rente; aantal_termijnen; hw; [tw]; [type_getal]', 'Periodieke betaling voor een lening (annuïteit).', (a) => { const x = finArgs(a, 5); if (isErr(x)) return x; return x[1] === 0 ? err('#NUM!') : pmt(...x); });
  def('FV', 'TW', 'fin', 'rente; aantal_termijnen; bet; [hw]; [type_getal]', 'Toekomstige waarde van een investering.', (a) => { const x = finArgs(a, 5); return isErr(x) ? x : fvf(...x); });
  def('PV', 'HW', 'fin', 'rente; aantal_termijnen; bet; [tw]; [type_getal]', 'Huidige waarde van een investering.', (a) => { const x = finArgs(a, 5); if (isErr(x)) return x; const [r, n, p, fv, t] = x; return r === 0 ? -(fv + p * n) : -(fv + p * (1 + r * t) * ((1 + r) ** n - 1) / r) / (1 + r) ** n; });
  def('NPER', 'NPER', 'fin', 'rente; bet; hw; [tw]; [type_getal]', 'Aantal termijnen van een investering.', (a) => { const x = finArgs(a, 5); if (isErr(x)) return x; const [r, p, pv, fv, t] = x; if (r === 0) return p === 0 ? err('#NUM!') : -(pv + fv) / p; const z = p * (1 + r * t) / r; const v = Math.log((z - fv) / (z + pv)) / Math.log(1 + r); return isFinite(v) ? v : err('#NUM!'); });
  def('RATE', 'RENTE', 'fin', 'aantal_termijnen; bet; hw; [tw]; [type_getal]; [schatting]', 'Rente per termijn van een annuïteit.', (a) => {
    const x = finArgs(a, 5); if (isErr(x)) return x; const [n, p, pv, fv, t] = x; let r = num(a[5], 0.1); if (isErr(r)) return r;
    for (let i = 0; i < 100; i++) {
      const f = fvf(r, n, p, pv, t) + fv;
      const h = 1e-6; const d = (fvf(r + h, n, p, pv, t) + fv - f) / h;
      if (!isFinite(d) || d === 0) break;
      const nr = r - f / d;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
    }
    return isFinite(r) ? r : err('#NUM!');
  });
  def('NPV', 'NHW', 'fin', 'rente; waarde1; [waarde2]; …', 'Netto huidige waarde van toekomstige kasstromen.', ([rate, ...rest]) => { const r = num(rate); if (isErr(r)) return r; const n = numsOf(rest); if (isErr(n)) return n; return n.reduce((s, v, i) => s + v / (1 + r) ** (i + 1), 0); });
  def('IRR', 'IR', 'fin', 'waarden; [schatting]', 'Interne rentabiliteit van kasstromen.', ([a, g]) => {
    const n = numsOf([a]); if (isErr(n)) return n; let r = num(g, 0.1); if (isErr(r)) return r;
    const f = (x) => n.reduce((s, v, i) => s + v / (1 + x) ** i, 0);
    for (let i = 0; i < 200; i++) { const y = f(r); const d = (f(r + 1e-7) - y) / 1e-7; if (!d) break; const nr = r - y / d; if (Math.abs(nr - r) < 1e-12) return nr; r = nr; }
    return isFinite(r) ? r : err('#NUM!');
  });
  const ipmt = (r, per, n, pv, fv = 0, t = 0) => { const p = pmt(r, n, pv, fv, t); let i = -fvf(r, per - 1, p, pv, t) * r; if (t === 1) { if (per === 1) return 0; i /= 1 + r; } return i; };
  def('IPMT', 'IBET', 'fin', 'rente; termijn; aantal_termijnen; hw; [tw]; [type_getal]', 'Rentedeel van een betaling.', (a) => { const x = finArgs(a, 6); return isErr(x) ? x : ipmt(...x); });
  def('PPMT', 'PBET', 'fin', 'rente; termijn; aantal_termijnen; hw; [tw]; [type_getal]', 'Aflossingsdeel van een betaling.', (a) => { const x = finArgs(a, 6); if (isErr(x)) return x; const [r, per, n, pv, fv, t] = x; return pmt(r, n, pv, fv, t) - ipmt(r, per, n, pv, fv, t); });
  def('SLN', 'LIN.AFSCHR', 'fin', 'kosten; restwaarde; duur', 'Lineaire afschrijving per periode.', (a) => { const x = finArgs(a, 3); if (isErr(x)) return x; return x[2] === 0 ? err('#DIV/0!') : (x[0] - x[1]) / x[2]; });
})();

/* Functies die nieuwer zijn dan Excel 2007 krijgen in .xlsx het voorvoegsel _xlfn. */
App.FN_XLFN = new Set(['IFS', 'IFNA', 'XLOOKUP', 'XMATCH', 'CONCAT', 'TEXTJOIN', 'MAXIFS', 'MINIFS', 'SWITCH', 'XOR', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'MODE.SNGL', 'RANK.EQ', 'PERCENTILE.INC', 'QUARTILE.INC', 'FORECAST.LINEAR', 'CEILING.MATH', 'FLOOR.MATH', 'ISOWEEKNUM', 'DAYS', 'NUMBERVALUE', 'UNICHAR', 'UNICODE', 'FORMULATEXT', 'ISFORMULA', 'TEXTBEFORE', 'TEXTAFTER']);
