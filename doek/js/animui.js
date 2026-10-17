/* =========================================================
   Doek (gemaakt door JJ van Schelven) — animaties in de interface: galerij,
   effectopties, timing, triggers, animatie kopiëren, het animatiedeelvenster met
   tijdlijn (slepen om te ordenen) en het voorbeeld op het werkvlak
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const slide = () => App.cur();
  const CLS_NAME = { entr: 'Ingang', emph: 'Nadruk', exit: 'Uitgang', path: 'Bewegingspaden' };
  const GALLERY = {
    entr: ['appear', 'fade', 'fly', 'float', 'split', 'wipe', 'shape', 'wheel', 'randomBars', 'grow', 'zoom', 'swivel', 'bounce'],
    emph: ['pulse', 'colorPulse', 'teeter', 'spin', 'grow', 'desaturate', 'darken', 'lighten', 'transp', 'objColor', 'bold', 'wave'],
    exit: ['appear', 'fade', 'fly', 'float', 'split', 'wipe', 'shape', 'wheel', 'randomBars', 'grow', 'zoom', 'swivel', 'bounce'],
    path: ['down', 'left', 'right', 'up', 'arcDown', 'arcUp', 'turnDown', 'turnUp', 'circle', 'square', 'diamond', 'heart', 'loop', 'wave', 'zigzag', 'bounce'],
  };
  const MORE = { entr: ['spin', 'dissolve', 'blinds', 'checker', 'peek'], emph: ['fillColor', 'lineColor', 'fontColor', 'underline'], exit: ['spin', 'dissolve', 'blinds', 'checker', 'peek'] };
  const DEFAULT_DIR = { fly: 'b', float: 'u', split: 'vertIn', wipe: 'b', shape: 'circle', wheel: '1', randomBars: 'horz', zoom: 'in', blinds: 'horz', checker: 'horz', peek: 'b' };
  const chip = (cls, eff, cmd = 'animApply', on) => {
    const name = cls === 'path' ? App.PATHS[eff][0] : App.EFFECT_NAMES[cls][eff];
    return `<button class="fx-chip ${cls}${on ? ' on' : ''}" data-cmd="${cmd}" data-arg="${cls}:${eff}" title="${App.esc(App.t(name))}"><span class="i">${cls === 'path' ? 'route' : App.EFFECT_ICONS[eff] || 'star'}</span><span>${App.esc(App.t(name.replace(/^.*: /, '')))}</span></button>`;
  };
  App.fillAnimGallery = () => {
    const g = $('#g-anims'); if (!g) return;
    const cur = (selAnims()[0]) || null;
    g.innerHTML = `<button class="fx-chip" data-cmd="animApply" data-arg="none" title="${App.esc(App.t('Geen'))}"><span class="i">block</span><span>${App.t('Geen')}</span></button>` + ['entr', 'emph', 'exit'].map((c) => GALLERY[c].slice(0, 7).map((e) => chip(c, e, 'animApply', cur && cur.cls === c && cur.eff === e)).join('')).join('') + chip('path', 'right');
  };
  const gallery = (cmd) => `<div class="fx-menu-body">` + ['entr', 'emph', 'exit', 'path'].map((c) => `<div class="menu-title">${App.esc(App.t(CLS_NAME[c]))}</div><div class="fx-grid">${GALLERY[c].map((e) => chip(c, e, cmd)).join('')}${(MORE[c] || []).map((e) => chip(c, e, cmd)).join('')}</div>`).join('') + `<hr><button data-cmd="drawMotionPath"><span class="i">gesture</span> ${App.t('Aangepast pad tekenen')}</button></div>`;
  App.menuBuilders['m-anims'] = () => gallery('animApply');
  App.menuBuilders['m-anims'].cls = 'fx-menu';
  App.menuBuilders['m-addanim'] = () => gallery('animAdd');
  App.menuBuilders['m-addanim'].cls = 'fx-menu';

  /* ---------- Geselecteerde animaties ---------- */
  st.animSel = [];
  const selAnims = () => {
    const s = slide(); if (!s || !s.anims) return [];
    if (st.animSel && st.animSel.length) { const list = s.anims.filter((a) => st.animSel.includes(a.id)); if (list.length) return list; }
    return s.anims.filter((a) => st.sel.includes(a.obj));
  };
  App.selAnims = selAnims;
  App.on('selection', () => { if (!st._animPaneClick) st.animSel = []; st._animPaneClick = false; App.updateAnimUi(); });
  App.on('slide', () => { st.animSel = []; App.updateAnimUi(); });
  App.updateAnimUi = () => {
    const a = selAnims()[0];
    const s = $('#anim-start'), d = $('#anim-dur'), dl = $('#anim-delay');
    if (s) { s.disabled = !a; if (a && document.activeElement !== s) s.value = a.start; }
    if (d) { d.disabled = !a; if (a && document.activeElement !== d) d.value = App.round(a.dur, 2); else if (!a) d.value = ''; }
    if (dl) { dl.disabled = !a; if (a && document.activeElement !== dl) dl.value = App.round(a.delay || 0, 2); else if (!a) dl.value = ''; }
    if (App.activeTab === 'animations') App.fillAnimGallery();
  };
  App.on('tab', (t) => { if (t === 'animations') { App.fillAnimGallery(); App.updateAnimUi(); } });
  App.on('change', () => { if (App.activeTab === 'animations') App.updateAnimUi(); });

  /* ---------- Toepassen ---------- */
  const makeAnim = (spec, obj, base) => {
    const [cls, eff] = spec.split(':');
    const a = { id: App.uid('a'), obj: obj.id, cls, eff: cls === 'path' ? 'path' : eff, start: base ? base.start : 'click', dur: base ? base.dur : (cls === 'path' ? 2 : eff === 'appear' ? 0.5 : 0.5), delay: base ? base.delay : 0 };
    if (cls === 'path') { a.path = App.PATHS[eff][1]; a.pathName = eff; }
    if (DEFAULT_DIR[eff] && cls !== 'emph') a.dir = DEFAULT_DIR[eff];
    if (cls === 'emph' && eff === 'spin') a.emph = { angle: 360 }; else if (cls === 'emph' && eff === 'grow') a.emph = { scale: 1.5 }; else if (cls === 'emph' && eff === 'transp') a.emph = { alpha: 0.5 };
    if (cls === 'emph' && (eff === 'pulse' || eff === 'teeter' || eff === 'colorPulse' || eff === 'wave')) a.dur = base ? base.dur : 0.6;
    if (eff === 'fly' || eff === 'bounce') a.dur = base ? base.dur : 0.5;
    // tekst in een placeholder: standaard per alinea
    if ((cls === 'entr' || cls === 'exit') && obj.ph && App.phFamily(obj.ph.type) === 'body' && obj.text && obj.text.paras.filter((p) => p.runs.some((r) => r.t)).length > 1) a.seq = 'para';
    return a;
  };
  App.defEdit('animApply', (spec) => {
    const s = slide(); const objs = App.selObjs();
    if (!objs.length) { App.toast(App.t('Selecteer eerst een object om te animeren.'), 'info'); return false; }
    s.anims = s.anims || [];
    if (spec === 'none') { s.anims = s.anims.filter((a) => !objs.some((o) => o.id === a.obj) || a.trig); st.animSel = []; return; }
    const sel = selAnims();
    objs.forEach((o) => {
      const mine = s.anims.filter((a) => a.obj === o.id && !a.trig);
      const target = sel.find((a) => a.obj === o.id) || mine[0];
      const na = makeAnim(spec, o, target);
      if (target) { const i = s.anims.indexOf(target); na.id = target.id; if (target.seq && na.seq === undefined) na.seq = target.seq; s.anims.splice(i, 1, na); }
      else s.anims.push(na);
    });
    App.previewSoon();
  });
  App.defEdit('animAdd', (spec) => {
    const s = slide(); const objs = App.selObjs();
    if (!objs.length) { App.toast(App.t('Selecteer eerst een object om te animeren.'), 'info'); return false; }
    s.anims = s.anims || [];
    const made = objs.map((o) => makeAnim(spec, o));
    s.anims.push(...made);
    st.animSel = made.map((a) => a.id);
    App.previewSoon();
  });
  const eachAnim = (fn) => { const list = selAnims(); if (!list.length) return false; list.forEach(fn); return true; };
  App.defEdit('animStart', (v) => eachAnim((a) => { a.start = v; }));
  App.defEdit('animDur', (v) => { const n = App.parseNum(v); if (!(n > 0)) return false; return eachAnim((a) => { a.dur = App.clamp(n, 0.01, 59); }); });
  App.defEdit('animDelay', (v) => { const n = App.parseNum(v); if (!(n >= 0)) return false; return eachAnim((a) => { a.delay = App.clamp(n, 0, 59); }); });
  App.defEdit('animMove', (d) => {
    const s = slide(); const sel = selAnims(); if (!sel.length) return false;
    const list = s.anims;
    const ids = new Set(sel.map((a) => a.id));
    if (+d < 0) { for (let i = 1; i < list.length; i++) if (ids.has(list[i].id) && !ids.has(list[i - 1].id)) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; } }
    else { for (let i = list.length - 2; i >= 0; i--) if (ids.has(list[i].id) && !ids.has(list[i + 1].id)) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; } }
    st.animSel = [...ids];
  });
  App.defEdit('animRemove', () => { const s = slide(); const ids = new Set(selAnims().map((a) => a.id)); if (!ids.size) return false; s.anims = s.anims.filter((a) => !ids.has(a.id)); st.animSel = []; });

  /* ---------- Effectopties ---------- */
  const DIRS = {
    fly: [['b', 'Vanaf onder'], ['bl', 'Vanaf linksonder'], ['l', 'Vanaf links'], ['tl', 'Vanaf linksboven'], ['t', 'Vanaf boven'], ['tr', 'Vanaf rechtsboven'], ['r', 'Vanaf rechts'], ['br', 'Vanaf rechtsonder']],
    float: [['u', 'Omhoog zweven'], ['d', 'Omlaag zweven']],
    split: [['horzIn', 'Horizontaal naar binnen'], ['horzOut', 'Horizontaal naar buiten'], ['vertIn', 'Verticaal naar binnen'], ['vertOut', 'Verticaal naar buiten']],
    wipe: [['b', 'Vanaf onder'], ['l', 'Vanaf links'], ['r', 'Vanaf rechts'], ['t', 'Vanaf boven']],
    shape: [['circle', 'Cirkel'], ['box', 'Rechthoek'], ['diamond', 'Ruit'], ['plus', 'Plus']],
    wheel: [['1', '1 spaak'], ['2', '2 spaken'], ['3', '3 spaken'], ['4', '4 spaken'], ['8', '8 spaken']],
    randomBars: [['horz', 'Horizontaal'], ['vert', 'Verticaal']], blinds: [['horz', 'Horizontaal'], ['vert', 'Verticaal']], checker: [['horz', 'Horizontaal'], ['vert', 'Verticaal']],
    zoom: [['in', 'In'], ['out', 'Uit']], peek: [['b', 'Vanaf onder'], ['l', 'Vanaf links'], ['r', 'Vanaf rechts'], ['t', 'Vanaf boven']],
  };
  App.menuBuilders['m-animopts'] = () => {
    const a = selAnims()[0];
    if (!a) return `<div class="menu-empty">${App.t('Selecteer een object met een animatie.')}</div>`;
    let h = '';
    const dirs = DIRS[a.eff];
    if (dirs && a.cls !== 'emph') h += `<div class="menu-title">${App.t('Richting')}</div>` + dirs.map(([v, l]) => `<button data-cmd="animDir" data-arg="${v}"><span class="i">${a.dir === v ? 'radio_button_checked' : 'radio_button_unchecked'}</span> ${App.esc(App.t(l))}</button>`).join('');
    if (a.cls === 'emph' && a.eff === 'spin') h += `<div class="menu-title">${App.t('Hoeveelheid')}</div>` + [[90, 'Kwart draai'], [180, 'Halve draai'], [360, 'Volledige draai'], [720, 'Twee draaien']].map(([v, l]) => `<button data-cmd="animEmph" data-arg="angle:${v}">${App.esc(App.t(l))}</button>`).join('');
    if (a.cls === 'emph' && a.eff === 'grow') h += `<div class="menu-title">${App.t('Grootte')}</div>` + [[0.5, 'Kleiner'], [1.5, 'Groter'], [2, 'Enorm']].map(([v, l]) => `<button data-cmd="animEmph" data-arg="scale:${v}">${App.esc(App.t(l))}</button>`).join('');
    if (a.cls === 'path') h += `<div class="menu-title">${App.t('Pad')}</div><button data-cmd="animPathReverse"><span class="i">swap_horiz</span> ${App.t('Padrichting omkeren')}</button><button data-cmd="animPathRot"><span class="i">${a.pathRot ? 'check_box' : 'check_box_outline_blank'}</span> ${App.t('Meedraaien met het pad')}</button><button data-cmd="editMotionPath"><span class="i">polyline</span> ${App.t('Punten bewerken')}</button>`;
    const o = App.obj(a.obj);
    if (o && o.text && (a.cls === 'entr' || a.cls === 'exit')) h += `<div class="menu-title">${App.t('Reeks')}</div><button data-cmd="animSeq" data-arg="one"><span class="i">${a.seq !== 'para' ? 'radio_button_checked' : 'radio_button_unchecked'}</span> ${App.t('Als één object')}</button><button data-cmd="animSeq" data-arg="para"><span class="i">${a.seq === 'para' ? 'radio_button_checked' : 'radio_button_unchecked'}</span> ${App.t('Per alinea')}</button>`;
    return h + `<hr><button data-cmd="animDialog">${App.t('Meer effectopties…')}</button>`;
  };
  App.defEdit('animDir', (v) => eachAnim((a) => { a.dir = v; }));
  App.defEdit('animSeq', (v) => eachAnim((a) => { if (v === 'para') a.seq = 'para'; else delete a.seq; }));
  App.defEdit('animEmph', (v) => { const [k, n] = String(v).split(':'); return eachAnim((a) => { a.emph = { ...(a.emph || {}), [k]: +n }; }); });
  App.defEdit('animPathReverse', () => eachAnim((a) => { if (a.cls !== 'path' || !a.path || !App.Geo) return; const subs = App.Geo.parse(a.path); subs.forEach((s) => { const pts = s.pts; const rev = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], nx = pts[i + 1]; const q = { x: p.x, y: p.y }; if (nx && nx.c1) { q.c1 = nx.c2; q.c2 = nx.c1; } rev.push(q); } s.pts = rev; }); const first = subs[0] && subs[0].pts[0]; const dx = first ? first.x : 0, dy = first ? first.y : 0; a.path = App.Geo.toD(App.Geo.transform(subs, [1, 0, 0, 1, -dx, -dy]), 4); }));
  App.defEdit('animPathRot', () => eachAnim((a) => { a.pathRot = !a.pathRot || undefined; }));

  /* ---------- Triggers ---------- */
  App.menuBuilders['m-trigger'] = () => {
    const a = selAnims()[0];
    if (!a) return `<div class="menu-empty">${App.t('Selecteer een object met een animatie.')}</div>`;
    const objs = slide().objs.filter((o) => o.id !== a.obj);
    const media = slide().objs.filter((o) => (o.type === 'video' || o.type === 'audio') && (o.marks || []).length);
    return `<div class="menu-title">${App.t('Bij klikken op')}</div>` + (objs.length ? objs.map((o) => `<button data-cmd="animTrigger" data-arg="obj:${App.esc(o.id)}"><span class="i">${a.trig && a.trig.obj === o.id ? 'check' : 'touch_app'}</span> ${App.esc(o.name || o.type)}</button>`).join('') : `<div class="menu-empty">${App.t('Er zijn geen andere objecten op deze dia.')}</div>`)
      + (media.length ? `<div class="menu-title">${App.t('Bij bladwijzer')}</div>` + media.flatMap((m) => m.marks.map((k) => `<button data-cmd="animTrigger" data-arg="mark:${App.esc(m.id)}:${App.esc(k.name)}"><span class="i">bookmark</span> ${App.esc(m.name)} › ${App.esc(k.name)}</button>`)).join('') : '')
      + (a.trig ? `<hr><button data-cmd="animTrigger" data-arg="none"><span class="i">block</span> ${App.t('Trigger verwijderen')}</button>` : '');
  };
  App.defEdit('animTrigger', (v) => eachAnim((a) => {
    if (v === 'none') { delete a.trig; return; }
    const [k, id, ...rest] = String(v).split(':');
    a.trig = k === 'obj' ? { obj: id } : { media: id, mark: rest.join(':') };
    a.start = 'click';
  }));

  /* ---------- Animatie kopiëren (kwast) ---------- */
  App.def('animPainter', () => {
    if (st.animPainter) { st.animPainter = null; App.scheduleState(); return; }
    const src = App.sel1(); if (!src) { App.toast(App.t('Selecteer eerst een object met een animatie.'), 'info'); return; }
    const anims = (slide().anims || []).filter((a) => a.obj === src.id);
    if (!anims.length) { App.toast(App.t('Dit object heeft geen animaties.'), 'info'); return; }
    st.animPainter = anims.map(App.clone);
    App.toast(App.t('Klik op het object dat dezelfde animatie moet krijgen.'), 'format_paint');
    App.scheduleState();
  });
  App.stateFns.animPainter = () => !!st.animPainter;
  App.on('selection', () => {
    const p = st.animPainter; if (!p) return;
    const o = App.sel1(); if (!o || p.some((a) => a.obj === o.id)) return;
    st.animPainter = null;
    App.run(() => { const s = slide(); s.anims = s.anims.filter((a) => a.obj !== o.id); p.forEach((a) => s.anims.push({ ...App.clone(a), id: App.uid('a'), obj: o.id })); });
    App.scheduleState();
  });

  /* ---------- Bewegingspad zelf tekenen ---------- */
  App.def('drawMotionPath', () => {
    const o = App.sel1(); if (!o) { App.toast(App.t('Selecteer eerst het object dat moet bewegen.'), 'info'); return; }
    App.toast(App.t('Sleep vanaf het object om het pad te tekenen.'), 'gesture', { ms: 3000 });
    const stage = $('#stage'); stage.classList.add('tool-draw');
    const down = (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const P = App.pres; const pts = [];
      const svg = App.svgEl('svg', { style: 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none', width: 1, height: 1 });
      const path = App.svgEl('path', { fill: 'none', stroke: '#6b7280', 'stroke-width': 2, 'stroke-dasharray': '6 4' }); svg.appendChild(path); $('#overlay').appendChild(svg);
      const move = (ev) => { const p = App.toSlide(ev.clientX, ev.clientY); pts.push([p.x, p.y]); const z = App.zoom(); path.setAttribute('d', App.strokePath(pts.map(([x, y]) => [x * z, y * z]))); };
      const up = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); svg.remove(); stage.classList.remove('tool-draw'); stage.removeEventListener('mousedown', down, true);
        if (pts.length < 3) return;
        const [x0, y0] = pts[0];
        const d = 'M0 0 ' + pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1).slice(1).map(([x, y]) => `L${App.round((x - x0) / P.size.w, 4)} ${App.round((y - y0) / P.size.h, 4)}`).join(' ');
        App.run(() => { const s = slide(); s.anims = s.anims || []; const a = { id: App.uid('a'), obj: o.id, cls: 'path', eff: 'path', path: d, start: 'click', dur: 2, delay: 0 }; s.anims.push(a); st.animSel = [a.id]; });
        App.previewSoon();
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    };
    stage.addEventListener('mousedown', down, true);
  });

  /* ---------- Dialoog met alle opties ---------- */
  App.def('animDialog', () => {
    const a = selAnims()[0]; if (!a) return;
    const name = a.cls === 'path' ? App.t('Bewegingspad') : App.t(App.EFFECT_NAMES[a.cls][a.eff] || a.eff);
    const o = App.obj(a.obj);
    App.dialog({
      title: name, wide: true,
      body: `<div class="seg" id="ad-tabs"><button data-t="eff" class="on">${App.t('Effect')}</button><button data-t="tim">${App.t('Timing')}</button>${o && o.text ? `<button data-t="txt">${App.t('Tekstanimatie')}</button>` : ''}</div>
        <div id="ad-eff">
          <div class="fields-2"><label class="field"><span>${App.t('Vloeiend begin en einde')}</span><select id="ad-ease"><option value="ease-out">${App.t('Vloeiend einde')}</option><option value="ease-in-out" ${a.ease === 'ease-in-out' ? 'selected' : ''}>${App.t('Vloeiend begin en einde')}</option><option value="linear" ${a.ease === 'linear' ? 'selected' : ''}>${App.t('Gelijkmatig')}</option><option value="ease-in" ${a.ease === 'ease-in' ? 'selected' : ''}>${App.t('Vloeiend begin')}</option></select></label>
          <label class="field"><span>${App.t('Na animatie')}</span><select id="ad-after"><option value="none">${App.t('Niet dimmen')}</option><option value="dim" ${a.after && a.after.type === 'dim' ? 'selected' : ''}>${App.t('Dimmen')}</option><option value="hide" ${a.after && a.after.type === 'hide' ? 'selected' : ''}>${App.t('Verbergen na animatie')}</option><option value="hideClick" ${a.after && a.after.type === 'hideClick' ? 'selected' : ''}>${App.t('Verbergen bij volgende klik')}</option></select></label></div>
          <label class="field"><span>${App.t('Tekst animeren')}</span><select id="ad-by"><option value="all">${App.t('In één keer')}</option><option value="word" ${a.by === 'word' ? 'selected' : ''}>${App.t('Per woord')}</option><option value="letter" ${a.by === 'letter' ? 'selected' : ''}>${App.t('Per letter')}</option></select></label>
          <label class="field"><span>${App.t('Vertraging tussen woorden of letters (% van de duur)')}</span><input id="ad-bydelay" type="number" min="0" max="100" value="${Math.round((a.byDelay !== undefined ? a.byDelay : 0.1) * 100)}"></label>
        </div>
        <div id="ad-tim" hidden>
          <div class="fields-3"><label class="field"><span>${App.t('Begin')}</span><select id="ad-start"><option value="click">${App.t('Bij klikken')}</option><option value="with" ${a.start === 'with' ? 'selected' : ''}>${App.t('Met vorige')}</option><option value="after" ${a.start === 'after' ? 'selected' : ''}>${App.t('Na vorige')}</option></select></label>
          <label class="field"><span>${App.t('Vertraging (s)')}</span><input id="ad-delay" type="number" min="0" step="0.25" value="${a.delay || 0}"></label>
          <label class="field"><span>${App.t('Duur (s)')}</span><input id="ad-dur" type="number" min="0.01" step="0.25" value="${a.dur}"></label></div>
          <div class="fields-2"><label class="field"><span>${App.t('Herhalen')}</span><select id="ad-rep"><option value="1">${App.t('(geen)')}</option>${[2, 3, 4, 5, 10].map((n) => `<option value="${n}" ${a.rep === n ? 'selected' : ''}>${n}</option>`).join('')}<option value="next" ${a.rep === 'next' ? 'selected' : ''}>${App.t('Tot volgende klik')}</option><option value="end" ${a.rep === 'end' ? 'selected' : ''}>${App.t('Tot einde van dia')}</option></select></label>
          <label class="field"><span>&nbsp;</span><label class="chk"><input type="checkbox" id="ad-rew" ${a.rew ? 'checked' : ''}> ${App.t('Terugspoelen na afspelen')}</label></label></div>
        </div>
        <div id="ad-txt" hidden><div class="radio-list"><label><input type="radio" name="ad-seq" value="one" ${a.seq !== 'para' ? 'checked' : ''}> ${App.t('Als één object')}</label><label><input type="radio" name="ad-seq" value="para" ${a.seq === 'para' ? 'checked' : ''}> ${App.t('Per alinea op het eerste niveau')}</label></div></div>`,
      onOpen: (d) => { d.$('#ad-tabs').onclick = (e) => { const t = e.target.closest('[data-t]'); if (!t) return; d.$$('#ad-tabs button').forEach((x) => x.classList.toggle('on', x === t)); ['eff', 'tim', 'txt'].forEach((k) => { const el = d.$('#ad-' + k); if (el) el.hidden = k !== t.dataset.t; }); }; },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        App.run(() => selAnims().forEach((x) => {
          x.ease = d.$('#ad-ease').value; if (x.ease === 'ease-out') delete x.ease;
          const af = d.$('#ad-after').value; if (af === 'none') delete x.after; else x.after = { type: af, color: af === 'dim' ? '#9e9e9e' : undefined };
          const by = d.$('#ad-by').value; if (by === 'all') delete x.by; else x.by = by;
          x.byDelay = App.clamp((+d.$('#ad-bydelay').value || 10) / 100, 0, 1);
          x.start = d.$('#ad-start').value; x.delay = Math.max(0, +d.$('#ad-delay').value || 0); x.dur = Math.max(0.01, +d.$('#ad-dur').value || 0.5);
          const rep = d.$('#ad-rep').value; if (rep === '1') delete x.rep; else x.rep = /^\d+$/.test(rep) ? +rep : rep;
          if (d.$('#ad-rew').checked) x.rew = true; else delete x.rew;
          const seq = d.$('input[name="ad-seq"]:checked'); if (seq) { if (seq.value === 'para') x.seq = 'para'; else delete x.seq; }
        }));
      } }],
    });
  });

  /* ---------- Animatiedeelvenster ---------- */
  App.panes.register('anim', {
    title: 'Animatiedeelvenster',
    render(body) {
      const s = slide();
      const tl = App.Anim.build(s);
      const list = s.anims || [];
      // stapnummer en begintijd per animatie
      const info = new Map();
      tl.steps.forEach((step, si) => step.items.forEach((it) => { if (!info.has(it.a.id)) info.set(it.a.id, { step: si + (tl.steps[0] && tl.steps[0].auto ? 0 : 1), t0: it.t0, dur: it.dur, end: step.end }); }));
      Object.values(tl.trig).forEach((steps) => steps.forEach((step) => step.items.forEach((it) => { if (!info.has(it.a.id)) info.set(it.a.id, { trig: true, t0: it.t0, dur: it.dur, end: step.end }); })));
      const maxEnd = Math.max(1, ...[...info.values()].map((x) => x.end || 0));
      const sel = new Set(selAnims().map((a) => a.id));
      let lastStep = -1, trigHead = false;
      const rows = list.map((a, i) => {
        const o = App.obj(a.obj);
        const inf = info.get(a.id) || { step: 0, t0: 0, dur: a.dur };
        const nm = o ? o.name || o.type : App.t('(verwijderd object)');
        const txt = o && o.text ? App.plainText(o.text, ' ').trim().slice(0, 40) : '';
        let head = '';
        if (a.trig && !trigHead) { trigHead = true; head = `<div class="pl-row" style="cursor:default;font-weight:600"><span class="i">bolt</span><span class="grow">${App.t('Triggers')}</span></div>`; }
        const stepLbl = a.trig ? '' : inf.step !== lastStep ? (lastStep = inf.step, inf.step || '') : '';
        const icon = a.start === 'click' ? 'ads_click' : a.start === 'with' ? 'east' : 'schedule';
        return head + `<div class="pl-row${sel.has(a.id) ? ' on' : ''}" data-aid="${App.esc(a.id)}" draggable="true" title="${App.esc(App.t(a.start === 'click' ? 'Bij klikken' : a.start === 'with' ? 'Met vorige' : 'Na vorige'))}">
          <span class="step">${stepLbl}</span><span class="i ai ${a.cls}" style="font-size:16px">${icon}</span><span class="i ai ${a.cls}">${a.cls === 'path' ? 'route' : App.EFFECT_ICONS[a.eff] || 'star'}</span>
          <span class="grow anim-name">${App.esc(nm)}${txt && txt !== nm ? ': ' + App.esc(txt) : ''}${a.seq === 'para' ? ' ¶' : ''}</span>
          <span class="tl"><i class="${a.cls}" style="left:${App.round(inf.t0 / maxEnd * 100, 1)}%;width:${Math.max(4, App.round(inf.dur / maxEnd * 100, 1))}%"></i></span>
          <button class="qb" data-amenu="${App.esc(a.id)}" title="${App.esc(App.t('Opties'))}"><span class="i">arrow_drop_down</span></button></div>`;
        void i;
      }).join('');
      body.innerHTML = `<div class="pane-actions"><button class="btn small" data-aplay="sel"><span class="i">play_arrow</span> ${App.t(sel.size ? 'Afspelen vanaf' : 'Alles afspelen')}</button><span style="flex:1"></span><button class="qb" data-amove="-1" title="${App.esc(App.t('Eerder'))}"><span class="i">arrow_upward</span></button><button class="qb" data-amove="1" title="${App.esc(App.t('Later'))}"><span class="i">arrow_downward</span></button></div>
        <div class="pane-list">${rows || `<div class="pane-empty">${App.t('Deze dia heeft nog geen animaties. Selecteer een object en kies een effect op het tabblad Animaties.')}</div>`}</div>
        ${list.length ? `<p class="muted small" style="padding:8px 12px;line-height:1.45">${App.t('Sleep om de volgorde te wijzigen. Dubbelklik voor alle opties. De balkjes tonen wanneer elk effect speelt binnen zijn stap.')}</p>` : ''}`;
    },
  });
  const paneEl = $('#pane');
  paneEl.addEventListener('click', (e) => {
    if (App.state.pane !== 'anim') return;
    const play = e.target.closest('[data-aplay]'); if (play) { App.exec('previewAnims', selAnims().length ? 'from' : 'all'); return; }
    const mv = e.target.closest('[data-amove]'); if (mv) { App.exec('animMove', mv.dataset.amove); App.panes.refresh(true); return; }
    const m = e.target.closest('[data-amenu]');
    if (m) {
      e.stopPropagation();
      st.animSel = [m.dataset.amenu];
      const it = (cmd, arg, l) => `<button data-cmd="${cmd}" data-arg="${arg}">${App.esc(App.t(l))}</button>`;
      App.openPopup(m, [it('animStart', 'click', 'Bij klikken starten'), it('animStart', 'with', 'Met vorige starten'), it('animStart', 'after', 'Na vorige starten'), '<hr>', it('animDialog', '', 'Effectopties…'), it('animDialog', '', 'Timing…'), '<hr>', it('animRemove', '', 'Verwijderen')].join(''));
      return;
    }
    const row = e.target.closest('[data-aid]');
    if (row) {
      const s = slide(); const a = s.anims.find((x) => x.id === row.dataset.aid);
      if (e.ctrlKey || e.shiftKey) st.animSel = [...new Set([...(st.animSel || []), a.id])]; else st.animSel = [a.id];
      st._animPaneClick = true;
      App.select([a.obj], { keepGroup: true });
      App.panes.refresh(true);
    }
  });
  paneEl.addEventListener('dblclick', (e) => { if (App.state.pane === 'anim' && e.target.closest('[data-aid]')) App.exec('animDialog'); });
  let dragA = null;
  paneEl.addEventListener('dragstart', (e) => { const r = e.target.closest('[data-aid]'); if (r && App.state.pane === 'anim') dragA = r.dataset.aid; });
  paneEl.addEventListener('dragover', (e) => { if (!dragA) return; e.preventDefault(); paneEl.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); const r = e.target.closest('[data-aid]'); if (r) r.classList.add('drag-over'); });
  paneEl.addEventListener('drop', (e) => {
    if (!dragA) return; e.preventDefault();
    const r = e.target.closest('[data-aid]'); const id = dragA; dragA = null;
    if (!r || r.dataset.aid === id) return;
    App.run(() => { const s = slide(); const i = s.anims.findIndex((a) => a.id === id); const [a] = s.anims.splice(i, 1); const j = s.anims.findIndex((x) => x.id === r.dataset.aid); s.anims.splice(j, 0, a); });
    App.panes.refresh(true);
  });
  App.on('change', () => { if (App.state.pane === 'anim') App.panes.refresh(); });

  /* ---------- Voorbeeld op het werkvlak ---------- */
  let preview = null;
  App.stopPreview = () => { if (preview) { preview.stop(); preview = null; } $$('#stage-slide .preview-layer').forEach((x) => x.remove()); };
  App.def('previewAnims', (mode) => {
    App.stopPreview();
    if (App.state.edit) App.textEdit.stop();
    const s = slide();
    const host = $('#stage-slide');
    const sl = App.renderSlide(s, { mode: 'preview', split: 'letter' });
    sl.classList.add('preview-layer');
    sl.style.cssText += `;position:absolute;left:0;top:0;transform:scale(${App.zoom()});transform-origin:0 0;z-index:5`;
    host.appendChild(sl);
    const player = new App.Anim.Player(sl, s);
    let cancelled = false;
    preview = { stop: () => { cancelled = true; player.stop(); sl.remove(); } };
    // vanaf de geselecteerde animatie: eerdere stappen meteen afronden
    if (mode === 'from') {
      const first = selAnims()[0];
      const idx = player.tl.steps.findIndex((stp) => stp.items.some((it) => it.a.id === first.id));
      for (let k = 0; k < idx; k++) { player.next(); player.finishRunning(); }
    }
    const runNext = () => {
      if (cancelled) return;
      if (!player.next()) { setTimeout(() => { if (!cancelled) App.stopPreview(); }, 600); return; }
      const step = player.tl.steps[player.step - 1];
      setTimeout(runNext, Math.min(15000, (step ? step.end : 0.5) * 1000 + 350));
    };
    player.autoStart();
    const first = player.tl.steps[0];
    setTimeout(runNext, first && first.auto ? first.end * 1000 + 300 : 50);
  });
  App.previewSoon = App.debounce(() => { if (App.settings.autoPreview !== false && App.activeTab === 'animations') App.exec('previewAnims', 'from'); }, 150);
  document.addEventListener('mousedown', (e) => { if (preview && e.target.closest('#stage')) App.stopPreview(); }, true);
})();
