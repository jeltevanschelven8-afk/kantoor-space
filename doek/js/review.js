/* =========================================================
   Doek (gemaakt door JJ van Schelven) — Controleren: opmerkingen (draden, antwoorden,
   oplossen, markeringen op de dia), spelling met het woordenboek van de browser, taal
   voor de controle, synoniemen, toegankelijkheidscontrole (vaste regels) en vergelijken
   met een andere versie (wijzigingen accepteren of weigeren). Geen AI, geen netwerk.
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const T = (s) => App.t(s);
  const esc = App.esc;
  const r2 = (v) => Math.round(v * 100) / 100;
  const ro = () => !!(App.readOnly && App.readOnly());
  const roToast = () => App.toast(T('Deze presentatie kan alleen worden bekeken.'), 'lock');
  const when = (t) => (App.fmtDateTime ? App.fmtDateTime(t) : new Date(t).toLocaleString());
  // Wijziging aan één of meer dia's (ook andere dan de huidige) als één stap in de geschiedenis
  const edit = (slides, fn, meta = {}) => {
    if (ro()) { roToast(); return false; }
    return App.run(fn, { slides: (Array.isArray(slides) ? slides : [slides]).filter(Boolean), ...meta });
  };
  const titleObj = (s) => (s && s.objs.find((o) => o.ph && App.phFamily(o.ph.type) === 'title')) || null;
  const titleText = (s) => { const t = titleObj(s); return t ? App.plainText(t.text, ' ').trim() : ''; };
  const objLabel = (o) => (o ? o.name || T(App.OBJ_NAMES[o.type] || 'Object') : '');
  // object (ook binnen een groep) op een willekeurige dia
  const findIn = (s, id) => { const h = s && id ? App.findObj(id, s.objs) : null; return h ? h.obj : null; };
  const normalView = () => { if (st.view !== 'normal' && App.setView) App.setView('normal'); };
  const gotoObj = (slideId, objId) => {
    const si = App.slideIndex(slideId); if (si < 0) return false;
    normalView();
    if (st.edit) App.textEdit.stop();
    if (si !== st.slide) App.gotoSlide(si);
    if (objId && App.obj(objId)) App.select([objId]); else App.select([]);
    return true;
  };
  const paneRefresh = (kind) => { if (st.pane === kind) App.panes.refresh(true); };
  const slideLabel = (s) => T('Dia {0}').replace('{0}', App.slideIndex(s.id) + 1);

  /* ---------- Opmaak van de vensters (één keer, met de kleuren van app.css) ---------- */
  const CSS = `.comment-pin{z-index:2}
.comment-pin.on{outline:2px solid var(--accent);outline-offset:1px}
.comment-pin.draft{background:#fff3c4;border:1px dashed #8a6d00}
.comment-pin.drag{opacity:.85;cursor:grabbing}
.pd-cmt-anchor{position:absolute;border:1.5px dashed #d9a400;pointer-events:none;transform-origin:50% 50%}
.pd-cmt-slide{display:flex;align-items:center;gap:6px;padding:7px 12px;font-size:11.5px;font-weight:600;color:var(--muted);background:var(--hover);border-bottom:1px solid var(--line);cursor:pointer}
.pd-cmt-slide.cur{color:var(--text)}
.pd-cmt-slide .pd-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}
.pd-n{min-width:18px;height:18px;border-radius:9px;background:var(--line);color:var(--text);font-size:11px;display:inline-grid;place-items:center;padding:0 5px;font-weight:600}
.cmt .pd-who{flex:1;min-width:0}
.cmt .pd-who .cmt-who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmt .pd-ib{width:24px;height:24px;flex-shrink:0}
.cmt .pd-ib .i{font-size:16px}
.cmt.done .cmt-head .pd-ib,.cmt .cmt-head .pd-ib{opacity:.75}
.cmt .cmt-head .pd-ib:hover{opacity:1}
.cmt>.cmt-text,.cmt>.cmt-replies,.cmt>.pd-cmt-rbox,.cmt>.pd-cmt-ta,.cmt>.cmt-actions{margin-left:34px}
.cmt-replies{margin-top:8px}
.pd-cmt-r .cmt-head{margin-bottom:3px}
.pd-cmt-r .cmt-av{width:22px;height:22px;font-size:10px}
.pd-cmt-r .cmt-text{margin-left:30px}
.pd-cmt-r .pd-cmt-ta,.pd-cmt-r .cmt-actions{margin-left:30px;width:calc(100% - 30px)}
.pd-cmt-on{display:flex;align-items:center;gap:3px;font-size:11.5px;color:var(--muted);margin:-3px 0 5px 34px;cursor:pointer;min-width:0}
.pd-cmt-on span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-cmt-on:hover{color:var(--accent)}
.pd-cmt-on .i{font-size:14px}
.cmt .pd-cmt-ta{display:block;width:calc(100% - 34px);min-height:46px}
.cmt .pd-cmt-rbox .pd-cmt-ta{width:100%}
.pd-cmt-draft{box-shadow:inset 3px 0 0 var(--accent)}
.pd-chip-done{font-size:10.5px;padding:1px 7px;border-radius:9px;background:var(--hover);color:var(--muted);white-space:nowrap}
.cmt-actions.pd-left{justify-content:flex-start;margin-top:4px}
.pd-link{border:0;background:none;color:var(--accent);padding:2px 0;font-size:12px;cursor:pointer;text-align:left}
.pd-link:hover{text-decoration:underline}
.pd-sel{height:26px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--panel);color:var(--text);padding:0 4px;font-size:12px;max-width:120px}
.pd-box{padding:10px 14px;display:flex;flex-direction:column;gap:10px}
.pd-note{margin:0;padding:8px 10px;border-radius:4px;background:var(--accent-soft);line-height:1.45}
.pd-warn{margin:0;padding:8px 10px;border-radius:4px;border:1px solid #e0a040;line-height:1.45}
.pd-card{border:1px solid var(--line-strong);border-radius:6px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.pd-card-t{font-weight:600}
.pd-sp-text{max-height:110px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:var(--muted);line-height:1.45}
.pd-sp-word{font-size:15px;font-weight:600;min-height:20px;word-break:break-word}
.pd-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pd-row .btn .i{font-size:16px}
.pd-tags{display:flex;flex-wrap:wrap;gap:4px}
.pd-tag{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line-strong);border-radius:12px;padding:1px 3px 1px 9px;font-size:12px}
.pd-tag button{border:0;background:none;padding:0;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;color:var(--muted)}
.pd-tag button:hover{background:var(--hover);color:var(--text)}
.pd-tag .i{font-size:14px}
.chk.pd-wrap{white-space:normal;padding-left:0}
.pd-th-search{display:flex;gap:4px}
.pd-th-search input{flex:1;min-width:0;height:28px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--panel);color:var(--text);padding:0 8px}
.pd-th-search input:focus{border-color:var(--accent);outline:none}
.pd-th-head{font-size:15px;font-weight:600;word-break:break-word}
.pd-th-sense{display:flex;flex-direction:column;gap:5px}
.pd-th-lbl{font-size:11.5px;color:var(--muted);font-weight:600}
.pd-th-ws{display:flex;flex-wrap:wrap;gap:5px}
.pd-th-c{display:inline-flex;align-items:stretch;border:1px solid var(--line-strong);border-radius:14px;overflow:hidden;background:var(--panel)}
.pd-th-c button{border:0;background:none;color:var(--text);height:26px;cursor:pointer}
.pd-th-c button:hover{background:var(--hover)}
.pd-th-w{padding:0 4px 0 10px;font-size:12.5px}
.pd-th-l{padding:0 6px 0 2px;display:grid;place-items:center}
.pd-th-l .i{font-size:15px;color:var(--muted)}
.pd-th-ant .pd-th-c{border-style:dashed}
.pd-a11y-sum{display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);line-height:1.4}
.pd-a11y-sum .i{font-size:24px}
.pd-a11y-rule{padding:6px 0 0}
.pd-a11y-rule b{font-weight:600}
.pd-a11y-why{color:var(--muted);font-size:11.5px;line-height:1.4;margin:2px 0 4px}
.pd-a11y-it{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;min-width:0}
.pd-a11y-it:hover{background:var(--hover)}
.pd-a11y-it .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-a11y-it .pd-where{color:var(--muted);font-size:11.5px;flex-shrink:0}
.pd-a11y-fix{display:flex;flex-wrap:wrap;gap:4px;padding:0 6px 6px 6px}
.pd-a11y-fix .btn.small{height:24px;padding:0 8px}
.pd-lvl-err{color:#c50f1f}.pd-lvl-warn{color:#b06000}.pd-lvl-tip{color:#0f6cbd}.pd-lvl-ok{color:#107c41}
body.dark .pd-lvl-err{color:#ff6b6b}body.dark .pd-lvl-warn{color:#f0b35a}body.dark .pd-lvl-tip{color:#6cb8f6}body.dark .pd-lvl-ok{color:#6ccb8f}
#sb-a11y.pd-a11y-bad .i{color:#b06000}
body.dark #sb-a11y.pd-a11y-bad .i{color:#f0b35a}
#sb-lang{cursor:pointer}
.pd-ch-file{display:flex;align-items:center;gap:6px;min-width:0;flex:1}
.pd-ch-file .notranslate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.pd-ch-slide{display:flex;align-items:center;gap:6px;padding:7px 12px;font-size:11.5px;font-weight:600;color:var(--muted);background:var(--hover);border-bottom:1px solid var(--line)}
.pd-ch-slide .pd-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}
.pd-ch-it{display:flex;align-items:flex-start;gap:6px;padding:6px 6px 6px 12px;border-bottom:1px solid var(--line);cursor:pointer}
.pd-ch-it:hover{background:var(--hover)}
.pd-ch-it .grow{flex:1;min-width:0}
.pd-ch-it .i.k{font-size:18px;margin-top:1px}
.pd-ch-it .pd-d{color:var(--muted);font-size:11.5px;line-height:1.4;word-break:break-word}
.pd-ch-it .qb{width:26px;height:26px;flex-shrink:0}
.pd-ch-ins{color:#107c41}.pd-ch-del{color:#c50f1f}.pd-ch-mod{color:#0f6cbd}.pd-ch-mov{color:#8a6d00}
body.dark .pd-ch-ins{color:#6ccb8f}body.dark .pd-ch-del{color:#ff6b6b}body.dark .pd-ch-mod{color:#6cb8f6}body.dark .pd-ch-mov{color:#f0c35a}`;
  if (!document.getElementById('pd-review-css')) { const s = document.createElement('style'); s.id = 'pd-review-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* =====================================================
     Opmerkingen
     slide.comments = [{ id, author, text, t, x?, y?, done?, obj?, replies: [{ id, author, text, t }] }]
     Een opmerking bij een object volgt dat object (rechtsboven), tot de markering wordt versleept.
     ===================================================== */
  const CM = { active: null, draft: null, editing: null, replies: {}, filter: 'all', focus: null, scroll: null };
  const markersOn = () => App.settings.commentMarkers !== false;
  const allComments = () => (App.pres ? App.pres.slides.flatMap((s, si) => (s.comments || []).map((c) => ({ s, si, c }))) : []);
  const findComment = (id) => { if (!id || !App.pres) return null; for (const s of App.pres.slides) { const c = (s.comments || []).find((x) => x.id === id); if (c) return { s, c }; } return null; };
  const author = () => String(App.settings.author || '').trim().slice(0, 80);   // optioneel, nooit gevraagd
  const who = (a) => (a && String(a).trim()) || T('Auteur');
  const initials = (a) => { const p = String(a || '').trim().split(/\s+/).filter(Boolean); return p.length ? (Array.from(p[0])[0] + (p.length > 1 ? Array.from(p[p.length - 1])[0] : '')).toUpperCase() : ''; };
  const AV = ['#c4501b', '#2b7a78', '#5b5fc7', '#b5179e', '#3a7d44', '#8a6d00', '#0f6cbd', '#a4262c'];
  const avColor = (a) => { let h = 7; for (const ch of String(a || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return AV[h % AV.length]; };
  const cleanText = (t) => String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 10000);

  // Alle wijzigingen lopen via App.run (ongedaan maken werkt), ook op andere dia's dan de huidige
  App.comments = {
    all: allComments,
    find: findComment,
    active: () => CM.active,
    setActive: (id, opts) => setActive(id, opts),
    add(slide, opts = {}) {
      const s = typeof slide === 'string' ? App.slideById(slide) : slide;
      const text = cleanText(opts.text);
      if (!s || !text) return null;
      const c = { id: App.uid('c'), author: author(), text, t: Date.now(), replies: [] };
      if (opts.obj && findIn(s, opts.obj)) c.obj = opts.obj;
      if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) { c.x = r2(opts.x); c.y = r2(opts.y); }
      if (edit(s, () => { (s.comments = s.comments || []).push(c); }) === false) return null;
      return c.id;
    },
    reply(id, text) {
      const h = findComment(id), t = cleanText(text);
      if (!h || !t) return null;
      const r = { id: App.uid('r'), author: author(), text: t, t: Date.now() };
      // antwoorden op een opgeloste draad opent hem weer
      if (edit(h.s, () => { (h.c.replies = h.c.replies || []).push(r); delete h.c.done; }) === false) return null;
      return r.id;
    },
    edit(id, rid, text) {
      const h = findComment(id), t = cleanText(text);
      if (!h || !t) return false;
      const target = rid ? (h.c.replies || []).find((r) => r.id === rid) : h.c;
      if (!target || target.text === t) return false;
      return edit(h.s, () => { target.text = t; }) !== false;
    },
    resolve(id, done = true) {
      const h = findComment(id);
      if (!h || !!h.c.done === !!done) return false;
      return edit(h.s, () => { if (done) h.c.done = true; else delete h.c.done; }) !== false;
    },
    remove(id) {
      const h = findComment(id); if (!h) return false;
      const ok = edit(h.s, () => { h.s.comments = h.s.comments.filter((c) => c.id !== id); if (!h.s.comments.length) delete h.s.comments; }) !== false;
      if (ok && CM.active === id) CM.active = null;
      if (ok && CM.editing && CM.editing.id === id) CM.editing = null;
      return ok;
    },
    removeReply(id, rid) {
      const h = findComment(id);
      if (!h || !(h.c.replies || []).some((r) => r.id === rid)) return false;
      return edit(h.s, () => { h.c.replies = h.c.replies.filter((r) => r.id !== rid); }) !== false;
    },
    move(id, x, y) {
      const h = findComment(id); if (!h) return false;
      const P = App.pres;
      return edit(h.s, () => { h.c.x = r2(App.clamp(x, 0, P.size.w)); h.c.y = r2(App.clamp(y, 0, P.size.h)); }) !== false;
    },
    // 'slide' (huidige dia) of 'all'; geeft het aantal verwijderde draden
    removeAll(scope) {
      const slides = (scope === 'all' ? App.pres.slides : [App.cur()]).filter((s) => s && s.comments && s.comments.length);
      const n = slides.reduce((k, s) => k + s.comments.length, 0);
      if (!n) return 0;
      if (edit(slides, () => slides.forEach((s) => { delete s.comments; })) === false) return 0;
      if (CM.active && !findComment(CM.active)) CM.active = null;
      if (CM.draft && slides.some((s) => s.id === CM.draft.slide)) CM.draft = null;
      CM.editing = null;
      return n;
    },
  };

  /* ---------- Markeringen op de dia ---------- */
  const overlay = $('#overlay');
  const pinPos = (c, s) => {
    const P = App.pres;
    if (Number.isFinite(c.x) && Number.isFinite(c.y)) return { x: c.x, y: c.y };
    if (c.obj && s === App.surface().owner && App.findObj(c.obj)) {
      const wb = App.worldBox(c.obj);
      if (wb) { const a = App.aabb(wb); return { x: App.clamp(a.x + a.w, 0, P.size.w), y: App.clamp(a.y, 0, P.size.h) }; }
    }
    return { x: 12, y: 12 };
  };
  App.drawComments = (ov = overlay) => {
    ov.querySelectorAll('.pd-cmt-anchor').forEach((e) => e.remove());
    if (!App.pres || st.view !== 'normal' || !markersOn()) return;
    const s = App.cur(); if (!s) return;
    const z = App.zoom();
    const list = (s.comments || []).map((c) => ({ c, p: pinPos(c, s) }));
    if (CM.draft && CM.draft.slide === s.id) list.push({ c: { id: '', author: author(), text: CM.draft.text || '', obj: CM.draft.obj }, p: pinPos(CM.draft, s), draft: true });
    const stack = {};
    list.forEach(({ c, p, draft }) => {
      const key = Math.round(p.x) + ':' + Math.round(p.y);
      const k = stack[key] = (stack[key] || 0) + 1;   // markeringen op dezelfde plek onder elkaar
      const el = document.createElement('div');
      el.className = 'comment-pin notranslate' + (c.done ? ' done' : '') + (draft ? ' draft' : '') + (c.id && c.id === CM.active ? ' on' : '');
      el.style.left = r2(p.x * z) + 'px';
      el.style.top = r2(p.y * z + (k - 1) * 26) + 'px';
      if (draft) el.dataset.draft = '1'; else el.dataset.cid = c.id;
      const n = (c.replies || []).length;
      el.title = draft ? T('Nieuwe opmerking') : who(c.author) + ': ' + String(c.text || '').slice(0, 140) + (n ? ' (' + T(n === 1 ? '1 antwoord' : '{0} antwoorden').replace('{0}', n) + ')' : '');
      el.innerHTML = `<span class="i">${draft ? 'add_comment' : n ? 'forum' : 'comment'}</span>`;
      ov.appendChild(el);
    });
    // object waar de actieve opmerking bij hoort: stippelkader
    const act = list.find((x) => (CM.active ? x.c.id === CM.active : x.draft));
    if (act && act.c.obj && App.findObj(act.c.obj)) {
      const wb = App.worldBox(act.c.obj);
      if (wb) {
        const f = document.createElement('div');
        f.className = 'pd-cmt-anchor';
        f.style.cssText = `left:${r2(wb.x * z)}px;top:${r2(wb.y * z)}px;width:${r2(wb.w * z)}px;height:${r2(wb.h * z)}px${wb.rot ? `;transform:rotate(${wb.rot}deg)` : ''}`;
        ov.appendChild(f);
      }
    }
  };
  // klikken = draad openen in het venster; slepen = markering verplaatsen
  overlay.addEventListener('mousedown', (e) => {
    const pin = e.target.closest('.comment-pin');
    if (!pin || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const id = pin.dataset.cid || null, isDraft = pin.dataset.draft === '1';
    const x0 = e.clientX, y0 = e.clientY, L0 = parseFloat(pin.style.left) || 0, T0 = parseFloat(pin.style.top) || 0;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (!moved && !isDraft && ro()) return;
      moved = true; pin.classList.add('drag');
      pin.style.left = L0 + dx + 'px'; pin.style.top = T0 + dy + 'px';
    };
    const up = (ev) => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      if (!moved) { if (isDraft) { CM.focus = 'draft'; openComments(); } else setActive(id, { open: true }); return; }
      const z = App.zoom();
      const x = (L0 + ev.clientX - x0) / z, y = (T0 + ev.clientY - y0) / z;
      if (isDraft && CM.draft) { CM.draft.x = r2(App.clamp(x, 0, App.pres.size.w)); CM.draft.y = r2(App.clamp(y, 0, App.pres.size.h)); App.drawSelection(); return; }
      App.comments.move(id, x, y);
      App.drawSelection();
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });

  const openComments = () => { if (st.pane !== 'comments') App.panes.open('comments'); else App.panes.refresh(true); };
  // Een draad actief maken: naar de dia gaan, markering en draad oplichten
  const setActive = (id, opts = {}) => {
    const h = findComment(id); if (!h) return;
    CM.active = id; CM.scroll = id;
    const si = App.pres.slides.indexOf(h.s);
    if (opts.nav !== false && (si !== st.slide || st.view !== 'normal')) { normalView(); if (si !== st.slide) App.gotoSlide(si); }
    if (opts.open) openComments(); else paneRefresh('comments');
    App.drawSelection();
  };

  /* ---------- Commando's ---------- */
  App.def('newComment', () => {
    if (!App.pres) return;
    if (st.view === 'master') { App.toast(T('Opmerkingen kun je alleen op dia\'s plaatsen. Sluit eerst het diamodel.'), 'info'); return; }
    if (ro()) { roToast(); return; }
    const s = App.cur();
    const pick = st.edit || (st.view !== 'sorter' && st.sel.length ? st.sel[0] : null);
    const obj = pick && findIn(s, pick) ? pick : null;
    const keep = CM.draft && CM.draft.slide === s.id && (CM.draft.obj || null) === obj ? CM.draft.text : '';
    CM.draft = { slide: s.id, text: keep || '' };
    if (obj) CM.draft.obj = obj;
    else {
      // losse opmerkingen linksboven, naast elkaar
      const k = (s.comments || []).filter((c) => !c.obj && Number.isFinite(c.x)).length;
      CM.draft.x = 12 + (k % 12) * 34; CM.draft.y = 12 + Math.floor(k / 12) * 34;
    }
    CM.active = null; CM.editing = null; CM.focus = 'draft';
    openComments();
    App.drawSelection();
  });
  const currentComment = () => {
    if (CM.active && findComment(CM.active)) return CM.active;
    const cs = (App.cur() && App.cur().comments) || [];
    return cs.length === 1 ? cs[0].id : null;
  };
  App.def('deleteComment', () => {
    const id = currentComment();
    if (!id) { App.toast(T('Kies eerst een opmerking in het venster Opmerkingen.'), 'info'); openComments(); return; }
    App.comments.remove(id);
    paneRefresh('comments');
  });
  App.def('deleteComments', (scope) => {
    const n = App.comments.removeAll(scope === 'all' ? 'all' : 'slide');
    if (!n) { App.toast(T(scope === 'all' ? 'Er zijn geen opmerkingen in deze presentatie.' : 'Er zijn geen opmerkingen op deze dia.'), 'info'); return; }
    App.toast(T(n === 1 ? '1 opmerking verwijderd' : '{0} opmerkingen verwijderd').replace('{0}', n), 'delete', { action: T('Ongedaan maken'), onAction: () => App.exec('undo'), ms: 5000 });
    paneRefresh('comments');
  });
  // Vorige/volgende opmerking over alle dia's heen (in de volgorde van de dia's, binnen een dia in volgorde van plaatsen)
  App.def('commentNav', (d) => {
    if (!App.pres) return;
    const dir = +d < 0 ? -1 : 1;
    const L = allComments().filter((x) => CM.filter !== 'open' || !x.c.done || x.c.id === CM.active);
    if (!L.length) { App.toast(T('Er zijn geen opmerkingen in deze presentatie.'), 'info'); return; }
    const k = L.findIndex((x) => x.c.id === CM.active);
    let next;
    if (k >= 0) {
      next = k + dir;
      if (next >= L.length || next < 0) { next = (next + L.length) % L.length; if (L.length > 1) App.toast(T(dir > 0 ? 'Verder vanaf de eerste opmerking' : 'Verder vanaf de laatste opmerking'), 'info'); }
    } else if (dir > 0) { next = L.findIndex((x) => x.si >= st.slide); if (next < 0) next = 0; }
    else { next = -1; for (let i = L.length - 1; i >= 0; i--) if (L[i].si <= st.slide) { next = i; break; } if (next < 0) next = L.length - 1; }
    setActive(L[next].c.id, { open: true });
  });
  App.def('toggleCommentMarkers', () => {
    App.settings.commentMarkers = !markersOn();
    App.saveSettings();
    App.drawSelection(); App.scheduleState();
    paneRefresh('comments');
  });
  App.stateFns.commentMarkers = () => markersOn();
  App.menuBuilders['m-delcomments'] = () => {
    const cur = App.cur(), nSlide = ((cur && cur.comments) || []).length, nAll = allComments().length;
    return `<button data-cmd="deleteComment" ${currentComment() ? '' : 'disabled'}><span class="i">delete</span> ${esc(T('Opmerking verwijderen'))}</button>
      <button data-cmd="deleteComments" data-arg="slide" ${nSlide ? '' : 'disabled'}><span class="i">delete_sweep</span> ${esc(T('Alle opmerkingen op deze dia verwijderen'))}</button>
      <button data-cmd="deleteComments" data-arg="all" ${nAll ? '' : 'disabled'}><span class="i">delete_forever</span> ${esc(T('Alle opmerkingen in deze presentatie verwijderen'))}</button>`;
  };

  /* ---------- Venster Opmerkingen ---------- */
  const avHtml = (a) => { const i = initials(a); return `<span class="cmt-av" style="background:${avColor(a)}">${i ? esc(i) : '<span class="i" style="font-size:16px">person</span>'}</span>`; };
  const ibtn = (act, icon, title, data = '') => `<button class="qb pd-ib" data-ca="${act}"${data} title="${esc(T(title))}"><span class="i">${icon}</span></button>`;
  const headHtml = (a, t, tools) => `<div class="cmt-head">${avHtml(a)}<div class="pd-who"><div class="cmt-who notranslate">${esc(who(a))}</div><div class="cmt-when">${esc(t ? when(t) : T('Nieuwe opmerking'))}</div></div>${tools}</div>`;
  const editBox = (text) => `<textarea class="pd-cmt-ta" data-ed="1">${esc(text)}</textarea><div class="cmt-actions"><button class="btn small" data-ca="editCancel">${esc(T('Annuleren'))}</button><button class="btn small primary" data-ca="editSave">${esc(T('Opslaan'))}</button></div>`;
  const anchorHtml = (o, data = '') => (o ? `<div class="pd-cmt-on" data-ca="obj"${data} title="${esc(T('Object selecteren'))}"><span class="i">subdirectory_arrow_right</span><span class="notranslate">${esc(objLabel(o))}</span></div>` : '');
  const threadHtml = (s, c) => {
    const on = c.id === CM.active, ed = CM.editing;
    const d = ` data-cid="${esc(c.id)}"`;
    const tools = (c.done ? `<span class="pd-chip-done">${esc(T('Opgelost'))}</span>` : '') + ibtn('edit', 'edit', 'Bewerken', d)
      + (c.done ? ibtn('reopen', 'replay', 'Opnieuw openen', d) : ibtn('resolve', 'check_circle', 'Draad oplossen', d)) + ibtn('del', 'delete', 'Draad verwijderen', d);
    let h = `<div class="cmt${on ? ' on' : ''}${c.done ? ' done' : ''}"${d}>` + headHtml(c.author, c.t, tools) + anchorHtml(c.obj ? findIn(s, c.obj) : null, d);
    h += ed && ed.id === c.id && !ed.rid ? editBox(ed.text) : `<div class="cmt-text notranslate">${esc(c.text)}</div>`;
    if ((c.replies || []).length) {
      h += '<div class="cmt-replies">' + c.replies.map((r) => {
        const rd = d + ` data-rid="${esc(r.id)}"`;
        return `<div class="pd-cmt-r">${headHtml(r.author, r.t, ibtn('edit', 'edit', 'Bewerken', rd) + ibtn('delr', 'close', 'Antwoord verwijderen', rd))}${ed && ed.id === c.id && ed.rid === r.id ? editBox(ed.text) : `<div class="cmt-text notranslate">${esc(r.text)}</div>`}</div>`;
      }).join('') + '</div>';
    }
    if (!c.done) {
      if (on || CM.replies[c.id]) h += `<div class="pd-cmt-rbox"><textarea class="pd-cmt-ta" data-reply="${esc(c.id)}" placeholder="${esc(T('Beantwoorden'))}">${esc(CM.replies[c.id] || '')}</textarea><div class="cmt-actions"><button class="btn small primary" data-ca="reply"${d}>${esc(T('Plaatsen'))}</button></div></div>`;
      else h += `<div class="cmt-actions pd-left"><button class="pd-link" data-ca="replyOpen"${d}>${esc(T('Beantwoorden'))}</button></div>`;
    }
    return h + '</div>';
  };
  const draftHtml = (s) => {
    const dr = CM.draft;
    return `<div class="cmt on pd-cmt-draft" data-draft="1">${headHtml(author(), 0, '')}${anchorHtml(dr.obj ? findIn(s, dr.obj) : null)}<textarea class="pd-cmt-ta" data-draft-text="1" placeholder="${esc(T('Typ een opmerking…'))}">${esc(dr.text || '')}</textarea><div class="cmt-actions"><button class="btn small" data-ca="draftCancel">${esc(T('Annuleren'))}</button><button class="btn small primary" data-ca="draftPost">${esc(T('Plaatsen'))}</button></div></div>`;
  };
  const focusLater = (sel) => setTimeout(() => {
    const ta = document.querySelector('#pane ' + sel);
    if (!ta) return;
    ta.focus({ preventScroll: true });
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch { /* niets */ }
    ta.scrollIntoView({ block: 'nearest' });
  }, 0);
  App.panes.register('comments', {
    title: 'Opmerkingen',
    render(body) {
      const P = App.pres, cur = App.cur();
      if (CM.draft && !App.slideById(CM.draft.slide)) CM.draft = null;
      if (CM.active && !findComment(CM.active)) CM.active = null;
      const groups = [];
      P.slides.forEach((s, si) => {
        let list = s.comments || [];
        if (CM.filter === 'slide' && s !== cur) list = [];
        if (CM.filter === 'open') list = list.filter((c) => !c.done || c.id === CM.active);
        const dr = !!(CM.draft && CM.draft.slide === s.id);
        if (list.length || dr) groups.push({ s, si, list, dr });
      });
      const total = allComments().length;
      let h = `<div class="pane-actions"><button class="btn small" data-ca="new" title="${esc(T('Nieuwe opmerking (Ctrl+Alt+M)'))}"><span class="i">add_comment</span>${esc(T('Nieuw'))}</button>${ibtn('prev', 'arrow_upward', 'Vorige opmerking')}${ibtn('next', 'arrow_downward', 'Volgende opmerking')}<span style="flex:1"></span>${ibtn('markers', markersOn() ? 'visibility' : 'visibility_off', markersOn() ? 'Markeringen op de dia verbergen' : 'Markeringen op de dia weergeven')}<select class="pd-sel" data-ca="filter" title="${esc(T('Weergeven'))}">${[['all', 'Alle dia\'s'], ['slide', 'Deze dia'], ['open', 'Niet opgelost']].map(([v, l]) => `<option value="${v}" ${CM.filter === v ? 'selected' : ''}>${esc(T(l))}</option>`).join('')}</select></div>`;
      if (st.view === 'master') h += `<p class="pd-note" style="margin:8px 10px">${esc(T('Opmerkingen horen bij dia\'s. Sluit het diamodel om ze op de dia te zien.'))}</p>`;
      if (!groups.length) h += `<div class="pane-empty">${esc(total && CM.filter !== 'all' ? T('Er zijn geen opmerkingen die bij dit filter passen.') : T('Er zijn nog geen opmerkingen. Selecteer een object of klik op de dia en kies Nieuw om een gesprek te beginnen.'))}</div>`;
      groups.forEach(({ s, si, list, dr }) => {
        const tt = titleText(s);
        h += `<div class="pd-cmt-slide${s === cur ? ' cur' : ''}" data-ca="slide" data-sid="${esc(s.id)}"><span>${esc(T('Dia {0}').replace('{0}', si + 1))}</span><span class="pd-t notranslate">${esc(tt)}</span><span class="pd-n">${(s.comments || []).length}</span></div>`;
        h += list.map((c) => threadHtml(s, c)).join('');
        if (dr) h += draftHtml(s);
      });
      body.innerHTML = h;
      wireComments(body);
      const f = CM.focus; CM.focus = null;
      if (f === 'draft') focusLater('[data-draft-text]');
      else if (f && f.startsWith('reply:')) focusLater(`[data-reply="${CSS.escape(f.slice(6))}"]`);
      else if (f === 'edit') focusLater('[data-ed]');
      else if (CM.scroll) { const id = CM.scroll; CM.scroll = null; setTimeout(() => { const el = document.querySelector(`#pane .cmt[data-cid="${CSS.escape(id)}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }, 0); }
    },
  });
  const postDraft = () => {
    const dr = CM.draft; if (!dr) return;
    const s = App.slideById(dr.slide);
    if (!s) { CM.draft = null; paneRefresh('comments'); return; }
    if (!cleanText(dr.text)) { App.toast(T('Typ eerst een opmerking.'), 'info'); CM.focus = 'draft'; paneRefresh('comments'); return; }
    const id = App.comments.add(s, { text: dr.text, obj: dr.obj, x: dr.x, y: dr.y });
    if (!id) return;
    CM.draft = null; CM.active = id; CM.scroll = id;
    paneRefresh('comments'); App.drawSelection();
  };
  const postReply = (id) => {
    if (!cleanText(CM.replies[id])) { CM.focus = 'reply:' + id; paneRefresh('comments'); return; }
    if (App.comments.reply(id, CM.replies[id])) { delete CM.replies[id]; CM.active = id; CM.focus = 'reply:' + id; paneRefresh('comments'); App.drawSelection(); }
  };
  const saveEdit = () => {
    const ed = CM.editing; if (!ed) return;
    if (!cleanText(ed.text)) { App.toast(T('Een opmerking kan niet leeg zijn.'), 'info'); return; }
    CM.editing = null;
    App.comments.edit(ed.id, ed.rid, ed.text);
    paneRefresh('comments');
  };
  const wireComments = (body) => {
    body.onclick = (e) => {
      if (e.target.closest('textarea, select, input')) return;
      const b = e.target.closest('[data-ca]');
      if (!b) { const card = e.target.closest('.cmt[data-cid]'); if (card && card.dataset.cid !== CM.active) setActive(card.dataset.cid); return; }
      const id = b.dataset.cid, rid = b.dataset.rid;
      switch (b.dataset.ca) {
        case 'new': App.exec('newComment'); break;
        case 'prev': App.exec('commentNav', -1); break;
        case 'next': App.exec('commentNav', 1); break;
        case 'markers': App.exec('toggleCommentMarkers'); break;
        case 'slide': { const si = App.slideIndex(b.dataset.sid); if (si >= 0) { normalView(); App.gotoSlide(si); } break; }
        case 'obj': { const h = findComment(id); if (h && h.c.obj) { CM.active = id; gotoObj(h.s.id, h.c.obj); App.drawSelection(); } break; }
        case 'edit': {
          const h = findComment(id); if (!h) break;
          const tgt = rid ? (h.c.replies || []).find((r) => r.id === rid) : h.c; if (!tgt) break;
          CM.editing = { id, rid: rid || null, text: tgt.text }; CM.active = id; CM.focus = 'edit';
          paneRefresh('comments'); App.drawSelection();
          break;
        }
        case 'editCancel': CM.editing = null; paneRefresh('comments'); break;
        case 'editSave': saveEdit(); break;
        case 'resolve': App.comments.resolve(id, true); paneRefresh('comments'); break;
        case 'reopen': App.comments.resolve(id, false); paneRefresh('comments'); break;
        case 'del': App.comments.remove(id); paneRefresh('comments'); break;
        case 'delr': App.comments.removeReply(id, rid); paneRefresh('comments'); break;
        case 'replyOpen': CM.active = id; CM.focus = 'reply:' + id; paneRefresh('comments'); App.drawSelection(); break;
        case 'reply': postReply(id); break;
        case 'draftCancel': CM.draft = null; paneRefresh('comments'); App.drawSelection(); break;
        case 'draftPost': postDraft(); break;
        default: break;
      }
    };
    body.onchange = (e) => { if (e.target.matches('[data-ca="filter"]')) { CM.filter = e.target.value; paneRefresh('comments'); } };
    body.oninput = (e) => {
      const t = e.target;
      if (t.dataset.draftText && CM.draft) CM.draft.text = t.value;
      else if (t.dataset.reply) CM.replies[t.dataset.reply] = t.value;
      else if (t.dataset.ed && CM.editing) CM.editing.text = t.value;
    };
    body.onkeydown = (e) => {
      const t = e.target; if (!t.matches('textarea')) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (t.dataset.draftText) postDraft(); else if (t.dataset.reply) postReply(t.dataset.reply); else if (t.dataset.ed) saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (t.dataset.draftText && !t.value.trim()) { CM.draft = null; paneRefresh('comments'); App.drawSelection(); }
        else if (t.dataset.ed) { CM.editing = null; paneRefresh('comments'); }
        App.focusStage();
      }
    };
  };

  /* =====================================================
     Spelling — zonder eigen woordenlijst: de browser of het systeem controleert de tekst
     die wordt bewerkt (contenteditable met spellcheck en lang). Het venster loopt alle
     tekstvakken, tabelcellen en notities langs en zet ze één voor één in bewerkmodus.
     ===================================================== */
  const SP = { items: [], i: -1, key: null, done: false };
  let IGN = null;   // woorden die in deze presentatie niet worden gecontroleerd (App.store, per presentatie)
  const ignKey = () => 'spell.ignore.' + (App.pres ? App.pres.id : '');
  const ignList = () => (App.store.get(ignKey(), []) || []).filter((w) => typeof w === 'string' && w);
  const ignSet = () => IGN || (IGN = new Set(ignList().map((w) => w.toLocaleLowerCase())));
  const spellOn = () => App.settings.spell !== false;
  const editRoot = () => (st.edit ? document.querySelector('#stage-slide [contenteditable="true"]') : null);
  const notesEl = () => $('#notes');
  const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}\p{N}'’-]*/gu;
  const WCH = /[\p{L}\p{M}\p{N}'’-]/u;

  // Tekstposities in de DOM als tekenafstand vanaf het begin (verandert niet als er spans omheen komen)
  const textNodes = (root) => { const out = []; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) out.push(n); return out; };
  const caretOf = (root) => {
    const s = window.getSelection();
    if (!s.rangeCount || !root.contains(s.anchorNode)) return null;
    const at = (node, off) => { const r = document.createRange(); r.setStart(root, 0); try { r.setEnd(node, off); } catch { return 0; } return r.toString().length; };
    return { a: at(s.anchorNode, s.anchorOffset), f: at(s.focusNode, s.focusOffset) };
  };
  const placeAt = (root, k) => {
    const ns = textNodes(root);
    let left = k;
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i], len = n.nodeValue.length;
      // aan het eind van een genegeerd woord: liever in de tekst erna (dan wordt nieuwe tekst wel gecontroleerd)
      if (left < len || (left === len && !(n.parentElement.closest('.pd-noproof') && ns[i + 1]))) return { node: n, off: left };
      left -= len;
    }
    const last = ns[ns.length - 1];
    return last ? { node: last, off: last.nodeValue.length } : { node: root, off: 0 };
  };
  const restoreCaret = (root, c) => {
    if (!c) return;
    const a = placeAt(root, c.a), f = placeAt(root, c.f);
    try { window.getSelection().setBaseAndExtent(a.node, a.off, f.node, f.off); } catch { /* niets */ }
  };
  // Woorden die niet gecontroleerd moeten worden in <span spellcheck=false> zetten (alleen in de DOM;
  // het tekstmodel blijft gelijk). Tekst met taal 'zxx' (Niet controleren) ook.
  const wrapWords = (root, words, opts = {}) => {
    if (!root) return 0;
    root.querySelectorAll('[lang="zxx"]').forEach((e) => { if (e.spellcheck !== false) e.spellcheck = false; });
    if (!words || !words.size) return 0;
    const caret = caretOf(root);
    const hits = [];
    let pos = 0;
    textNodes(root).forEach((n) => {
      const v = n.nodeValue;
      if (!n.parentElement.closest('.bu, .pd-noproof')) {
        WORD_RE.lastIndex = 0;
        let m;
        while ((m = WORD_RE.exec(v))) {
          const w = m[0].replace(/['’-]+$/, '');
          if (!words.has(w.toLocaleLowerCase())) continue;
          const a = pos + m.index, b = a + w.length;
          // tijdens het typen het woord bij de cursor niet inpakken
          if (opts.skipCaret && caret && (caret.a >= a && caret.a <= b || caret.f >= a && caret.f <= b)) continue;
          hits.push({ n, s: m.index, e: m.index + w.length });
        }
      }
      pos += v.length;
    });
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      try {
        const r = document.createRange(); r.setStart(h.n, h.s); r.setEnd(h.n, h.e);
        const sp = document.createElement('span'); sp.className = 'pd-noproof'; sp.spellcheck = false;
        r.surroundContents(sp);
      } catch { /* overslaan */ }
    }
    if (hits.length && caret) restoreCaret(root, caret);
    return hits.length;
  };
  const unwrapWord = (root, lw) => {
    if (!root) return;
    const caret = caretOf(root);
    let n = 0;
    root.querySelectorAll('.pd-noproof').forEach((sp) => { if (sp.textContent.toLocaleLowerCase() === lw) { const p = sp.parentNode; sp.replaceWith(...sp.childNodes); p.normalize(); n++; } });
    if (n && caret) restoreCaret(root, caret);
  };
  const noProofNow = (skipCaret = true) => {
    const ed = editRoot(); if (ed) wrapWords(ed, ignSet(), { skipCaret });
    const n = notesEl(); if (n && document.activeElement === n) wrapWords(n, ignSet(), { skipCaret });
  };
  const noProofSoon = App.debounce(() => noProofNow(true), 450);

  // Woord bij de cursor (of het geselecteerde woord) in de tekst die wordt bewerkt of in de notities
  const wordIn = (text, a0, b0) => {
    if (b0 > a0) { const w = text.slice(a0, b0), t = w.trim(); if (!t || /\s/.test(t)) return null; const a = a0 + w.indexOf(t); return { a, b: a + t.length }; }
    let a = a0, b = a0;
    while (a > 0 && WCH.test(text[a - 1])) a--;
    while (b < text.length && WCH.test(text[b])) b++;
    while (a < b && /['’-]/.test(text[a])) a++;
    while (b > a && /['’-]/.test(text[b - 1])) b--;
    return a < b ? { a, b } : null;
  };
  const wordAtCursor = () => {
    if (st.edit && App.textEdit.active && App.textEdit.active()) {
      const s = App.textEdit.getSel(); if (!s || s.start.p !== s.end.p) return null;
      const o = App.textEdit.obj(), cell = App.textEdit.cell();
      const body = cell ? ((o.rows[cell.r] && o.rows[cell.r].cells[cell.c]) || {}).text : o.text;
      const p = body && body.paras[s.start.p]; if (!p) return null;
      const text = p.runs.map((r) => r.t).join('');
      const w = wordIn(text, s.start.o, s.end.o); if (!w) return null;
      const run = (App.textEdit.selRuns() || [])[0] || {};
      return { kind: 'te', word: text.slice(w.a, w.b), obj: o.id, cell: cell ? { r: cell.r, c: cell.c } : null, slide: App.cur().id, start: { p: s.start.p, o: w.a }, end: { p: s.start.p, o: w.b }, lang: run.lang || App.pres.lang };
    }
    const n = notesEl(), sel = window.getSelection();
    if (n && sel.rangeCount && n.contains(sel.anchorNode) && sel.anchorNode.nodeType === 3 && sel.anchorNode === sel.focusNode) {
      const node = sel.anchorNode, text = node.nodeValue;
      const w = wordIn(text, Math.min(sel.anchorOffset, sel.focusOffset), Math.max(sel.anchorOffset, sel.focusOffset)); if (!w) return null;
      const r = document.createRange(); r.setStart(node, w.a); r.setEnd(node, w.b);
      const sp = node.parentElement && node.parentElement.closest('[lang]');
      return { kind: 'notes', word: text.slice(w.a, w.b), range: r, slide: App.cur().id, lang: (sp && n.contains(sp) && sp.lang) || App.pres.lang };
    }
    return null;
  };

  // Alle tekst van de presentatie in leesvolgorde: tekstvakken, tabelcellen (rij voor rij), notities
  const spellItems = () => {
    const out = [];
    App.pres.slides.forEach((s) => {
      const walk = (objs, hidden) => (objs || []).forEach((o) => {
        const hid = hidden || o.hidden;
        if (!hid && o.type === 'shape' && o.text && !App.isEmptyText(o)) out.push({ k: s.id + '|' + o.id, slide: s.id, obj: o.id, kind: 'shape' });
        else if (!hid && o.type === 'table') o.rows.forEach((row, r) => row.cells.forEach((cell, c) => { if (!cell.merged && cell.text && App.plainText(cell.text).trim()) out.push({ k: `${s.id}|${o.id}|${r},${c}`, slide: s.id, obj: o.id, kind: 'cell', r, c }); }));
        if (o.type === 'group') walk(o.objs, hid);
      });
      walk(s.objs, false);
      if (s.notes && App.plainText(s.notes).trim()) out.push({ k: s.id + '|notes', slide: s.id, kind: 'notes' });
    });
    return out;
  };
  const placeCaretStart = (el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
  const spellGo = (i) => {
    const it = SP.items[i]; if (!it) return;
    const si = App.slideIndex(it.slide); if (si < 0) return;
    SP.i = i; SP.key = it.k; SP.done = false;
    normalView();
    if (st.edit) App.textEdit.stop();
    if (si !== st.slide) App.gotoSlide(si);
    if (it.kind === 'notes') {
      if (App.settings.notes === false) App.exec('toggleSetting', 'notes');
      App.deselect();
      const n = notesEl();
      if (n) { n.spellcheck = spellOn(); n.focus({ preventScroll: true }); placeCaretStart(n); }
    } else {
      const o = App.obj(it.obj); if (!o) return;
      App.select([it.obj]);
      if (it.kind === 'cell') { st.cell = { id: o.id, r: it.r, c: it.c, r2: it.r, c2: it.c }; App.textEdit.cellStart(o, it.r, it.c); }
      else App.textEdit.start(it.obj, {});
      if (App.textEdit.active()) App.textEdit.setSel({ p: 0, o: 0 });
      const ed = editRoot();
      if (ed) { ed.spellcheck = spellOn(); const sc = ed.closest('.ob'); if (sc && sc.scrollIntoView) sc.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }
    noProofNow(true);
    paneRefresh('spelling');
  };
  const spellStep = (d) => {
    const key = SP.key;
    SP.items = spellItems();
    let i = SP.items.findIndex((x) => x.k === key);
    if (i < 0) i = App.clamp(SP.i - (d > 0 ? 1 : 0), -1, SP.items.length - 1);
    const n = i + d;
    if (n >= SP.items.length) {
      SP.done = true; SP.i = SP.items.length; SP.key = null;
      if (st.edit) App.textEdit.stop();
      paneRefresh('spelling');
      App.toast(T('De spellingcontrole is voltooid.'), 'ok');
      return;
    }
    if (n >= 0) spellGo(n);
  };
  const setSpell = (on) => {
    App.settings.spell = !!on; App.saveSettings();
    const ed = editRoot(); if (ed) ed.spellcheck = !!on;
    const n = notesEl(); if (n) n.spellcheck = !!on;
    App.scheduleState(); paneRefresh('spelling');
  };
  App.def('toggleSpell', () => setSpell(!spellOn()));
  App.stateFns.spellOn = () => spellOn();
  App.def('spelling', () => {
    if (!App.pres) return;
    if (st.view === 'master') { App.toast(T('Sluit eerst het diamodel om de spelling te controleren.'), 'info'); return; }
    if (st.pane === 'spelling' && SP.i >= 0 && !SP.done && SP.key) { spellStep(1); return; }   // F7 in het venster: volgende
    SP.items = spellItems(); SP.done = false; SP.key = null; SP.i = -1;
    const cur = App.cur();
    let i = -1;
    if (st.edit) { const cell = App.textEdit.cell(); i = SP.items.findIndex((x) => x.slide === cur.id && x.obj === st.edit && (!cell || (x.r === cell.r && x.c === cell.c))); }
    if (i < 0) i = SP.items.findIndex((x) => App.slideIndex(x.slide) >= st.slide);
    if (i < 0 && SP.items.length) i = 0;
    App.panes.open('spelling');
    if (i >= 0) spellGo(i); else App.toast(T('Er staat nog geen tekst in deze presentatie.'), 'info');
  });
  const spellIgnore = (all) => {
    const w = wordAtCursor();
    if (!w) { App.toast(T('Zet de cursor eerst in een woord.'), 'info'); return; }
    const lw = w.word.toLocaleLowerCase();
    if (all) {
      const list = ignList();
      if (!list.some((x) => x.toLocaleLowerCase() === lw)) { list.push(w.word); App.store.set(ignKey(), list.slice(-2000)); }
      IGN = null;
    }
    wrapWords(w.kind === 'notes' ? notesEl() : editRoot(), new Set([lw]), { skipCaret: false });
    App.toast(T(all ? '“{0}” wordt in deze presentatie niet meer gecontroleerd.' : '“{0}” wordt in deze tekst genegeerd.').replace('{0}', w.word), 'spellcheck');
    paneRefresh('spelling');
  };
  const spellUnignore = (word) => {
    const lw = String(word || '').toLocaleLowerCase();
    App.store.set(ignKey(), ignList().filter((x) => x.toLocaleLowerCase() !== lw));
    IGN = null;
    unwrapWord(editRoot(), lw); unwrapWord(notesEl(), lw);
    paneRefresh('spelling');
  };
  App.spelling = { items: () => spellItems(), go: (i) => spellGo(i), step: (d) => spellStep(d), state: () => ({ i: SP.i, key: SP.key, done: SP.done, n: SP.items.length }), ignore: spellIgnore, unignore: spellUnignore, ignored: ignList, wordAtCursor };

  // overheersende taal van een tekstlichaam (taal per run, anders die van de presentatie)
  const bodyLang = (body) => {
    const n = {};
    ((body && body.paras) || []).forEach((p) => p.runs.forEach((r) => { if (r.t) { const l = r.lang || App.pres.lang; n[l] = (n[l] || 0) + r.t.length; } }));
    const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    return best || App.pres.lang;
  };
  App.panes.register('spelling', {
    title: 'Spelling',
    render(body) {
      if (SP.i < 0 && !SP.items.length) SP.items = spellItems();
      const it = !SP.done ? SP.items[SP.i] : null;
      const s = it && App.slideById(it.slide);
      let h = `<div class="pd-box"><p class="pd-note">${esc(T('Doek gebruikt het woordenboek van je browser of systeem. Mogelijke fouten worden rood onderstreept; klik met de rechtermuisknop op een woord voor suggesties. Er wordt niets naar internet gestuurd.'))}</p>`;
      h += `<label class="chk pd-wrap"><input type="checkbox" data-sp="spell" ${spellOn() ? 'checked' : ''}> ${esc(T('Spelling controleren tijdens typen'))}</label>`;
      if (!spellOn()) h += `<p class="pd-warn">${esc(T('De spellingcontrole staat uit. Zet hem aan om mogelijke fouten te zien.'))}</p>`;
      if (SP.done) {
        h += `<div class="pd-card"><div class="pd-card-t"><span class="i pd-lvl-ok" style="vertical-align:-5px">task_alt</span> ${esc(T('De spellingcontrole is voltooid.'))}</div><div class="muted small">${esc(T('Alle tekst in de presentatie is langsgelopen.'))}</div><div class="pd-row"><button class="btn small primary" data-sp="restart">${esc(T('Opnieuw beginnen'))}</button></div></div>`;
      } else if (it && s) {
        const o = it.obj ? findIn(s, it.obj) : null;
        const cell = it.kind === 'cell' && o && o.rows[it.r] ? o.rows[it.r].cells[it.c] : null;
        const tb = it.kind === 'notes' ? s.notes : cell ? cell.text : o && o.text;
        const where = it.kind === 'notes' ? `<span>${esc(T('Notities'))}</span>` : `<span class="notranslate">${esc(objLabel(o))}</span>${cell ? ` · <span>${esc(T('rij {0}, kolom {1}').replace('{0}', it.r + 1).replace('{1}', it.c + 1))}</span>` : ''}`;
        const txt = App.plainText(tb, '\n');
        h += `<div class="pd-card"><div class="pd-card-t"><span>${esc(slideLabel(s))}</span> · ${where}</div><div class="pd-sp-text notranslate">${esc(txt.length > 400 ? txt.slice(0, 400) + '…' : txt)}</div><div class="muted small">${esc(T('Taal'))}: ${esc(App.langName(bodyLang(tb)))}</div></div>`;
        h += `<div class="pd-row"><button class="btn small" data-sp="prev" ${SP.i <= 0 ? 'disabled' : ''}><span class="i">arrow_back</span>${esc(T('Vorige'))}</button><button class="btn small primary" data-sp="next">${esc(T('Volgende'))}<span class="i">arrow_forward</span></button><span class="muted small">${esc(T('{0} van {1}').replace('{0}', SP.i + 1).replace('{1}', SP.items.length))}</span></div>`;
        const w = wordAtCursor();
        h += `<div class="pd-card"><div class="muted small">${esc(T('Woord bij de cursor'))}</div><div class="pd-sp-word notranslate">${esc(w ? w.word : '')}</div><div class="pd-row"><button class="btn small" data-sp="ignore" ${w ? '' : 'disabled'}>${esc(T('Negeren'))}</button><button class="btn small" data-sp="ignoreAll" ${w ? '' : 'disabled'}>${esc(T('Alles negeren'))}</button></div><div class="muted small">${esc(T('Negeren geldt voor deze tekst, Alles negeren voor de hele presentatie.'))}</div></div>`;
      } else if (SP.items.length) {
        h += `<div class="pd-row"><button class="btn small primary" data-sp="start">${esc(T('Beginnen'))}</button><span class="muted small">${esc(T(SP.items.length === 1 ? '1 tekst' : '{0} teksten').replace('{0}', SP.items.length))}</span></div>`;
      } else h += `<div class="muted">${esc(T('Er staat nog geen tekst in deze presentatie.'))}</div>`;
      const ig = ignList();
      if (ig.length) h += `<div><div class="muted small" style="margin-bottom:4px">${esc(T('Genegeerd in deze presentatie'))}</div><div class="pd-tags">${ig.map((x) => `<span class="pd-tag"><span class="notranslate">${esc(x)}</span><button data-sp="unignore" data-w="${esc(x)}" title="${esc(T('Weer controleren'))}"><span class="i">close</span></button></span>`).join('')}</div></div>`;
      h += `<div class="pd-row"><button class="pd-link" data-menu="m-lang">${esc(T('Taal voor de controle wijzigen…'))}</button></div></div>`;
      body.innerHTML = h;
      // knoppen houden de cursor in de tekst
      body.onmousedown = (e) => { if (e.target.closest('button[data-sp]')) e.preventDefault(); };
      body.onclick = (e) => {
        const b = e.target.closest('button[data-sp]'); if (!b) return;
        const a = b.dataset.sp;
        if (a === 'next') spellStep(1);
        else if (a === 'prev') spellStep(-1);
        else if (a === 'start' || a === 'restart') { SP.items = spellItems(); SP.done = false; if (SP.items.length) spellGo(0); else paneRefresh('spelling'); }
        else if (a === 'ignore') spellIgnore(false);
        else if (a === 'ignoreAll') spellIgnore(true);
        else if (a === 'unignore') spellUnignore(b.dataset.w);
      };
      body.onchange = (e) => { if (e.target.matches('[data-sp="spell"]')) setSpell(e.target.checked); };
    },
  });
  // het woord bij de cursor bijwerken zonder het venster opnieuw op te bouwen
  const spellWordSoon = App.debounce(() => {
    if (st.pane !== 'spelling') return;
    const el = document.querySelector('#pane .pd-sp-word'); if (!el) return;
    const w = wordAtCursor();
    el.textContent = w ? w.word : '';
    document.querySelectorAll('#pane [data-sp="ignore"], #pane [data-sp="ignoreAll"]').forEach((b) => { b.disabled = !w; });
  }, 120);
  document.addEventListener('selectionchange', () => { if (st.pane === 'spelling') spellWordSoon(); });

  /* ---------- Taal voor de spellingcontrole ---------- */
  const LANGS = [['nl-NL', 'Nederlands'], ['en-US', 'Engels (Verenigde Staten)'], ['en-GB', 'Engels (Verenigd Koninkrijk)'], ['de-DE', 'Duits'], ['fr-FR', 'Frans'], ['es-ES', 'Spaans'], ['it-IT', 'Italiaans'], ['pt-PT', 'Portugees (Portugal)'], ['zxx', 'Niet controleren']];
  App.PROOF_LANGS = LANGS;
  App.langName = (code) => { const l = LANGS.find((x) => x[0] === code) || LANGS.find((x) => code && x[0].split('-')[0] === String(code).split('-')[0] && x[0] !== 'zxx'); return l ? T(l[1]) : String(code || ''); };
  const hasTextSel = () => st.view !== 'sorter' && !!((App.textEdit.active && App.textEdit.active()) || App.selObjs().length);
  // taal van de selectie: één code, of null als die gemengd is
  const selLang = () => {
    const runs = App.curRuns ? App.curRuns() : [];
    const set = new Set(runs.map((r) => r.lang || App.pres.lang));
    return set.size === 1 ? [...set][0] : null;
  };
  const langItems = (scope, cur) => LANGS.map(([code, name]) => `<button data-cmd="proofLang" data-arg="${scope}:${code}"><span class="i" style="width:18px">${cur === code ? 'check' : ''}</span> ${esc(T(name))}</button>`).join('');
  const presLangState = () => {
    // 'zxx' als alle tekst op Niet controleren staat, anders de taal van de presentatie
    let any = false, all = true;
    App.pres.slides.forEach((s) => App.walkObjs(s.objs, (o) => { (o.text ? [o.text] : []).concat(o.type === 'table' ? o.rows.flatMap((r) => r.cells.map((c) => c.text)) : []).forEach((b) => (b && b.paras || []).forEach((p) => p.runs.forEach((r) => { if (r.t) { any = true; if (r.lang !== 'zxx') all = false; } }))); }));
    return any && all ? 'zxx' : App.pres.lang;
  };
  App.menuBuilders['m-lang'] = () => {
    if (hasTextSel()) return `<div class="menu-title">${esc(T('Taal van de selectie'))}</div>${langItems('sel', selLang())}<hr><button data-menu-sub="m-lang-all" data-cmd="noop"><span class="i">translate</span> ${esc(T('Hele presentatie'))} ›</button>`;
    return `<div class="menu-title">${esc(T('Taal van de hele presentatie'))}</div>${langItems('all', presLangState())}`;
  };
  App.menuBuilders['m-lang-all'] = () => `<div class="menu-title">${esc(T('Taal van de hele presentatie'))}</div>${langItems('all', presLangState())}`;
  const afterLang = () => {
    const ed = editRoot();
    if (ed && App.pres.lang) ed.lang = App.pres.lang;
    const n = notesEl(); if (n && App.pres.lang) n.lang = App.pres.lang;
    noProofNow(true); sbLang();
    paneRefresh('spelling'); paneRefresh('thesaurus');
  };
  // 'sel:<taal>' = geselecteerde tekst of objecten, 'all:<taal>' = alle tekst van de presentatie
  App.def('proofLang', (arg) => {
    const [scope, code] = String(arg || '').split(':');
    if (!LANGS.some((l) => l[0] === code) || !App.pres) return;
    if (ro()) { roToast(); return; }
    if (scope === 'sel' && hasTextSel()) {
      const base = App.pres.lang;
      App.applyRun((r) => { if (code === base) delete r.lang; else r.lang = code; });
      App.toast(T('Taal van de selectie: {0}').replace('{0}', App.langName(code)), 'translate');
      afterLang();
      return;
    }
    App.run(() => {
      const P = App.pres;
      const fix = (r) => { if (code === 'zxx') r.lang = 'zxx'; else delete r.lang; };
      const each = (b) => { if (b && b.paras) b.paras.forEach((p) => { p.runs.forEach(fix); if (p.end) fix(p.end); }); };
      if (code !== 'zxx') P.lang = code;
      P.slides.forEach((s) => { App.walkObjs(s.objs, (o) => { if (o.text) each(o.text); if (o.type === 'table') o.rows.forEach((row) => row.cells.forEach((c) => each(c.text))); }); each(s.notes); });
    }, { all: true });
    App.toast(T('Taal van de presentatie: {0}').replace('{0}', App.langName(code)), 'translate');
    App.updateStatus && App.updateStatus();
    afterLang();
  });
  // de statusbalk kent niet alle talen: zelf de naam zetten (en klikken opent het taalmenu)
  const sbLang = () => { const el = $('#sb-lang'); if (el && App.pres) { const n = App.langName(App.pres.lang); if (n && el.textContent !== n) el.textContent = n; } };
  const sbl = $('#sb-lang');
  if (sbl) {
    sbl.title = T('Taal voor de spellingcontrole');
    sbl.addEventListener('mousedown', (e) => e.preventDefault());   // selectie in de tekst houden
    sbl.addEventListener('click', () => { if (App.pres) App.openMenu('m-lang', sbl); });
  }

  /* =====================================================
     Synoniemen — eigen woordenlijst in js/thesaurus-data.js (pas geladen bij het eerste gebruik).
     Regelvorm: 'trefwoord: syn, syn | tweede betekenis, syn ! tegengesteld, tegengesteld'
     ===================================================== */
  const TH = { data: null, loading: null, word: '', lang: null, res: null, target: null, open: false, back: [], focusQ: false };
  const parseThes = (src) => {
    const out = {};
    Object.keys(src || {}).forEach((lang) => {
      const map = new Map(), rev = new Map();
      String(src[lang] || '').split('\n').forEach((line) => {
        const i = line.indexOf(':'); if (i < 1) return;
        const head = line.slice(0, i).trim().toLocaleLowerCase(); if (!head) return;
        let rest = line.slice(i + 1), ant = [];
        const k = rest.indexOf('!');
        if (k >= 0) { ant = rest.slice(k + 1).split(',').map((w) => w.trim()).filter(Boolean); rest = rest.slice(0, k); }
        const senses = rest.split('|').map((g) => g.split(',').map((w) => w.trim()).filter(Boolean)).filter((g) => g.length);
        const e = map.get(head);
        if (e) { e.senses.push(...senses); e.ant.push(...ant); } else map.set(head, { senses, ant });
        senses.flat().forEach((w) => { const lw = w.toLocaleLowerCase(); if (!rev.has(lw)) rev.set(lw, new Set()); rev.get(lw).add(head); });
      });
      out[lang] = { map, rev };
    });
    return out;
  };
  const thesReady = () => {
    if (TH.data) return Promise.resolve(TH.data);
    if (!TH.loading) {
      TH.loading = (App.THESAURUS_SRC ? Promise.resolve() : App.loadScript('js/thesaurus-data.js'))
        .then(() => { TH.data = parseThes(App.THESAURUS_SRC); return TH.data; })
        .catch((e) => { TH.loading = null; throw e; });
    }
    return TH.loading;
  };
  // eenvoudige, vaste vervoegingsregels (meervoud, verbuiging, werkwoordsvormen) om het trefwoord te vinden
  const stems = (w, lang) => {
    const out = [];
    const add = (x) => { if (x && x.length > 1 && x !== w && !out.includes(x)) out.push(x); };
    if (lang === 'nl') {
      const und = (x) => (/([bdfgklmnprst])\1$/.test(x) ? x.slice(0, -1) : x);          // snell → snel
      const dbl = (x) => x.replace(/(^|[^aeiou])([aeou])([bdfgklmnprstvz])$/, '$1$2$2$3');   // grot → groot
      const sgl = (x) => x.replace(/([aeou])\1([bdfgklmnprstvz])$/, '$1$2');               // maak → mak(en)
      const vf = (x) => x.replace(/v$/, 'f').replace(/z$/, 's');                           // brav → braaf
      const base = (b) => { add(b); add(und(b)); add(dbl(b)); add(vf(b)); add(dbl(vf(b))); add(b + 'en'); add(und(b) + 'en'); add(sgl(b) + 'en'); };
      ["'s", 's', 'en', 'e', 'er', 'ere', 'st', 'ste', 't', 'te', 'ten', 'de', 'den', 'd', 'tje', 'tjes', 'je', 'jes', 'ing', 'ingen', 'end', 'ende'].forEach((suf) => { if (w.endsWith(suf) && w.length - suf.length >= 2) base(w.slice(0, -suf.length)); });
      if (/^ge.{3,}[td]$/.test(w)) base(w.slice(2, -1));
      if (/^ge.{3,}en$/.test(w)) add(w.slice(2));
      add(w + 'en');
    } else {
      const base = (b) => { add(b); add(b + 'e'); if (/i$/.test(b)) add(b.slice(0, -1) + 'y'); if (/([bdfgklmnprtz])\1$/.test(b)) add(b.slice(0, -1)); };
      ["'s", 's', 'es', 'ies', 'ied', 'ed', 'd', 'ing', 'er', 'est', 'ly', 'ily', 'ness', 'ment'].forEach((suf) => { if (w.endsWith(suf) && w.length - suf.length >= 2) { const b = w.slice(0, -suf.length); base(b); if (/^(ies|ied|ily)$/.test(suf)) add(b + 'y'); } });
    }
    return out;
  };
  const uniq = (a, not) => { const seen = new Set([String(not || '').toLocaleLowerCase()]); return a.filter((x) => { const k = x.toLocaleLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };
  const thLookup = (word, lang) => {
    const D = TH.data && TH.data[lang];
    const w = String(word || '').trim().toLocaleLowerCase();
    if (!D || !w) return null;
    const head = D.map.has(w) ? w : stems(w, lang).find((x) => D.map.has(x));
    if (head) { const e = D.map.get(head); return { head, via: head !== w ? w : null, senses: e.senses.map((g) => uniq(g, w)).filter((g) => g.length), ant: uniq(e.ant, w) }; }
    // het woord staat als synoniem bij andere trefwoorden
    let heads = D.rev.get(w);
    if (!heads) { const s = stems(w, lang).find((x) => D.rev.has(x)); heads = s ? D.rev.get(s) : null; }
    if (heads && heads.size) {
      const hs = [...heads].slice(0, 6);
      const senses = hs.map((h) => { const e = D.map.get(h); const g = e.senses.find((x) => x.some((y) => y.toLocaleLowerCase() === w)) || e.senses[0] || []; return uniq([h, ...g], w).slice(0, 14); });
      return { head: w, related: true, senses, ant: uniq(hs.flatMap((h) => D.map.get(h).ant), w).slice(0, 12) };
    }
    return null;
  };
  const thSuggest = (word, lang) => {
    const D = TH.data && TH.data[lang]; const w = String(word || '').toLocaleLowerCase();
    if (!D || w.length < 3) return [];
    const p = w.slice(0, 3);
    return [...D.map.keys()].filter((k) => k.startsWith(p)).sort((a, b) => Math.abs(a.length - w.length) - Math.abs(b.length - w.length)).slice(0, 8);
  };
  const thLangOf = (code) => (/^en/i.test(code || '') ? 'en' : /^nl/i.test(code || '') ? 'nl' : null);
  const thCapture = () => {
    const w = wordAtCursor();
    TH.target = w; TH.back = [];
    if (w) { TH.word = w.word; TH.lang = thLangOf(w.lang) || TH.lang || thLangOf(App.pres.lang) || App.LANG || 'nl'; }
    else if (!TH.lang) TH.lang = thLangOf(App.pres.lang) || App.LANG || 'nl';
    TH.res = TH.data && TH.word ? thLookup(TH.word, TH.lang) : null;
  };
  const thSearch = (word, noHist) => {
    const w = String(word || '').trim();
    if (!noHist && TH.word && TH.word !== w) TH.back.push(TH.word);
    TH.word = w;
    TH.res = w && TH.data ? thLookup(w, TH.lang) : null;
    paneRefresh('thesaurus');
  };
  const matchCase = (w, like) => {
    if (!like) return w;
    if (like.length > 1 && like === like.toLocaleUpperCase() && like !== like.toLocaleLowerCase()) return w.toLocaleUpperCase();
    const f = Array.from(like)[0];
    return f && f === f.toLocaleUpperCase() && f !== f.toLocaleLowerCase() ? w.charAt(0).toLocaleUpperCase() + w.slice(1) : w;
  };
  // gekozen synoniem op de plek van het opgezochte woord zetten (via de tekstbewerking, dus ongedaan te maken)
  const thInsert = (word) => {
    const t = TH.target; if (!t) return false;
    if (ro()) { roToast(); return false; }
    const w = matchCase(word, t.word);
    const changed = () => { App.toast(T('De tekst is intussen gewijzigd. Zet de cursor opnieuw in het woord.'), 'info'); TH.target = null; paneRefresh('thesaurus'); return false; };
    if (t.kind === 'te') {
      const si = App.slideIndex(t.slide); if (si < 0) return changed();
      if (si !== st.slide || st.view !== 'normal') { normalView(); App.gotoSlide(si); }
      const o = App.obj(t.obj); if (!o) return changed();
      const body = t.cell ? ((o.rows[t.cell.r] && o.rows[t.cell.r].cells[t.cell.c]) || {}).text : o.text;
      const p = body && body.paras[t.start.p];
      if (!p || p.runs.map((r) => r.t).join('').slice(t.start.o, t.end.o) !== t.word) return changed();
      const cell = App.textEdit.cell();
      const same = App.textEdit.active() === t.obj && (t.cell ? !!cell && cell.r === t.cell.r && cell.c === t.cell.c : !cell);
      if (!same) { if (t.cell) App.textEdit.cellStart(o, t.cell.r, t.cell.c); else App.textEdit.start(t.obj, {}); }
      if (!App.textEdit.active()) return false;
      App.textEdit.setSel(t.start, t.end);
      App.textEdit.insertText(w);
      t.end = { p: t.start.p, o: t.start.o + w.length };
    } else if (t.kind === 'notes') {
      const n = notesEl();
      if (!n || !t.range || !n.contains(t.range.startContainer) || t.range.toString() !== t.word) return changed();
      n.focus({ preventScroll: true });
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(t.range);
      document.execCommand('insertText', false, w);
      const s2 = window.getSelection();
      if (s2.rangeCount && s2.focusNode && s2.focusNode.nodeType === 3 && s2.focusOffset >= w.length) { const r = document.createRange(); r.setStart(s2.focusNode, s2.focusOffset - w.length); r.setEnd(s2.focusNode, s2.focusOffset); t.range = r; } else TH.target = null;
    } else return false;
    t.word = w;
    paneRefresh('thesaurus');
    return true;
  };
  const chip = (w) => `<span class="pd-th-c"><button class="pd-th-w notranslate" data-ins="${esc(w)}" title="${esc(T(TH.target ? 'Invoegen' : 'Opzoeken'))}">${esc(w)}</button><button class="pd-th-l" data-look="${esc(w)}" title="${esc(T('Opzoeken'))}"><span class="i">search</span></button></span>`;
  App.panes.register('thesaurus', {
    title: 'Synoniemen',
    render(body) {
      if (!TH.open) { TH.open = true; thCapture(); }
      if (!TH.data) {
        body.innerHTML = `<div class="pane-empty">${esc(T('Woordenlijst laden…'))}</div>`;
        thesReady().then(() => { if (st.pane === 'thesaurus') thSearch(TH.word, true); })
          .catch(() => { if (st.pane === 'thesaurus') { const b = document.querySelector('#pane .pane-body'); if (b) b.innerHTML = `<div class="pane-empty">${esc(T('De woordenlijst kon niet worden geladen.'))}</div>`; } });
        return;
      }
      const res = TH.res, tgt = TH.target;
      let h = `<div class="pd-box"><form class="pd-th-search" data-th="form"><input type="search" data-th="q" value="${esc(TH.word)}" placeholder="${esc(T('Zoeken'))}" spellcheck="false" aria-label="${esc(T('Woord om op te zoeken'))}"><button class="qb" type="submit" title="${esc(T('Opzoeken'))}"><span class="i">search</span></button></form>`;
      h += `<div class="pd-row">${TH.back.length ? `<button class="btn small" data-th="back" title="${esc(T('Terug'))}"><span class="i">arrow_back</span>${esc(T('Terug'))}</button>` : ''}<span style="flex:1"></span><select class="pd-sel" data-th="lang" title="${esc(T('Taal van de woordenlijst'))}">${[['nl', 'Nederlands'], ['en', 'Engels']].map(([v, l]) => `<option value="${v}" ${TH.lang === v ? 'selected' : ''}>${esc(T(l))}</option>`).join('')}</select></div>`;
      if (!TH.word) h += `<div class="muted">${esc(T('Typ een woord, of zet de cursor in een woord in de tekst en druk op Shift+F7.'))}</div>`;
      else if (!res) {
        h += `<div class="muted notranslate">${esc(T('Geen synoniemen gevonden voor “{0}”.').replace('{0}', TH.word))}</div>`;
        const sug = thSuggest(TH.word, TH.lang);
        if (sug.length) h += `<div class="pd-th-sense"><div class="pd-th-lbl">${esc(T('Bedoelde je'))}</div><div class="pd-th-ws">${sug.map(chip).join('')}</div></div>`;
      } else {
        h += `<div class="pd-th-head notranslate">${esc(res.head)}</div>`;
        if (res.via) h += `<div class="muted small notranslate">${esc(T('Gevonden via “{0}”').replace('{0}', res.via))}</div>`;
        if (res.related) h += `<div class="muted small">${esc(T('Dit woord staat bij deze trefwoorden:'))}</div>`;
        res.senses.forEach((g, i) => { h += `<div class="pd-th-sense"><div class="pd-th-lbl">${esc(res.related ? T('Verwant') : res.senses.length > 1 ? T('Betekenis {0}').replace('{0}', i + 1) : T('Synoniemen'))}</div><div class="pd-th-ws">${g.map(chip).join('')}</div></div>`; });
        if (res.ant.length) h += `<div class="pd-th-sense pd-th-ant"><div class="pd-th-lbl">${esc(T('Tegengestelde woorden'))}</div><div class="pd-th-ws">${res.ant.map(chip).join('')}</div></div>`;
      }
      h += `<div class="muted small notranslate">${esc(tgt ? T('Klik op een woord om “{0}” te vervangen; het vergrootglas zoekt het woord op.').replace('{0}', tgt.word) : T('Zet de cursor in een woord in een tekstvak om het te kunnen vervangen.'))}</div>`;
      h += `<div class="muted small">${esc(T('Eigen woordenlijst van Doek; er wordt niets naar internet gestuurd.'))}</div></div>`;
      body.innerHTML = h;
      if (TH.focusQ) { TH.focusQ = false; const q = body.querySelector('[data-th="q"]'); setTimeout(() => { if (q.isConnected) { q.focus(); q.select(); } }, 0); }
      body.onmousedown = (e) => { if (e.target.closest('[data-ins], [data-look], [data-th="back"]')) e.preventDefault(); };
      body.onclick = (e) => {
        const ins = e.target.closest('[data-ins]'), look = e.target.closest('[data-look]'), back = e.target.closest('[data-th="back"]');
        if (look) thSearch(look.dataset.look);
        else if (ins) { if (TH.target) thInsert(ins.dataset.ins); else thSearch(ins.dataset.ins); }
        else if (back && TH.back.length) thSearch(TH.back.pop(), true);
      };
      body.onsubmit = (e) => { e.preventDefault(); const q = body.querySelector('[data-th="q"]'); TH.target = null; TH.focusQ = true; thSearch(q ? q.value : ''); };
      body.onchange = (e) => { if (e.target.matches('[data-th="lang"]')) { TH.lang = e.target.value; thSearch(TH.word, true); } };
    },
  });
  App.on('state', () => { if (st.pane !== 'thesaurus') TH.open = false; });
  // 'thesaurus' zonder woord: het woord bij de cursor opzoeken; met een woord: dat woord
  App.def('thesaurus', (word) => {
    if (!App.pres) return;
    if (typeof word === 'string' && word.trim()) {
      TH.open = true; TH.target = null; TH.back = []; TH.word = word.trim();
      if (!TH.lang) TH.lang = thLangOf(App.pres.lang) || App.LANG || 'nl';
      TH.res = TH.data ? thLookup(TH.word, TH.lang) : null;
      if (st.pane !== 'thesaurus') App.panes.open('thesaurus'); else paneRefresh('thesaurus');
      return;
    }
    if (st.pane === 'thesaurus') { thCapture(); paneRefresh('thesaurus'); } else App.panes.open('thesaurus');
  });
  App.thesaurus = { ready: thesReady, lookup: (w, lang) => thLookup(w, lang || 'nl'), insert: thInsert, search: (w, lang) => { if (lang) TH.lang = lang; thSearch(w); }, state: () => ({ word: TH.word, lang: TH.lang, res: TH.res, target: TH.target }) };

  /* =====================================================
     Toegankelijkheid — vaste regels, geen automatisch ingevulde beschrijvingen
     ===================================================== */
  const RULES = {
    alt: { lvl: 'err', name: 'Ontbrekende alternatieve tekst', why: 'Schermlezers lezen de alternatieve tekst voor aan mensen die de dia niet kunnen zien.' },
    title: { lvl: 'err', name: 'Ontbrekende diatitel', why: 'Met een titel weet iedereen waar een dia over gaat en kun je snel naar een dia gaan.' },
    dupTitle: { lvl: 'warn', name: 'Dubbele diatitel', why: 'Dia\'s met dezelfde titel zijn moeilijk uit elkaar te houden.' },
    contrast: { lvl: 'warn', name: 'Moeilijk leesbare tekstkleur', why: 'Tekst met te weinig contrast met de achtergrond is voor veel mensen slecht te lezen.' },
    tblHead: { lvl: 'warn', name: 'Tabel zonder koprij', why: 'Met een koprij kunnen schermlezers de kolommen benoemen.' },
    order: { lvl: 'warn', name: 'Leesvolgorde controleren', why: 'Schermlezers lezen de objecten van achter naar voor; de titel hoort als eerste.' },
    small: { lvl: 'warn', name: 'Zeer kleine tekst', why: 'Tekst kleiner dan 10 pt is op een scherm of beamer moeilijk te lezen.' },
    link: { lvl: 'warn', name: 'Onduidelijke koppelingstekst', why: 'De tekst van een koppeling moet op zichzelf duidelijk maken waar die naartoe gaat.' },
    caption: { lvl: 'tip', name: 'Video zonder ondertiteling', why: 'Controleer of de video ondertiteling heeft (in het beeld), zodat ook mensen die het geluid niet horen hem kunnen volgen.' },
  };
  const LEVELS = [['err', 'Fouten', 'error'], ['warn', 'Waarschuwingen', 'warning'], ['tip', 'Tips', 'lightbulb']];
  const ALT_TYPES = new Set(['image', 'chart', 'diagram', 'video', 'icon', 'group']);
  const VAGUE = new Set(['klik hier', 'hier', 'link', 'deze link', 'klik', 'klik op deze link', 'lees meer', 'meer', 'meer info', 'meer informatie', 'koppeling', 'deze koppeling', 'website', 'click here', 'here', 'this link', 'click', 'read more', 'more', 'more info', 'url']);
  const A11 = { cache: new Map(), collapsed: {}, mjson: null };
  const a11yIgnKey = () => 'a11y.ignore.' + (App.pres ? App.pres.id : '');
  const a11yIgn = () => new Set(App.store.get(a11yIgnKey(), []) || []);
  const itemKey = (it) => it.rule + ':' + it.slide + ':' + (it.obj || '');
  // kleuren achter de tekst: lijst van '#rrggbb' (bij een verloop alle punten), null = onbekend (afbeelding)
  const blend = (fg, a, bg) => { if (a >= 1) return fg; const f = App.hexToRgb(fg), b = App.hexToRgb(bg); return App.rgbToHex(f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a)); };
  const fillColors = (fill, th, under) => {
    if (!fill || fill.type === 'none') return under;
    if (fill.type === 'solid') { const c = App.color(fill.color, th); const a = fill.alpha === undefined ? 1 : fill.alpha; if (a >= 1) return [c]; return under ? under.map((u) => blend(c, a, u)) : null; }
    if (fill.type === 'grad') { const s = (fill.stops || []).map((x) => App.color(x.color, th)); return s.length ? s : under; }
    if (fill.type === 'pattern') return [App.color(fill.bg || 'bg1', th)];
    return null;
  };
  const slideBack = (s, th) => fillColors(App.bgOf(s), th, ['#ffffff']) || null;
  const runColor = (rs, th) => {
    const f = rs.fill;
    if (f && f.type === 'none') return null;   // onzichtbare tekst
    if (f && f.type === 'grad') return f.stops && f.stops.length ? { hex: App.color(f.stops[0].color, th), a: 1 } : null;
    const ref = f && f.type === 'solid' ? f.color : rs.color;
    const a = f && f.type === 'solid' && f.alpha !== undefined ? f.alpha : rs.alpha;
    return { hex: App.color(ref || 'tx1', th) || '#000000', a: a === undefined ? 1 : a };
  };
  // tekstlichamen van een object met de achtergrond erachter
  const bodiesFor = (o, s, th, back) => {
    if (o.type === 'shape' && o.text && !App.isEmptyText(o)) return [{ body: o.text, pobj: o, back: fillColors(App.objFill(o), th, back) }];
    if (o.type === 'table' && o.rows) {
      const f = App.tableStyle(o), nR = o.rows.length, nC = (o.cols || []).length, out = [];
      o.rows.forEach((row, r) => row.cells.forEach((cell, c) => {
        if (cell.merged || !cell.text) return;
        const cs = f(r, c, nR, nC);
        out.push({ body: cell.text, pobj: { type: 'cell' }, back: fillColors(cell.fill || cs.fill || (o.fill && o.fill.type !== 'none' ? o.fill : null), th, back), extra: { ...(cs.color ? { color: cs.color } : {}), ...(cs.b ? { b: true } : {}) } });
      }));
      return out;
    }
    return [];
  };
  const linkText = (t) => String(t || '').toLocaleLowerCase().replace(/[.,:;!?…"'“”‘’()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const textChecks = (o, s, th, back, push) => {
    const list = bodiesFor(o, s, th, back);
    if (!list.length) return;
    let worst = null, small = false, vague = null;
    list.forEach(({ body, pobj, back: bk, extra }) => {
      const scale = body.scale && body.scale.font ? body.scale.font : 1;
      const cache = {};
      body.paras.forEach((p) => {
        const ps = App.paraStyle(pobj, s, p, cache);
        let lk = null, lt = '';
        const flush = () => { if (lk && VAGUE.has(linkText(lt))) vague = vague || lt.trim(); lk = null; lt = ''; };
        p.runs.forEach((r) => {
          const key = r.link ? JSON.stringify(r.link) : null;
          if (key !== lk) { flush(); lk = key; }
          if (key) lt += r.t;
          if (!r.t || !r.t.trim()) return;
          const rs = App.runStyle(extra ? { ...extra, ...r } : r, ps);
          const sz = (rs.sz || 18) * scale;
          if (sz < 10 - 1e-6) small = true;
          const fg = bk ? runColor(rs, th) : null;
          if (fg) {
            const ratio = Math.min(...bk.map((b) => App.contrast(blend(fg.hex, fg.a, b), b)));
            const need = sz >= 18 || (sz >= 14 && rs.b) ? 3 : 4.5;
            if (ratio < need && (!worst || ratio < worst.ratio)) worst = { ratio, need };
          }
        });
        flush();
      });
    });
    if (o.link && !vague && VAGUE.has(linkText(App.objText(o)))) vague = App.objText(o).trim();
    if (worst) push('contrast', o, { ratio: r2(worst.ratio), need: worst.need });
    if (small) push('small', o);
    if (vague) push('link', o, { text: vague });
  };
  // controle van één dia (zonder de dubbele titels, die gelden voor de hele presentatie)
  const checkSlide = (s) => {
    const out = [];
    const th = App.theme(s), back = slideBack(s, th);
    const push = (rule, o, extra = {}) => out.push({ rule, lvl: RULES[rule].lvl, slide: s.id, obj: o ? o.id : null, name: o ? objLabel(o) : '', ...extra });
    const t = titleObj(s), tt = titleText(s);
    if (!tt) push('title', t, { empty: !!t });
    if (t && tt) { const first = s.objs.find((o) => !o.hidden && !o.decorative); if (first && first !== t) push('order', t); }
    const walk = (objs, inGroup) => (objs || []).forEach((o) => {
      if (o.hidden) return;
      if (ALT_TYPES.has(o.type) && !inGroup && !o.decorative && !(o.alt && o.alt.trim())) push('alt', o);
      if (o.type === 'table' && !(o.tstyle || { first: true }).first) push('tblHead', o);
      if (o.type === 'video') push('caption', o);
      textChecks(o, s, th, back, push);
      if (o.type === 'group') walk(o.objs, true);
    });
    walk(s.objs, false);
    return out;
  };
  App.a11y = {
    RULES,
    check() {
      const P = App.pres; if (!P) return { items: [], counts: { err: 0, warn: 0, tip: 0 } };
      const mj = P._mjson || null;
      if (mj !== A11.mjson) { A11.cache.clear(); A11.mjson = mj; }
      const items = [];
      const titles = new Map();
      P.slides.forEach((s) => {
        let c = A11.cache.get(s.id);
        // per dia bewaren zolang de dia niet is gewijzigd (de geschiedenis houdt de JSON bij)
        if (!c || s._dirty || !s._json || c.json !== s._json) { c = { json: s._dirty ? null : s._json, items: checkSlide(s) }; A11.cache.set(s.id, c); }
        items.push(...c.items);
        const tt = titleText(s).toLocaleLowerCase().replace(/\s+/g, ' ');
        if (tt) { if (!titles.has(tt)) titles.set(tt, []); titles.get(tt).push(s); }
      });
      titles.forEach((list) => { if (list.length > 1) list.forEach((s) => { const t = titleObj(s); items.push({ rule: 'dupTitle', lvl: 'warn', slide: s.id, obj: t ? t.id : null, name: titleText(s), n: list.length }); }); });
      const ign = a11yIgn();
      const order = new Map(P.slides.map((s, i) => [s.id, i]));
      const out = items.map((it) => ({ ...it, key: itemKey(it) })).filter((it) => !ign.has(it.key)).sort((a, b) => order.get(a.slide) - order.get(b.slide));
      const counts = { err: 0, warn: 0, tip: 0 };
      out.forEach((it) => { counts[it.lvl]++; });
      return { items: out, counts };
    },
    fix: (it, kind) => a11yFix(it, kind),
  };
  // snelle oplossingen per regel: [soort, label]
  const FIXES = {
    alt: (it) => [['alt', 'Alt-tekst toevoegen'], ['dec', 'Markeren als decoratief']],
    title: (it) => (it.empty ? [['title', 'Titel toevoegen']] : [['title', 'Titel toevoegen'], ['htitle', 'Verborgen titel toevoegen']]),
    dupTitle: () => [['edit', 'Titel bewerken']],
    contrast: () => [['contrast', 'Tekstkleur aanpassen'], ['ignore', 'Negeren']],
    tblHead: () => [['head', 'Koprij inschakelen']],
    order: () => [['order', 'Titel als eerste lezen']],
    small: () => [['small', 'Vergroten tot 10 pt'], ['ignore', 'Negeren']],
    link: () => [['edit', 'Tekst bewerken'], ['ignore', 'Negeren']],
    caption: () => [['ignore', 'Negeren']],
  };
  const setTitle = (s, text, hidden) => {
    let t = titleObj(s);
    if (!t) {
      // nieuwe titel-placeholder krijgt de plaats van de indeling of de master; vooraan = als eerste gelezen
      t = { id: App.uid('o'), type: 'shape', geom: 'rect', name: ((App.PH_NAMES && App.PH_NAMES.title) || 'Titel') + ' 1', ph: { type: 'title' }, text: { paras: [App.emptyPara()] } };
      if (hidden) t.hidden = true;
      s.objs.unshift(t);
    }
    t.text = { ...(t.text || {}), paras: [{ runs: [{ t: text }] }] };
    delete t.text.scale;
  };
  const eachRunFix = (o, s, fn) => {
    const th = App.theme(s), back = slideBack(s, th);
    bodiesFor(o, s, th, back).forEach(({ body, pobj, back: bk, extra }) => {
      const scale = body.scale && body.scale.font ? body.scale.font : 1;
      body.paras.forEach((p) => { const ps = App.paraStyle(pobj, s, p); p.runs.forEach((r) => { if (r.t && r.t.trim()) fn(r, App.runStyle(extra ? { ...extra, ...r } : r, ps), bk, scale, th); }); });
    });
  };
  const fixContrast = (o, s) => eachRunFix(o, s, (r, rs, bk, scale, th) => {
    if (!bk) return;
    const fg = runColor(rs, th); if (!fg) return;
    const sz = (rs.sz || 18) * scale, need = sz >= 18 || (sz >= 14 && rs.b) ? 3 : 4.5;
    if (Math.min(...bk.map((b) => App.contrast(blend(fg.hex, fg.a, b), b))) >= need) return;
    // zwart of wit, wat het meeste contrast geeft met alle achtergrondkleuren
    const score = (c) => Math.min(...bk.map((b) => App.contrast(c, b)));
    r.color = score('#000000') >= score('#ffffff') ? '#000000' : '#ffffff';
    delete r.alpha;
    if (r.fill && r.fill.type !== 'grad') delete r.fill;
  });
  const fixSmall = (o, s) => eachRunFix(o, s, (r, rs, bk, scale) => { if ((rs.sz || 18) * scale < 10) r.sz = Math.ceil((10 / scale) * 2) / 2; });
  const a11yGoto = (it) => gotoObj(it.slide, it.obj);
  const a11yFix = async (it, kind) => {
    const s = App.slideById(it.slide); if (!s) return false;
    const o = it.obj ? findIn(s, it.obj) : null;
    if (ro() && kind !== 'ignore') { roToast(); return false; }
    switch (kind) {
      case 'alt': a11yGoto(it); if (o) App.exec('altText'); return true;
      case 'dec': if (!o) return false; edit(s, () => { o.decorative = true; delete o.alt; }); break;
      case 'title': case 'htitle': {
        a11yGoto({ slide: it.slide, obj: null });
        const v = await App.prompt(T(kind === 'htitle' ? 'Verborgen titel toevoegen' : 'Titel toevoegen'), T('Titel van de dia'), '', { hint: esc(T(kind === 'htitle' ? 'Een verborgen titel is niet te zien in de voorstelling, maar schermlezers en het overzicht gebruiken hem wel.' : 'De titel komt op de plaats van de titel in de indeling.')) });
        if (v === null || !v.trim()) return false;
        const s2 = App.slideById(it.slide); if (!s2) return false;
        edit(s2, () => setTitle(s2, v.trim().slice(0, 500), kind === 'htitle'));
        break;
      }
      case 'head': if (!o) return false; edit(s, () => { o.tstyle = { id: 'medium2:accent1', bandR: true, ...(o.tstyle || {}), first: true }; }); break;
      case 'order': if (!o) return false; edit(s, () => { const i = s.objs.indexOf(o); if (i > 0) { s.objs.splice(i, 1); s.objs.unshift(o); } }); break;
      case 'contrast': if (!o) return false; edit(s, () => fixContrast(o, s)); break;
      case 'small': if (!o) return false; edit(s, () => fixSmall(o, s)); break;
      case 'edit': a11yGoto(it); if (o && o.type === 'shape' && App.obj(o.id)) App.textEdit.start(o.id, { selectAll: true }); return true;
      case 'ignore': { const ign = a11yIgn(); ign.add(it.key || itemKey(it)); App.store.set(a11yIgnKey(), [...ign].slice(-5000)); break; }
      default: return false;
    }
    paneRefresh('a11y'); sbA11y.now();
    return true;
  };
  App.panes.register('a11y', {
    title: 'Toegankelijkheid',
    render(body) {
      const { items, counts } = App.a11y.check();
      const total = items.length;
      let h = `<div class="pd-a11y-sum">${total ? `<span class="i pd-lvl-${counts.err ? 'err' : counts.warn ? 'warn' : 'tip'}">${counts.err ? 'error' : counts.warn ? 'warning' : 'lightbulb'}</span><div>${esc([[counts.err, '1 fout', '{0} fouten'], [counts.warn, '1 waarschuwing', '{0} waarschuwingen'], [counts.tip, '1 tip', '{0} tips']].filter((x) => x[0]).map(([n, one, more]) => T(n === 1 ? one : more).replace('{0}', n)).join(' · '))}<div class="muted small">${esc(T('Klik op een onderdeel om ernaartoe te gaan.'))}</div></div>` : `<span class="i pd-lvl-ok">task_alt</span><div><b>${esc(T('Geen problemen gevonden'))}</b><div class="muted small">${esc(T('Mensen met een beperking kunnen deze presentatie waarschijnlijk goed gebruiken.'))}</div></div>`}</div>`;
      LEVELS.forEach(([lvl, label, icon]) => {
        const list = items.filter((it) => it.lvl === lvl); if (!list.length) return;
        let inner = '';
        Object.keys(RULES).filter((r) => RULES[r].lvl === lvl).forEach((rule) => {
          const rl = list.filter((it) => it.rule === rule); if (!rl.length) return;
          inner += `<div class="pd-a11y-rule"><b>${esc(T(RULES[rule].name))}</b> <span class="pd-n">${rl.length}</span><div class="pd-a11y-why">${esc(T(RULES[rule].why))}</div></div>`;
          rl.forEach((it) => {
            const s = App.slideById(it.slide);
            const what = it.rule === 'title' ? T(it.empty ? 'Lege titel' : 'Geen titel') : it.name;
            const extra = it.rule === 'contrast' ? ` · ${App.fmtNum ? App.fmtNum(it.ratio, 1) : it.ratio}:1` : '';
            inner += `<div class="pd-a11y-it" data-k="${esc(it.key)}"><span class="i pd-lvl-${lvl}" style="font-size:16px">${icon}</span><span class="grow${it.rule === 'title' ? '' : ' notranslate'}">${esc(what)}${esc(extra)}</span><span class="pd-where">${esc(s ? slideLabel(s) : '')}</span></div>`;
            inner += `<div class="pd-a11y-fix">${(FIXES[rule] ? FIXES[rule](it) : []).map(([k, l]) => `<button class="btn small" data-fix="${k}" data-k="${esc(it.key)}">${esc(T(l))}</button>`).join('')}</div>`;
          });
        });
        h += `<details class="ps" data-lvl="${lvl}" ${A11.collapsed[lvl] ? '' : 'open'}><summary>${esc(T(label))} (${list.length})</summary><div class="ps-body" style="padding-left:12px;gap:0">${inner}</div></details>`;
      });
      if (a11yIgn().size) h += `<div class="pd-box" style="padding-top:8px"><button class="pd-link" data-a11y="unignore">${esc(T('Genegeerde meldingen weer tonen ({0})').replace('{0}', a11yIgn().size))}</button></div>`;
      body.innerHTML = h;
      const byKey = new Map(items.map((it) => [it.key, it]));
      body.onclick = (e) => {
        const fx = e.target.closest('[data-fix]');
        if (fx) { const it = byKey.get(fx.dataset.k); if (it) a11yFix(it, fx.dataset.fix); return; }
        if (e.target.closest('[data-a11y="unignore"]')) { App.store.del(a11yIgnKey()); paneRefresh('a11y'); sbA11y.now(); return; }
        const row = e.target.closest('.pd-a11y-it');
        if (row) { const it = byKey.get(row.dataset.k); if (it) a11yGoto(it); }
      };
      body.querySelectorAll('details[data-lvl]').forEach((d) => d.addEventListener('toggle', () => { A11.collapsed[d.dataset.lvl] = !d.open; }));
    },
  });
  // statusbalk: "in orde" / "onderzoeken" (na een korte pauze bijgewerkt)
  const sbA11yRun = () => {
    const el = $('#sb-a11y'); if (!el || !App.pres) return;
    const { counts } = App.a11y.check();
    const bad = counts.err + counts.warn;
    const span = el.querySelectorAll(':scope > span')[1] || el.lastElementChild;
    const txt = T(bad ? 'Toegankelijkheid: onderzoeken' : 'Toegankelijkheid: in orde');
    if (span && span.textContent !== txt) span.textContent = txt;
    el.classList.toggle('pd-a11y-bad', bad > 0);
    el.title = bad ? T(bad === 1 ? '1 probleem met de toegankelijkheid gevonden' : '{0} problemen met de toegankelijkheid gevonden').replace('{0}', bad) : T('Geen problemen met de toegankelijkheid gevonden');
    el.dataset.n = bad;
  };
  const sbA11y = App.debounce(sbA11yRun, 700);
  sbA11y.now = () => { sbA11y.cancel(); sbA11yRun(); };
  App.a11y.status = () => sbA11y.now();

  /* @@VERVOLG@@ */
})();
