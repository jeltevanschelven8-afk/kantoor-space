/* =========================================================
   Doek (gemaakt door JJ van Schelven) — opslag op deze computer (zelfde aanpak als Inkt en Cel).
   De presentatie (zonder media) staat in de gewone opslag; afbeeldingen, video en geluid in
   IndexedDB (veel groter). Raakt de gewone opslag vol, dan gaat ook de presentatie naar IndexedDB.
   Daarnaast: automatisch bewaarde versies (versiegeschiedenis) en herstel na afsluiten.
   ========================================================= */
'use strict';

/* ---------- IndexedDB ---------- */
App.idb = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('doek-opslag', 1);
    r.onupgradeneeded = () => { const d = r.result; ['pres', 'media', 'versions'].forEach((n) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const tx = (store, mode, fn) => db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return {
    get: (store, k) => tx(store, 'readonly', (s) => s.get(k)).catch(() => null),
    set: (store, k, v) => tx(store, 'readwrite', (s) => s.put(v, k)),
    del: (store, k) => tx(store, 'readwrite', (s) => s.delete(k)).catch(() => {}),
    keys: (store) => tx(store, 'readonly', (s) => s.getAllKeys()).catch(() => []),
  };
})();

(() => {
  const st = App.state;
  const saved = new Set();            // media-id's die al in IndexedDB staan
  App.mediaChanged = () => {};
  const saveMedia = async (ids) => {
    for (const id of ids) {
      if (saved.has(id) || !App.media[id]) continue;
      try { await App.idb.set('media', id, App.media[id]); saved.add(id); } catch (e) { console.warn('media opslaan', e); App.toast(App.t('Een afbeelding of video kon niet worden bewaard: de opslag is vol. Sla de presentatie op als bestand.'), 'error', { ms: 6000 }); return false; }
    }
    return true;
  };
  const loadMedia = async (ids) => {
    for (const id of ids) {
      if (App.media[id]) continue;
      const m = await App.idb.get('media', id);
      if (m) { const c = App.cleanMedia({ [id]: m }); if (c[id]) { App.media[id] = c[id]; saved.add(id); } }
    }
  };

  /* ---------- Opslaan ---------- */
  App.presData = () => { const d = App.serializePres({ media: false }); d.props = { ...d.props, modified: Date.now() }; return d; };
  App.markIndex = (data, extra) => {
    const P = App.pres;
    const idx = (App.store.get('index', []) || []).filter((x) => x.id !== P.id);
    const old = (App.store.get('index', []) || []).find((x) => x.id === P.id) || {};
    idx.unshift({ id: P.id, title: P.title, modified: data.props.modified, slides: P.slides.length, thumb: old.thumb, ...(extra || {}) });
    App.store.set('index', idx.slice(0, 300));
    App.store.set('last', P.id);
    P.dirty = false;
    const s = $('#save-state');
    if (s) { s.textContent = App.t('Opgeslagen') + (App.fileHandle ? ' · ' + App.fileHandle.name : ''); s.classList.remove('dirty'); }
    App.thumbIndexSoon();
  };
  App.saveLocal = (auto) => {
    if (!App.pres) return false;
    if (st.edit && !auto && App.textEdit) App.textEdit.stop();
    const P = App.pres;
    if (P.share && P.share.perm === 'view' && !P.share.owner) return true;   // alleen bekijken: niets lokaal overschrijven
    const data = App.presData();
    const used = App.usedMedia(P);
    data.mediaIds = [...used];
    saveMedia(used);
    const wasBig = ((App.store.get('index', []) || []).find((x) => x.id === P.id) || {}).big;
    if (App.store.set('pres.' + P.id, data)) {
      if (wasBig) App.idb.del('pres', P.id);
      App.markIndex(data);
      App.versionTick(data);
      return true;
    }
    // gewone opslag vol: naar IndexedDB
    App.store.del('pres.' + P.id);
    App.markIndex(data, { big: true });
    App.idb.set('pres', P.id, data).then(() => {
      if (!App._bigWarned) App.toast(App.t('De gewone opslag is vol. Doek bewaart deze presentatie nu in de grotere reserve-opslag.'), 'info', { ms: 5000 });
      App._bigWarned = true;
    }).catch(() => {
      P.dirty = true;
      const s = $('#save-state'); if (s) { s.textContent = App.t('Niet opgeslagen'); s.classList.add('dirty'); }
      App.toast(App.t('Kon de presentatie niet opslaan: de opslag is vol. Sla hem op als bestand via Bestand › Opslaan als.'), 'error', { ms: 8000, action: App.t('Opslaan als'), onAction: () => App.exportAs('pptx') });
    });
    App.versionTick(data);
    return true;
  };
  // Opgeslagen presentatie terughalen (met media)
  App.loadStored = async (id) => {
    const entry = (App.store.get('index', []) || []).find((x) => x.id === id);
    let data = App.store.get('pres.' + id);
    if (!data && entry && entry.big) data = await App.idb.get('pres', id);
    if (!data) data = await App.idb.get('pres', id);
    if (!data) return null;
    await loadMedia(data.mediaIds || []);
    const P = App.deserializePres(data, { media: false });
    P.id = id;
    return P;
  };
  App.deleteStored = (id) => {
    const data = App.store.get('pres.' + id);
    App.store.del('pres.' + id);
    App.idb.del('pres', id);
    App.store.set('index', (App.store.get('index', []) || []).filter((x) => x.id !== id));
    App.store.set('pinned', (App.store.get('pinned', []) || []).filter((x) => x !== id));
    // media die door geen enkele andere presentatie wordt gebruikt, opruimen
    App.cleanupMediaSoon(data && data.mediaIds);
    App.idb.keys('versions').then((keys) => keys.filter((k) => String(k).startsWith(id + ':')).forEach((k) => App.idb.del('versions', k)));
  };
  App.cleanupMediaSoon = App.debounce(async () => {
    const used = new Set();
    (App.store.get('index', []) || []).forEach((x) => { const d = App.store.get('pres.' + x.id); ((d && d.mediaIds) || []).forEach((m) => used.add(m)); });
    for (const x of App.store.get('index', []) || []) { if (x.big) { const d = await App.idb.get('pres', x.id); ((d && d.mediaIds) || []).forEach((m) => used.add(m)); } }
    if (App.pres) App.usedMedia(App.pres).forEach((m) => used.add(m));
    const keys = await App.idb.keys('media');
    keys.forEach((k) => { if (!used.has(k)) { App.idb.del('media', k); saved.delete(k); } });
  }, 4000);

  /* ---------- Miniatuur voor het startscherm (kleine JPEG van de eerste dia) ---------- */
  App.thumbIndexSoon = App.debounce(async () => {
    if (!App.pres || !App.slideToImage) return;
    const P = App.pres;
    try {
      const url = await App.slideToImage(P.slides[0], { width: 200, type: 'image/jpeg', quality: 0.7 });
      const idx = App.store.get('index', []) || [];
      const e = idx.find((x) => x.id === P.id);
      if (e && url) { e.thumb = url; App.store.set('index', idx); }
    } catch { /* geen miniatuur */ }
  }, 5000);

  /* ---------- Versiegeschiedenis ---------- */
  let lastVersion = 0;
  App.versionTick = (data) => {
    if (App.settings.versions === false) return;
    const every = (App.settings.versionMinutes || 10) * 60000;
    if (Date.now() - lastVersion < every) return;
    lastVersion = Date.now();
    const key = data.id + ':' + Date.now();
    App.idb.set('versions', key, { t: Date.now(), title: data.title, slides: data.slides.length, data }).then(async () => {
      const keys = (await App.idb.keys('versions')).filter((k) => String(k).startsWith(data.id + ':')).sort();
      keys.slice(0, Math.max(0, keys.length - 25)).forEach((k) => App.idb.del('versions', k));
    }).catch(() => {});
  };
  App.def('versionHistory', async () => {
    const id = App.pres.id;
    const keys = (await App.idb.keys('versions')).filter((k) => String(k).startsWith(id + ':')).sort().reverse();
    const rows = [];
    for (const k of keys) { const v = await App.idb.get('versions', k); if (v) rows.push({ k, v }); }
    App.dialog({
      title: App.t('Versiegeschiedenis'), wide: true,
      body: rows.length ? `<div class="list-rows">${rows.map(({ k, v }) => `<div class="list-row"><span class="i">history</span><span class="grow"><b>${App.esc(App.fmtDateTime(v.t))}</b><br><small class="muted">${App.esc(v.title)} · ${App.t(v.slides === 1 ? '{0} dia' : '{0} dia\'s').replace('{0}', v.slides)}</small></span><button class="btn small" data-copy="${App.esc(k)}">${App.t('Als kopie openen')}</button><button class="btn small" data-restore="${App.esc(k)}">${App.t('Terugzetten')}</button></div>`).join('')}</div>`
        : `<p class="muted">${App.t('Er zijn nog geen eerdere versies. Doek bewaart automatisch een versie terwijl je werkt (instelbaar via Bestand › Opties › Opslaan).')}</p>`,
      onOpen: (d) => d.body.addEventListener('click', async (e) => {
        const r = e.target.closest('[data-restore], [data-copy]'); if (!r) return;
        const v = await App.idb.get('versions', r.dataset.restore || r.dataset.copy); if (!v) return;
        await loadMedia(v.data.mediaIds || []);
        const P = App.deserializePres(v.data, { media: false });
        if (r.dataset.copy) { P.id = App.uid('p'); P.title = P.title + ' ' + App.t('(versie van {0})').replace('{0}', App.fmtDateTime(v.t)); delete P.share; }
        else { P.id = App.pres.id; App.saveLocal(true); }
        d.close();
        App.loadPres(P); App.markDirty();
        App.toast(r.dataset.copy ? App.t('Versie geopend als kopie') : App.t('Versie teruggezet'), 'history');
      }),
    });
  });

  /* ---------- Niets kwijtraken bij afsluiten ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && App.pres && App.pres.dirty && App.settings.autosave) { App.saveLocal(true); }
  });
  window.addEventListener('beforeunload', (e) => {
    if (!App.pres || !App.pres.dirty) { App.store.del('session'); return; }
    if (App.settings.autosave && App.saveLocal(true) && !App.pres.dirty) { App.store.del('session'); return; }
    e.preventDefault(); e.returnValue = '';
  });
  App.on('change', () => { if (App.pres) App.store.set('session', { id: App.pres.id, t: Date.now() }); });
})();
