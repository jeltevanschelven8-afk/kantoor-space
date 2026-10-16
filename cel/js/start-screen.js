/* =========================================================
   Cel (gemaakt door JJ van Schelven) — startscherm (Bestand › Start),
   ook getoond bij het opstarten. Nieuw (sjablonen), een bestand zoeken,
   Recent, Vastgemaakt en Gedeeld met mij.
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

  const sharedRows = (q) => {
    let list = (App.sharedWithMe ? App.sharedWithMe() : []);
    if (q) list = list.filter((d) => (d.title || '').toLowerCase().includes(q));
    if (!list.length) return `<p class="ss-empty">${q ? `Geen gedeelde werkmappen gevonden voor “${App.esc(q)}”.` : 'Werkmappen die anderen via een koppeling met je delen, verschijnen hier zodra je zo’n koppeling hebt geopend.'}</p>`;
    return `<div class="ss-table"><div class="ss-head"><span></span><span>Naam</span><span>Geopend</span><span></span></div>` + list.map((d) => `<div class="ss-row" data-link="${App.esc(d.link)}" title="${App.esc(d.link)}">
        <span class="i ss-ico">people</span>
        <span class="ss-name"><b>${App.esc(d.title)}</b><small>Gedeeld door ${App.esc(d.by || 'iemand anders')} · ${d.perm === 'view' ? 'alleen bekijken' : 'bewerken'}</small></span>
        <span class="ss-date">${relDate(d.opened)}</span>
        <span class="ss-act"><button class="qb ss-pin on" data-forget="${d.id}" title="Uit deze lijst verwijderen"><span class="i">close</span></button></span>
      </div>`).join('') + '</div>';
  };
  const fileRows = () => {
    const st = App.startState;
    const q = st.query.trim().toLowerCase();
    if (st.tab === 'shared') return sharedRows(q);
    const pins = App.pinned();
    let list = App.store.get('index', []) || [];
    if (st.tab === 'pinned') list = pins.map((id) => list.find((d) => d.id === id)).filter(Boolean);
    if (q) list = list.filter((d) => (d.title || '').toLowerCase().includes(q));
    if (!list.length) {
      const msg = q ? `Geen werkmappen gevonden voor “${App.esc(st.query)}”.`
        : st.tab === 'pinned' ? 'Maak werkmappen vast die je snel wilt terugvinden. Ze verschijnen dan hier. Wijs een werkmap aan en klik op het punaise-icoon.'
          : 'Je hebt de laatste tijd geen werkmappen geopend. Klik op Openen om naar een werkmap te bladeren.';
      return `<p class="ss-empty">${msg}</p>`;
    }
    return `<div class="ss-table"><div class="ss-head"><span></span><span>Naam</span><span>Gewijzigd</span><span></span></div>` + list.slice(0, 50).map((d) => {
      const pinned = pins.includes(d.id);
      return `<div class="ss-row" data-open="${d.id}" title="${App.esc(d.title)}">
        <span class="i ss-ico">table_view</span>
        <span class="ss-name"><b>${App.esc(d.title)}${d.id === App.book.id ? ' <span class="ss-badge">geopend</span>' : ''}</b><small>Cel › Werkmappen${d.sheets ? ' · ' + d.sheets + (d.sheets === 1 ? ' blad' : ' bladen') : ''}</small></span>
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
        <button class="ss-tab ${st.tab === 'shared' ? 'on' : ''}" data-sstab="shared">Gedeeld met mij</button>
      </div>
      <div class="ss-files">${fileRows()}</div>
      <div class="ss-more"><button class="ss-link" data-ss="moreFiles">Meer werkmappen <span class="i">arrow_forward</span></button></div>
    </div>`;
    if (main.dataset.ssBound) return;
    main.dataset.ssBound = '1';
    // Eigen afhandeling vóór de algemene klik-afhandeling van het Bestand-scherm
    main.addEventListener('click', (e) => {
      if (App.bsSection !== 'home') return;
      const pin = e.target.closest('[data-pin]');
      if (pin) { e.stopPropagation(); App.togglePin(pin.dataset.pin); main.querySelector('.ss-files').innerHTML = fileRows(); return; }
      const forget = e.target.closest('[data-forget]');
      if (forget) { e.stopPropagation(); App.forgetShared(forget.dataset.forget); main.querySelector('.ss-files').innerHTML = fileRows(); return; }
      const link = e.target.closest('[data-link]');
      if (link) { e.stopPropagation(); if (/^https?:/i.test(link.dataset.link)) location.href = link.dataset.link; return; }
      const tab = e.target.closest('[data-sstab]');
      if (tab) { st.tab = tab.dataset.sstab; App.renderStartScreen(main); return; }
      const a = e.target.closest('[data-ss]');
      if (!a) return;
      e.stopPropagation();
      if (a.dataset.ss === 'toggleNew') { st.newOpen = !st.newOpen; App.renderStartScreen(main); }
      if (a.dataset.ss === 'moreTemplates') App.renderBackstage('new');
      if (a.dataset.ss === 'moreFiles') App.renderBackstage('open');
    }, true);
    main.addEventListener('input', (e) => {
      if (e.target.id !== 'ss-q') return;
      st.query = e.target.value;
      main.querySelector('.ss-files').innerHTML = fileRows();
    });
  };

  // Bestand › Start vervangen door het nieuwe startscherm; Opties krijgt een schakelaar voor het startscherm
  const prev = App.renderBackstage;
  App.renderBackstage = (sec) => {
    App.bsSection = sec;
    prev(sec);
    const main = $('#backstage .bs-main');
    if (sec === 'home') App.renderStartScreen(main);
    if (sec === 'options') {
      const props = main.querySelector('.props');
      if (props && !main.querySelector('#op-start')) {
        props.insertAdjacentHTML('beforeend', `<span class="k">Opstarten</span><label class="chk"><input type="checkbox" id="op-start" ${App.settings.startScreen !== false ? 'checked' : ''}> Het startscherm weergeven bij het starten van Cel</label>`);
        main.querySelector('#op-start').addEventListener('change', (e) => { App.settings.startScreen = e.target.checked; App.saveSettings(); });
      }
    }
  };
})();
