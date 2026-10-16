/* =========================================================
   Inkt (gemaakt door JJ van Schelven) — lint die meeschaalt.
   Past een lintgroep niet meer in het venster, dan klapt hij (van rechts naar links) in tot één knop
   met de groepsnaam; klikken opent de hele groep als menu. Wordt het venster breder, dan klapt hij weer uit.
   ========================================================= */
'use strict';

(() => {
  const ribbon = $('#ribbon'); if (!ribbon) return;
  const nameOf = (grp) => { const l = grp.querySelector(':scope > .grp-label'); return l ? ((l.childNodes[0] && l.childNodes[0].textContent) || l.textContent).trim() : ''; };
  const iconOf = (grp) => { const i = grp.querySelector('.grp-body .rb .i'); return i ? i.textContent : 'more_horiz'; };

  const collapse = (grp) => {
    if (grp.classList.contains('collapsed')) return;
    grp._w = grp.offsetWidth;   // breedte in uitgeklapte staat, om later te weten of hij weer past
    const b = document.createElement('button');
    b.className = 'rb lg grp-btn'; b.type = 'button'; b.title = nameOf(grp);
    b.innerHTML = `<span class="i">${iconOf(grp)}</span><span>${App.esc(nameOf(grp))}</span><span class="i caret">arrow_drop_down</span>`;
    b.onclick = (e) => { e.stopPropagation(); if (App.popup && App.popup._grp === grp) { App.closePopup(); return; } open(grp, b); };
    grp.prepend(b); grp.classList.add('collapsed');
  };
  const expand = (grp) => {
    if (!grp.classList.contains('collapsed')) return;
    if (App.popup && App.popup._grp === grp) App.closePopup();
    grp.classList.remove('collapsed');
    const b = grp.querySelector(':scope > .grp-btn'); if (b) b.remove();
  };
  // De echte knoppen verhuizen naar het menu en komen bij het sluiten weer terug (zo blijven alle commando's werken)
  const open = (grp, anchor) => {
    const body = grp.querySelector(':scope > .grp-body'); if (!body) return;
    const wrap = document.createElement('div'); wrap.className = 'grp-pop'; wrap.appendChild(body);
    const m = App.openPopup(anchor, wrap, 'grp-menu');
    m._grp = grp; m._body = body;
  };
  const origClose = App.closePopup;
  App.closePopup = () => {
    const p = App.popup;
    if (p && p._grp && p._body && p._grp.isConnected) p._grp.insertBefore(p._body, p._grp.querySelector(':scope > .grp-label'));
    origClose();
  };

  const fit = () => {
    const panel = ribbon.querySelector('.panel.active');
    if (!panel || !panel.clientWidth) return;
    const grps = $$(':scope > .grp', panel);
    // echt gebruikte breedte (scrollWidth wordt nooit kleiner dan het zichtbare deel)
    const used = () => {
      const kids = $$(':scope > *', panel).filter((k) => k.offsetParent !== null); if (!kids.length) return 0;
      return kids[kids.length - 1].getBoundingClientRect().right - panel.getBoundingClientRect().left + (parseFloat(getComputedStyle(panel).paddingRight) || 0);
    };
    for (let guard = 0; guard < 40; guard++) {
      const over = used() - panel.clientWidth;
      if (over > 0) {
        const open = grps.filter((g) => !g.classList.contains('collapsed'));
        if (open.length <= 1) break;   // de eerste groep blijft altijd zichtbaar
        collapse(open[open.length - 1]);
        continue;
      }
      // past er weer iets bij? de laatst ingeklapte (= meest linkse ingeklapte) eerst: uitklappen, meten, anders terug
      const col = grps.filter((g) => g.classList.contains('collapsed'));
      if (!col.length) break;
      const g = col[0];
      if ((g._w || 0) - g.offsetWidth > -over - 2) break;   // zeker te breed
      expand(g);
      if (used() - panel.clientWidth > 0) { collapse(g); break; }
    }
  };
  App.fitRibbon = fit;
  window.addEventListener('resize', App.debounce(fit, 80));
  new MutationObserver((ms) => { if (ms.some((m) => m.target.classList && (m.target.classList.contains('panel') || m.target === document.body))) fit(); })
    .observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
  // pas meten als het pictogramlettertype er is (anders staan de pictogramnamen als lange tekst in de knoppen)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { grps().forEach((g) => { delete g._w; }); fit(); });
  else setTimeout(fit, 1500);
  function grps() { return $$('#ribbon .grp'); }
})();
