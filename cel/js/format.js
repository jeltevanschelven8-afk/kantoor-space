/* =========================================================
   Cel (gemaakt door JJ van Schelven) — opmaak: lettertype, randen, uitlijning, getalnotatie,
   celeigenschappen, celstijlen, tabelstijlen, voorwaardelijke opmaak,
   rijen/kolommen, bladen, zoom en weergave
   ========================================================= */
'use strict';

App.FONTS = ['Aptos Narrow', 'Aptos', 'Aptos Display', 'Calibri', 'Arial', 'Arial Narrow', 'Cambria', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Merriweather', 'Source Serif 4', 'Nunito', 'Fira Code'];
App.SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

(() => {
  const NF = App.NF;
  $('#font-family').innerHTML = App.FONTS.map((n) => `<option value="${n}" style="font-family:'${n}'">${n}</option>`).join('');
  $('#sizes').innerHTML = App.SIZES.map((s) => `<option value="${s}">`).join('');

  /* ---------- Stijl toepassen op de selectie ---------- */
  const cleanStyle = (st) => { Object.keys(st).forEach((k) => { if (st[k] === undefined || st[k] === null || st[k] === false || st[k] === '') delete st[k]; }); return st; };
  App.forSelCells = (fn, opts = {}) => {
    const sh = App.sh();
    const seen = new Set();
    App.selRanges().forEach((g0) => {
      if (App.isFullCol(g0) && !opts.noFull) {
        const cmax = App.isFullRow(g0) ? Math.min(g0.c2, App.extent(sh).c + 30) : g0.c2;
        for (let c = g0.c1; c <= cmax; c++) sh.colS[c] = cleanStyle(fn({ ...(sh.colS[c] || {}) }, -1, c) || {});
        App.eachInRange(sh, { ...g0, c2: cmax }, (r, c, cell) => { cell.s = cleanStyle(fn({ ...(cell.s || {}) }, r, c) || {}); App.cleanCell(sh, r, c); });
        return;
      }
      if (App.isFullRow(g0) && !opts.noFull) {
        for (let r = g0.r1; r <= g0.r2; r++) sh.rowS[r] = cleanStyle(fn({ ...(sh.rowS[r] || {}) }, r, -1) || {});
        App.eachInRange(sh, g0, (r, c, cell) => { cell.s = cleanStyle(fn({ ...(cell.s || {}) }, r, c) || {}); App.cleanCell(sh, r, c); });
        return;
      }
      const g = App.selBounded(g0, sh);
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
        const k = r * 16384 + c; if (seen.has(k)) continue; seen.add(k);
        const cell = App.cellAt(sh, r, c);
        const base = { ...App.styleAt(sh, r, c, cell) };
        const own = { ...(cell.s || {}) };
        const res = fn(Object.assign(base, own), r, c, g);
        cell.s = cleanStyle(res || {});
        // alleen afwijkingen van kolom/rij bewaren is niet nodig: celstijl overschrijft
        App.cleanCell(sh, r, c);
      }
    });
  };
  App.activeStyle = () => { const sh = App.sh(); const s = sh.sel; return App.styleAt(sh, s.ar, s.ac); };
  const setProp = (k, v) => App.forSelCells((st) => { st[k] = v; return st; });
  const toggleProp = (k) => { const on = !App.activeStyle()[k]; setProp(k, on); };
  const autoRows = () => { const sh = App.sh(); const done = new Set(); App.selRanges().forEach((g) => { g = App.selBounded(g); for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 5000); r++) if (!done.has(r)) { done.add(r); App.autoRowHeight(sh, r); } }); };

  App.defEdit('bold', () => toggleProp('b'));
  App.defEdit('italic', () => toggleProp('i'));
  App.defEdit('underline', () => { const on = !App.activeStyle().u; setProp('u', on ? 'single' : false); });
  App.defEdit('underlineStyle', (v) => setProp('u', v));
  App.defEdit('strike', () => toggleProp('s'));
  App.defEdit('fontName', (v) => { setProp('font', v === App.DEF_FONT ? undefined : v); autoRows(); });
  App.defEdit('fontSize', (v) => {
    const n = App.parseNum(v);
    if (!(n >= 1 && n <= 409)) { App.toast('Typ een getal tussen 1 en 409.', 'error'); return false; }
    setProp('size', n === App.DEF_SIZE ? undefined : n); autoRows();
  });
  const stepSize = (dir) => {
    const cur = App.activeStyle().size || App.DEF_SIZE;
    const next = dir > 0 ? App.SIZES.find((s) => s > cur) || cur + 4 : [...App.SIZES].reverse().find((s) => s < cur) || Math.max(1, cur - 1);
    App.forSelCells((st) => { st.size = next === App.DEF_SIZE ? undefined : next; return st; });
    autoRows();
  };
  App.defEdit('growFont', () => stepSize(1));
  App.defEdit('shrinkFont', () => stepSize(-1));
  App.defEdit('fontColor', (c) => { setProp('color', c === undefined ? App.state.lastColors.fontColor : c); });
  App.defEdit('fillColor', (c) => { setProp('fill', c === undefined ? App.state.lastColors.fillColor : c); });
  App.defEdit('hAlign', (v) => { const cur = App.activeStyle().ha; setProp('ha', cur === v ? undefined : v); });
  App.defEdit('vAlign', (v) => setProp('va', v === 'bottom' ? undefined : v));
  App.defEdit('wrapText', () => { toggleProp('wrap'); autoRows(); });
  App.defEdit('indent', () => App.forSelCells((st) => { st.ind = Math.min(15, (st.ind || 0) + 1); if (!st.ha || st.ha === 'center') st.ha = st.ha || 'left'; return st; }));
  App.defEdit('outdent', () => App.forSelCells((st) => { st.ind = Math.max(0, (st.ind || 0) - 1) || undefined; return st; }));
  App.defEdit('rotateText', (deg) => { setProp('rot', +deg || undefined); autoRows(); });

  /* Toestanden voor knoppen */
  const S = App.stateFns;
  S.bold = () => !!App.activeStyle().b;
  S.italic = () => !!App.activeStyle().i;
  S.underline = () => !!App.activeStyle().u;
  S.hLeft = () => App.activeStyle().ha === 'left';
  S.hCenter = () => App.activeStyle().ha === 'center';
  S.hRight = () => App.activeStyle().ha === 'right';
  S.vTop = () => App.activeStyle().va === 'top';
  S.vMiddle = () => App.activeStyle().va === 'middle';
  S.vBottom = () => !App.activeStyle().va || App.activeStyle().va === 'bottom';
  S.wrap = () => !!App.activeStyle().wrap;
  S.merged = () => { const s = App.sh().sel; return !!App.mergeAt(App.sh(), s.ar, s.ac); };
  S.painter = () => !!App.state.painter;
  S.showFormulas = () => App.state.showFormulas;
  S.viewNormal = () => App.state.view === 'normal';
  S.viewBreaks = () => App.state.view === 'breaks';
  S.protect = () => App.sh().protect;
  S.unlocked = () => App.activeStyle().unlocked === true;

  /* Lint bijwerken bij selectie */
  App.on('selection', () => {
    const st = App.activeStyle();
    const ff = $('#font-family');
    if (document.activeElement !== ff) {
      const fam = st.font || App.DEF_FONT;
      if (![...ff.options].some((o) => o.value === fam)) { const o = document.createElement('option'); o.value = fam; o.textContent = fam; ff.appendChild(o); }
      ff.value = fam;
    }
    const fs = $('#font-size');
    if (document.activeElement !== fs) fs.value = String(st.size || App.DEF_SIZE).replace('.', ',');
    const nfSel = $('#numfmt');
    if (document.activeElement !== nfSel) {
      const cat = NF.categoryOf(st.nf);
      const map = { General: 'General', number: 'number', currency: 'currency', accounting: 'accounting', date: /dddd|mmmm/.test(st.nf || '') ? 'longDate' : 'shortDate', time: 'time', percent: 'percent', fraction: 'fraction', scientific: 'scientific', text: 'text' };
      nfSel.value = map[cat] || 'more';
      if (nfSel.value === 'more') nfSel.selectedIndex = -1;
    }
    const sh = App.sh();
    $('#chk-grid').checked = $('#chk-grid2').checked = !!sh.grid;
    $('#chk-heads').checked = $('#chk-heads2').checked = !!sh.heads;
    $('#chk-fbar').checked = !!App.settings.fbar;
    $('#chk-printgrid').checked = !!sh.page.grid;
    $('#chk-printheads').checked = !!sh.page.heads;
    $('#fit-w').value = String(sh.page.fitW || 0);
    if (document.activeElement !== $('#print-scale')) $('#print-scale').value = sh.page.scale || 100;
    $('#sb-protect').hidden = !sh.protect;
  });

  /* ---------- Randen ---------- */
  const borderColor = () => $('#border-color') ? $('#border-color').value : '#000000';
  document.addEventListener('change', (e) => { if (e.target.id === 'border-color') App.state.borderColor = e.target.value; });
  App.applyBorder = (kind, style = 'thin', color) => {
    const sh = App.sh();
    color = color || App.state.borderColor || '#000000';
    const spec = [style, color];
    App.selRanges().forEach((g0) => {
      const g = App.selBounded(g0, sh);
      const set = (r, c, side, v) => {
        const cell = App.cellAt(sh, r, c);
        const s = { ...(cell.s || {}) };
        const bd = { ...(s.bd || {}) };
        if (v) bd[side] = v; else delete bd[side];
        if (Object.keys(bd).length) s.bd = bd; else delete s.bd;
        cell.s = s;
        App.cleanCell(sh, r, c);
      };
      const clearNeighbor = (r, c, side) => { if (r < 0 || c < 0) return; const cell = App.getCell(sh, r, c); if (cell && cell.s && cell.s.bd && cell.s.bd[side]) set(r, c, side, null); };
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
        const top = r === g.r1, bot = r === g.r2, left = c === g.c1, right = c === g.c2;
        switch (kind) {
          case 'none': ['t', 'b', 'l', 'r', 'd', 'u'].forEach((s) => set(r, c, s, null));
            if (top) clearNeighbor(r - 1, c, 'b'); if (bot) clearNeighbor(r + 1, c, 't'); if (left) clearNeighbor(r, c - 1, 'r'); if (right) clearNeighbor(r, c + 1, 'l'); break;
          case 'all': set(r, c, 't', spec); set(r, c, 'b', spec); set(r, c, 'l', spec); set(r, c, 'r', spec); break;
          case 'outer': if (top) set(r, c, 't', spec); if (bot) set(r, c, 'b', spec); if (left) set(r, c, 'l', spec); if (right) set(r, c, 'r', spec); break;
          case 'thickOuter': { const t = ['medium', color]; if (top) set(r, c, 't', t); if (bot) set(r, c, 'b', t); if (left) set(r, c, 'l', t); if (right) set(r, c, 'r', t); break; }
          case 'inner': if (!bot) set(r, c, 'b', spec); if (!right) set(r, c, 'r', spec); break;
          case 'bottom': if (bot) set(r, c, 'b', spec); break;
          case 'top': if (top) set(r, c, 't', spec); break;
          case 'left': if (left) set(r, c, 'l', spec); break;
          case 'right': if (right) set(r, c, 'r', spec); break;
          case 'doubleBottom': if (bot) set(r, c, 'b', ['double', color]); break;
          case 'thickBottom': if (bot) set(r, c, 'b', ['medium', color]); break;
          case 'topBottom': if (top) set(r, c, 't', spec); if (bot) set(r, c, 'b', spec); break;
          case 'topDoubleBottom': if (top) set(r, c, 't', spec); if (bot) set(r, c, 'b', ['double', color]); break;
          default: break;
        }
      }
    });
  };
  const BORDER_ICONS = { bottom: 'border_bottom', top: 'border_top', left: 'border_left', right: 'border_right', none: 'border_clear', all: 'border_all', outer: 'border_outer', thickOuter: 'check_box_outline_blank', inner: 'border_inner', doubleBottom: 'border_bottom', thickBottom: 'border_bottom', topBottom: 'border_horizontal', topDoubleBottom: 'border_horizontal' };
  App.defEdit('border', (kind) => {
    App.applyBorder(kind);
    App.state.lastBorder = kind;
    $('#ic-border').textContent = BORDER_ICONS[kind] || 'border_bottom';
  });
  App.defEdit('borderLast', () => App.applyBorder(App.state.lastBorder || 'bottom'));
  void borderColor;

  /* ---------- Samenvoegen ---------- */
  App.addMerge = (sh, g) => {
    sh.merges = sh.merges.filter((m) => !App.rangesOverlap(m, g));
    if (g.r1 !== g.r2 || g.c1 !== g.c2) sh.merges.push({ ...g });
  };
  const doMerge = async (across) => {
    const sh = App.sh();
    const ranges = App.selRanges().map((g) => App.selBounded(g, sh));
    let lost = false;
    ranges.forEach((g) => {
      const rows = across ? Array.from({ length: g.r2 - g.r1 + 1 }, (_, k) => ({ ...g, r1: g.r1 + k, r2: g.r1 + k })) : [g];
      rows.forEach((x) => { let n = 0; App.eachInRange(sh, x, (r, c, cell) => { if (App.hasValue(cell)) n++; }); if (n > 1) lost = true; });
    });
    if (lost && !(await App.confirm('Cellen samenvoegen', 'Bij het samenvoegen blijft alleen de waarde linksboven behouden. De andere waarden worden verwijderd.', 'OK'))) return false;
    return ranges;
  };
  const mergeApply = (ranges, across, center) => {
    const sh = App.sh();
    ranges.forEach((g) => {
      const parts = across ? Array.from({ length: g.r2 - g.r1 + 1 }, (_, k) => ({ ...g, r1: g.r1 + k, r2: g.r1 + k })) : [g];
      parts.forEach((x) => {
        if (x.r1 === x.r2 && x.c1 === x.c2) return;
        App.eachInRange(sh, x, (r, c, cell) => { if (r !== x.r1 || c !== x.c1) { delete cell.v; delete cell.f; App.cleanCell(sh, r, c); } });
        App.addMerge(sh, x);
        if (center) { const cell = App.cellAt(sh, x.r1, x.c1); cell.s = { ...(cell.s || {}), ha: 'center' }; }
      });
    });
  };
  App.def('mergeCenter', async () => {
    const sh = App.sh(); const s = sh.sel;
    if (App.mergeAt(sh, s.ar, s.ac) && App.selRanges().length === 1) { App.exec('unmerge'); return; }
    const ranges = await doMerge(false); if (!ranges) return;
    App.run(() => mergeApply(ranges, false, true));
  });
  App.def('mergeAcross', async () => { const ranges = await doMerge(true); if (!ranges) return; App.run(() => mergeApply(ranges, true, false)); });
  App.def('mergeCells', async () => { const ranges = await doMerge(false); if (!ranges) return; App.run(() => mergeApply(ranges, false, false)); });
  App.defEdit('unmerge', () => {
    const sh = App.sh();
    App.selRanges().forEach((g) => { sh.merges = sh.merges.filter((m) => !App.rangesOverlap(m, g)); });
  });

  /* ---------- Getalnotatie ---------- */
  App.defEdit('numFormatPreset', (k) => {
    if (k === 'more') { setTimeout(() => App.exec('formatCells', 'number'), 0); return false; }
    const f = NF.PRESETS[k] || k;
    setProp('nf', f === 'General' ? undefined : f);
  });
  App.defEdit('numFormatCustom', (f) => setProp('nf', f));
  App.defEdit('decimals', (d) => {
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    const base = App.styleAt(sh, s.ar, s.ac, cell).nf;
    const nf = NF.adjustDecimals(base, +d, cell ? App.valueOf(cell) : 0);
    setProp('nf', nf);
  });

  /* ---------- Celeigenschappen (Ctrl+1) ---------- */
  const BSTYLES = ['thin', 'hair', 'dotted', 'dashed', 'medium', 'mediumDashed', 'thick', 'double'];
  App.def('formatCells', (tab) => {
    if (App.state.editing) App.commitEdit();
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    const st = { ...App.styleAt(sh, s.ar, s.ac, cell) };
    const sample = cell ? App.valueOf(cell) : 1234.5;
    let nf = st.nf || 'General';
    let cat = NF.categoryOf(nf);
    const borders = { t: null, b: null, l: null, r: null, h: null, v: null };
    let bstyle = 'thin', bcolor = '#000000';
    const multi = App.selRanges().length > 1 || (() => { const g = App.selRange(); return g.r1 !== g.r2 || g.c1 !== g.c2; })();
    if (st.bd) Object.keys(st.bd).forEach((k) => { borders[k] = st.bd[k]; });
    const fill = { v: st.fill || '' };
    const tabs = [['number', 'Getal'], ['align', 'Uitlijning'], ['font', 'Lettertype'], ['border', 'Rand'], ['fill', 'Opvulling'], ['protect', 'Bescherming']];
    const body = `<div class="fc-tabs">${tabs.map(([k, l]) => `<button data-fct="${k}">${l}</button>`).join('')}</div>
      <div class="fc-pane" data-fcp="number"><div class="nf-layout"><div class="nf-cats">${NF.CATEGORIES.map(([id, l]) => `<button data-cat="${id}">${l}</button>`).join('')}</div>
        <div><div class="muted small">Voorbeeld</div><div class="nf-sample" id="nf-sample"></div>
        <div id="nf-opts"></div>
        <label class="field" style="margin-top:8px"><span>Notatiecode</span><input id="nf-code" spellcheck="false" style="font-family:Consolas,monospace"></label>
        <div class="nf-list" id="nf-list"></div></div></div></div>
      <div class="fc-pane" data-fcp="align"><div class="fields-2">
        <label class="field"><span>Horizontaal</span><select id="al-h"><option value="">Standaard</option><option value="left">Links (inspringen)</option><option value="center">Centreren</option><option value="right">Rechts (inspringen)</option><option value="fill">Doorvoeren</option><option value="justify">Uitvullen</option><option value="centerContinuous">Centreren over selectie</option></select></label>
        <label class="field"><span>Verticaal</span><select id="al-v"><option value="top">Boven</option><option value="middle">Midden</option><option value="bottom">Onder</option></select></label>
        <label class="field"><span>Inspringen</span><input type="number" id="al-ind" min="0" max="15"></label>
        <label class="field"><span>Stand (graden, -90 t/m 90)</span><input type="number" id="al-rot" min="-90" max="90"></label></div>
        <div class="checks"><label><input type="checkbox" id="al-wrap"> Terugloop</label><label><input type="checkbox" id="al-merge"> Cellen samenvoegen</label></div></div>
      <div class="fc-pane" data-fcp="font"><div class="fields-3">
        <label class="field"><span>Lettertype</span><select id="ft-fam">${App.FONTS.map((n) => `<option>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Tekenstijl</span><select id="ft-sty"><option value="">Standaard</option><option value="i">Cursief</option><option value="b">Vet</option><option value="bi">Vet cursief</option></select></label>
        <label class="field"><span>Grootte</span><input id="ft-size" list="sizes"></label>
        <label class="field"><span>Onderstrepen</span><select id="ft-u"><option value="">Geen</option><option value="single">Enkel</option><option value="double">Dubbel</option></select></label>
        <label class="field"><span>Kleur</span><input type="color" id="ft-color"></label></div>
        <div class="checks"><label><input type="checkbox" id="ft-s"> Doorhalen</label></div>
        <div class="preview-box" id="ft-prev" style="height:60px">AaBbCcYyZz</div></div>
      <div class="fc-pane" data-fcp="border"><div class="border-editor"><div>
        <div class="muted small" style="margin-bottom:4px">Stijl</div><div class="border-styles">${BSTYLES.map((b) => `<button data-bs="${b}" title="${b}"><i style="border-top:${b === 'double' ? '3px double' : (b === 'thick' ? '3px solid' : b === 'medium' || b === 'mediumDashed' ? '2px ' + (b === 'medium' ? 'solid' : 'dashed') : '1px ' + (b === 'dotted' || b === 'hair' ? 'dotted' : b === 'dashed' ? 'dashed' : 'solid'))}"></i></button>`).join('')}</div>
        <label class="field" style="margin-top:10px"><span>Kleur</span><input type="color" id="bd-color" value="#000000"></label></div>
        <div><div class="border-presets"><button class="btn small" data-bp="none">Geen</button><button class="btn small" data-bp="outline">Omtrek</button>${multi ? '<button class="btn small" data-bp="inside">Binnen</button>' : ''}</div>
        <div class="border-box" id="bd-box"><span class="bb t" data-e="t"></span><span class="bb b" data-e="b"></span><span class="bb l" data-e="l"></span><span class="bb r" data-e="r"></span><div class="bb-text">Tekst</div></div>
        <p class="muted small">Klik op een rand om hem aan of uit te zetten.</p></div></div></div>
      <div class="fc-pane" data-fcp="fill"><div class="muted small">Achtergrondkleur</div>
        <div class="color-menu" style="width:auto;padding:4px 0"><div class="cm-grid" id="fl-grid" style="max-width:300px"></div></div>
        <div class="row" style="gap:10px;margin-top:8px"><button class="btn small" id="fl-none">Geen kleur</button><label class="chk">Meer kleuren <input type="color" id="fl-more"></label></div>
        <div class="preview-box" id="fl-prev" style="height:50px;margin-top:10px"></div></div>
      <div class="fc-pane" data-fcp="protect"><label class="chk" style="font-size:13px"><input type="checkbox" id="pr-lock"> Vergrendeld</label>
        <p class="muted small" style="line-height:1.5">Het vergrendelen van cellen heeft pas effect als het blad is beveiligd (Controleren › Blad beveiligen).</p></div>`;
    App.dialog({
      title: 'Celeigenschappen', wide: true, body,
      onOpen: (d) => {
        const show = (k) => { d.$$('[data-fct]').forEach((b) => b.classList.toggle('on', b.dataset.fct === k)); d.$$('[data-fcp]').forEach((p) => { p.hidden = p.dataset.fcp !== k; }); };
        d.$('.fc-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-fct]'); if (b) show(b.dataset.fct); });
        show(tab && typeof tab === 'string' ? tab : 'number');
        // getal
        const sampleEl = d.$('#nf-sample'), code = d.$('#nf-code'), list = d.$('#nf-list'), opts = d.$('#nf-opts');
        const upd = () => { const f = NF.format(typeof sample === 'number' || typeof sample === 'string' ? sample : 1234.5, nf); sampleEl.textContent = f.text || ' '; sampleEl.style.color = f.color || ''; code.value = nf; };
        const decOpts = (withSep, withSym) => {
          const m = /\.(0+)/.exec(nf.split(';')[0]); const dec = m ? m[1].length : 0;
          opts.innerHTML = `<div class="fields-2"><label class="field"><span>Decimalen</span><input type="number" id="nf-dec" min="0" max="30" value="${dec}"></label>${withSep ? `<label class="chk" style="margin-top:18px"><input type="checkbox" id="nf-sep" ${/#,##/.test(nf) ? 'checked' : ''}> Scheidingsteken voor duizendtallen (.)</label>` : ''}${withSym ? `<label class="field"><span>Symbool</span><select id="nf-sym"><option value="€">€</option><option value="$">$</option><option value="£">£</option><option value="">Geen</option></select></label>` : ''}</div>`;
          const rebuild = () => {
            const dd = Math.max(0, Math.min(30, +d.$('#nf-dec').value || 0));
            const decs = dd ? '.' + '0'.repeat(dd) : '';
            if (cat === 'number') nf = (d.$('#nf-sep') && d.$('#nf-sep').checked ? '#,##0' : '0') + decs;
            else if (cat === 'percent') nf = '0' + decs + '%';
            else if (cat === 'scientific') nf = '0' + decs + 'E+00';
            else if (cat === 'currency') { const sym = d.$('#nf-sym').value; nf = sym ? `"${sym}" #,##0${decs};"${sym}" -#,##0${decs}` : `#,##0${decs};-#,##0${decs}`; }
            else if (cat === 'accounting') { const sym = d.$('#nf-sym').value; const sy = sym ? `"${sym}" ` : ''; nf = `_ ${sy}* #,##0${decs}_ ;_ ${sy}* -#,##0${decs}_ ;_ ${sy}* "-"${dd ? '?'.repeat(dd) : ''}_ ;_ @_ `; }
            upd(); renderList();
          };
          opts.querySelectorAll('input,select').forEach((x) => x.addEventListener('input', rebuild));
          const sym = d.$('#nf-sym'); if (sym) { const m2 = /"(.)"/.exec(nf); sym.value = m2 ? m2[1] : '€'; }
        };
        const renderList = () => {
          const items = (NF.CATEGORIES.find(([id]) => id === cat) || [, , []])[2];
          const all = cat === 'custom' ? Array.from(new Set(NF.CATEGORIES.flatMap((x) => x[2]))) : items;
          list.innerHTML = all.map((f) => `<button data-f="${App.esc(f)}" class="${f === nf ? 'on' : ''}">${App.esc(f)}</button>`).join('');
          list.hidden = !all.length || ['number', 'percent', 'scientific', 'General'].includes(cat);
        };
        const setCat = (c) => {
          cat = c;
          d.$$('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === c));
          if (c === 'General') nf = 'General';
          else if (NF.categoryOf(nf) !== c && c !== 'custom') nf = (NF.CATEGORIES.find(([id]) => id === c) || [, , ['General']])[2][c === 'number' ? 1 : 0] || nf;
          if (['number', 'percent', 'scientific'].includes(c)) decOpts(c === 'number', false);
          else if (c === 'currency' || c === 'accounting') decOpts(false, true);
          else opts.innerHTML = c === 'General' ? '<p class="muted small">Cellen met de standaardnotatie hebben geen specifieke getalnotatie.</p>' : c === 'text' ? '<p class="muted small">Cellen met tekstnotatie worden weergegeven zoals ze zijn ingevoerd, ook als er een getal in staat.</p>' : '';
          upd(); renderList();
        };
        d.$('.nf-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) setCat(b.dataset.cat); });
        list.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { nf = b.dataset.f; upd(); renderList(); } });
        code.addEventListener('input', () => { nf = code.value || 'General'; const f = NF.format(typeof sample === 'number' ? sample : 1234.5, nf); sampleEl.textContent = f.text; });
        setCat(cat);
        // uitlijning
        d.$('#al-h').value = st.ha || ''; d.$('#al-v').value = st.va || 'bottom'; d.$('#al-ind').value = st.ind || 0; d.$('#al-rot').value = st.rot || 0;
        d.$('#al-wrap').checked = !!st.wrap; d.$('#al-merge').checked = !!App.mergeAt(sh, s.ar, s.ac);
        // lettertype
        d.$('#ft-fam').value = st.font || App.DEF_FONT; d.$('#ft-sty').value = (st.b ? 'b' : '') + (st.i ? 'i' : '') === 'ib' ? 'bi' : (st.b ? 'b' : '') + (st.i ? 'i' : '');
        d.$('#ft-size').value = String(st.size || App.DEF_SIZE).replace('.', ','); d.$('#ft-u').value = st.u || ''; d.$('#ft-color').value = st.color || '#000000'; d.$('#ft-s').checked = !!st.s;
        const fprev = () => { const p = d.$('#ft-prev'); const sty = d.$('#ft-sty').value; p.style.fontFamily = `"${d.$('#ft-fam').value}", Calibri, sans-serif`; p.style.fontWeight = sty.includes('b') ? 700 : 400; p.style.fontStyle = sty.includes('i') ? 'italic' : 'normal'; p.style.fontSize = (App.parseNum(d.$('#ft-size').value) || 11) * 1.33 + 'px'; p.style.color = d.$('#ft-color').value; p.style.textDecoration = [d.$('#ft-u').value ? 'underline' + (d.$('#ft-u').value === 'double' ? ' double' : '') : '', d.$('#ft-s').checked ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'; };
        d.$('[data-fcp=font]').addEventListener('input', fprev); d.$('[data-fcp=font]').addEventListener('change', fprev); fprev();
        // rand
        const box = d.$('#bd-box');
        const drawBox = () => {
          box.querySelectorAll('[data-e]').forEach((x) => { const v = borders[x.dataset.e]; x.classList.toggle('on', !!v); x.style.color = v ? v[1] : ''; });
          d.$$('[data-bs]').forEach((b) => b.classList.toggle('on', b.dataset.bs === bstyle));
        };
        d.$('.border-styles').addEventListener('click', (e) => { const b = e.target.closest('[data-bs]'); if (b) { bstyle = b.dataset.bs; drawBox(); } });
        d.$('#bd-color').addEventListener('input', (e) => { bcolor = e.target.value; });
        box.addEventListener('click', (e) => { const x = e.target.closest('[data-e]'); if (!x) return; const k = x.dataset.e; borders[k] = borders[k] ? null : [bstyle, bcolor]; drawBox(); });
        d.$('.border-presets').addEventListener('click', (e) => {
          const b = e.target.closest('[data-bp]'); if (!b) return;
          if (b.dataset.bp === 'none') Object.keys(borders).forEach((k) => { borders[k] = null; });
          if (b.dataset.bp === 'outline') ['t', 'b', 'l', 'r'].forEach((k) => { borders[k] = [bstyle, bcolor]; });
          if (b.dataset.bp === 'inside') { borders.h = [bstyle, bcolor]; borders.v = [bstyle, bcolor]; }
          drawBox();
        });
        drawBox();
        // opvulling
        const grid = d.$('#fl-grid');
        const cols = App.PALETTE_BASE.concat(...[0.8, 0.6, 0.4, -0.25, -0.5].map((t) => App.PALETTE_BASE.map((c, i) => (i === 0 ? App.mix('#ffffff', -Math.abs(t) * 0.5) : i === 1 ? App.mix('#000000', Math.abs(t)) : App.mix(c, t)))), App.PALETTE_STD);
        grid.innerHTML = cols.map((c) => `<button data-color="${c}" style="background:${c}"></button>`).join('');
        const fprev2 = () => { d.$('#fl-prev').style.background = fill.v || '#fff'; };
        grid.addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) { fill.v = b.dataset.color; fprev2(); } });
        d.$('#fl-none').addEventListener('click', () => { fill.v = ''; fprev2(); });
        d.$('#fl-more').addEventListener('input', (e) => { fill.v = e.target.value; fprev2(); });
        fprev2();
        d.$('#pr-lock').checked = st.unlocked !== true;
        d._init = { st: JSON.stringify(st) };
      },
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const sty = d.$('#ft-sty').value;
          const size = App.parseNum(d.$('#ft-size').value);
          const vals = {
            nf: nf === 'General' ? undefined : nf,
            ha: d.$('#al-h').value || undefined, va: d.$('#al-v').value === 'bottom' ? undefined : d.$('#al-v').value,
            ind: +d.$('#al-ind').value || undefined, rot: App.clamp(+d.$('#al-rot').value || 0, -90, 90) || undefined, wrap: d.$('#al-wrap').checked || undefined,
            font: d.$('#ft-fam').value === App.DEF_FONT ? undefined : d.$('#ft-fam').value, b: sty.includes('b') || undefined, i: sty.includes('i') || undefined,
            size: size && size !== App.DEF_SIZE ? size : undefined, u: d.$('#ft-u').value || undefined, color: d.$('#ft-color').value === '#000000' ? (st.color && st.color !== '#000000' ? undefined : st.color) : d.$('#ft-color').value, s: d.$('#ft-s').checked || undefined,
            fill: fill.v || undefined, unlocked: d.$('#pr-lock').checked ? undefined : true,
          };
          const wantMerge = d.$('#al-merge').checked;
          App.run(() => {
            App.forSelCells((x, r, c, g) => {
              Object.assign(x, vals);
              if (g) {
                const bd = {};
                const top = r === g.r1, bot = r === g.r2, left = c === g.c1, right = c === g.c2;
                const set = (k, v) => { if (v) bd[k] = v; };
                set('t', top ? borders.t : borders.h); set('b', bot ? borders.b : borders.h);
                set('l', left ? borders.l : borders.v); set('r', right ? borders.r : borders.v);
                x.bd = Object.keys(bd).length ? bd : undefined;
              }
              return x;
            });
            const sh2 = App.sh();
            if (wantMerge) App.selRanges().forEach((g) => App.addMerge(sh2, App.selBounded(g)));
            else App.selRanges().forEach((g) => { sh2.merges = sh2.merges.filter((m) => !App.rangesOverlap(m, g)); });
            autoRows();
          });
        },
      }],
    });
  });

  /* ---------- Celstijlen ---------- */
  App.CELL_STYLES = [
    ['Goed, slecht en neutraal', [['Standaard', {}], ['Goed', { fill: '#c6efce', color: '#006100' }], ['Slecht', { fill: '#ffc7ce', color: '#9c0006' }], ['Neutraal', { fill: '#ffeb9c', color: '#9c5700' }]]],
    ['Gegevens en model', [['Berekening', { fill: '#f2f2f2', color: '#fa7d00', b: true, bd: { t: ['thin', '#7f7f7f'], b: ['thin', '#7f7f7f'], l: ['thin', '#7f7f7f'], r: ['thin', '#7f7f7f'] } }], ['Controlecel', { fill: '#a5a5a5', color: '#ffffff', b: true, bd: { t: ['double', '#3f3f3f'], b: ['double', '#3f3f3f'], l: ['double', '#3f3f3f'], r: ['double', '#3f3f3f'] } }], ['Invoer', { fill: '#ffcc99', color: '#3f3f76', bd: { t: ['thin', '#7f7f7f'], b: ['thin', '#7f7f7f'], l: ['thin', '#7f7f7f'], r: ['thin', '#7f7f7f'] } }], ['Uitvoer', { fill: '#f2f2f2', color: '#3f3f3f', b: true, bd: { t: ['thin', '#3f3f3f'], b: ['thin', '#3f3f3f'], l: ['thin', '#3f3f3f'], r: ['thin', '#3f3f3f'] } }], ['Notitie', { fill: '#ffffcc', bd: { t: ['thin', '#b2b2b2'], b: ['thin', '#b2b2b2'], l: ['thin', '#b2b2b2'], r: ['thin', '#b2b2b2'] } }], ['Waarschuwing', { color: '#ff0000' }], ['Verklarende tekst', { color: '#7f7f7f', i: true }], ['Gekoppelde cel', { color: '#fa7d00', bd: { b: ['double', '#ff8001'] } }]]],
    ['Titels en koppen', [['Titel', { size: 18, color: '#0e2841', font: 'Aptos Display' }], ['Kop 1', { size: 15, b: true, color: '#0e2841', bd: { b: ['thick', '#156082'] } }], ['Kop 2', { size: 13, b: true, color: '#0e2841', bd: { b: ['thick', '#a6c9ec'] } }], ['Kop 3', { b: true, color: '#0e2841', bd: { b: ['medium', '#94dcf8'] } }], ['Kop 4', { b: true, color: '#0e2841' }], ['Totaal', { b: true, bd: { t: ['thin', '#156082'], b: ['double', '#156082'] } }]]],
    ['Themacelstijlen', ['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'].flatMap((c, i) => [[`20% - Accent${i + 1}`, { fill: App.mix(c, 0.8) }]]).concat(['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'].flatMap((c, i) => [[`60% - Accent${i + 1}`, { fill: App.mix(c, 0.4), color: '#ffffff' }]])).concat(['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'].map((c, i) => [`Accent${i + 1}`, { fill: c, color: '#ffffff' }]))],
    ['Getalnotatie', [['Komma', { nf: '#,##0.00' }], ['Komma [0]', { nf: '#,##0' }], ['Valuta', { nf: NF.PRESETS.accounting }], ['Procent', { nf: '0%' }]]],
  ];
  App.menuBuilders['m-cellstyles'] = () => App.CELL_STYLES.map(([h, list]) => `<div class="menu-title">${h}</div><div class="cs-grid">${list.map(([n, st], k) => `<button data-cmd="cellStyle" data-arg="${App.esc(h)}|${k}" style="${st.fill ? 'background:' + st.fill + ';' : ''}${st.color ? 'color:' + st.color + ';' : ''}${st.b ? 'font-weight:700;' : ''}${st.i ? 'font-style:italic;' : ''}${st.size ? 'font-size:' + Math.min(16, st.size) + 'px;' : ''}${st.bd && st.bd.b ? 'border-bottom:2px ' + (st.bd.b[0] === 'double' ? 'double' : 'solid') + ' ' + st.bd.b[1] + ';' : ''}">${n}</button>`).join('')}</div>`).join('');
  App.defEdit('cellStyle', (arg) => {
    const [h, k] = arg.split('|');
    const grp = App.CELL_STYLES.find(([x]) => x === h);
    const st = grp && grp[1][+k] && grp[1][+k][1];
    if (!st) return false;
    if (!Object.keys(st).length) { App.forSelCells((x) => ({ nf: x.nf })); return; }
    App.forSelCells((x) => {
      if (h !== 'Getalnotatie') ['fill', 'color', 'b', 'i', 'bd', 'size', 'font'].forEach((p) => { delete x[p]; });
      return Object.assign(x, JSON.parse(JSON.stringify(st)));
    });
    autoRows();
  });

  /* ---------- Opmaken als tabel ---------- */
  const TS_COLORS = ['#7f7f7f', '#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'];
  const tableStyle = (kind, c) => {
    if (kind === 'light') return { head: { b: true, bd: { b: ['thin', c] } }, band: App.mix(c, 0.85), lines: c, topLine: true };
    if (kind === 'medium') return { head: { b: true, fill: c, color: '#ffffff' }, band: App.mix(c, 0.8), lines: null, outer: App.mix(c, 0.4) };
    return { head: { b: true, fill: App.mix(c, -0.5), color: '#ffffff' }, band: App.mix(c, 0.6), band2: App.mix(c, 0.75), dark: true };
  };
  App.menuBuilders['m-tablestyles'] = () => ['light', 'medium', 'dark'].map((kind) => `<div class="menu-title">${{ light: 'Licht', medium: 'Gemiddeld', dark: 'Donker' }[kind]}</div><div class="ts-grid">${TS_COLORS.map((c, i) => {
    const t = tableStyle(kind, c);
    const row = (k) => `<tr>${[0, 1, 2, 3].map(() => `<td style="background:${k === 0 ? (t.head.fill || '#fff') : k % 2 ? t.band : (t.band2 || '#fff')};${k === 0 && t.head.bd ? 'border-bottom:1px solid ' + c : ''}"></td>`).join('')}</tr>`;
    return `<button data-cmd="formatAsTable" data-arg="${kind}${i}" title="${{ light: 'Licht', medium: 'Gemiddeld', dark: 'Donker' }[kind]} ${i + 1}"><table>${[0, 1, 2, 3, 4].map(row).join('')}</table></button>`;
  }).join('')}</div>`).join('');
  App.def('formatAsTable', (arg) => {
    const sh = App.sh(); const s = sh.sel;
    let g = App.selRange();
    if (g.r1 === g.r2 && g.c1 === g.c2) g = App.currentRegion(sh, s.ar, s.ac) || g;
    g = App.selBounded(g, sh);
    const m = /^(light|medium|dark)(\d)$/.exec(arg || '') || ['', 'medium', '1'];
    App.dialog({
      title: 'Opmaken als tabel',
      body: `<label class="field"><span>Waar staan de gegevens voor de tabel?</span><input id="tb-ref" value="${App.absRangeStr(g)}"></label><label class="chk"><input type="checkbox" id="tb-head" ${typeof App.valueOf(App.getCell(sh, g.r1, g.c1)) === 'string' ? 'checked' : ''}> Tabel met kopteksten</label>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const rg = App.parseRange(d.$('#tb-ref').value);
          if (!rg) { App.toast('Ongeldig bereik', 'error'); return false; }
          const headers = d.$('#tb-head').checked;
          App.run(() => {
            let tg = rg;
            if (!headers) {
              App.shiftAxis(sh, 'row', tg.r1, 1, { c1: tg.c1, c2: tg.c2 });
              for (let c = tg.c1; c <= tg.c2; c++) App.cellAt(sh, tg.r1, c).v = 'Kolom' + (c - tg.c1 + 1);
              tg = { ...tg, r2: tg.r2 + 1 };
            }
            const t = tableStyle(m[1], TS_COLORS[+m[2]] || TS_COLORS[1]);
            const color = TS_COLORS[+m[2]] || TS_COLORS[1];
            for (let r = tg.r1; r <= tg.r2; r++) for (let c = tg.c1; c <= tg.c2; c++) {
              const cell = App.cellAt(sh, r, c);
              const st = { ...(cell.s || {}) };
              delete st.fill; delete st.bd;
              if (r === tg.r1) Object.assign(st, JSON.parse(JSON.stringify(t.head)));
              else {
                const k = r - tg.r1;
                if (k % 2 === 1) st.fill = t.band; else if (t.band2) st.fill = t.band2;
                if (t.lines) st.bd = { ...(st.bd || {}), b: ['thin', App.mix(color, 0.5)] };
                if (t.outer) st.bd = { ...(st.bd || {}), b: ['thin', t.outer], t: ['thin', t.outer] };
                if (t.dark) st.color = st.color || '#000000';
              }
              if (r === tg.r2 && t.topLine) st.bd = { ...(st.bd || {}), b: ['thin', color] };
              if (r === tg.r1 && t.topLine) st.bd = { ...(st.bd || {}), t: ['thin', color] };
              cell.s = st;
            }
            sh.filter = { r: tg.r1, r2: tg.r2, c1: tg.c1, c2: tg.c2, crit: {} };
            App.setSel(tg, tg.r1, tg.c1);
          });
        },
      }],
    });
  });

  /* ---------- Opmaak kopiëren ---------- */
  App.def('formatPainter', (sticky) => {
    if (App.state.painter && sticky !== 'sticky') { App.state.painter = null; App.scheduleState(); return; }
    const sh = App.sh();
    const g = App.selBounded(App.selRange());
    const styles = [];
    for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 200); r++) { const row = []; for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 100); c++) row.push(JSON.parse(JSON.stringify(App.styleAt(sh, r, c)))); styles.push(row); }
    const merges = sh.merges.filter((m) => m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2).map((m) => ({ r1: m.r1 - g.r1, c1: m.c1 - g.c1, r2: m.r2 - g.r1, c2: m.c2 - g.c1 }));
    App.state.painter = { styles, merges, sticky: sticky === 'sticky' };
    App.scheduleState();
    App.toast(sticky === 'sticky' ? 'Opmaak kopiëren staat vast. Druk op Esc om te stoppen.' : 'Klik op de cellen die deze opmaak moeten krijgen.', 'format_paint');
  });
  App.applyPainter = () => {
    const p = App.state.painter; if (!p) return;
    App.run(() => {
      const sh = App.sh();
      const g = App.selRange();
      const H = p.styles.length, W = p.styles[0].length;
      const tg = (g.r1 === g.r2 && g.c1 === g.c2) ? { r1: g.r1, c1: g.c1, r2: g.r1 + H - 1, c2: g.c1 + W - 1 } : App.selBounded(g);
      for (let r = tg.r1; r <= tg.r2; r++) for (let c = tg.c1; c <= tg.c2; c++) {
        const st = p.styles[(r - tg.r1) % H][(c - tg.c1) % W];
        const cell = App.cellAt(sh, r, c);
        cell.s = JSON.parse(JSON.stringify(st));
        App.cleanCell(sh, r, c);
      }
      sh.merges = sh.merges.filter((m) => !App.rangesOverlap(m, tg));
      p.merges.forEach((m) => { if (tg.r1 + m.r2 <= tg.r2 && tg.c1 + m.c2 <= tg.c2) sh.merges.push({ r1: tg.r1 + m.r1, c1: tg.c1 + m.c1, r2: tg.r1 + m.r2, c2: tg.c1 + m.c2 }); });
      App.setSel(tg, tg.r1, tg.c1);
    });
    if (!p.sticky) App.state.painter = null;
    App.scheduleState();
  };

  /* ---------- Voorwaardelijke opmaak ---------- */
  App._cfVer = 0;
  App.on('change', () => { App._cfVer++; });
  App.on('sheet', () => { App._cfVer++; });
  const CF_STYLES = [
    ['Lichtrode opvulling met donkerrode tekst', { fill: '#ffc7ce', color: '#9c0006' }],
    ['Gele opvulling met donkergele tekst', { fill: '#ffeb9c', color: '#9c5700' }],
    ['Groene opvulling met donkergroene tekst', { fill: '#c6efce', color: '#006100' }],
    ['Lichtrode opvulling', { fill: '#ffc7ce' }],
    ['Rode tekst', { color: '#9c0006' }],
    ['Vette tekst', { b: true }],
  ];
  App.cfPrepare = (sh) => {
    if (!sh.cf.length) return null;
    if (sh._cf && sh._cf.ver === App._cfVer) return sh._cf;
    const rules = sh.cf.map((rule) => {
      const vals = [];
      if (['bar', 'scale', 'icons', 'top', 'bottom', 'above', 'below', 'dup', 'uniq'].includes(rule.type)) {
        rule.ranges.forEach((g) => App.eachInRange(sh, App.selBounded(g, sh), (r, c, cell) => { const v = App.valueOf(cell); if (v !== null && v !== undefined && v !== '') vals.push(v); }));
      }
      const nums = vals.filter((v) => typeof v === 'number').sort((a, b) => a - b);
      const prep = { rule, min: nums[0], max: nums[nums.length - 1], avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0 };
      if (rule.type === 'scale') prep.mid = nums.length ? nums[Math.floor((nums.length - 1) / 2)] : 0;
      if (rule.type === 'top' || rule.type === 'bottom') {
        const n = rule.pct ? Math.max(1, Math.round(nums.length * rule.rank / 100)) : rule.rank || 10;
        prep.thr = rule.type === 'top' ? nums[Math.max(0, nums.length - n)] : nums[Math.min(nums.length - 1, n - 1)];
      }
      if (rule.type === 'dup' || rule.type === 'uniq') {
        const cnt = new Map(); vals.forEach((v) => { const k = typeof v === 'string' ? v.toLowerCase() : v; cnt.set(k, (cnt.get(k) || 0) + 1); });
        prep.cnt = cnt;
      }
      const num = (x) => { if (typeof x === 'string' && x[0] === '=') { const v = App.F.evalText(App.F.toCanon(x.slice(1)), { sh, r: 0, c: 0 }); return typeof v === 'number' ? v : App.NF.parseInput(String(v)).v; } const p = App.NF.parseInput(String(x)); return typeof p.v === 'number' ? p.v : x; };
      prep.v1 = rule.v1 !== undefined ? num(rule.v1) : undefined;
      prep.v2 = rule.v2 !== undefined ? num(rule.v2) : undefined;
      return prep;
    });
    const mixc = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); };
    const res = {
      ver: App._cfVer, any: true,
      at: (r, c, v) => {
        let out = null;
        for (const p of rules) {
          const rule = p.rule;
          if (!rule.ranges.some((g) => App.inRange(g, r, c))) continue;
          if (v === null || v === undefined || v === '') continue;
          let hit = false;
          const n = typeof v === 'number' ? v : null;
          switch (rule.type) {
            case 'gt': hit = n !== null && typeof p.v1 === 'number' ? n > p.v1 : typeof v === 'string' && typeof p.v1 === 'string' && v.toLowerCase() > p.v1.toLowerCase(); break;
            case 'lt': hit = n !== null && typeof p.v1 === 'number' ? n < p.v1 : false; break;
            case 'between': hit = n !== null && n >= Math.min(p.v1, p.v2) && n <= Math.max(p.v1, p.v2); break;
            case 'eq': hit = typeof p.v1 === 'number' ? n === p.v1 : String(v).toLowerCase() === String(p.v1).toLowerCase(); break;
            case 'text': hit = String(App.NF.format(v).text).toLowerCase().includes(String(rule.v1 || '').toLowerCase()); break;
            case 'dup': case 'uniq': { const k = typeof v === 'string' ? v.toLowerCase() : v; const cnt = p.cnt.get(k) || 0; hit = rule.type === 'dup' ? cnt > 1 : cnt === 1; break; }
            case 'top': hit = n !== null && n >= p.thr; break;
            case 'bottom': hit = n !== null && n <= p.thr; break;
            case 'above': hit = n !== null && n > p.avg; break;
            case 'below': hit = n !== null && n < p.avg; break;
            case 'formula': { const fv = App.F.evalText(App.F.shift(rule.f, r - rule.ranges[0].r1, c - rule.ranges[0].c1), { sh, r, c }); hit = fv === true || (typeof fv === 'number' && fv !== 0); break; }
            case 'icons': if (n !== null) {
              out = out || {};
              const f = p.max === p.min ? 1 : (n - p.min) / (p.max - p.min);
              const idx = f >= 0.67 ? 0 : f >= 0.33 ? 1 : 2;
              out.icon = { set: rule.set, idx: rule.reverse ? 2 - idx : idx };
            } continue;
            case 'bar': if (n !== null && p.max !== p.min || n !== null) { out = out || {}; const lo = Math.min(0, p.min), span = (p.max - lo) || 1; out.bar = { pct: App.clamp((n - lo) / span, 0, 1), color: rule.color }; } continue;
            case 'scale': if (n !== null) {
              out = out || {};
              const cs = rule.colors;
              if (cs.length === 2) out.fill = mixc(cs[0], cs[1], p.max === p.min ? 0.5 : (n - p.min) / (p.max - p.min));
              else out.fill = n <= p.mid ? mixc(cs[0], cs[1], p.mid === p.min ? 1 : (n - p.min) / (p.mid - p.min)) : mixc(cs[1], cs[2], p.max === p.mid ? 0 : (n - p.mid) / (p.max - p.mid));
            } continue;
            default: break;
          }
          if (hit) { out = out || {}; Object.keys(rule.style || {}).forEach((k) => { if (out[k] === undefined) out[k] = rule.style[k]; }); }
        }
        return out;
      },
    };
    sh._cf = res;
    return res;
  };
  const CF_LABELS = { gt: 'Cellen opmaken die GROTER ZIJN DAN:', lt: 'Cellen opmaken die KLEINER ZIJN DAN:', between: 'Cellen opmaken die TUSSEN de volgende waarden liggen:', eq: 'Cellen opmaken die GELIJK ZIJN AAN:', text: 'Cellen opmaken die de volgende tekst BEVATTEN:', dup: 'Cellen opmaken die het volgende bevatten:', top: 'Cellen opmaken die tot de BOVENSTE behoren:', bottom: 'Cellen opmaken die tot de ONDERSTE behoren:', above: 'Cellen opmaken die BOVEN HET GEMIDDELDE liggen', below: 'Cellen opmaken die ONDER HET GEMIDDELDE liggen' };
  const CF_TITLES = { gt: 'Groter dan', lt: 'Kleiner dan', between: 'Tussen', eq: 'Gelijk aan', text: 'Tekst die bevat', dup: 'Dubbele waarden', top: 'Bovenste 10 items', bottom: 'Onderste 10 items', above: 'Boven gemiddelde', below: 'Onder gemiddelde' };
  App.def('cfDialog', (type) => {
    const sh = App.sh();
    const ranges = App.selRanges().map((g) => App.selBounded(g, sh));
    let fields = '';
    if (['gt', 'lt', 'eq', 'text'].includes(type)) fields = `<input id="cf-v1" placeholder="${type === 'text' ? 'tekst' : 'waarde of =$A$1'}">`;
    if (type === 'between') fields = `<div class="row" style="gap:8px"><input id="cf-v1" class="inp" placeholder="laagste"> <span>en</span> <input id="cf-v2" class="inp" placeholder="hoogste"></div>`;
    if (type === 'dup') fields = `<select id="cf-dup"><option value="dup">Dubbele</option><option value="uniq">Unieke</option></select>`;
    if (type === 'top' || type === 'bottom') fields = `<div class="row" style="gap:8px"><input id="cf-v1" class="inp" type="number" value="10" min="1" style="width:90px"><label class="chk"><input type="checkbox" id="cf-pct"> %</label></div>`;
    // voorstel: gemiddelde waarde
    let sugg = '';
    if (['gt', 'lt', 'eq', 'between'].includes(type)) { const nums = []; ranges.forEach((g) => App.eachInRange(sh, g, (r, c, cell) => { const v = App.valueOf(cell); if (typeof v === 'number') nums.push(v); })); if (nums.length) sugg = App.NF.general(+(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)); }
    App.dialog({
      title: CF_TITLES[type],
      body: `<p style="margin:0 0 8px">${CF_LABELS[type]}</p><div class="field">${fields}</div>
        <label class="field"><span>met</span><select id="cf-style">${CF_STYLES.map(([l], k) => `<option value="${k}">${l}</option>`).join('')}</select></label>`,
      onOpen: (d) => { const v1 = d.$('#cf-v1'); if (v1 && sugg && type !== 'top' && type !== 'bottom') v1.value = sugg; if (type === 'between' && sugg) d.$('#cf-v2').value = sugg; },
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const rule = { id: App.uid('cf'), ranges, type, style: { ...CF_STYLES[+d.$('#cf-style').value][1] } };
          const v1 = d.$('#cf-v1'), v2 = d.$('#cf-v2');
          if (v1) rule.v1 = v1.value; if (v2) rule.v2 = v2.value;
          if (type === 'dup') rule.type = d.$('#cf-dup').value;
          if (type === 'top' || type === 'bottom') { rule.rank = Math.max(1, +v1.value || 10); rule.pct = d.$('#cf-pct').checked; delete rule.v1; }
          App.run(() => { sh.cf.push(rule); });
        },
      }],
    });
  });
  App.defEdit('cfBar', (color) => { const sh = App.sh(); sh.cf.push({ id: App.uid('cf'), ranges: App.selRanges().map((g) => App.selBounded(g, sh)), type: 'bar', color }); });
  App.defEdit('cfScale', (colors) => { const sh = App.sh(); sh.cf.push({ id: App.uid('cf'), ranges: App.selRanges().map((g) => App.selBounded(g, sh)), type: 'scale', colors: colors.split(',') }); });
  App.defEdit('cfIcons', (set) => { const sh = App.sh(); sh.cf.push({ id: App.uid('cf'), ranges: App.selRanges().map((g) => App.selBounded(g, sh)), type: 'icons', set }); });
  App.defEdit('cfClear', (where) => {
    const sh = App.sh();
    if (where === 'sheet') { sh.cf = []; return; }
    const sel = App.selRanges();
    sh.cf.forEach((rule) => { rule.ranges = rule.ranges.filter((g) => !sel.some((s) => App.rangesOverlap(s, g))); });
    sh.cf = sh.cf.filter((r) => r.ranges.length);
  });
  App.cfDescribe = (rule) => {
    const v = (x) => App.esc(x ?? '');
    switch (rule.type) {
      case 'gt': return `Celwaarde > ${v(rule.v1)}`; case 'lt': return `Celwaarde < ${v(rule.v1)}`;
      case 'between': return `Celwaarde tussen ${v(rule.v1)} en ${v(rule.v2)}`; case 'eq': return `Celwaarde = ${v(rule.v1)}`;
      case 'text': return `Tekst bevat “${v(rule.v1)}”`; case 'dup': return 'Dubbele waarden'; case 'uniq': return 'Unieke waarden';
      case 'top': return `Bovenste ${rule.rank}${rule.pct ? '%' : ''}`; case 'bottom': return `Onderste ${rule.rank}${rule.pct ? '%' : ''}`;
      case 'above': return 'Boven gemiddelde'; case 'below': return 'Onder gemiddelde';
      case 'bar': return 'Gegevensbalk'; case 'icons': return 'Pictogramset'; case 'scale': return 'Kleurenschaal'; case 'formula': return 'Formule: =' + App.esc(App.F.toLocal(rule.f));
      default: return rule.type;
    }
  };
  App.def('cfManage', () => {
    const sh = App.sh();
    const render = (d) => {
      d.$('#cf-list').innerHTML = sh.cf.length ? sh.cf.map((rule, i) => `<div class="list-row"><span class="grow">${App.cfDescribe(rule)}</span><span class="muted small">${rule.ranges.map(App.rangeStr).join(';')}</span>
        <span style="width:46px;height:18px;display:inline-block;border:1px solid var(--line);background:${rule.type === 'bar' ? rule.color : rule.type === 'scale' ? 'linear-gradient(90deg,' + rule.colors.join(',') + ')' : (rule.style && rule.style.fill) || '#fff'};color:${(rule.style && rule.style.color) || '#000'};font-size:10px;text-align:center">AaBb</span>
        <button class="qb" data-up="${i}" title="Omhoog"><span class="i">arrow_upward</span></button><button class="qb" data-del="${i}" title="Verwijderen"><span class="i">delete</span></button></div>`).join('') : '<div class="list-row muted">Geen regels voor voorwaardelijke opmaak op dit blad.</div>';
    };
    App.dialog({
      title: 'Regels voor voorwaardelijke opmaak', wide: true,
      body: '<div class="list-rows" id="cf-list"></div><p class="muted small">Regels bovenaan hebben voorrang.</p>',
      onOpen: (d) => {
        render(d);
        d.$('#cf-list').addEventListener('click', (e) => {
          const del = e.target.closest('[data-del]'), up = e.target.closest('[data-up]');
          if (del) { App.run(() => { sh.cf.splice(+del.dataset.del, 1); }); render(d); }
          if (up && +up.dataset.up > 0) { const i = +up.dataset.up; App.run(() => { [sh.cf[i - 1], sh.cf[i]] = [sh.cf[i], sh.cf[i - 1]]; }); render(d); }
        });
      },
    });
  });

  /* ---------- Rijhoogte en kolombreedte ---------- */
  const PX_PER_CHAR = 7;
  const charsToPx = (ch) => Math.round(ch * PX_PER_CHAR + 5);
  const pxToChars = (px) => Math.max(0, (px - 5) / PX_PER_CHAR);
  App.charsToPx = charsToPx; App.pxToChars = pxToChars;
  App.defEdit('setColWidth', ({ cols, w }) => {
    const sh = App.sh();
    cols.forEach((g) => { for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 16383); c++) { if (w <= 0) { sh.hidC[c] = 1; } else { delete sh.hidC[c]; if (Math.abs(w - sh.defW) < 0.5) delete sh.colW[c]; else sh.colW[c] = Math.round(w); } } });
    App.invalidateDims(sh);
  }, { allowProtected: true });
  App.defEdit('setRowHeight', ({ rows, h }) => {
    const sh = App.sh();
    rows.forEach((g) => { for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 100000); r++) { if (h <= 0) sh.hidR[r] = 1; else { delete sh.hidR[r]; sh.rowH[r] = Math.round(h); sh.rowManual[r] = 1; } } });
    App.invalidateDims(sh);
  }, { allowProtected: true });
  const selCols = () => App.selRanges().map((g) => ({ c1: g.c1, c2: g.c2 }));
  const selRows = () => App.selRanges().map((g) => ({ r1: g.r1, r2: g.r2 }));
  App.def('colWidthDialog', async () => {
    const v = await App.prompt('Kolombreedte', 'Kolombreedte (tekens):', App.fmtNum(pxToChars(App.colW(App.sh().sel.ac)), 2));
    if (v === null) return;
    const n = App.parseNum(v); if (!(n >= 0 && n <= 255)) { App.toast('Typ een getal tussen 0 en 255.', 'error'); return; }
    App.exec('setColWidth', { cols: selCols(), w: n === 0 ? 0 : charsToPx(n) });
  });
  App.def('rowHeightDialog', async () => {
    const v = await App.prompt('Rijhoogte', 'Rijhoogte (punten):', App.fmtNum(App.rowH(App.sh().sel.ar) * 0.75, 2));
    if (v === null) return;
    const n = App.parseNum(v); if (!(n >= 0 && n <= 409)) { App.toast('Typ een getal tussen 0 en 409.', 'error'); return; }
    App.exec('setRowHeight', { rows: selRows(), h: n / 0.75 });
  });
  App.def('defaultWidthDialog', async () => {
    const sh = App.sh();
    const v = await App.prompt('Standaardbreedte', 'Standaardkolombreedte (tekens):', App.fmtNum(pxToChars(sh.defW), 2));
    if (v === null) return;
    const n = App.parseNum(v); if (!(n > 0 && n <= 255)) return;
    App.run(() => { sh.defW = charsToPx(n); App.invalidateDims(sh); });
  });
  App.defEdit('autoFitCols', (cols) => {
    const sh = App.sh();
    (Array.isArray(cols) ? cols : selCols()).forEach((g) => {
      const c2 = Math.min(g.c2, App.extent(sh).c);
      for (let c = g.c1; c <= c2; c++) {
        let w = 0;
        App.eachInRange(sh, { r1: 0, r2: App.MAXR - 1, c1: c, c2: c }, (r, cc, cell) => {
          if (!App.hasValue(cell) || App.mergeAt(sh, r, c) || App.rowHidden(r, sh)) return;
          const st = App.styleAt(sh, r, c, cell);
          if (st.wrap) return;
          const txt = App.state.showFormulas && cell.f ? '=' + App.F.toLocal(cell.f) : App.NF.format(App.valueOf(cell), st.nf).text;
          const tw = Math.max(...txt.split('\n').map((l) => App.measureText(App.fontOf(st), l))) + 10 + (st.ind || 0) * 9 + (sh.filter && sh.filter.r === r ? 16 : 0);
          if (tw > w) w = tw;
        });
        if (w > 0) { delete sh.hidC[c]; sh.colW[c] = Math.min(1790, Math.ceil(w)); }
      }
    });
    App.invalidateDims(sh);
  }, { allowProtected: true });
  App.defEdit('autoFitRows', (rows) => {
    const sh = App.sh();
    (Array.isArray(rows) ? rows : selRows()).forEach((g) => {
      const r2 = Math.min(g.r2, App.extent(sh).r);
      for (let r = g.r1; r <= r2; r++) { delete sh.rowManual[r]; delete sh.hidR[r]; const h = App.fitRowHeight(sh, r); if (Math.abs(h - sh.defH) < 0.5) delete sh.rowH[r]; else sh.rowH[r] = h; }
    });
    App.invalidateDims(sh);
  }, { allowProtected: true });
  App.defEdit('hideRows', () => { const sh = App.sh(); selRows().forEach((g) => { for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 100000); r++) sh.hidR[r] = 1; }); App.invalidateDims(sh); }, { allowProtected: true });
  App.defEdit('hideCols', () => { const sh = App.sh(); selCols().forEach((g) => { for (let c = g.c1; c <= g.c2; c++) sh.hidC[c] = 1; }); App.invalidateDims(sh); }, { allowProtected: true });
  App.defEdit('unhideRows', () => { const sh = App.sh(); selRows().forEach((g) => { Object.keys(sh.hidR).forEach((k) => { if (+k >= g.r1 - (g.r1 === g.r2 ? 1 : 0) && +k <= g.r2 + (g.r1 === g.r2 ? 1 : 0)) delete sh.hidR[k]; }); }); if (App.isFullCol(App.selRange()) && App.isFullRow(App.selRange())) sh.hidR = {}; App.invalidateDims(sh); }, { allowProtected: true });
  App.defEdit('unhideCols', () => { const sh = App.sh(); selCols().forEach((g) => { Object.keys(sh.hidC).forEach((k) => { if (+k >= g.c1 - (g.c1 === g.c2 ? 1 : 0) && +k <= g.c2 + (g.c1 === g.c2 ? 1 : 0)) delete sh.hidC[k]; }); }); if (App.isFullCol(App.selRange()) && App.isFullRow(App.selRange())) sh.hidC = {}; App.invalidateDims(sh); }, { allowProtected: true });

  /* ---------- Bladen ---------- */
  const validName = (name, except) => {
    if (!name || name.length > 31) return 'Een bladnaam moet 1 tot 31 tekens lang zijn.';
    if (/[\\/?*[\]:]/.test(name)) return 'Een bladnaam mag geen \\ / ? * [ ] : bevatten.';
    if (/^'|'$/.test(name)) return 'Een bladnaam mag niet beginnen of eindigen met een apostrof.';
    const other = App.sheetByName(name);
    if (other && other !== except) return 'Er is al een blad met deze naam.';
    return null;
  };
  App.defEdit('addSheet', () => {
    const sh = App.newSheet(App.uniqueSheetName());
    App.book.sheets.splice(App.book.active + 1, 0, sh);
    App.book.active += 1;
    App.afterSheetSwitch();
  }, { allowProtected: true });
  App.def('deleteSheet', async () => {
    const b = App.book;
    if (b.sheets.filter((s) => !s.hidden).length < 2) { App.toast('Een werkmap moet minstens één zichtbaar blad bevatten.', 'info'); return; }
    const sh = App.sh();
    if (App.cellCount(sh) && !(await App.confirm('Blad verwijderen', `Blad “${App.esc(sh.name)}” wordt definitief verwijderd. Doorgaan?`, 'Verwijderen', true))) return;
    App.run(() => {
      b.sheets.splice(b.active, 1);
      b.sheets.forEach((s) => App.eachCell(s, (r, c, cell) => { if (cell.f) cell.f = App.F.dropSheet(cell.f, sh.name); }));
      b.active = Math.min(b.active, b.sheets.length - 1);
      while (b.sheets[b.active].hidden && b.active > 0) b.active--;
      App.afterSheetSwitch();
    }, { touchAll: true });
  });
  App.renameSheetTo = (sh, name) => {
    name = name.trim();
    const err = validName(name, sh);
    if (err) { App.toast(err, 'error'); return false; }
    if (name === sh.name) return true;
    const old = sh.name;
    App.run(() => {
      App.book.sheets.forEach((s) => App.eachCell(s, (r, c, cell) => { if (cell.f) cell.f = App.F.renameSheet(cell.f, old, name); }));
      Object.keys(App.book.names).forEach((k) => { App.book.names[k] = App.F.renameSheet(App.book.names[k], old, name); });
      App.book.sheets.forEach((s) => s.objs.forEach((o) => { if (o.range) o.range = App.F.renameSheet(o.range, old, name); }));
      sh.name = name;
      App.renderSheetTabs();
    }, { touchAll: true });
    return true;
  };
  App.renameSheetInline = (i) => {
    const btn = $(`#sheet-tabs [data-si="${i}"]`); if (!btn) return;
    const sh = App.book.sheets[i];
    btn.innerHTML = `<input value="${App.esc(sh.name)}" maxlength="31">`;
    const inp = btn.querySelector('input');
    inp.focus(); inp.select();
    let done = false;
    const finish = (save) => { if (done) return; done = true; if (save) App.renameSheetTo(sh, inp.value); App.renderSheetTabs(); App.focusGrid(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
    inp.addEventListener('mousedown', (e) => e.stopPropagation());
  };
  App.def('renameSheet', () => App.renameSheetInline(App.book.active));
  App.defEdit('reorderSheet', ({ from, to }) => {
    const b = App.book;
    const cur = b.sheets[b.active];
    const [s] = b.sheets.splice(from, 1);
    b.sheets.splice(to, 0, s);
    b.active = b.sheets.indexOf(cur);
    App.renderSheetTabs();
  }, { allowProtected: true });
  const copySheet = (sh, name) => {
    const n = App.deserializeSheet(JSON.parse(JSON.stringify(App.serializeSheet(sh))));
    n.id = App.uid('s'); n.name = name;
    n.objs = n.objs.map((o) => ({ ...o, id: App.uid('o') }));
    return n;
  };
  App.defEdit('duplicateSheet', () => {
    const sh = App.sh();
    let k = 2; while (App.sheetByName(`${sh.name.slice(0, 26)} (${k})`)) k++;
    App.book.sheets.splice(App.book.active + 1, 0, copySheet(sh, `${sh.name.slice(0, 26)} (${k})`));
    App.book.active += 1;
    App.afterSheetSwitch();
  }, { allowProtected: true });
  App.def('moveSheet', () => {
    const b = App.book;
    App.dialog({
      title: 'Verplaatsen of kopiëren',
      body: `<label class="field"><span>Vóór blad</span><select id="mv-pos" size="7" style="height:auto">${b.sheets.map((s, i) => `<option value="${i}">${App.esc(s.name)}</option>`).join('')}<option value="${b.sheets.length}">(naar einde verplaatsen)</option></select></label>
        <label class="chk"><input type="checkbox" id="mv-copy"> Kopie maken</label>`,
      onOpen: (d) => { d.$('#mv-pos').value = String(b.active); },
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const to = +d.$('#mv-pos').value;
          if (d.$('#mv-copy').checked) {
            App.run(() => {
              const sh = App.sh();
              let k = 2; while (App.sheetByName(`${sh.name.slice(0, 26)} (${k})`)) k++;
              b.sheets.splice(to, 0, copySheet(sh, `${sh.name.slice(0, 26)} (${k})`));
              b.active = to;
              App.afterSheetSwitch();
            });
          } else App.exec('reorderSheet', { from: b.active, to: to > b.active ? to - 1 : to });
        },
      }],
    });
  });
  App.def('tabColorMenu', () => {
    const btn = $('#sheet-tabs .stab.active') || $('#sheetbar');
    App.colorMenu(btn, 'tabColor', (c) => App.exec('tabColor', c));
  });
  App.defEdit('tabColor', (c) => { App.sh().tab = c || ''; App.renderSheetTabs(); }, { allowProtected: true });
  App.defEdit('hideSheet', () => {
    const b = App.book;
    if (b.sheets.filter((s) => !s.hidden).length < 2) { App.toast('Een werkmap moet minstens één zichtbaar blad bevatten.', 'info'); return false; }
    App.sh().hidden = true;
    let i = b.active; while (b.sheets[i] && b.sheets[i].hidden) i = (i + 1) % b.sheets.length;
    b.active = i;
    App.afterSheetSwitch();
  }, { allowProtected: true });
  App.def('unhideSheet', () => {
    const hidden = App.book.sheets.map((s, i) => ({ s, i })).filter((x) => x.s.hidden);
    if (!hidden.length) { App.toast('Er zijn geen verborgen bladen.', 'info'); return; }
    App.dialog({
      title: 'Zichtbaar maken',
      body: `<label class="field"><span>Blad zichtbaar maken:</span><select id="uh-s" size="6" style="height:auto">${hidden.map((x) => `<option value="${x.i}">${App.esc(x.s.name)}</option>`).join('')}</select></label>`,
      onOpen: (d) => { d.$('#uh-s').selectedIndex = 0; },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { const i = +d.$('#uh-s').value; App.run(() => { App.book.sheets[i].hidden = false; App.book.active = i; App.afterSheetSwitch(); }); } }],
    });
  });
  const stepSheet = (d) => {
    const b = App.book; let i = b.active;
    for (let k = 0; k < b.sheets.length; k++) { i = (i + d + b.sheets.length) % b.sheets.length; if (!b.sheets[i].hidden) break; }
    App.switchSheet(i);
  };
  App.def('sheetPrev', () => stepSheet(-1));
  App.def('sheetNext', () => stepSheet(1));

  /* ---------- Beveiligen ---------- */
  App.def('toggleProtect', async () => {
    const sh = App.sh();
    if (!sh.protect && !(await App.confirm('Blad beveiligen', 'Na het beveiligen kunnen vergrendelde cellen niet meer worden gewijzigd. Cellen die je bewerkbaar wilt houden, ontgrendel je eerst via Controleren › Cellen ontgrendelen. Doorgaan?', 'Beveiligen'))) return;
    App.run(() => { sh.protect = !sh.protect; App.renderSheetTabs(); }, { allowProtected: true });
    App.toast(sh.protect ? 'Blad beveiligd' : 'Beveiliging opgeheven', 'lock');
  });
  App.defEdit('toggleLocked', () => { const on = App.activeStyle().unlocked !== true; setProp('unlocked', on ? true : undefined); }, { allowProtected: false });

  /* ---------- Titels blokkeren ---------- */
  App.defEdit('freeze', (how) => {
    const sh = App.sh(); const s = sh.sel;
    const sc = $('#grid-scroll');
    if (how === 'none') sh.freeze = { r: 0, c: 0 };
    else {
      const top = App.rowAt(App.rowY(sh.freeze.r || 0) + sc.scrollTop / (sh.zoom || 1));
      const left = App.colAt(App.colX(sh.freeze.c || 0) + sc.scrollLeft / (sh.zoom || 1));
      if (how === 'row') sh.freeze = { r: top + 1, c: 0 };
      else if (how === 'col') sh.freeze = { r: 0, c: left + 1 };
      else sh.freeze = { r: s.ar, c: s.ac };
    }
    sh._max = null;
    sc.scrollTop = 0; sc.scrollLeft = 0;
    App.updateSpacer();
  }, { allowProtected: true });

  /* ---------- Zoom en weergave ---------- */
  const zoomTo = (pct) => {
    const sh = App.sh();
    const sc = $('#grid-scroll');
    const old = sh.zoom || 1;
    const z = App.clamp(Math.round(pct) / 100, 0.1, 4);
    const fx = sc.scrollLeft / old, fy = sc.scrollTop / old;
    sh.zoom = z;
    App.computeView(); App.updateSpacer();
    sc.scrollLeft = fx * z; sc.scrollTop = fy * z;
    App.updateZoomUi();
    App.resize();
  };
  App.updateZoomUi = () => { const p = Math.round((App.sh().zoom || 1) * 100); $('#zoom-label').textContent = p + '%'; $('#zoom-range').value = p; };
  App.def('zoomSet', (v) => zoomTo(+v));
  App.def('zoomIn', () => zoomTo((App.sh().zoom || 1) * 100 + 10));
  App.def('zoomOut', () => zoomTo((App.sh().zoom || 1) * 100 - 10));
  App.def('zoom100', () => zoomTo(100));
  App.def('zoomSelection', () => {
    const g = App.selBounded(App.selRange());
    const sc = $('#grid-scroll');
    const w = App.colX(g.c2 + 1) - App.colX(g.c1), h = App.rowY(g.r2 + 1) - App.rowY(g.r1);
    const z = Math.min((sc.clientWidth - 60) / w, (sc.clientHeight - 40) / h) * 100;
    zoomTo(App.clamp(z, 10, 400));
    App.scrollToCell(g.r1, g.c1);
  });
  App.def('zoomDialog', () => {
    const cur = Math.round((App.sh().zoom || 1) * 100);
    App.dialog({
      title: 'In-/uitzoomen',
      body: `${[200, 100, 75, 50, 25].map((p) => `<label class="chk" style="font-size:13px"><input type="radio" name="zm" value="${p}" ${p === cur ? 'checked' : ''}> ${p}%</label>`).join('')}
        <label class="chk" style="font-size:13px"><input type="radio" name="zm" value="sel"> Passend in selectie</label>
        <label class="chk" style="font-size:13px"><input type="radio" name="zm" value="custom" ${[200, 100, 75, 50, 25].includes(cur) ? '' : 'checked'}> Aangepast: <input type="number" id="zm-c" value="${cur}" min="10" max="400" style="width:70px"> %</label>`,
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { const v = d.$('input[name=zm]:checked').value; if (v === 'sel') App.exec('zoomSelection'); else zoomTo(v === 'custom' ? +d.$('#zm-c').value : +v); } }],
    });
  });
  App.defEdit('toggleGridlines', (v) => { const sh = App.sh(); sh.grid = typeof v === 'boolean' ? v : !sh.grid; }, { allowProtected: true });
  App.defEdit('toggleHeadings', (v) => { const sh = App.sh(); sh.heads = typeof v === 'boolean' ? v : !sh.heads; sh._max = null; }, { allowProtected: true });
  App.def('toggleFormulaBar', (v) => { App.settings.fbar = typeof v === 'boolean' ? v : !App.settings.fbar; document.body.classList.toggle('no-fbar', !App.settings.fbar); App.saveSettings(); App.resize(); App.scheduleState(); });
  App.def('toggleFormulaExpand', () => { document.body.classList.toggle('fbar-expanded'); App.resize(); });
  App.def('toggleShowFormulas', () => { App.state.showFormulas = !App.state.showFormulas; App.scheduleRender(); App.scheduleState(); });
  App.def('viewNormal', () => { App.state.view = 'normal'; App.scheduleRender(); App.scheduleState(); });
  App.def('viewBreaks', () => { App.state.view = App.state.view === 'breaks' ? 'normal' : 'breaks'; App.scheduleRender(); App.scheduleState(); });
})();
