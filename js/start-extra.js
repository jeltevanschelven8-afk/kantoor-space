/* =========================================================
   Inkt — tabblad Start (uitbreidingen): stijlen beheren, lijsten met
   meerdere niveaus, randen en arcering, selecteren, tekstrichting
   ========================================================= */
'use strict';

/* =================== STIJLEN IN HET DOCUMENT ===================
   meta.styles        = { h1: { font, size, color, bold, italic, underline, align, line, before, after }, ... }
   meta.customStyles  = [{ id: 'us-xxxx', label, base, tag, props }]
   meta.headingNumbering = '' | 'chapter' | 'decimal' | 'article'
   Alles wordt via één <style>-element toegepast (scherm, afdrukken, HTML-export). */
App.BUILTIN_STYLES = App.STYLES.slice();
App.STYLE_DOCX = { normal: 'Normal', nospace: 'NoSpacing', h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', h4: 'Heading4', title: 'Title', subtitle: 'Subtitle', quote: 'Quote', intense: 'IntenseQuote', code: 'Code', caption: 'Caption' };
['styles', 'customStyles', 'headingNumbering'].forEach((k) => { if (!App.history.LOOK.includes(k)) App.history.LOOK.push(k); });
// Standaardwaarden: nodig zodat ongedaan maken een lege stijlset ook echt terugzet
(() => {
  const orig = App.defaultMeta;
  App.defaultMeta = () => Object.assign(orig(), { styles: {}, customStyles: [], headingNumbering: '' });
  const m = App.doc.meta;
  if (!m.styles) m.styles = {};
  if (!m.customStyles) m.customStyles = [];
  if (m.headingNumbering == null) m.headingNumbering = '';
})();

App.styleDef = (id) => App.STYLES.find((s) => s.id === id);
App.styleProps = (id) => {
  const m = App.doc.meta;
  const cu = (m.customStyles || []).find((s) => s.id === id);
  return cu ? cu.props || {} : ((m.styles || {})[id] || {});
};
App.propsCss = (p, fontOnly) => {
  const o = [];
  if (p.font) o.push(`font-family:${App.fontStack(p.font)}`);
  if (p.size) o.push(`font-size:${p.size}pt`);
  if (p.color) o.push(`color:${p.color}`);
  if (p.bold != null) o.push(`font-weight:${p.bold ? 700 : 400}`);
  if (p.italic != null) o.push(`font-style:${p.italic ? 'italic' : 'normal'}`);
  if (fontOnly) return o.join(';');
  if (p.underline != null) o.push(`text-decoration:${p.underline ? 'underline' : 'none'}`);
  if (p.align) o.push(`text-align:${p.align}`);
  if (p.line) o.push(`line-height:${p.line}`);
  if (p.before != null && p.before !== '') o.push(`margin-top:${p.before}pt`);
  if (p.after != null && p.after !== '') o.push(`margin-bottom:${p.after}pt`);
  return o.join(';');
};
App.styleSelector = (st) => `.doc.doc ${st.tag}${st.cls ? '.' + st.cls : ''}`;
App.HEADING_NUMBERING = {
  chapter: { name: 'Hoofdstuk 1 / 1.1 / 1.1.1', h1: '"Hoofdstuk " counter(hn1) "  "', h2: 'counter(hn1) "." counter(hn2) "  "', h3: 'counter(hn1) "." counter(hn2) "." counter(hn3) "  "' },
  decimal: { name: '1 / 1.1 / 1.1.1', h1: 'counter(hn1) "  "', h2: 'counter(hn1) "." counter(hn2) "  "', h3: 'counter(hn1) "." counter(hn2) "." counter(hn3) "  "' },
  article: { name: 'Artikel I / Sectie 1.01 / (a)', h1: '"Artikel " counter(hn1, upper-roman) ".  "', h2: '"Sectie " counter(hn1) "." counter(hn2, decimal-leading-zero) "  "', h3: '"(" counter(hn3, lower-alpha) ")  "' },
};
App.userStylesCss = () => {
  const m = App.doc.meta;
  let css = '';
  const ov = m.styles || {};
  App.BUILTIN_STYLES.forEach((st) => {
    const p = ov[st.id];
    if (!p) return;
    if (st.id === 'normal') {
      const all = App.propsCss(p);
      if (all) css += `.doc.doc :where(p:not(.title, .subtitle, .caption, .nospace)) { ${all} }\n`;
      const f = App.propsCss(p, true);
      if (f) css += `.doc.doc :where(p.nospace, li, td, th) { ${f} }\n`;
    } else {
      const c = App.propsCss(p);
      if (c) css += `${App.styleSelector(st)} { ${c} }\n`;
    }
  });
  (m.customStyles || []).forEach((cs) => { css += `.doc.doc ${cs.tag || 'p'}.${cs.id} { ${App.propsCss(cs.props || {})} }\n`; });
  const hn = App.HEADING_NUMBERING[m.headingNumbering];
  if (hn) {
    css += `.doc.doc { counter-reset: hn1 hn2 hn3; }\n.doc.doc h1 { counter-increment: hn1; counter-reset: hn2 hn3; }\n.doc.doc h2 { counter-increment: hn2; counter-reset: hn3; }\n.doc.doc h3 { counter-increment: hn3; }\n`;
    // woorden als "Hoofdstuk " volgen de taal van de interface
    ['h1', 'h2', 'h3'].forEach((h) => { const content = hn[h].replace(/"([^"]*[A-Za-z][^"]*)"/g, (q, s) => { const w = s.trimEnd(); return '"' + App.t(w) + s.slice(w.length) + '"'; }); css += `.doc.doc ${h}::before { content: ${content}; }\n`; });
  }
  return css;
};
App.applyUserStyles = () => {
  const m = App.doc.meta;
  // eigen stijlen in de stijllijst opnemen
  App.STYLES.length = 0;
  App.BUILTIN_STYLES.forEach((s) => App.STYLES.push(s));
  (m.customStyles || []).forEach((cs) => App.STYLES.push({ id: cs.id, label: cs.label, tag: cs.tag || 'p', cls: cs.id, css: 'font-size:12px', custom: true }));
  let el = document.getElementById('inkt-user-styles');
  if (!el) { el = document.createElement('style'); el.id = 'inkt-user-styles'; document.head.appendChild(el); }
  const css = App.userStylesCss();
  if (el.textContent !== css) { el.textContent = css; App.scheduleLayout && App.scheduleLayout(); }
  App.renderStyleGallery();
  if (App.renderStylesPane) App.renderStylesPane();
};
App.renderStyleGallery = () => {
  const g = $('#style-gallery');
  if (!g) return;
  const cur = App.currentStyleId ? App.currentStyleId() : 'normal';
  g.innerHTML = App.STYLES.map((s) => {
    const p = App.styleProps(s.id);
    const prev = [s.css, p.font ? `font-family:${App.fontStack(p.font).replace(/"/g, "'")}` : '', p.color ? `color:${p.color}` : '', p.bold != null ? `font-weight:${p.bold ? 700 : 400}` : '', p.italic != null ? `font-style:${p.italic ? 'italic' : 'normal'}` : '', p.underline ? 'text-decoration:underline' : ''].filter(Boolean).join(';');
    return `<button class="style-chip${s.id === cur ? ' on' : ''}" data-cmd="blockStyle" data-arg="${s.id}" title="${App.esc(s.label)}" style="${prev}">${App.esc(s.label)}</button>`;
  }).join('');
};
// Bij laden, ongedaan maken en thema-wijzigingen opnieuw toepassen
(() => {
  const orig = App.applyDocLook;
  App.applyDocLook = (...a) => { const r = orig(...a); App.applyUserStyles(); return r; };
  const origCss = App.docCssText;
  App.docCssText = () => origCss() + '\n' + App.userStylesCss();
})();
App.applyUserStyles();

/* ---------- Stijlen in de .docx-export (hooks in js/docx.js) ---------- */
App.docxIdOf = (cs) => 'Inkt' + cs.id.replace(/[^a-zA-Z0-9]/g, '');
App.docxStyleOf = (el) => {
  const c = el.classList && Array.from(el.classList).find((x) => x.startsWith('us-'));
  if (!c) return null;
  const cs = (App.doc.meta.customStyles || []).find((s) => s.id === c);
  return cs ? App.docxIdOf(cs) : null;
};
App.docxStylesHook = (xml, h) => {
  const m = App.doc.meta;
  const hex = (c) => String(c || '').replace('#', '').toUpperCase();
  const rpr = (p) => (p.font ? h.font(p.font) : '') + (p.bold != null ? (p.bold ? '<w:b/><w:bCs/>' : '<w:b w:val="0"/>') : '') +
    (p.italic != null ? (p.italic ? '<w:i/><w:iCs/>' : '<w:i w:val="0"/>') : '') + (p.underline ? '<w:u w:val="single"/>' : '') +
    (p.color ? `<w:color w:val="${hex(p.color)}"/>` : '') + (p.size ? `<w:sz w:val="${Math.round(p.size * 2)}"/><w:szCs w:val="${Math.round(p.size * 2)}"/>` : '');
  const ppr = (p) => {
    const sp = [];
    if (p.before != null && p.before !== '') sp.push(`w:before="${Math.round(p.before * 20)}"`);
    if (p.after != null && p.after !== '') sp.push(`w:after="${Math.round(p.after * 20)}"`);
    if (p.line) sp.push(`w:line="${Math.round(p.line * 240)}" w:lineRule="auto"`);
    const jc = { left: 'left', center: 'center', right: 'right', justify: 'both' }[p.align];
    return (sp.length ? `<w:spacing ${sp.join(' ')}/>` : '') + (jc ? `<w:jc w:val="${jc}"/>` : '');
  };
  const strip = (inner, names) => inner.replace(new RegExp('<w:(' + names + ')(?=[ />])[^>]*/>', 'g'), '');
  const patch = (body, tag, add, names) => {
    if (!add) return body;
    const re = new RegExp('<w:' + tag + '>([^]*?)</w:' + tag + '>');
    if (re.test(body)) return body.replace(re, (all, inner) => `<w:${tag}>${strip(inner, names)}${add}</w:${tag}>`);
    if (tag === 'pPr' && body.includes('<w:rPr>')) return body.replace('<w:rPr>', `<w:pPr>${add}</w:pPr><w:rPr>`);
    return body + `<w:${tag}>${add}</w:${tag}>`;
  };
  Object.entries(m.styles || {}).forEach(([id, p]) => {
    const sid = App.STYLE_DOCX[id];
    if (!sid || !p) return;
    const re = new RegExp('(<w:style [^>]*w:styleId="' + sid + '"[^>]*>)([^]*?)(</w:style>)');
    xml = xml.replace(re, (all, a, body, z) => a + patch(patch(body, 'pPr', ppr(p), 'spacing|jc'), 'rPr', rpr(p), 'rFonts|b|bCs|i|iCs|u|color|sz|szCs') + z);
  });
  const extra = (m.customStyles || []).map((cs) => {
    const p = cs.props || {};
    const pp = ppr(p), rp = rpr(p);
    return `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${App.docxIdOf(cs)}"><w:name w:val="${h.X(cs.label)}"/><w:basedOn w:val="Normal"/><w:qFormat/>${pp ? `<w:pPr>${pp}</w:pPr>` : ''}${rp ? `<w:rPr>${rp}</w:rPr>` : ''}</w:style>`;
  }).join('');
  return extra ? xml.replace('</w:styles>', extra + '</w:styles>') : xml;
};

/* ---------- Venster "Stijl wijzigen" / "Nieuwe stijl" ---------- */
App.propsFromBlock = (b) => {
  const cs = getComputedStyle(b);
  const rgb = cs.color.match(/\d+/g) || [0, 0, 0];
  return {
    font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    size: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2,
    color: '#' + rgb.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''),
    bold: parseInt(cs.fontWeight, 10) >= 600, italic: cs.fontStyle === 'italic', underline: /underline/.test(cs.textDecorationLine),
    align: { start: 'left', left: 'left', center: 'center', right: 'right', justify: 'justify' }[cs.textAlign] || 'left',
    line: cs.lineHeight === 'normal' ? 1.15 : Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 100) / 100,
    before: Math.round(parseFloat(cs.marginTop) * 0.75), after: Math.round(parseFloat(cs.marginBottom) * 0.75),
  };
};
App.styleCurrentProps = (id) => {
  const st = App.styleDef(id);
  if (!st) return {};
  const sel = st.id === 'normal' ? 'p:not([class])' : `${st.tag}${st.cls ? '.' + st.cls : ''}`;
  let el = $$(sel, App.ed).find((x) => x !== App.ed.firstElementChild && x.parentNode === App.ed), tmp = false;
  if (!el) {
    el = document.createElement(st.tag);
    if (st.cls) el.className = st.cls;
    el.textContent = 'x';
    el.style.visibility = 'hidden';
    App.ed.appendChild(el); tmp = true;
  }
  const inl = el.getAttribute('style');
  if (!tmp) el.removeAttribute('style');      // directe opmaak telt niet mee
  const p = App.propsFromBlock(el);
  if (tmp) el.remove(); else if (inl) el.setAttribute('style', inl);
  return p;
};
App.styleDialog = (id, opts = {}) => {
  App.restoreRange();
  const isNew = !id;
  const st = id ? App.styleDef(id) : null;
  const block = App.getSelectedBlocks()[0];
  const p = { ...(isNew ? (block ? App.propsFromBlock(block) : App.styleCurrentProps('normal')) : App.styleCurrentProps(id)), ...(isNew ? {} : App.styleProps(id)) };
  const fonts = App.FONTS.map(([n]) => n);
  if (p.font && !fonts.includes(p.font)) fonts.unshift(p.font);
  const sel = (v, list) => list.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
  const d = App.dialog({
    title: isNew ? 'Nieuwe stijl maken op basis van opmaak' : 'Stijl wijzigen', wide: true,
    body: `<div class="fields-2">
        <label class="field"><span>Naam</span><input id="sd-name" value="${App.esc(isNew ? 'Stijl' + ((App.doc.meta.customStyles || []).length + 1) : st.label)}" ${st && !st.custom ? 'disabled' : ''}></label>
        <label class="field"><span>Stijltype</span><select disabled><option>Alinea</option></select></label>
      </div>
      <div class="sd-h">Opmaak</div>
      <div class="sd-row">
        <select id="sd-font" class="rsel" style="width:170px">${fonts.map((f) => `<option ${f === p.font ? 'selected' : ''}>${App.esc(f)}</option>`).join('')}</select>
        <input id="sd-size" class="rsel size" list="sizes" value="${App.fmtNum(p.size || 12, 1)}" style="width:54px">
        <button class="rb${p.bold ? ' on' : ''}" data-tg="bold" title="Vet"><span class="i">format_bold</span></button>
        <button class="rb${p.italic ? ' on' : ''}" data-tg="italic" title="Cursief"><span class="i">format_italic</span></button>
        <button class="rb${p.underline ? ' on' : ''}" data-tg="underline" title="Onderstrepen"><span class="i">format_underlined</span></button>
        <input type="color" id="sd-color" value="${p.color || '#000000'}" title="Tekstkleur">
      </div>
      <div class="sd-row">
        <span class="seg" id="sd-align" style="margin:0">${[['left', 'format_align_left', 'Links'], ['center', 'format_align_center', 'Centreren'], ['right', 'format_align_right', 'Rechts'], ['justify', 'format_align_justify', 'Uitvullen']].map(([k, i, t]) => `<button data-a="${k}" class="${(p.align || 'left') === k ? 'on' : ''}" title="${t}"><span class="i" style="font-size:16px;vertical-align:-3px">${i}</span></button>`).join('')}</span>
        <label class="sd-mini">Regelafstand <select id="sd-line">${sel(p.line || 1.15, [[1, '1,0'], [1.08, '1,08'], [1.15, '1,15'], [1.5, '1,5'], [2, '2,0'], [2.5, '2,5'], [3, '3,0']])}</select></label>
        <label class="sd-mini">Vóór <input id="sd-before" type="number" min="0" step="1" value="${p.before ?? 0}"> pt</label>
        <label class="sd-mini">Na <input id="sd-after" type="number" min="0" step="1" value="${p.after ?? 8}"> pt</label>
      </div>
      <div class="preview-box sd-prev"><div class="sd-ctx">Vorige alinea Vorige alinea Vorige alinea Vorige alinea Vorige alinea</div><div id="sd-sample">Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst</div><div class="sd-ctx">Volgende alinea Volgende alinea Volgende alinea Volgende alinea</div></div>`,
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: (dd) => {
      const np = read(dd);
      const name = dd.$('#sd-name').value.trim() || 'Stijl';
      App.run(() => {
        const m = App.doc.meta;
        if (isNew) {
          const nid = 'us-' + Math.random().toString(36).slice(2, 7);
          m.customStyles = [...(m.customStyles || []), { id: nid, label: name, base: 'normal', tag: 'p', props: np }];
          App.applyUserStyles();
          if (opts.apply !== false) App.commands.blockStyle.fn(nid);
        } else if (st.custom) {
          m.customStyles = (m.customStyles || []).map((c) => (c.id === id ? { ...c, label: name, props: np } : c));
        } else {
          m.styles = { ...(m.styles || {}), [id]: np };
        }
        App.applyUserStyles();
      });
    } }],
  });
  const read = (dd) => ({
    font: dd.$('#sd-font').value, size: App.parseNum(dd.$('#sd-size').value) || 12, color: dd.$('#sd-color').value,
    bold: !!dd.$('[data-tg="bold"].on'), italic: !!dd.$('[data-tg="italic"].on'), underline: !!dd.$('[data-tg="underline"].on'),
    align: (dd.$('#sd-align .on') || {}).dataset?.a || 'left', line: +dd.$('#sd-line').value,
    before: App.parseNum(dd.$('#sd-before').value) || 0, after: App.parseNum(dd.$('#sd-after').value) || 0,
  });
  const prev = () => {
    const np = read(d);
    const s = d.$('#sd-sample');
    s.style.cssText = App.propsCss({ ...np, size: Math.min(np.size, 20) });
  };
  d.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tg]'); if (t) { t.classList.toggle('on'); prev(); }
    const a = e.target.closest('[data-a]'); if (a) { d.$$('#sd-align button').forEach((b) => b.classList.toggle('on', b === a)); prev(); }
  });
  d.body.addEventListener('input', prev); d.body.addEventListener('change', prev);
  prev();
  return d;
};
App.def('modifyStyle', (id) => App.styleDialog(id || App.currentStyleId()));
App.def('newStyle', () => App.styleDialog(null));
App.defEdit('styleFromSelection', (id) => {
  const b = App.getSelectedBlocks()[0];
  if (!b || !id) return;
  const m = App.doc.meta, p = App.propsFromBlock(b);
  const st = App.styleDef(id);
  if (st && st.custom) m.customStyles = m.customStyles.map((c) => (c.id === id ? { ...c, props: p } : c));
  else m.styles = { ...(m.styles || {}), [id]: p };
  App.applyUserStyles();
});
App.defEdit('deleteStyle', (id) => {
  const m = App.doc.meta;
  m.customStyles = (m.customStyles || []).filter((c) => c.id !== id);
  $$('.' + id, App.ed).forEach((el) => el.classList.remove(id));
  App.applyUserStyles();
});
App.defEdit('resetStyle', (id) => { const m = App.doc.meta; if (m.styles) { const s = { ...m.styles }; delete s[id]; m.styles = s; } App.applyUserStyles(); });

/* ---------- Deelvenster Stijlen ---------- */
App.stylesPane = (() => {
  const el = document.createElement('aside');
  el.id = 'stylespane';
  el.hidden = true;
  el.innerHTML = `<div class="pane-head"><strong>Stijlen</strong><button class="qb" data-cmd="toggleStylesPane" title="Sluiten"><span class="i">close</span></button></div>
    <div class="sp-list" id="sp-list"></div>
    <div class="sp-opts"><label class="chk"><input type="checkbox" id="sp-preview"> Voorbeeld weergeven</label></div>
    <div class="sp-foot">
      <button class="qb" data-cmd="newStyle" title="Nieuwe stijl…"><span class="i">add_notes</span></button>
      <button class="qb" data-cmd="modifyStyle" title="Huidige stijl wijzigen…"><span class="i">edit_note</span></button>
      <button class="qb" data-cmd="clearFormat" title="Alle opmaak wissen"><span class="i">format_clear</span></button>
    </div>`;
  const cs = $('#canvas-scroll');
  cs.parentNode.insertBefore(el, cs.nextSibling);
  el.addEventListener('mousedown', (e) => { if (!e.target.closest('input, select, label')) e.preventDefault(); });
  el.querySelector('#sp-preview').addEventListener('change', (e) => { App.store.set('stylesPreview', e.target.checked); App.renderStylesPane(); });
  el.querySelector('#sp-preview').checked = !!App.store.get('stylesPreview', false);
  el.querySelector('#sp-list').addEventListener('click', (e) => {
    const more = e.target.closest('.sp-more');
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    if (more) { e.stopPropagation(); App.styleMenu(more, id); return; }
    if (id === '__clear') { App.exec('clearFormat'); App.exec('blockStyle', 'normal'); return; }
    App.exec('blockStyle', id);
  });
  return el;
})();
App.renderStylesPane = () => {
  const pane = App.stylesPane;
  if (!pane || pane.hidden) return;
  const cur = App.currentStyleId ? App.currentStyleId() : 'normal';
  const prev = $('#sp-preview').checked;
  const mark = (st) => ({ p: '¶', h1: '¶a', h2: '¶a', h3: '¶a', h4: '¶a' }[st.tag] || (st.tag === 'blockquote' || st.tag === 'pre' ? '¶' : '¶'));
  pane.querySelector('#sp-list').innerHTML = `<div class="sp-row" data-id="__clear"><span class="sp-name">Alles wissen</span></div>` +
    App.STYLES.map((st) => {
      const p = App.styleProps(st.id);
      const look = prev ? [st.css.replace(/font-size:\d+px/, ''), App.propsCss({ font: p.font, color: p.color, bold: p.bold, italic: p.italic }, true)].join(';') : '';
      return `<div class="sp-row${st.id === cur ? ' on' : ''}" data-id="${st.id}" title="${App.esc(st.label)}"><span class="sp-name" style="${look}">${App.esc(st.label)}</span><span class="sp-mark">${mark(st)}</span><button class="sp-more" title="Opties voor ${App.esc(st.label)}"><span class="i">arrow_drop_down</span></button></div>`;
    }).join('');
};
App.styleMenu = (anchor, id) => {
  const st = App.styleDef(id);
  if (!st) return;
  const n = App.styleInstances(id).length;
  const modified = !st.custom && App.doc.meta.styles && App.doc.meta.styles[id];
  App.openPopup(anchor, `<button data-cmd="styleFromSelection" data-arg="${id}"><span class="i">sync</span> ${App.esc(st.label)} bijwerken zodat deze overeenkomt met de selectie</button>
    <button data-cmd="modifyStyle" data-arg="${id}"><span class="i">edit_note</span> Wijzigen…</button>
    <button data-cmd="selectStyleInstances" data-arg="${id}" ${n ? '' : 'disabled'}><span class="i">select_all</span> Alle ${n} exemplaren selecteren</button>
    ${st.custom ? `<hr><button data-cmd="deleteStyle" data-arg="${id}"><span class="i">delete</span> ${App.esc(st.label)} verwijderen…</button>` : ''}
    ${modified ? `<hr><button data-cmd="resetStyle" data-arg="${id}"><span class="i">restart_alt</span> Standaardopmaak herstellen</button>` : ''}`);
};
App.styleInstances = (id) => {
  const st = App.styleDef(id);
  if (!st) return [];
  return $$(st.tag + (st.cls ? '.' + st.cls : ''), App.ed).filter((b) => {
    if (st.cls) return true;
    return !App.STYLES.some((x) => x.tag === st.tag && x.cls && b.classList.contains(x.cls));
  });
};
App.def('toggleStylesPane', () => {
  App.stylesPane.hidden = !App.stylesPane.hidden;
  App.renderStylesPane();
  App.scheduleLayout(); App.scheduleState();
  App.restoreRange();
});
App.stateFns.stylesPane = () => !App.stylesPane.hidden;
App.on('selection', () => {
  if (App.stylesPane.hidden) return;
  const cur = App.currentStyleId();
  $$('#sp-list .sp-row').forEach((r) => r.classList.toggle('on', r.dataset.id === cur));
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); App.exec('toggleStylesPane'); }
});

/* =================== MEERVOUDIGE SELECTIE ===================
   Chrome kent maar één selectiebereik. Voor "Tekst met vergelijkbare opmaak" en
   "Alle exemplaren selecteren" onthouden we de bereiken zelf, markeren ze en passen
   daarna opmaakcommando's op elk bereik toe (één stap ongedaan maken). */
App.multiSel = null;
App.MULTI_OK = new Set(['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript', 'fontName', 'fontSize', 'growFont', 'shrinkFont',
  'foreColor', 'hiliteColor', 'underlineStyle', 'clearCharFormat', 'clearFormat', 'changeCase', 'blockStyle', 'justifyLeft', 'justifyCenter', 'justifyRight',
  'justifyFull', 'lineSpacing', 'shading', 'paraBorder', 'dirLtr', 'dirRtl', 'clearParaFormat', 'toggleSpaceBefore', 'toggleSpaceAfter']);
App.paintMultiSel = () => {
  if (!window.CSS || !CSS.highlights) return;
  CSS.highlights.delete('inkt-multisel');
  if (!App.multiSel) return;
  const rs = App.multiSel.ranges.map((o) => {
    const s = App.pointAt(o.s, App.ed, true), e = App.pointAt(o.e, App.ed);
    const r = document.createRange();
    try { r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset); } catch { /* niets */ }
    return r;
  });
  CSS.highlights.set('inkt-multisel', new Highlight(...rs));
};
App.setMultiSel = (ranges) => {
  App.clearMultiSel();
  if (!ranges.length) { App.toast('Niets gevonden om te selecteren', 'info'); return; }
  App.ed.focus({ preventScroll: true });
  App.setRange(ranges[0]);
  if (ranges.length === 1) return;
  App.multiSel = { ranges: ranges.map((r) => ({ s: App.textOffset(r.startContainer, r.startOffset), e: App.textOffset(r.endContainer, r.endOffset) })) };
  App.paintMultiSel();
  App.toast(`${ranges.length} gedeelten geselecteerd. Kies nu een opmaak; klikken of typen heft de selectie op.`, 'select_all', { ms: 4000 });
};
App.clearMultiSel = () => { if (!App.multiSel) return; App.multiSel = null; App.paintMultiSel(); };
App.ed.addEventListener('mousedown', () => App.clearMultiSel(), true);
App.ed.addEventListener('keydown', (e) => { if (!/^(Shift|Control|Alt|Meta)$/.test(e.key)) App.clearMultiSel(); }, true);
(() => {
  const orig = App.exec;
  App.exec = (name, arg, el) => {
    const ms = App.multiSel, c = App.commands[name];
    if (!ms || !c || !c.edit || !App.MULTI_OK.has(name) || App.state.protect) return orig(name, arg, el);
    App.run(() => {
      ms.ranges.forEach((o) => { App.setSelOffsets({ s: o.s, e: o.e, root: App.ed }); try { c.fn(arg, el); } catch (err) { console.error(err); } });
      const f = ms.ranges[0];
      App.setSelOffsets({ s: f.s, e: f.e, root: App.ed });
    });
    App.paintMultiSel();
  };
})();
App.blockRange = (b) => { const r = document.createRange(); r.selectNodeContents(b); return r; };
App.def('selectStyleInstances', (id) => App.setMultiSel(App.styleInstances(id).map(App.blockRange)));
App.fmtKeyOf = (n) => {
  const el = n.parentElement, cs = getComputedStyle(el), b = App.blockOf(n);
  return [cs.fontFamily, cs.fontSize, parseInt(cs.fontWeight, 10) >= 600, cs.fontStyle, cs.color, cs.textDecorationLine, cs.backgroundColor, cs.verticalAlign, b ? b.tagName + '.' + Array.from(b.classList).filter((c) => c !== 'dropcap').join('.') : ''].join('|');
};
App.def('selectSimilar', () => {
  const r = App.restoreRange();
  let n = r.startContainer;
  if (n.nodeType !== 3) { const w = document.createTreeWalker(n.childNodes[r.startOffset] || n, NodeFilter.SHOW_TEXT); n = w.nextNode(); }
  if (!n || !App.ed.contains(n)) { App.toast('Plaats de cursor eerst in tekst', 'info'); return; }
  const key = App.fmtKeyOf(n);
  const out = [];
  let cur = null, curBlock = null;
  const w = document.createTreeWalker(App.ed, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.data.replace(/[\s​]/g, '') && !App.closest(t, '[contenteditable="false"]', App.ed) ? 1 : 3) });
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const b = App.blockOf(t);
    if (App.fmtKeyOf(t) === key) {
      if (cur && curBlock === b) cur.setEnd(t, t.length);
      else { cur = document.createRange(); cur.setStart(t, 0); cur.setEnd(t, t.length); out.push(cur); curBlock = b; }
    } else { cur = null; }
  }
  App.setMultiSel(out);
});

/* ---------- Selecteren: menu en "Objecten selecteren" ---------- */
App.menuBuilders['m-select'] = () => `<button data-cmd="selectAll"><span class="i">select_all</span> Alles selecteren <kbd>Ctrl+A</kbd></button>
  <button data-cmd="selectObjects"><span class="i">arrow_selector_tool</span> Objecten selecteren</button>
  <button data-cmd="selectSimilar"><span class="i">format_shapes</span> Tekst met vergelijkbare opmaak selecteren</button>`;
App.objectsInDoc = () => $$('img', App.ed);
App.def('selectObjects', () => {
  App.state.objSelect = !App.state.objSelect;
  document.body.classList.toggle('obj-select-mode', App.state.objSelect);
  if (App.state.objSelect) {
    const objs = App.objectsInDoc();
    if (objs.length) App.selectObj(objs[0]);
    App.toast(objs.length ? 'Objecten selecteren: klik op een object of gebruik Tab. Esc om te stoppen.' : 'Er staan geen objecten in dit document. Esc om te stoppen.', 'arrow_selector_tool', { ms: 3500 });
  }
  App.scheduleState();
});
App.stateFns.objSelect = () => !!App.state.objSelect;
App.ed.addEventListener('mousedown', (e) => {
  if (App.state.objSelect && e.target.tagName !== 'IMG') e.preventDefault();
}, true);
document.addEventListener('keydown', (e) => {
  if (!App.state.objSelect) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); App.exec('selectObjects'); return; }
  if (e.key === 'Tab') {
    e.preventDefault(); e.stopImmediatePropagation();
    const objs = App.objectsInDoc();
    if (!objs.length) return;
    const i = objs.indexOf(App.selectedObj);
    const next = objs[(i + (e.shiftKey ? -1 : 1) + objs.length) % objs.length];
    App.selectObj(next);
    if (!App.isVisible(next)) next.scrollIntoView({ block: 'center' });
  }
}, true);

/* ---------- Tekstrichting (van links naar rechts / van rechts naar links) ---------- */
App.defEdit('dirLtr', () => App.getSelectedBlocks().forEach((b) => { b.removeAttribute('dir'); if (b.style.textAlign === 'right' && b.dataset.rtlAlign) { b.style.textAlign = ''; delete b.dataset.rtlAlign; } }));
App.defEdit('dirRtl', () => App.getSelectedBlocks().forEach((b) => { b.setAttribute('dir', 'rtl'); }));
App.blockDir = () => { const r = App.getRange() || App.lastRange; const b = r && App.blockOf(r.startContainer); return b ? getComputedStyle(b).direction : 'ltr'; };
App.stateFns.dirLtr = () => App.blockDir() === 'ltr';
App.stateFns.dirRtl = () => App.blockDir() === 'rtl';

/* =================== LIJST MET MEERDERE NIVEAUS =================== */
App.MULTILEVEL = [
  { id: 'ml-decimal', name: '1. / 1.1. / 1.1.1.', demo: ['1.', '1.1.', '1.1.1.'] },
  { id: 'ml-alpha', name: '1. / a. / i.', demo: ['1.', 'a.', 'i.'] },
  { id: 'ml-paren', name: '1) / a) / i)', demo: ['1)', 'a)', 'i)'] },
  { id: 'ml-roman', name: 'I. / A. / 1.', demo: ['I.', 'A.', '1.'] },
  { id: 'ml-bullets', name: '• / ○ / ▪', demo: ['•', '○', '▪'], ul: true },
  { id: 'ml-arrows', name: '➢ / ■ / ●', demo: ['➢', '■', '●'], ul: true },
];
App.menuBuilders['m-multilevel'] = () => {
  const demo = (d) => `<span class="ml-demo">${d.map((t, i) => `<span style="padding-left:${i * 12}px"><b>${t}</b><i></i></span>`).join('')}</span>`;
  const hn = Object.entries(App.HEADING_NUMBERING).map(([k, h]) => `<button data-cmd="headingNumbering" data-arg="${k}" title="${h.name}"><span class="ml-demo">${h.name.split(' / ').map((t, i) => `<span style="padding-left:${i * 12}px"><b>${App.esc(t)}</b> Kop ${i + 1}</span>`).join('')}</span></button>`).join('');
  return `<div class="menu-title">Lijstbibliotheek</div><div class="ml-grid">
    <button data-cmd="multilevelList" data-arg="none" title="Geen"><span class="ml-demo ml-none">Geen</span></button>
    ${App.MULTILEVEL.map((s) => `<button data-cmd="multilevelList" data-arg="${s.id}" title="${s.name}">${demo(s.demo)}</button>`).join('')}
    </div><div class="menu-title">Koppen nummeren</div><div class="ml-grid">${hn}
    <button data-cmd="headingNumbering" data-arg="" title="Geen nummering van koppen"><span class="ml-demo ml-none">Geen</span></button></div>
    <hr><button data-cmd="multilevelLevel" data-arg="1"><span class="i">format_indent_increase</span> Lijstniveau verhogen (Tab)</button>
    <button data-cmd="multilevelLevel" data-arg="-1"><span class="i">format_indent_decrease</span> Lijstniveau verlagen (Shift+Tab)</button>`;
};
App.defEdit('multilevelList', (id) => {
  const s = App.MULTILEVEL.find((x) => x.id === id);
  let li = App.selClosest('li');
  if (id === 'none') { if (li) App.toggleList(li.parentNode.tagName.toLowerCase()); return; }
  if (!s) return;
  const tag = s.ul ? 'UL' : 'OL';
  if (!li) { App.toggleList(tag.toLowerCase()); li = App.selClosest('li'); }
  else if (li.parentNode.tagName !== tag) { App.toggleList(tag.toLowerCase()); li = App.selClosest('li'); }
  if (!li) return;
  let top = li.parentNode;
  while (top.parentNode && top.parentNode.closest && top.parentNode.closest('li') && App.ed.contains(top.parentNode)) top = top.parentNode.closest('li').parentNode;
  [top, ...top.querySelectorAll('ol, ul')].forEach((l) => {
    l.className = l.className.split(' ').filter((c) => c && !/^(ml-|lst-)/.test(c)).join(' ');
    l.classList.add(s.id); l.style.listStyleType = '';
    if (!l.className) l.removeAttribute('class');
  });
});
App.def('multilevelLevel', (d) => App.exec(+d > 0 ? 'indent' : 'outdent'));
App.defEdit('headingNumbering', (k) => {
  App.doc.meta.headingNumbering = k || '';
  App.applyUserStyles();
  if (k && !App.ed.querySelector('h1,h2,h3')) App.toast('Koppen worden genummerd zodra je Kop 1, Kop 2 of Kop 3 gebruikt', 'info');
});

/* =================== RANDEN EN ARCERING =================== */
(() => {
  const orig = App.pageBorderCss;
  App.pageBorderCss = (v) => (typeof v === 'string' && v.startsWith('css:') ? v.slice(4) : orig(v));
})();
App.BORDER_STYLES = [['solid', 'Doorgetrokken'], ['dotted', 'Gestippeld'], ['dashed', 'Gestreept'], ['double', 'Dubbel']];
App.BORDER_WIDTHS = [[0.5, '½ pt'], [0.75, '¾ pt'], [1, '1 pt'], [1.5, '1½ pt'], [2.25, '2¼ pt'], [3, '3 pt'], [4.5, '4½ pt'], [6, '6 pt']];
App.toHex = (c) => {
  if (/^#/.test(c || '')) return c;
  const m = String(c || '').match(/\d+(\.\d+)?/g);
  return m ? '#' + m.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('') : '#000000';
};
App.baRead = () => {
  const b = App.getSelectedBlocks()[0];
  const cs = b ? getComputedStyle(b) : null;
  const st = { sides: {}, style: 'solid', color: '#000000', width: 0.75, shadow: !!(b && b.style.boxShadow) };
  ['top', 'right', 'bottom', 'left'].forEach((s) => {
    const cap = s[0].toUpperCase() + s.slice(1);
    st.sides[s] = !!(b && b.style['border' + cap]);
    if (st.sides[s] && cs) {
      st.style = cs['border' + cap + 'Style'] || st.style;
      st.color = App.toHex(cs['border' + cap + 'Color']);
      st.width = Math.round(parseFloat(cs['border' + cap + 'Width']) * 0.75 * 4) / 4 || st.width;
    }
  });
  st.fill = b && b.style.backgroundColor ? App.toHex(b.style.backgroundColor) : '';
  const pb = String(App.doc.meta.pageBorder || '');
  const pm = pb.startsWith('css:') ? pb.slice(4).match(/^([\d.]+)px (\w+) (.+)$/) : null;
  st.page = { on: !!pb, style: pm ? pm[2] : 'solid', color: pm ? App.toHex(pm[3]) : '#000000', width: pm ? Math.round(+pm[1] * 0.75 * 4) / 4 : 1 };
  return st;
};
App.baBody = (st) => {
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
  const controls = (p, s, c, w) => `<label class="field"><span>Stijl</span><select id="${p}-style">${opt(App.BORDER_STYLES, s)}</select></label>
    <label class="field"><span>Kleur</span><input type="color" id="${p}-color" value="${c}"></label>
    <label class="field"><span>Breedte</span><select id="${p}-width">${opt(App.BORDER_WIDTHS, w)}</select></label>`;
  const setting = (p, list, cur) => `<div class="ba-set" id="${p}-set">${list.map(([k, l, i]) => `<button class="ba-opt${k === cur ? ' on' : ''}" data-s="${k}"><span class="i">${i}</span>${l}</button>`).join('')}</div>`;
  const any = Object.values(st.sides).some(Boolean);
  const cur = !any ? 'none' : st.shadow ? 'shadow' : Object.values(st.sides).every(Boolean) ? 'box' : 'custom';
  return `<div class="seg" id="ba-tabs"><button data-t="para">Randen</button><button data-t="page">Paginarand</button><button data-t="shade">Arcering</button></div>
    <div class="ba-pane" data-pane="para"><div class="ba-cols">
      <div><div class="sd-h">Instelling</div>${setting('bp', [['none', 'Geen', 'border_clear'], ['box', 'Kader', 'border_outer'], ['shadow', 'Schaduw', 'select'], ['custom', 'Aangepast', 'border_style']], cur)}</div>
      <div>${controls('bp', st.style, st.color, st.width)}</div>
      <div><div class="sd-h">Voorbeeld</div><div class="ba-prev">
        <button class="rb" data-side="top" title="Bovenrand"><span class="i">border_top</span></button>
        <div class="ba-mid"><button class="rb" data-side="left" title="Linkerrand"><span class="i">border_left</span></button><div class="ba-box" id="bp-box"><i></i><i></i><i></i><i></i></div><button class="rb" data-side="right" title="Rechterrand"><span class="i">border_right</span></button></div>
        <button class="rb" data-side="bottom" title="Onderrand"><span class="i">border_bottom</span></button></div>
        <p class="muted small">Klik op het voorbeeld of op de knoppen om randen toe te passen. Toepassen op: alinea.</p></div>
    </div></div>
    <div class="ba-pane" data-pane="page" hidden><div class="ba-cols">
      <div><div class="sd-h">Instelling</div>${setting('pg', [['none', 'Geen', 'border_clear'], ['box', 'Kader', 'border_outer']], st.page.on ? 'box' : 'none')}</div>
      <div>${controls('pg', st.page.style, st.page.color, st.page.width)}</div>
      <div><div class="sd-h">Voorbeeld</div><div class="ba-page" id="pg-box"><i></i><i></i><i></i><i></i><i></i></div><p class="muted small">Toepassen op: hele document.</p></div>
    </div></div>
    <div class="ba-pane" data-pane="shade" hidden><div class="ba-cols">
      <div><div class="sd-h">Opvulling</div><label class="chk"><input type="checkbox" id="sh-none" ${st.fill ? '' : 'checked'}> Geen kleur</label>
        <label class="field"><span>Kleur</span><input type="color" id="sh-color" value="${st.fill || '#e8e8e8'}"></label></div>
      <div><div class="sd-h">Voorbeeld</div><div class="ba-shade" id="sh-box">Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst Voorbeeldtekst</div><p class="muted small">Toepassen op: alinea.</p></div>
    </div></div>`;
};
App.bordersDialog = (tab = 'para') => {
  App.restoreRange();
  const st = App.baRead();
  const sides = st.sides;
  let shadow = st.shadow;
  const d = App.dialog({
    title: 'Randen en arcering', wide: true, body: App.baBody(st),
    buttons: [{ label: 'Annuleren' }, { label: 'OK', primary: true, action: () => apply() }],
  });
  const v = (id) => d.$(id).value;
  const line = (p) => `${(+v('#' + p + '-width') * 4 / 3).toFixed(2).replace(/\.?0+$/, '')}px ${v('#' + p + '-style')} ${v('#' + p + '-color')}`;
  const paint = () => {
    const l = line('bp');
    d.$$('[data-side]').forEach((x) => x.classList.toggle('on', !!sides[x.dataset.side]));
    const box = d.$('#bp-box');
    ['Top', 'Right', 'Bottom', 'Left'].forEach((S) => { box.style['border' + S] = sides[S.toLowerCase()] ? l : '1px dashed #c8c8c8'; });
    box.style.boxShadow = shadow ? `3px 3px 0 ${v('#bp-color')}` : '';
    d.$('#pg-box').style.border = d.$('#pg-set .on').dataset.s === 'box' ? line('pg') : '1px solid #ddd';
    d.$('#sh-box').style.background = d.$('#sh-none').checked ? 'transparent' : v('#sh-color');
  };
  d.$('#ba-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]'); if (!t) return;
    d.$$('#ba-tabs button').forEach((x) => x.classList.toggle('on', x === t));
    d.$$('.ba-pane').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.t; });
  });
  d.body.addEventListener('click', (e) => {
    const s = e.target.closest('[data-side]');
    if (s) { sides[s.dataset.side] = !sides[s.dataset.side]; d.$$('#bp-set .ba-opt').forEach((x) => x.classList.toggle('on', x.dataset.s === 'custom')); }
    const box = e.target.closest('#bp-box');
    if (box) {
      // klikken op de rand in het voorbeeld schakelt die zijde
      const r = box.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const side = y < 0.25 ? 'top' : y > 0.75 ? 'bottom' : x < 0.5 ? 'left' : 'right';
      sides[side] = !sides[side];
      d.$$('#bp-set .ba-opt').forEach((o) => o.classList.toggle('on', o.dataset.s === 'custom'));
    }
    const o = e.target.closest('.ba-opt');
    if (o) {
      o.parentNode.querySelectorAll('.ba-opt').forEach((x) => x.classList.toggle('on', x === o));
      if (o.parentNode.id === 'bp-set') {
        const k = o.dataset.s;
        if (k !== 'custom') ['top', 'right', 'bottom', 'left'].forEach((x) => { sides[x] = k !== 'none'; });
        shadow = k === 'shadow';
      }
    }
    paint();
  });
  d.body.addEventListener('input', (e) => { if (e.target.id === 'sh-color') d.$('#sh-none').checked = false; paint(); });
  d.body.addEventListener('change', paint);
  const apply = () => {
    const l = line('bp');
    const fill = d.$('#sh-none').checked ? '' : v('#sh-color');
    const pval = d.$('#pg-set .on').dataset.s === 'box' ? 'css:' + line('pg') : '';
    App.run(() => {
      App.getSelectedBlocks().forEach((bl) => {
        if (bl === App.editRoot()) return;
        ['Top', 'Right', 'Bottom', 'Left'].forEach((S) => {
          const on = sides[S.toLowerCase()];
          bl.style['border' + S] = on ? l : '';
          bl.style['padding' + S] = on || fill ? (S === 'Top' || S === 'Bottom' ? '1pt' : '4pt') : '';
        });
        bl.style.boxShadow = shadow ? `3px 3px 0 ${v('#bp-color')}` : '';
        bl.style.backgroundColor = fill;
        if (!bl.getAttribute('style')) bl.removeAttribute('style');
      });
      App.doc.meta.pageBorder = pval;
      App._forceSheets = true;
    });
  };
  d.$(`#ba-tabs [data-t="${tab}"]`).click();
  paint();
  return d;
};
App.def('bordersDialog', (tab) => App.bordersDialog(typeof tab === 'string' ? tab : 'para'));
App.menuBuilders['m-borders'] = () => $('#m-borders').innerHTML + '<button data-cmd="bordersDialog"><span class="i">border_style</span> Randen en arcering…</button>';
App.menuBuilders['m-pageborder'] = () => $('#m-pageborder').innerHTML + '<hr><button data-cmd="bordersDialog" data-arg="page">Randen en arcering…</button>';
