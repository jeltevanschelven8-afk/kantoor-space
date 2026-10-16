/* =========================================================
   Inkt — tabellen, afbeeldingen, vormen, grafieken
   ========================================================= */
'use strict';

/* =================== TABELLEN =================== */
App.TABLE_STYLES = [
  ['ts-grid', '#fff', '#000', '#fff'], ['ts-accent', '#156082', '#156082', '#fff'], ['ts-soft', '#c1e4f5', '#83caeb', '#fff'],
  ['ts-dark', '#2a2a35', '#2a2a35', '#fff'], ['ts-minimal', '#fff', '#222', '#fff'], ['ts-green', '#2f855a', '#2f855a', '#fff'], ['ts-orange', '#dd6b20', '#dd6b20', '#fff'],
];
(() => {
  $('#table-styles').innerHTML = App.TABLE_STYLES.map(([cls, head, line]) => `<button class="tstyle-chip" data-cmd="tableStyle" data-arg="${cls}" title="${cls.replace('ts-', 'Stijl ')}">
    <table>${[0, 1, 2, 3].map((r) => `<tr>${[0, 1, 2].map(() => `<td style="background:${r === 0 ? head : r % 2 ? '#fff' : '#f3f3f8'};border:1px solid ${line}"></td>`).join('')}</tr>`).join('')}</table></button>`).join('');
})();

App.makeTable = (rows, cols, opts = {}) => {
  const t = document.createElement('table');
  t.className = 'doc-table ' + (opts.style || 'ts-grid') + (opts.banded ? ' banded' : '');
  const tb = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement(opts.header && r === 0 ? 'th' : 'td');
      cell.innerHTML = opts.data ? (App.esc(opts.data[r]?.[c] ?? '') || '<br>') : '<br>';
      tr.appendChild(cell);
    }
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  if (opts.fixed) t.style.tableLayout = 'fixed';
  return t;
};
App.defEdit('insertTable', (o) => {
  const t = App.makeTable(o.rows, o.cols, o);
  App.insertBlockAtCaret(t, { caretIn: t.rows[0].cells[0], keepEmpty: false });
});
App.def('insertTableDialog', () => {
  App.restoreRange();
  App.dialog({
    title: 'Tabel invoegen',
    body: `<div class="fields-2">
        <label class="field"><span>Aantal kolommen</span><input id="ti-c" type="number" min="1" max="30" value="4"></label>
        <label class="field"><span>Aantal rijen</span><input id="ti-r" type="number" min="1" max="200" value="3"></label></div>
      <label class="field"><span>Stijl</span><select id="ti-s">${App.TABLE_STYLES.map(([c]) => `<option value="${c}">${{ 'ts-grid': 'Raster', 'ts-accent': 'Accent', 'ts-soft': 'Zacht', 'ts-dark': 'Donker', 'ts-minimal': 'Minimaal', 'ts-green': 'Groen', 'ts-orange': 'Oranje' }[c]}</option>`).join('')}</select></label>
      <div class="checks"><label><input type="checkbox" id="ti-h" checked> Kopregel</label><label><input type="checkbox" id="ti-b"> Gestreepte rijen</label><label><input type="checkbox" id="ti-f"> Vaste kolombreedte</label></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (d) => App.exec('insertTable', {
        cols: App.clamp(+d.$('#ti-c').value || 1, 1, 30), rows: App.clamp(+d.$('#ti-r').value || 1, 1, 200),
        style: d.$('#ti-s').value, header: d.$('#ti-h').checked, banded: d.$('#ti-b').checked, fixed: d.$('#ti-f').checked,
      }),
    }],
  });
});
App.def('textToTable', () => {
  App.restoreRange();
  const blocks = App.getSelectedBlocks().filter((b) => !App.closest(b, 'table', App.ed));
  if (!blocks.length) { App.toast('Selecteer eerst de alinea\'s die een tabel moeten worden', 'info'); return; }
  App.dialog({
    title: 'Tekst naar tabel converteren',
    body: `<label class="field"><span>Tekst scheiden bij</span><select id="tt-sep"><option value="auto">Automatisch</option><option value="\t">Tabs</option><option value=";">Puntkomma's</option><option value=",">Komma's</option><option value="|">Verticale streepjes</option><option value=" ">Spaties</option></select></label>
      <div class="checks"><label><input type="checkbox" id="tt-h" checked> Eerste rij is kopregel</label></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (d) => App.run(() => {
        let sep = d.$('#tt-sep').value;
        const lines = blocks.map((b) => b.innerText.replace(/\n$/, ''));
        if (sep === 'auto') sep = ['\t', ';', '|', ','].find((s) => lines.every((l) => l.includes(s))) || '\t';
        const data = lines.map((l) => l.split(sep).map((x) => x.trim()));
        const cols = Math.max(...data.map((r) => r.length));
        const t = App.makeTable(data.length, cols, { data, header: d.$('#tt-h').checked });
        let first = blocks[0]; while (first.parentNode !== App.ed && first.parentNode) first = first.parentNode;
        first.before(t);
        blocks.forEach((b) => { const li = b.closest('ul,ol'); b.remove(); if (li && !li.children.length) li.remove(); });
        App.caretAtEnd(t.rows[0].cells[0]);
      }),
    }],
  });
});
App.defEdit('quickTable', () => {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const days = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();
  const data = [days];
  let row = new Array(7).fill('');
  for (let d = 1; d <= n; d++) {
    row[(first + d - 1) % 7] = String(d);
    if ((first + d - 1) % 7 === 6 || d === n) { data.push(row); row = new Array(7).fill(''); }
  }
  const t = App.makeTable(data.length, 7, { data, header: true, style: 'ts-accent', fixed: true });
  const cap = document.createElement('h2');
  cap.textContent = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  App.insertBlockAtCaret(cap, { keepEmpty: false });
  cap.after(t);
  App.caretAtEnd(t.rows[1].cells[0]);
});

/* Tabelhulpen */
App.curCell = () => App.selClosest('td,th');
App.curTable = () => App.selClosest('table');
App.tableGrid = (table) => {
  const g = [];
  Array.from(table.rows).forEach((tr, r) => {
    g[r] = g[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach((td) => {
      while (g[r][c]) c++;
      const rs = td.rowSpan || 1, cs = td.colSpan || 1;
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) (g[r + i] = g[r + i] || [])[c + j] = td;
      c += cs;
    });
  });
  return g;
};
App.cellPos = (g, td) => {
  for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r] || []).length; c++) if (g[r][c] === td) return [r, c];
  return [0, 0];
};
App.newCellLike = (ref) => { const c = document.createElement(ref && ref.tagName === 'TH' ? 'th' : 'td'); c.innerHTML = '<br>'; return c; };
App.insertRow = (below) => {
  const cell = App.curCell(); if (!cell) return null;
  const table = cell.closest('table');
  const g = App.tableGrid(table);
  const [r0] = App.cellPos(g, cell);
  const R = below ? r0 + (cell.rowSpan || 1) - 1 : r0;
  const tr = document.createElement('tr');
  const cols = g[R].length;
  for (let c = 0; c < cols;) {
    const x = g[R][c];
    const [xr] = App.cellPos(g, x);
    const xEnd = xr + (x.rowSpan || 1) - 1;
    const spans = below ? xEnd > R : xr < R;
    if (spans) x.rowSpan = (x.rowSpan || 1) + 1;
    else { const n = App.newCellLike(null); if ((x.colSpan || 1) > 1) n.colSpan = x.colSpan; tr.appendChild(n); }
    c += x.colSpan || 1;
  }
  const rows = table.rows;
  if (below) rows[R].after(tr); else rows[R].before(tr);
  return tr;
};
App.insertColAt = (table, C) => {
  const g = App.tableGrid(table);
  const done = new Set();
  Array.from(table.rows).forEach((tr, r) => {
    const x = g[r][C];
    if (x) {
      const [, xc] = App.cellPos(g, x);
      if (xc < C) { if (!done.has(x)) { x.colSpan = (x.colSpan || 1) + 1; done.add(x); } return; }
    }
    const n = App.newCellLike(tr.cells[0]);
    const after = Array.from(tr.cells).find((cell) => App.cellPos(g, cell)[1] >= C);
    if (after) after.before(n); else tr.appendChild(n);
  });
};
App.defEdit('rowAbove', () => { const tr = App.insertRow(false); if (tr) App.caretAtEnd(tr.cells[0]); });
App.defEdit('rowBelow', () => { const tr = App.insertRow(true); if (tr) App.caretAtEnd(tr.cells[0]); });
App.defEdit('colLeft', () => { const c = App.curCell(); if (!c) return; const t = c.closest('table'); App.insertColAt(t, App.cellPos(App.tableGrid(t), c)[1]); });
App.defEdit('colRight', () => { const c = App.curCell(); if (!c) return; const t = c.closest('table'); const [, cc] = App.cellPos(App.tableGrid(t), c); App.insertColAt(t, cc + (c.colSpan || 1)); });
App.defEdit('deleteRow', () => {
  const cell = App.curCell(); if (!cell) return;
  const table = cell.closest('table');
  const g = App.tableGrid(table);
  const [r] = App.cellPos(g, cell);
  const tr = table.rows[r];
  const seen = new Set();
  (g[r] || []).forEach((x, c) => {
    if (seen.has(x)) return; seen.add(x);
    if ((x.rowSpan || 1) > 1) {
      const [xr] = App.cellPos(g, x);
      if (xr === r && table.rows[r + 1]) {
        x.rowSpan -= 1;
        const nextTr = table.rows[r + 1];
        const after = Array.from(nextTr.cells).find((cc) => App.cellPos(g, cc)[1] > c);
        if (after) after.before(x); else nextTr.appendChild(x);
      } else if (xr < r) x.rowSpan -= 1;
    }
  });
  const next = table.rows[r + 1] || table.rows[r - 1];
  tr.remove();
  if (!table.rows.length) { App.removeTable(table); return; }
  if (next && next.cells[0]) App.caretAtEnd(next.cells[0]);
});
App.defEdit('deleteCol', () => {
  const cell = App.curCell(); if (!cell) return;
  const table = cell.closest('table');
  const g = App.tableGrid(table);
  const [, C] = App.cellPos(g, cell);
  const seen = new Set();
  g.forEach((row) => {
    const x = row[C]; if (!x || seen.has(x)) return; seen.add(x);
    if ((x.colSpan || 1) > 1) x.colSpan -= 1; else x.remove();
  });
  Array.from(table.rows).forEach((tr) => { if (!tr.cells.length) tr.remove(); });
  if (!table.rows.length) { App.removeTable(table); return; }
  const first = table.rows[0].cells[Math.min(C, table.rows[0].cells.length - 1)];
  if (first) App.caretAtEnd(first);
});
App.removeTable = (table) => {
  const p = document.createElement('p'); p.innerHTML = '<br>';
  table.replaceWith(p); App.placeCaret(p, 0);
};
App.defEdit('deleteTable', () => { const t = App.curTable(); if (t) App.removeTable(t); });
App.selectedCells = () => {
  const r = App.getRange() || App.lastRange;
  const t = App.curTable();
  if (!r || !t) return [];
  if (r.collapsed) return [App.curCell()].filter(Boolean);
  const hit = $$('td,th', t).filter((c) => r.intersectsNode(c));
  if (hit.length < 2) return hit;
  // zoals in Word: de rechthoek tussen de eerste en de laatste geselecteerde cel, niet alles ertussen in documentvolgorde
  const g = App.tableGrid(t);
  const [ra, ca] = App.cellPos(g, hit[0]), [rb, cb] = App.cellPos(g, hit[hit.length - 1]);
  const last = hit[hit.length - 1];
  const r0 = Math.min(ra, rb), r1 = Math.max(ra + (hit[0].rowSpan || 1) - 1, rb + (last.rowSpan || 1) - 1);
  const c0 = Math.min(ca, cb), c1 = Math.max(ca + (hit[0].colSpan || 1) - 1, cb + (last.colSpan || 1) - 1);
  const out = new Set();
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) if (g[rr] && g[rr][cc]) out.add(g[rr][cc]);
  return Array.from(out);
};
App.defEdit('mergeCells', () => {
  let cells = App.selectedCells();
  const table = App.curTable(); if (!table || !cells.length) return;
  const g = App.tableGrid(table);
  if (cells.length === 1) {
    const [r, c] = App.cellPos(g, cells[0]);
    const right = g[r][c + (cells[0].colSpan || 1)];
    if (!right) { App.toast('Er is geen cel rechts om mee samen te voegen', 'info'); return; }
    cells = [cells[0], right];
  }
  let r0 = 1e9, c0 = 1e9, r1 = -1, c1 = -1;
  cells.forEach((cell) => {
    const [r, c] = App.cellPos(g, cell);
    r0 = Math.min(r0, r); c0 = Math.min(c0, c);
    r1 = Math.max(r1, r + (cell.rowSpan || 1) - 1); c1 = Math.max(c1, c + (cell.colSpan || 1) - 1);
  });
  const keep = g[r0][c0];
  const all = new Set();
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (g[r][c]) all.add(g[r][c]);
  all.forEach((cell) => {
    if (cell === keep) return;
    if (cell.textContent.trim() || cell.querySelector('img')) {
      if (keep.lastChild && keep.lastChild.nodeName !== 'BR') keep.appendChild(document.createElement('br'));
      while (cell.firstChild) keep.appendChild(cell.firstChild);
    }
    const tr = cell.parentNode; cell.remove();
    if (tr && !tr.cells.length) { /* rij blijft leeg bestaan als rowspan */ }
  });
  keep.colSpan = c1 - c0 + 1; keep.rowSpan = r1 - r0 + 1;
  App.caretAtEnd(keep);
});
App.defEdit('splitCell', () => {
  const cell = App.curCell(); if (!cell) return;
  const table = cell.closest('table');
  const g = App.tableGrid(table);
  const [r, c] = App.cellPos(g, cell);
  const cs = cell.colSpan || 1, rs = cell.rowSpan || 1;
  if (cs === 1 && rs === 1) {
    // In tweeën splitsen: nieuwe kolom alleen voor deze cel
    const seen = new Set();
    g.forEach((row, ri) => { const x = row[c]; if (x && x !== cell && !seen.has(x)) { seen.add(x); x.colSpan = (x.colSpan || 1) + 1; } void ri; });
    cell.after(App.newCellLike(cell));
    return;
  }
  cell.colSpan = 1; cell.rowSpan = 1;
  for (let i = 1; i < cs; i++) cell.after(App.newCellLike(cell));
  for (let k = 1; k < rs; k++) {
    const tr = table.rows[r + k]; if (!tr) continue;
    const after = Array.from(tr.cells).find((x) => App.cellPos(g, x)[1] > c);
    for (let i = 0; i < cs; i++) { const n = App.newCellLike(cell); if (after) after.before(n); else tr.appendChild(n); }
  }
});
App.defEdit('tableStyle', (cls) => {
  const t = App.curTable(); if (!t) return;
  t.className = t.className.split(' ').filter((c) => !c.startsWith('ts-')).concat(cls).join(' ');
  if (cls !== 'ts-grid' && !t.rows[0].querySelector('th')) App.setHeaderRow(t, true);
});
App.setHeaderRow = (t, on) => {
  const row = t.rows[0]; if (!row) return;
  Array.from(row.cells).forEach((c) => {
    if ((c.tagName === 'TH') === on) return;
    const n = document.createElement(on ? 'th' : 'td');
    Array.from(c.attributes).forEach((a) => n.setAttribute(a.name, a.value));
    while (c.firstChild) n.appendChild(c.firstChild);
    c.replaceWith(n);
  });
};
App.defEdit('tableHeaderRow', (on) => { const t = App.curTable(); if (t) App.setHeaderRow(t, !!on); });
App.defEdit('tableBanded', (on) => { const t = App.curTable(); if (t) t.classList.toggle('banded', !!on); });
App.defEdit('tableFirstCol', (on) => { const t = App.curTable(); if (t) t.classList.toggle('first-col', !!on); });
App.defEdit('cellShading', (c) => {
  c = c ?? App.state.lastColors.cellShading;
  App.selectedCells().forEach((cell) => { cell.style.backgroundColor = c || ''; });
});
App.defEdit('tableBorders', (v) => {
  const t = App.curTable(); if (!t) return;
  t.classList.remove('b-none', 'b-outer', 'b-inner', 'b-horizontal');
  if (v !== 'all') t.classList.add('b-' + v);
});
['Top', 'Middle', 'Bottom'].forEach((v) => App.defEdit('cellV' + v, () => App.selectedCells().forEach((c) => { c.style.verticalAlign = v.toLowerCase(); })));
App.defEdit('distributeCols', () => {
  const t = App.curTable(); if (!t) return;
  t.style.tableLayout = 'fixed'; t.style.width = '100%';
  const n = App.tableGrid(t)[0].length;
  $$('td,th', t).forEach((c) => { c.style.width = ''; });
  Array.from(t.rows[0].cells).forEach((c) => { c.style.width = ((c.colSpan || 1) * 100 / n).toFixed(2) + '%'; });
});
App.defEdit('tableAutofit', () => { const t = App.curTable(); if (!t) return; t.style.tableLayout = ''; t.style.width = 'auto'; $$('td,th', t).forEach((c) => { c.style.width = ''; }); });
App.defEdit('tableFullWidth', () => { const t = App.curTable(); if (!t) return; t.style.width = '100%'; });
App.defEdit('sortTable', (dir) => {
  const cell = App.curCell(); if (!cell) return;
  const t = cell.closest('table');
  const idx = cell.cellIndex;
  const rows = Array.from(t.rows);
  const head = rows[0].querySelector('th') ? rows.shift() : null;
  if (rows.some((r) => Array.from(r.cells).some((c) => c.rowSpan > 1))) { App.toast('Sorteren kan niet met verticaal samengevoegde cellen', 'info'); return; }
  const val = (r) => (r.cells[idx] ? r.cells[idx].textContent.trim() : '');
  rows.sort((a, b) => {
    const x = val(a), y = val(b);
    const nx = App.parseNum(x.replace(/[€$%\s.]/g, '').replace(',', '.')), ny = App.parseNum(y.replace(/[€$%\s.]/g, '').replace(',', '.'));
    const res = !isNaN(nx) && !isNaN(ny) && /\d/.test(x) && /\d/.test(y) ? nx - ny : x.localeCompare(y, 'nl', { numeric: true, sensitivity: 'base' });
    return dir === 'desc' ? -res : res;
  });
  const body = (head ? head.parentNode : t.tBodies[0]) || t;
  rows.forEach((r) => body.appendChild(r));
  void head;
});
App.defEdit('tableToText', () => {
  const t = App.curTable(); if (!t) return;
  const frag = document.createDocumentFragment();
  Array.from(t.rows).forEach((tr) => {
    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-wrap';
    p.textContent = Array.from(tr.cells).map((c) => c.innerText.trim()).join('\t');
    frag.appendChild(p);
  });
  const last = frag.lastChild;
  t.replaceWith(frag);
  App.caretAtEnd(last);
});
App.on('selection', () => {
  const t = App.curTable();
  if (t) {
    $('#chk-thead').checked = !!(t.rows[0] && t.rows[0].querySelector('th'));
    $('#chk-banded').checked = t.classList.contains('banded');
    $('#chk-firstcol').checked = t.classList.contains('first-col');
  }
});

/* Kolombreedte slepen */
(() => {
  let drag = null;
  App.ed.addEventListener('mousemove', (e) => {
    if (drag) return;
    const cell = e.target.closest && e.target.closest('td,th');
    if (!cell || !App.ed.contains(cell)) { if (App.ed.style.cursor === 'col-resize') App.ed.style.cursor = App.state.painter ? 'copy' : ''; return; }
    const r = cell.getBoundingClientRect();
    const near = Math.abs(e.clientX - r.right) < 4 && cell.nextElementSibling;
    App.ed.style.cursor = near ? 'col-resize' : (App.state.painter ? 'copy' : '');
  });
  App.ed.addEventListener('mousedown', (e) => {
    if (App.ed.style.cursor !== 'col-resize') return;
    const cell = e.target.closest('td,th');
    if (!cell || !cell.nextElementSibling) return;
    e.preventDefault();
    const table = cell.closest('table');
    const z = App.state.zoom;
    const first = Array.from(table.rows[0].cells);
    const widths = first.map((c) => c.getBoundingClientRect().width / z);
    const idx = Math.min(cell.cellIndex, first.length - 2);
    App.history.flush();
    table.style.tableLayout = 'fixed';
    table.style.width = widths.reduce((a, b) => a + b, 0) + 'px';
    first.forEach((c, i) => { c.style.width = widths[i] + 'px'; });
    drag = { x0: e.clientX, a: widths[idx], b: widths[idx + 1], ca: first[idx], cb: first[idx + 1] };
    const move = (ev) => {
      const d = (ev.clientX - drag.x0) / z;
      const a = Math.max(24, drag.a + d), b = Math.max(24, drag.b - (a - drag.a));
      drag.ca.style.width = a + 'px'; drag.cb.style.width = b + 'px';
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); drag = null; App.ed.style.cursor = ''; App.changed({ immediate: true }); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
})();

/* =================== TOETS-AFHANDELING IN DE EDITOR =================== */
App.ed.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    if (App.state.protect) return;
    const cell = App.curCell();
    if (cell) {
      e.preventDefault();
      const table = cell.closest('table');
      const cells = $$('td,th', table);
      const i = cells.indexOf(cell);
      let target = cells[i + (e.shiftKey ? -1 : 1)];
      if (!target && !e.shiftKey) { App.run(() => { const tr = App.insertRow(true); target = tr && tr.cells[0]; }); }
      if (target) App.selectContents(target);
      return;
    }
    e.preventDefault();
    const r = App.getRange();
    const li = App.selClosest('li');
    // Word: Tab verhoogt het lijstniveau alleen aan het begin van het item (of bij een selectie); anders een tab
    if (li && (e.shiftKey || !r || !r.collapsed || App.textOffset(r.startContainer, r.startOffset, li) === 0)) { App.exec(e.shiftKey ? 'outdent' : 'indent'); return; }
    if (e.shiftKey) { App.exec('outdent'); return; }
    const b = r && App.blockOf(r.startContainer);
    if (b && r.collapsed && App.textOffset(r.startContainer, r.startOffset, b) === 0 && b.textContent.length) {
      App.run(() => { b.style.textIndent = ((parseFloat(b.style.textIndent) || 0) + App.cm2px(1.25)).toFixed(1) + 'px'; });
    } else {
      App.run(() => App.insertHTML('<span class="tab" style="white-space:pre">\t</span>'));
    }
  }
  // Word: Enter in een tabelcel maakt een nieuwe alinea in die cel (geen harde regeleinde).
  // Losse inhoud van de cel eerst in een <p> zetten; daarna splitst de browser die alinea zelf.
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !App.state.protect && !App.state.track) {
    const cell = App.curCell();
    if (cell && !cell.querySelector('p,h1,h2,h3,h4,ul,ol,pre,blockquote,table')) {
      App.history.flush();
      const marks = App.markSel();
      const p = document.createElement('p');
      while (cell.firstChild) p.appendChild(cell.firstChild);
      if (!p.textContent && !p.querySelector('img,br')) p.appendChild(document.createElement('br'));
      cell.appendChild(p);
      App.restoreMarks(marks);
    }
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && App.selectedObj) {
    e.preventDefault();
    App.exec('imgDelete');
  }
});

/* =================== AFBEELDINGEN =================== */
App.contentWidth = () => { const g = App.geom(); return g.W - g.ml - g.mr; };
App.loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
App.shrinkDataUrl = async (src, type) => {
  if (/svg/.test(type || src.slice(0, 30))) return src;
  const im = await App.loadImg(src);
  const max = 1800;
  if (im.naturalWidth <= max && im.naturalHeight <= max && src.length < 1.5e6) return src;
  const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
  cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
  return /png|gif|webp/.test(type || '') ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88);
};
App.insertImageSrc = async (src, opts = {}) => {
  let w = 0;
  try { const im = await App.loadImg(src); w = Math.min(im.naturalWidth, App.contentWidth()); } catch { w = 300; }
  if (opts.width) w = opts.width;
  const id = App.uid('img');
  let img = null;
  App.run(() => {
    App.insertHTML(`<img src="${src}" data-id="${id}" alt="${App.esc(opts.alt || '')}" style="width:${Math.round(w)}px" ${opts.attrs || ''}>`);
    img = App.ed.querySelector(`img[data-id="${id}"]`);
    if (img) img.removeAttribute('data-id');
  });
  if (img) App.selectObj(img);
  return img;
};
App.insertImages = async (files) => {
  let last = null;
  for (const f of files) {
    if (!f.type || !f.type.startsWith('image/')) continue;
    try {
      const raw = await App.readFile(f, 'dataurl');
      const src = await App.shrinkDataUrl(raw, f.type);
      // de volgende afbeelding komt achter de vorige, niet in plaats ervan
      if (last && last.isConnected) {
        if (App.deselectObj) App.deselectObj();
        const r = document.createRange(); r.setStartAfter(last); r.collapse(true); App.lastRange = r.cloneRange();
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }
      last = await App.insertImageSrc(src, { alt: (f.name || '').replace(/\.[^.]+$/, '') }) || last;
    } catch (e) { App.toast('Kon afbeelding niet invoegen', 'error'); }
  }
};
App.def('imageFromFile', async () => {
  App.saveRange();
  const files = await App.pickFile('image/*', true);
  if (files && files.length) { App.restoreRange(); App.insertImages(files); }
});
App.def('imageFromUrl', async () => {
  App.saveRange();
  const url = await App.prompt('Afbeelding van internet', 'Adres van de afbeelding', '', { placeholder: 'https://…/foto.jpg' });
  if (!url) return;
  let src = url.trim();
  try {
    const blob = await (await fetch(src)).blob();
    if (blob.type.startsWith('image/')) src = await App.shrinkDataUrl(await App.readFile(blob, 'dataurl'), blob.type);
  } catch { /* externe link houden */ }
  App.restoreRange();
  App.insertImageSrc(src);
});
App.ed.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
App.ed.addEventListener('drop', (e) => {
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  const r = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
  if (r) App.setRange(r);
  App.insertImages(files);
});

/* Objectselectie */
App.selectedObj = null;
App.selectObj = (img) => {
  App.selectedObj = img;
  App.selectNode(img);
  $('#obj-overlay').hidden = false;
  App.positionObjOverlay();
  const isShape = !!img.dataset.shape, isChart = !!img.dataset.chart;
  $('#grp-shape').hidden = !isShape; $('#grp-chart').hidden = !isChart;
  if (isShape) { $('#shape-fill').value = img.dataset.fill || '#156082'; $('#shape-stroke').value = img.dataset.stroke || '#0e2841'; }
  $('#img-width').value = App.px2cm(img.getBoundingClientRect().width / App.state.zoom).toFixed(1);
  App.setContext({ ...App.context, picture: true });
  App.minibar.hide();
  App.scheduleState();
};
App.deselectObj = () => {
  if (!App.selectedObj) return;
  App.selectedObj = null;
  $('#obj-overlay').hidden = true;
  App.setContext({ ...App.context, picture: false });
};
App.positionObjOverlay = () => {
  const img = App.selectedObj, ov = $('#obj-overlay');
  if (!img) return;
  if (!img.isConnected) { App.deselectObj(); return; }
  const z = App.state.zoom;
  const pr = $('#pages').getBoundingClientRect(), r = img.getBoundingClientRect();
  Object.assign(ov.style, { left: (r.left - pr.left) / z + 'px', top: (r.top - pr.top) / z + 'px', width: r.width / z + 'px', height: r.height / z + 'px' });
};
App.ed.addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG' && App.ed.contains(e.target) && App.state.view !== 'read') { App.selectObj(e.target); }
});
App.ed.addEventListener('dblclick', (e) => {
  if (e.target.tagName === 'IMG' && e.target.dataset.chart) App.exec('editChart');
});
document.addEventListener('selectionchange', () => {
  const img = App.selectedObj; if (!img) return;
  const r = App.getRange();
  const p = img.parentNode;
  const idx = p ? Array.prototype.indexOf.call(p.childNodes, img) : -1;
  if (!r || !(r.startContainer === p && r.startOffset === idx && r.endOffset === idx + 1)) {
    if (!document.activeElement || !document.activeElement.closest('#ribbon, .menu, #dialog-layer')) App.deselectObj();
  }
});
(() => {
  const ov = $('#obj-overlay');
  ov.addEventListener('mousedown', (e) => {
    const h = e.target.dataset.h; if (!h) return;
    e.preventDefault(); e.stopPropagation();
    const img = App.selectedObj; if (!img) return;
    App.history.flush();
    const z = App.state.zoom;
    const r0 = img.getBoundingClientRect();
    const w0 = r0.width / z, h0 = r0.height / z, x0 = e.clientX;
    const dir = /w/.test(h) ? -1 : 1;
    const side = h === 'e' || h === 'w';
    const tip = ov.querySelector('.size-tip');
    ov.classList.add('resizing');
    const move = (ev) => {
      const w = App.clamp(w0 + dir * (ev.clientX - x0) / z, 16, App.contentWidth());
      img.style.width = Math.round(w) + 'px';
      if (side) { img.style.height = Math.round(h0) + 'px'; img.style.objectFit = 'fill'; } else img.style.height = '';
      tip.textContent = `${App.fmtNum(App.px2cm(w), 1)} × ${App.fmtNum(App.px2cm(side ? h0 : w * h0 / w0), 1)} cm`;
      App.positionObjOverlay();
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      ov.classList.remove('resizing');
      App.changed({ immediate: true });
      App.selectObj(img);
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
})();
App.objCmd = (name, fn) => App.defEdit(name, (arg) => {
  const img = App.selectedObj;
  if (!img) { App.toast('Selecteer eerst een afbeelding', 'image'); return; }
  const r = fn(img, arg);
  if (r instanceof Promise) r.then(() => { App.changed({ immediate: true }); App.selectObj(img); });
  else App.selectObj(img);
});
['wrapInline', 'wrapLeft', 'wrapRight', 'wrapCenter'].forEach((cmd) => {
  const cls = { wrapInline: '', wrapLeft: 'wrap-left', wrapRight: 'wrap-right', wrapCenter: 'wrap-center' }[cmd];
  App.objCmd(cmd, (img) => {
    img.classList.remove('wrap-left', 'wrap-right', 'wrap-center');
    if (cls) img.classList.add(cls);
    if (!img.className) img.removeAttribute('class');
  });
  App.stateFns[cmd] = () => {
    const img = App.selectedObj; if (!img) return false;
    return cls ? img.classList.contains(cls) : !/wrap-/.test(img.className);
  };
});
App.def('pictureTabFromLayout', () => {
  if (!App.selectedObj) { App.toast('Klik eerst op een afbeelding in het document', 'image'); return; }
  App.showTab('picture');
});
App.objCmd('imgStyle', (img, cls) => { img.classList.remove('st-rounded', 'st-shadow', 'st-polaroid', 'st-circle', 'st-tilt'); if (cls) img.classList.add(cls); });
App.objCmd('imgBorder', (img, v) => { img.style.border = v || ''; });
App.objCmd('imgWidth', (img, v) => { const cm = App.parseNum(v); if (cm > 0) { img.style.width = Math.min(App.cm2px(cm), App.contentWidth()) + 'px'; img.style.height = ''; } });
App.objCmd('imgSize', (img, pct) => { img.style.width = Math.round(App.contentWidth() * pct / 100) + 'px'; img.style.height = ''; });
App.defEdit('imgDelete', () => {
  const img = App.selectedObj;
  if (!img) { App.toast('Selecteer eerst een afbeelding', 'image'); return; }
  App.deselectObj();
  const r = document.createRange(); r.setStartBefore(img); r.collapse(true);
  img.remove();
  App.setRange(r);
});
App.def('imgAlt', () => {
  const img = App.selectedObj; if (!img) { App.toast('Selecteer eerst een afbeelding', 'image'); return; }
  App.dialog({
    title: 'Alternatieve tekst',
    body: `<label class="field"><span>Beschrijf de afbeelding voor mensen die hem niet kunnen zien</span><textarea id="alt-t">${App.esc(img.alt)}</textarea></label>
      <div class="checks"><label><input type="checkbox" id="alt-d" ${img.alt === '' && img.getAttribute('role') === 'presentation' ? 'checked' : ''}> Markeren als decoratief</label></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => App.run(() => {
      if (d.$('#alt-d').checked) { img.alt = ''; img.setAttribute('role', 'presentation'); } else { img.alt = d.$('#alt-t').value.trim(); img.removeAttribute('role'); }
    }) }],
  });
});
App.def('imgReplace', async () => {
  const img = App.selectedObj; if (!img) return;
  const f = await App.pickFile('image/*');
  if (!f) return;
  const src = await App.shrinkDataUrl(await App.readFile(f, 'dataurl'), f.type);
  App.run(() => { img.src = src; delete img.dataset.orig; delete img.dataset.base; delete img.dataset.shape; delete img.dataset.chart; img.style.filter = ''; });
  App.selectObj(img);
});
/* Canvasbewerkingen (draaien, spiegelen, filters, bijsnijden) */
App.canvasEdit = async (img, draw) => {
  let im;
  try { im = await App.loadImg(img.src); } catch { App.toast('Afbeelding kon niet worden geladen', 'error'); return false; }
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  draw(cv, ctx, im);
  try {
    const isSvg = /^data:image\/svg/.test(img.src);
    const out = cv.toDataURL(/png|svg|gif|webp/.test(img.src.slice(0, 30)) || isSvg ? 'image/png' : 'image/jpeg', 0.9);
    if (!img.dataset.orig) img.dataset.orig = img.src;
    img.src = out;
    if (img.dataset) img.dataset.base = out;
    return true;
  } catch {
    App.toast('Deze afbeelding staat op een andere website en kan niet worden bewerkt. Voeg hem in vanaf je apparaat.', 'error', { ms: 4000 });
    return false;
  }
};
App.objCmd('imgRotate', async (img) => {
  const w = img.getBoundingClientRect().width / App.state.zoom;
  const h = img.getBoundingClientRect().height / App.state.zoom;
  const ok = await App.canvasEdit(img, (cv, ctx, im) => {
    cv.width = im.naturalHeight || h; cv.height = im.naturalWidth || w;
    ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate(Math.PI / 2);
    ctx.drawImage(im, -cv.height / 2, -cv.width / 2, cv.height, cv.width);
  });
  if (ok) { img.style.width = Math.min(h, App.contentWidth()) + 'px'; img.style.height = ''; delete img.dataset.shape; }
});
App.objCmd('imgFlip', (img) => App.canvasEdit(img, (cv, ctx, im) => {
  cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  ctx.translate(cv.width, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0);
}));
App.objCmd('imgFilter', async (img, f) => {
  // Filters worden altijd toegepast op de versie zonder filter (data-base)
  if (!img.dataset.orig) img.dataset.orig = img.src;
  if (!img.dataset.base) img.dataset.base = img.src;
  const base = img.dataset.base;
  if (f === 'none') { img.src = base; return; }
  const holder = { src: base, dataset: { orig: base } };
  await App.canvasEdit(holder, (cv, ctx, im) => { cv.width = im.naturalWidth; cv.height = im.naturalHeight; ctx.filter = f; ctx.drawImage(im, 0, 0); });
  img.src = holder.src;
});
App.objCmd('imgReset', (img) => {
  if (img.dataset.orig) { img.src = img.dataset.orig; delete img.dataset.orig; }
  delete img.dataset.base;
  img.style.filter = ''; img.style.border = ''; img.style.height = '';
  img.classList.remove('st-rounded', 'st-shadow', 'st-polaroid', 'st-circle', 'st-tilt');
});
App.def('imgCrop', async () => {
  const img = App.selectedObj; if (!img) { App.toast('Selecteer eerst een afbeelding', 'image'); return; }
  const d = App.dialog({
    title: 'Bijsnijden', wide: true,
    body: `<div style="text-align:center"><div class="crop-stage"><img id="cr-img" src="${img.src}"><div class="crop-box" id="cr-box"><span class="ch nw" data-c="nw"></span><span class="ch ne" data-c="ne"></span><span class="ch sw" data-c="sw"></span><span class="ch se" data-c="se"></span></div></div></div>
      <div class="seg" style="margin-top:12px" id="cr-ratio"><button data-r="0" class="on">Vrij</button><button data-r="1">1:1</button><button data-r="1.3333">4:3</button><button data-r="1.7778">16:9</button><button data-r="0.75">3:4</button></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'Bijsnijden', primary: true, action: () => {
        const ci = d.$('#cr-img');
        const k = ci.naturalWidth / ci.clientWidth;
        const b = { x: box.x * k, y: box.y * k, w: box.w * k, h: box.h * k };
        const wCss = img.getBoundingClientRect().width / App.state.zoom;
        App.history.flush();
        App.canvasEdit(img, (cv, ctx, im) => { cv.width = Math.round(b.w); cv.height = Math.round(b.h); ctx.drawImage(im, b.x, b.y, b.w, b.h, 0, 0, cv.width, cv.height); })
          .then((ok) => { if (ok) { img.style.width = Math.max(30, wCss * box.w / ci.clientWidth) + 'px'; img.style.height = ''; delete img.dataset.shape; } App.changed({ immediate: true }); App.selectObj(img); });
      },
    }],
  });
  const ci = d.$('#cr-img'), el = d.$('#cr-box');
  let box = { x: 0, y: 0, w: 0, h: 0 }, ratio = 0;
  const paint = () => Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  const init = () => { const W = ci.clientWidth, H = ci.clientHeight; box = { x: W * 0.08, y: H * 0.08, w: W * 0.84, h: H * 0.84 }; paint(); };
  if (ci.complete) init(); else ci.onload = init;
  d.$('#cr-ratio').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    $$('#cr-ratio button', d.el).forEach((x) => x.classList.toggle('on', x === b));
    ratio = +b.dataset.r;
    if (ratio) { box.h = Math.min(box.w / ratio, ci.clientHeight - box.y); box.w = box.h * ratio; paint(); }
  });
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const c = e.target.dataset.c;
    const s = { ...box }, x0 = e.clientX, y0 = e.clientY, W = ci.clientWidth, H = ci.clientHeight;
    const move = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!c) { box.x = App.clamp(s.x + dx, 0, W - s.w); box.y = App.clamp(s.y + dy, 0, H - s.h); }
      else {
        let { x, y, w, h } = s;
        if (c.includes('w')) { x = App.clamp(s.x + dx, 0, s.x + s.w - 20); w = s.w + (s.x - x); }
        if (c.includes('e')) w = App.clamp(s.w + dx, 20, W - s.x);
        if (c.includes('n')) { y = App.clamp(s.y + dy, 0, s.y + s.h - 20); h = s.h + (s.y - y); }
        if (c.includes('s')) h = App.clamp(s.h + dy, 20, H - s.y);
        if (ratio) { h = w / ratio; if (y + h > H) { h = H - y; w = h * ratio; } }
        box = { x, y, w, h };
      }
      paint();
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
});

/* =================== VORMEN =================== */
App.SHAPES = {
  rect: { name: 'Rechthoek', svg: '<rect x="3" y="3" width="94" height="94"/>' },
  rounded: { name: 'Afgeronde rechthoek', svg: '<rect x="3" y="3" width="94" height="94" rx="16"/>' },
  ellipse: { name: 'Ovaal', svg: '<ellipse cx="50" cy="50" rx="47" ry="47"/>' },
  triangle: { name: 'Driehoek', svg: '<polygon points="50,4 97,96 3,96"/>' },
  diamond: { name: 'Ruit', svg: '<polygon points="50,3 97,50 50,97 3,50"/>' },
  pentagon: { name: 'Vijfhoek', svg: '<polygon points="50,3 97,38 79,96 21,96 3,38"/>' },
  hexagon: { name: 'Zeshoek', svg: '<polygon points="25,5 75,5 97,50 75,95 25,95 3,50"/>' },
  star: { name: 'Ster', svg: '<polygon points="50,3 61,37 97,37 68,59 79,95 50,73 21,95 32,59 3,37 39,37"/>' },
  arrowR: { name: 'Pijl rechts', svg: '<polygon points="3,32 60,32 60,10 97,50 60,90 60,68 3,68"/>' },
  arrowL: { name: 'Pijl links', svg: '<polygon points="97,32 40,32 40,10 3,50 40,90 40,68 97,68"/>' },
  arrowU: { name: 'Pijl omhoog', svg: '<polygon points="32,97 32,40 10,40 50,3 90,40 68,40 68,97"/>' },
  heart: { name: 'Hart', svg: '<path d="M50 92 L12 54 C-6 34 8 6 30 8 C40 9 46 15 50 22 C54 15 60 9 70 8 C92 6 106 34 88 54 Z"/>' },
  bubble: { name: 'Tekstballon', svg: '<path d="M10 5 H90 Q97 5 97 12 V62 Q97 69 90 69 H40 L20 92 L24 69 H10 Q3 69 3 62 V12 Q3 5 10 5 Z"/>' },
  cloud: { name: 'Wolk', svg: '<path d="M26 82 C10 82 3 70 6 60 C8 50 18 46 24 47 C24 30 40 20 54 26 C62 12 86 16 88 36 C99 40 99 60 92 70 C88 78 82 82 74 82 Z"/>' },
  plus: { name: 'Plus', svg: '<polygon points="36,3 64,3 64,36 97,36 97,64 64,64 64,97 36,97 36,64 3,64 3,36 36,36"/>' },
};
App.shapeSvg = (type, fill, stroke) => {
  const s = App.SHAPES[type];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400"><g fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round">${s.svg}</g></svg>`;
};
App.svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
App.menuBuilders['m-shapes'] = () => Object.entries(App.SHAPES).map(([k, s]) => `<button data-cmd="insertShape" data-arg="${k}" title="${s.name}"><svg viewBox="0 0 100 100"><g fill="#dbe9f4" stroke="#156082" stroke-width="5" stroke-linejoin="round">${s.svg}</g></svg></button>`).join('');
App.def('insertShape', (type) => {
  const fill = getComputedStyle(App.ed).getPropertyValue('--doc-accent').trim() || '#156082';
  const stroke = App.mix(fill.length === 7 ? fill : '#156082', -0.35);
  App.restoreRange();
  App.insertImageSrc(App.svgUrl(App.shapeSvg(type, fill, stroke)), { width: 120, alt: App.SHAPES[type].name, attrs: `data-shape="${type}" data-fill="${fill}" data-stroke="${stroke}"` });
});
App.objCmd('shapeFill', (img, c) => { if (!img.dataset.shape) return; img.dataset.fill = c; img.src = App.svgUrl(App.shapeSvg(img.dataset.shape, c, img.dataset.stroke)); });
App.objCmd('shapeStroke', (img, c) => { if (!img.dataset.shape) return; img.dataset.stroke = c; img.src = App.svgUrl(App.shapeSvg(img.dataset.shape, img.dataset.fill, c)); });

/* =================== GRAFIEKEN =================== */
App.CHART_COLORS = ['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e', '#0e2841', '#ffc000'];
App.parseChartData = (text, header) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { cats: [], series: [] };
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map((l) => l.split(sep).map((x) => x.trim()));
  const num = (v) => App.parseNum(String(v).replace(/[€$%\s]/g, ''));
  let head = null;
  const yearLike = (r) => r.slice(1).length && r.slice(1).every((v) => /^(19|20|21)\d\d$/.test(v));
  const auto = rows.length > 1 && (rows[0].slice(1).some((v) => isNaN(num(v))) || (yearLike(rows[0]) && !rows.slice(1).every(yearLike)));
  if (header === true || (header == null && auto)) head = rows.shift();
  const n = Math.max(1, ...rows.map((r) => r.length - 1));
  const series = Array.from({ length: n }, (_, i) => ({ name: head ? head[i + 1] || `Reeks ${i + 1}` : (n > 1 ? `Reeks ${i + 1}` : 'Waarde'), values: rows.map((r) => num(r[i + 1]) || 0) }));
  return { cats: rows.map((r) => r[0]), series };
};
App.niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
App.chartSvg = (spec) => {
  const W = 640, H = 400, F = 'Aptos, Calibri, Segoe UI, Arial, sans-serif';
  const { cats, series } = App.parseChartData(spec.data, spec.header);
  const col = (i) => App.CHART_COLORS[i % App.CHART_COLORS.length];
  const esc = App.esc;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${F}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  const top = spec.title ? 52 : 24;
  if (spec.title) s += `<text x="${W / 2}" y="32" text-anchor="middle" font-size="20" font-weight="600" fill="#222">${esc(spec.title)}</text>`;
  const legend = series.length > 1 || spec.type === 'pie' || spec.type === 'donut';
  const bottomPad = legend ? 64 : 44;
  if (!cats.length) return s + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#999" font-size="16">Geen gegevens</text></svg>`;
  if (spec.type === 'pie' || spec.type === 'donut') {
    const vals = series[0].values.map((v) => Math.max(0, v));
    const tot = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = top + (H - top - bottomPad) / 2 + 6, R = Math.min(W, H - top - bottomPad) / 2 - 6, r = spec.type === 'donut' ? R * 0.55 : 0;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / tot) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rr) => `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
      if (v / tot >= 0.9999) s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col(i)}"/>`;
      else s += `<path d="M${r ? p(a0, r) : cx + ',' + cy} L${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} ${r ? `L${p(a1, r)} A${r},${r} 0 ${large} 0 ${p(a0, r)}` : ''} Z" fill="${col(i)}" stroke="#fff" stroke-width="2"/>`;
      const am = (a0 + a1) / 2, lr = r ? (R + r) / 2 : R * 0.65;
      if (v / tot > 0.04) s += `<text x="${(cx + lr * Math.cos(am)).toFixed(1)}" y="${(cy + lr * Math.sin(am) + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="600" fill="#fff">${Math.round((v / tot) * 100)}%</text>`;
      a0 = a1;
    });
    if (r) s += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="#fff"/>`;
  } else {
    const L = 64, Rm = 24, B = H - bottomPad, T = top + 6;
    const horizontal = spec.type === 'bar';
    const all = series.flatMap((x) => x.values);
    const minV = Math.min(0, ...all), maxV = App.niceMax(Math.max(...all, 0));
    const range = maxV - minV || 1;
    const ticks = 5;
    const fmt = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('nl-NL', { maximumFractionDigits: 2 }));
    if (!horizontal) {
      const y = (v) => B - ((v - minV) / range) * (B - T);
      for (let i = 0; i <= ticks; i++) {
        const v = minV + (range * i) / ticks, yy = y(v);
        s += `<line x1="${L}" x2="${W - Rm}" y1="${yy}" y2="${yy}" stroke="#e5e5ec"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end" font-size="12" fill="#666">${fmt(v)}</text>`;
      }
      const bw = (W - L - Rm) / cats.length;
      cats.forEach((c, i) => { s += `<text x="${L + bw * i + bw / 2}" y="${B + 18}" text-anchor="middle" font-size="12" fill="#444">${esc(String(c).slice(0, 16))}</text>`; });
      if (spec.type === 'line' || spec.type === 'area') {
        series.forEach((ser, k) => {
          const pts = ser.values.map((v, i) => `${(L + bw * i + bw / 2).toFixed(1)},${y(v).toFixed(1)}`);
          if (spec.type === 'area') s += `<polygon points="${L + bw / 2},${y(0)} ${pts.join(' ')} ${L + bw * (cats.length - 1) + bw / 2},${y(0)}" fill="${col(k)}" opacity=".22"/>`;
          s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col(k)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
          pts.forEach((p) => { const [px, py] = p.split(','); s += `<circle cx="${px}" cy="${py}" r="4" fill="#fff" stroke="${col(k)}" stroke-width="2.5"/>`; });
        });
      } else {
        const gw = bw * 0.72, w1 = gw / series.length;
        series.forEach((ser, k) => ser.values.forEach((v, i) => {
          const x = L + bw * i + (bw - gw) / 2 + w1 * k, y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
          s += `<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${(w1 - 2).toFixed(1)}" height="${Math.max(0, y1 - y0).toFixed(1)}" rx="3" fill="${col(k)}"/>`;
          if (series.length === 1 && cats.length <= 12) s += `<text x="${(x + w1 / 2 - 1).toFixed(1)}" y="${(y0 - 6).toFixed(1)}" text-anchor="middle" font-size="12" fill="#444">${fmt(v)}</text>`;
        }));
      }
      s += `<line x1="${L}" x2="${W - Rm}" y1="${y(0)}" y2="${y(0)}" stroke="#999"/>`;
    } else {
      const L2 = 110;
      const x = (v) => L2 + ((v - minV) / range) * (W - Rm - L2);
      for (let i = 0; i <= ticks; i++) {
        const v = minV + (range * i) / ticks, xx = x(v);
        s += `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${B}" stroke="#e5e5ec"/><text x="${xx}" y="${B + 18}" text-anchor="middle" font-size="12" fill="#666">${fmt(v)}</text>`;
      }
      const bh = (B - T) / cats.length, gh = bh * 0.72, h1 = gh / series.length;
      cats.forEach((c, i) => { s += `<text x="${L2 - 8}" y="${T + bh * i + bh / 2 + 4}" text-anchor="end" font-size="12" fill="#444">${esc(String(c).slice(0, 16))}</text>`; });
      series.forEach((ser, k) => ser.values.forEach((v, i) => {
        const yy = T + bh * i + (bh - gh) / 2 + h1 * k, x0 = x(Math.min(0, v)), x1 = x(Math.max(0, v));
        s += `<rect x="${x0.toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(0, x1 - x0).toFixed(1)}" height="${(h1 - 2).toFixed(1)}" rx="3" fill="${col(k)}"/>`;
      }));
    }
  }
  if (legend) {
    const items = spec.type === 'pie' || spec.type === 'donut' ? cats : series.map((x) => x.name);
    const iw = Math.min(150, (W - 40) / items.length);
    const x0 = W / 2 - (iw * items.length) / 2;
    items.forEach((it, i) => { s += `<rect x="${x0 + iw * i}" y="${H - 26}" width="12" height="12" rx="2" fill="${col(i)}"/><text x="${x0 + iw * i + 18}" y="${H - 16}" font-size="12" fill="#444">${esc(String(it).slice(0, 18))}</text>`; });
  }
  return s + '</svg>';
};
App.chartDialog = (img) => {
  App.restoreRange();
  const spec = img ? JSON.parse(img.dataset.chart) : { type: 'column', title: 'Omzet per kwartaal', data: 'Kwartaal;2025;2026\nQ1;120;140\nQ2;150;165\nQ3;170;190\nQ4;210;230' };
  const types = [['column', 'Kolom', 'bar_chart'], ['bar', 'Staaf', 'align_horizontal_left'], ['line', 'Lijn', 'show_chart'], ['area', 'Vlak', 'area_chart'], ['pie', 'Cirkel', 'pie_chart'], ['donut', 'Ring', 'donut_large']];
  const d = App.dialog({
    title: img ? 'Grafiek bewerken' : 'Grafiek invoegen', xwide: true,
    body: `<div style="display:grid;grid-template-columns:300px 1fr;gap:18px">
      <div>
        <div class="seg" id="ch-type">${types.map(([k, l, i]) => `<button data-t="${k}" class="${spec.type === k ? 'on' : ''}"><span class="i" style="font-size:16px;vertical-align:-3px">${i}</span> ${l}</button>`).join('')}</div>
        <label class="field"><span>Titel</span><input id="ch-title" value="${App.esc(spec.title)}"></label>
        <label class="field"><span>Gegevens — één rij per regel, gescheiden door ;</span><textarea id="ch-data" style="min-height:180px;font-family:Consolas,monospace;font-size:12px">${App.esc(spec.data)}</textarea></label>
        <div class="checks"><label><input type="checkbox" id="ch-head" ${spec.header !== false ? 'checked' : ''}> Eerste regel bevat kopteksten (Categorie;Reeks 1;Reeks 2)</label></div>
      </div>
      <div class="preview-box chart-preview" id="ch-prev" style="padding:8px"></div></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: img ? 'Bijwerken' : 'Invoegen', primary: true, action: (dd) => {
        const sp = read(dd);
        const src = App.svgUrl(App.chartSvg(sp));
        if (img) { App.run(() => { img.src = src; img.dataset.chart = JSON.stringify(sp); }); App.selectObj(img); }
        else App.insertImageSrc(src, { width: Math.min(560, App.contentWidth()), alt: sp.title || 'Grafiek', attrs: `data-chart="${App.esc(JSON.stringify(sp))}"` });
      },
    }],
  });
  let type = spec.type;
  const read = (dd) => ({ type, title: dd.$('#ch-title').value, data: dd.$('#ch-data').value, header: dd.$('#ch-head').checked });
  const prev = () => { d.$('#ch-prev').innerHTML = App.chartSvg(read(d)); };
  d.$('#ch-type').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; $$('#ch-type button', d.el).forEach((x) => x.classList.toggle('on', x === b)); prev(); });
  d.body.addEventListener('input', prev);
  prev();
};
App.def('insertChart', () => App.chartDialog(null));
App.def('editChart', () => { if (App.selectedObj && App.selectedObj.dataset.chart) App.chartDialog(App.selectedObj); });
