/* =========================================================
   Cel (gemaakt door JJ van Schelven) — veilig opslaan (zelfde aanpak als js/opslag.js van Inkt).
   De gewone opslag van de browser is klein (± 5 MB). Raakt die vol, dan gaat de werkmap
   naar een reserve-opslag (IndexedDB, veel groter). De werkmap gaat dus nooit verloren
   omdat de opslag vol is.
   ========================================================= */
'use strict';

/* ---------- Reserve-opslag (IndexedDB) ---------- */
App.bigStore = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('cel-opslag', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('books');
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => {
    const t = d.transaction('books', mode); const req = fn(t.objectStore('books'));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return {
    get: (id) => tx('readonly', (s) => s.get(id)).catch(() => null),
    set: (id, data) => tx('readwrite', (s) => s.put(data, id)),
    del: (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {}),
  };
})();

// Een opgeslagen werkmap ophalen: de nieuwste van de gewone en de reserve-opslag
App.loadStored = async (id) => {
  const a = App.store.get('book.' + id);
  const entry = (App.store.get('index', []) || []).find((x) => x.id === id);
  if (!entry || !entry.big) return a;
  const b = await App.bigStore.get(id);
  if (!a) return b; if (!b) return a;
  return (b.modified || 0) >= (a.modified || 0) ? b : a;
};

/* ---------- Opslaan met reserve ---------- */
(() => {
  const orig = App.saveLocal;
  App.saveLocal = (auto) => {
    const wasBig = ((App.store.get('index', []) || []).find((x) => x.id === App.book.id) || {}).big;
    if (orig(auto, true)) {
      if (wasBig) App.bigStore.del(App.book.id);
      App._bigWarned = false;
      return true;
    }
    // gewone opslag vol: naar de reserve-opslag
    const b = App.book, data = App.bookData();
    App.store.del('book.' + b.id);   // geen verouderde kopie laten staan
    App.markIndex(data, { big: true });
    App.bigStore.set(b.id, data).then(() => {
      if (!App._bigWarned) App.toast('De gewone opslag is vol. Cel bewaart deze werkmap nu in de reserve-opslag. Sla belangrijke werkmappen ook op als bestand.', 'info', { ms: 6000 });
      App._bigWarned = true;
    }).catch(() => {
      const s = $('#save-state');
      if (App.book.id === b.id) { b.dirty = true; s.textContent = 'Niet opgeslagen'; s.classList.add('dirty'); }
      App.toast('Kon de werkmap niet opslaan: de opslag is vol. Sla hem op als bestand via Bestand › Opslaan als.', 'error', { ms: 8000, action: 'Opslaan als', onAction: () => App.exportAs('xlsx') });
    });
    return true;
  };
})();

/* ---------- Niets kwijtraken bij afsluiten ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && App.book && App.book.dirty && App.settings.autosave) { if (App.state.editing) App.commitEdit(); App.saveLocal(true); }
});
window.addEventListener('beforeunload', (e) => {
  if (!App.book || !App.book.dirty) return;
  if (App.state.editing) App.commitEdit();
  if (App.settings.autosave && App.saveLocal(true) && !App.book.dirty) return;
  e.preventDefault(); e.returnValue = '';
});
