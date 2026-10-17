/* =========================================================
   Doek (gemaakt door JJ van Schelven) — diavoorstelling: volledig scherm,
   toetsenbord en muis, animaties en overgangen, koppelingen en triggers, media,
   pen, markeerstift, gum en laserpointer (inkt blijft bewaard), zwart/wit scherm,
   overzicht, naar dia nummer, timings, repeteren en opnemen
   ========================================================= */
'use strict';

(() => {
  const root = $('#show');
  let S = null;   // toestand van de lopende voorstelling

  /* ---------- Afspeellijst ---------- */
  const playlist = (opts) => {
    const P = App.pres;
    if (opts.custom) { const cs = P.shows.find((x) => x.id === opts.custom); if (cs) return cs.slides.map((id) => App.slideIndex(id)).filter((i) => i >= 0); }
    let idx = P.slides.map((s, i) => i);
    if (P.show && P.show.range) idx = idx.filter((i) => i >= P.show.range.from - 1 && i <= P.show.range.to - 1);
    return idx.filter((i) => !P.slides[i].hidden || opts.includeHidden);
  };

  /* ---------- Starten en stoppen ---------- */
  App.startShow = async (from = 0, opts = {}) => {
    const P = App.pres;
    if (App.state.edit) App.textEdit.stop();
    App.closePopup && App.closePopup();
    App.stopPreview && App.stopPreview();
    App.history.flush();
    const list = playlist(opts);
    if (!list.length) { App.toast(App.t('Er zijn geen dia\'s om te tonen (alle dia\'s zijn verborgen).'), 'info'); return; }
    let pos = list.indexOf(from);
    if (pos < 0) { pos = list.findIndex((i) => i >= from); if (pos < 0) pos = 0; }
    S = { list, pos, opts, ink: new Map(), tool: 'none', penColor: (P.show && P.show.pen) || '#e5484d', laserColor: (P.show && P.show.laser) || '#ff2020', history: [], times: [], t0: performance.now(), slideT0: performance.now(), paused: false, kiosk: P.show && P.show.type === 'kiosk', loop: !!(P.show && (P.show.loop || P.show.type === 'kiosk')), rec: opts.record ? { slides: {} } : null };
    root.hidden = false;
    root.innerHTML = `<div class="stage"></div><svg class="ink-layer"></svg><div class="laser"></div><div class="blank"></div><div class="end-msg"><span>${App.t('Einde van diavoorstelling, klik om af te sluiten.')}</span></div>
      <div class="ctrl"><button data-sc="prev" title="${App.esc(App.t('Vorige'))}"><span class="i">arrow_back</span></button><button data-sc="next" title="${App.esc(App.t('Volgende'))}"><span class="i">arrow_forward</span></button><button data-sc="pen" title="${App.esc(App.t('Pen en laserpointer'))}"><span class="i">edit</span></button><button data-sc="ov" title="${App.esc(App.t('Alle dia\'s weergeven'))}"><span class="i">grid_view</span></button><button data-sc="more" title="${App.esc(App.t('Meer opties'))}"><span class="i">more_horiz</span></button></div>
      <div class="ov"><div class="ov-grid"></div></div><div class="goto"></div>`;
    S.stage = root.querySelector('.stage'); S.inkSvg = root.querySelector('.ink-layer'); S.laser = root.querySelector('.laser'); S.blank = root.querySelector('.blank'); S.end = root.querySelector('.end-msg');
    if (!opts.noFullscreen && !App.isAudience) { try { await (root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : Promise.resolve()); } catch { /* venster blijft */ } }
    fit();
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey, true);
    if (opts.rehearse || opts.record) startRehearse();
    if (opts.record) await startRecording();
    App.emit('show', 'start');
    await showSlide(pos, { trans: false });
    hideCursorSoon();
  };
  App.closeShow = (keepInk) => {
    if (!S) return;
    const s = S; S = null;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
    if (s.player) s.player.stop();
    stopMedia(s);
    if (s.rec && s.rec.media) { try { s.rec.media.stop(); } catch { /* niets */ } }
    clearTimeout(s.autoTimer); clearInterval(s.rehTimer);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    root.hidden = true; root.innerHTML = '';
    document.body.classList.remove('show-on');
    App.emit('show', 'end');
    if (s.rehearse) finishRehearse(s);
    // inkt bewaren?
    const inked = [...s.ink.entries()].filter(([, strokes]) => strokes.length);
    if (inked.length && keepInk !== false && !App.isAudience) {
      App.confirm(App.t('Inkt bewaren'), App.t('Wil je je inktaantekeningen behouden?'), App.t('Behouden')).then((ok) => { if (ok) App.run(() => inked.forEach(([id, strokes]) => addInk(id, strokes)), { all: true }); App.thumbs && App.thumbs.refresh(true); });
    }
    if (!App.isAudience) { App.gotoSlide(App.clamp(s.list[Math.min(s.pos, s.list.length - 1)] || 0, 0, App.pres.slides.length - 1)); App.focusStage(); }
  };
  App.showActive = () => !!S;
  App.showState = () => S;
  const addInk = (slideId, strokes) => {
    const s = App.slideById(slideId); if (!s) return;
    const P = App.pres;
    s.objs.push({ id: App.uid('o'), type: 'ink', name: App.t('Inkt'), x: 0, y: 0, w: P.size.w, h: P.size.h, cw: P.size.w, ch: P.size.h, strokes: strokes.map((st) => ({ ...st, pts: st.pts.map((p) => [App.round(p[0], 1), App.round(p[1], 1), p[2] || 0.5]) })) });
    App.touch(s);
  };
  const fit = () => {
    if (!S) return;
    const P = App.pres;
    const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
    const z = Math.min(W / P.size.w, H / P.size.h);
    S.z = z; S.ox = (W - P.size.w * z) / 2; S.oy = (H - P.size.h * z) / 2;
    const css = `left:${S.ox}px;top:${S.oy}px;width:${P.size.w}px;height:${P.size.h}px;transform:scale(${z});transform-origin:0 0`;
    S.stage.style.cssText = css + ';overflow:hidden;background:#000';
    S.inkSvg.setAttribute('viewBox', `0 0 ${P.size.w} ${P.size.h}`);
    S.inkSvg.style.cssText = `left:${S.ox}px;top:${S.oy}px;width:${P.size.w * z}px;height:${P.size.h * z}px`;
  };

  /* ---------- Dia tonen ---------- */
  const splitFor = (slide) => (o) => { const a = (slide.anims || []).find((x) => x.obj === o.id && x.by && x.by !== 'all'); return a ? a.by : null; };
  const renderFor = (slide) => {
    const el = App.renderSlide(slide, { mode: 'show', split: splitFor(slide), num: App.slideIndex(slide.id) + 1 });
    el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0';
    return el;
  };
  const showSlide = async (pos, o = {}) => {
    const P = App.pres;
    if (!S) return;
    clearTimeout(S.autoTimer);
    S.end.classList.remove('on');
    if (S.player) S.player.stop();
    stopMedia(S);
    const idx = S.list[pos];
    const slide = P.slides[idx];
    if (!slide) return;
    if (S.rehearse && S.cur !== undefined && S.cur !== idx) S.times[S.cur] = (S.times[S.cur] || 0) + (performance.now() - S.slideT0) / 1000;
    if (S.rec && S.cur !== undefined && S.cur !== idx) await recSlideDone(S.cur);
    const prevEl = S.stage.querySelector('.sl');
    const prevSlide = S.cur !== undefined ? P.slides[S.cur] : null;
    S.pos = pos; S.cur = idx; S.slideT0 = performance.now();
    const el = renderFor(slide);
    S.el = el;
    S.player = new App.Anim.Player(el, slide, { rate: 1 });
    const media = prepMedia(el, slide);
    S.media = media;
    if (o.end) S.player.finishAll();
    drawInk();
    App.emit('show', 'slide', { idx, step: 0 });
    if (o.trans !== false && prevEl && slide.trans && slide.trans.type && slide.trans.type !== 'none' && !o.end) {
      S.transitioning = true;
      if (slide.trans.sound) App.playSound && App.playSound(slide.trans.sound);
      await App.Trans.play(S.stage, prevEl, el, slide.trans, { oldSlide: prevSlide, newSlide: slide, index: idx });
      S.transitioning = false;
    } else { S.stage.replaceChildren(el); }
    if (!S || S.el !== el) return;
    if (!o.end) S.player.autoStart();
    media.filter((m) => m.o.play === 'auto').forEach((m) => playMedia(m));
    scheduleAuto(slide);
    if (S.rec) recSlideStart(idx);
    App.emit('show', 'shown', { idx });
  };
  // automatisch verder na x seconden (timings)
  const scheduleAuto = (slide) => {
    clearTimeout(S.autoTimer);
    const P = App.pres;
    if (S.paused || S.rehearse) return;
    const t = slide.trans && slide.trans.after;
    if (t === undefined || t === null || !(P.show.timings !== false)) { if (S.kiosk) S.autoTimer = setTimeout(() => next(), 5000); return; }
    const remaining = S.player.remaining();
    const per = remaining ? Math.max(0.2, t / (remaining + 1)) : t;
    S.autoTimer = setTimeout(() => { if (!S) return; next(true); if (S && S.player.remaining() >= 0) scheduleAuto(slide); }, per * 1000);
  };

  /* ---------- Vooruit en terug ---------- */
  const next = async (auto) => {
    if (!S) return;
    if (S.end.classList.contains('on')) { App.closeShow(); return; }
    if (S.transitioning) return;
    // eerst media 'in klikvolgorde'
    const seqMedia = (S.media || []).find((m) => m.o.play === 'seq' && !m.played);
    if (seqMedia && !S.player.remaining()) { playMedia(seqMedia); return; }
    if (S.player.next()) { App.emit('show', 'step', { idx: S.cur, step: S.player.step }); return; }
    if (S.zoomRet && S.cur === S.zoomRet.last) { const back = S.zoomRet.back; S.zoomRet = null; await showSlide(back); return; }
    if (S.pos < S.list.length - 1) { S.history.push(S.pos); await showSlide(S.pos + 1); }
    else if (S.loop) { await showSlide(0); }
    else if (!auto || true) { endScreen(); }
  };
  const prev = async () => {
    if (!S || S.transitioning) return;
    if (S.end.classList.contains('on')) { S.end.classList.remove('on'); return; }
    if (S.player.prev()) { App.emit('show', 'step', { idx: S.cur, step: S.player.step }); return; }
    if (S.pos > 0) await showSlide(S.pos - 1, { trans: false, end: true });
  };
  const gotoIndex = async (slideIdx, o = {}) => {
    if (!S) return;
    let pos = S.list.indexOf(slideIdx);
    if (pos < 0) { S.list.splice(S.pos + 1, 0, slideIdx); pos = S.pos + 1; }   // verborgen dia via koppeling
    S.history.push(S.pos);
    await showSlide(pos, o);
  };
  const endScreen = () => {
    if (!S) return;
    if (S.opts.noEndScreen) { App.closeShow(); return; }
    S.end.classList.add('on');
    App.emit('show', 'endscreen');
  };
  App.showNext = () => next(); App.showPrev = () => prev(); App.showGoto = (i) => gotoIndex(i);

  /* ---------- Media ---------- */
  const prepMedia = (el, slide) => {
    const out = [];
    slide.objs.forEach((o) => {
      if (o.type !== 'video' && o.type !== 'audio') return;
      const ob = el.querySelector(`.ob[data-id="${CSS.escape(o.id)}"]`); if (!ob) return;
      const m = ob.querySelector('video, audio'); if (!m) return;
      const start = o.trim ? o.trim.start || 0 : 0;
      try { m.currentTime = start; } catch { /* niets */ }
      if (o.loop) m.loop = true;
      if (o.hide) ob.style.visibility = 'hidden';
      const rec = { o, el: m, ob, played: false };
      m.addEventListener('timeupdate', () => {
        const end = o.trim && o.trim.end ? o.trim.end : (m.duration || Infinity);
        if (o.fade && o.fade.out && end - m.currentTime < o.fade.out) m.volume = App.clamp((end - m.currentTime) / o.fade.out, 0, 1) * (o.vol === undefined ? 1 : o.vol);
        if (o.fade && o.fade.in && m.currentTime - start < o.fade.in) m.volume = App.clamp((m.currentTime - start) / o.fade.in, 0, 1) * (o.vol === undefined ? 1 : o.vol);
        if (m.currentTime >= end - 0.03) { if (o.loop) m.currentTime = start; else { m.pause(); if (o.rewind) m.currentTime = start; if (o.hide) ob.style.visibility = 'hidden'; } }
        // bladwijzers als trigger
        (o.marks || []).forEach((k) => { if (!rec['m' + k.name] && m.currentTime >= k.t) { rec['m' + k.name] = 1; S && S.player && S.player.trigger('mark:' + o.id + ':' + k.name); } });
      });
      out.push(rec);
    });
    return out;
  };
  const playMedia = (rec) => { rec.played = true; rec.ob.style.visibility = ''; if (rec.o.full) { try { rec.el.requestFullscreen(); } catch { /* niets */ } } rec.el.play().catch(() => {}); };
  const stopMedia = (s) => { (s && s.media || []).forEach((m) => { try { m.el.pause(); } catch { /* niets */ } }); };
  App.playSound = (id) => { const u = App.mediaUrl(id); if (!u) return; const a = new Audio(u); a.play().catch(() => {}); };

  /* ---------- Muis ---------- */
  root.addEventListener('click', (e) => {
    if (!S) return;
    if (e.target.closest('.ctrl')) { const b = e.target.closest('[data-sc]'); if (b) ctrl(b.dataset.sc, b); return; }
    if (e.target.closest('.ov')) { const it = e.target.closest('[data-ov]'); if (it) { closeOverview(); gotoIndex(+it.dataset.ov, { trans: false }); } else closeOverview(); return; }
    if (S.tool === 'pen' || S.tool === 'hl' || S.tool === 'erase') return;
    if (S.blank.className !== 'blank') { setBlank(''); return; }
    // koppeling of trigger op een object
    const ob = e.target.closest('.ob');
    if (ob && S.el && S.el.contains(ob)) {
      const id = ob.dataset.id;
      const linkEl = e.target.closest('[data-link]');
      if (linkEl) { const run = findRun(id, linkEl); if (run && run.link) { followLink(run.link); return; } }
      const o = App.findObj(id, App.pres.slides[S.cur].objs);
      if (o && o.obj.link) { followLink(o.obj.link); return; }
      if (o && o.obj.type === 'zoom' && o.obj.slide) { followZoom(o.obj); return; }
      if (S.player.hasTrigger(id)) { S.player.trigger('obj:' + id); return; }
      const m = (S.media || []).find((x) => x.o.id === id);
      if (m) { if (m.el.paused) playMedia(m); else m.el.pause(); return; }
    }
    if (S.kiosk) return;
    next();
  });
  root.addEventListener('contextmenu', (e) => {
    if (!S) return;
    e.preventDefault();
    const it = (k, ic, l, kbd) => `<button data-sm="${k}"><span class="i">${ic}</span> ${App.esc(App.t(l))}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;
    const m = App.openPopup({ x: e.clientX, y: e.clientY }, [it('next', 'arrow_forward', 'Volgende', 'N'), it('prev', 'arrow_back', 'Vorige', 'P'), it('ov', 'grid_view', 'Alle dia\'s weergeven', 'G'), '<hr>', it('pen', 'edit', 'Pen', 'Ctrl+P'), it('hl', 'ink_highlighter', 'Markeerstift', 'Ctrl+I'), it('laser', 'my_location', 'Laserpointer', 'Ctrl+L'), it('erase', 'ink_eraser', 'Gum', 'Ctrl+E'), it('clear', 'delete_sweep', 'Alle inkt op de dia wissen', 'E'), it('arrow', 'arrow_selector_tool', 'Pijl', 'Ctrl+A'), '<hr>', it('black', 'rectangle', 'Zwart scherm', 'B'), it('white', 'crop_square', 'Wit scherm', 'W'), it('pause', S.paused ? 'play_arrow' : 'pause', S.paused ? 'Hervatten' : 'Onderbreken', 'S'), '<hr>', it('end', 'close', 'Voorstelling beëindigen', 'Esc')].join(''), 'ctx-menu');
    m.style.zIndex = 300;
    m.onclick = (ev) => { const b = ev.target.closest('[data-sm]'); if (!b) return; App.closePopup(); ctrl(b.dataset.sm); };
  });
  root.addEventListener('wheel', (e) => { if (!S || S.ovOpen) return; if (e.deltaY > 0) next(); else if (e.deltaY < 0) prev(); }, { passive: true });
  const findRun = (objId, span) => {
    const o = App.findObj(objId, App.pres.slides[S.cur].objs); if (!o || !o.obj.text) return null;
    const pEl = span.closest('.pa'); const p = o.obj.text.paras[+pEl.dataset.p]; if (!p) return null;
    return p.runs[+span.dataset.r] || null;
  };
  const followLink = (l) => {
    const P = App.pres;
    if (l.kind === 'url') { App.openLink(l.url); return; }
    if (l.kind === 'slide') { const i = App.slideIndex(l.slide); if (i >= 0) gotoIndex(i); return; }
    if (l.kind === 'first') { gotoIndex(S.list[0]); return; }
    if (l.kind === 'last') { gotoIndex(S.list[S.list.length - 1]); return; }
    if (l.kind === 'next') { if (S.pos < S.list.length - 1) showSlide(S.pos + 1); else endScreen(); return; }
    if (l.kind === 'prev') { if (S.pos > 0) showSlide(S.pos - 1); return; }
    if (l.kind === 'lastViewed') { const p = S.history.pop(); if (p !== undefined) showSlide(p); return; }
    if (l.kind === 'end') { App.closeShow(); return; }
    if (l.kind === 'show') { const cs = P.shows.find((x) => x.id === l.show); if (cs) { const list = cs.slides.map((id) => App.slideIndex(id)).filter((i) => i >= 0); if (list.length) { S.list = list; showSlide(0); } } }
  };
  const followZoom = (z) => {
    const P = App.pres;
    let i = App.slideIndex(z.slide);
    let last = i;
    // sectiezoom: alle dia's van de sectie, daarna terug
    if (z.sec) { const idx = P.slides.map((s, k) => (s.sec === z.sec ? k : -1)).filter((k) => k >= 0); if (idx.length) { i = idx[0]; last = idx[idx.length - 1]; } }
    if (i < 0) return;
    if (z.ret !== false) S.zoomRet = { back: S.pos, last };
    gotoIndex(i);
  };
  // actie bij aanwijzen met de muis (eenmaal per keer dat de muis het object binnenkomt)
  root.addEventListener('mouseover', (e) => {
    if (!S || !S.el) return;
    const ob = e.target.closest('.ob');
    if (!ob || !S.el.contains(ob) || ob === S.hoverOb) { if (!ob) S.hoverOb = null; return; }
    S.hoverOb = ob;
    const f = App.findObj(ob.dataset.id, App.pres.slides[S.cur].objs);
    if (f && f.obj.hover) followLink(f.obj.hover);
  });
  App.openLink = App.openLink || ((href) => {
    let u; try { u = new URL(href, location.href); } catch { return; }
    if (!/^(https?|mailto):$/.test(u.protocol)) { App.toast(App.t('Deze koppeling kan om veiligheidsredenen niet worden geopend.'), 'block'); return; }
    window.open(u.href, '_blank', 'noopener');
  });
  // cursor verbergen na een paar seconden stilstand
  let curTimer = 0;
  const hideCursorSoon = () => { if (!S) return; root.classList.remove('hide-cursor'); clearTimeout(curTimer); curTimer = setTimeout(() => { if (S && S.tool === 'none') root.classList.add('hide-cursor'); }, 3000); };
  root.addEventListener('mousemove', (e) => {
    if (!S) return;
    hideCursorSoon();
    if (S.tool === 'laser' || S.laserHold) { S.laser.style.left = e.clientX + 'px'; S.laser.style.top = e.clientY + 'px'; App.emit('show', 'laser', toSlidePt(e)); }
  });

  /* ---------- Bedieningsknoppen en menu's ---------- */
  const ctrl = (k, btn) => {
    if (k === 'next') next(); else if (k === 'prev') prev();
    else if (k === 'ov') openOverview();
    else if (k === 'pen' && btn) penMenu(btn);
    else if (k === 'pen' || k === 'hl' || k === 'laser' || k === 'erase' || k === 'arrow') setTool(k === 'arrow' ? 'none' : k);
    else if (k === 'clear') { S.ink.set(App.pres.slides[S.cur].id, []); drawInk(); App.emit('show', 'ink'); }
    else if (k === 'black') setBlank('black'); else if (k === 'white') setBlank('white');
    else if (k === 'pause') { S.paused = !S.paused; if (S.paused) { clearTimeout(S.autoTimer); S.player.pause(); } else { S.player.resume(); scheduleAuto(App.pres.slides[S.cur]); } }
    else if (k === 'more') { const r = btn.getBoundingClientRect(); root.dispatchEvent(new MouseEvent('contextmenu', { clientX: r.left, clientY: r.top - 10, bubbles: true })); }
    else if (k === 'end') App.closeShow();
  };
  const penMenu = (btn) => {
    const colors = ['#e5484d', '#2f6fde', '#2fa36b', '#f4c430', '#000000', '#ffffff', '#a02b93', '#f28c28'];
    const m = App.openPopup(btn, `<button data-pt="laser"><span class="i">my_location</span> ${App.t('Laserpointer')}</button><button data-pt="pen"><span class="i">edit</span> ${App.t('Pen')}</button><button data-pt="hl"><span class="i">ink_highlighter</span> ${App.t('Markeerstift')}</button><button data-pt="erase"><span class="i">ink_eraser</span> ${App.t('Gum')}</button><button data-pt="clear"><span class="i">delete_sweep</span> ${App.t('Alle inkt op de dia wissen')}</button><hr><div style="display:flex;gap:4px;padding:4px 8px">${colors.map((c) => `<button data-pc="${c}" style="width:22px;height:22px;border-radius:50%;border:1px solid #999;background:${c};padding:0"></button>`).join('')}</div>`);
    m.style.zIndex = 300;
    m.onclick = (e) => { const t = e.target.closest('[data-pt]'), c = e.target.closest('[data-pc]'); if (t) { App.closePopup(); if (t.dataset.pt === 'clear') ctrl('clear'); else setTool(t.dataset.pt); } if (c) { S.penColor = c.dataset.pc; App.closePopup(); setTool('pen'); } };
  };
  const setTool = (t) => {
    if (!S) return;
    S.tool = S.tool === t ? 'none' : t;
    root.classList.toggle('pen-on', S.tool === 'pen' || S.tool === 'hl' || S.tool === 'erase');
    root.classList.toggle('laser-on', S.tool === 'laser');
    S.laser.style.background = '';
    root.classList.remove('hide-cursor');
  };
  const setBlank = (k) => { if (!S) return; S.blank.className = 'blank' + (k && !S.blank.classList.contains(k) ? ' ' + k : ''); App.emit('show', 'blank', S.blank.className.replace('blank', '').trim()); };
  App.showTool = setTool; App.showBlank = setBlank;

  /* ---------- Inkt ---------- */
  const toSlidePt = (e) => ({ x: (e.clientX - S.ox) / S.z, y: (e.clientY - S.oy) / S.z });
  const drawInk = () => {
    if (!S) return;
    const strokes = S.ink.get(App.pres.slides[S.cur] && App.pres.slides[S.cur].id) || [];
    S.inkSvg.innerHTML = strokes.map((s, i) => `<path data-k="${i}" d="${App.strokePath(s.pts)}" fill="none" stroke="${App.esc(s.color)}" stroke-width="${s.w}" stroke-linecap="${s.hl ? 'square' : 'round'}" stroke-linejoin="round" ${s.hl ? 'stroke-opacity=".45" style="mix-blend-mode:multiply"' : ''}/>`).join('');
  };
  App.showDrawInk = drawInk;
  S && drawInk();
  root.addEventListener('mousedown', (e) => {
    if (!S || e.button !== 0) return;
    if (e.ctrlKey && S.tool === 'none') { S.laserHold = true; root.classList.add('laser-on'); return; }
    if (S.tool !== 'pen' && S.tool !== 'hl' && S.tool !== 'erase') return;
    e.preventDefault(); e.stopPropagation();
    const id = App.pres.slides[S.cur].id;
    if (!S.ink.has(id)) S.ink.set(id, (App.pres.slides[S.cur].objs.filter((o) => o.type === 'ink').length ? [] : []));
    const list = S.ink.get(id);
    if (S.tool === 'erase') {
      const er = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); const k = t && t.closest && t.closest('.ink-layer path'); if (k) { list.splice(+k.dataset.k, 1); drawInk(); App.emit('show', 'ink'); } };
      er(e);
      const up = () => { document.removeEventListener('mousemove', er); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', er); document.addEventListener('mouseup', up);
      return;
    }
    const st = { pts: [[toSlidePt(e).x, toSlidePt(e).y, 0.5]], color: S.tool === 'hl' ? '#ffd23f' : S.penColor, w: S.tool === 'hl' ? 18 : 3, hl: S.tool === 'hl' || undefined, t: [performance.now() - S.slideT0] };
    list.push(st);
    const mv = (ev) => { const p = toSlidePt(ev); st.pts.push([p.x, p.y, ev.pressure || 0.5]); st.t.push(performance.now() - S.slideT0); drawInk(); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); App.emit('show', 'ink'); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  }, true);
  document.addEventListener('mouseup', () => { if (S && S.laserHold) { S.laserHold = false; root.classList.remove('laser-on'); } });

  /* ---------- Overzicht en naar dia nummer ---------- */
  const openOverview = () => {
    const ov = root.querySelector('.ov'); const grid = ov.querySelector('.ov-grid');
    grid.innerHTML = '';
    App.pres.slides.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'ov-item' + (i === S.cur ? ' cur' : ''); d.dataset.ov = i;
      d.appendChild(App.slideThumb(s, 220));
      const l = document.createElement('div'); l.textContent = (i + 1) + (s.hidden ? ' (' + App.t('verborgen') + ')' : '') + ' · ' + App.slideTitle(s); l.style.marginTop = '4px';
      d.appendChild(l);
      grid.appendChild(d);
    });
    ov.classList.add('on'); S.ovOpen = true;
  };
  const closeOverview = () => { root.querySelector('.ov').classList.remove('on'); S.ovOpen = false; };
  let gotoBuf = '';
  const gotoEl = () => root.querySelector('.goto');

  /* ---------- Toetsenbord ---------- */
  const onKey = (e) => {
    if (!S) return;
    if ($('.backdrop')) return;
    const k = e.key, ctrlK = e.ctrlKey || e.metaKey;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (S.ovOpen) { if (k === 'Escape' || k === 'g' || k === '-') { stop(); closeOverview(); } return; }
    if (/^\d$/.test(k)) { stop(); gotoBuf += k; gotoEl().textContent = gotoBuf; gotoEl().classList.add('on'); return; }
    if (k === 'Enter' && gotoBuf) { stop(); const n = +gotoBuf; gotoBuf = ''; gotoEl().classList.remove('on'); if (n >= 1 && n <= App.pres.slides.length) gotoIndex(n - 1, { trans: false }); return; }
    if (gotoBuf && k !== 'Backspace') { gotoBuf = ''; gotoEl().classList.remove('on'); }
    if (ctrlK && k.toLowerCase() === 'p') { stop(); setTool('pen'); return; }
    if (ctrlK && k.toLowerCase() === 'i') { stop(); setTool('hl'); return; }
    if (ctrlK && k.toLowerCase() === 'l') { stop(); setTool('laser'); return; }
    if (ctrlK && k.toLowerCase() === 'e') { stop(); setTool('erase'); return; }
    if (ctrlK && k.toLowerCase() === 'a') { stop(); setTool('none'); return; }
    if (ctrlK && k.toLowerCase() === 'm') { stop(); S.inkSvg.style.visibility = S.inkSvg.style.visibility === 'hidden' ? '' : 'hidden'; return; }
    if (ctrlK && k.toLowerCase() === 'h') { stop(); root.classList.add('hide-cursor'); return; }
    if (k === 'Escape') { stop(); if (S.tool !== 'none') { setTool('none'); return; } if (S.blank.className !== 'blank') { setBlank(''); return; } App.closeShow(); return; }
    if (S.kiosk && !/^(Escape)$/.test(k)) { stop(); return; }
    if ([' ', 'n', 'N', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(k)) { stop(); if (S.blank.className !== 'blank') { setBlank(''); return; } next(); return; }
    if (['Backspace', 'p', 'P', 'ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) { stop(); prev(); return; }
    if (k === 'Home') { stop(); gotoIndex(S.list[0], { trans: false }); return; }
    if (k === 'End') { stop(); gotoIndex(S.list[S.list.length - 1], { trans: false }); return; }
    if (k === 'b' || k === 'B' || k === '.') { stop(); setBlank('black'); return; }
    if (k === 'w' || k === 'W' || k === ',') { stop(); setBlank('white'); return; }
    if (k === 'e' || k === 'E') { stop(); ctrl('clear'); return; }
    if (k === 'g' || k === 'G' || k === '-') { stop(); openOverview(); return; }
    if (k === 's' || k === 'S' || k === '+') { stop(); ctrl('pause'); return; }
    if (k === 'h' || k === 'H') { stop(); const nextHidden = App.pres.slides.findIndex((s, i) => i > S.cur && s.hidden); if (nextHidden >= 0) gotoIndex(nextHidden); return; }
    if (k === 'F1') { stop(); App.exec('showShortcuts'); return; }
    if (k === 'F5') { stop(); return; }
    if (k === 'Tab') { stop(); return; }
  };

  /* ---------- Timings repeteren ---------- */
  const startRehearse = () => {
    S.rehearse = true; S.times = [];
    const bar = document.createElement('div');
    bar.className = 'rehearse-bar';
    bar.innerHTML = `${S.opts.record ? '<span class="rec-dot"></span>' : ''}<button data-rh="next" title="${App.esc(App.t('Volgende'))}"><span class="i">arrow_forward</span></button><button data-rh="pause" title="${App.esc(App.t('Onderbreken'))}"><span class="i">pause</span></button><span class="t" data-rh-slide>0:00:00</span><button data-rh="redo" title="${App.esc(App.t('Opnieuw'))}"><span class="i">replay</span></button><span class="t" data-rh-total style="background:transparent;border:0">0:00:00</span>`;
    root.appendChild(bar);
    const fmtT = (s) => { s = Math.floor(s); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    let pausedAt = 0, pausedTotal = 0;
    S.rehTimer = setInterval(() => {
      if (!S) return;
      const now = performance.now() - (pausedAt ? performance.now() - pausedAt : 0);
      bar.querySelector('[data-rh-slide]').textContent = fmtT((now - S.slideT0) / 1000);
      bar.querySelector('[data-rh-total]').textContent = fmtT((now - S.t0 - pausedTotal) / 1000);
    }, 250);
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-rh]'); if (!b) return;
      if (b.dataset.rh === 'next') next();
      if (b.dataset.rh === 'pause') { if (pausedAt) { const d = performance.now() - pausedAt; S.slideT0 += d; pausedTotal += d; pausedAt = 0; } else pausedAt = performance.now(); }
      if (b.dataset.rh === 'redo') S.slideT0 = performance.now();
    });
  };
  const finishRehearse = (s) => {
    if (s.cur !== undefined) s.times[s.cur] = (s.times[s.cur] || 0) + (performance.now() - s.slideT0) / 1000;
    const total = s.times.reduce((a, b) => a + (b || 0), 0);
    if (!total) return;
    const m = Math.floor(total / 60), sec = Math.round(total % 60);
    App.confirm(App.t('Timings repeteren'), App.t('De totale tijd voor de diavoorstelling was {0}. Wil je de nieuwe diatimings bewaren?').replace('{0}', `${m}:${String(sec).padStart(2, '0')}`), App.t('Bewaren')).then((ok) => {
      if (!ok) return;
      App.run(() => s.times.forEach((t, i) => { if (t === undefined) return; const sl = App.pres.slides[i]; sl.trans = { type: 'none', dur: 0.5, ...(sl.trans || {}) }; sl.trans.after = App.round(t, 2); App.touch(sl); }), { noTouch: true });
      App.pres.show.timings = true;
      App.thumbs && App.thumbs.refresh(true);
      App.toast(App.t('Timings bewaard. Ze staan in de diasorteerder bij elke dia.'), 'timer');
    });
  };

  /* ---------- Opnemen (timings, pen en eigen gesproken tekst) ---------- */
  const startRecording = async () => {
    try { S.rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { S.rec.stream = null; App.toast(App.t('Geen microfoon: alleen timings en inkt worden opgenomen.'), 'mic_off'); }
  };
  const recSlideStart = (idx) => {
    if (!S.rec || !S.rec.stream || !window.MediaRecorder) return;
    const chunks = [];
    const mr = new MediaRecorder(S.rec.stream);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.start(500);
    S.rec.media = mr; S.rec.chunks = chunks; S.rec.idx = idx;
  };
  const recSlideDone = (idx) => new Promise((res) => {
    const r = S && S.rec; if (!r || !r.media || r.idx !== idx) { res(); return; }
    const mr = r.media; r.media = null;
    mr.onstop = async () => {
      const blob = new Blob(r.chunks, { type: mr.mimeType || 'audio/webm' });
      if (blob.size > 2000) { const url = await App.readFile(blob, 'dataurl'); const id = App.addMedia(url, blob.type, App.t('Gesproken tekst')); r.slides[idx] = id; }
      res();
    };
    try { mr.stop(); } catch { res(); }
  });
  App.on('show', (ev) => {
    if (ev !== 'end') return;
  });
  const finishRecording = async (s) => {
    if (!s || !s.rec) return;
    if (s.rec.stream) s.rec.stream.getTracks().forEach((t) => t.stop());
    App.run(() => Object.entries(s.rec.slides).forEach(([idx, mediaId]) => {
      const sl = App.pres.slides[+idx]; if (!sl) return;
      sl.objs = sl.objs.filter((o) => !(o.type === 'audio' && o.narration));
      sl.objs.push({ id: App.uid('o'), type: 'audio', name: App.t('Gesproken tekst'), media: mediaId, play: 'auto', hide: true, narration: true, x: App.pres.size.w - 56, y: App.pres.size.h - 56, w: 40, h: 40 });
      App.touch(sl);
    }), { noTouch: true });
  };
  const origClose = App.closeShow;
  App.closeShow = (keepInk) => { const s = S; if (s && s.rec) { recSlideDone(s.cur).then(() => finishRecording(s)); } origClose(keepInk); };

  /* ---------- Commando's ---------- */
  App.def('showFromStart', () => (App.pres.show.presenterView && App.startPresenter ? App.startPresenter(0) : App.startShow(0)));
  App.def('showFromCurrent', () => (App.pres.show.presenterView && App.startPresenter ? App.startPresenter(App.state.slide) : App.startShow(App.state.slide, { includeHidden: App.cur().hidden })));
  App.def('rehearse', () => App.startShow(0, { rehearse: true }));
  App.def('recordShow', () => App.startShow(App.state.slide, { record: true, rehearse: true }));
  App.def('customShow', (id) => App.startShow(0, { custom: id }));
  App.def('showOpt', (arg) => {
    const { key, value } = arg || {};
    const sh = App.pres.show;
    App.run(() => {
      if (key === 'timings') sh.timings = !!value;
      else if (key === 'narration') sh.narration = !!value;
      else if (key === 'mediaControls') sh.mediaControls = !!value;
      else if (key === 'presenter') sh.presenterView = !!value;
      else if (key === 'monitor') sh.monitor = value;
    }, { noTouch: true });
  });
  App.on('load', () => {
    const sh = App.pres.show || {};
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };
    set('ss-timings', sh.timings !== false); set('ss-narr', sh.narration !== false); set('ss-media', sh.mediaControls !== false); set('ss-presenter', !!sh.presenterView);
    const mon = $('#ss-monitor'); if (mon) mon.value = sh.monitor || 'auto';
  });
  App.def('showSetup', () => {
    const P = App.pres, sh = P.show;
    App.dialog({
      title: App.t('Diavoorstelling instellen'), wide: true,
      body: `<div class="fields-2"><div><h3 style="margin:0 0 8px;font-size:13px">${App.t('Soort voorstelling')}</h3><div class="radio-list"><label><input type="radio" name="sv-t" value="speaker" ${sh.type !== 'window' && sh.type !== 'kiosk' ? 'checked' : ''}> ${App.t('Gepresenteerd door een spreker (volledig scherm)')}</label><label><input type="radio" name="sv-t" value="window" ${sh.type === 'window' ? 'checked' : ''}> ${App.t('Bekeken door een persoon (venster)')}</label><label><input type="radio" name="sv-t" value="kiosk" ${sh.type === 'kiosk' ? 'checked' : ''}> ${App.t('Bekeken in een kiosk (volledig scherm, herhaalt vanzelf)')}</label></div>
        <h3 style="margin:14px 0 8px;font-size:13px">${App.t('Opties')}</h3><div class="checks" style="flex-direction:column;gap:6px"><label><input type="checkbox" id="sv-loop" ${sh.loop ? 'checked' : ''}> ${App.t('Doorlopend herhalen tot op Esc wordt gedrukt')}</label><label><input type="checkbox" id="sv-noanim" ${sh.anims === false ? 'checked' : ''}> ${App.t('Weergeven zonder animatie')}</label></div>
        <div class="fields-2" style="margin-top:10px"><label class="field"><span>${App.t('Penkleur')}</span><input type="color" id="sv-pen" value="${App.esc(sh.pen || '#e5484d')}"></label><label class="field"><span>${App.t('Kleur laserpointer')}</span><input type="color" id="sv-laser" value="${App.esc(sh.laser || '#ff2020')}"></label></div></div>
        <div><h3 style="margin:0 0 8px;font-size:13px">${App.t('Dia\'s weergeven')}</h3><div class="radio-list"><label><input type="radio" name="sv-r" value="all" ${!sh.range && !sh.custom ? 'checked' : ''}> ${App.t('Alle')}</label><label><input type="radio" name="sv-r" value="range" ${sh.range ? 'checked' : ''}> ${App.t('Van')} <input id="sv-from" type="number" min="1" max="${P.slides.length}" value="${sh.range ? sh.range.from : 1}" style="width:60px"> ${App.t('tot en met')} <input id="sv-to" type="number" min="1" max="${P.slides.length}" value="${sh.range ? sh.range.to : P.slides.length}" style="width:60px"></label>${P.shows.length ? `<label><input type="radio" name="sv-r" value="custom" ${sh.custom ? 'checked' : ''}> ${App.t('Aangepaste voorstelling:')} <select id="sv-custom">${P.shows.map((x) => `<option value="${App.esc(x.id)}" ${sh.custom === x.id ? 'selected' : ''}>${App.esc(x.name)}</option>`).join('')}</select></label>` : ''}</div>
        <h3 style="margin:14px 0 8px;font-size:13px">${App.t('Dia\'s doorlopen')}</h3><div class="radio-list"><label><input type="radio" name="sv-adv" value="manual" ${sh.timings === false ? 'checked' : ''}> ${App.t('Handmatig')}</label><label><input type="radio" name="sv-adv" value="timings" ${sh.timings !== false ? 'checked' : ''}> ${App.t('Met timings, indien aanwezig')}</label></div>
        <h3 style="margin:14px 0 8px;font-size:13px">${App.t('Meerdere beeldschermen')}</h3><label class="chk"><input type="checkbox" id="sv-pv" ${sh.presenterView ? 'checked' : ''}> ${App.t('Presentatorweergave gebruiken')}</label></div></div>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        App.run(() => {
          sh.type = d.$('input[name="sv-t"]:checked').value; sh.loop = d.$('#sv-loop').checked || sh.type === 'kiosk'; sh.anims = !d.$('#sv-noanim').checked;
          sh.pen = d.$('#sv-pen').value; sh.laser = d.$('#sv-laser').value;
          const r = d.$('input[name="sv-r"]:checked').value;
          sh.range = r === 'range' ? { from: App.clamp(+d.$('#sv-from').value || 1, 1, P.slides.length), to: App.clamp(+d.$('#sv-to').value || P.slides.length, 1, P.slides.length) } : null;
          sh.custom = r === 'custom' && d.$('#sv-custom') ? d.$('#sv-custom').value : null;
          sh.timings = d.$('input[name="sv-adv"]:checked').value === 'timings';
          sh.presenterView = d.$('#sv-pv').checked;
        }, { noTouch: true });
        App.emit('load');
      } }],
    });
  });
  // Aangepaste voorstellingen
  App.menuBuilders['m-customshows'] = () => App.pres.shows.map((x) => `<button data-cmd="customShow" data-arg="${App.esc(x.id)}"><span class="i">playlist_play</span> ${App.esc(x.name)}</button>`).join('') + (App.pres.shows.length ? '<hr>' : '') + `<button data-cmd="customShowsDialog">${App.t('Aangepaste voorstellingen…')}</button>`;
  App.def('customShowsDialog', () => {
    const P = App.pres;
    const render = (d) => {
      d.$('#cs-list').innerHTML = P.shows.length ? P.shows.map((x, i) => `<div class="list-row"><span class="grow"><b>${App.esc(x.name)}</b><br><small class="muted">${App.t(x.slides.length === 1 ? '{0} dia' : '{0} dia\'s').replace('{0}', x.slides.length)}</small></span><button class="btn small" data-cs-edit="${i}">${App.t('Bewerken…')}</button><button class="btn small" data-cs-play="${i}">${App.t('Weergeven')}</button><button class="qb" data-cs-del="${i}" title="${App.esc(App.t('Verwijderen'))}"><span class="i">delete</span></button></div>`).join('') : `<div class="list-row muted">${App.t('Er zijn nog geen aangepaste voorstellingen.')}</div>`;
    };
    const edit = (show, done) => {
      App.dialog({
        title: App.t('Aangepaste voorstelling definiëren'), wide: true,
        body: `<label class="field"><span>${App.t('Naam van voorstelling')}</span><input id="ce-name" value="${App.esc(show.name)}"></label><div class="list-rows" style="max-height:340px">${P.slides.map((s, i) => `<label class="list-row" style="cursor:pointer"><input type="checkbox" data-sid="${App.esc(s.id)}" ${show.slides.includes(s.id) ? 'checked' : ''}> ${i + 1}. ${App.esc(App.slideTitle(s))}</label>`).join('')}</div>`,
        buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (dd) => { show.name = dd.$('#ce-name').value.trim() || show.name; show.slides = dd.$$('[data-sid]').filter((c) => c.checked).map((c) => c.dataset.sid); done(); } }],
      });
    };
    App.dialog({
      title: App.t('Aangepaste voorstellingen'), wide: true,
      body: `<div class="list-rows" id="cs-list"></div>`,
      onOpen: (d) => {
        render(d);
        d.body.addEventListener('click', (e) => {
          const ed = e.target.closest('[data-cs-edit]'), pl = e.target.closest('[data-cs-play]'), de = e.target.closest('[data-cs-del]');
          if (ed) { const x = P.shows[+ed.dataset.csEdit]; const copy = App.clone(x); edit(copy, () => { App.run(() => Object.assign(x, copy), { noTouch: true }); render(d); }); }
          if (pl) { d.close(); App.startShow(0, { custom: P.shows[+pl.dataset.csPlay].id }); }
          if (de) { App.run(() => P.shows.splice(+de.dataset.csDel, 1), { noTouch: true }); render(d); }
        });
      },
      buttons: [{ label: 'Nieuw…', left: true, action: (d) => { const x = { id: App.uid('cs'), name: App.t('Aangepaste voorstelling {0}').replace('{0}', P.shows.length + 1), slides: [] }; edit(x, () => { App.run(() => P.shows.push(x), { noTouch: true }); render(d); }); return false; } }, { label: 'Sluiten', primary: true }],
    });
  });
  // F5 en dergelijke ook als de voorstelling niet loopt: zie editor.js (globalKeys)
  document.addEventListener('fullscreenchange', () => { if (S && !document.fullscreenElement && !S.opts.noFullscreen && !App.isAudience && S.opts.type !== 'window') { /* gebruiker verliet volledig scherm: voorstelling blijft in het venster */ } });
})();
