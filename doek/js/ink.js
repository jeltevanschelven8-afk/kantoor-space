/* =========================================================
   Doek (gemaakt door JJ van Schelven) — tekenen: pennen, potlood en markeerstiften
   in het lint, met de pen op de dia tekenen (druk, licht afvlakken), gum, inkt opnieuw
   afspelen, inkt verbergen en inkt naar vorm (vaste meetkundige regels, geen AI)
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const stage = $('#stage');
  const MM = 96 / 25.4;                                   // px per mm
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const now = () => performance.now();

  /* ---------- Opmaak (één keer in de pagina) ---------- */
  const CSS = `
#stage.tool-draw, #stage.tool-erase { touch-action: none; }
.pen-row .pen-btn .tip { box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .18); }
.pen-row .pen-btn.pk-pencil .tip { width: 10px; border-radius: 1px 1px 5px 5px; }
.pen-row .pen-btn.pk-hl .tip { width: 18px; border-radius: 1px 1px 3px 3px; opacity: .85; }
.pen-row .pen-btn.pk-hl .tip::after { left: 4px; right: 4px; }
.pen-row .pen-btn .lbl { white-space: nowrap; }
.pen-row .pen-add .i { font-size: 22px; color: var(--icon); margin: 6px 0 6px; }
.pd-pen-thk { display: flex; flex-wrap: wrap; gap: 2px; margin: 4px 0 8px; }
.pd-pen-thk button { width: 54px; height: 36px; border: 1px solid transparent; border-radius: var(--radius); background: transparent; color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 10.5px; padding: 0; }
.pd-pen-thk button:hover { background: var(--hover); }
.pd-pen-thk button.on { background: var(--on); border-color: var(--line-strong); }
.pd-pen-thk i { display: block; width: 28px; border-radius: 3px; }
.pd-ink-live, .pd-ink-replay { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; z-index: 60; }
`;
  const css = () => { if (!document.getElementById('pd-ink-css')) { const s = document.createElement('style'); s.id = 'pd-ink-css'; s.textContent = CSS; document.head.appendChild(s); } };

  /* ---------- Pennen (bewaard in de instellingen) ---------- */
  const KINDS = { pen: 'Pen', pencil: 'Potlood', hl: 'Markeerstift' };
  const ICONS = { pen: 'ink_pen', pencil: 'edit', hl: 'ink_highlighter' };
  const SIZES = { pen: [0.25, 0.35, 0.5, 0.7, 1, 2, 3.5], pencil: [0.25, 0.35, 0.5, 0.7, 1, 2, 3.5], hl: [2, 4, 6, 8, 10] };
  const DEFAULT_PENS = [
    { kind: 'pen', color: '#000000', mm: 0.5 },
    { kind: 'pen', color: '#ff0000', mm: 0.5 },
    { kind: 'pen', color: '#0070c0', mm: 0.5 },
    { kind: 'pencil', color: '#595959', mm: 1 },
    { kind: 'hl', color: '#ffff00', mm: 6 },
    { kind: 'hl', color: '#92d050', mm: 6 },
  ];
  const NEW_PEN = { pen: { color: '#000000', mm: 0.5 }, pencil: { color: '#595959', mm: 1 }, hl: { color: '#ffff00', mm: 6 } };
  // Namen van veelgebruikte kleuren (voor de knopinfo); andere kleuren als #rrggbb
  const COLOR_NAMES = {
    '#000000': 'Zwart', '#ffffff': 'Wit', '#595959': 'Donkergrijs', '#7f7f7f': 'Grijs', '#c00000': 'Donkerrood', '#ff0000': 'Rood',
    '#ffc000': 'Oranje', '#ffff00': 'Geel', '#92d050': 'Lichtgroen', '#00b050': 'Groen', '#00b0f0': 'Lichtblauw', '#0070c0': 'Blauw',
    '#002060': 'Donkerblauw', '#7030a0': 'Paars',
  };
  const colorLabel = (ref) => { const hex = App.color(ref) || '#000000'; return ref && ref[0] !== '#' ? App.colorName(ref) : COLOR_NAMES[hex] ? App.t(COLOR_NAMES[hex]) : hex.toUpperCase(); };
  const fmtMm = (mm) => App.fmtNum(mm, 2) + ' mm';
  const cleanPen = (p) => (p && KINDS[p.kind] && App.isColorRef(p.color) && Number.isFinite(+p.mm) && +p.mm > 0 && +p.mm <= 20 ? { kind: p.kind, color: p.color, mm: +p.mm } : null);
  const pens = () => {
    let list = Array.isArray(App.settings.pens) ? App.settings.pens.map(cleanPen).filter(Boolean) : [];
    if (!list.length) list = DEFAULT_PENS.map((p) => ({ ...p }));
    App.settings.pens = list.slice(0, 16);
    return App.settings.pens;
  };
  const penTitle = (p) => `${App.t(KINDS[p.kind])}: ${colorLabel(p.color)}, ${fmtMm(p.mm)}`;
  // Streekstijl van een pen: kleur vast (#rrggbb, zoals echte inkt), dikte in px
  const penStyle = (p) => ({ color: App.color(p.color) || '#000000', w: r2(p.mm * MM), alpha: p.kind === 'pencil' ? 0.85 : undefined, hl: p.kind === 'hl' || undefined });
  let lastPen = 0;

  App.fillPenRow = () => {
    const row = $('#pen-row'); if (!row) return;
    css();
    const th = App.pres ? App.theme() : null;
    row.innerHTML = pens().map((p, i) => `<button class="pen-btn pk-${p.kind}" data-cmd="drawTool" data-arg="${i}" aria-pressed="false" title="${App.esc(penTitle(p))}"><span class="tip" style="background:${App.color(p.color, th) || '#000000'}"></span><span class="lbl">${App.esc(fmtMm(p.mm))}</span></button>`).join('')
      + `<button class="pen-btn pen-add" data-cmd="penAdd" title="${App.esc(App.t('Pen toevoegen'))}"><span class="i">add</span><span class="lbl">${App.esc(App.t('Pen'))}</span></button>`;
    syncPens();
  };
  // Gekozen pen in het lint laten zien
  const syncPens = () => {
    const t = App.tool || {};
    $$('#pen-row .pen-btn[data-arg]').forEach((b) => {
      const on = t.kind === 'pen' && +b.dataset.arg === t.pen;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };
  App.on('state', syncPens);
  App.on('change', (o) => { if (o && (o.masters || o.all)) App.fillPenRow(); });   // themakleuren in de pennen bijwerken

  /* ---------- Gereedschap kiezen: Selecteren, Gum of een pen ---------- */
  // Andere werkwijzen eerst beëindigen (tekst bewerken, punten bewerken, bijsnijden) en de selectie opheffen
  const leaveModes = () => {
    if (st.edit && App.textEdit) App.textEdit.stop();
    if (st.points) { if (App.Points) App.Points.stop(); else st.points = null; }
    st.crop = null;
    stopReplay();
    if (st.sel.length) App.select([]);
  };
  let skipMenu = -1;   // het menu van deze pen was al open: een tweede klik sluit het alleen
  App.def('drawTool', (arg, el) => {
    if (arg === undefined || arg === null || arg === '' || arg === 'select') { App.setTool('select'); return; }
    if (arg === 'erase') { leaveModes(); App.setTool('erase'); return; }
    const i = parseInt(arg, 10), list = pens();
    if (!(i >= 0 && i < list.length)) return;
    const t = App.tool || {};
    const again = t.kind === 'pen' && t.pen === i;
    if (!again) leaveModes();
    if (App.settings.inkHidden) { App.settings.inkHidden = false; App.saveSettings(); App.renderStage(true); }   // tekenen = inkt weer zichtbaar
    App.setTool('pen', { pen: i });
    lastPen = i;
    // tweede klik op de gekozen pen: kleur en dikte kiezen
    if (again && el && el.closest && el.closest('#pen-row')) { if (skipMenu === i) skipMenu = -1; else openPenMenu(i, el); }
    syncPens();
  });
  window.addEventListener('mousedown', (e) => {
    const b = e.target.closest && e.target.closest('#pen-row .pen-btn[data-arg]');
    skipMenu = b && App.popup && App.popup.isConnected && App.popup.dataset.pdPen === b.dataset.arg ? +b.dataset.arg : -1;
  }, true);

  /* ---------- Menu van een pen: dikte, kleur, verwijderen ---------- */
  let menuPen = -1;
  const setPen = (i, patch) => { const p = pens()[i]; if (!p) return; Object.assign(p, patch); App.saveSettings(); App.fillPenRow(); };
  const openPenMenu = (i, anchor) => {
    const p = pens()[i]; if (!p) return;
    menuPen = i;
    const th = App.theme();
    const col = App.color(p.color, th) || '#000000';
    const thk = `<div class="cm-label">${App.esc(App.t('Dikte'))}</div><div class="pd-pen-thk">${SIZES[p.kind].map((mm) => `<button data-cmd="penWidth" data-arg="${mm}" class="${Math.abs(mm - p.mm) < 1e-6 ? 'on' : ''}" title="${App.esc(fmtMm(mm))}"><i style="height:${r1(App.clamp(mm * MM * (p.kind === 'hl' ? 0.45 : 1), 1, 14))}px;background:${col};${p.kind === 'hl' ? 'opacity:.6' : ''}"></i>${App.esc(fmtMm(mm))}</button>`).join('')}</div><div class="cm-label">${App.esc(App.t('Kleur'))}</div>`;
    const extra = pens().length > 1 ? `<hr><button class="mi" data-cmd="penRemove"><span class="i">delete</span> ${App.esc(App.t('Pen verwijderen'))}</button>` : '';
    const m = App.colorMenu(anchor, 'penColor', (c) => { if (c) setPen(i, { color: c }); }, { extra });
    if (!m) return;
    m.dataset.pdPen = String(i);
    const none = m.querySelector('.mi[data-color=""]'); if (none) none.remove();
    const cm = m.querySelector('.color-menu') || m;
    cm.insertAdjacentHTML('afterbegin', thk);
    App.positionPopup(m, anchor);
  };
  App.def('penWidth', (mm) => { const v = App.parseNum(mm); if (menuPen >= 0 && v > 0 && v <= 20) setPen(menuPen, { mm: v }); });
  App.def('penRemove', () => {
    const list = pens(); if (menuPen < 0 || menuPen >= list.length || list.length < 2) return;
    list.splice(menuPen, 1);
    const t = App.tool || {};
    if (t.kind === 'pen') { if (t.pen === menuPen) App.setTool('select'); else if (t.pen > menuPen) t.pen--; }
    menuPen = -1;
    App.saveSettings(); App.fillPenRow();
  });
  App.def('penAdd', (kind, el) => {
    if (!KINDS[kind]) {   // eerst kiezen: pen, potlood of markeerstift
      App.openPopup(el && el.getBoundingClientRect ? el : $('#pen-row .pen-add'), Object.keys(KINDS).map((k) => `<button data-cmd="penAdd" data-arg="${k}"><span class="i">${ICONS[k]}</span> ${App.esc(App.t(KINDS[k]))}</button>`).join(''));
      return;
    }
    const list = pens();
    if (list.length >= 16) { App.toast(App.t('Er kunnen niet meer pennen worden toegevoegd.'), 'info'); return; }
    list.push({ kind, ...NEW_PEN[kind] });
    App.saveSettings(); App.fillPenRow();
    App.exec('drawTool', list.length - 1);
  });
