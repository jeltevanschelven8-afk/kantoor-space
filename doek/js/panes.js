/* =========================================================
   Doek (gemaakt door JJ van Schelven) — taakvensters rechts (Vorm opmaken,
   Achtergrond opmaken, Afbeelding, Selectievenster; andere modules melden er
   meer aan: animaties, opmerkingen, synoniemen, toegankelijkheid) en de notities
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const pane = $('#pane');
  const REG = {};
  App.panes = {
    register(kind, def) { REG[kind] = def; },
    open(kind, opts = {}) {
      if (kind === 'size' || kind === 'effects' || kind === 'textopts') { opts.tab = kind; kind = 'format'; }
      if (!REG[kind]) return;
      st.pane = kind; st.paneTab = opts.tab || (kind === 'format' ? st.paneTab : null);
      pane.hidden = false;
      App.panes.refresh(true);
      App.layoutStage();
      App.scheduleState();
    },
    close() { st.pane = null; pane.hidden = true; pane.innerHTML = ''; App.layoutStage(); App.scheduleState(); },
    refresh(force) {
      if (!st.pane || !REG[st.pane]) return;
      const def = REG[st.pane];
      // tijdens het slepen in een veld niet opnieuw opbouwen
      if (!force && pane.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) return;
      if (!force && def.light && def.update) { def.update(pane.querySelector('.pane-body')); return; }
      const scroll = pane.querySelector('.pane-body') ? pane.querySelector('.pane-body').scrollTop : 0;
      pane.innerHTML = `<div class="pane-head"><strong>${App.esc(App.t(typeof def.title === 'function' ? def.title() : def.title))}</strong><button class="qb" data-pane-close title="${App.esc(App.t('Sluiten'))}"><span class="i">close</span></button></div><div class="pane-body"></div>`;
      const body = pane.querySelector('.pane-body');
      try { def.render(body); } catch (e) { console.error(e); body.innerHTML = `<div class="pane-empty">${App.esc(e.message)}</div>`; }
      body.scrollTop = scroll;
    },
  };
  pane.addEventListener('click', (e) => { if (e.target.closest('[data-pane-close]')) App.panes.close(); });
  App.def('togglePane', (kind) => {
    const k = kind === 'size' || kind === 'effects' || kind === 'textopts' ? 'format' : kind;
    if (st.pane === k && !(k === 'format' && kind !== 'format' && st.paneTab !== kind)) App.panes.close(); else App.panes.open(kind);
  });
  App.stateFns.paneAnim = () => st.pane === 'anim';
  App.stateFns.paneComments = () => st.pane === 'comments';

  /* ---------- Bouwstenen voor velden ---------- */
  const H = {
    section(title, open, content) { return `<details class="ps" ${open ? 'open' : ''}><summary>${App.esc(App.t(title))}</summary><div class="ps-body">${content}</div></details>`; },
    num(id, label, value, step = 1, min, max, unit = '') { return `<div class="pr"><span>${App.esc(App.t(label))}</span><input type="number" id="${id}" value="${value === '' || value === undefined ? '' : App.round(value, 2)}" step="${step}" ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}>${unit ? `<span class="muted small" style="width:20px">${unit}</span>` : ''}</div>`; },
    range(id, label, value, min = 0, max = 100, unit = '%') { return `<div class="pr"><span>${App.esc(App.t(label))}</span><input type="range" id="${id}" min="${min}" max="${max}" value="${Math.round(value)}"><input type="number" data-mirror="${id}" value="${Math.round(value)}" min="${min}" max="${max}" style="width:58px"><span class="muted small">${unit}</span></div>`; },
    color(id, label, ref) { const th = App.theme(); return `<div class="pr"><span>${App.esc(App.t(label))}</span><button class="btn small" data-colorpick="${id}" style="min-width:110px;justify-content:flex-start"><span style="display:inline-block;width:18px;height:14px;border:1px solid var(--line-strong);background:${ref ? App.color(ref, th) : 'transparent'}"></span>${App.esc(ref ? App.colorName(ref) : App.t('Geen'))}</button></div>`; },
    select(id, label, value, opts) { return `<div class="pr"><span>${App.esc(App.t(label))}</span><select id="${id}">${opts.map(([v, l]) => `<option value="${App.esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${App.esc(App.t(l))}</option>`).join('')}</select></div>`; },
    check(id, label, on) { return `<label class="pr"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${App.esc(App.t(label))}</span></label>`; },
    radios(name, value, opts) { return `<div class="radio-list">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}> ${App.esc(App.t(l))}</label>`).join('')}</div>`; },
  };
  App.paneH = H;
  // velden koppelen: elke wijziging past alle geselecteerde objecten aan (schuifjes worden samengevoegd tot één stap)
  const bind = (body, handlers) => {
    body.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.mirror) { const r = body.querySelector('#' + t.dataset.mirror); if (r) { r.value = t.value; handle(r, true); } return; }
      if (t.type === 'range') { const m = body.querySelector(`[data-mirror="${t.id}"]`); if (m) m.value = t.value; handle(t, true); }
    });
    body.addEventListener('change', (e) => { const t = e.target; if (t.dataset.mirror || t.type === 'range') return; handle(t, false); });
    body.addEventListener('click', (e) => {
      const cp = e.target.closest('[data-colorpick]');
      if (cp) { e.preventDefault(); const k = cp.dataset.colorpick; App.colorMenu(cp, '__pane', (c) => { if (handlers[k]) apply(() => handlers[k](c)); App.panes.refresh(true); }, { none: handlers[k + ':none'] || 'Geen' }); }
    });
    const handle = (t, live) => {
      const key = t.name || t.id;
      const fn = handlers[key]; if (!fn) return;
      const v = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' ? App.parseNum(t.value) : t.value;
      if (t.type === 'number' && !Number.isFinite(v)) return;
      if (live) { fn(v); App.touch(); App.markDirty(); App.history.later(600); App.scheduleRender(); }
      else { apply(() => fn(v)); if (handlers.__rebuild && handlers.__rebuild.includes(key)) App.panes.refresh(true); }
    };
  };
  const apply = (fn) => { App.run(() => { fn(); }); };
  App.paneBind = bind;

  /* ---------- Vorm opmaken ---------- */
  const fillEditor = (prefix, fill, set, opts = {}) => {
    const t = fill ? fill.type : 'none';
    const kinds = [['none', 'Geen opvulling'], ['solid', 'Effen opvulling'], ['grad', 'Opvulling met kleurovergang'], ['img', 'Opvulling met afbeelding of structuur'], ['pattern', 'Opvulling met patroon']];
    let h = H.radios(prefix + 'type', t, opts.noPattern ? kinds.slice(0, 4) : kinds);
    if (t === 'solid') h += H.color(prefix + 'color', 'Kleur', fill.color) + H.range(prefix + 'alpha', 'Transparantie', (1 - (fill.alpha === undefined ? 1 : fill.alpha)) * 100);
    if (t === 'grad') {
      const th = App.theme();
      h += H.select(prefix + 'gkind', 'Type', fill.kind || 'linear', [['linear', 'Lineair'], ['radial', 'Radiaal'], ['rect', 'Rechthoekig'], ['path', 'Pad']]);
      if ((fill.kind || 'linear') === 'linear') h += H.num(prefix + 'angle', 'Hoek', fill.angle || 0, 5, 0, 359, '°');
      h += `<div class="muted small">${App.t('Kleurovergangspunten (klik op de balk om een punt toe te voegen)')}</div><div class="stop-bar" id="${prefix}bar" style="background:${App.gradCss({ ...fill, kind: 'linear', angle: 0 }, th)}">${(fill.stops || []).map((s, i) => `<span class="stop${i === (App._stop || 0) ? ' on' : ''}" data-stop="${i}" style="left:${s.p * 100}%;background:${App.color(s.color, th)}"></span>`).join('')}</div>`;
      const s = (fill.stops || [])[App._stop || 0] || fill.stops[0];
      if (s) h += H.color(prefix + 'scolor', 'Kleur', s.color) + H.num(prefix + 'spos', 'Positie', Math.round(s.p * 100), 1, 0, 100, '%') + H.range(prefix + 'salpha', 'Transparantie', (1 - (s.alpha === undefined ? 1 : s.alpha)) * 100) + `<div class="pr"><span></span><button class="btn small" data-delstop="${prefix}">${App.t('Punt verwijderen')}</button></div>`;
    }
    if (t === 'img') h += `<div class="pr"><span>${App.t('Afbeeldingsbron')}</span><button class="btn small" data-pickimg="${prefix}">${App.t('Invoegen…')}</button></div>` + H.check(prefix + 'tile', 'Afbeelding als structuur naast elkaar', fill.mode === 'tile') + H.range(prefix + 'ialpha', 'Transparantie', (1 - (fill.alpha === undefined ? 1 : fill.alpha)) * 100);
    if (t === 'pattern') h += `<div class="sym-grid" style="grid-template-columns:repeat(8,1fr);max-height:none">${['pct5', 'pct10', 'pct20', 'pct25', 'pct50', 'pct75', 'pct90', 'horz', 'vert', 'ltHorz', 'ltVert', 'dkHorz', 'dkVert', 'narHorz', 'narVert', 'cross', 'smGrid', 'lgGrid', 'smCheck', 'lgCheck', 'dotGrid', 'dnDiag', 'upDiag', 'dkDnDiag', 'dkUpDiag', 'wdDnDiag', 'wdUpDiag', 'diagCross'].map((p) => `<button data-pat="${prefix}:${p}" title="${p}" style="height:28px;${fill.pat === p ? 'outline:2px solid var(--accent)' : ''}">${patSwatch(p)}</button>`).join('')}</div>` + H.color(prefix + 'fg', 'Voorgrond', fill.fg || 'tx1') + H.color(prefix + 'bg', 'Achtergrond', fill.bg || 'bg1');
    void set;
    return h;
  };
  const patSwatch = (p) => { const f = { type: 'pattern', pat: p, fg: '#333333', bg: '#ffffff' }; const svg = App.svgEl('svg', { width: 24, height: 18 }); const defs = App.svgEl('defs'); svg.appendChild(defs); const pt = App.svgPaint(f, App.theme(), defs, { w: 24, h: 18 }); svg.appendChild(App.svgEl('rect', { width: 24, height: 18, fill: pt.paint })); return svg.outerHTML; };
  // handlers voor een opvullingseditor op een object (get/set van fill)
  const fillHandlers = (prefix, get, setFill) => {
    const cur = () => get() || { type: 'none' };
    const upd = (fn) => { const f = App.clone(cur()); fn(f); setFill(f); };
    return {
      [prefix + 'type']: (v) => {
        const old = cur(); const base = old.type === 'solid' ? old.color : old.type === 'grad' ? old.stops[0].color : 'accent1';
        if (v === 'none') setFill({ type: 'none' });
        else if (v === 'solid') setFill({ type: 'solid', color: base });
        else if (v === 'grad') { App._stop = 0; setFill({ type: 'grad', kind: 'linear', angle: 90, stops: [{ p: 0, color: base.split('/')[0] + '/l60' }, { p: 1, color: base }] }); }
        else if (v === 'img') setFill({ type: 'img', media: null, mode: 'stretch' });
        else if (v === 'pattern') setFill({ type: 'pattern', pat: 'pct20', fg: base, bg: 'bg1' });
      },
      [prefix + 'color']: (c) => upd((f) => { f.color = c || 'accent1'; }),
      [prefix + 'alpha']: (v) => upd((f) => { const a = 1 - App.clamp(v, 0, 100) / 100; if (a >= 1) delete f.alpha; else f.alpha = App.round(a, 3); }),
      [prefix + 'gkind']: (v) => upd((f) => { f.kind = v; }),
      [prefix + 'angle']: (v) => upd((f) => { f.angle = ((v % 360) + 360) % 360; }),
      [prefix + 'scolor']: (c) => upd((f) => { const s = f.stops[App._stop || 0]; if (s && c) s.color = c; }),
      [prefix + 'spos']: (v) => upd((f) => { const s = f.stops[App._stop || 0]; if (s) s.p = App.clamp(v, 0, 100) / 100; }),
      [prefix + 'salpha']: (v) => upd((f) => { const s = f.stops[App._stop || 0]; if (!s) return; const a = 1 - App.clamp(v, 0, 100) / 100; if (a >= 1) delete s.alpha; else s.alpha = App.round(a, 3); }),
      [prefix + 'tile']: (v) => upd((f) => { f.mode = v ? 'tile' : 'stretch'; }),
      [prefix + 'ialpha']: (v) => upd((f) => { const a = 1 - App.clamp(v, 0, 100) / 100; if (a >= 1) delete f.alpha; else f.alpha = App.round(a, 3); }),
      [prefix + 'fg']: (c) => upd((f) => { f.fg = c || 'tx1'; }),
      [prefix + 'bg']: (c) => upd((f) => { f.bg = c || 'bg1'; }),
      __rebuild: [prefix + 'type', prefix + 'gkind'],
    };
  };
  // klikken op de verloopbalk, patronen en afbeelding kiezen
  const fillClicks = (body, prefix, get, setFill) => {
    body.addEventListener('click', async (e) => {
      const stop = e.target.closest('[data-stop]');
      const bar = e.target.closest('#' + prefix + 'bar');
      if (stop) { e.stopPropagation(); App._stop = +stop.dataset.stop; App.panes.refresh(true); return; }
      if (bar && !stop) {
        const r = bar.getBoundingClientRect(); const p = App.clamp((e.clientX - r.left) / r.width, 0, 1);
        const f = App.clone(get()); if (!f.stops) return;
        const near = f.stops.slice().sort((a, b) => Math.abs(a.p - p) - Math.abs(b.p - p))[0];
        f.stops.push({ p: App.round(p, 3), color: near.color }); f.stops.sort((a, b) => a.p - b.p);
        App._stop = f.stops.findIndex((s) => s.p === App.round(p, 3));
        apply(() => setFill(f)); App.panes.refresh(true); return;
      }
      const del = e.target.closest('[data-delstop]');
      if (del && del.dataset.delstop === prefix) { const f = App.clone(get()); if (f.stops.length > 2) { f.stops.splice(App._stop || 0, 1); App._stop = 0; apply(() => setFill(f)); App.panes.refresh(true); } return; }
      const pat = e.target.closest('[data-pat]');
      if (pat && pat.dataset.pat.startsWith(prefix + ':')) { const f = App.clone(get()); f.pat = pat.dataset.pat.split(':')[1]; apply(() => setFill(f)); App.panes.refresh(true); return; }
      const pi = e.target.closest('[data-pickimg]');
      if (pi && pi.dataset.pickimg === prefix) {
        const file = await App.pickFile('image/*'); if (!file) return;
        const fit = await App.fitImageUrl(await App.readFile(file, 'dataurl'));
        const id = App.addMedia(fit.url, null, file.name, { nat: { w: fit.w, h: fit.h } });
        const f = App.clone(get()); f.type = 'img'; f.media = id; f.mode = f.mode || 'stretch';
        apply(() => setFill(f)); App.panes.refresh(true);
      }
    });
    // verloopunten verslepen
    body.addEventListener('mousedown', (e) => {
      const stop = e.target.closest('[data-stop]'); if (!stop) return;
      const bar = stop.parentElement; const i = +stop.dataset.stop;
      App._stop = i;
      const move = (ev) => { const r = bar.getBoundingClientRect(); const p = App.clamp((ev.clientX - r.left) / r.width, 0, 1); stop.style.left = p * 100 + '%'; const f = App.clone(get()); f.stops[i].p = App.round(p, 3); setFill(f); App.touch(); App.scheduleRender(); };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); App.changed(); App.panes.refresh(true); };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  };

  const lineEditor = (l, isLine) => {
    const t = l.type || 'none';
    let h = H.radios('ln-type', t, [['none', 'Geen lijn'], ['solid', 'Effen lijn']]);
    if (t !== 'none') {
      h += H.color('ln-color', 'Kleur', l.color || 'tx1') + H.range('ln-alpha', 'Transparantie', (1 - (l.alpha === undefined ? 1 : l.alpha)) * 100)
        + H.num('ln-w', 'Breedte', l.w || 0.75, 0.25, 0, 100, 'pt')
        + H.select('ln-cmpd', 'Samengesteld type', l.cmpd || 'sng', [['sng', 'Enkel'], ['dbl', 'Dubbel'], ['thickThin', 'Dik-dun'], ['thinThick', 'Dun-dik'], ['tri', 'Drievoudig']])
        + H.select('ln-dash', 'Type streepje', l.dash || 'solid', [['solid', 'Doorgetrokken'], ['sysDot', 'Ronde punt'], ['sysDash', 'Vierkante punt'], ['dash', 'Streepje'], ['dashDot', 'Streepje punt'], ['lgDash', 'Lang streepje'], ['lgDashDot', 'Lang streepje punt'], ['lgDashDotDot', 'Lang streepje punt punt']])
        + H.select('ln-cap', 'Type einde', l.cap || 'flat', [['flat', 'Plat'], ['rnd', 'Rond'], ['sq', 'Vierkant']])
        + H.select('ln-join', 'Type verbinding', l.join || 'round', [['round', 'Rond'], ['bevel', 'Schuin'], ['miter', 'Verstek']]);
      if (isLine) {
        const ar = [['none', 'Geen'], ['triangle', 'Pijl'], ['stealth', 'Scherpe pijl'], ['arrow', 'Open pijl'], ['diamond', 'Ruit'], ['oval', 'Ovaal']];
        const sz = [['sm', 'Klein'], ['med', 'Gemiddeld'], ['lg', 'Groot']];
        h += H.select('ln-head', 'Type pijl aan het begin', (l.head && l.head.type) || 'none', ar) + H.select('ln-headw', 'Grootte pijl aan het begin', (l.head && l.head.w) || 'med', sz)
          + H.select('ln-tail', 'Type pijl aan het einde', (l.tail && l.tail.type) || 'none', ar) + H.select('ln-tailw', 'Grootte pijl aan het einde', (l.tail && l.tail.w) || 'med', sz);
      }
    }
    return h;
  };
  const fxEditor = (fx = {}) => {
    const s = fx.shadow, g = fx.glow, r = fx.refl, d = fx.rot3d, b = fx.bevel;
    let h = '';
    h += H.section('Schaduw', !!s, H.check('fx-sh-on', 'Schaduw', !!s) + (s ? H.select('fx-sh-type', 'Type', s.type || 'outer', [['outer', 'Buiten'], ['inner', 'Binnen']]) + H.color('fx-sh-color', 'Kleur', s.color || '#000000') + H.range('fx-sh-alpha', 'Transparantie', (1 - (s.alpha === undefined ? 0.4 : s.alpha)) * 100) + H.num('fx-sh-blur', 'Vervagen', s.blur || 0, 1, 0, 100, 'px') + H.num('fx-sh-dir', 'Hoek', s.dir || 0, 5, 0, 359, '°') + H.num('fx-sh-dist', 'Afstand', s.dist || 0, 1, 0, 200, 'px') : ''));
    h += H.section('Weerspiegeling', !!r, H.check('fx-rf-on', 'Weerspiegeling', !!r) + (r ? H.range('fx-rf-alpha', 'Transparantie', (1 - (r.alpha === undefined ? 0.5 : r.alpha)) * 100) + H.range('fx-rf-size', 'Grootte', (r.size || 0.5) * 100) + H.num('fx-rf-dist', 'Afstand', r.dist || 0, 1, 0, 100, 'px') : ''));
    h += H.section('Gloed', !!g, H.check('fx-gl-on', 'Gloed', !!g) + (g ? H.color('fx-gl-color', 'Kleur', g.color || 'accent1') + H.num('fx-gl-size', 'Grootte', g.size || 8, 1, 0, 150, 'px') + H.range('fx-gl-alpha', 'Transparantie', (1 - (g.alpha === undefined ? 0.6 : g.alpha)) * 100) : ''));
    h += H.section('Zachte randen', !!fx.soft, H.num('fx-soft', 'Grootte', fx.soft || 0, 1, 0, 100, 'px'));
    h += H.section('3D-opmaak', !!b, H.select('fx-bv', 'Schuine rand', (b && b.type) || 'none', [['none', 'Geen'], ['circle', 'Cirkel'], ['softRound', 'Zacht ronddraaien'], ['angle', 'Hoek']]));
    h += H.section('3D-draaiing', !!d, H.num('fx-3x', 'X-draaiing', d ? d.y || 0 : 0, 5, -180, 180, '°') + H.num('fx-3y', 'Y-draaiing', d ? d.x || 0 : 0, 5, -180, 180, '°') + H.num('fx-3p', 'Perspectief', d ? d.persp || 900 : 900, 50, 200, 5000, 'px'));
    return h;
  };
  const fxHandlers = (get, set) => {
    const upd = (fn) => { const fx = App.clone(get() || {}); fn(fx); Object.keys(fx).forEach((k) => { if (fx[k] === null || fx[k] === undefined || fx[k] === 0) delete fx[k]; }); set(Object.keys(fx).length ? fx : undefined); };
    const sh = (k) => (v) => upd((fx) => { fx.shadow = { type: 'outer', color: '#000000', alpha: 0.4, blur: 5, dist: 4, dir: 45, ...(fx.shadow || {}) }; fx.shadow[k] = v; });
    return {
      'fx-sh-on': (v) => upd((fx) => { fx.shadow = v ? { type: 'outer', color: '#000000', alpha: 0.4, blur: 5, dist: 4, dir: 45 } : null; }),
      'fx-sh-type': sh('type'), 'fx-sh-color': (c) => sh('color')(c || '#000000'), 'fx-sh-alpha': (v) => sh('alpha')(App.round(1 - v / 100, 3)), 'fx-sh-blur': sh('blur'), 'fx-sh-dir': sh('dir'), 'fx-sh-dist': sh('dist'),
      'fx-rf-on': (v) => upd((fx) => { fx.refl = v ? { alpha: 0.5, size: 0.5, dist: 0 } : null; }),
      'fx-rf-alpha': (v) => upd((fx) => { if (fx.refl) fx.refl.alpha = App.round(1 - v / 100, 3); }), 'fx-rf-size': (v) => upd((fx) => { if (fx.refl) fx.refl.size = App.round(v / 100, 3); }), 'fx-rf-dist': (v) => upd((fx) => { if (fx.refl) fx.refl.dist = v; }),
      'fx-gl-on': (v) => upd((fx) => { fx.glow = v ? { color: 'accent1', alpha: 0.6, size: 8 } : null; }),
      'fx-gl-color': (c) => upd((fx) => { if (fx.glow) fx.glow.color = c || 'accent1'; }), 'fx-gl-size': (v) => upd((fx) => { if (fx.glow) fx.glow.size = v; }), 'fx-gl-alpha': (v) => upd((fx) => { if (fx.glow) fx.glow.alpha = App.round(1 - v / 100, 3); }),
      'fx-soft': (v) => upd((fx) => { fx.soft = v || null; }),
      'fx-bv': (v) => upd((fx) => { fx.bevel = v === 'none' ? null : { type: v, w: 6, h: 6 }; }),
      'fx-3x': (v) => upd((fx) => { fx.rot3d = { x: 0, y: 0, persp: 900, ...(fx.rot3d || {}), y: v }; if (!fx.rot3d.x && !fx.rot3d.y) fx.rot3d = null; }),
      'fx-3y': (v) => upd((fx) => { fx.rot3d = { x: 0, y: 0, persp: 900, ...(fx.rot3d || {}), x: v }; if (!fx.rot3d.x && !fx.rot3d.y) fx.rot3d = null; }),
      'fx-3p': (v) => upd((fx) => { if (fx.rot3d) fx.rot3d.persp = v; }),
      __rebuild: ['fx-sh-on', 'fx-rf-on', 'fx-gl-on'],
    };
  };
  const sizeEditor = (o) => {
    const wb = App.worldBox(o.id) || { w: 0, h: 0, x: 0, y: 0 };
    const cm = (v) => App.round(v / App.CM, 2);
    let h = H.section('Grootte', true, H.num('sz-hh', 'Hoogte', cm(wb.h), 0.1, 0, 200, 'cm') + H.num('sz-ww', 'Breedte', cm(wb.w), 0.1, 0, 200, 'cm') + H.num('sz-rot', 'Draaiing', Math.round(o.rot || 0), 1, -360, 360, '°') + H.check('sz-lock', 'Hoogte-breedteverhouding vergrendelen', o.lockAspect || (o.type === 'image' && o.lockAspect !== false)));
    h += H.section('Positie', true, H.num('sz-x', 'Horizontale positie (vanaf linksboven)', cm(wb.x), 0.1, -200, 400, 'cm') + H.num('sz-y', 'Verticale positie (vanaf linksboven)', cm(wb.y), 0.1, -200, 400, 'cm'));
    if (o.type === 'shape') {
      const bp = App.bodyProps(o, App.surface().owner);
      const ins = bp.ins || { l: 9.6, t: 4.8, r: 9.6, b: 4.8 };
      h += H.section('Tekstvak', true, H.select('tb-valign', 'Verticale uitlijning', bp.vAlign || 't', [['t', 'Boven'], ['ctr', 'Midden'], ['b', 'Onder']])
        + H.select('tb-vert', 'Tekstrichting', bp.vert || 'horz', [['horz', 'Horizontaal'], ['vert', 'Alle tekst 90° draaien'], ['vert270', 'Alle tekst 270° draaien']])
        + H.radios('tb-fit', bp.fit || 'none', [['none', 'Niet automatisch aanpassen'], ['shrink', 'Tekst verkleinen bij overloop'], ['resize', 'Vorm aanpassen aan tekst']])
        + H.num('tb-l', 'Linkermarge', cm(ins.l), 0.05, 0, 20, 'cm') + H.num('tb-r', 'Rechtermarge', cm(ins.r), 0.05, 0, 20, 'cm') + H.num('tb-t', 'Bovenmarge', cm(ins.t), 0.05, 0, 20, 'cm') + H.num('tb-b', 'Ondermarge', cm(ins.b), 0.05, 0, 20, 'cm')
        + H.check('tb-wrap', 'Tekst laten teruglopen in vorm', bp.wrap !== false) + H.num('tb-cols', 'Kolommen', (bp.cols && bp.cols.n) || 1, 1, 1, 16));
    }
    h += H.section('Alternatieve tekst', !!o.alt, `<div class="pr"><textarea id="alt-text" placeholder="${App.esc(App.t('Beschrijving (wordt nooit automatisch ingevuld)'))}">${App.esc(o.alt || '')}</textarea></div>` + H.check('alt-dec', 'Markeren als decoratief', !!o.decorative));
    h += H.section('Naam en vergrendeling', false, `<div class="pr"><span>${App.t('Naam')}</span><input type="text" id="obj-name" value="${App.esc(o.name || '')}"></div>` + H.check('obj-lock', 'Vergrendelen (niet verplaatsen of schalen)', !!o.locked));
    return h;
  };
  const sizeHandlers = () => {
    const objs = () => App.selObjs();
    const bp = (fn) => objs().forEach((o) => { if (o.type !== 'shape') return; o.text = o.text || { paras: [App.emptyPara()] }; fn(o.text, o); App.autofit(o, App.surface().owner); });
    const pos = (k) => (v) => objs().forEach((o) => { const wb = App.worldBox(o.id); const px = v * App.CM; App.moveObj(o, k === 'x' ? px - wb.x : 0, k === 'y' ? px - wb.y : 0); });
    const size = (k) => (v) => App.commands.setSize.fn({ key: k, value: String(v).replace('.', App.LANG === 'en' ? '.' : ',') });
    return {
      'sz-hh': (v) => size('h')(v), 'sz-ww': (v) => size('w')(v),
      'sz-rot': (v) => objs().forEach((o) => { if (o.pts) return; App.fixBox(o); const r = ((v % 360) + 360) % 360; if (r) o.rot = r; else delete o.rot; }),
      'sz-lock': (v) => objs().forEach((o) => { o.lockAspect = v; }),
      'sz-x': pos('x'), 'sz-y': pos('y'),
      'tb-valign': (v) => bp((b) => { b.vAlign = v; }), 'tb-vert': (v) => bp((b) => { if (v === 'horz') delete b.vert; else b.vert = v; }),
      'tb-fit': (v) => bp((b) => { b.fit = v; if (v !== 'shrink') delete b.scale; }),
      'tb-l': (v) => bp((b, o) => { b.ins = { ...App.bodyProps(o, App.surface().owner).ins, l: v * App.CM }; }), 'tb-r': (v) => bp((b, o) => { b.ins = { ...App.bodyProps(o, App.surface().owner).ins, r: v * App.CM }; }),
      'tb-t': (v) => bp((b, o) => { b.ins = { ...App.bodyProps(o, App.surface().owner).ins, t: v * App.CM }; }), 'tb-b': (v) => bp((b, o) => { b.ins = { ...App.bodyProps(o, App.surface().owner).ins, b: v * App.CM }; }),
      'tb-wrap': (v) => bp((b) => { b.wrap = v; }), 'tb-cols': (v) => bp((b) => { if (v > 1) b.cols = { n: v, gap: (b.cols && b.cols.gap) || 14 }; else delete b.cols; }),
      'alt-text': (v) => objs().forEach((o) => { if (v.trim()) o.alt = v.trim().slice(0, 2000); else delete o.alt; }),
      'alt-dec': (v) => objs().forEach((o) => { if (v) o.decorative = true; else delete o.decorative; }),
      'obj-name': (v) => objs().forEach((o) => { if (v.trim()) o.name = v.trim().slice(0, 200); }),
      'obj-lock': (v) => objs().forEach((o) => { if (v) o.locked = true; else delete o.locked; }),
    };
  };
  // velden die per tab horen
  App.panes.register('format', {
    title: () => { const o = App.sel1(); return o && o.type === 'image' ? 'Afbeelding opmaken' : o && o.type === 'chart' ? 'Grafiekgebied opmaken' : 'Vorm opmaken'; },
    render(body) {
      const o = App.sel1() || App.selObjs()[0];
      if (!o) { body.innerHTML = `<div class="pane-empty">${App.t('Selecteer een vorm, afbeelding of ander object om de opmaak te wijzigen.')}</div>`; return; }
      const textMode = st.paneMode === 'text';
      const tab = st.paneTab || 'fill';
      const tabs = textMode ? [['fill', 'format_color_text', 'Tekstopvulling en -omtrek'], ['effects', 'blur_on', 'Teksteffecten'], ['size', 'text_fields', 'Tekstvak']] : [['fill', 'format_color_fill', 'Opvulling en lijn'], ['effects', 'blur_on', 'Effecten'], ['size', 'aspect_ratio', 'Grootte en eigenschappen']];
      if (o.type === 'image' && !textMode) tabs.push(['picture', 'image', 'Afbeelding']);
      let html = `<div class="pane-tabs">${(o.type === 'shape' ? [['shape', 'Vormopties'], ['text', 'Tekstopties']] : [['shape', o.type === 'image' ? 'Afbeeldingsopties' : 'Opties']]).map(([k, l]) => `<button class="pane-tab ${(k === 'text') === textMode ? 'on' : ''}" data-pmode="${k}">${App.esc(App.t(l))}</button>`).join('')}</div>`;
      html += `<div class="pane-tabs">${tabs.map(([k, ic, l]) => `<button class="pane-tab ${tab === k || (k === 'size' && tab === 'size') ? 'on' : ''}" data-ptab="${k}" title="${App.esc(App.t(l))}"><span class="i">${ic}</span></button>`).join('')}</div>`;
      let handlers = {};
      if (!textMode) {
        if (tab === 'fill') {
          if (o.type !== 'line') { html += H.section('Opvulling', true, fillEditor('f-', App.objFill(o))); handlers = { ...handlers, ...fillHandlers('f-', () => App.objFill(App.sel1() || o), (f) => App.selObjs().forEach((x) => { if (x.type !== 'line') x.fill = App.clone(f); })) }; }
          html += H.section(o.type === 'line' ? 'Lijn' : 'Lijn', true, lineEditor(App.objLine(o), o.type === 'line'));
          const lset = (fn) => App.selObjs().forEach((x) => { const l = { ...App.objLine(x) }; fn(l); x.line = l; });
          handlers = { ...handlers,
            'ln-type': (v) => lset((l) => { l.type = v; if (v === 'solid') { l.color = l.color || 'tx1'; l.w = l.w || 0.75; } }),
            'ln-color': (c) => lset((l) => { l.type = 'solid'; l.color = c || 'tx1'; }), 'ln-alpha': (v) => lset((l) => { const a = 1 - v / 100; if (a >= 1) delete l.alpha; else l.alpha = App.round(a, 3); }),
            'ln-w': (v) => lset((l) => { l.w = Math.max(0, v); }), 'ln-cmpd': (v) => lset((l) => { if (v === 'sng') delete l.cmpd; else l.cmpd = v; }), 'ln-dash': (v) => lset((l) => { if (v === 'solid') delete l.dash; else l.dash = v; }),
            'ln-cap': (v) => lset((l) => { l.cap = v; }), 'ln-join': (v) => lset((l) => { l.join = v; }),
            'ln-head': (v) => lset((l) => { if (v === 'none') delete l.head; else l.head = { ...(l.head || {}), type: v }; }), 'ln-headw': (v) => lset((l) => { if (l.head) { l.head.w = v; l.head.len = v; } }),
            'ln-tail': (v) => lset((l) => { if (v === 'none') delete l.tail; else l.tail = { ...(l.tail || {}), type: v }; }), 'ln-tailw': (v) => lset((l) => { if (l.tail) { l.tail.w = v; l.tail.len = v; } }),
            __rebuild: [...(handlers.__rebuild || []), 'ln-type'] };
        } else if (tab === 'effects') { html += fxEditor(o.fx); handlers = fxHandlers(() => (App.sel1() || o).fx, (fx) => App.selObjs().forEach((x) => { if (fx) x.fx = App.clone(fx); else delete x.fx; })); }
        else if (tab === 'picture' && o.type === 'image') { html += App.picturePaneHtml ? App.picturePaneHtml(o) : ''; handlers = App.picturePaneHandlers ? App.picturePaneHandlers() : {}; }
        else { html += sizeEditor(o); handlers = sizeHandlers(); handlers.__rebuild = ['tb-fit']; }
      } else {
        const r = (App.curRuns() || [])[0] || {};
        if (tab === 'fill') {
          const tfill = r.fill || { type: 'solid', color: r.color || 'tx1' };
          html += H.section('Tekstopvulling', true, fillEditor('t-', tfill, null, { noPattern: true }));
          handlers = fillHandlers('t-', () => { const rr = (App.curRuns() || [])[0] || {}; return rr.fill || { type: 'solid', color: rr.color || 'tx1' }; }, (f) => { App.selObjs().forEach((x) => App.bodiesOf(x).forEach((b) => b.paras.forEach((p) => p.runs.forEach((ru) => { if (f.type === 'solid') { ru.color = f.color; if (f.alpha !== undefined) ru.alpha = f.alpha; else delete ru.alpha; delete ru.fill; } else ru.fill = App.clone(f); })))); });
          const ln = r.ln || { type: 'none' };
          html += H.section('Tekstomtrek', true, H.radios('tl-type', ln.type || 'none', [['none', 'Geen lijn'], ['solid', 'Effen lijn']]) + (ln.type === 'solid' ? H.color('tl-color', 'Kleur', ln.color || 'tx1') + H.num('tl-w', 'Breedte', ln.w || 0.75, 0.25, 0, 20, 'pt') : ''));
          const tl = (fn) => App.selObjs().forEach((x) => App.bodiesOf(x).forEach((b) => b.paras.forEach((p) => p.runs.forEach((ru) => { const l = { type: 'solid', color: 'tx1', w: 0.75, ...(ru.ln || {}) }; fn(l); if (l.type === 'none') delete ru.ln; else ru.ln = l; }))));
          handlers = { ...handlers, 'tl-type': (v) => tl((l) => { l.type = v; }), 'tl-color': (c) => tl((l) => { l.color = c || 'tx1'; }), 'tl-w': (v) => tl((l) => { l.w = v; }), __rebuild: [...handlers.__rebuild, 'tl-type'] };
        } else if (tab === 'effects') {
          html += fxEditor(r.fx || {});
          handlers = fxHandlers(() => ((App.curRuns() || [])[0] || {}).fx, (fx) => App.selObjs().forEach((x) => App.bodiesOf(x).forEach((b) => b.paras.forEach((p) => p.runs.forEach((ru) => { if (fx) ru.fx = App.clone(fx); else delete ru.fx; })))));
        } else { html += sizeEditor(o); handlers = sizeHandlers(); handlers.__rebuild = ['tb-fit']; }
      }
      body.innerHTML = html;
      body.querySelectorAll('[data-pmode]').forEach((b) => { b.onclick = () => { st.paneMode = b.dataset.pmode; st.paneTab = 'fill'; App.panes.refresh(true); }; });
      body.querySelectorAll('[data-ptab]').forEach((b) => { b.onclick = () => { st.paneTab = b.dataset.ptab; App.panes.refresh(true); }; });
      bind(body, handlers);
      if (!textMode && tab === 'fill' && o.type !== 'line') fillClicks(body, 'f-', () => App.objFill(App.sel1() || o), (f) => App.selObjs().forEach((x) => { if (x.type !== 'line') x.fill = App.clone(f); }));
      if (textMode && tab === 'fill') fillClicks(body, 't-', () => { const rr = (App.curRuns() || [])[0] || {}; return rr.fill || { type: 'solid', color: rr.color || 'tx1' }; }, (f) => App.selObjs().forEach((x) => App.bodiesOf(x).forEach((b) => b.paras.forEach((p) => p.runs.forEach((ru) => { ru.fill = App.clone(f); })))));
    },
  });

  /* ---------- Achtergrond opmaken ---------- */
  App.panes.register('background', {
    title: 'Achtergrond opmaken',
    render(body) {
      const surf = App.surface();
      const owner = surf.owner;
      const bg = owner.bg || App.bgOf(owner);
      const isSlide = surf.kind === 'slide';
      let html = H.section('Opvulling', true, fillEditor('b-', bg)
        + (isSlide || surf.kind === 'layout' ? H.check('bg-hide', 'Achtergrondafbeeldingen verbergen', !!owner.hideMaster) : ''));
      html += `<div class="pane-foot">${isSlide ? `<button class="btn small" data-bgall>${App.t('Op alles toepassen')}</button>` : ''}<button class="btn small" data-bgreset>${App.t('Achtergrond opnieuw instellen')}</button></div>`;
      body.innerHTML = html;
      const targets = () => (App.surface().kind === 'slide' ? App.selSlides() : [App.surface().owner]);
      const setBg = (f) => targets().forEach((s) => { s.bg = App.clone(f); App.touch(s); });
      const h = fillHandlers('b-', () => App.surface().owner.bg || App.bgOf(App.surface().owner), setBg);
      h['bg-hide'] = (v) => targets().forEach((s) => { if (v) s.hideMaster = true; else delete s.hideMaster; App.touch(s); });
      bind(body, h);
      fillClicks(body, 'b-', () => App.surface().owner.bg || App.bgOf(App.surface().owner), setBg);
      body.querySelector('[data-bgreset]').onclick = () => { App.run(() => targets().forEach((s) => { delete s.bg; App.touch(s); }), { all: true }); App.invalidateThumbs(); App.panes.refresh(true); };
      const all = body.querySelector('[data-bgall]');
      if (all) all.onclick = () => { const f = App.clone(App.cur().bg || App.bgOf(App.cur())); App.run(() => { const m = App.masterOf(App.cur()); m.bg = App.clone(f); App.pres.slides.forEach((s) => { delete s.bg; }); App.masterOf(App.cur()).layouts.forEach((l) => { delete l.bg; }); }, { all: true, masters: true }); App.invalidateThumbs(); App.thumbs.refresh(true); };
    },
  });
  App.def('hideBgGraphics', () => App.run(() => { App.selSlides().forEach((s) => { if (s.hideMaster) delete s.hideMaster; else s.hideMaster = true; App.touch(s); }); }, { noTouch: true }));
  App.stateFns.hideBg = () => !!(App.cur() && App.cur().hideMaster);

  /* ---------- Selectievenster ---------- */
  App.panes.register('sel', {
    title: 'Selectie',
    render(body) {
      const surf = App.surface();
      const rows = [];
      const walk = (objs, depth) => objs.slice().reverse().forEach((o) => {
        rows.push(`<div class="pl-row${st.sel.includes(o.id) ? ' on' : ''}" data-id="${o.id}" draggable="true" style="padding-left:${10 + depth * 16}px">${o.type === 'group' ? '<span class="i" style="font-size:16px">folder</span>' : ''}<span class="grow" title="${App.esc(o.name || '')}">${App.esc(o.name || App.t(App.OBJ_NAMES[o.type] || 'Object'))}</span><button class="qb" data-lock="${o.id}" title="${App.esc(App.t(o.locked ? 'Ontgrendelen' : 'Vergrendelen'))}"><span class="i">${o.locked ? 'lock' : 'lock_open'}</span></button><button class="qb" data-vis="${o.id}" title="${App.esc(App.t(o.hidden ? 'Weergeven' : 'Verbergen'))}"><span class="i">${o.hidden ? 'visibility_off' : 'visibility'}</span></button></div>`);
        if (o.type === 'group') walk(o.objs, depth + 1);
      });
      walk(surf.objs, 0);
      body.innerHTML = `<div class="pane-actions"><button class="btn small" data-all="show">${App.t('Alles weergeven')}</button><button class="btn small" data-all="hide">${App.t('Alles verbergen')}</button><button class="qb" data-mv="1" title="${App.esc(App.t('Naar voren'))}"><span class="i">arrow_upward</span></button><button class="qb" data-mv="-1" title="${App.esc(App.t('Naar achteren'))}"><span class="i">arrow_downward</span></button></div>
        <div class="pane-list">${rows.join('') || `<div class="pane-empty">${App.t('Er staan geen objecten op deze dia.')}</div>`}</div>
        <p class="muted small" style="padding:8px 12px;line-height:1.45">${App.t('Bovenaan staat het voorste object. Sleep om de volgorde te wijzigen; dubbelklik om de naam te wijzigen. De volgorde is ook de leesvolgorde voor schermlezers (van achter naar voor).')}</p>`;
      body.onclick = (e) => {
        const lock = e.target.closest('[data-lock]'), vis = e.target.closest('[data-vis]'), all = e.target.closest('[data-all]'), mv = e.target.closest('[data-mv]');
        if (lock) { const o = App.obj(lock.dataset.lock); App.run(() => { if (o.locked) delete o.locked; else o.locked = true; }); App.panes.refresh(true); return; }
        if (vis) { const o = App.obj(vis.dataset.vis); App.run(() => { if (o.hidden) delete o.hidden; else o.hidden = true; }); App.panes.refresh(true); return; }
        if (all) { App.run(() => App.walkObjs(App.surface().objs, (o) => { if (all.dataset.all === 'hide') o.hidden = true; else delete o.hidden; })); App.panes.refresh(true); return; }
        if (mv) { App.exec('order', mv.dataset.mv === '1' ? 'forward' : 'backward'); App.panes.refresh(true); return; }
        const row = e.target.closest('[data-id]');
        if (row) { if (e.ctrlKey || e.shiftKey) App.select([...new Set([...st.sel, row.dataset.id])], { keepGroup: true }); else App.select([row.dataset.id]); }
      };
      body.ondblclick = async (e) => {
        const row = e.target.closest('[data-id]'); if (!row) return;
        const o = App.obj(row.dataset.id);
        const n = await App.prompt(App.t('Naam wijzigen'), App.t('Naam'), o.name || '');
        if (n && n.trim()) { App.run(() => { o.name = n.trim().slice(0, 200); }); App.panes.refresh(true); }
      };
      let dragId = null;
      body.ondragstart = (e) => { const r = e.target.closest('[data-id]'); dragId = r ? r.dataset.id : null; };
      body.ondragover = (e) => { if (!dragId) return; e.preventDefault(); body.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); const r = e.target.closest('[data-id]'); if (r) r.classList.add('drag-over'); };
      body.ondrop = (e) => {
        e.preventDefault(); const r = e.target.closest('[data-id]'); if (!r || !dragId || r.dataset.id === dragId) return;
        const list = App.ownerList(dragId), tl = App.ownerList(r.dataset.id); if (list !== tl) return;
        App.run(() => { const a = list.findIndex((x) => x.id === dragId); const [o] = list.splice(a, 1); const b = list.findIndex((x) => x.id === r.dataset.id); list.splice(b + 1, 0, o); });
        dragId = null; App.panes.refresh(true);
      };
    },
  });

  /* ---------- Notities ---------- */
  const notes = $('#notes');
  let notesFor = null;
  App.renderNotes = () => {
    if (st.view === 'master') { notes.contentEditable = 'false'; notes.innerHTML = ''; notesFor = null; return; }
    notes.contentEditable = App.readOnly && App.readOnly() ? 'false' : 'true';
    const s = App.cur(); if (!s) return;
    if (document.activeElement === notes && notesFor === s.id) return;   // tijdens het typen niet vervangen
    notesFor = s.id;
    notes.lang = App.pres.lang || 'nl-NL';
    const paras = s.notes && s.notes.paras ? s.notes.paras : [];
    notes.replaceChildren(...paras.filter((p, i) => i < paras.length || p.runs.some((r) => r.t)).map((p) => {
      const el = document.createElement('p');
      p.runs.forEach((r) => {
        const sp = document.createElement('span');
        if (r.b) sp.style.fontWeight = '700'; if (r.i) sp.style.fontStyle = 'italic'; if (r.u) sp.style.textDecoration = 'underline';
        App.fillRunText(sp, r.t);
        el.appendChild(sp);
      });
      if (!p.runs.some((r) => r.t)) el.appendChild(document.createElement('br'));
      return el;
    }));
    if (paras.length && !paras.some((p) => p.runs.some((r) => r.t))) notes.replaceChildren();
  };
  const readNotes = () => {
    const s = App.slideById(notesFor); if (!s) return;
    const ps = Array.from(notes.childNodes);
    const paras = [];
    const runOf = (node, base = {}) => {
      if (node.nodeType === 3) return [{ ...base, t: node.nodeValue }];
      if (node.nodeType !== 1) return [];
      if (node.tagName === 'BR') return [{ ...base, t: '\v' }];
      const st2 = { ...base };
      const cs = node.style || {};
      if (node.tagName === 'B' || node.tagName === 'STRONG' || cs.fontWeight === '700' || cs.fontWeight === 'bold') st2.b = true;
      if (node.tagName === 'I' || node.tagName === 'EM' || cs.fontStyle === 'italic') st2.i = true;
      if (node.tagName === 'U' || /underline/.test(cs.textDecoration || '')) st2.u = 'sng';
      return Array.from(node.childNodes).flatMap((c) => runOf(c, st2));
    };
    let loose = [];
    const flush = () => { if (loose.length) { paras.push({ runs: loose }); loose = []; } };
    ps.forEach((n) => {
      if (n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'DIV')) { flush(); const runs = runOf(n).map((r) => ({ ...r })); const t = runs.map((r) => r.t).join(''); paras.push(App.normalizePara({ runs: t === '\v' ? [{ t: '' }] : runs.map((r) => ({ ...r, t: r.t })).filter((r, i, a) => !(r.t === '\v' && i === a.length - 1)) })); }
      else loose.push(...runOf(n));
    });
    flush();
    const body = { paras: paras.length ? paras.map(App.normalizePara) : [] };
    if (!body.paras.some((p) => p.runs.some((r) => r.t))) delete s.notes; else s.notes = body;
    App.touch(s); App.markDirty(); App.history.later(900);
  };
  notes.addEventListener('input', readNotes);
  notes.addEventListener('focus', () => { notesFor = App.cur() && App.cur().id; });
  notes.addEventListener('blur', () => { readNotes(); App.history.flush(); });
  notes.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && /^[biu]$/i.test(e.key)) { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); readNotes(); }
    if (e.key === 'Escape') { notes.blur(); App.focusStage(); }
  });
  notes.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); });
})();
