/* =========================================================
   Doek (gemaakt door JJ van Schelven) — werkvlak: de dia in het midden tekenen,
   zoomen en passend maken, liniaal, raster, hulplijnen en de statusbalk
   ========================================================= */
'use strict';

(() => {
  const stage = $('#stage'), sizer = $('#stage-sizer'), host = $('#stage-slide'), overlay = $('#overlay');
  const MARGIN = 44;

  /* ---------- Zoom ---------- */
  App.fitZoom = () => {
    const P = App.pres;
    const w = Math.max(100, stage.clientWidth - MARGIN * 2), h = Math.max(80, stage.clientHeight - MARGIN * 2);
    return Math.max(0.05, Math.min(w / P.size.w, h / P.size.h));
  };
  App.zoom = () => (App.state.zoom ? App.state.zoom : App.fitZoom());
  App.layoutStage = () => {
    const P = App.pres; if (!P) return;
    const z = App.zoom();
    const sw = P.size.w * z, sh = P.size.h * z;
    const W = Math.max(stage.clientWidth, sw + MARGIN * 2), H = Math.max(stage.clientHeight, sh + MARGIN * 2);
    sizer.style.width = W + 'px'; sizer.style.height = H + 'px';
    const left = Math.round((W - sw) / 2), top = Math.round((H - sh) / 2);
    host.style.cssText = `left:${left}px;top:${top}px;width:${sw}px;height:${sh}px`;
    overlay.style.cssText = `left:${left}px;top:${top}px;width:${sw}px;height:${sh}px`;
    const sl = host.firstElementChild;
    if (sl) sl.style.transform = `scale(${z})`;
    const lbl = $('#zoom-label'); if (lbl) lbl.textContent = Math.round(z * 100) + '%';
    const rng = $('#zoom-range'); if (rng && document.activeElement !== rng) rng.value = Math.round(z * 100);
    App.drawGrid(); App.drawRulers();
    App.emit('zoom', z);
  };
  App.setZoom = (z, keepPoint) => {
    const old = App.zoom();
    App.state.zoom = z ? App.clamp(z, 0.1, 4) : 0;
    const before = keepPoint ? App.toSlide(keepPoint.x, keepPoint.y) : null;
    App.layoutStage();
    if (before) {
      const after = App.toClient(before.x, before.y);
      stage.scrollLeft += after.x - keepPoint.x; stage.scrollTop += after.y - keepPoint.y;
    }
    App.drawSelection && App.drawSelection();
    void old;
  };
  App.def('zoomIn', () => App.setZoom(Math.round((App.zoom() + 0.1) * 10) / 10));
  App.def('zoomOut', () => App.setZoom(Math.max(0.1, Math.round((App.zoom() - 0.1) * 10) / 10)));
  App.def('zoomFit', () => App.setZoom(0));
  App.def('zoomSet', (v) => App.setZoom(+v / 100));
  App.def('zoomDialog', () => {
    const cur = Math.round(App.zoom() * 100);
    App.dialog({
      title: App.t('Zoomen'),
      body: `<div class="radio-list" id="zd">${[400, 200, 100, 66, 50, 33].map((v) => `<label><input type="radio" name="zd" value="${v}" ${v === cur ? 'checked' : ''}> ${v}%</label>`).join('')}<label><input type="radio" name="zd" value="0" ${!App.state.zoom ? 'checked' : ''}> ${App.t('Passend')}</label></div>
        <label class="field" style="margin-top:12px"><span>${App.t('Percentage')}</span><input id="zd-p" type="number" min="10" max="400" value="${cur}"></label>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { const r = d.$('input[name="zd"]:checked'); const p = +d.$('#zd-p').value; App.setZoom(r && r.value === '0' ? 0 : (p || +r.value) / 100); } }],
      onOpen: (d) => d.$('#zd').addEventListener('change', (e) => { if (e.target.value !== '0') d.$('#zd-p').value = e.target.value; }),
    });
  });
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    App.setZoom(App.zoom() * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX, y: e.clientY });
  }, { passive: false });
  window.addEventListener('resize', App.debounce(() => { App.layoutStage(); App.drawSelection && App.drawSelection(); }, 60));
  if (window.ResizeObserver) new ResizeObserver(App.debounce(() => { if (!App.state.zoom) { App.layoutStage(); App.drawSelection && App.drawSelection(); } }, 30)).observe(stage);

  /* ---------- Coördinaten ---------- */
  App.toSlide = (cx, cy) => {
    const r = host.getBoundingClientRect(), z = App.zoom();
    return { x: (cx - r.left) / z, y: (cy - r.top) / z };
  };
  App.toClient = (x, y) => {
    const r = host.getBoundingClientRect(), z = App.zoom();
    return { x: r.left + x * z, y: r.top + y * z };
  };
  App.objEl = (id) => host.querySelector(`.ob[data-id="${CSS.escape(id)}"]`);
  App.slideEl = () => host.firstElementChild;
  App.focusStage = (keepText) => {
    if (keepText && App.state.edit && App.textEdit) { App.textEdit.focus(); return; }
    if ($('#backstage') || $('.backdrop') || $('#show:not([hidden])')) return;
    try { stage.focus({ preventScroll: true }); } catch { /* niets */ }
  };

  /* ---------- Tekenen van het werkvlak ---------- */
  App.renderStage = (force) => {
    const P = App.pres; if (!P) return;
    if (App.state.view === 'sorter' || App.state.view === 'notes') return;
    if (App.state.edit && !force) return;      // tekst wordt bewerkt: textedit.js houdt het object bij
    const surf = App.surface();
    const sl = App.renderSlide(surf.owner, { mode: 'edit' });
    sl.style.transform = `scale(${App.zoom()})`;
    // lege placeholders markeren (stippellijn)
    sl.querySelectorAll('.ob.ph').forEach((e) => {
      const o = App.obj(e.dataset.id);
      if (o && App.isEmptyText(o) && !e.classList.contains('ly-master') && !e.classList.contains('ly-layout') && !e.classList.contains('ly-hf')) e.classList.add('empty');
    });
    if (App.settings.inkHidden) sl.querySelectorAll('.ob.ink').forEach((e) => { e.style.visibility = 'hidden'; });
    host.replaceChildren(sl);
    App.layoutStage();
  };
  App.renderAll = (full) => {
    App.renderStage();
    App.thumbs && App.thumbs.refresh(full);
    App.renderNotes && App.renderNotes();
    App.drawSelection && App.drawSelection();
    App.updateStatus();
    App.panes && App.panes.refresh();
    App.scheduleState();
  };

  /* ---------- Raster en hulplijnen ---------- */
  App.drawGrid = () => {
    let g = overlay.querySelector('.grid-lines');
    const P = App.pres;
    if (!App.settings.grid) { if (g) g.remove(); } else {
      if (!g) { g = document.createElement('div'); g.className = 'grid-lines'; overlay.prepend(g); }
      const z = App.zoom(), s = (App.settings.gridSize || 16) * z;
      g.style.cssText = `width:${P.size.w * z}px;height:${P.size.h * z}px;background-image:radial-gradient(circle, rgba(110,110,110,.55) 0.8px, transparent 1px);background-size:${s}px ${s}px;background-position:${-s / 2}px ${-s / 2}px`;
    }
    overlay.querySelectorAll('.user-guide').forEach((e) => e.remove());
    if (App.settings.guides) {
      const z = App.zoom();
      const guides = P.guides && P.guides.length ? P.guides : [{ dir: 'v', pos: P.size.w / 2, def: true }, { dir: 'h', pos: P.size.h / 2, def: true }];
      guides.forEach((gd, i) => {
        const e = document.createElement('div');
        e.className = 'user-guide ' + gd.dir;
        e.dataset.guide = i;
        e.style.cssText = gd.dir === 'v' ? `left:${gd.pos * z}px;top:0;height:${P.size.h * z}px` : `top:${gd.pos * z}px;left:0;width:${P.size.w * z}px`;
        e.title = App.fmtNum(gd.pos / App.CM, 2) + ' cm';
        overlay.appendChild(e);
      });
    }
  };
  // Hulplijnen verslepen (Shift = kopie maken), naar buiten slepen = verwijderen
  overlay.addEventListener('mousedown', (e) => {
    const g = e.target.closest('.user-guide'); if (!g) return;
    e.preventDefault(); e.stopPropagation();
    const P = App.pres;
    if (!P.guides || !P.guides.length) P.guides = [{ dir: 'v', pos: P.size.w / 2 }, { dir: 'h', pos: P.size.h / 2 }];
    let i = +g.dataset.guide;
    if (e.ctrlKey) { P.guides.push({ ...P.guides[i] }); i = P.guides.length - 1; }
    const gd = P.guides[i];
    const tip = document.createElement('div'); tip.className = 'size-tip'; overlay.appendChild(tip);
    const move = (ev) => {
      const p = App.toSlide(ev.clientX, ev.clientY);
      gd.pos = App.round(gd.dir === 'v' ? p.x : p.y, 1);
      App.drawGrid();
      tip.textContent = App.fmtNum(gd.pos / App.CM, 2) + ' cm';
      tip.style.cssText = `left:${(gd.dir === 'v' ? gd.pos : p.x) * App.zoom() + 8}px;top:${(gd.dir === 'h' ? gd.pos : p.y) * App.zoom() + 8}px`;
      overlay.appendChild(tip);
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      tip.remove();
      if (gd.pos < -10 || gd.pos > (gd.dir === 'v' ? P.size.w : P.size.h) + 10) P.guides.splice(P.guides.indexOf(gd), 1);
      App.run(() => {}, { noTouch: true });
      App.drawGrid();
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });

  /* ---------- Liniaal ---------- */
  App.drawRulers = () => {
    document.body.classList.toggle('ruler-on', !!App.settings.ruler);
    const rh = $('#ruler-h'), rv = $('#ruler-v');
    if (!App.settings.ruler) return;
    const P = App.pres, z = App.zoom();
    const dpr = window.devicePixelRatio || 1;
    const hr = host.getBoundingClientRect(), wr = $('#stage-wrap').getBoundingClientRect();
    const dark = App.settings.dark;
    const draw = (cv, horiz) => {
      const len = horiz ? wr.width - 22 : wr.height - 22;
      cv.width = Math.max(1, len * dpr); cv.height = 22 * dpr;
      if (horiz) { cv.style.width = len + 'px'; cv.style.height = '22px'; } else { cv.width = 22 * dpr; cv.height = Math.max(1, len * dpr); cv.style.width = '22px'; cv.style.height = len + 'px'; }
      const c = cv.getContext('2d');
      c.scale(dpr, dpr);
      c.fillStyle = dark ? '#262626' : '#f3f3f3'; c.fillRect(0, 0, horiz ? len : 22, horiz ? 22 : len);
      const origin = horiz ? hr.left - wr.left - 22 + (P.size.w * z) / 2 : hr.top - wr.top - 22 + (P.size.h * z) / 2;   // nul in het midden, zoals bekende programma's
      const span = (horiz ? P.size.w : P.size.h) * z;
      c.fillStyle = dark ? '#3a3a3a' : '#ffffff';
      if (horiz) c.fillRect(origin - span / 2, 3, span, 16); else c.fillRect(3, origin - span / 2, 16, span);
      c.fillStyle = dark ? '#bbb' : '#555'; c.strokeStyle = dark ? '#888' : '#888';
      c.font = '9px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const cm = App.CM * z, half = Math.ceil(span / 2 / cm) + 1;
      for (let k = -half; k <= half; k++) {
        for (let q = 0; q < 4; q++) {
          const pos = origin + (k + q / 4) * cm;
          const len2 = q === 0 ? 0 : q === 2 ? 5 : 3;
          if (q === 0) {
            if (k !== 0 && cm > 14) { if (horiz) c.fillText(String(Math.abs(k)), pos, 11); else { c.save(); c.translate(11, pos); c.rotate(-Math.PI / 2); c.fillText(String(Math.abs(k)), 0, 0); c.restore(); } }
            continue;
          }
          c.beginPath();
          if (horiz) { c.moveTo(pos + 0.5, 11 - len2 / 2); c.lineTo(pos + 0.5, 11 + len2 / 2); } else { c.moveTo(11 - len2 / 2, pos + 0.5); c.lineTo(11 + len2 / 2, pos + 0.5); }
          c.stroke();
        }
      }
      // positie van de selectie
      const sel = App.selObjs && App.selObjs();
      if (sel && sel.length) {
        const bb = App.selBounds();
        c.fillStyle = 'rgba(196,80,27,.25)';
        if (horiz) c.fillRect(hr.left - wr.left - 22 + bb.x * z, 3, bb.w * z, 16); else c.fillRect(3, hr.top - wr.top - 22 + bb.y * z, 16, bb.h * z);
      }
    };
    draw(rh, true); draw(rv, false);
  };
  stage.addEventListener('scroll', () => { if (App.settings.ruler) App.drawRulers(); }, { passive: true });

  /* ---------- Statusbalk ---------- */
  App.updateStatus = () => {
    const P = App.pres; if (!P) return;
    const s = $('#sb-slide');
    if (App.state.view === 'master') {
      const m = P.masters[App.state.master.mi];
      s.textContent = App.state.master.li < 0 ? App.t('Diamodel') : (m.layouts[App.state.master.li] ? App.t(m.layouts[App.state.master.li].name) : '');
    } else s.textContent = App.t('Dia {0} van {1}').replace('{0}', App.state.slide + 1).replace('{1}', P.slides.length);
    const lang = $('#sb-lang');
    if (lang) lang.textContent = App.t({ 'nl-NL': 'Nederlands', 'en-US': 'Engels (Verenigde Staten)', 'en-GB': 'Engels (Verenigd Koninkrijk)', 'de-DE': 'Duits', 'fr-FR': 'Frans' }[P.lang] || P.lang || '');
    document.title = (P.title || 'Presentatie') + ' — Doek';
  };

  /* ---------- Weergaven ---------- */
  App.stateFns.viewNormal = () => App.state.view === 'normal';
  App.stateFns.viewSorter = () => App.state.view === 'sorter';
  App.stateFns.viewNotes = () => App.state.view === 'notes';
  App.stateFns.viewMaster = () => App.state.view === 'master';
  App.stateFns.notesOn = () => App.settings.notes;
  App.stateFns.grayNone = () => !App.settings.gray;
  App.stateFns.grayGray = () => App.settings.gray === 'gray';
  App.stateFns.grayBw = () => App.settings.gray === 'bw';
  App.def('grayMode', (m) => { App.settings.gray = m || ''; App.saveSettings(); App.scheduleRender(true); });
  App.applySettingsUi = () => {
    const S = App.settings;
    document.body.classList.toggle('notes-on', !!S.notes);
    document.body.classList.toggle('table-grid', S.tableGrid !== false);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };
    set('v-ruler', S.ruler); set('v-grid', S.grid); set('v-guides', S.guides); set('v-notes', S.notes); set('v-smart', S.smartGuides);
    document.documentElement.style.setProperty('--thumbs-w', (S.thumbW || 200) + 'px');
    document.documentElement.style.setProperty('--notes-h', (S.notesH || 110) + 'px');
  };
  App.stateFns.tableGrid = () => App.settings.tableGrid !== false;
  App.def('toggleSetting', (arg) => {
    const key = typeof arg === 'object' && arg ? arg.key : arg;
    const val = typeof arg === 'object' && arg ? !!arg.value : !App.settings[key];
    if (key === 'tableGrid') App.settings.tableGrid = typeof arg === 'object' ? val : App.settings.tableGrid === false;
    else App.settings[key] = val;
    App.saveSettings();
    App.applySettingsUi();
    App.layoutStage();
    App.drawSelection && App.drawSelection();
    App.scheduleState();
  });
  App.def('gridDialog', () => {
    const S = App.settings;
    App.dialog({
      title: App.t('Raster en hulplijnen'),
      body: `<h3 style="margin:0 0 8px;font-size:13px">${App.t('Uitlijnen op')}</h3>
        <div class="checks" style="flex-direction:column"><label><input type="checkbox" id="gd-snap" ${S.snapGrid ? 'checked' : ''}> ${App.t('Objecten uitlijnen op raster')}</label>
        <label><input type="checkbox" id="gd-objs" ${S.snapObjs ? 'checked' : ''}> ${App.t('Objecten uitlijnen op andere objecten')}</label></div>
        <h3 style="margin:10px 0 8px;font-size:13px">${App.t('Raster')}</h3>
        <div class="fields-2"><label class="field"><span>${App.t('Afstand (cm)')}</span><input id="gd-size" type="number" min="0.1" max="5" step="0.1" value="${App.round((S.gridSize || 16) / App.CM, 2)}"></label>
        <label class="field"><span>&nbsp;</span><label class="chk"><input type="checkbox" id="gd-show" ${S.grid ? 'checked' : ''}> ${App.t('Raster op het scherm weergeven')}</label></label></div>
        <h3 style="margin:4px 0 8px;font-size:13px">${App.t('Hulplijnen')}</h3>
        <div class="checks" style="flex-direction:column"><label><input type="checkbox" id="gd-guides" ${S.guides ? 'checked' : ''}> ${App.t('Tekenhulplijnen op het scherm weergeven')}</label>
        <label><input type="checkbox" id="gd-smart" ${S.smartGuides ? 'checked' : ''}> ${App.t('Slimme hulplijnen weergeven als vormen worden uitgelijnd')}</label></div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        S.snapGrid = d.$('#gd-snap').checked; S.snapObjs = d.$('#gd-objs').checked; S.grid = d.$('#gd-show').checked;
        S.gridSize = App.clamp((App.parseNum(d.$('#gd-size').value) || 0.42) * App.CM, 2, 200);
        S.guides = d.$('#gd-guides').checked; S.smartGuides = d.$('#gd-smart').checked;
        App.saveSettings(); App.applySettingsUi(); App.layoutStage();
      } }],
    });
  });

  /* ---------- Verdelers (breedte miniaturen, hoogte notities) ---------- */
  const splitter = (el, onMove) => el.addEventListener('mousedown', (e) => {
    e.preventDefault(); el.classList.add('drag');
    const move = (ev) => onMove(ev);
    const up = () => { el.classList.remove('drag'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); App.saveSettings(); App.layoutStage(); App.thumbs && App.thumbs.refresh(true); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
  splitter($('#split-thumbs'), (ev) => { App.settings.thumbW = App.clamp(ev.clientX - $('#workspace').getBoundingClientRect().left, 110, 420); App.applySettingsUi(); App.layoutStage(); });
  splitter($('#split-notes'), (ev) => { const r = $('#center').getBoundingClientRect(); App.settings.notesH = App.clamp(r.bottom - ev.clientY, 40, r.height - 120); App.applySettingsUi(); App.layoutStage(); });
})();
