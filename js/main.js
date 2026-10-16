/* =========================================================
   Inkt — opstarten
   ========================================================= */
'use strict';

(() => {
  // Instellingen laden
  Object.assign(App.settings, App.store.get('settings', {}) || {});
  // Eenmalig: oude standaard (Calibri 11, van vóór de Word 365-standaard) omzetten naar Aptos 12
  if (!App.settings.fontMigrated) {
    if (App.settings.defaultFont === 'Calibri' && +App.settings.defaultSize === 11) { App.settings.defaultFont = 'Aptos'; App.settings.defaultSize = 12; }
    App.settings.fontMigrated = true;
    App.store.set('settings', App.settings);
  }
  App.settings.initials = App.initialsOf(App.settings.author);
  document.body.classList.toggle('dark', !!App.settings.dark);
  document.body.classList.toggle('ruler-on', !!App.settings.ruler);
  $('#chk-ruler').checked = !!App.settings.ruler;
  $('#chk-nav').checked = !!App.settings.nav;
  $('#navpane').hidden = !App.settings.nav;
  App.ed.spellcheck = !!App.settings.spell;
  App.updateSwatches();
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* niets */ }

  // Editor-gebeurtenissen
  // Alleen gewone tekeninvoer/verwijdering telt als 'typen' (mag de layout overslaan);
  // Enter, plakken, slepen enz. geven altijd een volledige paginering.
  const TYPING = /^(insertText|insertCompositionText|insertReplacementText|deleteContent(Backward|Forward)|deleteWord(Backward|Forward))$/;
  App.ed.addEventListener('beforeinput', () => App.history.mark(), true);
  // Cursor verplaatsen sluit een typ-groep af (één ongedaan-maken-stap per typbeurt, zoals Word)
  App.ed.addEventListener('mousedown', () => App.history.flush(), true);
  App.ed.addEventListener('keydown', (e) => { if (/^(Arrow|Page|Home|End)/.test(e.key)) App.history.flush(); }, true);
  App.ed.addEventListener('input', (e) => {
    if (e.inputType === 'insertText' && !e.isComposing) App.cleanZwsp();
    App.changed({ typing: TYPING.test(e.inputType || '') });
  });
  // Afbeeldingen die later laden veranderen de hoogte: opnieuw pagineren
  App.ed.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') App.scheduleLayout(); }, true);
  document.addEventListener('selectionchange', () => {
    const r = App.getRange();
    if (r) { App.lastRange = r.cloneRange(); App.scheduleState(); if (r.collapsed) App.minibar.hide(); }
  });
  App.ed.addEventListener('mouseup', () => setTimeout(() => {
    if (App.state.painter) App.applyPainter();
    else if (!App.selectedObj) App.minibar.show();
  }, 0));
  App.ed.addEventListener('keydown', () => App.minibar.hide());
  document.addEventListener('keyup', (e) => {
    if (e.shiftKey && /Arrow|Home|End/.test(e.key)) { const r = App.getRange(); if (r && !r.collapsed) App.minibar.show(); }
  });

  // Document openen: net als Word start Inkt altijd met een leeg document.
  // Eerdere documenten staan onder Bestand › Openen / Recent.
  if (location.hash.startsWith('#sjabloon=')) { App.newDoc(location.hash.slice(10)); history.replaceState(null, '', location.pathname); }
  else { App.newDoc('blank'); if (location.hash === '#new') history.replaceState(null, '', location.pathname); }

  App.setZoom(1);
  // Op smalle schermen de pagina passend maken
  if ($('#canvas-scroll').clientWidth < App.geom().W + 60) App.exec('zoomWidth');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { App._forceSheets = true; App.layout(); App.drawRuler(); });
  window.addEventListener('beforeunload', () => { if (App.doc.dirty && App.settings.autosave) App.saveLocal(true); });
  App.scheduleState();
  // Als programma (via localhost): app lokaal bewaren zodat hij ook zonder server en internet start
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
