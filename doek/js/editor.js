/* =========================================================
   Doek (gemaakt door JJ van Schelven) — editor: selecteren, verplaatsen met slimme
   hulplijnen en raster, schalen, draaien, aanpasgrepen, lijnuiteinden, groepen,
   toetsenbord, klembord en rechtsklikmenu's
   ========================================================= */
'use strict';

(() => {
  const stage = $('#stage'), overlay = $('#overlay');
  const st = App.state;
  const rad = (d) => d * Math.PI / 180;
  const rotP = (x, y, cx, cy, deg) => { const a = rad(deg), c = Math.cos(a), s = Math.sin(a); const dx = x - cx, dy = y - cy; return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }; };
  App.rotP = rotP;

  /* ---------- Wereldcoördinaten (ook voor objecten in groepen) ---------- */
  // { cx, cy, w, h, rot } van een object in diacoördinaten
  App.worldBox = (id, objs = App.surface().objs, owner = App.surface().owner) => {
    const path = [];
    const find = (list, chain) => { for (const o of list) { if (o.id === id) { path.push(...chain, o); return true; } if (o.type === 'group' && find(o.objs, [...chain, o])) return true; } return false; };
    if (!find(objs, [])) return null;
    let T = null;
    for (const o of path) {
      const b = T ? { x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot || 0 } : App.box(o, owner);
      if (o.type === 'line' && o.pts && !T) { const lb = App.lineBox(o); b.x = lb.x; b.y = lb.y; b.w = lb.w; b.h = lb.h; }
      let cx = b.x + b.w / 2, cy = b.y + b.h / 2, rot = b.rot || 0;
      if (T) { const p = rotP(T.x + cx, T.y + cy, T.cx, T.cy, T.rot); cx = p.x; cy = p.y; rot += T.rot; }
      T = { x: cx - b.w / 2, y: cy - b.h / 2, cx, cy, w: b.w, h: b.h, rot };
    }
    return { cx: T.cx, cy: T.cy, w: T.w, h: T.h, rot: T.rot, x: T.cx - T.w / 2, y: T.cy - T.h / 2 };
  };
  App.parentOf = (id) => { const h = App.findObj(id); return h ? h.parent : null; };
  // Assen-uitgelijnde begrenzing van een (gedraaid) object
  App.aabb = (wb) => {
    if (!wb.rot) return { x: wb.cx - wb.w / 2, y: wb.cy - wb.h / 2, w: wb.w, h: wb.h };
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => rotP(wb.cx + sx * wb.w / 2, wb.cy + sy * wb.h / 2, wb.cx, wb.cy, wb.rot));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };
  App.selBounds = (ids = st.sel) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ids.forEach((id) => { const wb = App.worldBox(id); if (!wb) return; const a = App.aabb(wb); x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, a.x + a.w); y2 = Math.max(y2, a.y + a.h); });
    return x1 === Infinity ? { x: 0, y: 0, w: 0, h: 0 } : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  // Lijnen: x/y/w/h afleiden uit de eindpunten
  App.lineBox = (o) => {
    const [[x1, y1], [x2, y2]] = o.pts;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  };
  App.syncLine = (o) => { if (o.pts) Object.assign(o, App.lineBox(o)); };
  // Groep passend maken om de kinderen (na wijzigingen binnen een groep)
  App.fitGroup = (g) => {
    if (!g || g.type !== 'group' || !g.objs.length) return;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    g.objs.forEach((c) => { if (c.type === 'line' && c.pts) App.syncLine(c); const a = App.aabb({ cx: c.x + c.w / 2, cy: c.y + c.h / 2, w: c.w, h: c.h, rot: c.rot || 0 }); x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, a.x + a.w); y2 = Math.max(y2, a.y + a.h); });
    if (Math.abs(x1) < 0.01 && Math.abs(y1) < 0.01 && Math.abs(x2 - g.w) < 0.01 && Math.abs(y2 - g.h) < 0.01) return;
    const nw = x2 - x1, nh = y2 - y1;
    // nieuw middelpunt in wereldcoördinaten (groep kan gedraaid zijn)
    const ocx = g.x + g.w / 2, ocy = g.y + g.h / 2;
    const p = rotP(g.x + x1 + nw / 2, g.y + y1 + nh / 2, ocx, ocy, g.rot || 0);
    g.objs.forEach((c) => { c.x -= x1; c.y -= y1; if (c.pts) c.pts = c.pts.map(([px, py]) => [px - x1, py - y1]); });
    g.x = p.x - nw / 2; g.y = p.y - nh / 2; g.w = nw; g.h = nh;
    const par = App.parentOf(g.id); if (par) App.fitGroup(par);
  };

  /* ---------- Selectie ---------- */
  App.select = (ids, opts = {}) => {
    ids = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (st.edit && !opts.keepEdit) App.textEdit && App.textEdit.stop();
    st.sel = ids;
    st.cell = opts.cell || null;
    if (!opts.keepGroup) st.groupEdit = ids.length && App.parentOf(ids[0]) ? App.parentOf(ids[0]).id : null;
    App.drawSelection();
    App.emit('selection');
    App.updateContext();
    App.scheduleState();
    App.panes && App.panes.refresh();
  };
  App.deselect = () => { if (st.sel.length || st.edit) App.select([]); };
  App.updateContext = () => {
    const objs = App.selObjs();
    const o = objs.length === 1 ? objs[0] : null;
    const types = new Set(objs.map((x) => x.type));
    const shapeLike = objs.length && objs.every((x) => /shape|line|group|ink|icon|diagram|equation/.test(x.type));
    App.setContext({
      shapeFormat: !!(shapeLike || (o && /table|chart/.test(o.type))),
      pictureFormat: !!(o && o.type === 'image') || (objs.length > 1 && [...types].every((t) => t === 'image')),
      tableDesign: !!(o && o.type === 'table'), tableLayout: !!(o && o.type === 'table'),
      chartDesign: !!(o && o.type === 'chart'), diagramDesign: !!(o && o.type === 'diagram'),
      media: !!(o && (o.type === 'video' || o.type === 'audio')), equation: !!(o && o.type === 'equation'),
      masterTab: st.view === 'master', auto: false,
    });
  };

  /* ---------- Selectiekaders en grepen tekenen ---------- */
  const H8 = [['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5], ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5]];
  const CURS = ['nwse', 'ns', 'nesw', 'ew'];
  const cursorFor = (h, rot) => {
    const base = { nw: 0, n: 1, ne: 2, e: 3, se: 0, s: 1, sw: 2, w: 3 }[h];
    const steps = Math.round(((rot % 180) + 180) % 180 / 45);
    return CURS[(base + steps) % 4] + '-resize';
  };
  App.drawSelection = () => {
    overlay.querySelectorAll('.sel-box, .hd, .comment-pin, .cp-line, .crop-frame, .crop-ghost').forEach((e) => e.remove());
    if (App.drawComments) App.drawComments(overlay);
    if (st.view === 'sorter' || !App.pres) return;
    const z = App.zoom();
    if (st.crop) { App.drawCrop && App.drawCrop(overlay, z); return; }
    if (st.points) { App.drawPoints && App.drawPoints(overlay, z); return; }
    const multi = st.sel.length > 1;
    // groep waarin wordt gewerkt: stippelkader
    if (st.groupEdit) {
      const wb = App.worldBox(st.groupEdit);
      if (wb) { const b = boxEl(wb, z); b.classList.add('multi'); overlay.appendChild(b); }
    }
    st.sel.forEach((id) => {
      const o = App.obj(id); if (!o) return;
      const wb = App.worldBox(id); if (!wb) return;
      if (o.type === 'line') { drawLineHandles(o, z); return; }
      const box = boxEl(wb, z);
      if (st.edit === id) box.classList.add('editing');
      if (o.locked) { box.classList.add('locked'); overlay.appendChild(box); return; }
      overlay.appendChild(box);
      if (multi && !st.edit) { box.classList.add('multi'); }
      H8.forEach(([h, fx, fy]) => {
        if ((o.type === 'icon' || o.type === 'equation') && h.length === 1 && false) return;
        const d = document.createElement('div');
        d.className = 'hd'; d.dataset.h = h; d.dataset.id = id;
        d.style.left = fx * wb.w * z + 'px'; d.style.top = fy * wb.h * z + 'px';
        d.style.cursor = cursorFor(h, wb.rot);
        box.appendChild(d);
      });
      if (o.type !== 'table') {
        const r = document.createElement('div');
        r.className = 'hd rot'; r.dataset.h = 'rot'; r.dataset.id = id;
        r.style.left = wb.w * z / 2 + 'px'; r.style.top = '-22px';
        r.title = App.t('Draaien (Shift = per 15°)');
        box.appendChild(r);
      }
      // gele aanpasgrepen
      if (!multi && o.type === 'shape' && o.geom && App.Shapes && !o.path) {
        const g = App.geo(o, wb.w, wb.h);
        (g.handles || []).forEach((hp, i) => {
          const d = document.createElement('div');
          d.className = 'hd adj'; d.dataset.h = 'adj'; d.dataset.i = i; d.dataset.id = id;
          const lx = o.flipH ? wb.w - hp.x : hp.x, ly = o.flipV ? wb.h - hp.y : hp.y;
          d.style.left = lx * z + 'px'; d.style.top = ly * z + 'px';
          d.title = App.t('Vorm aanpassen');
          box.appendChild(d);
        });
      }
    });
    App.drawRulers && App.settings.ruler && App.drawRulers();
  };
  const boxEl = (wb, z) => {
    const b = document.createElement('div');
    b.className = 'sel-box';
    b.style.cssText = `left:${wb.x * z}px;top:${wb.y * z}px;width:${wb.w * z}px;height:${wb.h * z}px;${wb.rot ? `transform:rotate(${wb.rot}deg)` : ''}`;
    return b;
  };
  const drawLineHandles = (o, z) => {
    const par = App.parentOf(o.id);
    const pts = o.pts.map(([x, y]) => toWorld(par, x, y));
    pts.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'hd end'; d.dataset.h = 'end'; d.dataset.i = i; d.dataset.id = o.id;
      d.style.left = p.x * z + 'px'; d.style.top = p.y * z + 'px'; d.style.cursor = 'crosshair';
      overlay.appendChild(d);
    });
    if (/^bentConnector/.test(o.geom || '')) {
      const t = (o.adj && o.adj.adj1 !== undefined ? o.adj.adj1 : 50000) / 100000;
      const xm = pts[0].x + (pts[1].x - pts[0].x) * t;
      const d = document.createElement('div');
      d.className = 'hd adj'; d.dataset.h = 'elbow'; d.dataset.id = o.id;
      d.style.left = xm * z + 'px'; d.style.top = ((pts[0].y + pts[1].y) / 2) * z + 'px';
      overlay.appendChild(d);
    }
  };
  // punt in groepscoördinaten → dia
  const toWorld = (group, x, y) => {
    if (!group) return { x, y };
    const gw = App.worldBox(group.id);
    return rotP(gw.x + x, gw.y + y, gw.cx, gw.cy, gw.rot);
  };
  const toLocal = (group, x, y) => {
    if (!group) return { x, y };
    const gw = App.worldBox(group.id);
    const p = rotP(x, y, gw.cx, gw.cy, -gw.rot);
    return { x: p.x - gw.x, y: p.y - gw.y };
  };
  App.toWorldOf = toWorld; App.toLocalOf = toLocal;

  /* ---------- Aanwijzen op het werkvlak ---------- */
  const selectable = (el) => {
    if (!el) return null;
    const ob = el.closest('.ob');
    if (!ob || !ob.closest('#stage-slide')) return null;
    // alleen objecten van het werkvlak zelf (niet die van master/indeling op een dia)
    let top = ob;
    while (top.parentElement && top.parentElement.closest('.ob')) top = top.parentElement.closest('.ob');
    if (!top.classList.contains('ly-slide')) return null;
    return { top, inner: ob };
  };
  // object onder de muis kiezen: in een groep waarin wordt gewerkt het kind, anders het bovenste object
  const pickObj = (target) => {
    const s = selectable(target); if (!s) return null;
    const topId = s.top.dataset.id;
    if (st.groupEdit) {
      // binnen de groep: het directe kind van de groep onder de muis
      let el = s.inner;
      while (el && el !== s.top) { const p = el.parentElement && el.parentElement.closest('.ob'); if (p && p.dataset.id === st.groupEdit) return el.dataset.id; el = p; }
      if (s.top.dataset.id === st.groupEdit) return st.groupEdit;
    }
    return topId;
  };
  App.pickObj = pickObj;

  // Dubbelklik-detectie en slepen
  let drag = null;
  const THRESH = 3;
  stage.addEventListener('mousedown', (e) => {
    if (e.button === 2) return;
    if (!App.pres || st.view === 'sorter') return;
    if (App.tool && App.tool.down && App.tool.down(e)) return;          // tekenen, vorm plaatsen, gum
    const hd = e.target.closest('.hd');
    if (hd) { e.preventDefault(); startHandle(e, hd); return; }
    if (e.target.closest('.comment-pin')) return;
    const phb = e.target.closest('[data-phins]');
    if (phb && !(App.readOnly && App.readOnly())) { e.preventDefault(); const ob = phb.closest('.ob'); App.select([ob.dataset.id]); App.exec('phInsert', { kind: phb.dataset.phins, id: ob.dataset.id }); return; }
    // in tekst klikken terwijl die al wordt bewerkt: de browser regelt de cursor
    if (st.edit && e.target.closest(`.ob[data-id="${CSS.escape(st.edit)}"] .tx[contenteditable], .ob[data-id="${CSS.escape(st.edit)}"] td`)) return;
    const id = pickObj(e.target);
    stage.focus({ preventScroll: true });
    if (!id) {
      if (st.edit) App.textEdit.stop();
      if (!e.shiftKey && !e.ctrlKey) App.select([]);
      startMarquee(e);
      return;
    }
    e.preventDefault();
    const o = App.obj(id);
    const already = st.sel.includes(id);
    if (e.shiftKey || e.ctrlKey) {
      if (already && !e.ctrlKey) { App.select(st.sel.filter((x) => x !== id), { keepGroup: true }); return; }
      if (!already) App.select([...st.sel, id], { keepGroup: true });
      else if (e.ctrlKey && !e.shiftKey) { /* Ctrl+slepen = kopie: selectie houden */ }
    } else if (!already) {
      // klik in een groep die al geselecteerd is: kind selecteren
      if (st.sel.length === 1 && App.obj(st.sel[0]) && App.obj(st.sel[0]).type === 'group' && st.sel[0] === id) { /* blijft */ }
      App.select([id]);
    }
    const wasSelected = already;
    const p0 = App.toSlide(e.clientX, e.clientY);
    drag = { kind: 'pending', id, o, x0: e.clientX, y0: e.clientY, p0, wasSelected, shift: e.shiftKey, ctrl: e.ctrlKey, target: e.target, detail: e.detail };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  const onMove = (e) => {
    if (!drag) return;
    if (drag.kind === 'pending') {
      if (Math.abs(e.clientX - drag.x0) < THRESH && Math.abs(e.clientY - drag.y0) < THRESH) return;
      if (App.readOnly && App.readOnly()) return;   // alleen bekijken: niet verplaatsen
      const objs = st.sel.map((id) => App.obj(id)).filter((o) => o && !o.locked);
      if (!objs.length) { drag = null; return; }
      startMove(objs, e);
    }
    if (drag.kind === 'move') moveTo(e);
    else if (drag.kind === 'marquee') marqueeTo(e);
    else if (drag.fn) drag.fn(e);
  };
  const onUp = (e) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const d = drag; drag = null;
    clearGuides();
    if (!d) return;
    if (d.kind === 'pending') { clickObj(d, e); return; }
    if (d.kind === 'move') endMove(d, e);
    else if (d.kind === 'marquee') endMarquee(d, e);
    else if (d.end) d.end(e);
  };
  // Klik zonder slepen: tekst bewerken, groep in, of niets
  const clickObj = (d, e) => {
    const o = App.obj(d.id); if (!o) return;
    if (o.type === 'group' && d.wasSelected && !e.shiftKey) {
      // tweede klik op een groep: het kind eronder selecteren
      st.groupEdit = o.id;
      const child = pickObj(d.target);
      if (child && child !== o.id) { App.select([child], { keepGroup: true }); return; }
    }
    if (e.shiftKey || e.ctrlKey) return;
    const textual = o.type === 'shape' && (o.text || !o.path);
    const quickEdit = o.txbox || o.ph || App.isTextClick(d.target);
    if (textual && App.textEdit && !o.locked && (quickEdit || d.wasSelected || d.detail >= 2)) {
      App.textEdit.start(o.id, { x: e.clientX, y: e.clientY, selectWord: d.detail === 2, selectAll: d.detail >= 3 });
      return;
    }
    if (o.type === 'table' && App.tables) { App.tables.click(o, e, d); return; }
    if (d.detail >= 2) {
      if (o.type === 'image') App.exec('crop');
      else if (o.type === 'chart') App.exec('chartEditData');
      else if (o.type === 'equation') App.exec('editEquation');
      else if (o.type === 'diagram') App.exec('diaText');
      else if (o.type === 'video' || o.type === 'audio') App.exec('mediaPlay');
      else App.exec('togglePane', 'format');
    }
  };
  App.isTextClick = (target) => !!(target && target.closest && target.closest('.tx .r, .tx .pa'));

  /* ---------- Verplaatsen ---------- */
  const startMove = (objs, e) => {
    const z = App.zoom();
    // tijdens het slepen een kopie maken met Ctrl
    drag.kind = 'move';
    drag.objs = objs;
    drag.copy = drag.ctrl;
    drag.start = objs.map((o) => ({ o, wb: App.worldBox(o.id) }));
    drag.bounds = App.selBounds(objs.map((o) => o.id));
    drag.cands = guideCands(new Set(objs.map((o) => o.id)));
    drag.els = objs.map((o) => App.objEl(o.id)).filter(Boolean);
    drag.boxes = Array.from(overlay.querySelectorAll('.sel-box, .hd.end'));
    drag.z = z;
    if (st.edit) App.textEdit.stop();
    if (drag.copy) drag.els.forEach((el) => { const c = el.cloneNode(true); c.style.opacity = 0.5; c.classList.add('drag-ghost'); el.parentNode.insertBefore(c, el); });
  };
  const moveTo = (e) => {
    const p = App.toSlide(e.clientX, e.clientY);
    let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    const b = drag.bounds;
    const snapped = snapBox({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }, drag.cands, !e.altKey);
    dx = snapped.x - b.x; dy = snapped.y - b.y;
    if (e.shiftKey) { if (Math.abs(p.x - drag.p0.x) > Math.abs(p.y - drag.p0.y)) dy = 0; else dx = 0; }
    drag.dx = dx; drag.dy = dy;
    const z = drag.z;
    drag.els.forEach((el) => { el.style.translate = `${dx}px ${dy}px`; });
    drag.boxes.forEach((el) => { el.style.translate = `${dx * z}px ${dy * z}px`; });
    showGuides(snapped.guides);
    sizeTip(e, App.fmtNum((b.x + dx) / App.CM, 2) + ' × ' + App.fmtNum((b.y + dy) / App.CM, 2) + ' cm');
  };
  const endMove = (d) => {
    removeTip();
    const dx = d.dx || 0, dy = d.dy || 0;
    $$('.drag-ghost').forEach((x) => x.remove());
    if (!dx && !dy) { d.els.forEach((el) => { el.style.translate = ''; }); App.drawSelection(); return; }
    App.run(() => {
      let objs = d.objs;
      if (d.copy) {
        const copies = App.duplicateObjs(objs, 0, 0);
        objs = copies;
      }
      objs.forEach((o) => App.moveObj(o, dx, dy));
      if (d.copy) App.select(objs.map((o) => o.id));
      App.updateConnectors();
    });
    App.drawSelection();
  };
  // object verplaatsen met een verschuiving in diacoördinaten
  App.moveObj = (o, dx, dy) => {
    const par = App.parentOf(o.id);
    let ldx = dx, ldy = dy;
    if (par) { const gw = App.worldBox(par.id); const a = rad(-gw.rot); ldx = dx * Math.cos(a) - dy * Math.sin(a); ldy = dx * Math.sin(a) + dy * Math.cos(a); }
    if (o.pts) { o.pts = o.pts.map(([x, y]) => [x + ldx, y + ldy]); App.syncLine(o); if (o.conn) { delete o.conn; } }
    else { App.fixBox(o); o.x += ldx; o.y += ldy; }
    if (par) App.fitGroup(par);
  };

  /* ---------- Slimme hulplijnen en uitlijnen op raster ---------- */
  const guideCands = (skip) => {
    const P = App.pres;
    const xs = [], ys = [];
    const add = (b, kind) => {
      xs.push({ v: b.x, b, kind }, { v: b.x + b.w / 2, b, kind, c: 1 }, { v: b.x + b.w, b, kind });
      ys.push({ v: b.y, b, kind }, { v: b.y + b.h / 2, b, kind, c: 1 }, { v: b.y + b.h, b, kind });
    };
    add({ x: 0, y: 0, w: P.size.w, h: P.size.h }, 'slide');
    if (App.settings.snapObjs !== false) App.surface().objs.forEach((o) => { if (skip.has(o.id) || o.hidden) return; const wb = App.worldBox(o.id); if (wb) add(App.aabb(wb), 'obj'); });
    if (App.settings.guides) (P.guides && P.guides.length ? P.guides : [{ dir: 'v', pos: P.size.w / 2 }, { dir: 'h', pos: P.size.h / 2 }]).forEach((g) => (g.dir === 'v' ? xs : ys).push({ v: g.pos, kind: 'guide' }));
    return { xs, ys };
  };
  const snapBox = (b, cands, enabled, edges = { x: [0, 0.5, 1], y: [0, 0.5, 1] }) => {
    const out = { x: b.x, y: b.y, guides: [] };
    if (!enabled) return out;
    const z = App.zoom(), tol = 6 / z;
    const best = (vals, list) => {
      let hit = null;
      vals.forEach((v, k) => list.forEach((c) => { const d = c.v - v; if (Math.abs(d) <= tol && (!hit || Math.abs(d) < Math.abs(hit.d))) hit = { d, c, k }; }));
      return hit;
    };
    const smart = App.settings.smartGuides !== false;
    const hx = smart || App.settings.guides ? best(edges.x.map((f) => b.x + f * b.w), cands.xs.filter((c) => smart || c.kind === 'guide')) : null;
    const hy = smart || App.settings.guides ? best(edges.y.map((f) => b.y + f * b.h), cands.ys.filter((c) => smart || c.kind === 'guide')) : null;
    if (hx) { out.x += hx.d; out.guides.push({ dir: 'v', v: hx.c.v, c: hx.c }); }
    if (hy) { out.y += hy.d; out.guides.push({ dir: 'h', v: hy.c.v, c: hy.c }); }
    if (App.settings.snapGrid) {
      const g = App.settings.gridSize || 16;
      if (!hx) out.x = Math.round(out.x / g) * g;
      if (!hy) out.y = Math.round(out.y / g) * g;
    }
    out.guides.forEach((gd) => { gd.box = { x: out.x, y: out.y, w: b.w, h: b.h }; });
    return out;
  };
  App.snapBox = snapBox; App.guideCands = guideCands;
  const showGuides = (guides) => {
    clearGuides();
    const P = App.pres, z = App.zoom();
    guides.forEach((g) => {
      const e = document.createElement('div');
      e.className = 'guide-line ' + g.dir;
      const ob = g.c && g.c.b && g.c.kind === 'obj' ? g.c.b : null;
      if (g.dir === 'v') {
        const y1 = ob ? Math.min(ob.y, g.box.y) : 0, y2 = ob ? Math.max(ob.y + ob.h, g.box.y + g.box.h) : P.size.h;
        e.style.cssText = `left:${g.v * z}px;top:${y1 * z}px;height:${(y2 - y1) * z}px`;
      } else {
        const x1 = ob ? Math.min(ob.x, g.box.x) : 0, x2 = ob ? Math.max(ob.x + ob.w, g.box.x + g.box.w) : P.size.w;
        e.style.cssText = `top:${g.v * z}px;left:${x1 * z}px;width:${(x2 - x1) * z}px`;
      }
      overlay.appendChild(e);
    });
  };
  const clearGuides = () => overlay.querySelectorAll('.guide-line').forEach((e) => e.remove());
  let tipEl = null;
  const sizeTip = (e, text) => {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'size-tip'; document.body.appendChild(tipEl); tipEl.style.position = 'fixed'; tipEl.style.zIndex = 300; }
    tipEl.textContent = text; tipEl.style.left = e.clientX + 14 + 'px'; tipEl.style.top = e.clientY + 16 + 'px';
  };
  const removeTip = () => { if (tipEl) { tipEl.remove(); tipEl = null; } };

  /* ---------- Selectierechthoek ---------- */
  const startMarquee = (e) => {
    const p0 = App.toSlide(e.clientX, e.clientY);
    const m = document.createElement('div'); m.className = 'marquee';
    overlay.appendChild(m);
    drag = { kind: 'marquee', p0, el: m, add: e.shiftKey || e.ctrlKey, base: st.sel.slice(), x0: e.clientX, y0: e.clientY };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const marqueeTo = (e) => {
    const p = App.toSlide(e.clientX, e.clientY), z = App.zoom();
    const x = Math.min(p.x, drag.p0.x), y = Math.min(p.y, drag.p0.y), w = Math.abs(p.x - drag.p0.x), h = Math.abs(p.y - drag.p0.y);
    drag.rect = { x, y, w, h };
    drag.el.style.cssText = `left:${x * z}px;top:${y * z}px;width:${w * z}px;height:${h * z}px`;
  };
  const endMarquee = (d) => {
    d.el.remove();
    if (!d.rect || d.rect.w < 2 && d.rect.h < 2) return;
    const r = d.rect;
    const hit = App.surface().objs.filter((o) => {
      if (o.locked && false) return false;
      const wb = App.worldBox(o.id); if (!wb) return false;
      const a = App.aabb(wb);
      return a.x >= r.x - 0.5 && a.y >= r.y - 0.5 && a.x + a.w <= r.x + r.w + 0.5 && a.y + a.h <= r.y + r.h + 0.5;
    }).map((o) => o.id);
    App.select(d.add ? [...new Set([...d.base, ...hit])] : hit);
  };

  /* ---------- Grepen: schalen, draaien, aanpassen, lijnuiteinden ---------- */
  const startHandle = (e, hd) => {
    if (App.readOnly && App.readOnly()) return;
    const id = hd.dataset.id, o = App.obj(id); if (!o) return;
    const kind = hd.dataset.h;
    if (st.edit && kind !== 'adj') App.textEdit.stop(true);
    const wb = App.worldBox(id);
    const p0 = App.toSlide(e.clientX, e.clientY);
    drag = { kind: 'handle', id, o, wb, p0 };
    if (kind === 'rot') drag.fn = rotateFn(o, wb), drag.end = commitTransform;
    else if (kind === 'adj') drag.fn = adjustFn(o, wb, +hd.dataset.i), drag.end = commitTransform;
    else if (kind === 'end') drag.fn = endpointFn(o, +hd.dataset.i), drag.end = commitTransform;
    else if (kind === 'elbow') drag.fn = elbowFn(o), drag.end = commitTransform;
    else drag.fn = resizeFn(o, wb, kind), drag.end = commitTransform;
    // werk op een kopie van het model; pas bij loslaten vastleggen
    drag.before = App.clone(App.surface().objs);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const liveRender = () => {
    // alleen de betrokken objecten opnieuw tekenen (snel)
    const surf = App.surface();
    const ids = new Set(st.sel);
    if (drag && drag.id) ids.add(drag.id);
    const tops = new Set();
    ids.forEach((id) => { let cur = App.findObj(id); while (cur && cur.parent) { const p = App.findObj(cur.parent.id); if (!p) break; cur = p; } if (cur) tops.add(cur.obj.id); });
    tops.forEach((tid) => {
      const old = App.objEl(tid); const o = App.obj(tid); if (!old || !o) return;
      const fresh = App.renderObj(o, { mode: 'edit', theme: App.theme(), owner: surf.owner, layer: 'slide', num: App.state.slide + 1 });
      if (fresh) { fresh.classList.add('ly-slide'); old.replaceWith(fresh); }
    });
    App.drawSelection();
  };
  App.liveRender = liveRender;
  const commitTransform = () => {
    removeTip();
    const before = drag ? drag.before : null;
    void before;
    App.updateConnectors();
    App.changed();
    App.drawSelection();
  };
  // Schalen; Shift = verhouding behouden, Ctrl = vanuit het midden, afbeeldingen houden in de hoeken hun verhouding
  const resizeFn = (o, wb, h) => {
    const sx = { nw: -1, n: 0, ne: 1, e: 1, se: 1, s: 0, sw: -1, w: -1 }[h], sy = { nw: -1, n: -1, ne: -1, e: 0, se: 1, s: 1, sw: 1, w: 0 }[h];
    const others = st.sel.filter((x) => x !== o.id).map((x) => ({ o: App.obj(x), wb: App.worldBox(x) })).filter((x) => x.o && !x.o.locked);
    const ratio = wb.w / Math.max(1, wb.h);
    const cands = guideCands(new Set(st.sel));
    const origs = [{ o, wb }, ...others].map((x) => ({ ...x, snap: App.clone({ x: x.o.x, y: x.o.y, w: x.o.w, h: x.o.h, pts: x.o.pts, objs: x.o.objs, path: x.o.path, cols: x.o.cols, rows: x.o.rows, flipH: !!x.o.flipH, flipV: !!x.o.flipV }) }));
    return (e) => {
      const p = App.toSlide(e.clientX, e.clientY);
      // muis in lokale coördinaten van het object (ongedraaid rond het midden)
      const lp = rotP(p.x, p.y, wb.cx, wb.cy, -wb.rot);
      const fromCenter = e.ctrlKey;
      const keep = e.shiftKey !== (o.type === 'image' || o.type === 'icon' || o.type === 'equation' || (o.type === 'group' && sx && sy)) ? sx && sy : false;
      const ax = wb.cx - sx * wb.w / 2, ay = wb.cy - sy * wb.h / 2;    // vast punt (lokaal, ongedraaid)
      let nw = sx ? (fromCenter ? Math.abs(lp.x - wb.cx) * 2 : (lp.x - ax) * sx) : wb.w;
      let nh = sy ? (fromCenter ? Math.abs(lp.y - wb.cy) * 2 : (lp.y - ay) * sy) : wb.h;
      // uitlijnen van de bewegende rand (alleen ongedraaid)
      if (!wb.rot && !e.altKey && !keep) {
        const bx = sx ? (sx > 0 ? ax : ax - nw) : wb.x, by = sy ? (sy > 0 ? ay : ay - nh) : wb.y;
        const s = snapBox({ x: sx > 0 ? bx + nw : bx, y: sy > 0 ? by + nh : by, w: 0, h: 0 }, cands, true, { x: [0], y: [0] });
        if (sx) nw += (s.x - (sx > 0 ? bx + nw : bx)) * sx;
        if (sy) nh += (s.y - (sy > 0 ? by + nh : by)) * sy;
        showGuides(s.guides.map((g) => ({ ...g, box: { x: bx, y: by, w: nw, h: nh } })));
      }
      if (keep) { if (Math.abs(nw / ratio) > Math.abs(nh)) nh = nw / ratio; else nw = nh * ratio; }
      const flipX = nw < 0, flipY = nh < 0;
      nw = Math.max(1, Math.abs(nw)); nh = Math.max(1, Math.abs(nh));
      // nieuw middelpunt (lokaal), terug naar wereld
      let lcx = fromCenter ? wb.cx : sx ? ax + sx * (flipX ? -1 : 1) * nw / 2 : wb.cx;
      let lcy = fromCenter ? wb.cy : sy ? ay + sy * (flipY ? -1 : 1) * nh / 2 : wb.cy;
      const c = rotP(lcx, lcy, wb.cx, wb.cy, wb.rot);
      const fx = nw / wb.w, fy = nh / wb.h;
      applyBox(origs[0], c.x, c.y, nw, nh, flipX, flipY);
      // andere geselecteerde objecten met dezelfde factor, elk rond het eigen vaste punt
      origs.slice(1).forEach((x) => {
        const w2 = Math.max(1, x.wb.w * fx), h2 = Math.max(1, x.wb.h * fy);
        const ax2 = x.wb.cx - sx * x.wb.w / 2, ay2 = x.wb.cy - sy * x.wb.h / 2;
        const lc = { x: sx ? ax2 + sx * w2 / 2 : x.wb.cx, y: sy ? ay2 + sy * h2 / 2 : x.wb.cy };
        const c2 = rotP(lc.x, lc.y, x.wb.cx, x.wb.cy, x.wb.rot);
        applyBox(x, c2.x, c2.y, w2, h2, false, false);
      });
      liveRender();
      sizeTip(e, App.fmtNum(nh / App.CM, 2) + ' × ' + App.fmtNum(nw / App.CM, 2) + ' cm');
    };
  };
  // Nieuwe wereldpositie en -grootte toepassen op een object (ook in groepen, tabellen, groepen schalen)
  const applyBox = (x, cx, cy, w, h, flipX, flipY) => {
    const o = x.o, s = x.snap;
    const par = App.parentOf(o.id);
    let lc = { x: cx, y: cy };
    if (par) { const gw = App.worldBox(par.id); const p = rotP(cx, cy, gw.cx, gw.cy, -gw.rot); lc = { x: p.x - gw.x, y: p.y - gw.y }; }
    if (o.x === undefined) App.fixBox(o);
    const ow = s.w !== undefined ? s.w : x.wb.w, oh = s.h !== undefined ? s.h : x.wb.h;
    o.x = lc.x - w / 2; o.y = lc.y - h / 2; o.w = w; o.h = h;
    const fh = flipX ? !s.flipH : s.flipH, fv = flipY ? !s.flipV : s.flipV;
    if (fh) o.flipH = true; else delete o.flipH;
    if (fv) o.flipV = true; else delete o.flipV;
    const fx = w / (ow || 1), fy = h / (oh || 1);
    if (o.type === 'group' && s.objs) { o.objs = App.clone(s.objs); App.scaleChildren(o.objs, fx, fy); }
    if (o.type === 'table' && s.cols) { o.cols = s.cols.map((c) => c * fx); o.rows = App.clone(s.rows); o.rows.forEach((r) => { r.h *= fy; }); }
    if (o.type === 'ink' && !o.cw) { o.cw = ow; o.ch = oh; }
    if (par) App.fitGroup(par);
  };
  App.scaleChildren = (objs, fx, fy) => objs.forEach((c) => {
    c.x *= fx; c.y *= fy; c.w *= fx; c.h *= fy;
    if (c.pts) c.pts = c.pts.map(([px, py]) => [px * fx, py * fy]);
    if (c.type === 'group') App.scaleChildren(c.objs, fx, fy);
    if (c.type === 'table') { c.cols = c.cols.map((v) => v * fx); c.rows.forEach((r) => { r.h *= fy; }); }
  });
  const rotateFn = (o, wb) => {
    const others = st.sel.map((x) => ({ o: App.obj(x), wb: App.worldBox(x) })).filter((x) => x.o && !x.o.locked);
    const a0 = Math.atan2(drag.p0.y - wb.cy, drag.p0.x - wb.cx);
    const pts0 = new Map(others.map((x) => [x.o.id, x.o.pts ? App.clone(x.o.pts) : null]));
    return (e) => {
      const p = App.toSlide(e.clientX, e.clientY);
      let da = (Math.atan2(p.y - wb.cy, p.x - wb.cx) - a0) * 180 / Math.PI;
      let nr = wb.rot + da;
      if (e.shiftKey) nr = Math.round(nr / 15) * 15;
      else if (Math.abs(((nr % 90) + 90) % 90) < 3 || Math.abs(((nr % 90) + 90) % 90) > 87) nr = Math.round(nr / 90) * 90;
      da = nr - wb.rot;
      others.forEach((x) => {
        const par = App.parentOf(x.o.id);
        const base = par ? (x.wb.rot - App.worldBox(par.id).rot) : x.wb.rot;
        if (x.o.pts) {
          const c = { x: (x.o.pts[0][0] + x.o.pts[1][0]) / 2, y: (x.o.pts[0][1] + x.o.pts[1][1]) / 2 };
          x.o.pts = pts0.get(x.o.id).map(([px, py]) => { const q = rotP(px, py, c.x, c.y, da); return [q.x, q.y]; });
          App.syncLine(x.o);
          return;
        }
        App.fixBox(x.o);
        let r = ((base + da) % 360 + 360) % 360;
        if (Math.abs(r) < 0.01 || Math.abs(r - 360) < 0.01) r = 0;
        if (r) x.o.rot = App.round(r, 2); else delete x.o.rot;
        if (par) App.fitGroup(par);
      });
      liveRender();
      sizeTip(e, Math.round(((nr % 360) + 360) % 360) + '°');
    };
  };
  const adjustFn = (o, wb, i) => (e) => {
    const p = App.toSlide(e.clientX, e.clientY);
    const lp = rotP(p.x, p.y, wb.cx, wb.cy, -wb.rot);
    let lx = lp.x - (wb.cx - wb.w / 2), ly = lp.y - (wb.cy - wb.h / 2);
    if (o.flipH) lx = wb.w - lx; if (o.flipV) ly = wb.h - ly;
    const adj = { ...App.Shapes.defaults(o.geom), ...(o.adj || {}) };
    o.adj = App.Shapes.adjust(o.geom, wb.w, wb.h, adj, i, lx, ly);
    liveRender();
  };
  const endpointFn = (o, i) => {
    const par = App.parentOf(o.id);
    const cands = connSites(o.id);
    return (e) => {
      let p = App.toSlide(e.clientX, e.clientY);
      const other = toWorld(par, ...o.pts[1 - i]);
      if (e.shiftKey) {
        const dx = p.x - other.x, dy = p.y - other.y, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy);
        p = { x: other.x + Math.cos(a) * l, y: other.y + Math.sin(a) * l };
      }
      // aan een verbindingspunt van een vorm vastmaken
      let link = null;
      const tol = 8 / App.zoom();
      cands.forEach((c) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < tol && (!link || d < link.d)) link = { ...c, d }; });
      showSites(cands, link);
      if (link) p = { x: link.x, y: link.y };
      const lp = toLocal(par, p.x, p.y);
      o.pts[i] = [App.round(lp.x, 2), App.round(lp.y, 2)];
      App.syncLine(o);
      o.conn = o.conn || {};
      if (link) o.conn[i ? 'end' : 'st'] = { obj: link.obj, site: link.site }; else delete o.conn[i ? 'end' : 'st'];
      if (!o.conn.st && !o.conn.end) delete o.conn;
      if (par) App.fitGroup(par);
      liveRender();
    };
  };
  const elbowFn = (o) => (e) => {
    const p = App.toSlide(e.clientX, e.clientY);
    const [[x1], [x2]] = o.pts;
    if (Math.abs(x2 - x1) < 1) return;
    o.adj = { adj1: Math.round(App.clamp((p.x - x1) / (x2 - x1), -1, 2) * 100000) };
    liveRender();
  };
  // Verbindingspunten van alle vormen op het werkvlak (in diacoördinaten)
  const connSites = (skipId) => {
    const out = [];
    App.surface().objs.forEach((o) => {
      if (o.id === skipId || o.type === 'line' || o.hidden) return;
      const wb = App.worldBox(o.id); if (!wb) return;
      App.objSites(o, wb).forEach((s, k) => out.push({ x: s.x, y: s.y, obj: o.id, site: k }));
    });
    return out;
  };
  App.objSites = (o, wb) => {
    let sites = null;
    if (o.type === 'shape' && App.Shapes && !o.path) { const g = App.geo(o, wb.w, wb.h); if (g.sites && g.sites.length) sites = g.sites; }
    if (!sites) sites = [{ x: wb.w / 2, y: 0 }, { x: 0, y: wb.h / 2 }, { x: wb.w / 2, y: wb.h }, { x: wb.w, y: wb.h / 2 }];
    return sites.map((s) => {
      const lx = o.flipH ? wb.w - s.x : s.x, ly = o.flipV ? wb.h - s.y : s.y;
      return rotP(wb.x + lx, wb.y + ly, wb.cx, wb.cy, wb.rot);
    });
  };
  const showSites = (cands, hit) => {
    overlay.querySelectorAll('.hd.site').forEach((x) => x.remove());
    const z = App.zoom();
    cands.forEach((c) => { const d = document.createElement('div'); d.className = 'hd pt site' + (hit && hit.obj === c.obj && hit.site === c.site ? ' on' : ''); d.style.left = c.x * z + 'px'; d.style.top = c.y * z + 'px'; overlay.appendChild(d); });
  };
  // Verbindingslijnen bijwerken als de vormen waaraan ze vastzitten bewegen
  App.updateConnectors = () => {
    App.surface().objs.forEach((o) => {
      if (o.type !== 'line' || !o.conn) return;
      ['st', 'end'].forEach((k, i) => {
        const c = o.conn[k]; if (!c) return;
        const t = App.obj(c.obj); if (!t) { delete o.conn[k]; return; }
        const s = App.objSites(t, App.worldBox(t.id))[c.site];
        if (s) o.pts[i] = [App.round(s.x, 2), App.round(s.y, 2)];
      });
      App.syncLine(o);
    });
  };

  /* ---------- Toetsenbord ---------- */
  document.addEventListener('keydown', (e) => {
    if (!App.pres || $('#backstage') || $('.backdrop') || !$('#show').hidden) return;
    if (e.target.closest && e.target.closest('input, select, textarea, #notes, [contenteditable="true"]:not(.tx)')) return;
    if (st.edit) return;                                                     // textedit.js
    const inThumbs = e.target.closest && e.target.closest('#thumb-list, #sorter');
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    if (App.globalKeys(e)) return;
    if (inThumbs) return;                                                    // thumbs.js
    if (st.view === 'sorter') return;
    const sel = App.selObjs();
    if (k === 'Escape') {
      if (st.points) { App.exec('editPoints'); e.preventDefault(); return; }
      if (st.crop) { App.exec('crop'); e.preventDefault(); return; }
      if (App.tool && App.tool.kind !== 'select') { App.setTool('select'); e.preventDefault(); return; }
      if (st.groupEdit && sel.length) { App.select([st.groupEdit], { keepGroup: false }); e.preventDefault(); return; }
      App.deselect(); return;
    }
    if (/^Arrow/.test(k) && sel.length) {
      e.preventDefault();
      const step = ctrl ? 1 : (App.settings.snapGrid ? (App.settings.gridSize || 16) : 8);
      const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
      App.run(() => { sel.filter((o) => !o.locked).forEach((o) => App.moveObj(o, dx, dy)); App.updateConnectors(); });
      App.drawSelection();
      return;
    }
    if ((k === 'Delete' || k === 'Backspace') && sel.length) { e.preventDefault(); App.exec('deleteObjs'); return; }
    if (k === 'Tab' && !ctrl) {
      e.preventDefault();
      const list = (st.groupEdit ? App.obj(st.groupEdit).objs : App.surface().objs).filter((o) => !o.hidden);
      if (!list.length) return;
      const i = sel.length ? list.findIndex((o) => o.id === sel[sel.length - 1].id) : -1;
      App.select([list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].id], { keepGroup: true });
      return;
    }
    if (k === 'Enter' && sel.length === 1 && App.textEdit && (sel[0].type === 'shape')) { e.preventDefault(); App.textEdit.start(sel[0].id, { selectAll: true }); return; }
    if (k === 'F2' && sel.length === 1 && sel[0].type === 'shape') { e.preventDefault(); App.textEdit.start(sel[0].id, { end: true }); return; }
    // typen op een geselecteerde vorm: tekst vervangen
    if (!ctrl && !e.altKey && k.length === 1 && sel.length === 1 && sel[0].type === 'shape' && !sel[0].locked && App.textEdit) {
      e.preventDefault();
      App.textEdit.start(sel[0].id, { replaceWith: k });
      return;
    }
    if (k === 'PageDown' || (k === 'ArrowDown' && !sel.length)) { e.preventDefault(); App.gotoSlide(st.slide + 1); return; }
    if (k === 'PageUp' || (k === 'ArrowUp' && !sel.length)) { e.preventDefault(); App.gotoSlide(st.slide - 1); return; }
    if (k === 'Home' && !sel.length) { e.preventDefault(); App.gotoSlide(0); return; }
    if (k === 'End' && !sel.length) { e.preventDefault(); App.gotoSlide(App.pres.slides.length - 1); return; }
  });
  // Sneltoetsen die overal gelden (ook in de miniaturen)
  App.globalKeys = (e) => {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), sh = e.shiftKey;
    const run = (name, arg) => { e.preventDefault(); App.exec(name, arg); return true; };
    if (ctrl && !e.altKey) {
      if (k === 'z' && !sh) return run('undo');
      if ((k === 'y') || (k === 'z' && sh)) return run('redo');
      if (k === 's' && !sh) return run('save');
      if (k === 'o') return run('openBackstage', 'open');
      if (k === 'n' && !sh) return run('newPresentation');
      if (k === 'p') return run('print');
      if (k === 'm') return run('newSlide');
      if (k === 'd') return run('duplicate');
      if (k === 'a') return run('selectAll');
      if (k === 'g' && !sh) return run('group');
      if (k === 'g' && sh) return run('ungroup');
      if (k === 'c' && sh) return run('formatPainter', 'copy');
      if (k === 'v' && sh) return run('formatPainter', 'paste');
      if (k === 'k') return run('linkDialog');
      if (k === 'f') return run('find');
      if (k === 'h') return run('replace');
      if (k === 'f1') return run('toggleRibbon');
      if (e.key === ']' && sh) return run('order', 'forward');
      if (e.key === '[' && sh) return run('order', 'backward');
      if (e.key === '}' ) return run('order', 'forward');
      if (e.key === '{') return run('order', 'backward');
      if ((e.key === '>' || e.key === '.') && sh) return run('growFont');
      if ((e.key === '<' || e.key === ',') && sh) return run('shrinkFont');
      if (k === 'b') return run('bold');
      if (k === 'i') return run('italic');
      if (k === 'u') return run('underline');
      if (k === 't') return run('fontDialog');
      if (k === 'e') return run('align', 'ctr');
      if (k === 'l') return run('align', 'l');
      if (k === 'r') return run('align', 'r');
      if (k === 'j') return run('align', 'just');
    }
    if (ctrl && e.altKey && k === 'm') return run('newComment');
    if (e.altKey && !ctrl && k === 'f10') return run('togglePane', 'sel');
    if (e.key === 'F5' && !sh && !ctrl) return run('showFromStart');
    if (e.key === 'F5' && sh) return run('showFromCurrent');
    if (e.key === 'F4' || (ctrl && k === 'y')) return run('redo');
    if (e.key === 'F7' && !sh) return run('spelling');
    if (e.key === 'F7' && sh) return run('togglePane', 'thesaurus');
    if (e.key === 'F1') return run('showShortcuts');
    if (e.key === 'F3' && sh) return run('changeCase', 'cycle');
    if (e.altKey && !ctrl && k === 'q') { e.preventDefault(); $('#cmd-search').focus(); return true; }
    return false;
  };

  /* ---------- Dia's wisselen ---------- */
  App.gotoSlide = (i, opts = {}) => {
    const P = App.pres;
    if (st.view === 'master') return;
    i = App.clamp(i, 0, P.slides.length - 1);
    if (st.edit) App.textEdit.stop();
    if (i !== st.slide) { st.slide = i; st.sel = []; st.groupEdit = null; st.crop = null; st.points = null; }
    if (!opts.keepSorterSel) st.sorterSel = [P.slides[i].id];
    App.updateContext();
    App.renderStage(true);
    App.drawSelection();
    App.emit('slide');
    App.thumbs && App.thumbs.refresh();
    App.renderNotes && App.renderNotes();
    App.updateStatus();
    App.panes && App.panes.refresh();
    App.scheduleState();
  };

  /* ---------- Objecten maken, kopiëren, verwijderen ---------- */
  // Kopieën met nieuwe id's (ook binnen groepen en in animaties), verschoven met dx/dy, en direct na het origineel ingevoegd
  App.cloneObj = (o) => {
    const c = App.clone(App.cleanForSave(o));
    const fresh = (x) => { x.id = App.uid('o'); if (x.objs) x.objs.forEach(fresh); };
    fresh(c);
    return c;
  };
  App.duplicateObjs = (objs, dx = 18, dy = 18) => {
    const out = [];
    const slide = App.surface().owner;
    objs.forEach((o) => {
      const list = App.ownerList(o.id); if (!list) return;
      const c = App.cloneObj(o);
      if (c.ph && App.surface().kind === 'slide') { App.fixBox(c, slide); delete c.ph; c.txbox = o.ph && App.phFamily(o.ph.type) !== 'title' ? true : true; }
      if (c.pts) { c.pts = c.pts.map(([x, y]) => [x + dx, y + dy]); App.syncLine(c); delete c.conn; }
      else { if (c.x === undefined) Object.assign(c, App.box(o, slide)); c.x += dx; c.y += dy; }
      list.splice(list.indexOf(o) + 1 + out.filter((x) => list.includes(x)).length, 0, c);
      // animaties meenemen
      if (slide.anims) slide.anims.filter((a) => a.obj === o.id).forEach((a) => slide.anims.push({ ...App.clone(a), id: App.uid('a'), obj: c.id }));
      out.push(c);
    });
    return out;
  };
  App.addObj = (o, opts = {}) => {
    const surf = App.surface();
    const list = opts.into || surf.objs;
    list.push(o);
    if (opts.select !== false) { st.sel = [o.id]; st.groupEdit = null; }
    return o;
  };
  App.removeObjs = (ids) => {
    const slide = App.surface().owner;
    ids.forEach((id) => {
      const list = App.ownerList(id); if (!list) return;
      const i = list.findIndex((x) => x.id === id);
      const par = App.parentOf(id);
      if (i >= 0) list.splice(i, 1);
      if (par) { if (!par.objs.length) App.removeObjs([par.id]); else if (par.objs.length === 1) { /* groep van één: opheffen */ App.ungroupObj(par); } else App.fitGroup(par); }
      if (slide.anims) slide.anims = slide.anims.filter((a) => a.obj !== id && !(a.trig && a.trig.obj === id));
      // verbindingslijnen loskoppelen
      App.surface().objs.forEach((l) => { if (l.conn) { if (l.conn.st && l.conn.st.obj === id) delete l.conn.st; if (l.conn.end && l.conn.end.obj === id) delete l.conn.end; } });
    });
  };
  App.defEdit('deleteObjs', () => {
    const sel = App.selObjs(); if (!sel.length) return false;
    // gevulde placeholder: eerst leegmaken (zoals bekende programma's)
    if (sel.length === 1 && sel[0].ph && !App.isEmptyText(sel[0]) && App.surface().kind === 'slide') { sel[0].text.paras = [App.emptyPara()]; delete sel[0].text.scale; return; }
    App.removeObjs(sel.map((o) => o.id));
    st.sel = []; st.groupEdit = null;
    App.updateContext();
  });
  App.defEdit('selectAll', () => {
    if (st.view === 'sorter' || document.activeElement && document.activeElement.closest('#thumb-list')) { st.sorterSel = App.pres.slides.map((s) => s.id); App.thumbs && App.thumbs.refresh(); return false; }
    const list = st.groupEdit ? App.obj(st.groupEdit).objs : App.surface().objs;
    App.select(list.filter((o) => !o.hidden).map((o) => o.id), { keepGroup: true });
    return false;
  }, { noRepeat: true });
  App.defEdit('duplicate', () => {
    if (document.activeElement && document.activeElement.closest('#thumb-list, #sorter') || !st.sel.length) { App.exec('duplicateSlide'); return false; }
    const copies = App.duplicateObjs(App.selObjs());
    App.select(copies.map((o) => o.id));
  });

  /* ---------- Klembord ---------- */
  const CLIP_MARK = 'data-doek-clip';
  const packClip = (objs) => {
    const media = {};
    const scan = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(scan); Object.keys(x).forEach((k) => { if ((k === 'media' || k === 'poster') && App.media[x[k]]) media[x[k]] = App.media[x[k]]; else if (typeof x[k] === 'object') scan(x[k]); }); };
    const slide = App.surface().owner;
    const data = objs.map((o) => { const c = App.clone(App.cleanForSave(o)); if (c.x === undefined && c.type !== 'line') Object.assign(c, App.box(o, slide)); return c; });
    scan(data);
    const anims = (slide.anims || []).filter((a) => objs.some((o) => o.id === a.obj)).map(App.clone);
    return { kind: 'objs', objs: data, media, anims, from: slide.id, theme: App.theme().id };
  };
  App.copyObjs = async (cut) => {
    const objs = App.selObjs(); if (!objs.length) return false;
    const clip = packClip(objs);
    st.clip = clip; st.clipPastes = 0;
    const text = objs.map(App.objText).filter(Boolean).join('\n');
    try {
      const json = JSON.stringify(clip);
      const html = `<meta charset="utf-8"><div ${CLIP_MARK}="${App.esc(btoa(unescape(encodeURIComponent(json))))}">${App.esc(text)}</div>`;
      if (navigator.clipboard && window.ClipboardItem && json.length < 25e6) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    } catch { /* intern klembord blijft werken */ }
    if (cut) App.run(() => { App.removeObjs(objs.map((o) => o.id)); st.sel = []; });
    return true;
  };
  App.pasteClip = (clip, opts = {}) => {
    Object.assign(App.media, clip.media || {});
    const slide = App.surface().owner;
    const same = clip.from === slide.id;
    st.clipPastes = (st.clipPastes || 0) + (same ? 1 : 0);
    const off = same ? 18 * st.clipPastes : 0;
    const idMap = {};
    const added = clip.objs.map((o) => {
      const c = App.clone(o);
      const fresh = (x) => { const n = App.uid('o'); idMap[x.id] = n; x.id = n; if (x.objs) x.objs.forEach(fresh); };
      fresh(c);
      if (c.ph && App.surface().kind === 'slide') { delete c.ph; c.txbox = true; }
      if (c.pts) { c.pts = c.pts.map(([x, y]) => [x + off, y + off]); App.syncLine(c); delete c.conn; } else { c.x += off; c.y += off; }
      App.surface().objs.push(c);
      return c;
    });
    if (clip.anims && slide.anims && App.surface().kind === 'slide') clip.anims.forEach((a) => { if (idMap[a.obj]) slide.anims.push({ ...a, id: App.uid('a'), obj: idMap[a.obj] }); });
    App.select(added.map((o) => o.id));
    void opts;
    return added;
  };
  App.def('copy', () => { if (st.edit) { document.execCommand('copy'); return; } if (document.activeElement && document.activeElement.closest('#thumb-list, #sorter')) { App.exec('copySlides'); return; } App.copyObjs(false); });
  App.def('cut', () => { if (st.edit) { document.execCommand('cut'); return; } if (document.activeElement && document.activeElement.closest('#thumb-list, #sorter')) { App.exec('cutSlides'); return; } App.copyObjs(true); });
  App.def('paste', async () => {
    if (st.edit) { try { const t = await navigator.clipboard.readText(); App.textEdit.insertText(t); } catch { App.toast(App.t('Gebruik Ctrl+V om te plakken.'), 'info'); } return; }
    // systeemklembord lezen (kan om toestemming vragen); anders het interne klembord
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types.includes('text/html')) { const html = await (await it.getType('text/html')).text(); if (await App.pasteHtml(html)) return; }
          const img = it.types.find((t) => t.startsWith('image/'));
          if (img) { App.insertImageFile(new File([await it.getType(img)], 'afbeelding.png', { type: img })); return; }
          if (it.types.includes('text/plain')) { const t = await (await it.getType('text/plain')).text(); if (t.trim()) { App.pasteText(t); return; } }
        }
      }
    } catch { /* geen toegang tot het klembord */ }
    if (st.clip && st.clip.kind === 'objs') App.run(() => App.pasteClip(st.clip));
    else if (st.clip && st.clip.kind === 'slides') App.exec('pasteSlides');
    else App.toast(App.t('Het klembord is leeg. Gebruik Ctrl+V om te plakken uit een ander programma.'), 'info');
  });
  App.pasteHtml = async (html) => {
    const m = new RegExp(CLIP_MARK + '="([^"]+)"').exec(html);
    if (m) {
      try {
        const json = decodeURIComponent(escape(atob(m[1].replace(/&#43;/g, '+').replace(/&amp;/g, '&'))));
        const clip = JSON.parse(json);
        if (clip && clip.kind === 'objs' && Array.isArray(clip.objs)) { App.run(() => App.pasteClip(App.cleanClip(clip))); return true; }
        if (clip && clip.kind === 'slides' && App.pasteSlidesClip) { App.pasteSlidesClip(clip); return true; }
      } catch (e) { console.warn('plakken', e); }
    }
    // tabel uit een rekenblad of webpagina
    if (/<table/i.test(html) && App.tables && App.tables.fromHtml) { const t = App.tables.fromHtml(html); if (t) { App.run(() => { App.addObj(t); }); App.drawSelection(); return true; } }
    return false;
  };
  // Plakken van buiten: gegevens van een andere bron altijd controleren
  App.cleanClip = (clip) => ({ ...clip, objs: clip.objs.map((o) => App.cleanObj ? App.cleanObj(o) : o).filter(Boolean), media: App.cleanMedia ? App.cleanMedia(clip.media || {}) : {} });
  App.pasteText = (t) => {
    App.run(() => {
      const P = App.pres;
      const lines = String(t).replace(/\r\n?/g, '\n').split('\n');
      const o = App.newObj('shape', { geom: 'rect', txbox: true, fill: { type: 'none' }, line: { type: 'none' }, name: App.objName('Tekstvak'), x: P.size.w * 0.15, y: P.size.h * 0.3, w: P.size.w * 0.7, h: 50, text: { paras: lines.map((l) => ({ runs: [{ t: l.replace(/\t/g, '    ') }] })), wrap: true } });
      App.addObj(o);
      App.autofit(o, App.surface().owner);
    });
    App.drawSelection();
  };
  document.addEventListener('paste', (e) => {
    if (!App.pres || $('.backdrop') || $('#backstage')) return;
    if (e.target.closest && e.target.closest('input, textarea, #notes')) return;
    if (st.edit) return;   // textedit.js
    const dt = e.clipboardData; if (!dt) return;
    if (document.activeElement && document.activeElement.closest('#thumb-list, #sorter')) { e.preventDefault(); App.exec('pasteSlides'); return; }
    const files = Array.from(dt.files || []);
    const html = dt.getData('text/html');
    e.preventDefault();
    if (html && new RegExp(CLIP_MARK).test(html)) { App.pasteHtml(html); return; }
    if (files.length && files[0].type.startsWith('image/')) { files.forEach((f) => App.insertImageFile(f)); return; }
    if (files.length && /^(video|audio)\//.test(files[0].type)) { App.insertMediaFile && App.insertMediaFile(files[0]); return; }
    if (html) { App.pasteHtml(html).then((ok) => { if (!ok) { const t = dt.getData('text/plain'); if (t) App.pasteText(t); } }); return; }
    const t = dt.getData('text/plain');
    if (t) App.pasteText(t);
  });
  document.addEventListener('copy', (e) => {
    if (!App.pres || st.edit || (e.target.closest && e.target.closest('input, textarea, #notes')) || $('.backdrop')) return;
    if (!st.sel.length) return;
    e.preventDefault();
    const clip = packClip(App.selObjs());
    st.clip = clip; st.clipPastes = 0;
    const text = App.selObjs().map(App.objText).filter(Boolean).join('\n');
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', `<meta charset="utf-8"><div ${CLIP_MARK}="${btoa(unescape(encodeURIComponent(JSON.stringify(clip))))}">${App.esc(text)}</div>`);
  });
  document.addEventListener('cut', (e) => {
    if (!App.pres || st.edit || (e.target.closest && e.target.closest('input, textarea, #notes')) || $('.backdrop')) return;
    if (!st.sel.length) return;
    e.preventDefault();
    App.copyObjs(true);
  });

  /* ---------- Rechtsklikmenu op het werkvlak ---------- */
  stage.addEventListener('contextmenu', (e) => {
    if (!App.pres) return;
    if (st.edit && e.target.closest('[contenteditable]')) { App.textEdit.contextMenu && App.textEdit.contextMenu(e); return; }
    e.preventDefault();
    const id = pickObj(e.target);
    if (id && !st.sel.includes(id)) App.select([id]);
    if (!id && st.sel.length) App.select([]);
    const o = App.sel1();
    const items = [];
    const it = (cmd, icon, label, arg, kbd) => `<button data-cmd="${cmd}"${arg !== undefined ? ` data-arg="${App.esc(arg)}"` : ''}><span class="i">${icon}</span> ${App.esc(App.t(label))}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;
    if (id) {
      items.push(it('cut', 'content_cut', 'Knippen', undefined, 'Ctrl+X'), it('copy', 'content_copy', 'Kopiëren', undefined, 'Ctrl+C'), it('paste', 'content_paste', 'Plakken', undefined, 'Ctrl+V'), '<hr>');
      if (o && o.type === 'shape') items.push(it('editText', 'edit', 'Tekst bewerken'));
      if (o && o.type === 'shape' && !o.ph) items.push(it('editPoints', 'polyline', 'Punten bewerken'));
      if (o && o.type === 'image') items.push(it('changePicture', 'swap_horiz', 'Afbeelding wijzigen'), it('crop', 'crop', 'Bijsnijden'));
      if (o && o.type === 'chart') items.push(it('chartEditData', 'table_edit', 'Gegevens bewerken'), it('chartType', 'insert_chart', 'Ander grafiektype'));
      if (o && o.type === 'table') items.push(it('tableInsert', 'add_row_below', 'Rij hieronder invoegen', 'below'), it('tableInsert', 'add_column_right', 'Kolom rechts invoegen', 'right'), it('tableDelete', 'table_rows', 'Rijen verwijderen', 'rows'), it('tableDelete', 'view_column', 'Kolommen verwijderen', 'cols'));
      if (o && o.type === 'diagram') items.push(it('diaConvert', 'transform', 'Converteren naar vormen', 'shapes'), it('diaConvert', 'notes', 'Converteren naar tekst', 'text'));
      items.push('<hr>');
      if (st.sel.length > 1) items.push(it('group', 'ad_group', 'Groeperen', undefined, 'Ctrl+G'));
      if (o && o.type === 'group') items.push(it('ungroup', 'ad_group_off', 'Groep opheffen', undefined, 'Ctrl+Shift+G'));
      items.push(it('order', 'flip_to_front', 'Naar voorgrond', 'front'), it('order', 'flip_to_back', 'Naar achtergrond', 'back'), '<hr>');
      items.push(it('linkDialog', 'link', 'Koppeling…', undefined, 'Ctrl+K'), it('saveAsPicture', 'image', 'Opslaan als afbeelding…'), it('altText', 'alt_route', 'Alternatieve tekst bewerken…'));
      if (st.sel.length === 1 && App.surface().kind === 'slide') items.push(it('newComment', 'add_comment', 'Nieuwe opmerking'));
      items.push('<hr>', it('togglePane', 'aspect_ratio', 'Grootte en positie…', 'size'), it('togglePane', 'format_shapes', o && o.type === 'image' ? 'Afbeelding opmaken…' : 'Vorm opmaken…', 'format'));
      if (o && o.ph && App.surface().kind === 'slide') items.push(it('resetPlaceholder', 'restart_alt', 'Opnieuw instellen'));
    } else {
      items.push(it('paste', 'content_paste', 'Plakken', undefined, 'Ctrl+V'), '<hr>');
      if (App.surface().kind === 'slide') {
        items.push(`<button data-menu-sub="m-layout" data-cmd="noop"><span class="i">dashboard</span> ${App.t('Indeling')} ›</button>`, it('resetSlide', 'restart_alt', 'Dia opnieuw instellen'), '<hr>');
      }
      items.push(it('toggleSetting', 'straighten', 'Liniaal', 'ruler'), it('gridDialog', 'grid_4x4', 'Raster en hulplijnen…'), '<hr>');
      items.push(it('togglePane', 'wallpaper', 'Achtergrond opmaken…', 'background'));
      if (App.surface().kind === 'slide') items.push(it('newComment', 'add_comment', 'Nieuwe opmerking'));
    }
    App.openPopup({ x: e.clientX, y: e.clientY }, items.join(''), 'ctx-menu');
  });
  App.def('editText', () => { const o = App.sel1(); if (o && App.textEdit) App.textEdit.start(o.id, { end: true }); });
})();
