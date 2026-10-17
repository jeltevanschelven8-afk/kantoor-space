/* =========================================================
   Doek (gemaakt door JJ van Schelven) — gedeelde map, net als in Inkt.
   Presentaties opslaan en openen in een map die met anderen wordt gedeeld of
   gesynchroniseerd (OneDrive, Google Drive, Dropbox, netwerkschijf).
   Wijzigingen van anderen worden herkend; bij gelijktijdig bewerken kies je
   welke versie blijft. Werkt in het programma (Doek.exe) via App.native.
   De koppeling met het bestand wordt alleen op deze computer bewaard
   (nooit in de presentatie zelf), zodat een lokaal pad niet meereist.
   ========================================================= */
'use strict';

(() => {
  const S = App.settings;
  const sep = (p) => (p.includes('/') && !p.includes('\\') ? '/' : '\\');
  const join = (dir, name) => dir.replace(/[\\/]+$/, '') + sep(dir) + name;
  const baseName = (p) => p.split(/[\\/]/).pop();
  const safe = (n) => (n || 'presentatie').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'presentatie';
  const needNative = () => {
    if (App.native && App.native.ok) return true;
    App.dialog({
      title: App.t('Gedeelde map'),
      body: `<p style="line-height:1.55;margin:4px 0">${App.t('Opslaan in een gedeelde map werkt in het programma Doek (start Doek via het icoon op het bureaublad of in het Startmenu).')}</p><p class="muted small">${App.t('In de browser kun je een presentatie delen met Bestand › Opslaan als en het bestand daarna in je gedeelde map zetten.')}</p>`,
    });
    return false;
  };
  App.shared = { busy: false, lastCheck: 0 };
  const info = () => (App.pres ? App.store.get('sf.' + App.pres.id, null) : null);
  const setInfo = (v) => { if (v) App.store.set('sf.' + App.pres.id, v); else App.store.del('sf.' + App.pres.id); };

  /* ---------- Map instellen ---------- */
  App.def('sharedFolderSetup', async (after) => {
    if (!needNative()) return;
    let found = [];
    try { found = (await App.native.call('folders')).folders || []; } catch { /* geen voorstellen */ }
    const cur = S.sharedFolder || '';
    const opts = found.map((f, i) => `<label class="list-row" style="cursor:pointer"><input type="radio" name="sf" value="${i}" ${cur && cur.startsWith(f.path) ? 'checked' : ''}><span class="i">cloud</span><span class="grow"><b>${App.esc(f.name)}</b><div class="muted small notranslate">${App.esc(join(f.path, 'Doek'))}</div></span></label>`).join('');
    const d = App.dialog({
      title: App.t('Gedeelde map instellen'), wide: true,
      body: `<p style="margin:0 0 10px;line-height:1.5">${App.t('Kies een map die met anderen wordt gedeeld of gesynchroniseerd. Presentaties die je daar opslaat, kunnen anderen openen en bewerken; Doek waarschuwt als iemand anders het bestand intussen heeft gewijzigd.')}</p>
        <div class="list-rows" id="sf-list">${opts || `<div class="list-row muted">${App.t('Geen OneDrive-, Google Drive- of Dropbox-map gevonden.')}</div>`}
          <label class="list-row" style="cursor:pointer"><input type="radio" name="sf" value="own" ${cur && !found.some((f) => cur.startsWith(f.path)) ? 'checked' : ''}><span class="i">folder</span><span class="grow"><b>${App.t('Andere map…')}</b><div class="muted small notranslate" id="sf-own">${App.esc(cur && !found.some((f) => cur.startsWith(f.path)) ? cur : App.t('Bijvoorbeeld een gedeelde netwerkmap'))}</div></span></label>
        </div>
        <div class="field" style="margin-top:12px"><span>${App.t('Opslaan als')}</span>
          <div class="checks"><label><input type="radio" name="sf-fmt" value="doek" ${S.sharedFormat !== 'pptx' ? 'checked' : ''}> ${App.t('Doek-presentatie (.doek) — alles blijft precies behouden')}</label>
          <label><input type="radio" name="sf-fmt" value="pptx" ${S.sharedFormat === 'pptx' ? 'checked' : ''}> ${App.t('PowerPoint-presentatie (.pptx) — voor collega\'s met een ander presentatieprogramma')}</label></div>
          <div class="checks"><label><input type="checkbox" id="sf-copy" ${S.sharedPptxCopy ? 'checked' : ''}> ${App.t('Bij .doek ook een .pptx-kopie opslaan')}</label></div></div>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'Opslaan', primary: true, action: (dd) => {
          const v = (dd.$('input[name="sf"]:checked') || {}).value;
          let path = null;
          if (v === 'own') path = dd.el.dataset.own || (cur && !found.some((f) => cur.startsWith(f.path)) ? cur : null);
          else if (v != null) path = join(found[+v].path, 'Doek');
          if (!path) { App.toast(App.t('Kies eerst een map'), 'error'); return false; }
          S.sharedFolder = path;
          S.sharedFormat = dd.$('input[name="sf-fmt"]:checked').value;
          S.sharedPptxCopy = dd.$('#sf-copy').checked;
          App.saveSettings();
          App.toast(App.t('Gedeelde map ingesteld: {0}').replace('{0}', path), 'folder_shared', { ms: 3500 });
          if (after === 'save') setTimeout(() => App.exec('sharedFolderSave'), 50);
          if (App.bsSection === 'home' && $('#backstage')) App.renderBackstage('home');
        },
      }],
    });
    d.$('#sf-list').addEventListener('change', async (e) => {
      if (e.target.value !== 'own') return;
      try {
        const r = await App.native.call('pickFolder', { title: App.t('Kies de gedeelde map'), start: cur });
        if (r.path) { d.el.dataset.own = r.path; d.$('#sf-own').textContent = r.path; }
      } catch (err) { App.toast(err.message, 'error'); }
    });
  });

  /* ---------- Opslaan in de gedeelde map ---------- */
  const buildData = async (fmt) => App.native.toBase64(await App.buildBlob(fmt));
  const writeShared = async (opts = {}) => {
    const sh = info();
    const res = await App.native.call('write', { path: sh.path, data: await buildData(sh.format), expect: opts.force ? undefined : String(sh.modified || ''), force: opts.force ? '1' : '' });
    if (res.conflict) return res;
    sh.modified = res.modified; setInfo(sh);
    if (sh.format === 'doek' && S.sharedPptxCopy) {
      try { await App.native.call('write', { path: sh.path.replace(/\.doek$/i, '.pptx'), data: await buildData('pptx'), force: '1' }); } catch { /* kopie is bijzaak */ }
    }
    App.saveLocal(true);
    const s = $('#save-state'); if (s) { s.textContent = App.t('Opgeslagen in gedeelde map'); s.classList.remove('dirty'); }
    return res;
  };
  const conflictDialog = (res) => new Promise((resolve) => {
    App.dialog({
      title: App.t('Iemand anders heeft deze presentatie gewijzigd'),
      body: `<p style="line-height:1.55;margin:4px 0">${App.t('“{0}” in de gedeelde map is gewijzigd ({1}) nadat jij de presentatie opende. Wat wil je doen?').replace('{0}', App.esc(baseName(info().path))).replace('{1}', App.fmtDateTime(res.modified))}</p>`,
      buttons: [
        { label: 'Hun versie openen', left: true, action: () => resolve('theirs') },
        { label: 'Mijn versie als kopie opslaan', action: () => resolve('copy') },
        { label: 'Overschrijven met mijn versie', danger: true, action: () => resolve('mine') },
      ],
      onClose: (r) => { if (r == null) resolve(null); },
    });
  });
  App.saveToShared = async (opts = {}) => {
    if (App.shared.busy) return;
    App.shared.busy = true;
    try {
      let res = await writeShared(opts);
      if (res && res.conflict) {
        if (opts.silent) { App.shared.paused = true; App.toast(App.t('Iemand anders heeft de gedeelde presentatie gewijzigd. Druk op Ctrl+S om te kiezen wat je wilt doen.'), 'sync_problem', { ms: 6000 }); return; }
        const choice = await conflictDialog(res);
        if (choice === 'mine') res = await writeShared({ force: true });
        else if (choice === 'theirs') { App.exec('sharedFolderOpen', info().path); return; }
        else if (choice === 'copy') {
          const sh = info();
          const ext = sh.format === 'pptx' ? '.pptx' : '.doek';
          sh.path = sh.path.replace(/(\.\w+)$/, '') + ' (' + App.t('kopie van {0}').replace('{0}', safe(S.author || App.t('mij'))) + ')' + ext;
          sh.modified = null; setInfo(sh);
          res = await writeShared({ force: true });
        } else return;
      }
      App.shared.paused = false;
      if (!opts.silent) App.toast(App.t('Opgeslagen in de gedeelde map: {0}').replace('{0}', baseName(info().path)), 'folder_shared');
    } catch (e) {
      App.toast(App.t('Opslaan in de gedeelde map is mislukt: {0}').replace('{0}', e.message), 'error', { ms: 5000 });
    } finally { App.shared.busy = false; }
  };
  App.def('sharedFolderSave', async () => {
    if (!needNative()) return;
    if (!S.sharedFolder) { App.exec('sharedFolderSetup', 'save'); return; }
    const fmt = S.sharedFormat === 'pptx' ? 'pptx' : 'doek';
    const path = join(S.sharedFolder, safe(App.pres.title) + '.' + fmt);
    const sh = info();
    if (!sh || sh.path !== path) {
      const stt = await App.native.call('stat', { path }).catch(() => ({}));
      if (stt.exists && !(await App.confirm(App.t('Bestand bestaat al'), App.t('In de gedeelde map staat al “{0}”. Wil je het vervangen?').replace('{0}', App.esc(baseName(path))), App.t('Vervangen'), true))) return;
      setInfo({ path, format: fmt, modified: null });
      await App.saveToShared({ force: true });
    } else await App.saveToShared();
  });

  /* ---------- Openen uit de gedeelde map ---------- */
  App.def('sharedFolderOpen', async (path) => {
    if (!needNative() || !path) return;
    try {
      const r = await App.native.call('read', { path });
      const name = baseName(path);
      const file = new File([App.native.fromBase64(r.data)], name);
      const P = await App.fileToPres(file);
      if (!P) return;
      if (App.pres && App.pres.dirty) App.saveLocal(true);
      // hetzelfde gedeelde bestand opnieuw openen houdt dezelfde lokale presentatie aan
      const known = (App.store.get('index', []) || []).find((d) => { const x = App.store.get('sf.' + d.id, null); return x && x.path === path; });
      P.id = known ? known.id : App.uid('p');
      App.loadPres(P);
      setInfo({ path, format: /\.pptx$/i.test(name) ? 'pptx' : 'doek', modified: r.modified });
      App.saveLocal(true);
      App.closeBackstage && App.closeBackstage();
      App.toast(App.t('Geopend uit de gedeelde map: {0}').replace('{0}', name), 'folder_shared');
    } catch (e) { App.toast(App.t('Kon het bestand niet openen: {0}').replace('{0}', e.message), 'error', { ms: 5000 }); }
  });
  App.def('sharedFolderReveal', () => {
    if (!needNative()) return;
    if (!S.sharedFolder) { App.exec('sharedFolderSetup'); return; }
    App.native.call('reveal', { path: info() ? info().path : S.sharedFolder }).catch((e) => App.toast(e.message, 'error'));
  });
  App.sharedList = async () => {
    if (!App.native || !App.native.ok || !S.sharedFolder) return null;
    const r = await App.native.call('list', { path: S.sharedFolder, ext: '.doek,.pptx' });
    return (r.files || []).sort((a, b) => b.modified - a.modified);
  };

  /* ---------- Opslaan (Ctrl+S) en automatisch bijwerken ---------- */
  const save = App.commands.save;
  if (save) {
    const orig = save.fn;
    save.fn = async (...a) => {
      if (info() && App.native && App.native.ok) { App.saveLocal(false); await App.saveToShared(); return; }
      return orig(...a);
    };
  }
  // na wijzigingen het gedeelde bestand na een korte pauze bijwerken (zoals automatisch opslaan)
  const autoSync = App.debounce(() => { if (info() && App.native.ok && !App.shared.paused && S.autosave !== false) App.saveToShared({ silent: true }); }, 12000);
  App.on('change', () => { if (App.native && App.native.ok && info()) autoSync(); });
  // wijzigingen van anderen herkennen
  setInterval(async () => {
    if (!App.native || !App.native.ok || !App.pres) return;
    const sh = info();
    if (!sh || App.shared.busy || document.hidden) return;
    try {
      const stt = await App.native.call('stat', { path: sh.path });
      if (stt.exists && sh.modified && stt.modified - sh.modified > 1500 && !App.shared.notified) {
        App.shared.notified = true;
        App.toast(App.t('Iemand anders heeft deze presentatie in de gedeelde map bijgewerkt.'), 'sync', { action: App.t('Nieuwe versie laden'), onAction: () => { App.shared.notified = false; App.exec('sharedFolderOpen', sh.path); }, ms: 12000 });
        setTimeout(() => { App.shared.notified = false; }, 60000);
      }
    } catch { /* map tijdelijk niet bereikbaar */ }
  }, 30000);

  /* ---------- Delen-menu (van js/delen.js) aanvullen ---------- */
  setTimeout(() => {
    const b = App.menuBuilders['m-share'];
    if (!b || b._gedeeld) return;
    const wrapped = () => b() + `<hr><button data-cmd="sharedFolderSave"><span class="i">folder_shared</span> ${App.t('Opslaan in gedeelde map')}</button>
      <button data-cmd="sharedFolderSetup"><span class="i">settings</span> ${App.t('Gedeelde map instellen…')}</button>`;
    wrapped._gedeeld = true;
    App.menuBuilders['m-share'] = wrapped;
  }, 0);

  /* ---------- Bestand › Opslaan: kaart voor de gedeelde map ---------- */
  const prevRender = App.renderBackstage;
  App.renderBackstage = (sec) => {
    prevRender(sec);
    if (sec !== 'save') return;
    const main = $('#backstage .bs-main'); if (!main) return;
    const cards = main.querySelector('.bs-cards'); if (!cards) return;
    const sh = info();
    cards.insertAdjacentHTML('beforeend', `<button class="bs-card" data-act="sharedFolderSave"><span class="i">folder_shared</span><div><b>${App.t('Opslaan in gedeelde map')}</b><small>${sh ? App.t('Gekoppeld aan {0}. Wijzigingen worden automatisch bijgewerkt.').replace('{0}', App.esc(baseName(sh.path))) : S.sharedFolder ? App.t('Map: {0}').replace('{0}', App.esc(S.sharedFolder)) : App.t('Deel presentaties via OneDrive, Google Drive, Dropbox of een netwerkmap.')}</small></div></button>
      <button class="bs-card" data-act="sharedFolderSetup"><span class="i">settings</span><div><b>${App.t('Gedeelde map instellen')}</b><small>${S.sharedFolder ? App.esc(S.sharedFolder) : App.t('Nog niet ingesteld')}</small></div></button>`);
  };
})();
