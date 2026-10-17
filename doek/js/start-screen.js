/* =========================================================
   Doek (gemaakt door JJ van Schelven) — startscherm (Bestand › Start), ook getoond
   bij het opstarten, zoals in Inkt en Cel: Nieuw (sjablonen), een bestand zoeken,
   Recent, Vastgemaakt en Gedeeld.
   ========================================================= */
'use strict';

(() => {
  App.pinned = () => App.store.get('pinned', []) || [];
  App.togglePin = (id) => {
    const p = App.pinned();
    App.store.set('pinned', p.includes(id) ? p.filter((x) => x !== id) : [id, ...p]);
  };
  App.startState = { tab: 'recent', query: '', newOpen: true };

  const loc = () => (App.LANG === 'en' ? 'en-US' : 'nl-NL');
  const relDate = (t) => {
    const d = new Date(t), now = new Date();
    const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    const time = d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
    if (days === 0) return App.t('Vandaag') + ' ' + time;
    if (days === 1) return App.t('Gisteren') + ' ' + time;
    if (days < 7) return d.toLocaleDateString(loc(), { weekday: 'long' }) + ' ' + time;
    return d.toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const ico = (d) => (d && d.thumb && /^data:image\/(jpeg|png|webp);base64,/.test(d.thumb) ? `<img class="ss-thumb" src="${d.thumb}" alt="">` : '<span class="i ss-ico">co_present</span>');

  // tabblad Gedeeld: bestanden uit de gedeelde map en koppelingen die met jou zijn gedeeld
  const sharedRows = async () => {
    const st = App.startState;
    const q = st.query.trim().toLowerCase();
    const rows = [];
    let note = '';
    try {
      const files = App.sharedList ? await App.sharedList() : null;
      if (files) files.forEach((f) => rows.push({ kind: 'file', title: f.name.replace(/\.(doek|pptx)$/i, ''), sub: App.t('Gedeelde map') + (/\.pptx$/i.test(f.name) ? ' · .pptx' : ''), when: f.modified, path: f.path }));
      else if (App.native && App.native.ok) note = `<p class="ss-empty">${App.t('Nog geen gedeelde map ingesteld.')} <button class="ss-link" data-ss="setupShared">${App.t('Gedeelde map instellen')}</button></p>`;
    } catch (e) { note = `<p class="ss-empty">${App.t('De gedeelde map is nu niet bereikbaar ({0}).').replace('{0}', App.esc(e.message))}</p>`; }
    try {
      (App.sharedWithMe ? App.sharedWithMe() : []).forEach((s) => rows.push({ kind: 'link', title: s.title, sub: App.t('Koppeling') + (s.by ? ' · ' + s.by : '') + (s.perm === 'view' ? ' · ' + App.t('alleen bekijken') : ''), when: s.opened, link: s.link }));
    } catch { /* geen koppelingen */ }
    const list = rows.filter((r) => !q || (r.title || '').toLowerCase().includes(q)).sort((a, b) => (b.when || 0) - (a.when || 0));
    if (!list.length) return note + `<p class="ss-empty">${q ? App.t('Geen gedeelde presentaties gevonden voor “{0}”.').replace('{0}', App.esc(st.query)) : App.t('Hier verschijnen presentaties uit je gedeelde map en koppelingen die anderen met je hebben gedeeld.')}</p>`;
    return note + `<div class="ss-table"><div class="ss-head"><span></span><span>${App.t('Naam')}</span><span>${App.t('Gewijzigd')}</span><span></span></div>` + list.slice(0, 80).map((r) => `
      <div class="ss-row" ${r.kind === 'file' ? `data-sharedopen="${App.esc(r.path)}"` : `data-sharedlink="${App.esc(r.link)}"`} title="${App.esc(r.title)}">
        <span class="i ss-ico">${r.kind === 'file' ? 'folder_shared' : 'link'}</span>
        <span class="ss-name"><b>${App.esc(r.title)}</b><small>${App.esc(r.sub)}</small></span>
        <span class="ss-date">${r.when ? relDate(r.when) : ''}</span><span class="ss-act"></span>
      </div>`).join('') + '</div>';
  };
  const fillShared = async (main) => {
    const box = main.querySelector('.ss-files');
    if (!box) return;
    const html = await sharedRows();
    if (App.startState.tab === 'shared' && box.isConnected) box.innerHTML = html;
  };

  const fileRows = () => {
    const st = App.startState;
    if (st.tab === 'shared') return `<p class="ss-empty">${App.t('Gedeelde presentaties laden…')}</p>`;
    const pins = App.pinned();
    let list = App.store.get('index', []) || [];
    if (st.tab === 'pinned') list = pins.map((id) => list.find((d) => d.id === id)).filter(Boolean);
    const q = st.query.trim().toLowerCase();
    if (q) list = list.filter((d) => (d.title || '').toLowerCase().includes(q));
    if (!list.length) {
      const msg = q ? App.t('Geen presentaties gevonden voor “{0}”.').replace('{0}', App.esc(st.query))
        : st.tab === 'pinned' ? App.t('Maak presentaties vast die je snel wilt terugvinden. Ze verschijnen dan hier. Wijs een presentatie aan en klik op het punaise-icoon.')
          : App.t('Je hebt de laatste tijd geen presentaties geopend. Klik op Openen om naar een presentatie te bladeren.');
      return `<p class="ss-empty">${msg}</p>`;
    }
    return `<div class="ss-table"><div class="ss-head"><span></span><span>${App.t('Naam')}</span><span>${App.t('Gewijzigd')}</span><span></span></div>` + list.slice(0, 50).map((d) => {
      const pinned = pins.includes(d.id);
      return `<div class="ss-row" data-open="${App.esc(d.id)}" title="${App.esc(d.title)}">
        ${ico(d)}
        <span class="ss-name"><b>${App.esc(d.title)}${App.pres && d.id === App.pres.id ? ` <span class="ss-badge">${App.t('geopend')}</span>` : ''}</b><small>${App.t('Doek › Presentaties')}${d.slides ? ' · ' + App.t(d.slides === 1 ? '{0} dia' : '{0} dia\'s').replace('{0}', d.slides) : ''}</small></span>
        <span class="ss-date">${relDate(d.modified)}</span>
        <span class="ss-act"><button class="qb ss-pin ${pinned ? 'on' : ''}" data-pin="${App.esc(d.id)}" title="${App.esc(App.t(pinned ? 'Losmaken uit de lijst' : 'Aan de lijst vastmaken'))}"><span class="i">keep</span></button></span>
      </div>`;
    }).join('') + '</div>';
  };

  App.renderStartScreen = (main) => {
    const st = App.startState;
    const h = new Date().getHours();
    const greet = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
    const cards = App.TEMPLATE_CARDS ? App.TEMPLATE_CARDS() : [];
    main.innerHTML = `<div class="ss">
      <h1 class="ss-greet">${App.t(greet)}</h1>
      <button class="ss-toggle" data-ss="toggleNew" aria-expanded="${st.newOpen}"><span class="i">${st.newOpen ? 'expand_more' : 'chevron_right'}</span> ${App.t('Nieuw')}</button>
      <div class="ss-new" ${st.newOpen ? '' : 'hidden'}>
        <div class="ss-tpls">${cards.slice(0, 6).map((t) => App.tplCard(t)).join('')}</div>
        <div class="ss-more"><button class="ss-link" data-ss="moreTemplates">${App.t('Meer thema\'s en sjablonen')} <span class="i">arrow_forward</span></button></div>
      </div>
      <div class="ss-search"><span class="i">search</span><input id="ss-q" placeholder="${App.esc(App.t('Een bestand zoeken'))}" value="${App.esc(st.query)}" autocomplete="off" spellcheck="false"></div>
      <div class="ss-tabs">
        <button class="ss-tab ${st.tab === 'recent' ? 'on' : ''}" data-sstab="recent">${App.t('Recent')}</button>
        <button class="ss-tab ${st.tab === 'pinned' ? 'on' : ''}" data-sstab="pinned">${App.t('Vastgemaakt')}</button>
        <button class="ss-tab ${st.tab === 'shared' ? 'on' : ''}" data-sstab="shared">${App.t('Gedeeld')}</button>
      </div>
      <div class="ss-files">${fileRows()}</div>
      <div class="ss-more"><button class="ss-link" data-ss="moreFiles">${App.t('Meer presentaties')} <span class="i">arrow_forward</span></button></div>
    </div>`;
    App.fillTplThumbs && App.fillTplThumbs(main);
    if (st.tab === 'shared') fillShared(main);
    if (main.dataset.ssBound) return;
    main.dataset.ssBound = '1';
    // eigen afhandeling vóór de algemene klik-afhandeling van het Bestand-scherm
    main.addEventListener('click', (e) => {
      if (App.bsSection !== 'home') return;
      const pin = e.target.closest('[data-pin]');
      if (pin) { e.stopPropagation(); App.togglePin(pin.dataset.pin); main.querySelector('.ss-files').innerHTML = fileRows(); return; }
      const so = e.target.closest('[data-sharedopen]');
      if (so) { e.stopPropagation(); App.exec('sharedFolderOpen', so.dataset.sharedopen); return; }
      const sl = e.target.closest('[data-sharedlink]');
      if (sl) { e.stopPropagation(); if (/^https?:\/\//.test(sl.dataset.sharedlink)) location.href = sl.dataset.sharedlink; return; }
      const tab = e.target.closest('[data-sstab]');
      if (tab) { st.tab = tab.dataset.sstab; App.renderStartScreen(main); return; }
      const a = e.target.closest('[data-ss]');
      if (!a) return;
      e.stopPropagation();
      if (a.dataset.ss === 'toggleNew') { st.newOpen = !st.newOpen; App.renderStartScreen(main); }
      if (a.dataset.ss === 'moreTemplates') App.renderBackstage('new');
      if (a.dataset.ss === 'moreFiles') App.renderBackstage('open');
      if (a.dataset.ss === 'setupShared') App.exec('sharedFolderSetup');
    }, true);
    main.addEventListener('input', (e) => {
      if (e.target.id !== 'ss-q') return;
      st.query = e.target.value;
      main.querySelector('.ss-files').innerHTML = fileRows();
      if (st.tab === 'shared') fillShared(main);
    });
  };

  // Bestand › Start vervangen door het startscherm
  const prev = App.renderBackstage;
  App.renderBackstage = (sec) => {
    prev(sec);
    if (sec === 'home') App.renderStartScreen($('#backstage .bs-main'));
  };

  const css = document.createElement('style');
  css.id = 'pd-start-css';
  css.textContent = `.ss-thumb{width:64px;height:36px;object-fit:cover;border:1px solid var(--line);border-radius:2px;background:#fff}
.ss-row .ss-thumb + .ss-name{margin-left:2px}`;
  document.head.appendChild(css);
})();
