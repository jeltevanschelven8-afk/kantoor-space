/* =========================================================
   Doek (gemaakt door JJ van Schelven) — bestanden: Bestand-scherm (backstage),
   nieuw, openen (.doek, .pptx, overzicht), opslaan en opslaan als, wachtwoord
   (AES via WebCrypto), versiegeschiedenis, account en opties
   ========================================================= */
'use strict';

(() => {
  const st = App.state;

  /* ---------- Laden en nieuw ---------- */
  App.loadPres = (P, opts = {}) => {
    if (App.textEdit && st.edit) App.textEdit.stop();
    if (App.closeShow) App.closeShow();
    App.pres = P;
    App.fileHandle = opts.fileHandle || null; App.fileKind = opts.fileKind || null;
    st.slide = App.clamp(opts.slide || 0, 0, P.slides.length - 1);
    st.sel = []; st.edit = null; st.view = 'normal'; st.master = { mi: 0, li: -1 }; st.sorterSel = [P.slides[st.slide] && P.slides[st.slide].id]; st.crop = null; st.points = null;
    document.body.classList.remove('view-sorter', 'view-notes', 'view-reading', 'view-master');
    $('#doc-title').value = P.title;
    App.invalidateThumbs && App.invalidateThumbs();
    App.history.reset();
    P.dirty = false;
    const s = $('#save-state'); if (s) { s.textContent = App.t('Opgeslagen'); s.classList.remove('dirty'); }
    App.updateContext && App.updateContext();
    App.fillFontBox && App.fillFontBox();
    App.refreshGalleries && App.refreshGalleries();
    App.renderAll(true);
    App.thumbs && App.thumbs.refresh(true);
    App.emit('load', P);
    if (opts.warnFonts !== false) setTimeout(() => App.checkFonts && App.checkFonts(), 400);
  };
  App.newPresentation = (opts = {}) => {
    if (App.pres && App.pres.dirty) App.saveLocal(true);
    const n = (App.store.get('index', []) || []).length + 1;
    const P = opts.build ? opts.build() : App.newPres({ theme: opts.theme, variant: opts.variant, title: App.t('Presentatie') + n });
    if (!P.title) P.title = App.t('Presentatie') + n;
    App.loadPres(P);
    App.markDirty();
  };
  App.def('newPresentation', (theme) => { App.newPresentation({ theme }); App.closeBackstage(); });
  $('#doc-title').addEventListener('change', (e) => {
    App.run(() => { App.pres.title = e.target.value.trim() || App.pres.title; }, { noTouch: true });
    e.target.value = App.pres.title; App.updateStatus();
  });
  $('#doc-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); App.focusStage(); } });
  App.readOnly = () => { const s = App.pres && App.pres.share; return !!(s && s.perm === 'view' && !s.owner); };

  /* ---------- Bestanden openen ---------- */
  App.OPEN_TYPES = ['.pptx', '.potx', '.ppsx', '.doek', '.json', '.txt', '.md'];
  App.fileToPres = async (file) => {
    const name = file.name || 'presentatie';
    const ext = name.split('.').pop().toLowerCase();
    const title = name.replace(/\.[^.]+$/, '');
    if (ext === 'doek' || ext === 'json') {
      let d = JSON.parse(await App.readFile(file));
      if (d && d.format === 'doek-enc') d = await App.decryptPres(d, title);
      if (!d || d.format !== 'doek' || !Array.isArray(d.slides)) throw new Error(App.t('Geen geldig Doek-bestand'));
      const P = App.deserializePres(d);
      P.id = App.uid('p'); P.title = d.title || title;
      return P;
    }
    if (ext === 'pptx' || ext === 'potx' || ext === 'ppsx' || ext === 'pptm') {
      if (!App.Pptx || !App.Pptx.read) throw new Error(App.t('Het openen van .pptx is nog niet beschikbaar.'));
      const P = await App.Pptx.read(await App.readFile(file, 'buffer'), title);
      if (ext === 'potx') P.title = title;
      return P;
    }
    if (ext === 'ppt') throw new Error(App.t('Het oude .ppt-formaat wordt niet ondersteund. Sla het bestand eerst op als .pptx.'));
    if (ext === 'odp') throw new Error(App.t('.odp wordt nog niet ondersteund. Sla het bestand op als .pptx.'));
    if (ext === 'txt' || ext === 'md') {
      const P = App.newPres({ title, empty: true });
      const prev = App.pres; App.pres = P;
      try {
        const text = (await App.readFile(file)).replace(/^﻿/, '');
        const m = P.masters[0];
        const blocks = text.replace(/\r\n?/g, '\n').split(/\n(?=\S)/);
        blocks.forEach((b, i) => {
          const lines = b.split('\n').filter((l) => l.trim());
          if (!lines.length) return;
          const s = App.newSlide(m.layouts.find((l) => l.type === (i === 0 ? 'title' : 'obj')));
          const t = s.objs.find((o) => o.ph && App.phFamily(o.ph.type) === 'title');
          if (t) t.text = { paras: [{ runs: [{ t: lines[0].replace(/^#+\s*/, '').trim() }] }] };
          const body = s.objs.find((o) => o.ph && App.phFamily(o.ph.type) === 'body');
          if (body && lines.length > 1) body.text = { paras: lines.slice(1).map((l) => ({ runs: [{ t: l.trim().replace(/^[-*•]\s+/, '') }], lvl: Math.min(8, Math.floor((l.match(/^\s*/)[0].replace(/\t/g, '    ').length) / 4)) })) };
          P.slides.push(s);
        });
        if (!P.slides.length) P.slides.push(App.newSlide(m.layouts[0]));
      } finally { App.pres = prev; }
      return P;
    }
    throw new Error(App.t('Dit bestandstype wordt niet ondersteund.'));
  };
  App.def('openFile', async () => {
    let file, handle = null;
    if (window.showOpenFilePicker) {
      try {
        [handle] = await window.showOpenFilePicker({ types: [{ description: App.t('Presentaties'), accept: { 'application/octet-stream': App.OPEN_TYPES } }] });
        file = await handle.getFile();
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (!file) file = await App.pickFile(App.OPEN_TYPES.join(',') + ',.ppt,.odp');
    if (!file) return;
    App.openFileObject(file, handle);
  });
  App.openFileObject = async (file, handle) => {
    try {
      App.toast(App.t('Bezig met openen…'), 'hourglass_top', { ms: 1500 });
      const P = await App.fileToPres(file);
      if (App.pres && App.pres.dirty) App.saveLocal(true);
      const ext = file.name.split('.').pop().toLowerCase();
      const keep = handle && (ext === 'pptx' || ext === 'doek');
      App.loadPres(P, { fileHandle: keep ? handle : null, fileKind: keep ? ext : null });
      App.saveLocal(true);
      App.closeBackstage();
      App.toast(App.t('“{0}” geopend').replace('{0}', file.name), 'ok');
      if (P._importNotes && P._importNotes.length) setTimeout(() => App.dialog({ title: App.t('Niet alles kon worden overgenomen'), body: `<p class="muted small" style="margin:0 0 8px">${App.t('Doek heeft het bestand geopend. Deze onderdelen zijn vereenvoudigd of weggelaten:')}</p><ul style="margin:0;padding-left:18px;line-height:1.6">${[...new Set(P._importNotes)].slice(0, 20).map((n) => `<li>${App.esc(App.t(n))}</li>`).join('')}</ul>` }), 600);
    } catch (e) {
      console.error(e);
      App.toast(App.t('Kon het bestand niet openen: {0}').replace('{0}', e.message), 'error', { ms: 6000 });
    }
  };
  // bestanden naar het venster slepen
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    if (/^image\//.test(f.type)) Array.from(e.dataTransfer.files).forEach((x, i) => App.insertImageFile(x, { offset: i * 18 }));
    else if (/^(video|audio)\//.test(f.type)) App.insertMediaFile(f);
    else App.openFileObject(f);
  });

  /* ---------- Opslaan en exporteren ---------- */
  App.def('save', async () => {
    if (st.edit) App.textEdit.stop();
    const ok = App.saveLocal(false);
    if (App.fileHandle) {
      try {
        const blob = await App.buildBlob(App.fileKind);
        const w = await App.fileHandle.createWritable(); await w.write(blob); await w.close();
        App.toast(App.t('Opgeslagen in {0}').replace('{0}', App.fileHandle.name), 'save');
        const s = $('#save-state'); if (s) s.textContent = App.t('Opgeslagen') + ' · ' + App.fileHandle.name;
        return;
      } catch (e) { App.toast(App.t('Kon niet naar het bestand schrijven: {0}').replace('{0}', e.message), 'error'); }
    }
    if (ok) App.toast(App.t('Opgeslagen op deze computer'), 'save', { action: App.t('Ook als .pptx-bestand'), onAction: () => App.exportAs('pptx'), ms: 4000 });
  });
  App.buildBlob = async (kind) => {
    switch (kind) {
      case 'pptx': if (!App.Pptx || !App.Pptx.build) throw new Error(App.t('Opslaan als .pptx is nog niet beschikbaar.')); return App.Pptx.build(App.pres);
      case 'potx': return App.Pptx.build(App.pres, { template: true });
      case 'doek': {
        const data = JSON.stringify(App.serializePres({ noShare: true }));   // deelgegevens (eigenaarscode) nooit in een bestand dat je weggeeft
        if (App.presPassword) return new Blob([JSON.stringify(await App.encryptPres(data, App.presPassword))], { type: 'application/json' });
        return new Blob([data], { type: 'application/json' });
      }
      case 'outline': return new Blob(['﻿' + App.outlineText()], { type: 'text/plain' });
      default: if (App.buildExport) return App.buildExport(kind); throw new Error(App.t('Onbekend formaat'));
    }
  };
  App.EXPORTS = {
    pptx: { label: 'PowerPoint-presentatie (.pptx)', ext: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', icon: 'slideshow', desc: 'Het gangbare presentatieformaat; te openen in vrijwel elk presentatieprogramma. Met thema, indelingen, animaties, overgangen en notities.' },
    doek: { label: 'Doek-presentatie (.doek)', ext: '.doek', mime: 'application/json', icon: 'co_present', desc: 'Bewaart alles precies zoals het is in Doek, ook als je een wachtwoord instelt.' },
    pdf: { label: 'PDF', ext: '.pdf', icon: 'picture_as_pdf', desc: 'Vaste opmaak, ideaal om te delen of af te drukken. Eén dia per pagina, of hand-outs en notitiepagina\'s via Afdrukken.' },
    potx: { label: 'Sjabloon (.potx)', ext: '.potx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.template', icon: 'description', desc: 'Een sjabloon met het thema en de indelingen, om nieuwe presentaties mee te maken.' },
    png: { label: 'PNG-afbeeldingen', ext: '.png', icon: 'image', desc: 'Elke dia (of alleen de huidige) als afbeelding met hoge kwaliteit.' },
    jpg: { label: 'JPEG-afbeeldingen', ext: '.jpg', icon: 'photo', desc: 'Elke dia (of alleen de huidige) als kleinere foto-afbeelding.' },
    svg: { label: 'SVG (vectorafbeelding)', ext: '.svg', icon: 'polyline', desc: 'De huidige dia als schaalbare afbeelding voor webpagina\'s.' },
    video: { label: 'Video (.mp4 of .webm)', ext: '.mp4', icon: 'movie', desc: 'De presentatie als video, met overgangen, animaties en timings.' },
    outline: { label: 'Overzicht (.txt)', ext: '.txt', mime: 'text/plain', icon: 'format_list_bulleted', desc: 'Alleen de tekst van titels en opsommingen, met inspringingen.' },
  };
  App.exportAs = async (kind) => {
    if (st.edit) App.textEdit.stop();
    if (kind === 'pdf') { App.closeBackstage(); setTimeout(() => App.exec('print', 'pdf'), 120); return; }
    if ((kind === 'png' || kind === 'jpg' || kind === 'svg' || kind === 'video') && App.exportDialog) { App.closeBackstage(); App.exportDialog(kind); return; }
    const info = App.EXPORTS[kind];
    const name = App.safeName(App.pres.title) + info.ext;
    let handle = null;
    if (window.showSaveFilePicker) {
      try { handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: App.t(info.label), accept: { [info.mime || 'application/octet-stream']: [info.ext] } }] }); }
      catch (e) { if (e.name === 'AbortError') return; handle = null; }
    }
    try {
      App.toast(App.t('Bezig met opslaan…'), 'hourglass_top', { ms: 1200 });
      const blob = await App.buildBlob(kind);
      if (handle) {
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        if (kind === 'pptx' || kind === 'doek') { App.fileHandle = handle; App.fileKind = kind; App.saveLocal(true); }
        App.toast(App.t('Opgeslagen als {0}').replace('{0}', handle.name), 'ok');
      } else { App.download(blob, name); App.toast(App.t('{0} gedownload').replace('{0}', name), 'ok'); }
    } catch (e) { console.error(e); App.toast(App.t('Opslaan mislukt: {0}').replace('{0}', e.message), 'error', { ms: 5000 }); }
  };
  App.def('exportAs', (k) => App.exportAs(k));
  App.outlineText = () => App.pres.slides.map((s, i) => {
    const lines = [`${i + 1}. ${App.slideTitle(s)}`];
    s.objs.filter((o) => o.ph && App.phFamily(o.ph.type) === 'body' && o.text).forEach((o) => o.text.paras.forEach((p) => { const t = p.runs.map((r) => r.t).join('').replace(/\v/g, ' '); if (t.trim()) lines.push('    '.repeat((p.lvl || 0) + 1) + t); }));
    return lines.join('\r\n');
  }).join('\r\n\r\n');

  /* ---------- Wachtwoord (AES-GCM, sleutel via PBKDF2) ---------- */
  const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const keyFrom = async (pw, salt) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  App.encryptPres = async (json, pw) => {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(pw, salt), new TextEncoder().encode(json));
    return { format: 'doek-enc', v: 1, kdf: 'PBKDF2-SHA256-250000', salt: b64(salt), iv: b64(iv), data: b64(data) };
  };
  App.decryptPres = async (d, title) => {
    for (let tries = 0; tries < 5; tries++) {
      const pw = await App.prompt(App.t('Wachtwoord'), App.t('Voer het wachtwoord in voor “{0}”').replace('{0}', title), '', { ok: App.t('Openen') });
      if (pw === null) throw new Error(App.t('Openen geannuleerd'));
      try {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, await keyFrom(pw, unb64(d.salt)), unb64(d.data));
        App._openedPassword = pw;
        return JSON.parse(new TextDecoder().decode(plain));
      } catch { App.toast(App.t('Onjuist wachtwoord'), 'error'); }
    }
    throw new Error(App.t('Onjuist wachtwoord'));
  };
  App.on('load', () => { App.presPassword = App._openedPassword || null; App._openedPassword = null; });
  App.def('encryptPres', () => {
    App.dialog({
      title: App.t('Versleutelen met wachtwoord'),
      body: `<p class="muted small" style="margin:0 0 10px;line-height:1.5">${App.t('Het wachtwoord geldt voor het opgeslagen .doek-bestand. Let op: als je het wachtwoord vergeet, kan niemand het bestand nog openen. Laat het veld leeg om het wachtwoord te verwijderen.')}</p>
        <label class="field"><span>${App.t('Wachtwoord')}</span><input id="pw1" type="password" autocomplete="new-password"></label><label class="field"><span>${App.t('Wachtwoord bevestigen')}</span><input id="pw2" type="password" autocomplete="new-password"></label>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const a = d.$('#pw1').value, b = d.$('#pw2').value;
        if (a !== b) { App.toast(App.t('De wachtwoorden zijn niet gelijk.'), 'error'); return false; }
        App.presPassword = a || null;
        App.toast(a ? App.t('Wachtwoord ingesteld. Sla op als .doek-bestand om het te gebruiken.') : App.t('Wachtwoord verwijderd'), 'key');
        if (App.bsSection === 'info') App.renderBackstage('info');
      } }],
    });
  });

  /* ---------- Sjablonen (eigen voorbeelden) ---------- */
  const T = (s) => (App.tt ? App.tt(s) : s);
  const fillPh = (slide, fam, paras) => { const o = slide.objs.find((x) => x.ph && App.phFamily(x.ph.type) === fam); if (o) o.text = { paras: paras.map((p) => (typeof p === 'string' ? { runs: [{ t: T(p) }] } : { ...p, runs: [{ t: T(p.t) }] })) }; return o; };
  const sample = (theme, title, slides) => () => {
    const P = App.newPres({ theme, title: T(title), empty: true });
    const prev = App.pres; App.pres = P;
    try {
      const m = P.masters[0];
      slides.forEach(([type, ttl, body, extra]) => {
        const s = App.newSlide(m.layouts.find((l) => l.type === type) || m.layouts[1]);
        if (ttl) fillPh(s, 'title', [ttl]);
        if (body) { const bodies = s.objs.filter((x) => x.ph && App.phFamily(x.ph.type) === 'body'); (Array.isArray(body[0]) ? body : [body]).forEach((b, i) => { if (bodies[i]) bodies[i].text = { paras: b.map((p) => (typeof p === 'string' ? { runs: [{ t: T(p) }] } : { lvl: p.lvl, runs: [{ t: T(p.t) }] })) }; }); }
        if (extra) extra(s, P);
        P.slides.push(s);
      });
    } finally { App.pres = prev; }
    return P;
  };
  App.TEMPLATES = [
    { id: 'blank', name: 'Lege presentatie', build: () => App.newPres({ title: '' }) },
    { id: 'welkom', name: 'Welkom bij Doek', build: sample('horizon', 'Welkom bij Doek', [
      ['title', 'Welkom bij Doek', ['Presentaties maken en geven — gemaakt door JJ van Schelven']],
      ['obj', 'Aan de slag', ['Klik op een tekst om te typen', 'Ctrl+M maakt een nieuwe dia', 'Kies een thema op het tabblad Ontwerpen', 'Voeg vormen, afbeeldingen, tabellen en grafieken toe via Invoegen', 'Druk op F5 om te presenteren']],
      ['twoObj', 'Beweging', [['Overgangen tussen dia\'s, ook Morph', 'Animaties voor ingang, nadruk en uitgang'], ['Bewegingspaden en triggers', 'Het animatiedeelvenster met een tijdlijn']]],
      ['secHead', 'Presenteren', ['Presentatorweergave, pen, laserpointer en timings']],
      ['titleOnly', 'Veel plezier!', null],
    ]) },
    { id: 'spreekbeurt', name: 'Spreekbeurt', build: sample('tulp', 'Mijn spreekbeurt', [
      ['title', 'Mijn spreekbeurt', ['Naam · groep · datum']],
      ['obj', 'Waarom dit onderwerp?', ['Wat vind ik er leuk aan?', 'Wat wilde ik ontdekken?']],
      ['obj', 'Wat ik heb ontdekt', ['Feit 1', 'Feit 2', 'Feit 3']],
      ['picTx', 'Een mooie foto', ['Vertel hier wat er op de foto te zien is.']],
      ['obj', 'Vragen?', ['Bedankt voor het luisteren!']],
    ]) },
    { id: 'project', name: 'Projectplan', build: sample('metro', 'Projectplan', [
      ['title', 'Projectplan', ['Projectnaam · team']],
      ['obj', 'Doel', ['Wat willen we bereiken?', 'Voor wie doen we het?', 'Hoe weten we dat het gelukt is?']],
      ['twoTxTwoObj', 'Planning', [['Fase 1'], ['Onderzoek', 'Ontwerp'], ['Fase 2'], ['Bouwen', 'Testen', 'Opleveren']]],
      ['obj', 'Risico\'s en afspraken', ['Risico 1 en wat we eraan doen', 'Wie doet wat?', 'Wanneer spreken we af?']],
    ]) },
    { id: 'les', name: 'Les', build: sample('polder', 'Les: onderwerp', [
      ['title', 'Les: onderwerp', ['Vak · klas']],
      ['obj', 'Leerdoelen', ['Aan het eind van de les kun je …', 'Je weet …', 'Je begrijpt …']],
      ['obj', 'Uitleg', ['Begrip 1', { t: 'Toelichting', lvl: 1 }, 'Begrip 2', { t: 'Toelichting', lvl: 1 }]],
      ['obj', 'Aan de slag', ['Opdracht 1', 'Opdracht 2', 'Klaar? Bekijk de extra opdracht.']],
      ['secHead', 'Afsluiting', ['Wat hebben we geleerd?']],
    ]) },
    { id: 'kwartaal', name: 'Kwartaalcijfers', build: sample('delta', 'Kwartaalcijfers', [
      ['title', 'Kwartaalcijfers', ['Resultaten en vooruitblik']],
      ['titleOnly', 'Omzet per kwartaal', null, (s) => { if (App.Charts && App.Charts.sample) s.objs.push(App.newObj('chart', { x: 120, y: 190, w: 1040, h: 470, name: 'Grafiek 1', chart: App.Charts.sample('column', 'clustered') })); }],
      ['obj', 'Hoogtepunten', ['Groei in alle regio\'s', 'Nieuwe klanten', 'Lagere kosten']],
    ]) },
    { id: 'album', name: 'Fotoalbum', build: sample('studio', 'Fotoalbum', [
      ['title', 'Fotoalbum', ['Gemaakt met Doek']],
      ['picTx', 'Foto 1', ['Klik op het pictogram om een foto toe te voegen.']],
      ['picTx', 'Foto 2', ['Beschrijving']],
    ]) },
  ];
  App.newFromTemplate = (id) => {
    if (id && id.startsWith('theme:')) { App.newPresentation({ theme: id.slice(6) }); return; }
    const t = App.TEMPLATES.find((x) => x.id === id) || App.TEMPLATES[0];
    App.newPresentation({ build: t.build });
    if (t.id !== 'blank' && App.pres.title === '') App.pres.title = App.t(t.name);
  };
  const tplThumb = (id) => {
    let P;
    if (id.startsWith('theme:')) P = App.newPres({ theme: id.slice(6), title: '' });
    else { const t = App.TEMPLATES.find((x) => x.id === id); P = t.build(); }
    const prev = App.pres; App.pres = P;
    try {
      const s = P.slides[0];
      if (id.startsWith('theme:')) { const def = App.themeDef(id.slice(6)); fillPh(s, 'title', [App.t(def.name)]); }
      return App.slideThumb(s, 150);
    } finally { App.pres = prev; }
  };
  const tplCard = (id, name) => `<button class="tpl" data-tpl="${App.esc(id)}"><div class="thumb ptpl" data-tthumb="${App.esc(id)}"></div><div class="tname">${App.esc(App.t(name))}</div></button>`;
  App.tplCard = (t) => tplCard(t.id, t.name);
  App.fillTplThumbs = (root) => root.querySelectorAll('[data-tthumb]').forEach((el) => { if (el.dataset.done) return; el.dataset.done = 1; try { el.appendChild(tplThumb(el.dataset.tthumb)); } catch (e) { console.warn(e); } });
  App.TEMPLATE_CARDS = () => [{ id: 'blank', name: 'Lege presentatie' }, ...App.TEMPLATES.slice(1).map((t) => ({ id: t.id, name: t.name })), ...App.THEMES.map((t) => ({ id: 'theme:' + t.id, name: t.name }))];

  /* ---------- Bestand-scherm ---------- */
  App.def('openBackstage', (section) => {
    if (st.edit) App.textEdit.stop();
    let bs = $('#backstage');
    if (!bs) {
      bs = document.createElement('div');
      bs.id = 'backstage';
      bs.innerHTML = `<nav class="bs-nav">
        <button class="bs-back" data-bs="back" title="${App.esc(App.t('Terug naar de presentatie (Esc)'))}"><span class="i">arrow_back</span></button>
        <button data-bs="home"><span class="i">home</span> ${App.t('Start')}</button>
        <button data-bs="new"><span class="i">note_add</span> ${App.t('Nieuw')}</button>
        <button data-bs="open"><span class="i">folder_open</span> ${App.t('Openen')}</button>
        <div class="bs-sep"></div>
        <button data-bs="info">${App.t('Info')}</button>
        <button data-bs="save">${App.t('Opslaan')}</button>
        <button data-bs="export">${App.t('Opslaan als')}</button>
        <button data-bs="print">${App.t('Afdrukken')}</button>
        <button data-bs="exportfmt">${App.t('Exporteren')}</button>
        <button data-bs="close">${App.t('Sluiten')}</button>
        <div class="bs-fill"></div>
        <div class="bs-sep"></div>
        <button data-bs="about">${App.t('Account')}</button>
        <button data-bs="options">${App.t('Opties')}</button>
      </nav><div class="bs-main"></div>`;
      document.body.appendChild(bs);
      bs.querySelector('.bs-nav').addEventListener('click', (e) => {
        const b = e.target.closest('[data-bs]'); if (!b) return;
        if (b.dataset.bs === 'back') App.closeBackstage(); else App.renderBackstage(b.dataset.bs);
      });
      bs.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('.backdrop')) { e.preventDefault(); App.closeBackstage(); } });
    }
    App.renderBackstage(typeof section === 'string' ? section : 'home');
    setTimeout(() => { const b = bs.querySelector('.bs-nav .on') || bs.querySelector('.bs-back'); b && b.focus(); }, 20);
  });
  App.closeBackstage = () => { const bs = $('#backstage'); if (bs) { bs.remove(); App.focusStage(); } };
  App.def('closeBackstage', () => App.closeBackstage());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#backstage') && !$('.backdrop')) { e.preventDefault(); App.closeBackstage(); } });
  const recentRows = (limit, withDelete) => {
    const idx = (App.store.get('index', []) || []).slice(0, limit);
    if (!idx.length) return `<div class="recent-row" style="cursor:default"><span class="muted">${App.t('Nog geen presentaties. Begin met een nieuwe presentatie.')}</span></div>`;
    return idx.map((d) => `<div class="recent-row" data-open="${d.id}"><span class="i">co_present</span><span class="rn">${App.esc(d.title)}${d.id === App.pres.id ? ` <span class="chip" style="margin-left:6px">${App.t('geopend')}</span>` : ''}</span><span class="rd">${d.slides ? App.t(d.slides === 1 ? '{0} dia' : '{0} dia\'s').replace('{0}', d.slides) + ' · ' : ''}${App.fmtDateTime(d.modified)}</span>${withDelete ? `<button class="qb" data-del="${d.id}" title="${App.esc(App.t('Verwijderen van deze computer'))}"><span class="i">delete</span></button>` : ''}</div>`).join('');
  };
  App.renderBackstage = (sec) => {
    App.bsSection = sec;
    const bs = $('#backstage'), main = bs.querySelector('.bs-main');
    if (sec === 'close') { App.closePresentation(); return; }
    $$('.bs-nav [data-bs]', bs).forEach((b) => b.classList.toggle('on', b.dataset.bs === sec));
    const P = App.pres;
    let html = '';
    if (sec === 'home') {
      html = `<h1>${App.t('Start')}</h1>`;
    } else if (sec === 'new') {
      html = `<h1>${App.t('Nieuw')}</h1><div class="tpl-grid">${App.TEMPLATE_CARDS().map((t) => tplCard(t.id, t.name)).join('')}</div>`;
    } else if (sec === 'open') {
      html = `<h1>${App.t('Openen')}</h1><div class="bs-cards" style="margin-bottom:8px"><button class="bs-card" data-act="openFile"><span class="i">folder_open</span><div><b>${App.t('Bladeren…')}</b><small>${App.t('Open een bestand van je computer: .pptx, .potx, Doek (.doek) of een overzicht als tekst. Je kunt een bestand ook naar dit venster slepen.')}</small></div></button></div>
        <h3>${App.t('Presentaties op deze computer')}</h3><div class="recent-list">${recentRows(300, true)}</div>`;
    } else if (sec === 'info') {
      let objs = 0, imgs = 0, anims = 0, words = 0;
      P.slides.forEach((s) => { App.walkObjs(s.objs, (o) => { objs++; if (o.type === 'image') imgs++; const t = App.objText(o); if (t) words += t.split(/\s+/).filter(Boolean).length; }); anims += (s.anims || []).length; });
      const card = (act, icon, title, sub) => `<button class="bs-card" data-act="${act}"><span class="i">${icon}</span><div><b>${App.esc(App.t(title))}</b><small>${App.esc(App.t(sub))}</small></div></button>`;
      html = `<h1>${App.t('Info')}</h1><div class="props">
        <span class="k">${App.t('Titel')}</span><input id="bs-title" value="${App.esc(P.title)}">
        <span class="k">${App.t('Onderwerp')}</span><input id="bs-subject" value="${App.esc(P.props.subject || '')}">
        <span class="k">${App.t('Trefwoorden')}</span><input id="bs-keywords" value="${App.esc(P.props.keywords || '')}">
        <span class="k">${App.t('Gemaakt')}</span><span>${App.fmtDateTime(P.props.created)}</span>
        <span class="k">${App.t('Laatst gewijzigd')}</span><span>${App.fmtDateTime(P.props.modified)}</span>
        <span class="k">${App.t('Dia\'s')}</span><span>${P.slides.length}${P.slides.some((s) => s.hidden) ? ' (' + App.t('{0} verborgen').replace('{0}', P.slides.filter((s) => s.hidden).length) + ')' : ''}</span>
        <span class="k">${App.t('Objecten')}</span><span>${objs} · ${App.t('{0} afbeeldingen').replace('{0}', imgs)} · ${App.t('{0} animaties').replace('{0}', anims)}</span>
        <span class="k">${App.t('Woorden')}</span><span>${words.toLocaleString('nl-NL')}</span>
        <span class="k">${App.t('Diaformaat')}</span><span>${App.esc(App.t((App.SIZES[P.size.kind] || {}).name || 'Aangepast'))} · ${App.fmtNum(P.size.w / App.CM, 2)} × ${App.fmtNum(P.size.h / App.CM, 2)} cm</span>
        <span class="k">${App.t('Bestand')}</span><span>${App.fileHandle ? App.esc(App.fileHandle.name) : App.t('Alleen op deze computer')}</span></div>
        <h3>${App.t('Presentatie beveiligen')}</h3><div class="bs-cards">${card('encryptPres', 'key', App.presPassword ? 'Wachtwoord wijzigen of verwijderen' : 'Versleutelen met wachtwoord', App.presPassword ? 'Er is een wachtwoord nodig om het .doek-bestand te openen.' : 'Een wachtwoord vereisen om het opgeslagen .doek-bestand te openen.')}</div>
        <h3>${App.t('Presentatie inspecteren')}</h3><div class="bs-cards">${card('inspect', 'policy', 'Controleren op problemen', 'Opmerkingen, notities, verborgen dia\'s en objecten buiten de dia vinden en verwijderen voordat je de presentatie deelt.')}${card('a11yCheck', 'accessibility_new', 'Toegankelijkheid controleren', 'Ontbrekende alternatieve tekst, titels, leesvolgorde en contrast controleren (vaste regels).')}</div>
        <h3>${App.t('Versiegeschiedenis')}</h3><div class="bs-cards">${card('versionHistory', 'history', 'Versiegeschiedenis', 'Doek bewaart automatisch eerdere versies terwijl je werkt. Bekijk ze of zet er een terug.')}</div>`;
    } else if (sec === 'save') {
      html = `<h1>${App.t('Opslaan')}</h1><div class="bs-cards">
        <button class="bs-card" data-act="saveNow"><span class="i">save</span><div><b>${App.t('Nu opslaan')}</b><small>${App.t('Bewaar de presentatie op deze computer')}${App.fileHandle ? ' ' + App.t('en in {0}').replace('{0}', App.esc(App.fileHandle.name)) : ''}. (Ctrl+S)</small></div></button>
        <button class="bs-card" data-exp="pptx"><span class="i">slideshow</span><div><b>${App.t('Opslaan op computer (.pptx)')}</b><small>${App.t('Sla op als .pptx-bestand. Daarna slaat Ctrl+S direct op in dat bestand.')}</small></div></button>
        <button class="bs-card" data-exp="doek"><span class="i">co_present</span><div><b>${App.t('Opslaan als Doek-bestand')}</b><small>${App.t('Verliesvrij: alles blijft precies zoals het is.')}</small></div></button></div>
        <h3>${App.t('Automatisch opslaan')}</h3><label class="chk" style="font-size:13px"><input type="checkbox" id="bs-autosave" ${App.settings.autosave ? 'checked' : ''}> ${App.t('Wijzigingen automatisch opslaan op deze computer')}</label>
        <p class="muted small" style="max-width:640px;line-height:1.5">${App.t('Presentaties worden op deze computer bewaard (afbeeldingen en video in een aparte, grotere opslag). Sla belangrijke presentaties ook op als bestand.')}</p>`;
    } else if (sec === 'export') {
      html = `<h1>${App.t('Opslaan als')}</h1><div class="bs-cards">${Object.entries(App.EXPORTS).map(([k, e]) => `<button class="bs-card" data-exp="${k}"><span class="i">${e.icon}</span><div><b>${App.esc(App.t(e.label))}</b><small>${App.esc(App.t(e.desc))}</small></div></button>`).join('')}</div>`;
    } else if (sec === 'exportfmt') {
      const rows = [['pdf', 'picture_as_pdf', 'PDF-document maken', 'Indeling en opmaak blijven behouden; anderen kunnen het bestand niet eenvoudig wijzigen.'], ['video', 'movie', 'Een video maken', 'Sla de presentatie op als video, met overgangen, animaties, timings en media.'], ['handouts', 'grid_view', 'Hand-outs maken', 'Meerdere dia\'s per pagina, met ruimte voor aantekeningen. Ook notitiepagina\'s.'], ['png', 'image', 'Dia\'s als afbeeldingen', 'Elke dia als PNG- of JPEG-bestand.'], ['pptx', 'swap_horiz', 'Bestandstype wijzigen', 'Opslaan als .pptx, .potx, .doek of overzicht.']];
      html = `<h1>${App.t('Exporteren')}</h1><div class="bs-cards">${rows.map(([k, i, t, d]) => `<button class="bs-card" data-exp="${k}"><span class="i">${i}</span><div><b>${App.esc(App.t(t))}</b><small>${App.esc(App.t(d))}</small></div></button>`).join('')}</div>`;
    } else if (sec === 'print') {
      html = App.printPage ? App.printPage() : `<h1>${App.t('Afdrukken')}</h1>`;
    } else if (sec === 'about') {
      html = `<h1>${App.t('Account')}</h1>
        <div class="props"><span class="k">${App.t('Gebruiker')}</span><span>${App.t('Geen account nodig — alles blijft op deze computer')}</span>
        <span class="k">${App.t('Thema')}</span><span>${App.t(App.settings.dark ? 'Donker' : 'Licht')}</span></div>
        <h3>${App.t('Productinformatie')}</h3>
        <div class="bs-cards"><div class="bs-card" style="cursor:default"><span class="i" style="color:var(--brand)">co_present</span><div><b>Doek ${App.VERSION}</b><small>${App.t('Presentaties, gemaakt door')} <b>${App.MAKER}</b>.<br>${App.t('Onderdeel van dezelfde reeks als Inkt (tekstverwerker) en Cel (rekenblad).')}<br>${App.t('Open source')} · © ${new Date().getFullYear()} ${App.MAKER}</small></div></div>
        <button class="bs-card" data-act="showAbout"><span class="i">info</span><div><b>${App.t('Over Doek')}</b><small>${App.t('Versie, functies en de maker.')}</small></div></button></div>`;
    } else if (sec === 'options') {
      html = App.renderOptions();
    }
    main.innerHTML = html + `<p class="bs-credit">Doek ${App.VERSION} · ${App.t('gemaakt door')} ${App.MAKER}</p>`;
    App.fillTplThumbs(main);
    main.onclick = async (e) => {
      const tpl = e.target.closest('[data-tpl]');
      if (tpl) { App.newFromTemplate(tpl.dataset.tpl); App.closeBackstage(); return; }
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        const id = del.dataset.del;
        const item = (App.store.get('index', []) || []).find((x) => x.id === id);
        if (!(await App.confirm(App.t('Presentatie verwijderen'), App.t('“{0}” definitief van deze computer verwijderen?').replace('{0}', App.esc(item ? item.title : '')), App.t('Verwijderen'), true))) return;
        App.deleteStored(id);
        if (id === App.pres.id) App.pres.dirty = true;
        App.renderBackstage(sec);
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) { if (open.dataset.open === App.pres.id) App.closeBackstage(); else App.exec('openPresId', open.dataset.open); return; }
      const exp = e.target.closest('[data-exp]');
      if (exp) { if (exp.dataset.exp === 'handouts') { App.renderBackstage('print'); return; } App.exportAs(exp.dataset.exp); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'saveNow') { App.exec('save'); App.renderBackstage(sec); }
      else if (a === 'openFile') App.exec('openFile');
      else if (a === 'wipe') {
        if (!(await App.confirm(App.t('Alles wissen'), App.t('Alle Doek-presentaties op deze computer worden verwijderd. Weet je het zeker?'), App.t('Alles wissen'), true))) return;
        (App.store.get('index', []) || []).forEach((d) => App.deleteStored(d.id));
        App.pres.dirty = true;
        App.toast(App.t('Alle presentaties zijn gewist'), 'ok');
        App.renderBackstage(sec);
      } else if (a === 'a11yCheck') { App.closeBackstage(); App.panes.open('a11y'); }
      else if (App.printAction && App.printAction(a, main)) { /* afdrukken */ }
      else { App.closeBackstage(); App.exec(a); }
    };
    main.onchange = (e) => {
      const t = e.target;
      if (t.id === 'bs-title') { $('#doc-title').value = t.value; $('#doc-title').dispatchEvent(new Event('change')); }
      if (t.id === 'bs-subject' || t.id === 'bs-keywords') App.run(() => { App.pres.props[t.id === 'bs-subject' ? 'subject' : 'keywords'] = t.value.slice(0, 500); }, { noTouch: true });
      if (t.id === 'bs-autosave') { App.settings.autosave = t.checked; App.saveSettings(); if (t.checked) App.saveLocal(true); }
      if (App.optionChange) App.optionChange(t);
      if (App.printChange) App.printChange(t, main);
    };
  };
  App.def('openPresId', async (id) => {
    const P = App.loadStored ? await App.loadStored(id) : null;
    if (!P) { App.toast(App.t('Deze presentatie is niet meer gevonden'), 'error'); return; }
    if (App.pres && App.pres.dirty) App.saveLocal(true);
    App.loadPres(P);
    App.store.set('last', id);
    App.closeBackstage();
  });
  App.closePresentation = async () => {
    if (App.pres.dirty && !App.settings.autosave) {
      const choice = await new Promise((res) => {
        let v = 'cancel';
        App.dialog({ title: 'Doek', body: `<p style="margin-top:0">${App.esc(App.t('Wil je de wijzigingen in “{0}” opslaan?').replace('{0}', App.pres.title))}</p>`, buttons: [{ label: 'Opslaan', primary: true, action: () => { v = 'save'; } }, { label: 'Niet opslaan', action: () => { v = 'discard'; } }, { label: 'Annuleren' }], onClose: () => res(v) });
      });
      if (choice === 'cancel') return;
      if (choice === 'save') App.saveLocal(false);
    } else if (App.pres.dirty) App.saveLocal(true);
    App.closeBackstage();
    App.newPresentation({});
    App.pres.dirty = false;
    App.toast(App.t('Presentatie gesloten'), 'close');
  };

  /* ---------- Opties ---------- */
  App.optCat = 'general';
  App.OPT_CATS = [['general', 'Algemeen'], ['proofing', 'Controle'], ['save', 'Opslaan'], ['advanced', 'Geavanceerd']];
  App.renderOptions = () => {
    const s = App.settings, c = App.optCat;
    const chk = (id, on, label) => `<label class="chk opt-row"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${App.esc(App.t(label))}</label>`;
    const row = (label, ctl) => `<div class="opt-line"><span>${App.esc(App.t(label))}</span>${ctl}</div>`;
    let body = '';
    if (c === 'general') {
      body = `<h3>${App.t('Opties voor gebruikersinterface')}</h3>${chk('o-minibar', s.minibar !== false, 'Mini-werkbalk weergeven bij selecteren')}
        ${row('Kleurthema', `<select id="o-theme"><option value="light" ${!s.dark ? 'selected' : ''}>${App.t('Licht')}</option><option value="dark" ${s.dark ? 'selected' : ''}>${App.t('Donker')}</option></select>`)}
        <h3>${App.t('Doek aan je persoonlijke voorkeur aanpassen')}</h3>${row('Naam bij opmerkingen (optioneel)', `<input id="o-author" value="${App.esc(s.author || '')}" placeholder="${App.esc(App.t('bijv. Sam'))}">`)}
        <p class="muted small">${App.t('Laat dit leeg als je geen naam wilt gebruiken; er wordt dan geen naam bij je opmerkingen gezet.')}</p>
        <h3>${App.t('Opstartopties')}</h3>${chk('o-start', s.startScreen !== false, 'Het startscherm weergeven bij het starten van Doek')}`;
    } else if (c === 'proofing') {
      body = `<h3>${App.t('AutoCorrectie-opties')}</h3>${chk('o-ac', s.autocorrect !== false, 'Tijdens het typen verbeteren (tikfouten, aanhalingstekens, lijsten, symbolen)')}
        <h3>${App.t('Spelling')}</h3>${chk('o-spell', s.spell !== false, 'Spelling controleren tijdens typen')}
        <p class="muted small">${App.t('De spellingcontrole gebruikt het woordenboek van het systeem voor de taal van de tekst. Er wordt niets naar internet gestuurd.')}</p>`;
    } else if (c === 'save') {
      body = `<h3>${App.t('Presentaties opslaan')}</h3>${chk('o-auto', s.autosave, 'Automatisch opslaan op deze computer')}${chk('o-versions', s.versions !== false, 'Automatisch versies bewaren (versiegeschiedenis)')}
        ${row('Elke … minuten een versie bewaren', `<input id="o-vmin" type="number" min="1" max="120" value="${s.versionMinutes || 10}" style="width:80px">`)}`;
    } else {
      body = `<h3>${App.t('Bewerken')}</h3>${chk('o-snapobj', s.snapObjs !== false, 'Objecten uitlijnen op andere objecten')}${chk('o-snapgrid', !!s.snapGrid, 'Objecten uitlijnen op raster')}${chk('o-smart', s.smartGuides !== false, 'Slimme hulplijnen weergeven')}
        <h3>${App.t('Weergave')}</h3>${chk('o-notes', s.notes !== false, 'Notitiedeelvenster weergeven')}
        <h3>${App.t('Lettertypen')}</h3><button class="btn small" data-cmd-opt="loadLocalFonts">${App.t('Lettertypen van deze computer laden…')}</button>
        <p class="muted small">${App.t('Met jouw toestemming leest Doek welke lettertypen op deze computer staan, zodat je ze kunt kiezen.')}</p>`;
    }
    return `<h1>${App.t('Opties')}</h1><div class="opt-wrap"><nav class="opt-nav">${App.OPT_CATS.map(([k, l]) => `<button data-opt="${k}" class="${k === c ? 'on' : ''}">${App.esc(App.t(l))}</button>`).join('')}</nav><div class="opt-body">${body}</div></div>
      <h3>${App.t('Gegevens')}</h3><div class="bs-cards"><button class="bs-card" data-act="wipe"><span class="i">delete_forever</span><div><b>${App.t('Alle presentaties op deze computer wissen')}</b><small>${App.t('Verwijdert alle opgeslagen Doek-presentaties van deze computer. Dit kan niet ongedaan worden gemaakt.')}</small></div></button></div>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#backstage [data-opt]');
    if (b) { App.optCat = b.dataset.opt; App.renderBackstage('options'); return; }
    const c = e.target.closest('#backstage [data-cmd-opt]');
    if (c) App.exec(c.dataset.cmdOpt);
  });
  App.optionChange = (t) => {
    const s = App.settings;
    const map = { 'o-minibar': 'minibar', 'o-start': 'startScreen', 'o-ac': 'autocorrect', 'o-spell': 'spell', 'o-auto': 'autosave', 'o-versions': 'versions', 'o-snapobj': 'snapObjs', 'o-snapgrid': 'snapGrid', 'o-smart': 'smartGuides', 'o-notes': 'notes' };
    if (map[t.id]) { s[map[t.id]] = t.checked; App.saveSettings(); App.applySettingsUi && App.applySettingsUi(); }
    if (t.id === 'o-theme' && (t.value === 'dark') !== s.dark) App.exec('toggleDark');
    if (t.id === 'o-author') { s.author = t.value.trim().slice(0, 60); App.saveSettings(); }
    if (t.id === 'o-vmin') { s.versionMinutes = App.clamp(+t.value || 10, 1, 120); App.saveSettings(); }
  };

  /* ---------- Inspecteren ---------- */
  App.def('inspect', () => {
    const P = App.pres;
    const items = [
      ['comments', 'Opmerkingen', () => P.slides.reduce((n, s) => n + (s.comments || []).length, 0), () => P.slides.forEach((s) => { delete s.comments; App.touch(s); })],
      ['notes', 'Notities van de presentator', () => P.slides.filter((s) => s.notes && App.plainText(s.notes).trim()).length, () => P.slides.forEach((s) => { delete s.notes; App.touch(s); })],
      ['hidden', 'Verborgen dia\'s', () => P.slides.filter((s) => s.hidden).length, () => { P.slides = P.slides.filter((s) => !s.hidden); if (!P.slides.length) P.slides.push(App.newSlide()); App.state.slide = 0; App.touchAll(); }],
      ['offslide', 'Objecten buiten de dia', () => P.slides.reduce((n, s) => n + s.objs.filter((o) => { const b = App.box(o, s); return b.x + b.w < 0 || b.y + b.h < 0 || b.x > P.size.w || b.y > P.size.h; }).length, 0), () => P.slides.forEach((s) => { s.objs = s.objs.filter((o) => { const b = App.box(o, s); return !(b.x + b.w < 0 || b.y + b.h < 0 || b.x > P.size.w || b.y > P.size.h); }); App.touch(s); })],
      ['invisible', 'Onzichtbare objecten', () => P.slides.reduce((n, s) => { let k = 0; App.walkObjs(s.objs, (o) => { if (o.hidden) k++; }); return n + k; }, 0), () => P.slides.forEach((s) => { const strip = (list) => list.filter((o) => !o.hidden).map((o) => (o.objs ? { ...o, objs: strip(o.objs) } : o)); s.objs = strip(s.objs); App.touch(s); })],
      ['ink', 'Inkt (pen en markeerstift)', () => P.slides.reduce((n, s) => n + s.objs.filter((o) => o.type === 'ink').length, 0), () => P.slides.forEach((s) => { s.objs = s.objs.filter((o) => o.type !== 'ink'); App.touch(s); })],
      ['props', 'Eigenschappen (onderwerp, trefwoorden)', () => (P.props.subject || P.props.keywords ? 1 : 0), () => { delete P.props.subject; delete P.props.keywords; }],
    ];
    const render = (d) => {
      d.body.innerHTML = `<div class="list-rows" style="max-height:none">${items.map(([k, label, count]) => { const n = count(); return `<div class="list-row"><span class="i" style="color:${n ? '#b06000' : 'var(--accent)'}">${n ? 'warning' : 'check_circle'}</span><div class="grow"><b>${App.esc(App.t(label))}</b><div class="small muted">${n ? App.t('Gevonden: {0}').replace('{0}', n) : App.t('Er is niets gevonden.')}</div></div>${n ? `<button class="btn small" data-fix="${k}">${App.t('Alles verwijderen')}</button>` : ''}</div>`; }).join('')}</div>`;
    };
    App.dialog({ title: App.t('Presentatie inspecteren'), wide: true, body: '', onOpen: (d) => { render(d); d.body.onclick = (e) => { const b = e.target.closest('[data-fix]'); if (!b) return; const it = items.find((x) => x[0] === b.dataset.fix); App.run(() => it[3](), { all: true }); App.gotoSlide(App.state.slide); App.thumbs.refresh(true); render(d); }; } });
  });
})();
