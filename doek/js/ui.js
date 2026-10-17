/* =========================================================
   Doek (gemaakt door JJ van Schelven) — interface: lint, menu's, dialogen, meldingen
   (zelfde opzet als Inkt en Cel)
   ========================================================= */
'use strict';

/* ---------- Meldingen ---------- */
App.toast = (msg, icon = 'info', opts = {}) => {
  const icons = { info: 'info', error: 'error', ok: 'check_circle', lock: 'lock', undo: 'undo', save: 'save' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  const ic = document.createElement('span'); ic.className = 'i'; ic.textContent = icons[icon] || icon;
  const tx = document.createElement('span'); tx.textContent = msg;
  t.append(ic, tx);
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
  dlg.setAttribute('aria-modal', 'true');
  dlg.innerHTML = `
    <div class="dlg-head"><h2></h2><button class="qb" data-x title="Sluiten"><span class="i">close</span></button></div>
    <div class="dlg-body"></div>
    <div class="dlg-foot"></div>`;
  dlg.querySelector('h2').textContent = o.title || '';
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
      if (!$('#backstage') && !$('.backdrop')) App.focusStage && App.focusStage();
    },
  };
  const buttons = o.buttons || [{ label: 'Sluiten', primary: true }];
  if (!buttons.length) foot.remove();
  buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '') + (b.left ? ' left' : '');
    btn.textContent = App.t(b.label);
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
    else if (e.key === 'Enter' && api.primary && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !o.noEnter && !e.target.isContentEditable) {
      e.preventDefault(); e.stopPropagation(); api.primary.click();
    }
  };
  document.addEventListener('keydown', onKey, true);
  dlg.querySelector('[data-x]').onclick = () => api.close(null);
  bd.addEventListener('mousedown', (e) => { if (e.target === bd && !o.modal) api.close(null); });
  bd.appendChild(dlg);
  layer.appendChild(bd);
  o.onOpen && o.onOpen(api);
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('.dlg-body input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]), .dlg-body textarea, .dlg-body select');
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
  if (App.subPopup) { App.subPopup.remove(); App.subPopup = null; }
};
App.openPopup = (anchor, content, cls = '') => {
  App.closePopup();
  const m = document.createElement('div');
  m.className = 'menu ' + cls;
  m.setAttribute('role', 'menu');
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
  const src = document.getElementById(name);
  const built = App.menuBuilders[name] ? App.menuBuilders[name](anchor) : null;
  if (built === false) return null;
  const html = built || (src ? src.innerHTML : '');
  const cls = (src ? src.className : '') + (App.menuBuilders[name] && App.menuBuilders[name].cls ? ' ' + App.menuBuilders[name].cls : '');
  const m = App.openPopup(anchor, html, cls);
  if (App.menuAfter[name]) App.menuAfter[name](m, anchor);
  App.emit('menu', name, m);
  return m;
};
App.menuAfter = {};
// Submenu (knop met data-menu-sub)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-menu-sub]');
  if (!b || !b.closest('.menu')) return;
  e.stopPropagation(); e.preventDefault();
  const name = b.dataset.menuSub;
  const src = document.getElementById(name);
  const html = App.menuBuilders[name] ? App.menuBuilders[name]() : (src ? src.innerHTML : '');
  if (App.subPopup) App.subPopup.remove();
  const m = document.createElement('div');
  m.className = 'menu sub ' + (src ? src.className : '') + (App.menuBuilders[name] && App.menuBuilders[name].cls ? ' ' + App.menuBuilders[name].cls : '');
  m.innerHTML = html;
  $('#popup-layer').appendChild(m);
  App.subPopup = m;
  const r = b.getBoundingClientRect();
  App.positionPopup(m, { x: r.right + 2, y: r.top });
  if (App.menuAfter[name]) App.menuAfter[name](m, b);
}, true);

/* Kleurkiezer: themakleuren (blijven meegaan met het thema), standaardkleuren, recente kleuren, pipet */
App.PALETTE_STD = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
App.THEME_ROW = ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
App.colorName = (ref) => {
  if (!ref) return '';
  if (ref[0] === '#') return ref.toUpperCase();
  const [s, m] = ref.split('/');
  const base = { bg1: 'Achtergrond 1', tx1: 'Tekst 1', bg2: 'Achtergrond 2', tx2: 'Tekst 2', hlink: 'Hyperlink' }[s] || (s.startsWith('accent') ? 'Accent ' + s.slice(6) : s);
  if (!m) return App.t(base);
  return App.t(base) + ', ' + App.t(m[0] === 'l' ? '{0}% lichter' : '{0}% donkerder').replace('{0}', m.slice(1));
};
App.recentColors = () => App.store.get('recentColors', []) || [];
App.addRecentColor = (c) => { if (!c || c[0] !== '#') return; App.store.set('recentColors', [c, ...App.recentColors().filter((x) => x !== c)].slice(0, 10)); };
App.colorMenu = (anchor, cmd, onPick, opts = {}) => {
  const noneLabel = opts.none || { fontColor: 'Automatisch', shapeFill: 'Geen opvulling', shapeLine: 'Geen omtrek', hlColor: 'Geen kleur', cellFill: 'Geen opvulling', textFill: 'Geen opvulling', textOutline: 'Geen omtrek' }[cmd] || 'Geen';
  const th = App.theme();
  const btn = (c) => `<button data-color="${c}" title="${App.esc(App.colorName(c))}" style="background:${App.color(c, th)}"></button>`;
  let html = `<div class="color-menu">`;
  if (noneLabel) html += `<button class="mi" data-color=""><span class="i">format_color_reset</span> ${App.esc(App.t(noneLabel))}</button>`;
  html += `<div class="cm-label">${App.t('Themakleuren')}</div><div class="cm-grid">`;
  html += App.THEME_ROW.map(btn).join('');
  const rows = [['l80', 'd5'], ['l60', 'd15'], ['l40', 'd25'], ['d25', 'd35'], ['d50', 'd50']];
  rows.forEach(([m, mDark]) => {
    html += App.THEME_ROW.map((s) => {
      const isDark = App.luminance(App.color(s, th)) < 0.2, isLight = App.luminance(App.color(s, th)) > 0.85;
      const mod = isLight ? 'd' + ({ l80: 5, l60: 15, l40: 25, d25: 35, d50: 50 }[m]) : isDark && m[0] === 'd' ? 'l' + ({ d25: 25, d50: 15 }[m]) : m;
      void mDark;
      return btn(s + '/' + mod);
    }).join('');
  });
  html += `</div><div class="cm-label">${App.t('Standaardkleuren')}</div><div class="cm-grid">${App.PALETTE_STD.map(btn).join('')}</div>`;
  const rec = App.recentColors();
  if (rec.length) html += `<div class="cm-label">${App.t('Recente kleuren')}</div><div class="cm-recent">${rec.map(btn).join('')}</div>`;
  html += `<label class="mi"><span class="i">colorize</span> ${App.t('Meer kleuren…')} <input type="color" data-more style="margin-left:auto;width:28px;height:22px;border:0;padding:0;background:none"></label>`;
  if (window.EyeDropper) html += `<button class="mi" data-eyedrop><span class="i">colorize</span> ${App.t('Pipet')}</button>`;
  if (opts.extra) html += opts.extra;
  html += '</div>';
  const m = App.openPopup(anchor, html);
  const pick = (c) => {
    App.closePopup();
    if (c && c[0] === '#') App.addRecentColor(c);
    if (onPick) { onPick(c); return; }
    if (c) App.state.lastColors[{ fontColor: 'font', shapeFill: 'fill', shapeLine: 'line', hlColor: 'hl', cellFill: 'fill', textFill: 'font' }[cmd] || cmd] = c;
    App.updateSwatches();
    App.exec(cmd, c);
  };
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-color]');
    if (b) { e.stopPropagation(); pick(b.dataset.color); return; }
    if (e.target.closest('[data-eyedrop]')) {
      e.stopPropagation(); App.closePopup();
      try { const r = await new window.EyeDropper().open(); pick(r.sRGBHex); } catch { /* geannuleerd */ }
    }
  });
  m.querySelector('[data-more]').addEventListener('change', (e) => pick(e.target.value));
  return m;
};
App.updateSwatches = () => {
  const lc = App.state.lastColors, th = App.pres ? App.theme() : null;
  const set = (sel, c) => $$(sel).forEach((el) => { el.style.background = c && th ? App.color(c, th) : 'transparent'; });
  set('#sw-font, .sw-font', lc.font); set('#sw-hl', lc.hl); set('#sw-fill, .sw-fill', lc.fill); set('#sw-line, .sw-line', lc.line);
};

/* ---------- Tabbladen ---------- */
App.activeTab = 'home';
App.showTab = (name) => {
  if (document.body.classList.contains('ribbon-collapsed')) document.body.classList.add('ribbon-peek');
  App.activeTab = name;
  $$('#tabs .tab[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('#ribbon .panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  App.emit('tab', name);
  App.scheduleState();
};
App.CTX_TABS = ['shapeFormat', 'pictureFormat', 'tableDesign', 'tableLayout', 'chartDesign', 'diagramDesign', 'media', 'equation', 'masterTab'];
App.context = {};
App.setContext = (ctx) => {
  let first = null;
  App.CTX_TABS.forEach((k) => {
    const on = !!ctx[k];
    const tab = $(`#tabs .tab[data-tab="${k}"]`);
    if (!tab) return;
    if (on !== !!App.context[k]) {
      tab.hidden = !on;
      if (on && !first && ctx.focus !== false) first = k;
      if (!on && App.activeTab === k) App.showTab(App._tabBeforeCtx || 'home');
    }
    App.context[k] = on;
  });
  if (first && ctx.auto) App.showTab(first);
};

/* ---------- Toestand van knoppen bijwerken ---------- */
App.stateFns = {};
App.scheduleState = (() => {
  let raf = 0;
  return () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; App.updateState(); }); };
})();
App.updateState = () => {
  $$('[data-state]').forEach((el) => {
    const k = el.dataset.state;
    let on = false;
    try { on = App.stateFns[k] ? App.stateFns[k]() : false; } catch { on = false; }
    el.classList.toggle('on', !!on);
    if (el.matches('[aria-pressed]') || el.classList.contains('rb')) el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  App.emit('state');
};

/* ---------- Klikken in lint, menu's, statusbalk ---------- */
document.addEventListener('mousedown', (e) => {
  const b = e.target.closest('button, .menu .mi, .menu label');
  if (b && b.closest('#ribbon, .menu, .qat, #statusbar, #tabs, #find-panel .qb, #titlebar .tb-btn')) {
    if (!e.target.closest('input, select')) e.preventDefault();   // tekstselectie in een tekstvak niet kwijtraken
  }
  if (App.popup && !e.target.closest('.menu') && !e.target.closest('[data-menu]')) App.closePopup();
}, true);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-cmd], [data-menu], [data-tab]');
  if (!el || el.matches('input, select, label') || el.closest('#dialog-layer') || el.closest('#backstage .bs-main')) return;
  if (el.dataset.tab) { App.showTab(el.dataset.tab); if (!App.CTX_TABS.includes(el.dataset.tab)) App._tabBeforeCtx = el.dataset.tab; return; }
  if (el.dataset.menu) {
    e.stopPropagation();
    const wasOpen = el.classList.contains('open');
    App.closePopup();
    if (!wasOpen) App.openMenu(el.dataset.menu, el);
    return;
  }
  if (el.dataset.cmd) {
    if (el.dataset.cmd === 'noop') return;
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
  if (!el || !el.matches('input, select') || el.closest('#dialog-layer') || el.closest('#backstage') || el.closest('#pane')) return;
  if (el.type === 'range') return;
  const value = el.type === 'checkbox' ? el.checked : el.value;
  // met data-arg: { key, value }, anders alleen de waarde
  App.exec(el.dataset.cmd, el.dataset.arg !== undefined ? { key: el.dataset.arg, value } : value, el);
  if (el.matches('#font-family, #font-size')) App.focusStage(true);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input[type=range][data-cmd]') && !el.closest('#pane') && !el.closest('#dialog-layer')) App.exec(el.dataset.cmd, el.value, el);
});

/* ---------- Commando zoeken (Alt+Q) ---------- */
(() => {
  const input = $('#cmd-search'), out = $('#cmd-results');
  let items = [], sel = 0;
  const collect = () => {
    const seen = new Set();
    const list = [];
    $$('#ribbon [data-cmd], #menus [data-cmd], #ribbon [data-menu]').forEach((el) => {
      if (el.dataset.cmd === 'noop') return;
      const label = (el.getAttribute('title') || el.textContent).replace(/\s+/g, ' ').replace(/\b(arrow_drop_down|expand_more)\b/g, '').trim();
      const icon = el.querySelector('.i')?.textContent || 'bolt';
      const key = (el.dataset.cmd || el.dataset.menu) + '|' + (el.dataset.arg || '') + '|' + label;
      const clean = label.replace(new RegExp('^' + icon + '\\s*'), '').replace(/Ctrl\+.*$/, '').trim();
      if (!clean || seen.has(key)) return;
      seen.add(key);
      const panel = el.closest('.panel')?.dataset.panel;
      list.push({ label: clean, icon, cmd: el.dataset.cmd, menu: el.dataset.menu, arg: el.dataset.arg, panel });
    });
    return list;
  };
  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { out.hidden = true; return; }
    items = collect().filter((i) => i.label.toLowerCase().includes(q)).slice(0, 14);
    sel = 0;
    out.innerHTML = items.length
      ? `<div class="menu-title">${App.t('Acties')}</div>` + items.map((it, k) => `<button data-k="${k}" class="${k === 0 ? 'kb' : ''}"><span class="i">${App.esc(it.icon)}</span>${App.esc(it.label)}</button>`).join('')
      : `<div class="menu-empty">${App.esc(App.t('Niets gevonden voor “{0}”. Druk op Enter om in de presentatie te zoeken.').replace('{0}', q))}</div>`;
    out.hidden = false;
  };
  const run = (it) => {
    out.hidden = true; input.value = ''; input.blur();
    if (!it) return;
    if (it.cmd) App.exec(it.cmd, it.arg);
    else if (it.menu) {
      if (it.panel) App.showTab(it.panel);
      setTimeout(() => { const btn = $(`#ribbon .panel.active [data-menu="${it.menu}"]`); if (btn) App.openMenu(it.menu, btn); }, 30);
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
    } else if (e.key === 'Escape') { input.value = ''; out.hidden = true; App.focusStage(); }
  });
  out.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { e.preventDefault(); run(items[+b.dataset.k]); }
  });
})();

/* ---------- Sneltoetsen (overzicht) ---------- */
App.shortcuts = [
  ['Algemeen', [['Opslaan', 'Ctrl+S'], ['Openen', 'Ctrl+O'], ['Nieuwe presentatie', 'Ctrl+N'], ['Afdrukken / PDF', 'Ctrl+P'], ['Functie zoeken', 'Alt+Q'], ['Delen', 'Alt+S'], ['Lint in-/uitklappen', 'Ctrl+F1'], ['Sneltoetsen', 'F1']]],
  ["Dia's", [['Nieuwe dia', 'Ctrl+M'], ['Dia of object dupliceren', 'Ctrl+D'], ['Vorige / volgende dia', 'PageUp / PageDown'], ['Eerste / laatste dia', 'Home / End'], ['Dia verwijderen (in het miniatuurvenster)', 'Delete']]],
  ['Objecten', [['Groeperen / groep opheffen', 'Ctrl+G / Ctrl+Shift+G'], ['Naar voren / naar achteren', 'Ctrl+Shift+] / Ctrl+Shift+['], ['Verplaatsen in kleine stapjes', 'Ctrl+pijl'], ['Volgend / vorig object', 'Tab / Shift+Tab'], ['Alles selecteren', 'Ctrl+A'], ['Selectievenster', 'Alt+F10'], ['Opmaak kopiëren / plakken', 'Ctrl+Shift+C / Ctrl+Shift+V'], ['Laatste actie herhalen', 'F4'], ['Kopie slepen', 'Ctrl+slepen'], ['Recht verplaatsen of verhouding behouden', 'Shift+slepen']]],
  ['Tekst', [['Vet / cursief / onderstrepen', 'Ctrl+B / I / U'], ['Links / centreren / rechts / uitvullen', 'Ctrl+L / E / R / J'], ['Tekengrootte groter / kleiner', 'Ctrl+Shift+> / <'], ['Lijstniveau hoger / lager', 'Tab / Shift+Tab'], ['Hoofdletters wisselen', 'Shift+F3'], ['Opmaak wissen', 'Ctrl+Spatie'], ['Koppeling', 'Ctrl+K'], ['Lettertype', 'Ctrl+T'], ['Superscript / subscript', 'Ctrl+Shift+= / Ctrl+=']]],
  ['Diavoorstelling', [['Vanaf begin / vanaf huidige dia', 'F5 / Shift+F5'], ['Volgende stap', 'Spatie, N, →, ↓, Enter, klik'], ['Vorige stap', 'Backspace, P, ←, ↑'], ['Naar dia nummer', 'nummer + Enter'], ['Zwart / wit scherm', 'B / W'], ['Laserpointer', 'Ctrl+L'], ['Pen / gum / inkt wissen', 'Ctrl+P / Ctrl+E / E'], ['Alle dia\'s', 'G of -'], ['Beëindigen', 'Esc']]],
];
App.def('showShortcuts', () => {
  const html = '<div class="kbd-list">' + App.shortcuts.map(([h, list]) => `<h3>${App.esc(App.t(h))}</h3>` + list.map(([a, k]) => `<span>${App.esc(App.t(a))}</span><span>${k.split(' / ').map((x) => `<kbd>${App.esc(x)}</kbd>`).join(' / ')}</span>`).join('')).join('') + '</div>';
  App.dialog({ title: App.t('Sneltoetsen'), body: html, wide: true });
});

/* ---------- Basiscommando's ---------- */
App.def('undo', () => App.history.undo());
App.def('redo', () => App.history.redo());
App.def('toggleRibbon', () => {
  document.body.classList.toggle('ribbon-collapsed');
  document.body.classList.remove('ribbon-peek');
  App.layoutStage && App.layoutStage();
});
document.addEventListener('mousedown', (e) => {
  if (document.body.classList.contains('ribbon-peek') && !e.target.closest('#ribbon, #tabs, .menu')) document.body.classList.remove('ribbon-peek');
});
App.def('toggleDark', () => {
  App.settings.dark = !App.settings.dark;
  document.body.classList.toggle('dark', App.settings.dark);
  App.saveSettings();
  App.scheduleState();
});
App.stateFns.dark = () => App.settings.dark;
App.saveSettings = () => App.store.set('settings', App.settings);
App.def('newWindow', () => window.open(location.href.split('#')[0].split('?')[0] + '#new', '_blank'));
App.def('showAbout', () => App.dialog({
  title: App.t('Over Doek'),
  body: `<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><div class="logo" style="width:44px;height:44px;margin:0;border-radius:8px"><span class="i" style="font-size:30px">co_present</span></div>
    <div><b style="font-size:18px;font-weight:600">Doek</b><div class="muted">${App.t('Presentaties')} · ${App.t('versie')} ${App.VERSION}</div><div style="margin-top:2px">${App.t('Gemaakt door')} <b>${App.MAKER}</b></div></div></div>
    <p style="line-height:1.55;margin:0 0 8px">${App.t('Doek is een presentatieprogramma met thema\'s, diamodellen, vormen, tabellen, grafieken, diagrammen, animaties, overgangen (ook Morph), een presentatorweergave en het openen en opslaan van .pptx-bestanden.')}</p>
    <p style="line-height:1.55;margin:0 0 8px" class="muted">${App.t('Geen account, geen gegevens invullen en geen AI: alles blijft op je eigen computer. Open source.')}</p>
    <p style="margin:0" class="small">© ${new Date().getFullYear()} ${App.MAKER}. ${App.t('Doek is een onafhankelijk project en is niet verbonden aan Microsoft. PowerPoint is een merk van Microsoft Corporation; .pptx is een open standaard (ECMA-376).')}</p>`,
}));
App.def('showTour', () => App.dialog({
  title: App.t('Rondleiding'), wide: true,
  body: `<div class="bs-cards">
    ${[['format_bold', 'Start', 'Nieuwe dia\'s, indelingen, secties, lettertype, alinea, vormen tekenen, schikken en snelle stijlen.'],
      ['add_photo_alternate', 'Invoegen', 'Tabellen, afbeeldingen, vormen, pictogrammen, diagrammen, grafieken, koppelingen, WordArt, vergelijkingen, video en audio.'],
      ['palette', 'Ontwerpen', '14 eigen thema\'s met varianten, kleur- en lettertypesets, diaformaat en achtergrond.'],
      ['animation', 'Overgangen en Animaties', 'Overgangen zoals Morph, Duwen en Kubus; animaties voor ingang, nadruk, uitgang en bewegingspaden met een deelvenster en tijdlijn.'],
      ['slideshow', 'Diavoorstelling', 'Presenteren met presentatorweergave, pen, laserpointer, timings repeteren en opnemen.'],
      ['rate_review', 'Controleren', 'Spelling, synoniemen, toegankelijkheid, opmerkingen en vergelijken.'],
      ['visibility', 'Beeld', 'Normaal, diasorteerder, notitiepagina, leesweergave, diamodel, liniaal, raster en hulplijnen.']]
      .map(([i, t, s]) => `<div class="bs-card"><span class="i">${i}</span><div><b>${App.esc(App.t(t))}</b><small>${App.esc(App.t(s))}</small></div></div>`).join('')}
  </div><p class="muted small" style="margin-top:12px">${App.t('Doek is gemaakt door')} ${App.MAKER}.</p>`,
}));
