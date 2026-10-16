/* =========================================================
   Cel (gemaakt door JJ van Schelven) — bewerken: celeditor, formulebalk, aanwijzen, toetsenbord,
   klembord, doorvoeren, invoegen/verwijderen, zoeken
   ========================================================= */
'use strict';

(() => {
  const F = App.F, NF = App.NF;
  const editor = $('#cell-editor');
  const fbar = $('#formula');
  const namebox = $('#namebox');
  const acList = $('#ac-list');
  const fnTip = $('#fn-tip');
  const wrap = $('#grid-wrap');
  editor.hidden = false;
  editor.classList.add('idle');
  const idleCss = document.createElement('style');
  idleCss.textContent = '#cell-editor.idle{opacity:0;pointer-events:none;width:2px!important;height:2px!important;min-width:0!important;border:0;padding:0;box-shadow:none}';
  document.head.appendChild(idleCss);

  /* ---------- Hulpjes ---------- */
  App.editTextOf = (sh, r, c) => {
    const cell = App.getCell(sh, r, c);
    if (!cell) return '';
    if (cell.f) return '=' + F.toLocal(cell.f);
    return NF.editText(cell.v, App.styleAt(sh, r, c, cell).nf);
  };
  App.focusGrid = () => {
    if (App.state.editing) return;
    if (document.activeElement === editor) return;
    if ($('#backstage') || $('.backdrop')) return;
    editor.value = '';
    editor.focus({ preventScroll: true });
  };
  App.focusEditor = () => {
    const ed = App.state.editing; if (!ed) return;
    const el = ed.src === 'bar' || App.book.active !== ed.sheetIdx ? fbar : editor;
    el.focus({ preventScroll: true });
  };
  const input = () => (App.state.editing && App.state.editing.src === 'bar' ? fbar : editor);

  /* ---------- Formulebalk en naamvak bijwerken ---------- */
  App.updateFormulaBar = () => {
    const sh = App.sh();
    if (!App.state.editing) {
      const s = sh.sel;
      fbar.value = App.editTextOf(sh, s.ar, s.ac);
      const cell = App.getCell(sh, s.ar, s.ac);
      fbar.readOnly = !!(sh.protect && App.styleAt(sh, s.ar, s.ac, cell).unlocked !== true);
    }
    if (document.activeElement !== namebox) {
      const g = App.selRange();
      const s = sh.sel;
      const name = Object.entries(App.book.names).find(([, ref]) => {
        const p = /^(?:'?(.+?)'?!)?(\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)$/.exec(ref);
        if (!p) return false;
        const rg = App.parseRange(p[2]);
        return rg && (!p[1] || p[1].toLowerCase() === sh.name.toLowerCase()) && rg.r1 === g.r1 && rg.c1 === g.c1 && rg.r2 === g.r2 && rg.c2 === g.c2;
      });
      if (name) namebox.value = name[0];
      else if (App.selDragging) namebox.value = `${g.r2 - g.r1 + 1}R x ${g.c2 - g.c1 + 1}K`;
      else namebox.value = App.addr(s.ar, s.ac);
    }
  };
  App.on('selection', () => { App.updateFormulaBar(); App.positionEditor(); App.updateDvButton && App.updateDvButton(); });
  App.on('change', () => App.updateFormulaBar());
  App.on('sheet', () => App.updateFormulaBar());

  /* ---------- Editor positioneren ---------- */
  App.positionEditor = () => {
    const ed = App.state.editing;
    const sh = App.sh();
    const V = App.view;
    if (!ed) {
      const a = App.cellRect(sh.sel.ar, sh.sel.ac, sh);
      editor.style.left = Math.max(0, a.x * V.z) + 'px';
      editor.style.top = Math.max(0, a.y * V.z) + 'px';
      return;
    }
    if (App.book.active !== ed.sheetIdx) { editor.style.visibility = 'hidden'; return; }
    editor.style.visibility = '';
    if (ed.src === 'bar' && !ed.showInCell) { editor.style.visibility = 'hidden'; }
    App.computeView();
    const a = App.cellRect(ed.r, ed.c, sh);
    const st = App.styleAt(sh, ed.r, ed.c);
    const z = V.z;
    const font = App.fontOf(st);
    editor.style.font = font;
    editor.style.fontSize = ((st.size || App.DEF_SIZE) * 96 / 72) * z + 'px';
    editor.style.lineHeight = '1.22';
    editor.style.color = st.color || '#000';
    editor.style.background = st.fill || '#fff';
    editor.style.textAlign = ed.text && ed.text[0] === '=' ? 'left' : st.ha === 'center' ? 'center' : st.ha === 'right' ? 'right' : 'left';
    editor.classList.toggle('wrap', !!st.wrap);
    const left = a.x * z, top = a.y * z;
    const maxW = (V.W - a.x) * z - 2;
    const lines = editor.value.split('\n');
    const tw = Math.max(...lines.map((l) => App.measureText(font, l + 'MM'))) * z + 8;
    let w = Math.max(a.w * z + 2, st.wrap ? a.w * z + 2 : Math.min(maxW, tw));
    editor.style.left = (left - 1) + 'px';
    editor.style.top = (top - 1) + 'px';
    editor.style.width = w + 'px';
    editor.style.minWidth = '0px';
    editor.style.height = '0px';
    const sh2 = Math.max(a.h * z + 2, editor.scrollHeight + 2);
    editor.style.height = Math.min(sh2, Math.max(a.h * z + 2, (V.H - a.y) * z - 2)) + 'px';
  };

  /* ---------- Bewerken starten / afsluiten ---------- */
  App.startEdit = (opts = {}) => {
    const sh = App.sh();
    const s = sh.sel;
    if (sh.protect && App.styleAt(sh, s.ar, s.ac).unlocked !== true) { App.toast('Deze cel is beveiligd. Hef de beveiliging op via Controleren › Blad beveiligen.', 'lock'); editor.value = ''; return false; }
    if (App.state.editing) return true;
    const text = opts.initial !== undefined ? opts.initial : App.editTextOf(sh, s.ar, s.ac);
    App.state.editing = { r: s.ar, c: s.ac, mode: opts.mode || 'enter', src: opts.src || 'cell', sheetIdx: App.book.active, orig: App.editTextOf(sh, s.ar, s.ac), refs: [], point: null, text };
    App.scrollToCell(s.ar, s.ac);
    editor.classList.remove('idle');
    if (editor.value !== text) editor.value = text;
    fbar.value = text;
    document.body.classList.add('editing');
    $('#sb-mode').textContent = opts.mode === 'edit' ? 'Bewerken' : 'Invoeren';
    App.positionEditor();
    const el = input();
    if (el !== document.activeElement) el.focus({ preventScroll: true });
    if (opts.src !== 'bar') {
      const end = text.length;
      if (opts.clickX !== undefined && text && text[0] !== '=') { el.setSelectionRange(end, end); } else el.setSelectionRange(end, end);
    }
    updateRefs();
    App.scheduleRender();
    return true;
  };
  const finishEdit = () => {
    App.state.editing = null;
    editor.classList.add('idle');
    editor.classList.remove('wrap');
    editor.style.visibility = '';
    editor.value = '';
    document.body.classList.remove('editing');
    $('#sb-mode').textContent = 'Gereed';
    hideAc(); fnTip.hidden = true;
    App.scheduleRender();
    App.updateFormulaBar();
    App.positionEditor();
  };
  App.cancelEdit = (silent) => {
    const ed = App.state.editing;
    if (!ed) return;
    if (App.book.active !== ed.sheetIdx) { App.book.active = ed.sheetIdx; App.afterSheetSwitch(true); }
    finishEdit();
    if (!silent) App.focusGrid();
  };

  /* Waarde uit tekst in een cel zetten (gedeeld door invoer, plakken, vervangen) */
  const URL_RE = /^(https?:\/\/|www\.)[^\s]+$|^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const DATE_FNS = () => { const d = App.LOCALE ? App.LOCALE.dateFmt : 'd-m-yyyy'; return { DATE: d, TODAY: d, EDATE: d, EOMONTH: d, WORKDAY: d, DATEVALUE: d, NOW: d + ' h:mm', TIME: 'h:mm' }; };
  const inferFormat = (sh, canon) => {
    const m = /^([A-Z][A-Z0-9.]*)\(/.exec(canon);
    if (m && DATE_FNS()[m[1]]) return DATE_FNS()[m[1]];
    // eerste verwijzing met een notatie (valuta, datum, procent) overnemen bij eenvoudige rekensommen
    if (m && !['SUM', 'MIN', 'MAX', 'AVERAGE', 'ROUND', 'ABS', 'SUMIF', 'SUMIFS', 'SUBTOTAL'].includes(m[1])) return null;
    const toks = F.tokenize(canon, 'en');
    const ref = toks.find((t) => t.t === 'ref');
    if (!ref) return null;
    const tsh = ref.sheet ? App.sheetByName(ref.sheet) : sh;
    if (!tsh) return null;
    const st = App.styleAt(tsh, ref.r1, ref.c1);
    if (st.nf && st.nf !== 'General' && st.nf !== '@' && !/%/.test(st.nf) || (st.nf && /%/.test(st.nf) && /^[A-Z$0-9:]+$/.test(canon))) return st.nf;
    return null;
  };
  App.setCellFromText = (sh, r, c, text, opts = {}) => {
    const cell = App.cellAt(sh, r, c);
    const st = App.styleAt(sh, r, c, cell);
    delete cell.cv; delete cell._p;
    if (text === '' || text === null || text === undefined) {
      delete cell.v; delete cell.f;
      App.cleanCell(sh, r, c);
      return { ok: true };
    }
    if (typeof text === 'string' && text.length > 1 && text[0] === '=' && st.nf !== '@') {
      let canon = opts.canon ? text.slice(1) : F.toCanon(text.slice(1));
      const chk = F.check(canon);
      if (chk && chk.msg) return { ok: false, msg: chk.msg };
      if (chk && chk.fix) canon = chk.fix;
      cell.f = canon; delete cell.v; delete cell.legacy;
      if (!st.nf || st.nf === 'General') {
        const nf = inferFormat(sh, canon);
        if (nf) cell.s = { ...(cell.s || {}), nf };
      }
      return { ok: true };
    }
    delete cell.f;
    if (st.nf === '@') { cell.v = String(text); return { ok: true }; }
    const p = NF.parseInput(String(text));
    cell.v = p.v;
    if (p.nf && (!st.nf || st.nf === 'General' || (NF.isDateFmt(p.nf) && !NF.isDateFmt(st.nf)))) cell.s = { ...(cell.s || {}), nf: p.nf };
    if (typeof p.v === 'string' && URL_RE.test(p.v.trim()) && !cell.l && opts.autoLink !== false) cell.l = /@/.test(p.v) && !/^https?:/i.test(p.v) ? 'mailto:' + p.v.trim() : /^www\./i.test(p.v) ? 'https://' + p.v.trim() : p.v.trim();
    if (typeof p.v === 'string' && p.v.includes('\n')) cell.s = { ...(cell.s || {}), wrap: true };
    App.cleanCell(sh, r, c);
    return { ok: true };
  };

  App.commitEdit = (opts = {}) => {
    const ed = App.state.editing;
    if (!ed) return true;
    let text = input().value;
    // automatisch aanvullen geaccepteerd: geselecteerde aanvulling hoort erbij
    hideAc();
    const target = App.book.sheets[ed.sheetIdx];
    if (App.book.active !== ed.sheetIdx) { App.book.active = ed.sheetIdx; App.afterSheetSwitch(true); }
    if (text === ed.orig && !opts.all) { finishEdit(); App.focusGrid(); return true; }
    // gegevensvalidatie
    if (App.validateEntry && text[0] !== '=' && !App.validateEntry(target, ed.r, ed.c, text)) return false;
    const cells = [];
    if (opts.all) App.selRanges().forEach((g) => { g = App.selBounded(g); for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (!App.rowHidden(r) && !App.colHidden(c)) { const m = App.mergeAt(target, r, c); if (!m || (m.r1 === r && m.c1 === c)) cells.push({ r, c }); } });
    else cells.push({ r: ed.r, c: ed.c });
    let res = { ok: true };
    const canonFirst = text[0] === '=' && text.length > 1 ? F.toCanon(text.slice(1)) : null;
    if (canonFirst) {
      const chk = F.check(canonFirst);
      if (chk && chk.msg) {
        App.dialog({ title: 'Probleem met deze formule', body: `<p style="line-height:1.5;margin:0">${App.esc(chk.msg)}</p><p class="muted small">Typ een apostrof (') vóór het =-teken als je geen formule bedoelt.</p>`, onClose: () => App.focusEditor() });
        return false;
      }
    }
    App.run(() => {
      cells.forEach(({ r, c }) => {
        if (canonFirst) {
          const f = F.shift(canonFirst, r - ed.r, c - ed.c);
          res = App.setCellFromText(target, r, c, '=' + f, { canon: true });
        } else { res = App.setCellFromText(target, r, c, text); autoColWidth(target, r, c); }
        autoRowHeight(target, r);
      });
    });
    finishEdit();
    App.focusGrid();
    return res.ok;
  };

  /* Kolom automatisch breder maken (zoals Excel): een ingetypte datum of opgemaakt getal dat niet past in een kolom
     met de standaardbreedte zou anders als #### verschijnen. Kolommen met een zelf gekozen breedte blijven zoals ze zijn. */
  const autoColWidth = (sh, r, c) => {
    if (sh.colW[c] !== undefined || App.mergeAt(sh, r, c)) return;
    const cell = App.getCell(sh, r, c);
    if (!cell || cell.f || typeof cell.v !== 'number') return;
    const st = App.styleAt(sh, r, c, cell);
    if (!st.nf || st.nf === 'General' || st.wrap) return;
    const w = Math.ceil(App.measureText(App.fontOf(st), NF.format(cell.v, st.nf).text) + 10 + (st.ind || 0) * 9);
    if (w > App.colW(c, sh)) { sh.colW[c] = Math.min(1790, w); App.invalidateDims(sh); }
  };

  /* Rijhoogte automatisch aanpassen (bij terugloop of grote letters) */
  const autoRowHeight = (sh, r) => {
    if (sh.rowManual[r]) return;
    const h = App.fitRowHeight(sh, r);
    if (Math.abs((sh.rowH[r] ?? sh.defH) - h) > 0.5) {
      if (Math.abs(h - sh.defH) < 0.5) delete sh.rowH[r]; else sh.rowH[r] = h;
      App.invalidateDims(sh);
    }
  };
  App.autoRowHeight = autoRowHeight;
  App.fitRowHeight = (sh, r) => {
    let h = sh.defH;
    const row = sh.data.get(r);
    if (!row) return h;
    row.forEach((cell, c) => {
      const st = App.styleAt(sh, r, c, cell);
      const size = (st.size || App.DEF_SIZE) * 96 / 72;
      const base = Math.max(sh.defH, Math.round(size * 1.36));
      if (App.mergeAt(sh, r, c)) { h = Math.max(h, base); return; }
      const v = App.valueOf(cell);
      let lines = 1;
      if (typeof v === 'string' || (cell.f && typeof v === 'string')) {
        if (st.wrap) lines = App.wrapLines(App.fontOf(st), NF.format(v, st.nf).text, Math.max(10, App.colW(c, sh) - 6 - (st.ind || 0) * 9)).length;
        else if (v.includes('\n')) lines = v.split('\n').length;
      }
      if (st.rot) { const tw = App.measureText(App.fontOf(st), NF.format(v, st.nf).text); h = Math.max(h, Math.min(400, Math.abs(Math.sin(st.rot * Math.PI / 180)) * tw + 10)); }
      h = Math.max(h, lines > 1 ? Math.ceil(lines * size * 1.22 + 4) : base);
    });
    return Math.min(409, h);
  };

  /* ---------- Verwijzingen tijdens het bewerken ---------- */
  const updateRefs = () => {
    const ed = App.state.editing;
    if (!ed) return;
    const text = input().value;
    ed.text = text;
    ed.refs = text[0] === '=' ? F.refsInLocal(text.slice(1)) : [];
    App.scheduleRender();
  };
  App.canPoint = () => {
    const ed = App.state.editing;
    if (!ed) return false;
    const el = input();
    const text = el.value;
    if (text[0] !== '=') return false;
    const pos = el.selectionStart;
    if (ed.point && ed.point.end === pos && el.selectionEnd === pos) return true;
    if (el.selectionStart !== el.selectionEnd) return false;
    const before = text.slice(0, pos).replace(/\s+$/, '');
    if (!before.length) return false;
    return /[=(;,+\-*/^&<>:]$/.test(before);
  };
  App.pointInsert = (g, dragging) => {
    const ed = App.state.editing;
    if (!ed) return;
    const el = input();
    let text = el.value;
    const sh = App.sh();
    const editSheet = App.book.sheets[ed.sheetIdx];
    let ref = App.rangeStr(g);
    if (sh !== editSheet) ref = App.sheetRef(sh.name) + '!' + ref;
    let start, end;
    if (ed.point && (dragging || ed.point.end === el.selectionStart)) { start = ed.point.start; end = ed.point.end; }
    else { start = el.selectionStart; end = el.selectionEnd; }
    text = text.slice(0, start) + ref + text.slice(end);
    el.value = text;
    (el === editor ? fbar : editor).value = text;
    const caret = start + ref.length;
    el.setSelectionRange(caret, caret);
    ed.point = { start, end: caret, g, sheet: sh };
    ed.mode = 'enter';
    updateRefs();
    App.positionEditor();
    App.scheduleRender();
  };

  /* ---------- Automatisch aanvullen ---------- */
  let ac = null;
  const hideAc = () => { acList.hidden = true; ac = null; };
  const showFnAc = () => {
    const ed = App.state.editing;
    const el = input();
    const text = el.value, pos = el.selectionStart;
    if (text[0] !== '=') { hideAc(); fnTip.hidden = true; return; }
    const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(text.slice(0, pos));
    const before = m ? text.slice(0, pos - m[1].length).replace(/\s+$/, '') : '';
    if (m && /[=(;,+\-*/^&<>:]$/.test(before)) {
      const q = m[1].toUpperCase();
      const list = Object.entries(App.FN).filter(([, f]) => f.nl.startsWith(q)).sort((a, b) => a[1].nl.localeCompare(b[1].nl)).slice(0, 12);
      const names = Object.keys(App.book.names).filter((n) => n.toUpperCase().startsWith(q)).map((n) => [n, { nl: n, desc: 'Gedefinieerde naam', name: true }]);
      const all = names.concat(list);
      if (all.length) {
        ac = { items: all, sel: 0, start: pos - m[1].length, end: pos };
        acList.innerHTML = all.map(([en, f], k) => `<button data-k="${k}" class="${k === 0 ? 'kb' : ''}"><span class="i">${f.name ? 'label' : 'function'}</span><span><b>${f.nl}</b><span class="ac-desc">${App.esc(f.desc)}</span></span></button>`).join('');
        placeFloat(acList, el, 0);
        acList.hidden = false;
      } else hideAc();
    } else hideAc();
    // functietip
    const ctxFn = F.fnContext(text.slice(1), pos - 1);
    if (ctxFn && App.FN[ctxFn.name] && acList.hidden) {
      const f = App.FN[ctxFn.name];
      const args = f.sig ? f.sig.split('; ') : [];
      fnTip.innerHTML = `<b>${f.nl}</b>(${args.map((a, k) => `<span class="${k === Math.min(ctxFn.arg, args.length - 1) || (a === '…' && ctxFn.arg >= k) ? 'cur' : ''}">${App.esc(a)}</span>`).join('; ')})`;
      placeFloat(fnTip, el, 1);
      fnTip.hidden = false;
    } else fnTip.hidden = true;
    void ed;
  };
  const placeFloat = (el, anchor, tip) => {
    const wr = wrap.getBoundingClientRect();
    if (anchor === fbar) {
      const r = fbar.getBoundingClientRect();
      el.style.left = Math.max(4, r.left - wr.left + 8) + 'px';
      el.style.top = (tip ? 2 : 2 + (fnTip.hidden ? 0 : 0)) + 'px';
    } else {
      const r = editor.getBoundingClientRect();
      el.style.left = (r.left - wr.left) + 'px';
      el.style.top = (r.bottom - wr.top + 2 + (tip ? 0 : 0)) + 'px';
    }
  };
  const acceptAc = () => {
    if (!ac) return false;
    const [en, f] = ac.items[ac.sel];
    const el = input();
    const text = el.value;
    const ins = f.name ? en : f.nl + '(';
    const nt = text.slice(0, ac.start) + ins + text.slice(ac.end);
    el.value = nt; (el === editor ? fbar : editor).value = nt;
    const caret = ac.start + ins.length;
    el.setSelectionRange(caret, caret);
    hideAc();
    updateRefs(); App.positionEditor(); showFnAc();
    return true;
  };
  acList.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const b = e.target.closest('[data-k]'); if (!b || !ac) return;
    ac.sel = +b.dataset.k; acceptAc();
  });
  // Tekst aanvullen uit dezelfde kolom (zoals Excel AutoAanvullen)
  const textComplete = (ev) => {
    const ed = App.state.editing;
    if (!ed || ed.mode !== 'enter' || !ev || /delete/.test(ev.inputType || '')) return;
    const el = input();
    const text = el.value;
    if (!text || text[0] === '=' || el.selectionStart !== text.length || /^[\d\-+.,€%]/.test(text)) return;
    const sh = App.book.sheets[ed.sheetIdx];
    const low = text.toLowerCase();
    const found = new Set();
    for (let d = 1; d < 500; d++) {
      let any = false;
      for (const r of [ed.r - d, ed.r + d]) {
        if (r < 0) continue;
        const cell = App.getCell(sh, r, ed.c);
        const v = cell && App.valueOf(cell);
        if (typeof v === 'string' && v) { any = true; if (v.toLowerCase().startsWith(low) && v.length > text.length) found.add(v); }
      }
      if (!any && d > 1 && found.size === 0) {
        const up = App.getCell(sh, ed.r - d, ed.c), dn = App.getCell(sh, ed.r + d, ed.c);
        if (!App.hasValue(up) && !App.hasValue(dn)) break;
      }
    }
    if (found.size === 1) {
      const v = [...found][0];
      el.value = text + v.slice(text.length);
      el.setSelectionRange(text.length, v.length);
      (el === editor ? fbar : editor).value = el.value;
    }
  };

  /* ---------- Invoer-gebeurtenissen ---------- */
  const onInput = (el, ev) => {
    const ed = App.state.editing;
    if (!ed) {
      if (el === editor) {
        if (!editor.value) return;
        if (!App.startEdit({ mode: 'enter', initial: editor.value })) { editor.value = ''; return; }
      } else {
        App.startEdit({ mode: 'edit', src: 'bar', initial: fbar.value });
      }
    }
    const e2 = App.state.editing; if (!e2) return;
    (el === editor ? fbar : editor).value = el.value;
    if (e2.point) e2.point = null;
    textComplete(ev);
    updateRefs();
    App.positionEditor();
    showFnAc();
  };
  editor.addEventListener('input', (e) => onInput(editor, e));
  fbar.addEventListener('input', (e) => onInput(fbar, e));
  fbar.addEventListener('focus', () => {
    if (!App.state.editing) {
      if (fbar.readOnly) return;
      App.startEdit({ mode: 'edit', src: 'bar' });
    } else App.state.editing.src = 'bar';
  });
  editor.addEventListener('focus', () => { if (App.state.editing && App.book.active === App.state.editing.sheetIdx) App.state.editing.src = 'cell'; });
  editor.addEventListener('click', () => { const ed = App.state.editing; if (ed) { ed.mode = 'edit'; ed.point = null; $('#sb-mode').textContent = 'Bewerken'; showFnAc(); } });
  fbar.addEventListener('click', () => { const ed = App.state.editing; if (ed) { ed.point = null; showFnAc(); } });
  $('#fb-ok').addEventListener('click', () => App.commitEdit());
  $('#fb-cancel').addEventListener('click', () => App.cancelEdit());
  editor.addEventListener('blur', () => {
    setTimeout(() => {
      const ae = document.activeElement;
      if (App.state.editing && ae !== editor && ae !== fbar && !ae.closest?.('#dialog-layer, .menu, #ribbon, #sheetbar')) { /* blijven bewerken, zoals Excel */ }
    }, 0);
  });

  /* ---------- Toetsen tijdens het bewerken ---------- */
  const onEditKey = (e) => {
    const ed = App.state.editing;
    if (!ed) return false;
    const el = input();
    if (ac && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      ac.sel = App.clamp(ac.sel + (e.key === 'ArrowDown' ? 1 : -1), 0, ac.items.length - 1);
      $$('button', acList).forEach((b, k) => b.classList.toggle('kb', k === ac.sel));
      return true;
    }
    if (ac && (e.key === 'Tab' || (e.key === 'Enter' && !e.altKey))) { e.preventDefault(); acceptAc(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); if (ac) { hideAc(); return true; } App.cancelEdit(); return true; }
    if (e.key === 'Enter' && e.altKey) {
      e.preventDefault();
      const s = el.selectionStart, t = el.value;
      el.value = t.slice(0, s) + '\n' + t.slice(el.selectionEnd);
      el.setSelectionRange(s + 1, s + 1);
      onInput(el);
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const all = e.ctrlKey || e.metaKey;
      if (App.commitEdit({ all })) { if (!all) App.moveAfterEnter(e.shiftKey ? -1 : 1, 0); }
      return true;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (App.commitEdit()) App.moveAfterEnter(0, e.shiftKey ? -1 : 1);
      return true;
    }
    if (e.key === 'F4') {
      e.preventDefault();
      const t = el.value;
      if (t[0] !== '=') return true;
      const res = F.cycleAbs(t.slice(1), el.selectionStart - 1);
      if (res) { el.value = '=' + res.text; el.setSelectionRange(res.caret + 1, res.caret + 1); (el === editor ? fbar : editor).value = el.value; if (ed.point) ed.point.end = res.caret + 1; updateRefs(); }
      return true;
    }
    if (e.key === 'F2') { e.preventDefault(); ed.mode = ed.mode === 'edit' ? 'enter' : 'edit'; $('#sb-mode').textContent = ed.mode === 'edit' ? 'Bewerken' : 'Invoeren'; return true; }
    if (e.key === 'F3' && e.shiftKey) { e.preventDefault(); App.exec('insertFunction'); return true; }
    if (/^Arrow/.test(e.key) && ed.mode === 'enter' && el === editor || (/^Arrow/.test(e.key) && App.canPoint() && ed.mode === 'enter')) {
      if (App.canPoint()) {
        e.preventDefault();
        const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0, dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const base = ed.point ? ed.point : null;
        let g;
        if (base && base.sheet === App.sh()) {
          const cur = base.cur || { r: base.g.r2, c: base.g.c2 };
          const anchor = base.anchor || { r: base.g.r1, c: base.g.c1 };
          const nr = App.clamp(cur.r + dr, 0, App.MAXR - 1), nc = App.clamp(cur.c + dc, 0, App.MAXC - 1);
          g = e.shiftKey ? App.norm({ r1: anchor.r, c1: anchor.c, r2: nr, c2: nc }) : { r1: nr, c1: nc, r2: nr, c2: nc };
          App.pointInsert(g, true);
          ed.point.cur = { r: nr, c: nc }; ed.point.anchor = e.shiftKey ? anchor : { r: nr, c: nc };
          App.scrollToCell(nr, nc);
        } else {
          const nr = App.clamp(ed.r + dr, 0, App.MAXR - 1), nc = App.clamp(ed.c + dc, 0, App.MAXC - 1);
          g = { r1: nr, c1: nc, r2: nr, c2: nc };
          App.pointInsert(g);
          ed.point.cur = { r: nr, c: nc }; ed.point.anchor = { r: nr, c: nc };
          App.scrollToCell(nr, nc);
        }
        return true;
      }
      if (ed.mode === 'enter' && el === editor) {
        e.preventDefault();
        const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0, dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (App.commitEdit()) App.move(dr, dc, false);
        return true;
      }
    }
    if (/^Arrow/.test(e.key)) { ed.point = null; setTimeout(showFnAc, 0); }
    // Ctrl+Z tijdens bewerken: standaard tekstgedrag
    return false;
  };
  fbar.addEventListener('keydown', (e) => {
    if (App.state.editing) { if (onEditKey(e)) e.stopPropagation(); return; }
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); App.focusGrid(); }
  });

  /* ---------- Bewegen ---------- */
  const skipHiddenR = (r, dr) => { const sh = App.sh(); let k = 0; while (r >= 0 && r < App.MAXR && App.rowHidden(r, sh) && k++ < 100000) r += dr || 1; return App.clamp(r, 0, App.MAXR - 1); };
  const skipHiddenC = (c, dc) => { const sh = App.sh(); let k = 0; while (c >= 0 && c < App.MAXC && App.colHidden(c, sh) && k++ < 20000) c += dc || 1; return App.clamp(c, 0, App.MAXC - 1); };
  App.move = (dr, dc, extend, jump) => {
    const sh = App.sh();
    const s = sh.sel;
    if (extend) {
      if (s.er === undefined || !App.inRange(s.ranges[s.ri], s.er, s.ec)) {
        const g = s.ranges[s.ri];
        s.er = g.r1 === s.ar ? g.r2 : g.r1; s.ec = g.c1 === s.ac ? g.c2 : g.c1;
      }
      let r = s.er, c = s.ec;
      if (jump) { const p = edgeJump(r, c, dr, dc); r = p.r; c = p.c; }
      else { r = skipHiddenR(App.clamp(r + dr, 0, App.MAXR - 1), dr); c = skipHiddenC(App.clamp(c + dc, 0, App.MAXC - 1), dc); }
      s.er = r; s.ec = c;
      s.ranges[s.ri] = App.expandMerges(sh, App.norm({ r1: s.ar, c1: s.ac, r2: r, c2: c }));
      App.scrollToCell(r, c);
      App.selChanged();
      return;
    }
    let r = s.ar, c = s.ac;
    const m = App.mergeAt(sh, r, c);
    if (jump) { const p = edgeJump(r, c, dr, dc); r = p.r; c = p.c; }
    else {
      if (m) { if (dr > 0) r = m.r2; if (dc > 0) c = m.c2; }
      r = skipHiddenR(App.clamp(r + dr, 0, App.MAXR - 1), dr); c = skipHiddenC(App.clamp(c + dc, 0, App.MAXC - 1), dc);
    }
    s.er = undefined;
    App.selectCell(r, c);
    App.scrollToCell(r, c);
  };
  // Ctrl+pijl: naar de rand van het gegevensblok
  const edgeJump = (r, c, dr, dc) => {
    const sh = App.sh();
    const filled = (rr, cc) => App.hasValue(App.getCell(sh, rr, cc));
    const ext = App.extent(sh);
    const limR = dr > 0 ? App.MAXR - 1 : 0, limC = dc > 0 ? App.MAXC - 1 : 0;
    const inside = (rr, cc) => rr >= 0 && cc >= 0 && rr < App.MAXR && cc < App.MAXC;
    let rr = r, cc = c;
    const next = () => { rr += dr; cc += dc; };
    const beyond = () => (dr > 0 && rr > ext.r) || (dc > 0 && cc > ext.c);
    if (filled(r, c) && inside(r + dr, c + dc) && filled(r + dr, c + dc)) {
      while (inside(rr + dr, cc + dc) && filled(rr + dr, cc + dc)) next();
      return { r: rr, c: cc };
    }
    next();
    while (inside(rr, cc) && !filled(rr, cc)) {
      if (beyond()) return { r: dr ? limR : r, c: dc ? limC : c };
      next();
    }
    if (!inside(rr, cc)) return { r: dr ? limR : r, c: dc ? limC : c };
    return { r: rr, c: cc };
  };
  App.extendSel = (r, c) => {
    const sh = App.sh(); const s = sh.sel;
    s.er = r; s.ec = c;
    s.ranges[s.ri] = App.expandMerges(sh, App.norm({ r1: s.ar, c1: s.ac, r2: r, c2: c }));
    App.selChanged();
  };
  // Enter/Tab binnen een selectie
  App.state.tabStart = null;
  App.moveAfterEnter = (dr, dc) => {
    const sh = App.sh(); const s = sh.sel;
    const g = s.ranges[s.ri];
    const multi = s.ranges.length > 1 || g.r1 !== g.r2 || g.c1 !== g.c2;
    const m = App.mergeAt(sh, s.ar, s.ac);
    const isMergeOnly = m && m.r1 === g.r1 && m.c1 === g.c1 && m.r2 === g.r2 && m.c2 === g.c2 && s.ranges.length === 1;
    if (multi && !isMergeOnly) {
      let r = s.ar, c = s.ac;
      if (dr) { r += dr; if (r > g.r2) { r = g.r1; c++; if (c > g.c2) { s.ri = (s.ri + 1) % s.ranges.length; const n = s.ranges[s.ri]; r = n.r1; c = n.c1; } } if (r < g.r1) { r = g.r2; c--; if (c < g.c1) c = g.c2; } }
      if (dc) { c += dc; if (c > g.c2) { c = g.c1; r++; if (r > g.r2) { s.ri = (s.ri + 1) % s.ranges.length; const n = s.ranges[s.ri]; r = n.r1; c = n.c1; } } if (c < g.c1) { c = g.c2; r--; if (r < g.r1) r = g.r2; } }
      s.ar = r; s.ac = c;
      App.scrollToCell(r, c);
      App.selChanged();
      return;
    }
    if (dc) { if (App.state.tabStart === null) App.state.tabStart = s.ac; App.move(0, dc); return; }
    if (dr > 0 && App.state.tabStart !== null) { const c0 = App.state.tabStart; App.state.tabStart = null; App.selectCell(s.ar + 1, c0); App.scrollToCell(s.ar, c0); return; }
    App.state.tabStart = null;
    App.move(dr, 0);
  };

  /* ---------- Toetsenbord in het raster ---------- */
  editor.addEventListener('keydown', (e) => {
    if (App.state.editing) { if (onEditKey(e)) e.stopPropagation(); return; }
    if (e.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const go = (fn) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if (App.selectedObj && (k === 'Delete' || k === 'Backspace')) return go(() => App.exec('objDelete'));
    if (App.selectedObj && k === 'Escape') return go(() => App.deselectObj());
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { App.state.tabStart = null; return go(() => App.move(arrows[k][0], arrows[k][1], e.shiftKey, mod)); }
    if (k === 'Enter') return go(() => App.moveAfterEnter(e.shiftKey ? -1 : 1, 0));
    if (k === 'Tab') return go(() => App.moveAfterEnter(0, e.shiftKey ? -1 : 1));
    if (k === 'Home') {
      const sh = App.sh();
      if (mod) return go(() => { const r = sh.freeze.r || 0, c = sh.freeze.c || 0; if (e.shiftKey) App.extendSel(r, c); else { App.selectCell(r, c); } App.scrollToCell(r, c); });
      return go(() => { const s = sh.sel; if (e.shiftKey) App.extendSel(s.er ?? s.ar, 0); else App.selectCell(s.ar, 0); App.scrollToCell(s.ar, 0); });
    }
    if (k === 'End' && mod) return go(() => { const ex = App.extent(App.sh()); if (e.shiftKey) App.extendSel(ex.r, ex.c); else App.selectCell(ex.r, ex.c); App.scrollToCell(ex.r, ex.c); });
    if (k === 'PageDown' || k === 'PageUp') {
      if (mod) return go(() => App.exec(k === 'PageDown' ? 'sheetNext' : 'sheetPrev'));
      const V = App.view;
      const rows = Math.max(1, Math.floor((V.H - V.HH - V.FH) / App.sh().defH) - 1);
      if (e.altKey) return go(() => App.move(0, (k === 'PageDown' ? 1 : -1) * Math.max(1, Math.floor((V.W - V.HW) / App.sh().defW) - 1), e.shiftKey));
      return go(() => { App.move((k === 'PageDown' ? 1 : -1) * rows, 0, e.shiftKey); $('#grid-scroll').scrollTop += (k === 'PageDown' ? 1 : -1) * rows * App.sh().defH * V.z; });
    }
    if (k === 'F2') {
      if (e.shiftKey) return go(() => App.exec('newNote'));
      return go(() => App.startEdit({ mode: 'edit' }));
    }
    if (k === 'Delete') return go(() => App.exec('clear', 'contents'));
    if (k === 'Backspace') return go(() => { App.exec('clearActive'); App.startEdit({ mode: 'enter', initial: '' }); });
    if (k === 'Escape') { if (App.state.clip) { App.state.clip = null; App.scheduleRender(); } if (App.state.painter) { App.state.painter = null; App.scheduleState(); } App.traceArrows = null; return; }
    if (k === ' ' && mod && !e.shiftKey) return go(() => { const s = App.sh().sel; const g = s.ranges[s.ri]; App.setSel({ r1: 0, c1: g.c1, r2: App.MAXR - 1, c2: g.c2 }, s.ar, s.ac); });
    if (k === ' ' && e.shiftKey && !mod) return go(() => { const s = App.sh().sel; const g = s.ranges[s.ri]; App.setSel({ r1: g.r1, c1: 0, r2: g.r2, c2: App.MAXC - 1 }, s.ar, s.ac); });
    if (k === ' ' && e.shiftKey && mod) return go(() => App.exec('selectAll'));
    if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) return go(() => { const a = App.rangeScreenRect(App.selRange()); const wr = $('#grid-scroll').getBoundingClientRect(); App.openGridMenu({ clientX: wr.left + a.x + 20, clientY: wr.top + a.y + 10 }, { area: 'cell' }); });
  });

  /* ---------- Globale sneltoetsen ---------- */
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const inField = e.target.matches('input, textarea, select') && e.target !== editor && e.target !== fbar;
    const go = (cmd, arg) => { e.preventDefault(); App.exec(cmd, arg); };
    if (e.key === 'Escape') {
      if (App.popup) { App.closePopup(); return; }
      if ($('#backstage')) { App.exec('closeBackstage'); return; }
      if (!$('#find-panel').hidden && !App.state.editing) { App.exec('closeFind'); return; }
    }
    if ($('.backdrop') || $('#backstage')) { if (mod && k === 's') go('save'); return; }
    if (e.key === 'F1' && mod) return go('toggleRibbon');
    if (e.key === 'F1') return go('showShortcuts');
    if (e.key === 'F9') return go('calcNow');
    if (e.key === 'F7') return go('spellCheck');
    if (e.key === 'F5' && !mod) return go('gotoDialog');
    if (e.key === 'F11' && e.shiftKey) return go('addSheet');
    if (e.key === 'F3' && e.shiftKey && !App.state.editing) return go('insertFunction');
    if (e.altKey && k === 'q') { e.preventDefault(); $('#cmd-search').focus(); return; }
    if (e.altKey && (e.key === '=' || e.code === 'Equal') && !App.state.editing) return go('autoSum', 'SUM');
    if (!mod) return;
    if (k === 's' && !e.shiftKey) return go('save');
    if (k === 'o') return go('openBackstage', 'open');
    if (k === 'n' && !e.shiftKey && !e.altKey) return go('newBook');
    if (k === 'p') return go('print');
    if (inField) return;
    if (App.state.editing) {
      // tijdens bewerken alleen opmaak-sneltoetsen voor de hele cel
      return;
    }
    if (k === 'f' && !e.altKey) return go('find');
    if (k === 'h') return go('replace');
    if (k === 'g') return go('gotoDialog');
    if (k === 'z' && !e.shiftKey) return go('undo');
    if (k === 'y' || (k === 'z' && e.shiftKey)) return go('redo');
    if (k === 'k') return go('link');
    if (k === 't' || k === 'l' && !e.shiftKey) return go('formatAsTable', 'medium2');
    if (e.shiftKey) {
      if (k === 'l') return go('toggleFilter');
      if (e.key === '$' || e.code === 'Digit4') return go('numFormatPreset', 'currency');
      if (e.key === '%' || e.code === 'Digit5') return go('numFormatPreset', 'percent');
      if (e.key === '!' || e.code === 'Digit1') return go('numFormatPreset', 'comma');
      if (e.key === '#' || e.code === 'Digit3') return go('numFormatCustom', 'd-mmm-yy');
      if (e.key === '@' || e.code === 'Digit2') return go('numFormatCustom', 'h:mm');
      if (e.key === '~' || e.code === 'Backquote') return go('numFormatPreset', 'General');
      if (e.key === '^' || e.code === 'Digit6') return go('numFormatPreset', 'scientific');
      if (e.key === '&' || e.code === 'Digit7') return go('border', 'outer');
      if (e.key === '_' || e.code === 'Minus') return go('border', 'none');
      if (e.key === ':' || e.key === ';' || e.code === 'Semicolon') return go('insertTime');
      if (e.key === '>' || e.code === 'Period') return go('growFont');
      if (e.key === '<' || e.code === 'Comma') return go('shrinkFont');
      if (e.key === '+' || e.code === 'Equal') return go('insertCellsDialog');
      if (e.key === '*' || e.code === 'Digit8') return go('selectRegion');
      return;
    }
    if (e.altKey && k === 'v') return go('pasteSpecialDialog');
    if (e.altKey) return;
    const map = { b: 'bold', i: 'italic', u: 'underline', '1': 'formatCells', '5': 'strike', d: 'fillDown', r: 'fillRight', '9': 'hideRows', '0': 'hideCols', a: 'selectAll' };
    if (e.code === 'Digit1') return go('formatCells');
    if (e.code === 'Digit5') return go('strike');
    if (e.code === 'Digit9') return go('hideRows');
    if (e.code === 'Digit0') return go('hideCols');
    if (e.key === ';') return go('insertDate');
    if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') return go('deleteCellsDialog');
    if (e.key === '+' || e.code === 'NumpadAdd') return go('insertCellsDialog');
    if (e.key === '`' || e.code === 'Backquote') return go('toggleShowFormulas');
    if (map[k]) return go(map[k]);
  });

  /* ---------- Klembord ---------- */
  const cellClone = (cell) => {
    if (!cell) return null;
    const o = {};
    if (cell.v !== undefined) o.v = cell.v;
    if (cell.f) o.f = cell.f;
    if (cell.s) o.s = JSON.parse(JSON.stringify(cell.s));
    if (cell.n) o.n = cell.n;
    if (cell.l) o.l = cell.l;
    if (cell.f) o.cv = cell.cv;
    return o;
  };
  const tsvOf = (sh, g) => {
    const rows = [];
    for (let r = g.r1; r <= g.r2; r++) {
      if (App.rowHidden(r, sh)) continue;
      const row = [];
      for (let c = g.c1; c <= g.c2; c++) {
        if (App.colHidden(c, sh)) continue;
        const cell = App.getCell(sh, r, c);
        let t = '';
        if (cell && App.hasValue(cell)) t = NF.format(App.valueOf(cell), App.styleAt(sh, r, c, cell).nf).text.trim();
        if (/[\t\n"]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        row.push(t);
      }
      rows.push(row.join('\t'));
    }
    return rows.join('\r\n') + '\r\n';
  };
  const htmlOf = (sh, g) => {
    let h = '<table style="border-collapse:collapse">';
    for (let r = g.r1; r <= g.r2; r++) {
      if (App.rowHidden(r, sh)) continue;
      h += '<tr>';
      for (let c = g.c1; c <= g.c2; c++) {
        if (App.colHidden(c, sh)) continue;
        const cell = App.getCell(sh, r, c);
        const st = App.styleAt(sh, r, c, cell);
        const css = [];
        if (st.b) css.push('font-weight:bold'); if (st.i) css.push('font-style:italic'); if (st.u) css.push('text-decoration:underline');
        if (st.color) css.push('color:' + st.color); if (st.fill) css.push('background:' + st.fill);
        if (st.ha) css.push('text-align:' + st.ha);
        const v = cell ? App.valueOf(cell) : null;
        const txt = cell && App.hasValue(cell) ? NF.format(v, st.nf).text : '';
        h += `<td style="${css.join(';')}">${App.esc(txt)}</td>`;
      }
      h += '</tr>';
    }
    return h + '</table>';
  };
  App.copySel = (cut) => {
    const sh = App.sh();
    if (App.selRanges().length > 1) { App.toast('Deze opdracht kan niet worden gebruikt voor meerdere selecties.', 'info'); return null; }
    const g = App.selBounded(App.selRange());
    const cells = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const row = [];
      for (let c = g.c1; c <= g.c2; c++) row.push(cellClone(App.getCell(sh, r, c)));
      cells.push(row);
    }
    const widths = []; for (let c = g.c1; c <= g.c2; c++) widths.push(sh.colW[c]);
    const merges = sh.merges.filter((m) => m.r1 >= g.r1 && m.r2 <= g.r2 && m.c1 >= g.c1 && m.c2 <= g.c2).map((m) => ({ r1: m.r1 - g.r1, c1: m.c1 - g.c1, r2: m.r2 - g.r1, c2: m.c2 - g.c1 }));
    const text = tsvOf(sh, g);
    App.state.clip = { sheet: sh, g, cut: !!cut, cells, widths, merges, text, html: htmlOf(sh, g) };
    App.scheduleRender();
    return App.state.clip;
  };
  const normText = (t) => (t || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  // systeemklembord: kopiëren/knippen/plakken-gebeurtenissen op de verborgen editor
  editor.addEventListener('copy', (e) => {
    if (App.state.editing) return;
    e.preventDefault();
    const c = App.copySel(false); if (!c) return;
    e.clipboardData.setData('text/plain', c.text);
    e.clipboardData.setData('text/html', c.html);
  });
  editor.addEventListener('cut', (e) => {
    if (App.state.editing) return;
    e.preventDefault();
    const c = App.copySel(true); if (!c) return;
    e.clipboardData.setData('text/plain', c.text);
    e.clipboardData.setData('text/html', c.html);
  });
  editor.addEventListener('paste', (e) => {
    if (App.state.editing) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    const files = Array.from(e.clipboardData.files || []).filter((f) => /^image\//.test(f.type));
    if (files.length && !text) { App.insertImageFile && App.insertImageFile(files[0]); return; }
    App.exec('pasteData', { text, html });
  });
  App.def('copy', () => {
    const c = App.copySel(false); if (!c) return;
    writeClipboard(c);
  });
  App.def('cut', () => {
    const c = App.copySel(true); if (!c) return;
    writeClipboard(c);
  });
  const writeClipboard = (c) => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([c.text], { type: 'text/plain' }), 'text/html': new Blob([c.html], { type: 'text/html' }) })]).catch(() => navigator.clipboard.writeText(c.text).catch(() => {}));
      } else if (navigator.clipboard) navigator.clipboard.writeText(c.text).catch(() => {});
    } catch { /* intern klembord blijft werken */ }
  };
  App.def('paste', async () => {
    let text = null, html = null;
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
          if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
          const img = it.types.find((t) => /^image\//.test(t));
          if (img && !text) { App.insertImageFile && App.insertImageFile(await it.getType(img)); return; }
        }
      } else if (navigator.clipboard) text = await navigator.clipboard.readText();
    } catch { /* geen toegang tot systeemklembord */ }
    if (text === null && App.state.clip) text = App.state.clip.text;
    if (text === null) { App.toast('Plakken: gebruik Ctrl+V (de browser geeft geen toegang tot het klembord via deze knop).', 'info', { ms: 4000 }); return; }
    App.exec('pasteData', { text, html });
  });

  // Tekst met tabs en aanhalingstekens (Excel/CSV-stijl) opsplitsen
  App.parseDelimited = (text, delim = '\t') => {
    const rows = [];
    let row = [], cur = '', q = false, i = 0;
    text = text.replace(/\r\n?/g, '\n');
    while (i < text.length) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i += 2; continue; } q = false; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === '"' && cur === '') { q = true; i++; continue; }
      if (ch === delim) { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += ch; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };
  const htmlTable = (html) => {
    if (!html || !/<table/i.test(html)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const t = doc.querySelector('table'); if (!t) return null;
    const out = [];
    Array.from(t.rows).forEach((tr, ri) => {
      out[ri] = out[ri] || [];
      let ci = 0;
      Array.from(tr.cells).forEach((td) => {
        while (out[ri][ci] !== undefined) ci++;
        const st = {};
        const cs = td.getAttribute('style') || '';
        const b = td.querySelector('b,strong') || /font-weight:\s*(bold|[6-9]00)/i.test(cs);
        if (b) st.b = true;
        if (td.querySelector('i,em') || /font-style:\s*italic/i.test(cs)) st.i = true;
        const col = /(?:^|;)\s*color:\s*([^;]+)/i.exec(cs); if (col) st.color = toHex(col[1]);
        const bg = /background(?:-color)?:\s*([^;]+)/i.exec(cs); if (bg) st.fill = toHex(bg[1]);
        const ta = /text-align:\s*(left|center|right)/i.exec(cs); if (ta) st.ha = ta[1].toLowerCase();
        Object.keys(st).forEach((k) => { if (!st[k]) delete st[k]; });
        const text = td.innerText !== undefined ? td.textContent.replace(/ /g, ' ') : '';
        const rs = +td.rowSpan || 1, cspan = +td.colSpan || 1;
        out[ri][ci] = { text: text.trim(), st, rs, cs: cspan };
        for (let a = 0; a < rs; a++) for (let b2 = 0; b2 < cspan; b2++) if (a || b2) { out[ri + a] = out[ri + a] || []; out[ri + a][ci + b2] = null; }
        ci += cspan;
      });
    });
    return out;
  };
  const cvs = document.createElement('canvas').getContext('2d');
  const toHex = (c) => { if (!c || /transparent|inherit|windowtext|initial/i.test(c)) return null; cvs.fillStyle = '#000'; cvs.fillStyle = c.trim(); const v = cvs.fillStyle; if (v.startsWith('#')) return v === '#000000' && !/^#?0{3,6}$|black|rgb\(0,\s*0,\s*0\)/i.test(c) ? null : v; const m = v.match(/[\d.]+/g); if (!m || (m[3] !== undefined && +m[3] < 0.05)) return null; return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join(''); };
  App.cssToHex = toHex;

  App.defEdit('pasteData', ({ text, html }) => {
    const sh = App.sh();
    const clip = App.state.clip;
    const dest = App.selRange();
    if (clip && normText(text) === normText(clip.text)) return pasteInternal(clip, dest, 'all');
    const tbl = htmlTable(html);
    let grid;
    if (tbl && tbl.length) grid = tbl.map((row) => row.map((x) => x));
    else {
      const rows = App.parseDelimited(text || '', '\t');
      if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
      grid = rows.map((row) => row.map((t) => ({ text: t })));
    }
    if (!grid.length) return false;
    const r0 = dest.r1, c0 = dest.c1;
    grid.forEach((row, i) => row.forEach((x, j) => {
      if (!x) return;
      const r = r0 + i, c = c0 + j;
      App.setCellFromText(sh, r, c, x.text, { autoLink: true });
      if (x.st && Object.keys(x.st).length) { const cell = App.cellAt(sh, r, c); cell.s = { ...(cell.s || {}), ...x.st }; }
      if (x.rs > 1 || x.cs > 1) App.addMerge(sh, { r1: r, c1: c, r2: r + x.rs - 1, c2: c + x.cs - 1 });
    }));
    const h = grid.length, w = Math.max(...grid.map((r) => r.length));
    App.setSel({ r1: r0, c1: c0, r2: r0 + h - 1, c2: c0 + w - 1 }, r0, c0);
    App.growTo(r0 + h, c0 + w);
    return true;
  });
  const pasteInternal = (clip, dest, mode, opts = {}) => {
    const sh = App.sh();
    const src = clip.sheet;
    const H = clip.cells.length, W = clip.cells[0].length;
    const transpose = opts.transpose;
    const ph = transpose ? W : H, pw = transpose ? H : W;
    // vaker plakken als de selectie een veelvoud is
    const dh = dest.r2 - dest.r1 + 1, dw = dest.c2 - dest.c1 + 1;
    const tilesR = dh % ph === 0 && dh > ph ? dh / ph : 1, tilesC = dw % pw === 0 && dw > pw ? dw / pw : 1;
    if (clip.cut && (sh.protect)) return false;
    const r0 = dest.r1, c0 = dest.c1;
    // overlap met samengevoegde cellen opheffen
    const target = { r1: r0, c1: c0, r2: r0 + ph * tilesR - 1, c2: c0 + pw * tilesC - 1 };
    if (mode === 'all' || mode === 'formats') sh.merges = sh.merges.filter((m) => !App.rangesOverlap(m, target));
    if (clip.cut) {
      // verplaatsen: bron leegmaken en verwijzingen bijwerken
      const moved = [];
      for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) moved.push({ i, j, cell: clip.cells[i][j] });
      for (let r = clip.g.r1; r <= clip.g.r2; r++) for (let c = clip.g.c1; c <= clip.g.c2; c++) App.delCell(src, r, c);
      src.merges = src.merges.filter((m) => !(m.r1 >= clip.g.r1 && m.r2 <= clip.g.r2 && m.c1 >= clip.g.c1 && m.c2 <= clip.g.c2));
      const dr = r0 - clip.g.r1, dc = c0 - clip.g.c1;
      moved.forEach(({ i, j, cell }) => {
        const r = r0 + i, c = c0 + j;
        App.delCell(sh, r, c);
        if (cell) { const n = cellClone(cell); delete n.cv; const row = sh.data.get(r) || new Map(); sh.data.set(r, row); row.set(c, n); }
      });
      clip.merges.forEach((m) => sh.merges.push({ r1: m.r1 + r0, c1: m.c1 + c0, r2: m.r2 + r0, c2: m.c2 + c0 }));
      // verwijzingen in de hele werkmap
      const srcArea = { sheet: src.name, ...clip.g }, dstArea = { sheet: sh.name };
      App.book.sheets.forEach((s) => App.eachCell(s, (r, c, cell) => { if (cell.f) cell.f = F.moveRefs(cell.f, s.name, srcArea, dstArea, dr, dc); }));
      App.touchAll();
      App.state.clip = null;
      App.setSel({ r1: r0, c1: c0, r2: r0 + H - 1, c2: c0 + W - 1 }, r0, c0);
      return true;
    }
    for (let tr = 0; tr < tilesR; tr++) for (let tc = 0; tc < tilesC; tc++) {
      for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
        const cell = clip.cells[i][j];
        const ii = transpose ? j : i, jj = transpose ? i : j;
        const r = r0 + tr * ph + ii, c = c0 + tc * pw + jj;
        const srcR = clip.g.r1 + i, srcC = clip.g.c1 + j;
        const existing = App.getCell(sh, r, c);
        if (opts.skipBlanks && !(cell && App.hasValue(cell))) continue;
        if (mode === 'all' || mode === 'noborders') {
          App.delCell(sh, r, c);
          if (cell) {
            const n = cellClone(cell); delete n.cv;
            if (n.f) n.f = F.shift(n.f, r - srcR, c - srcC);
            if (mode === 'noborders' && n.s) delete n.s.bd;
            const row = sh.data.get(r) || new Map(); sh.data.set(r, row); row.set(c, n);
          }
        } else if (mode === 'values') {
          const v = cell ? (cell.f ? cell.cv : cell.v) : null;
          const n = App.cellAt(sh, r, c);
          delete n.f; delete n.cv;
          if (v === null || v === undefined || (typeof v === 'object' && v.err)) { if (v && v.err) n.v = v.err; else delete n.v; } else n.v = v;
          if (cell && cell.s && cell.s.nf && !(existing && existing.s && existing.s.nf)) n.s = { ...(n.s || {}), nf: cell.s.nf };
          App.cleanCell(sh, r, c);
        } else if (mode === 'formulas') {
          const n = App.cellAt(sh, r, c);
          delete n.v; delete n.f; delete n.cv;
          if (cell && cell.f) n.f = F.shift(cell.f, r - srcR, c - srcC); else if (cell && cell.v !== undefined) n.v = cell.v;
          App.cleanCell(sh, r, c);
        } else if (mode === 'formats') {
          const n = App.cellAt(sh, r, c);
          if (cell && cell.s) n.s = JSON.parse(JSON.stringify(cell.s)); else delete n.s;
          App.cleanCell(sh, r, c);
        } else if (mode === 'op') {
          const n = App.cellAt(sh, r, c);
          const a = typeof App.valueOf(n) === 'number' ? App.valueOf(n) : 0;
          const b = cell ? App.valueOf(cell) : 0;
          if (typeof b === 'number') { n.v = opts.op === 'add' ? a + b : opts.op === 'sub' ? a - b : opts.op === 'mul' ? a * b : b ? a / b : a; delete n.f; }
        }
      }
      if (mode === 'all') clip.merges.forEach((m) => { const mm = transpose ? { r1: m.c1, c1: m.r1, r2: m.c2, c2: m.r2 } : m; sh.merges.push({ r1: mm.r1 + r0 + tr * ph, c1: mm.c1 + c0 + tc * pw, r2: mm.r2 + r0 + tr * ph, c2: mm.c2 + c0 + tc * pw }); });
    }
    if (mode === 'widths' || opts.widths) clip.widths.forEach((w, j) => { if (w !== undefined) sh.colW[c0 + j] = w; else delete sh.colW[c0 + j]; });
    App.setSel({ r1: r0, c1: c0, r2: r0 + ph * tilesR - 1, c2: c0 + pw * tilesC - 1 }, r0, c0);
    App.growTo(r0 + ph * tilesR, c0 + pw * tilesC);
    return true;
  };
  App.defEdit('pasteSpecial', (mode) => {
    const clip = App.state.clip;
    if (!clip) { App.toast('Kopieer eerst cellen in Cel om Plakken speciaal te gebruiken.', 'info'); return false; }
    if (clip.cut && mode !== 'all') { App.toast('Plakken speciaal werkt niet na knippen.', 'info'); return false; }
    const dest = App.selRange();
    if (mode === 'transpose') return pasteInternal(clip, dest, 'all', { transpose: true });
    if (mode === 'widths') return pasteInternal(clip, dest, 'widths');
    return pasteInternal(clip, dest, mode);
  });
  App.def('pasteSpecialDialog', () => {
    if (!App.state.clip) { App.toast('Kopieer eerst cellen in Cel om Plakken speciaal te gebruiken.', 'info'); return; }
    App.dialog({
      title: 'Plakken speciaal',
      body: `<div class="fields-2"><div><b class="small">Plakken</b>
        ${[['all', 'Alles'], ['formulas', 'Formules'], ['values', 'Waarden'], ['formats', 'Opmaak'], ['noborders', 'Alles behalve randen'], ['widths', 'Kolombreedten']].map(([v, l], k) => `<label class="chk"><input type="radio" name="ps-mode" value="${v}" ${k === 0 ? 'checked' : ''}> ${l}</label>`).join('')}
        </div><div><b class="small">Bewerking</b>
        ${[['none', 'Geen'], ['add', 'Optellen'], ['sub', 'Aftrekken'], ['mul', 'Vermenigvuldigen'], ['div', 'Delen']].map(([v, l], k) => `<label class="chk"><input type="radio" name="ps-op" value="${v}" ${k === 0 ? 'checked' : ''}> ${l}</label>`).join('')}
        </div></div>
        <div class="checks" style="margin-top:10px"><label><input type="checkbox" id="ps-skip"> Lege cellen overslaan</label><label><input type="checkbox" id="ps-tr"> Transponeren</label></div>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const mode = d.$('input[name=ps-mode]:checked').value, op = d.$('input[name=ps-op]:checked').value;
          const opts = { skipBlanks: d.$('#ps-skip').checked, transpose: d.$('#ps-tr').checked };
          App.run(() => pasteInternal(App.state.clip, App.selRange(), op !== 'none' ? 'op' : mode, { ...opts, op }));
        },
      }],
    });
  });

  /* ---------- Wissen ---------- */
  App.defEdit('clear', (what = 'contents') => {
    const sh = App.sh();
    App.selRanges().forEach((g0) => {
      const g = App.selBounded(g0);
      if (what === 'formats' || what === 'all') {
        if (App.isFullCol(g0)) for (let c = g0.c1; c <= g0.c2; c++) delete sh.colS[c];
        if (App.isFullRow(g0)) for (let r = g0.r1; r <= g0.r2; r++) delete sh.rowS[r];
        sh.merges = sh.merges.filter((m) => !App.rangesOverlap(m, g));
      }
      const list = [];
      App.eachInRange(sh, g, (r, c) => list.push([r, c]));
      list.forEach(([r, c]) => {
        const cell = App.getCell(sh, r, c);
        if (what === 'all') { App.delCell(sh, r, c); return; }
        if (what === 'contents') { delete cell.v; delete cell.f; delete cell.cv; }
        if (what === 'formats') delete cell.s;
        if (what === 'notes') delete cell.n;
        if (what === 'links') { delete cell.l; }
        App.cleanCell(sh, r, c);
      });
      if (what === 'all' || what === 'formats') { sh.cf = sh.cf.filter((rule) => !rule.ranges.every((rg) => App.inRange(g, rg.r1, rg.c1) && App.inRange(g, rg.r2, rg.c2))); }
    });
    return true;
  });
  App.defEdit('clearActive', () => {
    const sh = App.sh(); const s = sh.sel;
    const cell = App.getCell(sh, s.ar, s.ac);
    if (cell) { delete cell.v; delete cell.f; App.cleanCell(sh, s.ar, s.ac); }
  });

  /* ---------- Doorvoeren ---------- */
  const NL_LISTS = [
    NF.MONTHS, NF.MONTHS_S, NF.DAYS.slice(1).concat(NF.DAYS[0]), NF.DAYS_S.slice(1).concat(NF.DAYS_S[0]),
    ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    ['kwartaal 1', 'kwartaal 2', 'kwartaal 3', 'kwartaal 4'], ['q1', 'q2', 'q3', 'q4'], ['k1', 'k2', 'k3', 'k4'],
  ];
  const caseLike = (model, s) => (model === model.toUpperCase() ? s.toUpperCase() : model[0] === model[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s);
  // Reeks voor één lijn (kolom of rij) bepalen: geeft functie k -> cel (k = 0.. vanaf het einde van de bron)
  const seriesFor = (cells, srcPos, forward, copyOnly) => {
    const n = cells.length;
    const vals = cells.map((c) => (c && !c.f ? c.v : undefined));
    const allNum = n > 0 && vals.every((v) => typeof v === 'number') && cells.every((c) => c && !c.f);
    if (!copyOnly && allNum) {
      const isDate = cells.some((c) => c.s && c.s.nf && NF.isDateFmt(c.s.nf));
      if (n === 1 && !isDate) return null;
      // lineaire trend
      let step;
      if (n === 1) step = 1;
      else {
        const xs = vals.map((_, i) => i), mx = (n - 1) / 2, my = vals.reduce((a, b) => a + b, 0) / n;
        let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (vals[i] - my); sxx += (x - mx) ** 2; });
        step = sxy / sxx;
        // maanden/jaren bij datums met gelijke dag
        if (isDate && n >= 2) {
          const ds = vals.map((v) => NF.serialToDate(v));
          const sameDay = ds.every((d) => d.getUTCDate() === ds[0].getUTCDate());
          const mdiff = (ds[1].getUTCFullYear() - ds[0].getUTCFullYear()) * 12 + ds[1].getUTCMonth() - ds[0].getUTCMonth();
          if (sameDay && mdiff !== 0 && ds.every((d, i) => i === 0 || (d.getUTCFullYear() - ds[i - 1].getUTCFullYear()) * 12 + d.getUTCMonth() - ds[i - 1].getUTCMonth() === mdiff)) {
            const last = ds[forward ? n - 1 : 0];
            return (k) => { const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + (forward ? 1 : -1) * mdiff * (k + 1), Math.min(last.getUTCDate(), 28))); const want = last.getUTCDate(); const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(want, dim)); return { v: NF.dateToSerial(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }; };
          }
        }
        const icpt = my - step * mx;
        return (k) => ({ v: +((forward ? icpt + step * (n + k) : icpt - step * (k + 1))).toPrecision(15) });
      }
      const last = vals[forward ? n - 1 : 0];
      return (k) => ({ v: last + (forward ? 1 : -1) * step * (k + 1) });
    }
    if (!copyOnly && n >= 1 && cells.every((c) => c && !c.f && typeof c.v === 'string')) {
      // lijsten (maanden, dagen)
      for (const list of NL_LISTS) {
        const idx = vals.map((v) => list.indexOf(v.toLowerCase()));
        if (idx.every((i) => i >= 0)) {
          const step = n > 1 ? ((idx[1] - idx[0]) + list.length) % list.length || 1 : 1;
          const base = forward ? idx[n - 1] : idx[0];
          const model = vals[forward ? n - 1 : 0];
          return (k) => ({ v: caseLike(model, list[(((base + (forward ? 1 : -1) * step * (k + 1)) % list.length) + list.length) % list.length]) });
        }
      }
      // tekst met getal aan het eind
      const m = vals.map((v) => /^(.*?)(\d+)(\D*)$/.exec(v));
      if (m.every((x) => x) && m.every((x) => x[1] === m[0][1] && x[3] === m[0][3])) {
        const nums = m.map((x) => +x[2]);
        const step = n > 1 ? nums[1] - nums[0] : 1;
        const base = forward ? nums[n - 1] : nums[0];
        const pad = m[0][2].length;
        return (k) => { const v = base + (forward ? 1 : -1) * step * (k + 1); return { v: m[0][1] + String(Math.abs(v)).padStart(m[0][2].startsWith('0') ? pad : 0, '0') + m[0][3] }; };
      }
    }
    return null;
  };
  App.fillRange = (sh, src, dst, opts = {}) => {
    // richting
    let dir;
    if (dst.r2 > src.r2) dir = 'down'; else if (dst.r1 < src.r1) dir = 'up'; else if (dst.c2 > src.c2) dir = 'right'; else if (dst.c1 < src.c1) dir = 'left'; else return;
    const vertical = dir === 'down' || dir === 'up';
    const forward = dir === 'down' || dir === 'right';
    const lines = vertical ? [src.c1, src.c2] : [src.r1, src.r2];
    const n = vertical ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1;
    const count = vertical ? (forward ? dst.r2 - src.r2 : src.r1 - dst.r1) : (forward ? dst.c2 - src.c2 : src.c1 - dst.c1);
    for (let L = lines[0]; L <= lines[1]; L++) {
      const cells = [];
      for (let i = 0; i < n; i++) {
        const r = vertical ? src.r1 + i : L, c = vertical ? L : src.c1 + i;
        cells.push(App.getCell(sh, r, c));
      }
      const ser = opts.copy ? null : seriesFor(cells, 0, forward, false);
      for (let k = 0; k < count; k++) {
        const r = vertical ? (forward ? src.r2 + 1 + k : src.r1 - 1 - k) : L;
        const c = vertical ? L : (forward ? src.c2 + 1 + k : src.c1 - 1 - k);
        const si = forward ? k % n : (n - 1 - (k % n));
        const sr = vertical ? src.r1 + si : L, sc = vertical ? L : src.c1 + si;
        const scell = cells[si];
        App.delCell(sh, r, c);
        if (!scell) continue;
        const nc = cellClone(scell); delete nc.cv; delete nc.n;
        if (nc.f) nc.f = F.shift(nc.f, r - sr, c - sc);
        else if (ser) { const x = ser(k); nc.v = x.v; }
        if (opts.noFormat) delete nc.s;
        if (opts.formatOnly) { delete nc.v; delete nc.f; const ex = App.getCell(sh, r, c); if (ex) { nc.v = ex.v; nc.f = ex.f; } }
        const row = sh.data.get(r) || new Map(); sh.data.set(r, row); row.set(c, nc);
      }
    }
  };
  App.defEdit('fillDrag', ({ src, dst }) => {
    const sh = App.sh();
    if (dst.r2 < src.r2 || dst.c2 < src.c2) {
      // teruggesleept: cellen wissen
      if (dst.r2 < src.r2) for (let r = dst.r2 + 1; r <= src.r2; r++) for (let c = src.c1; c <= src.c2; c++) { const cell = App.getCell(sh, r, c); if (cell) { delete cell.v; delete cell.f; App.cleanCell(sh, r, c); } }
      else for (let c = dst.c2 + 1; c <= src.c2; c++) for (let r = src.r1; r <= src.r2; r++) { const cell = App.getCell(sh, r, c); if (cell) { delete cell.v; delete cell.f; App.cleanCell(sh, r, c); } }
      App.setSel(dst, dst.r1, dst.c1);
      return true;
    }
    App.fillRange(sh, src, dst);
    App.setSel(dst, sh.sel.ar, sh.sel.ac);
    App.state.lastFill = { src, dst };
    return true;
  });
  App.defEdit('fillDoubleClick', () => {
    const sh = App.sh();
    const src = App.selRange();
    // doorvoeren tot het einde van de aangrenzende kolom
    const adj = [src.c1 - 1, src.c2 + 1].filter((c) => c >= 0);
    let end = src.r2;
    adj.forEach((c) => { let r = src.r2 + 1; while (App.hasValue(App.getCell(sh, r, c))) r++; end = Math.max(end, r - 1); });
    if (end <= src.r2) return false;
    const dst = { ...src, r2: end };
    App.fillRange(sh, src, dst);
    App.setSel(dst, sh.sel.ar, sh.sel.ac);
    return true;
  });
  App.defEdit('fill', (dir) => {
    const sh = App.sh();
    App.selRanges().forEach((g) => {
      g = App.selBounded(g);
      if (dir === 'down' && g.r2 > g.r1) App.fillRange(sh, { ...g, r2: g.r1 }, g, { copy: true });
      if (dir === 'right' && g.c2 > g.c1) App.fillRange(sh, { ...g, c2: g.c1 }, g, { copy: true });
      if (dir === 'up' && g.r2 > g.r1) App.fillRange(sh, { ...g, r1: g.r2 }, g, { copy: true });
      if (dir === 'left' && g.c2 > g.c1) App.fillRange(sh, { ...g, c1: g.c2 }, g, { copy: true });
      // één cel geselecteerd: van de cel erboven/links
      if (g.r1 === g.r2 && dir === 'down' && g.r1 > 0) App.fillRange(sh, { ...g, r1: g.r1 - 1, r2: g.r1 - 1 }, { ...g, r1: g.r1 - 1 }, { copy: true });
      if (g.c1 === g.c2 && dir === 'right' && g.c1 > 0) App.fillRange(sh, { ...g, c1: g.c1 - 1, c2: g.c1 - 1 }, { ...g, c1: g.c1 - 1 }, { copy: true });
    });
    return true;
  });
  App.def('fillDown', () => App.exec('fill', 'down'));
  App.def('fillRight', () => App.exec('fill', 'right'));
  App.def('seriesDialog', () => {
    App.dialog({
      title: 'Reeks',
      body: `<div class="fields-2"><label class="field"><span>Reeks in</span><select id="se-dir"><option value="col">Kolommen</option><option value="row">Rijen</option></select></label>
        <label class="field"><span>Type</span><select id="se-type"><option value="lin">Lineair</option><option value="grow">Groei</option><option value="date">Datum (dagen)</option><option value="month">Datum (maanden)</option><option value="work">Datum (werkdagen)</option></select></label>
        <label class="field"><span>Interval</span><input id="se-step" value="1"></label><label class="field"><span>Eindwaarde (optioneel)</span><input id="se-stop"></label></div>
        <p class="muted small">Begint met de waarde in de eerste cel van de selectie en vult de rest van de selectie.</p>`,
      buttons: [{ label: 'Annuleren' }, {
        label: 'OK', primary: true, action: (d) => {
          const step = App.parseNum(d.$('#se-step').value) || 1;
          const stopS = d.$('#se-stop').value.trim(), stop = stopS ? App.parseNum(stopS) : null;
          const type = d.$('#se-type').value, byCol = d.$('#se-dir').value === 'col';
          App.run(() => {
            const sh = App.sh(); const g = App.selBounded(App.selRange());
            const lines = byCol ? [g.c1, g.c2] : [g.r1, g.r2];
            for (let L = lines[0]; L <= lines[1]; L++) {
              const first = byCol ? App.getCell(sh, g.r1, L) : App.getCell(sh, L, g.c1);
              let v = first && typeof first.v === 'number' ? first.v : 1;
              if (!first || typeof first.v !== 'number') { const c0 = App.cellAt(sh, byCol ? g.r1 : L, byCol ? L : g.c1); c0.v = 1; }
              const len = byCol ? g.r2 - g.r1 : g.c2 - g.c1;
              for (let k = 1; k <= len; k++) {
                if (type === 'lin') v += step; else if (type === 'grow') v *= step; else if (type === 'date') v += step;
                else if (type === 'month') { const dt = NF.serialToDate(v); v = NF.dateToSerial(dt.getUTCFullYear(), dt.getUTCMonth() + step, dt.getUTCDate()); }
                else if (type === 'work') { let left = step; while (left > 0) { v += 1; const wd = NF.serialToDate(v).getUTCDay(); if (wd !== 0 && wd !== 6) left--; } }
                if (stop !== null && (step > 0 ? v > stop : v < stop)) break;
                const cell = App.cellAt(sh, byCol ? g.r1 + k : L, byCol ? L : g.c1 + k);
                cell.v = v; delete cell.f;
                if (first && first.s) cell.s = { ...first.s };
              }
            }
          });
        },
      }],
    });
  });

  /* ---------- Verplaatsen (slepen) ---------- */
  App.defEdit('moveCells', ({ src, dst, copy }) => {
    const sh = App.sh();
    const H = src.r2 - src.r1 + 1, W = src.c2 - src.c1 + 1;
    const cells = [];
    for (let i = 0; i < H; i++) { const row = []; for (let j = 0; j < W; j++) row.push(cellClone(App.getCell(sh, src.r1 + i, src.c1 + j))); cells.push(row); }
    const hasData = (() => { for (let r = dst.r1; r <= dst.r2; r++) for (let c = dst.c1; c <= dst.c2; c++) if (!App.inRange(src, r, c) && App.hasValue(App.getCell(sh, r, c))) return true; return false; })();
    const doIt = () => {
      if (!copy) for (let r = src.r1; r <= src.r2; r++) for (let c = src.c1; c <= src.c2; c++) App.delCell(sh, r, c);
      const dr = dst.r1 - src.r1, dc = dst.c1 - src.c1;
      for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
        const r = dst.r1 + i, c = dst.c1 + j;
        App.delCell(sh, r, c);
        const cell = cells[i][j];
        if (!cell) continue;
        const n = cellClone(cell); delete n.cv;
        if (copy && n.f) n.f = F.shift(n.f, dr, dc);
        const row = sh.data.get(r) || new Map(); sh.data.set(r, row); row.set(c, n);
      }
      if (!copy) {
        sh.merges.forEach((m) => { if (m.r1 >= src.r1 && m.r2 <= src.r2 && m.c1 >= src.c1 && m.c2 <= src.c2) { m.r1 += dr; m.r2 += dr; m.c1 += dc; m.c2 += dc; } });
        App.book.sheets.forEach((s) => App.eachCell(s, (r, c, cell) => { if (cell.f) cell.f = F.moveRefs(cell.f, s.name, { sheet: sh.name, ...src }, { sheet: sh.name }, dr, dc); }));
        App.touchAll();
      }
      App.setSel(dst, dst.r1, dst.c1);
    };
    if (hasData) {
      return App.confirm('Cellen vervangen?', 'Er staan al gegevens op deze plek. Wil je die vervangen?', 'Vervangen').then((ok) => { if (!ok) return false; doIt(); return true; });
    }
    doIt();
    return true;
  });

  /* ---------- Rijen en kolommen invoegen/verwijderen ---------- */
  const shiftMapKeys = (obj, at, count) => {
    const out = {};
    Object.keys(obj).forEach((k) => {
      const i = +k;
      if (i < at) out[i] = obj[k];
      else if (count > 0) out[i + count] = obj[k];
      else if (i >= at - count) out[i + count] = obj[k];
    });
    return out;
  };
  App.shiftAxis = (sh, type, at, count, span) => {
    const isRow = type === 'row';
    // gegevens
    const nd = new Map();
    sh.data.forEach((row, r) => row.forEach((cell, c) => {
      let nr = r, nc = c;
      const inSpan = !span || (isRow ? c >= span.c1 && c <= span.c2 : r >= span.r1 && r <= span.r2);
      const pos = isRow ? r : c;
      if (inSpan && pos >= at) {
        if (count < 0 && pos < at - count) return;   // verwijderd
        if (isRow) nr = r + count; else nc = c + count;
      }
      if (nr >= App.MAXR || nc >= App.MAXC) return;
      let m = nd.get(nr); if (!m) { m = new Map(); nd.set(nr, m); }
      m.set(nc, cell);
    }));
    sh.data = nd;
    if (!span) {
      if (isRow) { ['rowH', 'rowManual', 'hidR', 'fhid', 'rowS'].forEach((k) => { sh[k] = shiftMapKeys(sh[k], at, count); }); }
      else { ['colW', 'hidC', 'colS'].forEach((k) => { sh[k] = shiftMapKeys(sh[k], at, count); }); }
    }
    // bereiken aanpassen
    const adjRange = (g) => {
      if (span && (isRow ? (g.c1 < span.c1 || g.c2 > span.c2) : (g.r1 < span.r1 || g.r2 > span.r2))) return g;
      let a = isRow ? g.r1 : g.c1, b = isRow ? g.r2 : g.c2;
      if (count > 0) { if (a >= at) a += count; if (b >= at) b += count; }
      else {
        const d1 = at, d2 = at - count - 1;
        if (a >= d1 && b <= d2) return null;
        if (a > d2) a += count; else if (a >= d1) a = d1;
        if (b > d2) b += count; else if (b >= d1) b = d1 - 1;
        if (b < a) return null;
      }
      return isRow ? { ...g, r1: a, r2: Math.min(b, App.MAXR - 1) } : { ...g, c1: a, c2: Math.min(b, App.MAXC - 1) };
    };
    sh.merges = sh.merges.map(adjRange).filter((m) => m && (m.r2 > m.r1 || m.c2 > m.c1));
    sh.cf.forEach((rule) => { rule.ranges = rule.ranges.map(adjRange).filter(Boolean); });
    sh.cf = sh.cf.filter((rule) => rule.ranges.length);
    sh.dv.forEach((rule) => { rule.ranges = rule.ranges.map(adjRange).filter(Boolean); });
    sh.dv = sh.dv.filter((rule) => rule.ranges.length);
    if (sh.filter) { const f = adjRange({ r1: sh.filter.r, c1: sh.filter.c1, r2: sh.filter.r2 ?? sh.filter.r, c2: sh.filter.c2 }); if (!f) sh.filter = null; else { if (!isRow && count && sh.filter.crit) { const nc = {}; Object.keys(sh.filter.crit).forEach((k) => { const c = +k; const n = c >= at ? c + count : c; if (count > 0 || c < at || c >= at - count) nc[n] = sh.filter.crit[k]; }); sh.filter.crit = nc; } Object.assign(sh.filter, { r: f.r1, c1: f.c1, c2: f.c2, r2: f.r2 }); } }
    if (sh.printArea) sh.printArea = adjRange(sh.printArea);
    sh.objs.forEach((o) => { if (isRow && o.r >= at) o.r = Math.max(at, o.r + count); if (!isRow && o.c >= at) o.c = Math.max(at, o.c + count); });
    // formules in de hele werkmap
    const op = { sheet: sh.name, type, at, count, span };
    App.book.sheets.forEach((s) => App.eachCell(s, (r, c, cell) => { if (cell.f) cell.f = F.adjust(cell.f, s.name, op); }));
    Object.keys(App.book.names).forEach((k) => { App.book.names[k] = F.adjust(App.book.names[k], sh.name, op); });
    App.book.sheets.forEach((s) => s.objs.forEach((o) => { if (o.type === 'chart' && o.range) o.range = F.adjust(o.range, s.name, op); }));
    sh.dv.forEach((rule) => { if (rule.list && rule.list[0] === '=') rule.list = '=' + F.adjust(rule.list.slice(1), sh.name, op); });
    sh._max = null;
    App.invalidateDims(sh);
    App.touchAll();
  };
  App.defEdit('insertRows', () => {
    const sh = App.sh();
    const ranges = [...App.selRanges()].sort((a, b) => b.r1 - a.r1);
    ranges.forEach((g) => App.shiftAxis(sh, 'row', g.r1, g.r2 - g.r1 + 1));
    return true;
  });
  App.defEdit('insertCols', () => {
    const sh = App.sh();
    const ranges = [...App.selRanges()].sort((a, b) => b.c1 - a.c1);
    ranges.forEach((g) => App.shiftAxis(sh, 'col', g.c1, g.c2 - g.c1 + 1));
    return true;
  });
  App.defEdit('deleteRows', () => {
    const sh = App.sh();
    const ranges = [...App.selRanges()].sort((a, b) => b.r1 - a.r1);
    ranges.forEach((g) => App.shiftAxis(sh, 'row', g.r1, -(g.r2 - g.r1 + 1)));
    const s = sh.sel; App.selectCell(Math.min(s.ar, App.MAXR - 1), s.ac);
    return true;
  });
  App.defEdit('deleteCols', () => {
    const sh = App.sh();
    const ranges = [...App.selRanges()].sort((a, b) => b.c1 - a.c1);
    ranges.forEach((g) => App.shiftAxis(sh, 'col', g.c1, -(g.c2 - g.c1 + 1)));
    const s = sh.sel; App.selectCell(s.ar, Math.min(s.ac, App.MAXC - 1));
    return true;
  });
  App.defEdit('insertCells', (how) => {
    const sh = App.sh(); const g = App.selRange();
    if (how === 'row' || App.isFullRow(g)) return App.shiftAxis(sh, 'row', g.r1, g.r2 - g.r1 + 1), true;
    if (how === 'col' || App.isFullCol(g)) return App.shiftAxis(sh, 'col', g.c1, g.c2 - g.c1 + 1), true;
    if (how === 'right') App.shiftAxis(sh, 'col', g.c1, g.c2 - g.c1 + 1, { r1: g.r1, r2: g.r2 });
    else App.shiftAxis(sh, 'row', g.r1, g.r2 - g.r1 + 1, { c1: g.c1, c2: g.c2 });
    return true;
  });
  App.defEdit('deleteCells', (how) => {
    const sh = App.sh(); const g = App.selRange();
    if (how === 'row' || App.isFullRow(g)) return App.shiftAxis(sh, 'row', g.r1, -(g.r2 - g.r1 + 1)), true;
    if (how === 'col' || App.isFullCol(g)) return App.shiftAxis(sh, 'col', g.c1, -(g.c2 - g.c1 + 1)), true;
    if (how === 'left') App.shiftAxis(sh, 'col', g.c1, -(g.c2 - g.c1 + 1), { r1: g.r1, r2: g.r2 });
    else App.shiftAxis(sh, 'row', g.r1, -(g.r2 - g.r1 + 1), { c1: g.c1, c2: g.c2 });
    return true;
  });
  const cellsDialog = (ins) => {
    const g = App.selRange();
    if (App.isFullRow(g)) return App.exec(ins ? 'insertRows' : 'deleteRows');
    if (App.isFullCol(g)) return App.exec(ins ? 'insertCols' : 'deleteCols');
    const opts = ins ? [['down', 'Cellen naar beneden verplaatsen'], ['right', 'Cellen naar rechts verplaatsen'], ['row', 'Hele rij'], ['col', 'Hele kolom']]
      : [['up', 'Cellen naar boven verplaatsen'], ['left', 'Cellen naar links verplaatsen'], ['row', 'Hele rij'], ['col', 'Hele kolom']];
    App.dialog({
      title: ins ? 'Invoegen' : 'Verwijderen',
      body: opts.map(([v, l], k) => `<label class="chk" style="font-size:13px"><input type="radio" name="ic" value="${v}" ${k === 0 ? 'checked' : ''}> ${l}</label>`).join(''),
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { App.exec(ins ? 'insertCells' : 'deleteCells', d.$('input[name=ic]:checked').value); } }],
    });
  };
  App.def('insertCellsDialog', () => cellsDialog(true));
  App.def('deleteCellsDialog', () => cellsDialog(false));

  /* ---------- Selecteren ---------- */
  App.def('selectAll', () => {
    const sh = App.sh(); const s = sh.sel;
    // eerst het huidige gegevensgebied, bij nogmaals het hele blad
    const region = App.currentRegion(sh, s.ar, s.ac);
    const g = s.ranges[s.ri];
    if (region && !(g.r1 === region.r1 && g.c1 === region.c1 && g.r2 === region.r2 && g.c2 === region.c2) && (region.r2 > region.r1 || region.c2 > region.c1)) App.setSel(region, s.ar, s.ac);
    else App.setSel({ r1: 0, c1: 0, r2: App.MAXR - 1, c2: App.MAXC - 1 }, s.ar, s.ac);
  });
  App.def('selectRegion', () => { const sh = App.sh(); const s = sh.sel; const g = App.currentRegion(sh, s.ar, s.ac); if (g) App.setSel(g, s.ar, s.ac); });
  // Aaneengesloten gegevensgebied rond een cel
  App.currentRegion = (sh, r, c) => {
    let g = { r1: r, c1: c, r2: r, c2: c };
    const filled = (rr, cc) => rr >= 0 && cc >= 0 && App.hasValue(App.getCell(sh, rr, cc));
    let changed = true, guard = 0;
    while (changed && guard++ < 1000) {
      changed = false;
      const tryExpand = (dir) => {
        if (dir === 'up' && g.r1 > 0) { for (let cc = g.c1 - 1; cc <= g.c2 + 1; cc++) if (filled(g.r1 - 1, cc)) { g.r1--; return true; } }
        if (dir === 'down') { for (let cc = g.c1 - 1; cc <= g.c2 + 1; cc++) if (filled(g.r2 + 1, cc)) { g.r2++; return true; } }
        if (dir === 'left' && g.c1 > 0) { for (let rr = g.r1 - 1; rr <= g.r2 + 1; rr++) if (filled(rr, g.c1 - 1)) { g.c1--; return true; } }
        if (dir === 'right') { for (let rr = g.r1 - 1; rr <= g.r2 + 1; rr++) if (filled(rr, g.c2 + 1)) { g.c2++; return true; } }
        return false;
      };
      ['up', 'down', 'left', 'right'].forEach((d) => { if (tryExpand(d)) changed = true; });
    }
    if (!filled(r, c) && g.r1 === g.r2 && g.c1 === g.c2) return null;
    return g;
  };

  /* ---------- Naamvak ---------- */
  namebox.addEventListener('focus', () => namebox.select());
  namebox.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); App.updateFormulaBar(); App.focusGrid(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = namebox.value.trim();
    if (!v) return;
    if (App.gotoRef(v)) { App.focusGrid(); return; }
    // nieuwe naam definiëren voor de selectie
    if (/^[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*$/.test(v) && !App.parseAddr(v)) {
      App.run(() => { App.book.names[v] = App.sheetRef(App.sh().name) + '!' + App.absRangeStr(App.selRange()); });
      App.toast(`Naam “${v}” gemaakt`, 'ok');
      App.focusGrid();
      return;
    }
    App.toast('Ongeldige verwijzing of naam', 'error');
  });
  App.gotoRef = (text) => {
    let v = text.trim();
    let sheet = App.sh();
    const nameKey = Object.keys(App.book.names).find((k) => k.toLowerCase() === v.toLowerCase());
    if (nameKey) v = App.book.names[nameKey];
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/.exec(v);
    if (m) { sheet = App.sheetByName((m[1] || m[2]).replace(/''/g, "'")); v = m[3]; if (!sheet) return false; }
    const g = App.parseRange(v.replace(/\s/g, '')) || (() => { const p = /^([A-Za-z]{1,3})$/.exec(v); return p ? { r1: 0, c1: App.colIndex(p[1]), r2: App.MAXR - 1, c2: App.colIndex(p[1]) } : null; })();
    if (!g) return false;
    const idx = App.book.sheets.indexOf(sheet);
    if (idx !== App.book.active) { App.book.active = idx; App.afterSheetSwitch(); }
    App.setSel(g, g.r1, g.c1);
    App.scrollToCell(g.r1, g.c1);
    return true;
  };
  App.def('gotoDialog', () => {
    const names = Object.keys(App.book.names);
    App.dialog({
      title: 'Ga naar',
      body: `${names.length ? `<div class="list-rows" style="max-height:160px;margin-bottom:10px">${names.map((n) => `<div class="list-row" data-n="${App.esc(n)}" style="cursor:pointer"><span class="grow">${App.esc(n)}</span><span class="muted small">${App.esc(App.book.names[n])}</span></div>`).join('')}</div>` : ''}
        <label class="field"><span>Verwijzing (bijv. B12, A1:D20, Blad2!C5 of een naam)</span><input id="go-ref"></label>`,
      onOpen: (d) => d.body.addEventListener('click', (e) => { const r = e.target.closest('[data-n]'); if (r) d.$('#go-ref').value = r.dataset.n; }),
      buttons: [{ label: 'Speciaal…', left: true, action: () => { setTimeout(() => App.exec('gotoSpecial'), 0); } }, { label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => { if (!App.gotoRef(d.$('#go-ref').value)) { App.toast('Ongeldige verwijzing', 'error'); return false; } } }],
    });
  });

  /* ---------- Zoeken en vervangen ---------- */
  const fp = $('#find-panel'), fin = $('#find-input'), rin = $('#replace-input');
  let hits = [], hitIdx = -1;
  const searchAll = () => {
    const q = fin.value;
    hits = [];
    if (!q) { $('#find-count').textContent = ''; return; }
    const cs = $('#find-case').checked, whole = $('#find-whole').checked, all = $('#find-all').checked;
    const norm = (s) => (cs ? s : s.toLowerCase());
    const nq = norm(q);
    const re = /[*?]/.test(q) ? new RegExp((whole ? '^' : '') + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + (whole ? '$' : ''), cs ? '' : 'i') : null;
    const sheets = all ? App.book.sheets : [App.sh()];
    sheets.forEach((sh) => {
      const rows = Array.from(sh.data.keys()).sort((a, b) => a - b);
      rows.forEach((r) => {
        const row = sh.data.get(r);
        Array.from(row.keys()).sort((a, b) => a - b).forEach((c) => {
          const cell = row.get(c);
          if (!App.hasValue(cell)) return;
          const disp = NF.format(App.valueOf(cell), App.styleAt(sh, r, c, cell).nf).text;
          const edit = cell.f ? '=' + F.toLocal(cell.f) : disp;
          const ok = [disp, edit].some((t) => (re ? re.test(t) : whole ? norm(t) === nq : norm(t).includes(nq)));
          if (ok) hits.push({ sh, r, c });
        });
      });
    });
    $('#find-count').textContent = hits.length ? `${hits.length} gevonden` : 'Niets gevonden';
  };
  const showHit = () => {
    if (!hits.length) return;
    const h = hits[hitIdx];
    const idx = App.book.sheets.indexOf(h.sh);
    if (idx !== App.book.active) { App.book.active = idx; App.afterSheetSwitch(true); }
    App.selectCell(h.r, h.c); App.scrollToCell(h.r, h.c);
    $('#find-count').textContent = `${hitIdx + 1} van ${hits.length}`;
  };
  App.def('find', (q) => {
    fp.hidden = false;
    if (typeof q === 'string' && q) fin.value = q;
    fin.focus(); fin.select();
    searchAll();
  });
  App.def('replace', () => { App.exec('find'); $('#replace-row').hidden = false; });
  App.def('toggleReplaceRow', () => { $('#replace-row').hidden = !$('#replace-row').hidden; });
  App.def('closeFind', () => { fp.hidden = true; App.focusGrid(); });
  App.def('findNext', () => {
    searchAll(); if (!hits.length) return;
    const s = App.sh().sel;
    const cur = hits.findIndex((h) => h.sh === App.sh() && (h.r > s.ar || (h.r === s.ar && h.c > s.ac)));
    hitIdx = cur >= 0 ? cur : 0; showHit();
  });
  App.def('findPrev', () => {
    searchAll(); if (!hits.length) return;
    const s = App.sh().sel;
    let cur = -1; hits.forEach((h, i) => { if (h.sh === App.sh() && (h.r < s.ar || (h.r === s.ar && h.c < s.ac))) cur = i; });
    hitIdx = cur >= 0 ? cur : hits.length - 1; showHit();
  });
  const replaceIn = (sh, r, c) => {
    const q = fin.value, rep = rin.value, cs = $('#find-case').checked;
    const t = App.editTextOf(sh, r, c);
    const re = new RegExp(q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), cs ? 'g' : 'gi');
    const nt = $('#find-whole').checked ? rep : t.replace(re, rep.replace(/\$/g, '$$$$'));
    if (nt !== t) App.setCellFromText(sh, r, c, nt);
  };
  App.defEdit('replaceOne', () => {
    searchAll(); if (!hits.length) return false;
    const s = App.sh().sel;
    const h = hits.find((x) => x.sh === App.sh() && x.r === s.ar && x.c === s.ac);
    if (h) replaceIn(h.sh, h.r, h.c);
    setTimeout(() => App.exec('findNext'), 0);
    return !!h;
  });
  App.defEdit('replaceAll', () => {
    searchAll();
    const n = hits.length;
    hits.forEach((h) => replaceIn(h.sh, h.r, h.c));
    App.touchAll();
    App.toast(n ? `${n} vervangingen uitgevoerd` : 'Niets gevonden', n ? 'ok' : 'info');
    return n > 0;
  }, { allowProtected: false });
  fin.addEventListener('input', () => { hitIdx = -1; searchAll(); });
  fin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); App.exec(e.shiftKey ? 'findPrev' : 'findNext'); } if (e.key === 'Escape') { e.preventDefault(); App.exec('closeFind'); } });
  rin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); App.exec('replaceOne'); } if (e.key === 'Escape') { e.preventDefault(); App.exec('closeFind'); } });
  ['#find-case', '#find-whole', '#find-all'].forEach((s) => $(s).addEventListener('change', searchAll));
})();
