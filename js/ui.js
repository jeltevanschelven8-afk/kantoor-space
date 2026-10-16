/* =========================================================
   Inkt — interface: lint, menu's, dialogen, sneltoetsen
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
      if (!o.keepFocus && !$('#backstage')) App.restoreRange();
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
  // Echt modaal: Tab blijft binnen het venster, klikken ernaast sluit het niet, en alleen het bovenste venster luistert
  const focusables = () => api.$$('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"]), [contenteditable="true"]').filter((x) => !x.disabled && x.offsetParent !== null);
  const onKey = (e) => {
    if (layer.lastElementChild !== bd) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); api.close(null); }
    else if (e.key === 'Tab') {
      const f = focusables(); if (!f.length) { e.preventDefault(); return; }
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey ? i <= 0 : (i === -1 || i === f.length - 1)) { e.preventDefault(); e.stopPropagation(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
    else if (e.key === 'Enter' && api.primary && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.isContentEditable && !o.noEnter) {
      e.preventDefault(); e.stopPropagation(); api.primary.click();
    }
  };
  document.addEventListener('keydown', onKey, true);
  dlg.querySelector('[data-x]').onclick = () => api.close(null);
  dlg.setAttribute('aria-modal', 'true'); dlg.tabIndex = -1;
  // focus komt na het sluiten terug waar hij was
  const prevFocus = document.activeElement;
  const origClose = api.close;
  api.close = (result) => { if (api.closed) return; origClose(result); if (prevFocus && prevFocus.isConnected && !App.ed.contains(prevFocus) && !o.keepFocus) { try { prevFocus.focus({ preventScroll: true }); } catch { /* niets */ } } };
  bd.appendChild(dlg);
  layer.appendChild(bd);
  o.onOpen && o.onOpen(api);
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('.dlg-body input:not([type=checkbox]):not([type=radio]), .dlg-body textarea, .dlg-body select') || api.primary || focusables()[0] || dlg;
  setTimeout(() => { if (!api.closed && !dlg.contains(document.activeElement)) { first.focus({ preventScroll: true }); first.select && first.select(); } }, 30);
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
  // niet alleen .rb: ook de Delen-knop (.share-btn) en andere menu-knoppen krijgen 'open'; anders opent hij pas bij de tweede klik
  $$('.rb.open, [data-menu].open').forEach((b) => b.classList.remove('open'));
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
  if (name === 'table-grid') return App.tableGridMenu(anchor);
  const src = document.getElementById(name);
  let html = App.menuBuilders[name] ? App.menuBuilders[name]() : (src ? src.innerHTML : '');
  const cls = src ? src.className : '';
  App.openPopup(anchor, html, cls);
};

/* Kleurkiezer */
App.PALETTE_BASE = ['#ffffff', '#000000', '#e8e8e8', '#0e2841', '#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'];
App.PALETTE_STD = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
// De 15 markeerkleuren van Word (geel, felgroen, turquoise, roze, blauw, rood, donkerblauw, groenblauw, groen, violet, donkerrood, donkergeel, grijs 50%, grijs 25%, zwart)
App.HILITE = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000'];
App.mix = (hex, t) => {
  // t > 0 lichter, t < 0 donkerder
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (t > 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; } else { r *= 1 + t; g *= 1 + t; b *= 1 + t; }
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
};
App.colorMenu = (anchor, cmd) => {
  const isHi = cmd === 'hiliteColor';
  const noneLabel = { foreColor: 'Automatisch', hiliteColor: 'Geen kleur', shading: 'Geen kleur', pageColor: 'Geen kleur', cellShading: 'Geen kleur' }[cmd] || 'Geen';
  const btn = (c) => `<button data-color="${c}" title="${c}" style="background:${c}"></button>`;
  let html = `<div class="color-menu">`;
  html += `<button class="mi" data-color=""><span class="i">format_color_reset</span> ${noneLabel}</button>`;
  if (isHi) {
    html += `<div class="cm-label">Markeerkleuren</div><div class="cm-grid">${App.HILITE.map(btn).join('')}</div>`;
  } else {
    html += `<div class="cm-label">Themakleuren</div><div class="cm-grid">`;
    html += App.PALETTE_BASE.map(btn).join('');
    [0.8, 0.6, 0.4, -0.25, -0.5].forEach((t) => {
      html += App.PALETTE_BASE.map((c, i) => btn(i === 0 ? App.mix('#ffffff', -Math.abs(t) * 0.5) : i === 1 ? App.mix('#000000', Math.abs(t)) : App.mix(c, t))).join('');
    });
    html += `</div><div class="cm-label">Standaardkleuren</div><div class="cm-grid">${App.PALETTE_STD.map(btn).join('')}</div>`;
  }
  html += `<label class="mi"><span class="i">colorize</span> Meer kleuren… <input type="color" data-more style="margin-left:auto;width:28px;height:22px;border:0;padding:0;background:none"></label></div>`;
  const m = App.openPopup(anchor, html);
  const pick = (c) => {
    App.state.lastColors[cmd] = c;
    App.updateSwatches();
    App.closePopup();
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
  set('sw-fore', lc.foreColor); set('sw-hilite', lc.hiliteColor); set('sw-shade', lc.shading);
};

/* Tabelraster */
App.tableGridMenu = (anchor) => {
  const R = 8, C = 10;
  let cells = '';
  for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) cells += `<i data-r="${r}" data-c="${c}"></i>`;
  const m = App.openPopup(anchor, `<div class="table-grid"><div class="tg-label">Tabel invoegen</div><div class="tg">${cells}</div></div>
    <hr><button data-cmd="insertTableDialog"><span class="i">grid_on</span> Tabel invoegen…</button>
    <button data-cmd="textToTable"><span class="i">transform</span> Tekst naar tabel converteren</button>
    <button data-cmd="quickTable"><span class="i">calendar_view_month</span> Snelle tabel (kalender)</button>`);
  const label = m.querySelector('.tg-label');
  const grid = m.querySelector('.tg');
  grid.addEventListener('mouseover', (e) => {
    const t = e.target.closest('i'); if (!t) return;
    const r = +t.dataset.r, c = +t.dataset.c;
    grid.querySelectorAll('i').forEach((i) => i.classList.toggle('on', +i.dataset.r <= r && +i.dataset.c <= c));
    label.textContent = `Tabel ${c} × ${r}`;
  });
  grid.addEventListener('click', (e) => {
    const t = e.target.closest('i'); if (!t) return;
    App.closePopup();
    App.exec('insertTable', { rows: +t.dataset.r, cols: +t.dataset.c });
  });
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
App.context = { table: false, picture: false, hf: false };
App.setContext = (ctx) => {
  ['table', 'picture', 'hf'].forEach((k) => {
    const on = !!ctx[k];
    const tab = $(`#tabs .tab[data-tab="${k}"]`);
    if (on !== App.context[k]) {
      tab.hidden = !on;
      if (on && (k === 'picture' || k === 'hf')) App.showTab(k);
      if (!on && App.activeTab === k) App.showTab(k === 'table' ? 'insert' : k === 'picture' ? 'insert' : 'home');
    }
    App.context[k] = on;
  });
};

/* ---------- Toestand van knoppen bijwerken ---------- */
App.stateFns = {};
App.updateState = () => {
  const r = App.getRange() || App.lastRange;
  const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
  $$('[data-state]').forEach((el) => {
    const k = el.dataset.state;
    let on;
    if (App.stateFns[k]) on = App.stateFns[k]();
    else on = r ? q(k) : false;
    el.classList.toggle('on', !!on);
  });
  // Lettertype en grootte
  if (r) {
    const node = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
    if (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const ff = $('#font-family');
      if (document.activeElement !== ff) {
        if (![...ff.options].some((o) => o.value === fam)) {
          const o = document.createElement('option'); o.value = fam; o.textContent = fam; o.style.fontFamily = fam; ff.appendChild(o);
        }
        ff.value = fam;
      }
      const fs = $('#font-size');
      if (document.activeElement !== fs) fs.value = App.fmtNum(Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2, 1);
    }
  }
  App.setContext({ table: !!(App.curTable && App.curTable()), picture: !!App.selectedObj, hf: !!App.state.hfEditing });
  App.emit('selection', r);
};

/* ---------- Klikken in lint, menu's, statusbalk ---------- */
document.addEventListener('mousedown', (e) => {
  const b = e.target.closest('button, .menu .mi, .menu label');
  if (b && b.closest('#ribbon, #minibar, .menu, .qat, #statusbar, #tabs, #find-panel .qb, .ctx-menu, #titlebar .tb-right')) {
    if (!e.target.closest('input, select')) e.preventDefault();
  }
  // Buiten pop-up klikken sluit pop-up
  if (App.popup && !e.target.closest('.menu') && !e.target.closest('[data-menu]')) App.closePopup();
}, true);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-cmd], [data-menu], [data-tab]');
  if (!el || el.matches('input, select, label') || el.closest('#editor')) return;
  if (el.dataset.tab) { App.showTab(el.dataset.tab); return; }
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
    if (el.closest('#ribbon') && document.body.classList.contains('ribbon-peek') && !el.dataset.menu) document.body.classList.remove('ribbon-peek');
    App.exec(el.dataset.cmd, el.dataset.arg, el);
  }
});
// Dubbelklik op opmaak kopiëren = vasthouden
document.addEventListener('dblclick', (e) => {
  const el = e.target.closest('[data-cmd="formatPainter"]');
  if (el) App.exec('formatPainter', 'sticky', el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-cmd]');
  if (!el || !el.matches('input, select')) return;
  if (el.type === 'range') return;
  App.exec(el.dataset.cmd, el.type === 'checkbox' ? el.checked : el.value, el);
  if (el.matches('#font-family, #font-size')) App.restoreRange();
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input[type=range][data-cmd]')) App.exec(el.dataset.cmd, el.value, el);
});
$('#font-size').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
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
      const clean = label.replace(new RegExp('^' + icon + '\\s*'), '');
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
    const all = collect();
    items = all.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 12);
    sel = 0;
    out.innerHTML = items.length
      ? `<div class="menu-title">Acties</div>` + items.map((it, k) => `<button data-k="${k}" class="${k === 0 ? 'kb' : ''}"><span class="i">${it.icon}</span>${App.esc(it.label)}</button>`).join('')
      : `<div class="menu-empty">Geen functie gevonden voor “${App.esc(q)}”. Druk op Enter om in het document te zoeken.</div>`;
    out.hidden = false;
  };
  const run = (it) => {
    out.hidden = true; input.value = ''; input.blur();
    if (!it) return;
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
  input.addEventListener('focus', () => { App.saveRange(); render(); });
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
    } else if (e.key === 'Escape') { input.value = ''; out.hidden = true; App.restoreRange(); }
  });
  out.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { e.preventDefault(); run(items[+b.dataset.k]); }
  });
})();

/* ---------- Zwevende mini-werkbalk ---------- */
App.minibar = {
  el: $('#minibar'),
  show() {
    const r = App.getRange();
    if (!r || r.collapsed || App.state.view === 'read' || App.state.hfEditing) return this.hide();
    const rect = r.getBoundingClientRect();
    if (!rect.width && !rect.height) return this.hide();
    this.el.hidden = false;
    const w = this.el.offsetWidth;
    let x = rect.left + rect.width / 2 - w / 2;
    let y = rect.top - 48;
    if (y < 100) y = rect.bottom + 10;
    this.el.style.left = App.clamp(x, 8, innerWidth - w - 8) + 'px';
    this.el.style.top = y + 'px';
  },
  hide() { this.el.hidden = true; },
};

/* ---------- Contextmenu (rechtsklik) ---------- */
App.ed.addEventListener('contextmenu', (e) => {
  if (e.ctrlKey || e.metaKey) return; // native menu voor spellingsuggesties
  e.preventDefault();
  const inTable = App.closest(e.target, 'td,th', App.ed);
  const img = e.target.tagName === 'IMG' ? e.target : null;
  const link = App.closest(e.target, 'a[href]', App.ed);
  const r = App.getRange();
  const hasSel = r && !r.collapsed;
  let html = '';
  html += `<button data-cmd="cut" ${hasSel ? '' : 'disabled'}><span class="i">content_cut</span> Knippen <kbd>Ctrl+X</kbd></button>`;
  html += `<button data-cmd="copy" ${hasSel ? '' : 'disabled'}><span class="i">content_copy</span> Kopiëren <kbd>Ctrl+C</kbd></button>`;
  html += `<button data-cmd="paste"><span class="i">content_paste</span> Plakken <kbd>Ctrl+V</kbd></button>`;
  html += `<button data-cmd="pasteText"><span class="i">text_fields</span> Plakken als tekst</button><hr>`;
  if (img) {
    html += `<button data-cmd="imgCrop"><span class="i">crop</span> Bijsnijden</button>`;
    html += `<button data-cmd="imgAlt"><span class="i">closed_caption</span> Alternatieve tekst…</button>`;
    html += `<button data-cmd="caption"><span class="i">subtitles</span> Bijschrift invoegen</button>`;
    html += `<button data-cmd="imgDelete"><span class="i">delete</span> Verwijderen</button><hr>`;
  }
  if (inTable) {
    html += `<button data-cmd="rowAbove"><span class="i">add_row_above</span> Rij boven invoegen</button>`;
    html += `<button data-cmd="rowBelow"><span class="i">add_row_below</span> Rij onder invoegen</button>`;
    html += `<button data-cmd="colLeft"><span class="i">add_column_left</span> Kolom links invoegen</button>`;
    html += `<button data-cmd="colRight"><span class="i">add_column_right</span> Kolom rechts invoegen</button>`;
    html += `<button data-cmd="mergeCells"><span class="i">cell_merge</span> Cellen samenvoegen</button>`;
    html += `<button data-cmd="deleteRow"><span class="i">table_rows</span> Rij verwijderen</button>`;
    html += `<button data-cmd="deleteCol"><span class="i">view_column</span> Kolom verwijderen</button><hr>`;
  }
  if (link) {
    html += `<button data-cmd="openLink"><span class="i">open_in_new</span> Koppeling openen</button>`;
    html += `<button data-cmd="link"><span class="i">edit</span> Koppeling bewerken…</button>`;
    html += `<button data-cmd="unlink"><span class="i">link_off</span> Koppeling verwijderen</button><hr>`;
  } else {
    html += `<button data-cmd="link"><span class="i">link</span> Koppeling… <kbd>Ctrl+K</kbd></button>`;
  }
  html += `<button data-cmd="newComment"><span class="i">add_comment</span> Nieuwe opmerking</button>`;
  html += `<button data-cmd="fontDialog"><span class="i">text_format</span> Lettertype… <kbd>Ctrl+D</kbd></button>`;
  html += `<button data-cmd="paragraphDialog"><span class="i">format_textdirection_l_to_r</span> Alinea…</button>`;
  html += `<hr><div class="menu-empty" style="padding:4px 10px">Tip: Ctrl + rechtsklik toont spellingsuggesties.</div>`;
  App.minibar.hide();
  App.openPopup({ x: e.clientX, y: e.clientY }, html, 'ctx-menu');
});
App.def('openLink', () => {
  const a = App.selClosest('a[href]');
  if (a) App.openLink(a.href);
});

/* ---------- Sneltoetsen ---------- */
App.shortcuts = [
  ['Algemeen', [['Opslaan', 'Ctrl+S'], ['Openen', 'Ctrl+O'], ['Nieuw document', 'Ctrl+N'], ['Afdrukken / PDF', 'Ctrl+P'], ['Functie zoeken', 'Alt+Q'], ['Lint in-/uitklappen', 'Ctrl+F1'], ['Sneltoetsen', 'F1']]],
  ['Bewerken', [['Ongedaan maken', 'Ctrl+Z'], ['Opnieuw', 'Ctrl+Y'], ['Zoeken', 'Ctrl+F'], ['Vervangen', 'Ctrl+H'], ['Ga naar', 'Ctrl+G'], ['Alles selecteren', 'Ctrl+A'], ['Koppeling', 'Ctrl+K'], ['Pagina-einde', 'Ctrl+Enter'], ['Regeleinde', 'Shift+Enter']]],
  ['Tekst', [['Vet', 'Ctrl+B'], ['Cursief', 'Ctrl+I'], ['Onderstrepen', 'Ctrl+U'], ['Groter / kleiner', 'Ctrl+Shift+> / <'], ['Subscript', 'Ctrl+='], ['Superscript', 'Ctrl+Shift+='], ['Hoofdletters wisselen', 'Shift+F3'], ['Lettertype / tekengrootte kiezen', 'Ctrl+Shift+F / P'], ['Lettertype-instellingen', 'Ctrl+D'], ['Tekenopmaak wissen', 'Ctrl+Spatie']]],
  ['Alinea', [['Links / Centreren / Rechts / Uitvullen', 'Ctrl+L / E / R / J'], ['Regelafstand enkel / 1,5 / dubbel', 'Ctrl+1 / 5 / 2'], ['Afstand vóór aan/uit', 'Ctrl+0'], ['Alineaopmaak wissen', 'Ctrl+Q'], ['Kop 1 / 2 / 3', 'Ctrl+Alt+1 / 2 / 3'], ['Normaal', 'Ctrl+Shift+N'], ['Opsomming', 'Ctrl+Shift+L'], ['Inspringing vergroten / verkleinen', 'Ctrl+M / Ctrl+Shift+M'], ['Lijstniveau', 'Tab / Shift+Tab'], ['Opmaaktekens tonen', 'Ctrl+Shift+8']]],
  ['Controleren', [['Opmerking', 'Ctrl+Alt+M'], ['Wijzigingen bijhouden', 'Ctrl+Shift+E'], ['Voetnoot', 'Ctrl+Alt+F'], ['Spelling aan/uit', 'F7']]],
];
App.def('showShortcuts', () => {
  const html = '<div class="kbd-list">' + App.shortcuts.map(([h, list]) => `<h3>${h}</h3>` + list.map(([a, k]) => `<span>${a}</span><span>${k.split(' / ').map((x) => `<kbd>${x}</kbd>`).join(' / ')}</span>`).join('')).join('') + '</div>';
  App.dialog({ title: 'Sneltoetsen', body: html, wide: true });
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const inField = e.target.matches('input, textarea, select') && !e.target.closest('#editor');
  const go = (cmd, arg) => { e.preventDefault(); App.exec(cmd, arg); };

  if (e.key === 'Escape') {
    if (App.popup) { App.closePopup(); return; }
    if ($('#backstage')) { App.exec('closeBackstage'); return; }
    if (App.state.hfEditing) { App.exec('closeHF'); return; }
    if (!$('#find-panel').hidden) { App.exec('closeFind'); return; }
    if (App.state.view === 'focus' || App.state.view === 'read') { App.exec('viewPrint'); return; }
    if (App.state.painter) { App.state.painter = null; App.ed.style.cursor = ''; App.scheduleState(); return; }
    if (App.selectedObj) { App.deselectObj && App.deselectObj(); return; }
    App.minibar.hide();
  }
  if (e.key === 'F1' && mod) return go('toggleRibbon');
  if (e.key === 'F1') return go('showShortcuts');
  if (e.key === 'F7') return go('toggleSpell');
  if (e.key === 'F3' && e.shiftKey && !mod && !e.altKey && !inField && App.inRoot(document.activeElement)) return go('cycleCase');
  if (e.altKey && k === 'q') { e.preventDefault(); $('#cmd-search').focus(); return; }
  if (!mod) return;
  // Werkt overal
  if (k === 's' && !e.shiftKey) return go('save');
  if (k === 'o') return go('openBackstage', 'open');
  if (k === 'n' && !e.shiftKey && !e.altKey) return go('newDoc');
  if (k === 'p') return go('print');
  if (inField) return;
  if (k === 'f' && !e.altKey) return go('find');
  if (k === 'h') return go('replace');
  if (k === 'z' && !e.shiftKey) return go('undo');
  if (k === 'y' || (k === 'z' && e.shiftKey)) return go('redo');
  if (!App.inRoot(document.activeElement) && document.activeElement !== document.body) return;
  if (e.altKey) {
    if (k === '1' || k === '2' || k === '3') return go('blockStyle', 'h' + k);
    if (k === 'm') return go('newComment');
    if (k === 'f') return go('footnote');
    return;
  }
  if (e.shiftKey) {
    if (e.key === '>' || e.code === 'Period') return go('growFont');
    if (e.key === '<' || e.code === 'Comma') return go('shrinkFont');
    if (k === 'n') return go('blockStyle', 'normal');
    if (k === 'l') return go('bullets');
    if (k === 'e') return go('toggleTrack');
    if (k === 'm') return go('outdent');
    if (k === 'f' || k === 'p') { e.preventDefault(); const el = $(k === 'f' ? '#font-family' : '#font-size'); App.saveRange(); el.focus(); if (el.select) el.select(); return; }
    if (e.key === '*' || e.code === 'Digit8') return go('toggleMarks');
    if (e.key === '+' || e.code === 'Equal') return go('superscript');
    return;
  }
  const map = { b: 'bold', i: 'italic', u: 'underline', e: 'justifyCenter', l: 'justifyLeft', r: 'justifyRight', j: 'justifyFull', k: 'link', d: 'fontDialog', ']': 'growFont', '[': 'shrinkFont', m: 'indent', q: 'clearParaFormat', g: 'gotoDialog' };
  if (map[k]) return go(map[k]);
  // Regelafstand zoals Word: Ctrl+1 enkel, Ctrl+2 dubbel, Ctrl+5 anderhalf; Ctrl+0 afstand vóór aan/uit
  if (e.code === 'Digit1') return go('lineSpacing', '1');
  if (e.code === 'Digit2') return go('lineSpacing', '2');
  if (e.code === 'Digit5') return go('lineSpacing', '1.5');
  if (e.code === 'Digit0') return go('toggleSpaceBefore');
  if (e.key === '=') return go('subscript');
  if (e.key === ' ') return go('clearCharFormat');
  if (e.key === 'Enter') return go('pageBreak');
  if (k === 'a' && App.inRoot(document.activeElement)) { e.preventDefault(); App.exec('selectAll'); }
});

/* ---------- Basiscommando's ---------- */
App.def('undo', () => App.history.undo());
App.def('redo', () => App.history.redo());
App.def('toggleRibbon', () => {
  document.body.classList.toggle('ribbon-collapsed');
  document.body.classList.remove('ribbon-peek');
  App.scheduleLayout();
});
document.addEventListener('mousedown', (e) => {
  if (document.body.classList.contains('ribbon-peek') && !e.target.closest('#ribbon, #tabs, .menu')) document.body.classList.remove('ribbon-peek');
});
App.def('toggleDark', () => {
  App.settings.dark = !App.settings.dark;
  document.body.classList.toggle('dark', App.settings.dark);
  App.saveSettings();
  App.scheduleState();
  App.drawRuler && App.drawRuler();
});
App.stateFns.dark = () => App.settings.dark;
App.saveSettings = () => App.store.set('settings', App.settings);
App.def('newWindow', () => window.open(location.href.split('#')[0] + '#new', '_blank'));
App.def('showAbout', () => App.dialog({
  title: 'Over Inkt',
  body: `<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><div class="logo" style="width:36px;height:36px;margin:0"><span class="i" style="font-size:24px">ink_pen</span></div>
  <div><b style="font-size:16px;font-weight:600">Inkt</b><div class="muted">Tekstverwerker · versie 1.0</div><div class="muted">Gemaakt door JJ van Schelven</div></div></div>
  <p style="line-height:1.55;margin:0 0 8px">Documenten worden opgeslagen op deze computer op deze computer. Bestanden kunnen worden geopend en opgeslagen als .docx; afdrukken of opslaan als PDF gaat via het afdrukvenster.</p>
  <p style="margin:0" class="small muted">© ${new Date().getFullYear()} JJ van Schelven. Inkt is een onafhankelijk project en is niet verbonden aan, gesponsord door of goedgekeurd door Microsoft. Microsoft Word is een merk van Microsoft Corporation.</p>`,
}));
App.def('showTour', () => App.dialog({
  title: 'Rondleiding', wide: true,
  body: `<div class="bs-cards">
    ${[['format_bold', 'Start', 'Lettertype, alinea, stijlen, zoeken en vervangen.'],
       ['table', 'Invoegen', 'Tabellen, afbeeldingen, vormen, grafieken, koppelingen, kop- en voettekst, vergelijkingen en symbolen.'],
       ['palette', 'Ontwerpen', 'Thema, lettertypen, kleuren, watermerk, paginakleur en paginaranden.'],
       ['margin', 'Indeling', 'Marges, afdrukstand, paginaformaat, kolommen, eindes en inspringing.'],
       ['menu_book', 'Verwijzingen', 'Inhoudsopgave, voetnoten, citaten, bibliografie en bijschriften.'],
       ['mail', 'Verzendlijsten', 'Enveloppen, etiketten, adreslijsten en samenvoegvelden.'],
       ['rate_review', 'Controleren', 'Spelling, woorden tellen, voorlezen, opmerkingen en wijzigingen bijhouden.'],
       ['visibility', 'Beeld', 'Leesmodus, afdruk- en webweergave, liniaal, navigatievenster en zoomen.']]
      .map(([i, t, s]) => `<div class="bs-card"><span class="i">${i}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}
  </div>`,
}));
