/* =========================================================
   Doek (gemaakt door JJ van Schelven) — opstarten
   ========================================================= */
'use strict';

(() => {
  // Instellingen laden (geen account of gegevens nodig)
  const saved = App.store.get('settings', {}) || {};
  Object.assign(App.settings, saved);
  document.body.classList.toggle('dark', !!App.settings.dark);
  App.applySettingsUi();

  // Galerijen in het lint vullen (thema's, overgangen, animaties, stijlen …)
  App.refreshGalleries = () => {
    App.fillShapeStrips && App.fillShapeStrips();
    App.fillStyleGallery && App.fillStyleGallery();
    App.fillWordArtGallery && App.fillWordArtGallery();
    App.fillPicStyles && App.fillPicStyles();
    App.fillThemeGallery && App.fillThemeGallery();
    App.fillTransGallery && App.fillTransGallery();
    App.fillAnimGallery && App.fillAnimGallery();
    App.fillTableStyles && App.fillTableStyles();
    App.fillDiagramGallery && App.fillDiagramGallery();
    App.fillEqRibbon && App.fillEqRibbon();
    App.fillPenRow && App.fillPenRow();
    App.updateSwatches();
  };
  App.on('change', (o) => { if (o && (o.masters || o.all)) { App.fillStyleGallery && App.fillStyleGallery(); App.fillWordArtGallery && App.fillWordArtGallery(); App.fillThemeGallery && App.fillThemeGallery(); App.updateSwatches(); } });

  // Bij het openen met een nieuwe, lege presentatie beginnen; eerdere presentaties staan onder Bestand › Openen
  const index = App.store.get('index', []) || [];
  const hash = location.hash;
  const startOpts = { warnFonts: false };
  if (hash.startsWith('#sjabloon=')) { App.pres = App.newPres({ title: App.t('Presentatie') + (index.length + 1) }); App.loadPres(App.pres, startOpts); App.newFromTemplate(decodeURIComponent(hash.slice(10))); }
  else if (hash.startsWith('#open=')) { App.loadPres(App.newPres({ title: App.t('Presentatie') + (index.length + 1) }), startOpts); App.exec('openPresId', decodeURIComponent(hash.slice(6))); }
  else App.loadPres(App.newPres({ title: App.t('Presentatie') + (index.length + 1) }), startOpts);
  if (hash && !hash.startsWith('#publiek')) history.replaceState(null, '', location.pathname + location.search);
  App.refreshGalleries();
  App.pres.dirty = false;

  // Startscherm bij het opstarten (zoals bekende kantoorprogramma's); uit te zetten via Bestand › Opties
  setTimeout(() => {
    if (App.settings.startScreen !== false && !hash && !/[?&]deel=/.test(location.search) && !App.isAudience) App.exec('openBackstage', 'home');
  }, 60);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { App.invalidateThumbs && App.invalidateThumbs(); App.scheduleRender(true); });
  App.scheduleState();
  App.focusStage();
  // Als programma (via localhost): app lokaal bewaren zodat hij ook zonder server en internet start
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/\.local$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
  console.info(`Doek ${App.VERSION} — gemaakt door ${App.MAKER}`);
})();
