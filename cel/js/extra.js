/* =========================================================
   Cel (gemaakt door JJ van Schelven) — extra Excel-onderdelen:
   draaitabellen, sparklines, Snel aanvullen (Ctrl+E),
   Snelle analyse (Ctrl+Q), overloopweergave in de formulebalk,
   en de vermelding van de maker.
   ========================================================= */
'use strict';

App.MAKER = 'JJ van Schelven';
App.VERSION = '2.0';

(() => {
  const F = App.F, NF = App.NF;

  /* ---------- Draaitabellen ---------- */
  const EN = () => App.LANG === 'en';
  const FN_LABEL = { sum: 'Som', count: 'Aantal', avg: 'Gemiddelde', max: 'Max', min: 'Min' };
  const FN_LABEL_EN = { sum: 'Sum', count: 'Count', avg: 'Average', max: 'Max', min: 'Min' };
  const W = { Waarden: 'Values', Rijlabels: 'Row Labels', Totaal: 'Total', Eindtotaal: 'Grand Total', leeg: '(blank)', van: 'of' };
  const tw = (k) => (EN() ? W[k] : k === 'leeg' ? '(leeg)' : k);
  const pivotSource = (p) => {
    const tk = F.tokenize(p.src, 'en').find((t) => t.t === 'ref');
    if (!tk) return null;
    const sh = tk.sheet ? App.sheetByName(tk.sheet) : null;
    if (!sh) return null;
    const A = F.refToArray(F.boundRef({ sh, r1: tk.r1, c1: tk.c1, r2: tk.r2, c2: tk.c2, ref: true }));
    if (A.length < 2) return null;
    const heads = A[0].map((h, i) => (h === null || h === '' ? 'Kolom' + (i + 1) : NF.format(h).text));
    const recs = A.slice(1).filter((row) => row.some((v) => v !== null && v !== ''));
    return { heads, recs };
  };
  const keyOf = (v) => (v === null || v === undefined || v === '' ? tw('leeg') : NF.format(v).text);
  const sortKeys = (keys, sample) => keys.sort((a, b) => F.cmpVals(sample.get(a), sample.get(b)));
  const agg = (vals, fn) => {
    const nums = vals.filter((v) => typeof v === 'number');
    if (fn === 'count') return vals.filter((v) => v !== null && v !== '').length;
    if (!nums.length) return fn === 'sum' ? 0 : null;
    if (fn === 'sum') return nums.reduce((a, b) => a + b, 0);
    if (fn === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (fn === 'max') return Math.max(...nums);
    if (fn === 'min') return Math.min(...nums);
    return null;
  };
  App.buildPivot = (sh, p) => {
    const src = pivotSource(p);
    if (!src) { App.toast('De brongegevens van de draaitabel zijn niet gevonden.', 'error'); return false; }
    // oude uitvoer wissen
    if (p.out) for (let r = p.out.r1; r <= p.out.r2; r++) for (let c = p.out.c1; c <= p.out.c2; c++) App.delCell(sh, r, c);
    let recs = src.recs;
    if (p.filter !== null && p.filter !== undefined && p.filterVal) recs = recs.filter((row) => keyOf(row[p.filter]) === p.filterVal);
    const sample = new Map();
    const uniq = (idx) => { const s = new Set(); recs.forEach((row) => { const k = keyOf(row[idx]); s.add(k); if (!sample.has(k)) sample.set(k, row[idx]); }); return sortKeys(Array.from(s), sample); };
    const r1 = p.rows[0], r2 = p.rows[1];
    const colKeys = p.cols !== null && p.cols !== undefined ? uniq(p.cols) : [null];
    const vals = p.vals.length ? p.vals : [{ f: r1, fn: 'count' }];
    const at = p.at;
    let r = at.r, c0 = at.c;
    const put = (rr, cc, v, st) => { const cell = App.cellAt(sh, rr, cc); if (v !== null && v !== undefined) cell.v = v; else delete cell.v; delete cell.f; cell.s = st ? { ...st } : undefined; if (!cell.s) delete cell.s; };
    const HEAD = { b: true, fill: '#dceaf3', bd: { b: ['thin', '#156082'] } };
    const TOT = { b: true, fill: '#dceaf3', bd: { t: ['thin', '#156082'] } };
    const nfOf = (vf) => { const ex = recs.find((row) => typeof row[vf.f] === 'number'); return vf.fn === 'count' ? undefined : (p.nf && p.nf[vf.f]) || undefined; void ex; };
    // filterregel
    if (p.filter !== null && p.filter !== undefined) { put(r, c0, src.heads[p.filter], { b: true }); put(r, c0 + 1, p.filterVal || '(Alle)', { i: true }); r += 2; }
    // kopregels
    const valLabel = (vf) => `${EN() ? FN_LABEL_EN[vf.fn] : FN_LABEL[vf.fn]} ${tw('van')} ${src.heads[vf.f]}`;
    const multiCol = colKeys[0] !== null;
    if (multiCol) { put(r, c0, vals.length === 1 ? valLabel(vals[0]) : tw('Waarden'), HEAD); put(r, c0 + 1, src.heads[p.cols], HEAD); r++; }
    put(r, c0, r1 === undefined || r1 === null ? '' : tw('Rijlabels'), HEAD);
    let c = c0 + 1;
    colKeys.forEach((ck) => vals.forEach((vf) => { put(r, c++, multiCol ? (vals.length > 1 ? `${ck} - ${valLabel(vf)}` : ck) : valLabel(vf), HEAD); }));
    if (multiCol) vals.forEach((vf) => put(r, c++, vals.length > 1 ? `${tw('Totaal')} ${valLabel(vf)}` : tw('Eindtotaal'), HEAD));
    const lastCol = c - 1;
    r++;
    const writeRow = (label, rows, st, indent) => {
      put(r, c0, label, { ...(st || {}), ...(indent ? { ind: 1 } : {}) });
      let cc = c0 + 1;
      colKeys.forEach((ck) => vals.forEach((vf) => { const sub = ck === null ? rows : rows.filter((row) => keyOf(row[p.cols]) === ck); const v = agg(sub.map((row) => row[vf.f]), vf.fn); put(r, cc++, v, { ...(st || {}), nf: nfOf(vf) }); }));
      if (multiCol) vals.forEach((vf) => put(r, cc++, agg(rows.map((row) => row[vf.f]), vf.fn), { ...(st || {}), b: true, nf: nfOf(vf) }));
      r++;
    };
    if (r1 === null || r1 === undefined) writeRow(tw('Totaal'), recs, null);
    else {
      uniq(r1).forEach((k1) => {
        const rows1 = recs.filter((row) => keyOf(row[r1]) === k1);
        if (r2 !== null && r2 !== undefined) {
          writeRow(k1, rows1, { b: true });
          const s2 = new Map(); const ks = new Set(); rows1.forEach((row) => { const k = keyOf(row[r2]); ks.add(k); if (!s2.has(k)) s2.set(k, row[r2]); });
          sortKeys(Array.from(ks), s2).forEach((k2) => writeRow(k2, rows1.filter((row) => keyOf(row[r2]) === k2), null, true));
        } else writeRow(k1, rows1, null);
      });
    }
    writeRow(tw('Eindtotaal'), recs, TOT);
    p.out = { r1: at.r, c1: c0, r2: r - 1, c2: lastCol };
    for (let cc = c0; cc <= lastCol; cc++) {
      let w = 0;
      for (let rr = at.r; rr < r; rr++) { const cell = App.getCell(sh, rr, cc); if (cell && App.hasValue(cell)) w = Math.max(w, App.measureText(App.fontOf(cell.s || {}), NF.format(cell.v, (cell.s || {}).nf).text) + 16); }
      if (w > App.colW(cc, sh)) sh.colW[cc] = Math.min(320, Math.ceil(w));
    }
    App.invalidateDims(sh);
    return true;
  };
  App.pivotAt = (sh, r, c) => (sh.pivots || []).find((p) => p.out && App.inRange(p.out, r, c)) || null;
  const pivotDialog = (existing) => {
    const sh = App.sh(); const s = sh.sel;
    let srcText;
    if (existing) srcText = F.toLocal(existing.src);
    else {
      let g = App.selRange();
      if (g.r1 === g.r2 && g.c1 === g.c2) g = App.currentRegion(sh, s.ar, s.ac);
      if (!g) { App.toast('Selecteer een cel in een lijst met kopteksten om een draaitabel te maken.', 'info', { ms: 4000 }); return; }
      srcText = App.sheetRef(sh.name) + '!' + App.absRangeStr(App.selBounded(g, sh));
    }
    const p0 = existing || { rows: [0, null], cols: null, vals: [], filter: null };
    App.dialog({
      title: existing ? 'Velden van draaitabel' : 'Draaitabel maken', wide: true,
      body: `<label class="field"><span>Tabel of bereik</span><input id="pv-src" value="${App.esc(srcText)}"></label>
        ${existing ? '' : `<div class="field"><span>Plaats</span><div class="row" style="gap:14px"><label class="chk"><input type="radio" name="pv-to" value="new" checked> Nieuw werkblad</label><label class="chk"><input type="radio" name="pv-to" value="here"> Bestaand werkblad, cel: <input id="pv-cell" class="inp" style="width:90px;height:26px" value="${App.addr(s.ar, Math.min(App.MAXC - 1, (App.currentRegion(sh, s.ar, s.ac) || { c2: s.ac }).c2 + 2))}"></label></div></div>`}
        <div id="pv-fields"></div>`,
      onOpen: (d) => {
        const render = () => {
          const src = pivotSource({ src: F.toCanon(d.$('#pv-src').value.replace(/^=/, '')) });
          if (!src) { d.$('#pv-fields').innerHTML = '<p class="muted">Ongeldig bereik: kies een bereik met een kopregel en gegevens.</p>'; return; }
          const opts = (sel, none) => (none ? `<option value="">${none}</option>` : '') + src.heads.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${App.esc(h)}</option>`).join('');
          const numericIdx = src.heads.findIndex((_, i) => src.recs.some((row) => typeof row[i] === 'number'));
          const vals = p0.vals.length ? p0.vals : [{ f: numericIdx >= 0 ? numericIdx : 0, fn: numericIdx >= 0 ? 'sum' : 'count' }];
          const fnSel = (fn) => Object.entries(EN() ? FN_LABEL_EN : FN_LABEL).map(([k, l]) => `<option value="${k}" ${k === fn ? 'selected' : ''}>${l}</option>`).join('');
          const filterVals = p0.filter !== null && p0.filter !== undefined ? Array.from(new Set(src.recs.map((row) => keyOf(row[p0.filter])))) : [];
          d.$('#pv-fields').innerHTML = `<div class="fields-2">
            <label class="field"><span>Rijen</span><select id="pv-r1">${opts(p0.rows[0], '(geen)')}</select></label>
            <label class="field"><span>Rijen (tweede niveau)</span><select id="pv-r2">${opts(p0.rows[1], '(geen)')}</select></label>
            <label class="field"><span>Kolommen</span><select id="pv-c">${opts(p0.cols, '(geen)')}</select></label>
            <label class="field"><span>Filter</span><div class="row" style="gap:6px"><select id="pv-f" class="inp">${opts(p0.filter, '(geen)')}</select><select id="pv-fv" class="inp"><option value="">(Alle)</option>${filterVals.map((v) => `<option ${v === p0.filterVal ? 'selected' : ''}>${App.esc(v)}</option>`).join('')}</select></div></label></div>
            <div class="small" style="font-weight:600;margin:4px 0 6px">Waarden</div>
            <div id="pv-vals">${vals.map((vf) => `<div class="row pv-val" style="gap:8px;margin-bottom:6px"><select class="inp pv-fn" style="width:130px">${fnSel(vf.fn)}</select><span>van</span><select class="inp pv-vf">${opts(vf.f)}</select><button class="qb pv-del" title="Verwijderen"><span class="i">close</span></button></div>`).join('')}</div>
            <button class="btn small" id="pv-add"><span class="i">add</span> Waarde toevoegen</button>
            <p class="muted small">De draaitabel wordt bijgewerkt via Gegevens › Alles vernieuwen of via rechtsklik › Vernieuwen.</p>`;
          d.$('#pv-add').onclick = () => { p0.vals = readVals(d); p0.vals.push({ f: numericIdx >= 0 ? numericIdx : 0, fn: 'sum' }); readMain(d); render(); };
          d.$('#pv-vals').onclick = (e) => { const b = e.target.closest('.pv-del'); if (b && d.$$('.pv-val').length > 1) { b.closest('.pv-val').remove(); } };
          d.$('#pv-f').onchange = () => { readMain(d); p0.vals = readVals(d); p0.filterVal = ''; render(); };
        };
        const readVals = (dd) => dd.$$('.pv-val').map((row) => ({ fn: row.querySelector('.pv-fn').value, f: +row.querySelector('.pv-vf').value }));
        const readMain = (dd) => { const g = (id) => (dd.$(id) && dd.$(id).value !== '' ? +dd.$(id).value : null); p0.rows = [g('#pv-r1'), g('#pv-r2')]; p0.cols = g('#pv-c'); p0.filter = g('#pv-f'); p0.filterVal = dd.$('#pv-fv') ? dd.$('#pv-fv').value : ''; };
        d._read = () => { readMain(d); p0.vals = readVals(d); };
        d.$('#pv-src').addEventListener('change', render);
        render();
      },
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          d._read();
          const srcCanon = F.toCanon(d.$('#pv-src').value.replace(/^=/, ''));
          if (!pivotSource({ src: srcCanon })) { App.toast('Ongeldig bronbereik', 'error'); return false; }
          const def = { id: existing ? existing.id : App.uid('pv'), src: srcCanon, rows: p0.rows, cols: p0.cols, vals: p0.vals, filter: p0.filter, filterVal: p0.filterVal, out: existing ? existing.out : null };
          App.run(() => {
            let target = sh, at;
            if (existing) { at = existing.at; Object.assign(existing, def, { at }); App.buildPivot(sh, existing); return; }
            if (d.$('input[name=pv-to]:checked').value === 'new') {
              target = App.newSheet(App.uniqueSheetName());
              App.book.sheets.splice(App.book.active, 0, target);
              at = { r: 2, c: 0 };
            } else { const a = App.parseAddr(d.$('#pv-cell').value); if (!a) { App.toast('Ongeldige cel', 'error'); return false; } at = { r: a.r, c: a.c }; }
            def.at = at;
            target.pivots = target.pivots || [];
            target.pivots.push(def);
            App.buildPivot(target, def);
            if (target !== sh) { App.book.active = App.book.sheets.indexOf(target); App.afterSheetSwitch(); }
            App.setSel({ r1: at.r, c1: at.c, r2: at.r, c2: at.c }, at.r, at.c);
          }, { touchAll: true });
        },
      }],
    });
  };
  App.def('insertPivot', () => pivotDialog(null));
  App.def('pivotEdit', () => { const sh = App.sh(); const s = sh.sel; const p = App.pivotAt(sh, s.ar, s.ac); if (p) pivotDialog(p); else App.toast('Selecteer een cel in een draaitabel.', 'info'); });
  App.defEdit('refreshAll', () => {
    let n = 0;
    App.recalc();
    App.book.sheets.forEach((sh) => (sh.pivots || []).forEach((p) => { if (App.buildPivot(sh, p)) n++; }));
    App.book.sheets.forEach((sh) => { if (sh.filter) App.applyFilter(sh); });
    App.toast(n ? `${n} draaitabel${n > 1 ? 'len' : ''} vernieuwd` : 'Alles is bijgewerkt', 'ok');
  }, { touchAll: true, allowProtected: true });
  App.defEdit('pivotRefresh', () => { const sh = App.sh(); const p = App.pivotAt(sh, sh.sel.ar, sh.sel.ac); if (!p) return false; App.buildPivot(sh, p); });
  App.defEdit('pivotDelete', () => { const sh = App.sh(); const p = App.pivotAt(sh, sh.sel.ar, sh.sel.ac); if (!p) return false; for (let r = p.out.r1; r <= p.out.r2; r++) for (let c = p.out.c1; c <= p.out.c2; c++) App.delCell(sh, r, c); sh.pivots = sh.pivots.filter((x) => x !== p); });

  /* ---------- Sparklines ---------- */
  const SPARK_NAME = { line: 'Lijn', column: 'Kolom', winloss: 'Winst/verlies' };
  App.def('insertSpark', (type = 'line') => {
    const sh = App.sh();
    const g = App.selBounded(App.selRange(), sh);
    const single = g.r1 === g.r2 && g.c1 === g.c2;
    const loc = single ? App.addr(g.r1, g.c1) : App.rangeStr({ r1: g.r1, c1: g.c2 + 1, r2: g.r2, c2: g.c2 + 1 });
    App.dialog({
      title: 'Sparklines maken — ' + SPARK_NAME[type],
      body: `<label class="field"><span>Gegevensbereik</span><input id="sk-src" value="${single ? '' : App.rangeStr(g)}" placeholder="bijv. B2:G2"></label>
        <label class="field"><span>Locatiebereik</span><input id="sk-loc" value="${loc}"></label>
        <div class="fields-2"><label class="field"><span>Kleur</span><input type="color" id="sk-col" value="#156082"></label><label class="chk" style="margin-top:20px"><input type="checkbox" id="sk-mk"> Hoogste en laagste punt markeren</label></div>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const src = App.parseRange(d.$('#sk-src').value), lc = App.parseRange(d.$('#sk-loc').value);
          if (!src || !lc) { App.toast('Vul een geldig gegevens- en locatiebereik in.', 'error'); return false; }
          const locs = []; for (let r = lc.r1; r <= lc.r2; r++) for (let c = lc.c1; c <= lc.c2; c++) locs.push({ r, c });
          const vertical = lc.c1 === lc.c2 && locs.length > 1;
          App.run(() => {
            sh.sparks = (sh.sparks || []).filter((x) => !locs.some((l) => l.r === x.r && l.c === x.c));
            locs.forEach((l, i) => {
              let part;
              if (locs.length === 1) part = src;
              else if (vertical) part = { r1: src.r1 + i, r2: src.r1 + i, c1: src.c1, c2: src.c2 };
              else part = { r1: src.r1, r2: src.r2, c1: src.c1 + i, c2: src.c1 + i };
              sh.sparks.push({ r: l.r, c: l.c, src: App.rangeStr(part), type, color: d.$('#sk-col').value, markers: d.$('#sk-mk').checked });
            });
          });
        },
      }],
    });
  });
  App.defEdit('clearSparks', () => { const sh = App.sh(); const sel = App.selRanges(); const n = (sh.sparks || []).length; sh.sparks = (sh.sparks || []).filter((x) => !sel.some((g) => App.inRange(g, x.r, x.c))); return sh.sparks.length !== n; });

  /* ---------- Snel aanvullen (Ctrl+E) ---------- */
  const proper = (s) => s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const TRANS = [['', (s) => s], ['U', (s) => s.toUpperCase()], ['L', (s) => s.toLowerCase()], ['P', proper]];
  const atomsOf = (sources) => {
    // functies (rij -> tekst) uit de broncellen
    const out = [];
    sources.forEach((j) => {
      const get = (row) => row[j] || '';
      out.push({ k: `c${j}`, f: get });
      const SPL = [/\s+/, /[\s,;]+/, /[-_/.]/, /@/, /[\s,;\-_/.@()]+/];
      SPL.forEach((re, si) => {
        for (let t = 0; t < 4; t++) {
          out.push({ k: `c${j}s${si}t${t}`, f: (row) => get(row).split(re).filter(Boolean)[t] || '' });
          out.push({ k: `c${j}s${si}l${t}`, f: (row) => { const p = get(row).split(re).filter(Boolean); return p[p.length - 1 - t] || ''; } });
          out.push({ k: `c${j}s${si}i${t}`, f: (row) => (get(row).split(re).filter(Boolean)[t] || '').slice(0, 1) });
        }
      });
      out.push({ k: `c${j}dig`, f: (row) => get(row).replace(/\D+/g, '') });
      out.push({ k: `c${j}let`, f: (row) => get(row).replace(/[^\p{L}\s]+/gu, '').trim() });
      for (let n = 1; n <= 6; n++) { out.push({ k: `c${j}f${n}`, f: (row) => get(row).slice(0, n) }); out.push({ k: `c${j}e${n}`, f: (row) => get(row).slice(-n) }); }
    });
    const res = [];
    out.forEach((a) => TRANS.forEach(([tk, tf]) => res.push({ k: a.k + tk, f: (row) => tf(a.f(row)) })));
    return res;
  };
  const learn = (atoms, row, target) => {
    // kortste uitleg van target als reeks stukjes (bron-atomen) en letterlijke tekens
    const n = target.length;
    const best = new Array(n + 1).fill(Infinity), how = new Array(n + 1).fill(null);
    best[0] = 0;
    const vals = atoms.map((a) => ({ a, v: a.f(row) })).filter((x) => x.v);
    for (let i = 0; i < n; i++) {
      if (best[i] === Infinity) continue;
      if (best[i] + 1 < best[i + 1]) { best[i + 1] = best[i] + 1; how[i + 1] = { from: i, lit: target[i] }; }
      for (const x of vals) {
        if (target.startsWith(x.v, i)) { const j = i + x.v.length; const cost = best[i] + 0.2; if (cost < best[j]) { best[j] = cost; how[j] = { from: i, atom: x.a }; } }
      }
    }
    if (best[n] === Infinity) return null;
    const prog = [];
    for (let i = n; i > 0; i = how[i].from) prog.unshift(how[i]);
    // aaneengesloten letterlijke tekens samenvoegen
    const merged = [];
    prog.forEach((p) => { const last = merged[merged.length - 1]; if (p.lit !== undefined && last && last.lit !== undefined) last.lit += p.lit; else merged.push({ ...p }); });
    if (!merged.some((p) => p.atom)) return null;
    return merged;
  };
  const runProg = (prog, row) => prog.map((p) => (p.atom ? p.atom.f(row) : p.lit)).join('');
  App.defEdit('flashFill', () => {
    const sh = App.sh(); const s = sh.sel;
    const tc = s.ac;
    const reg = App.currentRegion(sh, s.ar, tc) || App.currentRegion(sh, s.ar, Math.max(0, tc - 1));
    if (!reg) { App.toast('Snel aanvullen: typ eerst een voorbeeld naast je gegevens.', 'info', { ms: 4000 }); return false; }
    const c1 = Math.min(reg.c1, tc), c2 = Math.max(reg.c2, tc);
    const sources = []; for (let c = c1; c <= c2; c++) if (c !== tc) sources.push(c - c1);
    const text = (r, c) => { const cell = App.getCell(sh, r, c); return cell && App.hasValue(cell) ? NF.format(App.valueOf(cell), App.styleAt(sh, r, c, cell).nf).text : ''; };
    const rows = [];
    for (let r = reg.r1; r <= reg.r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(text(r, c)); rows.push({ r, row, target: text(r, tc) }); }
    // kopregel overslaan als de doelkolom daar tekst heeft en er geen patroon in zit
    const examples = rows.filter((x) => x.target && x.row.some((v, i) => v && i !== tc - c1));
    const todo = rows.filter((x) => !x.target && x.row.some((v, i) => v && i !== tc - c1));
    if (!examples.length || !todo.length) { App.toast('Snel aanvullen: typ eerst één of twee voorbeelden en laat de rest van de kolom leeg.', 'info', { ms: 4500 }); return false; }
    const atoms = atomsOf(sources);
    let prog = null;
    // het eerste voorbeeld kan een kopregel zijn: probeer vanaf elk voorbeeld
    for (let start = 0; start < Math.min(examples.length, 3) && !prog; start++) {
      const ex = examples.slice(start);
      const cand = learn(atoms, ex[0].row, ex[0].target);
      if (cand && ex.every((x) => runProg(cand, x.row) === x.target)) prog = cand;
    }
    if (!prog) { App.toast('Snel aanvullen heeft geen patroon gevonden. Geef een extra voorbeeld.', 'error', { ms: 4000 }); return false; }
    todo.forEach((x) => { if (x.r > examples[0].r) App.setCellFromText(sh, x.r, tc, "'" + runProg(prog, x.row)); });
    App.setSel({ r1: todo[0].r, c1: tc, r2: todo[todo.length - 1].r, c2: tc }, todo[0].r, tc);
    App.toast(`Snel aanvullen: ${todo.length} cellen ingevuld`, 'bolt');
    return true;
  });

  /* ---------- Snelle analyse (Ctrl+Q) ---------- */
  App.def('quickAnalysis', (ev) => {
    const g = App.selRange();
    if (g.r1 === g.r2 && g.c1 === g.c2) { App.toast('Selecteer eerst meerdere cellen voor Snelle analyse.', 'info'); return; }
    const a = App.rangeScreenRect(App.selBounded(g));
    const wr = $('#grid-scroll').getBoundingClientRect();
    const pos = ev && ev.clientX ? { x: ev.clientX, y: ev.clientY } : { x: wr.left + Math.min(a.x + a.w, wr.width - 380), y: Math.min(wr.top + a.y + a.h + 6, innerHeight - 200) };
    const tabs = {
      Opmaak: [['cfBar', '#638ec6', 'data_thresholding', 'Gegevensbalken'], ['cfScale', '#f8696b,#ffeb84,#63be7b', 'gradient', 'Kleurenschaal'], ['cfIcons', 'arrows', 'trending_up', 'Pictogramset'], ['cfDialog', 'gt', 'chevron_right', 'Groter dan'], ['cfDialog', 'top', 'vertical_align_top', 'Top 10%'], ['cfClear', 'sel', 'format_clear', 'Opmaak wissen']],
      Grafieken: [['insertChart', 'column', 'bar_chart', 'Gegroepeerde kolom'], ['insertChart', 'line', 'show_chart', 'Lijn'], ['insertChart', 'pie', 'pie_chart', 'Cirkel'], ['insertChart', 'bar', 'align_horizontal_left', 'Gegroepeerde staaf'], ['insertChart', 'scatter', 'scatter_plot', 'Spreiding']],
      Totalen: [['autoSum', 'SUM', 'functions', 'Som'], ['autoSum', 'AVERAGE', 'avg_pace', 'Gemiddelde'], ['autoSum', 'COUNT', 'tag', 'Aantal'], ['autoSum', 'MAX', 'arrow_upward', 'Max'], ['autoSum', 'MIN', 'arrow_downward', 'Min']],
      Tabellen: [['formatAsTable', 'medium1', 'table_view', 'Tabel'], ['insertPivot', '', 'pivot_table_chart', 'Draaitabel']],
      Sparklines: [['insertSpark', 'line', 'show_chart', 'Lijn'], ['insertSpark', 'column', 'bar_chart', 'Kolom'], ['insertSpark', 'winloss', 'stacked_bar_chart', 'Winst/verlies']],
    };
    const names = Object.keys(tabs);
    const body = (t) => `<div class="qa-items">${tabs[t].map(([cmd, arg, ic, l]) => `<button data-cmd="${cmd}" data-arg="${App.esc(arg)}"><span class="i">${ic}</span><span>${l}</span></button>`).join('')}</div>`;
    const m = App.openPopup(pos, `<div class="qa"><div class="qa-tabs">${names.map((t, i) => `<button data-qt="${t}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div><div class="qa-body">${body(names[0])}</div><div class="qa-hint">Met de opdrachten voor snelle analyse kun je je gegevens snel analyseren.</div></div>`, 'qa-menu');
    m.addEventListener('click', (e) => {
      const t = e.target.closest('[data-qt]');
      if (t) { e.stopPropagation(); m.querySelectorAll('[data-qt]').forEach((x) => x.classList.toggle('on', x === t)); m.querySelector('.qa-body').innerHTML = body(t.dataset.qt); }
    });
  });

  /* ---------- Sneltoetsen ---------- */
  document.addEventListener('keydown', (e) => {
    if (App.state.editing || $('.backdrop') || $('#backstage')) return;
    if (e.target.matches('input, select, textarea') && e.target.id !== 'cell-editor') return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') { e.preventDefault(); App.exec('flashFill'); }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'q') { e.preventDefault(); App.exec('quickAnalysis'); }
  }, true);
  App.shortcuts.push(['Extra', [['Snel aanvullen', 'Ctrl+E'], ['Snelle analyse', 'Ctrl+Q'], ['Overloopbereik in formule', 'A1#']]]);

  /* ---------- Overloopbereik in de formulebalk (grijs, zoals Excel) ---------- */
  const fbar = $('#formula');
  const origFB = App.updateFormulaBar;
  App.updateFormulaBar = () => {
    origFB();
    fbar.classList.remove('ghost');
    if (App.state.editing) return;
    const sh = App.sh(); const s = sh.sel;
    if (!F.isEmptyCell(App.getCell(sh, s.ar, s.ac))) return;
    const a = F.spillAnchor(sh, s.ar, s.ac);
    if (!a || (a.r === s.ar && a.c === s.ac)) return;
    const ac = App.getCell(sh, a.r, a.c);
    if (ac && ac.f) { fbar.value = '=' + F.toLocal(ac.f); fbar.classList.add('ghost'); }
  };
  // rechtsklikmenu: draaitabel
  const origMenu = App.openGridMenu;
  App.openGridMenu = (ev, h) => {
    origMenu(ev, h);
    const sh = App.sh(); const s = sh.sel;
    const m = App.popup; if (!m) return;
    const extra = [];
    if (App.pivotAt(sh, s.ar, s.ac)) extra.push('<button data-cmd="pivotRefresh"><span class="i">refresh</span> Vernieuwen</button><button data-cmd="pivotEdit"><span class="i">pivot_table_chart</span> Velden van draaitabel…</button><button data-cmd="pivotDelete"><span class="i">delete</span> Draaitabel verwijderen</button><hr>');
    const g = App.selRange();
    if (!(g.r1 === g.r2 && g.c1 === g.c2)) extra.push('<button data-cmd="quickAnalysis"><span class="i">insights</span> Snelle analyse <kbd>Ctrl+Q</kbd></button><hr>');
    if (extra.length) m.insertAdjacentHTML('afterbegin', extra.join(''));
    App.positionPopup(m, { x: ev.clientX, y: ev.clientY });
  };

  /* ---------- Maker: JJ van Schelven ---------- */
  App.def('showAbout', () => App.dialog({
    title: 'Over Cel',
    body: `<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><div class="logo" style="width:44px;height:44px;margin:0;border-radius:8px"><span class="i" style="font-size:30px">grid_on</span></div>
      <div><b style="font-size:18px;font-weight:600">Cel</b><div class="muted">Rekenblad · versie ${App.VERSION}</div><div style="margin-top:2px">Gemaakt door <b>${App.MAKER}</b></div></div></div>
      <p style="line-height:1.55;margin:0 0 8px">Cel is een rekenprogramma met ruim ${Object.keys(App.FN).length} functies met Nederlandse namen, dynamische matrices, draaitabellen, grafieken, sparklines, voorwaardelijke opmaak en het openen en opslaan van .xlsx-bestanden.</p>
      <p style="line-height:1.55;margin:0 0 8px" class="muted">Geen account, geen gegevens invullen: alles blijft op je eigen computer. Open source.</p>
      <p style="margin:0" class="small">© ${new Date().getFullYear()} ${App.MAKER}. Cel is een onafhankelijk project en is niet verbonden aan Microsoft. Excel is een merk van Microsoft Corporation; .xlsx is een open standaard (ECMA-376).</p>`,
  }));
  // Bestand-scherm: pagina "Over Cel" en vermelding onderaan
  const origBS = App.renderBackstage;
  App.renderBackstage = (sec) => {
    const bs = $('#backstage');
    if (bs && !bs.querySelector('[data-bs="about"]')) {
      const opt = bs.querySelector('.bs-nav [data-bs="options"]');
      const b = document.createElement('button'); b.dataset.bs = 'about'; b.textContent = 'Account';
      opt.parentNode.insertBefore(b, opt);
    }
    if (sec === 'about') {
      $$('.bs-nav [data-bs]', bs).forEach((b) => b.classList.toggle('on', b.dataset.bs === 'about'));
      const main = bs.querySelector('.bs-main');
      main.onclick = null; main.onchange = null;
      main.innerHTML = `<h1>Account</h1>
        <div class="props"><span class="k">Gebruiker</span><span>Geen account nodig — alles blijft op deze computer</span>
        <span class="k">Thema</span><span>${App.settings.dark ? 'Donker' : 'Licht'}</span></div>
        <h3>Productinformatie</h3>
        <div class="bs-cards"><div class="bs-card" style="cursor:default"><span class="i" style="color:var(--brand)">grid_on</span><div><b>Cel ${App.VERSION}</b><small>Rekenblad, gemaakt door <b>${App.MAKER}</b>.<br>Onderdeel van dezelfde reeks als Inkt (tekstverwerker).<br>Open source · © ${new Date().getFullYear()} ${App.MAKER}</small></div></div>
        <button class="bs-card" data-about="1"><span class="i">info</span><div><b>Over Cel</b><small>Versie, functies en de maker.</small></div></button></div>`;
      main.querySelector('[data-about]').onclick = () => App.exec('showAbout');
      return;
    }
    origBS(sec);
    const main = bs && bs.querySelector('.bs-main');
    if (main && !main.querySelector('.bs-credit')) main.insertAdjacentHTML('beforeend', `<p class="bs-credit">Cel ${App.VERSION} · gemaakt door ${App.MAKER}</p>`);
  };
  const logo = $('#titlebar .logo'); if (logo) logo.title = `Cel — gemaakt door ${App.MAKER}`;
  App.def('showTour', ((orig) => () => { orig(); const b = $('.dialog:last-of-type .dlg-body') || $$('.dialog').pop()?.querySelector('.dlg-body'); if (b) b.insertAdjacentHTML('beforeend', `<p class="muted small" style="margin-top:12px">Cel is gemaakt door ${App.MAKER}.</p>`); })(App.commands.showTour.fn));
  console.info(`Cel ${App.VERSION} — gemaakt door ${App.MAKER}`);
})();
