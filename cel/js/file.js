/* =========================================================
   Cel (gemaakt door JJ van Schelven) — bestanden: opslaan, openen, exporteren, sjablonen, Bestand-scherm
   ========================================================= */
'use strict';

(() => {
  const NF = App.NF;

  /* ---------- Opslaan in de browser ---------- */
  // De werkmap als gegevens voor de opslag; en de werkmap in de lijst met recente werkmappen zetten (ook gebruikt door opslag.js)
  App.bookData = () => { const data = App.serializeBook(); data.modified = Date.now(); return data; };
  App.markIndex = (data, extra) => {
    const b = App.book;
    let cells = 0; b.sheets.forEach((s) => { cells += App.cellCount(s); });
    const idx = (App.store.get('index', []) || []).filter((x) => x.id !== b.id);
    idx.unshift({ id: b.id, title: b.title, modified: data.modified, sheets: b.sheets.length, cells, thumb: thumbOf(b.sheets[b.active]), ...(extra || {}) });
    App.store.set('index', idx.slice(0, 200));
    App.store.set('last', b.id);
    b.dirty = false;
    const s = $('#save-state');
    s.textContent = App.fileHandle ? 'Opgeslagen · ' + App.fileHandle.name : 'Opgeslagen';
    s.classList.remove('dirty');
  };
  App.saveLocal = (auto, quiet) => {
    if (App.state.editing && !auto) App.commitEdit();
    const b = App.book;
    const data = App.bookData();
    if (!App.store.set('book.' + b.id, data)) {
      if (!quiet) {
        if (!auto || !App._quotaWarned) App.toast('De opslag van de browser is vol. Sla de werkmap op als bestand via Bestand › Opslaan als.', 'error', { ms: 6000 });
        App._quotaWarned = true;
        $('#save-state').textContent = 'Niet opgeslagen';
      }
      return false;
    }
    App.markIndex(data);
    return true;
  };
  App.def('save', async () => {
    if (App.state.editing) App.commitEdit();
    const ok = App.saveLocal(false);
    if (App.fileHandle) {
      try {
        const blob = await App.buildBlob(App.fileKind);
        const w = await App.fileHandle.createWritable(); await w.write(blob); await w.close();
        App.toast(`Opgeslagen in ${App.fileHandle.name}`, 'save');
        return;
      } catch (e) { App.toast('Kon niet naar het bestand schrijven: ' + e.message, 'error'); }
    }
    if (ok) App.toast('Opgeslagen in deze browser', 'save', { action: 'Ook als .xlsx-bestand', onAction: () => App.exportAs('xlsx'), ms: 4000 });
  });

  /* Kleine miniatuur voor de lijst met recente werkmappen */
  const thumbOf = (sh) => {
    if (!sh) return null;
    const rows = [];
    for (let r = 0; r < 14; r++) {
      const row = [];
      for (let c = 0; c < 7; c++) {
        const cell = App.getCell(sh, r, c);
        const st = App.styleAt(sh, r, c, cell);
        const t = cell && App.hasValue(cell) ? NF.format(App.valueOf(cell), st.nf).text.slice(0, 14) : '';
        row.push([t, st.fill || '', st.b ? 1 : 0, st.color || '']);
      }
      rows.push(row);
    }
    return rows;
  };
  const miniTable = (rows) => `<div class="mini-sheet"><table>${(rows || []).map((row) => `<tr>${row.map(([t, f, b, c]) => `<td style="width:18px;${f ? 'background:' + f + ';' : ''}${b ? 'font-weight:700;' : ''}${c ? 'color:' + c : ''}">${App.esc(t)}</td>`).join('')}</tr>`).join('')}</table></div>`;

  /* ---------- Werkmap laden / nieuw ---------- */
  App.loadBook = (book, opts = {}) => {
    if (App.state.editing) App.cancelEdit(true);
    App.deselectObj && App.deselectObj();
    App.book = book;
    App.fileHandle = opts.fileHandle || null; App.fileKind = opts.fileKind || null;
    App.state.clip = null; App.traceArrows = null;
    $('#doc-title').value = book.title;
    document.title = book.title + ' — Cel';
    book.sheets.forEach((s) => { if (s.filter) App.applyFilter(s); s._max = null; s._dims = null; });
    App.recalc();
    App.history.reset();
    App.afterSheetSwitch();
    App.updateFormulaBar();
    book.dirty = false;
    const s = $('#save-state'); s.textContent = 'Opgeslagen'; s.classList.remove('dirty');
  };
  const freshBook = (title) => App.newBook(title);
  App.newFromTemplate = (id = 'blank') => {
    if (App.book.dirty) App.saveLocal(true);
    const tpl = App.TEMPLATES.find((t) => t.id === id) || App.TEMPLATES[0];
    const n = (App.store.get('index', []) || []).length + 1;
    const book = freshBook(tpl.id === 'blank' ? 'Map' + n : tpl.name);
    if (tpl.build) { const sh = book.sheets[0]; tpl.build(sh, book); fitRows(sh); }
    App.loadBook(book);
    App.markDirty();
  };
  App.def('newBook', () => { App.newFromTemplate('blank'); App.closeBackstage(); });
  App.def('openBookId', async (id) => {
    const data = App.loadStored ? await App.loadStored(id) : App.store.get('book.' + id);
    if (!data) { App.toast('Deze werkmap is niet meer gevonden', 'error'); return; }
    if (App.book.dirty) App.saveLocal(true);
    App.loadBook(App.deserializeBook(data));
    App.store.set('last', id);
    App.closeBackstage();
  });
  $('#doc-title').addEventListener('change', (e) => {
    App.book.title = e.target.value.trim() || 'Map1';
    e.target.value = App.book.title;
    document.title = App.book.title + ' — Cel';
    App.markDirty();
  });
  $('#doc-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); App.focusGrid(); } });

  /* ---------- Bestanden openen ---------- */
  App.fileToBook = async (file) => {
    const name = file.name || 'werkmap';
    const ext = name.split('.').pop().toLowerCase();
    const title = name.replace(/\.[^.]+$/, '');
    if (ext === 'cel' || ext === 'json') {
      const d = JSON.parse(await App.readFile(file));
      if (d.format !== 'cel' || !d.sheets) throw new Error('Geen geldig Cel-bestand');
      const b = App.deserializeBook(d); b.id = App.uid('b'); b.title = d.title || title;
      return b;
    }
    if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xltx') {
      const buf = await App.readFile(file, 'buffer');
      const { book, media } = await App.Xlsx.read(buf, title);
      Object.assign(App.media, media);
      return book;
    }
    if (ext === 'xls') throw new Error('Het oude .xls-formaat wordt niet ondersteund. Sla het bestand op als .xlsx en probeer opnieuw.');
    if (ext === 'ods') throw new Error('.ods wordt niet ondersteund. Sla het bestand op als .xlsx of .csv.');
    let text = await App.readFile(file);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const book = freshBook(title);
    const sh = book.sheets[0];
    sh.name = title.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Blad1';
    const rows = App.parseDelimited(text, ext === 'tsv' ? '\t' : App.detectDelim(text));
    const prev = App.book; App.book = book;
    rows.forEach((row, i) => row.forEach((x, j) => { if (x !== '') App.setCellFromText(sh, i, j, x, { autoLink: false }); }));
    App.book = prev;
    // kolombreedte passend maken
    const maxC = Math.max(0, ...rows.map((r) => r.length));
    for (let c = 0; c < Math.min(maxC, 60); c++) {
      let w = 0; rows.slice(0, 300).forEach((r) => { if (r[c]) w = Math.max(w, App.measureText(App.fontOf({}), r[c]) + 12); });
      if (w > App.DEF_W) sh.colW[c] = Math.min(400, Math.ceil(w));
    }
    return book;
  };
  App.def('openFile', async () => {
    let file, handle = null;
    const accept = ['.xlsx', '.xlsm', '.csv', '.tsv', '.txt', '.cel'];
    if (window.showOpenFilePicker) {
      try {
        [handle] = await window.showOpenFilePicker({ types: [{ description: 'Werkmappen', accept: { 'application/octet-stream': accept } }] });
        file = await handle.getFile();
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (!file) file = await App.pickFile(accept.join(',') + ',.json,.xls,.ods');
    if (!file) return;
    App.openFileObject(file, handle);
  });
  App.openFileObject = async (file, handle) => {
    try {
      App.toast('Bezig met openen…', 'hourglass_top', { ms: 1500 });
      const book = await App.fileToBook(file);
      if (App.book.dirty) App.saveLocal(true);
      const ext = file.name.split('.').pop().toLowerCase();
      const keep = handle && (ext === 'xlsx' || ext === 'cel');
      App.loadBook(book, { fileHandle: keep ? handle : null, fileKind: keep ? ext : null });
      App.saveLocal(true);
      App.closeBackstage();
      App.toast(`“${file.name}” geopend`, 'ok');
    } catch (e) {
      console.error(e);
      App.toast('Kon het bestand niet openen: ' + e.message, 'error', { ms: 6000 });
    }
  };
  // bestanden slepen naar het venster
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    if (/^image\//.test(f.type)) App.insertImageFile(f); else App.openFileObject(f);
  });

  /* ---------- Exporteren ---------- */
  const csvOf = (sh, delim = ';') => {
    const u = App.usedRange(sh);
    if (!u) return '';
    const lines = [];
    for (let r = 0; r <= u.r2; r++) {
      const row = [];
      for (let c = 0; c <= u.c2; c++) {
        const cell = App.getCell(sh, r, c);
        let t = cell && App.hasValue(cell) ? NF.format(App.valueOf(cell), App.styleAt(sh, r, c, cell).nf).text : '';
        if (t.includes(delim) || /["\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        row.push(t);
      }
      lines.push(row.join(delim));
    }
    return lines.join('\r\n');
  };
  const htmlOf = () => {
    const parts = App.book.sheets.filter((s) => !s.hidden).map((sh) => {
      const u = App.usedRange(sh, true);
      if (!u) return `<h2>${App.esc(sh.name)}</h2><p>(leeg)</p>`;
      let t = `<h2>${App.esc(sh.name)}</h2><table>`;
      const covered = new Set();
      for (let r = 0; r <= u.r2; r++) {
        if (App.rowHidden(r, sh)) continue;
        t += `<tr style="height:${App.rowH(r, sh)}px">`;
        for (let c = 0; c <= u.c2; c++) {
          if (App.colHidden(c, sh) || covered.has(r * 16384 + c)) continue;
          const m = App.mergeAt(sh, r, c);
          let span = '';
          if (m) { if (m.r1 !== r || m.c1 !== c) continue; span = ` colspan="${m.c2 - m.c1 + 1}" rowspan="${m.r2 - m.r1 + 1}"`; for (let a = m.r1; a <= m.r2; a++) for (let b = m.c1; b <= m.c2; b++) covered.add(a * 16384 + b); }
          const cell = App.getCell(sh, r, c);
          const st = App.styleAt(sh, r, c, cell);
          const v = cell ? App.valueOf(cell) : null;
          const css = [`width:${App.colW(c, sh)}px`];
          if (st.b) css.push('font-weight:700'); if (st.i) css.push('font-style:italic'); if (st.fill) css.push('background:' + st.fill); if (st.color) css.push('color:' + st.color);
          css.push('text-align:' + (st.ha || (typeof v === 'number' ? 'right' : 'left')));
          const txt = cell && App.hasValue(cell) ? App.esc(NF.format(v, st.nf).text) : '';
          t += `<td${span} style="${css.join(';')}">${cell && cell.l ? `<a href="${App.esc(cell.l)}">${txt}</a>` : txt}</td>`;
        }
        t += '</tr>';
      }
      return t + '</table>';
    });
    return `<!doctype html>\n<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${App.esc(App.book.title)}</title>
<style>body{font-family:Aptos,Calibri,Segoe UI,sans-serif;margin:24px;color:#222}h2{font-weight:600;font-size:16px;margin:24px 0 8px}table{border-collapse:collapse;table-layout:fixed}td{border:1px solid #d9d9d9;padding:2px 5px;font-size:11pt;white-space:nowrap;overflow:hidden}</style></head><body>${parts.join('\n')}</body></html>`;
  };
  App.buildBlob = async (kind) => {
    switch (kind) {
      case 'xlsx': return App.Xlsx.build();
      case 'cel': return new Blob([JSON.stringify(App.serializeBook())], { type: 'application/json' });
      case 'csv': return new Blob(['﻿' + csvOf(App.sh(), ';')], { type: 'text/csv' });
      case 'csvc': return new Blob(['﻿' + csvOf(App.sh(), ',')], { type: 'text/csv' });
      case 'html': return new Blob([htmlOf()], { type: 'text/html' });
      default: throw new Error('Onbekend formaat');
    }
  };
  App.EXPORTS = {
    xlsx: { label: 'Werkmap (.xlsx)', ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', icon: 'table_view', desc: 'Het gangbare rekenbladformaat; te openen in vrijwel elk rekenbladprogramma. Met formules, opmaak, grafieken, filters en meerdere bladen.' },
    pdf: { label: 'PDF', ext: '.pdf', icon: 'picture_as_pdf', desc: "Vaste opmaak, ideaal om te delen of te printen. Kies in het afdrukvenster 'Opslaan als PDF'." },
    cel: { label: 'Cel-werkmap', ext: '.cel', mime: 'application/json', icon: 'grid_on', desc: 'Bewaart alles precies zoals het is in Cel.' },
    csv: { label: 'CSV (puntkomma)', ext: '.csv', mime: 'text/csv', icon: 'csv', desc: 'Alleen de waarden van het huidige blad, gescheiden door ; zoals gebruikelijk in Nederland.' },
    csvc: { label: 'CSV (komma)', ext: '.csv', mime: 'text/csv', icon: 'csv', desc: 'Alleen de waarden van het huidige blad, gescheiden door komma’s (internationaal).' },
    html: { label: 'Webpagina', ext: '.html', mime: 'text/html', icon: 'language', desc: 'Alle bladen als tabellen in één HTML-bestand dat in elke browser opent.' },
  };
  App.exportAs = async (kind) => {
    if (App.state.editing) App.commitEdit();
    if (kind === 'pdf') { App.closeBackstage(); setTimeout(() => App.exec('print'), 150); return; }
    const info = App.EXPORTS[kind];
    const base = (App.book.title || 'werkmap').replace(/[\\/:*?"<>|]+/g, '-');
    const name = base + (kind === 'csv' || kind === 'csvc' ? (App.book.sheets.length > 1 ? ' - ' + App.sh().name : '') : '') + info.ext;
    let handle = null;
    if (window.showSaveFilePicker) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: info.label, accept: { [info.mime]: [info.ext] } }] });
      } catch (e) { if (e.name === 'AbortError') return; handle = null; }
    }
    try {
      App.toast('Bezig met opslaan…', 'hourglass_top', { ms: 1200 });
      const blob = await App.buildBlob(kind);
      if (handle) {
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        if (kind === 'xlsx' || kind === 'cel') { App.fileHandle = handle; App.fileKind = kind; App.saveLocal(true); }
        App.toast(`Opgeslagen als ${handle.name}`, 'ok');
      } else {
        App.download(blob, name);
        App.toast(`${name} gedownload`, 'ok');
      }
    } catch (e) {
      console.error(e);
      App.toast('Opslaan mislukt: ' + e.message, 'error', { ms: 5000 });
    }
  };
  App.def('exportAs', (k) => App.exportAs(k));

  /* ---------- Sjablonen ---------- */
  // Kleine hulp om bladen te vullen: put('A1', waarde of '=formule', stijl)
  // Sjabloonformules zijn in het Nederlands geschreven, ongeacht de taal van de interface (zie i18n.js)
  const asNl = (fn) => { const l = App.LANG; App.LANG = 'nl'; try { return fn(); } finally { App.LANG = l; } };
  const filler = (sh) => {
    const put = (a, v, st) => {
      const p = App.parseAddr(a);
      const cell = App.cellAt(sh, p.r, p.c);
      if (v !== undefined && v !== null && v !== '') {
        if (typeof v === 'string' && v[0] === '=') cell.f = asNl(() => App.F.toCanon(v.slice(1)));
        else if (typeof v === 'string') { const q = NF.parseInput(v); cell.v = q.v; if (q.nf) cell.s = { ...(cell.s || {}), nf: q.nf }; }
        else cell.v = v;
      }
      if (st) cell.s = { ...(cell.s || {}), ...st };
      return cell;
    };
    const style = (range, st) => { const g = App.parseRange(range); for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const cell = App.cellAt(sh, r, c); cell.s = { ...(cell.s || {}), ...JSON.parse(JSON.stringify(st)) }; } };
    const width = (col, chars) => { sh.colW[App.colIndex(col)] = Math.round(chars * 7 + 5); };
    const row = (n, pt) => { sh.rowH[n - 1] = Math.round(pt / 0.75); sh.rowManual[n - 1] = 1; };
    return { put, style, width, row };
  };
  // rijhoogten aanpassen aan grote letters en terugloop (zoals Excel bij invoer doet)
  const fitRows = (sh) => { sh.data.forEach((row, r) => { if (sh.rowManual[r]) return; const h = App.fitRowHeight(sh, r); if (Math.abs(h - sh.defH) > 0.5) sh.rowH[r] = h; }); sh._dims = null; };
  App.fitRows = fitRows;
  const EUR = '"€" #,##0.00;"€" -#,##0.00';
  const ACC = '#156082', ACC_L = '#dceaf3', HEAD = { b: true, fill: ACC, color: '#ffffff' };
  const thin = (c = '#bfbfbf') => ({ t: ['thin', c], b: ['thin', c], l: ['thin', c], r: ['thin', c] });
  App.TEMPLATES = [
    { id: 'blank', name: 'Lege werkmap' },
    {
      id: 'budget', name: 'Maandbudget', build: (sh) => {
        sh.name = 'Budget';
        const { put, style, width } = filler(sh);
        width('A', 26); width('B', 14); width('C', 14); width('D', 14); width('E', 3); width('F', 22); width('G', 14);
        put('A1', 'Maandbudget', { size: 20, b: true, color: '#0e2841' });
        put('A2', 'Vul de bedragen in; totalen worden automatisch berekend.', { i: true, color: '#7f7f7f' });
        ['Inkomsten', 'Begroot', 'Werkelijk', 'Verschil'].forEach((t, i) => put(App.colName(i) + '4', t, HEAD));
        [['Salaris', 2800, 2800], ['Toeslagen', 150, 150], ['Overig', 50, 0]].forEach(([n, a, b], i) => { const r = 5 + i; put('A' + r, n); put('B' + r, a, { nf: EUR }); put('C' + r, b, { nf: EUR }); put('D' + r, `=C${r}-B${r}`, { nf: EUR }); });
        put('A8', 'Totaal inkomsten', { b: true }); ['B', 'C', 'D'].forEach((c) => put(c + '8', `=SOM(${c}5:${c}7)`, { b: true, nf: EUR, bd: { t: ['thin', '#000'], b: ['double', '#000'] } }));
        ['Uitgaven', 'Begroot', 'Werkelijk', 'Verschil'].forEach((t, i) => put(App.colName(i) + '10', t, HEAD));
        [['Huur / hypotheek', 950, 950], ['Energie en water', 180, 195], ['Boodschappen', 450, 480], ['Verzekeringen', 160, 160], ['Telefoon en internet', 60, 60], ['Vervoer', 120, 95], ['Vrije tijd', 150, 210], ['Sparen', 300, 300]].forEach(([n, a, b], i) => { const r = 11 + i; put('A' + r, n); put('B' + r, a, { nf: EUR }); put('C' + r, b, { nf: EUR }); put('D' + r, `=B${r}-C${r}`, { nf: EUR }); if (i % 2) style(`A${r}:D${r}`, { fill: ACC_L }); });
        put('A19', 'Totaal uitgaven', { b: true }); ['B', 'C', 'D'].forEach((c) => put(c + '19', `=SOM(${c}11:${c}18)`, { b: true, nf: EUR, bd: { t: ['thin', '#000'], b: ['double', '#000'] } }));
        put('F4', 'Overzicht', HEAD); put('G4', '', HEAD);
        put('F5', 'Inkomsten'); put('G5', '=C8', { nf: EUR }); put('F6', 'Uitgaven'); put('G6', '=C19', { nf: EUR });
        put('F7', 'Over', { b: true }); put('G7', '=G5-G6', { b: true, nf: EUR, bd: { t: ['thin', '#000'] } });
        sh.cf.push({ id: App.uid('cf'), ranges: [App.parseRange('D5:D7'), App.parseRange('D11:D18'), App.parseRange('G7')], type: 'lt', v1: '0', style: { fill: '#ffc7ce', color: '#9c0006' } });
        sh.objs.push({ id: App.uid('o'), type: 'chart', r: 9, c: 5, dx: 0, dy: 6, w: 400, h: 320, chart: { kind: 'bar', range: 'Budget!$A$10:$C$18', title: 'Begroot en werkelijk', legend: 'bottom', labels: false, grid: true, palette: 0 } });
        sh.freeze = { r: 0, c: 0 };
      },
    },
    {
      id: 'invoice', name: 'Factuur', build: (sh) => {
        sh.name = 'Factuur'; sh.grid = false;
        const { put, style, width, row } = filler(sh);
        width('A', 40); width('B', 10); width('C', 14); width('D', 16);
        put('A1', 'FACTUUR', { size: 24, b: true, color: ACC }); row(1, 32);
        put('C1', 'Jouw Bedrijf', { b: true, ha: 'right' }); sh.merges.push(App.parseRange('C1:D1'));
        put('C2', 'Straat 1, 1234 AB Plaats', { ha: 'right' }); sh.merges.push(App.parseRange('C2:D2'));
        put('C3', 'KvK 12345678', { ha: 'right', color: '#7f7f7f' }); sh.merges.push(App.parseRange('C3:D3'));
        put('A5', 'Factuur aan', { b: true }); put('A6', 'Klantnaam'); put('A7', 'Adres 10'); put('A8', '5678 CD Plaats');
        put('C5', 'Factuurnummer', { b: true }); put('D5', '2026-001', { ha: 'right' });
        put('C6', 'Factuurdatum', { b: true }); put('D6', '=VANDAAG()', { nf: 'd-m-yyyy', ha: 'right' });
        put('C7', 'Vervaldatum', { b: true }); put('D7', '=D6+30', { nf: 'd-m-yyyy', ha: 'right' });
        ['Omschrijving', 'Aantal', 'Prijs', 'Bedrag'].forEach((t, i) => put(App.colName(i) + '10', t, { ...HEAD, ha: i ? 'right' : undefined }));
        [['Dienst of product', 1, 100], ['Dienst of product', 2, 50], ['', '', ''], ['', '', ''], ['', '', '']].forEach(([n, q, p], i) => { const r = 11 + i; put('A' + r, n); put('B' + r, q); put('C' + r, p, { nf: EUR }); put('D' + r, `=ALS(B${r}="";"";B${r}*C${r})`, { nf: EUR }); style(`A${r}:D${r}`, { bd: { b: ['thin', '#d9d9d9'] } }); });
        put('C17', 'Subtotaal', { b: true }); put('D17', '=SOM(D11:D15)', { nf: EUR });
        put('C18', 'Btw 21%', { b: true }); put('D18', '=AFRONDEN(D17*21%;2)', { nf: EUR });
        put('C19', 'Totaal', { b: true, size: 13 }); put('D19', '=D17+D18', { nf: EUR, b: true, size: 13, bd: { t: ['thin', '#000'], b: ['double', '#000'] } });
        put('A22', 'Gelieve het totaalbedrag binnen 30 dagen over te maken op NL00 BANK 0123 4567 89 onder vermelding van het factuurnummer.', { wrap: true, color: '#595959' }); sh.merges.push(App.parseRange('A22:D23')); row(22, 15); row(23, 15);
        sh.page.center = true;
      },
    },
    {
      id: 'todo', name: 'Takenlijst', build: (sh) => {
        sh.name = 'Taken';
        const { put, width, style } = filler(sh);
        width('A', 6); width('B', 38); width('C', 14); width('D', 14); width('E', 16); width('F', 30);
        put('A1', 'Takenlijst', { size: 20, b: true, color: '#0e2841' });
        ['Nr.', 'Taak', 'Wie', 'Deadline', 'Status', 'Opmerking'].forEach((t, i) => put(App.colName(i) + '3', t, HEAD));
        const today = new Date();
        [['Plan maken', 'Sam', 3, 'Klaar'], ['Offertes opvragen', 'Noor', 7, 'Bezig'], ['Budget goedkeuren', 'Kim', 10, 'Te doen'], ['Uitvoering starten', 'Sam', 14, 'Te doen'], ['Evaluatie', 'Noor', 30, 'Te doen']].forEach(([t, w, d, s], i) => {
          const r = 4 + i;
          put('A' + r, i + 1); put('B' + r, t); put('C' + r, w);
          put('D' + r, NF.dateToSerial(today.getFullYear(), today.getMonth(), today.getDate() + d), { nf: 'd-m-yyyy' });
          put('E' + r, s);
          style(`A${r}:F${r}`, { bd: { b: ['thin', '#d9d9d9'] } });
        });
        sh.dv.push({ ranges: [App.parseRange('E4:E50')], type: 'list', list: 'Te doen;Bezig;Klaar', blank: true, inCell: true, style: 'stop' });
        sh.cf.push({ id: App.uid('cf'), ranges: [App.parseRange('E4:E50')], type: 'eq', v1: 'Klaar', style: { fill: '#c6efce', color: '#006100' } });
        sh.cf.push({ id: App.uid('cf'), ranges: [App.parseRange('E4:E50')], type: 'eq', v1: 'Bezig', style: { fill: '#ffeb9c', color: '#9c5700' } });
        sh.filter = { r: 2, r2: 8, c1: 0, c2: 5, crit: {} };
        sh.freeze = { r: 3, c: 0 };
        put('H3', 'Open taken', { b: true }); put('I3', '=AANTALLEN.ALS(B4:B50;"<>";E4:E50;"<>Klaar")');
        width('H', 12);
      },
    },
    {
      id: 'grades', name: 'Cijferlijst', build: (sh) => {
        sh.name = 'Cijfers';
        const { put, width, style } = filler(sh);
        width('A', 22); ['B', 'C', 'D', 'E'].forEach((c) => width(c, 10)); width('F', 12); width('G', 14);
        put('A1', 'Cijferlijst', { size: 20, b: true, color: '#0e2841' });
        ['Leerling', 'Toets 1', 'Toets 2', 'Toets 3', 'PO', 'Gemiddelde', 'Resultaat'].forEach((t, i) => put(App.colName(i) + '3', t, { ...HEAD, ha: i ? 'center' : undefined }));
        [['Anna de Vries', 7.5, 6.8, 8.1, 7], ['Bram Jansen', 5.2, 6.1, 4.8, 6.5], ['Chloé Bakker', 8.9, 9.2, 8.4, 9], ['Daan Visser', 6, 5.4, 6.3, 5.5], ['Emma Smit', 4.5, 5.8, 5.1, 6]].forEach((row, i) => {
          const r = 4 + i;
          row.forEach((v, j) => put(App.colName(j) + r, v, j ? { nf: '0.0', ha: 'center' } : {}));
          put('F' + r, `=AFRONDEN(GEMIDDELDE(B${r}:E${r});1)`, { nf: '0.0', ha: 'center', b: true });
          put('G' + r, `=ALS(F${r}>=5,5;"Voldoende";"Onvoldoende")`, { ha: 'center' });
          if (i % 2) style(`A${r}:G${r}`, { fill: ACC_L });
        });
        put('A10', 'Klasgemiddelde', { b: true });
        ['B', 'C', 'D', 'E', 'F'].forEach((c) => put(c + '10', `=GEMIDDELDE(${c}4:${c}8)`, { nf: '0.0', ha: 'center', b: true, bd: { t: ['thin', '#000'] } }));
        sh.cf.push({ id: App.uid('cf'), ranges: [App.parseRange('B4:F8')], type: 'lt', v1: '5,5', style: { color: '#c00000', b: true } });
        sh.cf.push({ id: App.uid('cf'), ranges: [App.parseRange('G4:G8')], type: 'eq', v1: 'Onvoldoende', style: { fill: '#ffc7ce', color: '#9c0006' } });
        sh.objs.push({ id: App.uid('o'), type: 'chart', r: 11, c: 0, dx: 0, dy: 8, w: 520, h: 260, chart: { kind: 'column', range: 'Cijfers!$A$3:$E$8', title: 'Cijfers per leerling', legend: 'bottom', labels: false, grid: true, palette: 0 } });
      },
    },
    {
      id: 'cashbook', name: 'Kasboek', build: (sh) => {
        sh.name = 'Kasboek';
        const { put, width, style } = filler(sh);
        width('A', 12); width('B', 34); width('C', 16); width('D', 13); width('E', 13); width('F', 14);
        put('A1', 'Kasboek', { size: 20, b: true, color: '#0e2841' });
        put('E2', 'Beginsaldo', { b: true, ha: 'right' }); put('F2', 500, { nf: EUR, fill: '#ffcc99', bd: thin('#7f7f7f') });
        ['Datum', 'Omschrijving', 'Categorie', 'Ontvangen', 'Uitgegeven', 'Saldo'].forEach((t, i) => put(App.colName(i) + '4', t, HEAD));
        const d = new Date();
        [['Boodschappen', 'Huishouden', 0, 64.35], ['Salaris', 'Inkomen', 2800, 0], ['Benzine', 'Vervoer', 0, 72.1], ['Verjaardagscadeau', 'Overig', 0, 25], ['Terugbetaling', 'Overig', 40, 0]].forEach(([o, c, i, u], k) => {
          const r = 5 + k;
          put('A' + r, NF.dateToSerial(d.getFullYear(), d.getMonth(), 1 + k * 3), { nf: 'd-m-yyyy' });
          put('B' + r, o); put('C' + r, c);
          put('D' + r, i || null, { nf: EUR }); put('E' + r, u || null, { nf: EUR });
          put('F' + r, k === 0 ? `=F2+D${r}-E${r}` : `=F${r - 1}+D${r}-E${r}`, { nf: EUR, b: true });
          style(`A${r}:F${r}`, { bd: { b: ['thin', '#d9d9d9'] } });
        });
        sh.dv.push({ ranges: [App.parseRange('C5:C200')], type: 'list', list: 'Inkomen;Huishouden;Vervoer;Wonen;Vrije tijd;Overig', blank: true, inCell: true, style: 'warning' });
        sh.filter = { r: 3, r2: 9, c1: 0, c2: 5, crit: {} };
        sh.freeze = { r: 4, c: 0 };
        put('H4', 'Per categorie', HEAD); put('I4', 'Uitgegeven', HEAD);
        ['Huishouden', 'Vervoer', 'Wonen', 'Vrije tijd', 'Overig'].forEach((c, k) => { put('H' + (5 + k), c); put('I' + (5 + k), `=SOM.ALS($C$5:$C$200;H${5 + k};$E$5:$E$200)`, { nf: EUR }); });
        width('H', 16); width('I', 14);
      },
    },
    {
      id: 'schedule', name: 'Weekplanning', build: (sh) => {
        sh.name = 'Planning';
        const { put, width, style, row } = filler(sh);
        width('A', 9);
        const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
        days.forEach((dd, i) => { width(App.colName(i + 1), 17); put(App.colName(i + 1) + '3', dd, { ...HEAD, ha: 'center' }); });
        put('A1', 'Weekplanning', { size: 20, b: true, color: '#0e2841' });
        put('A3', 'Tijd', HEAD);
        for (let h = 7; h <= 21; h++) {
          const r = 4 + (h - 7);
          put('A' + r, (h) / 24, { nf: 'h:mm', b: true, color: '#595959' });
          style(`B${r}:H${r}`, { bd: thin('#d9d9d9') });
          row(r, 22);
        }
        put('B6', 'Werk', { fill: '#dceaf3' }); put('C6', 'Werk', { fill: '#dceaf3' }); put('D10', 'Sport', { fill: '#c6efce' }); put('G7', 'Markt', { fill: '#ffeb9c' });
        sh.freeze = { r: 3, c: 1 };
        sh.page.orient = 'landscape'; sh.page.fitW = 1;
      },
    },
  ];
  App.WELCOME = () => {
    const book = freshBook('Welkom bij Cel');
    const sh = book.sheets[0];
    sh.name = 'Welkom';
    const { put, width, style } = filler(sh);
    width('A', 3); width('B', 16); width('C', 14); width('D', 14); width('E', 14); width('F', 3); width('G', 44);
    put('B2', 'Welkom bij Cel', { size: 22, b: true, color: '#0e2841' });
    put('B3', 'Rekenblad, gemaakt door JJ van Schelven. Geen account nodig, alles blijft op je eigen computer.', { color: '#595959', i: true });
    ['Maand', 'Omzet', 'Kosten', 'Winst'].forEach((t, i) => put(App.colName(i + 1) + '5', t, HEAD));
    [['Januari', 12500, 8200], ['Februari', 13800, 8900], ['Maart', 15200, 9100], ['April', 14100, 9800], ['Mei', 16900, 10200], ['Juni', 18400, 10900]].forEach(([m, o, k], i) => {
      const r = 6 + i;
      put('B' + r, m); put('C' + r, o, { nf: '"€" #,##0' }); put('D' + r, k, { nf: '"€" #,##0' }); put('E' + r, `=C${r}-D${r}`, { nf: '"€" #,##0', b: true });
      if (i % 2) style(`B${r}:E${r}`, { fill: ACC_L });
    });
    put('B12', 'Totaal', { b: true });
    ['C', 'D', 'E'].forEach((c) => put(c + '12', `=SOM(${c}6:${c}11)`, { b: true, nf: '"€" #,##0', bd: { t: ['thin', '#000'], b: ['double', '#000'] } }));
    put('B13', 'Gemiddelde', { i: true, color: '#595959' });
    ['C', 'D', 'E'].forEach((c) => put(c + '13', `=GEMIDDELDE(${c}6:${c}11)`, { i: true, color: '#595959', nf: '"€" #,##0' }));
    sh.cf.push({ id: App.uid('cf'), ranges: [App.parseRange('E6:E11')], type: 'bar', color: '#63be7b' });
    const tips = [['Aan de slag', ''], ['Typ in een cel en druk op Enter.', ''], ['Begin met = voor een formule, bv. =SOM(C6:C11)', ''], ['Klik tijdens een formule op cellen om ze toe te voegen.', ''], ['Sleep het vierkantje rechtsonder om door te voeren.', ''], ['Alt+= maakt een AutoSom.', ''], ['Bestand › Openen opent .xlsx-bestanden.', ''], ['Bestand › Opslaan als bewaart als .xlsx, .csv of PDF.', ''], ['Ctrl+E: Snel aanvullen · Ctrl+Q: Snelle analyse.', ''], ['Probeer =SORTEREN(B6:E11;4;-1) voor een overlopende lijst.', ''], ['F1 toont alle sneltoetsen.', '']];
    tips.forEach(([t], i) => put('G' + (5 + i), t, i === 0 ? HEAD : { color: '#404040' }));
    style('G6:G13', { bd: { b: ['thin', '#e6e6e6'] } });
    sh.objs.push({ id: App.uid('o'), type: 'chart', r: 14, c: 1, dx: 0, dy: 10, w: 470, h: 260, chart: { kind: 'column', range: 'Welkom!$B$5:$D$11', title: 'Omzet en kosten per maand', legend: 'bottom', labels: false, grid: true, palette: 0 } });
    sh.sel = { ranges: [{ r1: 5, c1: 2, r2: 5, c2: 2 }], ar: 5, ac: 2, ri: 0 };
    fitRows(sh);
    return book;
  };

  /* ---------- Bestand-scherm (backstage) ---------- */
  App.def('openBackstage', (section) => {
    if (App.state.editing) App.commitEdit();
    let bs = $('#backstage');
    if (!bs) {
      bs = document.createElement('div');
      bs.id = 'backstage';
      bs.innerHTML = `<nav class="bs-nav">
        <button class="bs-back" data-bs="back" title="Terug naar de werkmap (Esc)"><span class="i">arrow_back</span></button>
        <button data-bs="home"><span class="i">home</span> Start</button>
        <button data-bs="new"><span class="i">note_add</span> Nieuw</button>
        <button data-bs="open"><span class="i">folder_open</span> Openen</button>
        <div class="bs-sep"></div>
        <button data-bs="info">Info</button>
        <button data-bs="save">Opslaan</button>
        <button data-bs="export">Opslaan als</button>
        <button data-bs="print">Afdrukken</button>
        <div class="bs-fill"></div>
        <div class="bs-sep"></div>
        <button data-bs="options">Opties</button>
      </nav><div class="bs-main"></div>`;
      document.body.appendChild(bs);
      bs.querySelector('.bs-nav').addEventListener('click', (e) => {
        const b = e.target.closest('[data-bs]'); if (!b) return;
        if (b.dataset.bs === 'back') App.closeBackstage(); else App.renderBackstage(b.dataset.bs);
      });
    }
    App.renderBackstage(typeof section === 'string' ? section : 'home');
  });
  App.closeBackstage = () => { const bs = $('#backstage'); if (bs) { bs.remove(); App.focusGrid(); } };
  App.def('closeBackstage', () => App.closeBackstage());
  const tplThumb = (t) => {
    if (t.id === 'blank') return '<div class="thumb blank-sheet"></div>';
    if (!t._thumb) { const b = freshBook(t.name); const prev = App.book; App.book = b; try { t.build(b.sheets[0], b); fitRows(b.sheets[0]); App.recalc(); t._thumb = thumbOf(b.sheets[0]); } catch (e) { console.error(e); t._thumb = []; } App.book = prev; }
    return `<div class="thumb">${miniTable(t._thumb)}</div>`;
  };
  const tplCard = (t) => `<button class="tpl" data-tpl="${t.id}">${tplThumb(t)}<div class="tname">${t.name}</div></button>`;
  App.tplCard = tplCard;
  const recentRows = (limit, withDelete) => {
    const idx = (App.store.get('index', []) || []).slice(0, limit);
    if (!idx.length) return '<div class="recent-row" style="cursor:default"><span class="muted">Nog geen werkmappen. Begin met een nieuwe werkmap.</span></div>';
    return idx.map((d) => `<div class="recent-row" data-open="${d.id}"><span class="i">table_view</span><span class="rn">${App.esc(d.title)}${d.id === App.book.id ? ' <span class="chip" style="margin-left:6px">geopend</span>' : ''}</span><span class="rd">${d.sheets ? d.sheets + (d.sheets === 1 ? ' blad · ' : ' bladen · ') : ''}${App.fmtDateTime(d.modified)}</span>${withDelete ? `<button class="qb" data-del="${d.id}" title="Verwijderen uit deze browser"><span class="i">delete</span></button>` : ''}</div>`).join('');
  };
  App.renderBackstage = (sec) => {
    const bs = $('#backstage'), main = bs.querySelector('.bs-main');
    $$('.bs-nav [data-bs]', bs).forEach((b) => b.classList.toggle('on', b.dataset.bs === sec));
    const h = new Date().getHours();
    const greet = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
    const b = App.book;
    let html = '';
    if (sec === 'home') {
      html = `<h1>${greet}</h1><h3>Nieuw</h3><div class="tpl-grid">${App.TEMPLATES.slice(0, 6).map(tplCard).join('')}</div>
        <h3>Recent</h3><div class="recent-list">${recentRows(8)}</div>`;
    } else if (sec === 'new') {
      html = `<h1>Nieuw</h1><div class="tpl-grid">${App.TEMPLATES.map(tplCard).join('')}</div>`;
    } else if (sec === 'open') {
      html = `<h1>Openen</h1><div class="bs-cards" style="margin-bottom:8px"><button class="bs-card" data-act="openFile"><span class="i">folder_open</span><div><b>Bladeren…</b><small>Open een bestand van je computer: .xlsx, CSV, tekst of Cel (.cel). Je kunt een bestand ook naar dit venster slepen.</small></div></button></div>
        <h3>Werkmappen in deze browser</h3><div class="recent-list">${recentRows(200, true)}</div>`;
    } else if (sec === 'info') {
      let cells = 0, formulas = 0; b.sheets.forEach((s) => App.eachCell(s, (r, c, cell) => { if (App.hasValue(cell)) cells++; if (cell.f) formulas++; }));
      html = `<h1>Info</h1><div class="props">
        <span class="k">Titel</span><input id="bs-title" value="${App.esc(b.title)}">
        <span class="k">Gemaakt</span><span>${App.fmtDateTime(b.created)}</span>
        <span class="k">Laatst gewijzigd</span><span>${App.fmtDateTime(b.modified)}</span>
        <span class="k">Bladen</span><span>${b.sheets.length}</span>
        <span class="k">Cellen met gegevens</span><span>${cells.toLocaleString('nl-NL')}</span>
        <span class="k">Formules</span><span>${formulas.toLocaleString('nl-NL')}</span>
        <span class="k">Bestand</span><span>${App.fileHandle ? App.esc(App.fileHandle.name) : 'Alleen in deze browser'}</span></div>
        <h3>Werkmap beveiligen</h3><div class="bs-cards">
          <button class="bs-card" data-act="toggleProtect"><span class="i">lock</span><div><b>${App.sh().protect ? 'Beveiliging van blad opheffen' : 'Huidig blad beveiligen'}</b><small>${App.sh().protect ? 'Het blad is nu beveiligd: vergrendelde cellen kunnen niet worden gewijzigd.' : 'Voorkom onbedoelde wijzigingen in vergrendelde cellen.'}</small></div></button>
          <button class="bs-card" data-act="errorCheck"><span class="i">error</span><div><b>Formules controleren</b><small>Zoek naar cellen met foutwaarden zoals #DEEL/0! of #VERW!.</small></div></button>
          <button class="bs-card" data-act="workbookStats"><span class="i">analytics</span><div><b>Statistieken</b><small>Aantal bladen, cellen, formules en objecten.</small></div></button></div>`;
    } else if (sec === 'save') {
      html = `<h1>Opslaan</h1><div class="bs-cards">
        <button class="bs-card" data-act="saveNow"><span class="i">save</span><div><b>Nu opslaan</b><small>Bewaar de werkmap in deze browser${App.fileHandle ? ' en in ' + App.esc(App.fileHandle.name) : ''}. (Ctrl+S)</small></div></button>
        <button class="bs-card" data-exp="xlsx"><span class="i">table_view</span><div><b>Opslaan op computer (.xlsx)</b><small>Sla op als .xlsx-bestand. Daarna slaat Ctrl+S direct op in dat bestand.</small></div></button>
        <button class="bs-card" data-exp="cel"><span class="i">grid_on</span><div><b>Opslaan als Cel-bestand</b><small>Verliesvrij: alles blijft precies zoals het is.</small></div></button></div>
        <h3>Automatisch opslaan</h3><label class="chk" style="font-size:13px"><input type="checkbox" id="bs-autosave" ${App.settings.autosave ? 'checked' : ''}> Wijzigingen automatisch opslaan in deze browser</label>
        <p class="muted small" style="max-width:640px;line-height:1.5">Werkmappen in de browser blijven bewaard op deze computer en in deze browser. Wis je de browsergegevens, dan zijn ze weg — sla belangrijke werkmappen daarom ook op als bestand.</p>`;
    } else if (sec === 'export') {
      html = `<h1>Opslaan als</h1><div class="bs-cards">${Object.entries(App.EXPORTS).map(([k, e]) => `<button class="bs-card" data-exp="${k}"><span class="i">${e.icon}</span><div><b>${e.label} <span class="muted small">${e.ext}</span></b><small>${e.desc}</small></div></button>`).join('')}</div>`;
    } else if (sec === 'print') {
      const p = App.sh().page;
      html = `<h1>Afdrukken</h1><div class="bs-cards">
        <button class="bs-card" data-act="print"><span class="i">print</span><div><b>Huidig blad afdrukken…</b><small>Opent het afdrukvenster. Kies daar een printer of <b>Opslaan als PDF</b>.</small></div></button>
        <button class="bs-card" data-act="printBook"><span class="i">library_books</span><div><b>Hele werkmap afdrukken…</b><small>Alle zichtbare bladen achter elkaar.</small></div></button>
        <button class="bs-card" data-act="printPreview"><span class="i">preview</span><div><b>Afdrukvoorbeeld</b><small>Bekijk hoe de pagina's eruit komen te zien.</small></div></button>
        <button class="bs-card" data-act="pageSetup"><span class="i">settings</span><div><b>Pagina-instelling</b><small>Marges, afdrukstand, passend maken, kop- en voettekst.</small></div></button></div>
        <h3>Instellingen</h3><div class="props"><span class="k">Papier</span><span>${p.size}, ${p.orient === 'landscape' ? 'liggend' : 'staand'}</span>
        <span class="k">Marges</span><span>${['t', 'b', 'l', 'r'].map((k) => App.fmtNum(p.margins[k])).join(' / ')} cm (boven/onder/links/rechts)</span>
        <span class="k">Schaal</span><span>${p.fitW ? `Passend op ${p.fitW} pagina${p.fitW > 1 ? "'s" : ''} breed` : (p.scale || 100) + '%'}</span>
        <span class="k">Afdrukbereik</span><span>${App.sh().printArea ? App.rangeStr(App.sh().printArea) : 'Alles met gegevens'}</span></div>
        <p class="muted small" style="margin-top:14px">Tip: zet in het afdrukvenster ‘Kopteksten en voetteksten’ van de browser uit voor het mooiste resultaat.</p>`;
    } else if (sec === 'options') {
      html = `<h1>Opties</h1><div class="props">
        <span class="k">Weergave</span><label class="chk"><input type="checkbox" id="op-dark" ${App.settings.dark ? 'checked' : ''}> Donkere modus</label>
        <span class="k">Formulebalk</span><label class="chk"><input type="checkbox" id="op-fbar" ${App.settings.fbar ? 'checked' : ''}> Formulebalk tonen</label>
        <span class="k">Opslaan</span><label class="chk"><input type="checkbox" id="op-auto" ${App.settings.autosave ? 'checked' : ''}> Automatisch opslaan</label>
        <span class="k">Berekenen</span><label class="chk"><input type="checkbox" id="op-calc" ${App.book.calc === 'auto' ? 'checked' : ''}> Automatisch berekenen</label>
      </div>
      <h3>Gegevens</h3><div class="bs-cards"><button class="bs-card" data-act="wipe"><span class="i">delete_forever</span><div><b>Alle werkmappen in deze browser wissen</b><small>Verwijdert alle opgeslagen Cel-werkmappen uit deze browser. Dit kan niet ongedaan worden gemaakt.</small></div></button></div>`;
    }
    main.innerHTML = html;
    main.onclick = async (e) => {
      const tpl = e.target.closest('[data-tpl]');
      if (tpl) { App.newFromTemplate(tpl.dataset.tpl); App.closeBackstage(); return; }
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        const id = del.dataset.del;
        const item = (App.store.get('index', []) || []).find((x) => x.id === id);
        if (!(await App.confirm('Werkmap verwijderen', `“${App.esc(item ? item.title : '')}” definitief uit deze browser verwijderen?`, 'Verwijderen', true))) return;
        App.store.del('book.' + id); if (App.bigStore) App.bigStore.del(id);
        App.store.set('index', (App.store.get('index', []) || []).filter((x) => x.id !== id));
        if (id === App.book.id) App.book.dirty = true;
        App.renderBackstage(sec);
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) { if (open.dataset.open === App.book.id) App.closeBackstage(); else App.exec('openBookId', open.dataset.open); return; }
      const exp = e.target.closest('[data-exp]');
      if (exp) { App.exportAs(exp.dataset.exp); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'saveNow') { App.exec('save'); App.renderBackstage(sec); }
      else if (a === 'print') App.exec('print');
      else if (a === 'printBook') App.exec('print', 'book');
      else if (a === 'openFile') App.exec('openFile');
      else if (a === 'wipe') {
        if (!(await App.confirm('Alles wissen', 'Alle Cel-werkmappen in deze browser worden verwijderd. Weet je het zeker?', 'Alles wissen', true))) return;
        (App.store.get('index', []) || []).forEach((d) => { App.store.del('book.' + d.id); if (App.bigStore) App.bigStore.del(d.id); });
        App.store.set('index', []);
        App.book.dirty = true;
        App.toast('Alle werkmappen zijn gewist', 'ok');
      } else { App.closeBackstage(); App.exec(a); }
    };
    main.onchange = (e) => {
      const t = e.target;
      if (t.id === 'bs-title') { $('#doc-title').value = t.value; $('#doc-title').dispatchEvent(new Event('change')); }
      if (t.id === 'bs-autosave' || t.id === 'op-auto') { App.settings.autosave = t.checked; App.saveSettings(); if (t.checked) App.saveLocal(true); }
      if (t.id === 'op-dark' && t.checked !== App.settings.dark) App.exec('toggleDark');
      if (t.id === 'op-fbar') App.exec('toggleFormulaBar', t.checked);
      if (t.id === 'op-calc') App.exec('calcMode', t.checked ? 'auto' : 'manual');
    };
  };
})();
