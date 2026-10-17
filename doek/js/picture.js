/* =========================================================
   Doek (gemaakt door JJ van Schelven) — afbeeldingen: correcties, kleur,
   artistieke effecten (vaste filters), transparantie, transparante kleur,
   comprimeren, wijzigen, bijsnijden (ook naar vorm en verhouding) en stijlen
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const pics = () => App.selObjs().filter((o) => o.type === 'image');
  const eachPic = (fn) => { const p = pics(); if (!p.length) { App.toast(App.t('Selecteer eerst een afbeelding.'), 'info'); return; } App.run(() => p.forEach((o) => { o.pic = { ...(o.pic || {}) }; fn(o.pic, o); Object.keys(o.pic).forEach((k) => { if (o.pic[k] === undefined || o.pic[k] === null || (k === 'sat' && o.pic[k] === 1) || (/^(bright|contrast|blur|sharpen)$/.test(k) && !o.pic[k])) delete o.pic[k]; }); if (!Object.keys(o.pic).length) delete o.pic; })); };
  // klein voorbeeld van de geselecteerde afbeelding met instellingen (voor de menu's)
  const tile = (o, pic, cmd, arg, title) => {
    const url = App.mediaUrl(o.media);
    const fake = { ...o, id: 'pv' + Math.random().toString(36).slice(2), x: 0, y: 0, w: 60, h: 60 * (o.h / o.w), rot: 0, pic: { ...(o.pic || {}), ...pic }, fx: undefined, line: undefined };
    const h = Math.min(60, 60 * o.h / o.w);
    const w = h * o.w / o.h;
    fake.w = w; fake.h = h;
    const el = App.renderObj(fake, { mode: 'thumb', theme: App.theme(), owner: App.surface().owner, layer: 'slide' });
    el.style.position = 'relative'; el.style.left = '0'; el.style.top = '0';
    const wrap = document.createElement('div');
    wrap.appendChild(el);
    void url;
    return `<button data-cmd="${cmd}" data-arg="${App.esc(arg)}" title="${App.esc(App.t(title))}" style="width:66px;height:66px;display:grid;place-items:center;border:1px solid var(--line);background:var(--panel);padding:2px">${wrap.innerHTML}</button>`;
  };
  const grid = (n, html) => `<div style="display:grid;grid-template-columns:repeat(${n},66px);gap:4px;padding:6px">${html}</div>`;

  App.menuBuilders['m-corrections'] = () => {
    const o = pics()[0]; if (!o) return `<div class="menu-empty">${App.t('Selecteer eerst een afbeelding.')}</div>`;
    const sharp = [[-4, 'Verzachten: 100%'], [-2, 'Verzachten: 50%'], [0, 'Normaal'], [0.25, 'Verscherpen: 25%'], [0.6, 'Verscherpen: 50%']];
    let h = `<div class="menu-title">${App.t('Verscherpen/verzachten')}</div>` + grid(5, sharp.map(([v, n]) => tile(o, v < 0 ? { blur: -v, sharpen: 0 } : { sharpen: v, blur: 0 }, 'picSharp', v, n)).join(''));
    h += `<div class="menu-title">${App.t('Helderheid/contrast')}</div>`;
    const steps = [-0.4, -0.2, 0, 0.2, 0.4];
    h += grid(5, steps.flatMap((c) => steps.map((b) => tile(o, { bright: b, contrast: c }, 'picBC', `${b}:${c}`, `${App.t('Helderheid')}: ${Math.round(b * 100)}% ${App.t('Contrast')}: ${Math.round(c * 100)}%`))).join(''));
    return h + `<hr><button data-cmd="togglePane" data-arg="picture">${App.t('Opties voor afbeeldingscorrecties…')}</button>`;
  };
  App.def('picSharp', (v) => eachPic((p) => { v = +v; if (v < 0) { p.blur = -v; delete p.sharpen; } else { p.sharpen = v; delete p.blur; } }));
  App.def('picBC', (a) => { const [b, c] = String(a).split(':').map(Number); eachPic((p) => { p.bright = b; p.contrast = c; }); });
  App.menuBuilders['m-piccolor'] = () => {
    const o = pics()[0]; if (!o) return `<div class="menu-empty">${App.t('Selecteer eerst een afbeelding.')}</div>`;
    const sats = [0, 0.33, 0.66, 1, 1.33, 1.66, 2, 3];
    let h = `<div class="menu-title">${App.t('Kleurverzadiging')}</div>` + grid(8, sats.map((s) => tile(o, { sat: s, recolor: undefined }, 'picSat', s, `${App.t('Verzadiging')}: ${Math.round(s * 100)}%`)).join(''));
    const rec = [['', 'Geen nieuwe kleur'], ['gray', 'Grijswaarden'], ['sepia', 'Sepia'], ['wash', 'Vervagen'], ['bw', 'Zwart-wit: 50%'], ['invert', 'Negatief'], ...['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((c) => ['duo:' + c, App.colorName(c) + ' ' + App.t('(donker)')])];
    h += `<div class="menu-title">${App.t('Opnieuw kleuren')}</div>` + grid(6, rec.map(([r, n]) => tile(o, { recolor: r || undefined, sat: 1 }, 'picRecolor', r, n)).join(''));
    return h + `<hr><button data-cmd="picChroma"><span class="i">colorize</span> ${App.t('Transparante kleur instellen')}</button><button data-cmd="togglePane" data-arg="picture">${App.t('Opties voor afbeeldingskleur…')}</button>`;
  };
  App.def('picSat', (s) => eachPic((p) => { p.sat = +s; delete p.recolor; }));
  App.def('picRecolor', (r) => eachPic((p) => { if (r) p.recolor = r; else delete p.recolor; }));
  App.menuBuilders['m-artistic'] = () => {
    const o = pics()[0]; if (!o) return `<div class="menu-empty">${App.t('Selecteer eerst een afbeelding.')}</div>`;
    const arts = [['', 'Geen'], ['blur', 'Vervagen'], ['sharpen', 'Verscherpen'], ['pencil', 'Potloodschets'], ['edges', 'Randen'], ['poster', 'Posteren'], ['glow', 'Gloeiende randen'], ['gray', 'Grijswaarden'], ['sepia', 'Sepia']];
    return grid(3, arts.map(([a, n]) => tile(o, a === 'blur' ? { blur: 3, art: undefined } : a === 'sharpen' ? { sharpen: 0.8, art: undefined } : a === 'gray' || a === 'sepia' ? { recolor: a, art: undefined } : { art: a || undefined }, 'picArt', a, n)).join(''));
  };
  App.def('picArt', (a) => eachPic((p) => {
    delete p.art;
    if (a === 'blur') p.blur = 3; else if (a === 'sharpen') p.sharpen = 0.8; else if (a === 'gray' || a === 'sepia') p.recolor = a;
    else if (a) p.art = a;
    else { delete p.blur; delete p.sharpen; }
  }));
  App.menuBuilders['m-transp'] = () => {
    const o = pics()[0]; if (!o) return `<div class="menu-empty">${App.t('Selecteer eerst een afbeelding.')}</div>`;
    return grid(4, [0, 0.15, 0.3, 0.5, 0.65, 0.8, 0.95].map((t) => tile(o, { alpha: 1 - t }, 'picAlpha', 1 - t, `${App.t('Transparantie')}: ${Math.round(t * 100)}%`)).join('')) + `<hr><button data-cmd="togglePane" data-arg="picture">${App.t('Opties voor transparantie…')}</button>`;
  };
  App.def('picAlpha', (a) => eachPic((p) => { const v = App.clamp(+a, 0, 1); if (v >= 1) delete p.alpha; else p.alpha = v; }));
  App.def('resetPicture', () => eachPic((p, o) => { Object.keys(p).forEach((k) => delete p[k]); delete o.crop; if (o.orig) { o.media = o.orig; delete o.orig; } if (o.nat) { const r = o.nat.w / o.nat.h; o.h = o.w / r; } }));

  /* ---------- Transparante kleur instellen (pixelbewerking, vast algoritme) ---------- */
  App.def('picChroma', () => {
    const o = pics()[0]; if (!o) return;
    App.toast(App.t('Klik op de kleur in de afbeelding die doorzichtig moet worden.'), 'colorize', { ms: 4000 });
    const stage = $('#stage');
    stage.classList.add('placing');
    const once = async (e) => {
      stage.removeEventListener('mousedown', once, true);
      stage.classList.remove('placing');
      e.preventDefault(); e.stopPropagation();
      const wb = App.worldBox(o.id);
      const p = App.toSlide(e.clientX, e.clientY);
      const lp = App.rotP(p.x, p.y, wb.cx, wb.cy, -wb.rot);
      let fx = (lp.x - wb.x) / wb.w, fy = (lp.y - wb.y) / wb.h;
      if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return;
      if (o.flipH) fx = 1 - fx; if (o.flipV) fy = 1 - fy;
      const c = o.crop || {};
      const ix = (c.l || 0) + fx * (1 - (c.l || 0) - (c.r || 0)), iy = (c.t || 0) + fy * (1 - (c.t || 0) - (c.b || 0));
      const src = App.media[o.orig || o.media]; if (!src) return;
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src.url; });
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      const px = (Math.min(cv.height - 1, Math.floor(iy * cv.height)) * cv.width + Math.min(cv.width - 1, Math.floor(ix * cv.width))) * 4;
      const [r, g, b] = [data.data[px], data.data[px + 1], data.data[px + 2]];
      const tol = 28;
      for (let i = 0; i < data.data.length; i += 4) {
        const d = Math.abs(data.data[i] - r) + Math.abs(data.data[i + 1] - g) + Math.abs(data.data[i + 2] - b);
        if (d <= tol) data.data[i + 3] = 0; else if (d <= tol * 2) data.data[i + 3] = Math.min(data.data[i + 3], Math.round(255 * (d - tol) / tol));
      }
      ctx.putImageData(data, 0, 0);
      const id = App.addMedia(cv.toDataURL('image/png'), 'image/png', (src.name || 'afbeelding') + ' (transparant)', { nat: { w: cv.width, h: cv.height } });
      App.run(() => { if (!o.orig) o.orig = o.media; o.media = id; o.pic = { ...(o.pic || {}), chroma: App.rgbToHex(r, g, b) }; });
    };
    stage.addEventListener('mousedown', once, true);
  });

  /* ---------- Comprimeren ---------- */
  App.def('compressPictures', () => {
    const all = !pics().length;
    App.dialog({
      title: App.t('Afbeeldingen comprimeren'),
      body: `<div class="checks" style="flex-direction:column;gap:6px"><label><input type="checkbox" id="cp-sel" ${all ? 'disabled' : 'checked'}> ${App.t('Alleen op deze afbeelding toepassen')}</label><label><input type="checkbox" id="cp-crop" checked> ${App.t('Bijgesneden delen van afbeeldingen verwijderen')}</label></div>
        <h3 style="margin:12px 0 8px;font-size:13px">${App.t('Resolutie')}</h3>
        <div class="radio-list"><label><input type="radio" name="cp-r" value="330"> ${App.t('HD (330 ppi): goede kwaliteit voor schermen met hoge resolutie')}</label><label><input type="radio" name="cp-r" value="220" checked> ${App.t('Afdrukken (220 ppi): uitstekende kwaliteit op de meeste printers en schermen')}</label><label><input type="radio" name="cp-r" value="150"> ${App.t('Web (150 ppi): goed voor webpagina\'s en projectoren')}</label><label><input type="radio" name="cp-r" value="96"> ${App.t('E-mail (96 ppi): zo klein mogelijk om te delen')}</label></div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const ppi = +d.$('input[name="cp-r"]:checked').value, crop = d.$('#cp-crop').checked;
        const targets = d.$('#cp-sel').checked && !all ? pics() : App.pres.slides.flatMap((s) => { const out = []; App.walkObjs(s.objs, (o) => { if (o.type === 'image') out.push(o); }); return out; });
        compress(targets, ppi, crop);
      } }],
    });
  });
  const compress = async (objs, ppi, crop) => {
    let saved = 0;
    for (const o of objs) {
      const m = App.media[o.media]; if (!m || /svg|gif/.test(m.mime || '')) continue;
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = m.url; });
      if (!img) continue;
      const c = crop && o.crop ? o.crop : { l: 0, t: 0, r: 0, b: 0 };
      const sx = (c.l || 0) * img.naturalWidth, sy = (c.t || 0) * img.naturalHeight;
      const sw = img.naturalWidth * (1 - (c.l || 0) - (c.r || 0)), sh = img.naturalHeight * (1 - (c.t || 0) - (c.b || 0));
      const target = Math.max(o.w, 1) / 96 * ppi;
      const f = Math.min(1, target / sw);
      if (f >= 0.98 && !(crop && o.crop)) continue;
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw * f)); cv.height = Math.max(1, Math.round(sh * f));
      cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      const png = /png/.test(m.mime || '') && o.pic && o.pic.chroma;
      const url = cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
      if (url.length >= m.url.length && !(crop && o.crop)) continue;
      saved += Math.max(0, m.url.length - url.length);
      const id = App.addMedia(url, png ? 'image/png' : 'image/jpeg', m.name, { nat: { w: cv.width, h: cv.height } });
      App.run(() => { o.media = id; o.nat = { w: cv.width, h: cv.height }; if (crop) delete o.crop; delete o.orig; }, { all: true });
    }
    App.toast(App.t('Afbeeldingen gecomprimeerd: ongeveer {0} kB kleiner').replace('{0}', Math.round(saved * 0.75 / 1024)), 'compress');
  };
  App.def('changePicture', async () => {
    const o = pics()[0]; if (!o) return;
    const f = await App.pickFile('image/*'); if (!f) return;
    const fit = await App.fitImageUrl(await App.readFile(f, 'dataurl'));
    const id = App.addMedia(fit.url, null, f.name, { nat: { w: fit.w, h: fit.h } });
    App.run(() => {
      o.media = id; o.nat = { w: fit.w, h: fit.h }; delete o.orig;
      // passend in hetzelfde kader: bijsnijden om de verhouding van het kader te houden
      const ar = fit.w / fit.h, br = o.w / o.h;
      if (Math.abs(ar - br) > 0.01) { if (ar > br) { const c = (1 - br / ar) / 2; o.crop = { l: c, r: c, t: 0, b: 0 }; } else { const c = (1 - ar / br) / 2; o.crop = { t: c, b: c, l: 0, r: 0 }; } } else delete o.crop;
    });
  });

  /* ---------- Afbeeldingsstijlen ---------- */
  App.PIC_STYLES = [
    ['Eenvoudig kader, wit', { line: { type: 'solid', color: '#ffffff', w: 6 }, fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.35, blur: 6, dist: 3, dir: 90 } } }],
    ['Eenvoudig kader, zwart', { line: { type: 'solid', color: '#000000', w: 6 } }],
    ['Afgeronde rechthoek', { geom: 'roundRect', adj: { adj: 10000 } }],
    ['Slagschaduw rechthoek', { fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.45, blur: 12, dist: 6, dir: 45 } } }],
    ['Weerspiegelde afgeronde rechthoek', { geom: 'roundRect', adj: { adj: 8000 }, fx: { refl: { alpha: 0.45, size: 0.4, dist: 2 } } }],
    ['Zachte randen', { fx: { soft: 14 } }],
    ['Ovaal', { geom: 'ellipse', fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.3, blur: 8, dist: 3, dir: 90 } } }],
    ['Dik kader, metaal', { line: { type: 'solid', color: '#8c8c8c', w: 9, cmpd: 'thinThick' }, fx: { bevel: { type: 'circle', w: 6, h: 6 } } }],
    ['Gedraaid, wit', { line: { type: 'solid', color: '#ffffff', w: 8 }, rot: -4, fx: { shadow: { type: 'outer', color: '#000000', alpha: 0.4, blur: 10, dist: 4, dir: 60 } } }],
    ['Perspectief', { fx: { rot3d: { x: 0, y: 22, persp: 900 }, shadow: { type: 'outer', color: '#000000', alpha: 0.3, blur: 10, dist: 4, dir: 90 } } }],
  ];
  App.fillPicStyles = () => {
    const g = $('#g-picstyles'); if (!g) return;
    g.innerHTML = App.PIC_STYLES.map(([n, s], i) => `<button class="style-sw" data-cmd="picStyle" data-arg="${i}" title="${App.esc(App.t(n))}" style="background:#9fb7d8;border-radius:${s.geom === 'ellipse' ? '50%' : s.geom === 'roundRect' ? '5px' : '0'};${s.line ? `border:${Math.min(3, s.line.w / 2)}px solid ${s.line.color}` : ''};${s.fx && s.fx.shadow ? 'box-shadow:0 2px 4px rgba(0,0,0,.45)' : ''};${s.rot ? 'transform:rotate(-6deg)' : ''}"></button>`).join('');
  };
  App.def('picStyle', (i) => {
    const s = (App.PIC_STYLES[+i] || [])[1]; if (!s) return;
    App.run(() => pics().forEach((o) => {
      ['geom', 'adj', 'line', 'fx'].forEach((k) => delete o[k]);
      if (s.geom) { o.geom = s.geom; if (s.adj) o.adj = { ...s.adj }; }
      if (s.line) o.line = App.clone(s.line);
      if (s.fx) o.fx = App.clone(s.fx);
      if (s.rot !== undefined) o.rot = s.rot;
    }));
  });

  /* ---------- Bijsnijden ---------- */
  App.stateFns.cropping = () => !!st.crop;
  App.def('crop', () => {
    if (st.crop) { st.crop = null; App.drawSelection(); App.scheduleState(); return; }
    const o = pics()[0] || App.sel1();
    if (!o || o.type !== 'image') { App.toast(App.t('Selecteer eerst een afbeelding.'), 'info'); return; }
    if (o.rot) { App.toast(App.t('Bijsnijden van een gedraaide afbeelding: zet de draaiing eerst op 0°.'), 'info'); return; }
    App.fixBox(o);
    st.crop = { id: o.id };
    App.select([o.id]);
    App.drawSelection();
    App.scheduleState();
  });
  // bijsnijweergave: het hele beeld licht, het kader met zwarte grepen
  App.drawCrop = (overlay, z) => {
    const o = App.obj(st.crop.id); if (!o) { st.crop = null; return; }
    const c = { l: 0, t: 0, r: 0, b: 0, ...(o.crop || {}) };
    const fw = 1 - c.l - c.r, fh = 1 - c.t - c.b;
    const iw = o.w / fw, ih = o.h / fh, ix = o.x - c.l * iw, iy = o.y - c.t * ih;
    const ghost = document.createElement('div');
    ghost.className = 'crop-ghost';
    ghost.style.cssText = `left:${ix * z}px;top:${iy * z}px;width:${iw * z}px;height:${ih * z}px;background:url("${App.mediaUrl(o.media)}") center/100% 100%;${o.flipH || o.flipV ? `transform:scale(${o.flipH ? -1 : 1},${o.flipV ? -1 : 1})` : ''};pointer-events:auto;cursor:move`;
    ghost.dataset.cropPan = '1';
    overlay.appendChild(ghost);
    const f = document.createElement('div'); f.className = 'crop-frame';
    f.style.cssText = `left:${o.x * z}px;top:${o.y * z}px;width:${o.w * z}px;height:${o.h * z}px`;
    overlay.appendChild(f);
    [['nw', 0, 0, 'c'], ['n', 0.5, 0, ''], ['ne', 1, 0, 'c'], ['e', 1, 0.5, 'v'], ['se', 1, 1, 'c'], ['s', 0.5, 1, ''], ['sw', 0, 1, 'c'], ['w', 0, 0.5, 'v']].forEach(([h, fx, fy, cls]) => {
      const d = document.createElement('div');
      d.className = 'hd crop ' + cls; d.dataset.crop = h;
      d.style.left = (o.x + fx * o.w) * z + 'px'; d.style.top = (o.y + fy * o.h) * z + 'px';
      if (cls === 'c') d.style.transform = `rotate(${{ nw: 0, ne: 90, se: 180, sw: 270 }[h]}deg)`;
      d.style.cursor = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }[h];
      overlay.appendChild(d);
    });
  };
  $('#overlay').addEventListener('mousedown', (e) => {
    if (!st.crop) return;
    const h = e.target.closest('[data-crop]'), pan = e.target.closest('[data-crop-pan]');
    if (!h && !pan) return;
    e.preventDefault(); e.stopPropagation();
    const o = App.obj(st.crop.id); if (!o) return;
    const c0 = { l: 0, t: 0, r: 0, b: 0, ...(o.crop || {}) };
    const b0 = { x: o.x, y: o.y, w: o.w, h: o.h };
    const fw = 1 - c0.l - c0.r, fh = 1 - c0.t - c0.b;
    const iw = b0.w / fw, ih = b0.h / fh, ix = b0.x - c0.l * iw, iy = b0.y - c0.t * ih;   // het hele beeld (vast tijdens bijsnijden)
    const p0 = App.toSlide(e.clientX, e.clientY);
    const move = (ev) => {
      const p = App.toSlide(ev.clientX, ev.clientY);
      const dx = p.x - p0.x, dy = p.y - p0.y;
      let x1 = b0.x, y1 = b0.y, x2 = b0.x + b0.w, y2 = b0.y + b0.h;
      if (pan) {
        // het beeld onder het kader verschuiven
        const nix = App.clamp(ix + dx, x2 - iw, x1), niy = App.clamp(iy + dy, y2 - ih, y1);
        o.crop = { l: (x1 - nix) / iw, r: (nix + iw - x2) / iw, t: (y1 - niy) / ih, b: (niy + ih - y2) / ih };
      } else {
        const k = h.dataset.crop;
        if (k.includes('w')) x1 = App.clamp(b0.x + dx, ix, x2 - 4); if (k.includes('e')) x2 = App.clamp(b0.x + b0.w + dx, x1 + 4, ix + iw);
        if (k.includes('n')) y1 = App.clamp(b0.y + dy, iy, y2 - 4); if (k.includes('s')) y2 = App.clamp(b0.y + b0.h + dy, y1 + 4, iy + ih);
        o.x = x1; o.y = y1; o.w = x2 - x1; o.h = y2 - y1;
        o.crop = { l: (x1 - ix) / iw, r: (ix + iw - x2) / iw, t: (y1 - iy) / ih, b: (iy + ih - y2) / ih };
      }
      Object.keys(o.crop).forEach((kk) => { o.crop[kk] = App.round(Math.max(0, o.crop[kk]), 5); });
      App.liveRender();
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); if (o.crop && Object.values(o.crop).every((v) => v < 0.0005)) delete o.crop; App.changed(); App.drawSelection(); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }, true);
  document.addEventListener('keydown', (e) => { if (st.crop && (e.key === 'Enter' || e.key === 'Escape') && !e.target.closest('input, textarea')) { e.preventDefault(); st.crop = null; App.drawSelection(); App.scheduleState(); } });
  App.def('cropToShape', (geom) => App.run(() => pics().forEach((o) => { o.geom = geom; const d = App.Shapes.defaults(geom); if (d && Object.keys(d).length) o.adj = { ...d }; else delete o.adj; })));
  App.def('cropAspect', (r) => {
    const [a, b] = String(r).split(':').map(Number); const want = a / b;
    App.run(() => pics().forEach((o) => {
      const nat = o.nat || { w: o.w, h: o.h };
      const ar = nat.w / nat.h;
      if (ar > want) { const c = (1 - want / ar) / 2; o.crop = { l: c, r: c, t: 0, b: 0 }; } else { const c = (1 - ar / want) / 2; o.crop = { t: c, b: c, l: 0, r: 0 }; }
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const area = o.w * o.h;
      o.h = Math.sqrt(area / want); o.w = o.h * want;
      o.x = cx - o.w / 2; o.y = cy - o.h / 2;
    }));
  });
  // Opvullen: het kader helemaal vullen (bijsnijden); Aanpassen: het hele beeld in het kader
  App.def('cropFill', (mode) => App.run(() => pics().forEach((o) => {
    const nat = o.nat || { w: o.w, h: o.h };
    const ar = nat.w / nat.h, br = o.w / o.h;
    if (mode === 'fill') { if (ar > br) { const c = (1 - br / ar) / 2; o.crop = { l: c, r: c, t: 0, b: 0 }; } else { const c = (1 - ar / br) / 2; o.crop = { t: c, b: c, l: 0, r: 0 }; } }
    else { delete o.crop; const cx = o.x + o.w / 2, cy = o.y + o.h / 2; if (ar > br) { o.h = o.w / ar; } else { o.w = o.h * ar; } o.x = cx - o.w / 2; o.y = cy - o.h / 2; }
  })));
})();
