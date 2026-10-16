/* =========================================================
   Cel (gemaakt door JJ van Schelven) — opstarten
   ========================================================= */
'use strict';

(() => {
  // Instellingen laden (geen account of gegevens nodig)
  const saved = App.store.get('settings', {}) || {};
  Object.assign(App.settings, saved, { stats: { ...App.settings.stats, ...(saved.stats || {}) } });
  document.body.classList.toggle('dark', !!App.settings.dark);
  document.body.classList.toggle('no-fbar', !App.settings.fbar);
  App.updateSwatches();

  // Bij het openen altijd met een lege werkmap beginnen (zoals Excel).
  // Eerdere werkmappen staan onder Bestand › Openen / Recent. Een lege werkmap
  // wordt pas bewaard zodra je er iets in zet.
  const index = App.store.get('index', []) || [];
  if (location.hash.startsWith('#sjabloon=')) { App.newFromTemplate(location.hash.slice(10)); history.replaceState(null, '', location.pathname); }
  else {
    App.loadBook(App.newBook('Map' + (index.length + 1)));
    if (location.hash) history.replaceState(null, '', location.pathname);
  }

  // Startscherm bij het opstarten (zoals bekende kantoorprogramma's); uit te zetten via Bestand › Opties
  setTimeout(() => { if (App.settings.startScreen !== false && !location.hash && !/[?&]deel=/.test(location.search)) App.exec('openBackstage', 'home'); }, 50);

  // Opslaan bij afsluiten (en waarschuwen als dat niet lukt): zie opslag.js
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => App.scheduleRender());
  App.scheduleState();
  App.focusGrid();
  // Als programma (via localhost): app lokaal bewaren zodat hij ook zonder server en internet start
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
