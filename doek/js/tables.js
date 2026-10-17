/* =========================================================
   Doek (gemaakt door JJ van Schelven) — tabellen: invoegen, cellen bewerken,
   selecteren, rijen/kolommen invoegen en verwijderen, samenvoegen en splitsen,
   kolombreedte en rijhoogte slepen, randen, arcering, tabelstijlen, plakken uit een rekenblad
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const cell0 = () => ({ text: { paras: [App.emptyPara()] } });

  /* ---------- Tabelstijlen ---------- */
  const FAM = [['themed1', 'Themastijl 1'], ['light1', 'Lichte stijl 1'], ['light2', 'Lichte stijl 2'], ['light3', 'Lichte stijl 3'], ['medium1', 'Normale stijl 1'], ['medium2', 'Normale stijl 2'], ['medium4', 'Normale stijl 4'], ['dark1', 'Donkere stijl 1']];
  const COLS = ['tx1', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  App.TABLE_STYLES = [{ id: 'none', name: 'Geen stijl, geen raster' }, { id: 'grid', name: 'Geen stijl, tabelraster' }, ...FAM.flatMap(([f, n]) => COLS.map((c) => ({ id: f + ':' + c, name: n + ' - ' + (c === 'tx1' ? 'Donker' : 'Accent ' + c.slice(6)) })))];
  const ln = (color, w = 1) => ({ type: 'solid', color, w });
  App.tableStyle = (o) => {
    const ts = o.tstyle || { id: 'medium2:accent1', first: true, bandR: true };
    const [fam, c0] = String(ts.id || 'medium2:accent1').split(':');
    const c = c0 || 'accent1';
    const lt = (p) => (c === 'tx1' ? 'tx1/l' + p : c + '/l' + p);
    return (r, k, nR, nC) => {
      const first = ts.first && r === 0, last = ts.last && r === nR - 1 && nR > 1, firstC = ts.firstC && k === 0, lastC = ts.lastC && k === nC - 1 && nC > 1;
      const bodyR = r - (ts.first ? 1 : 0);
      const band = ts.bandR && !first && !last ? (bodyR % 2 === 0 ? 1 : 2) : ts.bandC && !firstC && !lastC ? (k % 2 === 0 ? 1 : 2) : 0;
      const out = { bd: {} };
      const all = (l) => { out.bd = { l, r: l, t: l, b: l }; };
      if (fam === 'none') return out;
      if (fam === 'grid') { all(ln('tx1', 1)); return out; }
      switch (fam) {
        case 'themed1': all(ln('bg1', 1)); out.fill = { type: 'solid', color: band === 1 ? lt(60) : lt(80) }; if (first) { out.fill = { type: 'solid', color: c }; out.color = 'bg1'; out.b = true; } break;
        case 'light1': out.bd = { t: r === 0 ? ln(c, 1) : undefined, b: first || r === nR - 1 ? ln(c, 1) : undefined }; if (band === 1) out.fill = { type: 'solid', color: lt(80) }; if (first) out.b = true; break;
        case 'light2': all(ln(c, 1)); if (first) { out.fill = { type: 'solid', color: c }; out.color = 'bg1'; out.b = true; } break;
        case 'light3': out.bd = { b: ln(c, 1) }; if (first) { out.color = c; out.b = true; out.bd.b = ln(c, 2.25); } if (band === 1) out.fill = { type: 'solid', color: lt(80) }; break;
        case 'medium1': all(ln(lt(40), 1)); out.fill = { type: 'solid', color: band === 1 ? lt(80) : 'bg1' }; if (first) { out.fill = { type: 'solid', color: c }; out.color = 'bg1'; out.b = true; } break;
        case 'medium4': all(ln(c, 1)); out.fill = { type: 'solid', color: band === 1 ? lt(60) : lt(80) }; if (first) { out.fill = { type: 'solid', color: lt(60) }; out.b = true; } break;
        case 'dark1': all(ln('bg1', 1)); out.fill = { type: 'solid', color: band === 1 ? c + '/d25' : c }; out.color = 'bg1'; if (first) { out.fill = { type: 'solid', color: 'tx1' }; out.b = true; } break;
        default: // medium2
          all(ln('bg1', 1)); out.fill = { type: 'solid', color: band === 1 ? lt(60) : lt(80) }; if (first) { out.fill = { type: 'solid', color: c }; out.color = 'bg1'; out.b = true; }
      }
      if (last) { out.b = true; out.bd = { ...out.bd, t: ln(first ? 'bg1' : c, 2.25) }; if (fam === 'medium2' || fam === 'themed1') { out.fill = { type: 'solid', color: c }; out.color = 'bg1'; } }
      if ((firstC || lastC) && !first) { out.b = true; if (fam === 'medium2' || fam === 'themed1' || fam === 'dark1') { out.fill = { type: 'solid', color: c }; out.color = 'bg1'; } }
      Object.keys(out.bd).forEach((kk) => { if (!out.bd[kk]) delete out.bd[kk]; });
      return out;
    };
  };
  const styleChip = (s) => {
    const fake = { tstyle: { id: s.id, first: true, bandR: true } };
    const f = App.tableStyle(fake); const th = App.theme();
    let h = '<table>';
    for (let r = 0; r < 4; r++) { h += '<tr>'; for (let c = 0; c < 4; c++) { const cs = f(r, c, 4, 4); const bd = cs.bd || {}; h += `<td style="background:${cs.fill ? App.fillCss(cs.fill, th) : 'transparent'};${['t', 'b', 'l', 'r'].map((k) => (bd[k] ? `border-${{ t: 'top', b: 'bottom', l: 'left', r: 'right' }[k]}:1px solid ${App.color(bd[k].color, th)}` : '')).filter(Boolean).join(';')}"></td>`; } h += '</tr>'; }
    return `<button class="tstyle-chip" data-cmd="tableStyle" data-arg="${s.id}" title="${App.esc(App.t(s.name))}">${h}</table></button>`;
  };
  App.fillTableStyles = () => { const g = $('#g-tstyles'); if (g && App.pres) g.innerHTML = ['medium2:accent1', 'medium2:accent2', 'light1:accent1', 'themed1:accent1', 'dark1:accent1', 'grid'].map((id) => styleChip(App.TABLE_STYLES.find((s) => s.id === id))).join(''); };
  App.menuBuilders['m-tstyles'] = () => `<div style="display:grid;grid-template-columns:repeat(7,58px);gap:4px;padding:8px;max-height:420px;overflow:auto">${App.TABLE_STYLES.map(styleChip).join('')}</div><hr><button data-cmd="tableStyle" data-arg="none">${App.t('Tabel wissen')}</button>`;
  App.defEdit('tableStyle', (id) => { const o = App.sel1(); if (!o || o.type !== 'table') return false; o.tstyle = { first: true, bandR: true, ...(o.tstyle || {}), id }; });
  App.defEdit('tableOpt', (arg) => { const o = App.sel1(); if (!o || o.type !== 'table') return false; o.tstyle = { id: 'medium2:accent1', ...(o.tstyle || {}) }; o.tstyle[arg.key] = !!arg.value; });
  App.on('selection', () => { const o = App.sel1(); if (!o || o.type !== 'table') return; const ts = o.tstyle || {}; ['first', 'last', 'bandR', 'bandC', 'firstC', 'lastC'].forEach((k) => { const e = document.getElementById('to-' + k); if (e) e.checked = !!ts[k]; }); App.fillTableStyles(); updateSizes(o); });

  /* ---------- Invoegen ---------- */
  App.menuBuilders['m-table'] = () => {
    let g = '<div class="tg-label" id="tg-label">' + App.t('Tabel invoegen') + '</div><div class="tg">';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) g += `<i data-r="${r}" data-c="${c}"></i>`;
    return g + `</div><hr><button data-cmd="tableDialog"><span class="i">table</span> ${App.t('Tabel invoegen…')}</button>`;
  };
  App.menuAfter['m-table'] = (m) => {
    const grid = m.querySelector('.tg');
    grid.addEventListener('mousemove', (e) => {
      const t = e.target.closest('i'); if (!t) return;
      const R = +t.dataset.r, C = +t.dataset.c;
      grid.querySelectorAll('i').forEach((i) => i.classList.toggle('on', +i.dataset.r <= R && +i.dataset.c <= C));
      m.querySelector('#tg-label').textContent = App.t('Tabel {0} × {1}').replace('{0}', C + 1).replace('{1}', R + 1);
    });
    grid.addEventListener('click', (e) => { const t = e.target.closest('i'); if (!t) return; App.closePopup(); App.insertTable(+t.dataset.r + 1, +t.dataset.c + 1); });
  };
  App.insertTable = (rows, cols, phId) => {
    rows = App.clamp(rows, 1, 100); cols = App.clamp(cols, 1, 50);
    let o;
    App.run(() => {
      const P = App.pres;
      const ph = phId ? App.obj(phId) : (App.sel1() && App.sel1().ph && /^(obj|tbl)$/.test(App.sel1().ph.type) && App.isEmptyText(App.sel1()) ? App.sel1() : null);
      const b = ph ? App.box(ph, App.surface().owner) : { x: P.size.w * 0.1, y: P.size.h * 0.25, w: P.size.w * 0.8, h: 0 };
      const rh = 38.4;
      o = App.newObj('table', { x: b.x, y: b.y, w: b.w, h: rh * rows, name: App.objName(App.t('Tabel')), cols: Array.from({ length: cols }, () => App.round(b.w / cols, 2)), rows: Array.from({ length: rows }, () => ({ h: rh, cells: Array.from({ length: cols }, cell0) })), tstyle: { id: 'medium2:accent1', first: true, bandR: true } });
      if (ph) { const list = App.ownerList(ph.id); list.splice(list.indexOf(ph), 1, o); st.sel = [o.id]; } else App.addObj(o);
    });
    App.select([o.id]);
    App.setContext({ tableDesign: true, tableLayout: true, auto: true });
    setTimeout(() => App.textEdit.cellStart(o, 0, 0), 30);
  };
  App.def('tableDialog', (phId) => {
    App.dialog({
      title: App.t('Tabel invoegen'),
      body: `<div class="fields-2"><label class="field"><span>${App.t('Aantal kolommen')}</span><input id="td-c" type="number" min="1" max="50" value="5"></label><label class="field"><span>${App.t('Aantal rijen')}</span><input id="td-r" type="number" min="1" max="100" value="2"></label></div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.insertTable(+d.$('#td-r').value || 2, +d.$('#td-c').value || 5, phId) }],
    });
  });

  /* ---------- Cellen kiezen en bewerken ---------- */
  const tdAt = (target) => target && target.closest && target.closest('.ob.table td');
  App.tables = {};
  App.tables.click = (o, e) => {
    const td = tdAt(document.elementFromPoint(e.clientX, e.clientY));
    if (!td) return;
    const r = +td.dataset.r, c = +td.dataset.c;
    if (e.shiftKey && st.cell && st.cell.id === o.id) { st.cell = { ...st.cell, r2: r, c2: c }; markCells(); return; }
    st.cell = { id: o.id, r, c, r2: r, c2: c };
    App.textEdit.cellStart(o, r, c, { x: e.clientX, y: e.clientY });
    markCells();
  };
  // slepen over cellen selecteert een bereik
  $('#stage').addEventListener('mousedown', (e) => {
    const td = tdAt(e.target); if (!td || e.button !== 0) return;
    const ob = td.closest('.ob'); const o = App.obj(ob.dataset.id); if (!o) return;
    if (!st.sel.includes(o.id)) return;   // eerst selecteren (editor.js)
    const r0 = +td.dataset.r, c0 = +td.dataset.c;
    let moved = false;
    const move = (ev) => {
      const t = tdAt(document.elementFromPoint(ev.clientX, ev.clientY)); if (!t || t.closest('.ob') !== ob) return;
      const r = +t.dataset.r, c = +t.dataset.c;
      if (r === r0 && c === c0 && !moved) return;
      moved = true;
      if (App.state.edit) { App.textEdit.stop(true); }
      st.sel = [o.id];
      st.cell = { id: o.id, r: r0, c: c0, r2: r, c2: c };
      markCells();
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); if (moved) { App.emit('selection'); App.scheduleState(); } };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  const norm = (c) => ({ r1: Math.min(c.r, c.r2 ?? c.r), r2: Math.max(c.r, c.r2 ?? c.r), c1: Math.min(c.c, c.c2 ?? c.c), c2: Math.max(c.c, c.c2 ?? c.c) });
  App.tables.range = () => (st.cell ? norm(st.cell) : null);
  const markCells = () => {
    $$('#stage td.sel').forEach((t) => t.classList.remove('sel'));
    const c = st.cell; if (!c) return;
    const g = norm(c);
    if (g.r1 === g.r2 && g.c1 === g.c2 && App.state.edit) return;
    const ob = App.objEl(c.id); if (!ob) return;
    ob.querySelectorAll('td').forEach((td) => { const r = +td.dataset.r, k = +td.dataset.c; if (r >= g.r1 && r <= g.r2 && k >= g.c1 && k <= g.c2) td.classList.add('sel'); });
  };
  App.on('render', markCells);
  App.tables.eachSelCell = (o, fn) => {
    const g = st.cell && st.cell.id === o.id ? norm(st.cell) : { r1: 0, c1: 0, r2: o.rows.length - 1, c2: o.cols.length - 1 };
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const cell = o.rows[r] && o.rows[r].cells[c]; if (cell && !cell.merged) fn(cell, r, c); }
  };
  App.tables.tabMove = (back) => {
    const o = App.textEdit.obj(); const cur = App.textEdit.cell(); if (!o || !cur) return;
    const nR = o.rows.length, nC = o.cols.length;
    let r = cur.r, c = cur.c;
    do {
      c += back ? -1 : 1;
      if (c >= nC) { c = 0; r++; } else if (c < 0) { c = nC - 1; r--; }
    } while (r >= 0 && r < nR && o.rows[r].cells[c].merged);
    if (r >= nR) { App.textEdit.stop(true); App.run(() => { o.rows.push({ h: o.rows[nR - 1].h, cells: Array.from({ length: nC }, cell0) }); o.h += o.rows[nR - 1].h; }); App.renderStage(true); r = nR; c = 0; }
    if (r < 0) return;
    st.cell = { id: o.id, r, c, r2: r, c2: c };
    App.textEdit.cellStart(o, r, c, { selectAll: true });
  };

  /* ---------- Rijen en kolommen ---------- */
  const tbl = () => { const o = App.sel1() || (App.textEdit.obj && App.textEdit.obj()); return o && o.type === 'table' ? o : null; };
  const curCell = (o) => { const ec = App.textEdit.cell && App.textEdit.cell(); if (ec) return { r: ec.r, c: ec.c, r2: ec.r, c2: ec.c }; return st.cell && st.cell.id === o.id ? st.cell : { r: 0, c: 0, r2: 0, c2: 0 }; };
  App.defEdit('tableInsert', (where) => {
    const o = tbl(); if (!o) return false;
    if (App.state.edit) App.textEdit.stop(true);
    const g = norm(curCell(o)); const nC = o.cols.length;
    if (where === 'above' || where === 'below') {
      const at = where === 'above' ? g.r1 : g.r2 + 1, n = g.r2 - g.r1 + 1;
      const h = o.rows[Math.min(o.rows.length - 1, g.r1)].h;
      for (let i = 0; i < n; i++) o.rows.splice(at, 0, { h, cells: Array.from({ length: nC }, cell0) });
      o.h += h * n;
      fixSpans(o);
    } else {
      const at = where === 'left' ? g.c1 : g.c2 + 1, n = g.c2 - g.c1 + 1;
      const w = o.cols[Math.min(nC - 1, g.c1)];
      for (let i = 0; i < n; i++) { o.cols.splice(at, 0, w); o.rows.forEach((row) => row.cells.splice(at, 0, cell0())); }
      // breedte binnen de dia houden
      const total = o.cols.reduce((a, b) => a + b, 0);
      const maxW = Math.max(o.w, Math.min(total, App.pres.size.w - o.x));
      const f = maxW / total; o.cols = o.cols.map((c) => App.round(c * f, 2)); o.w = maxW;
      fixSpans(o);
    }
    st.cell = null;
  });
  App.defEdit('tableDelete', (what) => {
    const o = tbl(); if (!o) return false;
    if (App.state.edit) App.textEdit.stop(true);
    const g = norm(curCell(o));
    if (what === 'table' || (what === 'rows' && g.r2 - g.r1 + 1 >= o.rows.length) || (what === 'cols' && g.c2 - g.c1 + 1 >= o.cols.length)) { App.removeObjs([o.id]); st.sel = []; st.cell = null; return; }
    if (what === 'rows') { const removed = o.rows.splice(g.r1, g.r2 - g.r1 + 1); o.h -= removed.reduce((a, r) => a + r.h, 0); }
    else { const w = o.cols.splice(g.c1, g.c2 - g.c1 + 1).reduce((a, b) => a + b, 0); o.rows.forEach((row) => row.cells.splice(g.c1, g.c2 - g.c1 + 1)); o.w -= w; }
    fixSpans(o); st.cell = null;
  });
  // samengevoegde cellen kloppend houden na invoegen/verwijderen
  const fixSpans = (o) => {
    const nR = o.rows.length, nC = o.cols.length;
    o.rows.forEach((row) => row.cells.forEach((c) => { delete c.merged; }));
    o.rows.forEach((row, r) => row.cells.forEach((c, k) => {
      if (!c.span) return;
      c.span = { c: Math.min(c.span.c || 1, nC - k), r: Math.min(c.span.r || 1, nR - r) };
      if (c.span.c <= 1 && c.span.r <= 1) { delete c.span; return; }
      for (let rr = r; rr < r + c.span.r; rr++) for (let cc = k; cc < k + c.span.c; cc++) if (rr !== r || cc !== k) o.rows[rr].cells[cc].merged = true;
    }));
  };
  App.defEdit('tableMerge', () => {
    const o = tbl(); if (!o) return false;
    const g = norm(curCell(o));
    if (g.r1 === g.r2 && g.c1 === g.c2) { App.toast(App.t('Selecteer eerst meerdere cellen (sleep over de cellen).'), 'info'); return false; }
    if (App.state.edit) App.textEdit.stop(true);
    const first = o.rows[g.r1].cells[g.c1];
    const paras = [];
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const cell = o.rows[r].cells[c]; if (cell.text && !App.isEmptyText({ text: cell.text })) paras.push(...cell.text.paras); if (r !== g.r1 || c !== g.c1) { cell.text = { paras: [App.emptyPara()] }; delete cell.span; } }
    first.text = { ...(first.text || {}), paras: paras.length ? paras : [App.emptyPara()] };
    first.span = { c: g.c2 - g.c1 + 1, r: g.r2 - g.r1 + 1 };
    fixSpans(o);
    st.cell = { id: o.id, r: g.r1, c: g.c1, r2: g.r1, c2: g.c1 };
  });
  App.def('tableSplit', () => {
    const o = tbl(); if (!o) return;
    const g = norm(curCell(o));
    const cell = o.rows[g.r1].cells[g.c1];
    if (cell.span) { App.run(() => { delete cell.span; fixSpans(o); }); return; }
    App.dialog({
      title: App.t('Cellen splitsen'),
      body: `<div class="fields-2"><label class="field"><span>${App.t('Aantal kolommen')}</span><input id="ts-c" type="number" min="1" max="20" value="2"></label><label class="field"><span>${App.t('Aantal rijen')}</span><input id="ts-r" type="number" min="1" max="20" value="1"></label></div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const nc = App.clamp(+d.$('#ts-c').value || 1, 1, 20), nr = App.clamp(+d.$('#ts-r').value || 1, 1, 20);
        App.run(() => {
          if (App.state.edit) App.textEdit.stop(true);
          // kolommen: de kolom splitsen en de andere rijen laten overspannen
          if (nc > 1) {
            const w = o.cols[g.c1] / nc;
            o.cols.splice(g.c1, 1, ...Array.from({ length: nc }, () => App.round(w, 2)));
            o.rows.forEach((row, r) => { const c = row.cells[g.c1]; const extra = Array.from({ length: nc - 1 }, cell0); row.cells.splice(g.c1 + 1, 0, ...extra); if (r !== g.r1) { c.span = { c: (c.span ? c.span.c : 1) + nc - 1, r: c.span ? c.span.r : 1 }; } });
          }
          if (nr > 1) {
            const h = o.rows[g.r1].h;
            for (let i = 1; i < nr; i++) o.rows.splice(g.r1 + i, 0, { h, cells: Array.from({ length: o.cols.length }, cell0) });
            o.rows[g.r1].cells.forEach((c, k) => { if (k < g.c1 || k >= g.c1 + nc) c.span = { c: c.span ? c.span.c : 1, r: (c.span ? c.span.r : 1) + nr - 1 }; });
            o.h += h * (nr - 1);
          }
          fixSpans(o);
        });
      } }],
    });
  });
  App.defEdit('tableDistribute', (what) => {
    const o = tbl(); if (!o) return false;
    if (what === 'rows') { const h = o.rows.reduce((a, r) => a + r.h, 0) / o.rows.length; o.rows.forEach((r) => { r.h = App.round(h, 2); }); }
    else { const w = o.cols.reduce((a, b) => a + b, 0) / o.cols.length; o.cols = o.cols.map(() => App.round(w, 2)); }
  });
  App.def('tableSelect', (what) => {
    const o = tbl(); if (!o) return;
    if (App.state.edit) App.textEdit.stop(true);
    const g = norm(curCell(o));
    st.sel = [o.id];
    st.cell = what === 'table' ? { id: o.id, r: 0, c: 0, r2: o.rows.length - 1, c2: o.cols.length - 1 } : what === 'row' ? { id: o.id, r: g.r1, c: 0, r2: g.r2, c2: o.cols.length - 1 } : { id: o.id, r: 0, c: g.c1, r2: o.rows.length - 1, c2: g.c2 };
    markCells(); App.emit('selection');
  });
  App.defEdit('cellVAlign', (v) => { const o = tbl(); if (!o) return false; App.tables.eachSelCell(o, (c) => { c.vAlign = v; }); });
  App.defEdit('cellMargins', (k) => {
    const o = tbl(); if (!o) return false;
    const m = { normal: { l: 9.6, t: 4.8, r: 9.6, b: 4.8 }, none: { l: 0, t: 0, r: 0, b: 0 }, narrow: { l: 4.8, t: 4.8, r: 4.8, b: 4.8 }, wide: { l: 14.4, t: 14.4, r: 14.4, b: 14.4 } }[k];
    App.tables.eachSelCell(o, (c) => { c.ins = { ...m }; });
  });
  const BORDERS = [['all', 'border_all', 'Alle randen'], ['outer', 'border_outer', 'Buitenranden'], ['inner', 'border_inner', 'Binnenranden'], ['top', 'border_top', 'Bovenrand'], ['bottom', 'border_bottom', 'Onderrand'], ['left', 'border_left', 'Linkerrand'], ['right', 'border_right', 'Rechterrand'], ['innerH', 'border_horizontal', 'Horizontale binnenrand'], ['innerV', 'border_vertical', 'Verticale binnenrand'], ['d1', 'north_west', 'Diagonale rand omlaag'], ['d2', 'north_east', 'Diagonale rand omhoog'], ['none', 'border_clear', 'Geen rand']];
  App.menuBuilders['m-tborders'] = () => BORDERS.map(([k, i, l]) => `<button data-cmd="cellBorders" data-arg="${k}"><span class="i">${i}</span> ${App.esc(App.t(l))}</button>`).join('');
  App.defEdit('cellBorders', (k) => {
    const o = tbl(); if (!o) return false;
    const pen = { type: 'solid', color: ($('#tb-pen-color') && $('#tb-pen-color').value) || '#000000', w: +(($('#tb-pen-w') && $('#tb-pen-w').value) || 1), dash: ($('#tb-pen-dash') && $('#tb-pen-dash').value) || 'solid' };
    if (pen.dash === 'solid') delete pen.dash;
    const g = st.cell && st.cell.id === o.id ? norm(st.cell) : { r1: 0, c1: 0, r2: o.rows.length - 1, c2: o.cols.length - 1 };
    const none = { type: 'none' };
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
      const cell = o.rows[r].cells[c]; cell.bd = { ...(cell.bd || {}) };
      const set = (side, v) => { cell.bd[side] = v ? { ...pen } : none; };
      const top = r === g.r1, bot = r === g.r2, lef = c === g.c1, rig = c === g.c2;
      if (k === 'all') ['l', 'r', 't', 'b'].forEach((s) => set(s, true));
      else if (k === 'none') { ['l', 'r', 't', 'b'].forEach((s) => set(s, false)); delete cell.bd.d1; delete cell.bd.d2; }
      else if (k === 'outer') { if (top) set('t', true); if (bot) set('b', true); if (lef) set('l', true); if (rig) set('r', true); }
      else if (k === 'inner') { if (!top) set('t', true); if (!bot) set('b', true); if (!lef) set('l', true); if (!rig) set('r', true); }
      else if (k === 'innerH') { if (!top) set('t', true); if (!bot) set('b', true); }
      else if (k === 'innerV') { if (!lef) set('l', true); if (!rig) set('r', true); }
      else if (k === 'top' && top) set('t', true); else if (k === 'bottom' && bot) set('b', true); else if (k === 'left' && lef) set('l', true); else if (k === 'right' && rig) set('r', true);
      else if (k === 'd1' || k === 'd2') cell.bd[k] = { ...pen };
    }
  });
  // celgrootte in het lint
  const updateSizes = (o) => {
    const g = norm(curCell(o));
    const rh = $('#tb-rowh'), cw = $('#tb-colw');
    if (rh && document.activeElement !== rh) rh.value = App.fmtNum(o.rows[g.r1].h / App.CM, 2);
    if (cw && document.activeElement !== cw) cw.value = App.fmtNum(o.cols[g.c1] / App.CM, 2);
  };
  App.defEdit('tableRowH', (v) => { const o = tbl(); if (!o) return false; const n = App.parseNum(v) * App.CM; if (!(n > 0)) return false; const g = norm(curCell(o)); for (let r = g.r1; r <= g.r2; r++) o.rows[r].h = App.round(n, 2); o.h = o.rows.reduce((a, r) => a + r.h, 0); });
  App.defEdit('tableColW', (v) => { const o = tbl(); if (!o) return false; const n = App.parseNum(v) * App.CM; if (!(n > 0)) return false; const g = norm(curCell(o)); for (let c = g.c1; c <= g.c2; c++) o.cols[c] = App.round(n, 2); o.w = o.cols.reduce((a, b) => a + b, 0); });

  /* ---------- Kolombreedte en rijhoogte slepen ---------- */
  const EDGE = 4;
  $('#stage').addEventListener('mousemove', (e) => {
    const td = tdAt(e.target); if (!td) return;
    const r = td.getBoundingClientRect();
    const nearV = Math.abs(e.clientX - r.right) < EDGE || Math.abs(e.clientX - r.left) < EDGE;
    const nearH = Math.abs(e.clientY - r.bottom) < EDGE;
    td.style.cursor = nearV ? 'col-resize' : nearH ? 'row-resize' : '';
  });
  $('#stage').addEventListener('mousedown', (e) => {
    const td = tdAt(e.target); if (!td || e.button !== 0) return;
    const ob = td.closest('.ob'); const o = App.obj(ob.dataset.id); if (!o || o.locked) return;
    const r = td.getBoundingClientRect();
    const z = App.zoom();
    const c = +td.dataset.c + ((td.colSpan || 1) - 1), row = +td.dataset.r + ((td.rowSpan || 1) - 1);
    let mode = null, idx = 0;
    if (Math.abs(e.clientX - r.right) < EDGE) { mode = 'col'; idx = c; } else if (Math.abs(e.clientX - r.left) < EDGE && c > 0) { mode = 'col'; idx = +td.dataset.c - 1; } else if (Math.abs(e.clientY - r.bottom) < EDGE) { mode = 'row'; idx = row; }
    if (!mode) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (App.state.edit) App.textEdit.stop(true);
    const x0 = e.clientX, y0 = e.clientY;
    const cols0 = o.cols.slice(), rows0 = o.rows.map((x) => x.h), w0 = o.w, h0 = o.h;
    const move = (ev) => {
      if (mode === 'col') {
        const d = (ev.clientX - x0) / z;
        const last = idx === o.cols.length - 1;
        if (last || ev.shiftKey) { o.cols[idx] = Math.max(8, cols0[idx] + d); o.w = o.cols.reduce((a, b) => a + b, 0); }
        else { const sum = cols0[idx] + cols0[idx + 1]; o.cols[idx] = App.clamp(cols0[idx] + d, 8, sum - 8); o.cols[idx + 1] = sum - o.cols[idx]; o.w = w0; }
      } else { o.rows[idx].h = Math.max(10, rows0[idx] + (ev.clientY - y0) / z); o.h = h0 + (o.rows[idx].h - rows0[idx]); }
      App.liveRender();
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); o.cols = o.cols.map((v) => App.round(v, 2)); o.rows.forEach((x) => { x.h = App.round(x.h, 2); }); App.changed(); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }, true);

  /* ---------- Plakken uit een rekenblad of webpagina ---------- */
  App.tables.fromHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const t = doc.querySelector('table'); if (!t) return null;
    const trs = Array.from(t.querySelectorAll('tr')).slice(0, 100);
    const grid = trs.map((tr) => Array.from(tr.querySelectorAll('td, th')).slice(0, 50).map((td) => ({ text: td.textContent.replace(/\s+$/g, '').replace(/^\s+/g, ''), b: td.tagName === 'TH' || /bold|700/.test(td.getAttribute('style') || ''), colspan: +td.getAttribute('colspan') || 1 })));
    const nC = Math.max(1, ...grid.map((r) => r.reduce((a, c) => a + c.colspan, 0)));
    if (!grid.length) return null;
    const P = App.pres;
    const w = Math.min(P.size.w * 0.85, nC * 160);
    const o = App.newObj('table', { x: (P.size.w - w) / 2, y: P.size.h * 0.2, w, h: grid.length * 32, name: App.objName(App.t('Tabel')), cols: Array.from({ length: nC }, () => App.round(w / nC, 2)), rows: grid.map(() => ({ h: 32, cells: Array.from({ length: nC }, cell0) })), tstyle: { id: 'medium2:accent1', first: true, bandR: true } });
    grid.forEach((row, r) => { let c = 0; row.forEach((cell) => { if (c >= nC) return; o.rows[r].cells[c].text = { paras: cell.text.split('\n').map((l) => ({ runs: [{ t: l, sz: 14, ...(cell.b ? { b: true } : {}) }] })) }; if (cell.colspan > 1) o.rows[r].cells[c].span = { c: Math.min(cell.colspan, nC - c), r: 1 }; c += cell.colspan; }); });
    fixSpans(o);
    return o;
  };
  App.tables.fromTsv = (text) => {
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    if (lines.length < 1 || !lines.some((l) => l.includes('\t'))) return null;
    const html = '<table>' + lines.map((l) => '<tr>' + l.split('\t').map((c) => `<td>${App.esc(c)}</td>`).join('') + '</tr>').join('') + '</table>';
    return App.tables.fromHtml(html);
  };
  // rijen meegroeien met de tekst (na bewerken)
  App.tables.fit = (o) => {
    const el = App.objEl(o.id); if (!el) return false;
    const trs = el.querySelectorAll('tr');
    let changed = false, total = 0;
    trs.forEach((tr, i) => { const h = tr.offsetHeight; if (o.rows[i] && h > o.rows[i].h + 0.5) { o.rows[i].h = App.round(h, 2); changed = true; } total += o.rows[i] ? o.rows[i].h : 0; });
    if (Math.abs(total - o.h) > 0.5) { o.h = App.round(total, 2); changed = true; }
    return changed;
  };
  App.on('textchange', () => { const o = App.textEdit.obj && App.textEdit.obj(); if (o && o.type === 'table') { requestAnimationFrame(() => { if (App.tables.fit(o)) App.drawSelection(); }); } });
})();
