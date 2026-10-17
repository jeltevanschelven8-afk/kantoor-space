/* =========================================================
   Doek (gemaakt door JJ van Schelven) — video en audio in de editor:
   afspelen met een afspeelbalk, bladwijzers, bijsnijden, in- en uitfaden,
   afspeelopties en het afbeeldingsframe (poster)
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const mediaObj = () => { const o = App.sel1(); return o && (o.type === 'video' || o.type === 'audio') ? o : null; };
  const fmtT = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
  const parseT = (s) => { const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d+)?)\s*$/.exec(String(s)); return m ? (+(m[1] || 0)) * 60 + parseFloat(m[2].replace(',', '.')) : NaN; };

  /* ---------- Afspeelbalk onder het geselecteerde mediaobject ---------- */
  let P = null;   // { id, el, bar, raf }
  const stop = () => {
    if (!P) return;
    cancelAnimationFrame(P.raf);
    try { P.el.pause(); } catch { /* niets */ }
    P.el.remove(); P.bar.remove();
    P = null;
  };
  const ensure = (o) => {
    if (P && P.id === o.id && P.el.isConnected) return P;
    stop();
    const ob = App.objEl(o.id); if (!ob) return null;
    const url = App.mediaUrl(o.media); if (!url) { App.toast(App.t('Het mediabestand ontbreekt.'), 'error'); return null; }
    const el = document.createElement(o.type === 'video' ? 'video' : 'audio');
    el.src = url; el.preload = 'auto'; el.playsInline = true;
    if (o.vol !== undefined) el.volume = App.clamp(o.vol, 0, 1);
    if (o.type === 'video') { el.className = 'md-live'; ob.appendChild(el); } else { el.style.display = 'none'; document.body.appendChild(el); }
    const bar = document.createElement('div');
    bar.className = 'md-bar';
    bar.innerHTML = `<button class="qb" data-mb="play" title="${App.esc(App.t('Afspelen/onderbreken'))}"><span class="i">play_arrow</span></button><button class="qb" data-mb="back" title="${App.esc(App.t('0,25 seconde terug'))}"><span class="i">fast_rewind</span></button><button class="qb" data-mb="fwd" title="${App.esc(App.t('0,25 seconde vooruit'))}"><span class="i">fast_forward</span></button><div class="md-track"><div class="md-trim"></div><div class="md-prog"></div><div class="md-marks"></div></div><span class="md-time">0:00.00</span><button class="qb" data-mb="mute" title="${App.esc(App.t('Dempen'))}"><span class="i">volume_up</span></button>`;
    $('#overlay').appendChild(bar);
    P = { id: o.id, el, bar, raf: 0 };
    const trim = () => { const x = App.obj(P.id) || o; const d = el.duration || x.dur || 0; return { s: (x.trim && x.trim.start) || 0, e: x.trim && x.trim.end ? Math.min(x.trim.end, d || x.trim.end) : d }; };
    el.addEventListener('loadedmetadata', () => { const t = trim(); if (t.s) el.currentTime = t.s; place(); });
    const tick = () => {
      if (!P) return;
      const t = trim(), d = el.duration || 1;
      if (!el.paused && t.e && el.currentTime >= t.e) { el.pause(); el.currentTime = t.s; }
      // faden zoals in de voorstelling
      const x = App.obj(P.id) || o, f = x.fade || {}, base = x.vol === undefined ? 1 : x.vol;
      let v = base; if (f.in && el.currentTime - t.s < f.in) v = base * Math.max(0, (el.currentTime - t.s) / f.in); if (f.out && t.e - el.currentTime < f.out) v = Math.min(v, base * Math.max(0, (t.e - el.currentTime) / f.out));
      el.volume = App.clamp(v, 0, 1);
      bar.querySelector('.md-prog').style.width = (el.currentTime / d * 100) + '%';
      const tr = bar.querySelector('.md-trim'); tr.style.left = (t.s / d * 100) + '%'; tr.style.width = ((t.e - t.s) / d * 100) + '%';
      bar.querySelector('.md-time').textContent = fmtT(el.currentTime);
      bar.querySelector('[data-mb="play"] .i').textContent = el.paused ? 'play_arrow' : 'pause';
      bar.querySelector('[data-mb="mute"] .i').textContent = el.muted ? 'volume_off' : 'volume_up';
      P.raf = requestAnimationFrame(tick);
    };
    tick();
    bar.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-mb]');
      if (b) {
        const k = b.dataset.mb;
        if (k === 'play') { if (el.paused) el.play().catch(() => {}); else el.pause(); }
        else if (k === 'back') el.currentTime = Math.max(0, el.currentTime - 0.25);
        else if (k === 'fwd') el.currentTime = Math.min(el.duration || 0, el.currentTime + 0.25);
        else if (k === 'mute') el.muted = !el.muted;
        return;
      }
      const tr = e.target.closest('.md-track');
      if (tr) { const r = tr.getBoundingClientRect(); el.currentTime = App.clamp((e.clientX - r.left) / r.width, 0, 1) * (el.duration || 0); }
      const mk = e.target.closest('[data-mk]');
      if (mk) { const x = App.obj(P.id); const m = x && x.marks && x.marks[+mk.dataset.mk]; if (m) el.currentTime = m.t; }
    });
    drawMarks();
    place();
    return P;
  };
  const drawMarks = () => {
    if (!P) return;
    const o = App.obj(P.id); const d = P.el.duration || (o && o.dur) || 0;
    P.bar.querySelector('.md-marks').innerHTML = (o && o.marks || []).map((m, i) => `<i data-mk="${i}" title="${App.esc(m.name)} (${fmtT(m.t)})" style="left:${d ? m.t / d * 100 : 0}%"></i>`).join('');
  };
  // de balk onder het object houden (zoom, verplaatsen)
  const place = () => {
    if (!P) return;
    const o = App.obj(P.id), ob = App.objEl(P.id);
    if (!o || !ob || !App.state.sel.includes(P.id)) { stop(); return; }
    if (o.type === 'video' && !ob.contains(P.el)) ob.appendChild(P.el);
    const ov = $('#overlay').getBoundingClientRect(), r = ob.getBoundingClientRect();
    const w = Math.max(260, r.width);
    P.bar.style.left = (r.left - ov.left + (r.width - w) / 2) + 'px';
    P.bar.style.top = (r.bottom - ov.top + 6) + 'px';
    P.bar.style.width = w + 'px';
  };
  App.on('selection', () => { if (P && !App.state.sel.includes(P.id)) stop(); else requestAnimationFrame(place); });
  App.on('render', () => requestAnimationFrame(place));
  App.on('zoom', () => requestAnimationFrame(place));
  App.on('slide', stop);
  App.on('show', (k) => { if (k === 'start') stop(); });

  App.def('mediaPlay', () => {
    const o = mediaObj(); if (!o) return;
    const p = ensure(o); if (!p) return;
    if (p.el.paused) p.el.play().catch((e) => App.toast(App.t('Afspelen lukt niet: {0}').replace('{0}', e.message), 'error')); else p.el.pause();
  });

  /* ---------- Bladwijzers ---------- */
  App.def('mediaMark', (k) => {
    const o = mediaObj(); if (!o) return;
    const p = ensure(o); const t = p ? p.el.currentTime : 0;
    if (k === 'add') {
      App.run(() => { const x = App.obj(o.id); x.marks = (x.marks || []).concat({ t: App.round(t, 2), name: App.t('Bladwijzer') + ' ' + ((x.marks || []).length + 1) }).sort((a, b) => a.t - b.t); });
      App.toast(App.t('Bladwijzer toegevoegd op {0}. Gebruik hem als trigger voor animaties.').replace('{0}', fmtT(t)), 'bookmark_add');
    } else {
      const x = App.obj(o.id); if (!x.marks || !x.marks.length) { App.toast(App.t('Deze media heeft geen bladwijzers.'), 'info'); return; }
      let best = 0; x.marks.forEach((m, i) => { if (Math.abs(m.t - t) < Math.abs(x.marks[best].t - t)) best = i; });
      App.run(() => { const y = App.obj(o.id); y.marks.splice(best, 1); if (!y.marks.length) delete y.marks; });
    }
    drawMarks();
  });

  /* ---------- Bijsnijden ---------- */
  App.def('mediaTrim', () => {
    const o = mediaObj(); if (!o) return;
    const url = App.mediaUrl(o.media); if (!url) return;
    stop();
    const isV = o.type === 'video';
    const body = document.createElement('div');
    body.className = 'md-trimdlg';
    body.innerHTML = `${isV ? '<video class="mt-v" preload="auto" playsinline></video>' : '<audio class="mt-v" preload="auto"></audio>'}
      <div class="mt-track"><div class="mt-sel"></div><div class="mt-pos"></div><i class="mt-h a" title="${App.esc(App.t('Begintijd'))}"></i><i class="mt-h b" title="${App.esc(App.t('Eindtijd'))}"></i></div>
      <div class="mt-row"><label class="field"><span>${App.t('Begintijd')}</span><input class="mt-s" value="0:00.00"></label><button class="btn small mt-play"><span class="i">play_arrow</span> ${App.t('Afspelen')}</button><label class="field"><span>${App.t('Eindtijd')}</span><input class="mt-e" value="0:00.00"></label></div>
      <div class="muted small mt-dur"></div>`;
    const v = body.querySelector('.mt-v'); v.src = url;
    let s = (o.trim && o.trim.start) || 0, e = (o.trim && o.trim.end) || 0, D = o.dur || 0;
    const upd = () => {
      if (!D) return;
      body.querySelector('.mt-sel').style.left = (s / D * 100) + '%'; body.querySelector('.mt-sel').style.width = ((e - s) / D * 100) + '%';
      body.querySelector('.mt-h.a').style.left = (s / D * 100) + '%'; body.querySelector('.mt-h.b').style.left = (e / D * 100) + '%';
      if (document.activeElement !== body.querySelector('.mt-s')) body.querySelector('.mt-s').value = fmtT(s);
      if (document.activeElement !== body.querySelector('.mt-e')) body.querySelector('.mt-e').value = fmtT(e);
      body.querySelector('.mt-dur').textContent = App.t('Duur: {0}').replace('{0}', fmtT(e - s));
    };
    v.addEventListener('loadedmetadata', () => { D = v.duration || D; if (!e || e > D) e = D; v.currentTime = s; upd(); });
    let raf = 0;
    const loop = () => { body.querySelector('.mt-pos').style.left = (D ? v.currentTime / D * 100 : 0) + '%'; if (!v.paused && v.currentTime >= e) { v.pause(); v.currentTime = s; } body.querySelector('.mt-play .i').textContent = v.paused ? 'play_arrow' : 'pause'; raf = requestAnimationFrame(loop); };
    loop();
    body.querySelector('.mt-play').onclick = () => { if (v.paused) { if (v.currentTime < s || v.currentTime >= e) v.currentTime = s; v.play().catch(() => {}); } else v.pause(); };
    const drag = (which) => (ev) => {
      ev.preventDefault();
      const tr = body.querySelector('.mt-track').getBoundingClientRect();
      const mv = (m) => { const t = App.clamp((m.clientX - tr.left) / tr.width, 0, 1) * D; if (which === 'a') s = Math.min(t, e - 0.1); else e = Math.max(t, s + 0.1); v.currentTime = which === 'a' ? s : e; upd(); };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    };
    body.querySelector('.mt-h.a').addEventListener('mousedown', drag('a'));
    body.querySelector('.mt-h.b').addEventListener('mousedown', drag('b'));
    body.querySelector('.mt-s').addEventListener('change', (ev) => { const t = parseT(ev.target.value); if (Number.isFinite(t)) s = App.clamp(t, 0, e - 0.1); upd(); });
    body.querySelector('.mt-e').addEventListener('change', (ev) => { const t = parseT(ev.target.value); if (Number.isFinite(t)) e = App.clamp(t, s + 0.1, D || t); upd(); });
    App.dialog({
      title: App.t(isV ? 'Video bijsnijden' : 'Audio bijsnijden'), body, wide: true,
      onClose: () => { cancelAnimationFrame(raf); v.pause(); v.removeAttribute('src'); v.load(); },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: () => {
        App.run(() => { const x = App.obj(o.id); if (!x) return; if (s <= 0.01 && (!D || e >= D - 0.01)) delete x.trim; else x.trim = { start: App.round(s, 2), end: App.round(e, 2) }; if (D) x.dur = App.round(D, 2); });
      } }],
    });
  });

  /* ---------- Faden en afspeelopties ---------- */
  const val = (arg) => (arg && typeof arg === 'object' ? arg : { key: arg, value: undefined });
  App.defEdit('mediaFade', (arg) => {
    const o = mediaObj(); if (!o) return false;
    const { key, value } = val(arg);
    const n = App.clamp(App.parseNum(value !== undefined ? value : ($('#md-f' + key) || {}).value) || 0, 0, 60);
    o.fade = { in: 0, out: 0, ...(o.fade || {}), [key]: n };
    if (!o.fade.in && !o.fade.out) delete o.fade;
  });
  App.defEdit('mediaOpt', (arg) => {
    const o = mediaObj(); if (!o) return false;
    const { key, value } = val(arg);
    if (key === 'vol') { const v = App.clamp(App.parseNum(value) || 0, 0, 1); if (v === 1) delete o.vol; else o.vol = v; if (P) P.el.volume = v; }
    else if (key === 'play') o.play = ['click', 'auto', 'seq'].includes(value) ? value : 'seq';
    else if (['full', 'hide', 'loop', 'rewind'].includes(key)) { const on = value === undefined ? !o[key] : !!value; if (on) o[key] = true; else delete o[key]; }
    else return false;
  });
  const syncRibbon = () => {
    const o = mediaObj(); if (!o) return;
    const set = (id, v) => { const e = $('#' + id); if (!e || document.activeElement === e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; };
    set('md-fin', (o.fade && o.fade.in) || 0); set('md-fout', (o.fade && o.fade.out) || 0);
    const vol = o.vol === undefined ? 1 : o.vol;
    set('md-vol', vol === 0 ? '0' : vol <= 0.3 ? '0.25' : vol <= 0.8 ? '0.6' : '1');
    set('md-play', o.play || 'seq'); set('md-full', o.full); set('md-hide', o.hide); set('md-loop', o.loop); set('md-rew', o.rewind);
    const full = $('#md-full'); if (full) full.disabled = o.type !== 'video';
  };
  App.on('selection', syncRibbon);
  App.on('change', () => requestAnimationFrame(syncRibbon));

  /* ---------- Afbeeldingsframe ---------- */
  const grab = (o, t) => new Promise((res) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = App.mediaUrl(o.media);
    const done = (r) => { v.removeAttribute('src'); v.load(); res(r); };
    v.onloadeddata = () => { v.currentTime = Math.min(t, Math.max(0, (v.duration || 1) - 0.05)); };
    v.onseeked = () => {
      try {
        const sc = Math.min(1, 1280 / (v.videoWidth || 1280));
        const c = document.createElement('canvas'); c.width = Math.round((v.videoWidth || 640) * sc); c.height = Math.round((v.videoHeight || 360) * sc);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        done(App.addMedia(c.toDataURL('image/jpeg', 0.85), 'image/jpeg', 'poster', { nat: { w: c.width, h: c.height } }));
      } catch { done(null); }
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
  });
  App.def('mediaPoster', async (k) => {
    const o = mediaObj(); if (!o || o.type !== 'video') { App.toast(App.t('Selecteer eerst een video.'), 'info'); return; }
    if (k === 'file') {
      const f = await App.pickFile('image/*'); if (!f) return;
      const url = await App.fitImageUrl(await App.readFile(f, 'dataurl'), 1920);
      const id = App.addMedia(url, f.type, f.name);
      App.run(() => { const x = App.obj(o.id); if (x) x.poster = id; });
      return;
    }
    const t = k === 'current' && P && P.id === o.id ? P.el.currentTime : 0;
    const id = await grab(o, t);
    if (!id) { App.toast(App.t('Het frame kon niet worden vastgelegd.'), 'error'); return; }
    App.run(() => { const x = App.obj(o.id); if (x) x.poster = id; });
    App.toast(App.t(k === 'current' ? 'Huidig frame ingesteld als afbeeldingsframe' : 'Afbeeldingsframe opnieuw ingesteld'), 'ok');
  });

  /* ---------- Opmaak ---------- */
  const css = document.createElement('style');
  css.id = 'pd-media-css';
  css.textContent = `.md-live{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:1}
.md-bar{position:absolute;display:flex;align-items:center;gap:2px;background:var(--panel);color:var(--text);border:1px solid var(--line-strong);border-radius:4px;padding:2px 6px;box-shadow:0 2px 8px rgba(0,0,0,.18);pointer-events:auto;z-index:20;font-size:12px}
.md-bar .qb{width:26px;height:26px}.md-time{font-variant-numeric:tabular-nums;min-width:58px;text-align:right}
.md-track{flex:1;position:relative;height:8px;background:var(--hover);border-radius:4px;cursor:pointer;margin:0 6px}
.md-trim{position:absolute;top:0;bottom:0;background:rgba(80,140,230,.25);border-radius:4px}
.md-prog{position:absolute;left:0;top:0;bottom:0;background:var(--brand);border-radius:4px;pointer-events:none}
.md-marks i{position:absolute;top:-3px;width:10px;height:14px;margin-left:-5px;background:#ffb000;border-radius:50% 50% 50% 0;cursor:pointer;box-shadow:0 0 0 1px #fff}
.md-trimdlg .mt-v{width:100%;max-height:46vh;background:#000;border-radius:4px;display:block}
.md-trimdlg audio.mt-v{display:none}
.mt-track{position:relative;height:30px;margin:14px 8px;background:var(--hover);border-radius:4px}
.mt-sel{position:absolute;top:0;bottom:0;background:rgba(80,140,230,.3);border-left:2px solid #2f7d32;border-right:2px solid #c62828}
.mt-pos{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--text);pointer-events:none}
.mt-h{position:absolute;top:-6px;width:12px;height:42px;margin-left:-6px;border-radius:3px;cursor:ew-resize}.mt-h.a{background:#2f7d32}.mt-h.b{background:#c62828}
.mt-row{display:flex;align-items:flex-end;gap:12px;justify-content:space-between}.mt-row .field{max-width:150px}`;
  document.head.appendChild(css);
})();
