/* =========================================================
   Doek (gemaakt door JJ van Schelven) — tekstopmaak: lettertype, alinea,
   opsommingen en nummering, hoofdletters, lettertypelijst (ook eigen lettertypen
   via Local Font Access), autocorrectie en de mini-werkbalk
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  const TE = () => App.textEdit;
  const editing = () => !!(TE() && TE().active && TE().active());

  /* ---------- Toepassen op selectie of op hele objecten ---------- */
  // Alle tekstlichamen van een object (vormen, tabelcellen, groepen)
  const bodiesOf = (o, out = []) => {
    if (!o) return out;
    if (o.type === 'shape') { if (!o.text) o.text = { paras: [App.emptyPara()] }; out.push(o.text); }
    else if (o.type === 'table') {
      const c = st.cell && st.cell.id === o.id ? st.cell : null;
      o.rows.forEach((row, r) => row.cells.forEach((cell, k) => { if (cell.merged) return; if (c && !(r >= Math.min(c.r, c.r2) && r <= Math.max(c.r, c.r2) && k >= Math.min(c.c, c.c2) && k <= Math.max(c.c, c.c2))) return; if (!cell.text) cell.text = { paras: [App.emptyPara()] }; out.push(cell.text); }));
    } else if (o.type === 'group') o.objs.forEach((c) => bodiesOf(c, out));
    return out;
  };
  App.bodiesOf = bodiesOf;
  App.applyRun = (fn) => {
    if (editing()) { App.textEdit.applyRuns(fn); App.scheduleState(); return true; }
    const objs = App.selObjs(); if (!objs.length) return false;
    App.run(() => {
      objs.forEach((o) => {
        bodiesOf(o).forEach((b) => b.paras.forEach((p) => { p.runs.forEach(fn); if (!p.runs.some((r) => r.t)) { p.end = { ...(p.end || {}) }; fn(p.end); } }));
        if (o.type === 'shape') App.autofit(o, App.surface().owner);
      });
    });
    return true;
  };
  App.applyPara = (fn) => {
    if (editing()) { App.textEdit.applyParas(fn); App.scheduleState(); return true; }
    const objs = App.selObjs(); if (!objs.length) return false;
    App.run(() => objs.forEach((o) => { bodiesOf(o).forEach((b) => b.paras.forEach(fn)); if (o.type === 'shape') App.autofit(o, App.surface().owner); }));
    return true;
  };
  App.applyBodyProps = (fn) => {
    if (editing()) { App.textEdit.applyBody(fn); return true; }
    const objs = App.selObjs(); if (!objs.length) return false;
    App.run(() => objs.forEach((o) => { if (o.type === 'shape') { if (!o.text) o.text = { paras: [App.emptyPara()] }; fn(o.text, o); App.autofit(o, App.surface().owner); } else if (o.type === 'table') bodiesOf(o).forEach((b) => fn(b, o)); }));
    return true;
  };
  // Effectieve opmaak van de selectie (eerste run) voor de knoppen
  App.curRuns = () => {
    if (editing()) return App.textEdit.selRuns() || [];
    const o = App.sel1() || App.selObjs()[0];
    if (!o) return [];
    const owner = App.surface().owner;
    const bodies = bodiesOf(o === App.sel1() ? o : o);
    const out = [];
    bodies.slice(0, 4).forEach((b) => b.paras.slice(0, 6).forEach((p) => { const ps = App.paraStyle(o.type === 'table' ? { type: 'cell' } : o, owner, p); (p.runs.some((r) => r.t) ? p.runs.filter((r) => r.t) : p.runs).forEach((r) => out.push(App.runStyle(r, ps))); }));
    return out;
  };
  App.curParaStyles = () => {
    const owner = App.textEdit && App.textEdit.owner && App.textEdit.owner() || App.surface().owner;
    if (editing()) { const o = App.textEdit.obj(); const cell = App.textEdit.cell(); return (App.textEdit.selParas() || []).map((p) => App.paraStyle(cell ? { type: 'cell' } : o, owner, p)); }
    const o = App.sel1(); if (!o) return [];
    return bodiesOf(o).slice(0, 3).flatMap((b) => b.paras.slice(0, 6).map((p) => App.paraStyle(o.type === 'table' ? { type: 'cell' } : o, owner, p)));
  };
  const allRuns = (pred) => { const r = App.curRuns(); return r.length > 0 && r.every(pred); };
  App.stateFns.bold = () => allRuns((r) => r.b);
  App.stateFns.italic = () => allRuns((r) => r.i);
  App.stateFns.underline = () => allRuns((r) => r.u && r.u !== 'none');
  App.stateFns.strike = () => allRuns((r) => r.s && r.s !== 'noStrike');
  App.stateFns.textShadow = () => allRuns((r) => r.fx && r.fx.shadow);
  const pAlign = (a) => () => { const p = App.curParaStyles(); return p.length > 0 && p.every((x) => (x.align || 'l') === a); };
  App.stateFns.alignL = pAlign('l'); App.stateFns.alignC = pAlign('ctr'); App.stateFns.alignR = pAlign('r'); App.stateFns.alignJ = pAlign('just');
  App.stateFns.bullets = () => { const p = App.curParaStyles(); return p.length > 0 && p.every((x) => x.bullet && x.bullet.type === 'char'); };
  App.stateFns.numbering = () => { const p = App.curParaStyles(); return p.length > 0 && p.every((x) => x.bullet && x.bullet.type === 'auto'); };

  /* ---------- Lettertype ---------- */
  const toggle = (key, on = true, off = undefined) => {
    const runs = App.curRuns();
    const allOn = runs.length && runs.every((r) => r[key] && r[key] !== 'none');
    App.applyRun((r) => { if (allOn) { if (off === undefined) r[key] = false; else r[key] = off; } else r[key] = on; });
  };
  App.def('bold', () => toggle('b'));
  App.def('italic', () => toggle('i'));
  App.def('underline', () => toggle('u', 'sng', 'none'));
  App.def('underlineStyle', (s) => App.applyRun((r) => { r.u = s; }));
  App.def('strike', () => toggle('s', 'sng', 'noStrike'));
  App.def('textShadow', () => {
    const on = App.stateFns.textShadow();
    App.applyRun((r) => { if (on) { if (r.fx) { delete r.fx.shadow; if (!Object.keys(r.fx).length) delete r.fx; } } else r.fx = { ...(r.fx || {}), shadow: { type: 'outer', color: '#000000', alpha: 0.4, blur: 3, dist: 2, dir: 45 } }; });
  });
  App.def('superscript', () => { const on = allRuns((r) => r.base > 0); App.applyRun((r) => { if (on) delete r.base; else r.base = 30; }); });
  App.def('subscript', () => { const on = allRuns((r) => r.base < 0); App.applyRun((r) => { if (on) delete r.base; else r.base = -25; }); });
  App.def('fontName', (name) => {
    name = String(name || '').trim(); if (!name) return;
    App.addRecentFont(name);
    App.applyRun((r) => { r.font = name; });
    App.focusStage(true);
  });
  App.SIZES_PT = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
  App.def('fontSize', (v) => {
    const n = App.parseNum(v); if (!Number.isFinite(n) || n < 1 || n > 4000) { App.updateFontBox(); return; }
    App.applyRun((r) => { r.sz = App.round(n, 1); });
    App.focusStage(true);
  });
  const stepSize = (dir) => {
    App.applyRun((r) => {
      const cur = r.sz || App.curRuns()[0]?.sz || 18;
      const list = App.SIZES_PT;
      let next = dir > 0 ? list.find((s) => s > cur + 0.01) : [...list].reverse().find((s) => s < cur - 0.01);
      if (next === undefined) next = dir > 0 ? Math.round(cur * 1.1) : Math.max(1, Math.round(cur / 1.1));
      r.sz = next;
    });
  };
  // eerst de huidige grootte op elke run zetten (zodat geërfde grootte meeschaalt)
  const materializeSize = () => {
    if (editing()) return;
    App.selObjs().forEach((o) => { const owner = App.surface().owner; bodiesOf(o).forEach((b) => b.paras.forEach((p) => { const ps = App.paraStyle(o.type === 'table' ? { type: 'cell' } : o, owner, p); p.runs.forEach((r) => { if (r.sz === undefined) r.sz = App.runStyle(r, ps).sz; }); })); });
  };
  App.def('growFont', () => { materializeSize(); stepSize(1); });
  App.def('shrinkFont', () => { materializeSize(); stepSize(-1); });
  App.def('clearFormat', () => App.applyRun((r) => { App.RUN_KEYS.forEach((k) => { if (k !== 'lang') delete r[k]; }); }));
  App.def('fontColor', (c) => {
    if (c === undefined || c === null) c = App.state.lastColors.font;
    App.applyRun((r) => { if (!c) { delete r.color; delete r.fill; } else { r.color = c; if (r.fill && r.fill.type === 'solid') delete r.fill; } });
  });
  App.def('hlColor', (c) => {
    if (c === undefined || c === null) c = App.state.lastColors.hl;
    App.applyRun((r) => { if (c) r.hl = c; else delete r.hl; });
  });
  App.def('charSpacing', (v) => { const n = +v; App.applyRun((r) => { if (n) r.spc = n; else delete r.spc; }); });
  App.def('setTextLang', (lang) => {
    if (!editing() && !App.selObjs().length) { App.run(() => { App.pres.lang = lang; }, { noTouch: true }); App.toast(App.t('Taal van de presentatie: {0}').replace('{0}', App.t({ 'nl-NL': 'Nederlands', 'en-US': 'Engels (Verenigde Staten)' }[lang] || lang)), 'translate'); App.updateStatus(); return; }
    App.applyRun((r) => { r.lang = lang; });
  });
  // Hoofdletters / kleine letters
  const caseFn = (mode, t, first) => {
    if (mode === 'upper') return t.toLocaleUpperCase();
    if (mode === 'lower') return t.toLocaleLowerCase();
    if (mode === 'title') return t.toLocaleLowerCase().replace(/(^|[\s\-–(“"'‘])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase());
    if (mode === 'toggle') return Array.from(t).map((c) => (c === c.toLocaleUpperCase() ? c.toLocaleLowerCase() : c.toLocaleUpperCase())).join('');
    if (mode === 'sentence') { let s = t.toLocaleLowerCase(); s = s.replace(/([.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase()); if (first) s = s.replace(/^(\s*)(\p{L})/u, (m, a, b) => a + b.toLocaleUpperCase()); return s; }
    return t;
  };
  App.def('changeCase', (mode) => {
    if (mode === 'cycle') {
      const t = App.curRuns().length ? (editing() ? App.textEdit.selectedText() : App.selObjs().map(App.objText).join(' ')) : '';
      mode = t && t === t.toLocaleUpperCase() ? 'lower' : t && t === t.toLocaleLowerCase() ? 'title' : 'upper';
    }
    let first = true;
    App.applyRun((r) => { if (r.fld) return; r.t = caseFn(mode, r.t, first); first = false; });
  });

  /* ---------- Alinea ---------- */
  App.def('align', (a) => {
    if (st.cell && App.tables && !editing() && App.sel1() && App.sel1().type === 'table') { App.applyPara((p) => { p.align = a; }); return; }
    App.applyPara((p) => { p.align = a; });
  });
  App.BULLETS = [
    { type: 'char', char: '•', font: 'Arial', name: 'Gevulde ronde opsommingstekens' }, { type: 'char', char: '○', font: 'Arial', name: 'Holle ronde opsommingstekens' },
    { type: 'char', char: '■', font: 'Arial', name: 'Gevulde vierkante opsommingstekens' }, { type: 'char', char: '□', font: 'Arial', name: 'Holle vierkante opsommingstekens' },
    { type: 'char', char: '◆', font: 'Arial', name: 'Ruit-opsommingstekens' }, { type: 'char', char: '➢', font: 'Arial', name: 'Pijl-opsommingstekens' },
    { type: 'char', char: '✓', font: 'Arial', name: 'Vinkje-opsommingstekens' }, { type: 'char', char: '–', font: 'Arial', name: 'Streepjes' },
    { type: 'char', char: '★', font: 'Arial', name: 'Sterren' }, { type: 'char', char: '►', font: 'Arial', name: 'Driehoeken' }, { type: 'char', char: '❖', font: 'Arial', name: 'Ruiten' },
  ];
  App.NUMBERINGS = [['arabicPeriod', '1.', '2.', '3.'], ['arabicParenR', '1)', '2)', '3)'], ['romanUcPeriod', 'I.', 'II.', 'III.'], ['alphaUcPeriod', 'A.', 'B.', 'C.'], ['alphaLcParenR', 'a)', 'b)', 'c)'], ['alphaLcPeriod', 'a.', 'b.', 'c.'], ['romanLcPeriod', 'i.', 'ii.', 'iii.'], ['arabicParenBoth', '(1)', '(2)', '(3)'], ['circleNumDbPlain', '①', '②', '③']];
  const setBullet = (b) => App.applyPara((p) => {
    p.bullet = b;
    if (b.type !== 'none' && (p.marL === undefined || p.marL === 0) && !p.lvl) {
      // gewone tekstvakken krijgen een hangende inspringing bij een opsomming
      const ps = App.curParaStyles()[0];
      if (!ps || !ps.marL) { p.marL = 24 + (p.lvl || 0) * 48; p.indent = -24; }
    }
    if (b.type === 'none' && p.indent < 0 && p.marL === 24 + (p.lvl || 0) * 48) { delete p.marL; delete p.indent; }
  });
  App.def('bullets', () => {
    const on = App.stateFns.bullets();
    setBullet(on ? { type: 'none' } : { type: 'char', char: '•', font: 'Arial' });
  });
  App.def('bulletStyle', (i) => { if (i === 'none') setBullet({ type: 'none' }); else { const b = App.BULLETS[+i]; if (b) setBullet({ type: 'char', char: b.char, font: b.font }); } });
  App.def('numbering', () => { const on = App.stateFns.numbering(); setBullet(on ? { type: 'none' } : { type: 'auto', scheme: 'arabicPeriod' }); });
  App.def('numberStyle', (s) => { if (s === 'none') setBullet({ type: 'none' }); else setBullet({ type: 'auto', scheme: s }); });
  App.menuBuilders['m-bullets'] = () => `<button data-cmd="bulletStyle" data-arg="none"><small>${App.t('Geen')}</small></button>` + App.BULLETS.map((b, i) => `<button data-cmd="bulletStyle" data-arg="${i}" title="${App.esc(App.t(b.name))}"><small>${b.char}  ──\n${b.char}  ──\n${b.char}  ──</small></button>`).join('') + `<button class="wide" data-cmd="bulletDialog">${App.t('Opsommingstekens en nummering…')}</button>`;
  App.menuBuilders['m-numbering'] = () => `<button data-cmd="numberStyle" data-arg="none"><small>${App.t('Geen')}</small></button>` + App.NUMBERINGS.map(([s, a, b, c]) => `<button data-cmd="numberStyle" data-arg="${s}"><small>${a} ──\n${b} ──\n${c} ──</small></button>`).join('') + `<button class="wide" data-cmd="bulletDialog" data-arg="num">${App.t('Opsommingstekens en nummering…')}</button>`;
  App.def('indent', () => App.applyPara((p) => { p.lvl = Math.min(8, (p.lvl || 0) + 1); if (p.marL !== undefined && !App.isPhBody()) { p.marL += 48; } }));
  App.def('outdent', () => App.applyPara((p) => { if (p.lvl) { p.lvl--; if (p.marL !== undefined && !App.isPhBody()) p.marL = Math.max(0, p.marL - 48); } else if (p.marL) p.marL = Math.max(0, p.marL - 48); }));
  App.isPhBody = () => { const o = editing() ? App.textEdit.obj() : App.sel1(); return !!(o && o.ph && App.phFamily(o.ph.type) === 'body'); };
  App.def('lineSpacing', (v) => App.applyPara((p) => { p.lnSpc = { pct: +v }; }));
  App.def('textDir', (d) => App.applyBodyProps((b) => { if (d === 'horz') delete b.vert; else b.vert = d; }));
  App.def('textCols', (n) => App.applyBodyProps((b) => { if (+n > 1) b.cols = { n: +n, gap: 14 }; else delete b.cols; }));
  App.def('vAlign', (v) => {
    const o = App.sel1();
    if (o && o.type === 'table') { App.exec('cellVAlign', v); return; }
    App.applyBodyProps((b) => { b.vAlign = v; });
  });
  App.def('bulletDialog', (tab) => {
    const ps = App.curParaStyles()[0] || {};
    const b = ps.bullet || { type: 'none' };
    App.dialog({
      title: App.t('Opsommingstekens en nummering'), wide: true,
      body: `<div class="seg" id="bd-tabs"><button data-t="bul" class="${tab !== 'num' ? 'on' : ''}">${App.t('Met opsommingstekens')}</button><button data-t="num" class="${tab === 'num' ? 'on' : ''}">${App.t('Genummerd')}</button></div>
        <div id="bd-bul" ${tab === 'num' ? 'hidden' : ''}><div class="sym-grid" style="grid-template-columns:repeat(12,1fr);max-height:120px">${['•', '○', '■', '□', '◆', '◇', '➢', '➤', '►', '▸', '✓', '✔', '✗', '★', '☆', '–', '—', '❖', '♦', '●', '◉', '▪', '→', '⇒'].map((c) => `<button data-ch="${c}">${c}</button>`).join('')}</div>
          <label class="field" style="margin-top:10px"><span>${App.t('Eigen teken')}</span><input id="bd-char" value="${App.esc(b.type === 'char' ? b.char : '•')}" maxlength="2" style="width:80px"></label></div>
        <div id="bd-num" ${tab === 'num' ? '' : 'hidden'}><div class="radio-list">${App.NUMBERINGS.map(([s, a, b2, c]) => `<label><input type="radio" name="bd-s" value="${s}" ${b.type === 'auto' && b.scheme === s ? 'checked' : ''}> ${a} ${b2} ${c}</label>`).join('')}</div>
          <label class="field" style="margin-top:10px"><span>${App.t('Beginnen bij')}</span><input id="bd-start" type="number" min="1" max="9999" value="${b.start || 1}" style="width:90px"></label></div>
        <div class="fields-2"><label class="field"><span>${App.t('Grootte (% van tekst)')}</span><input id="bd-sz" type="number" min="25" max="400" value="${Math.round((b.sz || 1) * 100)}"></label>
        <label class="field"><span>${App.t('Kleur')}</span><input id="bd-color" type="color" value="${App.color(b.color || ps.base?.color || 'tx1')}"></label></div>`,
      onOpen: (d) => {
        d.$('#bd-tabs').onclick = (e) => { const t = e.target.closest('[data-t]'); if (!t) return; d.$$('#bd-tabs button').forEach((x) => x.classList.toggle('on', x === t)); d.$('#bd-bul').hidden = t.dataset.t !== 'bul'; d.$('#bd-num').hidden = t.dataset.t !== 'num'; };
        d.$('#bd-bul .sym-grid').onclick = (e) => { const c = e.target.closest('[data-ch]'); if (c) d.$('#bd-char').value = c.dataset.ch; };
      },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const num = !d.$('#bd-num').hidden;
        const sz = App.clamp(+d.$('#bd-sz').value || 100, 25, 400) / 100;
        const color = d.$('#bd-color').value;
        if (num) { const s = (d.$('input[name="bd-s"]:checked') || {}).value || 'arabicPeriod'; setBullet({ type: 'auto', scheme: s, start: Math.max(1, +d.$('#bd-start').value || 1), sz: sz !== 1 ? sz : undefined, color }); }
        else setBullet({ type: 'char', char: d.$('#bd-char').value || '•', font: 'Arial', sz: sz !== 1 ? sz : undefined, color });
      } }],
    });
  });
  App.def('paraDialog', () => {
    const ps = App.curParaStyles()[0] || {};
    const ls = ps.lnSpc || { pct: 1 };
    const cm = (px) => App.fmtNum((px || 0) / App.CM, 2);
    App.dialog({
      title: App.t('Alinea'), wide: true,
      body: `<h3 style="margin:0 0 8px;font-size:13px">${App.t('Algemeen')}</h3>
        <div class="fields-2"><label class="field"><span>${App.t('Uitlijning')}</span><select id="pd-al">${[['l', 'Links'], ['ctr', 'Gecentreerd'], ['r', 'Rechts'], ['just', 'Uitgevuld'], ['dist', 'Verdeeld']].map(([v, l]) => `<option value="${v}" ${(ps.align || 'l') === v ? 'selected' : ''}>${App.t(l)}</option>`).join('')}</select></label>
        <label class="field"><span>${App.t('Tekstrichting')}</span><select id="pd-dir"><option value="ltr">${App.t('Van links naar rechts')}</option><option value="rtl" ${ps.rtl ? 'selected' : ''}>${App.t('Van rechts naar links')}</option></select></label></div>
        <h3 style="margin:4px 0 8px;font-size:13px">${App.t('Inspringing')}</h3>
        <div class="fields-3"><label class="field"><span>${App.t('Vóór tekst (cm)')}</span><input id="pd-marl" value="${cm(ps.marL)}"></label>
        <label class="field"><span>${App.t('Speciaal')}</span><select id="pd-sp"><option value="none">${App.t('(geen)')}</option><option value="first" ${ps.indent > 0 ? 'selected' : ''}>${App.t('Eerste regel')}</option><option value="hang" ${ps.indent < 0 ? 'selected' : ''}>${App.t('Verkeerd om')}</option></select></label>
        <label class="field"><span>${App.t('Met (cm)')}</span><input id="pd-ind" value="${cm(Math.abs(ps.indent || 0))}"></label></div>
        <h3 style="margin:4px 0 8px;font-size:13px">${App.t('Afstand')}</h3>
        <div class="fields-4"><label class="field"><span>${App.t('Vóór (pt)')}</span><input id="pd-bef" type="number" min="0" step="1" value="${ps.spcBef || 0}"></label>
        <label class="field"><span>${App.t('Na (pt)')}</span><input id="pd-aft" type="number" min="0" step="1" value="${ps.spcAft || 0}"></label>
        <label class="field"><span>${App.t('Regelafstand')}</span><select id="pd-ls"><option value="1">${App.t('Enkel')}</option><option value="1.5">1,5 ${App.t('regel')}</option><option value="2">${App.t('Dubbel')}</option><option value="exact">${App.t('Precies')}</option><option value="multi">${App.t('Meerdere')}</option></select></label>
        <label class="field"><span>${App.t('Op')}</span><input id="pd-lsv" value="${ls.pt ? ls.pt : App.fmtNum(ls.pct || 1, 2)}"></label></div>`,
      onOpen: (d) => { const sel = d.$('#pd-ls'); sel.value = ls.pt ? 'exact' : [1, 1.5, 2].includes(ls.pct) ? String(ls.pct) : 'multi'; },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const al = d.$('#pd-al').value, rtl = d.$('#pd-dir').value === 'rtl';
        const marL = App.parseNum(d.$('#pd-marl').value) * App.CM;
        const sp = d.$('#pd-sp').value, ind = App.parseNum(d.$('#pd-ind').value) * App.CM;
        const bef = +d.$('#pd-bef').value || 0, aft = +d.$('#pd-aft').value || 0;
        const lsk = d.$('#pd-ls').value, lsv = App.parseNum(d.$('#pd-lsv').value);
        App.applyPara((p) => {
          p.align = al; if (rtl) p.rtl = true; else delete p.rtl;
          if (Number.isFinite(marL)) p.marL = App.round(marL, 2);
          p.indent = sp === 'none' ? 0 : App.round((sp === 'hang' ? -1 : 1) * (ind || 0), 2);
          p.spcBef = bef; p.spcAft = aft;
          p.lnSpc = lsk === 'exact' ? { pt: lsv || 12 } : lsk === 'multi' ? { pct: lsv || 1 } : { pct: +lsk };
        });
      } }],
    });
  });

  /* ---------- Dialoog Lettertype ---------- */
  App.def('fontDialog', (tab) => {
    const r = App.curRuns()[0] || {};
    const fonts = App.fontList().map((f) => `<option ${f === (r.font && !/^\+/.test(r.font) ? r.font : '') ? 'selected' : ''}>${App.esc(f)}</option>`).join('');
    App.dialog({
      title: App.t('Lettertype'), wide: true,
      body: `<div class="seg" id="fd-tabs"><button data-t="font" class="${tab !== 'spacing' ? 'on' : ''}">${App.t('Lettertype')}</button><button data-t="spacing" class="${tab === 'spacing' ? 'on' : ''}">${App.t('Tekenafstand')}</button></div>
      <div id="fd-font" ${tab === 'spacing' ? 'hidden' : ''}>
        <div class="fields-3"><label class="field"><span>${App.t('Lettertype')}</span><select id="fd-name"><option value="">${App.t('(thema)')} ${App.esc(App.fontName(r.font, App.theme()))}</option>${fonts}</select></label>
        <label class="field"><span>${App.t('Stijl')}</span><select id="fd-style"><option value="n">${App.t('Standaard')}</option><option value="i" ${r.i && !r.b ? 'selected' : ''}>${App.t('Cursief')}</option><option value="b" ${r.b && !r.i ? 'selected' : ''}>${App.t('Vet')}</option><option value="bi" ${r.b && r.i ? 'selected' : ''}>${App.t('Vet cursief')}</option></select></label>
        <label class="field"><span>${App.t('Grootte (pt)')}</span><input id="fd-size" type="number" min="1" max="4000" step="0.5" value="${r.sz || 18}"></label></div>
        <div class="fields-3"><label class="field"><span>${App.t('Tekenkleur')}</span><input id="fd-color" type="color" value="${App.color(r.color || 'tx1')}"></label>
        <label class="field"><span>${App.t('Onderstrepingsstijl')}</span><select id="fd-ul"><option value="none">${App.t('(geen)')}</option>${[['sng', 'Enkel'], ['dbl', 'Dubbel'], ['heavy', 'Dik'], ['dotted', 'Gestippeld'], ['dash', 'Streepjes'], ['wavy', 'Golvend']].map(([v, l]) => `<option value="${v}" ${r.u === v ? 'selected' : ''}>${App.t(l)}</option>`).join('')}</select></label>
        <label class="field"><span>&nbsp;</span></label></div>
        <h3 style="margin:4px 0 8px;font-size:13px">${App.t('Effecten')}</h3>
        <div class="checks"><label><input type="checkbox" id="fd-s" ${r.s === 'sng' ? 'checked' : ''}> ${App.t('Doorhalen')}</label><label><input type="checkbox" id="fd-ds" ${r.s === 'dbl' ? 'checked' : ''}> ${App.t('Dubbel doorhalen')}</label>
        <label><input type="checkbox" id="fd-sup" ${r.base > 0 ? 'checked' : ''}> ${App.t('Superscript')}</label><label><input type="checkbox" id="fd-sub" ${r.base < 0 ? 'checked' : ''}> ${App.t('Subscript')}</label>
        <label><input type="checkbox" id="fd-sc" ${r.caps === 'small' ? 'checked' : ''}> ${App.t('Kleine hoofdletters')}</label><label><input type="checkbox" id="fd-ac" ${r.caps === 'all' ? 'checked' : ''}> ${App.t('Alle hoofdletters')}</label></div>
        <h3 style="margin:4px 0 8px;font-size:13px">${App.t('OpenType-functies')}</h3>
        <div class="checks"><label><input type="checkbox" id="fd-liga" ${!(r.ot && r.ot.liga === false) ? 'checked' : ''}> ${App.t('Ligaturen')}</label><label><input type="checkbox" id="fd-smcp" ${r.ot && r.ot.smcp ? 'checked' : ''}> ${App.t('Echte kleine hoofdletters')}</label>
        <label><input type="checkbox" id="fd-onum" ${r.ot && r.ot.onum ? 'checked' : ''}> ${App.t('Oude-stijlcijfers')}</label><label><input type="checkbox" id="fd-tnum" ${r.ot && r.ot.tnum ? 'checked' : ''}> ${App.t('Cijfers met vaste breedte')}</label></div>
      </div>
      <div id="fd-spacing" ${tab === 'spacing' ? '' : 'hidden'}>
        <div class="fields-2"><label class="field"><span>${App.t('Afstand (pt, negatief = smaller)')}</span><input id="fd-spc" type="number" step="0.1" value="${r.spc || 0}"></label>
        <label class="field"><span>${App.t('Tekenspatiëring voor lettertypen')}</span><label class="chk"><input type="checkbox" id="fd-kern" ${r.kern !== 0 ? 'checked' : ''}> ${App.t('Tekenspatiëring')}</label></label></div>
      </div>`,
      onOpen: (d) => { d.$('#fd-tabs').onclick = (e) => { const t = e.target.closest('[data-t]'); if (!t) return; d.$$('#fd-tabs button').forEach((x) => x.classList.toggle('on', x === t)); d.$('#fd-font').hidden = t.dataset.t !== 'font'; d.$('#fd-spacing').hidden = t.dataset.t !== 'spacing'; }; },
      buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (d) => {
        const name = d.$('#fd-name').value, style = d.$('#fd-style').value, size = +d.$('#fd-size').value, color = d.$('#fd-color').value;
        const ul = d.$('#fd-ul').value, s = d.$('#fd-s').checked ? 'sng' : d.$('#fd-ds').checked ? 'dbl' : null;
        const sup = d.$('#fd-sup').checked, sub = d.$('#fd-sub').checked;
        const caps = d.$('#fd-ac').checked ? 'all' : d.$('#fd-sc').checked ? 'small' : null;
        const ot = { liga: d.$('#fd-liga').checked ? undefined : false, smcp: d.$('#fd-smcp').checked || undefined, onum: d.$('#fd-onum').checked || undefined, tnum: d.$('#fd-tnum').checked || undefined };
        const spc = +d.$('#fd-spc').value || 0, kern = d.$('#fd-kern').checked;
        const colorChanged = color !== App.color(r.color || 'tx1');
        App.applyRun((x) => {
          if (name) x.font = name; else delete x.font;
          x.b = style.includes('b'); x.i = style.includes('i');
          if (size > 0) x.sz = size;
          if (colorChanged) x.color = color;
          if (ul === 'none') delete x.u; else x.u = ul;
          if (s) x.s = s; else delete x.s;
          if (sup) x.base = 30; else if (sub) x.base = -25; else delete x.base;
          if (caps) x.caps = caps; else delete x.caps;
          const o2 = Object.fromEntries(Object.entries(ot).filter(([, v]) => v !== undefined)); if (Object.keys(o2).length) x.ot = o2; else delete x.ot;
          if (spc) x.spc = spc; else delete x.spc;
          if (!kern) x.kern = 0; else delete x.kern;
        });
        if (name) App.addRecentFont(name);
      } }],
    });
  });

  /* ---------- Lettertypelijst ---------- */
  // Thema-lettertypen, meegeleverde en veelvoorkomende systeemlettertypen (alleen als ze echt aanwezig zijn), eigen lettertypen
  const COMMON = ['Inter', 'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Calibri Light', 'Cambria', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Garamond', 'Georgia', 'Gill Sans MT', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold', 'Sitka Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Aptos', 'Aptos Display',
    'Carlito', 'Caladea', 'Liberation Sans', 'Liberation Serif', 'Liberation Mono', 'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Noto Sans', 'Noto Serif', 'Ubuntu', 'Cantarell', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Source Serif 4', 'Source Sans 3', 'JetBrains Mono', 'Fira Sans', 'Fira Code', 'Nunito', 'Poppins', 'Merriweather', 'Lora', 'Raleway', 'Oswald', 'EB Garamond',
    'Arabic Typesetting', 'Sakkal Majalla', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'David', 'Microsoft YaHei', 'SimSun', 'Noto Sans CJK SC', 'Yu Gothic', 'Meiryo', 'Malgun Gothic'];
  let available = null, local = [];
  const detect = () => {
    const c = document.createElement('canvas').getContext('2d');
    const test = 'mmmmmmmmmmlliiWW@#0123456789ÆØ';
    const base = {};
    ['monospace', 'serif', 'sans-serif'].forEach((g) => { c.font = `72px ${g}`; base[g] = c.measureText(test).width; });
    return COMMON.filter((f) => {
      if (f === 'Inter') return true;
      return ['monospace', 'serif', 'sans-serif'].some((g) => { c.font = `72px "${f}", ${g}`; return c.measureText(test).width !== base[g]; });
    });
  };
  App.fontAvailable = (name) => {
    if (!name) return true;
    if (!available) available = new Set(detect());
    if (available.has(name) || local.includes(name)) return true;
    const c = document.createElement('canvas').getContext('2d');
    const test = 'mmmmmmmmmmlliiWW@#0123456789';
    return ['monospace', 'serif'].some((g) => { c.font = `60px ${g}`; const a = c.measureText(test).width; c.font = `60px "${name.replace(/"/g, '')}", ${g}`; return c.measureText(test).width !== a; });
  };
  App.fontList = () => {
    if (!available) available = new Set(detect());
    return [...new Set([...available, ...local])].sort((a, b) => a.localeCompare(b));
  };
  App.addRecentFont = (name) => { const s = App.settings; s.recentFonts = [name, ...(s.recentFonts || []).filter((x) => x !== name)].slice(0, 8); App.saveSettings(); };
  // Eigen lettertypen van de computer (alleen na toestemming, via de Local Font Access API)
  App.def('loadLocalFonts', async () => {
    if (!window.queryLocalFonts) { App.toast(App.t('Deze browser kan de lettertypen van de computer niet opvragen.'), 'info'); return; }
    try {
      const list = await window.queryLocalFonts();
      local = [...new Set(list.map((f) => f.family))];
      App.toast(App.t('{0} lettertypen van deze computer geladen').replace('{0}', local.length), 'ok');
      App.fillFontBox();
    } catch (e) { App.toast(App.t('Geen toegang tot de lettertypen: {0}').replace('{0}', e.message), 'error'); }
  });
  const fontSel = $('#font-family');
  App.fillFontBox = () => {
    const th = App.pres ? App.theme() : null;
    const major = th ? th.fonts.major : 'Inter', minor = th ? th.fonts.minor : 'Inter';
    const rec = (App.settings.recentFonts || []).filter((f) => f !== major && f !== minor);
    const opt = (v, label, extra = '') => `<option value="${App.esc(v)}" style="font-family:${App.esc(App.cssFont(/^\+/.test(v) ? (v === '+mj' ? major : minor) : v))}"${extra}>${App.esc(label)}</option>`;
    fontSel.innerHTML = `<optgroup label="${App.esc(App.t('Thema-lettertypen'))}">${opt('+mj', major + ' ' + App.t('(koppen)'))}${opt('+mn', minor + ' ' + App.t('(hoofdtekst)'))}</optgroup>`
      + (rec.length ? `<optgroup label="${App.esc(App.t('Recent gebruikte lettertypen'))}">${rec.map((f) => opt(f, f)).join('')}</optgroup>` : '')
      + `<optgroup label="${App.esc(App.t('Alle lettertypen'))}">${App.fontList().map((f) => opt(f, f)).join('')}</optgroup>`
      + (window.queryLocalFonts && !local.length ? `<option value="__local">${App.esc(App.t('Lettertypen van deze computer laden…'))}</option>` : '');
    const dl = $('#sizes'); if (dl) dl.innerHTML = App.SIZES_PT.map((s) => `<option value="${String(s).replace('.', App.LANG === 'en' ? '.' : ',')}">`).join('');
    App.updateFontBox();
  };
  fontSel.addEventListener('change', (e) => {
    if (e.target.value === '__local') { e.stopImmediatePropagation(); App.exec('loadLocalFonts'); App.updateFontBox(); }
  }, true);
  App.updateFontBox = () => {
    const runs = App.curRuns();
    const r = runs[0];
    const fsz = $('#font-size');
    if (!r) { if (document.activeElement !== fontSel) fontSel.value = '+mn'; if (document.activeElement !== fsz) fsz.value = ''; return; }
    const sameFont = runs.every((x) => (x.font || '') === (r.font || ''));
    const f = r.font || '+mn';
    if (document.activeElement !== fontSel) {
      if (sameFont && ![...fontSel.options].some((o) => o.value === f) && f) { const o = document.createElement('option'); o.value = f; o.textContent = f + (App.fontAvailable(f) ? '' : ' ⚠'); fontSel.appendChild(o); }
      fontSel.value = sameFont ? f : '';
      fontSel.title = App.t('Lettertype') + (sameFont && !/^\+/.test(f) && !App.fontAvailable(f) ? ' — ' + App.t('niet op deze computer; er wordt een vervanger gebruikt') : '');
    }
    const sameSize = runs.every((x) => x.sz === r.sz);
    const scale = (() => { const o = editing() ? App.textEdit.obj() : App.sel1(); return o && o.text && o.text.scale ? o.text.scale.font : 1; })();
    if (document.activeElement !== fsz) fsz.value = sameSize ? String(App.round(r.sz * scale, 1)).replace('.', App.LANG === 'en' ? '.' : ',') + (scale < 1 ? '+' : '') : '';
  };
  App.on('state', () => App.updateFontBox());

  /* ---------- AutoCorrectie tijdens typen (zelfde lijst als Inkt) ---------- */
  App.AC_LIST = [
    ['(c)', '©'], ['(e)', '€'], ['(r)', '®'], ['(tm)', '™'], ['...', '…'], ['-->', '→'], ['<--', '←'], ['->', '→'], ['==>', '⇒'], ['<==', '⇐'], ['<=>', '⇔'], [':)', '☺'], [':(', '☹'],
    ['accomodatie', 'accommodatie'], ['alsjeblief', 'alsjeblieft'], ['appart', 'apart'], ['bijvoorbeld', 'bijvoorbeeld'], ['categorien', 'categorieën'], ['colega', 'collega'], ['definatief', 'definitief'],
    ['efficient', 'efficiënt'], ['geinteresseerd', 'geïnteresseerd'], ['ideeen', 'ideeën'], ['interresant', 'interessant'], ['mischien', 'misschien'], ['onmiddelijk', 'onmiddellijk'], ['paralel', 'parallel'], ['sowiezo', 'sowieso'], ['verassing', 'verrassing'],
    ['teh', 'the'], ['adn', 'and'], ['recieve', 'receive'], ['seperate', 'separate'], ['definately', 'definitely'], ['occured', 'occurred'], ['untill', 'until'], ['wich', 'which'], ['becuase', 'because'], ['accross', 'across'],
  ];
  const AC_ABBR = /\b(bijv|bv|enz|etc|ca|vgl|zgn|evt|nr|dhr|mevr|dr|prof|e\.g|i\.e|vs|incl|excl|max|min)\.$/i;
  App.autoCorrect = (body, sel, data, ctx) => {
    if (App.settings.autocorrect === false || !sel || !sel.collapsed) return null;
    const p = body.paras[sel.start.p]; if (!p) return null;
    const text = p.runs.map((r) => r.t).join('');
    const o = sel.start.o;
    const before = text.slice(0, o);
    const replaceRange = (a, b, rep) => {
      App.splitRunsAt(p, a); App.splitRunsAt(p, b);
      let pos = 0; const keep = [];
      let inserted = false;
      p.runs.forEach((r) => { const e = pos + r.t.length; if (e <= a || pos >= b) keep.push(r); else if (!inserted) { keep.push({ ...r, t: rep }); inserted = true; } pos = e; });
      p.runs = keep; App.normalizePara(p);
      return { p: sel.start.p, o: a + rep.length + (o - b) };
    };
    // slimme aanhalingstekens
    if (data === '"' || data === "'") {
      const prev = before.slice(-2, -1);
      const open = !prev || /[\s(\[{“‘–—-]/.test(prev);
      const rep = data === '"' ? (open ? '“' : '”') : (open ? '‘' : '’');
      return replaceRange(o - 1, o, rep);
    }
    // symbolen meteen; woorden bij spatie of leesteken
    for (const [f, t] of App.AC_LIST) { if (!/[a-z]$/i.test(f) && before.endsWith(f)) return replaceRange(o - f.length, o, t); }
    if (/[\s.,;:!?)]/.test(data)) {
      const m = /(\p{L}+)[\s.,;:!?)]$/u.exec(before);
      if (m) {
        const w = m[1], low = w.toLowerCase();
        const hit = App.AC_LIST.find(([f]) => f === low);
        if (hit) { const rep = w[0] === w[0].toUpperCase() ? hit[1][0].toUpperCase() + hit[1].slice(1) : hit[1]; const a = o - 1 - w.length; return replaceRange(a, o - 1, rep); }
        // TWee HOofdletters aan het begin verbeteren
        if (/^\p{Lu}\p{Lu}\p{Ll}{2,}$/u.test(w)) { const a = o - 1 - w.length; return replaceRange(a, o - 1, w[0] + w[1].toLowerCase() + w.slice(2)); }
      }
      // eerste letter van een zin met een hoofdletter (niet in tabellen bij korte waarden)
      if (data === ' ') {
        const m2 = /(^|[.!?]\s+)(\p{Ll})(\p{L}*)\s$/u.exec(before);
        if (m2 && !AC_ABBR.test(before.slice(0, before.length - m2[2].length - m2[3].length - 1).trim()) && !(ctx && ctx.cell && m2[3].length < 1)) {
          const a = o - 1 - m2[2].length - m2[3].length;
          if (sel.start.p === 0 || m2[1] || App.plainTextLen(body.paras[sel.start.p - 1] || { runs: [] }) >= 0) return replaceRange(a, a + 1, m2[2].toUpperCase());
        }
      }
      // automatische lijst: "1. " of "- " aan het begin van een alinea in een tekstvak
      if (data === ' ' && ctx && ctx.o && ctx.o.txbox && !p.bullet && sel.start.o <= 4) {
        const m3 = /^(\d+|[a-z])([.)])\s$/i.exec(before), m4 = /^([*\-•>])\s$/.exec(before);
        if (m3 || m4) {
          const r = replaceRange(0, before.length, '');
          p.bullet = m3 ? { type: 'auto', scheme: /\d/.test(m3[1]) ? (m3[2] === ')' ? 'arabicParenR' : 'arabicPeriod') : (m3[2] === ')' ? 'alphaLcParenR' : 'alphaLcPeriod'), start: /\d/.test(m3[1]) ? +m3[1] : 1 } : { type: 'char', char: m4[1] === '>' ? '➢' : m4[1] === '-' ? '–' : '•', font: 'Arial' };
          p.marL = 24; p.indent = -24;
          return { p: r.p, o: 0 };
        }
      }
    }
    // breuken en streepjes
    if (data === ' ') {
      const m5 = /(^|\s)(1\/2|1\/4|3\/4)\s$/.exec(before);
      if (m5) { const rep = { '1/2': '½', '1/4': '¼', '3/4': '¾' }[m5[2]]; const a = o - 1 - m5[2].length; return replaceRange(a, o - 1, rep); }
      const m6 = /\S\s(-{1,2})\s$/.exec(before);
      if (m6) { const a = o - 1 - m6[1].length; return replaceRange(a, o - 1, '–'); }
    }
    return null;
  };

  /* ---------- Mini-werkbalk bij tekstselectie ---------- */
  let mb = null, mbTimer = 0;
  App.hideMinibar = () => { if (mb) { mb.remove(); mb = null; } };
  App.minibarSoon = () => { clearTimeout(mbTimer); mbTimer = setTimeout(showMinibar, 250); };
  const showMinibar = () => {
    if (!editing() || App.settings.minibar === false) { App.hideMinibar(); return; }
    const s = window.getSelection();
    if (!s.rangeCount || s.isCollapsed) { App.hideMinibar(); return; }
    const r = s.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) return;
    if (!mb) {
      mb = document.createElement('div');
      mb.id = 'minibar';
      mb.innerHTML = `<button class="rb" data-cmd="growFont" title="${App.t('Tekengrootte vergroten')}"><span class="i">text_increase</span></button><button class="rb" data-cmd="shrinkFont" title="${App.t('Tekengrootte verkleinen')}"><span class="i">text_decrease</span></button><span class="sep"></span>
        <button class="rb" data-cmd="bold" data-state="bold" title="${App.t('Vet')}"><span class="i">format_bold</span></button><button class="rb" data-cmd="italic" data-state="italic" title="${App.t('Cursief')}"><span class="i">format_italic</span></button><button class="rb" data-cmd="underline" data-state="underline" title="${App.t('Onderstrepen')}"><span class="i">format_underlined</span></button>
        <button class="rb" data-menu="color:fontColor" title="${App.t('Tekstkleur')}"><span class="i">format_color_text</span></button><button class="rb" data-menu="color:hlColor" title="${App.t('Markeren')}"><span class="i">ink_highlighter</span></button><span class="sep"></span>
        <button class="rb" data-cmd="align" data-arg="l" title="${App.t('Links uitlijnen')}"><span class="i">format_align_left</span></button><button class="rb" data-cmd="align" data-arg="ctr" title="${App.t('Centreren')}"><span class="i">format_align_center</span></button><button class="rb" data-cmd="align" data-arg="r" title="${App.t('Rechts uitlijnen')}"><span class="i">format_align_right</span></button>
        <button class="rb" data-cmd="bullets" title="${App.t('Opsommingstekens')}"><span class="i">format_list_bulleted</span></button><button class="rb" data-cmd="numbering" title="${App.t('Nummering')}"><span class="i">format_list_numbered</span></button>`;
      mb.addEventListener('mousedown', (e) => e.preventDefault());
      document.body.appendChild(mb);
    }
    mb.style.left = Math.max(8, Math.min(innerWidth - 420, r.left)) + 'px';
    mb.style.top = Math.max(8, r.top - 46) + 'px';
    App.updateState();
  };
  document.addEventListener('mousedown', (e) => { if (mb && !e.target.closest('#minibar') && !e.target.closest('.menu')) App.hideMinibar(); });
})();
