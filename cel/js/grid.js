/* =========================================================
   Cel (gemaakt door JJ van Schelven) — raster: afmetingen, tekenen (canvas), muis, schuiven,
   bladtabs en statusbalk
   ========================================================= */
'use strict';

(() => {
  const wrap = $('#grid-wrap');
  const canvas = $('#grid-canvas');
  const scroller = $('#grid-scroll');
  const spacer = $('#grid-spacer');
  const ctx = canvas.getContext('2d');
  App.gridEl = scroller;

  /* ---------- Afmetingen van rijen en kolommen ---------- */
  const buildAxis = (def, sizes, hidden, hidden2) => {
    const keys = new Set();
    Object.keys(sizes).forEach((k) => keys.add(+k));
    Object.keys(hidden).forEach((k) => { if (hidden[k]) keys.add(+k); });
    if (hidden2) Object.keys(hidden2).forEach((k) => { if (hidden2[k]) keys.add(+k); });
    const ks = Array.from(keys).sort((a, b) => a - b);
    const cum = new Float64Array(ks.length + 1);
    ks.forEach((k, i) => {
      const hid = hidden[k] || (hidden2 && hidden2[k]);
      const sz = hid ? 0 : (sizes[k] ?? def);
      cum[i + 1] = cum[i] + (sz - def);
    });
    return { def, ks, cum, sizes, hidden, hidden2 };
  };
  const lowerBound = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; };
  const axisPos = (ax, i) => i * ax.def + ax.cum[lowerBound(ax.ks, i)];
  const axisSize = (ax, i) => ((ax.hidden[i] || (ax.hidden2 && ax.hidden2[i])) ? 0 : (ax.sizes[i] ?? ax.def));
  const axisAt = (ax, pos, max) => {
    if (pos <= 0) return 0;
    let lo = 0, hi = max - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (axisPos(ax, m) <= pos) lo = m; else hi = m - 1;
    }
    // verborgen (hoogte 0) overslaan
    while (lo < max - 1 && axisSize(ax, lo) === 0) lo++;
    return lo;
  };
  const dims = (sh) => {
    if (!sh._dims) sh._dims = { rows: buildAxis(sh.defH, sh.rowH, sh.hidR, sh.fhid), cols: buildAxis(sh.defW, sh.colW, sh.hidC) };
    return sh._dims;
  };
  App.invalidateDims = (sh) => { if (sh) sh._dims = null; else App.book.sheets.forEach((s) => { s._dims = null; }); };
  App.colX = (c, sh = App.sh()) => axisPos(dims(sh).cols, c);
  App.rowY = (r, sh = App.sh()) => axisPos(dims(sh).rows, r);
  App.colW = (c, sh = App.sh()) => axisSize(dims(sh).cols, c);
  App.rowH = (r, sh = App.sh()) => axisSize(dims(sh).rows, r);
  App.colAt = (x, sh = App.sh()) => axisAt(dims(sh).cols, x, App.MAXC);
  App.rowAt = (y, sh = App.sh()) => axisAt(dims(sh).rows, y, App.MAXR);
  App.rowHidden = (r, sh = App.sh()) => !!(sh.hidR[r] || sh.fhid[r]);
  App.colHidden = (c, sh = App.sh()) => !!sh.hidC[c];

  /* ---------- Weergave-geometrie ---------- */
  const V = App.view = { z: 1, HW: 40, HH: 20, W: 0, H: 0, sx: 0, sy: 0, FW: 0, FH: 0, fr: 0, fc: 0 };
  const dpr = () => window.devicePixelRatio || 1;
  const computeView = () => {
    const sh = App.sh();
    V.z = sh.zoom || 1;
    V.W = scroller.clientWidth / V.z;
    V.H = scroller.clientHeight / V.z;
    V.sx = scroller.scrollLeft / V.z;
    V.sy = scroller.scrollTop / V.z;
    V.fr = sh.freeze.r || 0; V.fc = sh.freeze.c || 0;
    V.FW = App.colX(V.fc); V.FH = App.rowY(V.fr);
    V.HH = sh.heads ? 20 : 0;
    const lastRow = App.rowAt(V.sy + App.rowY(V.fr) + V.H) + 1;
    V.HW = sh.heads ? Math.max(30, 10 + String(lastRow).length * 7.5) : 0;
  };
  App.computeView = computeView;
  /* Schermpositie (zonder zoom) van kolom / rij */
  const scrX = (c) => (c < V.fc ? V.HW + App.colX(c) : V.HW + V.FW + App.colX(c) - App.colX(V.fc) - V.sx);
  const scrY = (r) => (r < V.fr ? V.HH + App.rowY(r) : V.HH + V.FH + App.rowY(r) - App.rowY(V.fr) - V.sy);
  App.scrX = scrX; App.scrY = scrY;
  const colFromX = (x) => {
    if (x < V.HW) return -1;
    if (x < V.HW + V.FW) return App.colAt(x - V.HW);
    return App.colAt(x - V.HW - V.FW + App.colX(V.fc) + V.sx);
  };
  const rowFromY = (y) => {
    if (y < V.HH) return -1;
    if (y < V.HH + V.FH) return App.rowAt(y - V.HH);
    return App.rowAt(y - V.HH - V.FH + App.rowY(V.fr) + V.sy);
  };
  App.colFromX = colFromX; App.rowFromY = rowFromY;
  /* Rechthoek van een cel (of samengevoegd gebied) op het scherm, in px zonder zoom */
  App.cellRect = (r, c, sh = App.sh()) => {
    const m = App.mergeAt(sh, r, c);
    const g = m || { r1: r, c1: c, r2: r, c2: c };
    const x = scrX(g.c1), y = scrY(g.r1);
    return { x, y, w: App.colX(g.c2 + 1) - App.colX(g.c1), h: App.rowY(g.r2 + 1) - App.rowY(g.r1), g };
  };
  /* Rechthoek van een bereik in schermcoördinaten (pixels, met zoom) relatief aan het raster */
  App.rangeScreenRect = (g) => {
    const x1 = scrX(g.c1), y1 = scrY(g.r1);
    const x2 = scrX(g.c2) + App.colW(g.c2), y2 = scrY(g.r2) + App.rowH(g.r2);
    return { x: x1 * V.z, y: y1 * V.z, w: (x2 - x1) * V.z, h: (y2 - y1) * V.z };
  };

  /* Schuifbereik: groeit mee met de gegevens en met schuiven */
  const updateSpacer = () => {
    const sh = App.sh();
    if (!sh._max) { const e = App.extent(sh); sh._max = { r: Math.max(e.r + 60, 200), c: Math.max(e.c + 20, 50) }; }
    const w = (V.HW + V.FW + App.colX(sh._max.c) - App.colX(V.fc)) * V.z;
    const h = (V.HH + V.FH + App.rowY(sh._max.r) - App.rowY(V.fr)) * V.z;
    spacer.style.width = Math.max(w, scroller.clientWidth + 10) + 'px';
    spacer.style.height = Math.max(h, scroller.clientHeight + 10) + 'px';
  };
  App.updateSpacer = updateSpacer;
  App.growTo = (r, c) => {
    const sh = App.sh();
    if (!sh._max) updateSpacer();
    let grew = false;
    if (r + 40 > sh._max.r) { sh._max.r = Math.min(App.MAXR, r + 200); grew = true; }
    if (c + 10 > sh._max.c) { sh._max.c = Math.min(App.MAXC, c + 40); grew = true; }
    if (grew) updateSpacer();
  };
  scroller.addEventListener('scroll', () => {
    const sh = App.sh();
    sh.scroll = { x: scroller.scrollLeft, y: scroller.scrollTop };
    computeView();
    const bottomRow = App.rowAt(V.sy + V.FH + App.rowY(V.fr) + V.H);
    const rightCol = App.colAt(V.sx + V.FW + App.colX(V.fc) + V.W);
    App.growTo(bottomRow, rightCol);
    App.render();
    App.positionEditor && App.positionEditor();
    App.emit('render');
  }, { passive: true });

  /* Zichtbaar maken */
  App.scrollToCell = (r, c) => {
    computeView();
    App.growTo(r, c);
    let sl = scroller.scrollLeft, st = scroller.scrollTop;
    if (c >= V.fc) {
      const x = App.colX(c) - App.colX(V.fc), w = App.colW(c);
      const viewW = V.W - V.HW - V.FW;
      if (x < V.sx) sl = x * V.z;
      else if (x + w > V.sx + viewW) sl = Math.max(0, (x + w - viewW)) * V.z;
    }
    if (r >= V.fr) {
      const y = App.rowY(r) - App.rowY(V.fr), h = App.rowH(r);
      const viewH = V.H - V.HH - V.FH;
      if (y < V.sy) st = y * V.z;
      else if (y + h > V.sy + viewH) st = Math.max(0, (y + h - viewH)) * V.z;
    }
    if (sl !== scroller.scrollLeft) scroller.scrollLeft = sl;
    if (st !== scroller.scrollTop) scroller.scrollTop = st;
  };

  /* ---------- Tekenen ---------- */
  const FONT_FALLBACK = '"Aptos Narrow", Calibri, Carlito, "Segoe UI", sans-serif';
  const fontOf = (st) => `${st.i ? 'italic ' : ''}${st.b ? 'bold ' : ''}${(st.size || App.DEF_SIZE) * 96 / 72}px ${st.font ? '"' + st.font + '", ' : ''}${FONT_FALLBACK}`;
  App.fontOf = fontOf;
  const measureCache = new Map();
  const measure = (font, text) => {
    const k = font + '\u0001' + text;
    let w = measureCache.get(k);
    if (w === undefined) {
      ctx.font = font; w = ctx.measureText(text).width;
      if (measureCache.size > 20000) measureCache.clear();
      measureCache.set(k, w);
    }
    return w;
  };
  App.measureText = measure;
  const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  let colors = null;
  const loadColors = () => {
    colors = {
      grid: css('--grid-line') || '#e1e1e1', headBg: css('--head-bg'), headText: css('--head-text'), headSel: css('--head-sel'), headSelText: css('--head-sel-text'),
      selFill: css('--sel-fill'), selLine: css('--sel-line'), line: css('--line'), lineStrong: css('--line-strong'), panel: css('--panel'),
    };
  };
  App.on('render', () => {});

  /* Tekst die in een cel getoond wordt */
  App.displayOf = (sh, r, c, cell, st) => {
    if (!cell) return null;
    const v = App.valueOf(cell);
    if (App.state.showFormulas && cell.f) return { text: '=' + App.F.toLocal(cell.f), kind: 'str' };
    if (v === null || v === undefined || v === '') return null;
    const f = App.NF.format(v, st.nf);
    const kind = typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : (typeof v === 'object' && v.err) ? 'err' : 'str';
    return { text: f.text, color: f.color, kind, general: f.general, v };
  };

  const BORDER_W = { thin: 1, hair: 1, dotted: 1, dashed: 1, medium: 2, mediumDashed: 2, thick: 3, double: 3, dashDot: 1, mediumDashDot: 2 };
  const drawBorderLine = (x1, y1, x2, y2, spec) => {
    const [style, color] = spec;
    ctx.strokeStyle = color || '#000';
    const w = BORDER_W[style] || 1;
    ctx.setLineDash(style === 'dotted' || style === 'hair' ? [1, 2] : /dashed|dash/i.test(style) ? [4, 2] : []);
    if (style === 'double') {
      ctx.lineWidth = 1;
      const horiz = y1 === y2;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(x1, y1 - 1); ctx.lineTo(x2, y2 - 1); ctx.moveTo(x1, y1 + 1); ctx.lineTo(x2, y2 + 1); }
      else { ctx.moveTo(x1 - 1, y1); ctx.lineTo(x2 - 1, y2); ctx.moveTo(x1 + 1, y1); ctx.lineTo(x2 + 1, y2); }
      ctx.stroke();
    } else {
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  /* Eén deelvenster tekenen (bevroren of schuivend) */
  const drawPane = (sh, r1, r2, c1, c2, clip) => {
    if (r2 < r1 || c2 < c1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(clip.x, clip.y, clip.w, clip.h);
    const cf = App.cfPrepare ? App.cfPrepare(sh) : null;
    const rows = [], cols = [];
    for (let r = r1; r <= r2; r++) if (App.rowH(r) > 0) rows.push(r);
    for (let c = c1; c <= c2; c++) if (App.colW(c) > 0) cols.push(c);
    const xs = new Map(), ys = new Map();
    cols.forEach((c) => xs.set(c, scrX(c)));
    rows.forEach((r) => ys.set(r, scrY(r)));
    const mergedSeen = new Set();
    const merges = sh.merges.filter((m) => m.r2 >= r1 && m.r1 <= r2 && m.c2 >= c1 && m.c1 <= c2);
    const inMerge = (r, c) => merges.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);
    const texts = [];
    const borders = [];
    const fills = [];
    // 1. opvulling en verzamelen
    const spills = sh._spill && sh._spill.size;
    for (const r of rows) {
      const row = sh.data.get(r);
      const y = ys.get(r), h = App.rowH(r);
      for (const c of cols) {
        let cell = row ? row.get(c) : undefined;
        // overgelopen waarde van een matrixformule
        if (spills && App.F.isEmptyCell(cell)) {
          const sv = sh._spill.get(r * 16384 + c);
          if (sv && (sv.r !== r || sv.c !== c)) {
            const anchor = App.getCell(sh, sv.r, sv.c);
            const v = anchor && anchor.sp ? (anchor.sp.vals[r - sv.r] || [])[c - sv.c] : undefined;
            if (v !== undefined) cell = Object.assign({}, cell || {}, { v, _virt: true });
          }
        }
        const hasColRow = sh.colS[c] || sh.rowS[r];
        if (!cell && !hasColRow && !(cf && cf.any)) continue;
        const m = merges.length ? inMerge(r, c) : null;
        if (m && (m.r1 !== r || m.c1 !== c)) {
          if (mergedSeen.has(m)) continue;
          // anker buiten beeld: toch het hele gebied tekenen vanaf het anker
          if ((m.r1 >= r1 && m.c1 >= c1) && (m.r1 !== r || m.c1 !== c)) continue;
        }
        const ar = m ? m.r1 : r, ac = m ? m.c1 : c;
        if (m) mergedSeen.add(m);
        const acell = m ? App.getCell(sh, ar, ac) : cell;
        const st = App.styleAt(sh, ar, ac, acell);
        const x = m ? scrX(m.c1) : xs.get(c), yy = m ? scrY(m.r1) : y;
        const w = m ? App.colX(m.c2 + 1, sh) - App.colX(m.c1, sh) : App.colW(c);
        const hh = m ? App.rowY(m.r2 + 1, sh) - App.rowY(m.r1, sh) : h;
        const v = acell ? App.valueOf(acell) : null;
        const cfs = cf && cf.any ? cf.at(ar, ac, v) : null;
        const fill = (cfs && cfs.fill) || st.fill;
        if (fill || m) fills.push({ x, y: yy, w, h: hh, fill: fill || '#ffffff', m: !!m });
        if (cfs && cfs.bar) fills.push({ x: x + 2, y: yy + 2, w: Math.max(0, (w - 4) * cfs.bar.pct), h: hh - 4, fill: cfs.bar.color, bar: true });
        if (st.bd) borders.push({ x, y: yy, w, h: hh, bd: st.bd });
        if (acell && (App.hasValue(acell))) texts.push({ r: ar, c: ac, x, y: yy, w, h: hh, cell: acell, st, cfs, m });
        if (acell && acell.n) texts.push({ note: true, x, y: yy, w });
      }
    }
    // opvullingen zonder samenvoeging eerst, rasterlijnen, dan samengevoegde gebieden erover
    fills.filter((f) => !f.m && !f.bar).forEach((f) => { ctx.fillStyle = f.fill; ctx.fillRect(f.x, f.y, f.w, f.h); });
    // 2. rasterlijnen
    if (sh.grid) {
      ctx.strokeStyle = '#e1e1e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const yTop = ys.get(rows[0]) ?? clip.y, yBot = rows.length ? ys.get(rows[rows.length - 1]) + App.rowH(rows[rows.length - 1]) : clip.y + clip.h;
      const xL = xs.get(cols[0]) ?? clip.x, xR = cols.length ? xs.get(cols[cols.length - 1]) + App.colW(cols[cols.length - 1]) : clip.x + clip.w;
      for (const c of cols) { const x = Math.round(xs.get(c) + App.colW(c)) - 0.5; ctx.moveTo(x, yTop); ctx.lineTo(x, Math.min(yBot, clip.y + clip.h)); }
      for (const r of rows) { const y = Math.round(ys.get(r) + App.rowH(r)) - 0.5; ctx.moveTo(xL, y); ctx.lineTo(Math.min(xR, clip.x + clip.w), y); }
      ctx.stroke();
      // cellen met opvulling: rasterlijn verbergen zoals in Excel
      fills.filter((f) => !f.m && !f.bar && f.fill !== '#ffffff').forEach((f) => { ctx.fillStyle = f.fill; ctx.fillRect(f.x, f.y, f.w - 1, f.h - 1); });
    }
    fills.filter((f) => f.m).forEach((f) => { ctx.fillStyle = f.fill; ctx.fillRect(f.x, f.y, f.w - 1, f.h - 1); if (sh.grid && false) ctx.strokeRect(f.x, f.y, f.w, f.h); });
    fills.filter((f) => f.bar).forEach((f) => {
      const g = ctx.createLinearGradient(f.x, 0, f.x + Math.max(1, f.w), 0);
      g.addColorStop(0, f.fill); g.addColorStop(1, App.mix(f.fill, 0.75));
      ctx.fillStyle = g; ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeStyle = f.fill; ctx.lineWidth = 1; ctx.strokeRect(f.x + 0.5, f.y + 0.5, Math.max(0, f.w - 1), f.h - 1);
    });
    // 3. tekst
    for (const t of texts) {
      if (t.note) {
        ctx.fillStyle = '#d13438';
        ctx.beginPath(); ctx.moveTo(t.x + t.w - 6, t.y); ctx.lineTo(t.x + t.w - 1, t.y); ctx.lineTo(t.x + t.w - 1, t.y + 5); ctx.closePath(); ctx.fill();
        continue;
      }
      drawText(sh, t, xs, cols, clip);
      if (t.cfs && t.cfs.icon) drawIcon(t.cfs.icon, t.x + 3, t.y + t.h / 2);
    }
    // sparklines
    (sh.sparks || []).forEach((sp) => {
      if (!xs.has(sp.c) || !ys.has(sp.r)) return;
      drawSpark(sh, sp, xs.get(sp.c), ys.get(sp.r), App.colW(sp.c), App.rowH(sp.r));
    });
    // 4. randen
    for (const b of borders) {
      const { x, y, w, h, bd } = b;
      const X1 = Math.round(x) - 0.5, Y1 = Math.round(y) - 0.5, X2 = Math.round(x + w) - 0.5, Y2 = Math.round(y + h) - 0.5;
      if (bd.t) drawBorderLine(X1 - 0.5, Y1, X2 + 0.5, Y1, bd.t);
      if (bd.b) drawBorderLine(X1 - 0.5, Y2, X2 + 0.5, Y2, bd.b);
      if (bd.l) drawBorderLine(X1, Y1 - 0.5, X1, Y2 + 0.5, bd.l);
      if (bd.r) drawBorderLine(X2, Y1 - 0.5, X2, Y2 + 0.5, bd.r);
      if (bd.d) drawBorderLine(X1, Y1, X2, Y2, bd.d);
      if (bd.u) drawBorderLine(X1, Y2, X2, Y1, bd.u);
    }
    // 5. filterknoppen
    const flt = sh.filter;
    if (flt && flt.r >= r1 && flt.r <= r2) {
      for (let c = Math.max(flt.c1, c1); c <= Math.min(flt.c2, c2); c++) {
        if (!xs.has(c)) continue;
        const x = xs.get(c) + App.colW(c) - 17, y = ys.get(flt.r) + App.rowH(flt.r) - 17;
        const active = flt.crit && flt.crit[c];
        ctx.fillStyle = '#f3f3f3'; ctx.fillRect(x, y, 15, 15);
        ctx.strokeStyle = '#a0a0a0'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 14, 14);
        ctx.fillStyle = '#444';
        if (active) {
          ctx.beginPath(); ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 12, y + 4); ctx.lineTo(x + 8.5, y + 8); ctx.lineTo(x + 8.5, y + 12); ctx.lineTo(x + 6.5, y + 11); ctx.lineTo(x + 6.5, y + 8); ctx.closePath(); ctx.fill();
        } else {
          ctx.beginPath(); ctx.moveTo(x + 4, y + 6); ctx.lineTo(x + 11, y + 6); ctx.lineTo(x + 7.5, y + 10); ctx.closePath(); ctx.fill();
        }
        if (flt.sort && flt.sort.c === c) {
          ctx.fillStyle = '#107c41'; ctx.fillRect(x - 3, y + 2, 2, 11);
        }
      }
    }
    ctx.restore();
  };

  /* Pictogramsets (voorwaardelijke opmaak) */
  const drawIcon = (ic, x, cy) => {
    const s = 12, y = cy - s / 2;
    const col = ['#21a366', '#f2b800', '#d13438'][ic.idx] || '#888';
    ctx.save();
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    if (ic.set === 'arrows') {
      ctx.translate(x + s / 2, cy); ctx.rotate([-Math.PI / 2, 0, Math.PI / 2][ic.idx] || 0);
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(1, -4); ctx.lineTo(1, 4); ctx.closePath(); ctx.fill();
    } else if (ic.set === 'traffic') {
      ctx.beginPath(); ctx.arc(x + s / 2, cy, s / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
    } else if (ic.set === 'symbols') {
      ctx.beginPath(); ctx.arc(x + s / 2, cy, s / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.beginPath();
      if (ic.idx === 0) { ctx.moveTo(x + 3, cy); ctx.lineTo(x + 5.5, cy + 2.5); ctx.lineTo(x + 9.5, cy - 3); }
      else if (ic.idx === 1) { ctx.moveTo(x + 6, cy - 3.5); ctx.lineTo(x + 6, cy + 1); ctx.moveTo(x + 6, cy + 2.5); ctx.lineTo(x + 6, cy + 3.5); }
      else { ctx.moveTo(x + 3.5, cy - 2.5); ctx.lineTo(x + 8.5, cy + 2.5); ctx.moveTo(x + 8.5, cy - 2.5); ctx.lineTo(x + 3.5, cy + 2.5); }
      ctx.stroke();
    } else if (ic.set === 'flags') {
      ctx.fillRect(x + 2, y, 1.5, s);
      ctx.beginPath(); ctx.moveTo(x + 3.5, y); ctx.lineTo(x + 11, y + 3); ctx.lineTo(x + 3.5, y + 6); ctx.closePath(); ctx.fill();
    } else if (ic.set === 'stars') {
      const fill = [1, 0.5, 0][ic.idx];
      ctx.fillStyle = '#f2b800'; ctx.strokeStyle = '#d19c00'; ctx.lineWidth = 1;
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.6 : 6; pts.push([x + 6 + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
      if (fill) { ctx.save(); ctx.clip(); ctx.fillRect(x, y, 12 * fill, s); ctx.restore(); }
      ctx.stroke();
    }
    ctx.restore();
  };
  /* Sparklines: kleine grafiek in één cel */
  const drawSpark = (sh, sp, x, y, w, h) => {
    const g = App.parseRange(sp.src.replace(/^.*!/, ''));
    const dsh = /!/.test(sp.src) ? App.sheetByName(sp.src.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'")) || sh : sh;
    if (!g) return;
    const vals = [];
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const v = App.F.cellValue(dsh, r, c); vals.push(typeof v === 'number' ? v : null); }
    const nums = vals.filter((v) => v !== null);
    if (!nums.length) return;
    const pad = 3;
    const min = Math.min(0, ...nums), max = Math.max(...nums, sp.type === 'line' ? Math.min(...nums) + 1e-9 : 0);
    const lo = sp.type === 'line' ? Math.min(...nums) : min, hi = max === lo ? lo + 1 : max;
    const X = (i) => x + pad + (vals.length === 1 ? (w - 2 * pad) / 2 : i * (w - 2 * pad) / (vals.length - 1));
    const Y = (v) => y + h - pad - (v - lo) / (hi - lo) * (h - 2 * pad);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const color = sp.color || '#156082';
    if (sp.type === 'line') {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      let started = false;
      vals.forEach((v, i) => { if (v === null) { started = false; return; } if (!started) { ctx.moveTo(X(i), Y(v)); started = true; } else ctx.lineTo(X(i), Y(v)); });
      ctx.stroke();
      const iMax = vals.indexOf(Math.max(...nums)), iMin = vals.indexOf(Math.min(...nums));
      if (sp.markers) { ctx.fillStyle = '#d13438'; [iMax, iMin].forEach((i) => { ctx.beginPath(); ctx.arc(X(i), Y(vals[i]), 2, 0, Math.PI * 2); ctx.fill(); }); }
    } else {
      const bw = Math.max(1, (w - 2 * pad) / vals.length - 1.5);
      const step = (w - 2 * pad) / vals.length;
      vals.forEach((v, i) => {
        if (v === null) return;
        const bx = x + pad + i * step;
        if (sp.type === 'winloss') { ctx.fillStyle = v >= 0 ? color : '#d13438'; const mid = y + h / 2; ctx.fillRect(bx, v >= 0 ? mid - (h / 2 - pad) : mid, bw, h / 2 - pad); }
        else { ctx.fillStyle = v < 0 ? '#d13438' : color; const y0 = Y(Math.max(lo, 0)), y1 = Y(v); ctx.fillRect(bx, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0))); }
      });
    }
    ctx.restore();
  };
  App.drawSparkPreview = drawSpark;

  const drawText = (sh, t, xs, cols, clip) => {
    const { cell, st, cfs } = t;
    const disp = App.displayOf(sh, t.r, t.c, cell, st);
    if (!disp) return;
    let text = disp.text;
    const font = fontOf(cfs ? { ...st, b: cfs.b ?? st.b, i: cfs.i ?? st.i } : st);
    const size = (st.size || App.DEF_SIZE) * 96 / 72;
    let color = (cfs && cfs.color) || disp.color || st.color || (cell.l && !st.color ? '#0563c1' : '#000000');
    if (disp.kind === 'err') color = st.color || '#000000';
    let ha = st.ha || (disp.kind === 'num' ? 'right' : disp.kind === 'bool' || disp.kind === 'err' ? 'center' : 'left');
    if (App.state.showFormulas && cell.f) ha = 'left';
    if (ha === 'general') ha = disp.kind === 'num' ? 'right' : 'left';
    const va = st.va || 'bottom';
    const pad = 2;
    const indent = (st.ind || 0) * 9;
    ctx.font = font;
    ctx.fillStyle = color;
    let x = t.x, w = t.w;
    const avail = w - pad * 2 - indent;
    const rot = st.rot || 0;
    // getallen die niet passen
    if (disp.kind === 'num' && !App.state.showFormulas && !st.wrap && !rot) {
      let tw = measure(font, text);
      // getallen mogen (zoals in Excel) bijna de hele celbreedte gebruiken
      const numAvail = w - 3 - indent;
      if (tw > numAvail) {
        if (disp.general) {
          let p = 10;
          while (p > 1 && tw > numAvail) { text = App.NF.general(+disp.v.toPrecision(p)); if (text.length > p + 3) text = (+disp.v).toExponential(Math.max(0, p - 5)).replace('.', ',').replace(/e\+?(-?)(\d+)/, (m0, s, d) => 'E' + (s || '+') + d.padStart(2, '0')); tw = measure(font, text); p--; }
          if (tw > numAvail) text = '#'.repeat(Math.max(1, Math.floor(numAvail / measure(font, '#'))));
        } else text = '#'.repeat(Math.max(1, Math.floor(numAvail / measure(font, '#'))));
      }
    }
    const lines = st.wrap ? wrapLines(font, text, Math.max(10, avail)) : text.split('\n');
    const lh = size * 1.22;
    const blockH = lines.length * lh;
    let y0;
    if (va === 'top') y0 = t.y + 2;
    else if (va === 'middle' || va === 'center') y0 = t.y + (t.h - blockH) / 2;
    else y0 = t.y + t.h - blockH - 1;
    // tekstoverloop naar lege buurcellen
    let clipX = t.x, clipW = t.w;
    if (!st.wrap && !t.m && !rot && (disp.kind === 'str' || (App.state.showFormulas && cell.f)) && lines.length === 1) {
      const tw = measure(font, lines[0]);
      if (tw > avail) {
        const row = sh.data.get(t.r);
        const free = (c) => { const n = row && row.get(c); return !(n && App.hasValue(n)) && !App.mergeAt(sh, t.r, c); };
        if (ha === 'left' || ha === 'center') {
          let c = t.c + 1, right = t.x + t.w;
          const need = ha === 'center' ? t.x + t.w / 2 + tw / 2 + pad : t.x + pad + indent + tw + pad;
          while (right < need && c < App.MAXC && free(c) && right < clip.x + clip.w + 400) { right += App.colW(c); c++; }
          clipW = right - clipX;
        }
        if (ha === 'right' || ha === 'center') {
          let c = t.c - 1, left = t.x;
          const need = ha === 'center' ? t.x + t.w / 2 - tw / 2 - pad : t.x + t.w - pad - tw - pad;
          while (left > need && c >= 0 && free(c) && left > clip.x - 400) { left -= App.colW(c); c--; }
          clipW += clipX - left; clipX = left;
        }
        if (clipW > t.w) {
          // achtergrond over de rasterlijnen onder de overlopende tekst
          ctx.fillStyle = st.fill || '#ffffff';
          ctx.fillRect(clipX + 1, t.y, clipW - 2, t.h - 1);
          if (st.fill) { ctx.fillStyle = '#ffffff'; ctx.fillRect(clipX + 1, t.y, t.x - clipX, t.h - 1); ctx.fillRect(t.x + t.w, t.y, clipX + clipW - t.x - t.w - 1, t.h - 1); }
          ctx.fillStyle = color;
        }
      }
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(clipX + 1, t.y + 1, clipW - 2, t.h - 2); ctx.clip();
    ctx.textBaseline = 'top';
    if (rot) {
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      ctx.translate(cx, cy); ctx.rotate(-rot * Math.PI / 180);
      ctx.textAlign = 'center';
      lines.forEach((ln, k) => ctx.fillText(ln, 0, -blockH / 2 + k * lh + (lh - size) / 2));
    } else {
      lines.forEach((ln, k) => {
        const yy = y0 + k * lh + (lh - size) / 2;
        let xx;
        if (ha === 'center' || ha === 'centerContinuous') { ctx.textAlign = 'center'; xx = t.x + t.w / 2; }
        else if (ha === 'right') { ctx.textAlign = 'right'; xx = t.x + t.w - pad - indent; }
        else if (ha === 'fill') { ctx.textAlign = 'left'; xx = t.x + pad; const tw = measure(font, ln) || 1; ln = ln.repeat(Math.max(1, Math.floor(avail / tw))); }
        else { ctx.textAlign = 'left'; xx = t.x + pad + indent; }
        if (ha === 'justify' || ha === 'distributed') { ctx.textAlign = 'left'; xx = t.x + pad; }
        ctx.fillText(ln, xx, yy);
        const tw = measure(font, ln);
        const lx = ctx.textAlign === 'center' ? xx - tw / 2 : ctx.textAlign === 'right' ? xx - tw : xx;
        if (st.u || (cell.l && st.u !== false)) {
          ctx.fillRect(lx, yy + size * 0.98, tw, Math.max(1, size / 14));
          if (st.u === 'double') ctx.fillRect(lx, yy + size * 0.98 + 2, tw, 1);
        }
        if (st.s) ctx.fillRect(lx, yy + size * 0.55, tw, Math.max(1, size / 14));
      });
    }
    ctx.restore();
  };
  const wrapLines = (font, text, maxW) => {
    const out = [];
    text.split('\n').forEach((para) => {
      const words = para.split(/(\s+)/);
      let line = '';
      words.forEach((w) => {
        const test = line + w;
        if (measure(font, test) <= maxW || !line) {
          if (measure(font, test) > maxW && !line) {
            // lang woord afbreken
            let part = '';
            for (const ch of w) { if (measure(font, part + ch) > maxW && part) { out.push(part); part = ch; } else part += ch; }
            line = part;
          } else line = test;
        } else { out.push(line.trimEnd()); line = w.trimStart(); }
      });
      out.push(line.trimEnd());
    });
    return out;
  };
  App.wrapLines = wrapLines;

  /* Koppen */
  const drawHeaders = (sh, rs, cs) => {
    if (!sh.heads) return;
    const sel = sh.sel;
    const selCols = new Set(), selRows = new Set(), fullCols = new Set(), fullRows = new Set();
    sel.ranges.forEach((g) => {
      for (const c of cs) if (c >= g.c1 && c <= g.c2) { selCols.add(c); if (App.isFullCol(g)) fullCols.add(c); }
      for (const r of rs) if (r >= g.r1 && r <= g.r2) { selRows.add(r); if (App.isFullRow(g)) fullRows.add(r); }
    });
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    // kolomkoppen
    ctx.save();
    ctx.beginPath(); ctx.rect(V.HW, 0, V.W - V.HW, V.HH); ctx.clip();
    ctx.fillStyle = colors.headBg; ctx.fillRect(V.HW, 0, V.W, V.HH);
    for (const c of cs) {
      const x = scrX(c), w = App.colW(c);
      if (w <= 0) continue;
      if (selCols.has(c)) {
        ctx.fillStyle = fullCols.has(c) ? colors.selLine : colors.headSel; ctx.fillRect(x, 0, w, V.HH);
        ctx.fillStyle = colors.selLine; ctx.fillRect(x, V.HH - 2, w, 2);
      }
      ctx.fillStyle = fullCols.has(c) ? '#ffffff' : selCols.has(c) ? colors.headSelText : colors.headText;
      ctx.fillText(App.colName(c), x + w / 2, V.HH / 2 + 0.5);
      ctx.fillStyle = colors.lineStrong; ctx.fillRect(Math.round(x + w) - 1, 3, 1, V.HH - 6);
    }
    ctx.fillStyle = colors.lineStrong; ctx.fillRect(V.HW, V.HH - 1, V.W, 1);
    ctx.restore();
    // rijkoppen
    ctx.save();
    ctx.beginPath(); ctx.rect(0, V.HH, V.HW, V.H - V.HH); ctx.clip();
    ctx.fillStyle = colors.headBg; ctx.fillRect(0, V.HH, V.HW, V.H);
    for (const r of rs) {
      const y = scrY(r), h = App.rowH(r);
      if (h <= 0) continue;
      if (selRows.has(r)) {
        ctx.fillStyle = fullRows.has(r) ? colors.selLine : colors.headSel; ctx.fillRect(0, y, V.HW, h);
        ctx.fillStyle = colors.selLine; ctx.fillRect(V.HW - 2, y, 2, h);
      }
      ctx.fillStyle = fullRows.has(r) ? '#ffffff' : selRows.has(r) ? colors.headSelText : sh.fhid && sh.filter && r > sh.filter.r && Object.keys(sh.fhid).length ? '#0563c1' : colors.headText;
      ctx.fillText(String(r + 1), V.HW / 2, y + h / 2 + 0.5);
      ctx.fillStyle = colors.lineStrong; ctx.fillRect(3, Math.round(y + h) - 1, V.HW - 6, 1);
    }
    ctx.fillStyle = colors.lineStrong; ctx.fillRect(V.HW - 1, V.HH, 1, V.H);
    ctx.restore();
    // hoek
    ctx.fillStyle = colors.headBg; ctx.fillRect(0, 0, V.HW, V.HH);
    ctx.fillStyle = colors.lineStrong;
    ctx.beginPath(); ctx.moveTo(V.HW - 4, V.HH - 4); ctx.lineTo(V.HW - 4, 6); ctx.lineTo(V.HW - 14 > 6 ? V.HW - 14 : 6, V.HH - 4); ctx.closePath(); ctx.fill();
    ctx.fillRect(0, V.HH - 1, V.HW, 1); ctx.fillRect(V.HW - 1, 0, 1, V.HH);
  };

  /* Selectie, verwijzingskleuren, kopieerrand */
  const REF_COLORS = ['#4472c4', '#c00000', '#7030a0', '#00b050', '#ed7d31', '#0070c0', '#bf8f00', '#d6007b'];
  App.REF_COLORS = REF_COLORS;
  let marchOffset = 0, marchTimer = null;
  const rectOf = (g) => {
    const x1 = scrX(Math.max(g.c1, 0)), y1 = scrY(Math.max(g.r1, 0));
    const x2 = scrX(g.c2) + App.colW(g.c2), y2 = scrY(g.r2) + App.rowH(g.r2);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  const clipBody = () => { ctx.beginPath(); ctx.rect(V.HW, V.HH, V.W - V.HW, V.H - V.HH); ctx.clip(); };
  // Bij bevroren deelvensters een bereik per deelvenster tekenen
  const paneRects = (g) => {
    const out = [];
    const parts = [];
    const rr = V.fr > 0 ? [[g.r1, Math.min(g.r2, V.fr - 1), true], [Math.max(g.r1, V.fr), g.r2, false]] : [[g.r1, g.r2, false]];
    const cc = V.fc > 0 ? [[g.c1, Math.min(g.c2, V.fc - 1), true], [Math.max(g.c1, V.fc), g.c2, false]] : [[g.c1, g.c2, false]];
    rr.forEach(([a, b, fr]) => cc.forEach(([c, d, fc]) => { if (a <= b && c <= d) parts.push({ g: { r1: a, r2: b, c1: c, c2: d }, fr, fc }); }));
    parts.forEach((p) => {
      const R = rectOf(p.g);
      const clip = { x: p.fc ? V.HW : V.HW + V.FW, y: p.fr ? V.HH : V.HH + V.FH };
      clip.w = p.fc ? V.FW : V.W - clip.x; clip.h = p.fr ? V.FH : V.H - clip.y;
      out.push({ R, clip, full: R });
    });
    // samengevoegde rand: totale rechthoek binnen elk deelvenster tekenen met clip
    const T = rectOf(g);
    return out.map((o) => ({ ...o, T }));
  };
  const drawSelection = (sh) => {
    const sel = sh.sel;
    const editing = App.state.editing;
    ctx.save();
    clipBody();
    const single = sel.ranges.length === 1;
    sel.ranges.forEach((g) => {
      const m0 = App.mergeAt(sh, g.r1, g.c1);
      const isCell = (g.r1 === g.r2 && g.c1 === g.c2) || (m0 && m0.r1 === g.r1 && m0.c1 === g.c1 && m0.r2 === g.r2 && m0.c2 === g.c2);
      paneRects(g).forEach(({ T, clip }) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip();
        // de actieve cel wordt daarna opnieuw (zonder kleur) getekend door redrawActive
        if (!isCell) {
          ctx.fillStyle = colors.selFill;
          ctx.fillRect(T.x, T.y, T.w, T.h);
        }
        ctx.strokeStyle = colors.selLine;
        ctx.lineWidth = single ? 2 : 1;
        ctx.strokeRect(T.x + (single ? 0 : 0.5), T.y + (single ? 0 : 0.5), T.w - (single ? 1 : 1), T.h - (single ? 1 : 1));
        ctx.restore();
      });
    });
    // actieve cel: kader
    const a = App.cellRect(sel.ar, sel.ac, sh);
    if (!single) { ctx.strokeStyle = colors.selLine; ctx.lineWidth = 2; ctx.strokeRect(a.x + 1, a.y + 1, a.w - 2, a.h - 2); }
    // vulgreep
    if (single && !editing) {
      const g = sel.ranges[0];
      const T = rectOf(g);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(T.x + T.w - 4, T.y + T.h - 4, 7, 7);
      ctx.fillStyle = colors.selLine; ctx.fillRect(T.x + T.w - 3, T.y + T.h - 3, 5, 5);
    }
    ctx.restore();
  };
  // De selectie-opvulling mag de actieve cel niet bedekken: we tekenen die cel opnieuw
  const redrawActive = (sh) => {
    const sel = sh.sel;
    const g = sel.ranges[sel.ri];
    if (!g || (g.r1 === g.r2 && g.c1 === g.c2)) return;
    const a = App.cellRect(sel.ar, sel.ac, sh);
    const m = a.g;
    if (m.r1 === g.r1 && m.r2 === g.r2 && m.c1 === g.c1 && m.c2 === g.c2) return;
    const clip = { x: Math.max(a.x, sel.ac < V.fc ? V.HW : V.HW + V.FW), y: Math.max(a.y, sel.ar < V.fr ? V.HH : V.HH + V.FH) };
    clip.w = a.x + a.w - clip.x; clip.h = a.y + a.h - clip.y;
    if (clip.w <= 0 || clip.h <= 0) return;
    drawPane(sh, m.r1, m.r2, m.c1, m.c2, { x: clip.x + 1, y: clip.y + 1, w: clip.w - 2, h: clip.h - 2 });
  };

  const drawOverlays = (sh) => {
    ctx.save();
    clipBody();
    // verwijzingen tijdens het bewerken van een formule
    const ed = App.state.editing;
    if (ed && ed.refs) {
      ed.refs.forEach((rf, k) => {
        const target = rf.sheet ? App.sheetByName(rf.sheet) : App.book.sheets[ed.sheetIdx];
        if (target !== sh) return;
        const g = { r1: rf.r1, c1: rf.c1, r2: Math.min(rf.r2, App.MAXR - 1), c2: Math.min(rf.c2, App.MAXC - 1) };
        const color = REF_COLORS[k % REF_COLORS.length];
        paneRects(g).forEach(({ T, clip }) => {
          ctx.save(); ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip();
          ctx.fillStyle = color + '1f'; ctx.fillRect(T.x, T.y, T.w, T.h);
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2);
          if (ed.pointRefIdx === k) ctx.setLineDash([4, 3]);
          ctx.restore();
        });
      });
    }
    // overloopbereik van een matrixformule: blauwe stippelrand
    {
      const s = sh.sel;
      const a = sh._spill && sh._spill.get(s.ar * 16384 + s.ac);
      const ac = a && App.getCell(sh, a.r, a.c);
      if (ac && ac.sp) {
        const T = rectOf({ r1: a.r, c1: a.c, r2: a.r + ac.sp.h - 1, c2: a.c + ac.sp.w - 1 });
        ctx.strokeStyle = '#2f75b5'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
        ctx.strokeRect(T.x + 0.5, T.y + 0.5, T.w - 1, T.h - 1); ctx.setLineDash([]);
      }
    }
    // kopieerrand (marcherende mieren)
    const clip = App.state.clip;
    if (clip && clip.sheet === sh && !clip.done) {
      const T = rectOf(clip.g);
      ctx.strokeStyle = colors.selLine; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -marchOffset;
      ctx.strokeRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2);
      ctx.setLineDash([]);
      if (!marchTimer) marchTimer = setInterval(() => { marchOffset = (marchOffset + 1) % 7; App.scheduleRender(); }, 90);
    } else if (marchTimer) { clearInterval(marchTimer); marchTimer = null; }
    // slepen: doelkader voor verplaatsen / doorvoeren
    if (App.dragGhost && App.dragGhost.sheet === sh) {
      const T = rectOf(App.dragGhost.g);
      ctx.strokeStyle = '#707070'; ctx.lineWidth = 2; ctx.setLineDash(App.dragGhost.kind === 'fill' ? [3, 2] : []);
      ctx.strokeRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2); ctx.setLineDash([]);
    }
    // pagina-einden
    if (App.state.view === 'breaks' && App.pageBreaks) {
      const pb = App.pageBreaks(sh);
      ctx.strokeStyle = '#2f5eb5'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      pb.cols.forEach((c) => { const x = scrX(c); ctx.beginPath(); ctx.moveTo(x, V.HH); ctx.lineTo(x, V.H); ctx.stroke(); });
      pb.rows.forEach((r) => { const y = scrY(r); ctx.beginPath(); ctx.moveTo(V.HW, y); ctx.lineTo(V.W, y); ctx.stroke(); });
      ctx.setLineDash([]);
      if (pb.area) { const T = rectOf(pb.area); ctx.strokeStyle = '#2f5eb5'; ctx.lineWidth = 3; ctx.strokeRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2); }
    }
    // bronnen/doelen aanwijzen
    if (App.traceArrows && App.traceArrows.sheet === sh) {
      App.traceArrows.list.forEach(({ from, to }) => {
        const a = App.cellRect(from.r, from.c, sh), b = App.cellRect(to.r, to.c, sh);
        const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, x2 = b.x + b.w / 2, y2 = b.y + b.h / 2;
        ctx.strokeStyle = '#2f5eb5'; ctx.fillStyle = '#2f5eb5'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 9 * Math.cos(ang - 0.4), y2 - 9 * Math.sin(ang - 0.4)); ctx.lineTo(x2 - 9 * Math.cos(ang + 0.4), y2 - 9 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
      });
    }
    ctx.restore();
    // lijnen van bevroren deelvensters
    if (V.fr > 0) { ctx.fillStyle = '#9b9b9b'; ctx.fillRect(V.HW, V.HH + V.FH - 1, V.W, 1); }
    if (V.fc > 0) { ctx.fillStyle = '#9b9b9b'; ctx.fillRect(V.HW + V.FW - 1, V.HH, 1, V.H); }
  };

  /* Hoofdfunctie */
  App.render = () => {
    if (!colors) loadColors();
    const sh = App.sh();
    computeView();
    const d = dpr();
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    if (canvas.width !== Math.round(cw * d) || canvas.height !== Math.round(ch * d)) {
      canvas.width = Math.round(cw * d); canvas.height = Math.round(ch * d);
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = colors.panel; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(d * V.z, 0, 0, d * V.z, 0, 0);
    // zichtbare rijen/kolommen
    const rsScroll = [], csScroll = [];
    const r0 = App.rowAt(App.rowY(V.fr) + V.sy), c0 = App.colAt(App.colX(V.fc) + V.sx);
    let y = scrY(r0);
    for (let r = r0; r < App.MAXR && y < V.H; r++) { rsScroll.push(r); y += App.rowH(r); }
    let x = scrX(c0);
    for (let c = c0; c < App.MAXC && x < V.W; c++) { csScroll.push(c); x += App.colW(c); }
    const rsFrozen = [], csFrozen = [];
    for (let r = 0; r < V.fr; r++) rsFrozen.push(r);
    for (let c = 0; c < V.fc; c++) csFrozen.push(c);
    const last = (a) => a[a.length - 1];
    const bodyX = V.HW + V.FW, bodyY = V.HH + V.FH;
    if (rsScroll.length && csScroll.length) drawPane(sh, rsScroll[0], last(rsScroll), csScroll[0], last(csScroll), { x: bodyX, y: bodyY, w: V.W - bodyX, h: V.H - bodyY });
    if (V.fr && csScroll.length) drawPane(sh, 0, V.fr - 1, csScroll[0], last(csScroll), { x: bodyX, y: V.HH, w: V.W - bodyX, h: V.FH });
    if (V.fc && rsScroll.length) drawPane(sh, rsScroll[0], last(rsScroll), 0, V.fc - 1, { x: V.HW, y: bodyY, w: V.FW, h: V.H - bodyY });
    if (V.fr && V.fc) drawPane(sh, 0, V.fr - 1, 0, V.fc - 1, { x: V.HW, y: V.HH, w: V.FW, h: V.FH });
    drawSelection(sh);
    redrawActive(sh);
    // actieve-celkader opnieuw na het hertekenen van de actieve cel
    {
      const sel = sh.sel;
      if (sel.ranges.length === 1) {
        ctx.save(); clipBody();
        const T = rectOf(sel.ranges[0]);
        ctx.strokeStyle = colors.selLine; ctx.lineWidth = 2; ctx.strokeRect(T.x, T.y, T.w - 1, T.h - 1);
        if (!App.state.editing) { ctx.fillStyle = '#ffffff'; ctx.fillRect(T.x + T.w - 4, T.y + T.h - 4, 7, 7); ctx.fillStyle = colors.selLine; ctx.fillRect(T.x + T.w - 3, T.y + T.h - 3, 5, 5); }
        ctx.restore();
      }
    }
    drawOverlays(sh);
    drawHeaders(sh, rsFrozen.concat(rsScroll), csFrozen.concat(csScroll));
    App.visible = { rows: rsFrozen.concat(rsScroll), cols: csFrozen.concat(csScroll) };
  };
  App.on('change', () => { colors = null; });
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { colors = null; App.scheduleRender(); });
  new MutationObserver(() => { colors = null; App.scheduleRender(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  App.resize = () => { computeView(); updateSpacer(); App.render(); App.positionEditor && App.positionEditor(); App.emit('render'); };
  new ResizeObserver(() => App.resize()).observe(wrap);

  /* ---------- Muis ---------- */
  const hitTest = (ev) => {
    const rect = scroller.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    computeView();
    const x = px / V.z, y = py / V.z;
    if (px > scroller.clientWidth || py > scroller.clientHeight) return { area: 'scrollbar' };
    const sh = App.sh();
    if (y < V.HH && x < V.HW) return { area: 'corner', x, y };
    if (y < V.HH) {
      const c = colFromX(x);
      const cx = scrX(c);
      if (x > cx + App.colW(c) - 4 && c >= 0) return { area: 'colborder', c, x, y };
      if (x < cx + 3 && c > 0) { let p = c - 1; while (p > 0 && App.colW(p) === 0) p--; return { area: 'colborder', c: App.colW(c - 1) === 0 ? c - 1 : p, x, y, hiddenEdge: App.colW(c - 1) === 0 }; }
      return { area: 'colhead', c, x, y };
    }
    if (x < V.HW) {
      const r = rowFromY(y);
      const ry = scrY(r);
      if (y > ry + App.rowH(r) - 3 && r >= 0) return { area: 'rowborder', r, x, y };
      if (y < ry + 2 && r > 0) return { area: 'rowborder', r: r - 1, x, y };
      return { area: 'rowhead', r, x, y };
    }
    const r = rowFromY(y), c = colFromX(x);
    // filterknop
    const flt = sh.filter;
    if (flt && r === flt.r && c >= flt.c1 && c <= flt.c2) {
      const bx = scrX(c) + App.colW(c) - 17, by = scrY(r) + App.rowH(r) - 17;
      if (x >= bx && x <= bx + 15 && y >= by && y <= by + 15) return { area: 'filter', r, c, x, y };
    }
    // vulgreep en selectierand
    if (!App.state.editing && sh.sel.ranges.length === 1) {
      const g = sh.sel.ranges[0];
      const T = rectOf(g);
      if (Math.abs(x - (T.x + T.w)) <= 4 && Math.abs(y - (T.y + T.h)) <= 4) return { area: 'fill', r, c, x, y };
      const onEdge = (Math.abs(x - T.x) <= 3 || Math.abs(x - (T.x + T.w)) <= 3) && y >= T.y - 3 && y <= T.y + T.h + 3
        || (Math.abs(y - T.y) <= 3 || Math.abs(y - (T.y + T.h)) <= 3) && x >= T.x - 3 && x <= T.x + T.w + 3;
      if (onEdge && !App.isFullCol(g) && !App.isFullRow(g)) return { area: 'edge', r, c, x, y };
    }
    return { area: 'cell', r, c, x, y };
  };
  App.hitTest = hitTest;

  let drag = null;
  let autoScrollTimer = null;
  const stopAutoScroll = () => { clearInterval(autoScrollTimer); autoScrollTimer = null; };
  const autoScroll = (ev) => {
    const rect = scroller.getBoundingClientRect();
    const dx = ev.clientX < rect.left + V.HW * V.z ? -1 : ev.clientX > rect.left + scroller.clientWidth ? 1 : 0;
    const dy = ev.clientY < rect.top + V.HH * V.z ? -1 : ev.clientY > rect.top + scroller.clientHeight ? 1 : 0;
    stopAutoScroll();
    if (!dx && !dy) return;
    autoScrollTimer = setInterval(() => {
      scroller.scrollLeft += dx * 30; scroller.scrollTop += dy * 22;
      if (drag && drag.lastEv) onMove(drag.lastEv, true);
    }, 40);
  };
  const clampCell = (h) => ({ r: App.clamp(h.r < 0 ? 0 : h.r, 0, App.MAXR - 1), c: App.clamp(h.c < 0 ? 0 : h.c, 0, App.MAXC - 1) });
  const cellFromEvent = (ev) => {
    const rect = scroller.getBoundingClientRect();
    computeView();
    const x = App.clamp((ev.clientX - rect.left) / V.z, V.HW + 1, V.W - 1), y = App.clamp((ev.clientY - rect.top) / V.z, V.HH + 1, V.H - 1);
    return clampCell({ r: rowFromY(y), c: colFromX(x) });
  };

  scroller.addEventListener('pointerdown', (ev) => {
    if (ev.button === 2) {
      // rechtsklik: selectie behouden als de cel erin ligt
      const h = hitTest(ev);
      if (h.area === 'cell' || h.area === 'edge' || h.area === 'fill') {
        if (!App.selRanges().some((g) => App.inRange(g, h.r, h.c))) { App.commitEdit && App.state.editing && App.commitEdit(); App.selectCell(h.r, h.c); }
      } else if (h.area === 'colhead' && !App.selRanges().some((g) => App.isFullCol(g) && h.c >= g.c1 && h.c <= g.c2)) App.setSel({ r1: 0, c1: h.c, r2: App.MAXR - 1, c2: h.c }, App.rowAt(App.rowY(V.fr) + V.sy), h.c);
      else if (h.area === 'rowhead' && !App.selRanges().some((g) => App.isFullRow(g) && h.r >= g.r1 && h.r <= g.r2)) App.setSel({ r1: h.r, c1: 0, r2: h.r, c2: App.MAXC - 1 }, h.r, App.colAt(App.colX(V.fc) + V.sx));
      return;
    }
    if (ev.button !== 0) return;
    const h = hitTest(ev);
    if (h.area === 'scrollbar') return;
    ev.preventDefault();
    App.deselectObj && App.deselectObj();
    App.hideNotePop && App.hideNotePop();
    const sh = App.sh();
    const ed = App.state.editing;
    // aanwijsmodus tijdens het typen van een formule
    if (ed && App.canPoint && App.canPoint() && (h.area === 'cell' || h.area === 'edge' || h.area === 'fill' || h.area === 'colhead' || h.area === 'rowhead')) {
      const c0 = h.area === 'rowhead' ? 0 : h.c, r0 = h.area === 'colhead' ? 0 : h.r;
      const g = h.area === 'colhead' ? { r1: 0, c1: h.c, r2: App.MAXR - 1, c2: h.c } : h.area === 'rowhead' ? { r1: h.r, c1: 0, r2: h.r, c2: App.MAXC - 1 } : { r1: r0, c1: c0, r2: r0, c2: c0 };
      App.pointInsert(g);
      drag = { kind: 'point', ar: r0, ac: c0, head: h.area };
      scroller.setPointerCapture(ev.pointerId);
      return;
    }
    if (ed) App.commitEdit();
    App.focusGrid();
    if (h.area === 'filter') { App.openFilterMenu && App.openFilterMenu(h.c, ev); return; }
    if (h.area === 'corner') { App.setSel({ r1: 0, c1: 0, r2: App.MAXR - 1, c2: App.MAXC - 1 }, App.rowAt(App.rowY(V.fr) + V.sy), App.colAt(App.colX(V.fc) + V.sx)); return; }
    if (h.area === 'colborder') { drag = { kind: 'colsize', c: h.c, start: ev.clientX, w0: App.colW(h.c), cur: App.colW(h.c) }; scroller.setPointerCapture(ev.pointerId); return; }
    if (h.area === 'rowborder') { drag = { kind: 'rowsize', r: h.r, start: ev.clientY, h0: App.rowH(h.r), cur: App.rowH(h.r) }; scroller.setPointerCapture(ev.pointerId); return; }
    if (h.area === 'colhead') {
      const top = App.rowAt(App.rowY(V.fr) + V.sy);
      if (ev.shiftKey) { const s = sh.sel; App.setSel({ r1: 0, c1: Math.min(s.ac, h.c), r2: App.MAXR - 1, c2: Math.max(s.ac, h.c) }, s.ar, s.ac); }
      else App.setSel({ r1: 0, c1: h.c, r2: App.MAXR - 1, c2: h.c }, top, h.c, ev.ctrlKey);
      drag = { kind: 'cols', ac: ev.shiftKey ? sh.sel.ac : h.c, add: ev.ctrlKey };
      scroller.setPointerCapture(ev.pointerId); return;
    }
    if (h.area === 'rowhead') {
      const left = App.colAt(App.colX(V.fc) + V.sx);
      if (ev.shiftKey) { const s = sh.sel; App.setSel({ r1: Math.min(s.ar, h.r), c1: 0, r2: Math.max(s.ar, h.r), c2: App.MAXC - 1 }, s.ar, s.ac); }
      else App.setSel({ r1: h.r, c1: 0, r2: h.r, c2: App.MAXC - 1 }, h.r, left, ev.ctrlKey);
      drag = { kind: 'rows', ar: ev.shiftKey ? sh.sel.ar : h.r, add: ev.ctrlKey };
      scroller.setPointerCapture(ev.pointerId); return;
    }
    if (h.area === 'fill') { drag = { kind: 'fill', src: { ...sh.sel.ranges[0] }, start: { r: h.r, c: h.c } }; scroller.setPointerCapture(ev.pointerId); return; }
    if (h.area === 'edge') { drag = { kind: 'move', src: { ...sh.sel.ranges[0] }, start: { r: h.r, c: h.c }, copy: ev.ctrlKey }; scroller.setPointerCapture(ev.pointerId); return; }
    // gewone cel
    const cell = App.getCell(sh, h.r, h.c);
    if (cell && cell.l && (ev.ctrlKey || ev.metaKey)) { App.followLink(cell.l); return; }
    if (App.state.painter) {
      drag = { kind: 'cells', ar: h.r, ac: h.c, painter: true };
      App.selectCell(h.r, h.c);
      scroller.setPointerCapture(ev.pointerId); return;
    }
    if (ev.shiftKey) {
      const s = sh.sel;
      App.extendSel(h.r, h.c);
      drag = { kind: 'cells', ar: s.ar, ac: s.ac, extend: true };
    } else {
      App.selectCell(h.r, h.c, ev.ctrlKey || ev.metaKey);
      drag = { kind: 'cells', ar: h.r, ac: h.c, add: ev.ctrlKey || ev.metaKey };
    }
    scroller.setPointerCapture(ev.pointerId);
  });

  const onMove = (ev, fromTimer) => {
    if (!drag) {
      const h = hitTest(ev);
      const cls = h.area === 'colborder' ? 'cur-col' : h.area === 'rowborder' ? 'cur-row' : h.area === 'fill' ? 'cur-fill' : h.area === 'edge' ? 'cur-move' : h.area === 'filter' ? 'cur-pointer' : h.area === 'colhead' ? 'cur-down' : h.area === 'rowhead' ? 'cur-right' : h.area === 'cell' ? 'cur-cell' : '';
      scroller.className = cls;
      App.hoverCell && App.hoverCell(h);
      return;
    }
    drag.lastEv = ev;
    if (!fromTimer) autoScroll(ev);
    const sh = App.sh();
    if (drag.kind === 'colsize') {
      const w = Math.max(0, drag.w0 + (ev.clientX - drag.start) / V.z);
      drag.cur = w;
      showSizeTip(ev, `Breedte: ${App.fmtNum(Math.max(0, (w - 5) / 7), 2)} (${Math.round(w)} pixels)`);
      sh.colW[drag.c] = w; App.invalidateDims(sh); App.render();
      return;
    }
    if (drag.kind === 'rowsize') {
      const h = Math.max(0, drag.h0 + (ev.clientY - drag.start) / V.z);
      drag.cur = h;
      showSizeTip(ev, `Hoogte: ${App.fmtNum(h * 0.75, 2)} (${Math.round(h)} pixels)`);
      sh.rowH[drag.r] = h; App.invalidateDims(sh); App.render();
      return;
    }
    const p = cellFromEvent(ev);
    if (drag.kind === 'point') {
      let g;
      if (drag.head === 'colhead') g = { r1: 0, c1: Math.min(drag.ac, p.c), r2: App.MAXR - 1, c2: Math.max(drag.ac, p.c) };
      else if (drag.head === 'rowhead') g = { r1: Math.min(drag.ar, p.r), c1: 0, r2: Math.max(drag.ar, p.r), c2: App.MAXC - 1 };
      else g = App.norm({ r1: drag.ar, c1: drag.ac, r2: p.r, c2: p.c });
      App.pointInsert(g, true);
      return;
    }
    if (drag.kind === 'cells') {
      const s = sh.sel;
      const g = App.expandMerges(sh, App.norm({ r1: drag.ar, c1: drag.ac, r2: p.r, c2: p.c }));
      s.ranges[s.ri] = g; s.er = p.r; s.ec = p.c;
      App.selChanged();
      return;
    }
    if (drag.kind === 'cols') {
      const s = sh.sel;
      s.ranges[s.ri] = { r1: 0, c1: Math.min(drag.ac, p.c), r2: App.MAXR - 1, c2: Math.max(drag.ac, p.c) };
      App.selChanged(); return;
    }
    if (drag.kind === 'rows') {
      const s = sh.sel;
      s.ranges[s.ri] = { r1: Math.min(drag.ar, p.r), c1: 0, r2: Math.max(drag.ar, p.r), c2: App.MAXC - 1 };
      App.selChanged(); return;
    }
    if (drag.kind === 'move') {
      const dr = p.r - drag.start.r, dc = p.c - drag.start.c;
      const g = drag.src;
      const ng = { r1: g.r1 + dr, r2: g.r2 + dr, c1: g.c1 + dc, c2: g.c2 + dc };
      if (ng.r1 < 0) { ng.r2 -= ng.r1; ng.r1 = 0; }
      if (ng.c1 < 0) { ng.c2 -= ng.c1; ng.c1 = 0; }
      App.dragGhost = { sheet: sh, g: ng, kind: 'move' };
      drag.target = ng; drag.copy = ev.ctrlKey;
      scroller.className = ev.ctrlKey ? 'cur-cell' : 'cur-move';
      App.scheduleRender();
      return;
    }
    if (drag.kind === 'fill') {
      const g = drag.src;
      let ng = { ...g };
      const below = p.r - g.r2, above = g.r1 - p.r, right = p.c - g.c2, left = g.c1 - p.c;
      const vert = Math.max(below, above), horiz = Math.max(right, left);
      if (vert <= 0 && horiz <= 0) {
        // binnen de selectie terugslepen = wissen (zoals Excel)
        if (p.r < g.r2 && p.r >= g.r1 && (g.r2 > g.r1)) ng = { ...g, r2: p.r };
        else if (p.c < g.c2 && p.c >= g.c1 && (g.c2 > g.c1)) ng = { ...g, c2: p.c };
      } else if (vert >= horiz) { if (below > 0) ng.r2 = p.r; else ng.r1 = p.r; }
      else { if (right > 0) ng.c2 = p.c; else ng.c1 = p.c; }
      App.dragGhost = { sheet: sh, g: ng, kind: 'fill' };
      drag.target = ng;
      App.scheduleRender();
    }
  };
  scroller.addEventListener('pointermove', (ev) => onMove(ev));
  const tip = document.createElement('div');
  tip.id = 'size-tip';
  tip.style.cssText = 'position:fixed;z-index:60;background:#fff;color:#222;border:1px solid #c4c4c4;font-size:11px;padding:2px 6px;pointer-events:none;display:none;white-space:nowrap';
  document.body.appendChild(tip);
  const showSizeTip = (ev, text) => { tip.textContent = text; tip.style.display = 'block'; tip.style.left = ev.clientX + 12 + 'px'; tip.style.top = ev.clientY - 28 + 'px'; };
  App.showTip = showSizeTip;
  App.hideTip = () => { tip.style.display = 'none'; };

  scroller.addEventListener('pointerup', (ev) => {
    stopAutoScroll();
    tip.style.display = 'none';
    if (!drag) return;
    const d = drag; drag = null;
    try { scroller.releasePointerCapture(ev.pointerId); } catch { /* niets */ }
    const sh = App.sh();
    if (d.kind === 'colsize') {
      const w = d.cur;
      const cols = App.selRanges().filter((g) => App.isFullCol(g) && d.c >= g.c1 && d.c <= g.c2);
      App.exec('setColWidth', { cols: cols.length ? cols : [{ c1: d.c, c2: d.c }], w });
      return;
    }
    if (d.kind === 'rowsize') {
      const rows = App.selRanges().filter((g) => App.isFullRow(g) && d.r >= g.r1 && d.r <= g.r2);
      App.exec('setRowHeight', { rows: rows.length ? rows : [{ r1: d.r, r2: d.r }], h: d.cur });
      return;
    }
    if (d.kind === 'move' && d.target) {
      App.dragGhost = null;
      if (d.target.r1 !== d.src.r1 || d.target.c1 !== d.src.c1) App.exec('moveCells', { src: d.src, dst: d.target, copy: d.copy });
      App.scheduleRender();
      return;
    }
    if (d.kind === 'fill') {
      App.dragGhost = null;
      if (d.target) App.exec('fillDrag', { src: d.src, dst: d.target });
      App.scheduleRender();
      return;
    }
    if (d.kind === 'cells' && d.painter) { App.applyPainter && App.applyPainter(); return; }
    if (d.kind === 'point') { App.focusEditor && App.focusEditor(); return; }
    App.scheduleState();
  });
  scroller.addEventListener('lostpointercapture', () => { stopAutoScroll(); });

  scroller.addEventListener('dblclick', (ev) => {
    const h = hitTest(ev);
    if (h.area === 'colborder') {
      const cols = App.selRanges().filter((g) => App.isFullCol(g) && h.c >= g.c1 && h.c <= g.c2);
      App.exec('autoFitCols', cols.length ? cols : [{ c1: h.c, c2: h.c }]);
      return;
    }
    if (h.area === 'rowborder') {
      const rows = App.selRanges().filter((g) => App.isFullRow(g) && h.r >= g.r1 && h.r <= g.r2);
      App.exec('autoFitRows', rows.length ? rows : [{ r1: h.r, r2: h.r }]);
      return;
    }
    if (h.area === 'fill') { App.exec('fillDoubleClick'); return; }
    if (h.area === 'cell' || h.area === 'edge') {
      if (App.state.painter) return;
      App.selectCell(h.r, h.c);
      App.startEdit && App.startEdit({ mode: 'edit', clickX: ev.clientX });
    }
  });

  scroller.addEventListener('wheel', (ev) => {
    if (ev.ctrlKey) {
      ev.preventDefault();
      App.exec('zoomSet', Math.round((App.sh().zoom || 1) * 100 + (ev.deltaY < 0 ? 10 : -10)));
    }
  }, { passive: false });

  scroller.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    App.openGridMenu && App.openGridMenu(ev, hitTest(ev));
  });

  /* ---------- Bladtabs ---------- */
  const tabsEl = $('#sheet-tabs');
  App.renderSheetTabs = () => {
    const b = App.book;
    tabsEl.innerHTML = b.sheets.map((s, i) => s.hidden ? '' : `<button class="stab${i === b.active ? ' active' : ''}" data-si="${i}" draggable="true" title="${App.esc(s.name)}">${s.tab ? `<span class="tabc" style="background:${s.tab}"></span>` : ''}${App.esc(s.name)}${s.protect ? ' <span class="i" style="font-size:13px">lock</span>' : ''}</button>`).join('');
    const act = tabsEl.querySelector('.active');
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  tabsEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-si]'); if (!t || t.querySelector('input')) return;
    App.switchSheet(+t.dataset.si);
  });
  tabsEl.addEventListener('dblclick', (e) => {
    const t = e.target.closest('[data-si]'); if (!t) return;
    App.renameSheetInline(+t.dataset.si);
  });
  tabsEl.addEventListener('contextmenu', (e) => {
    const t = e.target.closest('[data-si]'); if (!t) return;
    e.preventDefault();
    App.switchSheet(+t.dataset.si);
    const visible = App.book.sheets.filter((s) => !s.hidden).length;
    const hidden = App.book.sheets.some((s) => s.hidden);
    App.openPopup({ x: e.clientX, y: e.clientY }, `
      <button data-cmd="addSheet"><span class="i">post_add</span> Invoegen</button>
      <button data-cmd="deleteSheet" ${visible < 2 ? 'disabled' : ''}><span class="i">delete</span> Verwijderen</button>
      <button data-cmd="renameSheet"><span class="i">edit</span> Naam wijzigen</button>
      <button data-cmd="moveSheet"><span class="i">drive_file_move</span> Verplaatsen of kopiëren…</button>
      <button data-cmd="duplicateSheet"><span class="i">content_copy</span> Blad dupliceren</button>
      <button data-cmd="tabColorMenu"><span class="i">tab</span> Tabkleur…</button>
      <button data-cmd="toggleProtect"><span class="i">lock</span> ${App.sh().protect ? 'Beveiliging opheffen' : 'Blad beveiligen'}</button>
      <hr>
      <button data-cmd="hideSheet" ${visible < 2 ? 'disabled' : ''}><span class="i">visibility_off</span> Verbergen</button>
      <button data-cmd="unhideSheet" ${hidden ? '' : 'disabled'}><span class="i">visibility</span> Zichtbaar maken…</button>
      <button data-cmd="selectAll"><span class="i">select_all</span> Alle cellen selecteren</button>`, 'ctx-menu');
  });
  let dragSi = null;
  tabsEl.addEventListener('dragstart', (e) => { const t = e.target.closest('[data-si]'); if (!t) return; dragSi = +t.dataset.si; e.dataTransfer.effectAllowed = 'move'; });
  tabsEl.addEventListener('dragover', (e) => {
    if (dragSi === null) return; e.preventDefault();
    $$('.stab', tabsEl).forEach((x) => x.classList.remove('drop-before'));
    const t = e.target.closest('[data-si]'); if (t) t.classList.add('drop-before');
  });
  tabsEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const t = e.target.closest('[data-si]');
    $$('.stab', tabsEl).forEach((x) => x.classList.remove('drop-before'));
    if (dragSi === null) return;
    const to = t ? +t.dataset.si : App.book.sheets.length;
    const from = dragSi; dragSi = null;
    if (to === from || to === from + 1) return;
    App.exec('reorderSheet', { from, to: to > from ? to - 1 : to });
  });
  tabsEl.addEventListener('dragend', () => { dragSi = null; $$('.stab', tabsEl).forEach((x) => x.classList.remove('drop-before')); });

  App.switchSheet = (i) => {
    if (i === App.book.active || !App.book.sheets[i]) return;
    if (App.state.editing) {
      // tijdens het typen van een formule: verwijzing naar ander blad mogelijk
      if (App.canPoint && App.canPoint()) { App.book.active = i; App.afterSheetSwitch(true); return; }
      App.commitEdit();
    }
    App.deselectObj && App.deselectObj();
    App.book.active = i;
    App.afterSheetSwitch();
    App.history.push();
  };
  App.afterSheetSwitch = (keepEdit) => {
    const sh = App.sh();
    sh._max = null;
    App.invalidateDims(sh);
    computeView(); updateSpacer();
    scroller.scrollLeft = sh.scroll.x; scroller.scrollTop = sh.scroll.y;
    App.renderSheetTabs();
    App.updateZoomUi && App.updateZoomUi();
    App.renderObjects && App.renderObjects();
    App.emit('sheet');
    App.render();
    App.scheduleState();
    if (!keepEdit) App.focusGrid && App.focusGrid();
  };

  /* ---------- Statusbalk ---------- */
  const statsEl = $('#sb-stats');
  App.updateStatus = App.debounce(() => {
    const sh = App.sh();
    const ranges = App.selRanges();
    const one = ranges.length === 1 && ranges[0].r1 === ranges[0].r2 && ranges[0].c1 === ranges[0].c2;
    if (one) { statsEl.innerHTML = ''; return; }
    let sum = 0, cnt = 0, ncnt = 0, min = Infinity, max = -Infinity;
    const seen = new Set();
    let fmt = null;
    ranges.forEach((g) => {
      App.eachInRange(sh, App.selBounded(g), (r, c, cell) => {
        const k = r * 16384 + c; if (seen.has(k)) return; seen.add(k);
        if (App.rowHidden(r) || App.colHidden(c)) return;
        const v = App.valueOf(cell);
        if (v === null || v === undefined || v === '') return;
        cnt++;
        if (typeof v === 'number') { ncnt++; sum += v; if (v < min) min = v; if (v > max) max = v; if (!fmt) fmt = (cell.s && cell.s.nf) || null; }
      });
    });
    if (cnt < 2 && !ncnt) { statsEl.innerHTML = cnt ? '' : ''; return; }
    const f = (v) => App.NF.format(v, fmt && !App.NF.isTextFmt(fmt) ? fmt : 'General').text;
    const s = App.settings.stats;
    const parts = [];
    if (s.avg && ncnt) parts.push(`<span><b>Gemiddelde:</b>${f(sum / ncnt)}</span>`);
    if (s.count) parts.push(`<span><b>Aantal:</b>${cnt}</span>`);
    if (s.numcount) parts.push(`<span><b>Aantal getallen:</b>${ncnt}</span>`);
    if (s.min && ncnt) parts.push(`<span><b>Min:</b>${f(min)}</span>`);
    if (s.max && ncnt) parts.push(`<span><b>Max:</b>${f(max)}</span>`);
    if (s.sum && ncnt) parts.push(`<span><b>Som:</b>${f(sum)}</span>`);
    statsEl.innerHTML = parts.join('');
  }, 60);
  App.on('selection', () => App.updateStatus());
  App.on('change', () => App.updateStatus());
  statsEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const s = App.settings.stats;
    const it = (k, l) => `<label class="mi"><input type="checkbox" data-stat="${k}" ${s[k] ? 'checked' : ''}> ${l}</label>`;
    const m = App.openPopup({ x: e.clientX, y: e.clientY - 200 }, `<div class="menu-title">Statusbalk aanpassen</div>${it('avg', 'Gemiddelde')}${it('count', 'Aantal')}${it('numcount', 'Aantal getallen')}${it('min', 'Minimum')}${it('max', 'Maximum')}${it('sum', 'Som')}`);
    m.addEventListener('change', (ev) => { const k = ev.target.dataset.stat; if (k) { s[k] = ev.target.checked; App.saveSettings(); App.updateStatus(); } });
  });
  statsEl.addEventListener('click', () => {
    // waarde kopiëren zoals in Excel: klik op de som
    const t = statsEl.textContent;
    if (t && navigator.clipboard) { const m = /S(?:om|um):([^A-Z]+)$/.exec(statsEl.innerText.replace(/\n/g, ' ')); if (m) navigator.clipboard.writeText(m[1].trim()).then(() => App.toast('Som gekopieerd', 'ok')).catch(() => {}); }
  });
})();
