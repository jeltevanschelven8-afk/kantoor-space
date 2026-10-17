/* =========================================================
   Doek (gemaakt door JJ van Schelven) — Delen
   Knop Delen rechtsboven met dezelfde keuzes als in Inkt en Cel: koppeling
   delen (iedereen met de koppeling kan bewerken of weergeven, met optionele
   code), koppeling kopiëren of e-mailen, een kopie verzenden (.pptx of PDF)
   en toegang beheren. Geen account nodig: de koppeling werkt voor iedereen op
   hetzelfde netwerk zolang het programma openstaat.
   Gelijktijdig bewerken wordt per dia en per object samengevoegd.
   ========================================================= */
'use strict';

(() => {
  const APPNAME = 'Doek';
  const st = App.state;

  /* ---------- Toestand van de huidige presentatie ---------- */
  const getShare = () => (App.pres && App.pres.share) || null;
  const setShare = (s) => { if (s) App.pres.share = s; else delete App.pres.share; };
  const docTitle = () => App.pres.title;
  const whoAmI = () => (App.settings.author ? App.settings.author : (App.share.info && App.share.info.host) || APPNAME);

  // Inhoud als tekst (met afbeeldingen en media, zonder de deelgegevens zelf)
  const packDoc = () => JSON.stringify(App.serializePres({ noShare: true }));
  const parseData = (data) => (typeof data === 'string' ? JSON.parse(data) : data);
  const unpackDoc = (data, keep) => {
    const slideId = App.cur() && App.cur().id, sel = st.sel.slice(), view = st.view;
    const P = App.deserializePres(data, { keepShare: false });
    P.id = App.pres.id; if (keep) P.share = keep;
    const i = P.slides.findIndex((s) => s.id === slideId);
    App.loadPres(P, { slide: i >= 0 ? i : Math.min(st.slide, P.slides.length - 1), warnFonts: false, fileHandle: App.fileHandle, fileKind: App.fileKind });
    const keepSel = sel.filter((id) => App.obj(id));
    if (keepSel.length) App.select(keepSel);
    if (view === 'sorter' || view === 'notes') App.setView && App.setView(view);
    App.pres.dirty = false;
  };

  /* ---------- Samenvoegen bij gelijktijdige wijzigingen ----------
     De server weigert een PUT (409) als iemand anders intussen een nieuwere versie heeft opgeslagen.
     Dan voegen we samen: basis = de versie die we het laatst met de server deelden, lokaal = onze presentatie,
     extern = de nieuwe versie. Volgorde van dia's en objecten met een diff3-achtige aanpak; per dia en per object
     wint wat lokaal is gewijzigd, de rest komt van de ander. */
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  // Verschillen tussen twee lijsten (LCS): gebieden {as, ae, bs, be} waar a[as..ae) is vervangen door b[bs..be)
  const diffHunks = (a, b) => {
    const n = a.length, m = b.length;
    let p = 0; while (p < n && p < m && a[p] === b[p]) p++;
    let s = 0; while (s < n - p && s < m - p && a[n - 1 - s] === b[m - 1 - s]) s++;
    const A = a.slice(p, n - s), B = b.slice(p, m - s), N = A.length, M = B.length;
    if (!N && !M) return [];
    if (N * M > 4e6) return [{ as: p, ae: n - s, bs: p, be: m - s }];
    const W = M + 1, dp = new Uint32Array((N + 1) * W);
    for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) dp[i * W + j] = A[i] === B[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    const hunks = []; let i = 0, j = 0, hs = null;
    const close = () => { if (hs) { hunks.push({ as: hs[0] + p, ae: i + p, bs: hs[1] + p, be: j + p }); hs = null; } };
    while (i < N || j < M) {
      if (i < N && j < M && A[i] === B[j]) { close(); i++; j++; }
      else { if (!hs) hs = [i, j]; if (j < M && (i >= N || dp[i * W + j + 1] >= dp[(i + 1) * W + j])) j++; else i++; }
    }
    close();
    return hunks;
  };
  const mergeBlocks = (base, local, remote) => {
    if (base === null) return local;   // geen basis bekend: lokaal wint
    const hl = diffHunks(base, local).map((h) => ({ ...h, side: 'l' }));
    const hr = diffHunks(base, remote).map((h) => ({ ...h, side: 'r' }));
    if (!hl.length) return remote;
    if (!hr.length) return local;
    const lpos = (b, isEnd) => b + hl.reduce((acc, h) => (h.ae <= b && !(isEnd && h.as === b && h.ae === b) ? acc + (h.be - h.bs) - (h.ae - h.as) : acc), 0);
    const all = [...hl, ...hr].sort((x, y) => x.as - y.as || x.ae - y.ae);
    const out = []; let pos = 0, i = 0;
    while (i < all.length) {
      let S = all[i].as, E = all[i].ae; const group = [all[i]]; i++;
      while (i < all.length && (all[i].as < E || (all[i].as === S && all[i].ae === E))) { E = Math.max(E, all[i].ae); group.push(all[i]); i++; }
      out.push(...base.slice(pos, S));
      const sides = new Set(group.map((h) => h.side));
      if (sides.size === 1) { const h = group[0]; out.push(...(h.side === 'l' ? local : remote).slice(h.bs, h.be)); }
      else if (S === E) group.filter((h) => h.side === 'r').concat(group.filter((h) => h.side === 'l')).forEach((h) => out.push(...(h.side === 'l' ? local : remote).slice(h.bs, h.be)));
      else out.push(...local.slice(lpos(S, false), lpos(E, true)));   // overlappende wijziging: wie nu werkt wint
      pos = E;
    }
    out.push(...base.slice(pos));
    return out.filter((x, k, a) => a.indexOf(x) === k);   // geen dubbele id's
  };
  // lijsten met id's samenvoegen; pick(b, l, r) kiest de inhoud per id
  const mergeList = (base, local, remote, pick) => {
    const B = new Map((base || []).map((x) => [x.id, x])), L = new Map(local.map((x) => [x.id, x])), R = new Map(remote.map((x) => [x.id, x]));
    const ids = mergeBlocks(base ? base.map((x) => x.id) : null, local.map((x) => x.id), remote.map((x) => x.id));
    // lokaal gewijzigd maar door de ander verwijderd: lokaal houden, op de lokale plek
    local.forEach((x, k) => {
      if (ids.includes(x.id) || !B.has(x.id) || same(x, B.get(x.id))) return;
      const prev = local.slice(0, k).reverse().find((y) => ids.includes(y.id));
      ids.splice(prev ? ids.indexOf(prev.id) + 1 : 0, 0, x.id);
    });
    return ids.map((id) => { const b = B.get(id), l = L.get(id), r = R.get(id); if (l && r) return pick(b, l, r); return l || r; }).filter(Boolean);
  };
  const pickObj = (b, l, r) => (b && same(l, b) ? r : l);
  const mergeSlide = (b, l, r) => {
    if (!b || same(r, b)) return l;
    if (same(l, b)) return r;
    const out = { ...r };
    Object.keys(l).forEach((k) => { if (k !== 'objs' && k !== 'anims' && !same(l[k], b[k])) out[k] = l[k]; });
    Object.keys(b).forEach((k) => { if (k !== 'objs' && k !== 'anims' && !(k in l) && same(r[k], b[k])) delete out[k]; });
    out.objs = mergeList(b.objs || [], l.objs || [], r.objs || [], pickObj);
    out.anims = !same(l.anims, b.anims) ? l.anims : r.anims;
    const ids = new Set(); App.walkObjs(out.objs, (o) => ids.add(o.id));
    out.anims = (out.anims || []).filter((a) => ids.has(a.obj));
    return out;
  };
  const mergeDoek = (base, local, remote) => {
    const out = { ...remote };
    ['title', 'size', 'sections', 'shows', 'hf', 'show', 'guides', 'lang', 'props'].forEach((k) => { if (!same(local[k], base && base[k])) out[k] = local[k]; });
    out.masters = mergeList(base ? base.masters : null, local.masters || [], remote.masters || [], (b, l, r) => (b && same(l, b) ? r : l));
    out.slides = mergeList(base ? base.slides : null, local.slides || [], remote.slides || [], mergeSlide);
    if (!out.slides.length) out.slides = local.slides;
    out.media = { ...(remote.media || {}), ...(local.media || {}) };
    return out;
  };
  const mergeDocs = (base, local, remote) => {
    try { return mergeDoek(base, local, remote); } catch (e) { console.warn('Samenvoegen mislukt, lokale versie gebruikt', e); return local; }
  };
  App.mergeShared = { docs: mergeDocs, blocks: mergeBlocks };   // ook te gebruiken voor tests

  /* ---------- Server vinden ---------- */
  App.share = { info: null, pending: null, lastEdit: 0, syncing: false };
  App.share.server = () => {
    if (App.share.pending) return App.share.pending;
    App.share.pending = (async () => {
      let base = null;
      if (window.KANTOOR_SERVER) base = window.KANTOOR_SERVER;
      else if (window.chrome && window.chrome.webview) {
        // Windows-programma: de ingebouwde server vragen om te starten
        base = await new Promise((res) => {
          const t = setTimeout(() => res(null), 4000);
          const on = (e) => { try { const m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (m && m.server) { clearTimeout(t); window.chrome.webview.removeEventListener('message', on); window.KANTOOR_SERVER = m.server; res(m.server); } } catch { /* niets */ } };
          window.chrome.webview.addEventListener('message', on);
          window.chrome.webview.postMessage('deel-server');
        });
      } else if (/^https?:$/.test(location.protocol) && !/\.local$/.test(location.hostname)) base = location.origin;
      if (base) {
        try { App.share.info = await (await fetch(base + '/deel/info', { cache: 'no-store' })).json(); } catch { base = null; }
      }
      App.share.pending = null;
      return base;
    })();
    return App.share.pending;
  };
  const api = async (base, method, p, body, share) => {
    const h = { 'Content-Type': 'application/json' };
    if (share && share.owner) h['X-Eigenaar'] = share.owner;
    if (share && share.code) h['X-Code'] = share.code;
    const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.fout || ('Fout ' + r.status)); e.status = r.status; e.body = j; throw e; }
    return j;
  };
  const noServer = () => App.dialog({
    title: App.t('Delen'),
    body: `<p style="line-height:1.55;margin:0 0 8px">${App.t('Delen via een koppeling werkt alleen als Doek via de server draait: start start-doek.bat (of het programma Doek.exe) en probeer het dan opnieuw.')}</p>
      <p class="muted small" style="line-height:1.5;margin:0">${App.t('Je kunt de presentatie wel altijd als bestand versturen via Delen › Een kopie verzenden.')}</p>`,
    buttons: [{ label: 'Een kopie verzenden', action: () => setTimeout(() => App.exec('shareCopy'), 0) }, { label: 'Sluiten', primary: true }],
  });

  /* ---------- Synchroniseren ---------- */
  let pushTimer = null, pollTimer = null, known = 0, baseData = null, pushing = false, pushAgain = false;
  const schedulePush = () => {
    const s = getShare(); if (!s || (s.perm === 'view' && !s.owner)) return;
    App.share.lastEdit = Date.now();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1500);
  };
  const push = async () => {
    const s = getShare(); if (!s) return;
    const base = s.server; if (!base) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true;
    try {
      let data = packDoc();
      try {
        const r = await api(base, 'PUT', '/deel/' + s.id, { data, title: docTitle(), base: known || undefined }, s);
        known = r.version;
      } catch (e) {
        if (e.status !== 409 || !e.body || e.body.data === undefined) throw e;
        // iemand anders was ons voor: samenvoegen en opnieuw versturen
        const merged = mergeDocs(baseData ? parseData(baseData) : null, parseData(data), parseData(e.body.data));
        data = JSON.stringify(merged);
        App.share.syncing = true;
        try { unpackDoc(merged, s); } finally { App.share.syncing = false; }
        const r = await api(base, 'PUT', '/deel/' + s.id, { data, title: docTitle(), base: e.body.version }, s);
        known = r.version;
        App.toast(App.t('Wijzigingen van {0} samengevoegd').replace('{0}', s.by && !s.owner ? s.by : App.t('een ander')), 'merge_type', { ms: 3000 });
      }
      baseData = data;
      setState('ok');
    } catch (e) {
      if (e.status === 404) stopLocal(App.t('Deze koppeling bestaat niet meer: de eigenaar is gestopt met delen.'));
      else if (e.status === 403) { s.perm = 'view'; setState('view'); App.toast(App.t('Je mag deze presentatie alleen nog bekijken.'), 'lock'); }
      else setState('offline');
    } finally {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(); }
    }
  };
  const poll = async () => {
    const s = getShare(); if (!s || !s.server) return;
    try {
      const v = await api(s.server, 'GET', '/deel/' + s.id + '/versie', undefined, s);
      if (v.perm !== s.perm && !s.owner) { s.perm = v.perm; setState(v.perm === 'view' ? 'view' : 'ok'); App.scheduleState(); }
      if (v.version !== known) {
        const busy = !!st.edit || !!(App.showActive && App.showActive()) || Date.now() - App.share.lastEdit < 2500 || App.pres.dirty || !!document.querySelector('.backdrop');
        if (busy) { if (App.pres.dirty) push(); return; }
        const full = await api(s.server, 'GET', '/deel/' + s.id, undefined, s);
        known = full.version; baseData = typeof full.data === 'string' ? full.data : JSON.stringify(full.data);
        App.share.syncing = true;
        try { unpackDoc(parseData(full.data), s); } finally { App.share.syncing = false; }
        setState('ok');
      } else setState(s.perm === 'view' && !s.owner ? 'view' : 'ok');
    } catch (e) {
      if (e.status === 404) stopLocal(App.t('Deze koppeling bestaat niet meer: de eigenaar is gestopt met delen.'));
      else setState('offline');
    }
  };
  const startSync = () => { clearInterval(pollTimer); pollTimer = setInterval(poll, 4000); };
  const stopLocal = (msg) => { clearInterval(pollTimer); pollTimer = null; setShare(null); setState(null); if (msg) App.toast(msg, 'link_off', { ms: 6000 }); App.markDirty(); App.scheduleState(); };
  const setState = (k) => {
    const el = $('#share-state'); if (!el) return;
    const s = getShare();
    if (!s || !k) { el.hidden = true; return; }
    el.hidden = false;
    const txt = { ok: s.owner ? 'Gedeeld' : 'Gedeeld met jou', view: 'Alleen bekijken', offline: 'Geen verbinding' }[k] || 'Gedeeld';
    el.innerHTML = `<span class="i">${k === 'offline' ? 'cloud_off' : k === 'view' ? 'visibility' : 'people'}</span>${App.esc(App.t(txt))}`;
    el.className = 'share-chip ' + k;
  };
  // wijzigingen doorsturen
  const origDirty = App.markDirty;
  App.markDirty = (...a) => { origDirty(...a); if (!App.share.syncing) schedulePush(); };
  // bij het laden van een andere presentatie: synchronisatie van de vorige stoppen
  const origLoad = App.loadPres;
  App.loadPres = (...a) => {
    const r = origLoad(...a);
    if (App.share.syncing) return r;   // laden door de synchronisatie zelf: versie niet vergeten
    const s = getShare();
    clearInterval(pollTimer); pollTimer = null; known = 0; baseData = null;
    if (s && s.server) { startSync(); setState(s.perm === 'view' && !s.owner ? 'view' : 'ok'); poll(); } else setState(null);
    return r;
  };

  /* ---------- Gedeeld met mij (lijst op het startscherm) ---------- */
  App.sharedWithMe = () => App.store.get('gedeeld', []) || [];
  const rememberShared = (s, link) => {
    const list = App.sharedWithMe().filter((x) => x.id !== s.id);
    list.unshift({ id: s.id, title: s.title, link, by: s.by, perm: s.perm, app: APPNAME, opened: Date.now() });
    App.store.set('gedeeld', list.slice(0, 100));
  };
  App.forgetShared = (id) => App.store.set('gedeeld', App.sharedWithMe().filter((x) => x.id !== id));

  /* ---------- Koppeling openen (?deel=…) ---------- */
  const openFromLink = async () => {
    const q = new URLSearchParams(location.search);
    const id = q.get('deel'); if (!id) return false;
    const base = location.origin;
    const code = q.get('code') || '';
    let full;
    try { full = await api(base, 'GET', '/deel/' + id, undefined, { code }); } catch (e) {
      if (e.status === 403 && e.body && e.body.fout === 'code') {
        const c = await App.prompt(App.t('Gedeelde presentatie'), App.t('Voor “{0}” is een code nodig. Vraag die aan degene die de presentatie deelt.').replace('{0}', e.body.title || ''), '');
        if (c === null) return true;
        q.set('code', c); history.replaceState(null, '', location.pathname + '?' + q.toString());
        return openFromLink();
      }
      App.dialog({ title: App.t('Koppeling openen'), body: `<p style="line-height:1.5">${App.esc(e.message)}</p>` });
      history.replaceState(null, '', location.pathname);
      return true;
    }
    const share = { id, server: base, code, perm: full.perm, by: full.by, link: full.link };
    let P;
    try { P = App.deserializePres(parseData(full.data), { keepShare: false }); } catch (e) { App.toast(App.t('Deze gedeelde presentatie kan niet worden gelezen.'), 'error'); history.replaceState(null, '', location.pathname); return true; }
    P.id = App.uid('p'); P.share = share;
    App.loadPres(P);
    known = full.version; baseData = typeof full.data === 'string' ? full.data : JSON.stringify(full.data);
    rememberShared(full, full.link);
    App.closeBackstage && App.closeBackstage();
    history.replaceState(null, '', location.pathname);
    App.toast(App.t(full.perm === 'view' ? 'Gedeelde presentatie geopend · alleen bekijken' : 'Gedeelde presentatie geopend · je kunt meewerken') + (full.by ? ' (' + full.by + ')' : ''), 'people', { ms: 5000 });
    return true;
  };

  /* ---------- Knop en menu ---------- */
  const tbr = $('#titlebar .tb-right');
  if (tbr && !$('.share-btn')) tbr.insertAdjacentHTML('afterbegin', `<span id="share-state" class="share-chip" hidden></span><button class="share-btn" data-menu="m-share" title="Delen (Alt+S)"><span class="i">share</span><span>Delen</span><span class="i caret">arrow_drop_down</span></button>`);
  App.menuBuilders['m-share'] = () => {
    const s = getShare();
    return `<button data-cmd="shareLink"><span class="i">link</span> ${App.t(s ? 'Koppeling en toegang' : 'Delen via koppeling')}</button>
      <button data-cmd="shareCopy"><span class="i">attach_email</span> ${App.t('Een kopie verzenden')}</button>
      <button data-cmd="shareManage"><span class="i">manage_accounts</span> ${App.t('Toegang beheren')}</button>
      ${s && s.owner ? `<hr><button data-cmd="shareStop"><span class="i">link_off</span> ${App.t('Stoppen met delen')}</button>` : s ? `<hr><button data-cmd="shareLeave"><span class="i">logout</span> ${App.t('Koppeling loslaten (eigen kopie houden)')}</button>` : ''}`;
  };
  App.def('shareMenu', (arg, el) => App.openMenu('m-share', el || $('.share-btn')));
  App.stateFns.shared = () => !!getShare();

  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); App.toast(App.t('Koppeling gekopieerd'), 'ok'); } catch { App.prompt(App.t('Koppeling'), App.t('Kopieer deze koppeling:'), t); } };
  const mailLink = (link, title) => { location.href = `mailto:?subject=${encodeURIComponent(title + ' (' + App.t('gedeeld via Doek') + ')')}&body=${encodeURIComponent(App.t('Ik deel “{0}” met je. Open deze koppeling op hetzelfde netwerk:').replace('{0}', title) + '\n' + link + '\n')}`; };

  App.def('shareLink', async () => {
    if (st.edit) App.textEdit.stop();
    const base = await App.share.server();
    if (!base) { noServer(); return; }
    const s = getShare();
    const render = (d) => {
      const sh = getShare();
      const body = d.$('#sh-body');
      if (!sh) {
        body.innerHTML = `<div class="sh-doc"><span class="i">co_present</span><div><b>${App.esc(docTitle())}</b><small>${App.t('Iedereen op dit netwerk die de koppeling heeft')}</small></div></div>
          <div class="sh-perm"><span class="i">public</span><select id="sh-perm"><option value="edit">${App.t('Iedereen met de koppeling kan bewerken')}</option><option value="view">${App.t('Iedereen met de koppeling kan weergeven')}</option></select></div>
          <label class="field"><span>${App.t('Code (optioneel — alleen wie de code weet, kan openen)')}</span><input id="sh-code" placeholder="${App.esc(App.t('bijv. 1234'))}" autocomplete="off"></label>
          <p class="muted small" style="margin:0 0 10px;line-height:1.5">${App.t('De koppeling werkt alleen voor apparaten op hetzelfde (wifi-)netwerk, zolang Doek op deze computer openstaat. Wijzigingen van anderen verschijnen vanzelf in jouw presentatie. Vraagt Windows de eerste keer of Doek netwerktoegang mag hebben? Kies dan Toestaan.')}</p>
          <div class="row" style="gap:8px"><button class="btn primary" id="sh-make"><span class="i">link</span> ${App.t('Koppeling maken')}</button></div>`;
        body.querySelector('#sh-make').onclick = async () => {
          try {
            const data = packDoc();
            const code = body.querySelector('#sh-code').value.trim();
            const r = await api(base, 'POST', '/deel', { title: docTitle(), data, perm: body.querySelector('#sh-perm').value, code, by: whoAmI() });
            setShare({ id: r.id, owner: r.owner, server: base, code: r.hasCode ? code : '', perm: r.perm, link: r.link });
            known = r.version; baseData = data;
            startSync(); setState('ok');
            App.markDirty();
            render(d);
            copyText(r.link);
          } catch (e) { App.toast(App.t('Delen mislukt: {0}').replace('{0}', e.message), 'error'); }
        };
        return;
      }
      body.innerHTML = `<div class="sh-doc"><span class="i">co_present</span><div><b>${App.esc(docTitle())}</b><small>${sh.owner ? App.t('Gedeeld door jou') : App.t('Gedeeld door {0}').replace('{0}', App.esc(sh.by || App.t('iemand anders')))}${sh.code ? ' · ' + App.t('met code') : ''}</small></div></div>
        ${sh.owner ? `<div class="sh-perm"><span class="i">public</span><select id="sh-perm"><option value="edit" ${sh.perm === 'edit' ? 'selected' : ''}>${App.t('Iedereen met de koppeling kan bewerken')}</option><option value="view" ${sh.perm === 'view' ? 'selected' : ''}>${App.t('Iedereen met de koppeling kan weergeven')}</option></select></div>` : `<div class="sh-perm"><span class="i">${sh.perm === 'view' ? 'visibility' : 'edit'}</span><span>${App.t(sh.perm === 'view' ? 'Je kunt deze presentatie alleen bekijken' : 'Je kunt deze presentatie bewerken')}</span></div>`}
        <label class="field"><span>${App.t('Koppeling')}</span><div class="row" style="gap:6px"><input id="sh-link" class="inp notranslate" readonly value="${App.esc(sh.link || '')}"><button class="btn" id="sh-copy" title="${App.esc(App.t('Koppeling kopiëren'))}"><span class="i">content_copy</span> ${App.t('Kopiëren')}</button></div></label>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" id="sh-mail"><span class="i">mail</span> ${App.t('Koppeling e-mailen')}</button>${sh.owner ? `<button class="btn" id="sh-stop"><span class="i">link_off</span> ${App.t('Stoppen met delen')}</button>` : ''}</div>
        <p class="muted small" style="margin:10px 0 0;line-height:1.5">${App.t(sh.owner ? 'Werkt voor iedereen op hetzelfde netwerk zolang Doek op deze computer openstaat.' : 'Werkt voor iedereen op hetzelfde netwerk zolang Doek bij de eigenaar openstaat.')}</p>`;
      body.querySelector('#sh-copy').onclick = () => copyText(sh.link);
      body.querySelector('#sh-mail').onclick = () => mailLink(sh.link, docTitle());
      const perm = body.querySelector('#sh-perm');
      if (perm && sh.owner) perm.onchange = async () => { try { const r = await api(base, 'PATCH', '/deel/' + sh.id, { perm: perm.value }, sh); sh.perm = r.perm; App.markDirty(); App.toast(App.t(perm.value === 'edit' ? 'Anderen kunnen nu bewerken' : 'Anderen kunnen nu alleen bekijken'), 'ok'); } catch (e) { App.toast(e.message, 'error'); } };
      const stop = body.querySelector('#sh-stop');
      if (stop) stop.onclick = async () => { await App.exec('shareStop'); d.close(); };
    };
    App.dialog({
      title: App.t(s ? 'Delen' : 'Koppeling verzenden'), body: '<div id="sh-body"></div>',
      onOpen: render,
      buttons: [{ label: 'Een kopie verzenden', left: true, action: () => setTimeout(() => App.exec('shareCopy'), 0) }].concat(App.commands.sharedFolderSave ? [{ label: 'Opslaan in gedeelde map', left: true, action: () => setTimeout(() => App.exec('sharedFolderSave'), 0) }] : [], [{ label: 'Sluiten', primary: true }]),
    });
  });

  App.def('shareStop', async () => {
    const s = getShare(); if (!s || !s.owner) return;
    if (!(await App.confirm(App.t('Stoppen met delen'), App.t('De koppeling werkt daarna niet meer. Anderen die de presentatie open hebben, kunnen hun wijzigingen niet meer opslaan.'), App.t('Stoppen')))) return;
    try { await api(s.server, 'DELETE', '/deel/' + s.id, undefined, s); } catch { /* server weg: lokaal opruimen */ }
    stopLocal(App.t('Delen gestopt'));
  });
  App.def('shareLeave', () => { const s = getShare(); if (!s) return; App.forgetShared(s.id); stopLocal(App.t('Koppeling losgelaten; je werkt nu in een eigen kopie')); });

  App.def('shareCopy', () => {
    App.dialog({
      title: App.t('Een kopie verzenden'),
      body: `<p class="muted small" style="margin:0 0 10px;line-height:1.5">${App.t(App.native && App.native.ok ? 'Kies een vorm; daarna opent het Windows-deelvenster (e-mail, WhatsApp, Nabij delen …).' : 'Het bestand wordt opgeslagen; daarna opent je e-mailprogramma. Voeg het opgeslagen bestand als bijlage toe.')}</p>
        <div class="bs-cards" style="grid-template-columns:1fr">
          <button class="bs-card" data-k="pptx"><span class="i">slideshow</span><div><b>${App.t('Presentatie (.pptx)')}</b><small>${App.t('Ontvangers kunnen de presentatie bewerken in vrijwel elk presentatieprogramma.')}</small></div></button>
          <button class="bs-card" data-k="pdf"><span class="i">picture_as_pdf</span><div><b>PDF</b><small>${App.t('Ontvangers zien de dia\'s precies zoals ze zijn, maar kunnen ze niet eenvoudig wijzigen.')}</small></div></button>
          <button class="bs-card" data-k="doek"><span class="i">co_present</span><div><b>${App.t('Doek-presentatie (.doek)')}</b><small>${App.t('Voor ontvangers die ook Doek gebruiken: alles blijft precies zoals het is.')}</small></div></button>
        </div>`,
      onOpen: (d) => d.body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        d.close();
        const k = b.dataset.k;
        const name = App.safeName(docTitle() || 'presentatie');
        if (App.native && App.native.ok) {
          // Windows-programma: het echte Windows-deelvenster
          try {
            if (k === 'pdf') await App.native.pdf(name + '.pdf', true);
            else await App.native.shareBlob(await App.buildBlob(k), name + '.' + k, docTitle());
            return;
          } catch (err) { App.toast(App.t('Windows-delen lukte niet: {0} — het bestand wordt opgeslagen.').replace('{0}', err.message), 'error', { ms: 4000 }); }
        }
        await App.exportAs(k);
        if (k !== 'pdf') setTimeout(() => { location.href = `mailto:?subject=${encodeURIComponent(docTitle())}&body=${encodeURIComponent(App.t('Hierbij “{0}” als bijlage.').replace('{0}', docTitle()) + '\n')}`; }, 800);
      }),
      buttons: [{ label: 'Annuleren' }],
    });
  });

  App.def('shareManage', async () => {
    const base = await App.share.server();
    if (!base) { noServer(); return; }
    const s = getShare();
    // eigen koppelingen op deze server: deelgegevens van presentaties in deze browser
    const mine = new Map();
    const collect = (sh) => { if (sh && sh.owner && sh.server === base) mine.set(sh.id, sh.owner); };
    (App.store.get('index', []) || []).forEach((x) => { const d = App.store.get('pres.' + x.id); if (d && d.share) collect(d.share); });
    if (s && s.owner) mine.set(s.id, s.owner);
    const items = [];
    for (const [id, owner] of mine) { try { items.push({ ...(await api(base, 'GET', '/deel/' + id, undefined, { owner })), id, owner }); } catch { /* weg */ } }
    const render = (d) => {
      d.$('#sm-list').innerHTML = items.length ? items.map((it, k) => `<div class="list-row"><span class="i" style="color:var(--brand)">co_present</span><span class="grow"><b>${App.esc(it.title)}</b><br><small class="muted">${App.esc(it.link)}${it.hasCode ? ' · ' + App.t('met code') : ''}</small></span>
        <select data-k="${k}" class="sm-perm"><option value="edit" ${it.perm === 'edit' ? 'selected' : ''}>${App.t('Bewerken')}</option><option value="view" ${it.perm === 'view' ? 'selected' : ''}>${App.t('Weergeven')}</option></select>
        <button class="qb" data-copy="${k}" title="${App.esc(App.t('Koppeling kopiëren'))}"><span class="i">content_copy</span></button><button class="qb" data-stop="${k}" title="${App.esc(App.t('Stoppen met delen'))}"><span class="i">link_off</span></button></div>`).join('')
        : `<div class="list-row muted">${App.t('Je deelt op dit moment geen presentaties vanaf deze computer.')}</div>`;
    };
    App.dialog({
      title: App.t('Toegang beheren'), wide: true,
      body: `<p class="muted small" style="margin:0 0 8px">${App.t('Koppelingen die vanaf deze computer zijn gedeeld ({0}).').replace('{0}', App.esc(App.share.info ? App.share.info.origin : base))}</p><div class="list-rows" id="sm-list"></div>`,
      onOpen: (d) => {
        render(d);
        d.$('#sm-list').addEventListener('change', async (e) => { const sel = e.target.closest('.sm-perm'); if (!sel) return; const it = items[+sel.dataset.k]; try { const r = await api(base, 'PATCH', '/deel/' + it.id, { perm: sel.value }, it); it.perm = r.perm; const cs = getShare(); if (cs && cs.id === it.id) { cs.perm = r.perm; App.markDirty(); } } catch (err) { App.toast(err.message, 'error'); } });
        d.$('#sm-list').addEventListener('click', async (e) => {
          const c = e.target.closest('[data-copy]'); if (c) { copyText(items[+c.dataset.copy].link); return; }
          const sb = e.target.closest('[data-stop]'); if (!sb) return;
          const it = items[+sb.dataset.stop];
          if (!(await App.confirm(App.t('Stoppen met delen'), App.t('De koppeling voor “{0}” werkt daarna niet meer.').replace('{0}', App.esc(it.title)), App.t('Stoppen')))) return;
          try { await api(base, 'DELETE', '/deel/' + it.id, undefined, it); } catch { /* weg */ }
          const cs = getShare(); if (cs && cs.id === it.id) stopLocal(App.t('Delen gestopt'));
          items.splice(+sb.dataset.stop, 1); render(d);
        });
      },
    });
  });

  // sneltoets zoals in Inkt en Cel: Alt+S
  document.addEventListener('keydown', (e) => { if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's' && !e.target.matches('input, textarea, [contenteditable="true"]') && !(App.showActive && App.showActive())) { e.preventDefault(); App.exec('shareMenu'); } });

  // opstarten: gedeelde koppeling openen, of synchronisatie hervatten van een eerder gedeelde presentatie
  setTimeout(async () => {
    if (App.isAudience) return;
    if (await openFromLink()) return;
    const s = getShare();
    if (s && s.server) { startSync(); setState(s.perm === 'view' && !s.owner ? 'view' : 'ok'); poll(); }
  }, 80);
})();
