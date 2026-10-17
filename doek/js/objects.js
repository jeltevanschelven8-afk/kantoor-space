/* =========================================================
   Doek (gemaakt door JJ van Schelven) — objecten invoegen en schikken:
   tekstvak en vormen tekenen, vrije vorm, afbeeldingen, video en audio,
   uitlijnen, verdelen, volgorde, groeperen, draaien, spiegelen en grootte
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const stage = $('#stage');
  const P = () => App.pres;

  /* ---------- Gereedschap: iets tekenen op de dia ---------- */
  App.tool = { kind: 'select' };
  App.setTool = (kind, opts = {}) => {
    App.tool = { kind, ...opts, down: App.tool.down };
    stage.classList.toggle('placing', /^(shape|textbox|freeform|scribble|line)/.test(kind));
    stage.classList.toggle('tool-draw', kind === 'pen');
    stage.classList.toggle('tool-erase', kind === 'erase');
    App.scheduleState();
  };
  App.stateFns.toolSelect = () => App.tool.kind === 'select';
  App.stateFns.toolErase = () => App.tool.kind === 'erase';
  const preview = (kind, b) => {
    let el = $('#overlay .draw-preview');
    if (!el) { el = document.createElement('div'); el.className = 'draw-preview marquee'; $('#overlay').appendChild(el); }
    const z = App.zoom();
    el.style.cssText = `left:${b.x * z}px;top:${b.y * z}px;width:${b.w * z}px;height:${b.h * z}px;${kind === 'line' ? 'background:none;border:0' : ''}`;
    return el;
  };
  App.tool.down = (e) => {
    const t = App.tool;
    if (t.kind === 'select') return false;
    if (t.kind === 'pen' || t.kind === 'erase') return App.inkDown ? App.inkDown(e) : false;
    if (e.button !== 0) return false;
    e.preventDefault();
    const p0 = App.toSlide(e.clientX, e.clientY);
    if (t.kind === 'freeform') { freeformClick(e, p0); return true; }
    const pts = [[p0.x, p0.y]];
    let b = { x: p0.x, y: p0.y, w: 0, h: 0 }, moved = false;
    const svgLine = (() => { if (t.kind !== 'line' && t.kind !== 'scribble') return null; const s = App.svgEl('svg', { style: 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none', width: 1, height: 1 }); const path = App.svgEl('path', { fill: 'none', stroke: '#5f6b7a', 'stroke-width': 1.5 }); s.appendChild(path); $('#overlay').appendChild(s); return { s, path }; })();
    const move = (ev) => {
      let p = App.toSlide(ev.clientX, ev.clientY);
      moved = true;
      if (t.kind === 'scribble') { pts.push([p.x, p.y]); svgLine.path.setAttribute('d', App.strokePath(pts.map(([x, y]) => [x * App.zoom(), y * App.zoom()]))); return; }
      if (t.kind === 'line') {
        if (ev.shiftKey) { const dx = p.x - p0.x, dy = p.y - p0.y, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy); p = { x: p0.x + Math.cos(a) * l, y: p0.y + Math.sin(a) * l }; }
        pts[1] = [p.x, p.y]; const z = App.zoom();
        svgLine.path.setAttribute('d', `M${p0.x * z} ${p0.y * z} L${p.x * z} ${p.y * z}`);
        return;
      }
      let w = p.x - p0.x, h = p.y - p0.y;
      if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      b = ev.ctrlKey ? { x: p0.x - Math.abs(w), y: p0.y - Math.abs(h), w: Math.abs(w) * 2, h: Math.abs(h) * 2 } : { x: Math.min(p0.x, p0.x + w), y: Math.min(p0.y, p0.y + h), w: Math.abs(w), h: Math.abs(h) };
      preview(t.kind, b);
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      $$('#overlay .draw-preview').forEach((x) => x.remove());
      if (svgLine) svgLine.s.remove();
      const keep = t.keep;
      if (t.kind === 'textbox') placeTextBox(moved && b.w > 4 ? b : null, p0);
      else if (t.kind === 'line') placeLine(p0, moved ? { x: pts[1][0], y: pts[1][1] } : { x: p0.x + 96, y: p0.y }, t);
      else if (t.kind === 'scribble') { if (pts.length > 2) placePath([{ closed: false, pts: smoothPts(pts) }], true); }
      else if (t.kind.startsWith('shape:')) placeShape(t.kind.slice(6), moved && (b.w > 3 || b.h > 3) ? b : { x: p0.x, y: p0.y, w: 96, h: 96 });
      if (!keep) App.setTool('select');
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    return true;
  };
  App.def('insertShape', (geom) => {
    if (st.edit) App.textEdit.stop();
    if (geom === 'freeform') { App.setTool('freeform'); App.toast(App.t('Klik om punten te plaatsen; dubbelklik of klik op het beginpunt om te stoppen. Sleep voor een vrije lijn.'), 'gesture', { ms: 4000 }); return; }
    if (geom === 'scribble') { App.setTool('scribble'); return; }
    if (/^(line|straightConnector1|bentConnector3|curvedConnector3)/.test(geom)) { const [g, arrows] = geom.split(':'); App.setTool('line', { geom: g, arrows }); return; }
    App.setTool('shape:' + geom);
  });
  App.def('insertTextBox', () => { if (st.edit) App.textEdit.stop(); App.setTool('textbox'); });
  const placeShape = (geom, b) => {
    App.run(() => {
      const o = App.newObj('shape', { geom, x: App.round(b.x, 2), y: App.round(b.y, 2), w: App.round(Math.max(4, b.w), 2), h: App.round(Math.max(4, b.h), 2), name: App.objName(App.t(App.shapeName(geom))) });
      const defs = App.Shapes && App.Shapes.defaults ? App.Shapes.defaults(geom) : {};
      if (defs && Object.keys(defs).length) o.adj = { ...defs };
      App.applyDefaultStyle && App.applyDefaultStyle(o);
      App.addObj(o);
    });
    App.select(st.sel);
  };
  App.shapeName = (geom) => { const s = App.Shapes && App.Shapes.LIST && App.Shapes.LIST.find((x) => x.id === geom); return s ? s.name : 'Vorm'; };
  const placeTextBox = (b, p0) => {
    let o;
    App.run(() => {
      o = App.newObj('shape', { geom: 'rect', txbox: true, fill: { type: 'none' }, line: { type: 'none' }, name: App.objName(App.t('Tekstvak')),
        x: App.round(b ? b.x : p0.x, 2), y: App.round(b ? b.y : p0.y, 2), w: App.round(b ? b.w : 200, 2), h: 40,
        text: { paras: [App.emptyPara()], wrap: !!b || undefined, fit: 'resize' } });
      if (!b) o.text.wrap = false;
      App.addObj(o);
      App.autofit(o, App.surface().owner);
    });
    App.select([o.id]);
    App.textEdit.start(o.id, { end: true });
  };
  const placeLine = (p1, p2, t) => {
    App.run(() => {
      const geom = t.geom || 'line';
      const o = App.newObj('line', { geom, pts: [[App.round(p1.x, 2), App.round(p1.y, 2)], [App.round(p2.x, 2), App.round(p2.y, 2)]], name: App.objName(App.t(geom === 'line' ? 'Rechte verbindingslijn' : 'Verbindingslijn')) });
      o.line = { type: 'solid', color: 'accent1', w: 1 };
      if (t.arrows === 'end' || geom === 'straightConnector1' && !t.arrows) o.line.tail = { type: 'triangle' };
      if (t.arrows === 'both') { o.line.head = { type: 'triangle' }; o.line.tail = { type: 'triangle' }; }
      App.syncLine(o);
      App.addObj(o);
    });
    App.select(st.sel);
  };
  // Vrije vorm: klikken plaatst punten, slepen tekent vrij
  let ff = null;
  const freeformClick = (e, p) => {
    if (!ff) {
      ff = { pts: [[p.x, p.y]], svg: App.svgEl('svg', { style: 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none', width: 1, height: 1 }) };
      ff.path = App.svgEl('path', { fill: 'rgba(95,132,194,.12)', stroke: '#5f6b7a', 'stroke-width': 1.5 });
      ff.svg.appendChild(ff.path); $('#overlay').appendChild(ff.svg);
      ff.move = (ev) => { const q = App.toSlide(ev.clientX, ev.clientY); const z = App.zoom(); ff.path.setAttribute('d', 'M' + [...ff.pts, [q.x, q.y]].map(([x, y]) => `${x * z} ${y * z}`).join(' L')); };
      document.addEventListener('mousemove', ff.move);
      return;
    }
    const first = ff.pts[0];
    const close = Math.hypot(first[0] - p.x, first[1] - p.y) < 8 / App.zoom();
    if (e.detail >= 2 || close) { finishFreeform(close); return; }
    ff.pts.push([p.x, p.y]);
  };
  const finishFreeform = (closed) => {
    if (!ff) return;
    document.removeEventListener('mousemove', ff.move);
    ff.svg.remove();
    const pts = ff.pts; ff = null;
    App.setTool('select');
    if (pts.length < 2) return;
    placePath([{ closed, pts: pts.map(([x, y]) => ({ x, y })) }], !closed);
  };
  const smoothPts = (pts) => {
    // gladde krabbel: punten uitdunnen en als Bézier opslaan
    const thin = [pts[0]];
    pts.forEach((p) => { const l = thin[thin.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 3) thin.push(p); });
    if (thin.length < 2) thin.push(pts[pts.length - 1]);
    const out = [{ x: thin[0][0], y: thin[0][1] }];
    for (let i = 1; i < thin.length; i++) {
      const p0 = thin[i - 2] || thin[i - 1], p1 = thin[i - 1], p2 = thin[i], p3 = thin[i + 1] || thin[i];
      out.push({ x: p2[0], y: p2[1], c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] });
    }
    return out;
  };
  // Pad in diacoördinaten → vorm met eigen geometrie
  const placePath = (subs, open) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    subs.forEach((s) => s.pts.forEach((p) => { [[p.x, p.y], p.c1, p.c2].forEach((q) => { if (!q) return; x1 = Math.min(x1, q[0]); y1 = Math.min(y1, q[1]); x2 = Math.max(x2, q[0]); y2 = Math.max(y2, q[1]); }); }));
    const w = Math.max(1, x2 - x1), h = Math.max(1, y2 - y1);
    const local = subs.map((s) => ({ closed: s.closed, pts: s.pts.map((p) => ({ x: App.round(p.x - x1, 2), y: App.round(p.y - y1, 2), ...(p.c1 ? { c1: [App.round(p.c1[0] - x1, 2), App.round(p.c1[1] - y1, 2)], c2: [App.round(p.c2[0] - x1, 2), App.round(p.c2[1] - y1, 2)] } : {}) })) }));
    App.run(() => {
      const o = App.newObj('shape', { geom: 'custom', path: { w, h, subs: local }, x: App.round(x1, 2), y: App.round(y1, 2), w: App.round(w, 2), h: App.round(h, 2), name: App.objName(App.t('Vrije vorm')) });
      if (open) { o.fill = { type: 'none' }; o.line = { type: 'solid', color: 'accent1', w: 1.5 }; }
      App.addObj(o);
    });
    App.select(st.sel);
  };
  App.placePath = placePath;

  /* ---------- Vormengalerij ---------- */
  const shapeBtns = (filter) => {
    if (!App.Shapes || !App.Shapes.LIST) return '';
    return App.Shapes.CATS.map((c) => {
      const items = App.Shapes.LIST.filter((s) => s.cat === c.id && (!filter || filter(s)));
      if (!items.length) return '';
      return `<div class="menu-title">${App.esc(App.t(c.name))}</div><div class="sm-grid">${items.map((s) => `<button data-cmd="${filter ? 'changeShape' : 'insertShape'}" data-arg="${s.id}${s.arrows ? ':' + s.arrows : ''}" title="${App.esc(App.t(s.name))}">${safeIcon(s.id)}</button>`).join('')}</div>`;
    }).join('');
  };
  const iconCache = {};
  const safeIcon = (id) => { if (iconCache[id]) return iconCache[id]; let h = ''; try { h = App.Shapes.icon(id, 22); } catch { h = ''; } if (!/^<svg[\s>]/.test(h)) h = '<span class="i">category</span>'; iconCache[id] = h; return h; };
  App.menuBuilders['m-shapes'] = () => {
    const recent = (App.settings.recentShapes || []).filter((id) => App.Shapes && App.Shapes.has && App.Shapes.has(id));
    return (recent.length ? `<div class="menu-title">${App.t('Recent gebruikte vormen')}</div><div class="sm-grid">${recent.map((id) => `<button data-cmd="insertShape" data-arg="${id}" title="${App.esc(App.t(App.shapeName(id)))}">${safeIcon(id)}</button>`).join('')}</div>` : '') + shapeBtns();
  };
  App.menuBuilders['m-shapes'].cls = 'shapes-menu';
  App.menuBuilders['m-changeshape'] = () => shapeBtns((s) => s.cat !== 'lines');
  App.menuBuilders['m-changeshape'].cls = 'shapes-menu';
  App.menuBuilders['m-picshape'] = () => shapeBtns((s) => s.cat !== 'lines').replace(/data-cmd="changeShape"/g, 'data-cmd="cropToShape"');
  App.menuBuilders['m-picshape'].cls = 'shapes-menu';
  App.on('menu', (name) => { void name; });
  // kleine vormenstrook in het lint (Start › Tekenen en Vormopmaak)
  App.fillShapeStrips = () => {
    if (!App.Shapes || !App.Shapes.LIST) return;
    const ids = ['line', 'straightConnector1', 'rect', 'ellipse', 'triangle', 'rtTriangle', 'roundRect', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'pentagon', 'hexagon', 'star5', 'wedgeRectCallout', 'flowChartProcess', 'flowChartDecision', 'heart', 'lightningBolt', 'cloud', 'leftBrace', 'rightBrace', 'chevron', 'homePlate'].filter((id) => App.Shapes.has(id));
    ['#home-shapes', '#sf-shapes'].forEach((sel) => { const el = $(sel); if (el) el.innerHTML = ids.map((id) => `<button data-cmd="insertShape" data-arg="${id}" title="${App.esc(App.t(App.shapeName(id)))}">${safeIcon(id)}</button>`).join('') + `<button data-menu="m-shapes" title="${App.esc(App.t('Meer vormen'))}"><span class="i" style="font-size:16px">expand_more</span></button>`; });
  };
  App.def('changeShape', (geom) => {
    App.run(() => App.selObjs().forEach((o) => { if (o.type !== 'shape') return; o.geom = geom; delete o.path; const d = App.Shapes.defaults(geom); if (d && Object.keys(d).length) o.adj = { ...d }; else delete o.adj; }));
  });
  App.on('change', () => {});

  /* ---------- Afbeeldingen ---------- */
  App.addMedia = (url, mime, name, extra = {}) => {
    const h = App.hash(url);
    const found = Object.keys(App.media).find((k) => App.media[k].h === h && App.media[k].url.length === url.length);
    if (found) return found;
    const id = App.uid('m');
    App.media[id] = { mime: mime || (url.slice(5, url.indexOf(';')) || 'application/octet-stream'), url, name: name || '', h, ...extra };
    App.mediaChanged && App.mediaChanged(id);
    return id;
  };
  const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(App.t('Afbeelding kan niet worden gelezen'))); i.src = url; });
  // Grote foto's verkleinen tot een redelijke resolutie (instelbaar via Comprimeren)
  App.fitImageUrl = async (url, max = 2400) => {
    const img = await loadImg(url);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (/^data:image\/(svg|gif)/.test(url) || Math.max(w, h) <= max) return { url, w, h };
    const f = max / Math.max(w, h); w = Math.round(w * f); h = Math.round(h * f);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const png = /^data:image\/png/.test(url);
    return { url: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w, h };
  };
  App.insertImageUrl = async (url, name, opts = {}) => {
    const fit = await App.fitImageUrl(url);
    const id = App.addMedia(fit.url, null, name, { nat: { w: fit.w, h: fit.h } });
    let made;
    App.run(() => {
      const S = P().size;
      // in een lege afbeeldings- of inhoudsplaceholder zetten (zoals bekende programma's)
      const target = opts.ph ? App.obj(opts.ph) : App.surface().kind === 'slide' && App.sel1() && App.sel1().ph && /^(pic|obj)$/.test(App.sel1().ph.type) && App.isEmptyText(App.sel1()) ? App.sel1() : null;
      let b;
      if (target) {
        const tb = App.box(target, App.surface().owner);
        const r = Math.min(tb.w / fit.w, tb.h / fit.h);
        const crop = target.ph.type === 'pic';
        if (crop) { b = { ...tb }; }
        else b = { w: fit.w * r, h: fit.h * r, x: tb.x + (tb.w - fit.w * r) / 2, y: tb.y + (tb.h - fit.h * r) / 2 };
        made = App.newObj('image', { media: id, nat: { w: fit.w, h: fit.h }, ...b, name: App.objName(App.t('Afbeelding')), ph: crop ? { ...target.ph } : undefined });
        if (crop) { const ar = fit.w / fit.h, br = tb.w / tb.h; if (ar > br) { const c = (1 - br / ar) / 2; made.crop = { l: c, r: c, t: 0, b: 0 }; } else { const c = (1 - ar / br) / 2; made.crop = { t: c, b: c, l: 0, r: 0 }; } delete made.x; delete made.y; delete made.w; delete made.h; }
        const list = App.ownerList(target.id); list.splice(list.indexOf(target), 1, made);
        st.sel = [made.id];
      } else {
        const sc = Math.min(1, (S.w * 0.8) / fit.w, (S.h * 0.8) / fit.h);
        const w = fit.w * sc, h = fit.h * sc;
        made = App.newObj('image', { media: id, nat: { w: fit.w, h: fit.h }, x: (S.w - w) / 2 + (opts.offset || 0), y: (S.h - h) / 2 + (opts.offset || 0), w, h, name: App.objName(App.t('Afbeelding')) });
        App.addObj(made);
      }
    });
    App.select([made.id]);
    App.updateContext();
    App.setContext({ pictureFormat: true, auto: true });
    return made;
  };
  App.insertImageFile = async (file, opts) => {
    if (!file || !/^image\//.test(file.type)) { App.toast(App.t('Dit is geen afbeelding.'), 'error'); return null; }
    try { return await App.insertImageUrl(await App.readFile(file, 'dataurl'), file.name, opts); } catch (e) { App.toast(App.t('Kon de afbeelding niet invoegen: {0}').replace('{0}', e.message), 'error'); return null; }
  };
  App.def('imageFromFile', async (ph) => {
    const files = await App.pickFile('image/*', true);
    if (!files || !files.length) return;
    for (let i = 0; i < files.length; i++) await App.insertImageFile(files[i], { offset: i * 18, ph: i === 0 ? ph : undefined });
  });
  App.def('imageFromUrl', async () => {
    const url = await App.prompt(App.t('Afbeelding van internetadres'), App.t('Adres van de afbeelding'), 'https://', { hint: App.t('De afbeelding wordt één keer opgehaald en daarna in de presentatie bewaard.') });
    if (!url || !/^https?:\/\//i.test(url.trim())) return;
    try {
      const r = await fetch(url.trim(), { mode: 'cors' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      if (!/^image\//.test(blob.type)) throw new Error(App.t('Dit adres geeft geen afbeelding.'));
      await App.insertImageFile(new File([blob], url.split('/').pop() || 'afbeelding', { type: blob.type }));
    } catch (e) { App.toast(App.t('Kon de afbeelding niet ophalen: {0}').replace('{0}', e.message), 'error', { ms: 5000 }); }
  });
  App.def('pasteImage', async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) { const t = it.types.find((x) => x.startsWith('image/')); if (t) { await App.insertImageFile(new File([await it.getType(t)], 'afbeelding.png', { type: t })); return; } }
      App.toast(App.t('Er staat geen afbeelding op het klembord.'), 'info');
    } catch { App.toast(App.t('Geen toegang tot het klembord. Gebruik Ctrl+V.'), 'info'); }
  });
  App.def('photoAlbum', async () => {
    const files = await App.pickFile('image/*', true);
    if (!files || !files.length) return;
    const m = App.masterOf(App.cur());
    const layout = m.layouts.find((l) => l.type === 'blank') || m.layouts[0];
    for (const f of files) {
      App.run(() => { const s = App.newSlide(layout); const at = st.slide + 1; P().slides.splice(at, 0, s); if (P().sections.length) s.sec = App.cur().sec; st.slide = at; }, { all: true });
      App.gotoSlide(st.slide);
      await App.insertImageFile(f);
      App.run(() => { const o = App.sel1(); if (!o) return; const S = P().size; const sc = Math.min(S.w * 0.9 / o.w, S.h * 0.9 / o.h); o.w *= sc; o.h *= sc; o.x = (S.w - o.w) / 2; o.y = (S.h - o.h) / 2; });
    }
    App.thumbs.refresh(true);
  });
  // Schermopname: de gebruiker kiest zelf het scherm of venster
  App.def('screenshot', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { App.toast(App.t('Schermopnamen worden niet ondersteund in dit venster.'), 'info'); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const v = document.createElement('video'); v.srcObject = stream; v.muted = true; await v.play();
      await new Promise((r) => setTimeout(r, 350));
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      await App.insertImageUrl(c.toDataURL('image/png'), App.t('Schermopname'));
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') App.toast(App.t('Schermopname mislukt: {0}').replace('{0}', e.message), 'error'); }
  });

  /* ---------- Video en audio ---------- */
  App.insertMediaFile = async (file) => {
    const isVideo = /^video\//.test(file.type), isAudio = /^audio\//.test(file.type);
    if (!isVideo && !isAudio) { App.toast(App.t('Dit bestandstype wordt niet ondersteund.'), 'error'); return; }
    if (file.size > 300 * 1024 * 1024) { App.toast(App.t('Dit bestand is te groot (meer dan 300 MB).'), 'error'); return; }
    App.toast(App.t('Bezig met invoegen…'), 'hourglass_top', { ms: 1500 });
    const url = await App.readFile(file, 'dataurl');
    const id = App.addMedia(url, file.type, file.name);
    let w = 640, h = 360, poster = null, dur = 0;
    try {
      const el = document.createElement(isVideo ? 'video' : 'audio');
      el.preload = 'auto'; el.muted = true; el.src = url;
      await new Promise((res, rej) => { el.onloadedmetadata = res; el.onerror = () => rej(new Error('media')); setTimeout(res, 6000); });
      dur = el.duration || 0;
      if (isVideo && el.videoWidth) {
        w = el.videoWidth; h = el.videoHeight;
        el.currentTime = Math.min(1, dur / 3 || 0);
        await new Promise((res) => { el.onseeked = res; setTimeout(res, 2500); });
        const c = document.createElement('canvas'); const sc = Math.min(1, 1280 / w); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
        c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
        poster = App.addMedia(c.toDataURL('image/jpeg', 0.85), 'image/jpeg', 'poster', { nat: { w: c.width, h: c.height } });
      }
    } catch { /* geen voorbeeldframe */ }
    App.run(() => {
      const S = P().size;
      let o;
      if (isVideo) {
        const sc = Math.min(1, S.w * 0.7 / w, S.h * 0.7 / h);
        o = App.newObj('video', { media: id, poster, x: (S.w - w * sc) / 2, y: (S.h - h * sc) / 2, w: w * sc, h: h * sc, play: 'seq', dur, name: App.objName(App.t('Video')) });
      } else o = App.newObj('audio', { media: id, x: S.w - 80, y: S.h - 80, w: 48, h: 48, play: 'seq', dur, name: App.objName(App.t('Audio')) });
      App.addObj(o);
    });
    App.select(st.sel);
    App.setContext({ media: true, auto: true });
  };
  App.def('videoFromFile', async () => { const f = await App.pickFile('video/*'); if (f) App.insertMediaFile(f); });
  App.def('audioFromFile', async () => { const f = await App.pickFile('audio/*'); if (f) App.insertMediaFile(f); });
  // Opnemen (scherm, camera, microfoon) met MediaRecorder; alleen na toestemming van de gebruiker
  const record = async (kind) => {
    let stream;
    try {
      if (kind === 'screen') stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      else if (kind === 'camera') stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      else stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') App.toast(App.t('Opnemen is niet gelukt: {0}').replace('{0}', e.message), 'error'); return; }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m) && (kind === 'audio' ? m.startsWith('audio') : m.startsWith('video')));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const t0 = Date.now();
    const d = App.dialog({
      title: App.t(kind === 'audio' ? 'Audio opnemen' : kind === 'camera' ? 'Opnemen met camera' : 'Schermopname'),
      body: `<div style="display:flex;align-items:center;gap:10px"><span class="rec-dot"></span><b id="rec-t">0:00</b><span class="muted">${App.t('Bezig met opnemen…')}</span></div>`,
      buttons: [{ label: 'Annuleren', action: () => { rec.onstop = null; rec.stop(); stream.getTracks().forEach((t) => t.stop()); } }, { label: 'Stoppen en invoegen', primary: true, action: () => { rec.stop(); } }],
      modal: true,
    });
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const e = d.$('#rec-t'); if (e) e.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 250);
    rec.onstop = () => {
      clearInterval(tick);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
      App.insertMediaFile(new File([blob], (kind === 'audio' ? 'opname' : 'video') + '.webm', { type: blob.type }));
    };
    stream.getTracks().forEach((t) => { t.onended = () => { if (rec.state === 'recording') { rec.stop(); d.close(); } }; });
    rec.start(500);
  };
  App.def('screenRecord', () => record('screen'));
  App.def('cameraRecord', () => record('camera'));
  App.def('audioRecord', () => record('audio'));

  /* ---------- Placeholder: invoegknoppen ---------- */
  App.def('phInsert', ({ kind, id }) => {
    if (kind === 'picture') App.exec('imageFromFile', id);
    else if (kind === 'table') App.exec('tableDialog', id);
    else if (kind === 'chart') App.exec('chartDialog', id);
    else if (kind === 'diagram') App.exec('diagramDialog', id);
    else if (kind === 'icon') App.exec('iconDialog', id);
    else if (kind === 'video') App.exec('videoFromFile');
  });
  // nieuw object op de plek van een (lege) placeholder zetten
  App.placeInPh = (o, phId) => {
    const ph = phId ? App.obj(phId) : null;
    if (!ph || !App.isEmptyText(ph)) return false;
    const b = App.box(ph, App.surface().owner);
    Object.assign(o, { x: b.x, y: b.y, w: b.w, h: b.h });
    const list = App.ownerList(ph.id); list.splice(list.indexOf(ph), 1, o);
    return true;
  };

  /* ---------- Schikken ---------- */
  App.defEdit('order', (how) => {
    const sel = App.selObjs(); if (!sel.length) return false;
    const lists = new Map();
    sel.forEach((o) => { const l = App.ownerList(o.id); if (!lists.has(l)) lists.set(l, []); lists.get(l).push(o); });
    lists.forEach((objs, l) => {
      const idx = (o) => l.indexOf(o);
      if (how === 'front') { objs.sort((a, b) => idx(a) - idx(b)).forEach((o) => { l.splice(idx(o), 1); l.push(o); }); }
      else if (how === 'back') { objs.sort((a, b) => idx(b) - idx(a)).forEach((o) => { l.splice(idx(o), 1); l.unshift(o); }); }
      else if (how === 'forward') { objs.sort((a, b) => idx(b) - idx(a)).forEach((o) => { const i = idx(o); if (i < l.length - 1 && !objs.includes(l[i + 1])) { l.splice(i, 1); l.splice(i + 1, 0, o); } }); }
      else if (how === 'backward') { objs.sort((a, b) => idx(a) - idx(b)).forEach((o) => { const i = idx(o); if (i > 0 && !objs.includes(l[i - 1])) { l.splice(i, 1); l.splice(i - 1, 0, o); } }); }
    });
  });
  App.state.alignTo = null;   // null = automatisch: één object → dia, meerdere → selectie
  App.def('alignTo', (m) => { App.state.alignTo = m; });
  App.menuAfter['m-align'] = (m) => { const mode = App.state.alignTo || (App.state.sel.length > 1 ? 'sel' : 'slide'); m.querySelectorAll('[data-alignto]').forEach((x) => { x.textContent = x.dataset.alignto === mode ? 'radio_button_checked' : 'radio_button_unchecked'; }); };
  App.defEdit('alignObjs', (how) => {
    const sel = App.selObjs().filter((o) => !o.locked); if (!sel.length) return false;
    const mode = App.state.alignTo || (sel.length > 1 ? 'sel' : 'slide');
    const ref = mode === 'slide' ? { x: 0, y: 0, w: P().size.w, h: P().size.h } : App.selBounds(sel.map((o) => o.id));
    sel.forEach((o) => {
      const a = App.aabb(App.worldBox(o.id));
      let dx = 0, dy = 0;
      if (how === 'l') dx = ref.x - a.x; else if (how === 'c') dx = ref.x + ref.w / 2 - (a.x + a.w / 2); else if (how === 'r') dx = ref.x + ref.w - (a.x + a.w);
      else if (how === 't') dy = ref.y - a.y; else if (how === 'm') dy = ref.y + ref.h / 2 - (a.y + a.h / 2); else if (how === 'b') dy = ref.y + ref.h - (a.y + a.h);
      App.moveObj(o, dx, dy);
    });
    App.updateConnectors();
  });
  App.defEdit('distribute', (dir) => {
    const sel = App.selObjs().filter((o) => !o.locked);
    const mode = App.state.alignTo || (sel.length > 2 ? 'sel' : 'slide');
    if (sel.length < 2 && mode !== 'slide') return false;
    const items = sel.map((o) => ({ o, a: App.aabb(App.worldBox(o.id)) }));
    const h = dir === 'h';
    items.sort((p, q) => (h ? p.a.x - q.a.x : p.a.y - q.a.y));
    const ref = mode === 'slide' ? { x: 0, y: 0, w: P().size.w, h: P().size.h } : App.selBounds(sel.map((o) => o.id));
    const total = items.reduce((n, x) => n + (h ? x.a.w : x.a.h), 0);
    const gap = ((h ? ref.w : ref.h) - total) / Math.max(1, items.length - (mode === 'slide' ? -1 : 1));
    let pos = (h ? ref.x : ref.y) + (mode === 'slide' ? gap : 0);
    items.forEach((x) => { const d = pos - (h ? x.a.x : x.a.y); App.moveObj(x.o, h ? d : 0, h ? 0 : d); pos += (h ? x.a.w : x.a.h) + gap; });
    App.updateConnectors();
  });
  App.defEdit('group', () => {
    const sel = App.selObjs();
    if (sel.length < 2) { App.toast(App.t('Selecteer minstens twee objecten om te groeperen.'), 'info'); return false; }
    const list = App.ownerList(sel[0].id);
    if (!sel.every((o) => App.ownerList(o.id) === list)) return false;
    if (sel.some((o) => o.ph) && App.surface().kind === 'slide') { App.toast(App.t('Tijdelijke aanduidingen kunnen niet worden gegroepeerd.'), 'info'); return false; }
    const ordered = list.filter((o) => sel.includes(o));
    const bb = App.selBounds(ordered.map((o) => o.id));
    const par = App.parentOf(ordered[0].id);
    const local = par ? App.toLocalOf(par, bb.x, bb.y) : { x: bb.x, y: bb.y };
    const g = App.newObj('group', { x: local.x, y: local.y, w: bb.w, h: bb.h, objs: [], name: App.objName(App.t('Groep')) });
    ordered.forEach((o) => {
      const wb = App.worldBox(o.id);
      if (o.pts) { const pw = par ? null : null; void pw; o.pts = o.pts.map(([x, y]) => { const w = par ? App.toWorldOf(par, x, y) : { x, y }; return [App.round(w.x - bb.x, 2), App.round(w.y - bb.y, 2)]; }); App.syncLine(o); }
      else { App.fixBox(o); o.x = App.round(wb.cx - wb.w / 2 - bb.x, 2); o.y = App.round(wb.cy - wb.h / 2 - bb.y, 2); o.rot = App.round(wb.rot - (par ? App.worldBox(par.id).rot : 0), 2) || undefined; if (!o.rot) delete o.rot; }
      delete o.conn;
    });
    const at = list.indexOf(ordered[ordered.length - 1]);
    ordered.forEach((o) => list.splice(list.indexOf(o), 1));
    g.objs = ordered;
    list.splice(Math.min(at - ordered.length + 1, list.length), 0, g);
    st.lastGroup = { id: g.id, kids: ordered.map((o) => o.id) };
    App.select([g.id]);
  });
  App.ungroupObj = (g) => {
    const list = App.ownerList(g.id); if (!list) return [];
    const i = list.indexOf(g);
    const gw = App.worldBox(g.id);
    const par = App.parentOf(g.id);
    const kids = g.objs.map((c) => {
      const wcx = App.rotP(gw.x + c.x + c.w / 2, gw.y + c.y + c.h / 2, gw.cx, gw.cy, gw.rot);
      const pl = par ? App.toLocalOf(par, wcx.x, wcx.y) : wcx;
      if (c.pts) { c.pts = c.pts.map(([x, y]) => { const w = App.rotP(gw.x + x, gw.y + y, gw.cx, gw.cy, gw.rot); const l = par ? App.toLocalOf(par, w.x, w.y) : w; return [App.round(l.x, 2), App.round(l.y, 2)]; }); App.syncLine(c); }
      else { c.x = App.round(pl.x - c.w / 2, 2); c.y = App.round(pl.y - c.h / 2, 2); const r = ((c.rot || 0) + (g.rot || 0)) % 360; if (r) c.rot = App.round(r, 2); else delete c.rot; if (g.flipH) c.flipH = !c.flipH; if (g.flipV) c.flipV = !c.flipV; }
      return c;
    });
    list.splice(i, 1, ...kids);
    // animaties van de groep gaan naar het eerste kind
    const slide = App.surface().owner;
    if (slide.anims) slide.anims.forEach((a) => { if (a.obj === g.id) a.obj = kids[0].id; });
    return kids;
  };
  App.defEdit('ungroup', () => {
    const gs = App.selObjs().filter((o) => o.type === 'group');
    if (!gs.length) return false;
    let ids = [];
    gs.forEach((g) => { ids = ids.concat(App.ungroupObj(g).map((c) => c.id)); st.lastGroup = { id: g.id, kids: g.objs.map((c) => c.id) }; });
    App.select(ids);
  });
  App.defEdit('regroup', () => {
    const lg = st.lastGroup; if (!lg) return false;
    const objs = lg.kids.map((id) => App.obj(id)).filter(Boolean);
    if (objs.length < 2) return false;
    st.sel = objs.map((o) => o.id);
    App.commands.group.fn();
  });
  App.defEdit('rotate', (deg) => {
    App.selObjs().filter((o) => !o.locked).forEach((o) => {
      if (o.pts) { const c = { x: (o.pts[0][0] + o.pts[1][0]) / 2, y: (o.pts[0][1] + o.pts[1][1]) / 2 }; o.pts = o.pts.map(([x, y]) => { const q = App.rotP(x, y, c.x, c.y, +deg); return [App.round(q.x, 2), App.round(q.y, 2)]; }); App.syncLine(o); return; }
      App.fixBox(o);
      const r = (((o.rot || 0) + (+deg)) % 360 + 360) % 360;
      if (r) o.rot = r; else delete o.rot;
    });
    App.updateConnectors();
  });
  App.defEdit('flip', (d) => {
    App.selObjs().filter((o) => !o.locked).forEach((o) => {
      if (o.pts) { const [[x1, y1], [x2, y2]] = o.pts; o.pts = d === 'h' ? [[x2, y1], [x1, y2]] : [[x1, y2], [x2, y1]]; return; }
      const k = d === 'h' ? 'flipH' : 'flipV';
      if (o[k]) delete o[k]; else o[k] = true;
    });
  });
  App.defEdit('setSize', (arg) => {
    const key = arg && arg.key, v = App.parseNum(arg && arg.value);
    if (!Number.isFinite(v) || v <= 0) { App.updateSizeBoxes(); return false; }
    const px = v * App.CM;
    App.selObjs().forEach((o) => {
      if (o.pts) { const [[x1, y1], [x2, y2]] = o.pts; const len = key === 'w' ? Math.abs(x2 - x1) : Math.abs(y2 - y1); if (!len) return; const f = px / len; if (key === 'w') o.pts[1][0] = x1 + (x2 - x1) * f; else o.pts[1][1] = y1 + (y2 - y1) * f; App.syncLine(o); return; }
      App.fixBox(o);
      const keep = o.lockAspect || o.type === 'image' && o.lockAspect !== false;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const r = o.w / Math.max(0.01, o.h);
      if (key === 'w') { o.w = px; if (keep) o.h = px / r; } else { o.h = px; if (keep) o.w = px * r; }
      if (o.type === 'group') { App.scaleChildren(o.objs, o.w / (o.cwOld || (o.w)), 1); }
      if (o.rot) { o.x = cx - o.w / 2; o.y = cy - o.h / 2; }
    });
  });
  App.updateSizeBoxes = () => {
    const o = App.sel1();
    const h = o ? App.worldBox(o.id) : null;
    const fmt = (v) => (v === null ? '' : App.fmtNum(v / App.CM, 2));
    const hv = o ? (o.pts ? Math.abs(o.pts[1][1] - o.pts[0][1]) : h.h) : null, wv = o ? (o.pts ? Math.abs(o.pts[1][0] - o.pts[0][0]) : h.w) : null;
    $$('#sz-h, .sz-h').forEach((e) => { if (document.activeElement !== e) e.value = fmt(hv); });
    $$('#sz-w, .sz-w').forEach((e) => { if (document.activeElement !== e) e.value = fmt(wv); });
  };
  App.on('selection', App.updateSizeBoxes);
  App.on('change', App.updateSizeBoxes);

  /* ---------- Pictogrammen (Material Symbols, meegeleverd) ---------- */
  App.ICONS = {
    'Mensen': ['person', 'group', 'groups', 'face', 'sentiment_satisfied', 'sentiment_dissatisfied', 'mood', 'person_add', 'support_agent', 'diversity_3', 'family_restroom', 'elderly', 'child_care', 'accessibility_new', 'record_voice_over', 'handshake', 'waving_hand', 'thumb_up', 'thumb_down', 'front_hand'],
    'Zakelijk': ['business_center', 'work', 'apartment', 'store', 'payments', 'savings', 'account_balance', 'trending_up', 'trending_down', 'monitoring', 'insights', 'query_stats', 'pie_chart', 'bar_chart', 'leaderboard', 'paid', 'euro', 'receipt_long', 'shopping_cart', 'inventory_2', 'local_shipping', 'factory', 'badge', 'contract', 'gavel'],
    'Communicatie': ['mail', 'call', 'chat', 'forum', 'campaign', 'notifications', 'share', 'send', 'contact_mail', 'contact_phone', 'alternate_email', 'rss_feed', 'podcasts', 'mic', 'videocam', 'translate', 'language'],
    'Technologie': ['computer', 'laptop', 'smartphone', 'tablet', 'desktop_windows', 'keyboard', 'mouse', 'memory', 'router', 'wifi', 'bluetooth', 'cloud', 'cloud_upload', 'cloud_download', 'database', 'dns', 'code', 'terminal', 'bug_report', 'developer_board', 'smart_toy', 'qr_code', 'security', 'lock', 'key', 'fingerprint', 'vpn_key', 'settings', 'build', 'construction'],
    'Onderwijs': ['school', 'menu_book', 'auto_stories', 'library_books', 'science', 'biotech', 'calculate', 'functions', 'history_edu', 'psychology', 'lightbulb', 'emoji_objects', 'quiz', 'workspace_premium', 'military_tech', 'edit', 'draw', 'brush', 'palette', 'architecture'],
    'Natuur': ['eco', 'park', 'forest', 'nature', 'grass', 'water_drop', 'waves', 'sunny', 'cloud', 'thunderstorm', 'ac_unit', 'local_florist', 'pets', 'cruelty_free', 'bug_report', 'recycling', 'compost', 'energy_savings_leaf', 'solar_power', 'wind_power'],
    'Vervoer': ['directions_car', 'directions_bus', 'train', 'tram', 'subway', 'directions_bike', 'two_wheeler', 'flight', 'flight_takeoff', 'sailing', 'directions_boat', 'local_taxi', 'electric_car', 'ev_station', 'local_gas_station', 'traffic', 'map', 'place', 'navigation', 'explore', 'public'],
    'Gezondheid': ['favorite', 'health_and_safety', 'medical_services', 'local_hospital', 'medication', 'vaccines', 'monitor_heart', 'fitness_center', 'sports_soccer', 'sports_basketball', 'directions_run', 'self_improvement', 'spa', 'restaurant', 'local_cafe', 'nutrition', 'bedtime'],
    'Pijlen': ['arrow_forward', 'arrow_back', 'arrow_upward', 'arrow_downward', 'north_east', 'south_east', 'trending_flat', 'sync', 'autorenew', 'refresh', 'redo', 'undo', 'swap_horiz', 'swap_vert', 'double_arrow', 'expand_circle_down', 'change_circle', 'u_turn_right', 'merge', 'call_split', 'fork_right', 'east', 'west'],
    'Symbolen': ['check_circle', 'cancel', 'help', 'info', 'warning', 'error', 'star', 'grade', 'bolt', 'flag', 'bookmark', 'push_pin', 'verified', 'new_releases', 'local_fire_department', 'diamond', 'rocket_launch', 'emoji_events', 'celebration', 'cake', 'redeem', 'timer', 'schedule', 'event', 'calendar_month', 'hourglass_empty', 'search', 'visibility', 'tune', 'filter_alt', 'link', 'attach_file', 'home', 'house', 'location_city', 'stadium', 'museum', 'theater_comedy', 'music_note', 'movie', 'photo_camera', 'image', 'sports_esports', 'extension', 'target', 'track_changes', 'hub', 'device_hub', 'account_tree', 'schema', 'category'],
  };
  App.def('iconDialog', (phId) => {
    let pick = null;
    const all = [...new Set(Object.values(App.ICONS).flat())];
    const grid = (names) => names.map((n) => `<button data-ic="${n}" title="${n}"><span class="i">${n}</span></button>`).join('');
    App.dialog({
      title: App.t('Pictogrammen invoegen'), xwide: true,
      body: `<div style="display:flex;gap:8px;margin-bottom:8px"><input id="ic-q" class="inp" placeholder="${App.t('Zoeken (Engelse namen, bijv. rocket, star, person)')}" style="flex:1"><select id="ic-cat" class="inp" style="width:200px"><option value="">${App.t('Alle categorieën')}</option>${Object.keys(App.ICONS).map((k) => `<option>${App.esc(App.t(k))}</option>`).join('')}</select></div><div class="icon-grid" id="ic-grid">${grid(all)}</div><p class="muted small" style="margin:8px 0 0">${App.t('Pictogrammen: Material Symbols (Apache-licentie 2.0), meegeleverd. Je kunt ook elke andere naam uit Material Symbols intypen.')}</p>`,
      onOpen: (d) => {
        const refresh = () => {
          const q = d.$('#ic-q').value.trim().toLowerCase().replace(/\s+/g, '_');
          const ci = d.$('#ic-cat').selectedIndex - 1;
          let names = ci >= 0 ? Object.values(App.ICONS)[ci] : all;
          if (q) { names = names.filter((n) => n.includes(q)); if (/^[a-z0-9_]{2,}$/.test(q) && !names.includes(q)) names = [q, ...names]; }
          d.$('#ic-grid').innerHTML = grid(names);
        };
        d.$('#ic-q').addEventListener('input', refresh); d.$('#ic-cat').addEventListener('change', refresh);
        d.$('#ic-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-ic]'); if (!b) return; d.$$('#ic-grid .on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); pick = b.dataset.ic; });
        d.$('#ic-grid').addEventListener('dblclick', (e) => { if (e.target.closest('[data-ic]')) d.primary.click(); });
      },
      buttons: [{ label: 'Annuleren' }, { label: 'Invoegen', primary: true, action: () => {
        if (!pick) return false;
        App.run(() => {
          const S = P().size;
          const o = App.newObj('icon', { icon: pick, color: 'accent1', x: S.w / 2 - 64, y: S.h / 2 - 64, w: 128, h: 128, name: App.objName(App.t('Pictogram')), alt: '' });
          if (!App.placeInPh(o, phId)) App.addObj(o); else st.sel = [o.id];
          if (o.w !== o.h) { const m = Math.min(o.w, o.h); o.x += (o.w - m) / 2; o.y += (o.h - m) / 2; o.w = o.h = m; }
        });
        App.select(st.sel);
      } }],
    });
  });

  /* ---------- WordArt ---------- */
  App.WORDART = [
    { fill: { type: 'solid', color: 'tx1' } },
    { fill: { type: 'solid', color: 'accent1' }, fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.35, blur: 4, dist: 3, dir: 45 } } },
    { fill: { type: 'solid', color: 'accent2' }, ln: { type: 'solid', color: 'bg1', w: 1 }, fx: { shadow: { type: 'outer', color: 'accent2', alpha: 0.6, blur: 2, dist: 2, dir: 45 } } },
    { fill: { type: 'none' }, ln: { type: 'solid', color: 'accent1', w: 1.5 } },
    { fill: { type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: 'accent4' }, { p: 1, color: 'accent2' }] } },
    { fill: { type: 'grad', kind: 'linear', angle: 0, stops: [{ p: 0, color: 'accent1' }, { p: 0.5, color: 'accent5' }, { p: 1, color: 'accent6' }] } },
    { fill: { type: 'solid', color: 'bg1' }, ln: { type: 'solid', color: 'accent1', w: 2 }, fx: { glow: { color: 'accent1', alpha: 0.5, size: 8 } } },
    { fill: { type: 'solid', color: 'accent3' }, fx: { refl: { alpha: 0.5, size: 0.5, dist: 0 } } },
    { fill: { type: 'solid', color: 'tx1/l25' }, fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.5, blur: 8, dist: 6, dir: 60 } } },
  ];
  const waChip = (i) => { const s = App.WORDART[i]; const th = App.theme(); const f = s.fill; const css = f.type === 'grad' ? `background:${App.gradCss(f, th)};-webkit-background-clip:text;background-clip:text;color:transparent` : f.type === 'none' ? 'color:transparent' : `color:${App.color(f.color, th)}`; const ln = s.ln ? `;-webkit-text-stroke:1px ${App.color(s.ln.color, th)}` : ''; return `<button class="wa-chip" data-cmd="wordArt" data-arg="${i}" title="WordArt"><span style="font-family:${App.esc(App.cssFont(App.fontName('+mj', th)))};${css}${ln}">A</span></button>`; };
  App.menuBuilders['m-wordart'] = () => `<div style="display:grid;grid-template-columns:repeat(3,56px);gap:3px;padding:6px">${App.WORDART.map((_, i) => waChip(i)).join('')}</div>`;
  App.fillWordArtGallery = () => { const g = $('#g-wordart'); if (g && App.pres) g.innerHTML = App.WORDART.map((_, i) => waChip(i)).join(''); };
  App.def('wordArt', (i) => {
    const s = App.WORDART[+i] || App.WORDART[0];
    const apply = (r) => { r.fill = App.clone(s.fill); if (s.ln) r.ln = App.clone(s.ln); else delete r.ln; if (s.fx) r.fx = App.clone(s.fx); else delete r.fx; delete r.color; };
    if (App.state.edit || (App.selObjs().length && App.selObjs().some((o) => o.text))) { App.applyRun(apply); return; }
    let o;
    App.run(() => {
      const S = P().size;
      o = App.newObj('shape', { geom: 'rect', txbox: true, fill: { type: 'none' }, line: { type: 'none' }, x: S.w * 0.2, y: S.h * 0.38, w: S.w * 0.6, h: 110, name: App.objName('WordArt'),
        text: { paras: [{ align: 'ctr', runs: [{ t: App.t('Plaats je tekst hier'), sz: 54, font: '+mj', b: true }] }], wrap: true, fit: 'resize' } });
      apply(o.text.paras[0].runs[0]);
      App.addObj(o);
      App.autofit(o, App.surface().owner);
    });
    App.select([o.id]);
    App.textEdit.start(o.id, { selectAll: true });
  });

  /* ---------- Symbolen, datum en tijd, dianummer ---------- */
  App.SYMBOLS = {
    'Veelgebruikt': '©®™€£$¥°±×÷≠≈≤≥∞√∑∏∫∂∆πΩµ§¶†‡•…–—‘’“”«»‹›¡¿½¼¾¹²³',
    'Pijlen': '←↑→↓↔↕⇐⇑⇒⇓⇔↖↗↘↙↺↻⟵⟶➔➜➤➡⬅⬆⬇',
    'Wiskunde': '∀∃∄∅∈∉∋∩∪⊂⊃⊆⊇⊕⊗⊥∠∡∥∦∧∨¬≡≢≅∝∴∵∶∷∼≃⊢⊨ℕℤℚℝℂ',
    'Grieks': 'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ',
    'Vormen': '■□▪▫▲△▶▷▼▽◀◁◆◇○●◎◉★☆♠♣♥♦✓✔✗✘☐☑☒✦✧❖',
    'Valuta': '€$£¥₹₽₩₺₪₫₴₦₱฿¢',
    'Leestekens': '¨´`ˆ˜¸˛·‚„‰′″‴‼⁇⁈⁉',
  };
  App.def('symbolDialog', () => {
    const recent = App.store.get('recentSymbols', []) || [];
    App.dialog({
      title: App.t('Symbool'), wide: true,
      body: `<div class="seg sym-tabs" id="sy-tabs">${Object.keys(App.SYMBOLS).map((k, i) => `<button data-k="${App.esc(k)}" class="${i ? '' : 'on'}">${App.esc(App.t(k))}</button>`).join('')}</div><div class="sym-grid" id="sy-grid"></div>
        ${recent.length ? `<div class="muted small" style="margin:10px 0 4px">${App.t('Recent gebruikte symbolen')}</div><div class="sym-grid" id="sy-rec" style="grid-template-columns:repeat(16,1fr)">${recent.map((c) => `<button data-c="${App.esc(c)}">${App.esc(c)}</button>`).join('')}</div>` : ''}
        <label class="field" style="margin-top:10px"><span>${App.t('Tekencode (hex)')}</span><input id="sy-code" placeholder="2192" style="width:120px"></label>`,
      onOpen: (d) => {
        const show = (k) => { d.$('#sy-grid').innerHTML = Array.from(App.SYMBOLS[k]).map((c) => `<button data-c="${App.esc(c)}" title="U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}">${App.esc(c)}</button>`).join(''); };
        show(Object.keys(App.SYMBOLS)[0]);
        d.$('#sy-tabs').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; d.$$('#sy-tabs button').forEach((x) => x.classList.toggle('on', x === b)); show(b.dataset.k); };
        const put = (c) => { App.store.set('recentSymbols', [c, ...recent.filter((x) => x !== c)].slice(0, 16)); insertTextHere(c); };
        d.body.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) put(b.dataset.c); });
        d.$('#sy-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const n = parseInt(e.target.value, 16); if (n > 0 && n < 0x110000) put(String.fromCodePoint(n)); } });
      },
      buttons: [{ label: 'Sluiten', primary: true }],
    });
  });
  // tekst op de cursor invoegen, of een nieuw tekstvak maken
  const insertTextHere = (text, run) => {
    if (App.state.edit) { App.textEdit.insertText(text, run); return; }
    const o = App.sel1();
    if (o && o.type === 'shape') { App.textEdit.start(o.id, { end: true }); App.textEdit.insertText(text, run); return; }
    let n;
    App.run(() => {
      const S = P().size;
      n = App.newObj('shape', { geom: 'rect', txbox: true, fill: { type: 'none' }, line: { type: 'none' }, x: S.w * 0.4, y: S.h * 0.45, w: 200, h: 40, name: App.objName(App.t('Tekstvak')), text: { paras: [{ runs: [{ t: '', ...(run || {}) }] }], wrap: false, fit: 'resize' } });
      App.addObj(n);
    });
    App.textEdit.start(n.id, { end: true });
    App.textEdit.insertText(text, run);
  };
  App.insertTextHere = insertTextHere;
  App.def('dateTime', () => {
    const d = new Date(), loc = App.LANG === 'en' ? 'en-US' : 'nl-NL';
    const fmts = [['datetime1', d.toLocaleDateString(loc)], ['datetime2', d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })], ['datetime3', d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })], ['datetime4', d.toLocaleDateString(loc, { month: 'long', year: 'numeric' })], ['datetime10', d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })], ['datetime11', d.toLocaleString(loc)]];
    App.dialog({
      title: App.t('Datum en tijd'),
      body: `<div class="list-rows" id="dt-list">${fmts.map(([k, v], i) => `<label class="list-row" style="cursor:pointer"><input type="radio" name="dt" value="${i}" ${i ? '' : 'checked'}> ${App.esc(v)}</label>`).join('')}</div><label class="chk" style="margin-top:10px"><input type="checkbox" id="dt-auto" checked> ${App.t('Automatisch bijwerken')}</label>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (dd) => {
        const i = +dd.$('input[name="dt"]:checked').value;
        const [k, v] = fmts[i];
        if (dd.$('#dt-auto').checked && App.state.edit) { App.textEdit.insertText(' '); insertField({ type: k }, v); } else insertTextHere(v);
      } }],
    });
  });
  // een veld (dianummer, datum) op de cursor
  const insertField = (fld, text) => {
    if (!App.state.edit) { insertTextHere(text); return; }
    App.textEdit.applyBody((body) => {
      const s = App.textEdit.getSel(); if (!s) return;
      const p = body.paras[s.start.p];
      const i = App.splitRunsAt(p, s.start.o);
      p.runs.splice(i, 0, { t: text, fld });
    });
  };
  App.def('slideNumber', () => {
    if (App.state.edit) { insertField({ type: 'slidenum' }, String(App.state.slide + 1)); return; }
    App.exec('headerFooter');
  });
  App.def('headerFooter', () => {
    const hf = { ...P().hf };
    App.dialog({
      title: App.t('Koptekst en voettekst'), wide: true,
      body: `<h3 style="margin:0 0 8px;font-size:13px">${App.t('Opnemen op dia')}</h3>
        <div class="checks" style="flex-direction:column;gap:8px">
          <label><input type="checkbox" id="hf-dt" ${hf.dt ? 'checked' : ''}> ${App.t('Datum en tijd')}</label>
          <div style="padding-left:24px;display:flex;flex-direction:column;gap:6px"><label><input type="radio" name="hf-dtk" value="auto" ${hf.dtAuto !== false ? 'checked' : ''}> ${App.t('Automatisch bijwerken')} <select id="hf-fmt" style="margin-left:6px"><option value="short">${new Date().toLocaleDateString(App.LANG === 'en' ? 'en-US' : 'nl-NL')}</option><option value="long" ${hf.dtFmt === 'long' ? 'selected' : ''}>${new Date().toLocaleDateString(App.LANG === 'en' ? 'en-US' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</option></select></label>
            <label><input type="radio" name="hf-dtk" value="fixed" ${hf.dtAuto === false ? 'checked' : ''}> ${App.t('Vast')} <input id="hf-dtt" class="inp" style="width:220px;display:inline-block;height:26px;margin-left:6px" value="${App.esc(hf.dtText || '')}"></label></div>
          <label><input type="checkbox" id="hf-num" ${hf.sldNum ? 'checked' : ''}> ${App.t('Dianummer')}</label>
          <label><input type="checkbox" id="hf-ftr" ${hf.ftr ? 'checked' : ''}> ${App.t('Voettekst')}</label>
          <input id="hf-ftrt" class="inp" style="margin-left:24px;width:calc(100% - 24px)" value="${App.esc(hf.ftrText || '')}">
          <label><input type="checkbox" id="hf-nt" ${hf.notTitle ? 'checked' : ''}> ${App.t('Niet weergeven op titeldia')}</label>
        </div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'Toepassen op alles', primary: true, action: (d) => {
        App.run(() => {
          P().hf = { dt: d.$('#hf-dt').checked, dtAuto: d.$('input[name="hf-dtk"]:checked').value === 'auto', dtFmt: d.$('#hf-fmt').value, dtText: d.$('#hf-dtt').value, sldNum: d.$('#hf-num').checked, ftr: d.$('#hf-ftr').checked, ftrText: d.$('#hf-ftrt').value, notTitle: d.$('#hf-nt').checked };
        }, { all: true });
        App.invalidateThumbs(); App.thumbs.refresh(true);
      } }],
    });
  });

  /* ---------- Vergelijkingen (LaTeX met KaTeX, meegeleverd) ---------- */
  App.EQUATIONS = [['Oppervlakte van een cirkel', 'A = \\pi r^2'], ['Binomium van Newton', '(x+a)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k a^{n-k}'], ['Abc-formule', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'], ['Stelling van Pythagoras', 'a^2 + b^2 = c^2'], ['Reeks van Taylor', 'e^x = 1 + \\frac{x}{1!} + \\frac{x^2}{2!} + \\cdots'], ['Fourierreeks', 'f(x) = a_0 + \\sum_{n=1}^{\\infty} \\left(a_n \\cos \\frac{n\\pi x}{L} + b_n \\sin \\frac{n\\pi x}{L}\\right)'], ['Energie en massa', 'E = mc^2'], ['Integraal', '\\int_a^b f(x)\\,dx = F(b) - F(a)']];
  App.menuBuilders['m-equations'] = () => App.EQUATIONS.map(([n, tex], i) => `<button data-cmd="insertEquation" data-arg="${i}"><b>${App.esc(App.t(n))}</b><small>${App.esc(tex)}</small></button>`).join('') + `<hr><button data-cmd="insertEquation">${App.t('Nieuwe vergelijking invoegen')}</button>`;
  App.def('insertEquation', async (i) => {
    await App.loadKatex().catch(() => {});
    const tex = i !== undefined && App.EQUATIONS[+i] ? App.EQUATIONS[+i][1] : 'x = \\frac{a}{b}';
    let o;
    App.run(() => {
      const S = P().size;
      o = App.newObj('equation', { tex, color: 'tx1', sz: 28, x: S.w * 0.25, y: S.h * 0.4, w: S.w * 0.5, h: 110, name: App.objName(App.t('Vergelijking')) });
      App.addObj(o);
    });
    App.select([o.id]);
    App.setContext({ equation: true, auto: true });
    if (i === undefined) App.exec('editEquation');
  });
  App.EQ_STRUCTS = [['Breuk', '\\frac{a}{b}'], ['Superscript', 'x^{2}'], ['Subscript', 'x_{i}'], ['Wortel', '\\sqrt{x}'], ['n-de wortel', '\\sqrt[n]{x}'], ['Integraal', '\\int_{a}^{b} f(x)\\,dx'], ['Som', '\\sum_{i=1}^{n} x_i'], ['Product', '\\prod_{i=1}^{n} x_i'], ['Limiet', '\\lim_{x \\to \\infty} f(x)'], ['Haakjes', '\\left( x \\right)'], ['Matrix', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'], ['Accent', '\\vec{v}'], ['Functie', '\\sin x']];
  App.EQ_SYMS = ['\\pm', '\\infty', '=', '\\neq', '\\approx', '\\times', '\\div', '!', '\\propto', '<', '\\ll', '>', '\\gg', '\\le', '\\ge', '\\mp', '\\cong', '\\equiv', '\\forall', '\\partial', '\\sqrt{}', '\\cup', '\\cap', '\\emptyset', '\\%', '\\circ', '\\nabla', '\\exists', '\\in', '\\notin', '\\alpha', '\\beta', '\\gamma', '\\delta', '\\theta', '\\lambda', '\\mu', '\\pi', '\\sigma', '\\phi', '\\omega', '\\Delta', '\\Sigma', '\\Omega', '\\rightarrow', '\\leftarrow', '\\Rightarrow', '\\Leftrightarrow'];
  const symLabel = { '\\pm': '±', '\\infty': '∞', '\\neq': '≠', '\\approx': '≈', '\\times': '×', '\\div': '÷', '\\propto': '∝', '\\ll': '≪', '\\gg': '≫', '\\le': '≤', '\\ge': '≥', '\\mp': '∓', '\\cong': '≅', '\\equiv': '≡', '\\forall': '∀', '\\partial': '∂', '\\sqrt{}': '√', '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅', '\\%': '%', '\\circ': '°', '\\nabla': '∇', '\\exists': '∃', '\\in': '∈', '\\notin': '∉', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ', '\\phi': 'φ', '\\omega': 'ω', '\\Delta': 'Δ', '\\Sigma': 'Σ', '\\Omega': 'Ω', '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔' };
  App.fillEqRibbon = () => {
    const s = $('#eq-symbols'); if (s) s.innerHTML = App.EQ_SYMS.map((x) => `<button data-cmd="eqInsert" data-arg="${App.esc(x)}" title="${App.esc(x)}">${App.esc(symLabel[x] || x)}</button>`).join('');
    const t = $('#eq-structs'); if (t) t.innerHTML = App.EQ_STRUCTS.map(([n, x]) => `<button class="rb lg" data-cmd="eqInsert" data-arg="${App.esc(x)}" title="${App.esc(App.t(n))}"><span class="i">${{ Breuk: 'percent', Superscript: 'superscript', Subscript: 'subscript', Wortel: 'square_foot', 'n-de wortel': 'square_foot', Integraal: 'functions', Som: 'functions', Product: 'close', Limiet: 'trending_flat', Haakjes: 'data_object', Matrix: 'grid_on', Accent: 'north_east', Functie: 'function' }[n] || 'function'}</span><span>${App.esc(App.t(n))}</span></button>`).join('');
  };
  App.def('eqInsert', (tex) => {
    const o = App.sel1();
    const ta = document.querySelector('#eq-tex');
    if (ta) { const a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + tex + ta.value.slice(b); ta.focus(); ta.selectionStart = ta.selectionEnd = a + tex.length; ta.dispatchEvent(new Event('input')); return; }
    if (o && o.type === 'equation') App.run(() => { o.tex = (o.tex ? o.tex + ' ' : '') + tex; });
  });
  App.def('editEquation', async () => {
    const o = App.sel1(); if (!o || o.type !== 'equation') return;
    await App.loadKatex().catch(() => {});
    App.dialog({
      title: App.t('Vergelijking bewerken'), wide: true,
      body: `<label class="field"><span>${App.t('LaTeX')}</span><textarea id="eq-tex" spellcheck="false" style="font-family:Consolas,monospace;min-height:80px">${App.esc(o.tex || '')}</textarea></label>
        <div class="eq-tools">${App.EQ_STRUCTS.map(([n, x]) => `<button data-x="${App.esc(x)}" title="${App.esc(x)}">${App.esc(App.t(n))}</button>`).join('')}</div>
        <div class="preview-box" id="eq-prev" style="min-height:90px;font-size:28px"></div>`,
      onOpen: (d) => {
        const ta = d.$('#eq-tex');
        const upd = () => { try { window.katex.render(ta.value, d.$('#eq-prev'), { throwOnError: false, displayMode: true, trust: false }); } catch { d.$('#eq-prev').textContent = ta.value; } };
        ta.addEventListener('input', upd); upd();
        d.$('.eq-tools').onclick = (e) => { const b = e.target.closest('[data-x]'); if (!b) return; const a = ta.selectionStart; ta.value = ta.value.slice(0, a) + b.dataset.x + ta.value.slice(ta.selectionEnd); ta.focus(); upd(); };
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { const v = d.$('#eq-tex').value.slice(0, 5000); App.run(() => { o.tex = v; }); } }],
    });
  });
})();
