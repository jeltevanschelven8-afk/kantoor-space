/* =========================================================
   Inkt — tabblad Start: klembord, lettertype, alinea, stijlen, zoeken
   ========================================================= */
'use strict';

App.FONTS = [
  ['Aptos', 'Aptos, Calibri, "Segoe UI", sans-serif'], ['Aptos Display', '"Aptos Display", Aptos, Calibri, "Segoe UI", sans-serif'], ['Calibri', 'Calibri, Carlito, sans-serif'], ['Arial', 'Arial, Helvetica, sans-serif'],
  ['Cambria', 'Cambria, Caladea, serif'], ['Georgia', 'Georgia, serif'], ['Times New Roman', '"Times New Roman", Times, serif'],
  ['Garamond', 'Garamond, "EB Garamond", serif'], ['Verdana', 'Verdana, sans-serif'], ['Segoe UI', '"Segoe UI", sans-serif'],
  ['Tahoma', 'Tahoma, sans-serif'], ['Trebuchet MS', '"Trebuchet MS", sans-serif'], ['Courier New', '"Courier New", monospace'],
  ['Consolas', 'Consolas, monospace'], ['Comic Sans MS', '"Comic Sans MS", cursive'], ['Impact', 'Impact, sans-serif'],
  ['Inter', 'Inter, sans-serif'], ['Roboto', 'Roboto, sans-serif'], ['Open Sans', '"Open Sans", sans-serif'], ['Lato', 'Lato, sans-serif'],
  ['Montserrat', 'Montserrat, sans-serif'], ['Poppins', 'Poppins, sans-serif'], ['Nunito', 'Nunito, sans-serif'], ['Raleway', 'Raleway, sans-serif'],
  ['Merriweather', 'Merriweather, serif'], ['Lora', 'Lora, serif'], ['Playfair Display', '"Playfair Display", serif'], ['Source Serif 4', '"Source Serif 4", serif'],
  ['Fira Code', '"Fira Code", monospace'], ['Caveat', 'Caveat, cursive'],
];
App.SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 60, 72];

App.STYLES = [
  { id: 'normal', label: 'Normaal', tag: 'p', cls: '', css: 'font-size:12px' },
  { id: 'nospace', label: 'Geen afstand', tag: 'p', cls: 'nospace', css: 'font-size:12px' },
  { id: 'h1', label: 'Kop 1', tag: 'h1', cls: '', css: 'font-size:16px;color:#0f4761' },
  { id: 'h2', label: 'Kop 2', tag: 'h2', cls: '', css: 'font-size:14px;color:#0f4761' },
  { id: 'h3', label: 'Kop 3', tag: 'h3', cls: '', css: 'font-size:13px;color:#0f4761' },
  { id: 'h4', label: 'Kop 4', tag: 'h4', cls: '', css: 'font-size:12px;color:#0f4761;font-style:italic' },
  { id: 'title', label: 'Titel', tag: 'p', cls: 'title', css: 'font-size:18px' },
  { id: 'subtitle', label: 'Ondertitel', tag: 'p', cls: 'subtitle', css: 'font-size:12px;color:#595959' },
  { id: 'quote', label: 'Citaat', tag: 'blockquote', cls: '', css: 'font-size:12px;font-style:italic;color:#404040;text-align:center' },
  { id: 'intense', label: 'Duidelijk citaat', tag: 'blockquote', cls: 'intense', css: 'font-size:12px;color:#0f4761;font-style:italic;text-align:center' },
  { id: 'code', label: 'Code', tag: 'pre', cls: '', css: 'font-size:11px;font-family:Consolas,monospace;background:#f4f4f8' },
  { id: 'caption', label: 'Bijschrift', tag: 'p', cls: 'caption', css: 'font-size:11px;font-style:italic;color:#555' },
];

/* ---------- Opbouw van keuzelijsten ---------- */
(() => {
  const ff = $('#font-family');
  ff.innerHTML = App.FONTS.map(([n, css]) => `<option value="${n}" style="font-family:${css.replace(/"/g, '&quot;')}">${n}</option>`).join('');
  $('#sizes').innerHTML = App.SIZES.map((s) => `<option value="${String(s).replace('.', ',')}">`).join('');
  $('#style-gallery').innerHTML = App.STYLES.map((s) => `<button class="style-chip" data-cmd="blockStyle" data-arg="${s.id}" title="${s.label}" style="${s.css}">${s.label}</button>`).join('');
})();
App.fontStack = (name) => (App.FONTS.find(([n]) => n === name) || [name, `"${name}"`])[1];

/* ---------- Hulp: woord onder de cursor ---------- */
App.wordRangeAt = (r) => {
  const n = r.startContainer;
  if (!r.collapsed || n.nodeType !== 3) return null;
  const t = n.data, isW = (c) => c && /[\p{L}\p{N}_'’-]/u.test(c);
  let s = r.startOffset, e = s;
  if (!isW(t[s - 1]) || !isW(t[s])) return null;
  while (s > 0 && isW(t[s - 1])) s--;
  while (e < t.length && isW(t[e])) e++;
  const wr = document.createRange(); wr.setStart(n, s); wr.setEnd(n, e);
  return wr;
};
// Voert fn uit op het woord onder de cursor als er niets is geselecteerd (zoals Word)
App.withWord = (fn) => {
  const r = App.restoreRange();
  const wr = r && App.wordRangeAt(r);
  if (!wr) return fn();
  const root = App.editRoot();
  const pos = App.textOffset(r.startContainer, r.startOffset, root);
  App.setRange(wr);
  const res = fn();
  App.setSelOffsets({ s: pos, e: pos, root });
  return res;
};

/* ---------- Inline-opmaak toepassen met willekeurige CSS ---------- */
App.applyInline = (styles) => {
  let r = App.restoreRange();
  if (r.collapsed) {
    const wr = App.wordRangeAt(r);
    if (wr) return App.withWord(() => App.applyInline(styles));
    const span = document.createElement('span');
    Object.assign(span.style, styles);
    span.textContent = '\u200B';
    r.insertNode(span);
    const nr = document.createRange(); nr.setStart(span.firstChild, 1); nr.collapse(true);
    App.setRange(nr);
    return [span];
  }
  App.ex('fontName', '__inkt__', false);
  const root = App.editRoot();
  const marks = $$('font[face="__inkt__"], [style*="__inkt__"]', root);
  const spans = [];
  marks.forEach((f) => {
    let span;
    if (f.tagName === 'FONT') {
      span = document.createElement('span');
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    } else {
      span = f; span.style.removeProperty('font-family');
    }
    Object.entries(styles).forEach(([k, v]) => {
      span.querySelectorAll('*').forEach((d) => {
        if (d.style && d.style[k]) d.style[k] = '';
        if (k === 'fontSize' && d.tagName === 'FONT') d.removeAttribute('size');
        if (k === 'color' && d.tagName === 'FONT') d.removeAttribute('color');
        if (k === 'fontFamily' && d.tagName === 'FONT') d.removeAttribute('face');
      });
      span.style[k] = v;
    });
    spans.push(span);
  });
  // Lege spans zonder stijl opruimen
  root.querySelectorAll('span:not([class]):not([data-cid])').forEach((s) => { if (!s.getAttribute('style')) App.unwrap(s); });
  const live = spans.filter((s) => s.isConnected);
  if (live.length) {
    const nr = document.createRange();
    const first = live[0], last = live[live.length - 1];
    nr.setStart(first, 0); nr.setEnd(last, last.childNodes.length);
    App.setRange(nr);
  }
  return live;
};
// Het hulpteken (zero-width space) uit applyInline weghalen zodra er echt getypt is
App.cleanZwsp = () => {
  const r = App.getRange();
  const n = r && r.collapsed && r.startContainer;
  if (!n || n.nodeType !== 3 || n.length < 2 || n.data.indexOf('\u200B') < 0) return;
  const off = r.startOffset;
  const before = (n.data.slice(0, off).match(/\u200B/g) || []).length;
  n.data = n.data.replace(/\u200B/g, '');
  App.placeCaret(n, Math.max(0, off - before));
};
// Stijlkenmerk verwijderen binnen de selectie
App.removeInline = (prop, attr) => {
  const r = App.restoreRange();
  const root = App.editRoot();
  $$('span, font', root).forEach((el) => {
    if (!r.intersectsNode(el)) return;
    if (el.style[prop]) el.style[prop] = '';
    if (attr && el.tagName === 'FONT') el.removeAttribute(attr);
    if (!el.getAttribute('style') && el.tagName === 'SPAN' && !el.className && !el.dataset.cid) App.unwrap(el);
  });
};

/* ---------- Klembord ---------- */
App.defEdit('cut', () => { App.ex('cut'); });
App.def('copy', () => { App.restoreRange(); document.execCommand('copy'); });
App.defEdit('paste', async () => {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      if (it.types.includes('text/html')) {
        const html = await (await it.getType('text/html')).text();
        App.run(() => (App.state.track && !App.state.hfEditing ? App.trackInsertHtml(App.sanitize(html)) : App.insertHTML(App.sanitize(html))));
        return;
      }
      const img = it.types.find((t) => t.startsWith('image/'));
      if (img) { App.insertImages && App.insertImages([await it.getType(img)]); return; }
      if (it.types.includes('text/plain')) {
        const t = await (await it.getType('text/plain')).text();
        App.run(() => App.ex('insertText', t));
        return;
      }
    }
  } catch {
    App.toast('De browser staat plakken via de knop niet toe. Gebruik Ctrl+V.', 'content_paste', { ms: 3500 });
  }
});
App.defEdit('pasteText', async () => {
  try {
    const t = await navigator.clipboard.readText();
    App.run(() => App.ex('insertText', t));
  } catch {
    App.state.pastePlainOnce = true;
    App.toast('Druk op Ctrl+V: de volgende keer plakken gebeurt zonder opmaak.', 'content_paste', { ms: 3500 });
  }
});

App.sanitize = (html) => {
  const office = /urn:schemas-microsoft-com|docs-internal-guid|<o:p>|mso-/i.test(html);
  const fromInkt = /data-inkt|class="(title|subtitle|nospace|doc-table)/.test(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'A', 'BR', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'IMG', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'HR', 'FONT', 'DIV', 'MARK', 'DEL', 'INS', 'COLGROUP', 'COL', 'SUP', 'FIGURE', 'FIGCAPTION']);
  const KEEP = ['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'color', 'background-color', 'text-align', 'vertical-align'];
  if (office || fromInkt) KEEP.push('font-size', 'font-family');
  const KEEP_CLASS = /^(title|subtitle|nospace|intense|caption|doc-table|ts-\w+|b-\w+|banded|first-col|wrap-\w+|st-\w+|textbox|accent|float-\w+|dropcap|lst-\w+|checklist|done|wa|wa-\d|eq|block|cols|c\d|cl|cr|page-break|sigline|sl-\w+|mf|fn-ref|cite)$/;
  const walk = (el) => {
    Array.from(el.children).forEach(walk);
    if (el === doc.body) return;
    const tag = el.tagName;
    if (/^(SCRIPT|STYLE|META|LINK|TITLE|XML|NOSCRIPT|IFRAME|OBJECT|EMBED|svg|SVG|BUTTON|INPUT|SELECT|TEXTAREA|FORM)$/.test(tag) || tag.includes(':')) {
      if (tag === 'O:P') { el.remove(); return; }
      el.remove(); return;
    }
    if (!ALLOWED.has(tag)) { App.unwrapEl(el); return; }
    // Attributen opschonen
    Array.from(el.attributes).forEach((a) => {
      const n = a.name.toLowerCase();
      if (n === 'href') { if (/^\s*[a-z][a-z0-9+.-]*:/i.test(a.value) && !/^\s*(https?|mailto|tel):/i.test(a.value)) el.removeAttribute(n); return; }
      if (n === 'src') { if (!/^(data:image\/|https?:|blob:)/i.test(a.value)) el.removeAttribute(n); return; }
      if (['alt', 'colspan', 'rowspan', 'start', 'type', 'width', 'data-shape', 'data-chart', 'data-tex', 'data-field', 'data-fn', 'data-note', 'data-src', 'contenteditable', 'data-fld'].includes(n)) return;
      if (n === 'class') {
        const keep = a.value.split(/\s+/).filter((c) => KEEP_CLASS.test(c));
        if (keep.length) el.setAttribute('class', keep.join(' ')); else el.removeAttribute('class');
        return;
      }
      if (n === 'style') {
        const s = el.style, out = [];
        KEEP.forEach((p) => {
          let v = s.getPropertyValue(p);
          if (!v || /mso-|windowtext/i.test(v)) return;
          if (p === 'color' && /^(rgb\(0, 0, 0\)|#000000|black)$/i.test(v)) return;
          if (p === 'background-color' && /^(rgba?\(255, 255, 255(, 1)?\)|#ffffff|white|transparent|rgba\(0, 0, 0, 0\))$/i.test(v)) return;
          if (p === 'font-size' && !/pt$/.test(v)) return;
          if (p === 'font-weight' && /^(400|normal)$/.test(v)) return;
          if (p === 'font-style' && v === 'normal') return;
          if (p === 'text-decoration' && /^none/.test(v)) return;
          out.push(`${p}:${v}`);
        });
        if (out.length) el.setAttribute('style', out.join(';')); else el.removeAttribute('style');
        return;
      }
      el.removeAttribute(n);
    });
    if (tag === 'DIV') {
      if (el.classList.length) return;
      if (el.querySelector('p,div,table,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,pre')) App.unwrapEl(el);
      else { const p = doc.createElement('p'); p.innerHTML = el.innerHTML; if (el.getAttribute('style')) p.setAttribute('style', el.getAttribute('style')); el.replaceWith(p); }
    }
    if (tag === 'SPAN' && !el.attributes.length) App.unwrapEl(el);
    if (tag === 'TABLE' && !el.className) el.className = 'doc-table ts-grid';
  };
  if (office) App.wordLists(doc);
  walk(doc.body);
  return doc.body.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
};
/* Lijsten uit Word komen op het klembord als <p style="mso-list:l0 level1"> met een nep-opsommingsteken.
   Hier maken we er echte (geneste) lijsten van. */
App.wordLists = (doc) => {
  const RE = /mso-list:\s*(l\d+)\s+level(\d+)/i;
  let stack = [], expect = null, lastId = null;
  Array.from(doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6')).forEach((p) => {
    const m = RE.exec(p.getAttribute('style') || '');
    if (!m) return;
    const level = +m[2];
    const ign = p.querySelector('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]');
    const marker = ign ? ign.textContent.replace(/[\s ]/g, '') : '';
    const tag = /^(\d+|[a-z]|[ivxlc]+)[.)]$/i.test(marker) ? 'OL' : 'UL';
    if (ign) {
      let rm = ign;
      while (rm.parentNode && rm.parentNode !== p && rm.parentNode.textContent.trim() === rm.textContent.trim()) rm = rm.parentNode;
      rm.remove();
    }
    if (p !== expect || m[1] !== lastId && level === 1) stack = [];
    while (stack.length && stack[stack.length - 1].level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (!top || top.level < level || (top.level === level && top.list.tagName !== tag)) {
      if (top && top.level === level) stack.pop();
      const parent = stack[stack.length - 1];
      const l = doc.createElement(tag);
      if (parent && parent.list.lastElementChild) parent.list.lastElementChild.appendChild(l);
      else p.before(l);
      top = { list: l, level };
      stack.push(top);
    }
    const li = doc.createElement('li');
    const inner = /^H\d$/.test(p.tagName) ? doc.createElement(p.tagName) : li;
    while (p.firstChild) inner.appendChild(p.firstChild);
    if (inner !== li) li.appendChild(inner);
    top.list.appendChild(li);
    expect = p.nextElementSibling;
    lastId = m[1];
    p.remove();
  });
};
App.unwrapEl = (el) => { const p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); el.remove(); };

App.ed.addEventListener('paste', (e) => {
  const cd = e.clipboardData;
  if (!cd || App.state.protect) { if (App.state.protect) e.preventDefault(); return; }
  const html = cd.getData('text/html');
  const files = Array.from(cd.files || []).filter((f) => f.type.startsWith('image/'));
  e.preventDefault();
  if (files.length && !html) { App.insertImages && App.insertImages(files); return; }
  const plain = App.state.pastePlainOnce; App.state.pastePlainOnce = false;
  App.run(() => {
    if (plain || !html) App.ex('insertText', cd.getData('text/plain'));
    else if (App.state.track && !App.state.hfEditing) App.trackInsertHtml(App.sanitize(html));   // bijgehouden als invoeging
    else App.insertHTML(App.sanitize(html));
  });
});

/* ---------- Opmaak kopiëren ---------- */
App.def('formatPainter', (arg) => {
  if (App.state.painter && arg !== 'sticky') { App.state.painter = null; App.ed.style.cursor = ''; App.scheduleState(); return; }
  const r = App.restoreRange();
  const node = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
  const cs = getComputedStyle(node);
  let bg = '';
  for (let n = node; n && n !== App.ed && App.ed.contains(n); n = n.parentNode) {
    if (n.style && n.style.backgroundColor) { bg = n.style.backgroundColor; break; }
  }
  const deco = [];
  if (App.closest(node, 'u') || /underline/.test(cs.textDecorationLine)) deco.push('underline');
  if (App.closest(node, 's,strike,del') || /line-through/.test(cs.textDecorationLine)) deco.push('line-through');
  App.state.painter = {
    sticky: arg === 'sticky',
    styles: {
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      textDecoration: deco.join(' ') || 'none', color: cs.color, backgroundColor: bg || '',
    },
  };
  App.ed.style.cursor = 'copy';
  App.toast(App.state.painter.sticky ? 'Opmaak kopiëren staat vast — Esc om te stoppen' : 'Selecteer tekst om de opmaak te plakken', 'format_paint');
  App.scheduleState();
});
App.stateFns.painter = () => !!App.state.painter;
App.applyPainter = () => {
  const p = App.state.painter;
  const r = App.getRange();
  if (!p || !r || r.collapsed) return;
  App.run(() => {
    App.ex('removeFormat');
    App.applyInline(p.styles);
  });
  if (!p.sticky) { App.state.painter = null; App.ed.style.cursor = ''; }
  App.scheduleState();
};

/* ---------- Lettertype ---------- */
['bold', 'italic', 'underline', 'strikeThrough'].forEach((c) => App.defEdit(c, () => App.withWord(() => App.ex(c))));
App.defEdit('subscript', () => App.ex('subscript'));
App.defEdit('superscript', () => App.ex('superscript'));
App.defEdit('fontName', (name) => App.withWord(() => App.ex('fontName', App.fontStack(name), true)));
App.defEdit('fontSize', (v) => {
  const pt = App.parseNum(v);
  if (!(pt > 0 && pt < 1640)) { App.toast('Ongeldige tekengrootte', 'error'); return; }
  App.applyInline({ fontSize: pt + 'pt' });
});
App.currentSize = () => {
  const r = App.getRange() || App.lastRange;
  if (!r) return 12;
  const n = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer;
  return Math.round(parseFloat(getComputedStyle(n).fontSize) * 0.75 * 2) / 2;
};
App.defEdit('growFont', () => {
  const cur = App.currentSize();
  const next = App.SIZES.find((s) => s > cur + 0.01) || cur + 10;
  App.applyInline({ fontSize: next + 'pt' });
});
App.defEdit('shrinkFont', () => {
  const cur = App.currentSize();
  const prev = [...App.SIZES].reverse().find((s) => s < cur - 0.01) || Math.max(1, cur - 1);
  App.applyInline({ fontSize: prev + 'pt' });
});
App.defEdit('underlineStyle', (style) => {
  App.applyInline({ textDecorationLine: 'underline', textDecorationStyle: style });
});
App.defEdit('foreColor', (c) => {
  c = c ?? App.state.lastColors.foreColor;
  App.withWord(() => { if (c) App.ex('foreColor', c, true); else App.removeInline('color', 'color'); });
});
App.defEdit('hiliteColor', (c) => {
  c = c ?? App.state.lastColors.hiliteColor;
  App.withWord(() => App.ex('hiliteColor', c || 'transparent', true));
});
App.defEdit('clearCharFormat', () => {
  App.ex('removeFormat');
  App.removeInline('fontSize'); App.removeInline('fontFamily'); App.removeInline('color'); App.removeInline('backgroundColor');
});
App.defEdit('clearFormat', () => {
  App.ex('removeFormat');
  ['fontSize', 'fontFamily', 'color', 'backgroundColor', 'letterSpacing', 'textTransform', 'fontVariant', 'textDecorationLine', 'textDecorationStyle'].forEach((p) => App.removeInline(p));
  const blocks = App.getSelectedBlocks();
  const marks = App.markSel();
  blocks.forEach((b) => {
    if (/^(H\d|BLOCKQUOTE|PRE|P)$/.test(b.tagName)) {
      const n = App.retag(b, App.STYLES[0]);
      n.removeAttribute('style');
    }
  });
  App.restoreMarks(marks);
});

// Alineaopmaak wissen (Ctrl+Q): uitlijning, inspringing, afstand, regelafstand terug naar de stijl
App.defEdit('clearParaFormat', () => {
  App.getSelectedBlocks().forEach((b) => {
    if (b === App.editRoot() || /^(TD|TH)$/.test(b.tagName)) return;
    b.removeAttribute('style');
    if (b.dataset.pg) b.dataset.pgOrig = '';
  });
});
// Shift+F3: wisselen tussen kleine letters, Elk Woord Met Hoofdletter en HOOFDLETTERS
App.defEdit('cycleCase', () => {
  let r = App.restoreRange();
  if (r.collapsed) { const wr = App.wordRangeAt(r); if (!wr) return; App.setRange(wr); r = wr; }
  const t = r.toString();
  const mode = t === t.toUpperCase() && t !== t.toLowerCase() ? 'lower' : t === t.toLowerCase() ? 'title' : 'upper';
  App.commands.changeCase.fn(mode);
});
/* Hoofdlettergebruik */
App.defEdit('changeCase', (mode) => {
  let r = App.restoreRange();
  if (r.collapsed) { const wr = App.wordRangeAt(r); if (!wr) return; App.setRange(wr); r = wr; }
  const offs = App.getSelOffsets(App.editRoot());
  const nodes = App.textNodesIn(r);
  let sentenceStart = true, wordStart = true;
  // Context vóór de selectie bepalen
  if (r.startContainer.nodeType === 3) {
    const before = r.startContainer.data.slice(0, r.startOffset);
    sentenceStart = /(^|[.!?]\s+)$/.test(before) || before.trim() === '';
    wordStart = /(^|\s)$/.test(before);
  }
  nodes.forEach((n) => {
    const s = n === r.startContainer ? r.startOffset : 0;
    const e = n === r.endContainer ? r.endOffset : n.length;
    const seg = n.data.slice(s, e);
    let out = '';
    for (const ch of seg) {
      let c = ch;
      if (mode === 'upper') c = ch.toUpperCase();
      else if (mode === 'lower') c = ch.toLowerCase();
      else if (mode === 'toggle') c = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
      else if (mode === 'title') c = wordStart ? ch.toUpperCase() : ch.toLowerCase();
      else if (mode === 'sentence') c = sentenceStart && /\p{L}/u.test(ch) ? ch.toUpperCase() : ch.toLowerCase();
      if (/\p{L}/u.test(ch)) sentenceStart = false;
      if (/[.!?]/.test(ch)) sentenceStart = true;
      wordStart = /\s|-/.test(ch);
      out += c;
    }
    n.data = n.data.slice(0, s) + out + n.data.slice(e);
  });
  App.setSelOffsets(offs);
});

/* Lettertype-dialoog */
App.def('fontDialog', () => {
  App.restoreRange();
  const r = App.getRange();
  const node = r ? (r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer) : App.ed;
  const cs = getComputedStyle(node);
  const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '');
  const size = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
  const toHex = (c) => { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('') : '#000000'; };
  const bold = +cs.fontWeight >= 600, italic = cs.fontStyle === 'italic';
  const d = App.dialog({
    title: 'Lettertype', wide: true,
    body: `
      <div class="fields-3">
        <label class="field"><span>Lettertype</span><select id="fd-fam">${App.FONTS.map(([n]) => `<option ${n === fam ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Stijl</span><select id="fd-style">
          <option value="n" ${!bold && !italic ? 'selected' : ''}>Standaard</option><option value="i" ${!bold && italic ? 'selected' : ''}>Cursief</option>
          <option value="b" ${bold && !italic ? 'selected' : ''}>Vet</option><option value="bi" ${bold && italic ? 'selected' : ''}>Vet cursief</option></select></label>
        <label class="field"><span>Grootte (pt)</span><input id="fd-size" type="number" min="1" max="400" step="0.5" value="${size}"></label>
      </div>
      <div class="fields-3">
        <label class="field"><span>Tekstkleur</span><input id="fd-color" type="color" value="${toHex(cs.color)}"></label>
        <label class="field"><span>Onderstrepen</span><select id="fd-ul"><option value="">(geen)</option><option value="solid">Enkel</option><option value="double">Dubbel</option><option value="dotted">Gestippeld</option><option value="dashed">Gestreept</option><option value="wavy">Golvend</option></select></label>
        <label class="field"><span>Tekenafstand (pt)</span><input id="fd-ls" type="number" step="0.5" value="${cs.letterSpacing === 'normal' ? 0 : App.fmtNum(parseFloat(cs.letterSpacing) * 0.75, 1).replace(',', '.')}"></label>
      </div>
      <div class="checks">
        <label><input type="checkbox" id="fd-strike"> Doorhalen</label>
        <label><input type="checkbox" id="fd-dstrike"> Dubbel doorhalen</label>
        <label><input type="checkbox" id="fd-sup"> Superscript</label>
        <label><input type="checkbox" id="fd-sub"> Subscript</label>
        <label><input type="checkbox" id="fd-smallcaps" ${cs.fontVariantCaps === 'small-caps' ? 'checked' : ''}> Kleinkapitaal</label>
        <label><input type="checkbox" id="fd-caps" ${cs.textTransform === 'uppercase' ? 'checked' : ''}> Hoofdletters</label>
        <label><input type="checkbox" id="fd-shadow"> Schaduw</label>
        <label><input type="checkbox" id="fd-outline"> Contour</label>
      </div>
      <div class="field"><span>Voorbeeld</span><div class="preview-box" id="fd-prev" style="height:80px">${App.esc((r && r.toString().slice(0, 40)) || 'Inkt schrijft mooi')}</div></div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (dd) => { const st = build(dd); App.run(() => {
        App.applyInline(st);
        if (dd.$('#fd-sup').checked && !document.queryCommandState('superscript')) App.ex('superscript');
        if (dd.$('#fd-sub').checked && !document.queryCommandState('subscript')) App.ex('subscript');
      }); },
    }],
  });
  const build = (dd) => {
    const st = dd.$('#fd-style').value;
    const ul = dd.$('#fd-ul').value;
    const lines = [];
    if (ul) lines.push('underline');
    if (dd.$('#fd-strike').checked || dd.$('#fd-dstrike').checked) lines.push('line-through');
    const s = {
      fontFamily: App.fontStack(dd.$('#fd-fam').value),
      fontSize: App.parseNum(dd.$('#fd-size').value) + 'pt',
      fontWeight: st.includes('b') ? '700' : '400',
      fontStyle: st.includes('i') ? 'italic' : 'normal',
      color: dd.$('#fd-color').value,
      textDecorationLine: lines.join(' ') || 'none',
      textDecorationStyle: dd.$('#fd-dstrike').checked ? 'double' : (ul || 'solid'),
      letterSpacing: (App.parseNum(dd.$('#fd-ls').value) || 0) + 'pt',
      fontVariant: dd.$('#fd-smallcaps').checked ? 'small-caps' : 'normal',
      textTransform: dd.$('#fd-caps').checked ? 'uppercase' : 'none',
      textShadow: dd.$('#fd-shadow').checked ? '1px 1px 2px rgba(0,0,0,.35)' : 'none',
      webkitTextStroke: dd.$('#fd-outline').checked ? '1px currentColor' : '',
    };
    if (dd.$('#fd-outline').checked) s.color = 'transparent';
    return s;
  };
  const prev = () => Object.assign(d.$('#fd-prev').style, build(d), d.$('#fd-outline').checked ? { webkitTextStroke: '1px #222' } : {});
  d.body.addEventListener('input', prev); d.body.addEventListener('change', prev); prev();
});

/* ---------- Alinea ---------- */
App.retag = (b, st) => {
  if (/^(LI|TD|TH|DIV)$/.test(b.tagName)) {
    if (st.id === 'normal') return b;
    const el = document.createElement(st.tag);
    if (st.cls) el.className = st.cls;
    Array.from(b.childNodes).forEach((n) => { if (!(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName))) el.appendChild(n); });
    b.insertBefore(el, b.firstChild);
    return el;
  }
  const el = document.createElement(st.tag);
  Array.from(b.attributes).forEach((a) => { if (a.name !== 'class') el.setAttribute(a.name, a.value); });
  const keep = Array.from(b.classList).filter((c) => c === 'dropcap');
  el.className = [st.cls, ...keep].filter(Boolean).join(' ');
  if (!el.className) el.removeAttribute('class');
  while (b.firstChild) el.appendChild(b.firstChild);
  b.replaceWith(el);
  return el;
};
App.defEdit('blockStyle', (id) => {
  const st = App.STYLES.find((s) => s.id === id);
  if (!st) return;
  const root = App.editRoot();
  let blocks = App.getSelectedBlocks();
  if (!blocks.length) {
    App.ex('formatBlock', st.tag);
    blocks = App.getSelectedBlocks();
  }
  const marks = App.markSel();
  blocks.forEach((b) => { if (b !== root) App.retag(b, st); });
  App.restoreMarks(marks);
});
App.currentStyleId = () => {
  const r = App.getRange() || App.lastRange;
  if (!r) return 'normal';
  const b = App.closest(r.startContainer, App.LEAF_BLOCK + ',blockquote');
  if (!b) return 'normal';
  const tag = b.tagName.toLowerCase();
  const st = App.STYLES.find((s) => s.tag === tag && (s.cls ? b.classList.contains(s.cls) : !App.STYLES.some((x) => x.tag === tag && x.cls && b.classList.contains(x.cls))));
  return st ? st.id : 'normal';
};
App.on('selection', () => {
  const id = App.currentStyleId();
  $$('#style-gallery .style-chip').forEach((c) => c.classList.toggle('on', c.dataset.arg === id));
});

/* Lijsten (eigen implementatie; execCommand nest lijsten in <p>) */
App.inList = (tag) => App.selClosest(tag);
App.liToP = (li) => {
  const p = document.createElement('p');
  if (li.getAttribute('style')) p.setAttribute('style', li.getAttribute('style'));
  const nested = [];
  Array.from(li.childNodes).forEach((n) => {
    if (n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)) nested.push(n);
    else if (n.nodeType === 1 && /^(P|H\d|PRE|BLOCKQUOTE)$/.test(n.tagName) && li.children.length === 1) { while (n.firstChild) p.appendChild(n.firstChild); }
    else p.appendChild(n);
  });
  if (!p.firstChild) p.innerHTML = '<br>';
  return { p, nested };
};
App.splitListAt = (li) => {
  // Splitst de lijst zodat li en volgende items in een nieuwe lijst staan; geeft die lijst terug
  const list = li.parentNode;
  if (li === list.firstElementChild) return list;
  const nl = list.cloneNode(false);
  if (list.tagName === 'OL') nl.removeAttribute('start');
  let n = li;
  while (n) { const nx = n.nextSibling; nl.appendChild(n); n = nx; }
  list.after(nl);
  return nl;
};
App.toggleList = (tag) => {
  const blocks = App.getSelectedBlocks().filter((b) => b !== App.editRoot());
  if (!blocks.length) return;
  const marks = App.markSel();
  const lis = blocks.map((b) => (b.tagName === 'LI' ? b : b.closest('li'))).filter(Boolean);
  const allLi = lis.length === blocks.length;
  if (allLi && lis.every((li) => li.parentNode.tagName === tag.toUpperCase())) {
    // Lijst uitzetten voor de geselecteerde items
    lis.forEach((li) => {
      if (!li.isConnected) return;
      const list = App.splitListAt(li);
      const rest = li.nextSibling ? App.splitListAt(li.nextElementSibling) : null;
      const { p, nested } = App.liToP(li);
      const parentLi = list.parentNode.closest && list.parentNode.closest('li');
      list.before(p);
      nested.forEach((x) => p.after(x));
      li.remove();
      if (!list.children.length) list.remove();
      if (parentLi) { /* p blijft binnen bovenliggend item */ }
      void rest;
    });
  } else if (allLi) {
    // Ander lijsttype: lijst(en) omzetten
    const lists = [...new Set(lis.map((li) => li.parentNode))];
    lists.forEach((l) => {
      const n = document.createElement(tag);
      while (l.firstChild) n.appendChild(l.firstChild);
      l.replaceWith(n);
    });
  } else {
    // Nieuwe lijst maken van de geselecteerde alinea's
    let list = null;
    blocks.forEach((b) => {
      if (b.tagName === 'LI' || b.closest('li')) return;
      const host = /^(TD|TH|DIV)$/.test(b.tagName) ? b : null;
      const li = document.createElement('li');
      if (host) {
        while (host.firstChild) li.appendChild(host.firstChild);
        const l = document.createElement(tag); l.appendChild(li); host.appendChild(l); list = null; return;
      }
      if (!/^P$/.test(b.tagName)) { const inner = document.createElement(b.tagName); inner.className = b.className; while (b.firstChild) inner.appendChild(b.firstChild); li.appendChild(inner); }
      else { while (b.firstChild) li.appendChild(b.firstChild); if (b.style.textAlign) li.style.textAlign = b.style.textAlign; }
      if (!li.firstChild) li.innerHTML = '<br>';
      if (!list || list.nextElementSibling !== b) {
        const prev = b.previousElementSibling;
        if (prev && prev.tagName === tag.toUpperCase() && !list) list = prev;
        else { list = document.createElement(tag); b.before(list); }
      }
      list.appendChild(li);
      b.remove();
      // samenvoegen met direct volgende lijst van hetzelfde type
      const nx = list.nextElementSibling;
      if (nx && nx.tagName === list.tagName && nx.className === list.className && b === blocks[blocks.length - 1]) { while (nx.firstChild) list.appendChild(nx.firstChild); nx.remove(); }
    });
  }
  App.restoreMarks(marks);
};
App.listIndent = (dir) => {
  const lis = App.getSelectedBlocks().map((b) => (b.tagName === 'LI' ? b : b.closest('li'))).filter(Boolean);
  if (!lis.length) return false;
  const marks = App.markSel();
  const items = dir > 0 ? lis : [...lis].reverse();
  items.forEach((li) => {
    const list = li.parentNode;
    if (dir > 0) {
      const prev = li.previousElementSibling;
      if (!prev) return;
      let sub = Array.from(prev.children).find((c) => /^(UL|OL)$/.test(c.tagName));
      if (!sub) { sub = list.cloneNode(false); sub.removeAttribute('start'); prev.appendChild(sub); }
      sub.appendChild(li);
      // eigen subitems meeverhuizen
      const own = Array.from(li.children).filter((c) => /^(UL|OL)$/.test(c.tagName));
      own.forEach((o) => { while (o.firstChild) sub.appendChild(o.firstChild); o.remove(); });
    } else {
      const parentLi = list.parentNode.closest('li');
      if (!parentLi || !App.ed.contains(parentLi)) {
        // bovenste niveau: lijst verlaten
        App.splitListAt(li);
        const rest = li.nextElementSibling ? App.splitListAt(li.nextElementSibling) : null;
        const { p, nested } = App.liToP(li);
        li.parentNode.before(p);
        nested.forEach((x) => { if (rest) rest.prepend(...Array.from(x.children)); else p.after(x); });
        const l = li.parentNode; li.remove(); if (!l.children.length) l.remove();
        return;
      }
      // volgende broers worden subitems van li
      const after = [];
      let n = li.nextElementSibling;
      while (n) { after.push(n); n = n.nextElementSibling; }
      if (after.length) {
        let sub = Array.from(li.children).find((c) => /^(UL|OL)$/.test(c.tagName));
        if (!sub) { sub = list.cloneNode(false); li.appendChild(sub); }
        after.forEach((a) => sub.appendChild(a));
      }
      parentLi.after(li);
      if (!list.children.length) list.remove();
    }
  });
  App.restoreMarks(marks);
  return true;
};
App.stateFns.insertUnorderedList = () => { const li = App.selClosest('li'); return !!li && li.parentNode.tagName === 'UL'; };
App.stateFns.insertOrderedList = () => { const li = App.selClosest('li'); return !!li && li.parentNode.tagName === 'OL'; };
// Enter in een leeg item beëindigt de lijst; Backspace aan het begin haalt het opsommingsteken weg
App.ed.addEventListener('keydown', (e) => {
  if (App.state.protect || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key !== 'Enter' && e.key !== 'Backspace') return;
  const r = App.getRange();
  if (!r || !r.collapsed) return;
  const li = App.closest(r.startContainer, 'li', App.ed);
  if (!li) return;
  const ownText = Array.from(li.childNodes).filter((n) => !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName))).map((n) => n.textContent).join('');
  const atStart = App.textOffset(r.startContainer, r.startOffset, li) === 0;
  if ((e.key === 'Enter' && !e.shiftKey && !ownText.trim() && !li.querySelector('img')) || (e.key === 'Backspace' && atStart && !App.state.track)) {
    e.preventDefault();
    App.run(() => App.listIndent(-1));
  }
});
// Enter aan het eind van Titel/Ondertitel/Bijschrift/Citaat: verder in Normaal (Word: "stijl volgende alinea")
App.NEXT_NORMAL = 'p.title, p.subtitle, p.caption, blockquote';
App.ed.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented || App.state.protect) return;
  const r = App.getRange();
  if (!r || !r.collapsed) return;
  const b = App.closest(r.startContainer, 'p, blockquote', App.ed);
  if (!b || !b.matches(App.NEXT_NORMAL) || b.closest('li, td, th') || b.parentNode !== App.ed) return;
  const rest = document.createRange();
  rest.selectNodeContents(b); rest.setStart(r.startContainer, r.startOffset);
  if (rest.toString().replace(/\u200B/g, '').length || rest.cloneContents().querySelector('img')) return;
  e.preventDefault();
  App.run(() => {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    b.after(p);
    App.placeCaret(p, 0);
  });
});
App.defEdit('bullets', () => App.toggleList('ul'));
App.defEdit('numbering', () => App.toggleList('ol'));
App.defEdit('bulletStyle', (arg) => {
  let ul = App.inList('ul');
  if (!ul) { App.toggleList('ul'); ul = App.inList('ul'); }
  if (!ul) return;
  ul.className = ul.className.split(' ').filter((c) => !/^lst-|checklist/.test(c)).join(' ');
  if (arg.startsWith('lst-')) { ul.classList.add(arg); ul.style.listStyleType = ''; } else ul.style.listStyleType = arg;
  if (!ul.className) ul.removeAttribute('class');
  if (!ul.getAttribute('style')) ul.removeAttribute('style');
});
App.defEdit('numberStyle', (arg) => {
  let ol = App.inList('ol');
  if (!ol) { App.toggleList('ol'); ol = App.inList('ol'); }
  if (!ol) return;
  ol.classList.remove('lst-paren');
  if (arg.startsWith('lst-')) { ol.classList.add(arg); ol.style.listStyleType = ''; } else ol.style.listStyleType = arg;
  if (!ol.className) ol.removeAttribute('class');
});
App.def('numberStart', async () => {
  const ol = App.inList('ol');
  if (!ol) { App.toast('Plaats de cursor eerst in een genummerde lijst', 'info'); return; }
  const v = await App.prompt('Nummering', 'Beginnen bij', ol.start || 1);
  if (v == null) return;
  App.run(() => { ol.start = parseInt(v, 10) || 1; ol.style.setProperty('--start', (parseInt(v, 10) || 1) - 1); });
});
App.defEdit('checklist', () => {
  let ul = App.inList('ul');
  if (!ul) { App.toggleList('ul'); ul = App.inList('ul'); }
  if (ul) { ul.className = 'checklist'; ul.style.listStyleType = ''; }
});
App.ed.addEventListener('mousedown', (e) => {
  const li = e.target.closest && e.target.closest('ul.checklist > li');
  if (li && e.offsetX < 0) {
    e.preventDefault();
    App.history.flush();
    li.classList.toggle('done');
    App.changed({ immediate: true });
  }
});

/* Inspringen */
App.indentBlocks = (delta) => {
  App.getSelectedBlocks().forEach((b) => {
    if (b.tagName === 'TD' || b.tagName === 'TH') return;
    const cur = parseFloat(b.style.marginLeft) || 0;
    const next = Math.max(0, cur + delta * App.cm2px(1.27));
    b.style.marginLeft = next ? Math.round(next) + 'px' : '';
  });
};
App.defEdit('indent', () => { if (!App.selClosest('li') || !App.listIndent(1)) App.indentBlocks(1); });
App.defEdit('outdent', () => { if (!App.selClosest('li') || !App.listIndent(-1)) App.indentBlocks(-1); });

/* Uitlijning */
const ALIGN = { justifyLeft: '', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' };
Object.entries(ALIGN).forEach(([cmd, val]) => {
  App.defEdit(cmd, () => {
    if (App.selectedObj && App.selectedObj.tagName === 'IMG') {
      const map = { justifyLeft: 'wrapInline', justifyCenter: 'wrapCenter', justifyRight: 'wrapRight', justifyFull: 'wrapInline' };
      App.commands[map[cmd]].fn(); return;
    }
    App.getSelectedBlocks().forEach((b) => { b.style.textAlign = val; if (!b.getAttribute('style')) b.removeAttribute('style'); });
  });
  App.stateFns[cmd] = () => {
    const r = App.getRange() || App.lastRange;
    if (!r) return false;
    const b = App.blockOf(r.startContainer) || App.editRoot();
    const a = getComputedStyle(b).textAlign;
    return val === '' ? (a === 'left' || a === 'start') : a === val;
  };
});

App.defEdit('lineSpacing', (v) => App.getSelectedBlocks().forEach((b) => { b.style.lineHeight = v; }));
App.defEdit('toggleSpaceBefore', () => App.getSelectedBlocks().forEach((b) => { b.style.marginTop = parseFloat(getComputedStyle(b).marginTop) > 1 ? '0px' : '12pt'; }));
App.defEdit('toggleSpaceAfter', () => App.getSelectedBlocks().forEach((b) => { b.style.marginBottom = parseFloat(getComputedStyle(b).marginBottom) > 1 ? '0px' : '8pt'; }));
App.defEdit('shading', (c) => {
  c = c ?? App.state.lastColors.shading;
  App.getSelectedBlocks().forEach((b) => { b.style.backgroundColor = c || ''; if (c) b.style.padding = b.style.padding || '2pt 4pt'; else b.style.padding = ''; });
});
App.defEdit('paraBorder', (side) => {
  const line = '1px solid #555';
  App.getSelectedBlocks().forEach((b) => {
    if (side === 'none') { ['border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight', 'padding'].forEach((p) => { b.style[p] = ''; }); return; }
    if (side === 'box') { b.style.border = line; b.style.padding = '4pt 6pt'; return; }
    const prop = 'border' + side[0].toUpperCase() + side.slice(1);
    b.style[prop] = b.style[prop] ? '' : line;
    const pad = { top: 'paddingTop', bottom: 'paddingBottom', left: 'paddingLeft', right: 'paddingRight' }[side];
    b.style[pad] = b.style[prop] ? '3pt' : '';
  });
});

App.defEdit('sortBlocks', (dir) => {
  const blocks = App.getSelectedBlocks().filter((b) => b.tagName !== 'TD' && b.tagName !== 'TH');
  if (blocks.length < 2) { App.toast('Selecteer minstens twee alinea\'s om te sorteren', 'info'); return; }
  const parent = blocks[0].parentNode;
  if (!blocks.every((b) => b.parentNode === parent)) { App.toast('Sorteren werkt binnen één lijst of één tekstgedeelte', 'info'); return; }
  const marker = document.createComment('sort');
  parent.insertBefore(marker, blocks[0]);
  const sorted = [...blocks].sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim(), 'nl', { numeric: true, sensitivity: 'base' }));
  if (dir === 'desc') sorted.reverse();
  sorted.forEach((b) => parent.insertBefore(b, marker));
  marker.remove();
});

App.def('toggleMarks', () => {
  App.state.marks = !App.state.marks;
  App.ed.classList.toggle('show-marks', App.state.marks);
  App.scheduleLayout(); App.scheduleState();
});
App.stateFns.marks = () => App.state.marks;

App.def('paragraphDialog', () => {
  App.restoreRange();
  const b = App.getSelectedBlocks()[0] || App.ed.firstElementChild;
  const cs = getComputedStyle(b);
  const fs = parseFloat(cs.fontSize);
  const lh = cs.lineHeight === 'normal' ? 1.15 : parseFloat(cs.lineHeight) / fs;
  const ti = parseFloat(cs.textIndent) || 0;
  const align = { left: 'left', start: 'left', center: 'center', right: 'right', justify: 'justify' }[cs.textAlign] || 'left';
  App.dialog({
    title: 'Alinea', wide: true,
    body: `
      <div class="fields-2">
        <label class="field"><span>Uitlijning</span><select id="pd-align">
          ${[['left', 'Links'], ['center', 'Gecentreerd'], ['right', 'Rechts'], ['justify', 'Uitgevuld']].map(([v, l]) => `<option value="${v}" ${v === align ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Overzichtsniveau</span><select id="pd-level" disabled><option>Platte tekst</option></select></label>
      </div>
      <div class="fields-4">
        <label class="field"><span>Links (cm)</span><input id="pd-left" type="number" step="0.1" value="${App.px2cm(parseFloat(cs.marginLeft) || 0).toFixed(2)}"></label>
        <label class="field"><span>Rechts (cm)</span><input id="pd-right" type="number" step="0.1" value="${App.px2cm(parseFloat(cs.marginRight) || 0).toFixed(2)}"></label>
        <label class="field"><span>Speciaal</span><select id="pd-special"><option value="none">(geen)</option><option value="first" ${ti > 0 ? 'selected' : ''}>Eerste regel</option><option value="hanging" ${ti < 0 ? 'selected' : ''}>Verkeerd om</option></select></label>
        <label class="field"><span>Met (cm)</span><input id="pd-by" type="number" step="0.1" min="0" value="${App.px2cm(Math.abs(ti)).toFixed(2)}"></label>
      </div>
      <div class="fields-4">
        <label class="field"><span>Afstand vóór (pt)</span><input id="pd-before" type="number" step="1" min="0" value="${Math.round(App.naturalMarginTop(b) * 0.75)}"></label>
        <label class="field"><span>Afstand na (pt)</span><input id="pd-after" type="number" step="1" min="0" value="${Math.round(parseFloat(cs.marginBottom) * 0.75)}"></label>
        <label class="field"><span>Regelafstand</span><select id="pd-lh">
          ${[['1', 'Enkel'], ['1.15', '1,15'], ['1.5', '1,5 regel'], ['2', 'Dubbel'], ['custom', 'Meervoudig']].map(([v, l]) => `<option value="${v}" ${Math.abs(lh - v) < 0.03 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Factor</span><input id="pd-lhv" type="number" step="0.05" min="0.5" value="${lh.toFixed(2)}"></label>
      </div>
      <div class="checks">
        <label><input type="checkbox" id="pd-keep" ${cs.breakInside === 'avoid' ? 'checked' : ''}> Regels bijeenhouden</label>
        <label><input type="checkbox" id="pd-next" ${cs.breakAfter === 'avoid' ? 'checked' : ''}> Bij volgende alinea houden</label>
        <label><input type="checkbox" id="pd-pbb" ${cs.breakBefore === 'page' ? 'checked' : ''}> Pagina-einde ervoor</label>
      </div>`,
    buttons: [{ label: 'Annuleren' }, {
      label: 'OK', primary: true, action: (d) => App.run(() => {
        const g = (id) => App.parseNum(d.$(id).value) || 0;
        const lhSel = d.$('#pd-lh').value;
        const lhv = lhSel === 'custom' ? g('#pd-lhv') : +lhSel;
        const sp = d.$('#pd-special').value, by = App.cm2px(g('#pd-by'));
        App.getSelectedBlocks().forEach((el) => {
          el.style.textAlign = d.$('#pd-align').value === 'left' ? '' : d.$('#pd-align').value;
          el.style.marginLeft = g('#pd-left') ? App.cm2px(g('#pd-left')).toFixed(1) + 'px' : '';
          el.style.marginRight = g('#pd-right') ? App.cm2px(g('#pd-right')).toFixed(1) + 'px' : '';
          el.style.textIndent = sp === 'first' ? by.toFixed(1) + 'px' : sp === 'hanging' ? (-by).toFixed(1) + 'px' : '';
          if (sp === 'hanging') el.style.paddingLeft = by.toFixed(1) + 'px'; else if (el.style.textIndent === '') el.style.paddingLeft = '';
          el.style.marginTop = g('#pd-before') + 'pt';
          el.style.marginBottom = g('#pd-after') + 'pt';
          el.style.lineHeight = lhv;
          el.style.breakInside = d.$('#pd-keep').checked ? 'avoid' : '';
          el.style.breakAfter = d.$('#pd-next').checked ? 'avoid' : '';
          el.style.breakBefore = d.$('#pd-pbb').checked ? 'page' : '';
        });
      }),
    }],
  });
});

/* Indeling > alinea-invoervelden */
App.defEdit('indentLeft', (v) => App.getSelectedBlocks().forEach((b) => { b.style.marginLeft = App.parseNum(v) ? App.cm2px(App.parseNum(v)).toFixed(1) + 'px' : ''; }));
App.defEdit('indentRight', (v) => App.getSelectedBlocks().forEach((b) => { b.style.marginRight = App.parseNum(v) ? App.cm2px(App.parseNum(v)).toFixed(1) + 'px' : ''; }));
App.defEdit('spaceBefore', (v) => App.getSelectedBlocks().forEach((b) => { b.style.marginTop = (App.parseNum(v) || 0) + 'pt'; }));
App.defEdit('spaceAfter', (v) => App.getSelectedBlocks().forEach((b) => { b.style.marginBottom = (App.parseNum(v) || 0) + 'pt'; }));
App.on('selection', () => {
  if (App.activeTab !== 'layout') return;
  const r = App.getRange() || App.lastRange;
  const b = r && App.blockOf(r.startContainer);
  if (!b) return;
  const cs = getComputedStyle(b);
  const set = (id, v) => { const el = document.getElementById(id); if (document.activeElement !== el) el.value = v; };
  set('ind-left', App.px2cm(parseFloat(cs.marginLeft) || 0).toFixed(2));
  set('ind-right', App.px2cm(parseFloat(cs.marginRight) || 0).toFixed(2));
  set('sp-before', Math.round(App.naturalMarginTop(b) * 0.75));
  set('sp-after', Math.round(parseFloat(cs.marginBottom) * 0.75));
});

/* ---------- Selecteren ---------- */
App.def('selectAll', () => {
  const root = App.editRoot();
  root.focus();
  App.selectContents(root);
});

/* ---------- Zoeken & vervangen ---------- */
App.find = {
  matches: [], cur: -1,
  regex(q) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const word = $('#find-word').checked;
    const src = word ? `(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])` : esc;
    return new RegExp(src, 'gu' + ($('#find-case').checked ? '' : 'i'));
  },
  run(q) {
    this.matches = [];
    if (!q) { this.paint(); return []; }
    const re = this.regex(q);
    // Tekstknooppunten groeperen per blok
    const groups = [];
    let cur = null;
    const w = document.createTreeWalker(App.ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const b = App.blockOf(n) || App.ed;
      if (!cur || cur.block !== b) { cur = { block: b, nodes: [], text: '' }; groups.push(cur); }
      cur.nodes.push({ node: n, start: cur.text.length });
      cur.text += n.data;
    }
    const locate = (g, pos) => {
      for (let i = g.nodes.length - 1; i >= 0; i--) if (pos >= g.nodes[i].start) return { node: g.nodes[i].node, offset: pos - g.nodes[i].start };
      return null;
    };
    groups.forEach((g) => {
      let m; re.lastIndex = 0;
      while ((m = re.exec(g.text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        const s = locate(g, m.index), e = locate(g, m.index + m[0].length);
        // einde op knooppuntgrens: liever einde van vorig knooppunt
        let en = e.node, eo = e.offset;
        if (eo === 0) { const idx = g.nodes.findIndex((x) => x.node === e.node); if (idx > 0) { en = g.nodes[idx - 1].node; eo = en.length; } }
        const r = document.createRange();
        r.setStart(s.node, s.offset); r.setEnd(en, eo);
        this.matches.push(r);
      }
    });
    return this.matches;
  },
  paint() {
    if (!window.CSS || !CSS.highlights) return;
    CSS.highlights.delete('inkt-find'); CSS.highlights.delete('inkt-find-current');
    if (this.matches.length) CSS.highlights.set('inkt-find', new Highlight(...this.matches));
    if (this.matches[this.cur]) CSS.highlights.set('inkt-find-current', new Highlight(this.matches[this.cur]));
    const c = $('#find-count');
    if (c) c.textContent = $('#find-input').value ? (this.matches.length ? `${this.cur + 1} van ${this.matches.length}` : 'Geen resultaten') : '';
  },
  go(i) {
    if (!this.matches.length) { this.paint(); return; }
    this.cur = (i + this.matches.length) % this.matches.length;
    const r = this.matches[this.cur];
    App.lastRange = r.cloneRange();
    this.paint();
    const el = r.startContainer.parentElement;
    const rect = r.getBoundingClientRect(), sc = $('#canvas-scroll').getBoundingClientRect();
    if (rect.top < sc.top + 60 || rect.bottom > sc.bottom - 40) $('#canvas-scroll').scrollTop += rect.top - sc.top - sc.height / 3;
    else if (!rect.height && el) el.scrollIntoView({ block: 'center' });
  },
  refresh() {
    const q = $('#find-input').value;
    const keep = this.cur;
    this.run(q);
    this.cur = Math.min(Math.max(keep, 0), this.matches.length - 1);
    this.paint();
  },
  clear() { this.matches = []; this.cur = -1; this.paint(); },
};
App.openFind = (replace, q) => {
  const p = $('#find-panel');
  p.hidden = false;
  $('#replace-row').hidden = !replace;
  const inp = $('#find-input');
  const r = App.getRange();
  if (q != null) inp.value = q;
  else if (r && !r.collapsed && r.toString().length < 80) inp.value = r.toString();
  inp.focus(); inp.select();
  App.find.run(inp.value);
  // eerste treffer na de cursor
  const cur = App.lastRange;
  let idx = 0;
  if (cur) idx = Math.max(0, App.find.matches.findIndex((m) => m.compareBoundaryPoints(Range.START_TO_START, cur) >= 0));
  App.find.go(idx);
};
App.def('find', (q) => App.openFind(false, typeof q === 'string' ? q : null));
App.def('replace', () => App.openFind(true));
App.def('toggleReplaceRow', () => { $('#replace-row').hidden = !$('#replace-row').hidden; if (!$('#replace-row').hidden) $('#replace-input').focus(); });
App.def('findNext', () => App.find.go(App.find.cur + 1));
App.def('findPrev', () => App.find.go(App.find.cur - 1));
App.def('closeFind', () => {
  $('#find-panel').hidden = true;
  const r = App.find.matches[App.find.cur];
  App.find.clear();
  App.ed.focus({ preventScroll: true });
  if (r) App.setRange(r);
});
App.def('replaceOne', () => {
  const r = App.find.matches[App.find.cur];
  if (!r) return;
  if (App.state.protect) { App.toast('Het document is beveiligd', 'lock'); return; }
  App.history.flush();
  if (App.state.track) { App.setRange(r); App.trackDeleteRange(r, false); App.trackInsert($('#replace-input').value); }   // bijgehouden vervanging
  else { r.deleteContents(); r.insertNode(document.createTextNode($('#replace-input').value)); }
  App.ed.normalize();
  App.changed({ immediate: true });
  const cur = App.find.cur;
  App.find.run($('#find-input').value);
  App.find.go(cur);
});
App.def('replaceAll', () => {
  const q = $('#find-input').value;
  if (!q) return;
  if (App.state.protect) { App.toast('Het document is beveiligd', 'lock'); return; }
  App.history.flush();
  const list = App.find.run(q);
  const rep = $('#replace-input').value;
  for (let i = list.length - 1; i >= 0; i--) {
    if (App.state.track) { App.setRange(list[i]); App.trackDeleteRange(list[i], false); App.trackInsert(rep); continue; }
    list[i].deleteContents();
    list[i].insertNode(document.createTextNode(rep));
  }
  App.ed.normalize();
  App.changed({ immediate: true });
  App.find.run(q); App.find.cur = -1; App.find.paint();
  App.toast(`${list.length} ${list.length === 1 ? 'vervanging' : 'vervangingen'} uitgevoerd`, 'ok');
});
$('#find-input').addEventListener('input', () => { App.find.run($('#find-input').value); App.find.go(0); });
$('#find-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); App.find.go(App.find.cur + (e.shiftKey ? -1 : 1)); }
});
$('#replace-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); App.exec('replaceOne'); } });
['#find-case', '#find-word'].forEach((s) => $(s).addEventListener('change', () => { App.find.run($('#find-input').value); App.find.go(0); }));
App.on('change', App.debounce(() => { if (!$('#find-panel').hidden) App.find.refresh(); }, 300));
