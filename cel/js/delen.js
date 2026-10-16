/* =========================================================
   Cel (gemaakt door JJ van Schelven) — Delen (zelfde bestand als bij Inkt)
   Knop Delen rechtsboven met dezelfde keuzes als in bekende kantoorprogramma's:
   koppeling delen (iedereen met de koppeling kan bewerken of weergeven, met
   optionele code), koppeling kopiëren of e-mailen, een kopie verzenden
   (.docx/.xlsx of PDF) en toegang beheren. Geen account nodig: de koppeling
   werkt voor iedereen op hetzelfde netwerk zolang het programma openstaat.
   Dit bestand is hetzelfde voor Inkt en Cel.
   ========================================================= */
'use strict';

(() => {
  const isCel = !!App.book;
  const APPNAME = isCel ? 'Cel' : 'Inkt';
  const DOC = isCel ? 'werkmap' : 'document';
  const FILE_KIND = isCel ? 'xlsx' : 'docx';
  const FILE_LABEL = isCel ? 'Werkmap (.xlsx)' : 'Document (.docx)';
  const $ = App.$;

  /* ---------- Toestand van het huidige document ---------- */
  const cur = () => (isCel ? App.book : App.doc);
  const getShare = () => (isCel ? App.book.share : App.doc.meta.share) || null;
  const setShare = (s) => { if (isCel) { if (s) App.book.share = s; else delete App.book.share; } else if (s) App.doc.meta.share = s; else delete App.doc.meta.share; };
  const docTitle = () => cur().title;
  const whoAmI = () => (!isCel && App.settings.author && App.settings.author !== 'Ik' ? App.settings.author : (App.share.info && App.share.info.host) || APPNAME);

  // Inhoud van het document als gegevens (zonder de deelgegevens zelf)
  // Altijd als tekst versturen: ook de ingebouwde server in het Windows-programma kan dat zo bewaren
  const packDoc = () => {
    let d;
    if (isCel) { d = App.serializeBook(); delete d.share; }
    else { const meta = { ...App.doc.meta }; delete meta.share; d = { format: 'inkt', version: 1, title: App.doc.title, html: App.cleanHtml(), meta }; }
    return JSON.stringify(d);
  };
  const parseData = (data) => (typeof data === 'string' ? JSON.parse(data) : data);
  const unpackDoc = (data, keep) => {
    if (isCel) {
      const b = App.deserializeBook(data);
      b.id = App.book.id; b.share = keep;
      const act = App.book.active, scroll = App.sh().scroll;
      b.active = Math.min(act, b.sheets.length - 1);
      App.loadBook(b);
      if (b.sheets[b.active]) { b.sheets[b.active].scroll = scroll; }
      if (keep && keep.perm === 'view') b.sheets.forEach((s) => { s.protect = true; });
      App.afterSheetSwitch && App.afterSheetSwitch();
    } else {
      const sel = App.getSelOffsets ? App.getSelOffsets() : null;
      const scroll = $('#canvas-scroll').scrollTop;
      const meta = { ...(data.meta || {}), share: keep };
      App.loadDoc({ id: App.doc.id, title: data.title || docTitle(), html: data.html, meta });
      if (keep && keep.perm === 'view') App.setProtect(true);
      $('#canvas-scroll').scrollTop = scroll;
      if (sel && App.setSelOffsets) { try { App.setSelOffsets(sel); } catch { /* niets */ } }
    }
    cur().dirty = false;
  };

  /* ---------- Samenvoegen bij gelijktijdige wijzigingen ----------
     De server weigert een PUT (409) als iemand anders intussen een nieuwere versie heeft opgeslagen.
     Dan voegen we samen: basis = de versie die we het laatst met de server deelden, lokaal = ons document, extern = de nieuwe versie.
     Cel: per cel (lokaal gewijzigde cellen winnen, de rest komt van de ander). Inkt: per blok (alinea, tabel …) met een diff3-achtige aanpak. */
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  const mergeSheet = (b, l, r) => {
    const o = { ...r };
    const cellMap = (s) => { const m = new Map(); ((s && s.cells) || []).forEach((c) => m.set(c[0] + ',' + c[1], c[2])); return m; };
    const bm = cellMap(b), lm = cellMap(l), rm = cellMap(r);
    const keys = new Set([...lm.keys(), ...rm.keys(), ...bm.keys()]);
    const cells = [];
    keys.forEach((k) => {
      const lv = lm.get(k);
      const v = same(lv, bm.get(k)) ? rm.get(k) : lv;   // lokaal gewijzigd → lokaal, anders de versie van de ander
      if (v !== undefined) { const [row, col] = k.split(',').map(Number); cells.push([row, col, v]); }
    });
    cells.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    o.cells = cells;
    Object.keys(l).forEach((k) => { if (k !== 'cells' && !same(l[k], b && b[k])) o[k] = l[k]; });
    return o;
  };
  const mergeCel = (base, local, remote) => {
    const idx = (book) => { const m = new Map(); ((book && book.sheets) || []).forEach((s) => m.set(s.name, s)); return m; };
    const B = idx(base), L = idx(local), R = idx(remote);
    const out = { ...remote, sheets: [] };
    const order = [...R.keys()]; L.forEach((_, n) => { if (!R.has(n)) order.push(n); });
    order.forEach((n) => {
      const b = B.get(n), l = L.get(n), r = R.get(n);
      if (!l) { if (!(b && same(b, r))) out.sheets.push(r); return; }        // lokaal verwijderd: alleen weg als de ander hem niet wijzigde
      if (!r) { if (!(b && same(b, l))) out.sheets.push(l); return; }        // door de ander verwijderd
      out.sheets.push(mergeSheet(b, l, r));
    });
    if (!out.sheets.length) out.sheets = local.sheets;
    ['title', 'names', 'calc', 'active'].forEach((k) => { if (!same(local[k], base && base[k])) out[k] = local[k]; });
    out.media = { ...(remote.media || {}), ...(local.media || {}) };
    return out;
  };
  // Verschillen tussen twee lijsten blokken (LCS): gebieden {as, ae, bs, be} waar a[as..ae) is vervangen door b[bs..be)
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
    if (base === null) return local;   // geen basis bekend: lokaal wint (een leeg basisdocument is wél een basis)
    const hl = diffHunks(base, local).map((h) => ({ ...h, side: 'l' }));
    const hr = diffHunks(base, remote).map((h) => ({ ...h, side: 'r' }));
    if (!hl.length) return remote;
    if (!hr.length) return local;
    // positie in de lokale lijst die hoort bij basispositie b (buiten de lokale wijzigingen)
    const lpos = (b, isEnd) => b + hl.reduce((acc, h) => (h.ae <= b && !(isEnd && h.as === b && h.ae === b) ? acc + (h.be - h.bs) - (h.ae - h.as) : acc), 0);
    const all = [...hl, ...hr].sort((x, y) => x.as - y.as || x.ae - y.ae);
    const out = []; let pos = 0, i = 0;
    while (i < all.length) {
      let S = all[i].as, E = all[i].ae; const group = [all[i]]; i++;
      while (i < all.length && (all[i].as < E || (all[i].as === S && all[i].ae === E))) { E = Math.max(E, all[i].ae); group.push(all[i]); i++; }
      out.push(...base.slice(pos, S));
      const sides = new Set(group.map((h) => h.side));
      if (sides.size === 1) { const h = group[0]; out.push(...(h.side === 'l' ? local : remote).slice(h.bs, h.be)); }
      else if (S === E) group.filter((h) => h.side === 'r').concat(group.filter((h) => h.side === 'l')).forEach((h) => out.push(...(h.side === 'l' ? local : remote).slice(h.bs, h.be)));   // beiden voegden hier iets in: allebei houden
      else out.push(...local.slice(lpos(S, false), lpos(E, true)));   // overlappende wijziging: wie nu typt wint
      pos = E;
    }
    out.push(...base.slice(pos));
    return out;
  };
  const htmlBlocks = (html) => { const el = document.createElement('div'); el.innerHTML = html || ''; return Array.from(el.childNodes).map((n) => (n.nodeType === 1 ? n.outerHTML : n.nodeType === 3 ? App.esc(n.nodeValue) : '')); };
  const mergeInkt = (base, local, remote) => {
    const out = { ...remote, meta: { ...(remote.meta || {}) } };
    if (!same(local.title, base && base.title)) out.title = local.title;
    Object.keys(local.meta || {}).forEach((k) => { if (!same(local.meta[k], base && base.meta && base.meta[k])) out.meta[k] = local.meta[k]; });
    out.html = mergeBlocks(base ? htmlBlocks(base.html) : null, htmlBlocks(local.html), htmlBlocks(remote.html)).join('');
    return out;
  };
  const mergeDocs = (base, local, remote) => {
    try { return isCel ? mergeCel(base, local, remote) : mergeInkt(base, local, remote); } catch (e) { console.warn('Samenvoegen mislukt, lokale versie gebruikt', e); return local; }
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
        // Eigen Windows-programma: de ingebouwde server vragen om te starten
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
    title: 'Delen',
    body: `<p style="line-height:1.55;margin:0 0 8px">Delen via een koppeling werkt alleen als ${APPNAME} via de server draait: start <b>${isCel ? 'start-cel.bat' : 'start-inkt.bat'}</b> (of het programma ${APPNAME}.exe) en probeer het dan opnieuw.</p>
      <p class="muted small" style="line-height:1.5;margin:0">Je kunt het ${DOC} wel altijd als bestand versturen via <b>Delen › Een kopie verzenden</b>.</p>`,
    buttons: [{ label: 'Een kopie verzenden', action: () => setTimeout(() => App.exec('shareCopy'), 0) }, { label: 'Sluiten', primary: true }],
  });

  /* ---------- Synchroniseren ---------- */
  let pushTimer = null, pollTimer = null, known = 0, baseData = null, pushing = false, pushAgain = false;
  const schedulePush = () => {
    const s = getShare(); if (!s || s.perm === 'view' && !s.owner) return;
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
        App.toast(`Wijzigingen van ${s.by && !s.owner ? App.esc(s.by) : 'een ander'} samengevoegd`, 'merge_type', { ms: 3000 });
      }
      baseData = data;
      setState('ok');
    } catch (e) {
      if (e.status === 404) { stopLocal('Deze koppeling bestaat niet meer: de eigenaar is gestopt met delen.'); }
      else if (e.status === 403) { s.perm = 'view'; setState('view'); App.toast('Je mag dit ' + DOC + ' alleen nog bekijken.', 'lock'); }
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
      if (v.perm !== s.perm && !s.owner) { s.perm = v.perm; if (!isCel) App.setProtect(v.perm === 'view'); else App.book.sheets.forEach((x) => { x.protect = v.perm === 'view'; }); setState(v.perm === 'view' ? 'view' : 'ok'); }
      if (v.version !== known) {
        const busy = (isCel ? !!App.state.editing : false) || Date.now() - App.share.lastEdit < 2500 || cur().dirty;
        if (busy) { if (cur().dirty) push(); return; }
        const full = await api(s.server, 'GET', '/deel/' + s.id, undefined, s);
        known = full.version; baseData = typeof full.data === 'string' ? full.data : JSON.stringify(full.data);
        App.share.syncing = true;
        try { unpackDoc(parseData(full.data), s); } finally { App.share.syncing = false; }
        setState('ok');
      } else setState(s.perm === 'view' && !s.owner ? 'view' : 'ok');
    } catch (e) {
      if (e.status === 404) stopLocal('Deze koppeling bestaat niet meer: de eigenaar is gestopt met delen.');
      else setState('offline');
    }
  };
  const startSync = () => { clearInterval(pollTimer); pollTimer = setInterval(poll, 4000); };
  const stopLocal = (msg) => { clearInterval(pollTimer); pollTimer = null; setShare(null); setState(null); if (msg) App.toast(msg, 'link_off', { ms: 6000 }); App.markDirty(); };
  const setState = (st) => {
    const el = $('#share-state'); if (!el) return;
    const s = getShare();
    if (!s || !st) { el.hidden = true; return; }
    el.hidden = false;
    const txt = { ok: s.owner ? 'Gedeeld' : 'Gedeeld met jou', view: 'Alleen bekijken', offline: 'Geen verbinding' }[st] || 'Gedeeld';
    el.innerHTML = `<span class="i">${st === 'offline' ? 'cloud_off' : st === 'view' ? 'visibility' : 'people'}</span>${txt}`;
    el.className = 'share-chip ' + st;
  };
  // wijzigingen in het document doorsturen
  const origDirty = App.markDirty;
  App.markDirty = (...a) => { origDirty(...a); if (!App.share.syncing) schedulePush(); };
  // bij het laden van een ander document: synchronisatie van het vorige stoppen
  const hookLoad = (name) => { const o = App[name]; App[name] = (...a) => { const r = o(...a); if (App.share.syncing) return r; /* laden door de synchronisatie zelf: versie niet vergeten */ const s = getShare(); clearInterval(pollTimer); pollTimer = null; known = 0; baseData = null; if (s && s.server) { startSync(); setState(s.perm === 'view' && !s.owner ? 'view' : 'ok'); if (!isCel && s.perm === 'view' && !s.owner) App.setProtect(true); } else setState(null); return r; }; };
  hookLoad(isCel ? 'loadBook' : 'loadDoc');
  if (isCel) {
    // deelgegevens horen bij de werkmap
    const oSer = App.serializeBook; App.serializeBook = () => { const d = oSer(); if (App.book.share) d.share = App.book.share; return d; };
    const oDes = App.deserializeBook; App.deserializeBook = (o) => { const b = oDes(o); if (o.share) b.share = o.share; return b; };
  }

  /* ---------- Gedeeld met mij (lijst op het startscherm) ---------- */
  App.sharedWithMe = () => App.store.get('gedeeld', []) || [];
  const rememberShared = (s, link) => {
    const list = App.sharedWithMe().filter((x) => x.id !== s.id);
    list.unshift({ id: s.id, title: s.title, link, by: s.by, perm: s.perm, app: s.app || APPNAME, opened: Date.now() });
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
        const c = await App.prompt('Gedeeld ' + DOC, `Voor “${e.body.title}” is een code nodig. Vraag die aan degene die het ${DOC} deelt.`, '');
        if (c === null) return true;
        q.set('code', c); history.replaceState(null, '', location.pathname + '?' + q.toString());
        return openFromLink();
      }
      App.dialog({ title: 'Koppeling openen', body: `<p style="line-height:1.5">${App.esc(e.message)}</p>` });
      history.replaceState(null, '', location.pathname);
      return true;
    }
    const share = { id, server: base, code, perm: full.perm, by: full.by, link: full.link };
    const data = parseData(full.data);
    if (isCel) { const b = App.deserializeBook(data); b.id = App.uid('b'); b.share = share; if (full.perm === 'view') b.sheets.forEach((s) => { s.protect = true; }); App.loadBook(b); }
    else { const meta = { ...(data.meta || {}), share }; App.loadDoc({ id: App.uid('d'), title: data.title || full.title, html: data.html, meta }); if (full.perm === 'view') App.setProtect(true); }
    known = full.version; baseData = typeof full.data === 'string' ? full.data : JSON.stringify(full.data);
    rememberShared(full, full.link);
    App.closeBackstage && App.closeBackstage();
    history.replaceState(null, '', location.pathname);
    App.toast(`Gedeeld ${DOC} geopend${full.by ? ' van ' + full.by : ''} · ${full.perm === 'view' ? 'alleen bekijken' : 'je kunt meewerken'}`, 'people', { ms: 5000 });
    return true;
  };

  /* ---------- Knop en menu ---------- */
  const tbr = $('#titlebar .tb-right');
  if (tbr) {
    tbr.insertAdjacentHTML('afterbegin', `<span id="share-state" class="share-chip" hidden></span><button class="share-btn" data-menu="m-share" title="Delen"><span class="i">share</span><span>Delen</span><span class="i caret">arrow_drop_down</span></button>`);
  }
  App.menuBuilders['m-share'] = () => {
    const s = getShare();
    return `<button data-cmd="shareLink"><span class="i">link</span> ${s ? 'Koppeling en toegang' : 'Delen via koppeling'}</button>
      <button data-cmd="shareCopy"><span class="i">attach_email</span> Een kopie verzenden</button>
      <button data-cmd="shareManage"><span class="i">manage_accounts</span> Toegang beheren</button>
      ${s && s.owner ? '<hr><button data-cmd="shareStop"><span class="i">link_off</span> Stoppen met delen</button>' : s ? '<hr><button data-cmd="shareLeave"><span class="i">logout</span> Koppeling loslaten (eigen kopie houden)</button>' : ''}`;
  };
  App.def('shareMenu', (arg, el) => App.openMenu('m-share', el || $('.share-btn')));

  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); App.toast('Koppeling gekopieerd', 'ok'); } catch { App.prompt('Koppeling', 'Kopieer deze koppeling:', t); } };
  const mailLink = (link, title) => { location.href = `mailto:?subject=${encodeURIComponent(title + ' (gedeeld via ' + APPNAME + ')')}&body=${encodeURIComponent(`Ik deel “${title}” met je. Open deze koppeling op hetzelfde netwerk:\n${link}\n`)}`; };

  App.def('shareLink', async () => {
    if (!isCel && App.state.hfEditing) App.closeHF(true);
    if (isCel && App.state.editing) App.commitEdit();
    const base = await App.share.server();
    if (!base) { noServer(); return; }
    const s = getShare();
    const render = (d) => {
      const sh = getShare();
      const body = d.$('#sh-body');
      if (!sh) {
        body.innerHTML = `<div class="sh-doc"><span class="i">${isCel ? 'table_view' : 'description'}</span><div><b>${App.esc(docTitle())}</b><small>Iedereen op dit netwerk die de koppeling heeft</small></div></div>
          <div class="sh-perm"><span class="i">public</span><select id="sh-perm"><option value="edit">Iedereen met de koppeling kan bewerken</option><option value="view">Iedereen met de koppeling kan weergeven</option></select></div>
          <label class="field"><span>Code (optioneel — alleen wie de code weet, kan openen)</span><input id="sh-code" placeholder="bijv. 1234" autocomplete="off"></label>
          <p class="muted small" style="margin:0 0 10px;line-height:1.5">De koppeling werkt alleen voor apparaten op hetzelfde (wifi-)netwerk, zolang ${APPNAME} op deze computer openstaat. Wijzigingen van anderen verschijnen vanzelf in jouw ${DOC}. Vraagt Windows de eerste keer of ${APPNAME} netwerktoegang mag hebben? Kies dan Toestaan.</p>
          <div class="row" style="gap:8px"><button class="btn primary" id="sh-make"><span class="i">link</span> Koppeling maken</button></div>`;
        body.querySelector('#sh-make').onclick = async () => {
          try {
            const data = packDoc();
            const r = await api(base, 'POST', '/deel', { title: docTitle(), data, perm: body.querySelector('#sh-perm').value, code: body.querySelector('#sh-code').value.trim(), by: whoAmI() });
            setShare({ id: r.id, owner: r.owner, server: base, code: r.hasCode ? body.querySelector('#sh-code').value.trim() : '', perm: r.perm, link: r.link });
            known = r.version; baseData = data;
            startSync(); setState('ok');
            App.markDirty();
            render(d);
            copyText(r.link);
          } catch (e) { App.toast('Delen mislukt: ' + e.message, 'error'); }
        };
        return;
      }
      body.innerHTML = `<div class="sh-doc"><span class="i">${isCel ? 'table_view' : 'description'}</span><div><b>${App.esc(docTitle())}</b><small>${sh.owner ? 'Gedeeld door jou' : 'Gedeeld door ' + App.esc(sh.by || 'iemand anders')}${sh.code ? ' · met code' : ''}</small></div></div>
        ${sh.owner ? `<div class="sh-perm"><span class="i">public</span><select id="sh-perm"><option value="edit" ${sh.perm === 'edit' ? 'selected' : ''}>Iedereen met de koppeling kan bewerken</option><option value="view" ${sh.perm === 'view' ? 'selected' : ''}>Iedereen met de koppeling kan weergeven</option></select></div>` : `<div class="sh-perm"><span class="i">${sh.perm === 'view' ? 'visibility' : 'edit'}</span><span>Je kunt dit ${DOC} ${sh.perm === 'view' ? 'alleen bekijken' : 'bewerken'}</span></div>`}
        <label class="field"><span>Koppeling</span><div class="row" style="gap:6px"><input id="sh-link" class="inp" readonly value="${App.esc(sh.link || '')}"><button class="btn" id="sh-copy" title="Koppeling kopiëren"><span class="i">content_copy</span> Kopiëren</button></div></label>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" id="sh-mail"><span class="i">mail</span> Koppeling e-mailen</button>${sh.owner ? '<button class="btn" id="sh-stop"><span class="i">link_off</span> Stoppen met delen</button>' : ''}</div>
        <p class="muted small" style="margin:10px 0 0;line-height:1.5">Werkt voor iedereen op hetzelfde netwerk zolang ${sh.owner ? APPNAME + ' op deze computer' : APPNAME + ' bij ' + App.esc(sh.by || 'de eigenaar')} openstaat.</p>`;
      body.querySelector('#sh-copy').onclick = () => copyText(sh.link);
      body.querySelector('#sh-mail').onclick = () => mailLink(sh.link, docTitle());
      const perm = body.querySelector('#sh-perm');
      if (perm) perm.onchange = async () => { try { const r = await api(base, 'PATCH', '/deel/' + sh.id, { perm: perm.value }, sh); sh.perm = r.perm; App.markDirty(); App.toast(perm.value === 'edit' ? 'Anderen kunnen nu bewerken' : 'Anderen kunnen nu alleen bekijken', 'ok'); } catch (e) { App.toast(e.message, 'error'); } };
      const stop = body.querySelector('#sh-stop');
      if (stop) stop.onclick = async () => { await App.exec('shareStop'); d.close(); };
    };
    App.dialog({
      title: s ? 'Delen' : 'Koppeling verzenden', body: '<div id="sh-body"></div>',
      onOpen: render,
      buttons: [{ label: 'Een kopie verzenden', left: true, action: () => setTimeout(() => App.exec('shareCopy'), 0) }].concat(App.commands.sharedFolderSave ? [{ label: 'Opslaan in gedeelde map', left: true, action: () => setTimeout(() => App.exec('sharedFolderSave'), 0) }] : [], [{ label: 'Sluiten', primary: true }]),
    });
  });

  App.def('shareStop', async () => {
    const s = getShare(); if (!s || !s.owner) return;
    if (!(await App.confirm('Stoppen met delen', 'De koppeling werkt daarna niet meer. Anderen die het ' + DOC + ' open hebben, kunnen hun wijzigingen niet meer opslaan.', 'Stoppen'))) return;
    try { await api(s.server, 'DELETE', '/deel/' + s.id, undefined, s); } catch { /* server weg: lokaal opruimen */ }
    stopLocal('Delen gestopt');
  });
  App.def('shareLeave', () => { const s = getShare(); if (!s) return; App.forgetShared(s.id); stopLocal('Koppeling losgelaten; je werkt nu in een eigen kopie'); });

  App.def('shareCopy', () => {
    App.dialog({
      title: 'Een kopie verzenden',
      body: `<p class="muted small" style="margin:0 0 10px;line-height:1.5">${App.native && App.native.ok ? 'Kies een vorm; daarna opent het Windows-deelvenster (e-mail, WhatsApp, Nabij delen …).' : 'Het bestand wordt opgeslagen; daarna opent je e-mailprogramma. Voeg het opgeslagen bestand als bijlage toe.'}</p>
        <div class="bs-cards" style="grid-template-columns:1fr">
          <button class="bs-card" data-k="${FILE_KIND}"><span class="i">${isCel ? 'table_view' : 'description'}</span><div><b>${FILE_LABEL}</b><small>Ontvangers kunnen het bestand bewerken in vrijwel elk ${isCel ? 'rekenblad' : 'tekstverwerkings'}programma.</small></div></button>
          <button class="bs-card" data-k="pdf"><span class="i">picture_as_pdf</span><div><b>PDF</b><small>Ontvangers zien het ${DOC} precies zoals het is, maar kunnen het niet eenvoudig wijzigen.</small></div></button>
        </div>`,
      onOpen: (d) => d.body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        d.close();
        const name = (docTitle() || DOC).replace(/[\\/:*?"<>|]+/g, '-');
        if (App.native && App.native.ok) {
          // Windows-programma: het echte Windows-deelvenster (e-mail, WhatsApp, Nabij delen …)
          try {
            if (b.dataset.k === 'pdf') { App.preparePrint && App.preparePrint(); try { await App.native.call('pdf', { name: name + '.pdf', share: '1' }); } finally { App.afterPrint && App.afterPrint(); } }
            else { const blob = await App.buildBlob(b.dataset.k); const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); }); await App.native.call('share', { name: name + '.' + b.dataset.k, data: b64, title: docTitle() }); }
            return;
          } catch (e) { App.toast('Windows-delen lukte niet: ' + e.message + ' — het bestand wordt opgeslagen.', 'error', { ms: 4000 }); }
        }
        await App.exportAs(b.dataset.k);
        setTimeout(() => { location.href = `mailto:?subject=${encodeURIComponent(docTitle())}&body=${encodeURIComponent('Hierbij “' + docTitle() + '” als bijlage.\n')}`; }, 800);
      }),
      buttons: [{ label: 'Annuleren' }],
    });
  });

  App.def('shareManage', async () => {
    const base = await App.share.server();
    if (!base) { noServer(); return; }
    const s = getShare();
    const tokens = [];
    // alle eigen koppelingen op deze server: tokens van gedeelde documenten in deze browser
    const mine = new Map();
    const collect = (meta) => { const sh = meta && meta.share; if (sh && sh.owner && sh.server === base) mine.set(sh.id, sh.owner); };
    (App.store.get('index', []) || []).forEach((x) => { const d = App.store.get((isCel ? 'book.' : 'doc.') + x.id); if (d) collect(isCel ? d : d.meta); });
    if (s && s.owner) mine.set(s.id, s.owner);
    const items = [];
    for (const [id, owner] of mine) { try { items.push({ ...(await api(base, 'GET', '/deel/' + id, undefined, { owner })), owner }); } catch { /* weg */ } }
    void tokens;
    const render = (d) => {
      d.$('#sm-list').innerHTML = items.length ? items.map((it, k) => `<div class="list-row"><span class="i" style="color:var(--brand)">${isCel ? 'table_view' : 'description'}</span><span class="grow"><b>${App.esc(it.title)}</b><br><small class="muted">${App.esc(it.link)}${it.hasCode ? ' · met code' : ''}</small></span>
        <select data-k="${k}" class="sm-perm"><option value="edit" ${it.perm === 'edit' ? 'selected' : ''}>Bewerken</option><option value="view" ${it.perm === 'view' ? 'selected' : ''}>Weergeven</option></select>
        <button class="qb" data-copy="${k}" title="Koppeling kopiëren"><span class="i">content_copy</span></button><button class="qb" data-stop="${k}" title="Stoppen met delen"><span class="i">link_off</span></button></div>`).join('')
        : `<div class="list-row muted">Je deelt op dit moment geen ${DOC}pen vanaf deze computer.</div>`;
    };
    App.dialog({
      title: 'Toegang beheren', wide: true,
      body: `<p class="muted small" style="margin:0 0 8px">Koppelingen die vanaf deze computer zijn gedeeld (${App.esc(App.share.info ? App.share.info.origin : base)}).</p><div class="list-rows" id="sm-list"></div>`,
      onOpen: (d) => {
        render(d);
        d.$('#sm-list').addEventListener('change', async (e) => { const sel = e.target.closest('.sm-perm'); if (!sel) return; const it = items[+sel.dataset.k]; try { const r = await api(base, 'PATCH', '/deel/' + it.id, { perm: sel.value }, it); it.perm = r.perm; const cs = getShare(); if (cs && cs.id === it.id) { cs.perm = r.perm; App.markDirty(); } } catch (err) { App.toast(err.message, 'error'); } });
        d.$('#sm-list').addEventListener('click', async (e) => {
          const c = e.target.closest('[data-copy]'); if (c) { copyText(items[+c.dataset.copy].link); return; }
          const st = e.target.closest('[data-stop]'); if (!st) return;
          const it = items[+st.dataset.stop];
          if (!(await App.confirm('Stoppen met delen', `De koppeling voor “${App.esc(it.title)}” werkt daarna niet meer.`, 'Stoppen'))) return;
          try { await api(base, 'DELETE', '/deel/' + it.id, undefined, it); } catch { /* weg */ }
          const cs = getShare(); if (cs && cs.id === it.id) stopLocal('Delen gestopt');
          items.splice(+st.dataset.stop, 1); render(d);
        });
      },
    });
  });

  // sneltoets zoals in bekende programma's: Ctrl+Shift+S kan al bezet zijn, daarom Alt+S
  document.addEventListener('keydown', (e) => { if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's' && !e.target.matches('input, textarea')) { e.preventDefault(); App.exec('shareMenu'); } });

  // opstarten: gedeelde koppeling openen, of synchronisatie hervatten van een eerder gedeeld document
  setTimeout(async () => {
    if (await openFromLink()) return;
    const s = getShare();
    if (s && s.server) { startSync(); setState(s.perm === 'view' && !s.owner ? 'view' : 'ok'); poll(); }
  }, 80);
})();
