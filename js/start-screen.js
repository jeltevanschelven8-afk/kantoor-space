/* =========================================================
   Inkt — startscherm (Bestand › Start), ook getoond bij het opstarten.
   Nieuw (sjablonen), een bestand zoeken, Recent en Vastgemaakt.
   ========================================================= */
'use strict';

(() => {
  App.pinned = () => App.store.get('pinned', []) || [];
  App.togglePin = (id) => {
    const p = App.pinned();
    App.store.set('pinned', p.includes(id) ? p.filter((x) => x !== id) : [id, ...p]);
  };
  App.startState = { tab: 'recent', query: '', newOpen: true };

  const relDate = (t) => {
    const d = new Date(t), now = new Date();
    const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    if (days === 0) return 'Vandaag ' + time;
    if (days === 1) return 'Gisteren ' + time;
    if (days < 7) return d.toLocaleDateString('nl-NL', { weekday: 'long' }) + ' ' + time;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Tabblad Gedeeld: bestanden uit de gedeelde map en koppelingen die met jou zijn gedeeld
  const sharedRows = async () => {
    const st = App.startState;
    const q = st.query.trim().toLowerCase();
    const rows = [];
    let note = '';
    try {
      const files = App.sharedList ? await App.sharedList() : null;
      if (files) files.forEach((f) => rows.push({ kind: 'file', title: f.name.replace(/\.(inkt|docx)$/i, ''), sub: 'Gedeelde map' + (/\.docx$/i.test(f.name) ? ' · .docx' : ''), when: f.modified, path: f.path }));
      else if (App.native && App.native.ok) note = '<p class="ss-empty">Nog geen gedeelde map ingesteld. <button class="ss-link" data-ss="setupShared">Gedeelde map instellen</button></p>';
    } catch (e) { note = `<p class="ss-empty">De gedeelde map is nu niet bereikbaar (${App.esc(e.message)}).</p>`; }
    try {
      (App.sharedWithMe ? App.sharedWithMe() : []).forEach((s) => rows.push({ kind: 'link', title: s.title, sub: 'Koppeling' + (s.by ? ' van ' + s.by : '') + (s.perm === 'view' ? ' · alleen bekijken' : ''), when: s.opened, link: s.link }));
    } catch { /* geen koppelingen */ }
    const list = rows.filter((r) => !q || (r.title || '').toLowerCase().includes(q)).sort((a, b) => (b.when || 0) - (a.when || 0));
    if (!list.length) return note + `<p class="ss-empty">${q ? `Geen gedeelde documenten gevonden voor “${App.esc(st.query)}”.` : 'Hier verschijnen documenten uit je gedeelde map en koppelingen die anderen met je hebben gedeeld.'}</p>`;
    return note + `<div class="ss-table"><div class="ss-head"><span></span><span>Naam</span><span>Gewijzigd</span><span></span></div>` + list.slice(0, 80).map((r) => `
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
    if (st.tab === 'shared') return '<p class="ss-empty">Gedeelde documenten laden…</p>';
    const pins = App.pinned();
    let list = App.store.get('index', []) || [];
    if (st.tab === 'pinned') list = pins.map((id) => list.find((d) => d.id === id)).filter(Boolean);
    const q = st.query.trim().toLowerCase();
    if (q) list = list.filter((d) => (d.title || '').toLowerCase().includes(q));
    if (!list.length) {
      const msg = q ? `Geen documenten gevonden voor “${App.esc(st.query)}”.`
        : st.tab === 'pinned' ? 'Maak documenten vast die je snel wilt terugvinden. Ze verschijnen dan hier. Wijs een document aan en klik op het punaise-icoon.'
          : 'Je hebt de laatste tijd geen documenten geopend. Klik op Openen om naar een document te bladeren.';
      return `<p class="ss-empty">${msg}</p>`;
    }
    return `<div class="ss-table"><div class="ss-head"><span></span><span>Naam</span><span>Gewijzigd</span><span></span></div>` + list.slice(0, 50).map((d) => {
      const pinned = pins.includes(d.id);
      return `<div class="ss-row" data-open="${d.id}" title="${App.esc(d.title)}">
        <span class="i ss-ico">description</span>
        <span class="ss-name"><b>${App.esc(d.title)}${d.id === App.doc.id ? ' <span class="ss-badge">geopend</span>' : ''}</b><small>Inkt › Documenten${d.words != null ? ' · ' + d.words + ' woorden' : ''}</small></span>
        <span class="ss-date">${relDate(d.modified)}</span>
        <span class="ss-act"><button class="qb ss-pin ${pinned ? 'on' : ''}" data-pin="${d.id}" title="${pinned ? 'Losmaken uit de lijst' : 'Aan de lijst vastmaken'}"><span class="i">keep</span></button></span>
      </div>`;
    }).join('') + '</div>';
  };

  App.renderStartScreen = (main) => {
    const st = App.startState;
    const h = new Date().getHours();
    const greet = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
    main.innerHTML = `<div class="ss">
      <h1 class="ss-greet">${greet}</h1>
      <button class="ss-toggle" data-ss="toggleNew" aria-expanded="${st.newOpen}"><span class="i">${st.newOpen ? 'expand_more' : 'chevron_right'}</span> Nieuw</button>
      <div class="ss-new" ${st.newOpen ? '' : 'hidden'}>
        <div class="ss-tpls">${App.TEMPLATES.slice(0, 6).map(App.tplCard).join('')}</div>
        <div class="ss-more"><button class="ss-link" data-ss="moreTemplates">Meer sjablonen <span class="i">arrow_forward</span></button></div>
      </div>
      <div class="ss-search"><span class="i">search</span><input id="ss-q" placeholder="Een bestand zoeken" value="${App.esc(st.query)}" autocomplete="off" spellcheck="false"></div>
      <div class="ss-tabs">
        <button class="ss-tab ${st.tab === 'recent' ? 'on' : ''}" data-sstab="recent">Recent</button>
        <button class="ss-tab ${st.tab === 'pinned' ? 'on' : ''}" data-sstab="pinned">Vastgemaakt</button>
        <button class="ss-tab ${st.tab === 'shared' ? 'on' : ''}" data-sstab="shared">Gedeeld</button>
      </div>
      <div class="ss-files">${fileRows()}</div>
      <div class="ss-more"><button class="ss-link" data-ss="moreFiles">Meer documenten <span class="i">arrow_forward</span></button></div>
    </div>`;
    if (st.tab === 'shared') fillShared(main);
    if (main.dataset.ssBound) return;
    main.dataset.ssBound = '1';
    // Eigen afhandeling vóór de algemene klik-afhandeling van het Bestand-scherm
    main.addEventListener('click', (e) => {
      if (App.bsSection !== 'home') return;
      const pin = e.target.closest('[data-pin]');
      if (pin) { e.stopPropagation(); App.togglePin(pin.dataset.pin); main.querySelector('.ss-files').innerHTML = fileRows(); return; }
      const so = e.target.closest('[data-sharedopen]');
      if (so) { e.stopPropagation(); App.exec('sharedFolderOpen', so.dataset.sharedopen); return; }
      const sl = e.target.closest('[data-sharedlink]');
      if (sl) { e.stopPropagation(); location.href = sl.dataset.sharedlink; return; }
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

  // Bestand › Start vervangen door het nieuwe startscherm
  const prev = App.renderBackstage;
  App.renderBackstage = (sec) => {
    prev(sec);
    if (sec === 'home') App.renderStartScreen($('#backstage .bs-main'));
  };
})();
