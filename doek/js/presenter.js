/* =========================================================
   Doek (gemaakt door JJ van Schelven) — presentatorweergave.
   Het publiek ziet de voorstelling in een tweede venster (zet het op de beamer),
   de presentator ziet de huidige en volgende dia, de notities, een timer en de klok.
   De vensters praten via een BroadcastChannel (alleen binnen deze computer).
   ========================================================= */
'use strict';

(() => {
  const AUD = /^#publiek=([a-z0-9]{6,20})$/i.exec(location.hash);
  App.isAudience = !!AUD;

  /* ---------- Publieksvenster ---------- */
  if (AUD) {
    const ch = new BroadcastChannel('doek-show:' + AUD[1]);
    document.documentElement.classList.add('audience');
    const wait = document.createElement('div');
    wait.className = 'aud-wait';
    wait.style.cssText = 'position:fixed;inset:0;z-index:400;background:#000;color:#ccc;display:grid;place-items:center;font:15px Inter,sans-serif;text-align:center';
    wait.innerHTML = `<div><div class="i" style="font-size:48px;color:#888">co_present</div><p>${App.t('Doek — publieksweergave')}</p><p style="color:#888;font-size:13px">${App.t('Sleep dit venster naar de beamer of het tweede scherm en klik hier voor volledig scherm.')}</p></div>`;
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wait));
    if (document.body) document.body.appendChild(wait);
    wait.addEventListener('click', () => { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); });
    const send = (m) => { try { ch.postMessage(m); } catch { /* niets */ } };
    ch.onmessage = async (e) => {
      const m = e.data || {};
      if (m.type === 'pres') {
        App.media = Object.assign(App.media, App.cleanMedia(m.media || {}));
        const P = App.deserializePres(m.data, { media: false, keepShare: false });
        App.loadPres(P, { warnFonts: false });
        App.closeBackstage && App.closeBackstage();
        await App.startShow(m.from || 0, { noFullscreen: true, custom: m.custom, includeHidden: m.includeHidden });
        wait.style.display = 'none';
        wait.onclick = null;
        report();
      } else if (!App.showActive()) return;
      else if (m.type === 'next') { await App.showNext(); report(); }
      else if (m.type === 'prev') { await App.showPrev(); report(); }
      else if (m.type === 'goto') { await App.showGoto(m.idx); report(); }
      else if (m.type === 'blank') App.showBlank(m.v);
      else if (m.type === 'tool') App.showTool(m.t);
      else if (m.type === 'laser') { const S = App.showState(); if (S) { S.laser.style.display = 'block'; S.laser.style.left = (S.ox + m.x * S.z) + 'px'; S.laser.style.top = (S.oy + m.y * S.z) + 'px'; clearTimeout(S._lt); S._lt = setTimeout(() => { S.laser.style.display = ''; }, 900); } }
      else if (m.type === 'ink') { const S = App.showState(); if (S) { S.ink.set(m.slide, m.strokes || []); App.showDrawInk(); } }
      else if (m.type === 'end') { App.closeShow(false); window.close(); }
    };
    const report = () => { const S = App.showState(); if (S) send({ type: 'state', idx: S.cur, step: S.player ? S.player.step : 0, steps: S.player ? S.player.tl.steps.length : 0, end: S.end.classList.contains('on') }); };
    App.on('show', (ev) => { if (ev === 'step' || ev === 'shown' || ev === 'endscreen') report(); if (ev === 'end') send({ type: 'closed' }); });
    // toetsen in het publieksvenster sturen de presentator aan (die bepaalt)
    document.addEventListener('keydown', (e) => { if (e.key === 'F11') return; send({ type: 'key', key: e.key, ctrl: e.ctrlKey }); }, true);
    addEventListener('load', () => send({ type: 'hello' }));
    setTimeout(() => send({ type: 'hello' }), 300);
    return;
  }

  /* ---------- Presentator ---------- */
  let PV = null;
  App.startPresenter = async (from = 0, opts = {}) => {
    const P = App.pres;
    if (App.state.edit) App.textEdit.stop();
    const chan = Math.random().toString(36).slice(2, 12);
    const url = location.href.split('#')[0].split('?')[0] + '#publiek=' + chan;
    let feat = 'popup,width=1280,height=720';
    // tweede scherm kiezen als de browser dat toestaat (Window Management API)
    try {
      if (window.getScreenDetails && (P.show.monitor || 'auto') !== 'this') {
        const sd = await window.getScreenDetails();
        const other = sd.screens.find((s) => s !== sd.currentScreen);
        if (other) feat = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
      }
    } catch { /* geen toestemming: gewoon een venster */ }
    const win = window.open(url, 'doek-publiek-' + chan, feat);
    if (!win) { App.toast(App.t('Het publieksvenster kon niet worden geopend; de voorstelling start in dit venster.'), 'info', { ms: 5000 }); App.startShow(from, opts); return; }
    const ch = new BroadcastChannel('doek-show:' + chan);
    const list = (() => { if (opts.custom) { const cs = P.shows.find((x) => x.id === opts.custom); if (cs) return cs.slides.map((id) => App.slideIndex(id)).filter((i) => i >= 0); } return P.slides.map((s, i) => i).filter((i) => !P.slides[i].hidden); })();
    PV = { ch, win, list, idx: from, step: 0, steps: 0, t0: Date.now(), paused: 0, pausedAt: 0, font: App.settings.pvFont || 16, tool: 'none', ink: new Map() };
    const sent = { done: false };
    ch.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'hello' && !sent.done) { sent.done = true; const data = App.serializePres({ media: false, noShare: true }); const media = {}; App.usedMedia(P).forEach((id) => { if (App.media[id]) media[id] = App.media[id]; }); ch.postMessage({ type: 'pres', data, media, from, custom: opts.custom }); }
      else if (m.type === 'state') { PV.idx = m.idx; PV.step = m.step; PV.steps = m.steps; PV.end = m.end; render(); }
      else if (m.type === 'key') keyCmd(m.key, m.ctrl);
      else if (m.type === 'closed') stop(true);
    };
    build();
    document.addEventListener('keydown', onKey, true);
    PV.timer = setInterval(tick, 500);
    PV.watch = setInterval(() => { if (PV && PV.win.closed) stop(true); }, 1000);
  };
  const stop = (fromAudience) => {
    if (!PV) return;
    const pv = PV; PV = null;
    clearInterval(pv.timer); clearInterval(pv.watch);
    document.removeEventListener('keydown', onKey, true);
    if (!fromAudience) { try { pv.ch.postMessage({ type: 'end' }); } catch { /* niets */ } }
    setTimeout(() => { try { pv.ch.close(); } catch { /* niets */ } }, 500);
    if (pv.el) pv.el.remove();
    // inkt uit de voorstelling bewaren?
    const inked = [...pv.ink.entries()].filter(([, s]) => s.length);
    if (inked.length) App.confirm(App.t('Inkt bewaren'), App.t('Wil je je inktaantekeningen behouden?'), App.t('Behouden')).then((ok) => { if (!ok) return; App.run(() => inked.forEach(([id, strokes]) => { const s = App.slideById(id); if (s) { s.objs.push({ id: App.uid('o'), type: 'ink', name: App.t('Inkt'), x: 0, y: 0, w: App.pres.size.w, h: App.pres.size.h, cw: App.pres.size.w, ch: App.pres.size.h, strokes }); App.touch(s); } }), { all: true }); App.thumbs.refresh(true); });
    if (App.pres.slides[pv.idx]) App.gotoSlide(pv.idx);
  };
  const send = (m) => { if (PV) PV.ch.postMessage(m); };
  const build = () => {
    const el = document.createElement('div');
    el.className = 'pv';
    el.innerHTML = `<div class="pv-top"><span class="i">timer</span><span class="timer" data-pv-timer>0:00:00</span><button data-pv="pause" title="${App.esc(App.t('Timer onderbreken'))}"><span class="i">pause</span></button><button data-pv="reset" title="${App.esc(App.t('Timer opnieuw starten'))}"><span class="i">restart_alt</span></button><span class="clock" data-pv-clock></span><button data-pv="swap" title="${App.esc(App.t('Presentatorweergave en diavoorstelling wisselen'))}"><span class="i">swap_horiz</span> ${App.t('Beeldschermen wisselen')}</button><button data-pv="end" title="${App.esc(App.t('Voorstelling beëindigen'))}"><span class="i">close</span> ${App.t('Voorstelling beëindigen')}</button></div>
      <div class="pv-cur"><div class="frame" data-pv-cur></div></div>
      <div class="pv-side"><div class="pv-next-lbl" data-pv-nextlbl>${App.t('Volgende dia')}</div><div class="pv-next" data-pv-next></div><div style="display:flex;gap:6px;align-items:center"><span class="muted small">${App.t('Notities')}</span><span style="flex:1"></span><button class="btn small" data-pv="font-" title="${App.esc(App.t('Tekst kleiner'))}">A−</button><button class="btn small" data-pv="font+" title="${App.esc(App.t('Tekst groter'))}">A+</button></div><div class="pv-notes" data-pv-notes></div></div>
      <div class="pv-bottom"><div class="tools"><button data-pv="pen" title="${App.esc(App.t('Pen'))}"><span class="i">edit</span></button><button data-pv="laser" title="${App.esc(App.t('Laserpointer'))}"><span class="i">my_location</span></button><button data-pv="hl" title="${App.esc(App.t('Markeerstift'))}"><span class="i">ink_highlighter</span></button><button data-pv="erase" title="${App.esc(App.t('Gum'))}"><span class="i">ink_eraser</span></button><button data-pv="ov" title="${App.esc(App.t('Alle dia\'s weergeven'))}"><span class="i">grid_view</span></button><button data-pv="black" title="${App.esc(App.t('Zwart scherm (B)'))}"><span class="i">rectangle</span></button></div>
        <div class="pv-nav"><button data-pv="prev" title="${App.esc(App.t('Vorige'))}"><span class="i">arrow_back</span></button><span data-pv-pos></span><button data-pv="next" title="${App.esc(App.t('Volgende'))}"><span class="i">arrow_forward</span></button></div><div class="pv-strip" data-pv-strip hidden></div></div>`;
    document.body.appendChild(el);
    PV.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (b) cmd(b.dataset.pv); const s = e.target.closest('[data-pv-go]'); if (s) { send({ type: 'goto', idx: +s.dataset.pvGo }); el.querySelector('[data-pv-strip]').hidden = true; } });
    // laser en pen op de huidige dia in de presentatorweergave
    const cur = el.querySelector('[data-pv-cur]');
    cur.addEventListener('mousemove', (e) => { if (PV.tool !== 'laser') return; const p = ptIn(cur, e); send({ type: 'laser', x: p.x, y: p.y }); });
    cur.addEventListener('mousedown', (e) => {
      if (PV.tool !== 'pen' && PV.tool !== 'hl') return;
      e.preventDefault();
      const sid = App.pres.slides[PV.idx].id;
      if (!PV.ink.has(sid)) PV.ink.set(sid, []);
      const strokes = PV.ink.get(sid);
      const p0 = ptIn(cur, e);
      const st = { pts: [[p0.x, p0.y, 0.5]], color: PV.tool === 'hl' ? '#ffd23f' : (App.pres.show.pen || '#e5484d'), w: PV.tool === 'hl' ? 18 : 3, hl: PV.tool === 'hl' || undefined };
      strokes.push(st);
      const mv = (ev) => { const p = ptIn(cur, ev); st.pts.push([p.x, p.y, 0.5]); send({ type: 'ink', slide: sid, strokes }); renderInk(); };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); send({ type: 'ink', slide: sid, strokes }); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    render();
  };
  const ptIn = (frame, e) => { const r = frame.getBoundingClientRect(); const P = App.pres; return { x: (e.clientX - r.left) / r.width * P.size.w, y: (e.clientY - r.top) / r.height * P.size.h }; };
  const renderInk = () => {
    const frame = PV.el.querySelector('[data-pv-cur]'); let svg = frame.querySelector('svg.pv-ink');
    if (!svg) { svg = App.svgEl('svg', { class: 'pv-ink', style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none' }); frame.appendChild(svg); }
    const P = App.pres; svg.setAttribute('viewBox', `0 0 ${P.size.w} ${P.size.h}`);
    const strokes = PV.ink.get(App.pres.slides[PV.idx].id) || [];
    svg.innerHTML = strokes.map((s) => `<path d="${App.strokePath(s.pts)}" fill="none" stroke="${App.esc(s.color)}" stroke-width="${s.w}" stroke-linecap="round" ${s.hl ? 'stroke-opacity=".45"' : ''}/>`).join('');
  };
  const render = () => {
    if (!PV || !PV.el) return;
    const P = App.pres;
    const s = P.slides[PV.idx]; if (!s) return;
    const el = PV.el;
    const cur = el.querySelector('[data-pv-cur]'), nx = el.querySelector('[data-pv-next]');
    const area = el.querySelector('.pv-cur').getBoundingClientRect();
    const w = Math.max(200, Math.min(area.width - 40, (area.height - 40) * P.size.w / P.size.h));
    cur.style.width = w + 'px'; cur.style.height = w * P.size.h / P.size.w + 'px';
    // huidige dia in de toestand na de gespeelde stappen
    const sl = App.renderSlide(s, { mode: 'show', scale: w / P.size.w });
    const box = document.createElement('div'); box.style.cssText = `position:relative;width:${w}px;height:${w * P.size.h / P.size.w}px;overflow:hidden`;
    box.appendChild(sl); cur.replaceChildren(box);
    const player = new App.Anim.Player(sl, s);
    player.autoStart();
    for (let k = player.step; k < PV.step; k++) { player.next(); }
    player.finishRunning();
    renderInk();
    const nw = el.querySelector('.pv-side').clientWidth - 2;
    const pos = PV.list.indexOf(PV.idx);
    const nextIdx = PV.list[pos + 1];
    const lbl = el.querySelector('[data-pv-nextlbl]');
    if (PV.steps && PV.step < PV.steps) { lbl.textContent = App.t('Volgende: animatie ({0} van {1})').replace('{0}', PV.step + 1).replace('{1}', PV.steps); const s2 = App.renderSlide(s, { mode: 'show', scale: nw / P.size.w }); const b2 = document.createElement('div'); b2.style.cssText = `position:relative;width:${nw}px;height:${nw * P.size.h / P.size.w}px;overflow:hidden`; b2.appendChild(s2); nx.replaceChildren(b2); const p2 = new App.Anim.Player(s2, s); p2.autoStart(); for (let k = p2.step; k <= PV.step; k++) p2.next(); p2.finishRunning(); }
    else if (nextIdx !== undefined) { lbl.textContent = App.t('Volgende dia'); nx.replaceChildren(App.slideThumb(P.slides[nextIdx], nw)); }
    else { lbl.textContent = App.t('Einde van de voorstelling'); nx.replaceChildren(); nx.style.height = nw * P.size.h / P.size.w + 'px'; }
    const notes = el.querySelector('[data-pv-notes]');
    notes.style.fontSize = PV.font + 'px';
    notes.textContent = s.notes ? App.plainText(s.notes) : App.t('Geen notities.');
    el.querySelector('[data-pv-pos]').textContent = App.t('Dia {0} van {1}').replace('{0}', pos + 1).replace('{1}', PV.list.length);
    el.querySelectorAll('[data-pv="pen"],[data-pv="laser"],[data-pv="hl"],[data-pv="erase"]').forEach((b) => b.classList.toggle('on', b.dataset.pv === PV.tool));
  };
  const tick = () => {
    if (!PV || !PV.el) return;
    const ms = (PV.pausedAt || Date.now()) - PV.t0 - PV.paused;
    const s = Math.floor(ms / 1000);
    PV.el.querySelector('[data-pv-timer]').textContent = Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    PV.el.querySelector('[data-pv-clock]').textContent = new Date().toLocaleTimeString(App.LANG === 'en' ? 'en-US' : 'nl-NL', { hour: '2-digit', minute: '2-digit' });
  };
  const cmd = (k) => {
    if (!PV) return;
    if (k === 'next') send({ type: 'next' }); else if (k === 'prev') send({ type: 'prev' });
    else if (k === 'end') stop();
    else if (k === 'pause') { if (PV.pausedAt) { PV.paused += Date.now() - PV.pausedAt; PV.pausedAt = 0; } else PV.pausedAt = Date.now(); }
    else if (k === 'reset') { PV.t0 = Date.now(); PV.paused = 0; PV.pausedAt = 0; }
    else if (k === 'font+') { PV.font = Math.min(48, PV.font + 2); App.settings.pvFont = PV.font; App.saveSettings(); render(); }
    else if (k === 'font-') { PV.font = Math.max(10, PV.font - 2); App.settings.pvFont = PV.font; App.saveSettings(); render(); }
    else if (k === 'black') { PV.blank = PV.blank ? '' : 'black'; send({ type: 'blank', v: PV.blank }); }
    else if (k === 'pen' || k === 'laser' || k === 'hl' || k === 'erase') { PV.tool = PV.tool === k ? 'none' : k; if (k === 'erase') { PV.ink.set(App.pres.slides[PV.idx].id, []); send({ type: 'ink', slide: App.pres.slides[PV.idx].id, strokes: [] }); renderInk(); PV.tool = 'none'; } send({ type: 'tool', t: PV.tool === 'laser' ? 'none' : PV.tool }); render(); }
    else if (k === 'ov') { const strip = PV.el.querySelector('[data-pv-strip]'); strip.hidden = !strip.hidden; if (!strip.hidden) { strip.replaceChildren(...App.pres.slides.map((s, i) => { const d = document.createElement('div'); d.className = 's' + (i === PV.idx ? ' cur' : ''); d.dataset.pvGo = i; d.appendChild(App.slideThumb(s, 120)); return d; })); } }
    else if (k === 'swap') { try { PV.win.focus(); } catch { /* niets */ } App.toast(App.t('Sleep het publieksvenster naar het andere scherm.'), 'swap_horiz'); }
  };
  const keyCmd = (key, ctrl) => {
    if ([' ', 'n', 'N', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(key)) cmd('next');
    else if (['Backspace', 'p', 'P', 'ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) cmd('prev');
    else if (key === 'Escape') stop();
    else if (key === 'b' || key === 'B' || key === '.') cmd('black');
    else if (key === 'w' || key === 'W' || key === ',') { PV.blank = PV.blank === 'white' ? '' : 'white'; send({ type: 'blank', v: PV.blank }); }
    else if (ctrl && (key === 'l' || key === 'L')) cmd('laser');
    else if (ctrl && (key === 'p' || key === 'P')) cmd('pen');
  };
  const onKey = (e) => { if (!PV || $('.backdrop')) return; e.preventDefault(); e.stopPropagation(); keyCmd(e.key, e.ctrlKey || e.metaKey); };
  window.addEventListener('resize', () => { if (PV) render(); });
})();
