/* =========================================================
   Inkt (gemaakt door JJ van Schelven) — veilig opslaan.
   De gewone opslag van de browser is klein (± 5 MB). Raakt die vol, dan:
   1. verdwijnen eerst de oudste versies (van alle documenten, oudste eerst);
   2. gaat het document naar een reserve-opslag (IndexedDB, veel groter).
   Het document zelf gaat dus nooit verloren omdat de opslag vol is.
   ========================================================= */
'use strict';

/* ---------- Reserve-opslag (IndexedDB) ---------- */
App.bigStore = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('inkt-opslag', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('docs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => {
    const t = d.transaction('docs', mode); const req = fn(t.objectStore('docs'));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return {
    get: (id) => tx('readonly', (s) => s.get(id)).catch(() => null),
    set: (id, data) => tx('readwrite', (s) => s.put(data, id)),
    del: (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {}),
  };
})();

// Een opgeslagen document ophalen: de nieuwste van de gewone en de reserve-opslag
App.loadStored = async (id) => {
  const a = App.store.get('doc.' + id);
  const entry = (App.store.get('index', []) || []).find((x) => x.id === id);
  if (!entry || !entry.big) return a;
  const b = await App.bigStore.get(id);
  if (!a) return b; if (!b) return a;
  return (b.modified || 0) >= (a.modified || 0) ? b : a;
};

/* ---------- Ruimte maken: oudste versies eerst ---------- */
App.pruneVersions = () => {
  let all = [];
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('inkt.ver.')).forEach((k) => {
      const id = k.slice(9);
      App.versions(id).forEach((v, i) => all.push({ id, t: v.t || 0, i }));
    });
  } catch { return false; }
  if (!all.length) return false;
  all.sort((x, y) => x.t - y.t);
  // een kwart van alle versies (minstens één) weg, de oudste eerst
  const drop = all.slice(0, Math.max(1, Math.ceil(all.length / 4)));
  const byDoc = {};
  drop.forEach((x) => { (byDoc[x.id] = byDoc[x.id] || new Set()).add(x.i); });
  Object.entries(byDoc).forEach(([id, set]) => {
    const keep = App.versions(id).filter((v, i) => !set.has(i));
    if (keep.length) App.store.set(App.verKey(id), keep); else App.store.del(App.verKey(id));
  });
  return true;
};

/* ---------- Opslaan met reserve ---------- */
(() => {
  const orig = App.saveLocal;
  App.saveLocal = (auto) => {
    const wasBig = ((App.store.get('index', []) || []).find((x) => x.id === App.doc.id) || {}).big;
    let ok = orig(auto);
    for (let n = 0; !ok && n < 8 && App.pruneVersions(); n++) ok = orig(auto);
    if (ok) {
      if (wasBig) App.bigStore.del(App.doc.id);
      App._bigWarned = false;
      return ok;
    }
    // gewone opslag vol: naar de reserve-opslag
    const d = App.doc, data = App.docData();
    App.store.del('doc.' + d.id);   // geen verouderde kopie laten staan
    App.markIndex(data, { big: true });
    App.store.set('last', d.id);
    d.dirty = false;
    const s = $('#save-state'); s.textContent = 'Opgeslagen'; s.classList.remove('dirty');
    App.bigStore.set(d.id, data).then(() => {
      if (!App._bigWarned) App.toast('De gewone opslag is vol. Inkt bewaart dit document nu in de reserve-opslag. Sla belangrijke documenten ook op als bestand.', 'info', { ms: 6000 });
      App._bigWarned = true;
    }).catch(() => {
      if (App.doc.id === d.id) { d.dirty = true; s.textContent = 'Niet opgeslagen'; s.classList.add('dirty'); }
      App.toast('Kon het document niet opslaan: de opslag is vol. Sla het op als bestand via Bestand › Opslaan als.', 'error', { ms: 8000, action: 'Opslaan als', onAction: () => App.exportAs('docx') });
    });
    return true;
  };
})();

/* ---------- Niets kwijtraken bij afsluiten ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && App.doc && App.doc.dirty && App.settings.autosave) App.saveLocal(true);
});
window.addEventListener('beforeunload', (e) => {
  if (!App.doc || !App.doc.dirty || document.body.classList.contains('second-window')) return;
  if (App.settings.autosave && App.saveLocal(true) && !App.doc.dirty) return;
  e.preventDefault(); e.returnValue = '';
});
