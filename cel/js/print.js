/* =========================================================
   Cel (gemaakt door JJ van Schelven) — afdrukken: pagina-instelling, afdrukbereik, titels,
   pagina-einden, kop-/voettekst, afdrukvoorbeeld en PDF
   ========================================================= */
'use strict';

(() => {
  const NF = App.NF;
  const PAPER = { A4: [21, 29.7], A5: [14.8, 21], A3: [29.7, 42], Letter: [21.59, 27.94], Legal: [21.59, 35.56] };
  const CM = 96 / 2.54;

  /* ---------- Pagina-instellingen ---------- */
  App.defEdit('margins', (arg) => { const [t, l, b, r] = arg.split(',').map(Number); App.sh().page.margins = { t, l, b, r }; }, { allowProtected: true });
  App.defEdit('orientation', (o) => { App.sh().page.orient = o; }, { allowProtected: true });
  App.defEdit('pageSize', (s) => { App.sh().page.size = s; }, { allowProtected: true });
  App.defEdit('fitWidth', (v) => { App.sh().page.fitW = +v || 0; }, { allowProtected: true });
  App.defEdit('printScale', (v) => { const n = App.clamp(+v || 100, 10, 400); App.sh().page.scale = n; App.sh().page.fitW = 0; }, { allowProtected: true });
  App.defEdit('togglePrintGrid', (v) => { App.sh().page.grid = typeof v === 'boolean' ? v : !App.sh().page.grid; }, { allowProtected: true });
  App.defEdit('togglePrintHeads', (v) => { App.sh().page.heads = typeof v === 'boolean' ? v : !App.sh().page.heads; }, { allowProtected: true });
  App.defEdit('setPrintArea', () => { const g = App.selBounded(App.selRange()); App.sh().printArea = g; App.toast('Afdrukbereik ingesteld op ' + App.rangeStr(g), 'ok'); }, { allowProtected: true });
  App.defEdit('clearPrintArea', () => { App.sh().printArea = null; }, { allowProtected: true });
  App.def('printTitles', () => App.exec('pageSetup', 'sheet'));
  App.def('headerFooter', () => App.exec('pageSetup', 'hf'));

  App.def('pageSetup', (tab) => {
    const sh = App.sh(); const p = sh.page;
    const codes = [['&[Pagina]', 'Paginanummer'], ['&[Pagina\'s]', 'Aantal pagina\'s'], ['&[Datum]', 'Datum'], ['&[Tijd]', 'Tijd'], ['&[Bestand]', 'Bestandsnaam'], ['&[Blad]', 'Bladnaam']];
    const hf = (k) => (p[k] || '').split('|');
    App.dialog({
      title: 'Pagina-instelling', wide: true,
      body: `<div class="fc-tabs"><button data-fct="page">Pagina</button><button data-fct="margins">Marges</button><button data-fct="hf">Koptekst/voettekst</button><button data-fct="sheet">Blad</button></div>
        <div class="fc-pane" data-fcp="page"><div class="fields-2">
          <label class="field"><span>Afdrukstand</span><select id="ps-or"><option value="portrait">Staand</option><option value="landscape">Liggend</option></select></label>
          <label class="field"><span>Papierformaat</span><select id="ps-size">${Object.keys(PAPER).map((k) => `<option>${k}</option>`).join('')}</select></label>
          <label class="field"><span>Schaal: aanpassen tot (%)</span><input type="number" id="ps-scale" min="10" max="400"></label>
          <label class="field"><span>Of passend maken: breedte</span><select id="ps-fit"><option value="0">Niet passend maken</option><option value="1">1 pagina breed</option><option value="2">2 pagina's breed</option><option value="3">3 pagina's breed</option></select></label></div>
          <label class="chk"><input type="checkbox" id="ps-center"> Horizontaal centreren op de pagina</label></div>
        <div class="fc-pane" data-fcp="margins"><div class="fields-4">
          ${[['t', 'Boven'], ['b', 'Onder'], ['l', 'Links'], ['r', 'Rechts']].map(([k, l]) => `<label class="field"><span>${l} (cm)</span><input id="ps-m${k}" value="${App.fmtNum(p.margins[k])}"></label>`).join('')}</div></div>
        <div class="fc-pane" data-fcp="hf">
          ${['header', 'footer'].map((k) => `<div class="small" style="margin:6px 0 4px;font-weight:600">${k === 'header' ? 'Koptekst' : 'Voettekst'}</div><div class="fields-3">${['Links', 'Midden', 'Rechts'].map((l, i) => `<label class="field"><span>${l}</span><input data-hf="${k}" data-i="${i}" value="${App.esc(hf(k)[i] || '')}"></label>`).join('')}</div>`).join('')}
          <div class="eq-tools">${codes.map(([c, l]) => `<button data-code="${App.esc(c)}" title="${l}">${l}</button>`).join('')}</div>
          <p class="muted small">Klik eerst in een vak en dan op een knop om een veld in te voegen. Velden worden bij het afdrukken ingevuld.</p></div>
        <div class="fc-pane" data-fcp="sheet">
          <label class="field"><span>Afdrukbereik (leeg = alles met gegevens)</span><input id="ps-area" value="${sh.printArea ? App.rangeStr(sh.printArea) : ''}" placeholder="bijv. A1:H40"></label>
          <label class="field"><span>Rijen bovenaan herhalen</span><input id="ps-titles" value="${sh.printTitles ? App.esc(sh.printTitles) : ''}" placeholder="bijv. 1:1"></label>
          <div class="checks"><label><input type="checkbox" id="ps-grid"> Rasterlijnen afdrukken</label><label><input type="checkbox" id="ps-heads"> Rij- en kolomkoppen afdrukken</label></div></div>`,
      onOpen: (d) => {
        const show = (k) => { d.$$('[data-fct]').forEach((b) => b.classList.toggle('on', b.dataset.fct === k)); d.$$('[data-fcp]').forEach((x) => { x.hidden = x.dataset.fcp !== k; }); };
        d.$('.fc-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-fct]'); if (b) show(b.dataset.fct); });
        show(typeof tab === 'string' ? tab : 'page');
        d.$('#ps-or').value = p.orient; d.$('#ps-size').value = p.size; d.$('#ps-scale').value = p.scale || 100; d.$('#ps-fit').value = String(p.fitW || 0);
        d.$('#ps-center').checked = !!p.center; d.$('#ps-grid').checked = !!p.grid; d.$('#ps-heads').checked = !!p.heads;
        let lastHf = null;
        d.body.addEventListener('focusin', (e) => { if (e.target.dataset && e.target.dataset.hf) lastHf = e.target; });
        d.body.addEventListener('mousedown', (e) => { if (e.target.closest('[data-code]')) e.preventDefault(); });
        d.body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-code]'); if (!b) return;
          const inp = lastHf || d.$('[data-hf="footer"][data-i="1"]');
          const pos = inp.selectionStart ?? inp.value.length;
          inp.value = inp.value.slice(0, pos) + b.dataset.code + inp.value.slice(pos);
          inp.focus();
        });
      },
      buttons: [{ label: 'Afdrukvoorbeeld', left: true, action: (d) => { apply(d); setTimeout(() => App.exec('printPreview'), 0); } }, { label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => apply(d) }],
    });
    const apply = (d) => {
      const area = d.$('#ps-area').value.trim();
      const g = area ? App.parseRange(area) : null;
      if (area && !g) { App.toast('Ongeldig afdrukbereik', 'error'); return false; }
      const titles = d.$('#ps-titles').value.trim().replace(/\$/g, '');
      App.run(() => {
        p.orient = d.$('#ps-or').value; p.size = d.$('#ps-size').value; p.scale = App.clamp(+d.$('#ps-scale').value || 100, 10, 400); p.fitW = +d.$('#ps-fit').value;
        p.center = d.$('#ps-center').checked; p.grid = d.$('#ps-grid').checked; p.heads = d.$('#ps-heads').checked;
        ['t', 'b', 'l', 'r'].forEach((k) => { const v = App.parseNum(d.$('#ps-m' + k).value); if (v >= 0 && v < 10) p.margins[k] = v; });
        ['header', 'footer'].forEach((k) => { p[k] = [0, 1, 2].map((i) => d.$(`[data-hf="${k}"][data-i="${i}"]`).value).join('|').replace(/^\|\|$/, ''); });
        sh.printArea = g;
        sh.printTitles = /^\d+(:\d+)?$/.test(titles) ? titles : null;
      }, { allowProtected: true });
      return true;
    };
  });

  /* ---------- Bereik en pagina-indeling ---------- */
  const printRange = (sh) => {
    if (sh.printArea) return sh.printArea;
    let g = App.usedRange(sh, true);
    sh.objs.forEach((o) => {
      const p = App.objXY(o, sh);
      const c2 = App.colAt(p.x + o.w, sh), r2 = App.rowAt(p.y + o.h, sh);
      g = g ? { r1: Math.min(g.r1, o.r), c1: Math.min(g.c1, o.c), r2: Math.max(g.r2, r2), c2: Math.max(g.c2, c2) } : { r1: o.r, c1: o.c, r2, c2 };
    });
    if (g) g = { r1: 0, c1: 0, r2: g.r2, c2: g.c2 };
    return g;
  };
  const pageBox = (sh) => {
    const p = sh.page;
    let [w, h] = PAPER[p.size] || PAPER.A4;
    if (p.orient === 'landscape') [w, h] = [h, w];
    const m = p.margins;
    const hfSpace = (p.header ? 0.7 : 0) + (p.footer ? 0.7 : 0);
    return { w, h, cw: (w - m.l - m.r) * CM, ch: (h - m.t - m.b - hfSpace) * CM };
  };
  const titleRows = (sh) => {
    if (!sh.printTitles) return null;
    const [a, b] = sh.printTitles.split(':').map((x) => +x - 1);
    return { r1: a, r2: isNaN(b) ? a : b };
  };
  const layoutPages = (sh) => {
    const g = printRange(sh);
    if (!g) return null;
    const box = pageBox(sh);
    const tr = titleRows(sh);
    const headW = sh.page.heads ? 34 : 0, headH = sh.page.heads ? 18 : 0;
    let totalW = headW; for (let c = g.c1; c <= g.c2; c++) totalW += App.colW(c, sh);
    let scale = (sh.page.scale || 100) / 100;
    if (sh.page.fitW) scale = Math.min(1, (box.cw * sh.page.fitW) / totalW);
    const pw = box.cw / scale, ph = box.ch / scale;
    const colBreaks = [g.c1];
    let acc = headW;
    for (let c = g.c1; c <= g.c2; c++) {
      const w = App.colW(c, sh);
      if (acc + w > pw && acc > headW) { colBreaks.push(c); acc = headW; }
      acc += w;
    }
    let titleH = 0; if (tr) for (let r = tr.r1; r <= tr.r2; r++) titleH += App.rowH(r, sh);
    const rowBreaks = [g.r1];
    acc = headH;
    for (let r = g.r1; r <= g.r2; r++) {
      const h = App.rowH(r, sh);
      const extra = tr && rowBreaks.length > 1 && r > tr.r2 ? titleH : 0;
      if (acc + h + extra > ph && acc > headH) { rowBreaks.push(r); acc = headH + (tr && r > tr.r2 ? titleH : 0); }
      acc += h;
    }
    return { g, colBreaks, rowBreaks, scale, box, tr };
  };
  App.pageBreaks = (sh) => {
    const L = layoutPages(sh);
    if (!L) return { rows: [], cols: [], area: null };
    return { rows: L.rowBreaks.slice(1), cols: L.colBreaks.slice(1), area: L.g };
  };

  /* ---------- HTML voor afdrukken ---------- */
  const BCSS = { thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', medium: '2px solid', mediumDashed: '2px dashed', thick: '3px solid', double: '3px double', dashDot: '1px dashed', mediumDashDot: '2px dashed' };
  const cellCss = (sh, r, c, cell) => {
    const st = App.styleAt(sh, r, c, cell);
    const v = cell ? App.valueOf(cell) : null;
    const css = [];
    css.push(`font-family:${st.font ? `'${st.font}',` : ''}'Aptos Narrow',Calibri,Carlito,sans-serif`);
    css.push(`font-size:${st.size || App.DEF_SIZE}pt`);
    if (st.b) css.push('font-weight:700'); if (st.i) css.push('font-style:italic');
    const deco = []; if (st.u || (cell && cell.l)) deco.push('underline'); if (st.s) deco.push('line-through');
    if (deco.length) css.push('text-decoration:' + deco.join(' ') + (st.u === 'double' ? ' double' : ''));
    const cf = App.cfPrepare ? App.cfPrepare(sh) : null;
    const cfs = cf && cf.any ? cf.at(r, c, v) : null;
    const fill = (cfs && cfs.fill) || st.fill;
    if (fill) css.push('background:' + fill);
    const f = cell && App.hasValue(cell) ? NF.format(v, st.nf) : null;
    const color = (cfs && cfs.color) || (f && f.color) || st.color || (cell && cell.l ? '#0563c1' : null);
    if (color) css.push('color:' + color);
    let ha = st.ha || (typeof v === 'number' ? 'right' : typeof v === 'boolean' || (v && v.err) ? 'center' : 'left');
    if (ha === 'centerContinuous') ha = 'center';
    css.push('text-align:' + (ha === 'fill' || ha === 'justify' ? 'left' : ha));
    css.push('vertical-align:' + ({ top: 'top', middle: 'middle', center: 'middle' }[st.va] || 'bottom'));
    if (st.wrap) css.push('white-space:pre-wrap;word-break:break-word'); else css.push('white-space:pre');
    if (st.ind) css.push(`padding-${ha === 'right' ? 'right' : 'left'}:${3 + st.ind * 9}px`);
    if (st.bd) Object.entries({ t: 'top', b: 'bottom', l: 'left', r: 'right' }).forEach(([k, side]) => { if (st.bd[k]) css.push(`border-${side}:${BCSS[st.bd[k][0]] || '1px solid'} ${st.bd[k][1] || '#000'}`); });
    return { css: css.join(';'), text: f ? f.text : '' };
  };
  const hfText = (t, ctx) => (t || '').replace(/&\[Pagina\]|&\[Page\]/g, ctx.page).replace(/&\[Pagina's\]|&\[Pages\]/g, ctx.pages).replace(/&\[Date\]/g, App.fmtDate(Date.now(), { day: 'numeric', month: 'numeric', year: 'numeric' })).replace(/&\[Time\]/g, new Date().toLocaleTimeString(App.LOCALE ? App.LOCALE.code : 'nl-NL', { hour: '2-digit', minute: '2-digit' })).replace(/&\[File\]/g, App.book.title).replace(/&\[Sheet\]/g, ctx.sheet).replace(/&\[Datum\]/g, App.fmtDate(Date.now(), { day: 'numeric', month: 'numeric', year: 'numeric' })).replace(/&\[Tijd\]/g, new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })).replace(/&\[Bestand\]/g, App.book.title).replace(/&\[Blad\]/g, ctx.sheet);
  const hfRow = (t, ctx, cls) => { if (!t) return ''; const [a = '', b = '', c = ''] = t.split('|'); return `<div class="pa-hf ${cls}"><span>${App.esc(hfText(a, ctx))}</span><span>${App.esc(hfText(b, ctx))}</span><span>${App.esc(hfText(c, ctx))}</span></div>`; };
  const buildSheetPages = (sh, pageOffset, totalPages) => {
    const L = layoutPages(sh);
    if (!L) return { html: '', count: 0 };
    const { g, colBreaks, rowBreaks, scale, tr } = L;
    const pages = [];
    // eerst omlaag, dan opzij (zoals Excel)
    for (let ci = 0; ci < colBreaks.length; ci++) for (let ri = 0; ri < rowBreaks.length; ri++) {
      pages.push({ c1: colBreaks[ci], c2: (colBreaks[ci + 1] ?? g.c2 + 1) - 1, r1: rowBreaks[ri], r2: (rowBreaks[ri + 1] ?? g.r2 + 1) - 1 });
    }
    let html = '';
    pages.forEach((pg, k) => {
      const ctx = { page: pageOffset + k + 1, pages: totalPages || '?', sheet: sh.name };
      const rows = [];
      if (tr && pg.r1 > tr.r2) for (let r = tr.r1; r <= tr.r2; r++) rows.push(r);
      for (let r = pg.r1; r <= pg.r2; r++) rows.push(r);
      const cols = []; for (let c = pg.c1; c <= pg.c2; c++) if (App.colW(c, sh) > 0) cols.push(c);
      let t = `<table style="width:${cols.reduce((a, c) => a + App.colW(c, sh), 0) + (sh.page.heads ? 34 : 0)}px">`;
      t += '<colgroup>' + (sh.page.heads ? '<col style="width:34px">' : '') + cols.map((c) => `<col style="width:${App.colW(c, sh)}px">`).join('') + '</colgroup>';
      if (sh.page.heads) t += '<tr style="height:18px"><th></th>' + cols.map((c) => `<th>${App.colName(c)}</th>`).join('') + '</tr>';
      const covered = new Set();
      rows.forEach((r) => {
        const h = App.rowH(r, sh);
        if (h <= 0) return;
        t += `<tr style="height:${h}px">` + (sh.page.heads ? `<th>${r + 1}</th>` : '');
        cols.forEach((c) => {
          const key = r * 16384 + c;
          if (covered.has(key)) return;
          const m = App.mergeAt(sh, r, c);
          let span = '';
          if (m && m.r1 === r && m.c1 === c) {
            const cs = cols.filter((x) => x >= m.c1 && x <= m.c2).length, rs = rows.filter((x) => x >= m.r1 && x <= m.r2 && App.rowH(x, sh) > 0).length;
            for (let a = m.r1; a <= m.r2; a++) for (let b = m.c1; b <= m.c2; b++) if (a !== r || b !== c) covered.add(a * 16384 + b);
            span = `${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}`;
          } else if (m) return;
          const cell = App.getCell(sh, r, c);
          const { css, text } = cellCss(sh, r, c, cell);
          t += `<td${span} style="${css}">${App.esc(text)}</td>`;
        });
        t += '</tr>';
      });
      t += '</table>';
      // objecten op deze pagina
      let objs = '';
      const x0 = App.colX(pg.c1, sh) - (sh.page.heads ? 34 : 0), y0 = App.rowY(pg.r1, sh) - (sh.page.heads ? 18 : 0);
      const x1 = App.colX(pg.c2 + 1, sh), y1 = App.rowY(pg.r2 + 1, sh);
      sh.objs.forEach((o) => {
        const p = App.objXY(o, sh);
        if (p.x >= x1 || p.y >= y1 || p.x + o.w <= x0 + (sh.page.heads ? 34 : 0) || p.y + o.h <= y0 + (sh.page.heads ? 18 : 0)) return;
        if (p.x < App.colX(pg.c1, sh) - 1 || p.y < App.rowY(pg.r1, sh) - 1) return;
        const inner = o.type === 'chart' ? App.chartSvg(o, o.w, o.h, sh) : o.type === 'image' ? `<img src="${App.esc(App.media[o.media] || o.media || '')}">` : o.type === 'shape' ? App.shapeSvg(o) : `<div style="border:1px solid #888;padding:6px 8px;height:100%;box-sizing:border-box;white-space:pre-wrap;font:11pt Calibri,sans-serif">${App.esc(o.text || '')}</div>`;
        objs += `<div class="pa-obj" style="left:${p.x - x0}px;top:${p.y - y0 + (tr && pg.r1 > tr.r2 ? (() => { let s = 0; for (let r = tr.r1; r <= tr.r2; r++) s += App.rowH(r, sh); return s; })() : 0)}px;width:${o.w}px;height:${o.h}px">${inner}</div>`;
      });
      html += `<div class="pa-page">${hfRow(sh.page.header, ctx, 'head')}<div style="zoom:${scale};position:relative;${sh.page.center ? 'margin:0 auto;width:max-content' : ''}">${t}${objs}</div>${hfRow(sh.page.footer, ctx, 'foot')}</div>`;
    });
    return { html, count: pages.length };
  };
  const pageStyle = (sh) => {
    const p = sh.page;
    let st = $('#print-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
    st.textContent = `@page { size: ${p.size} ${p.orient}; margin: ${p.margins.t}cm ${p.margins.r}cm ${p.margins.b}cm ${p.margins.l}cm; }`;
  };
  App.buildPrint = (which = 'sheet') => {
    const sheets = which === 'book' ? App.book.sheets.filter((s) => !s.hidden) : [App.sh()];
    let total = 0;
    sheets.forEach((s) => { total += buildSheetPages(s, 0, 0).count; });
    let html = '', off = 0;
    sheets.forEach((s) => { const r = buildSheetPages(s, off, total); html += r.html; off += r.count; });
    const pa = $('#print-area');
    pa.className = App.sh().page.grid ? 'grid' : '';
    pa.innerHTML = html || '<p style="font-family:sans-serif">Er is niets om af te drukken.</p>';
    pageStyle(App.sh());
    return { html, total };
  };
  App.def('print', (which) => {
    if (App.state.editing) App.commitEdit();
    if ($('#backstage')) App.closeBackstage();
    App.buildPrint(which === 'book' ? 'book' : 'sheet');
    setTimeout(() => window.print(), 120);
  });
  window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });
  App.def('printPreview', (which) => {
    const { html, total } = App.buildPrint(which === 'book' ? 'book' : 'sheet');
    const sh = App.sh();
    const box = pageBox(sh);
    const k = 0.62;
    const pages = html ? html.replace(/<div class="pa-page">/g, `<div class="pa-page pv" style="width:${box.w * CM}px;min-height:${box.h * CM}px;padding:${sh.page.margins.t * CM}px ${sh.page.margins.r * CM}px ${sh.page.margins.b * CM}px ${sh.page.margins.l * CM}px">`) : '<p>Er is niets om af te drukken.</p>';
    App.dialog({
      title: `Afdrukvoorbeeld — ${total} pagina${total === 1 ? '' : "'s"}`, xwide: true,
      body: `<style>.pv-wrap{background:#e6e6e6;max-height:68vh;overflow:auto;padding:16px}.pv-zoom{zoom:${k}}.pa-page.pv{background:#fff;color:#000;box-shadow:0 1px 4px rgba(0,0,0,.25);margin:0 auto 24px;box-sizing:border-box;position:relative;overflow:hidden}
        .pa-page.pv table{border-collapse:collapse;table-layout:fixed}.pa-page.pv td,.pa-page.pv th{overflow:hidden;padding:0 3px;vertical-align:bottom;white-space:nowrap}.pv-grid td{border:1px solid #d4d4d4}.pa-page.pv th{background:#eee;border:1px solid #bbb;font:9pt Calibri,sans-serif;color:#333}
        .pa-page.pv .pa-hf{display:flex;justify-content:space-between;font:9pt Calibri,sans-serif;color:#333;margin-bottom:6pt}.pa-page.pv .pa-hf.foot{position:absolute;left:${sh.page.margins.l * CM}px;right:${sh.page.margins.r * CM}px;bottom:${sh.page.margins.b * CM * 0.5}px}.pa-page.pv .pa-obj{position:absolute}.pa-page.pv .pa-obj svg,.pa-page.pv .pa-obj img{width:100%;height:100%}</style>
        <div class="pv-wrap"><div class="pv-zoom ${sh.page.grid ? 'pv-grid' : ''}">${pages}</div></div>`,
      buttons: [{ label: 'Pagina-instelling…', left: true, action: () => { setTimeout(() => App.exec('pageSetup'), 0); } }, { label: 'Sluiten' }, { label: 'Afdrukken', primary: true, action: () => { setTimeout(() => App.exec('print', which), 50); } }],
      onClose: () => { if (!document.querySelector('.backdrop')) $('#print-area').innerHTML = ''; },
    });
  });
})();
