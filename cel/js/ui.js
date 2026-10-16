/* =========================================================
   Cel (gemaakt door JJ van Schelven) — interface: lint, menu's, dialogen, meldingen
   ========================================================= */
'use strict';

/* ---------- Meldingen ---------- */
App.toast = (msg, icon = 'info', opts = {}) => {
  const icons = { info: 'info', error: 'error', ok: 'check_circle', lock: 'lock', undo: 'undo', save: 'save' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="i">${icons[icon] || icon}</span><span>${App.esc(msg)}</span>`;
  if (opts.action) {
    const b = document.createElement('button');
    b.textContent = opts.action;
    b.onclick = () => { opts.onAction && opts.onAction(); t.remove(); };
    t.appendChild(b);
  }
  $('#toast-layer').appendChild(t);
  setTimeout(() => t.remove(), opts.ms || 2600);
};

/* ---------- Dialogen ---------- */
App.dialog = (o) => {
  const layer = $('#dialog-layer');
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  const dlg = document.createElement('div');
  dlg.className = 'dialog' + (o.wide ? ' wide' : '') + (o.xwide ? ' xwide' : '');
  dlg.setAttribute('role', 'dialog');
  dlg.innerHTML = `
    <div class="dlg-head"><h2>${App.esc(o.title || '')}</h2><button class="qb" data-x title="Sluiten"><span class="i">close</span></button></div>
    <div class="dlg-body"></div>
    <div class="dlg-foot"></div>`;
  const body = dlg.querySelector('.dlg-body');
  if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
  const foot = dlg.querySelector('.dlg-foot');
  const api = {
    el: dlg, body,
    $: (s) => dlg.querySelector(s),
    $$: (s) => Array.from(dlg.querySelectorAll(s)),
    close(result) {
      if (api.closed) return;
      api.closed = true;
      bd.remove();
      document.removeEventListener('keydown', onKey, true);
      o.onClose && o.onClose(result);
      if (!$('#backstage') && !$('.backdrop')) App.focusGrid && App.focusGrid();
    },
  };
  const buttons = o.buttons || [{ label: 'Sluiten', primary: true }];
  if (!buttons.length) foot.remove();
  buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '') + (b.left ? ' left' : '');
    btn.textContent = b.label;
    btn.onclick = () => {
      const keep = b.action ? b.action(api) : undefined;
      if (keep !== false) api.close(b.value ?? b.label);
    };
    foot.appendChild(btn);
    if (b.primary) api.primary = btn;
  });
  const onKey = (e) => {
    if (!bd.isConnected) return;
    if (layer.lastElementChild !== bd) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); api.close(null); }
    else if (e.key === 'Enter' && api.primary && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !o.noEnter) {
      e.preventDefault(); e.stopPropagation(); api.primary.click();
    }
  };
  document.addEventListener('keydown', onKey, true);
  dlg.querySelector('[data-x]').onclick = () => api.close(null);
  bd.addEventListener('mousedown', (e) => { if (e.target === bd && !o.modal) api.close(null); });
  bd.appendChild(dlg);
  layer.appendChild(bd);
  o.onOpen && o.onOpen(api);
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('.dlg-body input:not([type=checkbox]):not([type=radio]):not([type=color]), .dlg-body textarea, .dlg-body select');
  if (first) setTimeout(() => { first.focus(); first.select && first.select(); }, 30);
  return api;
};
App.prompt = (title, label, value = '', opts = {}) => new Promise((res) => {
  let val = null;
  App.dialog({
    title,
    body: `<label class="field"><span>${App.esc(label)}</span><input id="pr-in" value="${App.esc(value)}" placeholder="${App.esc(opts.placeholder || '')}"></label>${opts.hint ? `<p class="muted small">${opts.hint}</p>` : ''}`,
    buttons: [{ label: 'Annuleren' }, { label: opts.ok || 'OK', primary: true, action: (d) => { val = d.$('#pr-in').value; } }],
    onClose: () => res(val),
  });
});
App.confirm = (title, msg, ok = 'OK', danger = false) => new Promise((res) => {
  let v = false;
  App.dialog({
    title, body: `<p style="line-height:1.5;margin:4px 0 8px">${msg}</p>`,
    buttons: [{ label: 'Annuleren' }, { label: ok, primary: !danger, danger, action: () => { v = true; } }],
    onClose: () => res(v),
  });
});

/* ---------- Pop-ups en menu's ---------- */
App.menuBuilders = {};
App.popup = null;
App.closePopup = () => {
  if (App.popup) { App.popup.remove(); App.popup = null; }
  $$('.rb.open, .qb.open').forEach((b) => b.classList.remove('open'));
};
App.openPopup = (anchor, content, cls = '') => {
  App.closePopup();
  const m = document.createElement('div');
  m.className = 'menu ' + cls;
  if (typeof content === 'string') m.innerHTML = content; else m.appendChild(content);
  $('#popup-layer').appendChild(m);
  App.popup = m;
  App.positionPopup(m, anchor);
  if (anchor && anchor.classList) anchor.classList.add('open');
  return m;
};
App.positionPopup = (m, anchor) => {
  let x, y;
  if (anchor && anchor.getBoundingClientRect) {
    const r = anchor.getBoundingClientRect();
    const host = anchor.closest('.split') || anchor;
    const hr = host.getBoundingClientRect();
    x = hr.left; y = r.bottom + 4;
  } else { x = anchor.x; y = anchor.y; }
  m.style.left = x + 'px'; m.style.top = y + 'px';
  const mr = m.getBoundingClientRect();
  if (mr.right > innerWidth - 8) m.style.left = Math.max(8, innerWidth - mr.width - 8) + 'px';
  if (mr.bottom > innerHeight - 8) {
    const up = (anchor && anchor.getBoundingClientRect) ? anchor.getBoundingClientRect().top - mr.height - 4 : y - mr.height;
    m.style.top = Math.max(8, up) + 'px';
  }
};
App.openMenu = (name, anchor) => {
  if (name.startsWith('color:')) return App.colorMenu(anchor, name.slice(6));
  if (name.startsWith('fn:')) return App.fnMenu(anchor, name.slice(3));
  const src = document.getElementById(name);
  const html = App.menuBuilders[name] ? App.menuBuilders[name]() : (src ? src.innerHTML : '');
  const cls = src ? src.className : '';
  const m = App.openPopup(anchor, html, cls);
  App.emit('selection');
  return m;
};

/* Kleurkiezer */
App.PALETTE_BASE = ['#ffffff', '#000000', '#e8e8e8', '#0e2841', '#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'];
App.PALETTE_STD = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
App.mix = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (t > 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; } else { r *= 1 + t; g *= 1 + t; b *= 1 + t; }
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
};
App.colorMenu = (anchor, cmd, onPick) => {
  const noneLabel = { fontColor: 'Automatisch', fillColor: 'Geen opvulling', tabColor: 'Geen kleur' }[cmd] || 'Geen';
  const btn = (c) => `<button data-color="${c}" title="${c}" style="background:${c}"></button>`;
  let html = `<div class="color-menu">`;
  html += `<button class="mi" data-color=""><span class="i">format_color_reset</span> ${noneLabel}</button>`;
  html += `<div class="cm-label">Themakleuren</div><div class="cm-grid">`;
  html += App.PALETTE_BASE.map(btn).join('');
  [0.8, 0.6, 0.4, -0.25, -0.5].forEach((t) => {
    html += App.PALETTE_BASE.map((c, i) => btn(i === 0 ? App.mix('#ffffff', -Math.abs(t) * 0.5) : i === 1 ? App.mix('#000000', Math.abs(t)) : App.mix(c, t))).join('');
  });
  html += `</div><div class="cm-label">Standaardkleuren</div><div class="cm-grid">${App.PALETTE_STD.map(btn).join('')}</div>`;
  html += `<label class="mi"><span class="i">colorize</span> Meer kleuren… <input type="color" data-more style="margin-left:auto;width:28px;height:22px;border:0;padding:0;background:none"></label></div>`;
  const m = App.openPopup(anchor, html);
  const pick = (c) => {
    App.closePopup();
    if (onPick) { onPick(c); return; }
    App.state.lastColors[cmd] = c;
    App.updateSwatches();
    App.exec(cmd, c);
  };
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (b) { e.stopPropagation(); pick(b.dataset.color); }
  });
  m.querySelector('[data-more]').addEventListener('change', (e) => pick(e.target.value));
};
App.updateSwatches = () => {
  const lc = App.state.lastColors;
  const set = (id, c) => { const el = document.getElementById(id); if (el) el.style.background = c || 'transparent'; };
  set('sw-fore', lc.fontColor); set('sw-fill', lc.fillColor);
};

/* ---------- Tabbladen ---------- */
App.activeTab = 'home';
App.showTab = (name) => {
  if (document.body.classList.contains('ribbon-collapsed')) document.body.classList.add('ribbon-peek');
  App.activeTab = name;
  $$('#tabs .tab[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('#ribbon .panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  App.scheduleState();
};
App.context = { chart: false, picture: false };
App.setContext = (ctx) => {
  ['chart', 'picture'].forEach((k) => {
    const on = !!ctx[k];
    const tab = $(`#tabs .tab[data-tab="${k}"]`);
    if (on !== App.context[k]) {
      tab.hidden = !on;
      if (on) App.showTab(k);
      if (!on && App.activeTab === k) App.showTab(App._tabBeforeCtx || 'home');
    }
    App.context[k] = on;
  });
};

/* ---------- Toestand van knoppen bijwerken ---------- */
App.stateFns = {};
App.updateState = () => {
  $$('[data-state]').forEach((el) => {
    const k = el.dataset.state;
    const on = App.stateFns[k] ? App.stateFns[k]() : false;
    el.classList.toggle('on', !!on);
  });
  App.emit('selection');
};

/* ---------- Klikken in lint, menu's, statusbalk ---------- */
document.addEventListener('mousedown', (e) => {
  const b = e.target.closest('button, .menu .mi, .menu label');
  if (b && b.closest('#ribbon, .menu, .qat, #statusbar, #tabs, #find-panel .qb, .ctx-menu, #sheetbar, .fb-btns')) {
    if (!e.target.closest('input, select')) e.preventDefault();
  }
  if (App.popup && !e.target.closest('.menu') && !e.target.closest('[data-menu]')) App.closePopup();
}, true);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-cmd], [data-menu], [data-tab]');
  if (!el || el.matches('input, select, label') || el.closest('#dialog-layer')) return;
  if (el.dataset.tab) { App.showTab(el.dataset.tab); App._tabBeforeCtx = /chart|picture/.test(el.dataset.tab) ? App._tabBeforeCtx : el.dataset.tab; return; }
  if (el.dataset.menu) {
    e.stopPropagation();
    const wasOpen = el.classList.contains('open');
    App.closePopup();
    if (!wasOpen) App.openMenu(el.dataset.menu, el);
    return;
  }
  if (el.dataset.cmd) {
    const inPopup = el.closest('.menu');
    if (inPopup) App.closePopup();
    if (el.closest('#ribbon') && document.body.classList.contains('ribbon-peek')) document.body.classList.remove('ribbon-peek');
    App.exec(el.dataset.cmd, el.dataset.arg, el);
  }
});
document.addEventListener('dblclick', (e) => {
  const el = e.target.closest('[data-cmd="formatPainter"]');
  if (el) App.exec('formatPainter', 'sticky', el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-cmd]');
  if (!el || !el.matches('input, select') || el.closest('#dialog-layer')) return;
  if (el.type === 'range') return;
  App.exec(el.dataset.cmd, el.type === 'checkbox' ? el.checked : el.value, el);
  if (el.matches('#font-family, #font-size, #numfmt')) App.focusGrid();
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input[type=range][data-cmd]')) App.exec(el.dataset.cmd, el.value, el);
});

/* ---------- Commando zoeken (Alt+Q) ---------- */
(() => {
  const input = $('#cmd-search'), out = $('#cmd-results');
  let items = [], sel = 0;
  const collect = () => {
    const seen = new Set();
    const list = [];
    $$('#ribbon [data-cmd], #menus [data-cmd], #ribbon [data-menu]').forEach((el) => {
      const label = (el.getAttribute('title') || el.textContent).replace(/\s+/g, ' ').replace(/\b(arrow_drop_down|expand_more)\b/g, '').trim();
      const icon = el.querySelector('.i')?.textContent || 'bolt';
      const key = (el.dataset.cmd || el.dataset.menu) + '|' + (el.dataset.arg || '') + '|' + label;
      const clean = label.replace(new RegExp('^' + icon + '\\s*'), '').replace(/Ctrl\+.*$/, '').trim();
      if (!clean || seen.has(key)) return;
      seen.add(key);
      const panel = el.closest('.panel')?.dataset.panel;
      list.push({ label: clean, icon, cmd: el.dataset.cmd, menu: el.dataset.menu, arg: el.dataset.arg, panel });
    });
    // functies
    Object.entries(App.FN).forEach(([en, f]) => list.push({ label: `${f.nl} — ${f.desc}`, icon: 'function', fn: en }));
    return list;
  };
  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { out.hidden = true; return; }
    const all = collect();
    items = all.filter((i) => i.label.toLowerCase().includes(q)).sort((a, b) => (a.fn ? 1 : 0) - (b.fn ? 1 : 0)).slice(0, 14);
    sel = 0;
    out.innerHTML = items.length
      ? `<div class="menu-title">Acties en functies</div>` + items.map((it, k) => `<button data-k="${k}" class="${k === 0 ? 'kb' : ''}"><span class="i">${it.icon}</span>${App.esc(it.label)}</button>`).join('')
      : `<div class="menu-empty">Niets gevonden voor “${App.esc(q)}”. Druk op Enter om in het blad te zoeken.</div>`;
    out.hidden = false;
  };
  const run = (it) => {
    out.hidden = true; input.value = ''; input.blur();
    if (!it) return;
    if (it.fn) { App.exec('insertFunction', it.fn); return; }
    if (it.cmd) App.exec(it.cmd, it.arg);
    else if (it.menu) {
      if (it.panel) App.showTab(it.panel);
      setTimeout(() => {
        const btn = $(`#ribbon .panel.active [data-menu="${it.menu}"]`);
        if (btn) App.openMenu(it.menu, btn);
      }, 30);
    }
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(() => { out.hidden = true; }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = App.clamp(sel + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
      $$('button', out).forEach((b, k) => b.classList.toggle('kb', k === sel));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[sel]) run(items[sel]);
      else { const q = input.value; run(null); App.exec('find', q); }
    } else if (e.key === 'Escape') { input.value = ''; out.hidden = true; App.focusGrid(); }
  });
  out.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { e.preventDefault(); run(items[+b.dataset.k]); }
  });
})();

/* ---------- Sneltoetsen (overzicht) ---------- */
App.shortcuts = [
  ['Algemeen', [['Opslaan', 'Ctrl+S'], ['Openen', 'Ctrl+O'], ['Nieuwe werkmap', 'Ctrl+N'], ['Afdrukken / PDF', 'Ctrl+P'], ['Functie zoeken', 'Alt+Q'], ['Lint in-/uitklappen', 'Ctrl+F1'], ['Sneltoetsen', 'F1']]],
  ['Bewegen en selecteren', [['Naar rand van gegevens', 'Ctrl+pijl'], ['Selectie uitbreiden', 'Shift+pijl'], ['Begin / einde van blad', 'Ctrl+Home / Ctrl+End'], ['Hele kolom / rij', 'Ctrl+Spatie / Shift+Spatie'], ['Alles selecteren', 'Ctrl+A'], ['Ga naar', 'Ctrl+G / F5'], ['Vorig / volgend blad', 'Ctrl+PageUp / PageDown']]],
  ['Bewerken', [['Cel bewerken', 'F2'], ['Nieuwe regel in cel', 'Alt+Enter'], ['Alle geselecteerde cellen vullen', 'Ctrl+Enter'], ['Absolute verwijzing wisselen', 'F4'], ['Ongedaan maken / opnieuw', 'Ctrl+Z / Ctrl+Y'], ['Omlaag / rechts doorvoeren', 'Ctrl+D / Ctrl+R'], ['AutoSom', 'Alt+='], ['Datum / tijd van nu', 'Ctrl+; / Ctrl+Shift+;'], ['Cellen invoegen / verwijderen', 'Ctrl++ / Ctrl+-'], ['Notitie', 'Shift+F2'], ['Koppeling', 'Ctrl+K']]],
  ['Opmaak', [['Celeigenschappen', 'Ctrl+1'], ['Vet / cursief / onderstrepen', 'Ctrl+B / I / U'], ['Doorhalen', 'Ctrl+5'], ['Valuta / procent / getal', 'Ctrl+Shift+$ / % / !'], ['Datum / tijd-notatie', 'Ctrl+Shift+# / @'], ['Rijen / kolommen verbergen', 'Ctrl+9 / Ctrl+0'], ['Opmaken als tabel', 'Ctrl+T'], ['Filter aan/uit', 'Ctrl+Shift+L']]],
  ['Formules', [['Functie invoegen', 'Shift+F3'], ['Formules weergeven', 'Ctrl+`'], ['Nu berekenen', 'F9'], ['Nieuw blad', 'Shift+F11']]],
];
App.def('showShortcuts', () => {
  const html = '<div class="kbd-list">' + App.shortcuts.map(([h, list]) => `<h3>${h}</h3>` + list.map(([a, k]) => `<span>${a}</span><span>${k.split(' / ').map((x) => `<kbd>${x}</kbd>`).join(' / ')}</span>`).join('')).join('') + '</div>';
  App.dialog({ title: 'Sneltoetsen', body: html, wide: true });
});

/* ---------- Basiscommando's ---------- */
App.def('undo', () => App.history.undo());
App.def('redo', () => App.history.redo());
App.def('toggleRibbon', () => {
  document.body.classList.toggle('ribbon-collapsed');
  document.body.classList.remove('ribbon-peek');
  App.resize();
});
document.addEventListener('mousedown', (e) => {
  if (document.body.classList.contains('ribbon-peek') && !e.target.closest('#ribbon, #tabs, .menu')) document.body.classList.remove('ribbon-peek');
});
App.def('toggleDark', () => {
  App.settings.dark = !App.settings.dark;
  document.body.classList.toggle('dark', App.settings.dark);
  App.saveSettings();
  App.scheduleState();
  App.scheduleRender();
});
App.stateFns.dark = () => App.settings.dark;
App.saveSettings = () => App.store.set('settings', App.settings);
App.def('newWindow', () => window.open(location.href.split('#')[0] + '#new', '_blank'));
App.def('showAbout', () => App.dialog({
  title: 'Over Cel',
  body: `<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><div class="logo" style="width:36px;height:36px;margin:0"><span class="i" style="font-size:24px">grid_on</span></div>
  <div><b style="font-size:16px;font-weight:600">Cel</b><div class="muted">Rekenblad · versie 1.0 · open source</div></div></div>
  <p style="line-height:1.55;margin:0 0 8px">Werkmappen worden opgeslagen in deze browser op deze computer. Bestanden kunnen worden geopend en opgeslagen als .xlsx en .csv; afdrukken of opslaan als PDF gaat via het afdrukvenster.</p>
  <p style="line-height:1.55;margin:0" class="muted">Geen account, geen gegevens invullen: alles blijft op je eigen computer.</p>`,
}));
App.def('showTour', () => App.dialog({
  title: 'Rondleiding', wide: true,
  body: `<div class="bs-cards">
    ${[['format_bold', 'Start', 'Klembord, lettertype, uitlijning, getalnotatie, voorwaardelijke opmaak, tabelstijlen, cellen invoegen en AutoSom.'],
       ['bar_chart', 'Invoegen', 'Grafieken (kolom, staaf, lijn, cirkel, vlak, spreiding, ring), afbeeldingen, vormen, tekstvakken, koppelingen en notities.'],
       ['margin', 'Pagina-indeling', 'Marges, afdrukstand, papierformaat, afdrukbereik, titels afdrukken en passend maken.'],
       ['function', 'Formules', 'Ruim 170 functies met Nederlandse namen, namen beheren, formules weergeven en controleren.'],
       ['filter_alt', 'Gegevens', 'Sorteren, filteren, tekst naar kolommen, dubbele waarden verwijderen, gegevensvalidatie en doelzoeken.'],
       ['rate_review', 'Controleren', 'Spelling, statistieken, voorlezen, notities en bladbeveiliging.'],
       ['visibility', 'Beeld', 'Rasterlijnen, koppen, formulebalk, zoomen, titels blokkeren en donkere modus.']]
      .map(([i, t, s]) => `<div class="bs-card"><span class="i">${i}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}
  </div>`,
}));
