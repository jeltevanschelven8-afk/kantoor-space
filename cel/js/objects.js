/* =========================================================
   Cel (gemaakt door JJ van Schelven) — objecten: grafieken, afbeeldingen, vormen, tekstvakken,
   notities, koppelingen, symbolen, datum en tijd
   ========================================================= */
'use strict';

(() => {
  const F = App.F, NF = App.NF;
  const layer = $('#obj-layer');
  const noteLayer = $('#note-layer');

  /* ---------- Posities ---------- */
  const objXY = (o, sh = App.sh()) => ({ x: App.colX(o.c, sh) + (o.dx || 0), y: App.rowY(o.r, sh) + (o.dy || 0) });
  const toScreen = (x, y) => {
    const V = App.view;
    const sx = x < V.FW ? V.HW + x : V.HW + V.FW + x - App.colX(V.fc) - V.sx;
    const sy = y < V.FH ? V.HH + y : V.HH + V.FH + y - App.rowY(V.fr) - V.sy;
    return { x: sx * V.z, y: sy * V.z };
  };
  const anchorFrom = (o, x, y) => {
    const c = App.colAt(Math.max(0, x)), r = App.rowAt(Math.max(0, y));
    o.c = c; o.r = r; o.dx = Math.max(0, x) - App.colX(c); o.dy = Math.max(0, y) - App.rowY(r);
  };
  App.objXY = objXY;

  /* ---------- Grafieken ---------- */
  App.CHART_PALETTES = [
    ['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e', '#6a8fb5', '#f2a46f'],
    ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e'],
    ['#0f4761', '#156082', '#2a7fa8', '#4a9cc4', '#7fbad8', '#b3d7ea', '#08303f', '#5e8fa8'],
    ['#196b24', '#2f8a3b', '#4ea72e', '#7cc35a', '#a9d98d', '#0f4517', '#5f9f6a', '#cfe8c2'],
    ['#c0504d', '#e97132', '#f2a46f', '#ffc000', '#9e480e', '#7f1d1a', '#d88c8a', '#ffd966'],
    ['#404040', '#7f7f7f', '#a5a5a5', '#595959', '#bfbfbf', '#262626', '#d9d9d9', '#8c8c8c'],
  ];
  const nice = (min, max, n = 5) => {
    if (min === max) { if (min === 0) { max = 1; } else if (min > 0) min = 0; else max = 0; }
    const span = max - min;
    const raw = span / n;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toPrecision(12));
    return { lo, hi, step, ticks };
  };
  const fmtAxis = (v, nf) => {
    if (nf && nf !== 'General') return NF.format(v, nf).text;
    const a = Math.abs(v);
    if (a >= 1e6) return App.fmtNum(v / 1e6, 1) + ' mln';
    if (a >= 1e4) return NF.format(v, '#,##0').text;
    return NF.general(+v.toPrecision(6));
  };
  App.chartData = (o, sh) => {
    const ch = o.chart;
    const toks = F.tokenize(ch.range || '', 'en').filter((t) => t.t === 'ref');
    if (!toks.length) return null;
    const t = toks[0];
    const dsh = t.sheet ? App.sheetByName(t.sheet) : sh;
    if (!dsh) return null;
    const g = F.boundRef({ sh: dsh, r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2, ref: true });
    const val = (r, c) => F.cellValue(dsh, r, c);
    let rows = [];
    for (let r = g.r1; r <= g.r2; r++) { if (App.rowHidden(r, dsh)) continue; const row = []; for (let c = g.c1; c <= g.c2; c++) { if (App.colHidden(c, dsh)) continue; row.push(val(r, c)); } rows.push(row); }
    if (!rows.length) return null;
    if (ch.byRow) rows = rows[0].map((_, j) => rows.map((row) => row[j]));
    const isText = (v) => typeof v === 'string';
    const hasHeadRow = rows.length > 1 && rows[0].slice(1).some(isText) || (rows.length > 1 && rows[0].every((v) => isText(v) || v === null));
    const hasHeadCol = rows[0].length > 1 && rows.slice(hasHeadRow ? 1 : 0).some((r) => isText(r[0]) || (ch.kind !== 'scatter' && r[0] !== null && rows[0][0] === null));
    const body = rows.slice(hasHeadRow ? 1 : 0);
    const cats = hasHeadCol ? body.map((r) => NF.format(r[0], null).text) : body.map((_, i) => String(i + 1));
    const series = [];
    const startCol = hasHeadCol || ch.kind === 'scatter' ? 1 : 0;
    for (let j = startCol; j < rows[0].length; j++) {
      series.push({ name: hasHeadRow ? NF.format(rows[0][j]).text : (App.LANG === 'en' ? 'Series ' : 'Reeks ') + (j - startCol + 1), vals: body.map((r) => (typeof r[j] === 'number' ? r[j] : null)) });
    }
    if (ch.kind === 'scatter') {
      let xs = body.map((r) => (typeof r[0] === 'number' ? r[0] : null));
      if (!xs.some((x) => x !== null)) xs = body.map((_, i) => i + 1);   // geen getallen: 1, 2, 3 … (zoals Excel)
      series.forEach((s) => { s.xs = xs; });
      if (!series.length) series.push({ name: 'Reeks 1', vals: xs, xs: xs.map((_, i) => i + 1) });
    }
    const nfCell = App.getCell(dsh, g.r1 + (hasHeadRow && !ch.byRow ? 1 : 0), g.c1 + (hasHeadCol && !ch.byRow ? 1 : 0));
    return { cats, series, nf: nfCell && nfCell.s && nfCell.s.nf, title: ch.title ?? (series.length === 1 ? series[0].name : '') };
  };
  App.chartSvg = (o, w, h, sh = App.sh()) => {
    const ch = o.chart;
    const data = App.chartData(o, sh);
    const pal = App.CHART_PALETTES[ch.palette || 0] || App.CHART_PALETTES[0];
    const esc = App.esc;
    const font = 'font-family="Aptos, Calibri, Carlito, Segoe UI, sans-serif"';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${font}><rect width="${w}" height="${h}" fill="#fff"/>`;
    if (!data || !data.series.length) return s + `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="12" fill="#777">${App.LANG === 'en' ? 'No data to display' : 'Geen gegevens om weer te geven'}</text></svg>`;
    const title = ch.title !== undefined ? ch.title : data.title;
    let top = 10;
    if (title) { s += `<text x="${w / 2}" y="26" text-anchor="middle" font-size="15" fill="#404040">${esc(title)}</text>`; top = 40; }
    const kind = ch.kind || 'column';
    const pie = kind === 'pie' || kind === 'doughnut';
    const legendPos = ch.legend || (pie || data.series.length > 1 ? 'right' : 'none');
    const legendItems = pie ? data.cats.map((c, i) => ({ name: c, color: pal[i % pal.length] })) : data.series.map((sr, i) => ({ name: sr.name, color: pal[i % pal.length] }));
    let L = 12, R = w - 12, T = top, B = h - 12;
    if (legendPos === 'right') {
      const lw = Math.min(w * 0.35, 20 + Math.max(...legendItems.map((x) => x.name.length)) * 6.6);
      R = w - lw - 10;
      legendItems.slice(0, Math.floor((h - top) / 18)).forEach((it, i) => { const y = top + 10 + i * 18; s += `<rect x="${R + 14}" y="${y - 8}" width="10" height="10" fill="${it.color}"/><text x="${R + 30}" y="${y + 1}" font-size="11" fill="#595959">${esc(it.name.slice(0, 28))}</text>`; });
    } else if (legendPos === 'bottom' || legendPos === 'top') {
      const y = legendPos === 'bottom' ? h - 12 : top + 4;
      if (legendPos === 'bottom') B = h - 30; else T = top + 20;
      let x = 0; const parts = [];
      legendItems.forEach((it) => { parts.push({ x, it }); x += 22 + it.name.length * 6.4; });
      const off = Math.max(10, (w - x) / 2);
      parts.forEach(({ x: px, it }) => { s += `<rect x="${off + px}" y="${y - 9}" width="10" height="10" fill="${it.color}"/><text x="${off + px + 14}" y="${y}" font-size="11" fill="#595959">${esc(it.name.slice(0, 24))}</text>`; });
    }
    if (pie) {
      const vals = data.series[0].vals.map((v) => Math.max(0, v || 0));
      const total = vals.reduce((a, b) => a + b, 0) || 1;
      const cx = (L + R) / 2, cy = (T + B) / 2, rad = Math.max(10, Math.min(R - L, B - T) / 2 - 6);
      const inner = kind === 'doughnut' ? rad * 0.55 : 0;
      let a0 = -Math.PI / 2;
      vals.forEach((v, i) => {
        const a1 = a0 + (v / total) * Math.PI * 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (a, r) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
        if (v > 0) {
          if (v >= total) s += inner ? `<circle cx="${cx}" cy="${cy}" r="${(rad + inner) / 2}" fill="none" stroke="${pal[i % pal.length]}" stroke-width="${rad - inner}"/>` : `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${pal[i % pal.length]}"/>`;
          else s += `<path d="M ${p(a0, rad)} A ${rad} ${rad} 0 ${large} 1 ${p(a1, rad)} ${inner ? `L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)}` : `L ${cx} ${cy}`} Z" fill="${pal[i % pal.length]}" stroke="#fff" stroke-width="1.5"/>`;
          if (ch.labels) { const am = (a0 + a1) / 2, lr = inner ? (rad + inner) / 2 : rad * 0.65; s += `<text x="${cx + lr * Math.cos(am)}" y="${cy + lr * Math.sin(am) + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600">${Math.round(v / total * 100)}%</text>`; }
        }
        a0 = a1;
      });
      return s + '</svg>';
    }
    const horiz = kind === 'bar';
    const stacked = kind === 'stacked';
    const n = data.cats.length;
    let all = [];
    if (stacked) data.cats.forEach((_, i) => { let p = 0, q = 0; data.series.forEach((sr) => { const v = sr.vals[i] || 0; if (v >= 0) p += v; else q += v; }); all.push(p, q); });
    else data.series.forEach((sr) => sr.vals.forEach((v) => { if (v !== null) all.push(v); }));
    if (!all.length) all = [0, 1];
    let min = Math.min(0, ...all), max = Math.max(0, ...all);
    if (kind === 'line' || kind === 'scatter') { min = Math.min(...all); max = Math.max(...all); if (min > 0 && min < max * 0.5) min = 0; }
    const ax = nice(min, max);
    // x-as voor spreiding
    let xax = null;
    if (kind === 'scatter') { const xs = data.series[0].xs.filter((v) => v !== null); xax = nice(Math.min(...xs, 0), Math.max(...xs, 1)); }
    const labW = Math.max(...ax.ticks.map((t) => fmtAxis(t, data.nf).length)) * 6.5 + 8;
    const catW = horiz ? Math.min(120, Math.max(...data.cats.map((c) => c.length)) * 6.3 + 8) : 0;
    const PL = L + (horiz ? catW : labW), PR = R - 8, PT = T + 4, PB = B - (horiz ? 18 : 22);
    const W = PR - PL, H = PB - PT;
    if (W < 20 || H < 20) return s + '</svg>';
    const vy = (v) => PT + H - ((v - ax.lo) / (ax.hi - ax.lo)) * H;
    const vx = (v) => PL + ((v - ax.lo) / (ax.hi - ax.lo)) * W;
    // raster en as-labels
    ax.ticks.forEach((t) => {
      if (horiz) { const x = vx(t); if (ch.grid !== false) s += `<line x1="${x}" y1="${PT}" x2="${x}" y2="${PB}" stroke="#d9d9d9"/>`; s += `<text x="${x}" y="${PB + 14}" text-anchor="middle" font-size="10" fill="#595959">${esc(fmtAxis(t, data.nf))}</text>`; }
      else { const y = vy(t); if (ch.grid !== false) s += `<line x1="${PL}" y1="${y}" x2="${PR}" y2="${y}" stroke="#d9d9d9"/>`; s += `<text x="${PL - 6}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#595959">${esc(fmtAxis(t, data.nf))}</text>`; }
    });
    if (kind === 'scatter') {
      const sx = (v) => PL + ((v - xax.lo) / (xax.hi - xax.lo)) * W;
      xax.ticks.forEach((t) => { s += `<text x="${sx(t)}" y="${PB + 14}" text-anchor="middle" font-size="10" fill="#595959">${esc(fmtAxis(t))}</text>`; });
      data.series.forEach((sr, k) => sr.vals.forEach((v, i) => { const x = sr.xs[i]; if (v === null || x === null) return; s += `<circle cx="${sx(x)}" cy="${vy(v)}" r="4" fill="${pal[k % pal.length]}"/>`; }));
      s += `<line x1="${PL}" y1="${vy(Math.max(ax.lo, Math.min(0, ax.hi)))}" x2="${PR}" y2="${vy(Math.max(ax.lo, Math.min(0, ax.hi)))}" stroke="#bfbfbf"/>`;
      return s + '</svg>';
    }
    const band = (horiz ? H : W) / Math.max(1, n);
    // categorie-labels
    const step = Math.max(1, Math.ceil(n / Math.max(1, (horiz ? H / 14 : W / 46))));
    data.cats.forEach((c, i) => {
      if (i % step) return;
      if (horiz) s += `<text x="${PL - 6}" y="${PT + band * (i + 0.5) + 4}" text-anchor="end" font-size="10" fill="#595959">${esc(c.slice(0, 18))}</text>`;
      else s += `<text x="${PL + band * (i + 0.5)}" y="${PB + 14}" text-anchor="middle" font-size="10" fill="#595959">${esc(c.slice(0, Math.max(4, Math.floor(band * step / 6))))}</text>`;
    });
    const zero = horiz ? vx(Math.max(ax.lo, Math.min(0, ax.hi))) : vy(Math.max(ax.lo, Math.min(0, ax.hi)));
    if (kind === 'column' || kind === 'bar' || kind === 'stacked') {
      const ns = data.series.length;
      const gap = band * 0.25;
      const bw = stacked ? band - gap * 2 : (band - gap * 2) / ns;
      const posAcc = new Array(n).fill(0), negAcc = new Array(n).fill(0);
      data.series.forEach((sr, k) => sr.vals.forEach((v, i) => {
        if (v === null) return;
        let a, b;
        if (stacked) { if (v >= 0) { a = posAcc[i]; b = posAcc[i] += v; } else { a = negAcc[i]; b = negAcc[i] += v; } } else { a = 0; b = v; }
        const color = pal[k % pal.length];
        if (horiz) {
          const y = PT + band * i + gap + (stacked ? 0 : bw * k);
          const x1 = vx(Math.min(a, b)), x2 = vx(Math.max(a, b));
          s += `<rect x="${x1}" y="${y}" width="${Math.max(0, x2 - x1)}" height="${bw}" fill="${color}"/>`;
          if (ch.labels) s += `<text x="${x2 + 3}" y="${y + bw / 2 + 4}" font-size="10" fill="#404040">${esc(fmtAxis(v, data.nf))}</text>`;
        } else {
          const x = PL + band * i + gap + (stacked ? 0 : bw * k);
          const y1 = vy(Math.max(a, b)), y2 = vy(Math.min(a, b));
          s += `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y2 - y1)}" fill="${color}"/>`;
          if (ch.labels) s += `<text x="${x + bw / 2}" y="${(stacked ? (y1 + y2) / 2 + 4 : y1 - 4)}" text-anchor="middle" font-size="10" fill="${stacked ? '#fff' : '#404040'}">${esc(fmtAxis(v, data.nf))}</text>`;
        }
      }));
    } else if (kind === 'line' || kind === 'area') {
      data.series.forEach((sr, k) => {
        const color = pal[k % pal.length];
        const pts = sr.vals.map((v, i) => (v === null ? null : [PL + band * (i + 0.5), vy(v)]));
        const segs = []; let cur = [];
        pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
        if (cur.length) segs.push(cur);
        segs.forEach((seg) => {
          const d = seg.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
          if (kind === 'area') s += `<path d="${d} L ${seg[seg.length - 1][0].toFixed(1)} ${zero} L ${seg[0][0].toFixed(1)} ${zero} Z" fill="${color}" fill-opacity="${data.series.length > 1 ? 0.55 : 0.85}"/>`;
          else s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linejoin="round"/>`;
        });
        if (kind === 'line' && n <= 40) pts.forEach((p) => { if (p) s += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${color}"/>`; });
        if (ch.labels) pts.forEach((p, i) => { if (p) s += `<text x="${p[0]}" y="${p[1] - 7}" text-anchor="middle" font-size="10" fill="#404040">${esc(fmtAxis(sr.vals[i], data.nf))}</text>`; });
      });
    }
    s += horiz ? `<line x1="${zero}" y1="${PT}" x2="${zero}" y2="${PB}" stroke="#bfbfbf"/>` : `<line x1="${PL}" y1="${zero}" x2="${PR}" y2="${zero}" stroke="#bfbfbf"/>`;
    return s + '</svg>';
  };

  /* ---------- Objecten tekenen ---------- */
  const SHAPES = {
    rect: (w, h) => `<rect x="1" y="1" width="${w - 2}" height="${h - 2}"/>`,
    round: (w, h) => `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.min(w, h) * 0.15}"/>`,
    ellipse: (w, h) => `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}"/>`,
    triangle: (w, h) => `<polygon points="${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}"/>`,
    diamond: (w, h) => `<polygon points="${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}"/>`,
    arrow: (w, h) => `<polygon points="1,${h * 0.3} ${w * 0.65},${h * 0.3} ${w * 0.65},1 ${w - 1},${h / 2} ${w * 0.65},${h - 1} ${w * 0.65},${h * 0.7} 1,${h * 0.7}"/>`,
    star: (w, h) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.4 : 1; p.push(`${w / 2 + Math.cos(a) * (w / 2 - 1) * r},${h / 2 + Math.sin(a) * (h / 2 - 1) * r}`); } return `<polygon points="${p.join(' ')}"/>`; },
    hexagon: (w, h) => `<polygon points="${w * 0.25},1 ${w * 0.75},1 ${w - 1},${h / 2} ${w * 0.75},${h - 1} ${w * 0.25},${h - 1} 1,${h / 2}"/>`,
    line: (w, h) => `<line x1="1" y1="${h / 2}" x2="${w - 1}" y2="${h / 2}" stroke-width="2"/>`,
    callout: (w, h) => `<path d="M1 1 H${w - 1} V${h * 0.72} H${w * 0.35} L${w * 0.18} ${h - 1} L${w * 0.22} ${h * 0.72} H1 Z"/>`,
  };
  const SHAPE_NAMES = { rect: 'Rechthoek', round: 'Afgeronde rechthoek', ellipse: 'Ovaal', triangle: 'Driehoek', diamond: 'Ruit', arrow: 'Pijl', star: 'Ster', hexagon: 'Zeshoek', line: 'Lijn', callout: 'Tekstballon' };
  App.menuBuilders['m-shapes'] = () => Object.keys(SHAPES).map((k) => `<button data-cmd="insertShape" data-arg="${k}" title="${SHAPE_NAMES[k]}"><svg viewBox="0 0 30 30" fill="#dbe8f5" stroke="#156082" stroke-width="1.5">${SHAPES[k](30, 30)}</svg></button>`).join('');
  App.shapeSvg = (o) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.w} ${o.h}" fill="${o.fill || '#156082'}" stroke="${o.stroke || '#0f4761'}" stroke-width="1.5">${(SHAPES[o.shape] || SHAPES.rect)(o.w, o.h)}</svg>`;

  const nodes = new Map();
  App.renderObjects = () => {
    const sh = App.sh();
    const ids = new Set(sh.objs.map((o) => o.id));
    nodes.forEach((el, id) => { if (!ids.has(id)) { el.remove(); nodes.delete(id); } });
    sh.objs.forEach((o, i) => {
      let el = nodes.get(o.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'obj ' + o.type;
        el.dataset.id = o.id;
        el.innerHTML = '<div class="obj-body" style="width:100%;height:100%"></div>' + ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="h ${h}" data-h="${h}"></span>`).join('');
        layer.appendChild(el);
        nodes.set(o.id, el);
        o._key = null;
      }
      const V = App.view;
      const p = objXY(o, sh);
      const sp = toScreen(p.x, p.y);
      el.style.left = sp.x + 'px'; el.style.top = sp.y + 'px';
      el.style.width = o.w * V.z + 'px'; el.style.height = o.h * V.z + 'px';
      el.style.zIndex = String(i + 1);
      el.classList.toggle('sel', App.selectedObj === o);
      el.className = el.className.replace(/\bst-\S+/g, '').trim() + (o.style ? ' ' + o.style : '');
      const body = el.querySelector('.obj-body');
      if (o.type === 'chart') {
        const key = JSON.stringify(o.chart) + o.w + 'x' + o.h + ':' + App._chartVer;
        if (o._key !== key) { o._key = key; body.innerHTML = App.chartSvg(o, o.w, o.h, sh); }
      } else if (o.type === 'image') {
        const src = App.media[o.media] || o.media || '';
        if (o._key !== src.length + ':' + o.media) { o._key = src.length + ':' + o.media; body.innerHTML = `<img src="${App.esc(src)}" alt="${App.esc(o.alt || '')}" draggable="false">`; }
      } else if (o.type === 'shape') {
        const key = o.shape + o.fill + o.stroke + o.w + o.h;
        if (o._key !== key) { o._key = key; body.innerHTML = App.shapeSvg(o); }
      } else if (o.type === 'textbox') {
        if (o._key !== o.text && document.activeElement !== body.firstChild) { o._key = o.text; body.innerHTML = `<div class="tb-text">${App.esc(o.text || '')}</div>`; }
        body.style.fontSize = 11 * 96 / 72 * V.z + 'px';
      }
    });
  };
  App._chartVer = 0;
  App.on('render', () => App.renderObjects());
  App.on('change', () => { App._chartVer++; App.renderObjects(); });
  App.on('sheet', () => { nodes.forEach((el) => el.remove()); nodes.clear(); App.selectedObj = null; App.renderObjects(); });

  /* ---------- Selecteren, slepen, schalen ---------- */
  App.selectedObj = null;
  App.selectObj = (o) => {
    if (App.state.editing) App.commitEdit();
    App.selectedObj = o;
    App.renderObjects();
    App.setContext({ chart: o && o.type === 'chart', picture: o && o.type !== 'chart' });
    $('#grp-shape').hidden = !(o && o.type === 'shape');
    if (o && o.type === 'shape') { $('#shape-fill').value = o.fill || '#156082'; $('#shape-stroke').value = o.stroke || '#0f4761'; }
    if (o && o.type === 'chart') renderPalettes();
    App.scheduleState();
    App.focusGrid();
  };
  App.deselectObj = () => {
    if (!App.selectedObj) return;
    App.selectedObj = null;
    App.renderObjects();
    App.setContext({ chart: false, picture: false });
  };
  layer.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.obj'); if (!el) return;
    const sh = App.sh();
    const o = sh.objs.find((x) => x.id === el.dataset.id); if (!o) return;
    if (e.target.closest('.tb-text[contenteditable="true"]')) return;
    e.preventDefault(); e.stopPropagation();
    App.selectObj(o);
    const handle = e.target.closest('[data-h]');
    const z = App.view.z;
    const start = { x: e.clientX, y: e.clientY, w: o.w, h: o.h };
    const objStart = objXY(o, sh);
    const ratio = o.w / o.h;
    el.setPointerCapture(e.pointerId);
    let moved = false;
    const move = (ev) => {
      const dx = (ev.clientX - start.x) / z, dy = (ev.clientY - start.y) / z;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (!handle) anchorFrom(o, objStart.x + dx, objStart.y + dy);
      else {
        const hdl = handle.dataset.h;
        let x = objStart.x, y = objStart.y, w = start.w, h = start.h;
        if (hdl.includes('e')) w = Math.max(16, start.w + dx);
        if (hdl.includes('s')) h = Math.max(12, start.h + dy);
        if (hdl.includes('w')) { w = Math.max(16, start.w - dx); x = objStart.x + start.w - w; }
        if (hdl.includes('n')) { h = Math.max(12, start.h - dy); y = objStart.y + start.h - h; }
        if ((ev.shiftKey || o.type === 'image') && hdl.length === 2) { if (w / h > ratio) w = h * ratio; else h = w / ratio; if (hdl.includes('w')) x = objStart.x + start.w - w; if (hdl.includes('n')) y = objStart.y + start.h - h; }
        o.w = Math.round(w); o.h = Math.round(h);
        anchorFrom(o, x, y);
      }
      App.renderObjects();
    };
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      if (moved) App.run(() => true, { allowProtected: true });
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  });
  layer.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.obj'); if (!el) return;
    const o = App.sh().objs.find((x) => x.id === el.dataset.id); if (!o) return;
    if (o.type === 'chart') App.exec('chartData');
    if (o.type === 'textbox' || o.type === 'shape') editText(o, el);
  });
  const editText = (o, el) => {
    if (o.type === 'shape') { App.prompt('Tekst in vorm', 'Tekst', o.text || '').then((t) => { if (t !== null) App.run(() => { o.text = t; }); }); return; }
    const t = el.querySelector('.tb-text');
    t.contentEditable = 'true'; t.focus();
    const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const done = () => { t.contentEditable = 'false'; const txt = t.innerText.replace(/\n$/, ''); if (txt !== o.text) App.run(() => { o.text = txt; o._key = txt; }); t.removeEventListener('blur', done); };
    t.addEventListener('blur', done);
    t.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') t.blur(); });
  };
  layer.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.obj'); if (!el) return;
    e.preventDefault();
    const o = App.sh().objs.find((x) => x.id === el.dataset.id); if (!o) return;
    App.selectObj(o);
    App.openPopup({ x: e.clientX, y: e.clientY }, `${o.type === 'chart' ? '<button data-cmd="chartData"><span class="i">dataset</span> Gegevens selecteren…</button><button data-cmd="chartTitle"><span class="i">title</span> Grafiektitel…</button><hr>' : ''}
      <button data-cmd="objFront"><span class="i">flip_to_front</span> Naar voren</button><button data-cmd="objBack"><span class="i">flip_to_back</span> Naar achteren</button>
      ${o.type === 'image' ? '<button data-cmd="imgAlt"><span class="i">closed_caption</span> Alternatieve tekst…</button>' : ''}<hr><button data-cmd="objDelete"><span class="i">delete</span> Verwijderen</button>`, 'ctx-menu');
  });
  App.defEdit('objDelete', () => { const o = App.selectedObj; if (!o) return false; const sh = App.sh(); sh.objs = sh.objs.filter((x) => x !== o); App.deselectObj(); }, { allowProtected: true });
  App.defEdit('objFront', () => { const o = App.selectedObj; if (!o) return false; const sh = App.sh(); sh.objs = sh.objs.filter((x) => x !== o).concat(o); });
  App.defEdit('objBack', () => { const o = App.selectedObj; if (!o) return false; const sh = App.sh(); sh.objs = [o].concat(sh.objs.filter((x) => x !== o)); });

  // nieuw object bij de actieve cel / zichtbaar gebied
  const placeNew = (o) => {
    const sh = App.sh(); const s = sh.sel;
    const g = App.selRange();
    const c = Math.min(g.c2 + 2, App.MAXC - 10), r = Math.max(0, g.r1);
    o.id = App.uid('o'); o.r = r; o.c = c; o.dx = 0; o.dy = 0;
    // zorgen dat het zichtbaar is
    if (!App.visible || !App.visible.rows.includes(r)) { o.r = s.ar; o.c = s.ac + 1; }
    sh.objs.push(o);
    App.selectedObj = o;
    setTimeout(() => App.selectObj(o), 0);
    return o;
  };

  /* ---------- Grafiek invoegen en bewerken ---------- */
  App.defEdit('insertChart', (kind = 'column') => {
    const sh = App.sh(); const s = sh.sel;
    let g = App.selRange();
    if (g.r1 === g.r2 && g.c1 === g.c2) g = App.currentRegion(sh, s.ar, s.ac);
    if (!g) { App.toast('Selecteer eerst de gegevens voor de grafiek (bijvoorbeeld A1:C6).', 'info', { ms: 4000 }); return false; }
    g = App.selBounded(g, sh);
    const o = placeNew({ type: 'chart', w: 480, h: 290, chart: { kind, range: App.sheetRef(sh.name) + '!' + App.absRangeStr(g), legend: undefined, labels: false, grid: true, palette: 0 } });
    o.c = g.c2 + 2; o.r = g.r1;
    return true;
  }, { allowProtected: true });
  const chartOf = () => (App.selectedObj && App.selectedObj.type === 'chart' ? App.selectedObj : null);
  App.defEdit('chartType', (k) => { const o = chartOf(); if (!o) return false; o.chart.kind = k; });
  App.defEdit('chartSwap', () => { const o = chartOf(); if (!o) return false; o.chart.byRow = !o.chart.byRow; });
  App.defEdit('chartLegend', (p) => { const o = chartOf(); if (!o) return false; o.chart.legend = p; });
  App.defEdit('chartLabels', () => { const o = chartOf(); if (!o) return false; o.chart.labels = !o.chart.labels; });
  App.defEdit('chartGrid', () => { const o = chartOf(); if (!o) return false; o.chart.grid = o.chart.grid === false; });
  App.defEdit('chartPalette', (i) => { const o = chartOf(); if (!o) return false; o.chart.palette = +i; renderPalettes(); });
  App.stateFns.chartLabels = () => !!(chartOf() && chartOf().chart.labels);
  App.stateFns.chartGrid = () => !!(chartOf() && chartOf().chart.grid !== false);
  const renderPalettes = () => {
    const o = chartOf();
    $('#chart-palettes').innerHTML = App.CHART_PALETTES.map((p, i) => `<button class="pal-chip${o && (o.chart.palette || 0) === i ? ' on' : ''}" data-cmd="chartPalette" data-arg="${i}" title="Kleurenset ${i + 1}">${p.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join('')}</button>`).join('');
  };
  App.def('chartTitle', async () => {
    const o = chartOf(); if (!o) return;
    const cur = o.chart.title !== undefined ? o.chart.title : (App.chartData(o, App.sh()) || {}).title || '';
    const t = await App.prompt('Grafiektitel', 'Titel (leeg laten voor geen titel)', cur);
    if (t === null) return;
    App.run(() => { o.chart.title = t; });
  });
  App.def('chartData', () => {
    const o = chartOf(); if (!o) return;
    App.dialog({
      title: 'Gegevensbron selecteren', wide: true,
      body: `<label class="field"><span>Gegevensbereik van grafiek</span><input id="cd-r" value="${App.esc('=' + F.toLocal(o.chart.range))}"></label>
        <label class="chk"><input type="checkbox" id="cd-row" ${o.chart.byRow ? 'checked' : ''}> Reeksen in rijen (in plaats van kolommen)</label>
        <div class="chart-preview" id="cd-prev" style="margin-top:10px"></div>`,
      onOpen: (d) => {
        const prev = () => { const tmp = { ...o, chart: { ...o.chart, range: F.toCanon(d.$('#cd-r').value.replace(/^=/, '')), byRow: d.$('#cd-row').checked } }; d.$('#cd-prev').innerHTML = App.chartSvg(tmp, 520, 220); };
        d.body.addEventListener('input', prev); d.body.addEventListener('change', prev); prev();
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { App.run(() => { o.chart.range = F.toCanon(d.$('#cd-r').value.replace(/^=/, '')); o.chart.byRow = d.$('#cd-row').checked; }); } }],
    });
  });

  /* ---------- Afbeeldingen, vormen, tekstvakken ---------- */
  const shrinkImage = (url, max = 1600) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      if (k >= 1 || /^data:image\/(gif|svg)/.test(url)) { res({ url, w: img.naturalWidth, h: img.naturalHeight }); return; }
      const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      res({ url: cv.toDataURL(/png/.test(url.slice(0, 30)) ? 'image/png' : 'image/jpeg', 0.9), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => res(null);
    img.src = url;
  });
  App.insertImageFile = async (file) => {
    const url = await App.readFile(file, 'dataurl');
    const r = await shrinkImage(url);
    if (!r) { App.toast('Deze afbeelding kan niet worden gelezen.', 'error'); return; }
    const id = App.uid('m'); App.media[id] = r.url;
    const k = Math.min(1, 480 / r.w, 360 / r.h);
    App.run(() => { placeNew({ type: 'image', media: id, w: Math.round(r.w * k), h: Math.round(r.h * k), nw: r.w, nh: r.h, alt: file.name || '' }); }, { allowProtected: true });
  };
  App.def('imageFromFile', async () => { const f = await App.pickFile('image/*'); if (f) App.insertImageFile(f); });
  App.def('imageFromUrl', async () => {
    const u = await App.prompt('Afbeelding van internet', 'Internetadres van de afbeelding', 'https://');
    if (!u || !/^https?:\/\//i.test(u)) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      let url = u;
      try { const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img, 0, 0); url = cv.toDataURL('image/png'); } catch { /* blijft een koppeling */ }
      const id = App.uid('m'); App.media[id] = url;
      const k = Math.min(1, 480 / img.naturalWidth, 360 / img.naturalHeight);
      App.run(() => { placeNew({ type: 'image', media: id, w: Math.round(img.naturalWidth * k), h: Math.round(img.naturalHeight * k), nw: img.naturalWidth, nh: img.naturalHeight }); }, { allowProtected: true });
    };
    img.onerror = () => App.toast('De afbeelding kon niet worden geladen.', 'error');
    img.src = u;
  });
  App.defEdit('insertShape', (k) => { placeNew({ type: 'shape', shape: k, w: k === 'line' ? 160 : 140, h: k === 'line' ? 20 : 90, fill: k === 'line' ? 'none' : '#156082', stroke: '#0f4761' }); }, { allowProtected: true });
  App.defEdit('shapeFill', (c) => { const o = App.selectedObj; if (o && o.type === 'shape') o.fill = c; });
  App.defEdit('shapeStroke', (c) => { const o = App.selectedObj; if (o && o.type === 'shape') o.stroke = c; });
  App.defEdit('textBox', () => { placeNew({ type: 'textbox', w: 200, h: 80, text: 'Typ hier je tekst' }); }, { allowProtected: true });
  App.defEdit('imgStyle', (st) => { const o = App.selectedObj; if (!o || o.type !== 'image') return false; o.style = st || undefined; });
  App.defEdit('imgReset', () => { const o = App.selectedObj; if (!o || o.type !== 'image' || !o.nw) return false; const k = Math.min(1, 800 / o.nw); o.w = Math.round(o.nw * k); o.h = Math.round(o.nh * k); });
  App.def('imgAlt', async () => { const o = App.selectedObj; if (!o || o.type !== 'image') return; const t = await App.prompt('Alternatieve tekst', 'Beschrijving van de afbeelding (voor schermlezers)', o.alt || ''); if (t !== null) App.run(() => { o.alt = t; }); });

  /* ---------- Notities ---------- */
  let hoverPop = null, hoverKey = null;
  const notePos = (r, c) => { const a = App.cellRect(r, c); const z = App.view.z; return { x: (a.x + a.w) * z + 8, y: a.y * z }; };
  App.hideNotePop = () => { if (hoverPop) { hoverPop.remove(); hoverPop = null; hoverKey = null; } };
  App.hoverCell = (h) => {
    if (App.state.notes) return;
    const sh = App.sh();
    if (h.area !== 'cell' && h.area !== 'edge') { App.hideNotePop(); return; }
    const cell = App.getCell(sh, h.r, h.c);
    const key = h.r + ':' + h.c;
    if (!cell || !cell.n) { if (hoverPop && !hoverPop.querySelector('textarea')) App.hideNotePop(); if (cell && cell.l) $('#grid-scroll').title = 'Ctrl+klik om de koppeling te volgen: ' + cell.l; else $('#grid-scroll').title = ''; return; }
    if (hoverKey === key) return;
    App.hideNotePop();
    const p = notePos(h.r, h.c);
    hoverPop = document.createElement('div'); hoverPop.className = 'note-pop';
    hoverPop.style.left = p.x + 'px'; hoverPop.style.top = p.y + 'px';
    hoverPop.textContent = cell.n;
    noteLayer.appendChild(hoverPop); hoverKey = key;
  };
  const renderAllNotes = () => {
    noteLayer.querySelectorAll('.note-all').forEach((x) => x.remove());
    if (!App.state.notes) return;
    const sh = App.sh();
    App.eachCell(sh, (r, c, cell) => {
      if (!cell.n || !App.visible || !App.visible.rows.includes(r) || !App.visible.cols.includes(c)) return;
      const p = notePos(r, c);
      const el = document.createElement('div'); el.className = 'note-pop note-all';
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.textContent = cell.n;
      noteLayer.appendChild(el);
    });
  };
  App.on('render', renderAllNotes);
  App.def('toggleNotes', () => { App.state.notes = !App.state.notes; App.hideNotePop(); renderAllNotes(); App.scheduleState(); });
  App.stateFns.notes = () => App.state.notes;
  const openNoteEditor = () => {
    const sh = App.sh(); const s = sh.sel;
    if (App.state.editing) App.commitEdit();
    App.hideNotePop();
    App.scrollToCell(s.ar, s.ac);
    App.computeView();
    const p = notePos(s.ar, s.ac);
    const cell = App.getCell(sh, s.ar, s.ac);
    const el = document.createElement('div'); el.className = 'note-pop';
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.innerHTML = '<textarea placeholder="Typ een notitie…"></textarea>';
    noteLayer.appendChild(el);
    hoverPop = el; hoverKey = 'edit';
    const ta = el.querySelector('textarea'); ta.value = (cell && cell.n) || '';
    ta.focus();
    const r = s.ar, c = s.ac;
    const save = () => {
      const t = ta.value.trim();
      const cur = App.getCell(sh, r, c);
      if ((cur && cur.n || '') !== t) App.run(() => { const cc = App.cellAt(sh, r, c); if (t) cc.n = t; else delete cc.n; App.cleanCell(sh, r, c); }, { allowProtected: true });
      el.remove(); if (hoverPop === el) { hoverPop = null; hoverKey = null; }
      App.focusGrid();
    };
    ta.addEventListener('blur', save);
    ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { ta.blur(); } });
  };
  App.def('newNote', openNoteEditor);
  App.def('editNote', openNoteEditor);
  App.defEdit('deleteNote', () => { const sh = App.sh(); let n = 0; App.selRanges().forEach((g) => App.eachInRange(sh, App.selBounded(g, sh), (r, c, cell) => { if (cell.n) { delete cell.n; n++; App.cleanCell(sh, r, c); } })); return n > 0; }, { allowProtected: true });
  const noteStep = (dir) => {
    const sh = App.sh(); const s = sh.sel;
    const list = []; App.eachCell(sh, (r, c, cell) => { if (cell.n) list.push({ r, c }); });
    if (!list.length) { App.toast('Er staan geen notities op dit blad.', 'info'); return; }
    list.sort((a, b) => a.r - b.r || a.c - b.c);
    const cur = s.ar * 20000 + s.ac;
    const next = dir > 0 ? list.find((x) => x.r * 20000 + x.c > cur) || list[0] : [...list].reverse().find((x) => x.r * 20000 + x.c < cur) || list[list.length - 1];
    App.selectCell(next.r, next.c); App.scrollToCell(next.r, next.c);
    setTimeout(() => App.hoverCell({ area: 'cell', r: next.r, c: next.c }), 50);
  };
  App.def('nextNote', () => noteStep(1));
  App.def('prevNote', () => noteStep(-1));

  /* ---------- Koppelingen ---------- */
  App.followLink = (l) => {
    if (!l) return;
    if (l[0] === '#') { if (!App.gotoRef(l.slice(1))) App.toast('Verwijzing niet gevonden: ' + l.slice(1), 'error'); return; }
    // alleen gewone webadressen: een bestand van een ander mag geen javascript:- of file:-koppeling laten openen
    if (!/^(https?:|mailto:|tel:)/i.test(l.trim())) { App.toast('Deze koppeling kan niet worden geopend: ' + l.slice(0, 60), 'error'); return; }
    window.open(l, '_blank', 'noopener');
  };
  App.def('followLinkCmd', () => { const sh = App.sh(); const s = sh.sel; const c = App.getCell(sh, s.ar, s.ac); if (c && c.l) App.followLink(c.l); });
  App.def('link', () => {
    if (App.state.editing) App.commitEdit();
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    const disp = cell && App.hasValue(cell) ? NF.format(App.valueOf(cell), App.styleAt(sh, s.ar, s.ac).nf).text : '';
    const cur = (cell && cell.l) || '';
    App.dialog({
      title: 'Koppeling invoegen',
      body: `<div class="seg" id="ln-kind"><button data-k="web" class="${cur[0] === '#' ? '' : 'on'}">Webpagina of e-mail</button><button data-k="doc" class="${cur[0] === '#' ? 'on' : ''}">Plaats in deze werkmap</button></div>
        <label class="field"><span>Weer te geven tekst</span><input id="ln-t" value="${App.esc(disp)}"></label>
        <label class="field" id="ln-aw"><span>Adres</span><input id="ln-a" value="${App.esc(cur[0] === '#' ? '' : cur)}" placeholder="https://… of naam@voorbeeld.nl"></label>
        <label class="field" id="ln-dw" hidden><span>Celverwijzing (bijv. Blad2!A1 of een naam)</span><input id="ln-d" value="${App.esc(cur[0] === '#' ? cur.slice(1) : '')}"></label>`,
      onOpen: (d) => {
        const set = (k) => { d.$$('#ln-kind button').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); d.$('#ln-aw').hidden = k !== 'web'; d.$('#ln-dw').hidden = k !== 'doc'; };
        d.$('#ln-kind').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) set(b.dataset.k); });
        set(cur[0] === '#' ? 'doc' : 'web');
      },
      buttons: [{ label: 'Koppeling verwijderen', left: true, action: () => { App.exec('clear', 'links'); } }, { label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const doc = !d.$('#ln-dw').hidden;
          let a = doc ? '#' + d.$('#ln-d').value.trim() : d.$('#ln-a').value.trim();
          if (!doc && a && !/^[a-z]+:/i.test(a)) a = /@/.test(a) ? 'mailto:' + a : 'https://' + a;
          const t = d.$('#ln-t').value;
          App.run(() => {
            const c = App.cellAt(sh, s.ar, s.ac);
            if (a && a !== '#') c.l = a; else delete c.l;
            if (t !== disp) { App.setCellFromText(sh, s.ar, s.ac, t || a, { autoLink: false }); App.cellAt(sh, s.ar, s.ac).l = a; }
            else if (!App.hasValue(c) && a) c.v = a.replace(/^mailto:/, '');
            App.cleanCell(sh, s.ar, s.ac);
          });
        },
      }],
    });
  });

  /* ---------- Symbolen, datum en tijd ---------- */
  const SYMBOLS = '€ £ $ ¥ ¢ © ® ™ § ¶ ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∆ π Ω µ α β γ δ ε λ σ φ ½ ⅓ ¼ ¾ ⅛ ² ³ ¹ ‰ ← → ↑ ↓ ↔ ⇒ ⇔ ✓ ✔ ✗ ✘ ★ ☆ ● ○ ■ □ ▲ △ ▼ ▽ ◆ ◇ ♠ ♣ ♥ ♦ ☺ ☹ ☀ ☁ ☂ ☎ ✉ ✂ ✎ ⌚ ⌛ ⚠ ⚡ « » „ “ ” ‘ ’ – — … • · ¿ ¡ ß æ ø å é è ë ê ï ö ü ç ñ'.split(' ');
  App.def('symbol', () => {
    App.dialog({
      title: 'Symbool', wide: true,
      body: `<div class="sym-grid">${SYMBOLS.map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div>`,
      onOpen: (d) => d.body.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; d.close(); insertText(b.dataset.s); }),
      buttons: [],
    });
  });
  const insertText = (t) => {
    if (App.state.editing) {
      const el = $('#cell-editor'); const p = el.selectionStart; el.value = el.value.slice(0, p) + t + el.value.slice(el.selectionEnd); el.setSelectionRange(p + t.length, p + t.length); el.dispatchEvent(new Event('input')); el.focus();
      return;
    }
    const sh = App.sh(); const s = sh.sel;
    App.startEdit({ mode: 'edit', initial: App.editTextOf(sh, s.ar, s.ac) + t });
  };
  App.def('insertDate', () => {
    const d = new Date();
    if (App.state.editing) { insertText(`${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`); return; }
    App.exec('setCellText', `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`);
  });
  App.def('insertTime', () => {
    const d = new Date();
    const t = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (App.state.editing) { insertText(t); return; }
    App.exec('setCellText', t);
  });
})();
