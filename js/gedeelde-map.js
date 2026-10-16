/* =========================================================
   Inkt (gemaakt door JJ van Schelven) — gedeelde map.
   Documenten opslaan en openen in een map die met anderen wordt gedeeld of
   gesynchroniseerd (OneDrive, Google Drive, Dropbox, netwerkschijf).
   Wijzigingen van anderen worden herkend; bij gelijktijdig bewerken kies je
   welke versie blijft. Werkt in het programma (Inkt.exe) via App.native.
   ========================================================= */
'use strict';

(() => {
  const S = App.settings;
  const sep = (p) => (p.includes('/') && !p.includes('\\') ? '/' : '\\');
  const join = (dir, name) => dir.replace(/[\\/]+$/, '') + sep(dir) + name;
  const baseName = (p) => p.split(/[\\/]/).pop();
  const safe = (n) => (n || 'document').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document';
  const needNative = () => {
    if (App.native && App.native.ok) return true;
    App.dialog({
      title: 'Gedeelde map',
      body: '<p style="line-height:1.55;margin:4px 0">Opslaan in een gedeelde map werkt in het programma <b>Inkt</b> (start Inkt via het icoon op het bureaublad of in het Startmenu).</p><p class="muted small">In de browser kun je een document delen met Bestand › Opslaan als en het bestand daarna in je gedeelde map zetten.</p>',
    });
    return false;
  };
  App.shared = { busy: false, lastCheck: 0 };
  const info = () => App.doc.meta.shared || null;

  /* ---------- Map instellen ---------- */
  App.def('sharedFolderSetup', async (after) => {
    if (!needNative()) return;
    let found = [];
    try { found = (await App.native.call('folders')).folders || []; } catch { /* geen voorstellen */ }
    const cur = S.sharedFolder || '';
    const opts = found.map((f, i) => `<label class="list-row" style="cursor:pointer"><input type="radio" name="sf" value="${i}" ${cur && cur.startsWith(f.path) ? 'checked' : ''}><span class="i">cloud</span><span class="grow"><b>${App.esc(f.name)}</b><div class="muted small">${App.esc(join(f.path, 'Inkt'))}</div></span></label>`).join('');
    const d = App.dialog({
      title: 'Gedeelde map instellen', wide: true,
      body: `<p style="margin:0 0 10px;line-height:1.5">Kies een map die met anderen wordt gedeeld of gesynchroniseerd. Documenten die je daar opslaat, kunnen anderen openen en bewerken; Inkt waarschuwt als iemand anders het bestand intussen heeft gewijzigd.</p>
        <div class="list-rows" id="sf-list">${opts || '<div class="list-row muted">Geen OneDrive-, Google Drive- of Dropbox-map gevonden.</div>'}
          <label class="list-row" style="cursor:pointer"><input type="radio" name="sf" value="own" ${cur && !found.some((f) => cur.startsWith(f.path)) ? 'checked' : ''}><span class="i">folder</span><span class="grow"><b>Andere map…</b><div class="muted small" id="sf-own">${App.esc(cur && !found.some((f) => cur.startsWith(f.path)) ? cur : 'Bijvoorbeeld een gedeelde netwerkmap')}</div></span></label>
        </div>
        <div class="field" style="margin-top:12px"><span>Opslaan als</span>
          <div class="checks"><label><input type="radio" name="sf-fmt" value="inkt" ${S.sharedFormat !== 'docx' ? 'checked' : ''}> Inkt-document (.inkt) — alles blijft precies behouden</label>
          <label><input type="radio" name="sf-fmt" value="docx" ${S.sharedFormat === 'docx' ? 'checked' : ''}> DOCX-document (.docx) — voor collega's met een andere tekstverwerker</label></div>
          <div class="checks"><label><input type="checkbox" id="sf-copy" ${S.sharedDocxCopy ? 'checked' : ''}> Bij .inkt ook een .docx-kopie opslaan</label></div></div>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'Opslaan', primary: true, action: (dd) => {
          const v = (dd.$('input[name="sf"]:checked') || {}).value;
          let path = null;
          if (v === 'own') path = dd.el.dataset.own || (cur && !found.some((f) => cur.startsWith(f.path)) ? cur : null);
          else if (v != null) path = join(found[+v].path, 'Inkt');
          if (!path) { App.toast('Kies eerst een map', 'error'); return false; }
          S.sharedFolder = path;
          S.sharedFormat = dd.$('input[name="sf-fmt"]:checked').value;
          S.sharedDocxCopy = dd.$('#sf-copy').checked;
          App.saveSettings();
          App.toast('Gedeelde map ingesteld: ' + path, 'folder_shared', { ms: 3500 });
          if (after === 'save') setTimeout(() => App.exec('sharedFolderSave'), 50);
          if (App.bsSection === 'home' && $('#backstage')) App.renderBackstage('home');
        },
      }],
    });
    d.$('#sf-list').addEventListener('change', async (e) => {
      if (e.target.value !== 'own') return;
      try {
        const r = await App.native.call('pickFolder', { title: 'Kies de gedeelde map', start: cur });
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
    sh.modified = res.modified;
    if (sh.format === 'inkt' && S.sharedDocxCopy) {
      try { await App.native.call('write', { path: sh.path.replace(/\.inkt$/i, '.docx'), data: await buildData('docx'), force: '1' }); } catch { /* kopie is bijzaak */ }
    }
    App.saveLocal(true);
    const s = $('#save-state'); if (s) { s.textContent = 'Opgeslagen in gedeelde map'; s.classList.remove('dirty'); }
    return res;
  };
  const conflictDialog = (res) => new Promise((resolve) => {
    App.dialog({
      title: 'Iemand anders heeft dit document gewijzigd',
      body: `<p style="line-height:1.55;margin:4px 0">“${App.esc(baseName(info().path))}” in de gedeelde map is gewijzigd (${App.fmtDateTime(res.modified)}) nadat jij het opende. Wat wil je doen?</p>`,
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
        if (opts.silent) { App.shared.paused = true; App.toast('Iemand anders heeft het gedeelde document gewijzigd. Druk op Ctrl+S om te kiezen wat je wilt doen.', 'sync_problem', { ms: 6000 }); return; }
        const choice = await conflictDialog(res);
        if (choice === 'mine') res = await writeShared({ force: true });
        else if (choice === 'theirs') { App.exec('sharedFolderOpen', info().path); return; }
        else if (choice === 'copy') {
          const sh = info();
          const ext = sh.format === 'docx' ? '.docx' : '.inkt';
          sh.path = sh.path.replace(/(\.\w+)$/, '') + ' (kopie van ' + safe(S.author || 'mij') + ')' + ext;
          sh.modified = null;
          res = await writeShared({ force: true });
        } else return;
      }
      App.shared.paused = false;
      if (!opts.silent) App.toast('Opgeslagen in de gedeelde map: ' + baseName(info().path), 'folder_shared');
    } catch (e) {
      App.toast('Opslaan in de gedeelde map is mislukt: ' + e.message, 'error', { ms: 5000 });
    } finally { App.shared.busy = false; }
  };
  App.def('sharedFolderSave', async () => {
    if (!needNative()) return;
    if (!S.sharedFolder) { App.exec('sharedFolderSetup', 'save'); return; }
    const fmt = S.sharedFormat === 'docx' ? 'docx' : 'inkt';
    const path = join(S.sharedFolder, safe(App.doc.title) + '.' + fmt);
    const sh = info();
    if (!sh || sh.path !== path) {
      const st = await App.native.call('stat', { path }).catch(() => ({}));
      if (st.exists && !(await App.confirm('Bestand bestaat al', `In de gedeelde map staat al “${App.esc(baseName(path))}”. Wil je het vervangen?`, 'Vervangen', true))) return;
      App.doc.meta.shared = { path, format: fmt, modified: null };
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
      const doc = await App.fileToDoc(file);
      if (App.doc.dirty) App.saveLocal(true);
      // Hetzelfde gedeelde bestand opnieuw openen houdt hetzelfde lokale document aan
      const known = (App.store.get('index', []) || []).map((d) => App.store.get('doc.' + d.id)).find((d) => d && d.meta && d.meta.shared && d.meta.shared.path === path);
      App.loadDoc({ id: known ? known.id : App.uid('d'), title: doc.title, html: doc.html, meta: doc.meta });
      App.doc.meta.shared = { path, format: /\.docx$/i.test(name) ? 'docx' : 'inkt', modified: r.modified };
      App.saveLocal(true);
      App.closeBackstage && App.closeBackstage();
      App.toast('Geopend uit de gedeelde map: ' + name, 'folder_shared');
    } catch (e) { App.toast('Kon het bestand niet openen: ' + e.message, 'error', { ms: 5000 }); }
  });
  App.def('sharedFolderReveal', () => {
    if (!needNative()) return;
    if (!S.sharedFolder) { App.exec('sharedFolderSetup'); return; }
    App.native.call('reveal', { path: info() ? info().path : S.sharedFolder }).catch((e) => App.toast(e.message, 'error'));
  });
  App.sharedList = async () => {
    if (!App.native.ok || !S.sharedFolder) return null;
    const r = await App.native.call('list', { path: S.sharedFolder, ext: '.inkt,.docx' });
    return (r.files || []).sort((a, b) => b.modified - a.modified);
  };

  /* ---------- Opslaan (Ctrl+S) en automatisch bijwerken ---------- */
  const save = App.commands.save;
  if (save) {
    const orig = save.fn;
    save.fn = async (...a) => {
      if (info() && App.native.ok) { App.saveLocal(false); await App.saveToShared(); return; }
      return orig(...a);
    };
  }
  // Na wijzigingen het gedeelde bestand na een korte pauze bijwerken (zoals automatisch opslaan)
  const autoSync = App.debounce(() => { if (info() && App.native.ok && !App.shared.paused && S.autosave !== false) App.saveToShared({ silent: true }); }, 12000);
  App.on('change', () => { if (info()) autoSync(); });
  // Wijzigingen van anderen herkennen
  setInterval(async () => {
    const sh = info();
    if (!sh || !App.native.ok || App.shared.busy || document.hidden) return;
    try {
      const st = await App.native.call('stat', { path: sh.path });
      if (st.exists && sh.modified && st.modified - sh.modified > 1500 && !App.shared.notified) {
        App.shared.notified = true;
        App.toast('Iemand anders heeft dit document in de gedeelde map bijgewerkt.', 'sync', { action: 'Nieuwe versie laden', onAction: () => { App.shared.notified = false; App.exec('sharedFolderOpen', sh.path); }, ms: 12000 });
        setTimeout(() => { App.shared.notified = false; }, 60000);
      }
    } catch { /* map tijdelijk niet bereikbaar */ }
  }, 30000);

  /* ---------- Delen-menu (van js/delen.js) aanvullen ---------- */
  setTimeout(() => {
    const b = App.menuBuilders['m-share'];
    if (!b || b._gedeeld) return;
    const wrapped = () => b() + `<hr><button data-cmd="sharedFolderSave"><span class="i">folder_shared</span> Opslaan in gedeelde map</button>
      <button data-cmd="sharedFolderSetup"><span class="i">settings</span> Gedeelde map instellen…</button>`;
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
    cards.insertAdjacentHTML('beforeend', `<button class="bs-card" data-act="sharedFolderSave"><span class="i">folder_shared</span><div><b>Opslaan in gedeelde map</b><small>${sh ? 'Gekoppeld aan ' + App.esc(baseName(sh.path)) + '. Wijzigingen worden automatisch bijgewerkt.' : S.sharedFolder ? 'Map: ' + App.esc(S.sharedFolder) : 'Deel documenten via OneDrive, Google Drive, Dropbox of een netwerkmap.'}</small></div></button>
      <button class="bs-card" data-act="sharedFolderSetup"><span class="i">settings</span><div><b>Gedeelde map instellen</b><small>${S.sharedFolder ? App.esc(S.sharedFolder) : 'Nog niet ingesteld'}</small></div></button>`);
  };
})();
