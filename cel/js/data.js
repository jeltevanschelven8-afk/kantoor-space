/* =========================================================
   Cel (gemaakt door JJ van Schelven) — gegevens en formules: sorteren, filteren, validatie,
   hulpmiddelen, AutoSom, functies invoegen, namen, controleren,
   rechtsklikmenu
   ========================================================= */
'use strict';

(() => {
  const F = App.F, NF = App.NF;

  /* ---------- Sorteren ---------- */
  const sortKey = (v) => (v === null || v === undefined || v === '' ? null : v);
  const cmpSort = (a, b, desc) => {
    a = sortKey(a); b = sortKey(b);
    if (a === null && b === null) return 0;
    if (a === null) return 1;          // lege cellen altijd onderaan
    if (b === null) return -1;
    const rank = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : 3);
    let d = rank(a) - rank(b);
    if (!d) {
      if (typeof a === 'string') d = a.localeCompare(b, 'nl', { numeric: true, sensitivity: 'base' });
      else if (typeof a === 'number') d = a - b;
      else if (typeof a === 'boolean') d = (a ? 1 : 0) - (b ? 1 : 0);
    }
    return desc ? -d : d;
  };
  const guessHeader = (sh, g) => {
    if (g.r2 <= g.r1) return false;
    let txtTop = 0, numBelow = 0, cols = 0;
    for (let c = g.c1; c <= g.c2; c++) {
      const a = App.valueOf(App.getCell(sh, g.r1, c)), b = App.valueOf(App.getCell(sh, g.r1 + 1, c));
      if (a === null && b === null) continue;
      cols++;
      if (typeof a === 'string') txtTop++;
      if (typeof b !== 'string' || (App.getCell(sh, g.r1, c)?.s?.b && !App.getCell(sh, g.r1 + 1, c)?.s?.b)) numBelow++;
    }
    return cols > 0 && txtTop === cols && numBelow > 0;
  };
  App.sortRange = (sh, g, keys) => {
    const rows = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const cells = [];
      for (let c = g.c1; c <= g.c2; c++) cells.push(App.getCell(sh, r, c));
      rows.push({ r, cells, h: sh.rowH[r], man: sh.rowManual[r] });
    }
    rows.sort((x, y) => {
      for (const k of keys) {
        const d = cmpSort(App.valueOf(x.cells[k.c - g.c1]), App.valueOf(y.cells[k.c - g.c1]), k.desc);
        if (d) return d;
      }
      return x.r - y.r;
    });
    rows.forEach((row, i) => {
      const r = g.r1 + i;
      row.cells.forEach((cell, j) => {
        const c = g.c1 + j;
        App.delCell(sh, r, c);
      });
    });
    rows.forEach((row, i) => {
      const r = g.r1 + i;
      row.cells.forEach((cell, j) => {
        if (!cell) return;
        const c = g.c1 + j;
        if (cell.f && row.r !== r) cell.f = F.shift(cell.f, r - row.r, 0);
        delete cell._p;
        const m = sh.data.get(r) || new Map(); sh.data.set(r, m); m.set(c, cell);
      });
      if (App.isFullRow({ c1: g.c1, c2: g.c2 }) || (g.c1 === 0)) { if (row.h !== undefined) sh.rowH[r] = row.h; else delete sh.rowH[r]; }
    });
    App.invalidateDims(sh);
  };
  const sortTarget = () => {
    const sh = App.sh(); const s = sh.sel;
    let g = App.selRange();
    const single = g.r1 === g.r2 && g.c1 === g.c2;
    if (single || App.isFullCol(g)) {
      const reg = App.currentRegion(sh, s.ar, s.ac);
      if (!reg) return null;
      if (App.isFullCol(g)) g = { ...reg, c1: Math.min(reg.c1, g.c1), c2: Math.max(reg.c2, g.c2) }; else g = reg;
    }
    if (sh.filter && App.inRange({ r1: sh.filter.r, c1: sh.filter.c1, r2: sh.filter.r2 ?? App.MAXR - 1, c2: sh.filter.c2 }, s.ar, s.ac)) {
      const f = sh.filter; g = { r1: f.r, c1: f.c1, r2: filterBottom(sh), c2: f.c2 };
      return { g, header: true };
    }
    if (sh.merges.some((m) => App.rangesOverlap(m, g))) { App.toast('Sorteren is niet mogelijk met samengevoegde cellen in het bereik.', 'error'); return null; }
    return { g: App.selBounded(g, sh), header: guessHeader(sh, g) };
  };
  App.defEdit('sort', (dir) => {
    const sh = App.sh(); const t = sortTarget(); if (!t) return false;
    const g = t.header ? { ...t.g, r1: t.g.r1 + 1 } : t.g;
    const col = App.clamp(sh.sel.ac, g.c1, g.c2);
    App.sortRange(sh, g, [{ c: col, desc: dir === 'desc' }]);
    if (sh.filter) sh.filter.sort = { c: col, desc: dir === 'desc' };
    App.setSel(t.g, sh.sel.ar, sh.sel.ac);
    return true;
  });
  App.def('customSort', () => {
    const sh = App.sh(); const t = sortTarget();
    if (!t) { App.toast('Selecteer een cel in een bereik met gegevens.', 'info'); return; }
    const colName = (c, header) => (header ? (NF.format(App.valueOf(App.getCell(sh, t.g.r1, c))).text || 'Kolom ' + App.colName(c)) : 'Kolom ' + App.colName(c));
    const opts = (header) => { let o = ''; for (let c = t.g.c1; c <= t.g.c2; c++) o += `<option value="${c}">${App.esc(colName(c, header))}</option>`; return o; };
    const levelRow = (header, i) => `<div class="row" data-lv><span style="width:80px" class="small">${i ? 'Dan op' : 'Sorteren op'}</span><select class="lv-col">${opts(header)}</select><select class="lv-dir"><option value="asc">A naar Z / klein naar groot</option><option value="desc">Z naar A / groot naar klein</option></select><button class="qb lv-del" title="Niveau verwijderen"><span class="i">close</span></button></div>`;
    App.dialog({
      title: 'Sorteren', wide: true,
      body: `<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn small" id="lv-add"><span class="i">add</span> Niveau toevoegen</button><span style="flex:1"></span><label class="chk"><input type="checkbox" id="lv-head" ${t.header ? 'checked' : ''}> Mijn gegevens bevatten kopteksten</label></div><div class="sort-levels" id="lv-list">${levelRow(t.header, 0)}</div>`,
      onOpen: (d) => {
        const list = d.$('#lv-list');
        d.$('#lv-add').onclick = () => { if (list.children.length < 64) list.insertAdjacentHTML('beforeend', levelRow(d.$('#lv-head').checked, list.children.length)); };
        list.addEventListener('click', (e) => { const b = e.target.closest('.lv-del'); if (b && list.children.length > 1) b.closest('[data-lv]').remove(); });
        d.$('#lv-head').onchange = () => { const h = d.$('#lv-head').checked; list.querySelectorAll('.lv-col').forEach((s) => { const v = s.value; s.innerHTML = opts(h); s.value = v; }); };
        list.querySelector('.lv-col').value = String(App.clamp(sh.sel.ac, t.g.c1, t.g.c2));
      },
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const keys = d.$$('[data-lv]').map((row) => ({ c: +row.querySelector('.lv-col').value, desc: row.querySelector('.lv-dir').value === 'desc' }));
          const header = d.$('#lv-head').checked;
          App.run(() => { App.sortRange(sh, header ? { ...t.g, r1: t.g.r1 + 1 } : t.g, keys); App.setSel(t.g, t.g.r1, t.g.c1); });
        },
      }],
    });
  });

  /* ---------- Filteren ---------- */
  const filterBottom = (sh) => {
    const f = sh.filter;
    let r2 = Math.max(f.r2 ?? f.r, f.r);
    // uitbreiden zolang er onder het bereik nog gegevens staan
    const has = (r) => { for (let c = f.c1; c <= f.c2; c++) if (App.hasValue(App.getCell(sh, r, c))) return true; return false; };
    while (has(r2 + 1)) r2++;
    f.r2 = r2;
    return r2;
  };
  App.filterBottom = filterBottom;
  const dispOf = (sh, r, c) => { const cell = App.getCell(sh, r, c); if (!cell || !App.hasValue(cell)) return ''; return NF.format(App.valueOf(cell), App.styleAt(sh, r, c, cell).nf).text; };
  App.applyFilter = (sh) => {
    const f = sh.filter;
    sh.fhid = {};
    if (!f) { App.invalidateDims(sh); return; }
    const r2 = filterBottom(sh);
    const crit = f.crit || {};
    const cols = Object.keys(crit).map(Number).filter((c) => crit[c]);
    if (cols.length) {
      for (let r = f.r + 1; r <= r2; r++) {
        for (const c of cols) {
          const cr = crit[c];
          const t = dispOf(sh, r, c);
          let ok = true;
          if (cr.values) ok = cr.values.includes(t);
          if (ok && cr.op) { const v = App.valueOf(App.getCell(sh, r, c)); const n = typeof v === 'number' ? v : NaN; ok = cr.op === 'gt' ? n > cr.v : cr.op === 'lt' ? n < cr.v : cr.op === 'contains' ? t.toLowerCase().includes(String(cr.v).toLowerCase()) : true; }
          if (!ok) { sh.fhid[r] = 1; break; }
        }
      }
    }
    App.invalidateDims(sh);
  };
  App.defEdit('toggleFilter', () => {
    const sh = App.sh();
    if (sh.filter) { sh.filter = null; sh.fhid = {}; App.invalidateDims(sh); return; }
    const s = sh.sel;
    let g = App.selRange();
    if (g.r1 === g.r2 && g.c1 === g.c2) g = App.currentRegion(sh, s.ar, s.ac);
    if (!g) { App.toast('Selecteer een cel in een bereik met gegevens om te filteren.', 'info'); return false; }
    g = App.selBounded(g, sh);
    sh.filter = { r: g.r1, r2: g.r2, c1: g.c1, c2: g.c2, crit: {} };
  }, { allowProtected: false });
  App.stateFns.filter = () => !!App.sh().filter;
  App.defEdit('clearFilter', () => { const sh = App.sh(); if (!sh.filter) return false; sh.filter.crit = {}; App.applyFilter(sh); });
  App.defEdit('reapplyFilter', () => { const sh = App.sh(); if (!sh.filter) return false; App.applyFilter(sh); });
  App.openFilterMenu = (c, ev) => {
    const sh = App.sh();
    const f = sh.filter; if (!f) return;
    const r2 = filterBottom(sh);
    const vals = new Map();
    for (let r = f.r + 1; r <= r2; r++) {
      // alleen rijen die door andere kolommen niet al verborgen zijn
      const t = dispOf(sh, r, c);
      const v = App.valueOf(App.getCell(sh, r, c));
      if (!vals.has(t)) vals.set(t, v);
    }
    const list = Array.from(vals.entries()).sort((a, b) => cmpSort(a[1], b[1]));
    const cur = (f.crit && f.crit[c]) || null;
    const isOn = (t) => !cur || !cur.values || cur.values.includes(t);
    const colLabel = dispOf(sh, f.r, c) || 'Kolom ' + App.colName(c);
    const html = `<div class="filter-menu">
      <button class="mi" data-fs="asc"><span class="i">arrow_downward</span> Sorteren van A naar Z</button>
      <button class="mi" data-fs="desc"><span class="i">arrow_upward</span> Sorteren van Z naar A</button>
      <hr><button class="mi" data-fclear ${cur ? '' : 'disabled'}><span class="i">filter_alt_off</span> Filter wissen uit “${App.esc(colLabel)}”</button>
      <div class="fm-search"><span class="i" style="font-size:16px">search</span><input placeholder="Zoeken" id="fm-q"></div>
      <div class="fm-list"><label><input type="checkbox" id="fm-all" ${!cur ? 'checked' : ''}> (Alles selecteren)</label>${list.map(([t], k) => `<label data-t="${App.esc(t.toLowerCase())}"><input type="checkbox" data-k="${k}" ${isOn(t) ? 'checked' : ''}> ${t === '' ? '(Lege cellen)' : App.esc(t)}</label>`).join('')}</div>
      <div class="fm-foot"><button class="btn small primary" id="fm-ok">OK</button><button class="btn small" id="fm-cancel">Annuleren</button></div></div>`;
    const m = App.openPopup({ x: ev.clientX - 20, y: ev.clientY + 10 }, html);
    const q = m.querySelector('#fm-q'), all = m.querySelector('#fm-all');
    const boxes = () => Array.from(m.querySelectorAll('[data-k]'));
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase();
      m.querySelectorAll('[data-t]').forEach((l) => { const vis = l.dataset.t.includes(s); l.hidden = !vis; l.querySelector('input').checked = s ? vis : l.querySelector('input').checked; });
    });
    all.addEventListener('change', () => boxes().forEach((b) => { if (!b.closest('label').hidden) b.checked = all.checked; }));
    m.addEventListener('click', (e) => {
      const fs = e.target.closest('[data-fs]');
      if (fs) { App.closePopup(); App.run(() => { const g = { r1: f.r + 1, c1: f.c1, r2: filterBottom(sh), c2: f.c2 }; App.sortRange(sh, g, [{ c, desc: fs.dataset.fs === 'desc' }]); f.sort = { c, desc: fs.dataset.fs === 'desc' }; App.applyFilter(sh); }); return; }
      if (e.target.closest('[data-fclear]')) { App.closePopup(); App.run(() => { delete f.crit[c]; App.applyFilter(sh); }); return; }
      if (e.target.closest('#fm-cancel')) { App.closePopup(); return; }
      if (e.target.closest('#fm-ok')) {
        const chosen = boxes().filter((b) => b.checked && !b.closest('label').hidden).map((b) => list[+b.dataset.k][0]);
        App.closePopup();
        App.run(() => {
          f.crit = f.crit || {};
          if (chosen.length === list.length) delete f.crit[c]; else f.crit[c] = { values: chosen };
          App.applyFilter(sh);
        });
      }
    });
  };

  /* ---------- Tekst naar kolommen ---------- */
  App.def('textToColumns', () => {
    const sh = App.sh();
    const g = App.selBounded(App.selRange(), sh);
    if (g.c1 !== g.c2) { App.toast('Selecteer één kolom met tekst.', 'info'); return; }
    const lines = [];
    for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 2000); r++) { const v = App.valueOf(App.getCell(sh, r, g.c1)); lines.push(v === null ? '' : String(NF.format(v).text)); }
    const split = (d) => {
      const ds = d.$$('[data-d]').filter((x) => x.checked).map((x) => x.dataset.d);
      const o = d.$('#tc-other').value; if (o) ds.push(o);
      if (!ds.length) return lines.map((l) => [l]);
      const re = new RegExp('[' + ds.map((x) => x.replace(/[\]\\^-]/g, '\\$&')).join('') + ']' + (d.$('#tc-merge').checked ? '+' : ''));
      return lines.map((l) => l.split(re));
    };
    App.dialog({
      title: 'Tekst naar kolommen', wide: true,
      body: `<div class="checks"><span class="small">Scheidingstekens:</span>
        <label><input type="checkbox" data-d="\t"> Tab</label><label><input type="checkbox" data-d=";" ${lines.some((l) => l.includes(';')) ? 'checked' : ''}> Puntkomma</label>
        <label><input type="checkbox" data-d="," ${!lines.some((l) => l.includes(';')) && lines.some((l) => l.includes(',')) ? 'checked' : ''}> Komma</label><label><input type="checkbox" data-d=" "> Spatie</label>
        <label>Anders <input id="tc-other" maxlength="1" style="width:30px"></label><label><input type="checkbox" id="tc-merge"> Opeenvolgende als één</label></div>
        <div class="preview-scroll" id="tc-prev"></div>`,
      onOpen: (d) => {
        const prev = () => d.$('#tc-prev').innerHTML = `<table class="mini-grid">${split(d).slice(0, 12).map((row) => `<tr>${row.map((x) => `<td>${App.esc(x)}</td>`).join('')}</tr>`).join('')}</table>`;
        d.body.addEventListener('input', prev); d.body.addEventListener('change', prev); prev();
      },
      buttons: [{ label: 'Annuleren' }, {
        label: 'Voltooien', primary: true, action: (d) => {
          const rows = split(d);
          App.run(() => rows.forEach((row, i) => row.forEach((x, j) => App.setCellFromText(sh, g.r1 + i, g.c1 + j, x))));
        },
      }],
    });
  });

  /* ---------- Dubbele waarden verwijderen ---------- */
  App.def('removeDuplicates', () => {
    const sh = App.sh(); const s = sh.sel;
    let g = App.selRange();
    if (g.r1 === g.r2 && g.c1 === g.c2) g = App.currentRegion(sh, s.ar, s.ac);
    if (!g) { App.toast('Selecteer een bereik met gegevens.', 'info'); return; }
    g = App.selBounded(g, sh);
    const header = guessHeader(sh, g);
    const name = (c, h) => (h ? dispOf(sh, g.r1, c) || 'Kolom ' + App.colName(c) : 'Kolom ' + App.colName(c));
    const cols = () => Array.from({ length: g.c2 - g.c1 + 1 }, (_, k) => g.c1 + k);
    App.dialog({
      title: 'Dubbele waarden verwijderen',
      body: `<p class="small" style="margin-top:0">Selecteer een of meer kolommen met dubbele waarden.</p><label class="chk"><input type="checkbox" id="rd-head" ${header ? 'checked' : ''}> Mijn gegevens bevatten kopteksten</label>
        <div class="list-rows" id="rd-cols"></div>`,
      onOpen: (d) => {
        const render = () => { const h = d.$('#rd-head').checked; d.$('#rd-cols').innerHTML = cols().map((c) => `<label class="list-row"><input type="checkbox" data-c="${c}" checked> ${App.esc(name(c, h))}</label>`).join(''); };
        d.$('#rd-head').onchange = render; render();
      },
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const use = d.$$('[data-c]').filter((x) => x.checked).map((x) => +x.dataset.c);
          if (!use.length) return false;
          const h = d.$('#rd-head').checked;
          let removed = 0, kept = 0;
          App.run(() => {
            const start = h ? g.r1 + 1 : g.r1;
            const seen = new Set(), keep = [];
            for (let r = start; r <= g.r2; r++) {
              const key = use.map((c) => { const v = App.valueOf(App.getCell(sh, r, c)); return typeof v === 'string' ? 's' + v.toLowerCase() : JSON.stringify(v); }).join('\u0001');
              if (seen.has(key)) { removed++; continue; }
              seen.add(key); keep.push(r);
            }
            kept = keep.length;
            const rows = keep.map((r) => { const cells = []; for (let c = g.c1; c <= g.c2; c++) cells.push(App.getCell(sh, r, c)); return { r, cells }; });
            for (let r = start; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) App.delCell(sh, r, c);
            rows.forEach((row, i) => row.cells.forEach((cell, j) => { if (!cell) return; const r = start + i; if (cell.f) cell.f = F.shift(cell.f, r - row.r, 0); const m = sh.data.get(r) || new Map(); sh.data.set(r, m); m.set(g.c1 + j, cell); }));
          });
          App.toast(removed ? `${removed} dubbele waarden verwijderd; ${kept} unieke waarden over.` : 'Geen dubbele waarden gevonden.', removed ? 'ok' : 'info', { ms: 4000 });
        },
      }],
    });
  });
  App.defEdit('flashTrim', () => {
    const sh = App.sh(); let n = 0;
    App.selRanges().forEach((g) => App.eachInRange(sh, App.selBounded(g, sh), (r, c, cell) => {
      if (typeof cell.v === 'string' && !cell.f) { const t = cell.v.replace(/\s+/g, ' ').trim(); if (t !== cell.v) { n++; App.setCellFromText(sh, r, c, t); } }
    }));
    App.toast(n ? `${n} cellen opgeschoond (overbodige spaties verwijderd)` : 'Geen overbodige spaties gevonden', n ? 'ok' : 'info');
    return n > 0;
  });

  /* ---------- Gegevensvalidatie ---------- */
  App.dvAt = (sh, r, c) => sh.dv.find((rule) => rule.ranges.some((g) => App.inRange(g, r, c))) || null;
  const dvList = (sh, rule, r, c) => {
    if (!rule.list) return [];
    if (rule.list[0] === '=') {
      const v = F.evaluate(F.parse(F.toCanon(rule.list.slice(1))), { sh, r, c });
      const arr = F.valArr(v);
      return arr ? arr.flat().filter((x) => x !== null && x !== '').map((x) => NF.format(x).text) : [];
    }
    return rule.list.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  };
  App.dvList = dvList;
  const dvCheck = (sh, rule, r, c, text) => {
    if (text === '' ) return rule.blank !== false;
    if (rule.type === 'any') return true;
    if (rule.type === 'list') return dvList(sh, rule, r, c).some((x) => x.toLowerCase() === text.toLowerCase());
    const p = NF.parseInput(text);
    let v = p.v;
    if (rule.type === 'length') v = text.length;
    if (rule.type !== 'length' && typeof v !== 'number') return false;
    if (rule.type === 'whole' && !Number.isInteger(v)) return false;
    const num = (x) => { if (x === undefined || x === '') return NaN; if (String(x)[0] === '=') { const e = F.evalText(F.toCanon(String(x).slice(1)), { sh, r, c }); return typeof e === 'number' ? e : NaN; } const q = NF.parseInput(String(x)); return typeof q.v === 'number' ? q.v : NaN; };
    const a = num(rule.v1), b = num(rule.v2);
    switch (rule.op) {
      case 'between': return v >= a && v <= b;
      case 'notBetween': return v < a || v > b;
      case 'eq': return v === a; case 'ne': return v !== a;
      case 'gt': return v > a; case 'lt': return v < a; case 'ge': return v >= a; case 'le': return v <= a;
      default: return true;
    }
  };
  App.validateEntry = (sh, r, c, text) => {
    if (App._skipDv) { App._skipDv = false; return true; }
    const rule = App.dvAt(sh, r, c);
    if (!rule || dvCheck(sh, rule, r, c, text)) return true;
    const msg = rule.err || 'Deze waarde komt niet overeen met de beperkingen voor gegevensvalidatie die voor deze cel zijn gedefinieerd.';
    const title = rule.errTitle || 'Cel';
    if (rule.style === 'warning' || rule.style === 'info') {
      App.dialog({
        title, body: `<p style="line-height:1.5">${App.esc(msg)}</p>${rule.style === 'warning' ? '<p>Wilt u doorgaan?</p>' : ''}`,
        buttons: [{ label: 'Annuleren', action: () => { App.cancelEdit(); } }, { label: rule.style === 'warning' ? 'Nee' : 'OK', primary: rule.style !== 'warning', action: () => { if (rule.style === 'info') { App._skipDv = true; App.commitEdit(); } else setTimeout(App.focusEditor, 0); } }].concat(rule.style === 'warning' ? [{ label: 'Ja', primary: true, action: () => { App._skipDv = true; App.commitEdit(); } }] : []),
        onClose: () => { if (App.state.editing) setTimeout(App.focusEditor, 0); },
      });
    } else {
      App.dialog({
        title, body: `<p style="line-height:1.5">${App.esc(msg)}</p>`,
        buttons: [{ label: 'Annuleren', action: () => { App.cancelEdit(); } }, { label: 'Opnieuw', primary: true, action: () => { setTimeout(() => { App.focusEditor(); const el = $('#cell-editor'); el.select(); }, 0); } }],
        onClose: () => { if (App.state.editing) setTimeout(App.focusEditor, 0); },
      });
    }
    return false;
  };
  App.def('dataValidation', () => {
    const sh = App.sh(); const s = sh.sel;
    const cur = App.dvAt(sh, s.ar, s.ac) || { type: 'any', op: 'between', blank: true, inCell: true };
    App.dialog({
      title: 'Gegevensvalidatie', wide: true,
      body: `<div class="fc-tabs"><button data-fct="set" class="on">Instellingen</button><button data-fct="in">Invoerbericht</button><button data-fct="err">Foutmelding</button></div>
        <div class="fc-pane" data-fcp="set"><div class="fields-2">
          <label class="field"><span>Toestaan</span><select id="dv-type"><option value="any">Elke waarde</option><option value="whole">Geheel getal</option><option value="decimal">Decimaal</option><option value="list">Lijst</option><option value="date">Datum</option><option value="time">Tijd</option><option value="length">Tekstlengte</option></select></label>
          <label class="field"><span>Gegevens</span><select id="dv-op"><option value="between">tussen</option><option value="notBetween">niet tussen</option><option value="eq">gelijk aan</option><option value="ne">niet gelijk aan</option><option value="gt">groter dan</option><option value="lt">kleiner dan</option><option value="ge">groter dan of gelijk aan</option><option value="le">kleiner dan of gelijk aan</option></select></label>
          <label class="field" id="dv-v1w"><span>Minimum</span><input id="dv-v1"></label><label class="field" id="dv-v2w"><span>Maximum</span><input id="dv-v2"></label></div>
          <label class="field" id="dv-listw"><span>Bron (gescheiden door ; of een bereik, bv. =$E$1:$E$5)</span><input id="dv-list"></label>
          <div class="checks"><label><input type="checkbox" id="dv-blank"> Lege cellen negeren</label><label id="dv-incw"><input type="checkbox" id="dv-inc"> Vervolgkeuzelijst in cel</label></div></div>
        <div class="fc-pane" data-fcp="in" hidden><label class="field"><span>Titel</span><input id="dv-mt"></label><label class="field"><span>Invoerbericht</span><textarea id="dv-m"></textarea></label></div>
        <div class="fc-pane" data-fcp="err" hidden><label class="field"><span>Stijl</span><select id="dv-st"><option value="stop">Stoppen</option><option value="warning">Waarschuwing</option><option value="info">Informatie</option></select></label><label class="field"><span>Titel</span><input id="dv-et"></label><label class="field"><span>Foutmelding</span><textarea id="dv-e"></textarea></label></div>`,
      onOpen: (d) => {
        d.$('.fc-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-fct]'); if (!b) return; d.$$('[data-fct]').forEach((x) => x.classList.toggle('on', x === b)); d.$$('[data-fcp]').forEach((p) => { p.hidden = p.dataset.fcp !== b.dataset.fct; }); });
        d.$('#dv-type').value = cur.type; d.$('#dv-op').value = cur.op || 'between'; d.$('#dv-v1').value = cur.v1 ?? ''; d.$('#dv-v2').value = cur.v2 ?? '';
        d.$('#dv-list').value = cur.list || ''; d.$('#dv-blank').checked = cur.blank !== false; d.$('#dv-inc').checked = cur.inCell !== false;
        d.$('#dv-mt').value = cur.msgTitle || ''; d.$('#dv-m').value = cur.msg || ''; d.$('#dv-st').value = cur.style || 'stop'; d.$('#dv-et').value = cur.errTitle || ''; d.$('#dv-e').value = cur.err || '';
        const upd = () => {
          const t = d.$('#dv-type').value, op = d.$('#dv-op').value;
          const numeric = !['any', 'list'].includes(t);
          d.$('#dv-op').closest('.field').hidden = !numeric;
          d.$('#dv-v1w').hidden = !numeric; d.$('#dv-v2w').hidden = !numeric || !['between', 'notBetween'].includes(op);
          d.$('#dv-v1w span').textContent = ['between', 'notBetween'].includes(op) ? 'Minimum' : 'Waarde';
          d.$('#dv-listw').hidden = t !== 'list'; d.$('#dv-incw').hidden = t !== 'list';
        };
        d.body.addEventListener('change', upd); upd();
      },
      buttons: [{ label: 'Alles wissen', left: true, action: () => { App.run(() => { const sel = App.selRanges(); sh.dv.forEach((rule) => { rule.ranges = rule.ranges.filter((g) => !sel.some((x) => App.rangesOverlap(x, g))); }); sh.dv = sh.dv.filter((x) => x.ranges.length); }); } }, { label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const rule = {
            ranges: App.selRanges().map((g) => App.selBounded(g, sh)), type: d.$('#dv-type').value, op: d.$('#dv-op').value, v1: d.$('#dv-v1').value, v2: d.$('#dv-v2').value,
            list: d.$('#dv-list').value.trim(), blank: d.$('#dv-blank').checked, inCell: d.$('#dv-inc').checked,
            msgTitle: d.$('#dv-mt').value, msg: d.$('#dv-m').value, style: d.$('#dv-st').value, errTitle: d.$('#dv-et').value, err: d.$('#dv-e').value,
          };
          if (rule.type === 'list' && !rule.list) { App.toast('Vul de bron van de lijst in.', 'error'); return false; }
          App.run(() => {
            const sel = rule.ranges;
            sh.dv.forEach((x) => { x.ranges = x.ranges.filter((g) => !sel.some((y) => App.rangesOverlap(y, g))); });
            sh.dv = sh.dv.filter((x) => x.ranges.length);
            if (rule.type !== 'any' || rule.msg) sh.dv.push(rule);
          });
        },
      }],
    });
  });
  // keuzeknop bij lijstvalidatie en invoerbericht
  const dvBtn = $('#dv-btn');
  let dvTip = null;
  App.updateDvButton = () => {
    const sh = App.sh(); const s = sh.sel;
    const rule = App.dvAt(sh, s.ar, s.ac);
    if (dvTip) { dvTip.remove(); dvTip = null; }
    if (!rule || App.state.editing) { dvBtn.hidden = true; return; }
    const a = App.cellRect(s.ar, s.ac, sh); const z = App.view.z;
    if (rule.type === 'list' && rule.inCell !== false) {
      dvBtn.hidden = false;
      dvBtn.style.left = (a.x + a.w) * z + 1 + 'px';
      dvBtn.style.top = (a.y + a.h) * z - 18 + 'px';
    } else dvBtn.hidden = true;
    if (rule.msg) {
      dvTip = document.createElement('div');
      dvTip.className = 'note-pop';
      dvTip.style.cssText = `left:${(a.x + a.w / 2) * z}px;top:${(a.y + a.h) * z + 6}px;background:#fff;border-color:#bbb`;
      dvTip.innerHTML = `${rule.msgTitle ? `<span class="note-who">${App.esc(rule.msgTitle)}</span>` : ''}${App.esc(rule.msg)}`;
      $('#note-layer').appendChild(dvTip);
    }
  };
  App.on('render', () => { if (!dvBtn.hidden || dvTip) App.updateDvButton(); });
  dvBtn.addEventListener('mousedown', (e) => e.preventDefault());
  dvBtn.addEventListener('click', () => {
    const sh = App.sh(); const s = sh.sel;
    const rule = App.dvAt(sh, s.ar, s.ac); if (!rule) return;
    const items = dvList(sh, rule, s.ar, s.ac);
    const m = App.openPopup(dvBtn, items.map((x, k) => `<button data-k="${k}">${App.esc(x)}</button>`).join('') || '<div class="menu-empty">Lijst is leeg</div>', 'dv-menu');
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; App.closePopup(); App.exec('setCellText', items[+b.dataset.k]); });
  });
  App.defEdit('setCellText', (t) => { const sh = App.sh(); const s = sh.sel; App.setCellFromText(sh, s.ar, s.ac, t); });

  /* ---------- Doelzoeken ---------- */
  App.def('goalSeek', () => {
    const s = App.sh().sel;
    App.dialog({
      title: 'Doelzoeken',
      body: `<label class="field"><span>Doelcel</span><input id="gs-set" value="${App.addr(s.ar, s.ac)}"></label><label class="field"><span>Naar waarde</span><input id="gs-to"></label><label class="field"><span>Door wijzigen van cel</span><input id="gs-by"></label>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const sh = App.sh();
          const a = App.parseAddr(d.$('#gs-set').value), b = App.parseAddr(d.$('#gs-by').value);
          const target = App.parseNum(d.$('#gs-to').value);
          if (!a || !b || isNaN(target)) { App.toast('Vul een geldige doelcel, waarde en te wijzigen cel in.', 'error'); return false; }
          const fc = App.getCell(sh, a.r, a.c);
          if (!fc || !fc.f) { App.toast('De doelcel moet een formule bevatten.', 'error'); return false; }
          const bc = App.getCell(sh, b.r, b.c);
          if (bc && bc.f) { App.toast('De te wijzigen cel moet een waarde bevatten, geen formule.', 'error'); return false; }
          const orig = bc ? bc.v : null;
          const f = (x) => { const c = App.cellAt(sh, b.r, b.c); c.v = x; App.recalc(); const v = App.valueOf(App.getCell(sh, a.r, a.c)); return typeof v === 'number' ? v - target : NaN; };
          let x0 = typeof orig === 'number' ? orig : 0, x1 = x0 ? x0 * 1.1 : 1;
          let f0 = f(x0), f1 = f(x1), ok = false;
          for (let i = 0; i < 100 && isFinite(f1); i++) {
            if (Math.abs(f1) < 1e-7) { ok = true; break; }
            const den = f1 - f0;
            const x2 = den === 0 ? x1 + 1 : x1 - f1 * (x1 - x0) / den;
            x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
          }
          const result = x1;
          const c = App.cellAt(sh, b.r, b.c); c.v = orig; if (orig === null) App.cleanCell(sh, b.r, b.c);
          App.recalc();
          if (ok) {
            App.confirm('Status doelzoeken', `Er is een oplossing gevonden voor cel ${App.addr(a.r, a.c)}.<br>Doelwaarde: ${App.esc(NF.general(target))}<br>Gevonden waarde in ${App.addr(b.r, b.c)}: <b>${App.esc(NF.general(result))}</b><br><br>Toepassen?`, 'Toepassen').then((yes) => { if (yes) App.run(() => { App.cellAt(sh, b.r, b.c).v = +result.toPrecision(15); }); });
          } else App.toast('Doelzoeken heeft geen oplossing gevonden.', 'error', { ms: 4000 });
          App.scheduleRender();
        },
      }],
    });
  });

  /* ---------- Groeperen en subtotalen ---------- */
  App.defEdit('groupRows', () => {
    const g = App.selRange();
    if (App.isFullCol(g) && !App.isFullRow(g)) return App.exec('hideCols'), false;
    const sh = App.sh();
    for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 100000); r++) sh.hidR[r] = 1;
    App.invalidateDims(sh);
    App.toast('Rijen gegroepeerd en samengevouwen. Kies Degroeperen om ze weer te tonen.', 'unfold_less');
  });
  App.defEdit('ungroupRows', () => {
    const g = App.selRange();
    const sh = App.sh();
    if (App.isFullCol(g) && !App.isFullRow(g)) { for (let c = g.c1 - 1; c <= g.c2 + 1; c++) delete sh.hidC[c]; }
    else Object.keys(sh.hidR).forEach((k) => { if (+k >= g.r1 - 1 && +k <= g.r2 + 1) delete sh.hidR[k]; });
    App.invalidateDims(sh);
  });
  App.def('subtotals', () => {
    const sh = App.sh(); const s = sh.sel;
    const g = App.currentRegion(sh, s.ar, s.ac);
    if (!g || g.r2 <= g.r1) { App.toast('Selecteer een cel in een lijst met kopteksten.', 'info'); return; }
    const cols = []; for (let c = g.c1; c <= g.c2; c++) cols.push({ c, name: dispOf(sh, g.r1, c) || App.colName(c) });
    App.dialog({
      title: 'Subtotalen',
      body: `<label class="field"><span>Bij elke wijziging in</span><select id="st-by">${cols.map((x) => `<option value="${x.c}">${App.esc(x.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Functie</span><select id="st-fn"><option value="9">Som</option><option value="2">Aantal</option><option value="1">Gemiddelde</option><option value="4">Max</option><option value="5">Min</option></select></label>
        <div class="muted small">Subtotaal toevoegen aan</div><div class="list-rows">${cols.map((x, k) => `<label class="list-row"><input type="checkbox" data-c="${x.c}" ${k === cols.length - 1 ? 'checked' : ''}> ${App.esc(x.name)}</label>`).join('')}</div>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const by = +d.$('#st-by').value, fn = d.$('#st-fn').value;
          const targets = d.$$('[data-c]').filter((x) => x.checked).map((x) => +x.dataset.c);
          if (!targets.length) return false;
          const fname = { 9: 'Som', 2: 'Aantal', 1: 'Gemiddelde', 4: 'Max', 5: 'Min' }[fn];
          App.run(() => {
            let r = g.r1 + 1, start = r, last = g.r2;
            const groups = [];
            while (r <= last + 1) {
              const v = r <= last ? dispOf(sh, r, by) : '\u0000end';
              if (r > start && v !== dispOf(sh, start, by)) {
                groups.push({ start, end: r - 1, label: dispOf(sh, start, by) });
                start = r;
              }
              r++;
            }
            // van onder naar boven invoegen
            let added = 0;
            for (let k = groups.length - 1; k >= 0; k--) {
              const gr = groups[k];
              App.shiftAxis(sh, 'row', gr.end + 1, 1);
              const tr = gr.end + 1;
              const lc = App.cellAt(sh, tr, by); lc.v = gr.label + ' ' + fname.toLowerCase(); lc.s = { b: true };
              targets.forEach((c) => { const cell = App.cellAt(sh, tr, c); cell.f = `SUBTOTAL(${fn},${App.colName(c)}${gr.start + 1}:${App.colName(c)}${gr.end + 1})`; cell.s = { ...(App.getCell(sh, gr.start, c)?.s || {}), b: true }; });
              added++;
            }
            const endRow = g.r2 + added + 1;
            const lc = App.cellAt(sh, endRow, by); lc.v = 'Eindtotaal'; lc.s = { b: true };
            targets.forEach((c) => { const cell = App.cellAt(sh, endRow, c); cell.f = `SUBTOTAL(${fn},${App.colName(c)}${g.r1 + 2}:${App.colName(c)}${endRow})`; cell.s = { ...(App.getCell(sh, g.r1 + 1, c)?.s || {}), b: true }; });
          });
        },
      }],
    });
  });

  /* ---------- AutoSom ---------- */
  App.def('autoSum', (fn = 'SUM') => {
    if (App.state.editing) App.commitEdit();
    const sh = App.sh(); const s = sh.sel;
    const g = App.selRange();
    const nl = App.FN_NL[fn] || fn;
    const isNum = (r, c) => { const v = App.valueOf(App.getCell(sh, r, c)); return typeof v === 'number'; };
    if (g.r1 === g.r2 && g.c1 === g.c2) {
      // boven zoeken, anders links
      let r = s.ar - 1;
      while (r >= 0 && !App.hasValue(App.getCell(sh, r, s.ac))) r--;
      let range = null;
      if (r >= 0 && isNum(r, s.ac)) { let top = r; while (top - 1 >= 0 && (isNum(top - 1, s.ac) || !App.hasValue(App.getCell(sh, top - 1, s.ac)) && isNum(top - 2, s.ac))) top--; range = { r1: top, c1: s.ac, r2: r, c2: s.ac }; }
      else {
        let c = s.ac - 1;
        while (c >= 0 && !App.hasValue(App.getCell(sh, s.ar, c))) c--;
        if (c >= 0 && isNum(s.ar, c)) { let left = c; while (left - 1 >= 0 && isNum(s.ar, left - 1)) left--; range = { r1: s.ar, c1: left, r2: s.ar, c2: c }; }
      }
      const ref = range ? App.rangeStr(range) : '';
      App.startEdit({ mode: 'enter', initial: `=${nl}(${ref})` });
      const el = $('#cell-editor');
      const start = nl.length + 2;
      el.setSelectionRange(start, start + ref.length);
      if (range) App.state.editing.point = { start, end: start + ref.length, g: range, sheet: sh };
      return;
    }
    // bereik geselecteerd: totalen eronder (of rechts bij één rij)
    App.run(() => {
      const gb = App.selBounded(g, sh);
      if (gb.r1 === gb.r2) {
        const c = gb.c2 + 1;
        App.cellAt(sh, gb.r1, c).f = `${fn}(${App.rangeStr(gb)})`;
      } else {
        let lastFilled = true;
        for (let c = gb.c1; c <= gb.c2; c++) if (App.hasValue(App.getCell(sh, gb.r2, c))) { lastFilled = true; break; } else lastFilled = false;
        const tr = lastFilled ? gb.r2 + 1 : gb.r2;
        for (let c = gb.c1; c <= gb.c2; c++) {
          let any = false; for (let r = gb.r1; r < tr; r++) if (isNum(r, c)) { any = true; break; }
          if (any) { const cell = App.cellAt(sh, tr, c); cell.f = `${fn}(${App.colName(c)}${gb.r1 + 1}:${App.colName(c)}${tr})`; delete cell.v; }
        }
      }
    });
  });

  /* ---------- Functie invoegen ---------- */
  const fnArgsDialog = (en) => {
    const f = App.FN[en];
    const sh = App.sh(); const s = sh.sel;
    const params = (f.sig || '').split('; ').filter((x) => x && x !== '…');
    const variadic = /…/.test(f.sig || '');
    if (!params.length && !variadic) { App.exec('setCellFormula', `=${f.nl}()`); return; }
    const existing = (() => { const cell = App.getCell(sh, s.ar, s.ac); if (cell && cell.f) { const m = new RegExp('^' + en.replace('.', '\\.') + '\\((.*)\\)$').exec(cell.f); if (m) return F.toLocal(m[1]).split(';'); } return []; })();
    let count = Math.max(params.length, existing.length);
    const row = (p, k) => `<label class="field"><span>${App.esc(p.replace(/[[\]]/g, ''))}${/^\[/.test(p) ? ' <span class="muted small">(optioneel)</span>' : ''}</span><input data-arg="${k}" value="${App.esc((existing[k] || '').trim())}" spellcheck="false"><span class="arg-val" data-val="${k}"></span></label>`;
    const nameFor = (k) => params[k] || (params.length ? params[params.length - 1].replace(/\d+\]?$/, '') + (k + 1) : 'getal' + (k + 1));
    App.dialog({
      title: 'Functieargumenten', wide: true,
      body: `<p style="margin-top:0"><b>${f.nl}</b> — ${App.esc(f.desc)}</p><div class="fn-args" id="fa-list">${Array.from({ length: count }, (_, k) => row(nameFor(k), k)).join('')}</div>
        <p class="muted small">Typ waarden, celverwijzingen (bv. A1:A10) of formules. Resultaat: <b id="fa-res"></b></p>`,
      onOpen: (d) => {
        const update = () => {
          const args = d.$$('[data-arg]').map((x) => x.value.trim());
          while (args.length && !args[args.length - 1]) args.pop();
          const text = `${f.nl}(${args.join(';')})`;
          d.$$('[data-val]').forEach((el) => { const v = d.$(`[data-arg="${el.dataset.val}"]`).value.trim(); if (!v) { el.textContent = ''; return; } const r = F.evalText(F.toCanon(v), { sh, r: s.ar, c: s.ac }); el.textContent = '= ' + NF.format(r && r.ref ? F.deref(r) : r).text; });
          const res = F.evalText(F.toCanon(text), { sh, r: s.ar, c: s.ac });
          d.$('#fa-res').textContent = NF.format(res).text;
          // extra veld bij variabel aantal argumenten
          if (variadic && args.length >= d.$$('[data-arg]').length && d.$$('[data-arg]').length < 30) { d.$('#fa-list').insertAdjacentHTML('beforeend', row(nameFor(d.$$('[data-arg]').length), d.$$('[data-arg]').length)); }
        };
        d.body.addEventListener('input', update); update();
        d._text = () => { const args = d.$$('[data-arg]').map((x) => x.value.trim()); while (args.length && !args[args.length - 1]) args.pop(); return `=${f.nl}(${args.join(';')})`; };
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { App.exec('setCellFormula', d._text()); } }],
    });
    App.settings.recentFns = [en].concat(App.settings.recentFns.filter((x) => x !== en)).slice(0, 10);
    App.saveSettings();
  };
  App.defEdit('setCellFormula', (text) => {
    const sh = App.sh(); const s = sh.sel;
    const res = App.setCellFromText(sh, s.ar, s.ac, text);
    if (!res.ok) { App.toast(res.msg, 'error'); return false; }
    return true;
  });
  App.def('insertFunction', (pre) => {
    if (App.state.editing && App.state.editing.text && App.state.editing.text[0] === '=' && !pre) {
      // tijdens het typen: functienaam invoegen
    }
    if (pre && App.FN[pre]) { if (App.state.editing) App.commitEdit(); fnArgsDialog(pre); return; }
    if (App.state.editing) App.commitEdit();
    const all = Object.entries(App.FN).sort((a, b) => a[1].nl.localeCompare(b[1].nl));
    App.dialog({
      title: 'Functie invoegen', wide: true,
      body: `<div class="fields-2"><label class="field"><span>Zoek een functie</span><input id="fi-q" placeholder="Beschrijf wat je wilt doen, bv. optellen"></label>
        <label class="field"><span>Of selecteer een categorie</span><select id="fi-cat"><option value="recent">Laatst gebruikt</option><option value="all">Alle</option>${Object.entries(App.FN_CATS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
        <div class="fn-layout"><div class="fn-list" id="fi-list"></div><div class="fn-info" id="fi-info"></div></div>`,
      onOpen: (d) => {
        let sel = null;
        const render = () => {
          const q = d.$('#fi-q').value.trim().toLowerCase(), cat = d.$('#fi-cat').value;
          let list = all;
          if (q) list = all.filter(([en, f]) => f.nl.toLowerCase().includes(q) || en.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q));
          else if (cat === 'recent') list = App.settings.recentFns.filter((x) => App.FN[x]).map((x) => [x, App.FN[x]]);
          else if (cat !== 'all') list = all.filter(([, f]) => f.cat === cat);
          d.$('#fi-list').innerHTML = list.map(([en, f]) => `<button data-fn="${en}">${f.nl}</button>`).join('');
          pick(list[0] && list[0][0]);
        };
        const pick = (en) => {
          sel = en;
          d.$$('[data-fn]').forEach((b) => b.classList.toggle('on', b.dataset.fn === en));
          const f = App.FN[en];
          d.$('#fi-info').innerHTML = f ? `<code>${f.nl}(${App.esc(f.sig)})</code><p>${App.esc(f.desc)}</p><p class="muted small">Categorie: ${App.FN_CATS[f.cat] || ''}${f.nl !== en ? ` · Engels: ${en}` : ''}</p>` : '';
        };
        d.$('#fi-q').addEventListener('input', render);
        d.$('#fi-cat').addEventListener('change', () => { d.$('#fi-q').value = ''; render(); });
        d.$('#fi-list').addEventListener('click', (e) => { const b = e.target.closest('[data-fn]'); if (b) pick(b.dataset.fn); });
        d.$('#fi-list').addEventListener('dblclick', (e) => { const b = e.target.closest('[data-fn]'); if (b) { d.close(); fnArgsDialog(b.dataset.fn); } });
        d._sel = () => sel;
        render();
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { const en = d._sel(); if (en) setTimeout(() => fnArgsDialog(en), 0); } }],
    });
  });
  App.fnMenu = (anchor, cat) => {
    const list = cat === 'recent' ? App.settings.recentFns.filter((x) => App.FN[x]).map((x) => [x, App.FN[x]]) : Object.entries(App.FN).filter(([, f]) => f.cat === cat || (cat === 'stat' && f.cat === 'info')).sort((a, b) => a[1].nl.localeCompare(b[1].nl));
    const m = App.openPopup(anchor, list.map(([en, f]) => `<button data-fn="${en}" title="${App.esc(f.desc)}">${f.nl}</button>`).join('') + '<hr><button data-fn="">Functie invoegen…</button>', 'fn-menu');
    m.style.maxHeight = '60vh';
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-fn]'); if (!b) return; App.closePopup(); App.exec('insertFunction', b.dataset.fn || undefined); });
  };

  /* ---------- Namen ---------- */
  App.def('defineName', (preset) => {
    const sh = App.sh();
    const g = App.selRange();
    const sug = (() => { const v = App.valueOf(App.getCell(sh, g.r1, g.c1)); return typeof v === 'string' ? v.replace(/[^A-Za-z0-9_À-ɏ]+/g, '_').replace(/^(\d)/, '_$1') : ''; })();
    const cur = typeof preset === 'string' ? preset : null;
    App.dialog({
      title: cur ? 'Naam bewerken' : 'Nieuwe naam',
      body: `<label class="field"><span>Naam</span><input id="dn-n" value="${App.esc(cur || sug)}"></label><label class="field"><span>Verwijst naar</span><input id="dn-r" value="${App.esc(cur ? '=' + F.toLocal(App.book.names[cur]) : '=' + App.sheetRef(sh.name) + '!' + App.absRangeStr(g))}"></label>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const n = d.$('#dn-n').value.trim(); let r = d.$('#dn-r').value.trim();
          if (!/^[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*$/.test(n) || App.parseAddr(n) || /^(waar|onwaar|true|false)$/i.test(n)) { App.toast('Ongeldige naam. Gebruik letters, cijfers en _ en begin met een letter.', 'error'); return false; }
          if (r[0] === '=') r = r.slice(1);
          App.run(() => { if (cur && cur !== n) delete App.book.names[cur]; App.book.names[n] = F.toCanon(r); }, { touchAll: true });
        },
      }],
    });
  });
  App.def('nameManager', () => {
    const render = (d) => {
      const names = Object.keys(App.book.names);
      d.$('#nm-list').innerHTML = names.length ? names.map((n) => {
        const v = F.evalText(App.book.names[n], { sh: App.sh(), r: 0, c: 0 });
        return `<div class="list-row"><span class="grow"><b>${App.esc(n)}</b></span><span class="muted small" style="flex:1">=${App.esc(F.toLocal(App.book.names[n]))}</span><span class="small" style="width:90px;overflow:hidden">${App.esc(NF.format(v && v.ref ? F.deref(v) : v).text)}</span><button class="qb" data-edit="${App.esc(n)}" title="Bewerken"><span class="i">edit</span></button><button class="qb" data-del="${App.esc(n)}" title="Verwijderen"><span class="i">delete</span></button></div>`;
      }).join('') : '<div class="list-row muted">Nog geen namen. Selecteer cellen en typ een naam in het naamvak, of kies Nieuw.</div>';
    };
    App.dialog({
      title: 'Namen beheren', wide: true,
      body: '<div class="list-rows" id="nm-list"></div>',
      onOpen: (d) => {
        render(d);
        d.$('#nm-list').addEventListener('click', (e) => {
          const del = e.target.closest('[data-del]'), ed = e.target.closest('[data-edit]');
          if (del) { App.run(() => { delete App.book.names[del.dataset.del]; }, { touchAll: true }); render(d); }
          if (ed) { d.close(); App.exec('defineName', ed.dataset.edit); }
        });
      },
      buttons: [{ label: 'Nieuw…', left: true, action: () => { setTimeout(() => App.exec('defineName'), 0); } }, { label: 'Sluiten', primary: true }],
    });
  });
  App.menuBuilders['m-usename'] = () => { const names = Object.keys(App.book.names); return names.length ? names.map((n) => `<button data-cmd="useName" data-arg="${App.esc(n)}">${App.esc(n)}</button>`).join('') : '<div class="menu-empty">Er zijn nog geen namen gedefinieerd.</div>'; };
  App.menuBuilders['m-names'] = () => { const names = Object.keys(App.book.names); return names.length ? names.map((n) => `<button data-cmd="gotoName" data-arg="${App.esc(n)}">${App.esc(n)}</button>`).join('') : '<div class="menu-empty">Er zijn nog geen namen. Selecteer cellen en typ een naam in het naamvak.</div>'; };
  App.def('gotoName', (n) => App.gotoRef(n));
  App.def('useName', (n) => {
    if (App.state.editing) {
      const el = $('#cell-editor'); const pos = el.selectionStart; const t = el.value;
      el.value = t.slice(0, pos) + n + t.slice(el.selectionEnd); el.setSelectionRange(pos + n.length, pos + n.length);
      el.dispatchEvent(new Event('input'));
    } else App.startEdit({ mode: 'enter', initial: '=' + n });
  });

  /* ---------- Formules controleren ---------- */
  App.def('tracePrecedents', () => {
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    if (!cell || !cell.f) { App.toast('De actieve cel bevat geen formule.', 'info'); return; }
    const list = [];
    F.tokenize(cell.f, 'en').forEach((t) => { if (t.t === 'ref' && (!t.sheet || App.sheetByName(t.sheet) === sh)) list.push({ from: { r: Math.min(t.r1, App.MAXR - 1), c: Math.min(t.c1, App.MAXC - 1) }, to: { r: s.ar, c: s.ac } }); });
    App.traceArrows = { sheet: sh, list: (App.traceArrows && App.traceArrows.sheet === sh ? App.traceArrows.list : []).concat(list) };
    App.scheduleRender();
  });
  App.def('traceDependents', () => {
    const sh = App.sh(); const s = sh.sel;
    const list = [];
    App.eachCell(sh, (r, c, cell) => {
      if (!cell.f) return;
      if (F.tokenize(cell.f, 'en').some((t) => t.t === 'ref' && (!t.sheet || App.sheetByName(t.sheet) === sh) && App.inRange(t, s.ar, s.ac))) list.push({ from: { r: s.ar, c: s.ac }, to: { r, c } });
    });
    if (!list.length) { App.toast('Geen formules gevonden die naar de actieve cel verwijzen.', 'info'); return; }
    App.traceArrows = { sheet: sh, list: (App.traceArrows && App.traceArrows.sheet === sh ? App.traceArrows.list : []).concat(list) };
    App.scheduleRender();
  });
  App.def('clearArrows', () => { App.traceArrows = null; App.scheduleRender(); });
  App.def('errorCheck', () => {
    const errs = [];
    App.book.sheets.forEach((sh) => App.eachCell(sh, (r, c, cell) => { const v = App.valueOf(cell); if (v && typeof v === 'object' && v.err) errs.push({ sh, r, c, e: v.err, f: cell.f }); }));
    if (!errs.length) { App.toast('De foutcontrole is voltooid: er zijn geen fouten gevonden.', 'ok', { ms: 3500 }); return; }
    const why = { '#DIV/0!': 'Deling door nul of door een lege cel.', '#N/A': 'Een waarde is niet gevonden (bijvoorbeeld bij VERT.ZOEKEN).', '#VALUE!': 'Verkeerd type waarde, bijvoorbeeld tekst waar een getal wordt verwacht.', '#REF!': 'De formule verwijst naar een cel die niet meer bestaat.', '#NAME?': 'Onbekende functie of naam. Controleer de spelling.', '#NUM!': 'Ongeldig getal of de berekening kan niet worden uitgevoerd.', '#CALC!': 'De berekening is te complex.' };
    App.dialog({
      title: 'Foutcontrole', wide: true,
      body: `<div class="list-rows">${errs.slice(0, 300).map((x, k) => `<div class="list-row" data-k="${k}" style="cursor:pointer"><b style="width:80px">${App.esc(x.sh.name)}!${App.addr(x.r, x.c)}</b><span style="width:90px;color:#c00">${App.esc(NF.ERR_NL[x.e] || x.e)}</span><span class="grow muted small">${App.esc(why[x.e] || '')}</span><code class="small">${x.f ? '=' + App.esc(F.toLocal(x.f)) : ''}</code></div>`).join('')}</div>`,
      onOpen: (d) => d.body.addEventListener('click', (e) => { const row = e.target.closest('[data-k]'); if (!row) return; const x = errs[+row.dataset.k]; d.close(); App.gotoRef(App.sheetRef(x.sh.name) + '!' + App.addr(x.r, x.c)); }),
    });
  });
  App.def('evalFormula', () => {
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    if (!cell || !cell.f) { App.toast('De actieve cel bevat geen formule.', 'info'); return; }
    const refs = F.tokenize(cell.f, 'en').filter((t) => t.t === 'ref');
    const rows = refs.map((t) => {
      const tsh = t.sheet ? App.sheetByName(t.sheet) : sh;
      const txt = F.untokenize([t], 'nl');
      if (!tsh) return `<tr><td>${App.esc(txt)}</td><td>#VERW!</td></tr>`;
      const single = t.r1 === t.r2 && t.c1 === t.c2;
      const v = single ? F.cellValue(tsh, t.r1, t.c1) : null;
      return `<tr><td>${App.esc(txt)}</td><td>${single ? App.esc(NF.format(v, App.styleAt(tsh, t.r1, t.c1).nf).text) : `${(t.r2 - t.r1 + 1)} × ${(t.c2 - t.c1 + 1)} cellen`}</td></tr>`;
    }).join('');
    const res = App.valueOf(cell);
    App.dialog({
      title: 'Formule evalueren', wide: true,
      body: `<p><b>Verwijzing:</b> ${App.esc(sh.name)}!${App.addr(s.ar, s.ac)}</p><p><b>Formule:</b> <code>=${App.esc(F.toLocal(cell.f))}</code></p>
        ${rows ? `<table class="data-table" style="margin-bottom:10px"><tr><th style="padding:5px">Verwijzing</th><th style="padding:5px">Waarde</th></tr>${rows.replace(/<td>/g, '<td style="padding:4px 7px">')}</table>` : ''}
        <p><b>Resultaat:</b> ${App.esc(NF.format(res, App.styleAt(sh, s.ar, s.ac).nf).text)}</p>`,
    });
  });
  App.def('calcMode', (m) => { App.book.calc = m; App.toast(m === 'auto' ? 'Automatisch berekenen staat aan' : 'Handmatig berekenen: druk op F9 om te berekenen', 'calculate'); if (m === 'auto') { App.recalc(); App.scheduleRender(); } });
  App.menuBuilders['m-calcopts'] = () => `<button data-cmd="calcMode" data-arg="auto"><span class="i">${App.book.calc === 'auto' ? 'radio_button_checked' : 'radio_button_unchecked'}</span> Automatisch</button><button data-cmd="calcMode" data-arg="manual"><span class="i">${App.book.calc === 'manual' ? 'radio_button_checked' : 'radio_button_unchecked'}</span> Handmatig</button>`;
  App.def('calcNow', () => { App.recalc(); App.scheduleRender(); App.updateFormulaBar(); App.emit('change', {}); });

  /* ---------- Controleren ---------- */
  App.def('workbookStats', () => {
    const b = App.book; const sh = App.sh();
    let cells = 0, formulas = 0, notes = 0, charts = 0, imgs = 0;
    b.sheets.forEach((s) => { App.eachCell(s, (r, c, cell) => { if (App.hasValue(cell)) cells++; if (cell.f) formulas++; if (cell.n) notes++; }); s.objs.forEach((o) => { if (o.type === 'chart') charts++; else imgs++; }); });
    const u = App.usedRange(sh);
    App.dialog({
      title: 'Werkmapstatistieken',
      body: `<div class="props"><span class="k">Huidig blad</span><span>${App.esc(sh.name)}</span><span class="k">Laatste cel</span><span>${u ? App.addr(u.r2, u.c2) : 'A1'}</span>
        <span class="k">Bladen</span><span>${b.sheets.length}</span><span class="k">Cellen met gegevens</span><span>${cells.toLocaleString('nl-NL')}</span>
        <span class="k">Formules</span><span>${formulas.toLocaleString('nl-NL')}</span><span class="k">Grafieken</span><span>${charts}</span><span class="k">Afbeeldingen en vormen</span><span>${imgs}</span>
        <span class="k">Notities</span><span>${notes}</span><span class="k">Namen</span><span>${Object.keys(b.names).length}</span></div>`,
    });
  });
  App.def('spellCheck', () => {
    const list = [];
    App.book.sheets.forEach((sh) => App.eachCell(sh, (r, c, cell) => { if (typeof cell.v === 'string' && /[a-z]{2,}/i.test(cell.v) && !cell.f && list.length < 400) list.push({ sh, r, c, v: cell.v }); }));
    if (!list.length) { App.toast('Er staat geen tekst in deze werkmap om te controleren.', 'info'); return; }
    App.dialog({
      title: 'Spelling', wide: true,
      body: `<p class="muted small" style="margin-top:0">Woorden met een rode golflijn zijn mogelijk verkeerd gespeld. Klik met de rechtermuisknop op een woord voor suggesties en pas de tekst aan.</p>
        <div class="list-rows" style="max-height:52vh">${list.map((x, k) => `<div class="list-row"><span class="muted small" style="width:90px">${App.esc(x.sh.name)}!${App.addr(x.r, x.c)}</span><input class="inp grow" data-k="${k}" spellcheck="true" lang="nl" value="${App.esc(x.v)}"></div>`).join('')}</div>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'Wijzigingen toepassen', primary: true, action: (d) => {
          const changes = d.$$('[data-k]').filter((inp) => inp.value !== list[+inp.dataset.k].v);
          if (!changes.length) return;
          App.run(() => changes.forEach((inp) => { const x = list[+inp.dataset.k]; App.setCellFromText(x.sh, x.r, x.c, inp.value); }), { touchAll: true });
          App.toast(`${changes.length} cellen aangepast`, 'ok');
        },
      }],
      onOpen: (d) => { d.$$('[data-k]').forEach((inp) => inp.focus()); const f = d.$('[data-k]'); if (f) f.focus(); },
    });
  });
  App.def('readAloud', () => {
    const synth = window.speechSynthesis;
    if (!synth) { App.toast('Voorlezen wordt niet ondersteund in deze browser.', 'error'); return; }
    if (App.state.speaking) { synth.cancel(); App.state.speaking = false; App.scheduleState(); return; }
    const sh = App.sh(); const parts = [];
    App.selRanges().forEach((g) => { g = App.selBounded(g, sh); for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const cell = App.getCell(sh, r, c); if (cell && App.hasValue(cell)) parts.push(NF.format(App.valueOf(cell), App.styleAt(sh, r, c, cell).nf).text); } });
    if (!parts.length) { App.toast('Selecteer cellen met inhoud om voor te lezen.', 'info'); return; }
    const u = new SpeechSynthesisUtterance(parts.join('. '));
    u.lang = 'nl-NL';
    const v = synth.getVoices().find((x) => /^nl/i.test(x.lang)); if (v) u.voice = v;
    u.onend = u.onerror = () => { App.state.speaking = false; App.scheduleState(); };
    App.state.speaking = true; App.scheduleState();
    synth.speak(u);
  });
  App.stateFns.speaking = () => App.state.speaking;

  /* ---------- Tekst/CSV importeren ---------- */
  App.detectDelim = (text) => {
    const first = text.split(/\r?\n/).slice(0, 5).join('\n');
    const count = (ch) => (first.match(new RegExp(ch === '\t' ? '\t' : '\\' + ch, 'g')) || []).length;
    const c = { ';': count(';'), ',': count(','), '\t': count('\t'), '|': count('|') };
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0][1] ? Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] : ',';
  };
  App.def('importCsv', async () => {
    const file = await App.pickFile('.csv,.txt,.tsv');
    if (!file) return;
    let text = await App.readFile(file);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const delim0 = App.detectDelim(text);
    App.dialog({
      title: 'Importeren: ' + file.name, wide: true,
      body: `<div class="fields-2"><label class="field"><span>Scheidingsteken</span><select id="ic-d"><option value=";">Puntkomma (;)</option><option value=",">Komma (,)</option><option value="\t">Tab</option><option value="|">Verticale streep (|)</option></select></label>
        <label class="field"><span>Plaats</span><select id="ic-to"><option value="new">Nieuw blad</option><option value="here">Bij de actieve cel</option></select></label></div><div class="preview-scroll" id="ic-prev"></div>`,
      onOpen: (d) => {
        d.$('#ic-d').value = delim0;
        const prev = () => { const rows = App.parseDelimited(text.split('\n').slice(0, 15).join('\n'), d.$('#ic-d').value); d.$('#ic-prev').innerHTML = `<table class="mini-grid">${rows.map((r) => `<tr>${r.map((x) => `<td>${App.esc(x)}</td>`).join('')}</tr>`).join('')}</table>`; };
        d.$('#ic-d').onchange = prev; prev();
      },
      buttons: [{ label: 'Annuleren' }, {
        label: 'Laden', primary: true, action: (d) => {
          const rows = App.parseDelimited(text, d.$('#ic-d').value);
          App.run(() => {
            let sh = App.sh(), r0 = sh.sel.ar, c0 = sh.sel.ac;
            if (d.$('#ic-to').value === 'new') {
              let name = file.name.replace(/\.[^.]+$/, '').replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Import';
              let k = 2; const base = name; while (App.sheetByName(name)) name = base.slice(0, 27) + ' (' + k++ + ')';
              sh = App.newSheet(name); App.book.sheets.splice(App.book.active + 1, 0, sh); App.book.active++; r0 = 0; c0 = 0;
            }
            rows.forEach((row, i) => row.forEach((x, j) => { if (x !== '') App.setCellFromText(sh, r0 + i, c0 + j, x, { autoLink: false }); }));
            App.afterSheetSwitch();
            const w = Math.max(...rows.map((r) => r.length));
            App.setSel({ r1: r0, c1: c0, r2: r0 + rows.length - 1, c2: c0 + w - 1 }, r0, c0);
            App.commands.autoFitCols.fn([{ c1: c0, c2: c0 + w - 1 }]);
          }, { touchAll: true });
        },
      }],
    });
  });

  /* ---------- Rechtsklikmenu in het raster ---------- */
  App.openGridMenu = (ev, h) => {
    const g = App.selRange();
    const fullCol = App.isFullCol(g), fullRow = App.isFullRow(g);
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    let html = `<button data-cmd="cut"><span class="i">content_cut</span> Knippen <kbd>Ctrl+X</kbd></button>
      <button data-cmd="copy"><span class="i">content_copy</span> Kopiëren <kbd>Ctrl+C</kbd></button>
      <button data-cmd="paste"><span class="i">content_paste</span> Plakken <kbd>Ctrl+V</kbd></button>
      <button data-cmd="pasteSpecialDialog" ${App.state.clip ? '' : 'disabled'}><span class="i">content_paste_go</span> Plakken speciaal…</button><hr>`;
    if (fullCol && !fullRow) html += `<button data-cmd="insertCols"><span class="i">add</span> Kolommen invoegen</button><button data-cmd="deleteCols"><span class="i">remove</span> Kolommen verwijderen</button><button data-cmd="clear" data-arg="contents"><span class="i">backspace</span> Inhoud wissen</button><hr><button data-cmd="colWidthDialog"><span class="i">width</span> Kolombreedte…</button><button data-cmd="hideCols"><span class="i">visibility_off</span> Verbergen</button><button data-cmd="unhideCols"><span class="i">visibility</span> Zichtbaar maken</button>`;
    else if (fullRow && !fullCol) html += `<button data-cmd="insertRows"><span class="i">add</span> Rijen invoegen</button><button data-cmd="deleteRows"><span class="i">remove</span> Rijen verwijderen</button><button data-cmd="clear" data-arg="contents"><span class="i">backspace</span> Inhoud wissen</button><hr><button data-cmd="rowHeightDialog"><span class="i">height</span> Rijhoogte…</button><button data-cmd="hideRows"><span class="i">visibility_off</span> Verbergen</button><button data-cmd="unhideRows"><span class="i">visibility</span> Zichtbaar maken</button>`;
    else {
      html += `<button data-cmd="insertCellsDialog"><span class="i">add_box</span> Invoegen…</button><button data-cmd="deleteCellsDialog"><span class="i">disabled_by_default</span> Verwijderen…</button><button data-cmd="clear" data-arg="contents"><span class="i">backspace</span> Inhoud wissen</button><hr>`;
      html += `<button data-cmd="sort" data-arg="asc"><span class="i">arrow_downward</span> Sorteren A → Z</button><button data-cmd="sort" data-arg="desc"><span class="i">arrow_upward</span> Sorteren Z → A</button><button data-cmd="toggleFilter"><span class="i">filter_alt</span> ${sh.filter ? 'Filter verwijderen' : 'Filter'}</button><hr>`;
      html += cell && cell.n ? `<button data-cmd="editNote"><span class="i">edit_note</span> Notitie bewerken</button><button data-cmd="deleteNote"><span class="i">speaker_notes_off</span> Notitie verwijderen</button>` : `<button data-cmd="newNote"><span class="i">sticky_note_2</span> Nieuwe notitie <kbd>Shift+F2</kbd></button>`;
      html += `<button data-cmd="formatCells"><span class="i">grid_on</span> Celeigenschappen… <kbd>Ctrl+1</kbd></button>`;
      if (App.dvAt(sh, s.ar, s.ac) && App.dvAt(sh, s.ar, s.ac).type === 'list') html += `<button data-cmd="dvPick"><span class="i">arrow_drop_down_circle</span> Kiezen uit vervolgkeuzelijst…</button>`;
      html += `<button data-cmd="defineName"><span class="i">label</span> Naam definiëren…</button>`;
      html += cell && cell.l ? `<button data-cmd="followLinkCmd"><span class="i">open_in_new</span> Koppeling openen</button><button data-cmd="link"><span class="i">edit</span> Koppeling bewerken…</button><button data-cmd="clear" data-arg="links"><span class="i">link_off</span> Koppeling verwijderen</button>` : `<button data-cmd="link"><span class="i">link</span> Koppeling… <kbd>Ctrl+K</kbd></button>`;
    }
    void h;
    App.openPopup({ x: ev.clientX, y: ev.clientY }, html, 'ctx-menu');
  };
  App.def('dvPick', () => $('#dv-btn').click());
})();
