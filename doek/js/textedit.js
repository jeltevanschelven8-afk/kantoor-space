/* =========================================================
   Doek (gemaakt door JJ van Schelven) — tekst bewerken in de dia.
   De browser typt de tekens zelf (ook IME en spellingcontrole); alles wat de
   structuur verandert (Enter, alinea's samenvoegen, plakken, opmaak) gaat via het
   model. Na elke wijziging wordt de DOM terug naar alinea's en runs gelezen.
   ========================================================= */
'use strict';

(() => {
  const st = App.state;
  let E = null;   // { id, o, owner, el (.ob), tx (.tx), cell?, undo: [], redo: [], pending, lastPush }

  /* ---------- Waar wordt bewerkt ---------- */
  const bodyOf = () => (E.cell ? E.cellRef().text : E.o.text);
  const setBody = (b) => { if (E.cell) E.cellRef().text = b; else E.o.text = b; };
  const parasEl = () => E.tx.querySelector('.txi') || E.tx;
  const pEls = () => Array.from(parasEl().children).filter((n) => n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'DIV'));

  /* ---------- DOM ↔ model: posities ---------- */
  // Tekstlengte van een alinea-element (zonder opsommingsteken; <br> = 1 teken '\v')
  const walkP = (p, fn) => {
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.nodeType === 1 && n.classList && (n.classList.contains('bu')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n;
    while ((n = tw.nextNode())) { if (fn(n) === false) return; }
  };
  const isLastBr = (n) => { const p = n.closest && n.closest('p, div'); if (!p) return false; let last = null; walkP(p, (x) => { if (x.nodeType === 3 && x.nodeValue.replace(/​/g, '')) last = x; else if (x.nodeType === 1 && x.tagName === 'BR') last = x; }); return last === n; };
  const domToPos = (node, offset) => {
    const ps = pEls();
    let p = node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'DIV') && ps.includes(node) ? node : (node.nodeType === 1 ? node : node.parentElement).closest('.txi > p, .txi > div, .tx > p, .cell-tx > p');
    if (!p || !ps.includes(p)) {
      // buiten een alinea (bijv. in .txi zelf): naar begin of einde
      if (node === parasEl()) { const i = Math.min(offset, ps.length - 1); return { p: Math.max(0, i), o: offset >= ps.length ? textLen(ps[ps.length - 1]) : 0 }; }
      return { p: 0, o: 0 };
    }
    const pi = ps.indexOf(p);
    let count = 0, done = false;
    // positie als (container, offset): tel alles wat ervoor komt
    const r = document.createRange();
    try { r.setStart(p, 0); r.setEnd(node, offset); } catch { return { p: pi, o: 0 }; }
    const frag = r.cloneContents();
    frag.querySelectorAll('.bu').forEach((b) => b.remove());
    const tw = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) count += n.nodeValue.replace(/​/g, '').length;
      else if (n.tagName === 'BR' && !(n.dataset && n.dataset.end)) count += 1;
    }
    void done;
    return { p: pi, o: Math.min(count, textLen(p)) };
  };
  const textLen = (p) => { let c = 0; walkP(p, (n) => { if (n.nodeType === 3) c += n.nodeValue.replace(/​/g, '').length; else if (n.tagName === 'BR' && !isLastBr(n)) c += 1; }); return c; };
  const posToDom = (pos) => {
    const ps = pEls();
    const p = ps[App.clamp(pos.p, 0, ps.length - 1)];
    if (!p) return { node: parasEl(), offset: 0 };
    let left = pos.o, hit = null;
    walkP(p, (n) => {
      if (n.nodeType === 3) {
        const len = n.nodeValue.length;
        if (left <= len) { hit = { node: n, offset: left }; return false; }
        left -= len;
      } else if (n.tagName === 'BR') {
        if (isLastBr(n)) return;
        if (left === 0) { hit = { node: n.parentNode, offset: Array.prototype.indexOf.call(n.parentNode.childNodes, n) }; return false; }
        left -= 1;
        if (left === 0) { hit = { node: n.parentNode, offset: Array.prototype.indexOf.call(n.parentNode.childNodes, n) + 1 }; return false; }
      }
      return true;
    });
    if (hit) return hit;
    // aan het einde: in de laatste run, of in de lege alinea
    const runs = p.querySelectorAll('.r');
    const last = runs[runs.length - 1];
    if (last) { const t = last.lastChild; if (t && t.nodeType === 3) return { node: t, offset: t.nodeValue.length }; return { node: last, offset: last.childNodes.length }; }
    const bu = p.querySelector('.bu');
    return { node: p, offset: bu ? Array.prototype.indexOf.call(p.childNodes, bu) + 1 : 0 };
  };
  App.textEdit = {};
  const getSel = () => {
    const s = window.getSelection();
    if (!s.rangeCount || !E || !E.tx.contains(s.anchorNode)) return null;
    const a = domToPos(s.anchorNode, s.anchorOffset), f = domToPos(s.focusNode, s.focusOffset);
    const before = a.p < f.p || (a.p === f.p && a.o <= f.o);
    return { start: before ? a : f, end: before ? f : a, anchor: a, focus: f, collapsed: a.p === f.p && a.o === f.o };
  };
  const setSel = (start, end = start) => {
    const s = window.getSelection();
    const a = posToDom(start), b = posToDom(end);
    try { s.setBaseAndExtent(a.node, a.offset, b.node, b.offset); } catch { /* niets */ }
  };
  App.textEdit.getSel = () => getSel();
  App.textEdit.setSel = setSel;

  /* ---------- DOM → model ---------- */
  // Eén alinea-element teruglezen naar runs (de opmaak komt van de oorspronkelijke runs via data-r)
  const readPara = (pEl, model) => {
    const runs = [];
    const src = model ? model.runs : [{ t: '' }];
    let cur = null;
    const push = (ri, text) => {
      if (!text) return;
      const base = src[ri] || src[src.length - 1] || {};
      if (cur && cur.ri === ri) { cur.run.t += text; return; }
      const run = { ...base, t: text };
      if (run.fld) { delete run.fld; }       // getypte tekst in een veld wordt gewone tekst
      cur = { ri, run }; runs.push(run);
    };
    const visit = (node, ri) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) { push(ri, n.nodeValue.replace(/​/g, '')); return; }
        if (n.nodeType !== 1) return;
        if (n.classList.contains('bu')) return;
        if (n.tagName === 'BR') { if (!isLastBr(n)) push(ri, '\v'); return; }
        if (n.dataset && n.dataset.fld !== undefined && n.classList.contains('r')) {
          const r = src[+n.dataset.r]; if (r && r.fld) { runs.push({ ...r }); cur = null; } return;
        }
        const r2 = n.classList.contains('r') && n.dataset.r !== undefined ? +n.dataset.r : ri;
        visit(n, r2);
      });
    };
    // tekst vóór de eerste run hoort bij de eerste run
    visit(pEl, 0);
    const out = { ...(model || {}), runs: runs.length ? runs : [{ ...(src.find((r) => !r.fld) || src[0] || {}), t: '' }] };
    out.runs.forEach((r) => { if (r.fld === undefined) delete r.fld; });
    return App.normalizePara(out);
  };
  // Hele tekstruimte teruglezen; geeft true als de DOM niet meer netjes is (opnieuw tekenen nodig)
  const syncFromDom = () => {
    const body = bodyOf();
    const old = body.paras;
    const ps = pEls();
    const paras = ps.map((p, i) => {
      const di = p.dataset && p.dataset.p !== undefined ? +p.dataset.p : i;
      return readPara(p, old[di] || old[i] || old[old.length - 1]);
    });
    body.paras = paras.length ? paras : [App.emptyPara()];
    // nette vorm: elke alinea een <p data-p=i>, runs met oplopende data-r
    let dirty = ps.length !== body.paras.length;
    ps.forEach((p, i) => {
      if (p.tagName !== 'P' || +p.dataset.p !== i) dirty = true;
      const rs = p.querySelectorAll(':scope > .r');
      let k = 0;
      p.childNodes.forEach((n) => { if (n.nodeType === 3 && n.nodeValue.replace(/​/g, '')) dirty = true; else if (n.nodeType === 1 && !n.classList.contains('r') && !n.classList.contains('bu') && n.tagName !== 'BR') dirty = true; });
      rs.forEach((r) => { if (+r.dataset.r !== k++) dirty = true; });
      if (rs.length !== body.paras[i].runs.filter((r) => r.t || r.fld).length && body.paras[i].runs.some((r) => r.t)) dirty = true;
    });
    return dirty;
  };

  /* ---------- Model → DOM ---------- */
  const rerender = (sel) => {
    if (!E) return;
    const o = E.o;
    if (E.cell) {
      const host = E.tx;
      host.replaceChildren(App.renderParas({ id: o.id + '-c', type: 'cell', text: bodyOf() }, E.owner, bodyOf(), { mode: 'edit' }));
    } else {
      const changed = App.autofit(o, E.owner);
      if (changed) {
        const fresh = App.renderObj(o, { mode: 'edit', theme: App.theme(), owner: E.owner, layer: 'slide', num: App.state.slide + 1 });
        fresh.classList.add('ly-slide');
        const tx = fresh.querySelector('.tx');
        if (tx && !tx.classList.contains('prompt')) { E.el.replaceWith(fresh); E.el = fresh; E.tx = tx; } else rebuildTx();
        App.drawSelection();
      } else rebuildTx();
    }
    arm();
    if (sel) setSel(sel.start, sel.end);
  };
  const rebuildTx = () => {
    const b = App.box(E.o, E.owner);
    const rect = App.textRect(E.o, b);
    const tx = App.renderTextBox(E.o, E.owner, rect, { mode: 'edit' });
    E.tx.replaceWith(tx); E.tx = tx;
  };
  const arm = () => {
    const t = E.tx;
    t.contentEditable = 'true';
    t.spellcheck = App.settings.spell !== false;
    t.lang = (App.pres.lang || 'nl-NL');
    t.classList.remove('prompt');
    t.setAttribute('role', 'textbox'); t.setAttribute('aria-multiline', 'true');
  };

  /* ---------- Geschiedenis binnen het tekstvak ---------- */
  const snap = (sel) => ({ body: JSON.stringify(bodyOf()), sel: sel || getSel() });
  const pushUndo = (kind) => {
    const now = Date.now();
    if (kind === 'type' && E.lastKind === 'type' && now - E.lastPush < 1200) return;
    E.undo.push(snap()); if (E.undo.length > 300) E.undo.shift();
    E.redo = []; E.lastPush = now; E.lastKind = kind;
  };
  App.textEdit.undo = () => {
    if (!E || !E.undo.length) return false;
    E.redo.push(snap());
    const s = E.undo.pop();
    setBody(JSON.parse(s.body));
    rerender(s.sel);
    changed(true);
    E.lastKind = null;
    return true;
  };
  App.textEdit.redo = () => {
    if (!E || !E.redo.length) return false;
    E.undo.push(snap());
    const s = E.redo.pop();
    setBody(JSON.parse(s.body));
    rerender(s.sel);
    changed(true);
    return true;
  };
  // Na een wijziging: dia als gewijzigd markeren, na een pauze een stap in de algemene geschiedenis
  const changed = (structural) => {
    App.touch(); App.markDirty();
    App.history.later(900);
    if (structural !== 'noThumb') App.thumbs && App.thumbs.refreshSoon && App.thumbs.refreshSoon();
    App.scheduleState();
    App.emit('textchange');
  };

  /* ---------- Bewerken starten en stoppen ---------- */
  App.textEdit.start = (id, opts = {}) => {
    if (App.readOnly && App.readOnly()) return;
    const o = App.obj(id); if (!o) return;
    if (o.type !== 'shape') return;
    if (E && E.id === id && !opts.cell) { App.textEdit.focus(); return; }
    App.textEdit.stop();
    if (!o.text) o.text = { paras: [App.emptyPara()] };
    const surf = App.surface();
    App.renderStage(true);
    let el = App.objEl(id);
    if (!el) return;
    st.edit = id; st.sel = [id];
    E = { id, o, owner: surf.owner, el, tx: null, undo: [], redo: [], pending: null, lastPush: 0 };
    // placeholder: echte (lege) tekst in plaats van de voorbeeldtekst
    let tx = el.querySelector(':scope > .tx');
    if (!tx || tx.classList.contains('prompt')) {
      const b = App.box(o, surf.owner);
      const ntx = App.renderTextBox(o, surf.owner, App.textRect(o, b), { mode: 'edit' });
      if (tx) tx.replaceWith(ntx); else el.appendChild(ntx);
      tx = ntx;
      el.querySelectorAll('.ph-ins').forEach((x) => x.remove());
      el.classList.remove('empty');
    }
    E.tx = tx;
    arm();
    tx.focus({ preventScroll: true });
    // cursor plaatsen
    const P = bodyOf().paras;
    const endPos = { p: P.length - 1, o: App.plainTextLen(P[P.length - 1]) };
    if (opts.replaceWith !== undefined) { setSel({ p: 0, o: 0 }, endPos); App.textEdit.insertText(opts.replaceWith); }
    else if (opts.selectAll) setSel({ p: 0, o: 0 }, endPos);
    else if (opts.x !== undefined) {
      const c = caretFromPoint(opts.x, opts.y);
      if (c && tx.contains(c.node)) {
        const s = window.getSelection(); s.collapse(c.node, c.offset);
        if (opts.selectWord) selectWordAtCaret();
        else if (App.isEmptyText(o)) setSel({ p: 0, o: 0 });
      } else setSel(endPos);
    } else setSel(endPos);
    App.drawSelection();
    App.updateContext();
    App.emit('selection');
    App.scheduleState();
  };
  const caretFromPoint = (x, y) => {
    if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); return c ? { node: c.offsetNode, offset: c.offset } : null; }
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r ? { node: r.startContainer, offset: r.startOffset } : null; }
    return null;
  };
  const selectWordAtCaret = () => {
    const s = window.getSelection();
    if (s.modify) { s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word'); }
  };
  App.plainTextLen = (p) => p.runs.reduce((n, r) => n + (r.fld ? (r.t || ' ').length : r.t.length), 0);
  App.textEdit.stop = (keepSel) => {
    if (!E) return;
    const cur = E;
    try { if (syncFromDom()) { /* nette vorm komt bij het opnieuw tekenen */ } } catch (e) { console.warn(e); }
    App.normalizeBody(bodyOf());
    E = null; st.edit = null;
    const o = cur.o;
    const surf = App.surface();
    // leeg tekstvak (geen placeholder) verdwijnt, zoals in bekende programma's
    if (!cur.cell && o.txbox && !o.ph && App.isEmptyText(o) && App.findObj(o.id) && !(o.fill && o.fill.type !== 'none') && !(o.line && o.line.type !== 'none')) {
      App.removeObjs([o.id]);
      st.sel = [];
    } else if (!cur.cell) App.autofit(o, surf.owner);
    window.getSelection().removeAllRanges();
    App.history.flush();
    App.changed();
    if (keepSel !== true) App.updateContext();
    App.renderStage(true);
    App.drawSelection();
    App.emit('selection');
    App.scheduleState();
    App.hideMinibar && App.hideMinibar();
  };
  App.textEdit.active = () => (E ? E.id : null);
  App.textEdit.focus = () => { if (E) E.tx.focus({ preventScroll: true }); };
  App.textEdit.cellStart = (tableObj, r, c, opts = {}) => {
    if (App.readOnly && App.readOnly()) return;
    App.textEdit.stop();
    const el = App.objEl(tableObj.id); if (!el) return;
    const td = el.querySelector(`td[data-r="${r}"][data-c="${c}"]`); if (!td) return;
    const cellRef = () => tableObj.rows[r].cells[c];
    if (!cellRef().text) cellRef().text = { paras: [App.emptyPara()] };
    const tx = td.querySelector('.cell-tx');
    st.edit = tableObj.id; st.sel = [tableObj.id];
    E = { id: tableObj.id, o: tableObj, owner: App.surface().owner, el, tx, cell: { r, c }, cellRef, undo: [], redo: [], lastPush: 0 };
    arm();
    tx.focus({ preventScroll: true });
    if (opts.x !== undefined) { const cp = caretFromPoint(opts.x, opts.y); if (cp && tx.contains(cp.node)) window.getSelection().collapse(cp.node, cp.offset); }
    else { const P = cellRef().text.paras; const endPos = { p: P.length - 1, o: App.plainTextLen(P[P.length - 1]) }; if (opts.selectAll) setSel({ p: 0, o: 0 }, endPos); else setSel(endPos); }
    App.emit('selection');
  };
  App.textEdit.cell = () => (E && E.cell ? E.cell : null);

  /* ---------- Modelbewerkingen ---------- */
  // Splits de runs van alinea pi op tekenpositie off; geeft de index van de eerste run ná de positie
  const splitAt = (para, off) => {
    let pos = 0;
    for (let i = 0; i < para.runs.length; i++) {
      const r = para.runs[i]; const len = r.t.length;
      if (off === pos) return i;
      if (off < pos + len) {
        if (r.fld) return i + 1;
        const a = { ...r, t: r.t.slice(0, off - pos) }, b = { ...r, t: r.t.slice(off - pos) };
        para.runs.splice(i, 1, a, b);
        return i + 1;
      }
      pos += len;
    }
    return para.runs.length;
  };
  App.splitRunsAt = splitAt;
  const runPropsAt = (para, off) => {
    let pos = 0;
    for (const r of para.runs) { if (off <= pos + r.t.length && (off > pos || pos === 0)) return r; pos += r.t.length; }
    return para.runs[para.runs.length - 1] || {};
  };
  // Tekst tussen start en end verwijderen (model)
  const deleteRange = (body, s, e) => {
    if (s.p === e.p) {
      const p = body.paras[s.p];
      const i = splitAt(p, s.o), j = splitAt(p, e.o);
      // splitAt(e) kan de runs verschuiven: opnieuw tellen
      const i2 = runIndexAt(p, s.o), j2 = runIndexAt(p, e.o);
      p.runs.splice(i2, j2 - i2);
      void i; void j;
      if (!p.runs.length) p.runs.push({ t: '' });
      App.normalizePara(p);
      return;
    }
    const a = body.paras[s.p], b = body.paras[e.p];
    const ia = splitAt(a, s.o); a.runs = a.runs.slice(0, ia);
    const ib = splitAt(b, e.o); const tail = b.runs.slice(ib);
    a.runs.push(...tail);
    if (!a.runs.length) a.runs.push({ t: '' });
    body.paras.splice(s.p + 1, e.p - s.p);
    App.normalizePara(a);
  };
  const runIndexAt = (p, off) => { let pos = 0; for (let i = 0; i < p.runs.length; i++) { if (pos === off) return i; pos += p.runs[i].t.length; } return p.runs.length; };
  const insertAt = (body, pos, text, props) => {
    const p = body.paras[pos.p];
    const lines = String(text).split('\n');
    const base = props || runPropsAt(p, pos.o);
    const i = splitAt(p, pos.o);
    const first = { ...base, t: lines[0] }; delete first.fld;
    if (lines.length === 1) { p.runs.splice(i, 0, first); App.normalizePara(p); return { p: pos.p, o: pos.o + lines[0].length }; }
    const rest = p.runs.splice(i);
    p.runs.push(first);
    const newParas = lines.slice(1).map((l, k) => ({ ...p, runs: [{ ...first, t: l }], ...(k === lines.length - 2 ? {} : {}) }));
    const last = newParas[newParas.length - 1];
    last.runs.push(...rest);
    body.paras.splice(pos.p + 1, 0, ...newParas.map((x) => App.normalizePara({ ...x, runs: x.runs.slice() })));
    App.normalizePara(p);
    return { p: pos.p + lines.length - 1, o: lines[lines.length - 1].length };
  };
  App.textEdit.insertText = (text, props) => {
    if (!E) return;
    text = String(text).replace(/[\u0000-\u0008\u000c\u000e-\u001f]/g, '');   // stuurtekens horen niet in tekst (breken ook .pptx/XML)
    if (!text) return;
    pushUndo('paste');
    syncFromDom();
    const s = getSel() || { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } };
    const body = bodyOf();
    if (!s.collapsed) deleteRange(body, s.start, s.end);
    const pending = E.pending;
    const p = body.paras[s.start.p];
    const base = pending ? { ...runPropsAt(p, s.start.o), ...pending } : props;
    const pos = insertAt(body, s.start, String(text).replace(/\r\n?/g, '\n').replace(/\t/g, '\t'), base);
    E.pending = null;
    rerender({ start: pos, end: pos });
    changed(true);
  };

  /* ---------- Invoer ---------- */
  document.addEventListener('beforeinput', (e) => {
    if (!E || !E.tx.contains(e.target) && e.target !== E.tx) return;
    const t = e.inputType;
    if (t === 'insertParagraph' || (t === 'insertLineBreak' && !e.isTrusted)) { e.preventDefault(); splitParagraph(); return; }
    if (t === 'insertLineBreak') { e.preventDefault(); App.textEdit.insertText('\v'); return; }
    if (t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertFromYank') { e.preventDefault(); return; }   // via het paste-event
    if (t === 'historyUndo') { e.preventDefault(); App.textEdit.undo(); return; }
    if (t === 'historyRedo') { e.preventDefault(); App.textEdit.redo(); return; }
    if (/^format/.test(t)) { e.preventDefault(); return; }                                    // opmaak gaat via onze knoppen
    const s = getSel();
    if (!s) return;
    if (t === 'insertText' && E.pending && s.collapsed && e.data) { e.preventDefault(); App.textEdit.insertText(e.data); return; }
    const crossesPara = s.start.p !== s.end.p;
    const atStart = s.collapsed && s.start.o === 0, atEnd = s.collapsed && s.start.o === App.plainTextLen(bodyOf().paras[s.start.p]);
    if ((t === 'deleteContentBackward' && atStart) || (t === 'deleteContentForward' && atEnd) || (/^delete/.test(t) && crossesPara) || (t === 'insertText' && crossesPara) || (t === 'insertReplacementText' && crossesPara)) {
      e.preventDefault();
      pushUndo('delete');
      syncFromDom();
      const body = bodyOf();
      if (!s.collapsed) {
        deleteRange(body, s.start, s.end);
        let pos = s.start;
        if (t === 'insertText' && e.data) pos = insertAt(body, s.start, e.data);
        rerender({ start: pos, end: pos });
      } else if (t === 'deleteContentBackward') {
        if (s.start.p === 0) {
          // begin van de eerste alinea: opsommingsteken of inspringing weghalen
          const p = body.paras[0];
          if (p.lvl) p.lvl--; else if (p.bullet && p.bullet.type !== 'none') p.bullet = { type: 'none' }; else if (paraHasBullet(0)) p.bullet = { type: 'none' };
          rerender({ start: s.start, end: s.start });
        } else {
          const p = body.paras[s.start.p];
          if (p.lvl && App.plainTextLen(p) >= 0 && paraHasBullet(s.start.p) && false) { p.lvl--; rerender(s); }
          else {
            const prev = body.paras[s.start.p - 1];
            const off = App.plainTextLen(prev);
            prev.runs.push(...p.runs);
            App.normalizePara(prev);
            body.paras.splice(s.start.p, 1);
            const pos = { p: s.start.p - 1, o: off };
            rerender({ start: pos, end: pos });
          }
        }
      } else if (t === 'deleteContentForward' && s.start.p < body.paras.length - 1) {
        const p = body.paras[s.start.p], next = body.paras[s.start.p + 1];
        p.runs.push(...next.runs); App.normalizePara(p);
        body.paras.splice(s.start.p + 1, 1);
        rerender({ start: s.start, end: s.start });
      }
      changed(true);
      return;
    }
    if (/^(insert|delete)/.test(t)) pushUndo(t === 'insertText' ? 'type' : 'delete');
  });
  const paraHasBullet = (i) => {
    const p = bodyOf().paras[i];
    const ps = App.paraStyle(E.cell ? { type: 'cell' } : E.o, E.owner, p);
    return ps.bullet && ps.bullet.type !== 'none';
  };
  let composing = false;
  document.addEventListener('compositionstart', (e) => { if (E && E.tx.contains(e.target)) composing = true; });
  document.addEventListener('compositionend', (e) => { if (E && E.tx.contains(e.target)) { composing = false; afterInput(); } });
  document.addEventListener('input', (e) => {
    if (!E || !(E.tx.contains(e.target) || e.target === E.tx)) return;
    if (composing) return;
    afterInput(e);
  });
  const afterInput = (e) => {
    const sel = getSel();
    const dirty = syncFromDom();
    if (e && e.inputType === 'insertText' && e.data && App.autoCorrect) {
      const r = App.autoCorrect(bodyOf(), sel, e.data, { o: E.o, owner: E.owner, cell: !!E.cell });
      if (r) { rerender({ start: r, end: r }); changed(); return; }
    }
    if (dirty) rerender(sel ? { start: sel.start, end: sel.end } : null);
    else if (!E.cell) {
      // alleen passend maken als dat iets verandert
      if (App.autofit(E.o, E.owner)) rerender(sel ? { start: sel.start, end: sel.end } : null);
    }
    changed();
  };
  const splitParagraph = () => {
    pushUndo('split');
    syncFromDom();
    const s = getSel(); if (!s) return;
    const body = bodyOf();
    if (!s.collapsed) deleteRange(body, s.start, s.end);
    const p = body.paras[s.start.p];
    // Enter in een lege opsommingsalinea: niveau omlaag of opsomming stoppen
    if (App.plainTextLen(p) === 0 && paraHasBullet(s.start.p) && body.paras.length > 1) {
      if (p.lvl) { p.lvl--; rerender({ start: s.start, end: s.start }); changed(true); return; }
    }
    const i = splitAt(p, s.start.o);
    const tail = p.runs.splice(i);
    if (!p.runs.length) p.runs.push({ ...(tail[0] || {}), t: '' });
    const np = { ...App.clone(p), runs: tail.length ? tail : [{ ...p.runs[p.runs.length - 1], t: '' }] };
    np.runs.forEach((r) => { if (r.fld && !tail.includes(r)) delete r.fld; });
    App.normalizePara(p); App.normalizePara(np);
    body.paras.splice(s.start.p + 1, 0, np);
    const pos = { p: s.start.p + 1, o: 0 };
    rerender({ start: pos, end: pos });
    changed(true);
  };

  /* ---------- Toetsen tijdens bewerken ---------- */
  document.addEventListener('keydown', (e) => {
    if (!E || !(E.tx.contains(e.target) || e.target === E.tx)) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    if (k === 'Escape') { e.preventDefault(); App.textEdit.stop(); return; }
    if (k === 'Tab' && !ctrl) {
      e.preventDefault();
      if (E.cell && App.tables) { App.tables.tabMove(e.shiftKey); return; }
      const s = getSel();
      const multi = s && s.start.p !== s.end.p;
      const atStart = s && s.collapsed && s.start.o === 0;
      if (multi || atStart || (s && paraHasBullet(s.start.p) && s.collapsed && s.start.o === 0)) App.exec(e.shiftKey ? 'outdent' : 'indent');
      else App.textEdit.insertText('\t');
      return;
    }
    if (ctrl && k.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); if (!App.textEdit.undo()) { App.textEdit.stop(); App.history.undo(); } return; }
    if (ctrl && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); App.textEdit.redo(); return; }
    if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); const P = bodyOf().paras; setSel({ p: 0, o: 0 }, { p: P.length - 1, o: App.plainTextLen(P[P.length - 1]) }); App.scheduleState(); return; }
    if (ctrl && k === ' ') { e.preventDefault(); App.exec('clearFormat'); return; }
    if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); App.exec(e.shiftKey ? 'superscript' : 'subscript'); return; }
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); App.exec('save'); return; }
    if (ctrl && k.toLowerCase() === 'k') { e.preventDefault(); App.exec('linkDialog'); return; }
    if (ctrl && k.toLowerCase() === 'm') { e.preventDefault(); App.textEdit.stop(); App.exec('newSlide'); return; }
    if (ctrl && !e.altKey && App.globalKeys && /^[biuletjrdg]$/i.test(k)) { if (App.globalKeys(e)) return; }
    if (ctrl && e.shiftKey && (k === '>' || k === '.' || k === '<' || k === ',')) { App.globalKeys(e); return; }
    if (e.key === 'F3' && e.shiftKey) { e.preventDefault(); App.exec('changeCase', 'cycle'); return; }
    if (e.key === 'F5') { App.globalKeys(e); return; }
  });
  document.addEventListener('selectionchange', () => {
    if (!E) return;
    if (E.pending && E._pendingAt) { const s = getSel(); if (!s || !s.collapsed || s.start.p !== E._pendingAt.p || s.start.o !== E._pendingAt.o) E.pending = null; }
    App.scheduleState();
    App.minibarSoon && App.minibarSoon();
  });

  /* ---------- Plakken en kopiëren in tekst ---------- */
  document.addEventListener('paste', (e) => {
    if (!E || !(E.tx.contains(e.target) || e.target === E.tx)) return;
    e.preventDefault();
    const dt = e.clipboardData;
    const html = dt.getData('text/html');
    // eigen runs (van Doek) met opmaak; anders alleen tekst
    const m = /data-doek-runs="([^"]+)"/.exec(html || '');
    if (m && !App.state.pastePlain) {
      try { const paras = JSON.parse(decodeURIComponent(escape(atob(m[1])))); insertParas(paras); return; } catch { /* gewone tekst */ }
    }
    const files = Array.from(dt.files || []);
    if (files.length && files[0].type.startsWith('image/')) { App.textEdit.stop(); App.insertImageFile(files[0]); return; }
    const t = dt.getData('text/plain');
    if (t) App.textEdit.insertText(t.replace(/\r\n?/g, '\n'));
  });
  const insertParas = (paras) => {
    if (!Array.isArray(paras) || !paras.length) return;
    pushUndo('paste');
    syncFromDom();
    const s = getSel(); const body = bodyOf();
    if (!s.collapsed) deleteRange(body, s.start, s.end);
    const clean = paras.map((p) => App.cleanPara ? App.cleanPara(p) : p);
    const cur = body.paras[s.start.p];
    const i = splitAt(cur, s.start.o);
    const tail = cur.runs.splice(i);
    cur.runs.push(...clean[0].runs);
    const rest = clean.slice(1).map((p) => ({ ...p, runs: p.runs.slice() }));
    let endPos;
    if (rest.length) {
      rest[rest.length - 1].runs.push(...tail);
      body.paras.splice(s.start.p + 1, 0, ...rest);
      const lp = rest[rest.length - 1];
      endPos = { p: s.start.p + rest.length, o: App.plainTextLen(lp) - tail.reduce((n, r) => n + r.t.length, 0) };
    } else { cur.runs.push(...tail); endPos = { p: s.start.p, o: s.start.o + clean[0].runs.reduce((n, r) => n + r.t.length, 0) }; }
    body.paras.forEach(App.normalizePara);
    rerender({ start: endPos, end: endPos });
    changed(true);
  };
  const selectedParas = () => {
    syncFromDom();
    const s = getSel(); if (!s || s.collapsed) return null;
    const body = App.clone(bodyOf());
    const out = [];
    for (let i = s.start.p; i <= s.end.p; i++) {
      const p = App.clone(body.paras[i]);
      const a = i === s.start.p ? s.start.o : 0, b = i === s.end.p ? s.end.o : App.plainTextLen(p);
      const j = splitAt(p, b); const k2 = splitAt(p, a);
      p.runs = p.runs.slice(runIndexAt(p, a), runIndexAt(p, b));
      void j; void k2;
      if (!p.runs.length) p.runs = [{ t: '' }];
      out.push(p);
    }
    return out;
  };
  const onCopy = (e, cut) => {
    if (!E || !(E.tx.contains(e.target) || e.target === E.tx)) return;
    const paras = selectedParas(); if (!paras) return;
    e.preventDefault();
    const text = paras.map((p) => p.runs.map((r) => r.t.replace(/\v/g, '\n')).join('')).join('\n');
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', `<meta charset="utf-8"><span data-doek-runs="${btoa(unescape(encodeURIComponent(JSON.stringify(paras))))}">${App.esc(text)}</span>`);
    if (cut) {
      pushUndo('delete');
      const s = getSel();
      deleteRange(bodyOf(), s.start, s.end);
      rerender({ start: s.start, end: s.start });
      changed(true);
    }
  };
  document.addEventListener('copy', (e) => onCopy(e, false));
  document.addEventListener('cut', (e) => onCopy(e, true));
  // slepen van tekst binnen het vak: als knippen + plakken via de browser zou de structuur breken
  document.addEventListener('drop', (e) => { if (E && E.tx.contains(e.target)) e.preventDefault(); }, true);

  /* ---------- Opmaak op de selectie ---------- */
  // Bereik bepalen: selectie in de tekst, of (zonder selectie) het woord onder de cursor zoals bekende programma's
  const workRange = (opts = {}) => {
    syncFromDom();
    const s = getSel(); if (!s) return null;
    if (!s.collapsed || opts.noWord) return s;
    // cursor in een woord: dat woord
    const p = bodyOf().paras[s.start.p];
    const text = p.runs.map((r) => r.t).join('');
    let a = s.start.o, b = s.start.o;
    while (a > 0 && /[\p{L}\p{N}]/u.test(text[a - 1])) a--;
    while (b < text.length && /[\p{L}\p{N}]/u.test(text[b])) b++;
    if (a === b || a === s.start.o && b === s.start.o) return { ...s, empty: true };
    return { start: { p: s.start.p, o: a }, end: { p: s.start.p, o: b }, collapsed: false, word: true, caret: s.start };
  };
  // fn(run) past een run aan; geldt voor de runs in het bereik
  App.textEdit.applyRuns = (fn, opts = {}) => {
    if (!E) return false;
    const r = workRange(opts);
    if (!r) return false;
    if (r.empty) {
      // geen tekst geselecteerd: opmaak geldt voor wat je daarna typt
      const s = getSel(); const p = bodyOf().paras[s.start.p];
      const base = { ...runPropsAt(p, s.start.o), ...(E.pending || {}) };
      const probe = { ...base }; fn(probe);
      const diff = {}; [...App.RUN_KEYS, 'link'].forEach((k) => { if (JSON.stringify(probe[k]) !== JSON.stringify(base[k])) diff[k] = probe[k]; });
      E.pending = { ...(E.pending || {}), ...diff }; E._pendingAt = s.start;
      // een lege alinea krijgt de opmaak meteen
      if (App.plainTextLen(p) === 0) { pushUndo('format'); p.runs = [{ ...p.runs[0], ...diff, t: '' }]; p.end = { ...(p.end || {}), ...diff }; rerender({ start: s.start, end: s.start }); E.pending = { ...diff }; E._pendingAt = s.start; changed(true); }
      App.scheduleState();
      return true;
    }
    pushUndo('format');
    const body = bodyOf();
    for (let i = r.start.p; i <= r.end.p; i++) {
      const p = body.paras[i];
      const a = i === r.start.p ? r.start.o : 0, b = i === r.end.p ? r.end.o : App.plainTextLen(p);
      if (a === b && !(a === 0 && b === 0 && App.plainTextLen(p) === 0)) continue;
      splitAt(p, a); splitAt(p, b);
      const ia = runIndexAt(p, a), ib = runIndexAt(p, b);
      for (let k = ia; k < ib; k++) fn(p.runs[k]);
      if (App.plainTextLen(p) === 0) { fn(p.runs[0]); p.end = { ...(p.end || {}) }; fn(p.end); }
      App.normalizePara(p);
    }
    const back = r.word ? { start: r.caret, end: r.caret } : { start: r.start, end: r.end };
    rerender(back);
    changed(true);
    return true;
  };
  // Effectieve runs in de selectie (voor de toestand van de knoppen)
  App.textEdit.selRuns = () => {
    if (!E) return null;
    const s = getSel(); if (!s) return null;
    const body = bodyOf();
    const out = [];
    const obj = E.cell ? { type: 'cell' } : E.o;
    for (let i = s.start.p; i <= s.end.p; i++) {
      const p = body.paras[i]; if (!p) continue;
      const ps = App.paraStyle(obj, E.owner, p);
      if (s.collapsed) { const run = E.pending ? { ...runPropsAt(p, s.start.o), ...E.pending } : runPropsAt(p, Math.max(0, s.start.o)); out.push(App.runStyle(run, ps)); break; }
      let pos = 0;
      const a = i === s.start.p ? s.start.o : 0, b = i === s.end.p ? s.end.o : Infinity;
      p.runs.forEach((r) => { const e2 = pos + r.t.length; if (e2 > a && pos < b) out.push(App.runStyle(r, ps)); pos = e2; });
      if (!p.runs.some((r) => r.t)) out.push(App.runStyle(p.runs[0], ps));
    }
    return out;
  };
  App.textEdit.selParas = () => {
    if (!E) return null;
    const s = getSel(); const body = bodyOf();
    const a = s ? s.start.p : 0, b = s ? s.end.p : body.paras.length - 1;
    return body.paras.slice(a, b + 1);
  };
  App.textEdit.applyParas = (fn) => {
    if (!E) return false;
    pushUndo('para');
    syncFromDom();
    const s = getSel(); const body = bodyOf();
    const a = s ? s.start.p : 0, b = s ? s.end.p : body.paras.length - 1;
    for (let i = a; i <= b; i++) fn(body.paras[i], i);
    rerender(s ? { start: s.start, end: s.end } : null);
    changed(true);
    return true;
  };
  App.textEdit.applyBody = (fn) => {
    if (!E) return false;
    pushUndo('body'); syncFromDom();
    const s = getSel();
    fn(E.cell ? E.cellRef().text : E.o.text, E.o);
    rerender(s ? { start: s.start, end: s.end } : null);
    changed(true);
    return true;
  };
  App.textEdit.obj = () => (E ? E.o : null);
  App.textEdit.owner = () => (E ? E.owner : null);
  App.textEdit.selectedText = () => { const ps = E ? selectedParas() : null; return ps ? ps.map((p) => p.runs.map((r) => r.t).join('')).join('\n') : ''; };
  App.textEdit.replaceSelection = (text) => App.textEdit.insertText(text);
})();
