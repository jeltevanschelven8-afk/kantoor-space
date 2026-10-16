/* =========================================================
   Inkt — tabblad Tekenen: pennen, markeerstift, gum, tekenvlak.
   Tekenen gebeurt op een laag boven het document; bij stoppen worden de
   streken als SVG-afbeelding in het document gezet (zwevend voor de tekst,
   of in het tekenvlak als je daarbinnen tekent). Muis, pen en aanraking.
   ========================================================= */
'use strict';

App.MM = 96 / 25.4;   // px per mm
App.DRAW_DEFAULT_PENS = [
  { type: 'pen', color: '#000000', mm: 0.5 },
  { type: 'pen', color: '#c00000', mm: 1 },
  { type: 'pen', color: '#0070c0', mm: 2 },
  { type: 'hl', color: '#ffff00', mm: 6 },
];
App.DRAW_COLORS = ['#000000', '#ffffff', '#7f7f7f', '#c00000', '#ff0000', '#ff8c00', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0', '#e83e8c', '#8b4513'];
App.DRAW_PEN_MM = [0.25, 0.35, 0.5, 0.7, 1, 2, 3.5];
App.DRAW_HL_MM = [2, 4, 6, 8, 10];

App.draw = {
  active: false,          // tekenlaag zichtbaar
  tool: 'pen0',           // pen0..pen3 | eraser
  strokes: [],            // { tool, color, w, opacity, pts: [[x,y],...] } in editor-coördinaten
  layer: null,
  pens: (() => { const p = App.store.get('drawPens', null); return Array.isArray(p) && p.length === 4 ? p : App.DRAW_DEFAULT_PENS.map((x) => ({ ...x })); })(),
  savePens() { App.store.set('drawPens', this.pens); App.drawPaintButtons(); },
};
App.penOf = (tool) => App.draw.pens[+String(tool).replace('pen', '')] || App.draw.pens[0];

/* Pad door de punten (vloeiend via kwadratische bochten) */
App.strokePath = (pts, dx = 0, dy = 0) => {
  if (!pts.length) return '';
  const f = (v) => Math.round(v * 10) / 10;
  if (pts.length === 1) { const [x, y] = pts[0]; return `M${f(x - dx)},${f(y - dy)} l0.01,0`; }
  let d = `M${f(pts[0][0] - dx)},${f(pts[0][1] - dy)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${f(pts[i][0] - dx)},${f(pts[i][1] - dy)} ${f(mx - dx)},${f(my - dy)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${f(l[0] - dx)},${f(l[1] - dy)}`;
};
App.strokeSvg = (s, dx = 0, dy = 0) => `<path d="${App.strokePath(s.pts, dx, dy)}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-linecap="${s.hl ? 'butt' : 'round'}" stroke-linejoin="round"${s.hl ? ' stroke-opacity="0.45"' : ''}/>`;
App.strokesBox = (list) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  list.forEach((s) => s.pts.forEach(([x, y]) => { const h = s.w / 2 + 2; x0 = Math.min(x0, x - h); y0 = Math.min(y0, y - h); x1 = Math.max(x1, x + h); y1 = Math.max(y1, y + h); }));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
App.inkSvg = (list, box, size) => {
  const W = size ? size.w : box.w, H = size ? size.h : box.h;
  const hl = list.filter((s) => s.hl), pen = list.filter((s) => !s.hl);
  // markeerstift onder de pen, zoals in Word
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(H)}" width="${Math.ceil(W)}" height="${Math.ceil(H)}">${hl.concat(pen).map((s) => App.strokeSvg(s, box.x, box.y)).join('')}</svg>`;
};

/* ---------- Tekenlaag ---------- */
App.drawPoint = (e) => {
  const r = App.ed.getBoundingClientRect(), z = App.state.zoom;
  return [(e.clientX - r.left) / z, (e.clientY - r.top) / z];
};
App.drawSizeLayer = () => {
  const L = App.draw.layer;
  if (!L) return;
  const ed = App.ed, sh = $('#sheets');
  Object.assign(L.style, { left: ed.offsetLeft + 'px', top: ed.offsetTop + 'px', width: ed.offsetWidth + 'px', height: Math.max(ed.offsetHeight, sh ? sh.scrollHeight : 0) + 'px' });
};
App.on('layout', () => App.drawSizeLayer());
App.drawStart = (tool) => {
  const d = App.draw;
  if (tool) d.tool = tool;
  if (!d.active) {
    if (App.state.view !== 'print') App.exec('viewPrint');
    if (App.state.hfEditing) App.closeHF(true);
    if (App.deselectObj) App.deselectObj();
    App.minibar.hide();
    d.active = true;
    const L = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    L.id = 'draw-layer';
    L.innerHTML = '<g class="dl-hl"></g><g class="dl-pen"></g>';
    $('#pages').appendChild(L);
    d.layer = L;
    App.drawSizeLayer();
    L.addEventListener('pointerdown', App.drawDown);
    L.addEventListener('pointermove', App.drawMove);
    L.addEventListener('pointerup', App.drawUp);
    L.addEventListener('pointercancel', App.drawUp);
    L.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.classList.add('drawing');
  }
  document.body.dataset.drawTool = d.tool === 'eraser' ? 'eraser' : App.penOf(d.tool).type;
  App.scheduleState();
};
App.drawStop = () => {
  const d = App.draw;
  if (!d.active) return;
  const list = d.strokes;
  d.strokes = []; d.cur = null; d.active = false;
  if (d.layer) d.layer.remove();
  d.layer = null;
  document.body.classList.remove('drawing');
  delete document.body.dataset.drawTool;
  if (list.length) App.drawCommit(list);
  App.scheduleState();
};
App.drawDown = (e) => {
  const d = App.draw;
  if (e.button > 0) return;
  e.preventDefault();
  try { d.layer.setPointerCapture(e.pointerId); } catch { /* niets */ }
  const p = App.drawPoint(e);
  if (d.tool === 'eraser') { d.erasing = true; App.drawErase(p); return; }
  const pen = App.penOf(d.tool), hl = pen.type === 'hl';
  const w = Math.max(0.6, pen.mm * App.MM * (e.pointerType === 'pen' && !hl && e.pressure ? 0.6 + e.pressure * 0.8 : 1));
  const s = { color: pen.color, w: Math.round(w * 10) / 10, hl, pts: [p] };
  s.el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  d.layer.querySelector(hl ? '.dl-hl' : '.dl-pen').appendChild(s.el);
  d.cur = s;
  App.drawRender(s);
};
App.drawMove = (e) => {
  const d = App.draw;
  if (d.erasing) { App.drawErase(App.drawPoint(e)); return; }
  const s = d.cur;
  if (!s) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  (evs.length ? evs : [e]).forEach((ev) => {
    const p = App.drawPoint(ev), l = s.pts[s.pts.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) >= 0.8) s.pts.push(p);
  });
  App.drawRender(s);
};
App.drawUp = () => {
  const d = App.draw;
  d.erasing = false;
  if (!d.cur) return;
  d.strokes.push(d.cur);
  d.cur = null;
};
App.drawRender = (s) => {
  const el = s.el;
  el.setAttribute('d', App.strokePath(s.pts));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', s.color);
  el.setAttribute('stroke-width', s.w);
  el.setAttribute('stroke-linecap', s.hl ? 'butt' : 'round');
  el.setAttribute('stroke-linejoin', 'round');
  if (s.hl) el.setAttribute('stroke-opacity', '0.45');
};
App.segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? App.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
App.drawErase = (p) => {
  const d = App.draw;
  d.strokes = d.strokes.filter((s) => {
    const hit = s.pts.some((q, i) => App.segDist(p, q, s.pts[i + 1] || q) <= s.w / 2 + 5 / App.state.zoom);
    if (hit && s.el) s.el.remove();
    return !hit;
  });
};
App.drawUndo = () => { const s = App.draw.strokes.pop(); if (s && s.el) s.el.remove(); };

/* ---------- Streken in het document zetten ---------- */
App.edRectOf = (el) => {
  const z = App.state.zoom, er = App.ed.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: (r.left - er.left) / z, y: (r.top - er.top) / z, w: r.width / z, h: r.height / z };
};
App.canvasSvg = (strokes, cw, ch) => (strokes.length
  ? App.inkSvg(strokes, { x: 0, y: 0 }, { w: cw, h: ch })
  : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cw} ${ch}" width="${cw}" height="${ch}"><rect x="1" y="1" width="${cw - 2}" height="${ch - 2}" fill="none" stroke="#bdbdbd" stroke-dasharray="6 4"/></svg>`);
App.packStrokes = (list, dx, dy, k = 1) => list.map((s) => ({ color: s.color, w: Math.round(s.w * k * 10) / 10, hl: s.hl, pts: s.pts.map(([x, y]) => [Math.round((x - dx) * k * 10) / 10, Math.round((y - dy) * k * 10) / 10]) }));
App.drawCommit = (list) => {
  const canvases = $$('img[data-drawcanvas]', App.ed).map((img) => ({ img, r: App.edRectOf(img), add: [] }));
  const floating = [];
  list.forEach((s) => {
    const b = App.strokesBox([s]), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const c = canvases.find((v) => cx >= v.r.x && cx <= v.r.x + v.r.w && cy >= v.r.y && cy <= v.r.y + v.r.h);
    if (c) c.add.push(s); else floating.push(s);
  });
  let made = null;
  App.run(() => {
    canvases.filter((c) => c.add.length).forEach(({ img, r, add }) => {
      const cw = +img.dataset.cw || 600, ch = +img.dataset.ch || 220, k = cw / r.w;
      const all = JSON.parse(img.dataset.ink || '[]').concat(App.packStrokes(add, r.x, r.y, k));
      img.dataset.ink = JSON.stringify(all);
      img.src = App.svgUrl(App.canvasSvg(all, cw, ch));
    });
    if (!floating.length) return;
    const box = App.strokesBox(floating);
    const packed = App.packStrokes(floating, box.x, box.y);
    const img = document.createElement('img');
    img.src = App.svgUrl(App.inkSvg(packed, { x: 0, y: 0 }, { w: box.w, h: box.h }));
    img.alt = 'Inkttekening';
    img.className = 'wrap-front';
    img.dataset.ink = JSON.stringify(packed);
    Object.assign(img.style, { left: Math.round(box.x) + 'px', top: Math.round(box.y) + 'px', width: Math.round(box.w) + 'px', zIndex: 3 });
    // aan de alinea op die hoogte hangen (de editor blijft het referentiepunt)
    const tops = Array.from(App.ed.children).filter((el) => /^(P|H[1-6])$/.test(el.tagName));
    let anchor = tops[0] || null;
    tops.forEach((el) => { if (el.offsetTop <= box.y) anchor = el; });
    if (!anchor) { anchor = document.createElement('p'); anchor.innerHTML = '<br>'; App.ed.prepend(anchor); }
    anchor.prepend(img);
    made = img;
  });
  if (made) App.toast('Tekening ingevoegd. Je kunt hem verslepen, vergroten of verwijderen als afbeelding.', 'draw', { ms: 3000 });
};

/* ---------- Tekenvlak ---------- */
App.def('drawCanvas', () => {
  const cw = 600, ch = 240;
  App.restoreRange();
  const w = Math.min(App.contentWidth(), 600);
  App.run(() => {
    const p = document.createElement('p');
    const img = document.createElement('img');
    img.src = App.svgUrl(App.canvasSvg([], cw, ch));
    img.alt = 'Tekenvlak';
    img.dataset.drawcanvas = '1'; img.dataset.cw = cw; img.dataset.ch = ch; img.dataset.ink = '[]';
    img.style.width = Math.round(w) + 'px';
    p.appendChild(img);
    App.insertBlockAtCaret(p, { keepEmpty: true });
  });
  App.drawStart(App.draw.tool === 'eraser' ? 'pen0' : App.draw.tool);
  App.toast('Teken in het tekenvlak. Druk op Esc of kies Stoppen met tekenen als je klaar bent.', 'draw', { ms: 3500 });
});

/* ---------- Commando's en lint ---------- */
App.drawPenIcon = (p) => (p.type === 'hl' ? 'ink_highlighter' : 'stylus');
App.drawPaintButtons = () => {
  $$('[data-pen]').forEach((b) => {
    const p = App.draw.pens[+b.dataset.pen];
    if (!p) return;
    const sw = b.querySelector('.pen-sw');
    if (sw) { sw.style.background = p.color; sw.style.height = Math.max(3, Math.min(8, p.mm * 1.6)) + 'px'; }
    const ic = b.querySelector('.i');
    if (ic) ic.textContent = App.drawPenIcon(p);
    b.title = `${p.type === 'hl' ? 'Markeerstift' : 'Pen'}: ${p.mm} mm (klik nogmaals voor kleur en dikte)`;
  });
};
App.def('drawTool', (tool, el) => {
  const d = App.draw;
  if (d.active && d.tool === tool && tool !== 'eraser' && el) { App.drawPenMenu(el, tool); return; }
  App.drawStart(tool);
});
App.drawPenMenu = (anchor, tool) => {
  const i = +tool.replace('pen', ''), p = App.draw.pens[i];
  const sizes = p.type === 'hl' ? App.DRAW_HL_MM : App.DRAW_PEN_MM;
  const m = App.openPopup(anchor, `<div class="pen-menu"><div class="cm-label">Dikte</div>
    <div class="pen-sizes">${sizes.map((mm) => `<button data-mm="${mm}" class="${mm === p.mm ? 'on' : ''}" title="${String(mm).replace('.', ',')} mm"><i style="width:${Math.min(22, 3 + mm * 3)}px;height:${Math.min(22, 3 + mm * 3)}px;background:${p.color}"></i></button>`).join('')}</div>
    <div class="cm-label">Kleuren</div>
    <div class="cm-grid pen-colors">${App.DRAW_COLORS.map((c) => `<button data-c="${c}" style="background:${c}" class="${c === p.color ? 'on' : ''}" title="${c}"></button>`).join('')}</div>
    <label class="mi"><span class="i">colorize</span> Meer kleuren… <input type="color" data-more value="${p.color}" style="margin-left:auto;width:28px;height:22px;border:0;padding:0;background:none"></label>
    <hr><button class="mi" data-type="${p.type === 'hl' ? 'pen' : 'hl'}"><span class="i">${p.type === 'hl' ? 'stylus' : 'ink_highlighter'}</span> ${p.type === 'hl' ? 'Omzetten naar pen' : 'Omzetten naar markeerstift'}</button></div>`);
  const set = (k, v) => { App.draw.pens[i] = { ...App.draw.pens[i], [k]: v }; App.draw.savePens(); App.drawStart(tool); };
  m.addEventListener('click', (e) => {
    const s = e.target.closest('[data-mm]'), c = e.target.closest('[data-c]'), t = e.target.closest('[data-type]');
    if (s) { set('mm', +s.dataset.mm); App.closePopup(); }
    if (c) { set('color', c.dataset.c); App.closePopup(); }
    if (t) { App.draw.pens[i] = { ...p, type: t.dataset.type, mm: t.dataset.type === 'hl' ? 6 : 0.5, color: t.dataset.type === 'hl' ? '#ffff00' : '#000000' }; App.draw.savePens(); App.drawStart(tool); App.closePopup(); }
  });
  m.querySelector('[data-more]').addEventListener('change', (e) => { set('color', e.target.value); App.closePopup(); });
};
App.def('drawStop', () => App.drawStop());
App.def('drawSelect', () => { App.drawStop(); App.ed.focus({ preventScroll: true }); });
App.def('drawUndo', () => { if (App.draw.active && App.draw.strokes.length) App.drawUndo(); else App.exec('undo'); });
['pen0', 'pen1', 'pen2', 'pen3', 'eraser'].forEach((t) => { App.stateFns['draw-' + t] = () => App.draw.active && App.draw.tool === t; });
App.stateFns['draw-select'] = () => !App.draw.active;
document.addEventListener('keydown', (e) => {
  if (!App.draw.active) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); App.drawStop(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && App.draw.strokes.length) { e.preventDefault(); e.stopImmediatePropagation(); App.drawUndo(); }
}, true);
// Ander tabblad, afdrukken of een ander document: tekenen netjes afronden
(() => {
  const orig = App.showTab;
  App.showTab = (name) => { if (name !== 'draw' && App.draw.active) App.drawStop(); return orig(name); };
  const origLoad = App.loadDoc;
  App.loadDoc = (data) => { if (App.draw.active) { App.draw.strokes = []; App.drawStop(); } return origLoad(data); };
})();
window.addEventListener('beforeprint', () => App.drawStop());
App.drawPaintButtons();
